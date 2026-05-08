'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { AuthGuard, useAuth } from '@/components/AuthProvider';
import ScoreBadge from '@/components/ScoreBadge';
import ScoreBreakdown from '@/components/ScoreBreakdown';
import { authenticatedFetch } from '@/lib/api-client';
import { getErrorMessage } from '@/lib/errors';

const BRANCHES = ['CSE', 'ECE', 'IT', 'MECH', 'EEE', 'CIVIL', 'Other'];
const YEARS = [
  { value: '1', label: '1st Year' },
  { value: '2', label: '2nd Year' },
  { value: '3', label: '3rd Year' },
  { value: '4', label: '4th Year' },
];

interface ScoreResult {
  score: number;
  breakdown: {
    dsa: number;
    githubActivity: number;
    projectQuality: number;
    competitive: number;
    consistency: number;
  };
  errors: string[];
}

export default function AddStudentPage() {
  return (
    <AuthGuard>
      <AddStudentContent />
    </AuthGuard>
  );
}

function AddStudentContent() {
  const router = useRouter();
  const { user } = useAuth();

  const [form, setForm] = useState({
    name: '',
    rollNumber: '',
    branch: 'CSE',
    year: '1',
    email: '',
    githubUrl: '',
    leetcodeUrl: '',
    codechefUrl: '',
    codeforcesUrl: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [scoreResult, setScoreResult] = useState<ScoreResult | null>(null);

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setFieldErrors((fe) => ({ ...fe, [key]: '' }));
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = 'Name is required';
    if (!form.rollNumber.trim()) errs.rollNumber = 'Roll number is required';
    if (!form.githubUrl.trim()) errs.githubUrl = 'GitHub URL is required';
    if (!form.leetcodeUrl.trim()) errs.leetcodeUrl = 'LeetCode URL is required';
    return errs;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }

    setSubmitting(true);

    try {
      // Check roll number uniqueness
      const q = query(
        collection(db, 'students'),
        where('rollNumber', '==', form.rollNumber.trim())
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        setFieldErrors({ rollNumber: 'A student with this roll number already exists.' });
        setSubmitting(false);
        return;
      }

      // Add student to Firestore
      const docRef = await addDoc(collection(db, 'students'), {
        name: form.name.trim(),
        rollNumber: form.rollNumber.trim(),
        branch: form.branch,
        year: parseInt(form.year),
        email: form.email.trim(),
        githubUrl: form.githubUrl.trim(),
        leetcodeUrl: form.leetcodeUrl.trim(),
        codechefUrl: form.codechefUrl.trim(),
        codeforcesUrl: form.codeforcesUrl.trim(),
        createdAt: serverTimestamp(),
        lastSyncedAt: null,
      });

      setSubmitting(false);
      setSyncLoading(true);

      // Trigger sync
      const syncRes = await authenticatedFetch(user, `/api/sync/${docRef.id}`, { method: 'POST' });
      const syncData = await syncRes.json();

      setScoreResult({
        score: syncData.score ?? 0,
        breakdown: syncData.breakdown ?? { dsa: 0, githubActivity: 0, projectQuality: 0, competitive: 0, consistency: 0 },
        errors: syncData.errors ?? [],
      });
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
      setSyncLoading(false);
    }
  };

  // Success state
  if (scoreResult !== null) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl border border-gray-100 shadow-lg p-8 max-w-md w-full animate-fade-in-up">
          <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center mb-5">
            <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-[#1a1a2e] mb-1" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Student Added!
          </h2>
          <p className="text-gray-500 text-sm mb-6" style={{ fontFamily: 'DM Sans, sans-serif' }}>
            {form.name} has been added and their scores have been fetched.
          </p>

          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-gray-600" style={{ fontFamily: 'DM Sans, sans-serif' }}>
              Composite Score
            </span>
            <ScoreBadge score={scoreResult.score} showLabel size="lg" />
          </div>

          <div className="mb-6">
            <ScoreBreakdown breakdown={scoreResult.breakdown} />
          </div>

          {scoreResult.errors.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-5">
              <p className="text-amber-800 text-xs font-semibold mb-1" style={{ fontFamily: 'DM Sans, sans-serif' }}>
                Some data could not be fetched:
              </p>
              {scoreResult.errors.map((e, i) => (
                <p key={i} className="text-amber-700 text-xs" style={{ fontFamily: 'DM Sans, sans-serif' }}>• {e}</p>
              ))}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => {
                setForm({ name: '', rollNumber: '', branch: 'CSE', year: '1', email: '', githubUrl: '', leetcodeUrl: '', codechefUrl: '', codeforcesUrl: '' });
                setScoreResult(null);
              }}
              className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              style={{ fontFamily: 'DM Sans, sans-serif' }}
            >
              Add Another
            </button>
            <button
              onClick={() => router.push('/dashboard')}
              className="flex-1 py-2.5 bg-[#4f8ef7] rounded-xl text-sm font-semibold text-white hover:bg-[#3a7cf0] transition-colors"
              style={{ fontFamily: 'DM Sans, sans-serif' }}
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div>
            <h1 className="text-lg font-bold text-[#1a1a2e]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              Add Student
            </h1>
            <p className="text-xs text-gray-400" style={{ fontFamily: 'DM Sans, sans-serif' }}>
              Register a new student and fetch their skill data
            </p>
          </div>
        </div>
      </header>

      {/* Loading overlay for sync */}
      {syncLoading && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center gap-4">
          <div className="w-12 h-12 border-4 border-[#4f8ef7] border-t-transparent rounded-full animate-spin" />
          <div className="text-center">
            <p className="font-semibold text-[#1a1a2e]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              Fetching data from GitHub and LeetCode...
            </p>
            <p className="text-sm text-gray-400 mt-1" style={{ fontFamily: 'DM Sans, sans-serif' }}>
              This may take a few seconds
            </p>
          </div>
        </div>
      )}

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          {/* Personal Info */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-base font-semibold text-[#1a1a2e] mb-5" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              Personal Information
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Full Name *" error={fieldErrors.name}>
                <input
                  type="text"
                  value={form.name}
                  onChange={set('name')}
                  placeholder="Rahul Sharma"
                  className={inputClass(fieldErrors.name)}
                />
              </Field>
              <Field label="Roll Number *" error={fieldErrors.rollNumber}>
                <input
                  type="text"
                  value={form.rollNumber}
                  onChange={set('rollNumber')}
                  placeholder="CSE2021001"
                  className={inputClass(fieldErrors.rollNumber)}
                />
              </Field>
              <Field label="Branch *" error="">
                <select value={form.branch} onChange={set('branch')} className={inputClass('')}>
                  {BRANCHES.map((b) => <option key={b}>{b}</option>)}
                </select>
              </Field>
              <Field label="Year *" error="">
                <select value={form.year} onChange={set('year')} className={inputClass('')}>
                  {YEARS.map((y) => <option key={y.value} value={y.value}>{y.label}</option>)}
                </select>
              </Field>
              <Field label="Email (optional)" error="" className="sm:col-span-2">
                <input
                  type="email"
                  value={form.email}
                  onChange={set('email')}
                  placeholder="rahul@college.edu"
                  className={inputClass('')}
                />
              </Field>
            </div>
          </div>

          {/* Platform URLs */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-base font-semibold text-[#1a1a2e] mb-1" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              Coding Platform Links
            </h2>
            <p className="text-xs text-gray-400 mb-5" style={{ fontFamily: 'DM Sans, sans-serif' }}>
              Paste full profile URLs. GitHub and LeetCode are required.
            </p>
            <div className="flex flex-col gap-4">
              <Field label="GitHub Profile URL *" error={fieldErrors.githubUrl}>
                <input
                  type="url"
                  value={form.githubUrl}
                  onChange={set('githubUrl')}
                  placeholder="https://github.com/username"
                  className={inputClass(fieldErrors.githubUrl)}
                />
              </Field>
              <Field label="LeetCode Profile URL *" error={fieldErrors.leetcodeUrl}>
                <input
                  type="url"
                  value={form.leetcodeUrl}
                  onChange={set('leetcodeUrl')}
                  placeholder="https://leetcode.com/u/username/"
                  className={inputClass(fieldErrors.leetcodeUrl)}
                />
              </Field>
              <Field label="CodeChef Profile URL (optional)" error="">
                <input
                  type="url"
                  value={form.codechefUrl}
                  onChange={set('codechefUrl')}
                  placeholder="https://www.codechef.com/users/username"
                  className={inputClass('')}
                />
              </Field>
              <Field label="Codeforces Profile URL (optional)" error="">
                <input
                  type="url"
                  value={form.codeforcesUrl}
                  onChange={set('codeforcesUrl')}
                  placeholder="https://codeforces.com/profile/username"
                  className={inputClass('')}
                />
              </Field>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm" style={{ fontFamily: 'DM Sans, sans-serif' }}>
              {error}
            </div>
          )}

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              style={{ fontFamily: 'DM Sans, sans-serif' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || syncLoading}
              className="px-6 py-2.5 bg-[#4f8ef7] text-white rounded-xl text-sm font-semibold hover:bg-[#3a7cf0] transition-colors disabled:opacity-60 flex items-center gap-2"
              style={{ fontFamily: 'DM Sans, sans-serif' }}
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                'Add & Fetch Scores'
              )}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

function inputClass(error: string) {
  return `w-full px-3 py-2.5 border rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#4f8ef7] transition-all ${
    error ? 'border-red-300 bg-red-50' : 'border-gray-200'
  }`;
}

function Field({
  label,
  error,
  children,
  className = '',
}: {
  label: string;
  error: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-gray-600 mb-1.5" style={{ fontFamily: 'DM Sans, sans-serif' }}>
        {label}
      </label>
      {children}
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
}
