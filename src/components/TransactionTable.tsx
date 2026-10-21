import React, { useState } from 'react';
import {
  ListChecks, History, Trash2, Info, AlertTriangle, Search, Filter, Pencil, X, Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
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
  const [activeTab, setActiveTab] = useState<'extrato' | 'historico'>('extrato');
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
    const match = (t.id || '').match(/^[dr](\d+)$/);
    if (match) {
      return parseInt(match[1], 10);
    }
    return 0;
  };

  // Filter based on selected bank account with ID deduplication
  const filteredByAccount = React.useMemo(() => {
    const raw = selectedAccountId && selectedAccountId !== 'consolidado'
      ? transactions.filter(t => t.accountId === selectedAccountId)
      : transactions;
    const seen = new Set<string>();
    return raw.filter(t => {
      if (!t || !t.id) return false;
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });
  }, [transactions, selectedAccountId]);

  // Compute cumulative running balance chronologically across filtered transactions
  const transactionBalances: { [id: string]: number } = {};
  
  const activeAccountObj = accounts.find(a => a.id === selectedAccountId);
  const isActiveCard = activeAccountObj && activeAccountObj.tipo === 'credito';
  
  let accumulatedBalance = 0;
  if (selectedAccountId === 'consolidado') {
    accumulatedBalance = accounts
      .filter(acc => acc.tipo !== 'credito')
      .reduce((sum, acc) => sum + acc.saldoInicial, 0);
  } else if (activeAccountObj) {
    if (isActiveCard) {
      accumulatedBalance = 0;
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
      if (!isItemCard) {
        const value = item.tipoItem === 'despesa' ? -item.valor : item.valor;
        accumulatedBalance += value;
      }
      transactionBalances[item.id] = accumulatedBalance;
    } else {
      if (isActiveCard) {
        const value = item.tipoItem === 'despesa' ? item.valor : -item.valor;
        accumulatedBalance += value;
      } else {
        const value = item.tipoItem === 'despesa' ? -item.valor : item.valor;
        accumulatedBalance += value;
      }
      transactionBalances[item.id] = accumulatedBalance;
    }
  });

  // Filter transactions for the current month/year
  const currentMonthTransactions = filteredByAccount.filter((t) => {
    if (!t.data) return false;
    const parts = t.data.split('-');
    if (parts.length < 3) return false;
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    return m === currentMonth && y === currentYear;
  });

  // Sort descending (newest first, older last) for ledger
  const ledgerTransactions = [...currentMonthTransactions].sort((a, b) => {
    const timeA = new Date(a.data).getTime();
    const timeB = new Date(b.data).getTime();
    if (timeA !== timeB) return timeB - timeA;

    const createdA = getCreatedTime(a);
    const createdB = getCreatedTime(b);
    if (createdA !== createdB) return createdB - createdA;

    return (b.id || '').localeCompare(a.id || '');
  });

  // Subfilter for ledger
  const displayedLedgerTransactions = ledgerTransactions.filter((t) => {
    if (filtroExtrato === 'despesas') return t.tipoItem === 'despesa';
    if (filtroExtrato === 'receitas') return t.tipoItem === 'receita';
    return true;
  });

  // Filtered transactions for global search
  let searchedTransactions = [...filteredByAccount];
  if (buscaHistorico.trim() !== '') {
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
  
  searchedTransactions.sort((a, b) => {
    const timeA = new Date(a.data).getTime();
    const timeB = new Date(b.data).getTime();
    if (timeA !== timeB) return timeB - timeA;

    const createdA = getCreatedTime(a);
    const createdB = getCreatedTime(b);
    if (createdA !== createdB) return createdB - createdA;

    return (b.id || '').localeCompare(a.id || '');
  });

  const despesasMes = currentMonthTransactions.filter((t) => t.tipoItem === 'despesa');
  const categoryBudgets: { [key: string]: number } = {};
  despesasMes.forEach((d) => {
    categoryBudgets[d.categoria] = (categoryBudgets[d.categoria] || 0) + d.valor;
  });

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

  const totalMesDespesas = currentMonthTransactions
    .filter(t => t.tipoItem === 'despesa')
    .reduce((s, t) => s + t.valor, 0);

  const totalMesReceitas = currentMonthTransactions
    .filter(t => t.tipoItem === 'receita')
    .reduce((s, t) => s + t.valor, 0);

  const formatDate = (isoStr: string) => {
    const d = new Date(isoStr + 'T12:00:00');
    return d.toLocaleDateString('pt-BR');
  };

  const formatCurrency = (val: number) => {
    return `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="w-full bg-white dark:bg-[#32323F] border border-[#E8E5DC] dark:border-[#4C4E5D]/60 rounded-2xl p-3.5 sm:p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-3">
      {/* INTEGRATED TAB BAR & TOOLBAR HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-[#EAE7E0] dark:border-[#4C4E5D]/50 pb-2.5">
        {/* TAB BUTTONS (EXTRATO DO PERÍODO vs HISTÓRICO GERAL) */}
        <div className="flex bg-[#F3F1EB] dark:bg-[#252530] p-1 rounded-xl border border-[#E8E5DC] dark:border-[#4C4E5D]/60 flex-shrink-0">
          <button
            onClick={() => setActiveTab('extrato')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'extrato'
                ? 'bg-white dark:bg-[#4C4E5D] text-zinc-900 dark:text-white shadow-xs'
                : 'text-zinc-600 dark:text-[#988E96] hover:text-zinc-900 dark:hover:text-[#DDD5D0]'
            }`}
          >
            <ListChecks className="w-3.5 h-3.5 text-zinc-700 dark:text-[#DDD5D0]" />
            <span>Extrato do Período</span>
            <span className="ml-0.5 px-1.5 py-0.2 rounded-md text-[10px] bg-zinc-200/80 dark:bg-[#32323F] font-mono">
              {currentMonthTransactions.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('historico')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'historico'
                ? 'bg-white dark:bg-[#4C4E5D] text-zinc-900 dark:text-white shadow-xs'
                : 'text-zinc-600 dark:text-[#988E96] hover:text-zinc-900 dark:hover:text-[#DDD5D0]'
            }`}
          >
            <History className="w-3.5 h-3.5 text-zinc-700 dark:text-[#DDD5D0]" />
            <span>Histórico Geral</span>
            <span className="ml-0.5 px-1.5 py-0.2 rounded-md text-[10px] bg-zinc-200/80 dark:bg-[#32323F] font-mono">
              {filteredByAccount.length}
            </span>
          </button>
        </div>

        {/* CONTEXTUAL TOOLBAR BASED ON ACTIVE TAB */}
        {activeTab === 'extrato' ? (
          <div className="flex flex-wrap items-center gap-2 justify-between lg:justify-end">
            {/* Quick sub-filter (Todos, Despesas, Receitas) */}
            <div className="flex bg-[#F3F1EB] dark:bg-[#252530] p-1 rounded-xl text-[11px] font-semibold border border-[#E8E5DC] dark:border-[#4C4E5D]/60">
              <button
                onClick={() => setFiltroExtrato('todos')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  filtroExtrato === 'todos'
                    ? 'bg-white dark:bg-[#4C4E5D] shadow-xs text-zinc-900 dark:text-white font-bold'
                    : 'text-zinc-600 hover:text-zinc-900 dark:text-[#988E96] dark:hover:text-[#DDD5D0]'
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setFiltroExtrato('despesas')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  filtroExtrato === 'despesas'
                    ? 'bg-white dark:bg-[#4C4E5D] shadow-xs text-rose-600 dark:text-rose-400 font-bold'
                    : 'text-zinc-600 hover:text-zinc-900 dark:text-[#988E96] dark:hover:text-[#DDD5D0]'
                }`}
              >
                Despesas
              </button>
              <button
                onClick={() => setFiltroExtrato('receitas')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  filtroExtrato === 'receitas'
                    ? 'bg-white dark:bg-[#4C4E5D] shadow-xs text-emerald-600 dark:text-emerald-400 font-bold'
                    : 'text-zinc-600 hover:text-zinc-900 dark:text-[#988E96] dark:hover:text-[#DDD5D0]'
                }`}
              >
                Receitas
              </button>
            </div>

            {onOpenImportModal && (
              <button
                onClick={onOpenImportModal}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#32323F] hover:bg-[#252530] dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-950 shadow-xs transition-all cursor-pointer active:scale-95"
                title="Importar extrato bancário (PDF Santander, OFX, CSV)"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300 dark:text-amber-500" />
                <span>Importar Extrato</span>
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto min-w-0 flex-1 justify-end">
            <div className="relative flex-1 min-w-[180px] w-full sm:w-auto max-w-full">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-zinc-400" />
              <input
                type="text"
                placeholder="Filtrar por nome ou valor..."
                value={buscaHistorico}
                onChange={(e) => setBuscaHistorico(e.target.value)}
                className="bg-[#F8F7F4] dark:bg-[#252530] border border-[#E8E5DC] dark:border-[#4C4E5D]/60 dark:text-white rounded-xl pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10 w-full font-medium"
              />
            </div>
            <div className="relative flex-1 min-w-[160px] w-full sm:w-auto max-w-full flex items-center">
              <Filter className="w-3.5 h-3.5 absolute left-3 text-zinc-400 pointer-events-none" />
              <select
                value={filtroCatHistorico}
                onChange={(e) => setFiltroCatHistorico(e.target.value)}
                className="bg-[#F8F7F4] dark:bg-[#252530] border border-[#E8E5DC] dark:border-[#4C4E5D]/60 dark:text-white rounded-xl pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10 w-full font-medium truncate"
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
        )}
      </div>

      {/* ANIMATED SPOTLIGHT CONTENT */}
      <AnimatePresence mode="wait">
        {activeTab === 'extrato' ? (
          <motion.div
            key="tab-extrato"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="space-y-3"
          >
            {/* Bottleneck Alerts */}
            {criticalCategories.length > 0 && (
              <div className="space-y-1.5">
                {criticalCategories.map(([cat, val]) => (
                  <div
                    key={cat}
                    className="p-2.5 bg-rose-50 text-rose-900 dark:bg-rose-950/20 dark:text-rose-300 text-[11px] rounded-xl border border-rose-200 dark:border-rose-900/30 flex items-center gap-2 font-medium shadow-xs"
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

            {/* Mobile list */}
            <div className="block sm:hidden space-y-2 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
              {displayedLedgerTransactions.length === 0 ? (
                <div className="p-6 text-center text-zinc-400 dark:text-zinc-600 font-medium text-xs">
                  Nenhum lançamento registrado neste mês.
                </div>
              ) : (
                displayedLedgerTransactions.map((item) => {
                  const isDesp = item.tipoItem === 'despesa';
                  const account = accounts.find((a) => a.id === item.accountId);
                  return (
                    <div
                      key={item.id}
                      className="p-3 bg-[#F8F7F4] dark:bg-[#252530] border border-[#E8E5DC] dark:border-[#4C4E5D]/60 rounded-xl flex items-center justify-between gap-3 shadow-xs"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1 text-[10px] text-zinc-500 dark:text-zinc-400 font-medium">
                          <span>{formatDate(item.data)}</span>
                          <span aria-hidden="true">·</span>
                          <span className="truncate max-w-[120px]">{item.categoria}</span>
                          {account && (
                            <span className="px-1 py-0.2 rounded text-[9px] bg-zinc-200/70 dark:bg-[#32323F] font-semibold">
                              {account.nome}
                            </span>
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
                      <div className="flex items-center gap-0.5 shrink-0 border-l border-[#E8E5DC] dark:border-[#4C4E5D]/60 pl-1.5">
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

            {/* Desktop Ledger table with contained scrolling */}
            <div className="hidden sm:block overflow-x-auto max-h-[300px] lg:max-h-[330px] overflow-y-auto rounded-xl border border-[#E8E5DC] dark:border-[#4C4E5D]/60 custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#E8E5DC] dark:border-[#4C4E5D]/60 text-zinc-500 dark:text-[#988E96] text-[10px] uppercase font-bold sticky top-0 bg-[#F8F7F4]/95 dark:bg-[#252530]/95 backdrop-blur-xs z-10">
                    <th className="p-3">Data</th>
                    <th className="p-3">Descrição</th>
                    <th className="p-3">Conta</th>
                    <th className="p-3">Categoria</th>
                    <th className="p-3 text-right">Valor</th>
                    <th className="p-3 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="text-xs divide-y divide-[#EFECE5] dark:divide-[#4C4E5D]/40">
                  {displayedLedgerTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-zinc-400 dark:text-zinc-600 font-medium">
                        Nenhum lançamento registrado neste mês.
                      </td>
                    </tr>
                  ) : (
                    displayedLedgerTransactions.map((item) => {
                      const isDesp = item.tipoItem === 'despesa';
                      const account = accounts.find((a) => a.id === item.accountId);
                      return (
                        <tr
                          key={item.id}
                          className="hover:bg-[#F8F7F4]/80 dark:hover:bg-[#252530]/60 transition-colors"
                        >
                          <td className="p-3 whitespace-nowrap text-zinc-500 dark:text-zinc-400 font-medium font-mono text-[11px]">
                            {formatDate(item.data)}
                          </td>
                          <td className="p-3 font-semibold text-zinc-800 dark:text-zinc-200">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span>{item.descricao}</span>
                              {item.faturaMes && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] bg-[#F0EEE6] dark:bg-[#252530] text-zinc-600 dark:text-zinc-400 font-medium shrink-0">
                                  💳 Fatura {item.faturaMes}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-3 whitespace-nowrap text-zinc-500 dark:text-zinc-400">
                            {account ? (
                              <span className="px-2 py-0.5 rounded-lg text-[10px] bg-[#F0EEE6] dark:bg-[#252530] text-zinc-700 dark:text-zinc-300 font-semibold border border-[#E4E0D6] dark:border-[#4C4E5D]/50">
                                {account.nome}
                              </span>
                            ) : (
                              '—'
                            )}
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
                                className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-[#4C4E5D] cursor-pointer transition-colors"
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

            {/* Summary Footer */}
            <div className="bg-[#F8F7F4] dark:bg-[#252530] p-3 rounded-xl border border-[#E8E5DC] dark:border-[#4C4E5D]/60 flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs gap-2">
              <p className="font-medium text-zinc-600 dark:text-zinc-400 flex items-center gap-1.5 leading-normal">
                <Info className="w-4 h-4 text-zinc-400 shrink-0" />
                <span>
                  {highestExpenditureWeight > 0 ? (
                    <>
                      Maior consumo do mês em &quot;
                      <strong className="text-zinc-900 dark:text-white font-bold">{highestExpenditureCategory}</strong>&quot;:{' '}
                      <strong className="text-rose-600 dark:text-rose-400 font-bold">{formatCurrency(highestExpenditureWeight)}</strong>.
                    </>
                  ) : (
                    'Sem despesas registradas nesta parcial do mês corrente.'
                  )}
                </span>
              </p>
              <div className="flex items-center gap-3 text-[11px] font-mono shrink-0">
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                  +{formatCurrency(totalMesReceitas)}
                </span>
                <span className="text-rose-600 dark:text-rose-400 font-bold">
                  -{formatCurrency(totalMesDespesas)}
                </span>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="tab-historico"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="space-y-3"
          >
            {/* Mobile-optimized global history list */}
            <div className="block sm:hidden space-y-2 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
              {searchedTransactions.length === 0 ? (
                <div className="p-6 text-center text-zinc-400 dark:text-zinc-600 font-medium text-xs">
                  Nenhum registro corresponde aos filtros de pesquisa informados.
                </div>
              ) : (
                searchedTransactions.map((item) => {
                  const isDesp = item.tipoItem === 'despesa';
                  const account = accounts.find((a) => a.id === item.accountId);
                  return (
                    <div
                      key={item.id}
                      className="p-3 bg-[#F8F7F4] dark:bg-[#252530] border border-[#E8E5DC] dark:border-[#4C4E5D]/60 rounded-xl flex items-center justify-between gap-3 shadow-xs"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1 text-[10px] text-zinc-500 dark:text-zinc-400 font-medium">
                          <span>{formatDate(item.data)}</span>
                          <span aria-hidden="true">·</span>
                          <span className="truncate max-w-[120px]">{item.categoria}</span>
                          {account && (
                            <span className="px-1 py-0.2 rounded text-[9px] bg-zinc-200/70 dark:bg-[#32323F] font-semibold">
                              {account.nome}
                            </span>
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
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0 border-l border-[#E8E5DC] dark:border-[#4C4E5D]/60 pl-1.5">
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

            {/* Global history table list with contained scrolling */}
            <div className="hidden sm:block overflow-x-auto max-h-[300px] lg:max-h-[330px] overflow-y-auto rounded-xl border border-[#E8E5DC] dark:border-[#4C4E5D]/60 custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#E8E5DC] dark:border-[#4C4E5D]/60 text-zinc-500 dark:text-[#988E96] text-[10px] uppercase font-bold sticky top-0 bg-[#F8F7F4]/95 dark:bg-[#252530]/95 backdrop-blur-xs z-10">
                    <th className="p-3">Data</th>
                    <th className="p-3">Descrição</th>
                    <th className="p-3">Conta</th>
                    <th className="p-3">Categoria</th>
                    <th className="p-3 text-right">Valor</th>
                    <th className="p-3 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="text-xs divide-y divide-[#EFECE5] dark:divide-[#4C4E5D]/40">
                  {searchedTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-zinc-400 dark:text-zinc-600 font-medium">
                        Nenhum registro corresponde aos filtros informados.
                      </td>
                    </tr>
                  ) : (
                    searchedTransactions.map((item) => {
                      const isDesp = item.tipoItem === 'despesa';
                      const account = accounts.find((a) => a.id === item.accountId);
                      return (
                        <tr
                          key={item.id}
                          className="hover:bg-[#F8F7F4]/80 dark:hover:bg-[#252530]/60 transition-colors"
                        >
                          <td className="p-3 whitespace-nowrap text-zinc-500 dark:text-zinc-400 font-medium font-mono text-[11px]">
                            {formatDate(item.data)}
                          </td>
                          <td className="p-3 font-semibold text-zinc-800 dark:text-zinc-200">
                            {item.descricao}
                          </td>
                          <td className="p-3 whitespace-nowrap text-zinc-500 dark:text-zinc-400">
                            {account ? (
                              <span className="px-2 py-0.5 rounded-lg text-[10px] bg-[#F0EEE6] dark:bg-[#252530] text-zinc-700 dark:text-zinc-300 font-semibold border border-[#E4E0D6] dark:border-[#4C4E5D]/50">
                                {account.nome}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="p-3">
                            <span className="text-xs text-zinc-600 dark:text-zinc-300 font-medium">
                              {item.categoria}
                            </span>
                          </td>
                          <td className="p-3 text-right font-mono tabular-nums">
                            <span
                              className={`font-bold ${
                                isDesp ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                              }`}
                            >
                              {isDesp ? '-' : '+'} {formatCurrency(item.valor)}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => startEdit(item)}
                                className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-[#4C4E5D] cursor-pointer transition-colors"
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

            {/* History Summary Footer */}
            <div className="bg-[#F8F7F4] dark:bg-[#252530] p-3 rounded-xl border border-[#E8E5DC] dark:border-[#4C4E5D]/60 flex items-center justify-between text-xs">
              <span className="text-zinc-500 dark:text-zinc-400">
                Total de lançamentos encontrados: <strong className="text-zinc-900 dark:text-white font-bold">{searchedTransactions.length}</strong>
              </span>
              <span className="text-zinc-500 dark:text-zinc-400 font-mono">
                Soma filtrada:{' '}
                <strong className="text-zinc-900 dark:text-white font-bold">
                  {formatCurrency(searchedTransactions.reduce((acc, t) => acc + (t.tipoItem === 'despesa' ? -t.valor : t.valor), 0))}
                </strong>
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* TRANSACTION EDITING MODAL */}
      {editingTransaction && (
        <div className="fixed inset-0 bg-zinc-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#32323F] border border-[#E8E5DC] dark:border-[#4C4E5D]/60 rounded-2xl p-6 w-full max-w-sm shadow-xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-4 border-b border-[#EAE7E0] dark:border-[#4C4E5D]/50 pb-3">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <Pencil className="w-4 h-4 text-zinc-500" />
                Editar Lançamento
              </h3>
              <button
                onClick={() => setEditingTransaction(null)}
                className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={saveEdit} className="space-y-3.5">
              <div>
                <label className="block text-[10px] uppercase font-bold text-zinc-500 dark:text-zinc-400 mb-1">
                  Descrição
                </label>
                <input
                  type="text"
                  required
                  value={editDescricao}
                  onChange={(e) => setEditDescricao(e.target.value)}
                  className="w-full bg-[#F8F7F4] dark:bg-[#252530] border border-[#E8E5DC] dark:border-[#4C4E5D]/60 text-zinc-900 dark:text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-zinc-500 dark:text-zinc-400 mb-1">
                    Valor (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editValor}
                    onChange={(e) => setEditValor(parseFloat(e.target.value) || 0)}
                    className="w-full bg-[#F8F7F4] dark:bg-[#252530] border border-[#E8E5DC] dark:border-[#4C4E5D]/60 text-zinc-900 dark:text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10 font-mono font-bold"
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
                    className="w-full bg-[#F8F7F4] dark:bg-[#252530] border border-[#E8E5DC] dark:border-[#4C4E5D]/60 text-zinc-900 dark:text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10 font-medium"
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
                  className="w-full bg-[#F8F7F4] dark:bg-[#252530] border border-[#E8E5DC] dark:border-[#4C4E5D]/60 text-zinc-900 dark:text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10 font-medium mb-3.5"
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
                  className="w-full bg-[#F8F7F4] dark:bg-[#252530] border border-[#E8E5DC] dark:border-[#4C4E5D]/60 text-zinc-900 dark:text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10 font-medium"
                >
                  {(editingTransaction.tipoItem === 'despesa' ? categoriasDespesa : categoriasReceita).map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2.5 pt-3 border-t border-[#EAE7E0] dark:border-[#4C4E5D]/60">
                <button
                  type="button"
                  onClick={() => setEditingTransaction(null)}
                  className="flex-1 px-4 py-2 bg-[#F3F1EB] hover:bg-[#EBE7DF] dark:bg-[#4C4E5D] dark:hover:bg-[#5B5D6E] text-zinc-700 dark:text-zinc-300 rounded-xl text-xs font-semibold transition-all cursor-pointer text-center"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-[#32323F] hover:bg-[#252530] dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-950 rounded-xl text-xs font-bold transition-all cursor-pointer text-center shadow-xs"
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
