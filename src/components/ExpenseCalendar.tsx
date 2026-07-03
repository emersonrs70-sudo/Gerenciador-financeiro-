import React, { useState, useEffect } from 'react';
import { 
  Calendar as CalendarIcon, 
  Flame, 
  Leaf, 
  TrendingDown, 
  TrendingUp, 
  Info, 
  Sparkles
} from 'lucide-react';
import { Transaction } from '../types';

interface ExpenseCalendarProps {
  transactions: Transaction[];
  currentMonth: number;
  currentYear: number;
  periodoFiltro?: '7dias' | '15dias' | 'mes' | '3meses' | 'ano';
}

export const ExpenseCalendar: React.FC<ExpenseCalendarProps> = ({
  transactions,
  currentMonth,
  currentYear,
  periodoFiltro = 'mes'
}) => {
  // Use a full date string state YYYY-MM-DD instead of just day numbers
  const [selectedDateStr, setSelectedDateStr] = useState<string>(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  });

  const MONTH_NAMES_PT = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  // Helper to get days in a month
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  // Helper to get first day of the week index (0 = Sunday, 1 = Monday, etc.)
  const getFirstDayOfWeek = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  // Reference date (today or the last day of navigation month)
  const hoje = new Date();
  const isCurrentMonthYear = hoje.getMonth() === currentMonth && hoje.getFullYear() === currentYear;
  const refDate = isCurrentMonthYear
    ? hoje
    : new Date(currentYear, currentMonth + 1, 0);

  // Update selectedDateStr when month or year changes under 'mes' mode
  useEffect(() => {
    if (periodoFiltro === 'mes') {
      const parts = selectedDateStr.split('-');
      if (parts.length === 3) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        if (y !== currentYear || m !== currentMonth) {
          const mm = String(currentMonth + 1).padStart(2, '0');
          setSelectedDateStr(`${currentYear}-${mm}-01`);
        }
      }
    }
  }, [currentMonth, currentYear, periodoFiltro]);

  // Helper to parse date string into readable text
  const getReadableDate = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length < 3) return '';
    const year = parts[0];
    const monthIdx = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    return `Dia ${day} de ${MONTH_NAMES_PT[monthIdx]} de ${year}`;
  };

  // Get financial stats for a specific day
  const getDayFinances = (dateStr: string) => {
    if (!dateStr) return { despesas: 0, receitas: 0, items: [] };
    const dayTransactions = transactions.filter(t => t.data === dateStr);
    
    const despesas = dayTransactions
      .filter(t => t.tipoItem === 'despesa')
      .reduce((sum, t) => sum + t.valor, 0);

    const receitas = dayTransactions
      .filter(t => t.tipoItem === 'receita')
      .reduce((sum, t) => sum + t.valor, 0);

    return {
      despesas,
      receitas,
      items: dayTransactions
    };
  };

  // Determine thermometer level and color style
  const getThermometerStyle = (despesas: number) => {
    if (despesas === 0) {
      return {
        level: 'no-spend',
        bg: 'bg-emerald-50/50 hover:bg-emerald-100 dark:bg-emerald-950/20 dark:hover:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-155 dark:border-emerald-900/30',
        badge: 'bg-emerald-500 text-white',
        desc: 'Dia de Economia 🌿'
      };
    }
    if (despesas <= 50) {
      return {
        level: 'cool',
        bg: 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-900/60 dark:hover:bg-slate-800 text-slate-750 dark:text-slate-300 border-slate-200 dark:border-slate-800',
        badge: 'bg-blue-500 text-white',
        desc: 'Gasto Controlado (Frio)'
      };
    }
    if (despesas <= 150) {
      return {
        level: 'warm',
        bg: 'bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/25 dark:hover:bg-amber-900/30 text-amber-850 dark:text-amber-400 border-amber-200 dark:border-amber-900/40',
        badge: 'bg-amber-500 text-white',
        desc: 'Gasto Moderado (Morno)'
      };
    }
    if (despesas <= 300) {
      return {
        level: 'hot',
        bg: 'bg-orange-50 hover:bg-orange-100 dark:bg-orange-950/30 dark:hover:bg-orange-900/40 text-orange-850 dark:text-orange-400 border-orange-200 dark:border-orange-800/60',
        badge: 'bg-orange-500 text-white',
        desc: 'Gasto Elevado (Quente) ⚠️'
      };
    }
    return {
      level: 'boiling',
      bg: 'bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/50 text-red-900 dark:text-red-400 border-red-200 dark:border-red-900/50 animate-pulse',
      badge: 'bg-red-600 text-white',
      desc: 'Alerta de Torneira Aberta (Fervendo) 🔥'
    };
  };

  interface PeriodDay {
    dateStr: string;
    dayNum: number;
    monthNum: number;
    yearNum: number;
    dayLabel: string;
    weekdayLabel: string;
    isPlaceholder?: boolean;
  }

  // Generate the days of interest based on active period filter
  const getDaysForPeriod = (): PeriodDay[] => {
    const list: PeriodDay[] = [];
    
    if (periodoFiltro === '7dias') {
      const start = new Date(refDate);
      start.setDate(refDate.getDate() - 6);
      for (let i = 0; i < 7; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        const yStr = d.getFullYear();
        const mStr = String(d.getMonth() + 1).padStart(2, '0');
        const dStr = String(d.getDate()).padStart(2, '0');
        const wday = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'][d.getDay()];
        list.push({
          dateStr: `${yStr}-${mStr}-${dStr}`,
          dayNum: d.getDate(),
          monthNum: d.getMonth(),
          yearNum: yStr,
          dayLabel: `${d.getDate()}/${d.getMonth() + 1}`,
          weekdayLabel: wday
        });
      }
    } else if (periodoFiltro === '15dias') {
      const start = new Date(refDate);
      start.setDate(refDate.getDate() - 14);
      for (let i = 0; i < 15; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        const yStr = d.getFullYear();
        const mStr = String(d.getMonth() + 1).padStart(2, '0');
        const dStr = String(d.getDate()).padStart(2, '0');
        const wday = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'][d.getDay()];
        list.push({
          dateStr: `${yStr}-${mStr}-${dStr}`,
          dayNum: d.getDate(),
          monthNum: d.getMonth(),
          yearNum: yStr,
          dayLabel: `${d.getDate()}/${d.getMonth() + 1}`,
          weekdayLabel: wday
        });
      }
    } else if (periodoFiltro === '3meses') {
      // Days from 2 months ago to the end of the current month
      const start = new Date(currentYear, currentMonth - 2, 1);
      const end = new Date(currentYear, currentMonth + 1, 0);
      const tempDate = new Date(start);
      while (tempDate <= end) {
        const yStr = tempDate.getFullYear();
        const mStr = String(tempDate.getMonth() + 1).padStart(2, '0');
        const dStr = String(tempDate.getDate()).padStart(2, '0');
        const wday = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'][tempDate.getDay()];
        list.push({
          dateStr: `${yStr}-${mStr}-${dStr}`,
          dayNum: tempDate.getDate(),
          monthNum: tempDate.getMonth(),
          yearNum: yStr,
          dayLabel: `${tempDate.getDate()}/${tempDate.getMonth() + 1}`,
          weekdayLabel: wday
        });
        tempDate.setDate(tempDate.getDate() + 1);
      }
    } else if (periodoFiltro === 'ano') {
      // Entire calendar year
      const start = new Date(currentYear, 0, 1);
      const end = new Date(currentYear, 11, 31);
      const tempDate = new Date(start);
      while (tempDate <= end) {
        const yStr = tempDate.getFullYear();
        const mStr = String(tempDate.getMonth() + 1).padStart(2, '0');
        const dStr = String(tempDate.getDate()).padStart(2, '0');
        const wday = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'][tempDate.getDay()];
        list.push({
          dateStr: `${yStr}-${mStr}-${dStr}`,
          dayNum: tempDate.getDate(),
          monthNum: tempDate.getMonth(),
          yearNum: yStr,
          dayLabel: `${tempDate.getDate()}/${tempDate.getMonth() + 1}`,
          weekdayLabel: wday
        });
        tempDate.setDate(tempDate.getDate() + 1);
      }
    } else {
      // 'mes'
      const totalDays = getDaysInMonth(currentYear, currentMonth);
      const firstDayIndex = getFirstDayOfWeek(currentYear, currentMonth);
      
      // Placeholders for weekday index padding
      for (let i = 0; i < firstDayIndex; i++) {
        list.push({
          dateStr: '',
          dayNum: 0,
          monthNum: 0,
          yearNum: 0,
          dayLabel: '',
          weekdayLabel: '',
          isPlaceholder: true
        });
      }
      for (let d = 1; d <= totalDays; d++) {
        const mm = String(currentMonth + 1).padStart(2, '0');
        const dd = String(d).padStart(2, '0');
        const dateStr = `${currentYear}-${mm}-${dd}`;
        const wday = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'][new Date(currentYear, currentMonth, d).getDay()];
        list.push({
          dateStr,
          dayNum: d,
          monthNum: currentMonth,
          yearNum: currentYear,
          dayLabel: String(d),
          weekdayLabel: wday
        });
      }
    }
    return list;
  };

  const periodDaysList = getDaysForPeriod();
  const realDaysList = periodDaysList.filter(d => !d.isPlaceholder);

  // Dynamic calculations tailored to the active period
  let noSpendDays = 0;
  let highestSpendDayStr = '';
  let highestSpendVal = 0;
  let totalExpensesThisPeriod = 0;

  realDaysList.forEach(d => {
    const { despesas } = getDayFinances(d.dateStr);
    totalExpensesThisPeriod += despesas;
    if (despesas === 0) noSpendDays++;
    if (despesas > highestSpendVal) {
      highestSpendVal = despesas;
      highestSpendDayStr = d.dateStr;
    }
  });

  const averageDailySpend = realDaysList.length > 0 ? totalExpensesThisPeriod / realDaysList.length : 0;

  // Selected Day finances
  const activeFinances = selectedDateStr ? getDayFinances(selectedDateStr) : null;
  const activeThermometer = selectedDateStr && activeFinances ? getThermometerStyle(activeFinances.despesas) : null;

  // Helpers to group days by month (used for 3-month and annual heatmaps)
  const getGroupedMonths = () => {
    const grouped: { [key: string]: PeriodDay[] } = {};
    realDaysList.forEach(d => {
      const key = `${d.yearNum}-${d.monthNum}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(d);
    });
    return grouped;
  };

  const groupedMonths = getGroupedMonths();

  return (
    <div className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 md:p-5 shadow-xs transition-all duration-300">
      <div className="flex flex-col lg:flex-row gap-5">
        
        {/* CALENDAR/THERMOMETER GRID VIEW */}
        <div className="flex-1 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 gap-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-red-500/10 dark:bg-red-950/30 flex items-center justify-center text-red-500">
                <CalendarIcon className="w-4 h-4 animate-pulse" />
              </div>
              <div>
                <h2 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-1.5 flex-wrap">
                  Termômetro de Despesas
                  <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 rounded-md">
                    {periodoFiltro === '7dias' ? '7 Dias' :
                     periodoFiltro === '15dias' ? '15 Dias' :
                     periodoFiltro === '3meses' ? 'Trimestral' :
                     periodoFiltro === 'ano' ? 'Anual' : 'Mensal'}
                  </span>
                </h2>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                  {periodoFiltro === '7dias' ? 'Últimos 7 dias de transações calibrados pelo termômetro' :
                   periodoFiltro === '15dias' ? 'Distribuição térmica de gastos dos últimos 15 dias' :
                   periodoFiltro === '3meses' ? 'Grade térmica trimestral compacta por mês' :
                   periodoFiltro === 'ano' ? `Visão unificada das calorias financeiras de ${currentYear}` :
                   `${MONTH_NAMES_PT[currentMonth]} de ${currentYear} • Cores indicam calor de gastos`}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-950 px-2.5 py-1 rounded-xl text-[9px] text-slate-500 font-bold border border-slate-150 dark:border-slate-800 self-start sm:self-center">
              <Sparkles className="w-3 h-3 text-red-500" />
              <span>Cores mudam por temperatura de gastos</span>
            </div>
          </div>

          {/* DYNAMIC RENDERING ACCORDING TO FILTER PERIOD */}
          <div className="min-h-[220px] flex flex-col justify-center">
            
            {/* 1. SEVEN DAYS */}
            {periodoFiltro === '7dias' && (
              <div className="grid grid-cols-7 gap-2.5">
                {periodDaysList.map((item) => {
                  const finances = getDayFinances(item.dateStr);
                  const style = getThermometerStyle(finances.despesas);
                  const isSelected = selectedDateStr === item.dateStr;
                  return (
                    <button
                      key={`day-7-${item.dateStr}`}
                      onClick={() => setSelectedDateStr(item.dateStr)}
                      className={`p-2 flex flex-col items-center justify-between border rounded-xl transition-all duration-200 cursor-pointer min-h-[90px] ${style.bg} ${
                        isSelected 
                          ? 'ring-2 ring-purple-500 border-purple-500 scale-102 z-10 shadow-md' 
                          : 'shadow-3xs'
                      }`}
                    >
                      <div className="text-center">
                        <span className="text-[8px] font-black uppercase block text-slate-400 dark:text-slate-500 leading-none mb-1">
                          {item.weekdayLabel}
                        </span>
                        <span className={`text-xs font-black block leading-none ${isSelected ? 'text-purple-600 dark:text-purple-400 font-black' : ''}`}>
                          {item.dayLabel}
                        </span>
                      </div>
                      <div className="text-center w-full mt-2">
                        <p className="text-[10px] font-black leading-none text-slate-800 dark:text-slate-100">
                          {finances.despesas > 0 ? `R$ ${Math.round(finances.despesas)}` : 'R$ 0'}
                        </p>
                        {finances.receitas > 0 && (
                          <p className="text-[7px] text-emerald-500 dark:text-emerald-400 font-black leading-none mt-1">
                            +{Math.round(finances.receitas)}
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* 2. FIFTEEN DAYS */}
            {periodoFiltro === '15dias' && (
              <div className="grid grid-cols-5 sm:grid-cols-15 gap-1.5">
                {periodDaysList.map((item) => {
                  const finances = getDayFinances(item.dateStr);
                  const style = getThermometerStyle(finances.despesas);
                  const isSelected = selectedDateStr === item.dateStr;
                  return (
                    <button
                      key={`day-15-${item.dateStr}`}
                      onClick={() => setSelectedDateStr(item.dateStr)}
                      className={`p-1.5 flex flex-col items-center justify-between border rounded-xl transition-all duration-200 cursor-pointer min-h-[80px] ${style.bg} ${
                        isSelected 
                          ? 'ring-2 ring-purple-500 border-purple-500 scale-102 z-10 shadow-md' 
                          : 'shadow-3xs'
                      }`}
                    >
                      <div className="text-center">
                        <span className="text-[7px] font-bold uppercase block text-slate-400 dark:text-slate-500 leading-none mb-1">
                          {item.weekdayLabel}
                        </span>
                        <span className="text-[9px] font-black block leading-none">
                          {item.dayLabel}
                        </span>
                      </div>
                      <div className="text-center w-full mt-2">
                        <p className="text-[9px] font-black leading-none text-slate-800 dark:text-slate-100">
                          {finances.despesas > 0 ? `R$ ${Math.round(finances.despesas)}` : '0'}
                        </p>
                        {finances.receitas > 0 && (
                          <p className="text-[6.5px] text-emerald-500 dark:text-emerald-400 font-bold leading-none mt-0.5">
                            +{Math.round(finances.receitas)}
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* 3. MONTH (TRADITIONAL CALENDAR) */}
            {periodoFiltro === 'mes' && (
              <div className="space-y-2">
                {/* Weekday headers */}
                <div className="grid grid-cols-7 gap-1 text-center">
                  {['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'].map(d => (
                    <span key={d} className="text-[9px] font-black text-slate-400 dark:text-slate-500 py-1">
                      {d}
                    </span>
                  ))}
                </div>
                {/* Cells */}
                <div className="grid grid-cols-7 gap-1">
                  {periodDaysList.map((item, idx) => {
                    if (item.isPlaceholder) {
                      return <div key={`empty-${idx}`} className="aspect-square bg-slate-100/30 dark:bg-slate-950/10 rounded-xl" />;
                    }
                    const finances = getDayFinances(item.dateStr);
                    const style = getThermometerStyle(finances.despesas);
                    const isSelected = selectedDateStr === item.dateStr;
                    return (
                      <button
                        key={`day-mes-${item.dateStr}`}
                        onClick={() => setSelectedDateStr(item.dateStr)}
                        className={`aspect-square p-1.5 flex flex-col justify-between border rounded-xl transition-all duration-200 relative cursor-pointer group ${style.bg} ${
                          isSelected 
                            ? 'ring-2 ring-purple-500 border-purple-500 scale-102 z-10 shadow-md' 
                            : 'shadow-3xs'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className={`text-[10px] md:text-xs font-black ${isSelected ? 'text-purple-600 dark:text-purple-400' : ''}`}>
                            {item.dayNum}
                          </span>
                          {finances.despesas === 0 ? (
                            <Leaf className="w-2.5 h-2.5 text-emerald-500 fill-emerald-500/20" />
                          ) : finances.despesas > 300 ? (
                            <Flame className="w-2.5 h-2.5 text-red-500 fill-red-500/10 animate-bounce" />
                          ) : null}
                        </div>
                        <div className="text-right w-full">
                          <p className="text-[8px] md:text-[9px] font-bold leading-none tracking-tight">
                            {finances.despesas > 0 ? `R$ ${Math.round(finances.despesas)}` : 'R$ 0'}
                          </p>
                          {finances.receitas > 0 && (
                            <p className="text-[7px] text-emerald-500 dark:text-emerald-400 font-black leading-none mt-0.5">
                              +{Math.round(finances.receitas)}
                            </p>
                          )}
                        </div>
                        {finances.items.length > 0 && (
                          <div className="absolute bottom-1 left-1.5 flex gap-0.5">
                            {finances.items.slice(0, 3).map((it, idx2) => (
                              <span key={idx2} className={`w-1 h-1 rounded-full ${it.tipoItem === 'despesa' ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                            ))}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 4. THREE MONTHS (GROUPED BY MONTH) */}
            {periodoFiltro === '3meses' && (
              <div className="space-y-4">
                {Object.entries(groupedMonths).map(([monthKey, days]) => {
                  const [year, mIdx] = monthKey.split('-').map(Number);
                  return (
                    <div key={monthKey} className="space-y-1.5 bg-slate-55/10 dark:bg-slate-950/20 p-2.5 rounded-xl border border-slate-100 dark:border-slate-900/60">
                      <h4 className="text-[10px] font-black text-slate-500 dark:text-slate-450 uppercase tracking-wider flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-purple-500 rounded-full" />
                        {MONTH_NAMES_PT[mIdx]} de {year}
                      </h4>
                      <div className="flex flex-wrap gap-1">
                        {days.map((item) => {
                          const finances = getDayFinances(item.dateStr);
                          const style = getThermometerStyle(finances.despesas);
                          const isSelected = selectedDateStr === item.dateStr;
                          return (
                            <button
                              key={`day-3m-${item.dateStr}`}
                              onClick={() => setSelectedDateStr(item.dateStr)}
                              title={`${item.dayNum}/${mIdx+1}: R$ ${finances.despesas.toFixed(2)}`}
                              className={`w-7 h-7 rounded-md border flex items-center justify-center text-[9px] font-black transition-all cursor-pointer ${style.bg} ${
                                isSelected ? 'ring-2 ring-purple-500 border-purple-500 scale-110 z-10 shadow-sm' : 'shadow-3xs'
                              }`}
                            >
                              {item.dayNum}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 5. ANNUAL VIEW (DENSE MINI HEATMAP) */}
            {periodoFiltro === 'ano' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Object.entries(groupedMonths).map(([monthKey, days]) => {
                  const [year, mIdx] = monthKey.split('-').map(Number);
                  return (
                    <div key={monthKey} className="bg-slate-50/50 dark:bg-slate-950/20 p-2.5 border border-slate-100 dark:border-slate-850 rounded-xl space-y-1.5">
                      <h4 className="text-[9px] font-black text-slate-550 dark:text-slate-400 uppercase tracking-wider">
                        {MONTH_NAMES_PT[mIdx]} {year}
                      </h4>
                      <div className="grid grid-cols-7 gap-1">
                        {days.map((item) => {
                          const finances = getDayFinances(item.dateStr);
                          const style = getThermometerStyle(finances.despesas);
                          const isSelected = selectedDateStr === item.dateStr;
                          return (
                            <button
                              key={`day-yr-${item.dateStr}`}
                              onClick={() => setSelectedDateStr(item.dateStr)}
                              title={`${item.dayNum} ${MONTH_NAMES_PT[mIdx]}: R$ ${finances.despesas.toFixed(2)}`}
                              className={`aspect-square rounded-md border-[0.5px] flex items-center justify-center text-[8px] font-bold transition-all cursor-pointer ${style.bg} ${
                                isSelected ? 'ring-1.5 ring-purple-500 border-purple-550 scale-105 z-10 shadow-sm' : ''
                              }`}
                            >
                              {item.dayNum}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

          </div>

          {/* THERMOMETER COLORS LEGEND */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800/60 rounded-xl px-3 py-2 text-[9px] font-bold text-slate-500 dark:text-slate-400 gap-2">
            <span className="uppercase tracking-wider">Gasto Diário:</span>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-emerald-500" /> R$ 0 (Eco 🌿)</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-slate-300 dark:bg-slate-700" /> ≤ R$ 50</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-amber-500" /> ≤ R$ 150</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-orange-500" /> ≤ R$ 300</span>
              <span className="flex items-center gap-1 text-red-650 dark:text-red-400"><span className="w-2.5 h-2.5 rounded bg-red-600 animate-pulse" /> &gt; R$ 300</span>
            </div>
          </div>
        </div>

        {/* SIDE PANELS: PERIOD STATS SUMMARY & ACTIVE SELECTED DAY DETAILS */}
        <div className="w-full lg:w-72 flex flex-col gap-4">
          
          {/* DYNAMIC RELATÓRIO DE CALORIAS */}
          <div className="bg-slate-50 dark:bg-slate-950/50 rounded-xl p-3.5 border border-slate-100 dark:border-slate-850 space-y-3">
            <h3 className="text-[10px] font-black text-slate-450 dark:text-slate-500 uppercase tracking-widest">
              Calorias Financeiras ({periodoFiltro === '7dias' ? '7D' : periodoFiltro === '15dias' ? '15D' : periodoFiltro === '3meses' ? 'Trimestre' : periodoFiltro === 'ano' ? 'Ano' : 'Mês'})
            </h3>
            
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 p-2 rounded-xl text-center shadow-3xs">
                <p className="text-[8px] font-bold text-slate-400 dark:text-slate-550 uppercase">Dias Limpos 🌿</p>
                <p className="text-sm font-black text-emerald-600 dark:text-emerald-400 mt-0.5">{noSpendDays} d</p>
                <p className="text-[7.5px] text-slate-400 dark:text-slate-500 font-medium">Gastou R$ 0,00</p>
              </div>
              <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 p-2 rounded-xl text-center shadow-3xs">
                <p className="text-[8px] font-bold text-slate-400 dark:text-slate-550 uppercase">Média Diária</p>
                <p className="text-sm font-black text-purple-600 dark:text-purple-400 mt-0.5">R$ {Math.round(averageDailySpend)}</p>
                <p className="text-[7.5px] text-slate-400 dark:text-slate-500 font-medium">Alvo &lt; R$ 100/dia</p>
              </div>
            </div>

            {highestSpendVal > 0 ? (
              <div className="bg-orange-50/50 dark:bg-orange-950/10 border border-orange-100 dark:border-orange-950/30 p-2.5 rounded-xl flex items-center justify-between gap-2 shadow-3xs">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 flex items-center justify-center">
                    <Flame className="w-4 h-4 animate-bounce" />
                  </div>
                  <div>
                    <p className="text-[8px] font-bold text-slate-400 dark:text-slate-550 uppercase leading-none">Pico do Período</p>
                    <p className="text-[10px] font-black text-slate-800 dark:text-slate-200 mt-1">
                      {highestSpendDayStr ? `${highestSpendDayStr.split('-')[2]}/${highestSpendDayStr.split('-')[1]}` : ''}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-black text-orange-600 dark:text-orange-400">R$ {highestSpendVal.toFixed(2)}</span>
                </div>
              </div>
            ) : (
              <div className="bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-100 dark:border-emerald-950/30 p-2.5 rounded-xl text-center text-[9px] font-bold text-emerald-600 dark:text-emerald-400 shadow-3xs">
                Parabéns! Zero gastos no período! 🎉
              </div>
            )}
          </div>

          {/* ACTIVE DAY DETAILS */}
          <div className="flex-1 bg-slate-50 dark:bg-slate-950/50 rounded-xl p-3.5 border border-slate-100 dark:border-slate-850 flex flex-col justify-between min-h-[160px]">
            {selectedDateStr && activeFinances && activeThermometer ? (
              <div className="space-y-3 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between border-b border-slate-150 dark:border-slate-800 pb-2">
                    <span className="text-[10.5px] font-black text-slate-750 dark:text-slate-200">
                      {getReadableDate(selectedDateStr)}
                    </span>
                    <span className={`text-[7px] px-1.5 py-0.5 rounded-md font-black uppercase ${activeThermometer.badge}`}>
                      {activeThermometer.desc}
                    </span>
                  </div>

                  {/* Day financial summaries */}
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div className="bg-slate-100 dark:bg-slate-900/80 px-2 py-1.5 rounded-lg shadow-3xs">
                      <span className="text-[7px] text-slate-400 dark:text-slate-500 font-bold uppercase flex items-center gap-0.5">
                        <TrendingDown className="w-2.5 h-2.5 text-red-500" /> Gastos
                      </span>
                      <p className="text-xs font-black text-slate-800 dark:text-slate-200 mt-0.5">
                        R$ {activeFinances.despesas.toFixed(2)}
                      </p>
                    </div>
                    <div className="bg-slate-100 dark:bg-slate-900/80 px-2 py-1.5 rounded-lg shadow-3xs">
                      <span className="text-[7px] text-slate-400 dark:text-slate-500 font-bold uppercase flex items-center gap-0.5">
                        <TrendingUp className="w-2.5 h-2.5 text-emerald-500" /> Recebido
                      </span>
                      <p className="text-xs font-black text-slate-800 dark:text-slate-200 mt-0.5">
                        R$ {activeFinances.receitas.toFixed(2)}
                      </p>
                    </div>
                  </div>

                  {/* List of transactions */}
                  <div className="mt-3 space-y-1.5 max-h-[130px] overflow-y-auto no-scrollbar">
                    {activeFinances.items.length > 0 ? (
                      activeFinances.items.map((item) => (
                        <div 
                          key={item.id}
                          className="flex items-center justify-between text-[10px] p-2 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/60 rounded-xl shadow-3xs"
                        >
                          <div className="flex flex-col gap-0.5">
                            <span className="font-bold text-slate-850 dark:text-slate-200 leading-tight">
                              {item.descricao}
                            </span>
                            <span className="text-[8px] text-slate-400 dark:text-slate-500 font-bold uppercase">
                              {item.categoria}
                            </span>
                          </div>
                          <span className={`font-black ${
                            item.tipoItem === 'despesa' ? 'text-red-500' : 'text-emerald-500'
                          }`}>
                            {item.tipoItem === 'despesa' ? '-' : '+'} R$ {item.valor.toFixed(2)}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-5 text-slate-400 dark:text-slate-500 text-[10px] font-bold italic border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                        Sem lançamentos neste dia
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-2 text-[8px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
                  <Info className="w-3 h-3 text-purple-400" />
                  <span>Clique nas células para carregar os detalhes do dia!</span>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                <CalendarIcon className="w-7 h-7 text-slate-300 dark:text-slate-750 mb-1.5" />
                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold italic">
                  Selecione um dia do termômetro para detalhar os lançamentos realizados!
                </p>
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
};
