'use client';

interface FilterBarProps {
  branch: string;
  year: string;
  minScore: string;
  search: string;
  onBranchChange: (v: string) => void;
  onYearChange: (v: string) => void;
  onMinScoreChange: (v: string) => void;
  onSearchChange: (v: string) => void;
}

const BRANCHES = ['All', 'CSE', 'ECE', 'IT', 'MECH', 'EEE', 'CIVIL', 'Other'];
const YEARS = [
  { value: '', label: 'All Years' },
  { value: '1', label: '1st Year' },
  { value: '2', label: '2nd Year' },
  { value: '3', label: '3rd Year' },
  { value: '4', label: '4th Year' },
];

export default function FilterBar({
  branch, year, minScore, search,
  onBranchChange, onYearChange, onMinScoreChange, onSearchChange,
}: FilterBarProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 flex flex-wrap gap-3 items-center shadow-sm">
      {/* Branch */}
      <div className="flex flex-col gap-1 min-w-[130px]">
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide" style={{ fontFamily: 'DM Sans, sans-serif' }}>
          Branch
        </label>
        <select
          value={branch}
          onChange={(e) => onBranchChange(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#4f8ef7] cursor-pointer"
          style={{ fontFamily: 'DM Sans, sans-serif' }}
        >
          {BRANCHES.map((b) => (
            <option key={b} value={b === 'All' ? '' : b}>{b}</option>
          ))}
        </select>
      </div>

      {/* Year */}
      <div className="flex flex-col gap-1 min-w-[130px]">
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide" style={{ fontFamily: 'DM Sans, sans-serif' }}>
          Year
        </label>
        <select
          value={year}
          onChange={(e) => onYearChange(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#4f8ef7] cursor-pointer"
          style={{ fontFamily: 'DM Sans, sans-serif' }}
        >
          {YEARS.map((y) => (
            <option key={y.value} value={y.value}>{y.label}</option>
          ))}
        </select>
      </div>

      {/* Min Score */}
      <div className="flex flex-col gap-1 min-w-[120px]">
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide" style={{ fontFamily: 'DM Sans, sans-serif' }}>
          Min Score
        </label>
        <input
          type="number"
          min={0}
          max={100}
          value={minScore}
          onChange={(e) => onMinScoreChange(e.target.value)}
          placeholder="0"
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#4f8ef7]"
          style={{ fontFamily: 'DM Sans, sans-serif' }}
        />
      </div>

      {/* Search */}
      <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide" style={{ fontFamily: 'DM Sans, sans-serif' }}>
          Search
        </label>
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by name or roll number..."
            className="w-full text-sm border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#4f8ef7]"
            style={{ fontFamily: 'DM Sans, sans-serif' }}
          />
        </div>
      </div>
    </div>
  );
}
