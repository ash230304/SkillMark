'use client';

import React, { useState } from 'react';
import ScoreBadge from './ScoreBadge';
import ScoreBreakdown from './ScoreBreakdown';

export interface StudentRow {
  id: string;
  rank: number;
  name: string;
  rollNumber: string;
  branch: string;
  year: number;
  compositeScore: number;
  breakdown: {
    dsa: number;
    githubActivity: number;
    projectQuality: number;
    competitive: number;
    consistency: number;
  };
  lastSyncedAt?: Date | null;
  syncError?: boolean;
}

type SortKey = 'rank' | 'name' | 'compositeScore' | 'breakdown.dsa' | 'breakdown.githubActivity' | 'breakdown.competitive' | 'breakdown.consistency';

interface StudentTableProps {
  students: StudentRow[];
  onResync: (id: string, name: string) => void;
  resyncingIds: Set<string>;
}

function MedalIcon({ rank }: { rank: number }) {
  const medals: Record<number, { emoji: string; color: string }> = {
    1: { emoji: '🥇', color: '#f59e0b' },
    2: { emoji: '🥈', color: '#94a3b8' },
    3: { emoji: '🥉', color: '#cd7c2f' },
  };
  if (medals[rank]) {
    return <span className="text-lg">{medals[rank].emoji}</span>;
  }
  return <span className="text-sm font-semibold text-gray-500 w-6 text-center">{rank}</span>;
}

function timeSince(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

type SortDir = 'asc' | 'desc';

function getNestedValue(obj: StudentRow, key: SortKey): number | string {
  if (key === 'breakdown.dsa') return obj.breakdown.dsa;
  if (key === 'breakdown.githubActivity') return obj.breakdown.githubActivity;
  if (key === 'breakdown.competitive') return obj.breakdown.competitive;
  if (key === 'breakdown.consistency') return obj.breakdown.consistency;
  return (obj as any)[key];
}

export default function StudentTable({ students, onResync, resyncingIds }: StudentTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('rank');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'name' ? 'asc' : 'desc');
    }
  };

  const sorted = [...students].sort((a, b) => {
    const av = getNestedValue(a, sortKey);
    const bv = getNestedValue(b, sortKey);
    const cmp = typeof av === 'string' ? av.localeCompare(bv as string) : (av as number) - (bv as number);
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <span className="text-gray-300 ml-1">↕</span>;
    return <span className="text-[#4f8ef7] ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  const ThButton = ({ label, k }: { label: string; k: SortKey }) => (
    <button
      onClick={() => handleSort(k)}
      className="flex items-center whitespace-nowrap hover:text-[#4f8ef7] transition-colors text-left"
    >
      {label}<SortIcon k={k} />
    </button>
  );

  if (students.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 flex flex-col items-center justify-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-[#4f8ef718] flex items-center justify-center">
          <svg className="w-8 h-8 text-[#4f8ef7]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold text-[#1a1a2e] mb-1" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            No students found
          </p>
          <p className="text-sm text-gray-500" style={{ fontFamily: 'DM Sans, sans-serif' }}>
            Try adjusting your filters or add new students
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px]" style={{ fontFamily: 'DM Sans, sans-serif' }}>
          <thead className="sticky top-0 bg-gray-50 border-b border-gray-100 z-10">
            <tr className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <th className="px-4 py-3 text-left"><ThButton label="Rank" k="rank" /></th>
              <th className="px-4 py-3 text-left"><ThButton label="Name" k="name" /></th>
              <th className="px-4 py-3 text-left">Roll No</th>
              <th className="px-4 py-3 text-left">Branch</th>
              <th className="px-4 py-3 text-left">Year</th>
              <th className="px-4 py-3 text-right"><ThButton label="DSA" k="breakdown.dsa" /></th>
              <th className="px-4 py-3 text-right"><ThButton label="GitHub" k="breakdown.githubActivity" /></th>
              <th className="px-4 py-3 text-right"><ThButton label="Competitive" k="breakdown.competitive" /></th>
              <th className="px-4 py-3 text-right"><ThButton label="Consistency" k="breakdown.consistency" /></th>
              <th className="px-4 py-3 text-right"><ThButton label="Total" k="compositeScore" /></th>
              <th className="px-4 py-3 text-right">Synced</th>
              <th className="px-4 py-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {sorted.map((student) => {
              const isExpanded = expandedId === student.id;
              const isSyncing = resyncingIds.has(student.id);
              return (
                <React.Fragment key={student.id}>
                  <tr
                    onClick={() => setExpandedId(isExpanded ? null : student.id)}
                    className="hover:bg-blue-50/40 cursor-pointer transition-colors duration-150 group"
                  >
                    <td className="px-4 py-3">
                      <MedalIcon rank={student.rank} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <a
                          href={`/students/${student.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="font-semibold text-[#1a1a2e] hover:text-[#4f8ef7] transition-colors"
                        >
                          {student.name}
                        </a>
                        {student.syncError && (
                          <div className="relative group/warn">
                            <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.072 16.5c-.77.833.192 2.5 1.732 2.5z" />
                            </svg>
                            <div className="absolute hidden group-hover/warn:block bottom-full left-1/2 -translate-x-1/2 mb-1 bg-gray-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-20">
                              Last sync had errors
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{student.rollNumber}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-medium bg-blue-50 text-blue-700 rounded-md px-2 py-0.5">
                        {student.branch}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">Y{student.year}</td>
                    <td className="px-4 py-3 text-right text-sm font-medium text-[#4f8ef7]">
                      {student.breakdown.dsa.toFixed(0)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-medium text-teal-600">
                      {student.breakdown.githubActivity.toFixed(0)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-medium text-purple-600">
                      {student.breakdown.competitive.toFixed(0)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-medium text-amber-600">
                      {student.breakdown.consistency.toFixed(0)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <ScoreBadge score={student.compositeScore} />
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-gray-400">
                      {student.lastSyncedAt ? timeSince(student.lastSyncedAt) : '—'}
                    </td>
                    <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <div className="relative group/sync flex justify-center">
                        <button
                          onClick={() => onResync(student.id, student.name)}
                          disabled={isSyncing}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-[#4f8ef718] hover:text-[#4f8ef7] transition-all disabled:opacity-50"
                        >
                          <svg className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        </button>
                        <div className="absolute hidden group-hover/sync:block bottom-full left-1/2 -translate-x-1/2 mb-1 bg-gray-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-20">
                          Re-sync data
                        </div>
                      </div>
                    </td>
                  </tr>

                  {isExpanded && (
                    <tr key={`${student.id}-expanded`} className="bg-blue-50/30">
                      <td colSpan={12} className="px-6 py-4">
                        <div className="max-w-xl">
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3" style={{ fontFamily: 'DM Sans, sans-serif' }}>
                            Score Breakdown
                          </p>
                          <ScoreBreakdown breakdown={student.breakdown} compact />
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
