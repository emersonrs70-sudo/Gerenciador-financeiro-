import React from 'react';
import { X, RefreshCw, Trash2, CheckCircle2, PauseCircle, Calendar, CreditCard } from 'lucide-react';
import { RecurrentRule, BankAccount } from '../types';

interface ManageRecurrentModalProps {
  isOpen: boolean;
  onClose: () => void;
  rules: RecurrentRule[];
  onToggleRule: (ruleId: string) => Promise<void>;
  onDeleteRule: (ruleId: string) => Promise<void>;
  accounts: BankAccount[];
}

export const ManageRecurrentModal: React.FC<ManageRecurrentModalProps> = ({
  isOpen,
  onClose,
  rules,
  onToggleRule,
  onDeleteRule,
  accounts
}) => {
  if (!isOpen) return null;

  const formatCurrency = (val: number) => {
    return `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white dark:bg-[#32323F] border border-[#E8E5DC] dark:border-[#4C4E5D]/60 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#E8E5DC] dark:border-[#4C4E5D]/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
              <RefreshCw className="w-4 h-4 animate-spin-slow" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                Lançamentos Fixos Contínuos
              </h3>
              <p className="text-[11px] text-zinc-500 dark:text-[#988E96]">
                Gastos gerados automaticamente todo início de mês
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-[#252530] text-zinc-400 hover:text-zinc-700 dark:hover:text-white transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Rules List */}
        <div className="p-4 overflow-y-auto custom-scrollbar flex-1 space-y-2.5">
          {rules.length === 0 ? (
            <div className="py-8 text-center space-y-2 border border-dashed border-[#E8E5DC] dark:border-[#4C4E5D]/60 rounded-xl">
              <RefreshCw className="w-8 h-8 mx-auto text-zinc-300 dark:text-zinc-600" />
              <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                Nenhum lançamento fixo contínuo cadastrado
              </p>
              <p className="text-[11px] text-zinc-400 max-w-xs mx-auto">
                Ao cadastrar um "Lançamento Fixo" sem preencher o mês limite, ele aparecerá aqui e será gerado todo mês.
              </p>
            </div>
          ) : (
            rules.map((rule) => {
              const account = accounts.find(a => a.id === rule.accountId);
              return (
                <div
                  key={rule.id}
                  className={`p-3 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    rule.ativa
                      ? 'bg-[#F8F7F4] dark:bg-[#252530] border-[#E8E5DC] dark:border-[#4C4E5D]/60'
                      : 'bg-zinc-100/50 dark:bg-[#252530]/40 border-zinc-200 dark:border-zinc-800 opacity-60'
                  }`}
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-zinc-900 dark:text-white truncate">
                        {rule.descricao}
                      </span>
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold uppercase ${
                          rule.tipoItem === 'despesa'
                            ? 'bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400'
                            : 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {rule.tipoItem}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-[10px] text-zinc-500 dark:text-zinc-400">
                      <span className="flex items-center gap-1 font-semibold text-zinc-700 dark:text-zinc-300">
                        <Calendar className="w-3 h-3 text-zinc-400" />
                        Todo dia {rule.diaDoMes}
                      </span>
                      <span>•</span>
                      <span>{rule.categoria}</span>
                      {account && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <CreditCard className="w-3 h-3 text-zinc-400" />
                            {account.nome}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-200/60 dark:border-zinc-800">
                    <span className="text-xs font-bold font-mono text-zinc-900 dark:text-white">
                      {formatCurrency(rule.valor)}
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => onToggleRule(rule.id)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                          rule.ativa
                            ? 'bg-amber-100 hover:bg-amber-200 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                            : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                        }`}
                        title={rule.ativa ? 'Pausar geração automática' : 'Reativar geração automática'}
                      >
                        {rule.ativa ? (
                          <>
                            <PauseCircle className="w-3 h-3" />
                            <span>Pausar</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Ativar</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => onDeleteRule(rule.id)}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all cursor-pointer"
                        title="Excluir regra de recorrência"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-zinc-50 dark:bg-[#252530]/50 border-t border-[#E8E5DC] dark:border-[#4C4E5D]/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-zinc-900 hover:bg-black dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-950 text-xs font-bold transition-all cursor-pointer"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
};
