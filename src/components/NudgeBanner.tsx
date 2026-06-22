import React from 'react';
import { Flame, CheckCircle2, Award } from 'lucide-react';

interface NudgeBannerProps {
  streak: number;
  registrouHoje: boolean;
}

export const NudgeBanner: React.FC<NudgeBannerProps> = ({ streak, registrouHoje }) => {
  return (
    <div
      id="status-geral-banner"
      className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs transition-all duration-300 ${
        !registrouHoje
          ? 'bg-amber-50/70 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900/30'
          : 'bg-emerald-50/70 border-emerald-200 dark:bg-emerald-950/10 dark:border-emerald-900/30'
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`p-2 rounded-xl mt-0.5 ${
            !registrouHoje
              ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400'
              : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400'
          }`}
        >
          {!registrouHoje ? (
            <Flame className={`w-5 h-5 ${streak > 0 ? 'animate-bounce' : ''}`} />
          ) : (
            <CheckCircle2 className="w-5 h-5" />
          )}
        </div>
        <div>
          <h3
            className={`text-sm font-bold tracking-tight flex items-center gap-1.5 ${
              !registrouHoje
                ? 'text-amber-800 dark:text-amber-350'
                : 'text-emerald-800 dark:text-emerald-350'
            }`}
          >
            {!registrouHoje ? 'Proteja sua sequência diária!' : 'Tudo sob controle!'}
          </h3>
          <p
            className={`text-xs mt-1 leading-relaxed ${
              !registrouHoje
                ? 'text-amber-700/80 dark:text-amber-450'
                : 'text-emerald-700/80 dark:text-emerald-400'
            }`}
          >
            {!registrouHoje
              ? streak > 0
                ? `Você ainda não registrou lançamentos hoje. Adicione um gasto ou receita para assegurar sua sequência de ${streak} ${streak === 1 ? 'dia' : 'dias'}!`
                : `Seu hábito financeiro começa hoje. Adicione sua primeira transação do dia para ativar sua chama!`
              : `Sequência de ${streak} ${streak === 1 ? 'dia' : 'dias'} garantida hoje. Excelente rotina de controle orçamentário!`}
          </p>
        </div>
      </div>
      {streak >= 3 && (
        <div className="flex items-center gap-1 self-end sm:self-center px-2.5 py-1 bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 rounded-full text-[10px] font-black uppercase tracking-wider">
          <Award className="w-3.5 h-3.5" />
          <span>Foco Ativo</span>
        </div>
      )}
    </div>
  );
};
