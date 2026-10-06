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
  currentMonth: number;
  currentYear: number;
}

export const SubPanels: React.FC<SubPanelsProps> = ({
  activeType,
  transactions,
  projects,
  onAddProject,
  onDeleteProject,
  saldoReal,
  currentMonth,
  currentYear
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

  // Filter current month transactions for localized calculations
  const currentMonthTrans = transactions.filter(t => {
    if (!t.data) return false;
    const parts = t.data.split('-');
    if (parts.length < 3) return false;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // Convert 1-12 to 0-11
    return month === currentMonth && year === currentYear;
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
        <div className="p-5 bg-white dark:bg-[#1A1A1E] rounded-2xl border border-zinc-200/80 dark:border-[#27272A] space-y-3.5 shadow-xs">
          <div className="flex justify-between items-center border-b border-zinc-150 dark:border-[#27272A] pb-2">
            <h4 className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-1.5 uppercase tracking-wide">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              Modo Hardcore: Gasto Diário Seguro
            </h4>
            <span className="text-[9px] font-bold px-2 py-0.5 bg-zinc-100 dark:bg-[#222226] text-zinc-700 dark:text-zinc-300 rounded-full">
              Saúde Financeira
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-center">
            <div className="space-y-1">
              <p className="text-[10px] uppercase font-bold text-zinc-400 dark:text-zinc-500">
                Seu limite diário recomendado:
              </p>
              <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {formatValue(limiteDiario)}
              </p>
            </div>
            <div className="md:col-span-2 space-y-1.5">
              <div className="flex justify-between text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                <span>Energia do Caixa Atual</span>
                <span>{Math.max(0, powerMeter).toFixed(0)}%</span>
              </div>
              <div className="w-full bg-zinc-100 dark:bg-[#222226] h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full transition-all duration-500"
                  style={{ width: `${Math.max(0, powerMeter)}%` }}
                ></div>
              </div>
            </div>
          </div>
          <p className="text-[10px] text-zinc-500 dark:text-zinc-400 pt-2 border-t border-zinc-100 dark:border-[#27272A]">
            Fórmula inteligente baseada em sua liquidez acumulada real dividida pelos{' '}
            <strong className="text-zinc-700 dark:text-zinc-300">{diasRestantes} dias restantes</strong> do mês. Gastar abaixo de {formatValue(limiteDiario)} hoje melhora a sua projeção amanhã!
          </p>
        </div>
      )}

      {/* 2. TERMOMETRO DE SOBRA */}
      {activeType === 'saldo' && (() => {
        const needsCategories = ['moradia', 'alimentação', 'alimentacao', 'transporte', 'saúde', 'saude', 'educação', 'educacao', 'contas'];
        
        // Mapear gastos reais do mês
        const actualNeeds = despesasMes
          .filter((d) => needsCategories.includes(d.categoria.toLowerCase()))
          .reduce((s, d) => s + d.valor, 0);
          
        const actualWants = despesasMes
          .filter((d) => !needsCategories.includes(d.categoria.toLowerCase()))
          .reduce((s, d) => s + d.valor, 0);

        // Definir se é simulação ou real
        const isSimulation = totalReceitasMes === 0;
        const incomeBase = isSimulation ? 5000 : totalReceitasMes;
        
        const idealNeeds = incomeBase * 0.50;
        const idealWants = incomeBase * 0.30;
        const idealSavings = incomeBase * 0.20;
        
        const actualSaved = isSimulation 
          ? Math.max(0, 5000 - totalDespesasMes) 
          : Math.max(0, totalReceitasMes - totalDespesasMes);

        // Percentuais de uso do orçamento
        const needsPct = idealNeeds > 0 ? (actualNeeds / idealNeeds) * 100 : 0;
        const wantsPct = idealWants > 0 ? (actualWants / idealWants) * 100 : 0;
        const savingsPct = idealSavings > 0 ? (actualSaved / idealSavings) * 100 : 0;

        return (
          <div className="p-5 bg-white dark:bg-[#1A1A1E] rounded-2xl border border-zinc-200/80 dark:border-[#27272A] space-y-4 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-150 dark:border-[#27272A] pb-3 gap-2">
              <div>
                <h4 className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-1.5 uppercase tracking-wide">
                  <PieChart className="w-4 h-4 text-zinc-500" />
                  Direcionador Orçamentário Estratégico (Regra 50-30-20)
                </h4>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Mapeamento de despesas reais versus alocação ideal baseada em sua receita
                </p>
              </div>
              <span className={`text-[9px] font-bold px-2.5 py-1 rounded-full self-start sm:self-center uppercase tracking-wider ${
                isSimulation 
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20' 
                  : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
              }`}>
                {isSimulation ? 'Simulação (Renda R$ 5.000)' : 'Orçamento Real Ativo'}
              </span>
            </div>

            {isSimulation && (
              <div className="bg-zinc-50 dark:bg-[#141416] border border-zinc-200/80 dark:border-[#27272A] p-3 rounded-xl flex items-start gap-2">
                <HelpCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-[10px] text-zinc-600 dark:text-zinc-300 leading-tight">
                  <strong>Por que tudo marcava R$ 0?</strong> A regra 50-30-20 calcula as divisões a partir das suas <strong>Receitas/Entradas</strong> do mês. Como você não possui receitas cadastradas neste mês ainda, ativamos esta <strong>simulação educativa com renda padrão de R$ 5.000,00</strong> para demonstrar o seu direcionamento! Adicione lançamentos de receita para ver seu orçamento real.
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* ESSENCIAIS - 50% */}
              <div className="bg-zinc-50/70 dark:bg-[#141416] p-4 rounded-xl border border-zinc-200/70 dark:border-[#27272A] shadow-2xs space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase block">Necessidades (50%)</span>
                    <span className="text-[10px] font-semibold text-zinc-700 dark:text-zinc-300">Essenciais</span>
                  </div>
                  <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                    {formatValue(idealNeeds)}
                  </span>
                </div>
                <div className="border-t border-zinc-200/60 dark:border-[#27272A] pt-2 flex justify-between text-[10px]">
                  <span className="text-zinc-500 dark:text-zinc-400">Gasto Real:</span>
                  <span className={`font-bold ${actualNeeds > idealNeeds ? 'text-rose-500' : 'text-zinc-700 dark:text-zinc-300'}`}>
                    {formatValue(actualNeeds)}
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-500 ${actualNeeds > idealNeeds ? 'bg-rose-500' : 'bg-zinc-800 dark:bg-zinc-300'}`} 
                      style={{ width: `${needsPct}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-[8px] font-bold uppercase tracking-wide">
                    <span className={actualNeeds > idealNeeds ? 'text-rose-500' : 'text-zinc-600 dark:text-zinc-400'}>
                      {needsPct.toFixed(0)}% Consumido
                    </span>
                    <span className="text-zinc-400">
                      {actualNeeds > idealNeeds ? 'Excedeu!' : 'No limite'}
                    </span>
                  </div>
                </div>
              </div>

              {/* DESEJOS - 30% */}
              <div className="bg-zinc-50/70 dark:bg-[#141416] p-4 rounded-xl border border-zinc-200/70 dark:border-[#27272A] shadow-2xs space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase block">Estilo de Vida (30%)</span>
                    <span className="text-[10px] font-semibold text-zinc-700 dark:text-zinc-300">Lazer & Desejos</span>
                  </div>
                  <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                    {formatValue(idealWants)}
                  </span>
                </div>
                <div className="border-t border-zinc-200/60 dark:border-[#27272A] pt-2 flex justify-between text-[10px]">
                  <span className="text-zinc-500 dark:text-zinc-400">Gasto Real:</span>
                  <span className={`font-bold ${actualWants > idealWants ? 'text-rose-500' : 'text-zinc-700 dark:text-zinc-300'}`}>
                    {formatValue(actualWants)}
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-500 ${actualWants > idealWants ? 'bg-rose-500' : 'bg-zinc-600 dark:bg-zinc-400'}`} 
                      style={{ width: `${wantsPct}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-[8px] font-bold uppercase tracking-wide">
                    <span className={actualWants > idealWants ? 'text-rose-500' : 'text-zinc-600 dark:text-zinc-400'}>
                      {wantsPct.toFixed(0)}% Consumido
                    </span>
                    <span className="text-zinc-400">
                      {actualWants > idealWants ? 'Excedeu!' : 'Sob controle'}
                    </span>
                  </div>
                </div>
              </div>

              {/* POUPANÇA / RESERVA - 20% */}
              <div className="bg-zinc-50/70 dark:bg-[#141416] p-4 rounded-xl border border-zinc-200/70 dark:border-[#27272A] shadow-2xs space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase block">Futuro / Reserva (20%)</span>
                    <span className="text-[10px] font-semibold text-zinc-700 dark:text-zinc-300">Poupança & Projetos</span>
                  </div>
                  <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                    {formatValue(idealSavings)}
                  </span>
                </div>
                <div className="border-t border-zinc-200/60 dark:border-[#27272A] pt-2 flex justify-between text-[10px]">
                  <span className="text-zinc-500 dark:text-zinc-400">Sobra Poupar:</span>
                  <span className="font-bold text-emerald-500">
                    {formatValue(actualSaved)}
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-emerald-500 h-full transition-all duration-500" 
                      style={{ width: `${savingsPct}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-[8px] font-bold uppercase tracking-wide">
                    <span className="text-emerald-500">
                      {savingsPct.toFixed(0)}% Meta Atingida
                    </span>
                    <span className="text-zinc-400">
                      {actualSaved >= idealSavings ? 'Meta batida! 🎉' : 'Abaixo da meta'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 p-3 bg-zinc-50 dark:bg-[#141416] rounded-xl border border-zinc-200/80 dark:border-[#27272A] text-[10px] text-zinc-500 dark:text-zinc-400 leading-normal">
              <span>💡</span>
              <span>
                <strong>Como funciona o mapeamento automático:</strong> Despesas categorizadas como <em>Moradia</em>, <em>Alimentação</em>, e <em>Transporte</em> são somadas automaticamente em <strong>Necessidades</strong>. Todas as outras categorias (como <em>Lazer</em> e <em>Outros</em>) são direcionadas para <strong>Estilo de Vida</strong>. A diferença restante é o que você consegue efetivamente <strong>Poupar</strong>!
              </span>
            </div>
          </div>
        );
      })()}

      {/* 3. B-A-BA DE INVESTIMENTO */}
      {activeType === 'receitas' && (
        <div className="p-5 bg-white dark:bg-[#1A1A1E] rounded-2xl border border-zinc-200/80 dark:border-[#27272A] space-y-3.5 shadow-xs">
          <div className="border-b border-zinc-150 dark:border-[#27272A] pb-2">
            <h4 className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-1.5 uppercase tracking-wide">
              <GraduationCap className="w-4.5 h-4.5 text-zinc-500" />
              Proporção de Investimentos: Projeção Anual
            </h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-zinc-50/70 dark:bg-[#141416] p-3.5 rounded-xl border border-zinc-200/80 dark:border-[#27272A] flex flex-col justify-between gap-2 text-[11px]">
              <div>
                <h5 className="font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-tight">Poupança Clássica</h5>
                <p className="text-zinc-500 dark:text-zinc-400 mt-0.5 text-[10px] leading-tight">Retorno nominal fixo (retorno real exposto à inflação).</p>
              </div>
              <div className="border-t border-zinc-200/60 dark:border-[#27272A] pt-2 text-[10px] font-medium">
                Retorno Estimado 1ano:{' '}
                <span className="text-rose-500 font-bold">{formatValue(Math.max(0, saldoReal) * 0.0617)}</span>
              </div>
            </div>
            <div className="bg-zinc-50/70 dark:bg-[#141416] p-3.5 rounded-xl border border-zinc-200/80 dark:border-[#27272A] flex flex-col justify-between gap-2 text-[11px]">
              <div>
                <h5 className="font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-tight">CDB 100% CDI</h5>
                <p className="text-zinc-500 dark:text-zinc-400 mt-0.5 text-[10px] leading-tight">Liquidez imediata e proteção via FGC. Ótimo para sua reserva.</p>
              </div>
              <div className="border-t border-zinc-200/60 dark:border-[#27272A] pt-2 text-[10px] font-medium">
                Retorno Estimado 1ano:{' '}
                <span className="text-emerald-500 font-bold">{formatValue(Math.max(0, saldoReal) * 0.105)}</span>
              </div>
            </div>
            <div className="bg-zinc-50/70 dark:bg-[#141416] p-3.5 rounded-xl border border-zinc-200/80 dark:border-[#27272A] flex flex-col justify-between gap-2 text-[11px]">
              <div>
                <h5 className="font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-tight">Tesouro Selic</h5>
                <p className="text-zinc-500 dark:text-zinc-400 mt-0.5 text-[10px] leading-tight">Máxima segurança soberana nacional, com rendimento indexado.</p>
              </div>
              <div className="border-t border-zinc-200/60 dark:border-[#27272A] pt-2 text-[10px] font-medium">
                Retorno Estimado 1ano:{' '}
                <span className="text-emerald-500 font-bold">{formatValue(Math.max(0, saldoReal) * 0.1075)}</span>
              </div>
            </div>
          </div>
          <p className="text-[10px] text-zinc-400 leading-normal">
            Calculado com base em seu patrimônio total de <strong className="text-zinc-600 dark:text-zinc-300">{formatValue(saldoReal)}</strong>. Rentabilidades simuladas com base nas taxas vigentes aproximadas (CDI e Selic atual).
          </p>
        </div>
      )}

      {/* 4. CORTADOR DE GORDURA */}
      {activeType === 'despesas' && (
        <div className="p-5 bg-white dark:bg-[#1A1A1E] rounded-2xl border border-zinc-200/80 dark:border-[#27272A] space-y-4 shadow-xs">
          <div className="border-b border-zinc-150 dark:border-[#27272A] pb-2 flex justify-between items-center">
            <h4 className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-1.5 uppercase tracking-wide">
              <Scissors className="w-4 h-4 text-zinc-500" />
              Cortador de Gordura Opcional
            </h4>
            <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
              Economia Imediata: {formatValue(totalEconomia)}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-zinc-50/70 dark:bg-[#141416] p-4 rounded-xl border border-zinc-200/80 dark:border-[#27272A] space-y-2.5">
              <div className="flex justify-between font-bold text-xs text-zinc-700 dark:text-zinc-300">
                <span>🍿 Economia Lazer (Total: {formatValue(lazerGastos)})</span>
                <span className="text-rose-500">{lazerCorte}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="50"
                step="5"
                value={lazerCorte}
                onChange={(e) => setLazerCorte(parseInt(e.target.value))}
                className="w-full accent-zinc-900 dark:accent-zinc-100 h-2 bg-zinc-200 dark:bg-zinc-800 rounded-lg cursor-pointer transition-all"
              />
              <div className="flex justify-between items-center text-[10px] text-zinc-400 font-medium">
                <span>Economia estimada:</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">{formatValue(economiaLazer)}</span>
              </div>
            </div>
            <div className="bg-zinc-50/70 dark:bg-[#141416] p-4 rounded-xl border border-zinc-200/80 dark:border-[#27272A] space-y-2.5">
              <div className="flex justify-between font-bold text-xs text-zinc-700 dark:text-zinc-300">
                <span>🛒 Compras Gerais (Total: {formatValue(comprasGastos)})</span>
                <span className="text-rose-500">{comprasCorte}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="50"
                step="5"
                value={comprasCorte}
                onChange={(e) => setComprasCorte(parseInt(e.target.value))}
                className="w-full accent-zinc-900 dark:accent-zinc-100 h-2 bg-zinc-200 dark:bg-zinc-800 rounded-lg cursor-pointer transition-all"
              />
              <div className="flex justify-between items-center text-[10px] text-zinc-400 font-medium">
                <span>Economia estimada:</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">{formatValue(economiaCompras)}</span>
              </div>
            </div>
          </div>
          <p className="text-[10px] text-zinc-400 leading-normal">
            Arraste os sliders acima para ver quanto você economizaria cortando supérfluos e reequilibrando seu estilo de consumo.
          </p>
        </div>
      )}

      {/* 5. PLANEJADOR DE SONHOS (DREAM PLANNER) */}
      {activeType === 'metas' && (
        <div className="p-5 bg-white dark:bg-[#1A1A1E] rounded-2xl border border-zinc-200/80 dark:border-[#27272A] space-y-4 shadow-xs">
          <div className="border-b border-zinc-150 dark:border-[#27272A] pb-2">
            <h4 className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-1.5 uppercase tracking-wide">
              <Rocket className="w-4 h-4 text-zinc-500" />
              Planejador de Sonhos Multimetas
            </h4>
          </div>
          
          <form onSubmit={handleProjectSubmit} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
            <div>
              <label className="text-[9px] text-zinc-400 dark:text-zinc-500 font-bold block uppercase tracking-wider mb-1">
                Nome da Meta/Sonho
              </label>
              <input
                type="text"
                placeholder="Ex. Viagem, Notebook"
                value={projNome}
                onChange={(e) => setProjNome(e.target.value)}
                required
                className="w-full bg-zinc-50 dark:bg-[#141416] border border-zinc-200/80 dark:border-[#27272A] text-zinc-900 dark:text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-zinc-400 font-medium"
              />
            </div>
            <div>
              <label className="text-[9px] text-zinc-400 dark:text-zinc-500 font-bold block uppercase tracking-wider mb-1">
                Custo Total (R$)
              </label>
              <input
                type="number"
                placeholder="Ex. 5000"
                value={projValor}
                onChange={(e) => setProjValor(e.target.value)}
                required
                className="w-full bg-zinc-50 dark:bg-[#141416] border border-zinc-200/80 dark:border-[#27272A] text-zinc-900 dark:text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-zinc-400 font-medium"
              />
            </div>
            <div>
              <label className="text-[9px] text-zinc-400 dark:text-zinc-500 font-bold block uppercase tracking-wider mb-1">
                Prazo Alvo
              </label>
              <input
                type="date"
                value={projData}
                onChange={(e) => setProjData(e.target.value)}
                required
                className="w-full bg-zinc-50 dark:bg-[#141416] border border-zinc-200/80 dark:border-[#27272A] text-zinc-900 dark:text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-zinc-400 font-medium"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-zinc-900 hover:bg-black dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-950 text-xs font-bold py-2.5 rounded-xl transition-all shadow-xs active:scale-98 flex items-center justify-center uppercase tracking-wide cursor-pointer"
            >
              Projetar Meta
            </button>
          </form>

          <div className="overflow-x-auto rounded-xl border border-zinc-200/80 dark:border-[#27272A] bg-zinc-50/30 dark:bg-[#141416]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-200/80 dark:border-[#27272A] text-zinc-400 dark:text-zinc-500 text-[10px] uppercase font-bold bg-zinc-50 dark:bg-[#141416]">
                  <th className="p-3">Projeto</th>
                  <th className="p-3">Custo Total</th>
                  <th className="p-3">Prazo Alvo</th>
                  <th className="p-3">Aporte Sugerido</th>
                  <th className="p-3 text-center">Remover</th>
                </tr>
              </thead>
              <tbody className="text-xs divide-y divide-zinc-200/60 dark:divide-[#27272A]">
                {projects.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-zinc-400 dark:text-zinc-500 font-medium">
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
                      <tr key={p.id} className="hover:bg-zinc-100/50 dark:hover:bg-[#1F1F24] transition-colors">
                        <td className="p-3 font-semibold text-zinc-800 dark:text-zinc-200">{p.nome}</td>
                        <td className="p-3 font-bold text-zinc-700 dark:text-zinc-300">{formatValue(p.valor)}</td>
                        <td className="p-3 font-medium text-zinc-600 dark:text-zinc-400">{dateFormatted}</td>
                        <td className="p-3 font-bold text-zinc-900 dark:text-white">
                          {formatValue(aporte)} /mês
                        </td>
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => onDeleteProject(p.id)}
                            className="p-1.5 text-zinc-400 hover:text-rose-500 dark:hover:text-rose-400 transition-colors rounded-lg hover:bg-zinc-100 dark:hover:bg-[#222226] cursor-pointer"
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
