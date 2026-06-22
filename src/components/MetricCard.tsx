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
  activeRingColor
}) => {
  return (
    <button
      id={id}
      onClick={onClick}
      className={`w-full text-left p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs transition-all duration-300 active:scale-98 hover:shadow-md cursor-pointer ${borderColor} ${
        isActive
          ? `${activeRingColor} ${activeBorderColor} transform translate-y-[-2px]`
          : 'hover:translate-y-[-1px]'
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
