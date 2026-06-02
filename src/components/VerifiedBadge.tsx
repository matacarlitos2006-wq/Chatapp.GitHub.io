import { Check } from 'lucide-react';

interface VerifiedBadgeProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function VerifiedBadge({ size = 'md', className = '' }: VerifiedBadgeProps) {
  const sizes = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  const iconSizes = {
    sm: 'w-2.5 h-2.5',
    md: 'w-3 h-3',
    lg: 'w-3.5 h-3.5',
  };

  return (
    <div
      className={`${sizes[size]} rounded-full bg-gradient-to-br from-cyan-400 to-cyan-500 flex items-center justify-center shadow-sm ${className}`}
      aria-label="Verified"
      title="Verified account"
    >
      <Check className={`${iconSizes[size]} text-white stroke-[3]`} />
    </div>
  );
}
