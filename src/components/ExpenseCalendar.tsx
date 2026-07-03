import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calendar as CalendarIcon, 
  Flame, 
  Leaf, 
  TrendingDown, 
  TrendingUp, 
  Info, 
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Plus
} from 'lucide-react';
import { Transaction } from '../types';

interface ExpenseCalendarProps {
  transactions: Transaction[];
  currentMonth: number;
  currentYear: number;
}

export const ExpenseCalendar: React.FC<ExpenseCalendarProps> = ({
  transactions,
  currentMonth,
  currentYear
}) => {
  const [selectedDay, setSelectedDay] = useState<number | null>(() => {
    return new Date().getDate();
  });

  const MONTH_NAMES_PT = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  // Helper to get days in the current month
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  // Helper to get first day of the week index (0 = Sunday, 1 = Monday, etc.)
  const getFirstDayOfWeek = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  const totalDays = getDaysInMonth(currentYear, currentMonth);
  const firstDayIndex = getFirstDayOfWeek(currentYear, currentMonth);

  // Generate date string helper (YYYY-MM-DD)
  const formatDateString = (day: number) => {
    const mm = String(currentMonth + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return `${currentYear}-${mm}-${dd}`;
  };

  // Get financial stats for a specific day
  const getDayFinances = (day: number) => {
    const dateStr = formatDateString(day);
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
        bg: 'bg-emerald-50/50 hover:bg-emerald-100 dark:bg-emerald-950/20 dark:hover:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30',
        badge: 'bg-emerald-500 text-white',
        desc: 'Dia de Economia 🌿'
      };
    }
    if (despesas <= 50) {
      return {
        level: 'cool',
        bg: 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-900/60 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800',
        badge: 'bg-blue-500 text-white',
        desc: 'Gasto Controlado (Frio)'
      };
    }
    if (despesas <= 150) {
      return {
        level: 'warm',
        bg: 'bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/25 dark:hover:bg-amber-900/30 text-amber-800 dark:text-amber-400 border-amber-200 dark:border-amber-900/40',
        badge: 'bg-amber-500 text-white',
        desc: 'Gasto Moderado (Morno)'
      };
    }
    if (despesas <= 300) {
      return {
        level: 'hot',
        bg: 'bg-orange-50 hover:bg-orange-100 dark:bg-orange-950/30 dark:hover:bg-orange-900/40 text-orange-800 dark:text-orange-400 border-orange-200 dark:border-orange-800/60',
        badge: 'bg-orange-500 text-white',
        desc: 'Gasto Elevado (Quente) ⚠️'
      };
    }
    return {
      level: 'boiling',
      bg: 'bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/50 text-red-850 dark:text-red-400 border-red-200 dark:border-red-900/50 animate-pulse',
      badge: 'bg-red-600 text-white',
      desc: 'Alerta de Torneira Aberta (Fervendo) 🔥'
    };
  };

  // Calculate monthly stats
  let noSpendDays = 0;
  let highestSpendDay = 0;
  let highestSpendVal = 0;
  let totalExpensesThisMonth = 0;

  for (let d = 1; d <= totalDays; d++) {
    const { despesas } = getDayFinances(d);
    totalExpensesThisMonth += despesas;
    if (despesas === 0) noSpendDays++;
    if (despesas > highestSpendVal) {
      highestSpendVal = despesas;
      highestSpendDay = d;
    }
  }

  const averageDailySpend = totalDays > 0 ? totalExpensesThisMonth / totalDays : 0;

  // Selected Day Finances
  const activeDay = selectedDay ? Math.min(selectedDay, totalDays) : null;
  const activeFinances = activeDay ? getDayFinances(activeDay) : null;
  const activeThermometer = activeDay && activeFinances ? getThermometerStyle(activeFinances.despesas) : null;

  // Render weekdays header
  const weekdays = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

  // Calendar cells generation
  const cells = [];
  // Add empty cells for padding
  for (let i = 0; i < firstDayIndex; i++) {
    cells.push(<div key={`empty-${i}`} className="aspect-square bg-slate-100/30 dark:bg-slate-950/10 rounded-xl" />);
  }

  // Add actual days
  for (let day = 1; day <= totalDays; day++) {
    const finances = getDayFinances(day);
    const style = getThermometerStyle(finances.despesas);
    const isSelected = selectedDay === day;

    cells.push(
      <button
        key={`day-${day}`}
        onClick={() => setSelectedDay(day)}
        className={`aspect-square p-1.5 flex flex-col justify-between border rounded-xl transition-all duration-200 relative cursor-pointer group ${style.bg} ${
          isSelected 
            ? 'ring-2 ring-purple-500 border-purple-500 scale-102 z-10 shadow-md' 
            : 'shadow-2xs'
        }`}
      >
        <div className="flex items-center justify-between w-full">
          <span className={`text-[10px] md:text-xs font-black ${isSelected ? 'text-purple-600 dark:text-purple-400 font-extrabold' : ''}`}>
            {day}
          </span>
          {/* Economic Badge 🌿 or Indicator */}
          {finances.despesas === 0 ? (
            <Leaf className="w-2.5 h-2.5 text-emerald-500 fill-emerald-500/20" />
          ) : finances.despesas > 300 ? (
            <Flame className="w-2.5 h-2.5 text-red-500 fill-red-500/10 animate-bounce" />
          ) : null}
        </div>

        {/* Daily Spending Display */}
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

        {/* Subtle indicator dots */}
        {finances.items.length > 0 && (
          <div className="absolute bottom-1 left-1.5 flex gap-0.5">
            {finances.items.slice(0, 3).map((item, idx) => (
              <span 
                key={idx} 
                className={`w-1 h-1 rounded-full ${
                  item.tipoItem === 'despesa' ? 'bg-rose-500' : 'bg-emerald-500'
                }`}
              />
            ))}
          </div>
        )}
      </button>
    );
  }

  return (
    <div className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 md:p-5 shadow-xs transition-all duration-300">
      <div className="flex flex-col lg:flex-row gap-5">
        
        {/* CALENDAR VIEW */}
        <div className="flex-1 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-red-150/40 dark:bg-red-950/20 flex items-center justify-center text-red-600 dark:text-red-400">
                <CalendarIcon className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-1.5">
                  Termômetro de Gastos Mensal
                  <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400 rounded-md">
                    Interativo
                  </span>
                </h2>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                  {MONTH_NAMES_PT[currentMonth]} de {currentYear} • Cores indicam a intensidade de seus gastos diários
                </p>
              </div>
            </div>
            
            {/* Legend button */}
            <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-950 px-2.5 py-1 rounded-xl text-[9px] text-slate-500 font-bold border border-slate-150 dark:border-slate-800">
              <Sparkles className="w-3 h-3 text-purple-500" />
              <span>Cores mudam por temperatura</span>
            </div>
          </div>

          {/* WEEKDAYS HEADER */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {weekdays.map(d => (
              <span 
                key={d} 
                className="text-[9px] font-black text-slate-400 dark:text-slate-500 py-1"
              >
                {d}
              </span>
            ))}
          </div>

          {/* CALENDAR CELLS GRID */}
          <div className="grid grid-cols-7 gap-1">
            {cells}
          </div>

          {/* HEAT GRADIENT LEGEND */}
          <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800/60 rounded-xl px-3 py-2 text-[9px] font-bold text-slate-500 dark:text-slate-400">
            <span className="uppercase tracking-wider">Grau de Intensidade:</span>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-emerald-500" /> R$ 0 (Eco 🌿)</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-slate-300 dark:bg-slate-700" /> ≤ R$ 50</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-amber-500" /> ≤ R$ 150</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-orange-500" /> ≤ R$ 300</span>
              <span className="flex items-center gap-1 text-red-550 dark:text-red-400"><span className="w-2.5 h-2.5 rounded bg-red-600 animate-pulse" /> &gt; R$ 300</span>
            </div>
          </div>
        </div>

        {/* SIDE PANELS: MONTH SUMMARY & ACTIVE DAY DETAILS */}
        <div className="w-full lg:w-72 flex flex-col gap-4">
          
          {/* MONTH SUMMARY STATS ("Surpreenda-me" Cards) */}
          <div className="bg-slate-50 dark:bg-slate-950/50 rounded-xl p-3.5 border border-slate-100 dark:border-slate-850 space-y-3">
            <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              Relatório de Calorias Financeiras
            </h3>
            
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 p-2 rounded-xl text-center">
                <p className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase">Dias Limpos 🌿</p>
                <p className="text-sm font-black text-emerald-600 dark:text-emerald-400 mt-0.5">{noSpendDays} d</p>
                <p className="text-[7px] text-slate-500 dark:text-slate-400 font-medium">Gastou R$ 0,00</p>
              </div>
              <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 p-2 rounded-xl text-center">
                <p className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase">Média Diária</p>
                <p className="text-sm font-black text-purple-600 dark:text-purple-400 mt-0.5">R$ {Math.round(averageDailySpend)}</p>
                <p className="text-[7px] text-slate-500 dark:text-slate-400 font-medium">Alvo &lt; R$ 100/dia</p>
              </div>
            </div>

            {highestSpendVal > 0 ? (
              <div className="bg-orange-50/50 dark:bg-orange-950/10 border border-orange-100 dark:border-orange-950/30 p-2.5 rounded-xl flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 flex items-center justify-center">
                    <Flame className="w-4 h-4 animate-bounce" />
                  </div>
                  <div>
                    <p className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase leading-none">Pico de Gastos</p>
                    <p className="text-[11px] font-black text-slate-800 dark:text-slate-200 mt-1">Dia {highestSpendDay} de {MONTH_NAMES_PT[currentMonth]}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-black text-orange-600 dark:text-orange-400">R$ {highestSpendVal.toFixed(2)}</span>
                </div>
              </div>
            ) : (
              <div className="bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-100 dark:border-emerald-950/30 p-2.5 rounded-xl text-center text-[9px] font-bold text-emerald-600 dark:text-emerald-400">
                Parabéns! Nenhum centavo gasto este mês! 🎉
              </div>
            )}
          </div>

          {/* ACTIVE SELECTED DAY BREAKDOWN (Animate beautifully) */}
          <div className="flex-1 bg-slate-50 dark:bg-slate-950/50 rounded-xl p-3.5 border border-slate-100 dark:border-slate-850 flex flex-col justify-between min-h-[140px]">
            {activeDay && activeFinances && activeThermometer ? (
              <div className="space-y-3 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between border-b border-slate-150 dark:border-slate-800/80 pb-2">
                    <span className="text-xs font-black text-slate-700 dark:text-slate-300">
                      Dia {activeDay} de {MONTH_NAMES_PT[currentMonth]}
                    </span>
                    <span className={`text-[8px] px-2 py-0.5 rounded-md font-black uppercase ${activeThermometer.badge}`}>
                      {activeThermometer.desc}
                    </span>
                  </div>

                  {/* Day financial summaries */}
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div className="bg-slate-100 dark:bg-slate-900/80 px-2 py-1.5 rounded-lg">
                      <span className="text-[7px] text-slate-400 dark:text-slate-500 font-bold uppercase flex items-center gap-0.5">
                        <TrendingDown className="w-2.5 h-2.5 text-red-500" /> Gastos
                      </span>
                      <p className="text-xs font-black text-slate-800 dark:text-slate-200 mt-0.5">
                        R$ {activeFinances.despesas.toFixed(2)}
                      </p>
                    </div>
                    <div className="bg-slate-100 dark:bg-slate-900/80 px-2 py-1.5 rounded-lg">
                      <span className="text-[7px] text-slate-400 dark:text-slate-500 font-bold uppercase flex items-center gap-0.5">
                        <TrendingUp className="w-2.5 h-2.5 text-emerald-500" /> Recebido
                      </span>
                      <p className="text-xs font-black text-slate-800 dark:text-slate-200 mt-0.5">
                        R$ {activeFinances.receitas.toFixed(2)}
                      </p>
                    </div>
                  </div>

                  {/* List of transactions for selected day */}
                  <div className="mt-3.5 space-y-1.5 max-h-[120px] overflow-y-auto no-scrollbar">
                    {activeFinances.items.length > 0 ? (
                      activeFinances.items.map((item) => (
                        <div 
                          key={item.id}
                          className="flex items-center justify-between text-[10px] p-2 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/60 rounded-xl"
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
                        Nenhum lançamento no dia
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-2 text-[8px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
                  <Info className="w-3 h-3 text-purple-400" />
                  <span>Selecione outros dias no calendário para ver os detalhes.</span>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                <CalendarIcon className="w-7 h-7 text-slate-300 dark:text-slate-750 mb-1.5" />
                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold italic">
                  Selecione um dia do calendário para detalhar os lançamentos realizados!
                </p>
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
};
