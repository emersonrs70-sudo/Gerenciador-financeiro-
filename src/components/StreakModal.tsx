import React from 'react';
import { Flame, Trophy, Shield, Award, X, Check, Lock, ArrowUpCircle, ArrowDownCircle, ChevronRight, HelpCircle } from 'lucide-react';
import { Transaction } from '../types';

interface StreakModalProps {
  isOpen: boolean;
  onClose: () => void;
  streak: number;
  transactions: Transaction[];
}

interface LevelConfig {
  level: number;
  name: string;
  badgeColor: string;
  iconColor: string;
  emoji: string;
  description: string;
  minDays: number;
  perk: string;
}

const levels: LevelConfig[] = [
  { 
    level: 1, 
    name: 'Aprendiz das Finanças', 
    badgeColor: 'bg-amber-100/40 border border-amber-250 text-amber-700 dark:bg-amber-950/20 dark:border-amber-900/40 dark:text-amber-400', 
    iconColor: 'text-amber-500 dark:text-amber-400', 
    emoji: '🥉', 
    description: 'Parabéns pelos primeiros passos! Você começou a rotinarização dos seus lançamentos.',
    minDays: 0,
    perk: 'Medalha Bronze e Painel de Controle habilitado.'
  },
  { 
    level: 2, 
    name: 'Sentinela das Contas', 
    badgeColor: 'bg-emerald-50 dark:bg-emerald-950/15 border border-emerald-200 dark:border-emerald-900/30 text-emerald-600 dark:text-emerald-400', 
    iconColor: 'text-emerald-500 dark:text-emerald-400', 
    emoji: '🥈', 
    description: 'Sequência ativa magnífica! Suas despesas diárias estão sob vigilância intensa.',
    minDays: 3,
    perk: 'Medalha Prata e Análise de Consumo Mapeado.'
  },
  { 
    level: 3, 
    name: 'Mestre do Orçamento', 
    badgeColor: 'bg-blue-50 dark:bg-blue-950/15 border border-blue-200 dark:border-blue-900/30 text-blue-600 dark:text-blue-400', 
    iconColor: 'text-blue-500 dark:text-blue-400', 
    emoji: '🥇', 
    description: 'Cinco dias seguidos sem negligenciar! Você domina o fluxo do seu próprio dinheiro.',
    minDays: 5,
    perk: 'Medalha Ouro e Relatórios Avançados com AI.'
  },
  { 
    level: 4, 
    name: 'Guardião do Saldo', 
    badgeColor: 'bg-teal-50 dark:bg-teal-950/15 border border-teal-250 dark:border-teal-900/35 text-teal-600 dark:text-teal-400', 
    iconColor: 'text-teal-500 dark:text-teal-400', 
    emoji: '🛡️', 
    description: 'Dez dias consecutivos! Sua postura firme evita gastos por impulso e assegura o acúmulo real.',
    minDays: 10,
    perk: 'Escudo de Platina e Oráculo AI Conselheiro Personalizado.'
  },
  { 
    level: 5, 
    name: 'Titã da Disciplina', 
    badgeColor: 'bg-indigo-50 dark:bg-indigo-950/15 border border-indigo-250 dark:border-indigo-900/35 text-indigo-600 dark:text-indigo-400', 
    iconColor: 'text-indigo-500 dark:text-indigo-400', 
    emoji: '👑', 
    description: 'Vinte dias sem interrupções! Você é um exemplo vivo de disciplina orçamentária.',
    minDays: 20,
    perk: 'Coroa Elite de Consistência e Selo Premium.'
  },
  { 
    level: 6, 
    name: 'Soberano das Finanças', 
    badgeColor: 'bg-purple-100 dark:bg-purple-950/20 border border-purple-250 dark:border-purple-900/35 text-purple-700 dark:text-purple-400', 
    iconColor: 'text-purple-600 dark:text-purple-400', 
    emoji: '💎', 
    description: 'Cinqüenta dias de ofensiva lendária! Você atingiu o status máximo. Nada desestabiliza suas metas.',
    minDays: 50,
    perk: 'Diamante Cósmico e AI de Alocação de Portfólio.'
  },
];

const milestones = [
  { days: 3, level: 'Sentinela das Contas', reward: 'Medalha de Bronze 🥉', perk: 'Nível 2' },
  { days: 5, level: 'Mestre do Orçamento', reward: 'Medalha de Prata 🥈', perk: 'Nível 3' },
  { days: 10, level: 'Guardião do Saldo', reward: 'Medalha de Ouro 🥇', perk: 'Nível 4' },
  { days: 20, level: 'Titã da Disciplina', reward: 'Escudo Real 🛡️', perk: 'Nível 5' },
  { days: 50, level: 'Soberano das Finanças', reward: 'Diamante Cósmico 💎', perk: 'Nível 6' },
];

export const StreakModal: React.FC<StreakModalProps> = ({ isOpen, onClose, streak, transactions }) => {
  if (!isOpen) return null;

  // Find current level config
  const currentLevel = [...levels].reverse().find(lvl => streak >= lvl.minDays) || levels[0];
  
  // Find next milestones
  const nextMilestone = milestones.find(m => streak < m.days);
  const daysRemaining = nextMilestone ? nextMilestone.days - streak : 0;

  // Calculate standard list of consecutive days programmatically for the current streak
  const getStreakHistory = () => {
    if (streak <= 0) return [];

    const dates = transactions.map((t) => t.data);
    const uniqueSorted = (Array.from(new Set(dates)) as string[]).sort((a, b) => b.localeCompare(a));

    if (uniqueSorted.length === 0) return [];

    const today = new Date();
    const formatLocalDate = (date: Date) => {
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
        date.getDate()
      ).padStart(2, '0')}`;
    };

    const todayStr = formatLocalDate(today);
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const yesterdayStr = formatLocalDate(yesterday);

    // Verify if streak is active starting today or yesterday
    if (uniqueSorted[0] < yesterdayStr && uniqueSorted[0] !== todayStr) {
      return [];
    }

    const streakDates: string[] = [];
    const latestDateStr = uniqueSorted[0];
    const latestDate = new Date(latestDateStr + 'T12:00:00');

    for (let i = 0; i < streak; i++) {
      const d = new Date(latestDate);
      d.setDate(latestDate.getDate() - i);
      const dateStr = formatLocalDate(d);
      streakDates.push(dateStr);
    }

    return streakDates.map(dateStr => {
      const dayTrans = transactions.filter(t => t.data === dateStr);
      const receitasValue = dayTrans.filter(t => t.tipoItem === 'receita').reduce((sum, t) => sum + t.valor, 0);
      const despesasValue = dayTrans.filter(t => t.tipoItem === 'despesa').reduce((sum, t) => sum + t.valor, 0);
      const balance = receitasValue - despesasValue;

      return {
        dateStr,
        transactions: dayTrans,
        receitas: receitasValue,
        despesas: despesasValue,
        balance
      };
    });
  };

  const streakHistory = getStreakHistory();

  const formatDateLabel = (dateStr: string) => {
    const today = new Date();
    const formatLocalDate = (date: Date) => {
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
        date.getDate()
      ).padStart(2, '0')}`;
    };

    const todayStr = formatLocalDate(today);
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const yesterdayStr = formatLocalDate(yesterday);

    if (dateStr === todayStr) return 'Hoje';
    if (dateStr === yesterdayStr) return 'Ontem';

    const parts = dateStr.split('-');
    const dt = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    return dt.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });
  };

  const getDayInsight = (receitas: number, despesas: number, balance: number) => {
    if (receitas > 0 && despesas === 0) return 'Dia focado puramente em expandir ganhos! 🚀';
    if (despesas > 0 && receitas === 0) {
      if (despesas > 150) return 'Gastos importantes mapeados e lançados com responsabilidade. 📊';
      return 'Gastos diários moderados registrados com economia. 💡';
    }
    if (balance > 0) return 'Superávit financeiro! Você guardou mais do que gastou hoje. 🌱';
    if (balance < 0) return 'Controlado! Despesas e receitas devidamente registradas. ⚖️';
    return 'Lançamento financeiro anotado com sucesso para manter a rotina! 🎯';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-3xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl relative animate-scale-up">
        
        {/* CLOSE BUTTON */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-6 md:p-8 space-y-6">
          
          {/* HEADER HERO ACCENT */}
          <div className="bg-gradient-to-tr from-amber-500/10 via-orange-500/10 to-rose-500/10 dark:from-amber-950/30 dark:via-orange-950/20 dark:to-rose-950/20 border border-amber-200/50 dark:border-amber-900/30 p-5 rounded-2xl flex items-center gap-4">
            <div className="p-3.5 bg-amber-500 text-white rounded-2xl shadow-lg shadow-amber-500/20 animate-pulse">
              <Flame className="w-8 h-8 fill-amber-100" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">{streak} {streak === 1 ? 'Dia' : 'Dias'}</span>
                <span className="px-2 py-0.5 text-[10px] uppercase font-extrabold bg-amber-500 text-white rounded-md tracking-wider">Ativo</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Sua sequência de registros e rotina de controle ativo!
              </p>
            </div>
          </div>

          {/* LEVEL BAR AND STATUS CARD */}
          <div className="space-y-4">
            <h4 className="text-xs font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              Nível e Medalha Atual
            </h4>
            <div className={`p-5 rounded-2xl border ${currentLevel.badgeColor} flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all duration-300`}>
              <div className="flex items-center gap-4">
                <span className="text-4xl select-none">{currentLevel.emoji}</span>
                <div>
                  <h5 className="font-extrabold text-slate-800 dark:text-white text-base tracking-tight">
                    {currentLevel.name}
                  </h5>
                  <p className="text-xs mt-1 text-slate-650 dark:text-slate-350 leading-relaxed font-medium">
                    {currentLevel.description}
                  </p>
                </div>
              </div>
              <div className="md:border-l md:border-slate-300/40 dark:md:border-slate-800/40 md:pl-5 flex-shrink-0">
                <span className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-400 tracking-wider">Benefício Liberado:</span>
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-0.5">
                  {currentLevel.perk}
                </p>
              </div>
            </div>
          </div>

          {/* ROADMAP TIMELINE (RÉGUA DE OFENSIVA) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-sans">
                Régua de Metas Orçamentárias
              </h4>
              {nextMilestone && (
                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-black">
                  Faltam {daysRemaining} {daysRemaining === 1 ? 'dia' : 'dias'} para {nextMilestone.reward}
                </span>
              )}
            </div>

            {/* PROGRESS TRACKER BAR */}
            <div className="grid grid-cols-5 gap-2 relative pt-2">
              {milestones.map((milestone) => {
                const isCompleted = streak >= milestone.days;
                return (
                  <div 
                    key={milestone.days} 
                    className={`p-3 rounded-xl border text-center transition-all ${
                      isCompleted 
                        ? 'bg-amber-50/40 dark:bg-amber-950/10 border-amber-250 dark:border-amber-900/65 shadow-2xs hover:-translate-y-0.5' 
                        : 'bg-slate-50/50 dark:bg-slate-950/20 border-slate-200 dark:border-slate-800/50 opacity-60'
                    }`}
                  >
                    <div className="flex justify-center mb-1">
                      {isCompleted ? (
                        <div className="p-1 bg-amber-500 rounded-full text-white">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                      ) : (
                        <div className="p-1 bg-slate-250 dark:bg-slate-800 text-slate-400 dark:text-slate-650 rounded-full">
                          <Lock className="w-3 h-3" />
                        </div>
                      )}
                    </div>
                    <span className="block text-[10px] font-black tracking-tight text-slate-750 dark:text-slate-200">
                      {milestone.days} Dias
                    </span>
                    <span className="block text-[9px] mt-0.5 text-slate-500 dark:text-slate-400 truncate">
                      {milestone.reward.split(' ').pop()} {milestone.level.split(' ')[0]}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* REAL DAY SUMMARY (INFORMATIVO DOS DIAS DE OFENSIVA CLICADO) */}
          <div className="space-y-4 pt-2">
            <h4 className="text-xs font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              Resumo do que foi feito na Sequência
            </h4>
            
            {streakHistory.length === 0 ? (
              <div className="text-center p-6 bg-slate-50 dark:bg-slate-950/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                <HelpCircle className="w-8 h-8 text-slate-400 dark:text-slate-650 mx-auto mb-2" />
                <p className="text-xs font-bold">Nenhuma atividade registrada na ofensiva ainda.</p>
                <p className="text-[11px] mt-1 text-slate-400">Adicione uma receita ou despesa hoje para iniciar!</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                {streakHistory.map((day, ix) => (
                  <div
                    key={day.dateStr}
                    className="p-3.5 bg-slate-50 dark:bg-slate-950/20 border border-slate-200/60 dark:border-slate-800/60 rounded-xl hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col gap-2"
                  >
                    {/* Date and mini-badge */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                        <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                          {formatDateLabel(day.dateStr)}
                        </span>
                        <span className="text-[10px] font-mono text-slate-450 dark:text-slate-500">
                          ({day.dateStr})
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px]">
                        {day.receitas > 0 && (
                          <span className="flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400 font-extrabold">
                            <ArrowUpCircle className="w-3 h-3" />
                            +R$ {day.receitas.toFixed(2)}
                          </span>
                        )}
                        {day.despesas > 0 && (
                          <span className="flex items-center gap-0.5 text-rose-600 dark:text-rose-400 font-extrabold">
                            <ArrowDownCircle className="w-3 h-3" />
                            -R$ {day.despesas.toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Day insight summary */}
                    <p className="text-[11px] text-slate-600 dark:text-slate-350 italic font-medium leading-relaxed">
                      {getDayInsight(day.receitas, day.despesas, day.balance)}
                    </p>

                    {/* Transactions list */}
                    {day.transactions.length > 0 && (
                      <div className="border-t border-slate-200/40 dark:border-slate-850 pt-2 flex flex-wrap gap-1.5">
                        {day.transactions.map((t) => (
                          <span
                            key={t.id}
                            className={`text-[10px] px-2 py-0.5 rounded-md font-bold truncate max-w-[170px] ${
                              t.tipoItem === 'receita'
                                ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-950/40'
                                : 'bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 border border-rose-100 dark:border-rose-950/40'
                            }`}
                            title={t.descricao}
                          >
                            {t.descricao}: R$ {t.valor}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* MOTIVATIONAL QUOTE FOOTER */}
          <div className="text-center pt-2 text-[11px] text-slate-400 dark:text-slate-500 font-bold leading-relaxed border-t border-slate-100 dark:border-slate-850">
            "A constância nos pequenos hábitos diários constrói impérios financeiros duradouros." 🚀
          </div>

        </div>
      </div>
    </div>
  );
};
