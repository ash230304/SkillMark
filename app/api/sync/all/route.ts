import { NextRequest } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { syncStudent } from '@/lib/sync';
import { FieldValue } from 'firebase-admin/firestore';
import { requireAdminUser } from '@/lib/api-auth';
import { getErrorMessage } from '@/lib/errors';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function encodeSSE(data: object): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: NextRequest) {
  const authError = await requireAdminUser(request);
  if (authError) return authError;

  const db = getAdminFirestore();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const studentsSnap = await db.collection('students').get();
        const students = studentsSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Array<{ id: string; name: string; githubUrl: string; leetcodeUrl: string; codechefUrl?: string }>;

        const total = students.length;
        let completed = 0;
        let failed = 0;

        controller.enqueue(
          encoder.encode(encodeSSE({ type: 'start', total }))
        );

        for (const student of students) {
          try {
            controller.enqueue(
              encoder.encode(
                encodeSSE({ type: 'progress', progress: completed, total, current: student.name })
              )
            );

            const result = await syncStudent({
              githubUrl: student.githubUrl,
              leetcodeUrl: student.leetcodeUrl,
              codechefUrl: student.codechefUrl || null,
            });

            const scoreRef = db.collection('scores').doc(student.id);
            await scoreRef.set({
              studentId: student.id,
              github: result.github,
              leetcode: result.leetcode,
              codechef: result.codechef,
              compositeScore: result.compositeScore,
              breakdown: result.breakdown,
              calculatedAt: FieldValue.serverTimestamp(),
              syncError: result.syncError,
            });

            await db.collection('students').doc(student.id).update({
              lastSyncedAt: FieldValue.serverTimestamp(),
            });

            completed++;
            controller.enqueue(
              encoder.encode(
                encodeSSE({
                  type: 'progress',
                  progress: completed,
                  total,
                  current: student.name,
                  success: true,
                })
              )
            );
          } catch (err: unknown) {
            failed++;
            completed++;
            controller.enqueue(
              encoder.encode(
                encodeSSE({
                  type: 'error',
                  progress: completed,
                  total,
                  current: student.name,
                  error: getErrorMessage(err),
                })
              )
            );
          }

          // Respect rate limits
          await delay(500);
        }

        controller.enqueue(
          encoder.encode(
            encodeSSE({ type: 'done', total, completed: completed - failed, failed })
          )
        );
      } catch (err: unknown) {
        controller.enqueue(
          encoder.encode(encodeSSE({ type: 'fatal', error: getErrorMessage(err) }))
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
