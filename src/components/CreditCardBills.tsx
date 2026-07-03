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
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-5">
      {/* CARD HEADER DETAILS */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 dark:border-slate-850 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-600 flex items-center justify-center text-white shadow-md shadow-red-500/10">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
              {activeAccount.nome}
              <span className="text-[10px] bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 font-extrabold px-1.5 py-0.5 rounded-md uppercase">
                Cartão de Crédito
              </span>
            </h2>
            <p className="text-[11px] text-slate-500">
              Fechamento dia {closingDay} • Vencimento dia {dueDay}
            </p>
          </div>
        </div>

        {/* LIMIT VISUAL STAT */}
        <div className="text-right">
          <p className="text-[10px] font-black uppercase text-slate-400">Limite Disponível</p>
          <p className="text-base font-black text-emerald-500">
            R$ {available.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-[10px] text-slate-500">
            de R$ {limit.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
          </p>
        </div>
      </div>

      {/* LIMIT PROGRESS BAR */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-[10px] font-black uppercase text-slate-500">
          <span>Total Gasto: R$ {spent.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          <span>Disponível: {((available / limit) * 100).toFixed(0)}%</span>
        </div>
        <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-amber-500 to-red-600 transition-all duration-500"
            style={{ width: `${Math.min((spent / limit) * 100, 100)}%` }}
          />
        </div>
      </div>

      {/* DETAILED STATEMENTS / BILLS LIST */}
      <div className="space-y-4">
        <h3 className="text-xs font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">
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
                className="border border-slate-150 dark:border-slate-850 rounded-xl bg-slate-50/40 dark:bg-slate-950/10 p-3.5 space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-850 pb-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <div>
                      <p className="text-xs font-black text-slate-800 dark:text-slate-200">
                        {formatMonthName(month)}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        Vence dia {dueDay}/{month.split('-')[1]}
                      </p>
                    </div>
                  </div>

                  {/* STATUS BADGES */}
                  <div className="flex items-center gap-2">
                    {isPaga ? (
                      <span className="flex items-center gap-1 text-[9px] bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 px-2 py-1 rounded-md font-extrabold uppercase">
                        <CheckCircle className="w-3 h-3" /> Paga
                      </span>
                    ) : isFechada ? (
                      <span className="flex items-center gap-1 text-[9px] bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 px-2 py-1 rounded-md font-extrabold uppercase animate-pulse">
                        <AlertTriangle className="w-3 h-3" /> Fechada / Pendente
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[9px] bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 px-2 py-1 rounded-md font-extrabold uppercase">
                        <Clock className="w-3 h-3" /> Em Aberto
                      </span>
                    )}

                    <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                      R$ {saldoFatura.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* PURCHASES LIST */}
                {monthTx.length === 0 ? (
                  <p className="text-[11px] text-slate-400 italic">Sem transações registradas para esta fatura.</p>
                ) : (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {monthTx.map(t => (
                      <div key={t.id} className="flex justify-between items-center text-[11px] hover:bg-slate-100/50 dark:hover:bg-slate-900/30 p-1 rounded transition-colors">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-slate-400 dark:text-slate-550 shrink-0">
                            {t.data.split('-')[2]}/{t.data.split('-')[1]}
                          </span>
                          <span className="text-slate-700 dark:text-slate-300 font-bold truncate">
                            {t.descricao}
                          </span>
                        </div>
                        <span className={`font-bold shrink-0 ${t.tipoItem === 'despesa' ? 'text-red-500' : 'text-emerald-500'}`}>
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
                      className="flex items-center gap-1 text-[10px] font-black text-white bg-purple-600 hover:bg-purple-700 px-3 py-1.5 rounded-lg active:scale-95 cursor-pointer transition-all shadow-sm shadow-purple-500/10"
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

      {/* BILL PAYMENT MODAL DIALOG */}
      {payModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-800 pb-2">
              <Landmark className="w-4 h-4 text-purple-600" />
              Pagar Fatura - {formatMonthName(selectedBillMonth)}
            </h3>

            <form onSubmit={handleConfirmPayment} className="space-y-4">
              <div>
                <p className="text-[10px] uppercase font-black text-slate-400">Valor do Pagamento</p>
                <p className="text-lg font-black text-purple-600 mt-0.5">
                  R$ {selectedBillAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-black text-slate-400 dark:text-slate-500 mb-1.5">
                  Conta de Origem (Débito)
                </label>
                <select
                  required
                  value={sourceAccountId}
                  onChange={(e) => setSourceAccountId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 dark:text-white rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 font-semibold"
                >
                  {checkingAccounts.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.nome} (Saldo: R$ {(accountBalances[acc.id] ?? 0).toFixed(0)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-black text-slate-400 dark:text-slate-500 mb-1.5">
                  Data de Pagamento
                </label>
                <input
                  type="date"
                  required
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 dark:text-white rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 font-bold"
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setPayModalOpen(false)}
                  className="flex-1 px-4 py-2 bg-slate-100 dark:bg-slate-850 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-350 rounded-xl text-xs font-black transition-all cursor-pointer text-center"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-black transition-all cursor-pointer text-center shadow-md shadow-emerald-500/10"
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
