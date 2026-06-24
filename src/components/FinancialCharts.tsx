import React, { useState } from 'react';
import {
  BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
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
  const [periodoFiltro, setPeriodoFiltro] = useState<'7dias' | '15dias' | 'mes' | '3meses' | 'ano'>('mes');

  // Determinar data de referência baseada na navegação de meses do usuário
  const hoje = new Date();
  const isCurrentMonthYear = hoje.getMonth() === currentMonth && hoje.getFullYear() === currentYear;
  
  // Se for o mês atual, a referência é o dia de hoje. Se for outro mês, é o último dia daquele mês.
  const refDate = isCurrentMonthYear
    ? hoje
    : new Date(currentYear, currentMonth + 1, 0);

  // Filtragem unificada de transações de acordo com o período selecionado
  const getFilteredTransactions = () => {
    return transactions.filter((t) => {
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
        // Primeiro dia de 2 meses atrás até o último dia do mês atual selecionado
        const minDate = new Date(currentYear, currentMonth - 2, 1);
        minDate.setHours(0, 0, 0, 0);
        const maxDate = new Date(currentYear, currentMonth + 1, 0);
        maxDate.setHours(23, 59, 59, 999);
        return tDate >= minDate && tDate <= maxDate;
      }
      if (periodoFiltro === 'ano') {
        return y === currentYear;
      }
      // Padrão: 'mes' (Mês Selecionado Completo)
      return m === currentMonth && y === currentYear;
    });
  };

  const filteredTrans = getFilteredTransactions();

  // 1. CHART: PIE / CATEGORY (Despesas por categoria no período)
  const despesasPeriodo = filteredTrans.filter((t) => t.tipoItem === 'despesa');
  const pieData = categorias
    .map((cat) => {
      const value = despesasPeriodo
        .filter((d) => d.categoria === cat)
        .reduce((sum, d) => sum + d.valor, 0);
      return { name: cat, value };
    })
    .filter((v) => v.value > 0);

  // 2. CHART: AREA / CUMULATIVE DUAL PROGRESSION (Receitas vs Despesas acumuladas no período)
  const lineData = [];
  let cumGasto = 0;
  let cumReceita = 0;

  if (periodoFiltro === '7dias' || periodoFiltro === '15dias') {
    const numDays = periodoFiltro === '7dias' ? 7 : 15;
    const start = new Date(refDate);
    start.setDate(refDate.getDate() - (numDays - 1));
    
    for (let i = 0; i < numDays; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const yStr = d.getFullYear();
      const mStr = String(d.getMonth() + 1).padStart(2, '0');
      const dStr = String(d.getDate()).padStart(2, '0');
      const dateKey = `${yStr}-${mStr}-${dStr}`;
      
      const dayDespesas = transactions
        .filter(t => t.tipoItem === 'despesa' && t.data === dateKey)
        .reduce((s, t) => s + t.valor, 0);
        
      const dayReceitas = transactions
        .filter(t => t.tipoItem === 'receita' && t.data === dateKey)
        .reduce((s, t) => s + t.valor, 0);
        
      cumGasto += dayDespesas;
      cumReceita += dayReceitas;
      
      lineData.push({
        lbl: `${d.getDate()}/${d.getMonth() + 1}`,
        Gasto: parseFloat(cumGasto.toFixed(2)),
        Receita: parseFloat(cumReceita.toFixed(2))
      });
    }
  } else if (periodoFiltro === '3meses') {
    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    for (let i = -2; i <= 0; i++) {
      const targetDate = new Date(currentYear, currentMonth + i, 1);
      const mIdx = targetDate.getMonth();
      const yVal = targetDate.getFullYear();
      
      const mDespesas = transactions
        .filter(t => {
          if (!t.data) return false;
          const p = t.data.split('-');
          return parseInt(p[0], 10) === yVal && (parseInt(p[1], 10) - 1) === mIdx && t.tipoItem === 'despesa';
        })
        .reduce((s, t) => s + t.valor, 0);
        
      const mReceitas = transactions
        .filter(t => {
          if (!t.data) return false;
          const p = t.data.split('-');
          return parseInt(p[0], 10) === yVal && (parseInt(p[1], 10) - 1) === mIdx && t.tipoItem === 'receita';
        })
        .reduce((s, t) => s + t.valor, 0);
        
      cumGasto += mDespesas;
      cumReceita += mReceitas;
      
      lineData.push({
        lbl: monthNames[mIdx],
        Gasto: parseFloat(cumGasto.toFixed(2)),
        Receita: parseFloat(cumReceita.toFixed(2))
      });
    }
  } else if (periodoFiltro === 'ano') {
    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    for (let m = 0; m < 12; m++) {
      const mDespesas = transactions
        .filter(t => {
          if (!t.data) return false;
          const p = t.data.split('-');
          return parseInt(p[0], 10) === currentYear && (parseInt(p[1], 10) - 1) === m && t.tipoItem === 'despesa';
        })
        .reduce((s, t) => s + t.valor, 0);
        
      const mReceitas = transactions
        .filter(t => {
          if (!t.data) return false;
          const p = t.data.split('-');
          return parseInt(p[0], 10) === currentYear && (parseInt(p[1], 10) - 1) === m && t.tipoItem === 'receita';
        })
        .reduce((s, t) => s + t.valor, 0);
        
      cumGasto += mDespesas;
      cumReceita += mReceitas;
      
      lineData.push({
        lbl: monthNames[m],
        Gasto: parseFloat(cumGasto.toFixed(2)),
        Receita: parseFloat(cumReceita.toFixed(2))
      });
    }
  } else {
    // 'mes' (Mês Selecionado Completo)
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const endDay = isCurrentMonthYear ? hoje.getDate() : daysInMonth;
    
    for (let d = 1; d <= endDay; d++) {
      const dDespesas = transactions
        .filter(t => {
          if (!t.data) return false;
          const p = t.data.split('-');
          return parseInt(p[0], 10) === currentYear && (parseInt(p[1], 10) - 1) === currentMonth && parseInt(p[2], 10) === d && t.tipoItem === 'despesa';
        })
        .reduce((s, t) => s + t.valor, 0);
        
      const dReceitas = transactions
        .filter(t => {
          if (!t.data) return false;
          const p = t.data.split('-');
          return parseInt(p[0], 10) === currentYear && (parseInt(p[1], 10) - 1) === currentMonth && parseInt(p[2], 10) === d && t.tipoItem === 'receita';
        })
        .reduce((s, t) => s + t.valor, 0);
        
      cumGasto += dDespesas;
      cumReceita += dReceitas;
      
      lineData.push({
        lbl: `Dia ${d}`,
        Gasto: parseFloat(cumGasto.toFixed(2)),
        Receita: parseFloat(cumReceita.toFixed(2))
      });
    }
  }

  // 3. CHART: BAR / COMPARATIVE (Total de Entradas vs Saídas no período)
  const totalDespesasPeriodo = filteredTrans.filter((t) => t.tipoItem === 'despesa').reduce((s, t) => s + t.valor, 0);
  const totalReceitasPeriodo = filteredTrans.filter((t) => t.tipoItem === 'receita').reduce((s, t) => s + t.valor, 0);
  
  const barData = [
    {
      name: periodoFiltro === '7dias' ? '7 Dias' :
            periodoFiltro === '15dias' ? '15 Dias' :
            periodoFiltro === '3meses' ? 'Trimestre' :
            periodoFiltro === 'ano' ? 'Ano' : 'Este Mês',
      Receitas: totalReceitasPeriodo,
      Despesas: totalDespesasPeriodo
    }
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white dark:bg-slate-900 border border-slate-250/50 dark:border-slate-800 p-4 rounded-2xl shadow-2xs">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-950/40 flex items-center justify-center text-purple-600 dark:text-purple-400">
            <BarChart3 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">
              Estatísticas e Distribuições Visuais
            </h3>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
              Análise estratégica e projeção gráfica unificada
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 self-start sm:self-center">
          <span className="text-[9px] uppercase font-bold text-slate-400 dark:text-slate-550 hidden md:inline">Período Ativo:</span>
          <select
            value={periodoFiltro}
            onChange={(e) => setPeriodoFiltro(e.target.value as any)}
            className="text-[10px] font-black bg-slate-50 hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer transition-colors"
          >
            <option value="7dias">Últimos 7 dias</option>
            <option value="15dias">Últimos 15 dias</option>
            <option value="mes">Este Mês (Completo)</option>
            <option value="3meses">Últimos 3 Meses</option>
            <option value="ano">Ano Inteiro ({currentYear})</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* CHART 1: PIE / CATEGORY */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl h-80 shadow-xs flex flex-col justify-between border-t-4 border-t-purple-500 transition-all">
          <div>
            <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-550">
              Expêndito por Categoria
            </h4>
            <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-0.5">
              Onde você está gastando no período selecionado
            </p>
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

        {/* CHART 2: AREA / DUAL ACCUMULATION PROGRESSION */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl h-80 shadow-xs flex flex-col justify-between border-t-4 border-t-blue-500 transition-all lg:col-span-1">
          <div>
            <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-550">
              Progressão do Fluxo de Caixa
            </h4>
            <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-0.5">
              Comparativo de Receita vs Gasto Acumulado
            </p>
          </div>
          <div className="h-52 w-full mt-2">
            {lineData.length === 0 ? (
              <div className="flex items-center justify-center h-full text-slate-400 text-xs font-semibold">
                Nenhum dado de movimentação.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={lineData} margin={{ top: 10, right: 5, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorGasto" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.01}/>
                    </linearGradient>
                    <linearGradient id="colorReceita" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.01}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" className="opacity-40 dark:hidden" />
                  <XAxis dataKey="lbl" tick={{ fontSize: 9, fontWeight: 'bold' }} stroke="#94a3b8" />
                  <YAxis tick={{ fontSize: 9, fontWeight: 'bold' }} stroke="#94a3b8" />
                  <Tooltip
                    formatter={(val: number) => [`R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`]}
                    contentStyle={{ borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' }}
                  />
                  <Legend verticalAlign="top" height={24} iconSize={8} iconType="circle" formatter={(v) => <span className="text-[9px] font-bold text-slate-500 uppercase">{v}</span>} />
                  <Area
                    type="monotone"
                    dataKey="Receita"
                    stroke="#10b981"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorReceita)"
                    name="Entradas Acumuladas"
                    activeDot={{ r: 5 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="Gasto"
                    stroke="#3b82f6"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorGasto)"
                    name="Saídas Acumuladas"
                    activeDot={{ r: 5 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* CHART 3: BAR / INCOME VS DESPESAS COMPARISON */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl h-80 shadow-xs flex flex-col justify-between border-t-4 border-t-emerald-500 transition-all">
          <div>
            <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-550">
              Proporção de Caixa no Período
            </h4>
            <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-0.5">
              Relação direta de volume entre entradas e saídas
            </p>
          </div>
          <div className="h-52 w-full mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} barGap={12} barCategoryGap="20%" margin={{ top: 10, right: 5, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" className="opacity-40 dark:hidden" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 'bold' }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 9, fontWeight: 'bold' }} stroke="#94a3b8" />
                <Tooltip
                  formatter={(val: number) => [`R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`]}
                  contentStyle={{ borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' }}
                />
                <Legend verticalAlign="bottom" height={24} iconSize={8} iconType="circle" formatter={(v) => <span className="text-[9px] font-bold text-slate-500 uppercase">{v}</span>} />
                <Bar dataKey="Receitas" fill="#10b981" radius={[8, 8, 0, 0]} name="Total Entradas" />
                <Bar dataKey="Despesas" fill="#f43f5e" radius={[8, 8, 0, 0]} name="Total Saídas" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
