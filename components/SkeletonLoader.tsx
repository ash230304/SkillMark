'use client';

export function TableSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-gray-100">
        <div className="h-5 bg-gray-100 rounded-md w-48 animate-pulse" />
      </div>
      <div className="divide-y divide-gray-50">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="px-4 py-3 flex items-center gap-4">
            <div className="h-4 w-6 bg-gray-100 rounded animate-pulse" />
            <div className="h-4 w-32 bg-gray-100 rounded animate-pulse" />
            <div className="h-4 w-20 bg-gray-100 rounded animate-pulse" />
            <div className="h-4 w-12 bg-gray-100 rounded animate-pulse" />
            <div className="ml-auto h-6 w-16 bg-gray-100 rounded-full animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 flex items-start gap-4 shadow-sm">
      <div className="w-11 h-11 rounded-xl bg-gray-100 animate-pulse flex-shrink-0" />
      <div className="flex flex-col gap-2 flex-1">
        <div className="h-3 w-20 bg-gray-100 rounded animate-pulse" />
        <div className="h-7 w-16 bg-gray-100 rounded animate-pulse" />
      </div>
    </div>
  );
}

export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  const widths = ['92%', '84%', '76%', '88%', '72%'];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className={`h-4 bg-gray-100 rounded animate-pulse ${i < lines - 1 ? 'mb-3' : ''}`}
          style={{ width: widths[i % widths.length] }} />
      ))}
    </div>
  );
}
