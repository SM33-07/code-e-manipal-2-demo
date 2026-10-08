import React from 'react';

interface MetricCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon?: React.ReactNode;
  trend?: {
    value: string;
    positive: boolean;
  };
  className?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  subtext,
  icon,
  trend,
  className = '',
}) => {
  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-[var(--jaipur-secondary-light)] bg-[var(--jaipur-card)] p-5 shadow-sm transition-all hover:border-[var(--jaipur-primary)]/40 hover:shadow-md ${className}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono font-medium uppercase tracking-wider text-[var(--muted)]">
          {label}
        </span>
        {icon && (
          <span className="text-[var(--jaipur-primary)] opacity-80">
            {icon}
          </span>
        )}
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-3xl font-extrabold tracking-tight font-mono text-[var(--foreground)]">
          {value}
        </span>
        {trend && (
          <span
            className={`text-xs font-medium font-mono ${
              trend.positive ? 'text-emerald-500' : 'text-rose-500'
            }`}
          >
            {trend.positive ? '↑' : '↓'} {trend.value}
          </span>
        )}
      </div>

      {subtext && (
        <p className="mt-1 text-xs text-[var(--muted)] truncate">
          {subtext}
        </p>
      )}

      {/* Subtle Jaipur heritage accent line */}
      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[var(--jaipur-primary)]/30 to-transparent" />
    </div>
  );
};

export default MetricCard;
