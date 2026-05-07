'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { collection, onSnapshot, query, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth, AuthGuard } from '@/components/AuthProvider';
import StudentTable, { StudentRow } from '@/components/StudentTable';
import StatCard from '@/components/StatCard';
import FilterBar from '@/components/FilterBar';
import SyncProgress from '@/components/SyncProgress';
import { TableSkeleton, StatCardSkeleton } from '@/components/SkeletonLoader';

interface StudentDoc {
  id: string;
  name: string;
  rollNumber: string;
  branch: string;
  year: number;
  lastSyncedAt?: Timestamp;
}

interface ScoreDoc {
  studentId: string;
  compositeScore: number;
  breakdown: {
    dsa: number;
    githubActivity: number;
    projectQuality: number;
    competitive: number;
    consistency: number;
  };
  syncError?: boolean;
  calculatedAt?: Timestamp;
}

interface SyncProgressState {
  active: boolean;
  progress: number;
  total: number;
  currentName: string;
  isComplete: boolean;
  failed: number;
}

export default function DashboardPage() {
  return (
    <AuthGuard>
      <DashboardContent />
    </AuthGuard>
  );
}

function DashboardContent() {
  const { signOut } = useAuth();
  const router = useRouter();

  const [students, setStudents] = useState<StudentDoc[]>([]);
  const [scores, setScores] = useState<Map<string, ScoreDoc>>(new Map());
  const [loading, setLoading] = useState(true);

  // Filters
  const [branch, setBranch] = useState('');
  const [year, setYear] = useState('');
  const [minScore, setMinScore] = useState('');
  const [search, setSearch] = useState('');

  // Sync state
  const [resyncingIds, setResyncingIds] = useState<Set<string>>(new Set());
  const [syncProgress, setSyncProgress] = useState<SyncProgressState>({
    active: false,
    progress: 0,
    total: 0,
    currentName: '',
    isComplete: false,
    failed: 0,
  });

  // Real-time Firestore listeners
  useEffect(() => {
    const unsubStudents = onSnapshot(
      query(collection(db, 'students')),
      (snap) => {
        const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as StudentDoc));
        setStudents(docs);
        setLoading(false);
      },
      (err) => {
        console.error('Students listener error:', err);
        setLoading(false);
      }
    );

    const unsubScores = onSnapshot(
      query(collection(db, 'scores')),
      (snap) => {
        const map = new Map<string, ScoreDoc>();
        snap.docs.forEach((d) => map.set(d.id, d.data() as ScoreDoc));
        setScores(map);
      }
    );

    return () => {
      unsubStudents();
      unsubScores();
    };
  }, []);

  // Build combined rows
  const allRows: StudentRow[] = students
    .map((s) => {
      const score = scores.get(s.id);
      return {
        id: s.id,
        rank: 0,
        name: s.name,
        rollNumber: s.rollNumber,
        branch: s.branch,
        year: s.year,
        compositeScore: score?.compositeScore ?? 0,
        breakdown: score?.breakdown ?? { dsa: 0, githubActivity: 0, projectQuality: 0, competitive: 0, consistency: 0 },
        lastSyncedAt: s.lastSyncedAt ? s.lastSyncedAt.toDate() : null,
        syncError: score?.syncError ?? false,
      };
    })
    .sort((a, b) => b.compositeScore - a.compositeScore)
    .map((row, i) => ({ ...row, rank: i + 1 }));

  // Apply filters
  const filteredRows = allRows.filter((s) => {
    if (branch && s.branch !== branch) return false;
    if (year && String(s.year) !== year) return false;
    if (minScore && s.compositeScore < parseFloat(minScore)) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!s.name.toLowerCase().includes(q) && !s.rollNumber.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // Stats
  const totalStudents = allRows.length;
  const avgScore = totalStudents > 0
    ? (allRows.reduce((sum, s) => sum + s.compositeScore, 0) / totalStudents).toFixed(1)
    : '—';
  const topScorer = allRows[0] ?? null;
  const placementReady = allRows.filter((s) => s.compositeScore >= 70).length;

  // Last synced
  const lastSyncedDates = students
    .map((s) => s.lastSyncedAt?.toDate())
    .filter(Boolean) as Date[];
  const latestSync = lastSyncedDates.length > 0
    ? new Date(Math.max(...lastSyncedDates.map((d) => d.getTime())))
    : null;

  function formatLastSync(date: Date | null): string {
    if (!date) return 'Never synced';
    const diff = Date.now() - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Last synced just now';
    if (mins < 60) return `Last synced ${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `Last synced ${hrs}h ago`;
    return `Last synced ${Math.floor(hrs / 24)}d ago`;
  }

  // Single resync
  const handleResync = useCallback(async (id: string, name: string) => {
    setResyncingIds((prev) => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/sync/${id}`, { method: 'POST' });
      if (!res.ok) throw new Error('Sync failed');
    } catch (err) {
      console.error('Resync error:', err);
    } finally {
      setResyncingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, []);

  // Bulk sync with SSE
  const handleSyncAll = useCallback(async () => {
    if (students.length === 0) return;

    setSyncProgress({
      active: true,
      progress: 0,
      total: students.length,
      currentName: 'Starting...',
      isComplete: false,
      failed: 0,
    });

    try {
      const res = await fetch('/api/sync/all', { method: 'POST' });
      if (!res.body) throw new Error('No response body');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const dataLine = line.replace(/^data: /, '').trim();
          if (!dataLine) continue;
          try {
            const msg = JSON.parse(dataLine);
            if (msg.type === 'progress' || msg.type === 'error') {
              setSyncProgress((prev) => ({
                ...prev,
                progress: msg.progress,
                currentName: msg.current,
                failed: msg.type === 'error' ? prev.failed + 1 : prev.failed,
              }));
            }
            if (msg.type === 'done') {
              setSyncProgress((prev) => ({
                ...prev,
                progress: msg.total,
                isComplete: true,
                failed: msg.failed,
              }));
            }
          } catch {}
        }
      }
    } catch (err) {
      console.error('Sync all error:', err);
      setSyncProgress((prev) => ({ ...prev, isComplete: true }));
    }
  }, [students.length]);

  // CSV Export
  const handleExport = () => {
    const params = new URLSearchParams();
    if (branch) params.set('branch', branch);
    if (year) params.set('year', year);
    if (minScore) params.set('minScore', minScore);
    if (search) params.set('search', search);
    window.location.href = `/api/export?${params.toString()}`;
  };

  const handleLogout = async () => {
    await signOut();
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      {/* Top Bar */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40 shadow-sm">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-4">
          {/* Logo */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="w-8 h-8 bg-[#4f8ef7] rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
            </div>
            <span className="font-bold text-[#1a1a2e] text-lg hidden sm:block" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              SkillMark
            </span>
          </div>

          {/* Last synced */}
          <div className="flex-1 text-center hidden md:block">
            <span className="text-sm text-gray-400" style={{ fontFamily: 'DM Sans, sans-serif' }}>
              {formatLastSync(latestSync)}
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 ml-auto">
            <a
              href="/students/add"
              className="hidden sm:flex items-center gap-1.5 text-sm font-medium text-[#4f8ef7] hover:bg-[#4f8ef718] px-3 py-1.5 rounded-lg transition-colors"
              style={{ fontFamily: 'DM Sans, sans-serif' }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Student
            </a>
            <a
              href="/students/import"
              className="hidden sm:flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 px-3 py-1.5 rounded-lg transition-colors"
              style={{ fontFamily: 'DM Sans, sans-serif' }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Import
            </a>
            <button
              onClick={handleSyncAll}
              disabled={syncProgress.active && !syncProgress.isComplete}
              className="flex items-center gap-1.5 text-sm font-semibold bg-[#4f8ef7] text-white px-3 py-1.5 rounded-lg hover:bg-[#3a7cf0] transition-colors disabled:opacity-60"
              style={{ fontFamily: 'DM Sans, sans-serif' }}
            >
              <svg className={`w-4 h-4 ${syncProgress.active && !syncProgress.isComplete ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Sync All
            </button>
            <button
              onClick={handleLogout}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
              title="Sign out"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">
        {/* Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
          ) : (
            <>
              <StatCard
                title="Total Students"
                value={totalStudents}
                subtitle="Registered in the platform"
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                }
                accent="#4f8ef7"
              />
              <StatCard
                title="Average Score"
                value={avgScore}
                subtitle="Across all students"
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                }
                accent="#14b8a6"
              />
              <StatCard
                title="Top Scorer"
                value={topScorer ? topScorer.compositeScore.toFixed(1) : '—'}
                subtitle={topScorer ? topScorer.name : 'No students yet'}
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                }
                accent="#f59e0b"
              />
              <StatCard
                title="Placement Ready"
                value={placementReady}
                subtitle="Students with score ≥ 70"
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                }
                accent="#22c55e"
              />
            </>
          )}
        </div>

        {/* Filters + Export */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <FilterBar
              branch={branch}
              year={year}
              minScore={minScore}
              search={search}
              onBranchChange={setBranch}
              onYearChange={setYear}
              onMinScoreChange={setMinScore}
              onSearchChange={setSearch}
            />
          </div>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors shadow-sm flex-shrink-0 self-end"
            style={{ fontFamily: 'DM Sans, sans-serif' }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export CSV
          </button>
        </div>

        {/* Table */}
        {loading ? (
          <TableSkeleton />
        ) : (
          <>
            <div className="flex items-center justify-between px-1">
              <p className="text-sm text-gray-500" style={{ fontFamily: 'DM Sans, sans-serif' }}>
                Showing <span className="font-semibold text-gray-700">{filteredRows.length}</span> of{' '}
                <span className="font-semibold text-gray-700">{totalStudents}</span> students
              </p>
            </div>
            <StudentTable
              students={filteredRows}
              onResync={handleResync}
              resyncingIds={resyncingIds}
            />
          </>
        )}
      </main>

      {/* Sync Progress Toast */}
      {syncProgress.active && (
        <SyncProgress
          progress={syncProgress.progress}
          total={syncProgress.total}
          currentName={syncProgress.currentName}
          isComplete={syncProgress.isComplete}
          failed={syncProgress.failed}
          onClose={() => setSyncProgress((prev) => ({ ...prev, active: false }))}
        />
      )}
    </div>
  );
}
