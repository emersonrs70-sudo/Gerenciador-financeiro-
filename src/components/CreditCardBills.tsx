import React, { useState, useEffect, useMemo } from 'react';
import { 
  CreditCard, CheckCircle, AlertTriangle, Clock, Landmark, ArrowRight, 
  Calendar, Plus, ShieldCheck, Tag, ReceiptText, ChevronRight
} from 'lucide-react';
import { BankAccount, Transaction, getBillMonthForDate } from '../types';

interface CreditCardBillsProps {
  creditAccounts: BankAccount[];
  transactions: Transaction[];
  checkingAccounts: BankAccount[];
  onAddTransaction: (
    descricao: string,
    valor: number,
    data: string,
    categoria: string,
    tipoItem: 'despesa' | 'receita',
    accountId: string,
    faturaMes?: string
  ) => Promise<void>;
  accountBalances: { [accId: string]: number };
  currentMonth: number;
  currentYear: number;
  activeAccountId?: string;
  onOpenAddCardModal?: () => void;
  onSelectAccount?: (id: string) => void;
}

export const CreditCardBills: React.FC<CreditCardBillsProps> = ({
  creditAccounts,
  transactions,
  checkingAccounts,
  onAddTransaction,
  accountBalances,
  currentMonth,
  currentYear,
  activeAccountId,
  onOpenAddCardModal,
  onSelectAccount
}) => {
  // Determine initially selected card
  const [selectedCardId, setSelectedCardId] = useState<string>(() => {
    if (activeAccountId && creditAccounts.some(c => c.id === activeAccountId)) {
      return activeAccountId;
    }
    return creditAccounts[0]?.id || '';
  });

  // Keep in sync if activeAccountId changes from outside
  useEffect(() => {
    if (activeAccountId && creditAccounts.some(c => c.id === activeAccountId)) {
      setSelectedCardId(activeAccountId);
    } else if (creditAccounts.length > 0 && !creditAccounts.some(c => c.id === selectedCardId)) {
      setSelectedCardId(creditAccounts[0].id);
    }
  }, [activeAccountId, creditAccounts]);

  const activeAccount = creditAccounts.find(c => c.id === selectedCardId) || creditAccounts[0];

  // Payment modal state
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [selectedBillMonth, setSelectedBillMonth] = useState<string>('');
  const [selectedBillAmount, setSelectedBillAmount] = useState<number>(0);
  const [sourceAccountId, setSourceAccountId] = useState<string>(checkingAccounts[0]?.id || '');
  const [paymentDate, setPaymentDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });

  // Search filter for transactions in invoice
  const [searchTerm, setSearchTerm] = useState('');

  // Target Bill Month formatted from the dashboard ruler
  const targetBillMonth = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;

  const closingDay = activeAccount?.diaFechamento || 5;
  const dueDay = activeAccount?.diaVencimento || 12;
  const limit = activeAccount?.limiteCredito || 5000;
  const spent = activeAccount ? (accountBalances[activeAccount.id] ?? 0) : 0;
  const available = Math.max(limit - spent, 0);
  const limitUsagePct = limit > 0 ? Math.min(Math.round((spent / limit) * 100), 100) : 0;

  // Filter transactions of this credit card that belong to targetBillMonth
  const cardTransactions = useMemo(() => {
    if (!activeAccount) return [];
    return transactions.filter(t => t.accountId === activeAccount.id);
  }, [transactions, activeAccount]);

  const monthTx = useMemo(() => {
    if (!activeAccount) return [];
    return cardTransactions
      .filter(t => {
        const bMonth = t.faturaMes || getBillMonthForDate(t.data, closingDay);
        return bMonth === targetBillMonth;
      })
      .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
  }, [cardTransactions, targetBillMonth, closingDay, activeAccount]);

  const filteredTx = useMemo(() => {
    if (!searchTerm.trim()) return monthTx;
    const term = searchTerm.toLowerCase().trim();
    return monthTx.filter(t => 
      t.descricao.toLowerCase().includes(term) || 
      t.categoria.toLowerCase().includes(term)
    );
  }, [monthTx, searchTerm]);

  // Invoice calculations
  const compras = useMemo(() => {
    return monthTx.filter(t => t.tipoItem === 'despesa').reduce((sum, t) => sum + t.valor, 0);
  }, [monthTx]);

  const pagamentos = useMemo(() => {
    return monthTx.filter(t => t.tipoItem === 'receita').reduce((sum, t) => sum + t.valor, 0);
  }, [monthTx]);

  const saldoFatura = Math.max(compras - pagamentos, 0);
  const isPaga = compras > 0 && pagamentos >= compras;

  // Status calculation for the selected bill month
  const today = new Date();
  const currentRealYear = today.getFullYear();
  const currentRealMonth = today.getMonth();

  let isFechada = false;
  if (currentYear < currentRealYear || (currentYear === currentRealYear && currentMonth < currentRealMonth)) {
    isFechada = true;
  } else if (currentYear === currentRealYear && currentMonth === currentRealMonth) {
    if (today.getDate() > closingDay) {
      isFechada = true;
    }
  }

  const formatMonthName = (year: number, monthIdx: number) => {
    const months = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    return `${months[monthIdx]} de ${year}`;
  };

  const formatCurrency = (val: number) => {
    return `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const handleOpenPayModal = () => {
    if (!activeAccount) return;
    setSelectedBillMonth(targetBillMonth);
    setSelectedBillAmount(saldoFatura);
    setPayModalOpen(true);
  };

  const handleConfirmPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAccount || selectedBillAmount <= 0 || !sourceAccountId || !selectedBillMonth) return;

    const sourceAcc = checkingAccounts.find(a => a.id === sourceAccountId);
    if (!sourceAcc) return;

    // 1. Receita on the Credit Card to pay off spent amount
    await onAddTransaction(
      `Pagamento Fatura ${selectedBillMonth}`,
      selectedBillAmount,
      paymentDate,
      'Pagamento de Fatura',
      'receita',
      activeAccount.id,
      selectedBillMonth
    );

    // 2. Despesa on the checking account
    await onAddTransaction(
      `Pagamento Fatura ${selectedBillMonth} - ${activeAccount.nome}`,
      selectedBillAmount,
      paymentDate,
      'Cartão de Crédito',
      'despesa',
      sourceAccountId
    );

    setPayModalOpen(false);
  };

  if (!activeAccount) {
    return (
      <div className="p-8 text-center bg-white dark:bg-[#32323F] border border-zinc-200/80 dark:border-[#4C4E5D]/60 rounded-2xl">
        <CreditCard className="w-8 h-8 mx-auto text-zinc-400 mb-2" />
        <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Nenhum cartão de crédito cadastrado</p>
        <p className="text-xs text-zinc-500 mt-1">Cadastre seus cartões para acompanhar faturas e limites.</p>
        {onOpenAddCardModal && (
          <button
            onClick={onOpenAddCardModal}
            className="mt-4 px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl text-xs font-bold hover:opacity-90 transition-opacity"
          >
            Cadastrar Cartão
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-[#32323F] border border-zinc-200/80 dark:border-[#4C4E5D]/60 rounded-2xl shadow-xs overflow-hidden flex flex-col h-full min-h-[580px] max-h-[calc(100vh-175px)]">
      {/* 1. TOP HEADER: HORIZONTAL CARD TABS + MONTH INDICATOR */}
      <div className="px-4 py-3 border-b border-zinc-100 dark:border-[#4C4E5D]/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-50/70 dark:bg-[#252530]/60 shrink-0">
        {/* Horizontal Card Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {creditAccounts.map(card => {
            const isSelected = card.id === activeAccount.id;
            const cardSpent = accountBalances[card.id] ?? 0;
            const cardLimit = card.limiteCredito || 5000;
            const cardAvail = Math.max(cardLimit - cardSpent, 0);

            return (
              <button
                key={card.id}
                onClick={() => {
                  setSelectedCardId(card.id);
                  if (onSelectAccount) onSelectAccount(card.id);
                }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                  isSelected
                    ? 'bg-white dark:bg-[#3A3A49] text-zinc-900 dark:text-white shadow-xs border border-zinc-200/80 dark:border-[#4C4E5D]'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100/70 dark:hover:bg-[#30303D]'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${card.cor || 'bg-red-600'} shrink-0`} />
                <span className="truncate max-w-[130px] font-bold">{card.nome}</span>
                <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 font-normal">
                  R$ {cardAvail >= 1000 ? `${(cardAvail / 1000).toFixed(1)}k` : cardAvail.toFixed(0)}
                </span>
              </button>
            );
          })}

          {onOpenAddCardModal && (
            <button
              onClick={onOpenAddCardModal}
              title="Adicionar outro cartão de crédito"
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-[#30303D] rounded-xl transition-all shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="text-[11px] font-medium hidden md:inline">Novo Cartão</span>
            </button>
          )}
        </div>

        {/* Selected Month Badge synced with Dashboard Ruler */}
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto text-xs text-zinc-600 dark:text-zinc-400">
          <Calendar className="w-3.5 h-3.5 text-zinc-400" />
          <span>Fatura de</span>
          <span className="font-bold text-zinc-900 dark:text-white">
            {formatMonthName(currentYear, currentMonth)}
          </span>
        </div>
      </div>

      {/* 2. MAIN SPLIT VIEW (LEFT SUMMARY & CARD | RIGHT INVOICE STATEMENT) */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
        {/* LEFT COLUMN: VIRTUAL CARD GRAPHIC, LIMIT STATS & INVOICE SUMMARY (~38%) */}
        <div className="w-full lg:w-[380px] xl:w-[410px] shrink-0 p-4 sm:p-5 flex flex-col justify-between overflow-y-auto space-y-4 bg-zinc-50/40 dark:bg-[#272733]/50 border-b lg:border-b-0 lg:border-r border-zinc-100 dark:border-[#4C4E5D]/50 custom-scrollbar">
          
          {/* Virtual Card Graphic */}
          <div className="relative rounded-2xl p-4 sm:p-5 text-white shadow-md overflow-hidden bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-950 dark:from-[#1E1E26] dark:via-[#262633] dark:to-[#171720] border border-white/10">
            {/* Subtle card glowing accent based on card color */}
            <div className={`absolute -right-8 -top-8 w-32 h-32 rounded-full opacity-25 blur-xl pointer-events-none ${activeAccount.cor || 'bg-red-600'}`} />
            
            <div className="flex justify-between items-start mb-6 relative z-10">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${activeAccount.cor || 'bg-red-600'} ring-2 ring-white/30`} />
                <span className="font-bold text-sm tracking-wide">{activeAccount.nome}</span>
              </div>
              <div className="flex items-center gap-1.5 opacity-80">
                <CreditCard className="w-5 h-5" />
                <span className="text-[10px] font-black uppercase tracking-widest">Crédito</span>
              </div>
            </div>

            {/* Chip & Contactless Icons */}
            <div className="flex items-center gap-3 mb-5 relative z-10">
              <div className="w-9 h-6 rounded-md bg-gradient-to-tr from-amber-300 via-amber-200 to-amber-400 border border-amber-500/40 shadow-xs flex items-center justify-center">
                <div className="w-6 h-3 border-t border-b border-amber-600/30" />
              </div>
              <div className="text-[10px] font-mono text-zinc-400 tracking-widest">
                •••• •••• •••• {activeAccount.id.slice(-4).toUpperCase()}
              </div>
            </div>

            <div className="flex justify-between items-end relative z-10 text-[11px]">
              <div>
                <p className="text-[9px] uppercase tracking-wider text-zinc-400 font-semibold">Limite Disponível</p>
                <p className="text-base font-bold font-mono text-emerald-400">
                  {formatCurrency(available)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[9px] uppercase tracking-wider text-zinc-400 font-semibold">Vencimento</p>
                <p className="font-mono text-white font-bold">
                  Dia {dueDay}
                </p>
              </div>
            </div>
          </div>

          {/* Limit Bar */}
          <div className="bg-white dark:bg-[#32323F] p-3.5 rounded-xl border border-zinc-200/80 dark:border-[#4C4E5D]/60 space-y-2">
            <div className="flex justify-between items-center text-[11px]">
              <span className="font-semibold text-zinc-600 dark:text-zinc-300">Uso do Limite</span>
              <span className="font-mono font-bold text-zinc-900 dark:text-white">{limitUsagePct}%</span>
            </div>
            <div className="w-full h-2 bg-zinc-100 dark:bg-[#20202A] rounded-full overflow-hidden border border-zinc-200/50 dark:border-[#4C4E5D]/40">
              <div 
                className={`h-full transition-all duration-500 rounded-full ${
                  limitUsagePct > 90 ? 'bg-rose-500' : limitUsagePct > 70 ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${limitUsagePct}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-zinc-500 dark:text-zinc-400 font-mono">
              <span>Gasto: {formatCurrency(spent)}</span>
              <span>Total: {formatCurrency(limit)}</span>
            </div>
          </div>

          {/* Month's Invoice Summary Card */}
          <div className="bg-white dark:bg-[#32323F] p-4 rounded-xl border border-zinc-200/80 dark:border-[#4C4E5D]/60 space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 dark:text-zinc-400">
                Fatura de {formatMonthName(currentYear, currentMonth).split(' de ')[0]}
              </span>

              {/* Status Badge */}
              {isPaga ? (
                <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-md font-bold uppercase border border-emerald-200/60 dark:border-emerald-800/40">
                  <CheckCircle className="w-3 h-3" /> Paga
                </span>
              ) : isFechada ? (
                <span className="inline-flex items-center gap-1 text-[10px] bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 px-2 py-0.5 rounded-md font-bold uppercase border border-rose-200/60 dark:border-rose-800/40">
                  <AlertTriangle className="w-3 h-3" /> Fechada / Pendente
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-2 py-0.5 rounded-md font-bold uppercase border border-zinc-200/80 dark:border-[#4C4E5D]/60">
                  <Clock className="w-3 h-3" /> Em Aberto
                </span>
              )}
            </div>

            <div>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                {isFechada 
                  ? `Vence dia ${dueDay}/${String(currentMonth + 1).padStart(2, '0')}`
                  : `Fecha dia ${closingDay} • Vence dia ${dueDay}/${String(currentMonth + 1).padStart(2, '0')}`
                }
              </p>
              <p className="text-2xl font-black font-mono tracking-tight text-zinc-900 dark:text-white mt-0.5">
                {formatCurrency(isPaga ? compras : saldoFatura)}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-100 dark:border-[#4C4E5D]/40 text-[11px]">
              <div>
                <span className="text-[10px] text-zinc-400 block font-medium">Compras</span>
                <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                  {formatCurrency(compras)}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-zinc-400 block font-medium">Pagamentos</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(pagamentos)}
                </span>
              </div>
            </div>

            {/* Pay Button / Paid Status */}
            {saldoFatura > 0 ? (
              <button
                onClick={handleOpenPayModal}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 px-4 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-950 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-98"
              >
                Pagar Fatura ({formatCurrency(saldoFatura)})
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : isPaga ? (
              <div className="flex items-center justify-center gap-1.5 py-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50/80 dark:bg-emerald-950/30 rounded-xl border border-emerald-200/50 dark:border-emerald-800/40">
                <CheckCircle className="w-4 h-4" />
                Fatura Quitada com Sucesso
              </div>
            ) : (
              <div className="text-center py-2 text-xs text-zinc-400 dark:text-zinc-500 italic">
                Sem saldo devedor nesta fatura
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: DETAILED INVOICE STATEMENT WITH INTERNAL SCROLL (~62%) */}
        <div className="flex-1 min-w-0 p-4 sm:p-5 flex flex-col overflow-hidden">
          {/* Statement Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 mb-3 border-b border-zinc-100 dark:border-[#4C4E5D]/50 shrink-0">
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <ReceiptText className="w-4 h-4 text-zinc-500" />
                Extrato da Fatura
                <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">
                  ({monthTx.length} {monthTx.length === 1 ? 'lançamento' : 'lançamentos'})
                </span>
              </h3>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Lançamentos processados para o vencimento de {formatMonthName(currentYear, currentMonth)}
              </p>
            </div>

            {/* Quick Filter Search */}
            {monthTx.length > 3 && (
              <input
                type="text"
                placeholder="Filtrar lançamentos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="px-2.5 py-1 text-xs bg-zinc-50 dark:bg-[#252530] border border-zinc-200/80 dark:border-[#4C4E5D]/60 rounded-lg text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-zinc-400 w-full sm:w-44"
              />
            )}
          </div>

          {/* Transactions List with Dedicated Internal Scroll */}
          <div className="flex-1 overflow-y-auto pr-1 space-y-2 custom-scrollbar">
            {monthTx.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 text-zinc-400 dark:text-zinc-500">
                <CreditCard className="w-10 h-10 stroke-[1.5] mb-2 opacity-50" />
                <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Nenhuma compra nesta fatura</p>
                <p className="text-[11px] max-w-xs mt-1">
                  Compras efetuadas no cartão {activeAccount.nome} para a competência de {formatMonthName(currentYear, currentMonth)} aparecerão aqui.
                </p>
              </div>
            ) : filteredTx.length === 0 ? (
              <div className="py-8 text-center text-xs text-zinc-400">
                Nenhum lançamento encontrado para "{searchTerm}".
              </div>
            ) : (
              filteredTx.map(t => {
                const tDay = parseInt(t.data.split('-')[2], 10);
                const isAfterClosing = tDay > closingDay;
                const isExpense = t.tipoItem === 'despesa';

                return (
                  <div
                    key={t.id}
                    className="flex items-center justify-between p-2.5 rounded-xl hover:bg-zinc-50 dark:hover:bg-[#2A2A38] transition-colors border border-transparent hover:border-zinc-200/60 dark:hover:border-[#4C4E5D]/40"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Date Block */}
                      <div className="w-10 text-center shrink-0 py-0.5 px-1 bg-zinc-100 dark:bg-[#22222E] rounded-lg">
                        <span className="block text-[9px] text-zinc-400 uppercase font-bold">
                          {t.data.split('-')[1]}
                        </span>
                        <span className="block text-xs font-bold text-zinc-900 dark:text-white font-mono">
                          {t.data.split('-')[2]}
                        </span>
                      </div>

                      {/* Description & Category */}
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-zinc-900 dark:text-white truncate">
                          {t.descricao}
                        </p>
                        <div className="flex items-center gap-1.5 flex-wrap text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                          <span>{t.categoria}</span>
                          {isAfterClosing && (
                            <>
                              <span>•</span>
                              <span 
                                className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 font-bold shrink-0" 
                                title={`Compra realizada no dia ${tDay} (após o fechamento dia ${closingDay})`}
                              >
                                pós-fechamento
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Value */}
                    <div className="text-right shrink-0 pl-3">
                      <span className={`text-xs font-black font-mono ${isExpense ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        {isExpense ? '- ' : '+ '}{formatCurrency(t.valor)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Statement Footer */}
          {monthTx.length > 0 && (
            <div className="pt-3 mt-2 border-t border-zinc-100 dark:border-[#4C4E5D]/50 flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400 shrink-0">
              <span>Fechamento: dia {closingDay} • Vencimento: dia {dueDay}</span>
              <span className="font-mono font-bold text-zinc-900 dark:text-white">
                Total da Fatura: {formatCurrency(compras)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 3. PAYMENT MODAL */}
      {payModalOpen && (
        <div className="fixed inset-0 bg-zinc-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#32323F] border border-zinc-200/80 dark:border-[#4C4E5D]/60 rounded-2xl p-6 w-full max-w-sm shadow-xl animate-in zoom-in-95 duration-200">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white mb-3 flex items-center gap-1.5 border-b border-zinc-100 dark:border-[#4C4E5D]/60 pb-2">
              <Landmark className="w-4 h-4 text-zinc-500" />
              Pagar Fatura - {formatMonthName(currentYear, currentMonth)}
            </h3>

            <form onSubmit={handleConfirmPayment} className="space-y-4">
              <div>
                <p className="text-[10px] uppercase font-bold text-zinc-400 dark:text-zinc-500">Valor do Pagamento</p>
                <p className="text-lg font-bold font-mono text-zinc-900 dark:text-white mt-0.5">
                  {formatCurrency(selectedBillAmount)}
                </p>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-zinc-500 dark:text-zinc-400 mb-1.5">
                  Conta de Origem (Débito)
                </label>
                <select
                  required
                  value={sourceAccountId}
                  onChange={(e) => setSourceAccountId(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-[#252530] border border-zinc-200/80 dark:border-[#4C4E5D]/60 text-zinc-900 dark:text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10 font-medium"
                >
                  {checkingAccounts.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.nome} (Saldo: R$ {(accountBalances[acc.id] ?? 0).toFixed(0)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-zinc-500 dark:text-zinc-400 mb-1.5">
                  Data de Pagamento
                </label>
                <input
                  type="date"
                  required
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-[#252530] border border-zinc-200/80 dark:border-[#4C4E5D]/60 text-zinc-900 dark:text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10 font-medium"
                />
              </div>

              <div className="flex gap-2.5 pt-3 border-t border-zinc-100 dark:border-[#4C4E5D]/60">
                <button
                  type="button"
                  onClick={() => setPayModalOpen(false)}
                  className="flex-1 px-4 py-2 bg-zinc-100 hover:bg-zinc-200/70 dark:bg-[#4C4E5D] dark:hover:bg-[#5B5D6E] text-zinc-700 dark:text-zinc-300 rounded-xl text-xs font-semibold transition-all cursor-pointer text-center"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-950 rounded-xl text-xs font-bold transition-all cursor-pointer text-center shadow-xs"
                >
                  Confirmar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
