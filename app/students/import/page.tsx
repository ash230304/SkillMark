'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { AuthGuard, useAuth } from '@/components/AuthProvider';
import { parseCSV, fetchCSVFromUrl, CSVStudent } from '@/lib/csv';
import { authenticatedFetch } from '@/lib/api-client';
import { getErrorMessage } from '@/lib/errors';

interface ImportResult {
  success: number;
  failed: number;
  errors: { row: number; name: string; reason: string }[];
}

export default function ImportPage() {
  return (
    <AuthGuard>
      <ImportContent />
    </AuthGuard>
  );
}

function ImportContent() {
  const router = useRouter();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<'url' | 'file'>('file');
  const [csvUrl, setCsvUrl] = useState('');
  const [previewRows, setPreviewRows] = useState<CSVStudent[] | null>(null);
  const [allRows, setAllRows] = useState<CSVStudent[]>([]);
  const [invalidRows, setInvalidRows] = useState<{ row: number; reason: string; data: Record<string, string> }[]>([]);

  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState('');

  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0, name: '' });
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState('');

  const handleCSVText = (text: string) => {
    const { valid, invalid } = parseCSV(text);
    setAllRows(valid);
    setInvalidRows(invalid);
    setPreviewRows(valid.slice(0, 5));
    setImportResult(null);
  };

  const handleFileUpload = (file: File) => {
    if (!file.name.endsWith('.csv')) {
      setError('Please upload a .csv file');
      return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => handleCSVText(e.target?.result as string);
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  };

  const handleUrlPreview = async () => {
    setError('');
    try {
      const text = await fetchCSVFromUrl(csvUrl.trim());
      handleCSVText(text);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    }
  };

  const handleImport = useCallback(async () => {
    if (allRows.length === 0) return;
    setImporting(true);
    setImportProgress({ current: 0, total: allRows.length, name: '' });

    const errors: ImportResult['errors'] = [];
    let successCount = 0;
    const newStudentIds: string[] = [];

    for (let i = 0; i < allRows.length; i++) {
      const row = allRows[i];
      setImportProgress({ current: i + 1, total: allRows.length, name: row.name });

      try {
        // Check uniqueness
        const q = query(collection(db, 'students'), where('rollNumber', '==', row.roll_number));
        const snap = await getDocs(q);
        if (!snap.empty) {
          errors.push({ row: i + 2, name: row.name, reason: 'Roll number already exists' });
          continue;
        }

        const docRef = await addDoc(collection(db, 'students'), {
          name: row.name,
          rollNumber: row.roll_number,
          branch: row.branch || 'Other',
          year: parseInt(row.year) || 1,
          email: row.email || '',
          githubUrl: row.github_url,
          leetcodeUrl: row.leetcode_url,
          codechefUrl: row.codechef_url || '',
          codeforcesUrl: row.codeforces_url || '',
          createdAt: serverTimestamp(),
          lastSyncedAt: null,
        });

        newStudentIds.push(docRef.id);
        successCount++;
      } catch (err: unknown) {
        errors.push({ row: i + 2, name: row.name, reason: getErrorMessage(err) });
      }
    }

    setImportResult({ success: successCount, failed: errors.length, errors });
    setImporting(false);

    // Background sync for all new students
    if (newStudentIds.length > 0) {
      // Non-blocking — user sees summary immediately
      (async () => {
        for (const id of newStudentIds) {
          try {
            await authenticatedFetch(user, `/api/sync/${id}`, { method: 'POST' });
          } catch {}
          await new Promise((r) => setTimeout(r, 500));
        }
      })();
    }
  }, [allRows, user]);

  const resetState = () => {
    setPreviewRows(null);
    setAllRows([]);
    setInvalidRows([]);
    setImportResult(null);
    setFileName('');
    setCsvUrl('');
    setError('');
  };

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <button onClick={() => router.back()} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div>
            <h1 className="text-lg font-bold text-[#1a1a2e]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              Import Students
            </h1>
            <p className="text-xs text-gray-400" style={{ fontFamily: 'DM Sans, sans-serif' }}>
              Bulk import from CSV file or Google Sheets
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6">
        {/* Import result */}
        {importResult && (
          <div className={`rounded-2xl border p-6 ${importResult.failed === 0 ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${importResult.failed === 0 ? 'bg-green-100' : 'bg-amber-100'}`}>
                {importResult.failed === 0 ? (
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-800" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                  Import Complete
                </p>
                <p className="text-sm text-gray-600 mt-0.5" style={{ fontFamily: 'DM Sans, sans-serif' }}>
                  {importResult.success} imported successfully
                  {importResult.failed > 0 && `, ${importResult.failed} failed`}
                </p>
                {importResult.errors.length > 0 && (
                  <ul className="mt-3 space-y-1">
                    {importResult.errors.map((e, i) => (
                      <li key={i} className="text-xs text-red-600" style={{ fontFamily: 'DM Sans, sans-serif' }}>
                        Row {e.row} ({e.name}): {e.reason}
                      </li>
                    ))}
                  </ul>
                )}
                <p className="text-xs text-gray-400 mt-2" style={{ fontFamily: 'DM Sans, sans-serif' }}>
                  Scores are being fetched in the background. Check the dashboard shortly.
                </p>
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={resetState} className="text-sm text-gray-600 hover:text-gray-800 underline underline-offset-2">
                Import more
              </button>
              <button onClick={() => router.push('/dashboard')} className="text-sm text-[#4f8ef7] font-semibold">
                Go to Dashboard →
              </button>
            </div>
          </div>
        )}

        {!importResult && (
          <>
            {/* CSV Format info */}
            <div className="bg-[#4f8ef718] rounded-2xl border border-[#4f8ef730] p-4">
              <p className="text-sm font-semibold text-[#4f8ef7] mb-2" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                Expected CSV Columns
              </p>
              <p className="text-xs text-[#1a1a2e] font-mono bg-white/60 rounded-lg px-3 py-2">
                name, roll_number, branch, year, email, github_url, leetcode_url, codechef_url
              </p>
              <p className="text-xs text-gray-500 mt-2" style={{ fontFamily: 'DM Sans, sans-serif' }}>
                Column order is flexible and case-insensitive. Only name, roll_number, github_url, and leetcode_url are required.
              </p>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
              {(['file', 'url'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => { setActiveTab(tab); resetState(); }}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeTab === tab ? 'bg-white text-[#1a1a2e] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  style={{ fontFamily: 'DM Sans, sans-serif' }}
                >
                  {tab === 'file' ? '📁 CSV File Upload' : '🔗 Google Sheets URL'}
                </button>
              ))}
            </div>

            {/* File Upload */}
            {activeTab === 'file' && (
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all ${dragging ? 'border-[#4f8ef7] bg-[#4f8ef710]' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}
              >
                <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center">
                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-700" style={{ fontFamily: 'DM Sans, sans-serif' }}>
                    {fileName ? fileName : 'Drop your CSV file here, or click to browse'}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">.csv files only</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => { if (e.target.files?.[0]) handleFileUpload(e.target.files[0]); }}
                />
              </div>
            )}

            {/* URL import */}
            {activeTab === 'url' && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <p className="text-sm font-semibold text-[#1a1a2e] mb-1" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                  Google Sheets CSV URL
                </p>
                <p className="text-xs text-gray-500 mb-4" style={{ fontFamily: 'DM Sans, sans-serif' }}>
                  In Google Sheets: File → Share → Publish to web → Select CSV format → Copy link
                </p>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={csvUrl}
                    onChange={(e) => setCsvUrl(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/.../pub?output=csv"
                    className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#4f8ef7]"
                    style={{ fontFamily: 'DM Sans, sans-serif' }}
                  />
                  <button
                    onClick={handleUrlPreview}
                    className="px-4 py-2.5 bg-[#4f8ef7] text-white rounded-xl text-sm font-semibold hover:bg-[#3a7cf0] transition-colors whitespace-nowrap"
                    style={{ fontFamily: 'DM Sans, sans-serif' }}
                  >
                    Preview
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm">
                {error}
              </div>
            )}

            {/* Preview Table */}
            {previewRows !== null && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-[#1a1a2e]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                      Preview ({allRows.length} valid rows)
                    </p>
                    {invalidRows.length > 0 && (
                      <p className="text-xs text-red-500 mt-0.5">{invalidRows.length} rows will be skipped (missing required fields)</p>
                    )}
                  </div>
                  <button
                    onClick={handleImport}
                    disabled={importing || allRows.length === 0}
                    className="flex items-center gap-2 bg-[#4f8ef7] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#3a7cf0] transition-colors disabled:opacity-60"
                    style={{ fontFamily: 'DM Sans, sans-serif' }}
                  >
                    {importing ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Importing {importProgress.current}/{importProgress.total}...
                      </>
                    ) : (
                      `Import ${allRows.length} Students`
                    )}
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs" style={{ fontFamily: 'DM Sans, sans-serif' }}>
                    <thead className="bg-gray-50">
                      <tr className="text-gray-500 uppercase tracking-wide">
                        {['Name', 'Roll No', 'Branch', 'Year', 'GitHub', 'LeetCode'].map((h) => (
                          <th key={h} className="px-4 py-2 text-left font-semibold">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {previewRows.map((row, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-4 py-2 font-medium text-gray-700">{row.name}</td>
                          <td className="px-4 py-2 text-gray-500">{row.roll_number}</td>
                          <td className="px-4 py-2 text-gray-500">{row.branch}</td>
                          <td className="px-4 py-2 text-gray-500">{row.year}</td>
                          <td className="px-4 py-2 text-[#4f8ef7] truncate max-w-[120px]">{row.github_url}</td>
                          <td className="px-4 py-2 text-[#4f8ef7] truncate max-w-[120px]">{row.leetcode_url}</td>
                        </tr>
                      ))}
                      {allRows.length > 5 && (
                        <tr>
                          <td colSpan={6} className="px-4 py-2 text-center text-gray-400">
                            + {allRows.length - 5} more rows
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Progress during import */}
            {importing && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-[#1a1a2e]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                    Processing student {importProgress.current} of {importProgress.total}
                  </p>
                  <span className="text-sm text-[#4f8ef7] font-semibold">
                    {Math.round((importProgress.current / importProgress.total) * 100)}%
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2 mb-2">
                  <div
                    className="h-2 bg-[#4f8ef7] rounded-full transition-all duration-300"
                    style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-gray-400 truncate" style={{ fontFamily: 'DM Sans, sans-serif' }}>
                  {importProgress.name}
                </p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
