import Papa from 'papaparse';

export interface CSVStudent {
  name: string;
  roll_number: string;
  branch: string;
  year: string;
  email?: string;
  github_url: string;
  leetcode_url: string;
  codechef_url?: string;
  codeforces_url?: string;
}

export interface CSVParseResult {
  valid: CSVStudent[];
  invalid: { row: number; reason: string; data: Record<string, string> }[];
}

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/\s+/g, '_').trim();
}

function normalizeRow(row: Record<string, string>): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(row)) {
    normalized[normalizeKey(key)] = (value ?? '').trim();
  }
  return normalized;
}

export function parseCSV(csvText: string): CSVParseResult {
  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => normalizeKey(header),
  });

  const valid: CSVStudent[] = [];
  const invalid: CSVParseResult['invalid'] = [];

  result.data.forEach((row, index) => {
    const r = normalizeRow(row);
    const rowNum = index + 2; // 1-indexed + header row

    if (!r.name) {
      invalid.push({ row: rowNum, reason: 'Missing name', data: r });
      return;
    }
    if (!r.roll_number) {
      invalid.push({ row: rowNum, reason: 'Missing roll_number', data: r });
      return;
    }
    if (!r.github_url) {
      invalid.push({ row: rowNum, reason: 'Missing github_url', data: r });
      return;
    }
    if (!r.leetcode_url) {
      invalid.push({ row: rowNum, reason: 'Missing leetcode_url', data: r });
      return;
    }

    valid.push({
      name: r.name,
      roll_number: r.roll_number,
      branch: r.branch || 'Other',
      year: r.year || '1',
      email: r.email || '',
      github_url: r.github_url,
      leetcode_url: r.leetcode_url,
      codechef_url: r.codechef_url || '',
      codeforces_url: r.codeforces_url || '',
    });
  });

  return { valid, invalid };
}

export async function fetchCSVFromUrl(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch CSV: HTTP ${res.status}`);
  const text = await res.text();
  return text;
}

export function generateExportCSV(
  students: Array<{
    rank: number;
    name: string;
    rollNumber: string;
    branch: string;
    year: number;
    breakdown: { dsa: number; githubActivity: number; competitive: number; consistency: number };
    compositeScore: number;
    lastSyncedAt?: string;
  }>
): string {
  const headers = [
    'Rank',
    'Name',
    'Roll No',
    'Branch',
    'Year',
    'DSA Score',
    'GitHub Score',
    'Competitive Score',
    'Consistency Score',
    'Total Score',
    'Last Synced',
  ];

  const rows = students.map((s) => [
    s.rank,
    s.name,
    s.rollNumber,
    s.branch,
    s.year,
    s.breakdown.dsa.toFixed(1),
    s.breakdown.githubActivity.toFixed(1),
    s.breakdown.competitive.toFixed(1),
    s.breakdown.consistency.toFixed(1),
    s.compositeScore.toFixed(1),
    s.lastSyncedAt ?? 'Never',
  ]);

  return Papa.unparse({ fields: headers, data: rows });
}
