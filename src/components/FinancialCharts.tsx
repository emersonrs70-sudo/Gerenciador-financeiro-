import React, { useState } from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer,
  XAxis, YAxis, Tooltip, CartesianGrid
} from 'recharts';
import {
  TrendingUp, TrendingDown, PieChart as PieIcon, BarChart2,
  ShieldCheck, Target, ArrowUpRight, ArrowDownRight, Wallet, Sparkles, Layers, CheckCircle2
} from 'lucide-react';
import { motion } from 'motion/react';
import { Transaction, BankAccount } from '../types';
import { ExpenseCalendar } from './ExpenseCalendar';

interface FinancialChartsProps {
  transactions: Transaction[];
  categorias: string[];
  currentMonth: number;
  currentYear: number;
  selectedAccountId?: string;
  showCalendar?: boolean;
  accounts?: BankAccount[];
}

const PIE_COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#EC4899', // Pink
  '#8B5CF6', // Purple
  '#14B8A6', // Teal
  '#F43F5E', // Rose
  '#6366F1'  // Indigo
];

export const FinancialCharts: React.FC<FinancialChartsProps> = ({
  transactions,
  categorias,
  currentMonth,
  currentYear,
  selectedAccountId = 'consolidado',
  showCalendar = false,
  accounts = []
}) => {
  const [periodoFiltro, setPeriodoFiltro] = useState<'7dias' | '15dias' | 'mes' | '3meses' | 'ano'>('mes');
  const [modoPizza, setModoPizza] = useState<'despesa' | 'receita'>('despesa');
  const [hoveredPieIndex, setHoveredPieIndex] = useState<number | null>(null);

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

  // Metrics for active period
  const totalReceitasPeriodo = filteredTrans
    .filter(t => t.tipoItem === 'receita')
    .reduce((s, t) => s + t.valor, 0);

  const totalDespesasPeriodo = filteredTrans
    .filter(t => t.tipoItem === 'despesa')
    .reduce((s, t) => s + t.valor, 0);

  const saldoLiquidoPeriodo = totalReceitasPeriodo - totalDespesasPeriodo;
  const taxaPoupanca = totalReceitasPeriodo > 0 
    ? Math.max(0, Math.round(((totalReceitasPeriodo - totalDespesasPeriodo) / totalReceitasPeriodo) * 100))
    : 0;

  // 1. Time-series Data for AreaChart (Fluxo Financeiro)
  const fluxoData: Array<{ lbl: string; Receita: number; Gasto: number }> = [];

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

      fluxoData.push({
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

      fluxoData.push({
        lbl: monthNames[mIdx],
        Gasto: parseFloat(mDespesas.toFixed(2)),
        Receita: parseFloat(mReceitas.toFixed(2))
      });
    }
  } else {
    // Daily view: 7 days, 15 days, or whole month
    const daysCount = periodoFiltro === '7dias' ? 7 : periodoFiltro === '15dias' ? 15 : new Date(currentYear, currentMonth + 1, 0).getDate();
    const startDay = periodoFiltro === 'mes' ? 1 : Math.max(1, refDate.getDate() - daysCount + 1);
    const endDay = periodoFiltro === 'mes' ? daysCount : refDate.getDate();

    for (let d = startDay; d <= endDay; d++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dDespesas = filteredTrans
        .filter(t => t.data === dateStr && t.tipoItem === 'despesa')
        .reduce((s, t) => s + t.valor, 0);
      const dReceitas = filteredTrans
        .filter(t => t.data === dateStr && t.tipoItem === 'receita')
        .reduce((s, t) => s + t.valor, 0);

      fluxoData.push({
        lbl: `${d}/${currentMonth + 1}`,
        Gasto: parseFloat(dDespesas.toFixed(2)),
        Receita: parseFloat(dReceitas.toFixed(2))
      });
    }
  }

  // 2. Pie / Donut Chart Data (Categorias)
  const transactionsModoPizza = filteredTrans.filter(t => t.tipoItem === modoPizza);
  const totalModoPizza = transactionsModoPizza.reduce((s, t) => s + t.valor, 0);

  const categoryTotals: { [cat: string]: number } = {};
  transactionsModoPizza.forEach(t => {
    categoryTotals[t.categoria] = (categoryTotals[t.categoria] || 0) + t.valor;
  });

  const pieData = Object.entries(categoryTotals)
    .map(([name, value], idx) => ({
      name,
      value: parseFloat(value.toFixed(2)),
      percent: totalModoPizza > 0 ? Math.round((value / totalModoPizza) * 100) : 0,
      color: PIE_COLORS[idx % PIE_COLORS.length]
    }))
    .sort((a, b) => b.value - a.value);

  // 3. Comparativo Mensal Data (Last 5 Months)
  const monthNamesShort = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const comparativoData: Array<{ mes: string; Receitas: number; Despesas: number; Saldo: number }> = [];
  for (let i = -4; i <= 0; i++) {
    const d = new Date(currentYear, currentMonth + i, 1);
    const mIdx = d.getMonth();
    const yVal = d.getFullYear();

    const mDesp = filteredByAccount
      .filter(t => {
        if (!t.data) return false;
        const p = t.data.split('-');
        return parseInt(p[0], 10) === yVal && (parseInt(p[1], 10) - 1) === mIdx && t.tipoItem === 'despesa';
      })
      .reduce((s, t) => s + t.valor, 0);

    const mRec = filteredByAccount
      .filter(t => {
        if (!t.data) return false;
        const p = t.data.split('-');
        return parseInt(p[0], 10) === yVal && (parseInt(p[1], 10) - 1) === mIdx && t.tipoItem === 'receita';
      })
      .reduce((s, t) => s + t.valor, 0);

    comparativoData.push({
      mes: `${monthNamesShort[mIdx]}`,
      Receitas: parseFloat(mRec.toFixed(2)),
      Despesas: parseFloat(mDesp.toFixed(2)),
      Saldo: parseFloat((mRec - mDesp).toFixed(2))
    });
  }

  // 4. Balanço Patrimonial & Liquidez
  const accountBalances: { [id: string]: number } = {};
  accounts.forEach(acc => {
    let bal = acc.saldoInicial;
    const accTrans = transactions.filter(t => t.accountId === acc.id);
    accTrans.forEach(t => {
      if (acc.tipo === 'credito') {
        bal += (t.tipoItem === 'despesa' ? t.valor : -t.valor);
      } else {
        bal += (t.tipoItem === 'receita' ? t.valor : -t.valor);
      }
    });
    accountBalances[acc.id] = bal;
  });

  const totalPatrimonioLiquido = accounts
    .filter(a => a.tipo !== 'credito')
    .reduce((sum, a) => sum + (accountBalances[a.id] ?? a.saldoInicial), 0);

  const totalDividasCartao = accounts
    .filter(a => a.tipo === 'credito')
    .reduce((sum, a) => sum + (accountBalances[a.id] ?? 0), 0);

  // 5. Projeção Financeira & Regra 50-30-20
  const mediaGastosDiarios = despesasMesMedia();
  function despesasMesMedia() {
    const pastDays = Math.max(1, hoje.getDate());
    const totalGasto = filteredTrans
      .filter(t => t.tipoItem === 'despesa')
      .reduce((s, t) => s + t.valor, 0);
    return totalGasto / pastDays;
  }
  const projecaoFimMes = totalDespesasPeriodo + mediaGastosDiarios * Math.max(0, new Date(currentYear, currentMonth + 1, 0).getDate() - hoje.getDate());

  // Rule 50-30-20 breakdown
  const necessidadesKeywords = ['moradia', 'aluguel', 'luz', 'agua', 'energia', 'alimentação', 'mercado', 'saúde', 'transporte', 'condomínio', 'educação', 'educacao', 'contas'];
  const desejosKeywords = ['lazer', 'cinema', 'restaurante', 'viagem', 'bar', 'shopping', 'roupa', 'assinaturas', 'netflix', 'spotify'];
  const poupancaKeywords = ['investimento', 'investimentos', 'poupança', 'poupanca', 'reserva', 'fundo', 'emergência', 'emergencia', 'aporte', 'tesouro', 'cdb', 'ações', 'acoes', 'caixinha'];

  let necessidadesTotal = 0;
  let desejosTotal = 0;
  let aportesPoupancaTotal = 0;

  filteredTrans.filter(t => t.tipoItem === 'despesa').forEach(t => {
    const c = t.categoria.toLowerCase();
    const d = (t.descricao || '').toLowerCase();
    if (necessidadesKeywords.some(k => c.includes(k) || d.includes(k))) {
      necessidadesTotal += t.valor;
    } else if (poupancaKeywords.some(k => c.includes(k) || d.includes(k))) {
      aportesPoupancaTotal += t.valor;
    } else {
      desejosTotal += t.valor;
    }
  });

  const baseOrcamento = totalReceitasPeriodo > 0 ? totalReceitasPeriodo : Math.max(1, totalDespesasPeriodo);
  const pctNecessidades = Math.min(100, Math.round((necessidadesTotal / baseOrcamento) * 100));
  const pctDesejos = Math.min(100, Math.round((desejosTotal / baseOrcamento) * 100));

  // Total destinado à poupança e reserva: aportes intencionais + sobra líquida livre em conta
  const sobraLivre = Math.max(0, totalReceitasPeriodo - (necessidadesTotal + desejosTotal + aportesPoupancaTotal));
  const totalDestinadoPoupanca = aportesPoupancaTotal + sobraLivre;
  const pctPoupanca = Math.min(100, Math.round((totalDestinadoPoupanca / baseOrcamento) * 100));

  const formatCurrency = (val: number) => {
    return `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="space-y-3.5">
      {/* 3x2 HARMONIC GRID (3 columns on desktop, 2 rows) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 items-stretch">
        
        {/* ROW 1: CELL 1 & 2 (COL-SPAN 2) - FLUXO FINANCEIRO EVOLUTIVO */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="lg:col-span-2 bg-white dark:bg-[#32323F] border border-[#E8E5DC] dark:border-[#4C4E5D]/60 rounded-2xl p-3.5 sm:p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col justify-between"
        >
          <div>
            {/* Header + Period Selector */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-[#EAE7E0] dark:border-[#4C4E5D]/50 pb-2.5">
              <div>
                <h3 className="text-xs sm:text-sm font-bold flex items-center gap-1.5 text-zinc-900 dark:text-white">
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                  Fluxo Financeiro Dinâmico
                </h3>
                <p className="text-[10px] text-zinc-500 dark:text-[#988E96]">
                  Acompanhamento de Receitas vs Despesas em tempo real
                </p>
              </div>

              {/* Period selector tabs */}
              <div className="flex bg-[#F3F1EB] dark:bg-[#252530] p-0.5 rounded-lg text-[10px] font-semibold border border-[#E8E5DC] dark:border-[#4C4E5D]/60 self-stretch sm:self-auto justify-between">
                {(['7dias', '15dias', 'mes', '3meses', 'ano'] as const).map((p) => {
                  const labels = { '7dias': '7D', '15dias': '15D', 'mes': 'Mês', '3meses': '3M', 'ano': 'Ano' };
                  return (
                    <button
                      key={p}
                      onClick={() => setPeriodoFiltro(p)}
                      className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                        periodoFiltro === p
                          ? 'bg-white dark:bg-[#4C4E5D] text-zinc-900 dark:text-white shadow-xs font-bold'
                          : 'text-zinc-600 dark:text-[#988E96] hover:text-zinc-900 dark:hover:text-white'
                      }`}
                    >
                      {labels[p]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 my-2.5">
              <div className="p-2 bg-[#F8F7F4] dark:bg-[#252530] rounded-xl border border-[#E8E5DC] dark:border-[#4C4E5D]/50">
                <span className="text-[9px] text-zinc-500 dark:text-zinc-400 block font-medium">Receitas</span>
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                  +{formatCurrency(totalReceitasPeriodo)}
                </span>
              </div>
              <div className="p-2 bg-[#F8F7F4] dark:bg-[#252530] rounded-xl border border-[#E8E5DC] dark:border-[#4C4E5D]/50">
                <span className="text-[9px] text-zinc-500 dark:text-zinc-400 block font-medium">Despesas</span>
                <span className="text-xs font-bold text-rose-600 dark:text-rose-400 font-mono">
                  -{formatCurrency(totalDespesasPeriodo)}
                </span>
              </div>
              <div className="p-2 bg-[#F8F7F4] dark:bg-[#252530] rounded-xl border border-[#E8E5DC] dark:border-[#4C4E5D]/50">
                <span className="text-[9px] text-zinc-500 dark:text-zinc-400 block font-medium">Saldo Líquido</span>
                <span className={`text-xs font-bold font-mono ${saldoLiquidoPeriodo >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                  {saldoLiquidoPeriodo >= 0 ? '+' : ''}{formatCurrency(saldoLiquidoPeriodo)}
                </span>
              </div>
              <div className="p-2 bg-[#F8F7F4] dark:bg-[#252530] rounded-xl border border-[#E8E5DC] dark:border-[#4C4E5D]/50">
                <span className="text-[9px] text-zinc-500 dark:text-zinc-400 block font-medium">Poupança</span>
                <span className="text-xs font-bold text-zinc-900 dark:text-white font-mono flex items-center gap-1">
                  {taxaPoupanca}%
                  <span className="text-[8px] text-zinc-400 font-normal">taxa</span>
                </span>
              </div>
            </div>

            {/* Smooth AreaChart */}
            <div className="h-36 sm:h-40 xl:h-44 w-full mt-1">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={fluxoData} margin={{ top: 5, right: 10, left: -22, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorReceita" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0.0}/>
                    </linearGradient>
                    <linearGradient id="colorGasto" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F43F5E" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#F43F5E" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#4C4E5D" opacity={0.25} />
                  <XAxis
                    dataKey="lbl"
                    tick={{ fontSize: 9, fill: '#8E8E93' }}
                    stroke="#E8E5DC"
                    axisLine={{ stroke: '#E8E5DC' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 9, fill: '#8E8E93' }}
                    stroke="#E8E5DC"
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : `${v}`}
                  />
                  <Tooltip
                    formatter={(val: number, name: string) => [
                      `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                      name === 'Receita' ? 'Receitas (+)' : 'Despesas (-)'
                    ]}
                    contentStyle={{
                      backgroundColor: '#32323F',
                      borderColor: '#4C4E5D',
                      borderRadius: '12px',
                      color: '#FFFFFF',
                      fontSize: '11px',
                      fontWeight: 600,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="Receita"
                    stroke="#10B981"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorReceita)"
                  />
                  <Area
                    type="monotone"
                    dataKey="Gasto"
                    stroke="#F43F5E"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorGasto)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="flex items-center justify-between text-[10px] text-zinc-500 dark:text-[#988E96] border-t border-[#EAE7E0] dark:border-[#4C4E5D]/60 pt-2 mt-1">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500" /> Receitas
              </span>
              <span className="flex items-center gap-1 font-medium">
                <span className="w-2 h-2 rounded-full bg-rose-500" /> Despesas
              </span>
            </div>
            <span className="font-mono text-zinc-600 dark:text-zinc-300">
              Cobertura: {totalDespesasPeriodo > 0 ? (totalReceitasPeriodo / totalDespesasPeriodo).toFixed(1) : '∞'}x
            </span>
          </div>
        </motion.div>

        {/* ROW 1: CELL 3 (COL-SPAN 1) - GRÁFICO DE PIZZA / DONUT DAS CATEGORIAS */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.05 }}
          className="bg-white dark:bg-[#32323F] border border-[#E8E5DC] dark:border-[#4C4E5D]/60 rounded-2xl p-3.5 sm:p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col justify-between"
        >
          <div>
            <div className="flex justify-between items-center border-b border-[#EAE7E0] dark:border-[#4C4E5D]/50 pb-2.5">
              <div>
                <h3 className="text-xs sm:text-sm font-bold flex items-center gap-1.5 text-zinc-900 dark:text-white">
                  <PieIcon className="w-4 h-4 text-blue-500" />
                  Divisão por Categoria
                </h3>
                <p className="text-[10px] text-zinc-500 dark:text-[#988E96]">
                  Distribuição percentual dos fluxos
                </p>
              </div>

              {/* Toggle Despesas vs Receitas */}
              <div className="flex bg-[#F3F1EB] dark:bg-[#252530] p-0.5 rounded-lg border border-[#E8E5DC] dark:border-[#4C4E5D]/50 text-[10px] font-bold">
                <button
                  onClick={() => setModoPizza('despesa')}
                  className={`px-2 py-0.5 rounded-md cursor-pointer transition-all ${
                    modoPizza === 'despesa'
                      ? 'bg-white dark:bg-[#4C4E5D] text-rose-600 dark:text-rose-400 shadow-xs'
                      : 'text-zinc-500 hover:text-zinc-800 dark:text-[#988E96]'
                  }`}
                >
                  Despesas
                </button>
                <button
                  onClick={() => setModoPizza('receita')}
                  className={`px-2 py-0.5 rounded-md cursor-pointer transition-all ${
                    modoPizza === 'receita'
                      ? 'bg-white dark:bg-[#4C4E5D] text-emerald-600 dark:text-emerald-400 shadow-xs'
                      : 'text-zinc-500 hover:text-zinc-800 dark:text-[#988E96]'
                  }`}
                >
                  Receitas
                </button>
              </div>
            </div>

            {/* Donut Chart Container */}
            <div className="relative h-32 sm:h-36 w-full my-1.5 flex items-center justify-center">
              {pieData.length === 0 ? (
                <div className="text-zinc-400 text-xs text-center">
                  Sem dados de {modoPizza === 'despesa' ? 'despesas' : 'receitas'} neste período.
                </div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Tooltip
                        formatter={(val: number, name: string) => [
                          `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                          name
                        ]}
                        contentStyle={{
                          backgroundColor: '#32323F',
                          borderColor: '#4C4E5D',
                          borderRadius: '12px',
                          color: '#FFFFFF',
                          fontSize: '11px',
                          fontWeight: 600
                        }}
                      />
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={42}
                        outerRadius={64}
                        paddingAngle={3}
                        onMouseEnter={(_, idx) => setHoveredPieIndex(idx)}
                        onMouseLeave={() => setHoveredPieIndex(null)}
                      >
                        {pieData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry.color}
                            stroke="#FFFFFF"
                            strokeWidth={hoveredPieIndex === index ? 3 : 1}
                            style={{ outline: 'none', transition: 'all 0.2s' }}
                          />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>

                  {/* Center Info in Donut */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                    <span className="text-[9px] text-zinc-400 uppercase tracking-wider font-semibold">
                      {hoveredPieIndex !== null && pieData[hoveredPieIndex] ? pieData[hoveredPieIndex].name : 'Total'}
                    </span>
                    <span className="text-xs font-bold text-zinc-900 dark:text-white font-mono">
                      {hoveredPieIndex !== null && pieData[hoveredPieIndex]
                        ? formatCurrency(pieData[hoveredPieIndex].value)
                        : formatCurrency(totalModoPizza)}
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Top Categories List */}
            <div className="space-y-1 max-h-24 overflow-y-auto pr-1 custom-scrollbar">
              {pieData.slice(0, 3).map((cat) => (
                <div key={cat.name} className="flex items-center justify-between text-[11px] py-0.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                    <span className="truncate text-zinc-700 dark:text-zinc-200 font-medium">{cat.name}</span>
                  </div>
                  <div className="flex items-center gap-2 font-mono shrink-0">
                    <span className="text-zinc-500 dark:text-zinc-400 text-[10px]">{cat.percent}%</span>
                    <span className="font-bold text-zinc-900 dark:text-white text-[10px]">{formatCurrency(cat.value)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="text-[10px] text-zinc-500 dark:text-[#988E96] border-t border-[#EAE7E0] dark:border-[#4C4E5D]/60 pt-2 mt-1 flex justify-between">
            <span>{pieData.length} categorias</span>
            <span className="font-mono font-bold text-zinc-800 dark:text-[#DDD5D0]">{formatCurrency(totalModoPizza)}</span>
          </div>
        </motion.div>

        {/* ROW 2: CELL 4 (COL-SPAN 1) - COMPARATIVO MENSAL (EVOLUÇÃO & METAS) */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.1 }}
          className="bg-white dark:bg-[#32323F] border border-[#E8E5DC] dark:border-[#4C4E5D]/60 rounded-2xl p-3.5 sm:p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col justify-between"
        >
          <div>
            <div className="flex justify-between items-center border-b border-[#EAE7E0] dark:border-[#4C4E5D]/50 pb-2.5">
              <div>
                <h3 className="text-xs sm:text-sm font-bold flex items-center gap-1.5 text-zinc-900 dark:text-white">
                  <BarChart2 className="w-4 h-4 text-indigo-500" />
                  Comparativo Mensal
                </h3>
                <p className="text-[10px] text-zinc-500 dark:text-[#988E96]">
                  Evolução mês a mês das contas
                </p>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
                5 Meses
              </span>
            </div>

            {/* Bar Chart Receitas vs Despesas */}
            <div className="h-32 sm:h-36 w-full mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparativoData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#4C4E5D" opacity={0.2} />
                  <XAxis
                    dataKey="mes"
                    tick={{ fontSize: 9, fill: '#8E8E93' }}
                    stroke="#E8E5DC"
                    axisLine={{ stroke: '#E8E5DC' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 9, fill: '#8E8E93' }}
                    stroke="#E8E5DC"
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `${(v/1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(val: number, name: string) => [
                      `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                      name
                    ]}
                    contentStyle={{
                      backgroundColor: '#32323F',
                      borderColor: '#4C4E5D',
                      borderRadius: '12px',
                      color: '#FFFFFF',
                      fontSize: '11px',
                      fontWeight: 600
                    }}
                  />
                  <Bar dataKey="Receitas" fill="#10B981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Despesas" fill="#F43F5E" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="flex items-center justify-between text-[10px] text-zinc-500 dark:text-[#988E96] border-t border-[#EAE7E0] dark:border-[#4C4E5D]/60 pt-2 mt-1">
            <span className="flex items-center gap-1 font-medium">
              <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500" />
              Média: {formatCurrency(comparativoData.reduce((s, c) => s + c.Despesas, 0) / comparativoData.length)}
            </span>
            <span className="font-mono text-zinc-700 dark:text-zinc-200 font-bold">
              {saldoLiquidoPeriodo >= 0 ? 'Superávit' : 'Déficit'}
            </span>
          </div>
        </motion.div>

        {/* ROW 2: CELL 5 (COL-SPAN 1) - BALANÇO PATRIMONIAL & LIQUIDEZ */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.15 }}
          className="bg-white dark:bg-[#32323F] border border-[#E8E5DC] dark:border-[#4C4E5D]/60 rounded-2xl p-3.5 sm:p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col justify-between"
        >
          <div>
            <div className="flex justify-between items-center border-b border-[#EAE7E0] dark:border-[#4C4E5D]/50 pb-2.5">
              <div>
                <h3 className="text-xs sm:text-sm font-bold flex items-center gap-1.5 text-zinc-900 dark:text-white">
                  <Wallet className="w-4 h-4 text-emerald-500" />
                  Balanço Patrimonial
                </h3>
                <p className="text-[10px] text-zinc-500 dark:text-[#988E96]">
                  Distribuição de liquidez e saldos
                </p>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                Consolidado
              </span>
            </div>

            <div className="my-2 space-y-2">
              {/* Total Consolidated Value */}
              <div className="p-2.5 bg-[#F8F7F4] dark:bg-[#252530] rounded-xl border border-[#E8E5DC] dark:border-[#4C4E5D]/50">
                <span className="text-[9px] text-zinc-500 dark:text-zinc-400 block font-medium">Patrimônio Líquido</span>
                <span className="text-base font-extrabold text-zinc-900 dark:text-white font-mono">
                  {formatCurrency(totalPatrimonioLiquido)}
                </span>
                <div className="flex items-center gap-1.5 text-[9px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                  <span>Cartões:</span>
                  <strong className="text-rose-500 font-mono font-bold">{formatCurrency(totalDividasCartao)}</strong>
                </div>
              </div>

              {/* Account Breakdown Bars */}
              <div className="space-y-1.5 max-h-24 overflow-y-auto pr-1 custom-scrollbar">
                {accounts.slice(0, 3).map((acc) => {
                  const bal = accountBalances[acc.id] ?? acc.saldoInicial;
                  const ratio = totalPatrimonioLiquido > 0 ? Math.max(0, Math.min(100, (bal / totalPatrimonioLiquido) * 100)) : 0;
                  return (
                    <div key={acc.id} className="space-y-0.5">
                      <div className="flex justify-between text-[11px]">
                        <span className="font-semibold text-zinc-700 dark:text-zinc-200 truncate">{acc.nome}</span>
                        <span className="font-mono text-zinc-900 dark:text-white font-bold">{formatCurrency(bal)}</span>
                      </div>
                      <div className="h-1 w-full bg-zinc-100 dark:bg-[#252530] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#4C4E5D] dark:bg-[#DDD5D0] rounded-full"
                          style={{ width: `${ratio}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="text-[10px] text-zinc-500 dark:text-[#988E96] border-t border-[#EAE7E0] dark:border-[#4C4E5D]/60 pt-2 mt-1 flex justify-between items-center">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
              Liquidez Estável
            </span>
            <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200">
              {accounts.length} contas
            </span>
          </div>
        </motion.div>

        {/* ROW 2: CELL 6 (COL-SPAN 1) - PROJEÇÃO FINANCEIRA & REGRA 50-30-20 */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.2 }}
          className="bg-white dark:bg-[#32323F] border border-[#E8E5DC] dark:border-[#4C4E5D]/60 rounded-2xl p-3.5 sm:p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col justify-between"
        >
          <div>
            <div className="flex justify-between items-center border-b border-[#EAE7E0] dark:border-[#4C4E5D]/50 pb-2.5">
              <div>
                <h3 className="text-xs sm:text-sm font-bold flex items-center gap-1.5 text-zinc-900 dark:text-white">
                  <Target className="w-4 h-4 text-amber-500" />
                  Projeção & Orçamento
                </h3>
                <p className="text-[10px] text-zinc-500 dark:text-[#988E96]">
                  Previsão e Regra 50-30-20
                </p>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                pctNecessidades <= 55
                  ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                  : 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400'
              }`}>
                {pctNecessidades <= 55 ? 'Equilibrado' : 'Atenção'}
              </span>
            </div>

            <div className="my-2 space-y-2">
              {/* Previsão de Fechamento */}
              <div className="p-2 bg-[#F8F7F4] dark:bg-[#252530] rounded-xl border border-[#E8E5DC] dark:border-[#4C4E5D]/50 flex justify-between items-center">
                <div>
                  <span className="text-[9px] text-zinc-500 dark:text-zinc-400 block font-medium">Previsão Fim do Mês</span>
                  <span className="text-[10px] text-zinc-700 dark:text-zinc-300">Ritmo atual diário</span>
                </div>
                <span className="text-xs font-bold text-rose-600 dark:text-rose-400 font-mono">
                  {formatCurrency(projecaoFimMes)}
                </span>
              </div>

              {/* 50-30-20 Budget Health Progress Bars */}
              <div className="space-y-1.5">
                {/* Necessidades (50%) */}
                <div className="space-y-0.5">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-zinc-700 dark:text-zinc-300 font-medium">Necessidades (50%)</span>
                    <span className="font-mono font-bold text-zinc-900 dark:text-white">{pctNecessidades}%</span>
                  </div>
                  <div className="h-1 w-full bg-zinc-100 dark:bg-[#252530] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${pctNecessidades <= 55 ? 'bg-blue-500' : 'bg-rose-500'}`}
                      style={{ width: `${pctNecessidades}%` }}
                    />
                  </div>
                </div>

                {/* Desejos (30%) */}
                <div className="space-y-0.5">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-zinc-700 dark:text-zinc-300 font-medium">Desejos (30%)</span>
                    <span className="font-mono font-bold text-zinc-900 dark:text-white">{pctDesejos}%</span>
                  </div>
                  <div className="h-1 w-full bg-zinc-100 dark:bg-[#252530] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${pctDesejos <= 35 ? 'bg-amber-500' : 'bg-rose-500'}`}
                      style={{ width: `${pctDesejos}%` }}
                    />
                  </div>
                </div>

                {/* Poupança/Investimentos (20%) */}
                <div className="space-y-0.5">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-zinc-700 dark:text-zinc-300 font-medium">Investimentos (20%)</span>
                    <span className="font-mono font-bold text-zinc-900 dark:text-white">{pctPoupanca}%</span>
                  </div>
                  <div className="h-1 w-full bg-zinc-100 dark:bg-[#252530] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{ width: `${pctPoupanca}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="text-[10px] text-zinc-500 dark:text-[#988E96] border-t border-[#EAE7E0] dark:border-[#4C4E5D]/60 pt-2 mt-1 flex justify-between">
            <span>Status</span>
            <span className="font-bold text-zinc-800 dark:text-zinc-200">
              {pctNecessidades <= 50 ? 'Meta Cumprida' : 'Ajustar Custos'}
            </span>
          </div>
        </motion.div>

      </div>

      {/* COMPACT INTERACTIVE EXPENSE CALENDAR (Optional) */}
      {showCalendar && (
        <ExpenseCalendar
          transactions={filteredByAccount}
          currentMonth={currentMonth}
          currentYear={currentYear}
          periodoFiltro={periodoFiltro}
        />
      )}
    </div>
  );
};
