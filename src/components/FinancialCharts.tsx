import React, { useState } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import { BarChart3 } from 'lucide-react';
import { Transaction } from '../types';

interface FinancialChartsProps {
  transactions: Transaction[];
  categorias: string[];
  currentMonth: number;
  currentYear: number;
}

const COLORS = ['#a855f7', '#3b82f6', '#10b981', '#f43f5e', '#f59e0b', '#64748b'];

export const FinancialCharts: React.FC<FinancialChartsProps> = ({
  transactions,
  categorias,
  currentMonth,
  currentYear
}) => {
  const [periodoFiltro, setPeriodoFiltro] = useState<'30dias' | '7dias'>('30dias');

  // Filter current month transactions
  const despesasMes = transactions.filter((t) => {
    const d = new Date(t.data);
    return (
      t.tipoItem === 'despesa' &&
      d.getMonth() === currentMonth &&
      d.getFullYear() === currentYear
    );
  });

  const receitasMes = transactions.filter((t) => {
    const d = new Date(t.data);
    return (
      t.tipoItem === 'receita' &&
      d.getMonth() === currentMonth &&
      d.getFullYear() === currentYear
    );
  });

  const totalDespesas = despesasMes.reduce((s, t) => s + t.valor, 0);
  const totalReceitas = receitasMes.reduce((s, t) => s + t.valor, 0);

  // 1. Data Category distribution (Doughnut)
  const pieData = categorias
    .map((cat) => {
      const value = despesasMes
        .filter((d) => d.categoria === cat)
        .reduce((sum, d) => sum + d.valor, 0);
      return { name: cat, value };
    })
    .filter((v) => v.value > 0);

  // 2. Data Daily cumulative progression
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const rawLineData = [];
  let cumulativeValue = 0;

  // Select period layout (30 days vs 7 days)
  const loopLimit = periodoFiltro === '30dias' ? daysInMonth : 7;
  const startDay = periodoFiltro === '30dias' ? 1 : Math.max(1, new Date().getDate() - 6);
  const endDay = periodoFiltro === '30dias' ? daysInMonth : new Date().getDate();

  for (let d = startDay; d <= endDay; d++) {
    const dayExp = despesasMes
      .filter((item) => new Date(item.data).getDate() === d)
      .reduce((s, item) => s + item.valor, 0);
    cumulativeValue += dayExp;
    rawLineData.push({
      lbl: `Dia ${d}`,
      Gasto: parseFloat(cumulativeValue.toFixed(2))
    });
  }

  // 3. Data Income vs Outgoings comparison
  const barData = [
    {
      name: 'Resumo',
      Receitas: totalReceitas,
      Despesas: totalDespesas
    }
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
          <BarChart3 className="w-4 h-4 text-purple-600" />
          Estatísticas e Distribuições Visuais
        </h3>
        <select
          value={periodoFiltro}
          onChange={(e) => setPeriodoFiltro(e.target.value as '30dias' | '7dias')}
          className="text-[10px] font-black bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
        >
          <option value="30dias">Mês Inteiro (Parcial)</option>
          <option value="7dias">Últimos 7 dias</option>
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* CHART 1: PIE / CATEGORY */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl h-80 shadow-xs flex flex-col justify-between border-t-4 border-t-purple-500">
          <div>
            <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Expêndito por Categoria
            </h4>
          </div>
          <div className="h-52 w-full mt-2 relative">
            {pieData.length === 0 ? (
              <div className="flex items-center justify-center h-full text-slate-400 text-xs font-semibold">
                Nenhum gasto lançado para análise.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: number) => [
                      `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                      'Gasto'
                    ]}
                    contentStyle={{ borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    iconSize={8}
                    iconType="circle"
                    formatter={(value) => <span className="text-[9px] font-bold text-slate-500 uppercase">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* CHART 2: LINE / DAILY ACCUMULATION */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl h-80 shadow-xs flex flex-col justify-between border-t-4 border-t-blue-500">
          <div>
            <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Acumulação de Gastos no Período
            </h4>
          </div>
          <div className="h-52 w-full mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rawLineData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" className="dark:hidden" />
                <XAxis dataKey="lbl" tick={{ fontSize: 9, fontWeight: 'bold' }} />
                <YAxis tick={{ fontSize: 9, fontWeight: 'bold' }} />
                <Tooltip
                  formatter={(val: number) => [`R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Gasto Acumulado']}
                  contentStyle={{ borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' }}
                />
                <Line
                  type="monotone"
                  dataKey="Gasto"
                  stroke="#3b82f6"
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* CHART 3: BAR / INCOME VS DESPESAS */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl h-80 shadow-xs flex flex-col justify-between border-t-4 border-t-emerald-500">
          <div>
            <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Proporção de Caixa Diário (Reclusão)
            </h4>
          </div>
          <div className="h-52 w-full mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} barCategoryGap="25%">
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" className="dark:hidden" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 'bold' }} />
                <YAxis tick={{ fontSize: 9, fontWeight: 'bold' }} />
                <Tooltip
                  formatter={(val: number) => [`R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`]}
                  contentStyle={{ borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' }}
                />
                <Bar dataKey="Receitas" fill="#10b981" radius={[8, 8, 0, 0]} name="Entradas" />
                <Bar dataKey="Despesas" fill="#f43f5e" radius={[8, 8, 0, 0]} name="Saídas" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
