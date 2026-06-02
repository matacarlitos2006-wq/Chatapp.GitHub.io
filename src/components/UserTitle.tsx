interface UserTitleProps {
  title: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function UserTitle({ title, size = 'md', className = '' }: UserTitleProps) {
  const sizes = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  return (
    <span
      className={`${sizes[size]} font-semibold bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-500 bg-clip-text text-transparent ${className}`}
      style={{
        textShadow: '0 0 20px rgba(251, 191, 36, 0.3)',
      }}
    >
      {title}
    </span>
  );
}
