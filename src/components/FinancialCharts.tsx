import React, { useState, useMemo } from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer,
  XAxis, YAxis, Tooltip, CartesianGrid
} from 'recharts';
import {
  TrendingUp, TrendingDown, PieChart as PieIcon, BarChart2,
  ShieldCheck, Target, ArrowUpRight, ArrowDownRight, Wallet, Sparkles, Layers, CheckCircle2,
  Filter, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
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

  // Alteração 1: Clicked category in pie chart to expand to 1.5 space & show transactions table
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Alteração 2: Category filter in dynamic financial flow
  const [fluxoCategoriaFiltro, setFluxoCategoriaFiltro] = useState<string>('todas');

  // Filter based on selected bank account
  const filteredByAccount = selectedAccountId && selectedAccountId !== 'consolidado'
    ? transactions.filter(t => t.accountId === selectedAccountId)
    : transactions;

  // Available categories for dropdown filter
  const { categoriasDespesaList, categoriasReceitaList } = useMemo(() => {
    const desp = new Set<string>();
    const rec = new Set<string>();
    filteredByAccount.forEach(t => {
      if (t.tipoItem === 'despesa' && t.categoria) desp.add(t.categoria);
      if (t.tipoItem === 'receita' && t.categoria) rec.add(t.categoria);
    });
    categorias.forEach(c => {
      if (!desp.has(c) && !rec.has(c)) {
        desp.add(c);
      }
    });
    return {
      categoriasDespesaList: Array.from(desp).sort((a, b) => a.localeCompare(b)),
      categoriasReceitaList: Array.from(rec).sort((a, b) => a.localeCompare(b))
    };
  }, [filteredByAccount, categorias]);

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

  // Category filter state analysis
  const isCategoryFiltered = fluxoCategoriaFiltro !== 'todas';
  const filteredCategoryIsReceita = isCategoryFiltered && categoriasReceitaList.includes(fluxoCategoriaFiltro);
  const filteredCategoryIsDespesa = isCategoryFiltered && categoriasDespesaList.includes(fluxoCategoriaFiltro);

  // 1. Time-series Data for AreaChart (Fluxo Financeiro)
  const fluxoData: Array<{ lbl: string; Receita: number; Gasto: number }> = [];

  if (periodoFiltro === 'ano') {
    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    for (let m = 0; m < 12; m++) {
      const mDespesas = filteredByAccount
        .filter(t => {
          if (!t.data) return false;
          const p = t.data.split('-');
          const matchDate = parseInt(p[0], 10) === currentYear && (parseInt(p[1], 10) - 1) === m;
          const matchCat = !isCategoryFiltered || t.categoria === fluxoCategoriaFiltro;
          return matchDate && matchCat && t.tipoItem === 'despesa';
        })
        .reduce((s, t) => s + t.valor, 0);

      const mReceitas = filteredByAccount
        .filter(t => {
          if (!t.data) return false;
          const p = t.data.split('-');
          const matchDate = parseInt(p[0], 10) === currentYear && (parseInt(p[1], 10) - 1) === m;
          const matchCat = !isCategoryFiltered || t.categoria === fluxoCategoriaFiltro;
          return matchDate && matchCat && t.tipoItem === 'receita';
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
          const matchDate = parseInt(p[0], 10) === yVal && (parseInt(p[1], 10) - 1) === mIdx;
          const matchCat = !isCategoryFiltered || t.categoria === fluxoCategoriaFiltro;
          return matchDate && matchCat && t.tipoItem === 'despesa';
        })
        .reduce((s, t) => s + t.valor, 0);

      const mReceitas = filteredByAccount
        .filter(t => {
          if (!t.data) return false;
          const p = t.data.split('-');
          const matchDate = parseInt(p[0], 10) === yVal && (parseInt(p[1], 10) - 1) === mIdx;
          const matchCat = !isCategoryFiltered || t.categoria === fluxoCategoriaFiltro;
          return matchDate && matchCat && t.tipoItem === 'receita';
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
        .filter(t => {
          const matchDate = t.data === dateStr;
          const matchCat = !isCategoryFiltered || t.categoria === fluxoCategoriaFiltro;
          return matchDate && matchCat && t.tipoItem === 'despesa';
        })
        .reduce((s, t) => s + t.valor, 0);
      const dReceitas = filteredTrans
        .filter(t => {
          const matchDate = t.data === dateStr;
          const matchCat = !isCategoryFiltered || t.categoria === fluxoCategoriaFiltro;
          return matchDate && matchCat && t.tipoItem === 'receita';
        })
        .reduce((s, t) => s + t.valor, 0);

      fluxoData.push({
        lbl: `${d}/${currentMonth + 1}`,
        Gasto: parseFloat(dDespesas.toFixed(2)),
        Receita: parseFloat(dReceitas.toFixed(2))
      });
    }
  }

  // Filtered Category Metrics for Quick Bar
  const filteredCategoryTrans = filteredTrans.filter(t => t.categoria === fluxoCategoriaFiltro);
  const totalCategoryFiltered = filteredCategoryTrans.reduce((s, t) => s + t.valor, 0);
  const totalBaseComparison = filteredCategoryIsReceita ? totalReceitasPeriodo : totalDespesasPeriodo;
  const categorySharePct = totalBaseComparison > 0 ? Math.round((totalCategoryFiltered / totalBaseComparison) * 100) : 0;
  const countCategoryFiltered = filteredCategoryTrans.length;
  const mediaCategoriaPorPonto = fluxoData.length > 0 ? totalCategoryFiltered / fluxoData.length : 0;

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

  // Selected Category Transactions for Drilldown Table (Alteração 1)
  const selectedCategoryTransactions = useMemo(() => {
    if (!selectedCategory) return [];
    return filteredTrans
      .filter(t => t.tipoItem === modoPizza && t.categoria.toLowerCase() === selectedCategory.toLowerCase())
      .sort((a, b) => {
        const dateA = a.data ? new Date(a.data).getTime() : 0;
        const dateB = b.data ? new Date(b.data).getTime() : 0;
        return dateB - dateA;
      });
  }, [selectedCategory, filteredTrans, modoPizza]);

  const selectedCategoryTotal = useMemo(() => {
    return selectedCategoryTransactions.reduce((acc, t) => acc + t.valor, 0);
  }, [selectedCategoryTransactions]);

  const selectedCategoryPct = totalModoPizza > 0
    ? Math.round((selectedCategoryTotal / totalModoPizza) * 100)
    : 0;

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
      {/* ROW 1: FLUID TRANSITIONING TOP CARDS (50%/50% when selected, 66.6%/33.3% default) */}
      <div className="flex flex-col lg:flex-row gap-3.5 items-stretch w-full">
        
        {/* CARD 1: FLUXO FINANCEIRO DINÂMICO */}
        <div
          className={`w-full ${
            selectedCategory ? 'lg:w-1/2' : 'lg:w-2/3'
          } transition-[width] duration-300 ease-out bg-white dark:bg-[#32323F] border border-[#E8E5DC] dark:border-[#4C4E5D]/60 rounded-2xl p-3.5 sm:p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col justify-between overflow-hidden`}
        >
          <div>
            {/* Header + Category Filter + Period Selector */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-[#EAE7E0] dark:border-[#4C4E5D]/50 pb-2.5">
              <div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h3 className="text-xs sm:text-sm font-bold flex items-center gap-1.5 text-zinc-900 dark:text-white">
                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                    Fluxo Financeiro Dinâmico
                  </h3>
                  {isCategoryFiltered && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/50">
                      <span>{fluxoCategoriaFiltro}</span>
                      <button
                        onClick={() => setFluxoCategoriaFiltro('todas')}
                        className="hover:text-rose-500 cursor-pointer ml-0.5"
                        title="Remover filtro de categoria"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-zinc-500 dark:text-[#988E96]">
                  {isCategoryFiltered
                    ? `Filtrando movimentações de "${fluxoCategoriaFiltro}"`
                    : 'Acompanhamento de Receitas vs Despesas em tempo real'}
                </p>
              </div>

              {/* Controls: Category Filter Dropdown + Period selector */}
              <div className="flex items-center gap-1.5 flex-wrap self-stretch sm:self-auto justify-between sm:justify-end">
                {/* Alteração 2: Category Filter Dropdown */}
                <div className="flex items-center gap-1 bg-[#F3F1EB] dark:bg-[#252530] px-2 py-1 rounded-lg border border-[#E8E5DC] dark:border-[#4C4E5D]/60 text-[10px]">
                  <Filter className="w-3 h-3 text-zinc-500 dark:text-zinc-400 shrink-0" />
                  <select
                    value={fluxoCategoriaFiltro}
                    onChange={(e) => setFluxoCategoriaFiltro(e.target.value)}
                    className="bg-transparent text-zinc-800 dark:text-zinc-200 font-medium outline-none cursor-pointer max-w-[110px] sm:max-w-[130px] truncate"
                    title="Filtrar fluxo por categoria"
                  >
                    <option value="todas">Todas as Categorias</option>
                    {categoriasDespesaList.length > 0 && (
                      <optgroup label="Despesas">
                        {categoriasDespesaList.map((c) => (
                          <option key={`flx-desp-${c}`} value={c}>
                            {c}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {categoriasReceitaList.length > 0 && (
                      <optgroup label="Receitas">
                        {categoriasReceitaList.map((c) => (
                          <option key={`flx-rec-${c}`} value={c}>
                            {c}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>

                {/* Period selector tabs */}
                <div className="flex bg-[#F3F1EB] dark:bg-[#252530] p-0.5 rounded-lg text-[10px] font-semibold border border-[#E8E5DC] dark:border-[#4C4E5D]/60">
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
            </div>

            {/* Quick Metrics Bar: Dynamically adapts to filtered category */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 my-2.5">
              {!isCategoryFiltered ? (
                <>
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
                </>
              ) : (
                <>
                  <div className="p-2 bg-[#F8F7F4] dark:bg-[#252530] rounded-xl border border-[#E8E5DC] dark:border-[#4C4E5D]/50">
                    <span className="text-[9px] text-zinc-500 dark:text-zinc-400 block font-medium">Total Filtrado</span>
                    <span className={`text-xs font-bold font-mono ${filteredCategoryIsReceita ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                      {filteredCategoryIsReceita ? '+' : '-'}{formatCurrency(totalCategoryFiltered)}
                    </span>
                  </div>
                  <div className="p-2 bg-[#F8F7F4] dark:bg-[#252530] rounded-xl border border-[#E8E5DC] dark:border-[#4C4E5D]/50">
                    <span className="text-[9px] text-zinc-500 dark:text-zinc-400 block font-medium">Participação</span>
                    <span className="text-xs font-bold text-zinc-900 dark:text-white font-mono flex items-center gap-1">
                      {categorySharePct}%
                      <span className="text-[8px] text-zinc-400 font-normal">do total</span>
                    </span>
                  </div>
                  <div className="p-2 bg-[#F8F7F4] dark:bg-[#252530] rounded-xl border border-[#E8E5DC] dark:border-[#4C4E5D]/50">
                    <span className="text-[9px] text-zinc-500 dark:text-zinc-400 block font-medium">Lançamentos</span>
                    <span className="text-xs font-bold text-zinc-900 dark:text-white font-mono">
                      {countCategoryFiltered} {countCategoryFiltered === 1 ? 'item' : 'itens'}
                    </span>
                  </div>
                  <div className="p-2 bg-[#F8F7F4] dark:bg-[#252530] rounded-xl border border-[#E8E5DC] dark:border-[#4C4E5D]/50">
                    <span className="text-[9px] text-zinc-500 dark:text-zinc-400 block font-medium">Média no Período</span>
                    <span className="text-xs font-bold text-zinc-900 dark:text-white font-mono">
                      {formatCurrency(mediaCategoriaPorPonto)}
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Smooth AreaChart with Debounce to prevent 60fps re-draw stalls during resize */}
            <div className="h-36 sm:h-40 xl:h-44 w-full mt-1">
              <ResponsiveContainer width="100%" height="100%" debounce={40}>
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
                    formatter={(val: number, name: string) => {
                      const label = isCategoryFiltered
                        ? name === 'Gasto'
                          ? `${fluxoCategoriaFiltro} (-)`
                          : `${fluxoCategoriaFiltro} (+)`
                        : name === 'Receita'
                          ? 'Receitas (+)'
                          : 'Despesas (-)';
                      return [`R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, label];
                    }}
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
                  {(!isCategoryFiltered || filteredCategoryIsReceita || fluxoData.some(d => d.Receita > 0)) && (
                    <Area
                      type="monotone"
                      dataKey="Receita"
                      stroke="#10B981"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorReceita)"
                    />
                  )}
                  {(!isCategoryFiltered || filteredCategoryIsDespesa || fluxoData.some(d => d.Gasto > 0)) && (
                    <Area
                      type="monotone"
                      dataKey="Gasto"
                      stroke="#F43F5E"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorGasto)"
                    />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="flex items-center justify-between text-[10px] text-zinc-500 dark:text-[#988E96] border-t border-[#EAE7E0] dark:border-[#4C4E5D]/60 pt-2 mt-1">
            <div className="flex items-center gap-3">
              {isCategoryFiltered ? (
                <span className="flex items-center gap-1 font-medium text-zinc-700 dark:text-zinc-200">
                  <span className={`w-2 h-2 rounded-full ${filteredCategoryIsReceita ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                  {fluxoCategoriaFiltro} ({countCategoryFiltered} registros)
                </span>
              ) : (
                <>
                  <span className="flex items-center gap-1 font-medium">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" /> Receitas
                  </span>
                  <span className="flex items-center gap-1 font-medium">
                    <span className="w-2 h-2 rounded-full bg-rose-500" /> Despesas
                  </span>
                </>
              )}
            </div>
            {isCategoryFiltered ? (
              <button
                onClick={() => setFluxoCategoriaFiltro('todas')}
                className="font-mono text-zinc-600 dark:text-zinc-300 hover:text-emerald-500 cursor-pointer underline text-[10px]"
              >
                Limpar filtro
              </button>
            ) : (
              <span className="font-mono text-zinc-600 dark:text-zinc-300">
                Cobertura: {totalDespesasPeriodo > 0 ? (totalReceitasPeriodo / totalDespesasPeriodo).toFixed(1) : '∞'}x
              </span>
            )}
          </div>
        </div>

        {/* CARD 2: DIVISÃO POR CATEGORIA */}
        <div
          className={`w-full ${
            selectedCategory ? 'lg:w-1/2' : 'lg:w-1/3'
          } transition-[width] duration-300 ease-out bg-white dark:bg-[#32323F] border border-[#E8E5DC] dark:border-[#4C4E5D]/60 rounded-2xl p-3.5 sm:p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col justify-between overflow-hidden`}
        >
          <div>
            {/* Header + Toggle + Close selection */}
            <div className="flex justify-between items-center border-b border-[#EAE7E0] dark:border-[#4C4E5D]/50 pb-2.5">
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <div>
                  <h3 className="text-xs sm:text-sm font-bold flex items-center gap-1.5 text-zinc-900 dark:text-white">
                    <PieIcon className="w-4 h-4 text-blue-500 shrink-0" />
                    <span>Divisão por Categoria</span>
                  </h3>
                  <p className="text-[10px] text-zinc-500 dark:text-[#988E96]">
                    {selectedCategory ? 'Clique para alternar ou fechar o detalhe' : 'Clique em uma fatia para detalhar'}
                  </p>
                </div>
                {selectedCategory && (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200 border border-blue-200 dark:border-blue-800/60 truncate max-w-[130px]">
                    {selectedCategory}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {/* Toggle Despesas vs Receitas */}
                <div className="flex bg-[#F3F1EB] dark:bg-[#252530] p-0.5 rounded-lg border border-[#E8E5DC] dark:border-[#4C4E5D]/50 text-[10px] font-bold">
                  <button
                    onClick={() => {
                      setModoPizza('despesa');
                      setSelectedCategory(null);
                    }}
                    className={`px-2 py-0.5 rounded-md cursor-pointer transition-all ${
                      modoPizza === 'despesa'
                        ? 'bg-white dark:bg-[#4C4E5D] text-rose-600 dark:text-rose-400 shadow-xs'
                        : 'text-zinc-500 hover:text-zinc-800 dark:text-[#988E96]'
                    }`}
                  >
                    Despesas
                  </button>
                  <button
                    onClick={() => {
                      setModoPizza('receita');
                      setSelectedCategory(null);
                    }}
                    className={`px-2 py-0.5 rounded-md cursor-pointer transition-all ${
                      modoPizza === 'receita'
                        ? 'bg-white dark:bg-[#4C4E5D] text-emerald-600 dark:text-emerald-400 shadow-xs'
                        : 'text-zinc-500 hover:text-zinc-800 dark:text-[#988E96]'
                    }`}
                  >
                    Receitas
                  </button>
                </div>

                {/* Close category drilldown button */}
                {selectedCategory && (
                  <button
                    onClick={() => setSelectedCategory(null)}
                    className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-[#F3F1EB] dark:hover:bg-[#252530] transition-colors cursor-pointer"
                    title="Fechar detalhamento e restaurar proporção original"
                    aria-label="Fechar detalhamento"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Stable Layout Structure with Side-by-Side Flex (Never stacks vertically during exit) */}
            <div className="flex flex-col sm:flex-row gap-3 my-1.5 items-stretch min-w-0">
              {/* Left Column: Donut Chart + Category switcher */}
              <div className={`flex flex-col items-center justify-between min-w-0 transition-[width] duration-300 ease-out ${
                selectedCategory ? 'w-full sm:w-1/2' : 'w-full'
              }`}>
                <div className="relative h-32 sm:h-36 w-full flex items-center justify-center">
                  {pieData.length === 0 ? (
                    <div className="text-zinc-400 text-xs text-center">
                      Sem dados de {modoPizza === 'despesa' ? 'despesas' : 'receitas'} neste período.
                    </div>
                  ) : (
                    <>
                      <ResponsiveContainer width="100%" height="100%" debounce={40}>
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
                            innerRadius={selectedCategory ? 36 : 42}
                            outerRadius={selectedCategory ? 56 : 64}
                            paddingAngle={3}
                            onMouseEnter={(_, idx) => setHoveredPieIndex(idx)}
                            onMouseLeave={() => setHoveredPieIndex(null)}
                            onClick={(data) => {
                              if (data && data.name) {
                                setSelectedCategory((prev) => (prev === data.name ? null : data.name));
                              }
                            }}
                            className="cursor-pointer"
                          >
                            {pieData.map((entry, index) => {
                              const isSelected = selectedCategory?.toLowerCase() === entry.name.toLowerCase();
                              return (
                                <Cell
                                  key={`drill-cell-${index}`}
                                  fill={entry.color}
                                  stroke={isSelected ? '#18181B' : '#FFFFFF'}
                                  strokeWidth={isSelected ? 2.5 : (hoveredPieIndex === index ? 3 : 1)}
                                  opacity={selectedCategory && !isSelected ? 0.45 : 1}
                                  style={{ outline: 'none', cursor: 'pointer', transition: 'opacity 0.2s' }}
                                />
                              );
                            })}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>

                      {/* Center Info in Donut */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-1">
                        <span className="text-[9px] text-zinc-400 uppercase tracking-wider font-semibold truncate max-w-[85px]">
                          {selectedCategory || (hoveredPieIndex !== null && pieData[hoveredPieIndex] ? pieData[hoveredPieIndex].name : 'Total')}
                        </span>
                        <span className="text-xs font-bold text-zinc-900 dark:text-white font-mono">
                          {selectedCategory
                            ? formatCurrency(selectedCategoryTotal)
                            : hoveredPieIndex !== null && pieData[hoveredPieIndex]
                              ? formatCurrency(pieData[hoveredPieIndex].value)
                              : formatCurrency(totalModoPizza)}
                        </span>
                        {selectedCategory && (
                          <span className="text-[9px] text-zinc-500 font-medium">
                            {selectedCategoryPct}% do total
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* When NOT selected: Top 3 Categories List */}
                {!selectedCategory ? (
                  <div className="space-y-1 max-h-24 overflow-y-auto pr-1 w-full custom-scrollbar">
                    {pieData.slice(0, 3).map((cat) => (
                      <div
                        key={cat.name}
                        onClick={() => setSelectedCategory(cat.name)}
                        className="flex items-center justify-between text-[11px] py-1 px-1.5 rounded-lg hover:bg-[#F8F7F4] dark:hover:bg-[#252530] transition-colors cursor-pointer group"
                        title="Clique para detalhar esta categoria"
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                          <span className="truncate text-zinc-700 dark:text-zinc-200 font-medium group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            {cat.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 font-mono shrink-0">
                          <span className="text-zinc-500 dark:text-zinc-400 text-[10px]">{cat.percent}%</span>
                          <span className="font-bold text-zinc-900 dark:text-white text-[10px]">{formatCurrency(cat.value)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  /* When selected: Category Switcher Pills */
                  <div className="flex flex-wrap gap-1 justify-center max-h-14 overflow-y-auto w-full custom-scrollbar pt-1">
                    {pieData.map((cat) => {
                      const isSelected = selectedCategory?.toLowerCase() === cat.name.toLowerCase();
                      return (
                        <button
                          key={`pill-${cat.name}`}
                          onClick={() => setSelectedCategory(isSelected ? null : cat.name)}
                          className={`px-1.5 py-0.5 rounded text-[9px] font-medium transition-all flex items-center gap-1 cursor-pointer ${
                            isSelected
                              ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-xs'
                              : 'bg-[#F3F1EB] dark:bg-[#252530] text-zinc-600 dark:text-zinc-300 hover:bg-[#EAE7E0]'
                          }`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                          <span className="truncate max-w-[80px]">{cat.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Right Column: Transactions Table (Instant clean unmount on close so height never jumps) */}
              {selectedCategory && (
                <div className="flex flex-col justify-between border-t sm:border-t-0 sm:border-l border-[#EAE7E0] dark:border-[#4C4E5D]/50 pt-2 sm:pt-0 sm:pl-3 min-w-0 w-full sm:w-1/2 transition-opacity duration-200">
                  <div>
                    <div className="flex items-center justify-between mb-1.5 pb-1 border-b border-[#EAE7E0] dark:border-[#4C4E5D]/30">
                      <span className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200">
                        Lançamentos no Período
                      </span>
                      <span className="text-[10px] font-mono font-semibold text-zinc-500 dark:text-zinc-400">
                        {selectedCategoryTransactions.length} {selectedCategoryTransactions.length === 1 ? 'item' : 'itens'}
                      </span>
                    </div>

                    <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                      {selectedCategoryTransactions.length === 0 ? (
                        <div className="p-4 text-center text-zinc-400 dark:text-zinc-500 text-[11px]">
                          Nenhum lançamento encontrado nesta categoria para o período selecionado.
                        </div>
                      ) : (
                        selectedCategoryTransactions.map((t) => {
                          const acc = accounts.find((a) => a.id === t.accountId);
                          const dateDisplay = t.data ? t.data.split('-').slice(1).reverse().join('/') : '--/--';
                          return (
                            <div
                              key={t.id}
                              className="flex items-center justify-between p-1.5 bg-[#F8F7F4] dark:bg-[#252530] rounded-lg border border-[#E8E5DC]/80 dark:border-[#4C4E5D]/40 text-[10px]"
                            >
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="font-mono text-zinc-400 dark:text-zinc-500 text-[9px] shrink-0">
                                  {dateDisplay}
                                </span>
                                <div className="min-w-0">
                                  <p className="font-medium text-zinc-800 dark:text-zinc-200 truncate max-w-[100px] sm:max-w-[125px]">
                                    {t.descricao || 'Sem descrição'}
                                  </p>
                                  {acc && (
                                    <span className="text-[8px] text-zinc-500 dark:text-zinc-400 block truncate">
                                      {acc.nome}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <span
                                className={`font-mono font-bold shrink-0 ml-1 ${
                                  t.tipoItem === 'receita'
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-rose-600 dark:text-rose-400'
                                }`}
                              >
                                {t.tipoItem === 'receita' ? '+' : '-'}{formatCurrency(t.valor)}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  <div className="pt-1.5 mt-1 border-t border-[#EAE7E0] dark:border-[#4C4E5D]/40 flex justify-between items-center text-[10px]">
                    <span className="text-zinc-500 dark:text-zinc-400">Total da Categoria:</span>
                    <span className="font-mono font-bold text-zinc-900 dark:text-white">
                      {formatCurrency(selectedCategoryTotal)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="text-[10px] text-zinc-500 dark:text-[#988E96] border-t border-[#EAE7E0] dark:border-[#4C4E5D]/60 pt-2 mt-1 flex justify-between">
            <span>{pieData.length} categorias</span>
            <span className="font-mono font-bold text-zinc-800 dark:text-[#DDD5D0]">{formatCurrency(totalModoPizza)}</span>
          </div>
        </div>
      </div>

      {/* ROW 2: 3-COLUMN HARMONIC GRID (INDEPENDENT FROM ROW 1) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 items-stretch">
        {/* ROW 2: CELL 3 - COMPARATIVO MENSAL (EVOLUÇÃO & METAS) */}
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

        {/* ROW 2: CELL 4 - BALANÇO PATRIMONIAL & LIQUIDEZ */}
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

        {/* ROW 2: CELL 5 - PROJEÇÃO FINANCEIRA & REGRA 50-30-20 */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.2 }}
          className="md:col-span-2 lg:col-span-1 bg-white dark:bg-[#32323F] border border-[#E8E5DC] dark:border-[#4C4E5D]/60 rounded-2xl p-3.5 sm:p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col justify-between"
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
