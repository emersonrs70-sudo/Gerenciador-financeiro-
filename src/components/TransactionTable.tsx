import React, { useState } from 'react';
import {
  ListChecks, History, Trash2, Info, AlertTriangle, Search, Filter
} from 'lucide-react';
import { Transaction, ExtratoFilter } from '../types';

interface TransactionTableProps {
  transactions: Transaction[];
  onDeleteTransaction: (id: string, tipoItem: 'despesa' | 'receita') => Promise<void>;
  categorias: string[];
  currentMonth: number;
  currentYear: number;
}

export const TransactionTable: React.FC<TransactionTableProps> = ({
  transactions,
  onDeleteTransaction,
  categorias,
  currentMonth,
  currentYear
}) => {
  const [filtroExtrato, setFiltroExtrato] = useState<ExtratoFilter>('todos');

  // General History / Search state
  const [buscaHistorico, setBuscaHistorico] = useState('');
  const [filtroCatHistorico, setFiltroCatHistorico] = useState('todas');

  // Filter current month transactions for period ledger
  const currentMonthTransactions = transactions.filter((t) => {
    const d = new Date(t.data);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  // Filter based on selected ledger type
  const ledgerTransactions = currentMonthTransactions.filter((t) => {
    if (filtroExtrato === 'despesas') return t.tipoItem === 'despesa';
    if (filtroExtrato === 'receitas') return t.tipoItem === 'receita';
    return true;
  });

  // Sort by date descending
  ledgerTransactions.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

  // Global search filtering (All history)
  let searchedTransactions = [...transactions];
  if (buscaHistorico.trim()) {
    const term = buscaHistorico.toLowerCase();
    searchedTransactions = searchedTransactions.filter((t) =>
      t.descricao.toLowerCase().includes(term)
    );
  }
  if (filtroCatHistorico !== 'todas') {
    searchedTransactions = searchedTransactions.filter(
      (t) => t.categoria === filtroCatHistorico
    );
  }
  searchedTransactions.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

  // Calculations of over-expenditures/gargalos in current month
  const despesasMes = currentMonthTransactions.filter((t) => t.tipoItem === 'despesa');
  const categoryBudgets: { [key: string]: number } = {};
  despesasMes.forEach((d) => {
    categoryBudgets[d.categoria] = (categoryBudgets[d.categoria] || 0) + d.valor;
  });

  // Find the category with maximum expenditures
  let highestExpenditureCategory = '';
  let highestExpenditureWeight = 0;
  Object.entries(categoryBudgets).forEach(([cat, val]) => {
    if (val > highestExpenditureWeight) {
      highestExpenditureWeight = val;
      highestExpenditureCategory = cat;
    }
  });

  const criticalCategories = Object.entries(categoryBudgets).filter(
    ([_, val]) => val > 1500
  );

  const formatDate = (isoStr: string) => {
    // Avoid timezone offset by parsing with custom Date values
    const d = new Date(isoStr + 'T12:00:00');
    return d.toLocaleDateString('pt-BR');
  };

  const formatCurrency = (val: number) => {
    return `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 transition-all">
      {/* SECTION 1: EXTRATO DO PERÍODO */}
      <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-150 dark:border-slate-800 pb-3">
          <h2 className="text-sm font-black flex items-center gap-2 text-slate-800 dark:text-slate-100">
            <ListChecks className="w-4 h-4 text-purple-600" />
            Extrato do Período
          </h2>
          <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded-xl text-[10px] font-black border dark:border-slate-850 w-full sm:w-auto justify-around">
            <button
              onClick={() => setFiltroExtrato('todos')}
              className={`px-3 py-1.5 rounded-lg font-black transition-all cursor-pointer ${
                filtroExtrato === 'todos'
                  ? 'bg-white dark:bg-slate-900 shadow-xs text-purple-600 dark:text-purple-400'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setFiltroExtrato('despesas')}
              className={`px-3 py-1.5 rounded-lg font-black transition-all cursor-pointer ${
                filtroExtrato === 'despesas'
                  ? 'bg-white dark:bg-slate-900 shadow-xs text-red-600 dark:text-red-400'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Despesas
            </button>
            <button
              onClick={() => setFiltroExtrato('receitas')}
              className={`px-3 py-1.5 rounded-lg font-black transition-all cursor-pointer ${
                filtroExtrato === 'receitas'
                  ? 'bg-white dark:bg-slate-900 shadow-xs text-emerald-600 dark:text-emerald-450'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Receitas
            </button>
          </div>
        </div>

        {/* Bottleneck Alerts */}
        {criticalCategories.length > 0 && (
          <div className="space-y-1.5">
            {criticalCategories.map(([cat, val]) => (
              <div
                key={cat}
                className="p-3 bg-red-50 text-red-800 dark:bg-red-950/20 dark:text-red-300 text-[11px] rounded-xl border border-red-200 dark:border-red-900/30 flex items-center gap-2 font-bold shadow-xs"
              >
                <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 animate-pulse" />
                <span>
                  Alerta de Limite Excedido: Seus gastos em &quot;{cat}&quot; atingiram o patamar crítico de{' '}
                  <strong className="text-red-700 dark:text-red-400">{formatCurrency(val)}</strong> (limite sugerido: R$ 1.500,00).
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Ledger items list */}
        <div className="overflow-x-auto rounded-xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-250 dark:border-slate-850 text-slate-400 dark:text-slate-500 text-[10px] uppercase font-black bg-slate-50 dark:bg-slate-950/40">
                <th className="p-3">Data</th>
                <th className="p-3">Descrição</th>
                <th className="p-3">Categoria</th>
                <th className="p-3 text-right">Valor</th>
                <th className="p-3 text-center">Remover</th>
              </tr>
            </thead>
            <tbody className="text-xs divide-y divide-slate-100 dark:divide-slate-850">
              {ledgerTransactions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400 dark:text-slate-600 font-medium">
                    Nenhum lançamento registrado neste mês.
                  </td>
                </tr>
              ) : (
                ledgerTransactions.map((item) => {
                  const isDesp = item.tipoItem === 'despesa';
                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-100/40 dark:hover:bg-slate-900/40 transition-colors"
                    >
                      <td className="p-3 whitespace-nowrap text-slate-400 dark:text-slate-500 font-bold">
                        {formatDate(item.data)}
                      </td>
                      <td className="p-3 font-bold text-slate-700 dark:text-slate-300">
                        {item.descricao}
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] text-slate-500 dark:text-slate-400 font-black tracking-wide">
                          {item.categoria}
                        </span>
                      </td>
                      <td
                        className={`p-3 text-right font-black ${
                          isDesp ? 'text-red-500' : 'text-emerald-500'
                        }`}
                      >
                        {isDesp ? '-' : '+'} R$ {item.valor.toFixed(2)}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => onDeleteTransaction(item.id, item.tipoItem)}
                          className="p-1.5 hover:text-red-500 dark:hover:text-red-400 text-slate-400 dark:text-slate-650 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Bottleneck evaluation helper footer */}
        <div className="bg-slate-50 dark:bg-slate-950/40 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px]">
          <p className="font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1.5 leading-normal">
            <Info className="w-4.5 h-4.5 text-purple-600" />
            <span>
              {highestExpenditureWeight > 0 ? (
                <>
                  Seu maior foco de consumo este mês está em &quot;
                  <strong className="text-purple-600">{highestExpenditureCategory}</strong>&quot; com um total de{' '}
                  <strong className="text-red-500">{formatCurrency(highestExpenditureWeight)}</strong>.
                </>
              ) : (
                'Sem despesas registradas nesta parcial do mês corrente.'
              )}
            </span>
          </p>
        </div>
      </div>

      {/* SECTION 2: BUSCA GLOBAL FILTRO HISTÓRICO */}
      <div className="lg:col-span-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-150 dark:border-slate-850 pb-3">
          <h2 className="text-sm font-black flex items-center gap-2 text-slate-800 dark:text-slate-100">
            <History className="w-4 h-4 text-blue-500" />
            Histórico Geral (Busca Global)
          </h2>
          <div className="flex flex-col sm:flex-row gap-2.5 w-full sm:w-auto">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-455" />
              <input
                type="text"
                placeholder="Filtrar por nome..."
                value={buscaHistorico}
                onChange={(e) => setBuscaHistorico(e.target.value)}
                className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 dark:text-white rounded-xl pl-8 pr-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-48 font-medium"
              />
            </div>
            <div className="relative flex items-center">
              <Filter className="w-3.5 h-3.5 absolute left-3 text-slate-455 pointer-events-none" />
              <select
                value={filtroCatHistorico}
                onChange={(e) => setFiltroCatHistorico(e.target.value)}
                className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 dark:text-white rounded-xl pl-8 pr-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 w-full hover:bg-slate-100 transition-all font-medium"
              >
                <option value="todas">Todas Categorias</option>
                {categorias.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto max-h-72 overflow-y-auto rounded-xl shadow-inner border border-slate-150 dark:border-slate-800/80">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-850 text-slate-400 dark:text-slate-500 text-[10px] uppercase font-black sticky top-0 bg-white dark:bg-slate-900 z-10 shadow-xs">
                <th className="p-3">Data</th>
                <th className="p-3">Lançamento</th>
                <th className="p-3">Categoria</th>
                <th className="p-3 text-right">Valor</th>
              </tr>
            </thead>
            <tbody className="text-xs divide-y divide-slate-100 dark:divide-slate-850">
              {searchedTransactions.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-slate-400 dark:text-slate-655 font-medium">
                    Nenhum registro corresponde aos filtros de pesquisa informados.
                  </td>
                </tr>
              ) : (
                searchedTransactions.map((item) => {
                  const isDesp = item.tipoItem === 'despesa';
                  return (
                    <tr
                      key={item.id}
                      className="border-b border-slate-100 dark:border-slate-850/40 hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors"
                    >
                      <td className="p-3 text-slate-400 dark:text-slate-500 font-medium">
                        {formatDate(item.data)}
                      </td>
                      <td className="p-3 font-bold text-slate-700 dark:text-slate-350">
                        {item.descricao}
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] text-slate-500 dark:text-slate-400 font-bold">
                          {item.categoria}
                        </span>
                      </td>
                      <td
                        className={`p-3 text-right font-black ${
                          isDesp ? 'text-red-500' : 'text-emerald-500'
                        }`}
                      >
                        {isDesp ? '-' : '+'} {formatCurrency(item.valor)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
