import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { syncStudent } from '@/lib/sync';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  const { studentId } = await params;

  try {
    const db = getAdminFirestore();
    const studentRef = db.collection('students').doc(studentId);
    const studentSnap = await studentRef.get();

    if (!studentSnap.exists) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    const student = studentSnap.data()!;

    const result = await syncStudent({
      githubUrl: student.githubUrl,
      leetcodeUrl: student.leetcodeUrl,
      codechefUrl: student.codechefUrl || null,
    });

    // Save score to Firestore
    const scoreRef = db.collection('scores').doc(studentId);
    await scoreRef.set({
      studentId,
      github: result.github,
      leetcode: result.leetcode,
      codechef: result.codechef,
      compositeScore: result.compositeScore,
      breakdown: result.breakdown,
      calculatedAt: FieldValue.serverTimestamp(),
      syncError: result.syncError,
    });

    // Update student's lastSyncedAt
    await studentRef.update({
      lastSyncedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      success: result.success,
      score: result.compositeScore,
      breakdown: result.breakdown,
      errors: result.errors,
    });
  } catch (err: any) {
    console.error('[sync/studentId] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
