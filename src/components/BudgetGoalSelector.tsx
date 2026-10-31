import React from 'react';
import { SlidersHorizontal, RotateCcw, CheckCircle2, AlertCircle, Sparkles, TrendingUp, HeartHandshake, ShieldCheck } from 'lucide-react';
import { BudgetRuleConfig, DEFAULT_BUDGET_CONFIG } from '../types';

interface BudgetGoalSelectorProps {
  budgetConfig: BudgetRuleConfig;
  onUpdateBudgetConfig: (newConfig: BudgetRuleConfig) => void;
  monthlyIncome: number;
}

const PRESETS: Array<{
  name: string;
  config: BudgetRuleConfig;
  description: string;
}> = [
  {
    name: 'Padrão (50 / 30 / 20)',
    config: { needsPct: 50, wantsPct: 30, savingsPct: 20 },
    description: 'Equilíbrio clássico entre despesas, estilo de vida e futuro.'
  },
  {
    name: 'Foco Investidor (50 / 20 / 30)',
    config: { needsPct: 50, wantsPct: 20, savingsPct: 30 },
    description: 'Acelera a reserva de emergência e liberdade financeira.'
  },
  {
    name: 'Essencial (60 / 20 / 20)',
    config: { needsPct: 60, wantsPct: 20, savingsPct: 20 },
    description: 'Ideal para momentos com custos fixos ou moradia mais altos.'
  },
  {
    name: 'Agressivo / FIRE (40 / 20 / 40)',
    config: { needsPct: 40, wantsPct: 20, savingsPct: 40 },
    description: 'Construção massiva de patrimônio e investimentos rápidos.'
  }
];

export function BudgetGoalSelector({
  budgetConfig,
  onUpdateBudgetConfig,
  monthlyIncome
}: BudgetGoalSelectorProps) {
  const { needsPct, wantsPct, savingsPct } = budgetConfig;
  const total = needsPct + wantsPct + savingsPct;
  const is100 = total === 100;
  const incomeBase = monthlyIncome > 0 ? monthlyIncome : 5000;

  const handleChange = (key: keyof BudgetRuleConfig, value: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(value)));
    onUpdateBudgetConfig({
      ...budgetConfig,
      [key]: clamped
    });
  };

  const handleAdjust = (key: keyof BudgetRuleConfig, delta: number) => {
    const current = budgetConfig[key];
    handleChange(key, current + delta);
  };

  const handleReset = () => {
    onUpdateBudgetConfig(DEFAULT_BUDGET_CONFIG);
  };

  const handleNormalize = () => {
    if (total === 0) {
      onUpdateBudgetConfig(DEFAULT_BUDGET_CONFIG);
      return;
    }
    const factor = 100 / total;
    const newNeeds = Math.round(needsPct * factor);
    const newWants = Math.round(wantsPct * factor);
    const newSavings = 100 - newNeeds - newWants;
    onUpdateBudgetConfig({
      needsPct: Math.max(0, newNeeds),
      wantsPct: Math.max(0, newWants),
      savingsPct: Math.max(0, newSavings)
    });
  };

  const isPresetActive = (p: BudgetRuleConfig) =>
    p.needsPct === needsPct && p.wantsPct === wantsPct && p.savingsPct === savingsPct;

  return (
    <div className="bg-white dark:bg-[#32323F] rounded-2xl p-4 sm:p-5 border border-zinc-200/80 dark:border-[#4C4E5D]/60 shadow-xs space-y-4">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-150 dark:border-[#4C4E5D]/60 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <SlidersHorizontal className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                Personalizar Meta de Renda
              </h3>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-900/40">
                {needsPct}% / {wantsPct}% / {savingsPct}%
              </span>
            </div>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">
              Defina a alocação de receita ideal para Necessidades, Lazer e Investimentos
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold text-zinc-600 dark:text-zinc-300 bg-zinc-100 hover:bg-zinc-200 dark:bg-[#252530] dark:hover:bg-[#4C4E5D]/60 transition-colors cursor-pointer"
            title="Restaurar padrão clássico 50-30-20"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Restaurar 50-30-20</span>
          </button>
        </div>
      </div>

      {/* Preset Quick Buttons */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[9px] uppercase font-bold text-zinc-400 dark:text-zinc-500 mr-1 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-amber-500" /> Modelos:
        </span>
        {PRESETS.map((preset) => {
          const active = isPresetActive(preset.config);
          return (
            <button
              key={preset.name}
              type="button"
              onClick={() => onUpdateBudgetConfig(preset.config)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                active
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-zinc-100 dark:bg-[#252530] text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-[#4C4E5D]/50 border border-zinc-200/60 dark:border-[#4C4E5D]/40'
              }`}
              title={preset.description}
            >
              {preset.name}
            </button>
          );
        })}
      </div>

      {/* Distribution Stacked Bar */}
      <div className="space-y-1.5">
        <div className="h-3 w-full bg-zinc-100 dark:bg-[#252530] rounded-full overflow-hidden flex shadow-inner">
          <div
            className="bg-blue-500 transition-all duration-300"
            style={{ width: `${Math.min(100, needsPct)}%` }}
            title={`Necessidades: ${needsPct}%`}
          />
          <div
            className="bg-purple-500 transition-all duration-300"
            style={{ width: `${Math.min(100 - needsPct, wantsPct)}%` }}
            title={`Lazer & Desejos: ${wantsPct}%`}
          />
          <div
            className="bg-emerald-500 transition-all duration-300"
            style={{ width: `${Math.min(100 - needsPct - wantsPct, savingsPct)}%` }}
            title={`Investimentos: ${savingsPct}%`}
          />
        </div>

        {/* Dynamic Total Validation Bar */}
        <div className="flex items-center justify-between text-[10px]">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-bold">
              <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> Necessidades: {needsPct}%
            </span>
            <span className="flex items-center gap-1 text-purple-600 dark:text-purple-400 font-bold">
              <span className="w-2 h-2 rounded-full bg-purple-500 inline-block" /> Lazer: {wantsPct}%
            </span>
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Investimentos: {savingsPct}%
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {is100 ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Total: 100%
              </span>
            ) : (
              <div className="flex items-center gap-1.5">
                <span className={`font-bold flex items-center gap-1 ${total > 100 ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'}`}>
                  <AlertCircle className="w-3.5 h-3.5" />
                  Total: {total}% {total > 100 ? `(+${total - 100}%)` : `(restam ${100 - total}%)`}
                </span>
                <button
                  type="button"
                  onClick={handleNormalize}
                  className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 hover:bg-amber-200 transition-colors cursor-pointer"
                >
                  Ajustar p/ 100%
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3 Interactive Cards with Sliders and Steppers */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
        {/* 1. Necessidades */}
        <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-[#252530] border border-zinc-200/80 dark:border-[#4C4E5D]/60 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-blue-500" />
              <div>
                <span className="text-[10px] font-black text-zinc-900 dark:text-white uppercase tracking-wider block leading-none">
                  Necessidades
                </span>
                <span className="text-[8.5px] text-zinc-400 dark:text-zinc-500">
                  Moradia, contas, saúde, alimentação
                </span>
              </div>
            </div>
            <span className="text-sm font-black font-mono text-blue-600 dark:text-blue-400">
              {needsPct}%
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleAdjust('needsPct', -5)}
              className="w-6 h-6 rounded-lg bg-white dark:bg-[#32323F] border border-zinc-200/80 dark:border-[#4C4E5D]/60 text-zinc-700 dark:text-zinc-200 font-bold text-xs flex items-center justify-center hover:bg-zinc-100 cursor-pointer"
              title="Diminuir 5%"
            >
              -
            </button>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={needsPct}
              onChange={(e) => handleChange('needsPct', parseFloat(e.target.value))}
              className="flex-1 accent-blue-600 cursor-pointer h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-lg"
            />
            <button
              type="button"
              onClick={() => handleAdjust('needsPct', 5)}
              className="w-6 h-6 rounded-lg bg-white dark:bg-[#32323F] border border-zinc-200/80 dark:border-[#4C4E5D]/60 text-zinc-700 dark:text-zinc-200 font-bold text-xs flex items-center justify-center hover:bg-zinc-100 cursor-pointer"
              title="Aumentar 5%"
            >
              +
            </button>
          </div>

          <div className="flex items-center justify-between text-[9px] pt-1 border-t border-zinc-200/60 dark:border-[#4C4E5D]/40 text-zinc-500 dark:text-zinc-400">
            <span>Teto estimado:</span>
            <span className="font-bold font-mono text-zinc-800 dark:text-zinc-200">
              R$ {((incomeBase * needsPct) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* 2. Lazer e Desejos */}
        <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-[#252530] border border-zinc-200/80 dark:border-[#4C4E5D]/60 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <HeartHandshake className="w-4 h-4 text-purple-500" />
              <div>
                <span className="text-[10px] font-black text-zinc-900 dark:text-white uppercase tracking-wider block leading-none">
                  Lazer & Desejos
                </span>
                <span className="text-[8.5px] text-zinc-400 dark:text-zinc-500">
                  Estilo de vida, restaurantes, hobbies
                </span>
              </div>
            </div>
            <span className="text-sm font-black font-mono text-purple-600 dark:text-purple-400">
              {wantsPct}%
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleAdjust('wantsPct', -5)}
              className="w-6 h-6 rounded-lg bg-white dark:bg-[#32323F] border border-zinc-200/80 dark:border-[#4C4E5D]/60 text-zinc-700 dark:text-zinc-200 font-bold text-xs flex items-center justify-center hover:bg-zinc-100 cursor-pointer"
              title="Diminuir 5%"
            >
              -
            </button>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={wantsPct}
              onChange={(e) => handleChange('wantsPct', parseFloat(e.target.value))}
              className="flex-1 accent-purple-600 cursor-pointer h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-lg"
            />
            <button
              type="button"
              onClick={() => handleAdjust('wantsPct', 5)}
              className="w-6 h-6 rounded-lg bg-white dark:bg-[#32323F] border border-zinc-200/80 dark:border-[#4C4E5D]/60 text-zinc-700 dark:text-zinc-200 font-bold text-xs flex items-center justify-center hover:bg-zinc-100 cursor-pointer"
              title="Aumentar 5%"
            >
              +
            </button>
          </div>

          <div className="flex items-center justify-between text-[9px] pt-1 border-t border-zinc-200/60 dark:border-[#4C4E5D]/40 text-zinc-500 dark:text-zinc-400">
            <span>Teto estimado:</span>
            <span className="font-bold font-mono text-zinc-800 dark:text-zinc-200">
              R$ {((incomeBase * wantsPct) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* 3. Investimentos e Poupança */}
        <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-[#252530] border border-zinc-200/80 dark:border-[#4C4E5D]/60 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              <div>
                <span className="text-[10px] font-black text-zinc-900 dark:text-white uppercase tracking-wider block leading-none">
                  Investimentos
                </span>
                <span className="text-[8.5px] text-zinc-400 dark:text-zinc-500">
                  Reserva, aportes, metas e futuro
                </span>
              </div>
            </div>
            <span className="text-sm font-black font-mono text-emerald-600 dark:text-emerald-400">
              {savingsPct}%
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleAdjust('savingsPct', -5)}
              className="w-6 h-6 rounded-lg bg-white dark:bg-[#32323F] border border-zinc-200/80 dark:border-[#4C4E5D]/60 text-zinc-700 dark:text-zinc-200 font-bold text-xs flex items-center justify-center hover:bg-zinc-100 cursor-pointer"
              title="Diminuir 5%"
            >
              -
            </button>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={savingsPct}
              onChange={(e) => handleChange('savingsPct', parseFloat(e.target.value))}
              className="flex-1 accent-emerald-600 cursor-pointer h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-lg"
            />
            <button
              type="button"
              onClick={() => handleAdjust('savingsPct', 5)}
              className="w-6 h-6 rounded-lg bg-white dark:bg-[#32323F] border border-zinc-200/80 dark:border-[#4C4E5D]/60 text-zinc-700 dark:text-zinc-200 font-bold text-xs flex items-center justify-center hover:bg-zinc-100 cursor-pointer"
              title="Aumentar 5%"
            >
              +
            </button>
          </div>

          <div className="flex items-center justify-between text-[9px] pt-1 border-t border-zinc-200/60 dark:border-[#4C4E5D]/40 text-zinc-500 dark:text-zinc-400">
            <span>Alvo estimado:</span>
            <span className="font-bold font-mono text-zinc-800 dark:text-zinc-200">
              R$ {((incomeBase * savingsPct) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
