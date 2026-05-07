import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { generateExportCSV } from '@/lib/csv';

export async function GET(request: NextRequest) {
  try {
    const db = getAdminFirestore();
    const { searchParams } = new URL(request.url);

    const branch = searchParams.get('branch') || '';
    const year = searchParams.get('year') || '';
    const minScore = parseFloat(searchParams.get('minScore') || '0');
    const search = (searchParams.get('search') || '').toLowerCase();

    // Fetch all students
    const studentsSnap = await db.collection('students').get();
    const students = studentsSnap.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as {
        name: string;
        rollNumber: string;
        branch: string;
        year: number;
        lastSyncedAt?: FirebaseFirestore.Timestamp;
      }),
    }));

    // Fetch all scores
    const scoresSnap = await db.collection('scores').get();
    const scoresMap = new Map<string, any>();
    scoresSnap.docs.forEach((doc) => {
      scoresMap.set(doc.id, doc.data());
    });

    // Combine and filter
    let combined = students
      .map((s) => {
        const score = scoresMap.get(s.id);
        return {
          id: s.id,
          name: s.name,
          rollNumber: s.rollNumber,
          branch: s.branch,
          year: s.year,
          compositeScore: score?.compositeScore ?? 0,
          breakdown: score?.breakdown ?? {
            dsa: 0,
            githubActivity: 0,
            projectQuality: 0,
            competitive: 0,
            consistency: 0,
          },
          lastSyncedAt: s.lastSyncedAt
            ? s.lastSyncedAt.toDate().toISOString()
            : undefined,
        };
      })
      .filter((s) => {
        if (branch && s.branch !== branch) return false;
        if (year && String(s.year) !== year) return false;
        if (s.compositeScore < minScore) return false;
        if (
          search &&
          !s.name.toLowerCase().includes(search) &&
          !s.rollNumber.toLowerCase().includes(search)
        )
          return false;
        return true;
      })
      .sort((a, b) => b.compositeScore - a.compositeScore)
      .map((s, i) => ({ ...s, rank: i + 1 }));

    const csv = generateExportCSV(combined);

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="skillmark-export.csv"',
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
