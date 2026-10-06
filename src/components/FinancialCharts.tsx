import React, { useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell
} from 'recharts';
import { TrendingUp, BarChart2 } from 'lucide-react';
import { Transaction } from '../types';
import { ExpenseCalendar } from './ExpenseCalendar';

interface FinancialChartsProps {
  transactions: Transaction[];
  categorias: string[];
  currentMonth: number;
  currentYear: number;
  selectedAccountId?: string;
}

export const FinancialCharts: React.FC<FinancialChartsProps> = ({
  transactions,
  categorias,
  currentMonth,
  currentYear,
  selectedAccountId = 'consolidado'
}) => {
  const [periodoFiltro, setPeriodoFiltro] = useState<'7dias' | '15dias' | 'mes' | '3meses' | 'ano'>('mes');

  // Filter based on selected bank account
  const filteredByAccount = selectedAccountId && selectedAccountId !== 'consolidado'
    ? transactions.filter(t => t.accountId === selectedAccountId)
    : transactions;

  // Reference date
  const hoje = new Date();
  const isCurrentMonthYear = hoje.getMonth() === currentMonth && hoje.getFullYear() === currentYear;
  const refDate = isCurrentMonthYear ? hoje : new Date(currentYear, currentMonth + 1, 0);

  // Filter transactions for active period
  const getFilteredTransactions = () => {
    return filteredByAccount.filter((t) => {
      if (!t.data) return false;
      const parts = t.data.split('-');
      if (parts.length < 3) return false;
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      const tDate = new Date(y, m, d);

      if (periodoFiltro === '7dias') {
        const minDate = new Date(refDate);
        minDate.setDate(refDate.getDate() - 6);
        minDate.setHours(0, 0, 0, 0);
        const maxDate = new Date(refDate);
        maxDate.setHours(23, 59, 59, 999);
        return tDate >= minDate && tDate <= maxDate;
      }
      if (periodoFiltro === '15dias') {
        const minDate = new Date(refDate);
        minDate.setDate(refDate.getDate() - 14);
        minDate.setHours(0, 0, 0, 0);
        const maxDate = new Date(refDate);
        maxDate.setHours(23, 59, 59, 999);
        return tDate >= minDate && tDate <= maxDate;
      }
      if (periodoFiltro === '3meses') {
        const minDate = new Date(currentYear, currentMonth - 2, 1);
        minDate.setHours(0, 0, 0, 0);
        const maxDate = new Date(currentYear, currentMonth + 1, 0);
        maxDate.setHours(23, 59, 59, 999);
        return tDate >= minDate && tDate <= maxDate;
      }
      if (periodoFiltro === 'ano') {
        return y === currentYear;
      }
      return m === currentMonth && y === currentYear;
    });
  };

  const filteredTrans = getFilteredTransactions();

  // 1. Category Bar Data (Matching "Project Progress by Dept." in screenshot)
  const despesasPeriodo = filteredTrans.filter((t) => t.tipoItem === 'despesa');
  const totalDespesas = despesasPeriodo.reduce((acc, t) => acc + t.valor, 0);

  const categoryBarData = categorias
    .map((cat) => {
      const val = despesasPeriodo
        .filter((d) => d.categoria === cat)
        .reduce((sum, d) => sum + d.valor, 0);
      const percent = totalDespesas > 0 ? (val / totalDespesas) * 100 : 0;
      return {
        name: cat,
        valor: val,
        percent: Math.round(percent)
      };
    })
    .filter((c) => c.valor > 0)
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 5);

  // 2. Line Chart Data (Matching "Monthly Revenue | Last 12 Months" in screenshot)
  const lineData: Array<{ lbl: string; Receita: number; Gasto: number }> = [];

  if (periodoFiltro === 'ano') {
    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    for (let m = 0; m < 12; m++) {
      const mDespesas = filteredByAccount
        .filter(t => {
          if (!t.data) return false;
          const p = t.data.split('-');
          return parseInt(p[0], 10) === currentYear && (parseInt(p[1], 10) - 1) === m && t.tipoItem === 'despesa';
        })
        .reduce((s, t) => s + t.valor, 0);

      const mReceitas = filteredByAccount
        .filter(t => {
          if (!t.data) return false;
          const p = t.data.split('-');
          return parseInt(p[0], 10) === currentYear && (parseInt(p[1], 10) - 1) === m && t.tipoItem === 'receita';
        })
        .reduce((s, t) => s + t.valor, 0);

      lineData.push({
        lbl: monthNames[m],
        Gasto: parseFloat(mDespesas.toFixed(2)),
        Receita: parseFloat(mReceitas.toFixed(2))
      });
    }
  } else if (periodoFiltro === '3meses') {
    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    for (let i = -2; i <= 0; i++) {
      const targetDate = new Date(currentYear, currentMonth + i, 1);
      const mIdx = targetDate.getMonth();
      const yVal = targetDate.getFullYear();

      const mDespesas = filteredByAccount
        .filter(t => {
          if (!t.data) return false;
          const p = t.data.split('-');
          return parseInt(p[0], 10) === yVal && (parseInt(p[1], 10) - 1) === mIdx && t.tipoItem === 'despesa';
        })
        .reduce((s, t) => s + t.valor, 0);

      const mReceitas = filteredByAccount
        .filter(t => {
          if (!t.data) return false;
          const p = t.data.split('-');
          return parseInt(p[0], 10) === yVal && (parseInt(p[1], 10) - 1) === mIdx && t.tipoItem === 'receita';
        })
        .reduce((s, t) => s + t.valor, 0);

      lineData.push({
        lbl: monthNames[mIdx],
        Gasto: parseFloat(mDespesas.toFixed(2)),
        Receita: parseFloat(mReceitas.toFixed(2))
      });
    }
  } else {
    // Days in Month / 7 / 15 days
    const numDays = periodoFiltro === '7dias' ? 7 : periodoFiltro === '15dias' ? 15 : new Date(currentYear, currentMonth + 1, 0).getDate();
    const startDate = periodoFiltro === '7dias' || periodoFiltro === '15dias'
      ? new Date(refDate.getTime() - (numDays - 1) * 24 * 60 * 60 * 1000)
      : new Date(currentYear, currentMonth, 1);

    for (let i = 0; i < numDays; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      const yStr = d.getFullYear();
      const mStr = String(d.getMonth() + 1).padStart(2, '0');
      const dStr = String(d.getDate()).padStart(2, '0');
      const dateKey = `${yStr}-${mStr}-${dStr}`;

      const dayDespesas = filteredByAccount
        .filter(t => t.tipoItem === 'despesa' && t.data === dateKey)
        .reduce((s, t) => s + t.valor, 0);

      const dayReceitas = filteredByAccount
        .filter(t => t.tipoItem === 'receita' && t.data === dateKey)
        .reduce((s, t) => s + t.valor, 0);

      lineData.push({
        lbl: `${d.getDate()} ${periodoFiltro === 'mes' ? '' : `/${d.getMonth() + 1}`}`,
        Gasto: parseFloat(dayDespesas.toFixed(2)),
        Receita: parseFloat(dayReceitas.toFixed(2))
      });
    }
  }

  return (
    <div className="space-y-6">
      {/* SECTION: TWO-COLUMN EXECUTIVE DASHBOARD CHARTS (Matching reference image) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        {/* LEFT CHART: MONTHLY REVENUE / FLUXO FINANCEIRO (Wider col - 2/3) */}
        <div className="lg:col-span-2 bg-white dark:bg-[#1A1A1E] border border-zinc-200/80 dark:border-[#27272A] rounded-2xl p-5 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                Fluxo Financeiro
                <span className="text-xs font-normal text-zinc-400 dark:text-zinc-500">
                  | {periodoFiltro === 'ano' ? `Ano de ${currentYear}` : 'Evolução Temporal'}
                </span>
              </h3>
            </div>

            {/* Segmented Period Tabs */}
            <div className="flex bg-zinc-100/90 dark:bg-[#141416] p-1 rounded-xl text-xs font-semibold border border-zinc-200/80 dark:border-[#27272A] self-stretch sm:self-auto justify-between">
              {(['7dias', '15dias', 'mes', '3meses', 'ano'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setPeriodoFiltro(mode)}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer text-[11px] ${
                    periodoFiltro === mode
                      ? 'bg-white dark:bg-[#27272A] text-zinc-900 dark:text-white shadow-xs font-bold'
                      : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                  }`}
                >
                  {mode === '7dias' ? '7D' : mode === '15dias' ? '15D' : mode === 'mes' ? 'Mês' : mode === '3meses' ? '3M' : 'Ano'}
                </button>
              ))}
            </div>
          </div>

          <div className="h-64 sm:h-72 w-full mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineData} margin={{ top: 15, right: 15, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272A" opacity={0.6} />
                <XAxis
                  dataKey="lbl"
                  tick={{ fontSize: 10, fill: '#71717A' }}
                  stroke="#27272A"
                  axisLine={{ stroke: '#27272A' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#71717A' }}
                  stroke="#27272A"
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `R$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
                />
                <Tooltip
                  formatter={(val: number) => [`R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`]}
                  contentStyle={{
                    backgroundColor: '#1A1A1E',
                    borderColor: '#27272A',
                    borderRadius: '12px',
                    color: '#FFFFFF',
                    fontSize: '11px',
                    fontWeight: 600,
                    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)'
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="Receita"
                  stroke="#10B981"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#10B981', strokeWidth: 0 }}
                  activeDot={{ r: 6, fill: '#FFFFFF', stroke: '#10B981', strokeWidth: 2 }}
                  name="Receitas"
                />
                <Line
                  type="monotone"
                  dataKey="Gasto"
                  stroke="#71717A"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={{ r: 3, fill: '#71717A', strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: '#F43F5E', stroke: '#FFFFFF', strokeWidth: 2 }}
                  name="Despesas"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400 border-t border-zinc-100 dark:border-[#27272A] pt-3 mt-2">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                Receitas Realizadas
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-zinc-500 inline-block" />
                Despesas no Período
              </span>
            </div>
            <span className="font-mono text-zinc-400">
              {filteredTrans.length} transações
            </span>
          </div>
        </div>

        {/* RIGHT CHART: PROJECT PROGRESS BY DEPT. / GASTOS POR CATEGORIA (Matching reference image) */}
        <div className="bg-white dark:bg-[#1A1A1E] border border-zinc-200/80 dark:border-[#27272A] rounded-2xl p-5 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-zinc-400" />
              Gastos por Categoria
            </h3>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
              Distribuição proporcional das despesas
            </p>
          </div>

          <div className="h-64 sm:h-72 w-full mt-2">
            {categoryBarData.length === 0 ? (
              <div className="flex items-center justify-center h-full text-zinc-400 text-xs">
                Nenhum gasto registrado neste período.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={categoryBarData}
                  margin={{ top: 15, right: 10, left: -25, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272A" opacity={0.6} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 9, fill: '#71717A' }}
                    stroke="#27272A"
                    axisLine={{ stroke: '#27272A' }}
                    tickLine={false}
                    interval={0}
                    tickFormatter={(name) => name.length > 7 ? `${name.substring(0, 7)}.` : name}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#71717A' }}
                    stroke="#27272A"
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip
                    formatter={(val: number, _name: string, entry: any) => [
                      `R$ ${entry.payload.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${val}%)`,
                      'Percentual'
                    ]}
                    contentStyle={{
                      backgroundColor: '#1A1A1E',
                      borderColor: '#27272A',
                      borderRadius: '12px',
                      color: '#FFFFFF',
                      fontSize: '11px',
                      fontWeight: 600
                    }}
                  />
                  <Bar dataKey="percent" radius={[6, 6, 0, 0]} fill="#71717A">
                    {categoryBarData.map((_entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={index === 0 ? '#E4E4E7' : index === 1 ? '#A1A1AA' : index === 2 ? '#71717A' : '#52525B'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="text-[11px] text-zinc-400 dark:text-zinc-500 border-t border-zinc-100 dark:border-[#27272A] pt-3 mt-2 flex justify-between">
            <span>Total: R$ {totalDespesas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            <span>Top 5 Categorias</span>
          </div>
        </div>
      </div>

      {/* COMPACT INTERACTIVE EXPENSE CALENDAR */}
      <ExpenseCalendar
        transactions={filteredByAccount}
        currentMonth={currentMonth}
        currentYear={currentYear}
        periodoFiltro={periodoFiltro}
      />
    </div>
  );
};
