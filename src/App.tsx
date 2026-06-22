import React, { useState, useEffect } from 'react';
import {
  Wallet, TrendingUp, ArrowUpCircle, ArrowDownCircle, Rocket,
  ChevronLeft, ChevronRight, Sun, Moon, Flame, Download
} from 'lucide-react';
import {
  Transaction, Project, SubPainelType, ExtratoFilter
} from './types';
import {
  supabase, testConnection, DEFAULT_CATEGORIES, DEFAULT_DESPESAS,
  DEFAULT_RECEITAS, DEFAULT_PROJETOS, getLocal, saveLocal
} from './lib/supabase';
import { NudgeBanner } from './components/NudgeBanner';
import { MetricCard } from './components/MetricCard';
import { SubPanels } from './components/SubPanels';
import { TransactionForm } from './components/TransactionForm';
import { TransactionTable } from './components/TransactionTable';
import { FinancialCharts } from './components/FinancialCharts';
import { PersonalAIAdvisor } from './components/PersonalAIAdvisor';
import { StreakModal } from './components/StreakModal';

interface Toast {
  id: string;
  msg: string;
  type: 'sucesso' | 'info' | 'erro';
}

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export default function App() {
  // Calendar Anchored date
  const [dataAncorada, setDataAncorada] = useState<Date>(() => new Date());

  // App dataset state
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categorias, setCategorias] = useState<string[]>(DEFAULT_CATEGORIES);
  const [projects, setProjects] = useState<Project[]>([]);

  // Selection statuses
  const [subpainelAberto, setSubpainelAberto] = useState<SubPainelType>(null);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => getLocal<boolean>('app_theme_dark', true));
  const [mobileTabActive, setMobileTabActive] = useState<'dashboard' | 'transacoes' | 'planejador'>('dashboard');
  const [isStreakModalOpen, setIsStreakModalOpen] = useState<boolean>(false);

  // Supabase connection status
  const [isOnline, setIsOnline] = useState<boolean>(false);

  // PWA install prompt handler
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const triggerInstallApp = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`PWA user choice outcome: ${outcome}`);
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  // Toast Alerts feed
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Trigger Toast Notification
  const showToast = (msg: string, type: 'sucesso' | 'info' | 'erro' = 'sucesso') => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, msg, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  };

  // 1. Initial Data Fetching from Supabase, mirroring to local storage
  useEffect(() => {
    async function initData() {
      // Set initial HTML Dark Mode class matching isDarkMode state
      if (isDarkMode) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }

      const connected = await testConnection();
      setIsOnline(connected);

      let fetchedDespesas: Transaction[] = [];
      let fetchedReceitas: Transaction[] = [];
      let fetchedProjetos: Project[] = [];
      let fetchedCategorias: string[] = [...DEFAULT_CATEGORIES];

      if (connected) {
        try {
          // Fetch custom categories
          const { data: catData } = await supabase.from('fin_categorias').select('nome');
          if (catData && catData.length > 0) {
            fetchedCategorias = [...new Set([...DEFAULT_CATEGORIES, ...catData.map((c) => c.nome)])];
          }

          // Fetch despesas
          const { data: despData } = await supabase.from('fin_despesas').select('*');
          if (despData) fetchedDespesas = despData.map(d => ({ ...d, tipoItem: 'despesa' }));

          // Fetch receitas
          const { data: recData } = await supabase.from('fin_receitas').select('*');
          if (recData) fetchedReceitas = recData.map(r => ({ ...r, tipoItem: 'receita' }));

          // Fetch projects
          const { data: projData } = await supabase.from('fin_projetos').select('*');
          if (projData) fetchedProjetos = projData;

          showToast('Sincronizado com Supabase com sucesso!', 'sucesso');
        } catch (err) {
          console.error('Err fetching from Supabase tables:', err);
          showToast('Erro ao sincronizar, usando dados locais.', 'erro');
        }
      }

      // If online fetched arrays are empty AND we have no local cache, seed with defaults so the user has an operational starting screen
      const cachedDespesas = getLocal<Transaction[]>('local_despesas', []);
      const cachedReceitas = getLocal<Transaction[]>('local_receitas', []);
      const cachedProjects = getLocal<Project[]>('local_projects', []);
      const cachedCategorias = getLocal<string[]>('local_categorias', DEFAULT_CATEGORIES);

      const hasInitialized = localStorage.getItem('fintech_initialized') === 'true';
      let finalDespesas: Transaction[] = [];
      let finalReceitas: Transaction[] = [];
      let finalProjects: Project[] = [];
      let finalCategorias: string[] = [];

      if (!hasInitialized) {
        if (connected) {
          if (fetchedDespesas.length === 0 && fetchedReceitas.length === 0 && fetchedProjetos.length === 0) {
            // Database is completely empty, let's pre-seed
            fetchedDespesas = [...DEFAULT_DESPESAS];
            fetchedReceitas = [...DEFAULT_RECEITAS];
            fetchedProjetos = [...DEFAULT_PROJETOS];
            fetchedCategorias = [...DEFAULT_CATEGORIES];

            // Seed to Supabase background to make sandbox rich natively
            await Promise.all([
              supabase.from('fin_despesas').insert(DEFAULT_DESPESAS),
              supabase.from('fin_receitas').insert(DEFAULT_RECEITAS),
              supabase.from('fin_projetos').insert(DEFAULT_PROJETOS)
            ]).catch(err => console.warn('Supabase initial seed error:', err));
          }
          finalDespesas = fetchedDespesas;
          finalReceitas = fetchedReceitas;
          finalProjects = fetchedProjetos;
          finalCategorias = fetchedCategorias;
        } else {
          // Offline and first load, fallback to defaults
          finalDespesas = cachedDespesas.length > 0 ? cachedDespesas : DEFAULT_DESPESAS;
          finalReceitas = cachedReceitas.length > 0 ? cachedReceitas : DEFAULT_RECEITAS;
          finalProjects = cachedProjects.length > 0 ? cachedProjects : DEFAULT_PROJETOS;
          finalCategorias = cachedCategorias.length > 0 ? cachedCategorias : DEFAULT_CATEGORIES;
        }
        localStorage.setItem('fintech_initialized', 'true');
      } else {
        // App is already initialized. We strictly respect the direct state (even if empty lists).
        if (connected) {
          finalDespesas = fetchedDespesas;
          finalReceitas = fetchedReceitas;
          finalProjects = fetchedProjetos;
          finalCategorias = fetchedCategorias;
        } else {
          finalDespesas = cachedDespesas;
          finalReceitas = cachedReceitas;
          finalProjects = cachedProjects;
          finalCategorias = cachedCategorias;
        }
      }

      const finalTransactions = [...finalDespesas, ...finalReceitas];

      setTransactions(finalTransactions);
      setCategorias(finalCategorias);
      setProjects(finalProjects);

      // Save to local storage for subsequent offline entries
      saveLocal('local_despesas', finalTransactions.filter(t => t.tipoItem === 'despesa'));
      saveLocal('local_receitas', finalTransactions.filter(t => t.tipoItem === 'receita'));
      saveLocal('local_projects', finalProjects);
      saveLocal('local_categorias', finalCategorias);
    }

    initData();
  }, []);

  // Theme support toggler
  const toggleTheme = () => {
    setIsDarkMode((prev) => {
      const next = !prev;
      if (next) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      saveLocal('app_theme_dark', next);
      return next;
    });
  };

  // Months navigation triggers
  const prevMonth = () => {
    setDataAncorada((prev) => {
      const next = new Date(prev);
      next.setMonth(prev.getMonth() - 1);
      return next;
    });
  };

  const nextMonth = () => {
    setDataAncorada((prev) => {
      const next = new Date(prev);
      next.setMonth(prev.getMonth() + 1);
      return next;
    });
  };

  const resetToToday = () => {
    setDataAncorada(new Date());
  };

  // --- CRUD ACTIONS ---

  // Add category handler
  const handleAddCategory = async (nome: string) => {
    let success = false;
    if (isOnline) {
      try {
        const { error } = await supabase.from('fin_categorias').insert([{ nome }]);
        if (!error) success = true;
      } catch (err) {
        console.warn('Could not insert category on Supabase, fallback locally:', err);
      }
    }

    const updated = [...categorias, nome];
    setCategorias(updated);
    saveLocal('local_categorias', updated);
    showToast(`Categoria "${nome}" adicionada com sucesso!`, 'sucesso');
  };

  // Add transaction (despesa or receita) handler
  const handleAddTransaction = async (
    descricao: string,
    valor: number,
    data: string,
    categoria: string,
    tipoItem: 'despesa' | 'receita'
  ) => {
    const newTransaction: Transaction = {
      id: crypto.randomUUID(),
      descricao,
      valor,
      data,
      categoria,
      tipoItem
    };

    if (isOnline) {
      try {
        const table = tipoItem === 'despesa' ? 'fin_despesas' : 'fin_receitas';
        const { error } = await supabase.from(table).insert([newTransaction]);
        if (error) {
          console.warn('Supabase insertion error, proceeding local-only:', error);
        }
      } catch (err) {
        console.warn('Supabase offline or table schema issue, fallback local:', err);
      }
    }

    const updated = [...transactions, newTransaction];
    setTransactions(updated);

    // Filter and update local caches
    saveLocal('local_despesas', updated.filter(t => t.tipoItem === 'despesa'));
    saveLocal('local_receitas', updated.filter(t => t.tipoItem === 'receita'));

    showToast(
      tipoItem === 'despesa'
        ? `Despesa "${descricao}" registrada!`
        : `Receita "${descricao}" injetada com sucesso! 🚀`,
      'sucesso'
    );
  };

  // Delete transaction handler
  const handleDeleteTransaction = async (id: string, tipoItem: 'despesa' | 'receita') => {
    if (!window.confirm('Deseja remover este lançamento permanentemente?')) return;

    if (isOnline) {
      try {
        const table = tipoItem === 'despesa' ? 'fin_despesas' : 'fin_receitas';
        const { error } = await supabase.from(table).delete().eq('id', id);
        if (error) {
          console.warn('Supabase delete error:', error);
        }
      } catch (err) {
        console.warn('Supabase connectivity issue during delete, fallback local:', err);
      }
    }

    const updated = transactions.filter((t) => t.id !== id);
    setTransactions(updated);

    saveLocal('local_despesas', updated.filter(t => t.tipoItem === 'despesa'));
    saveLocal('local_receitas', updated.filter(t => t.tipoItem === 'receita'));

    showToast('Lançamento removido com sucesso!', 'info');
  };

  // Add dream/project planner handler
  const handleAddProject = async (nome: string, valor: number, dataAlvo: string) => {
    const newProj: Project = {
      id: crypto.randomUUID(),
      nome,
      valor,
      dataAlvo
    };

    if (isOnline) {
      try {
        const { error } = await supabase.from('fin_projetos').insert([newProj]);
        if (error) console.warn('Supabase projects insertion error:', error);
      } catch (err) {
        console.warn('Could not insert project on Supabase, fallback local:', err);
      }
    }

    const updated = [...projects, newProj];
    setProjects(updated);
    saveLocal('local_projects', updated);

    showToast(`Sonho "${nome}" projetado com sucesso! 🚀`, 'sucesso');
  };

  // Delete project handler
  const handleDeleteProject = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja apagar essa meta do seu planejador de sonhos?')) return;

    if (isOnline) {
      try {
        const { error } = await supabase.from('fin_projetos').delete().eq('id', id);
        if (error) console.warn('Supabase dream deletion error:', error);
      } catch (err) {
        console.warn('Supabase project delete issue, fallback local:', err);
      }
    }

    const updated = projects.filter((p) => p.id !== id);
    setProjects(updated);
    saveLocal('local_projects', updated);

    showToast('Projeto de meta deletado.', 'info');
  };

  // --- STATS ANALYSERS ---

  const currentYear = dataAncorada.getFullYear();
  const currentMonth = dataAncorada.getMonth();

  // Filter list by currently selected month of the year
  const currentMonthTransactions = transactions.filter((t) => {
    const d = new Date(t.data);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  const despesasMes = currentMonthTransactions.filter((t) => t.tipoItem === 'despesa');
  const totalDespesasMes = despesasMes.reduce((acc, t) => acc + t.valor, 0);

  const receitasMes = currentMonthTransactions.filter((t) => t.tipoItem === 'receita');
  const totalReceitasMes = receitasMes.reduce((acc, t) => acc + t.valor, 0);

  // Expected cash surplus at the end of the month
  const saldoProjetadoFimDoMes = totalReceitasMes - totalDespesasMes;

  // Real Accumulative Total balance across ALL entries in database
  const saldoRealAcumulado =
    transactions.filter((t) => t.tipoItem === 'receita').reduce((s, t) => s + t.valor, 0) -
    transactions.filter((t) => t.tipoItem === 'despesa').reduce((s, t) => s + t.valor, 0);

  // Active Logging Streak Score
  const computeStreak = () => {
    const dates = transactions.map((t) => t.data).filter(Boolean);
    if (dates.length === 0) return 0;

    const uniqueSorted = Array.from(new Set(dates)).sort(
      (a: string, b: string) => new Date(b).getTime() - new Date(a).getTime()
    );

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

    if (uniqueSorted[0] < yesterdayStr && uniqueSorted[0] !== todayStr) {
      return 0;
    }

    let streak = 0;
    const trackingDate = new Date(uniqueSorted[0] + 'T12:00:00');

    for (let i = 0; i < uniqueSorted.length; i++) {
      const expectationStr = formatLocalDate(trackingDate);
      if (uniqueSorted[i] === expectationStr) {
        streak++;
        trackingDate.setDate(trackingDate.getDate() - 1);
      } else {
        break;
      }
    }
    return streak;
  };

  const streak = computeStreak();

  // Check if anything has been logged today
  const checkLoggedToday = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    return transactions.some((t) => t.data === todayStr);
  };

  const loggedToday = checkLoggedToday();

  // Dreams overall progress ratio compared to real accumulative total balance
  const totalDreamCost = projects.reduce((sum, p) => sum + p.valor, 0);
  const dreamsProgressRatio =
    totalDreamCost > 0 ? Math.min((saldoRealAcumulado / totalDreamCost) * 100, 100) : 0;

  // Formatting helper
  const formatCurrency = (val: number) => {
    return `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const handleSubPanelToggle = (type: SubPainelType) => {
    setSubpainelAberto((prev) => (prev === type ? null : type));
    // Slide beautifully down to view if activated
    if (subpainelAberto !== type) {
      setTimeout(() => {
        const sub = document.getElementById('container-subpaineis');
        if (sub) sub.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);
    }
  };

  return (
    <div className="bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 min-h-screen font-sans antialiased transition-all duration-300 pb-20 md:pb-6 relative">
      {/* TOAST SYSTEM ALERTS STREAM */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none flex flex-col gap-2.5 w-full max-w-sm px-6">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg border text-xs font-black transition-all duration-300 transform translate-y-0 opacity-100 pointer-events-auto bg-white dark:bg-slate-900 ${
              t.type === 'sucesso'
                ? 'border-emerald-200 dark:border-emerald-950 text-emerald-600 dark:text-emerald-400'
                : t.type === 'erro'
                ? 'border-red-200 dark:border-red-950 text-red-650 dark:text-red-420'
                : 'border-blue-200 dark:border-blue-950 text-blue-600 dark:text-blue-400'
            }`}
          >
            <div className={`w-2 h-2 rounded-full ${t.type === 'sucesso' ? 'bg-emerald-500' : t.type === 'erro' ? 'bg-red-500' : 'bg-blue-500'} animate-ping`} />
            <span>{t.msg}</span>
          </div>
        ))}
      </div>

      {/* HEADER BAR */}
      <header className="w-full bg-white border-b border-slate-200 dark:bg-slate-900 dark:border-slate-800 p-4 sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-purple-600 flex items-center justify-center text-white font-black text-base shadow-md shadow-purple-500/20 uppercase tracking-tight">
              F
            </div>
            <div>
              <h1 className="text-base font-black tracking-tight flex items-center gap-1 text-slate-800 dark:text-white">
                Fintech<span className="text-purple-600">Core</span>
                <span className="text-[9px] px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 rounded-md font-bold uppercase ml-1">
                  v5.0 – React
                </span>
              </h1>
            </div>
            {isOnline ? (
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 ml-1.5" title="Supabase Conectado" />
            ) : (
              <span className="inline-block w-2 h-2 rounded-full bg-amber-500 ml-1.5" title="Modo Local Ativo" />
            )}
          </div>

          <div className="flex items-center justify-between w-full sm:w-auto gap-3">
            <div className="flex items-center bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800 flex-1 sm:flex-none">
              <button
                onClick={prevMonth}
                className="p-1.5 hover:bg-white dark:hover:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400 cursor-pointer hover:shadow-2xs transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-black px-3 min-w-[110px] text-center text-slate-700 dark:text-slate-350 tracking-tight">
                {MONTHS[currentMonth]} {currentYear}
              </span>
              <button
                onClick={nextMonth}
                className="p-1.5 hover:bg-white dark:hover:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400 cursor-pointer hover:shadow-2xs transition-all"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={resetToToday}
                className="text-[10px] bg-white dark:bg-slate-800 px-2 py-1.5 rounded-lg ml-1.5 hover:bg-slate-200 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 font-bold transition-all hover:shadow-3xs cursor-pointer"
              >
                Hoje
              </button>
            </div>

            {/* FLAME STREAK DIARIO METEORS */}
            <button
              onClick={() => setIsStreakModalOpen(true)}
              title="Clique para ver níveis, medalhas e resumo"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black border transition-all duration-300 cursor-pointer active:scale-95 ${
                streak > 0
                  ? 'bg-amber-50/70 border-amber-200 text-amber-600 dark:bg-amber-950/20 dark:border-amber-900/40 dark:text-amber-400 hover:bg-amber-100/80 dark:hover:bg-amber-950/30 hover:border-amber-300 dark:hover:border-amber-800 hover:scale-[1.03] shadow-3xs'
                  : 'bg-slate-100 dark:bg-slate-950 text-slate-400 dark:text-slate-600 border-slate-250 dark:border-slate-800/80 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 hover:border-slate-300 dark:hover:border-slate-700 shadow-inner'
              }`}
            >
              <Flame className={`w-3.5 h-3.5 ${streak > 0 ? 'fill-amber-500 text-amber-500 animate-pulse' : ''}`} />
              <span>{streak} {streak === 1 ? 'dia' : 'dias'}</span>
            </button>

            {/* PWA INSTALL TRIGGER */}
            {deferredPrompt && (
              <button
                onClick={triggerInstallApp}
                className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-xl text-xs font-black transition-all cursor-pointer shadow-sm hover:scale-[1.02] active:scale-95 border border-emerald-400/20"
                title="Instalar FintechCore como aplicativo"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Instalar App</span>
              </button>
            )}

            {/* LIGHT/DARK MODE TOGGLE */}
            <button
              onClick={toggleTheme}
              className="p-2.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl hover:shadow-2xs cursor-pointer text-slate-500 dark:text-slate-400 transition-all font-bold"
            >
              {isDarkMode ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-slate-600" />}
            </button>
          </div>
        </div>
      </header>

      {/* CENTER STAGE CONTAINER */}
      <main className="max-w-7xl mx-auto px-4 md:px-6 mt-5 space-y-6">
        {/* ROW 1: MOBILE ADAPTATIVE SHEETS */}
        <div className={mobileTabActive === 'dashboard' ? 'block' : 'hidden md:block'}>
          <div className="space-y-4">
            {/* NUDGING DAILY FOCUS FEEDBACK */}
            <NudgeBanner streak={streak} registrouHoje={loggedToday} />

            {/* PREMIUM METRIC CARDS GRID */}
            <section className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
              <MetricCard
                id="card-saldo-real"
                title="Disponível Hoje"
                value={formatCurrency(saldoRealAcumulado)}
                subValue="Clique para o limite diário"
                icon={Wallet}
                borderColor="border-l-[4.5px] border-l-slate-200 dark:border-l-slate-800 hover:border-l-emerald-500"
                activeBorderColor="border-l-emerald-500"
                iconColor="text-emerald-500"
                isActive={subpainelAberto === 'saldo-real'}
                onClick={() => handleSubPanelToggle('saldo-real')}
                activeRingColor="ring-2 ring-emerald-500/40 dark:ring-emerald-500/30 border-emerald-400/40 dark:border-emerald-800"
              />
              <MetricCard
                id="card-saldo"
                title="Projeção Fim do Mês"
                value={formatCurrency(saldoProjetadoFimDoMes)}
                subValue="Clique para regramento"
                icon={TrendingUp}
                borderColor={saldoProjetadoFimDoMes < 0 ? 'border-l-[4.5px] border-l-slate-200 dark:border-l-slate-800 hover:border-l-red-500' : 'border-l-[4.5px] border-l-slate-200 dark:border-l-slate-800 hover:border-l-purple-500'}
                activeBorderColor={saldoProjetadoFimDoMes < 0 ? 'border-l-red-500' : 'border-l-purple-500'}
                iconColor="text-purple-500"
                isActive={subpainelAberto === 'saldo'}
                onClick={() => handleSubPanelToggle('saldo')}
                activeRingColor={saldoProjetadoFimDoMes < 0 ? 'ring-2 ring-red-500/40 dark:ring-red-500/30 border-red-400/40 dark:border-red-800' : 'ring-2 ring-purple-500/40 dark:ring-purple-500/30 border-purple-400/40 dark:border-purple-800'}
              />
              <MetricCard
                id="card-receitas"
                title="Receitas do Período"
                value={`+ R$ ${totalReceitasMes.toFixed(2)}`}
                subValue="Clique para investir"
                icon={ArrowUpCircle}
                borderColor="border-l-[4.5px] border-l-slate-200 dark:border-l-slate-800 hover:border-l-blue-500"
                activeBorderColor="border-l-blue-500"
                iconColor="text-blue-500"
                isActive={subpainelAberto === 'receitas'}
                onClick={() => handleSubPanelToggle('receitas')}
                activeRingColor="ring-2 ring-blue-500/40 dark:ring-blue-500/30 border-blue-400/40 dark:border-blue-800"
              />
              <MetricCard
                id="card-despesas"
                title="Despesas do Período"
                value={`- R$ ${totalDespesasMes.toFixed(2)}`}
                subValue="Clique para simular cortes"
                icon={ArrowDownCircle}
                borderColor="border-l-[4.5px] border-l-slate-200 dark:border-l-slate-800 hover:border-l-rose-500"
                activeBorderColor="border-l-rose-500"
                iconColor="text-rose-500"
                isActive={subpainelAberto === 'despesas'}
                onClick={() => handleSubPanelToggle('despesas')}
                activeRingColor="ring-2 ring-rose-500/40 dark:ring-rose-500/30 border-rose-400/40 dark:border-rose-800"
              />
              <MetricCard
                id="card-metas"
                title="Consolidação Metas"
                value={`${dreamsProgressRatio.toFixed(0)}%`}
                subValue="Planejador de Sonhos"
                icon={Rocket}
                borderColor="border-l-[4.5px] border-l-slate-200 dark:border-l-slate-800 hover:border-l-indigo-500"
                activeBorderColor="border-l-indigo-500"
                iconColor="text-indigo-500"
                isActive={subpainelAberto === 'metas'}
                onClick={() => handleSubPanelToggle('metas')}
                activeRingColor="ring-2 ring-indigo-500/40 dark:ring-indigo-500/30 border-indigo-400/40 dark:border-indigo-800"
              />
            </section>

            {/* SUBPANELS RICH EXPANSION container */}
            <div id="container-subpaineis" className="w-full">
              <SubPanels
                activeType={subpainelAberto}
                transactions={transactions}
                projects={projects}
                onAddProject={handleAddProject}
                onDeleteProject={handleDeleteProject}
                saldoReal={saldoRealAcumulado}
              />
            </div>
          </div>
        </div>

        {/* ROW 2: TRANSACTIONS ADDITION AND LEDGER HISTORIES */}
        <div className={mobileTabActive === 'transacoes' ? 'block' : 'hidden md:block'}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <TransactionForm
              categorias={categorias}
              onAddTransaction={handleAddTransaction}
              onAddCategory={handleAddCategory}
            />
            <div className="lg:col-span-2">
              <TransactionTable
                transactions={transactions}
                onDeleteTransaction={handleDeleteTransaction}
                categorias={categorias}
                currentMonth={currentMonth}
                currentYear={currentYear}
              />
            </div>
          </div>
        </div>

        {/* ROW 3: VISUAL METRICS ESTATÍSTICA DE CARGA */}
        <div className={mobileTabActive === 'planejador' ? 'block' : 'hidden md:block'}>
          <FinancialCharts
            transactions={transactions}
            categorias={categorias}
            currentMonth={currentMonth}
            currentYear={currentYear}
          />
        </div>
      </main>

      {/* FLOATING ADVISORY AI SERVICES CHATBOT */}
      <PersonalAIAdvisor transactions={transactions} saldoReal={saldoRealAcumulado} />

      {/* SYSTEM METERS BOTTOM NAVIGATION BAR (Exclusively mobile tab bar) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 z-40 flex justify-around py-2.5 md:hidden shadow-lg">
        <button
          onClick={() => setMobileTabActive('dashboard')}
          className={`flex flex-col items-center gap-0.5 transition-all cursor-pointer ${
            mobileTabActive === 'dashboard'
              ? 'text-sky-600 dark:text-sky-405 font-extrabold scale-105 animate-pulse'
              : 'text-slate-400 dark:text-slate-600 hover:text-sky-500'
          }`}
        >
          <Wallet className="w-5 h-5" />
          <span className="text-[10px]">Dashboard</span>
        </button>
        <button
          onClick={() => setMobileTabActive('transacoes')}
          className={`flex flex-col items-center gap-0.5 transition-all cursor-pointer ${
            mobileTabActive === 'transacoes'
              ? 'text-emerald-600 dark:text-emerald-405 font-extrabold scale-105 animate-pulse'
              : 'text-slate-400 dark:text-slate-600 hover:text-emerald-500'
          }`}
        >
          <ArrowUpCircle className="w-5 h-5" />
          <span className="text-[10px]">Lançamentos</span>
        </button>
        <button
          onClick={() => setMobileTabActive('planejador')}
          className={`flex flex-col items-center gap-0.5 transition-all cursor-pointer ${
            mobileTabActive === 'planejador'
              ? 'text-violet-600 dark:text-violet-405 font-extrabold scale-105 animate-pulse'
              : 'text-slate-400 dark:text-slate-600 hover:text-violet-500'
          }`}
        >
          <TrendingUp className="w-5 h-5" />
          <span className="text-[10px]">Gráficos</span>
        </button>
      </nav>

      {/* STREAK REWARDS AND ROSTER MODAL OVERLAY */}
      <StreakModal
        isOpen={isStreakModalOpen}
        onClose={() => setIsStreakModalOpen(false)}
        streak={streak}
        transactions={transactions}
      />
    </div>
  );
}
