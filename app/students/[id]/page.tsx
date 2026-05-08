'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { AuthGuard, useAuth } from '@/components/AuthProvider';
import ScoreBadge, { getScoreCategory } from '@/components/ScoreBadge';
import ScoreBreakdown from '@/components/ScoreBreakdown';
import { CardSkeleton } from '@/components/SkeletonLoader';
import { authenticatedFetch } from '@/lib/api-client';

interface StudentData {
  name: string;
  rollNumber: string;
  branch: string;
  year: number;
  email?: string;
  githubUrl: string;
  leetcodeUrl: string;
  codechefUrl?: string;
  lastSyncedAt?: Timestamp;
}

interface ScoreData {
  compositeScore: number;
  breakdown: {
    dsa: number;
    githubActivity: number;
    projectQuality: number;
    competitive: number;
    consistency: number;
  };
  github: {
    repos: number;
    commits6m: number;
    stars: number;
    languages: Record<string, number>;
    reposWithReadme: number;
  } | null;
  leetcode: {
    totalSolved: number;
    easy: number;
    medium: number;
    hard: number;
    contestRating: number | null;
  } | null;
  codechef: {
    rating: number | null;
    problemsSolved: number | null;
  } | null;
  syncError?: boolean;
  calculatedAt?: Timestamp;
}

const LANG_COLORS: Record<string, string> = {
  JavaScript: '#f1e05a',
  TypeScript: '#2b7489',
  Python: '#3572A5',
  Java: '#b07219',
  'C++': '#f34b7d',
  C: '#555555',
  Go: '#00ADD8',
  Rust: '#dea584',
  Dart: '#00B4AB',
  Swift: '#ffac45',
  Kotlin: '#F18E33',
  Ruby: '#701516',
  PHP: '#4F5D95',
  HTML: '#e34c26',
  CSS: '#563d7c',
  Shell: '#89e051',
};

function getStarRating(rating: number): string {
  if (rating >= 2500) return '★★★★★★★';
  if (rating >= 2000) return '★★★★★★';
  if (rating >= 1800) return '★★★★★';
  if (rating >= 1600) return '★★★★';
  if (rating >= 1400) return '★★★';
  if (rating >= 1200) return '★★';
  return '★';
}

function DonutChart({ easy, medium, hard }: { easy: number; medium: number; hard: number }) {
  const total = easy + medium + hard;
  if (total === 0) return (
    <div className="w-32 h-32 rounded-full border-8 border-gray-100 flex items-center justify-center">
      <span className="text-sm text-gray-400">None</span>
    </div>
  );

  const easyPct = (easy / total) * 100;
  const medPct = (medium / total) * 100;
  // Build conic-gradient
  const gradient = `conic-gradient(
    #22c55e 0% ${easyPct}%,
    #f59e0b ${easyPct}% ${easyPct + medPct}%,
    #ef4444 ${easyPct + medPct}% 100%
  )`;

  return (
    <div className="relative w-32 h-32 flex-shrink-0">
      <div
        className="w-full h-full rounded-full"
        style={{ background: gradient }}
      />
      <div className="absolute inset-3 bg-white rounded-full flex flex-col items-center justify-center">
        <span className="text-xl font-bold text-[#1a1a2e]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
          {total}
        </span>
        <span className="text-[10px] text-gray-400 font-medium">solved</span>
      </div>
    </div>
  );
}

export default function StudentDetailPage() {
  return (
    <AuthGuard>
      <StudentDetailContent />
    </AuthGuard>
  );
}

function StudentDetailContent() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const id = params.id as string;

  const [student, setStudent] = useState<StudentData | null>(null);
  const [score, setScore] = useState<ScoreData | null>(null);
  const [loading, setLoading] = useState(true);
  const [resyncing, setResyncing] = useState(false);

  useEffect(() => {
    async function load() {
      const [studentSnap, scoreSnap] = await Promise.all([
        getDoc(doc(db, 'students', id)),
        getDoc(doc(db, 'scores', id)),
      ]);
      if (studentSnap.exists()) setStudent(studentSnap.data() as StudentData);
      if (scoreSnap.exists()) setScore(scoreSnap.data() as ScoreData);
      setLoading(false);
    }
    load();
  }, [id]);

  const handleResync = async () => {
    setResyncing(true);
    try {
      const res = await authenticatedFetch(user, `/api/sync/${id}`, { method: 'POST' });
      if (!res.ok) throw new Error('Sync failed');
      // Reload page data
      const scoreSnap = await getDoc(doc(db, 'scores', id));
      if (scoreSnap.exists()) setScore(scoreSnap.data() as ScoreData);
    } finally {
      setResyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] p-6 max-w-3xl mx-auto flex flex-col gap-4">
        <CardSkeleton lines={3} />
        <CardSkeleton lines={5} />
        <CardSkeleton lines={4} />
      </div>
    );
  }

  if (!student) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500" style={{ fontFamily: 'DM Sans, sans-serif' }}>Student not found.</p>
          <button onClick={() => router.push('/dashboard')} className="mt-3 text-[#4f8ef7] text-sm">
            ← Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const initials = student.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
  const { bg, text } = score ? getScoreCategory(score.compositeScore) : { bg: '#f1f5f9', text: '#64748b' };
  const topLangs = score?.github?.languages
    ? Object.entries(score.github.languages).sort((a, b) => b[1] - a[1]).slice(0, 6)
    : [];

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <button
            onClick={() => router.push('/dashboard')}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <span className="text-sm text-gray-400" style={{ fontFamily: 'DM Sans, sans-serif' }}>
            Dashboard / Student Detail
          </span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-5">
        {/* Student Header Card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-start gap-5">
            {/* Avatar */}
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold flex-shrink-0"
              style={{ backgroundColor: bg, color: text, fontFamily: 'Space Grotesk, sans-serif' }}
            >
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between flex-wrap gap-2">
                <div>
                  <h1 className="text-2xl font-bold text-[#1a1a2e]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                    {student.name}
                  </h1>
                  <p className="text-gray-500 text-sm" style={{ fontFamily: 'DM Sans, sans-serif' }}>
                    {student.rollNumber}
                  </p>
                </div>
                {score && <ScoreBadge score={score.compositeScore} showLabel size="lg" />}
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                <span className="text-xs font-medium bg-blue-50 text-blue-700 rounded-md px-2 py-1">
                  {student.branch}
                </span>
                <span className="text-xs font-medium bg-purple-50 text-purple-700 rounded-md px-2 py-1">
                  Year {student.year}
                </span>
                {student.email && (
                  <span className="text-xs font-medium bg-gray-50 text-gray-600 rounded-md px-2 py-1">
                    {student.email}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-5 pt-5 border-t border-gray-50">
            <button
              onClick={handleResync}
              disabled={resyncing}
              className="flex items-center gap-2 bg-[#4f8ef7] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#3a7cf0] transition-colors disabled:opacity-60"
              style={{ fontFamily: 'DM Sans, sans-serif' }}
            >
              <svg className={`w-4 h-4 ${resyncing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {resyncing ? 'Re-syncing...' : 'Re-sync Data'}
            </button>
            <a
              href={student.githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 border border-gray-200 text-gray-600 px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
              style={{ fontFamily: 'DM Sans, sans-serif' }}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
              GitHub
            </a>
            <a
              href={student.leetcodeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 border border-gray-200 text-gray-600 px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
              style={{ fontFamily: 'DM Sans, sans-serif' }}
            >
              LeetCode ↗
            </a>
          </div>
        </div>

        {/* Score Breakdown */}
        {score && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-base font-semibold text-[#1a1a2e] mb-5" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              Score Breakdown
            </h2>
            <ScoreBreakdown breakdown={score.breakdown} />
          </div>
        )}

        {/* GitHub Section */}
        {score?.github && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
              </div>
              <h2 className="text-base font-semibold text-[#1a1a2e]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                GitHub Activity
              </h2>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-5">
              {[
                { label: 'Repositories', value: score.github.repos },
                { label: 'Commits (6m)', value: score.github.commits6m },
                { label: 'Total Stars', value: score.github.stars },
              ].map(({ label, value }) => (
                <div key={label} className="text-center p-3 bg-gray-50 rounded-xl">
                  <p className="text-2xl font-bold text-[#1a1a2e]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                    {value}
                  </p>
                  <p className="text-xs text-gray-500 mt-1" style={{ fontFamily: 'DM Sans, sans-serif' }}>
                    {label}
                  </p>
                </div>
              ))}
            </div>

            {topLangs.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2" style={{ fontFamily: 'DM Sans, sans-serif' }}>
                  Top Languages
                </p>
                <div className="flex flex-wrap gap-2">
                  {topLangs.map(([lang, count]) => (
                    <span
                      key={lang}
                      className="text-xs font-medium px-2.5 py-1 rounded-full text-white"
                      style={{ backgroundColor: LANG_COLORS[lang] || '#4f8ef7' }}
                    >
                      {lang} ({count})
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* LeetCode Section */}
        {score?.leetcode && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
                <span className="text-white text-xs font-bold">LC</span>
              </div>
              <h2 className="text-base font-semibold text-[#1a1a2e]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                LeetCode
              </h2>
            </div>

            <div className="flex items-center gap-8">
              <DonutChart
                easy={score.leetcode.easy}
                medium={score.leetcode.medium}
                hard={score.leetcode.hard}
              />
              <div className="flex flex-col gap-3">
                {[
                  { label: 'Easy', value: score.leetcode.easy, color: '#22c55e' },
                  { label: 'Medium', value: score.leetcode.medium, color: '#f59e0b' },
                  { label: 'Hard', value: score.leetcode.hard, color: '#ef4444' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                    <span className="text-sm text-gray-600 w-14" style={{ fontFamily: 'DM Sans, sans-serif' }}>{label}</span>
                    <span className="text-sm font-semibold text-[#1a1a2e]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>{value}</span>
                  </div>
                ))}
                {score.leetcode.contestRating && (
                  <div className="mt-2 pt-2 border-t border-gray-100">
                    <p className="text-xs text-gray-500" style={{ fontFamily: 'DM Sans, sans-serif' }}>Contest Rating</p>
                    <p className="text-lg font-bold text-[#4f8ef7]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                      {score.leetcode.contestRating}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* CodeChef Section */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 bg-amber-600 rounded-lg flex items-center justify-center">
              <span className="text-white text-xs font-bold">CC</span>
            </div>
            <h2 className="text-base font-semibold text-[#1a1a2e]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              CodeChef
            </h2>
          </div>

          {student.codechefUrl && score?.codechef ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-amber-50 rounded-xl">
                <p className="text-2xl font-bold text-amber-700" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                  {score.codechef.rating ?? '—'}
                </p>
                <p className="text-xs text-amber-600 mt-1" style={{ fontFamily: 'DM Sans, sans-serif' }}>
                  Rating {score.codechef.rating ? getStarRating(score.codechef.rating) : ''}
                </p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-xl">
                <p className="text-2xl font-bold text-[#1a1a2e]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                  {score.codechef.problemsSolved ?? '—'}
                </p>
                <p className="text-xs text-gray-500 mt-1" style={{ fontFamily: 'DM Sans, sans-serif' }}>
                  Problems Solved
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-500" style={{ fontFamily: 'DM Sans, sans-serif' }}>Not connected</p>
              <p className="text-xs text-gray-400 mt-1" style={{ fontFamily: 'DM Sans, sans-serif' }}>
                No CodeChef profile URL provided
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
