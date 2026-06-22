import React, { useState } from 'react';
import {
  ShieldCheck, PieChart, GraduationCap, Scissors, Rocket, Trash2, HelpCircle
} from 'lucide-react';
import { Transaction, Project, SubPainelType } from '../types';

interface SubPanelsProps {
  activeType: SubPainelType;
  transactions: Transaction[];
  projects: Project[];
  onAddProject: (nome: string, valor: number, dataAlvo: string) => Promise<void>;
  onDeleteProject: (id: string) => Promise<void>;
  saldoReal: number;
}

export const SubPanels: React.FC<SubPanelsProps> = ({
  activeType,
  transactions,
  projects,
  onAddProject,
  onDeleteProject,
  saldoReal
}) => {
  // Draggable sliders state for Fat Cutter
  const [lazerCorte, setLazerCorte] = useState<number>(0);
  const [comprasCorte, setComprasCorte] = useState<number>(0);

  // New Dream State
  const [projNome, setProjNome] = useState('');
  const [projValor, setProjValor] = useState('');
  const [projData, setProjData] = useState('');

  if (!activeType) return null;

  // Calculators helper
  const formatValue = (v: number) =>
    `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();

  // Filter current month transactions for localized calculations
  const currentMonthTrans = transactions.filter(t => {
    const d = new Date(t.data);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  const despesasMes = currentMonthTrans.filter(t => t.tipoItem === 'despesa');
  const totalDespesasMes = despesasMes.reduce((acc, t) => acc + t.valor, 0);

  const receitasMes = currentMonthTrans.filter(t => t.tipoItem === 'receita');
  const totalReceitasMes = receitasMes.reduce((acc, t) => acc + t.valor, 0);

  const sobraMes = Math.max(0, totalReceitasMes - totalDespesasMes);

  // 1. Hardcore Mode (Saldo Real) calculations
  const formatLocalDate = (date: Date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  const hoje = new Date();
  const ultimoDiaDoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
  const diasRestantes = Math.max(1, ultimoDiaDoMes - hoje.getDate() + 1);
  const limiteDiario = Math.max(0, saldoReal / diasRestantes);
  const powerMeter = Math.min((saldoReal / 3000) * 100, 100);

  // 2. Fat Cutter category expenditures
  const lazerGastos = despesasMes.filter(d => d.categoria === 'Lazer').reduce((s, d) => s + d.valor, 0);
  const fixedCategories = ['Moradia', 'Alimentação', 'Transporte', 'Lazer'];
  const comprasGastos = despesasMes.filter(d => !fixedCategories.includes(d.categoria)).reduce((s, d) => s + d.valor, 0);

  const economiaLazer = lazerGastos * (lazerCorte / 100);
  const economiaCompras = comprasGastos * (comprasCorte / 100);
  const totalEconomia = economiaLazer + economiaCompras;

  // 3. Dreams target calculators
  const handleProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projNome || !projValor || !projData) return;
    await onAddProject(projNome, parseFloat(projValor), projData);
    setProjNome('');
    setProjValor('');
    setProjData('');
  };

  const calculateMonthsLeft = (targetStr: string) => {
    const today = new Date();
    const targeted = new Date(targetStr);
    const months = (targeted.getFullYear() - today.getFullYear()) * 12 + (targeted.getMonth() - today.getMonth());
    return Math.max(1, months);
  };

  return (
    <div className="w-full transition-all duration-300">
      {/* 1. MODO HARDCORE */}
      {activeType === 'saldo-real' && (
        <div className="p-5 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/10 rounded-2xl border border-emerald-100 dark:border-emerald-900/30 space-y-3.5 shadow-xs">
          <div className="flex justify-between items-center border-b border-emerald-100 dark:border-emerald-900/20 pb-2">
            <h4 className="text-xs font-black text-emerald-800 dark:text-emerald-400 flex items-center gap-1.5 uppercase tracking-wide">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              Modo Hardcore: Gasto Diário Seguro
            </h4>
            <span className="text-[9px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-950/55 dark:text-emerald-350 rounded-full">
              Sua Saúde Financeira
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-center">
            <div className="space-y-1">
              <p className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500">
                Seu limite diário recomendado:
              </p>
              <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {formatValue(limiteDiario)}
              </p>
            </div>
            <div className="md:col-span-2 space-y-1.5">
              <div className="flex justify-between text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <span>Energia do Caixa Atual</span>
                <span>{Math.max(0, powerMeter).toFixed(0)}%</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full transition-all duration-500"
                  style={{ width: `${Math.max(0, powerMeter)}%` }}
                ></div>
              </div>
            </div>
          </div>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200/50 dark:border-slate-800/50">
            Fórmula inteligente baseada em sua liquidez acumulada real dividida pelos{' '}
            <strong className="text-slate-700 dark:text-slate-300">{diasRestantes} dias restantes</strong> do mês. Gastar abaixo de {formatValue(limiteDiario)} hoje melhora a sua projeção amanhã!
          </p>
        </div>
      )}

      {/* 2. TERMOMETRO DE SOBRA */}
      {activeType === 'saldo' && (
        <div className="p-5 bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/15 dark:to-indigo-950/10 rounded-2xl border border-purple-100 dark:border-purple-900/30 space-y-3.5 shadow-xs">
          <div className="border-b border-purple-100 dark:border-purple-900/20 pb-2">
            <h4 className="text-xs font-black text-purple-800 dark:text-purple-400 flex items-center gap-1.5 uppercase tracking-wide">
              <PieChart className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              Direcionador Orçamentário (Regra 50-30-20)
            </h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white/80 dark:bg-slate-950/50 p-3 rounded-xl border border-purple-100/30 dark:border-slate-800/60">
              <div className="flex justify-between text-[10px] font-bold text-slate-700 dark:text-slate-350 mb-1">
                <span>🎯 Projetos de Vida (50%)</span>
                <span className="text-purple-600 font-extrabold">{formatValue(sobraMes * 0.5)}</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                <div className="bg-purple-500 h-full" style={{ width: '50%' }}></div>
              </div>
            </div>
            <div className="bg-white/80 dark:bg-slate-950/50 p-3 rounded-xl border border-purple-100/30 dark:border-slate-800/60">
              <div className="flex justify-between text-[10px] font-bold text-slate-700 dark:text-slate-350 mb-1">
                <span>🛡️ Reserva de Emergência (30%)</span>
                <span className="text-blue-500 font-extrabold">{formatValue(sobraMes * 0.3)}</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                <div className="bg-blue-500 h-full" style={{ width: '30%' }}></div>
              </div>
            </div>
            <div className="bg-white/80 dark:bg-slate-950/50 p-3 rounded-xl border border-purple-100/30 dark:border-slate-800/60">
              <div className="flex justify-between text-[10px] font-bold text-slate-700 dark:text-slate-350 mb-1">
                <span>🍿 Estilo de Vida Livre (20%)</span>
                <span className="text-emerald-500 font-extrabold">{formatValue(sobraMes * 0.2)}</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                <div className="bg-emerald-500 h-full" style={{ width: '20%' }}></div>
              </div>
            </div>
          </div>
          <p className="text-[10px] text-slate-400 leading-relaxed font-medium">
            Sua sobra orçamentária projetada para este mês é de <strong className="text-slate-600 dark:text-slate-350">{formatValue(sobraMes)}</strong>. Esta divisão metodológica sugere como você pode alocar seu capital residual para enriquecimento sólido, autocontenção e lazer seguro.
          </p>
        </div>
      )}

      {/* 3. B-A-BA DE INVESTIMENTO */}
      {activeType === 'receitas' && (
        <div className="p-5 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/10 rounded-2xl border border-blue-100 dark:border-blue-900/30 space-y-3.5 shadow-xs">
          <div className="border-b border-blue-100 dark:border-blue-900/20 pb-2">
            <h4 className="text-xs font-black text-blue-900 dark:text-blue-400 flex items-center gap-1.5 uppercase tracking-wide">
              <GraduationCap className="w-4.5 h-4.5 text-blue-600 dark:text-blue-400" />
              Proporção de Investimentos: Projeção Anual
            </h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-white dark:bg-slate-950 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-2 text-[11px]">
              <div>
                <h5 className="font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tight">Poupança Clássica</h5>
                <p className="text-slate-500 dark:text-slate-400 mt-0.5 text-[10px] leading-tight">Retorno nominal fixo (retorno real exposto à inflação).</p>
              </div>
              <div className="border-t border-slate-100 dark:border-slate-900 pt-2 text-[10px] font-medium">
                Retorno Estimado 1ano:{' '}
                <span className="text-red-500 font-extrabold">{formatValue(Math.max(0, saldoReal) * 0.0617)}</span>
              </div>
            </div>
            <div className="bg-white dark:bg-slate-950 p-3.5 rounded-xl border border-blue-200 dark:border-blue-900/40 flex flex-col justify-between gap-2 text-[11px] border-t-4 border-t-blue-500 shadow-xs">
              <div>
                <h5 className="font-black text-blue-650 dark:text-blue-450 uppercase tracking-tight">CDB 100% CDI</h5>
                <p className="text-slate-500 dark:text-slate-400 mt-0.5 text-[10px] leading-tight">Liquidez imediata e proteção via FGC. Ótimo para sua reserva.</p>
              </div>
              <div className="border-t border-blue-50 dark:border-slate-900 pt-2 text-[10px] font-medium">
                Retorno Estimado 1ano:{' '}
                <span className="text-emerald-500 font-extrabold">{formatValue(Math.max(0, saldoReal) * 0.105)}</span>
              </div>
            </div>
            <div className="bg-white dark:bg-slate-950 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-2 text-[11px]">
              <div>
                <h5 className="font-bold text-indigo-650 dark:text-indigo-400 uppercase tracking-tight">Tesouro Selic</h5>
                <p className="text-slate-500 dark:text-slate-400 mt-0.5 text-[10px] leading-tight">Máxima segurança soberana nacional, com rendimento indexado.</p>
              </div>
              <div className="border-t border-slate-100 dark:border-slate-900 pt-2 text-[10px] font-medium">
                Retorno Estimado 1ano:{' '}
                <span className="text-emerald-500 font-extrabold">{formatValue(Math.max(0, saldoReal) * 0.1075)}</span>
              </div>
            </div>
          </div>
          <p className="text-[10px] text-slate-400 leading-normal">
            Calculado com base em seu patrimônio total de <strong className="text-slate-500">{formatValue(saldoReal)}</strong>. Rentabilidades simuladas com base nas taxas vigentes aproximadas (CDI e Selic atual).
          </p>
        </div>
      )}

      {/* 4. CORTADOR DE GORDURA */}
      {activeType === 'despesas' && (
        <div className="p-5 bg-gradient-to-br from-red-50 to-amber-50 dark:from-red-950/25 dark:to-slate-900 rounded-2xl border border-red-100 dark:border-red-900/30 space-y-4 shadow-xs">
          <div className="border-b border-red-100 dark:border-red-900/20 pb-2 flex justify-between items-center">
            <h4 className="text-xs font-black text-red-800 dark:text-red-450 flex items-center gap-1.5 uppercase tracking-wide">
              <Scissors className="w-4 h-4 text-red-600 dark:text-red-400" />
              Cortador de Gordura Opcional
            </h4>
            <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/50 px-2 py-0.5 rounded-md">
              Economia Imediata: {formatValue(totalEconomia)}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-slate-950 p-4 rounded-xl border border-slate-200/50 dark:border-slate-850 space-y-2.5">
              <div className="flex justify-between font-bold text-xs text-slate-700 dark:text-slate-300">
                <span>🍿 Economia Lazer (Total: {formatValue(lazerGastos)})</span>
                <span className="text-red-500">{lazerCorte}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="50"
                step="5"
                value={lazerCorte}
                onChange={(e) => setLazerCorte(parseInt(e.target.value))}
                className="w-full accent-red-500 h-2 bg-slate-200 dark:bg-slate-800 rounded-lg cursor-pointer transition-all"
              />
              <div className="flex justify-between items-center text-[10px] text-slate-400 font-medium">
                <span>Economia estimada:</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">{formatValue(economiaLazer)}</span>
              </div>
            </div>
            <div className="bg-white dark:bg-slate-950 p-4 rounded-xl border border-slate-200/50 dark:border-slate-850 space-y-2.5">
              <div className="flex justify-between font-bold text-xs text-slate-700 dark:text-slate-300">
                <span>🛒 Compras Gerais (Total: {formatValue(comprasGastos)})</span>
                <span className="text-red-500">{comprasCorte}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="50"
                step="5"
                value={comprasCorte}
                onChange={(e) => setComprasCorte(parseInt(e.target.value))}
                className="w-full accent-red-500 h-2 bg-slate-200 dark:bg-slate-800 rounded-lg cursor-pointer transition-all"
              />
              <div className="flex justify-between items-center text-[10px] text-slate-400 font-medium">
                <span>Economia estimada:</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">{formatValue(economiaCompras)}</span>
              </div>
            </div>
          </div>
          <p className="text-[10px] text-slate-400 leading-normal">
            Arraste os sliders acima para ver quanto você economizaria cortando supérfluos e reequilibrando seu estilo de consumo.
          </p>
        </div>
      )}

      {/* 5. PLANEJADOR DE SONHOS (DREAM PLANNER) */}
      {activeType === 'metas' && (
        <div className="p-5 bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/15 dark:to-indigo-950/10 rounded-2xl border border-purple-100 dark:border-purple-900/30 space-y-4 shadow-xs">
          <div className="border-b border-purple-100 dark:border-purple-900/20 pb-2">
            <h4 className="text-xs font-black text-purple-800 dark:text-purple-400 flex items-center gap-1.5 uppercase tracking-wide">
              <Rocket className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              Planejador de Sonhos Multimetas
            </h4>
          </div>
          
          <form onSubmit={handleProjectSubmit} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
            <div>
              <label className="text-[9px] text-slate-400 dark:text-slate-550 font-black block uppercase tracking-wider mb-1">
                Nome da Meta/Sonho
              </label>
              <input
                type="text"
                placeholder="Ex. Viagem, Notebook"
                value={projNome}
                onChange={(e) => setProjNome(e.target.value)}
                required
                className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 dark:text-white rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="text-[9px] text-slate-400 dark:text-slate-550 font-black block uppercase tracking-wider mb-1">
                Custo Total (R$)
              </label>
              <input
                type="number"
                placeholder="Ex. 5000"
                value={projValor}
                onChange={(e) => setProjValor(e.target.value)}
                required
                className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 dark:text-white rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="text-[9px] text-slate-400 dark:text-slate-550 font-black block uppercase tracking-wider mb-1">
                Prazo Alvo
              </label>
              <input
                type="date"
                value={projData}
                onChange={(e) => setProjData(e.target.value)}
                required
                className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 dark:text-white rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-purple-600 text-white hover:bg-purple-700 text-xs font-black py-2.5 rounded-xl transition-all shadow-sm active:scale-98 h-[38px] flex items-center justify-center uppercase tracking-wide"
            >
              Projetar Meta
            </button>
          </form>

          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-950">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-850 text-slate-400 dark:text-slate-500 text-[10px] uppercase font-bold bg-slate-50 dark:bg-slate-900/60 shadow-inner">
                  <th className="p-3">Projeto</th>
                  <th className="p-3">Custo Total</th>
                  <th className="p-3">Prazo Alvo</th>
                  <th className="p-3">Aporte Sugerido</th>
                  <th className="p-3 text-center">Remover</th>
                </tr>
              </thead>
              <tbody className="text-xs divide-y divide-slate-100 dark:divide-slate-900">
                {projects.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-slate-400 dark:text-slate-650 font-medium">
                      Nenhum projeto planejado. Crie suas metas no formulário acima!
                    </td>
                  </tr>
                ) : (
                  projects.map((p) => {
                    const monthsLeft = calculateMonthsLeft(p.dataAlvo);
                    const aporte = p.valor / monthsLeft;
                    const dateFormatted = new Date(p.dataAlvo + 'T12:00:00')
                      .toLocaleDateString('pt-BR', { timeZone: 'UTC' });

                    return (
                      <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors">
                        <td className="p-3 font-bold text-slate-700 dark:text-slate-350">{p.nome}</td>
                        <td className="p-3 font-extrabold text-slate-600 dark:text-slate-400">{formatValue(p.valor)}</td>
                        <td className="p-3 font-bold text-purple-600 dark:text-purple-400">{dateFormatted}</td>
                        <td className="p-3 font-black text-slate-800 dark:text-white bg-purple-50/20 dark:bg-purple-950/5">
                          {formatValue(aporte)} /mês
                        </td>
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => onDeleteProject(p.id)}
                            className="p-1.5 text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-950/25 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
