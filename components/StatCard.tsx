'use client';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  accent?: string;
}

export default function StatCard({ title, value, subtitle, icon, accent = '#4f8ef7' }: StatCardProps) {
  return (
    <div
      className="bg-white rounded-2xl border border-gray-100 p-5 flex items-start gap-4 shadow-sm hover:shadow-md transition-shadow duration-200"
    >
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${accent}18` }}
      >
        <span style={{ color: accent }}>{icon}</span>
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1" style={{ fontFamily: 'DM Sans, sans-serif' }}>
          {title}
        </p>
        <p className="text-2xl font-bold text-[#1a1a2e] leading-none" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
          {value}
        </p>
        {subtitle && (
          <p className="text-xs text-gray-400 mt-1 truncate" style={{ fontFamily: 'DM Sans, sans-serif' }}>
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}
