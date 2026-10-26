import React from 'react';
import { Landmark, CreditCard, Check, X, Edit3, Sparkles, BellRing, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { PendingSuggestion } from '../types';

interface BankNotificationBannerProps {
  suggestions: PendingSuggestion[];
  onApprove: (suggestion: PendingSuggestion) => void;
  onEdit: (suggestion: PendingSuggestion) => void;
  onDismiss: (suggestion: PendingSuggestion) => void;
  onOpenMacroDroidModal: () => void;
}

export const BankNotificationBanner: React.FC<BankNotificationBannerProps> = ({
  suggestions,
  onApprove,
  onEdit,
  onDismiss,
  onOpenMacroDroidModal
}) => {
  if (!suggestions || suggestions.length === 0) return null;

  const current = suggestions[0];
  const count = suggestions.length;

  const formatCurrency = (val: number) => {
    return `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const isIncome = current.tipoItem === 'receita';

  return (
    <div className="relative overflow-hidden bg-gradient-to-r from-amber-550/15 via-emerald-500/10 to-teal-500/15 dark:from-[#32323F] dark:via-[#2a2a36] dark:to-[#32323F] border border-amber-500/30 dark:border-amber-500/40 rounded-2xl p-4 shadow-sm backdrop-blur-xs transition-all animate-fade-in mb-5">
      {/* Glow effect bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-emerald-400 to-teal-400" />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left: Info */}
        <div className="flex items-start gap-3.5 min-w-0">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
            isIncome
              ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400'
              : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
          }`}>
            {isIncome ? <ArrowUpCircle className="w-5 h-5" /> : <CreditCard className="w-5 h-5" />}
          </div>

          <div className="min-w-0 space-y-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-500/15 dark:bg-amber-500/25 text-amber-800 dark:text-amber-300 uppercase tracking-wider flex items-center gap-1">
                <BellRing className="w-3 h-3 animate-pulse" />
                Notificação Bancária Detectada
              </span>
              <span className="text-[11px] font-bold text-zinc-600 dark:text-[#BCABA8]">
                {current.banco}
              </span>
              {count > 1 && (
                <span className="text-[10px] bg-zinc-200/80 dark:bg-[#4C4E5D] text-zinc-700 dark:text-[#DDD5D0] px-1.5 py-0.2 rounded-md font-bold">
                  + {count - 1} pendente{count - 1 > 1 ? 's' : ''}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-[#DDD5D0] truncate max-w-[280px] sm:max-w-md">
                {current.descricao}
              </h3>
              <span className={`text-sm font-black font-mono ${
                isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
              }`}>
                {isIncome ? '+' : '-'}{formatCurrency(current.valor)}
              </span>
            </div>

            <p className="text-xs text-zinc-500 dark:text-[#988E96] flex items-center gap-2 flex-wrap">
              <span>Categoria sugerida: <strong className="text-zinc-700 dark:text-[#DDD5D0] font-semibold">{current.categoria}</strong></span>
              <span>•</span>
              <span className="truncate max-w-[260px] italic opacity-85">"{current.rawText}"</span>
            </p>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 self-end md:self-center shrink-0">
          <button
            onClick={() => onApprove(current)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
            title="Aprovar e lançar automaticamente no extrato"
          >
            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Aprovar Lançamento</span>
          </button>

          <button
            onClick={() => onEdit(current)}
            className="flex items-center gap-1.5 px-3 py-2 bg-zinc-100 dark:bg-[#4C4E5D]/50 hover:bg-zinc-200 dark:hover:bg-[#4C4E5D] text-zinc-700 dark:text-[#DDD5D0] rounded-xl text-xs font-semibold transition-all cursor-pointer active:scale-95 border border-zinc-200/80 dark:border-transparent"
            title="Ajustar dados antes de lançar"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Ajustar</span>
          </button>

          <button
            onClick={() => onDismiss(current)}
            className="p-2 rounded-xl text-zinc-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
            title="Descartar notificação"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
