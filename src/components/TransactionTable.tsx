import React, { useState } from 'react';
import {
  ListChecks, History, Trash2, Info, AlertTriangle, Search, Filter, Pencil, X, Sparkles
} from 'lucide-react';
import { Transaction, ExtratoFilter, BankAccount, getBillMonthForDate } from '../types';

interface TransactionTableProps {
  transactions: Transaction[];
  onDeleteTransaction: (id: string, tipoItem: 'despesa' | 'receita') => Promise<void>;
  onUpdateTransaction: (
    id: string,
    tipoItem: 'despesa' | 'receita',
    updatedData: { descricao: string; valor: number; data: string; categoria: string; accountId?: string }
  ) => Promise<void>;
  categorias: string[];
  categoriasDespesa: string[];
  categoriasReceita: string[];
  currentMonth: number;
  currentYear: number;
  accounts: BankAccount[];
  selectedAccountId?: string;
  onOpenImportModal?: () => void;
}

export const TransactionTable: React.FC<TransactionTableProps> = ({
  transactions,
  onDeleteTransaction,
  onUpdateTransaction,
  categorias,
  categoriasDespesa,
  categoriasReceita,
  currentMonth,
  currentYear,
  accounts = [],
  selectedAccountId = 'consolidado',
  onOpenImportModal
}) => {
  const [filtroExtrato, setFiltroExtrato] = useState<ExtratoFilter>('todos');

  // General History / Search state
  const [buscaHistorico, setBuscaHistorico] = useState('');
  const [filtroCatHistorico, setFiltroCatHistorico] = useState('todas');

  // Editing transaction state
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [editDescricao, setEditDescricao] = useState('');
  const [editValor, setEditValor] = useState<number>(0);
  const [editData, setEditData] = useState('');
  const [editCategoria, setEditCategoria] = useState('');
  const [editAccountId, setEditAccountId] = useState('geral');

  const startEdit = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setEditDescricao(transaction.descricao);
    setEditValor(transaction.valor);
    setEditData(transaction.data);
    setEditCategoria(transaction.categoria);
    setEditAccountId(transaction.accountId || 'geral');
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTransaction) return;
    if (!editDescricao.trim() || editValor <= 0 || !editData || !editCategoria) return;

    const account = accounts.find(a => a.id === editAccountId);
    let faturaMes: string | undefined = undefined;
    if (account && account.tipo === 'credito') {
      faturaMes = getBillMonthForDate(editData, account.diaFechamento);
    }

    await onUpdateTransaction(editingTransaction.id, editingTransaction.tipoItem, {
      descricao: editDescricao.trim(),
      valor: editValor,
      data: editData,
      categoria: editCategoria,
      accountId: editAccountId,
      faturaMes
    });

    setEditingTransaction(null);
  };

  // Helper to extract or fallback chronological insertion sequence
  const getCreatedTime = (t: Transaction) => {
    if (t.created_at) {
      const parsed = new Date(t.created_at).getTime();
      if (!isNaN(parsed)) return parsed;
    }
    // Fallback for default static transactions (e.g. d1, d2)
    const match = (t.id || '').match(/^[dr](\d+)$/);
    if (match) {
      return parseInt(match[1], 10);
    }
    return 0;
  };

  // Filter based on selected bank account
  const filteredByAccount = selectedAccountId && selectedAccountId !== 'consolidado'
    ? transactions.filter(t => t.accountId === selectedAccountId)
    : transactions;

  // Compute cumulative running balance chronologically across filtered transactions
  const transactionBalances: { [id: string]: number } = {};
  
  // Find current active account and if it is card
  const activeAccountObj = accounts.find(a => a.id === selectedAccountId);
  const isActiveCard = activeAccountObj && activeAccountObj.tipo === 'credito';
  
  // Calculate the proper initial/starting balance
  let accumulatedBalance = 0;
  if (selectedAccountId === 'consolidado') {
    // Starting balance of all non-credit accounts
    accumulatedBalance = accounts
      .filter(acc => acc.tipo !== 'credito')
      .reduce((sum, acc) => sum + acc.saldoInicial, 0);
  } else if (activeAccountObj) {
    if (isActiveCard) {
      accumulatedBalance = 0; // Card spent amount starts at 0
    } else {
      accumulatedBalance = activeAccountObj.saldoInicial;
    }
  }

  const chronologicalAll = [...filteredByAccount].sort((a, b) => {
    const timeA = new Date(a.data).getTime();
    const timeB = new Date(b.data).getTime();
    if (timeA !== timeB) return timeA - timeB;
    
    const createdA = getCreatedTime(a);
    const createdB = getCreatedTime(b);
    if (createdA !== createdB) return createdA - createdB;

    return (a.id || '').localeCompare(b.id || '');
  });

  chronologicalAll.forEach((item) => {
    const itemAccount = accounts.find(a => a.id === item.accountId);
    const isItemCard = itemAccount && itemAccount.tipo === 'credito';

    if (selectedAccountId === 'consolidado') {
      // In consolidated view, credit card transactions must NOT influence the cash balance
      if (!isItemCard) {
        const value = item.tipoItem === 'despesa' ? -item.valor : item.valor;
        accumulatedBalance += value;
      }
      transactionBalances[item.id] = accumulatedBalance;
    } else {
      // For specific account view
      if (isActiveCard) {
        // Spent amount goes UP with despesa, DOWN with receitas (payments)
        const value = item.tipoItem === 'despesa' ? item.valor : -item.valor;
        accumulatedBalance += value;
      } else {
        const value = item.tipoItem === 'despesa' ? -item.valor : item.valor;
        accumulatedBalance += value;
      }
      transactionBalances[item.id] = accumulatedBalance;
    }
  });

  // Filter current month transactions for period ledger
  const currentMonthTransactions = filteredByAccount.filter((t) => {
    if (!t.data) return false;
    const parts = t.data.split('-');
    if (parts.length < 3) return false;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // Convert 1-12 to 0-11
    return month === currentMonth && year === currentYear;
  });

  // Filter based on selected ledger type
  const ledgerTransactions = currentMonthTransactions.filter((t) => {
    if (filtroExtrato === 'despesas') return t.tipoItem === 'despesa';
    if (filtroExtrato === 'receitas') return t.tipoItem === 'receita';
    return true;
  });

  // Sort by date descending, and then by exact insertion order descending (newest on top)
  ledgerTransactions.sort((a, b) => {
    const timeA = new Date(a.data).getTime();
    const timeB = new Date(b.data).getTime();
    if (timeA !== timeB) return timeB - timeA;

    const createdA = getCreatedTime(a);
    const createdB = getCreatedTime(b);
    if (createdA !== createdB) return createdB - createdA;

    return (b.id || '').localeCompare(a.id || '');
  });

  // Global search filtering (All history)
  let searchedTransactions = [...filteredByAccount];
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
  
  // Sort search results by date descending, and then by exact insertion order descending
  searchedTransactions.sort((a, b) => {
    const timeA = new Date(a.data).getTime();
    const timeB = new Date(b.data).getTime();
    if (timeA !== timeB) return timeB - timeA;

    const createdA = getCreatedTime(a);
    const createdB = getCreatedTime(b);
    if (createdA !== createdB) return createdB - createdA;

    return (b.id || '').localeCompare(a.id || '');
  });

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
      <div className="lg:col-span-2 bg-white dark:bg-[#1A1A1E] border border-zinc-200/80 dark:border-[#27272A] rounded-2xl p-5 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-zinc-100 dark:border-[#27272A] pb-3">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-sm font-bold flex items-center gap-2 text-zinc-900 dark:text-white">
              <ListChecks className="w-4 h-4 text-zinc-500" />
              Extrato do Período
            </h2>
            {onOpenImportModal && (
              <button
                onClick={onOpenImportModal}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-950 shadow-xs transition-all cursor-pointer active:scale-95"
                title="Importar extrato bancário (PDF Santander, OFX, CSV)"
              >
                <Sparkles className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-600" />
                <span>Importar Extrato</span>
              </button>
            )}
          </div>
          <div className="flex bg-zinc-100/90 dark:bg-[#141416] p-1 rounded-xl text-[11px] font-semibold border border-zinc-200/80 dark:border-[#27272A] w-full sm:w-auto justify-around">
            <button
              onClick={() => setFiltroExtrato('todos')}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                filtroExtrato === 'todos'
                  ? 'bg-white dark:bg-[#27272A] shadow-xs text-zinc-900 dark:text-white font-bold'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setFiltroExtrato('despesas')}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                filtroExtrato === 'despesas'
                  ? 'bg-white dark:bg-[#27272A] shadow-xs text-rose-600 dark:text-rose-400 font-bold'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
              }`}
            >
              Despesas
            </button>
            <button
              onClick={() => setFiltroExtrato('receitas')}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                filtroExtrato === 'receitas'
                  ? 'bg-white dark:bg-[#27272A] shadow-xs text-emerald-600 dark:text-emerald-400 font-bold'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
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
                className="p-3 bg-rose-50 text-rose-900 dark:bg-rose-950/20 dark:text-rose-300 text-[11px] rounded-xl border border-rose-200 dark:border-rose-900/30 flex items-center gap-2 font-medium shadow-xs"
              >
                <AlertTriangle className="w-4 h-4 text-rose-500 flex-shrink-0" />
                <span>
                  Alerta de Limite: Seus gastos em &quot;{cat}&quot; atingiram{' '}
                  <strong className="text-rose-700 dark:text-rose-400 font-bold">{formatCurrency(val)}</strong> (limite sugerido: R$ 1.500,00).
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Mobile-optimized List (Visible on Mobile only, hidden on SM+) */}
        <div className="block sm:hidden space-y-2">
          {ledgerTransactions.length === 0 ? (
            <div className="p-8 text-center text-zinc-400 dark:text-zinc-600 font-medium text-xs">
              Nenhum lançamento registrado neste mês.
            </div>
          ) : (
            ledgerTransactions.map((item) => {
              const isDesp = item.tipoItem === 'despesa';
              const account = accounts.find((a) => a.id === item.accountId);
              return (
                <div
                  key={item.id}
                  className="p-3 bg-zinc-50/70 dark:bg-[#141416] border border-zinc-200/70 dark:border-[#27272A] rounded-xl flex items-center justify-between gap-3 shadow-xs"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center flex-wrap gap-1.5 mb-1 text-[10px] text-zinc-500 dark:text-zinc-400 font-medium">
                      <span>{formatDate(item.data)}</span>
                      <span aria-hidden="true">·</span>
                      <span className="truncate max-w-[110px]">{item.categoria}</span>
                      {account && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="truncate max-w-[90px] font-semibold text-zinc-700 dark:text-zinc-300">{account.nome}</span>
                        </>
                      )}
                    </div>
                    <p className="text-xs font-bold text-zinc-900 dark:text-white truncate">
                      {item.descricao}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-xs font-bold font-mono tabular-nums ${isDesp ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      {isDesp ? '-' : '+'} {formatCurrency(item.valor)}
                    </p>
                    <p className="text-[9px] text-zinc-400 dark:text-zinc-500 font-mono mt-0.5">
                      {formatCurrency(transactionBalances[item.id] ?? 0)}
                    </p>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0 border-l border-zinc-200/80 dark:border-[#27272A] pl-1.5">
                    <button
                      onClick={() => startEdit(item)}
                      className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                      title="Editar"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onDeleteTransaction(item.id, item.tipoItem)}
                      className="p-1 text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
                      title="Remover"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Ledger items list */}
        <div className="hidden sm:block overflow-x-auto rounded-xl border border-zinc-200/80 dark:border-[#27272A]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-200/80 dark:border-[#27272A] text-zinc-500 dark:text-zinc-400 text-[10px] uppercase font-bold bg-zinc-50/80 dark:bg-[#141416]">
                <th className="p-3">Data</th>
                <th className="p-3">Descrição</th>
                <th className="p-3">Categoria</th>
                <th className="p-3 text-right">Valor</th>
                <th className="p-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="text-xs divide-y divide-zinc-100 dark:divide-[#27272A]/60">
              {ledgerTransactions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-zinc-400 dark:text-zinc-600 font-medium">
                    Nenhum lançamento registrado neste mês.
                  </td>
                </tr>
              ) : (
                ledgerTransactions.map((item) => {
                  const isDesp = item.tipoItem === 'despesa';
                  const account = accounts.find((a) => a.id === item.accountId);
                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-zinc-50/60 dark:hover:bg-[#222226]/60 transition-colors"
                    >
                      <td className="p-3 whitespace-nowrap text-zinc-500 dark:text-zinc-400 font-medium font-mono text-[11px]">
                        {formatDate(item.data)}
                      </td>
                      <td className="p-3 font-semibold text-zinc-800 dark:text-zinc-200">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span>{item.descricao}</span>
                          {account && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-semibold tracking-wide shrink-0">
                              {account.nome}
                            </span>
                          )}
                          {item.faturaMes && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 font-medium shrink-0">
                              💳 Fatura {item.faturaMes}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3">
                        <span className="text-xs text-zinc-600 dark:text-zinc-300 font-medium">
                          {item.categoria}
                        </span>
                      </td>
                      <td className="p-3 text-right font-mono tabular-nums">
                        <div
                          className={`font-bold ${
                            isDesp ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          {isDesp ? '-' : '+'} {formatCurrency(item.valor)}
                        </div>
                        <div className="text-[10px] text-zinc-400 dark:text-zinc-500 font-normal mt-0.5">
                          Saldo: {formatCurrency(transactionBalances[item.id] ?? 0)}
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => startEdit(item)}
                            className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-[#27272A] cursor-pointer transition-colors"
                            title="Editar lançamento"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onDeleteTransaction(item.id, item.tipoItem)}
                            className="p-1 text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer transition-colors"
                            title="Remover lançamento"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Bottleneck evaluation helper footer */}
        <div className="bg-zinc-50/70 dark:bg-[#141416] p-3 rounded-xl border border-zinc-200/80 dark:border-[#27272A] flex items-center justify-between text-xs">
          <p className="font-medium text-zinc-600 dark:text-zinc-400 flex items-center gap-1.5 leading-normal">
            <Info className="w-4 h-4 text-zinc-400 shrink-0" />
            <span>
              {highestExpenditureWeight > 0 ? (
                <>
                  Maior consumo no período em &quot;
                  <strong className="text-zinc-900 dark:text-white font-bold">{highestExpenditureCategory}</strong>&quot;:{' '}
                  <strong className="text-rose-600 dark:text-rose-400 font-bold">{formatCurrency(highestExpenditureWeight)}</strong>.
                </>
              ) : (
                'Sem despesas registradas nesta parcial do mês corrente.'
              )}
            </span>
          </p>
        </div>
      </div>

      {/* SECTION 2: BUSCA GLOBAL FILTRO HISTÓRICO */}
      <div className="lg:col-span-3 bg-white dark:bg-[#1A1A1E] border border-zinc-200/80 dark:border-[#27272A] rounded-2xl p-5 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-zinc-100 dark:border-[#27272A] pb-3">
          <h2 className="text-sm font-bold flex items-center gap-2 text-zinc-900 dark:text-white">
            <History className="w-4 h-4 text-zinc-400" />
            Histórico Geral de Movimentações
          </h2>
          <div className="flex flex-col sm:flex-row gap-2.5 w-full sm:w-auto">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-zinc-400" />
              <input
                type="text"
                placeholder="Filtrar por nome..."
                value={buscaHistorico}
                onChange={(e) => setBuscaHistorico(e.target.value)}
                className="bg-zinc-50 dark:bg-[#141416] border border-zinc-200/80 dark:border-[#27272A] dark:text-white rounded-xl pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10 w-full sm:w-48 font-medium"
              />
            </div>
            <div className="relative flex items-center">
              <Filter className="w-3.5 h-3.5 absolute left-3 text-zinc-400 pointer-events-none" />
              <select
                value={filtroCatHistorico}
                onChange={(e) => setFiltroCatHistorico(e.target.value)}
                className="bg-zinc-50 dark:bg-[#141416] border border-zinc-200/80 dark:border-[#27272A] dark:text-white rounded-xl pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10 w-full font-medium"
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

        {/* Mobile-optimized global history list */}
        <div className="block sm:hidden space-y-2 max-h-72 overflow-y-auto pr-1">
          {searchedTransactions.length === 0 ? (
            <div className="p-6 text-center text-zinc-400 dark:text-zinc-600 font-medium text-xs">
              Nenhum registro corresponde aos filtros de pesquisa informados.
            </div>
          ) : (
            searchedTransactions.map((item) => {
              const isDesp = item.tipoItem === 'despesa';
              return (
                <div
                  key={item.id}
                  className="p-3 bg-zinc-50/70 dark:bg-[#141416] border border-zinc-200/70 dark:border-[#27272A] rounded-xl flex items-center justify-between gap-3 shadow-xs"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1 text-[10px] text-zinc-500 dark:text-zinc-400 font-medium">
                      <span>{formatDate(item.data)}</span>
                      <span aria-hidden="true">·</span>
                      <span className="truncate max-w-[120px]">{item.categoria}</span>
                    </div>
                    <p className="text-xs font-bold text-zinc-900 dark:text-white truncate">
                      {item.descricao}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-xs font-bold font-mono tabular-nums ${isDesp ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      {isDesp ? '-' : '+'} {formatCurrency(item.valor)}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Global history table list (Visible on SM+ screens, hidden on Mobile) */}
        <div className="hidden sm:block overflow-x-auto max-h-72 overflow-y-auto rounded-xl border border-zinc-200/80 dark:border-[#27272A]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-200/80 dark:border-[#27272A] text-zinc-500 dark:text-zinc-400 text-[10px] uppercase font-bold sticky top-0 bg-zinc-50 dark:bg-[#141416] z-10 shadow-xs">
                <th className="p-3">Data</th>
                <th className="p-3">Lançamento</th>
                <th className="p-3">Categoria</th>
                <th className="p-3 text-right">Valor</th>
              </tr>
            </thead>
            <tbody className="text-xs divide-y divide-zinc-100 dark:divide-[#27272A]/60">
              {searchedTransactions.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-zinc-400 dark:text-zinc-600 font-medium">
                    Nenhum registro corresponde aos filtros de pesquisa informados.
                  </td>
                </tr>
              ) : (
                searchedTransactions.map((item) => {
                  const isDesp = item.tipoItem === 'despesa';
                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-zinc-50/60 dark:hover:bg-[#222226]/60 transition-colors"
                    >
                      <td className="p-3 text-zinc-500 dark:text-zinc-400 font-medium font-mono text-[11px]">
                        {formatDate(item.data)}
                      </td>
                      <td className="p-3 font-semibold text-zinc-800 dark:text-zinc-200">
                        {item.descricao}
                      </td>
                      <td className="p-3">
                        <span className="text-xs text-zinc-600 dark:text-zinc-300 font-medium">
                          {item.categoria}
                        </span>
                      </td>
                      <td
                        className={`p-3 text-right font-mono tabular-nums font-bold ${
                          isDesp ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
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

      {editingTransaction && (
        <div className="fixed inset-0 bg-zinc-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#1A1A1E] border border-zinc-200/80 dark:border-[#27272A] rounded-2xl p-6 w-full max-w-md shadow-xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-zinc-100 dark:border-[#27272A]">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                Editar Lançamento ({editingTransaction.tipoItem === 'despesa' ? 'Despesa' : 'Receita'})
              </h3>
              <button
                onClick={() => setEditingTransaction(null)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={saveEdit} className="space-y-4">
              <div>
                <label className="block text-[10px] uppercase font-bold text-zinc-500 dark:text-zinc-400 mb-1">
                  Descrição
                </label>
                <input
                  type="text"
                  required
                  value={editDescricao}
                  onChange={(e) => setEditDescricao(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-[#141416] border border-zinc-200/80 dark:border-[#27272A] text-zinc-900 dark:text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-zinc-500 dark:text-zinc-400 mb-1">
                    Valor (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    min="0.01"
                    value={editValor || ''}
                    onChange={(e) => setEditValor(parseFloat(e.target.value) || 0)}
                    className="w-full bg-zinc-50 dark:bg-[#141416] border border-zinc-200/80 dark:border-[#27272A] text-zinc-900 dark:text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10 font-medium font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-zinc-500 dark:text-zinc-400 mb-1">
                    Data
                  </label>
                  <input
                    type="date"
                    required
                    value={editData}
                    onChange={(e) => setEditData(e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-[#141416] border border-zinc-200/80 dark:border-[#27272A] text-zinc-900 dark:text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10 font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-zinc-500 dark:text-zinc-400 mb-1">
                  Conta Bancária / Cartão
                </label>
                <select
                  value={editAccountId}
                  onChange={(e) => setEditAccountId(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-[#141416] border border-zinc-200/80 dark:border-[#27272A] text-zinc-900 dark:text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10 font-medium mb-3.5"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.nome} ({acc.tipo === 'credito' ? 'Crédito' : 'Saldo'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-zinc-500 dark:text-zinc-400 mb-1">
                  Categoria
                </label>
                <select
                  value={editCategoria}
                  onChange={(e) => setEditCategoria(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-[#141416] border border-zinc-200/80 dark:border-[#27272A] text-zinc-900 dark:text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10 font-medium"
                >
                  {(editingTransaction.tipoItem === 'despesa' ? categoriasDespesa : categoriasReceita).map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2.5 pt-3 border-t border-zinc-100 dark:border-[#27272A]">
                <button
                  type="button"
                  onClick={() => setEditingTransaction(null)}
                  className="flex-1 px-4 py-2 bg-zinc-100 hover:bg-zinc-200/70 dark:bg-[#27272A] dark:hover:bg-[#38383E] text-zinc-700 dark:text-zinc-300 rounded-xl text-xs font-semibold transition-all cursor-pointer text-center"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-950 rounded-xl text-xs font-bold transition-all cursor-pointer text-center shadow-xs"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
