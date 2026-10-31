import React, { useState } from 'react';
import { PlusCircle, ListTodo, Loader2, RefreshCw, CreditCard, Calendar, AlertCircle } from 'lucide-react';
import { Category, Transaction, BankAccount, RecurrentRule, getBillMonthForDate, getInstallmentBillMonth, getInstallmentTransactionDate } from '../types';

interface TransactionFormProps {
  categoriasDespesa: string[];
  categoriasReceita: string[];
  onAddTransaction: (
    descricao: string,
    valor: number,
    data: string,
    categoria: string,
    tipoItem: 'despesa' | 'receita',
    accountId: string,
    faturaMes?: string,
    transferTargetAccountId?: string
  ) => Promise<void>;
  onAddCategory: (nome: string, tipoItem: 'despesa' | 'receita') => Promise<void>;
  onAddRecurrentRule?: (rule: Omit<RecurrentRule, 'id' | 'criadaEm'>) => Promise<void>;
  recurrentRulesCount?: number;
  onOpenManageRecurrentModal?: () => void;
  accounts: BankAccount[];
  selectedAccountId?: string;
}

export const TransactionForm: React.FC<TransactionFormProps> = ({
  categoriasDespesa,
  categoriasReceita,
  onAddTransaction,
  onAddCategory,
  onAddRecurrentRule,
  recurrentRulesCount = 0,
  onOpenManageRecurrentModal,
  accounts = [],
  selectedAccountId
}) => {
  const [modo, setModo] = useState<'despesa' | 'receita'>('despesa');
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [data, setData] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });

  const [accountId, setAccountId] = useState(() => {
    if (selectedAccountId && selectedAccountId !== 'consolidado') return selectedAccountId;
    return accounts[0]?.id || 'geral';
  });

  const [transferTargetAccountId, setTransferTargetAccountId] = useState<string>('');

  React.useEffect(() => {
    if (selectedAccountId && selectedAccountId !== 'consolidado') {
      setAccountId(selectedAccountId);
    }
  }, [selectedAccountId]);

  // Reset transfer target if user changes main account to the same one
  React.useEffect(() => {
    if (transferTargetAccountId === accountId) {
      setTransferTargetAccountId('');
    }
  }, [accountId, transferTargetAccountId]);

  const activeCategorias = modo === 'despesa' ? categoriasDespesa : categoriasReceita;
  const [categoria, setCategoria] = useState('');

  React.useEffect(() => {
    const currentCats = modo === 'despesa' ? categoriasDespesa : categoriasReceita;
    if (!currentCats.includes(categoria)) {
      setCategoria(currentCats[0] || 'Outros');
    }
  }, [modo, categoriasDespesa, categoriasReceita]);

  const [criandoCategoria, setCriandoCategoria] = useState(false);
  const [novaCategoriaNome, setNovaCategoriaNome] = useState('');

  const [tipoGasto, setTipoGasto] = useState<'variavel' | 'parcelado' | 'fixo'>('variavel');
  const [numParcelas, setNumParcelas] = useState<number>(2);
  const [modoValorParcela, setModoValorParcela] = useState<'total' | 'parcela'>('total');
  const [validadeFixo, setValidadeFixo] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Intelligent detection of target account from description text
  const handleDescricaoChange = (val: string) => {
    setDescricao(val);
    if (modo === 'despesa' && !transferTargetAccountId) {
      const lower = val.toLowerCase();
      if (lower.includes('transf') || lower.includes('pix') || lower.includes('para ')) {
        const matched = accounts.find(a => a.id !== accountId && lower.includes(a.nome.toLowerCase()));
        if (matched) {
          setTransferTargetAccountId(matched.id);
          // Suggest category Transferência if available
          const transfCat = categoriasDespesa.find(c => c.toLowerCase().includes('transf') || c.toLowerCase().includes('pix'));
          if (transfCat) setCategoria(transfCat);
        }
      }
    }
  };

  const handleTipoGastoChange = (novoTipo: 'variavel' | 'parcelado' | 'fixo') => {
    setTipoGasto(novoTipo);
    if (novoTipo === 'parcelado') {
      const currentAcc = accounts.find(a => a.id === accountId);
      if (!currentAcc || currentAcc.tipo !== 'credito') {
        const creditAcc = accounts.find(a => a.tipo === 'credito');
        if (creditAcc) {
          setAccountId(creditAcc.id);
        }
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || !descricao.trim() || !valor || !data) return;

    setIsSubmitting(true);
    try {
      const account = accounts.find(a => a.id === accountId);
      const catToUse = categoria;

      if (modo === 'despesa' && tipoGasto === 'parcelado') {
        // CASE: PARCELAMENTO NO CARTÃO (CRÉDITO)
        const parsedVal = parseFloat(valor);
        const count = Math.max(2, Math.min(36, numParcelas));
        const valorPorParcela = modoValorParcela === 'total'
          ? Math.round((parsedVal / count) * 100) / 100
          : parsedVal;
        
        const closingDay = account?.diaFechamento || 5;

        for (let i = 0; i < count; i++) {
          const installmentDate = getInstallmentTransactionDate(data, i);
          const installmentFaturaMes = getInstallmentBillMonth(data, i, closingDay);
          const installmentDesc = `${descricao.trim()} (${i + 1}/${count})`;

          await onAddTransaction(
            installmentDesc,
            valorPorParcela,
            installmentDate,
            catToUse,
            modo,
            accountId,
            installmentFaturaMes
          );
        }
      } else if (modo === 'despesa' && tipoGasto === 'fixo' && validadeFixo) {
        // CASE 1: FIXED LIMIT DATE (replicate up to validadeFixo)
        try {
          const startDate = new Date(data + 'T12:00:00');
          const [limitYearStr, limitMonthStr] = validadeFixo.split('-');
          const limitYear = parseInt(limitYearStr, 10);
          const limitMonth = parseInt(limitMonthStr, 10) - 1; // 0-indexed month

          let currentYear = startDate.getFullYear();
          let currentMonth = startDate.getMonth();
          const targetDay = startDate.getDate();

          while (true) {
            if (currentYear > limitYear || (currentYear === limitYear && currentMonth > limitMonth)) {
              break;
            }

            const d = new Date(currentYear, currentMonth, 1);
            const maxDays = new Date(currentYear, currentMonth + 1, 0).getDate();
            const dayToUse = Math.min(targetDay, maxDays);
            
            const yyyy = currentYear;
            const mm = String(currentMonth + 1).padStart(2, '0');
            const dd = String(dayToUse).padStart(2, '0');
            const dateStr = `${yyyy}-${mm}-${dd}`;

            let faturaMesForDate: string | undefined = undefined;
            if (account && account.tipo === 'credito') {
              faturaMesForDate = getBillMonthForDate(dateStr, account.diaFechamento);
            }

            const formattedMonth = String(currentMonth + 1).padStart(2, '0');
            const recDescricao = `${descricao.trim()} (${formattedMonth}/${currentYear})`;

            await onAddTransaction(
              recDescricao,
              parseFloat(valor),
              dateStr,
              catToUse,
              modo,
              accountId,
              faturaMesForDate
            );

            currentMonth++;
            if (currentMonth > 11) {
              currentMonth = 0;
              currentYear++;
            }
          }
        } catch (err) {
          console.error('Error generating recurring transactions:', err);
          let faturaMes: string | undefined = undefined;
          if (account && account.tipo === 'credito') {
            faturaMes = getBillMonthForDate(data, account.diaFechamento);
          }
          await onAddTransaction(descricao.trim(), parseFloat(valor), data, catToUse, modo, accountId, faturaMes);
        }
      } else if (tipoGasto === 'fixo' && !validadeFixo) {
        // CASE 2: CONTINUOUS RECURRING EXPENSE (NO LIMIT DATE)
        // 1. Generate current month's transaction immediately
        let faturaMes: string | undefined = undefined;
        if (account && account.tipo === 'credito') {
          faturaMes = getBillMonthForDate(data, account.diaFechamento);
        }
        await onAddTransaction(descricao.trim(), parseFloat(valor), data, catToUse, modo, accountId, faturaMes);

        // 2. Register continuous rule so future months are generated automatically
        if (onAddRecurrentRule) {
          const targetDay = parseInt(data.split('-')[2], 10) || new Date().getDate();
          const currentYearMonth = data.substring(0, 7);
          await onAddRecurrentRule({
            descricao: descricao.trim(),
            valor: parseFloat(valor),
            diaDoMes: targetDay,
            categoria: catToUse,
            tipoItem: modo,
            accountId: accountId,
            ativa: true,
            ultimoMesGerado: currentYearMonth
          });
        }
      } else {
        // CASE 3: STANDARD ONE-OFF TRANSACTION
        let faturaMes: string | undefined = undefined;
        if (account && account.tipo === 'credito') {
          faturaMes = getBillMonthForDate(data, account.diaFechamento);
        }
        await onAddTransaction(
          descricao.trim(),
          parseFloat(valor),
          data,
          catToUse,
          modo,
          accountId,
          faturaMes,
          modo === 'despesa' && transferTargetAccountId ? transferTargetAccountId : undefined
        );
      }

      // Reset fields
      setDescricao('');
      setValor('');
      setValidadeFixo('');
      setTransferTargetAccountId('');
    } catch (err) {
      console.error('Error adding transaction:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCriarCategoria = async () => {
    const nomeLimpo = novaCategoriaNome.trim();
    if (nomeLimpo) {
      const activeCats = modo === 'despesa' ? categoriasDespesa : categoriasReceita;
      if (!activeCats.includes(nomeLimpo)) {
        await onAddCategory(nomeLimpo, modo);
        setCategoria(nomeLimpo);
        setNovaCategoriaNome('');
        setCriandoCategoria(false);
      }
    }
  };

  const selectedAccount = accounts.find(a => a.id === accountId);
  const closingDay = selectedAccount?.diaFechamento || 5;
  const dayNumber = parseInt(data.split('-')[2], 10) || new Date().getDate();
  const isAfterClosing = dayNumber > closingDay;
  const firstBill = getInstallmentBillMonth(data, 0, closingDay);
  const lastBill = getInstallmentBillMonth(data, numParcelas - 1, closingDay);
  const parsedVal = parseFloat(valor) || 0;
  const valParcela = modoValorParcela === 'total' ? (parsedVal / numParcelas) : parsedVal;

  return (
    <div className="bg-white dark:bg-[#32323F] border border-[#E8E5DC] dark:border-[#4C4E5D]/60 rounded-2xl p-3.5 sm:p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-2.5 self-start">
      <div className="flex bg-[#F3F1EB] dark:bg-[#252530] p-1 rounded-xl border border-[#E8E5DC] dark:border-[#4C4E5D]/50">
        <button
          type="button"
          onClick={() => setModo('despesa')}
          className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
            modo === 'despesa'
              ? 'bg-white dark:bg-[#4C4E5D] text-rose-600 dark:text-rose-300 shadow-xs'
              : 'text-zinc-600 hover:text-zinc-900 dark:text-[#988E96] dark:hover:text-[#DDD5D0]'
          }`}
        >
          Despesa
        </button>
        <button
          type="button"
          onClick={() => setModo('receita')}
          className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
            modo === 'receita'
              ? 'bg-white dark:bg-[#4C4E5D] text-emerald-600 dark:text-emerald-400 shadow-xs'
              : 'text-zinc-600 hover:text-zinc-900 dark:text-[#988E96] dark:hover:text-[#DDD5D0]'
          }`}
        >
          Receita
        </button>
      </div>

      <h2 className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-1.5 border-b border-[#EAE7E0] dark:border-[#4C4E5D]/60 pb-2">
        <ListTodo className={`w-3.5 h-3.5 ${modo === 'despesa' ? 'text-rose-500' : 'text-emerald-500'}`} />
        {modo === 'despesa' ? 'Nova Despesa' : 'Nova Receita'}
      </h2>

      <form onSubmit={handleSubmit} className="space-y-2.5">
        <div>
          <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block mb-1">
            Conta / Cartão
          </label>
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="w-full bg-[#F8F7F4] dark:bg-[#252530] border border-[#E8E5DC] dark:border-[#4C4E5D]/60 text-zinc-900 dark:text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10 transition-all font-medium"
          >
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.nome} ({acc.tipo === 'credito' ? 'Crédito' : `Saldo: R$ ${acc.saldoInicial.toFixed(0)}`})
              </option>
            ))}
          </select>
        </div>

        {modo === 'despesa' && accounts.length > 1 && (
          <div className="p-2.5 bg-zinc-50 dark:bg-[#252530] border border-zinc-200/80 dark:border-[#4C4E5D]/60 rounded-xl space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider flex items-center gap-1">
                <span>🔄 Transferir para outra conta?</span>
              </label>
              {transferTargetAccountId && (
                <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400">
                  Lançamento duplo ativo
                </span>
              )}
            </div>
            <select
              value={transferTargetAccountId}
              onChange={(e) => setTransferTargetAccountId(e.target.value)}
              className="w-full bg-white dark:bg-[#32323F] border border-zinc-200/80 dark:border-[#4C4E5D]/60 text-zinc-900 dark:text-white rounded-lg px-2.5 py-1.5 text-xs font-medium focus:outline-none"
            >
              <option value="">Não é transferência (saída normal)</option>
              {accounts.filter(a => a.id !== accountId).map((acc) => (
                <option key={acc.id} value={acc.id}>
                  Transferir para: {acc.nome} ({acc.tipo === 'credito' ? 'Crédito' : `Saldo: R$ ${acc.saldoInicial.toFixed(0)}`})
                </option>
              ))}
            </select>
            {transferTargetAccountId && (
              <p className="text-[9.5px] text-zinc-500 dark:text-zinc-400 leading-tight">
                💡 Ao salvar, será gerada uma <strong>saída</strong> nesta conta e uma <strong>entrada (receita)</strong> correspondente na conta de destino com vínculo de exclusão mútua.
              </p>
            )}
          </div>
        )}

        <div>
          <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block mb-1">
            Descrição
          </label>
          <input
            type="text"
            required
            value={descricao}
            onChange={(e) => handleDescricaoChange(e.target.value)}
            placeholder="Ex: Supermercado, Pix para Poupança, etc."
            className="w-full bg-[#F8F7F4] dark:bg-[#252530] border border-[#E8E5DC] dark:border-[#4C4E5D]/60 text-zinc-900 dark:text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10 transition-all font-medium placeholder:text-zinc-400"
          />
        </div>

        <div>
          <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block mb-1">
            Valor (R$)
          </label>
          <input
            type="number"
            step="0.01"
            required
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder="0.00"
            className="w-full bg-[#F8F7F4] dark:bg-[#252530] border border-[#E8E5DC] dark:border-[#4C4E5D]/60 text-zinc-900 dark:text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10 transition-all font-mono font-bold"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              Data
            </label>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => {
                  const d = new Date();
                  setData(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
                }}
                className="text-[9px] px-1.5 py-0.5 rounded bg-[#F3F1EB] dark:bg-[#252530] text-zinc-600 dark:text-zinc-400 font-semibold hover:bg-zinc-200 cursor-pointer"
              >
                Hoje
              </button>
              <button
                type="button"
                onClick={() => {
                  const d = new Date();
                  d.setDate(d.getDate() - 1);
                  setData(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
                }}
                className="text-[9px] px-1.5 py-0.5 rounded bg-[#F3F1EB] dark:bg-[#252530] text-zinc-600 dark:text-zinc-400 font-semibold hover:bg-zinc-200 cursor-pointer"
              >
                Ontem
              </button>
            </div>
          </div>
          <input
            type="date"
            required
            value={data}
            onChange={(e) => setData(e.target.value)}
            className="w-full bg-[#F8F7F4] dark:bg-[#252530] border border-[#E8E5DC] dark:border-[#4C4E5D]/60 text-zinc-900 dark:text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10 transition-all font-medium"
          />
        </div>

        {/* Categoria */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              Categoria
            </label>
            <button
              type="button"
              onClick={() => setCriandoCategoria(!criandoCategoria)}
              className="text-[10px] text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 font-semibold cursor-pointer"
            >
              {criandoCategoria ? 'Selecionar Existente' : '+ Nova Categoria'}
            </button>
          </div>

          {!criandoCategoria ? (
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className="w-full bg-[#F8F7F4] dark:bg-[#252530] border border-[#E8E5DC] dark:border-[#4C4E5D]/60 text-zinc-900 dark:text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10 transition-all font-medium"
            >
              {activeCategorias.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          ) : (
            <div className="flex gap-1.5 mt-1">
              <input
                type="text"
                placeholder="Ex: Viagens, Pets"
                value={novaCategoriaNome}
                onChange={(e) => setNovaCategoriaNome(e.target.value)}
                className="flex-1 bg-[#F8F7F4] dark:bg-[#252530] border border-[#E8E5DC] dark:border-[#4C4E5D]/60 text-zinc-900 dark:text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10 font-medium"
              />
              <button
                type="button"
                onClick={handleCriarCategoria}
                className="bg-[#32323F] hover:bg-[#252530] dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-950 text-xs px-3 rounded-xl font-bold transition-all cursor-pointer shadow-xs"
              >
                Criar
              </button>
            </div>
          )}
        </div>

        {modo === 'despesa' && (
          <>
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block">
                  Tipo de Gasto
                </label>
                {onOpenManageRecurrentModal && recurrentRulesCount > 0 && (
                  <button
                    type="button"
                    onClick={onOpenManageRecurrentModal}
                    className="text-[10px] font-bold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-2.5 h-2.5" />
                    <span>Ver Fixos Ativos ({recurrentRulesCount})</span>
                  </button>
                )}
              </div>
              <select
                value={tipoGasto}
                onChange={(e) => handleTipoGastoChange(e.target.value as 'variavel' | 'parcelado' | 'fixo')}
                className="w-full bg-[#F8F7F4] dark:bg-[#252530] border border-[#E8E5DC] dark:border-[#4C4E5D]/60 text-zinc-900 dark:text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10 font-medium"
              >
                <option value="variavel">Lançamento Único (Variável)</option>
                <option value="parcelado">Parcelado no Cartão (Crédito)</option>
                <option value="fixo">Lançamento Fixo (Recorrente Mensal)</option>
              </select>
            </div>

            {tipoGasto === 'parcelado' && (
              <div className="space-y-2.5 p-3 bg-amber-50/70 dark:bg-[#2a2a36] border border-amber-200/80 dark:border-amber-500/30 rounded-xl">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    Parcelamento no Cartão
                  </span>
                  {selectedAccount?.diaFechamento ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-800 dark:text-amber-300">
                      Fechamento: dia {selectedAccount.diaFechamento}
                    </span>
                  ) : null}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider block mb-1">
                      Nº de Parcelas
                    </label>
                    <select
                      value={numParcelas}
                      onChange={(e) => setNumParcelas(parseInt(e.target.value, 10))}
                      className="w-full bg-white dark:bg-[#252530] border border-amber-200 dark:border-amber-800/50 text-zinc-900 dark:text-white rounded-lg px-2.5 py-1.5 text-xs font-bold focus:outline-none"
                    >
                      {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 18, 24, 36].map((n) => (
                        <option key={n} value={n}>
                          {n}x {valor && modoValorParcela === 'total' && !isNaN(parseFloat(valor)) ? `de R$ ${(parseFloat(valor) / n).toFixed(2)}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider block mb-1">
                      O valor digitado é:
                    </label>
                    <select
                      value={modoValorParcela}
                      onChange={(e) => setModoValorParcela(e.target.value as 'total' | 'parcela')}
                      className="w-full bg-white dark:bg-[#252530] border border-amber-200 dark:border-amber-800/50 text-zinc-900 dark:text-white rounded-lg px-2 py-1.5 text-xs font-semibold focus:outline-none"
                    >
                      <option value="total">Valor Total da Compra</option>
                      <option value="parcela">Valor de Cada Parcela</option>
                    </select>
                  </div>
                </div>

                {/* Explanatory Rule Preview */}
                <div className="pt-2 border-t border-amber-200/60 dark:border-[#4C4E5D]/50 text-[11px] space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold">
                    <span className={`w-2 h-2 rounded-full ${isAfterClosing ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                    <span className={isAfterClosing ? 'text-amber-800 dark:text-amber-300' : 'text-emerald-800 dark:text-emerald-300'}>
                      {isAfterClosing
                        ? `Compra no dia ${dayNumber} (após o fechamento dia ${closingDay}):`
                        : `Compra no dia ${dayNumber} (antes do fechamento dia ${closingDay}):`}
                    </span>
                  </div>
                  <p className="text-zinc-600 dark:text-zinc-300 text-[10px] leading-relaxed">
                    {isAfterClosing ? (
                      <>
                        Como a compra é após o dia {closingDay}, a fatura deste mês já fechou. A <strong>1ª parcela (1/{numParcelas})</strong> de <strong>R$ {valParcela.toFixed(2)}</strong> contará na <strong>fatura do mês seguinte ({firstBill})</strong> e a última em <strong>{lastBill}</strong>.
                      </>
                    ) : (
                      <>
                        A <strong>1ª parcela (1/{numParcelas})</strong> de <strong>R$ {valParcela.toFixed(2)}</strong> entrará na <strong>fatura atual ({firstBill})</strong> e a última em <strong>{lastBill}</strong>.
                      </>
                    )}
                  </p>
                </div>
              </div>
            )}

            {tipoGasto === 'fixo' && (
              <div className="space-y-1.5 p-2.5 bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200/70 dark:border-purple-800/40 rounded-xl">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold text-purple-800 dark:text-purple-300 uppercase tracking-wider block">
                    Mês Limite (Opcional)
                  </label>
                  {validadeFixo && (
                    <button
                      type="button"
                      onClick={() => setValidadeFixo('')}
                      className="text-[10px] text-purple-600 dark:text-purple-400 hover:underline cursor-pointer font-bold"
                    >
                      Remover limite
                    </button>
                  )}
                </div>
                <input
                  type="month"
                  value={validadeFixo}
                  onChange={(e) => setValidadeFixo(e.target.value)}
                  className="w-full bg-white dark:bg-[#252530] border border-purple-200 dark:border-purple-800/60 text-zinc-900 dark:text-white rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-purple-400 font-medium"
                />
                <p className="text-[10px] text-purple-700/80 dark:text-purple-300/80 leading-tight">
                  {validadeFixo
                    ? `Será lançado até ${validadeFixo.split('-')[1]}/${validadeFixo.split('-')[0]}.`
                    : 'Sem data limite: o sistema gerará este gasto no início de cada mês automaticamente até você desativar.'}
                </p>
              </div>
            )}
          </>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className={`w-full text-white text-xs font-bold py-2.5 rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 ${
            isSubmitting ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer active:scale-[0.98]'
          } ${
            modo === 'despesa'
              ? 'bg-rose-600 hover:bg-rose-700'
              : 'bg-emerald-600 hover:bg-emerald-700'
          }`}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Registrando...</span>
            </>
          ) : (
            <>
              <PlusCircle className="w-4 h-4" />
              <span>{modo === 'despesa' ? 'Adicionar Despesa' : 'Adicionar Receita'}</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
};
