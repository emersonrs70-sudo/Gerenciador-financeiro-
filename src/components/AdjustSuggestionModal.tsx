import React, { useState, useEffect } from 'react';
import { X, Check, Trash2, Edit3, CreditCard, Sparkles, AlertCircle } from 'lucide-react';
import { BankAccount, PendingSuggestion, getBillMonthForDate, getInstallmentBillMonth, getInstallmentTransactionDate } from '../types';

interface AdjustSuggestionModalProps {
  isOpen: boolean;
  suggestion: PendingSuggestion | null;
  onClose: () => void;
  onSave: (adjusted: {
    descricao: string;
    valor: number;
    data: string;
    categoria: string;
    tipoItem: 'despesa' | 'receita';
    accountId: string;
    faturaMes?: string;
    parcelas?: number;
  }) => Promise<void>;
  onDismiss: (suggestionId: string) => void;
  accounts: BankAccount[];
  categoriasDespesa: string[];
  categoriasReceita: string[];
}

export const AdjustSuggestionModal: React.FC<AdjustSuggestionModalProps> = ({
  isOpen,
  suggestion,
  onClose,
  onSave,
  onDismiss,
  accounts,
  categoriasDespesa,
  categoriasReceita
}) => {
  if (!isOpen || !suggestion) return null;

  const [tipoItem, setTipoItem] = useState<'despesa' | 'receita'>(suggestion.tipoItem || 'despesa');
  const [descricao, setDescricao] = useState(suggestion.descricao || '');
  const [valor, setValor] = useState(suggestion.valor ? suggestion.valor.toString() : '');
  const [data, setData] = useState(suggestion.data || new Date().toISOString().split('T')[0]);
  const [accountId, setAccountId] = useState(suggestion.accountId || accounts[0]?.id || 'santander');
  const [categoria, setCategoria] = useState(suggestion.categoria || 'Outros');
  const [parcelas, setParcelas] = useState<number>(suggestion.parcelas || 1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync state whenever suggestion prop updates
  useEffect(() => {
    if (suggestion) {
      setTipoItem(suggestion.tipoItem || 'despesa');
      setDescricao(suggestion.descricao || '');
      setValor(suggestion.valor ? suggestion.valor.toString() : '');
      setData(suggestion.data || new Date().toISOString().split('T')[0]);
      setAccountId(suggestion.accountId || accounts[0]?.id || 'santander');
      setCategoria(suggestion.categoria || 'Outros');
      setParcelas(suggestion.parcelas || 1);
    }
  }, [suggestion, accounts]);

  const activeCategories = tipoItem === 'despesa' ? categoriasDespesa : categoriasReceita;
  const currentAccount = accounts.find(a => a.id === accountId);
  const isCreditCard = currentAccount?.tipo === 'credito';

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const numValor = parseFloat(valor);
    if (!descricao.trim() || isNaN(numValor) || numValor <= 0 || !data) {
      return;
    }

    setIsSubmitting(true);
    try {
      const closingDay = currentAccount?.diaFechamento || 5;
      const faturaMes = isCreditCard ? getBillMonthForDate(data, closingDay) : undefined;

      await onSave({
        descricao: descricao.trim(),
        valor: numValor,
        data,
        categoria: categoria || 'Outros',
        tipoItem,
        accountId,
        faturaMes,
        parcelas: isCreditCard && parcelas > 1 ? parcelas : undefined
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDismiss = () => {
    onDismiss(suggestion.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-fade-in">
      <div className="bg-white dark:bg-[#32323F] border border-zinc-200/80 dark:border-[#4C4E5D]/60 rounded-3xl w-full max-w-lg max-h-[92vh] overflow-y-auto shadow-2xl flex flex-col relative animate-scale-up">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-200/80 dark:border-[#4C4E5D]/60 sticky top-0 bg-white/95 dark:bg-[#32323F]/95 backdrop-blur-sm z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-zinc-900 dark:text-[#DDD5D0] tracking-tight">
                Ajustar Transação Detectada
              </h2>
              <p className="text-xs text-zinc-500 dark:text-[#988E96]">
                Notificação recebida de {suggestion.banco}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-[#DDD5D0] hover:bg-zinc-100 dark:hover:bg-[#4C4E5D]/40 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-5 space-y-4 text-xs">
          {/* Original notification snippet */}
          <div className="p-3 rounded-xl bg-zinc-50 dark:bg-[#252530] border border-zinc-200/70 dark:border-[#4C4E5D]/40">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-0.5">
              Texto Original da Notificação
            </span>
            <p className="text-[11px] text-zinc-600 dark:text-zinc-300 italic font-mono break-words">
              "{suggestion.rawText}"
            </p>
          </div>

          {/* Toggle Despesa vs Receita */}
          <div>
            <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block mb-1">
              Tipo de Transação
            </label>
            <div className="flex bg-zinc-100 dark:bg-[#252530] p-1 rounded-xl border border-zinc-200/80 dark:border-[#4C4E5D]/50">
              <button
                type="button"
                onClick={() => setTipoItem('despesa')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  tipoItem === 'despesa'
                    ? 'bg-white dark:bg-[#4C4E5D] text-rose-600 dark:text-rose-400 shadow-xs'
                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800'
                }`}
              >
                Despesa (Saída / Pix Enviado / Compra)
              </button>
              <button
                type="button"
                onClick={() => setTipoItem('receita')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  tipoItem === 'receita'
                    ? 'bg-white dark:bg-[#4C4E5D] text-emerald-600 dark:text-emerald-400 shadow-xs'
                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800'
                }`}
              >
                Receita (Entrada / Pix Recebido)
              </button>
            </div>
          </div>

          {/* Descrição */}
          <div>
            <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block mb-1">
              Descrição
            </label>
            <input
              type="text"
              required
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex: Pix para João, Supermercado, etc."
              className="w-full bg-zinc-50 dark:bg-[#252530] border border-zinc-200/80 dark:border-[#4C4E5D]/60 text-zinc-900 dark:text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/30 font-medium"
            />
          </div>

          {/* Valor e Data */}
          <div className="grid grid-cols-2 gap-3">
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
                className="w-full bg-zinc-50 dark:bg-[#252530] border border-zinc-200/80 dark:border-[#4C4E5D]/60 text-zinc-900 dark:text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/30 font-mono font-bold"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block mb-1">
                Data
              </label>
              <input
                type="date"
                required
                value={data}
                onChange={(e) => setData(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-[#252530] border border-zinc-200/80 dark:border-[#4C4E5D]/60 text-zinc-900 dark:text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/30 font-medium"
              />
            </div>
          </div>

          {/* Conta / Cartão */}
          <div>
            <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block mb-1">
              Conta de Destino / Cartão
            </label>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="w-full bg-zinc-50 dark:bg-[#252530] border border-zinc-200/80 dark:border-[#4C4E5D]/60 text-zinc-900 dark:text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/30 font-medium"
            >
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.nome} ({acc.tipo === 'credito' ? `Cartão • Fechamento dia ${acc.diaFechamento || 5}` : 'Conta Corrente / Carteira'})
                </option>
              ))}
            </select>
          </div>

          {/* Categoria */}
          <div>
            <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block mb-1">
              Categoria
            </label>
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className="w-full bg-zinc-50 dark:bg-[#252530] border border-zinc-200/80 dark:border-[#4C4E5D]/60 text-zinc-900 dark:text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/30 font-medium"
            >
              {activeCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Parcelamento para Cartão de Crédito */}
          {isCreditCard && tipoItem === 'despesa' && (
            <div className="p-3 bg-amber-50/70 dark:bg-[#2a2a36] border border-amber-200/80 dark:border-amber-500/30 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  Compra Parcelada no Cartão?
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-800 dark:text-amber-300">
                  Fechamento: dia {currentAccount?.diaFechamento || 5}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400 uppercase">
                  Parcelas:
                </label>
                <select
                  value={parcelas}
                  onChange={(e) => setParcelas(parseInt(e.target.value, 10))}
                  className="bg-white dark:bg-[#252530] border border-amber-200 dark:border-amber-800/50 text-zinc-900 dark:text-white rounded-lg px-2.5 py-1 text-xs font-bold"
                >
                  <option value={1}>1x (À vista na fatura)</option>
                  {[2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 18, 24].map((n) => (
                    <option key={n} value={n}>
                      {n}x de R$ {(parseFloat(valor || '0') / n).toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>

              {parcelas > 1 && (
                <p className="text-[10px] text-zinc-600 dark:text-zinc-300 leading-tight pt-1">
                  💡 A 1ª parcela entrará na fatura de <strong>{getInstallmentBillMonth(data, 0, currentAccount?.diaFechamento || 5)}</strong> e a última em <strong>{getInstallmentBillMonth(data, parcelas - 1, currentAccount?.diaFechamento || 5)}</strong>.
                </p>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-3 border-t border-zinc-200/80 dark:border-[#4C4E5D]/60 gap-2">
            <button
              type="button"
              onClick={handleDismiss}
              className="px-3.5 py-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Descartar</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-[#4C4E5D]/50 dark:hover:bg-[#4C4E5D] text-zinc-700 dark:text-[#DDD5D0] rounded-xl text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95"
              >
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>{isSubmitting ? 'Salvando...' : 'Salvar e Lançar'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
