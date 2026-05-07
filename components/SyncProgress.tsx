'use client';

interface SyncProgressProps {
  progress: number;
  total: number;
  currentName: string;
  isComplete: boolean;
  failed: number;
  onClose?: () => void;
}

export default function SyncProgress({ progress, total, currentName, isComplete, failed, onClose }: SyncProgressProps) {
  const pct = total > 0 ? Math.round((progress / total) * 100) : 0;

  return (
    <div className="fixed bottom-6 right-6 z-50 bg-white rounded-2xl border border-gray-200 shadow-2xl p-5 w-80">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-semibold text-[#1a1a2e] text-sm" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            {isComplete ? 'Sync Complete' : 'Syncing Students...'}
          </p>
          {!isComplete && (
            <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[200px]" style={{ fontFamily: 'DM Sans, sans-serif' }}>
              {currentName}
            </p>
          )}
        </div>
        {isComplete && onClose && (
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <div className="w-full bg-gray-100 rounded-full h-2 mb-2">
        <div
          className="h-2 rounded-full transition-all duration-300"
          style={{
            width: `${pct}%`,
            backgroundColor: isComplete ? '#22c55e' : '#4f8ef7',
          }}
        />
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500" style={{ fontFamily: 'DM Sans, sans-serif' }}>
          {progress} / {total} students
        </span>
        <span className="text-xs font-semibold" style={{
          color: isComplete ? '#22c55e' : '#4f8ef7',
          fontFamily: 'DM Sans, sans-serif',
        }}>
          {pct}%
        </span>
      </div>

      {isComplete && failed > 0 && (
        <p className="text-xs text-red-500 mt-2" style={{ fontFamily: 'DM Sans, sans-serif' }}>
          {failed} student{failed > 1 ? 's' : ''} had sync errors
        </p>
      )}
      {isComplete && failed === 0 && (
        <p className="text-xs text-green-600 mt-2" style={{ fontFamily: 'DM Sans, sans-serif' }}>
          All students synced successfully!
        </p>
      )}
    </div>
  );
}
