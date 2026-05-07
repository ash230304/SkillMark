'use client';

interface ScoreBreakdownProps {
  breakdown: {
    dsa: number;
    githubActivity: number;
    projectQuality: number;
    competitive: number;
    consistency: number;
  };
  compact?: boolean;
}

const components = [
  { key: 'dsa', label: 'DSA', color: '#4f8ef7' },
  { key: 'githubActivity', label: 'GitHub Activity', color: '#14b8a6' },
  { key: 'projectQuality', label: 'Project Quality', color: '#22c55e' },
  { key: 'competitive', label: 'Competitive', color: '#a855f7' },
  { key: 'consistency', label: 'Consistency', color: '#f59e0b' },
];

export default function ScoreBreakdown({ breakdown, compact = false }: ScoreBreakdownProps) {
  return (
    <div className={`flex flex-col gap-${compact ? '2' : '3'}`}>
      {components.map(({ key, label, color }) => {
        const value = (breakdown as any)[key] ?? 0;
        return (
          <div key={key} className="flex items-center gap-3">
            <span
              className={`${compact ? 'w-20 text-xs' : 'w-28 text-sm'} text-gray-600 font-medium flex-shrink-0`}
              style={{ fontFamily: 'DM Sans, sans-serif' }}
            >
              {label}
            </span>
            <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${value}%`, backgroundColor: color }}
              />
            </div>
            <span
              className={`${compact ? 'w-7 text-xs' : 'w-9 text-sm'} text-right font-semibold flex-shrink-0`}
              style={{ color, fontFamily: 'DM Sans, sans-serif' }}
            >
              {Math.round(value)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
