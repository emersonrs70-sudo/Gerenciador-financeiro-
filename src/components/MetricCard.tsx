import React from 'react';
import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string;
  subValue?: string;
  icon: LucideIcon;
  borderColor: string;
  activeBorderColor: string;
  iconColor: string;
  isActive: boolean;
  onClick: () => void;
  id: string;
  activeRingColor: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subValue,
  icon: Icon,
  borderColor,
  activeBorderColor,
  iconColor,
  isActive,
  onClick,
  id,
}) => {
  // Extract base color class (e.g. 'emerald-500') from activeBorderColor
  const baseColorClass = activeBorderColor.replace('border-l-', '');

  // Define color hex for CSS variable pulse animation
  let colorVar = '#a855f7';
  if (baseColorClass.includes('emerald')) colorVar = '#10b981';
  else if (baseColorClass.includes('red')) colorVar = '#ef4444';
  else if (baseColorClass.includes('blue')) colorVar = '#3b82f6';
  else if (baseColorClass.includes('rose')) colorVar = '#f43f5e';
  else if (baseColorClass.includes('indigo')) colorVar = '#6366f1';
  else if (baseColorClass.includes('purple')) colorVar = '#a855f7';

  return (
    <button
      id={id}
      onClick={onClick}
      style={{ '--card-color': colorVar } as React.CSSProperties}
      className={`w-full text-left p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs transition-all duration-300 active:scale-98 hover:shadow-md cursor-pointer relative ${
        isActive
          ? `border-l-[8px] ${activeBorderColor} transform translate-y-[-2px] shadow-sm`
          : `border-l-4 ${activeBorderColor} hover:translate-y-[-1px] hover:animate-pulse-border`
      }`}
    >
      <div className="flex justify-between items-start gap-2">
        <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-black tracking-wider leading-none">
          {title}
        </p>
        <div className={`p-1.5 rounded-lg ${iconColor} bg-slate-50 dark:bg-slate-950`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="text-xl font-extrabold text-slate-800 dark:text-white mt-2 tracking-tight">
        {value}
      </p>
      {subValue && (
        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 font-medium italic">
          {subValue}
        </p>
      )}
    </button>
  );
};
