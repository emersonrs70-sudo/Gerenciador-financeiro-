import React, { useState } from 'react';
import { CreditCard, CheckCircle, AlertTriangle, Clock, Landmark, ArrowRight, Calendar } from 'lucide-react';
import { BankAccount, Transaction, getBillMonthForDate } from '../types';

interface CreditCardBillsProps {
  activeAccount: BankAccount;
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
}

export const CreditCardBills: React.FC<CreditCardBillsProps> = ({
  activeAccount,
  transactions,
  checkingAccounts,
  onAddTransaction,
  accountBalances
}) => {
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [selectedBillMonth, setSelectedBillMonth] = useState<string>('');
  const [selectedBillAmount, setSelectedBillAmount] = useState<number>(0);
  const [sourceAccountId, setSourceAccountId] = useState<string>(checkingAccounts[0]?.id || '');
  const [paymentDate, setPaymentDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });

  const closingDay = activeAccount.diaFechamento || 5;
  const dueDay = activeAccount.diaVencimento || 12;
  const limit = activeAccount.limiteCredito || 5000;
  const spent = accountBalances[activeAccount.id] ?? 0;
  const available = Math.max(limit - spent, 0);

  // Group card transactions by billing month
  const cardTransactions = transactions.filter(t => t.accountId === activeAccount.id);

  // Find unique billing months
  const billMonthsSet = new Set<string>();
  // Include current, previous, and next month to guarantee options are visible
  const today = new Date();
  const getYearMonthStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  billMonthsSet.add(getYearMonthStr(today));
  
  const prevMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  billMonthsSet.add(getYearMonthStr(prevMonthDate));

  const nextMonthDate = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  billMonthsSet.add(getYearMonthStr(nextMonthDate));

  // Add months from actual transactions
  cardTransactions.forEach(t => {
    if (t.faturaMes) {
      billMonthsSet.add(t.faturaMes);
    }
  });

  const sortedBillMonths = Array.from(billMonthsSet).sort((a, b) => b.localeCompare(a));

  const handleOpenPayModal = (month: string, amount: number) => {
    setSelectedBillMonth(month);
    setSelectedBillAmount(amount);
    setPayModalOpen(true);
  };

  const handleConfirmPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedBillAmount <= 0 || !sourceAccountId || !selectedBillMonth) return;

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

  const formatMonthName = (yearMonth: string) => {
    const parts = yearMonth.split('-');
    if (parts.length < 2) return yearMonth;
    const year = parts[0];
    const monthIdx = parseInt(parts[1], 10) - 1;
    const months = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    return `${months[monthIdx]} ${year}`;
  };

  return (
    <div className="bg-white dark:bg-[#1A1A1E] border border-zinc-200/80 dark:border-[#27272A] rounded-2xl p-5 shadow-xs space-y-5">
      {/* CARD HEADER DETAILS */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-zinc-100 dark:border-[#27272A] pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-zinc-900 dark:bg-zinc-100 flex items-center justify-center text-white dark:text-zinc-950 shadow-xs">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-black text-zinc-900 dark:text-white flex items-center gap-2">
              {activeAccount.nome}
              <span className="text-[10px] bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 font-extrabold px-1.5 py-0.5 rounded-md uppercase">
                Cartão de Crédito
              </span>
            </h2>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Fechamento dia {closingDay} • Vencimento dia {dueDay}
            </p>
          </div>
        </div>

        {/* LIMIT VISUAL STAT */}
        <div className="text-right">
          <p className="text-[10px] font-black uppercase text-zinc-400 dark:text-zinc-500">Limite Disponível</p>
          <p className="text-base font-black text-emerald-600 dark:text-emerald-400 font-mono">
            R$ {available.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono">
            de R$ {limit.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
          </p>
        </div>
      </div>

      {/* LIMIT PROGRESS BAR */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-[10px] font-black uppercase text-zinc-500 dark:text-zinc-400">
          <span>Total Gasto: R$ {spent.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          <span>Disponível: {((available / limit) * 100).toFixed(0)}%</span>
        </div>
        <div className="w-full h-2 bg-zinc-100 dark:bg-[#141416] rounded-full overflow-hidden border border-zinc-200/50 dark:border-[#27272A]">
          <div 
            className="h-full bg-zinc-800 dark:bg-zinc-200 transition-all duration-500"
            style={{ width: `${Math.min((spent / limit) * 100, 100)}%` }}
          />
        </div>
      </div>

      {/* DETAILED STATEMENTS / BILLS LIST */}
      <div className="space-y-4">
        <h3 className="text-xs font-black uppercase text-zinc-500 dark:text-zinc-400 tracking-wider">
          🧾 Faturas por Competência
        </h3>

        <div className="space-y-3">
          {sortedBillMonths.map(month => {
            const monthTx = cardTransactions.filter(t => t.faturaMes === month);
            
            const compras = monthTx.filter(t => t.tipoItem === 'despesa').reduce((sum, t) => sum + t.valor, 0);
            const pagamentos = monthTx.filter(t => t.tipoItem === 'receita').reduce((sum, t) => sum + t.valor, 0);
            
            const saldoFatura = Math.max(compras - pagamentos, 0);
            const isPaga = compras > 0 && pagamentos >= compras;

            // Determine if bill is Closed or Open
            const parts = month.split('-');
            const billYear = parseInt(parts[0], 10);
            const billMonth = parseInt(parts[1], 10) - 1;
            const currentYear = today.getFullYear();
            const currentMonth = today.getMonth();

            let isFechada = false;
            if (billYear < currentYear || (billYear === currentYear && billMonth < currentMonth)) {
              isFechada = true;
            } else if (billYear === currentYear && billMonth === currentMonth) {
              // Same month, check closing day
              if (today.getDate() > closingDay) {
                isFechada = true;
              }
            }

            return (
              <div 
                key={month} 
                className="border border-zinc-200/80 dark:border-[#27272A] rounded-xl bg-zinc-50/50 dark:bg-[#141416] p-3.5 space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-200/60 dark:border-[#27272A] pb-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-zinc-400" />
                    <div>
                      <p className="text-xs font-bold text-zinc-900 dark:text-zinc-200">
                        {formatMonthName(month)}
                      </p>
                      <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                        Vence dia {dueDay}/{month.split('-')[1]}
                      </p>
                    </div>
                  </div>

                  {/* STATUS BADGES */}
                  <div className="flex items-center gap-2">
                    {isPaga ? (
                      <span className="flex items-center gap-1 text-[9px] bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 px-2 py-1 rounded-md font-bold uppercase">
                        <CheckCircle className="w-3 h-3" /> Paga
                      </span>
                    ) : isFechada ? (
                      <span className="flex items-center gap-1 text-[9px] bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 px-2 py-1 rounded-md font-bold uppercase">
                        <AlertTriangle className="w-3 h-3" /> Fechada / Pendente
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[9px] bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-2 py-1 rounded-md font-bold uppercase">
                        <Clock className="w-3 h-3" /> Em Aberto
                      </span>
                    )}

                    <span className="text-xs font-bold font-mono text-zinc-900 dark:text-white">
                      R$ {saldoFatura.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* PURCHASES LIST */}
                {monthTx.length === 0 ? (
                  <p className="text-[11px] text-zinc-400 dark:text-zinc-500 italic">Sem transações registradas para esta fatura.</p>
                ) : (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {monthTx.map(t => (
                      <div key={t.id} className="flex justify-between items-center text-[11px] hover:bg-zinc-100/60 dark:hover:bg-[#222226] p-1 rounded transition-colors">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-zinc-400 dark:text-zinc-500 shrink-0 font-mono text-[10px]">
                            {t.data.split('-')[2]}/{t.data.split('-')[1]}
                          </span>
                          <span className="text-zinc-700 dark:text-zinc-300 font-medium truncate">
                            {t.descricao}
                          </span>
                        </div>
                        <span className={`font-bold font-mono shrink-0 ${t.tipoItem === 'despesa' ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                          {t.tipoItem === 'despesa' ? '-' : '+'} R$ {t.valor.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* PAY BUTTON IF UNPAID */}
                {saldoFatura > 0 && (
                  <div className="flex justify-end pt-1">
                    <button
                      onClick={() => handleOpenPayModal(month, saldoFatura)}
                      className="flex items-center gap-1 text-[11px] font-bold text-white dark:text-zinc-950 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white px-3 py-1.5 rounded-xl active:scale-95 cursor-pointer transition-all shadow-xs"
                    >
                      Pagar Fatura <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {payModalOpen && (
        <div className="fixed inset-0 bg-zinc-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#1A1A1E] border border-zinc-200/80 dark:border-[#27272A] rounded-2xl p-6 w-full max-w-sm shadow-xl animate-in zoom-in-95 duration-200">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white mb-3 flex items-center gap-1.5 border-b border-zinc-100 dark:border-[#27272A] pb-2">
              <Landmark className="w-4 h-4 text-zinc-500" />
              Pagar Fatura - {formatMonthName(selectedBillMonth)}
            </h3>

            <form onSubmit={handleConfirmPayment} className="space-y-4">
              <div>
                <p className="text-[10px] uppercase font-bold text-zinc-400 dark:text-zinc-500">Valor do Pagamento</p>
                <p className="text-lg font-bold font-mono text-zinc-900 dark:text-white mt-0.5">
                  R$ {selectedBillAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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
                  className="w-full bg-zinc-50 dark:bg-[#141416] border border-zinc-200/80 dark:border-[#27272A] text-zinc-900 dark:text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10 font-medium"
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
                  className="w-full bg-zinc-50 dark:bg-[#141416] border border-zinc-200/80 dark:border-[#27272A] text-zinc-900 dark:text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10 font-medium"
                />
              </div>

              <div className="flex gap-2.5 pt-3 border-t border-zinc-100 dark:border-[#27272A]">
                <button
                  type="button"
                  onClick={() => setPayModalOpen(false)}
                  className="flex-1 px-4 py-2 bg-zinc-100 hover:bg-zinc-200/70 dark:bg-[#27272A] dark:hover:bg-[#38383E] text-zinc-700 dark:text-zinc-300 rounded-xl text-xs font-semibold transition-all cursor-pointer text-center"
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
