import React from 'react';
import { motion } from 'motion/react';
import { LucideIcon, ChevronDown, TrendingUp, TrendingDown } from 'lucide-react';

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
    <motion.button
      id={id}
      onClick={onClick}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.985 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className={`w-full text-left p-3 sm:p-3.5 rounded-2xl transition-all duration-300 cursor-pointer relative overflow-hidden group flex flex-col justify-between select-none ${
        isActive
          ? 'bg-zinc-100/95 dark:bg-[#32323F] border-[#4C4E5D] dark:border-[#BCABA8] ring-2 ring-[#BCABA8]/35 shadow-md'
          : 'bg-white dark:bg-[#32323F]/80 border border-zinc-200/80 dark:border-[#4C4E5D]/60 hover:border-[#4C4E5D] dark:hover:border-[#988E96]/50 shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:shadow-sm'
      }`}
    >
      {/* Active Top Highlight Bar */}
      {isActive && (
        <motion.div
          layoutId="cardActiveHighlight"
          className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-emerald-500 rounded-t-2xl"
          transition={{ type: 'spring', stiffness: 350, damping: 28 }}
        />
      )}

      {/* Top Header: Label + Organic Animated Chevron */}
      <div className="flex items-center justify-between w-full">
        <span className="text-[11px] font-semibold text-zinc-500 dark:text-[#988E96] tracking-normal truncate">
          {title}
        </span>
        <div className="flex items-center gap-1 text-zinc-400 dark:text-[#988E96] group-hover:text-zinc-700 dark:group-hover:text-zinc-200 transition-colors">
          <span className="text-[8.5px] font-bold uppercase tracking-wider hidden sm:group-hover:inline-block opacity-75">
            {isActive ? 'Recolher' : 'Expandir'}
          </span>
          <motion.div
            animate={{ rotate: isActive ? 180 : 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 24 }}
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </motion.div>
        </div>
      </div>

      {/* Middle: Big Metric Value + Trend Indicator */}
      <div className="mt-1.5 flex items-baseline justify-between gap-1.5 flex-wrap">
        <span className="text-base sm:text-lg font-black text-zinc-900 dark:text-white tracking-tight font-mono tabular-nums">
          {value}
        </span>

        {trend && (
          <div
            className={`flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
              trend.neutral
                ? 'text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800'
                : trend.isPositive
                ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40'
                : 'text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40'
            }`}
          >
            {trend.neutral ? null : trend.isPositive ? (
              <TrendingUp className="w-2.5 h-2.5" />
            ) : (
              <TrendingDown className="w-2.5 h-2.5" />
            )}
            <span>{trend.value}</span>
          </div>
        )}
      </div>

      {/* SubValue context */}
      {subValue && (
        <span className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5 font-medium truncate block">
          {subValue}
        </span>
      )}

      {/* Bottom Sparkline Curve or Progress Track */}
      <div className="mt-1.5 pt-0.5 w-full">
        {sparklineType === 'progress' ? (
          <div className="w-full">
            <div className="w-full h-1 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-zinc-800 dark:bg-zinc-200 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(Math.max(progressPercent, 5), 100)}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="h-4 w-full opacity-60 group-hover:opacity-100 transition-opacity">
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

      {/* Bottom Caret Pointer when Active */}
      {isActive && (
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-zinc-100 dark:bg-[#32323F] rotate-45 border-r border-b border-[#4C4E5D] dark:border-[#BCABA8] z-10" />
      )}
    </motion.button>
  );
};

