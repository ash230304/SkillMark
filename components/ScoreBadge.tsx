'use client';

interface ScoreBadgeProps {
  score: number;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function getScoreCategory(score: number) {
  if (score >= 70) return { bg: '#dcfce7', text: '#166534', label: 'Placement Ready' };
  if (score >= 50) return { bg: '#fef9c3', text: '#854d0e', label: 'Developing' };
  return { bg: '#fee2e2', text: '#991b1b', label: 'Needs Work' };
}

export default function ScoreBadge({ score, showLabel = false, size = 'md' }: ScoreBadgeProps) {
  const { bg, text, label } = getScoreCategory(score);

  const sizes = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${sizes[size]}`}
      style={{ backgroundColor: bg, color: text, fontFamily: 'DM Sans, sans-serif' }}
    >
      <span className="font-bold">{score.toFixed(1)}</span>
      {showLabel && <span className="opacity-75">{label}</span>}
    </span>
  );
}
