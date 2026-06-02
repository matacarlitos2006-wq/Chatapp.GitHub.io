interface StatusDotProps {
  status: 'online' | 'away' | 'offline';
  size?: 'sm' | 'md';
}

export default function StatusDot({ status, size = 'sm' }: StatusDotProps) {
  const sizeClass = size === 'sm' ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5';
  const colorClass =
    status === 'online' ? 'bg-emerald-500' :
    status === 'away'   ? 'bg-amber-400' :
                          'bg-gray-400';
  return (
    <span
      className={`${sizeClass} ${colorClass} rounded-full inline-block ring-2 ring-white dark:ring-gray-800 flex-shrink-0`}
      title={status.charAt(0).toUpperCase() + status.slice(1)}
    />
  );
}
