import React, { useState } from 'react';
import { Flame, CheckCircle2, Award, X } from 'lucide-react';

interface NudgeBannerProps {
  streak: number;
  registrouHoje: boolean;
}

export const NudgeBanner: React.FC<NudgeBannerProps> = ({ streak, registrouHoje }) => {
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      return localStorage.getItem(`nudge_banner_dismissed_${todayStr}`) === 'true';
    } catch {
      return false;
    }
  });

  if (dismissed) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      localStorage.setItem(`nudge_banner_dismissed_${todayStr}`, 'true');
    } catch {
      // ignore localStorage errors
    }
  };

  return (
    <div
      id="status-geral-banner"
      className={`relative p-2.5 sm:p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-all pr-8 ${
        !registrouHoje
          ? 'bg-amber-50/60 border-amber-200/80 dark:bg-amber-950/15 dark:border-amber-900/30'
          : 'bg-emerald-50/50 border-emerald-200/80 dark:bg-emerald-950/10 dark:border-emerald-900/30'
      }`}
    >
      <div className="flex items-center gap-2.5">
        <div
          className={`p-1.5 rounded-lg shrink-0 ${
            !registrouHoje
              ? 'bg-amber-100/80 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
              : 'bg-emerald-100/80 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
          }`}
        >
          {!registrouHoje ? (
            <Flame className="w-4.5 h-4.5" />
          ) : (
            <CheckCircle2 className="w-4.5 h-4.5" />
          )}
        </div>
        <div>
          <h3
            className={`text-xs sm:text-sm font-bold tracking-tight flex items-center gap-1.5 ${
              !registrouHoje
                ? 'text-amber-900 dark:text-amber-300'
                : 'text-emerald-900 dark:text-emerald-300'
            }`}
          >
            {!registrouHoje ? 'Mantenha sua sequência diária ativa' : 'Registros do dia em dia'}
          </h3>
          <p
            className={`text-xs mt-0.5 leading-relaxed ${
              !registrouHoje
                ? 'text-amber-800/80 dark:text-amber-400/90'
                : 'text-emerald-800/80 dark:text-emerald-400/90'
            }`}
          >
            {!registrouHoje
              ? streak > 0
                ? `Você ainda não lançou transações hoje. Registre uma receita ou despesa para manter o streak de ${streak} ${streak === 1 ? 'dia' : 'dias'}.`
                : `Registre sua primeira movimentação hoje para iniciar seu histórico financeiro contínuo.`
              : `Sequência de ${streak} ${streak === 1 ? 'dia' : 'dias'} mantida com sucesso hoje.`}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 self-end sm:self-center">
        {streak >= 3 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 rounded-lg text-[10px] font-bold tracking-wide">
            <Award className="w-3.5 h-3.5" />
            <span>{streak} Dias Ativo</span>
          </div>
        )}
      </div>

      {/* Dismiss button */}
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 p-1 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
        title="Fechar notificação"
        aria-label="Fechar notificação"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
