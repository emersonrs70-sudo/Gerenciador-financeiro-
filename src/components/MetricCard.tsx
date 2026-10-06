import React from 'react';
import { LucideIcon, MoreHorizontal, TrendingUp, TrendingDown } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string;
  subValue?: string;
  trend?: {
    value: string;
    isPositive?: boolean;
    neutral?: boolean;
  };
  icon?: LucideIcon;
  borderColor?: string;
  activeBorderColor?: string;
  iconColor?: string;
  isActive: boolean;
  onClick: () => void;
  id: string;
  activeRingColor?: string;
  sparklineType?: 'up' | 'down' | 'wave' | 'progress';
  progressPercent?: number;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subValue,
  trend,
  isActive,
  onClick,
  id,
  sparklineType = 'wave',
  progressPercent = 65,
}) => {
  return (
    <button
      id={id}
      onClick={onClick}
      className={`w-full text-left p-4 sm:p-5 rounded-2xl transition-all duration-200 cursor-pointer relative overflow-hidden group flex flex-col justify-between ${
        isActive
          ? 'bg-zinc-50/80 dark:bg-[#222226] border-zinc-900 dark:border-zinc-200 ring-2 ring-zinc-900/10 dark:ring-white/10 shadow-sm'
          : 'bg-white dark:bg-[#1A1A1E] border border-zinc-200/80 dark:border-[#27272A] hover:border-zinc-300 dark:hover:border-[#38383E] shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:shadow-sm'
      }`}
    >
      {/* Top Header: Label + Three dots */}
      <div className="flex items-center justify-between w-full">
        <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 tracking-normal truncate">
          {title}
        </span>
        <div className="text-zinc-400 dark:text-zinc-500 opacity-60 group-hover:opacity-100 transition-opacity">
          <MoreHorizontal className="w-4 h-4" />
        </div>
      </div>

      {/* Middle: Big Metric Value + Trend Indicator */}
      <div className="mt-3 flex items-baseline justify-between gap-2 flex-wrap">
        <span className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white tracking-tight font-mono tabular-nums">
          {value}
        </span>

        {trend && (
          <div
            className={`flex items-center gap-1 text-[11px] font-bold px-1.5 py-0.5 rounded-md ${
              trend.neutral
                ? 'text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800'
                : trend.isPositive
                ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40'
                : 'text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40'
            }`}
          >
            {trend.neutral ? null : trend.isPositive ? (
              <TrendingUp className="w-3 h-3" />
            ) : (
              <TrendingDown className="w-3 h-3" />
            )}
            <span>{trend.value}</span>
          </div>
        )}
      </div>

      {/* SubValue context */}
      {subValue && (
        <span className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 font-medium truncate block">
          {subValue}
        </span>
      )}

      {/* Bottom Sparkline Curve or Progress Track */}
      <div className="mt-3 pt-1 w-full">
        {sparklineType === 'progress' ? (
          <div className="w-full">
            <div className="w-full h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-zinc-800 dark:bg-zinc-200 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(Math.max(progressPercent, 5), 100)}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="h-6 w-full opacity-60 group-hover:opacity-100 transition-opacity">
            <svg
              className="w-full h-full overflow-visible"
              viewBox="0 0 100 24"
              preserveAspectRatio="none"
              fill="none"
            >
              {sparklineType === 'up' && (
                <path
                  d="M0 20 Q 25 18, 40 14 T 70 8 T 100 2"
                  stroke="currentColor"
                  className="text-emerald-500 dark:text-emerald-400"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              )}
              {sparklineType === 'down' && (
                <path
                  d="M0 6 Q 25 8, 45 14 T 75 16 T 100 22"
                  stroke="currentColor"
                  className="text-rose-500 dark:text-rose-400"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              )}
              {sparklineType === 'wave' && (
                <path
                  d="M0 16 C 20 22, 35 4, 55 12 C 75 20, 85 8, 100 4"
                  stroke="currentColor"
                  className="text-zinc-400 dark:text-zinc-500"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              )}
            </svg>
          </div>
        )}
      </div>
    </button>
  );
};
