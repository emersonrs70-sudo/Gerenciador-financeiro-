import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  Wallet, TrendingUp, ArrowUpCircle, ArrowDownCircle, Rocket,
  ChevronLeft, ChevronRight, Sun, Moon, Flame, Download, User, Sparkles,
  Cloud, RefreshCw, LogIn, LogOut, LayoutDashboard, Receipt, Target,
  Landmark, Tags, Bot, Calendar, CreditCard, BarChart3, Menu, X, Plus,
  Layers, CheckCircle2, ChevronDown
} from 'lucide-react';
import {
  Transaction, Project, SubPainelType, ExtratoFilter, AppNotification, BankAccount, safeRandomUUID, RecurrentRule, getBillMonthForDate
} from './types';
import {
  auth, db, testConnection, loginWithGoogle, logoutUser,
  DEFAULT_CATEGORIES_DESPESA, DEFAULT_CATEGORIES_RECEITA,
  DEFAULT_DESPESAS, DEFAULT_RECEITAS, DEFAULT_PROJETOS, getLocal, saveLocal
} from './lib/firebase';
import {
  migrateLocalDataToFirestore, subscribeToUserFinance,
  addTransactionToFirestore, batchAddTransactionsToFirestore,
  deleteTransactionFromFirestore, updateTransactionInFirestore,
  addProjectToFirestore, deleteProjectFromFirestore,
  saveRecurrentRuleToFirestore, deleteRecurrentRuleFromFirestore
} from './lib/dataSync';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { NudgeBanner } from './components/NudgeBanner';
import { MetricCard } from './components/MetricCard';
import { SubPanels } from './components/SubPanels';
import { TransactionForm } from './components/TransactionForm';
import { TransactionTable } from './components/TransactionTable';
import { FinancialCharts } from './components/FinancialCharts';
import { ExpenseCalendar } from './components/ExpenseCalendar';
import { PersonalAIAdvisor } from './components/PersonalAIAdvisor';
import { StreakModal } from './components/StreakModal';
import { NotificationCenter } from './components/NotificationCenter';
import { CreditCardBills } from './components/CreditCardBills';
import { ImportStatementModal } from './components/ImportStatementModal';
import { FirebaseDomainModal } from './components/FirebaseDomainModal';
import { ManageRecurrentModal } from './components/ManageRecurrentModal';

interface Toast {
  id: string;
  msg: string;
  type: 'sucesso' | 'info' | 'erro';
}

function parseTransactionFromDb(item: any, tipoItem: 'despesa' | 'receita'): Transaction {
  const desc = item.descricao || '';
  const match = desc.match(/(.*?) \| user:(.*)/);
  let cleanDesc = match ? match[1].trim() : desc;

  let accountId = 'santander';
  let faturaMes = undefined;
  let created_at = undefined;

  const accMatch = cleanDesc.match(/\[acc:(.*?)\]/);
  if (accMatch) {
    accountId = accMatch[1];
    if (['nubank', 'itau', 'carteira', 'geral'].includes(accountId)) {
      accountId = 'santander';
    }
    cleanDesc = cleanDesc.replace(/\[acc:(.*?)\]/, '').trim();
  }

  const billMatch = cleanDesc.match(/\[bill:(.*?)\]/);
  if (billMatch) {
    faturaMes = billMatch[1];
    cleanDesc = cleanDesc.replace(/\[bill:(.*?)\]/, '').trim();
  }

  const createdMatch = cleanDesc.match(/\[created:(.*?)\]/);
  if (createdMatch) {
    created_at = createdMatch[1];
    cleanDesc = cleanDesc.replace(/\[created:(.*?)\]/, '').trim();
  }

  return {
    ...item,
    descricao: cleanDesc,
    tipoItem,
    accountId,
    faturaMes,
    created_at: created_at || item.created_at
  };
}

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

function deduplicateTransactions(list: Transaction[]): Transaction[] {
  const seenIds = new Set<string>();
  const seenFingerprints = new Set<string>();
  const result: Transaction[] = [];

  for (const item of list) {
    if (!item) continue;
    
    // 1. Strict ID deduplication
    if (item.id && seenIds.has(item.id)) {
      continue;
    }
    if (item.id) {
      seenIds.add(item.id);
    }

    // 2. Accidental double-submit fingerprint deduplication:
    // Identical description, value, date, type, and account created within a tight 5-second window
    const timestamp = item.created_at ? new Date(item.created_at).getTime() : 0;
    const timeWindow = timestamp > 0 ? Math.floor(timestamp / 5000) : 0;
    const fingerprint = `${item.descricao?.trim()}|${item.valor}|${item.data}|${item.tipoItem}|${item.accountId || 'geral'}|${timeWindow}`;

    if (timeWindow > 0 && seenFingerprints.has(fingerprint)) {
      continue;
    }
    if (timeWindow > 0) {
      seenFingerprints.add(fingerprint);
    }

    result.push(item);
  }

  return result;
}

const DEFAULT_PERSONAL_USER = { email: 'emersonrs70@gmail.com', name: 'Emerson' };

export default function App() {
  // Current user profile (Personal account - access directly without credentials)
  const [currentUser, setCurrentUser] = useState<{ email: string; name: string }>(() => {
    return getLocal<{ email: string; name: string }>('fintech_current_user', DEFAULT_PERSONAL_USER) || DEFAULT_PERSONAL_USER;
  });

  // Calendar Anchored date
  const [dataAncorada, setDataAncorada] = useState<Date>(() => new Date());

  // App dataset state
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categoriasDespesa, setCategoriasDespesa] = useState<string[]>(DEFAULT_CATEGORIES_DESPESA);
  const [categoriasReceita, setCategoriasReceita] = useState<string[]>(DEFAULT_CATEGORIES_RECEITA);
  const [projects, setProjects] = useState<Project[]>([]);

  // Bank Accounts state (loaded from cache)
  const [accounts, setAccounts] = useState<BankAccount[]>(() => {
    const cached = getLocal<BankAccount[]>('local_bank_accounts', []);
    if (cached.length === 0 || cached.some(acc => ['nubank', 'itau', 'carteira'].includes(acc.id))) {
      const defaultAccs: BankAccount[] = [
        { id: 'santander', nome: 'Santander', tipo: 'corrente', saldoInicial: 800, cor: 'bg-red-600' },
        { id: 'santander-cartao', nome: 'Santander SX', tipo: 'credito', saldoInicial: 0, cor: 'bg-red-750', limiteCredito: 5000, diaFechamento: 5, diaVencimento: 12 }
      ];
      saveLocal('local_bank_accounts', defaultAccs);
      return defaultAccs;
    }
    return cached;
  });

  const [selectedAccountId, setSelectedAccountId] = useState<string>('consolidado');
  const [isAddAccountModalOpen, setIsAddAccountModalOpen] = useState<boolean>(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  const [novaCatNome, setNovaCatNome] = useState<string>('');
  const [novaCatTipo, setNovaCatTipo] = useState<'despesa' | 'receita'>('despesa');

  // Recurring rules state (continuous recurring expenses)
  const [recurrentRules, setRecurrentRules] = useState<RecurrentRule[]>(() => {
    return getLocal<RecurrentRule[]>(`local_recurrent_rules_${DEFAULT_PERSONAL_USER.email}`, []);
  });
  const [isManageRecurrentModalOpen, setIsManageRecurrentModalOpen] = useState<boolean>(false);

  const handleDeleteAccount = (id: string) => {
    if (accounts.length <= 1) {
      showToast('Você precisa manter pelo menos uma conta ativa!', 'erro');
      return;
    }
    if (window.confirm('Tem certeza que deseja apagar essa conta? Todas as transações vinculadas a ela serão mantidas, mas sem vínculo de conta.')) {
      const updated = accounts.filter(acc => acc.id !== id);
      setAccounts(updated);
      if (selectedAccountId === id) {
        setSelectedAccountId('consolidado');
      }
      showToast('Conta removida com sucesso!', 'sucesso');
    }
  };

  useEffect(() => {
    saveLocal('local_bank_accounts', accounts);
  }, [accounts]);

  // Navigation & View tabs (SaaS Layout Re-architecture)
  const [activeNav, setActiveNav] = useState<'dashboard' | 'transacoes' | 'sonhos' | 'contas' | 'categorias' | 'ia'>('dashboard');
  const [dashboardTab, setDashboardTab] = useState<'geral' | 'graficos' | 'calendario' | 'cartoes'>('geral');
  const [subpainelAberto, setSubpainelAberto] = useState<SubPainelType>(null);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => getLocal<boolean>('app_theme_dark', true));
  const [mobileTabActive, setMobileTabActive] = useState<'dashboard' | 'transacoes' | 'planejador'>('dashboard');
  const [isStreakModalOpen, setIsStreakModalOpen] = useState<boolean>(false);

  // Firebase Cloud & Network status
  const [isOnline, setIsOnline] = useState<boolean>(false);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(() => auth.currentUser);
  const [isSyncingFirebase, setIsSyncingFirebase] = useState<boolean>(false);

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
    const id = safeRandomUUID();
    setToasts((prev) => [...prev, { id, msg, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  };

  // Notifications state initialized from localStorage
  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    return getLocal<AppNotification[]>('local_notifications', [
      {
        id: 'n-welcome',
        titulo: 'Bem-vindo ao FintechCore! 👋',
        mensagem: 'Sua Central de Notificações está ativa! Cadastre receitas e despesas para ver seu orçamento 50-30-20 se desenhar automaticamente.',
        data: new Date().toISOString(),
        lida: false,
        tipo: 'sucesso'
      }
    ]);
  });

  // Helper to send browser & in-app notifications
  const sendSystemNotification = (
    titulo: string,
    mensagem: string,
    tipo: 'alerta' | 'ofensiva' | 'sucesso' | 'info' = 'info'
  ) => {
    const newNotification: AppNotification = {
      id: safeRandomUUID(),
      titulo,
      mensagem,
      data: new Date().toISOString(),
      lida: false,
      tipo
    };

    setNotifications((prev) => {
      const updated = [newNotification, ...prev];
      saveLocal('local_notifications', updated);
      return updated;
    });

    // Mirror to standard visible toasts
    showToast(`${titulo}: ${mensagem}`, tipo === 'alerta' ? 'erro' : 'sucesso');

    // Browser Desktop Notification
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(titulo, {
          body: mensagem,
          icon: '/favicon.ico'
        });
      } catch (err) {
        console.warn('Native notification failed:', err);
      }
    }
  };

  const handleMarkAllRead = () => {
    const updated = notifications.map(n => ({ ...n, lida: true }));
    setNotifications(updated);
    saveLocal('local_notifications', updated);
    showToast('Todas as notificações foram lidas!', 'sucesso');
  };

  const handleMarkRead = (id: string) => {
    const updated = notifications.map(n => n.id === id ? { ...n, lida: true } : n);
    setNotifications(updated);
    saveLocal('local_notifications', updated);
  };

  const handleDeleteNotification = (id: string) => {
    const updated = notifications.filter(n => n.id !== id);
    setNotifications(updated);
    saveLocal('local_notifications', updated);
  };

  const handleClearAllNotifications = () => {
    setNotifications([]);
    saveLocal('local_notifications', []);
    showToast('Histórico de notificações limpo!', 'info');
  };

  const handleSendTestNotification = () => {
    sendSystemNotification(
      '🔔 Notificação Funcional',
      'Excelente! Suas notificações push do FintechCore estão configuradas e funcionando perfeitamente.',
      'sucesso'
    );
  };

  // 1. Initial Data Fetching and Firebase Authentication Listener
  useEffect(() => {
    // Set initial HTML Dark Mode class matching isDarkMode state
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    testConnection().then((connected) => {
      setIsOnline(connected);
    });

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setFirebaseUser(user);
        const userProfile = {
          email: user.email || 'emersonrs70@gmail.com',
          name: user.displayName || user.email?.split('@')[0] || 'Emerson'
        };
        setCurrentUser(userProfile);
        saveLocal('fintech_current_user', userProfile);
        setIsOnline(true);
        setIsSyncingFirebase(true);

        try {
          const { migratedCount } = await migrateLocalDataToFirestore(user.uid, user.email || '', (msg) => {
            showToast(msg, 'info');
          });
          if (migratedCount > 0) {
            showToast(`${migratedCount} registros sincronizados com Firebase Firestore! ☁️`, 'sucesso');
          }
        } catch (e) {
          console.warn('Migration to Firebase error:', e);
        } finally {
          setIsSyncingFirebase(false);
        }
      } else {
        setFirebaseUser(null);
        // Load local cache for personal user
        const cachedDesp = getLocal<Transaction[]>(`local_despesas_${currentUser.email}`, []);
        const cachedRec = getLocal<Transaction[]>(`local_receitas_${currentUser.email}`, []);
        const cachedProj = getLocal<Project[]>(`local_projects_${currentUser.email}`, []);
        const cachedCatDesp = getLocal<string[]>(`local_categorias_despesa_${currentUser.email}`, DEFAULT_CATEGORIES_DESPESA);
        const cachedCatRec = getLocal<string[]>(`local_categorias_receita_${currentUser.email}`, DEFAULT_CATEGORIES_RECEITA);

        if (cachedDesp.length === 0 && cachedRec.length === 0 && !localStorage.getItem(`fintech_initialized_${currentUser.email}`)) {
          // Initialize with default template data
          const baseTime = Date.now();
          const initDesp = DEFAULT_DESPESAS.map((d, index) => ({
            ...d,
            id: safeRandomUUID(),
            accountId: (index === 2 || index === 3) ? 'santander-cartao' : 'santander',
            faturaMes: (index === 2 || index === 3) ? '2026-07' : undefined,
            created_at: new Date(baseTime + index * 1000).toISOString()
          }));
          const initRec = DEFAULT_RECEITAS.map((r, index) => ({
            ...r,
            id: safeRandomUUID(),
            accountId: 'santander',
            created_at: new Date(baseTime + (index + 10) * 1000).toISOString()
          }));
          const initProj = DEFAULT_PROJETOS.map(p => ({ ...p, id: safeRandomUUID() }));
          setTransactions([...initDesp, ...initRec]);
          setProjects(initProj);
          setCategoriasDespesa(DEFAULT_CATEGORIES_DESPESA);
          setCategoriasReceita(DEFAULT_CATEGORIES_RECEITA);
          saveLocal(`local_despesas_${currentUser.email}`, initDesp);
          saveLocal(`local_receitas_${currentUser.email}`, initRec);
          saveLocal(`local_projects_${currentUser.email}`, initProj);
          localStorage.setItem(`fintech_initialized_${currentUser.email}`, 'true');
        } else {
          const dedupedCached = deduplicateTransactions([...cachedDesp, ...cachedRec]);
          setTransactions(dedupedCached);
          setProjects(cachedProj);
          setCategoriasDespesa(cachedCatDesp);
          setCategoriasReceita(cachedCatRec);
          const cachedRules = getLocal<RecurrentRule[]>(`local_recurrent_rules_${currentUser.email}`, []);
          setRecurrentRules(cachedRules);
        }
      }
    });

    return () => unsubscribe();
  }, [isDarkMode]);

  // 2. Real-time Firestore sync subscriber for authenticated user
  useEffect(() => {
    if (!firebaseUser) return;

    const unsubscribe = subscribeToUserFinance(firebaseUser.uid, {
      onTransactions: (liveTransactions) => {
        if (liveTransactions.length > 0) {
          const deduped = deduplicateTransactions(liveTransactions);
          // Auto-clean any duplicate Firestore documents if detected
          if (deduped.length < liveTransactions.length) {
            const keepIds = new Set(deduped.map(t => t.id));
            const duplicatesToRemove = liveTransactions.filter(t => !keepIds.has(t.id));
            duplicatesToRemove.forEach(dup => {
              if (dup.id) {
                deleteTransactionFromFirestore(firebaseUser.uid, dup.id).catch(() => {});
              }
            });
          }
          setTransactions(deduped);
          saveLocal(`local_despesas_${currentUser.email}`, deduped.filter(t => t.tipoItem === 'despesa'));
          saveLocal(`local_receitas_${currentUser.email}`, deduped.filter(t => t.tipoItem === 'receita'));
        }
      },
      onProjects: (liveProjects) => {
        if (liveProjects.length > 0) {
          setProjects(liveProjects);
          saveLocal(`local_projects_${currentUser.email}`, liveProjects);
        }
      },
      onAccounts: (liveAccounts) => {
        if (liveAccounts.length > 0) {
          setAccounts(liveAccounts);
          saveLocal('local_bank_accounts', liveAccounts);
        }
      },
      onRecurrentRules: (liveRules) => {
        setRecurrentRules(liveRules);
        saveLocal(`local_recurrent_rules_${currentUser.email}`, liveRules);
      },
      onError: (err) => {
        console.warn('Real-time sync notice:', err);
      }
    });

    return () => unsubscribe();
  }, [firebaseUser, currentUser.email]);

  const [domainModalError, setDomainModalError] = useState<{ isOpen: boolean; code?: string; message?: string }>({
    isOpen: false
  });

  // Google Login and Logout triggers
  const handleGoogleLogin = async () => {
    try {
      setIsSyncingFirebase(true);
      const user = await loginWithGoogle();
      showToast(`Bem-vindo, ${user.displayName || 'Usuário'}! Conectado ao Firebase.`, 'sucesso');
    } catch (err: any) {
      console.error('Google Sign-in error:', err);
      const errCode = err?.code || '';
      const errMsg = err?.message || '';

      if (errCode === 'auth/unauthorized-domain' || errMsg.includes('unauthorized-domain')) {
        setDomainModalError({
          isOpen: true,
          code: 'auth/unauthorized-domain',
          message: 'Domínio do GitHub não está na lista de autorizados do Firebase.'
        });
        showToast('Domínio não autorizado no Firebase. Abrindo guia de configuração...', 'erro');
      } else if (errCode === 'auth/popup-blocked') {
        showToast('Pop-up de login bloqueado pelo navegador. Por favor, permita pop-ups nesta página.', 'erro');
      } else if (errCode === 'auth/popup-closed-by-user') {
        showToast('Login cancelado: janela do Google fechada antes da confirmação.', 'info');
      } else if (errCode === 'auth/network-request-failed') {
        showToast('Falha de rede ao tentar conectar com os servidores do Google/Firebase.', 'erro');
      } else {
        showToast(`Falha ao conectar com o Google (${errCode || 'erro'}).`, 'erro');
      }
    } finally {
      setIsSyncingFirebase(false);
    }
  };

  const handleGoogleLogout = async () => {
    try {
      await logoutUser();
      setFirebaseUser(null);
      showToast('Desconectado do Firebase.', 'info');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

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

  const selectMonth = (monthIndex: number) => {
    setDataAncorada((prev) => {
      const next = new Date(prev);
      next.setMonth(monthIndex);
      return next;
    });
  };

  const resetToToday = () => {
    setDataAncorada(new Date());
  };

  // --- CRUD ACTIONS ---

  // Add category handler
  const handleAddCategory = async (nome: string, tipoItem: 'despesa' | 'receita') => {
    if (tipoItem === 'despesa') {
      const updated = [...categoriasDespesa, nome];
      setCategoriasDespesa(updated);
      saveLocal(`local_categorias_despesa_${currentUser!.email}`, updated);
    } else {
      const updated = [...categoriasReceita, nome];
      setCategoriasReceita(updated);
      saveLocal(`local_categorias_receita_${currentUser!.email}`, updated);
    }
    showToast(`Categoria "${nome}" adicionada com sucesso!`, 'sucesso');
  };

  // Delete category handler
  const handleDeleteCategory = async (nome: string, tipoItem: 'despesa' | 'receita') => {
    if (tipoItem === 'despesa') {
      const updated = categoriasDespesa.filter(c => c !== nome);
      setCategoriasDespesa(updated);
      saveLocal(`local_categorias_despesa_${currentUser!.email}`, updated);
    } else {
      const updated = categoriasReceita.filter(c => c !== nome);
      setCategoriasReceita(updated);
      saveLocal(`local_categorias_receita_${currentUser!.email}`, updated);
    }
    showToast(`Categoria "${nome}" removida com sucesso!`, 'sucesso');
  };

  // Add transaction (despesa or receita) handler
  const handleAddTransaction = async (
    descricao: string,
    valor: number,
    data: string,
    categoria: string,
    tipoItem: 'despesa' | 'receita',
    accountId: string = 'geral',
    faturaMes?: string
  ) => {
    const transactionId = safeRandomUUID();
    const newTransaction: Transaction = {
      id: transactionId,
      descricao,
      valor,
      data,
      categoria,
      tipoItem,
      accountId,
      faturaMes,
      created_at: new Date().toISOString()
    };

    if (firebaseUser) {
      try {
        await addTransactionToFirestore(firebaseUser.uid, newTransaction);
      } catch (err) {
        console.warn('Firebase transaction insertion error, saving locally:', err);
      }
    }

    setTransactions(prev => {
      if (prev.some(t => t.id === newTransaction.id)) {
        return prev;
      }
      const updated = deduplicateTransactions([...prev, newTransaction]);
      saveLocal(`local_despesas_${currentUser!.email}`, updated.filter(t => t.tipoItem === 'despesa'));
      saveLocal(`local_receitas_${currentUser!.email}`, updated.filter(t => t.tipoItem === 'receita'));
      return updated;
    });

    showToast(
      tipoItem === 'despesa'
        ? `Despesa "${descricao}" registrada!`
        : `Receita "${descricao}" injetada com sucesso! 🚀`,
      'sucesso'
    );
  };

  // Batch add transactions from statement import
  const handleBatchAddTransactions = async (
    newItems: Array<{
      descricao: string;
      valor: number;
      data: string;
      categoria: string;
      tipoItem: 'despesa' | 'receita';
      accountId: string;
      faturaMes?: string;
    }>
  ) => {
    if (newItems.length === 0) return;

    const baseTime = Date.now();
    const createdTransactions: Transaction[] = newItems.map((item, index) => {
      const transactionId = safeRandomUUID();
      const createdAt = new Date(baseTime + index * 50).toISOString();
      return {
        id: transactionId,
        descricao: item.descricao,
        valor: item.valor,
        data: item.data,
        categoria: item.categoria,
        tipoItem: item.tipoItem,
        accountId: item.accountId || 'santander',
        faturaMes: item.faturaMes,
        created_at: createdAt
      };
    });

    if (firebaseUser) {
      try {
        await batchAddTransactionsToFirestore(firebaseUser.uid, createdTransactions);
      } catch (err) {
        console.warn('Batch insert Firebase error, fallback local:', err);
      }
    }

    setTransactions(prev => {
      const existingIds = new Set(prev.map(t => t.id));
      const freshItems = createdTransactions.filter(t => !existingIds.has(t.id));
      if (freshItems.length === 0) return prev;
      const updated = deduplicateTransactions([...prev, ...freshItems]);
      saveLocal(`local_despesas_${currentUser!.email}`, updated.filter(t => t.tipoItem === 'despesa'));
      saveLocal(`local_receitas_${currentUser!.email}`, updated.filter(t => t.tipoItem === 'receita'));
      return updated;
    });

    showToast(`${createdTransactions.length} movimentações do extrato importadas com sucesso! 🎉`, 'sucesso');
    sendSystemNotification(
      'Extrato Importado',
      `Foram lançadas ${createdTransactions.length} movimentações no seu controle financeiro.`,
      'sucesso'
    );
  };

  // Delete transaction handler
  const handleDeleteTransaction = async (id: string, tipoItem: 'despesa' | 'receita') => {
    if (!window.confirm('Deseja remover este lançamento permanentemente?')) return;

    if (firebaseUser) {
      try {
        await deleteTransactionFromFirestore(firebaseUser.uid, id);
      } catch (err) {
        console.warn('Firebase delete error, fallback local:', err);
      }
    }

    const updated = transactions.filter((t) => t.id !== id);
    setTransactions(updated);

    saveLocal(`local_despesas_${currentUser!.email}`, updated.filter(t => t.tipoItem === 'despesa'));
    saveLocal(`local_receitas_${currentUser!.email}`, updated.filter(t => t.tipoItem === 'receita'));

    showToast('Lançamento removido com sucesso!', 'info');
  };

  // Update transaction handler
  const handleUpdateTransaction = async (
    id: string,
    tipoItem: 'despesa' | 'receita',
    updatedData: { descricao: string; valor: number; data: string; categoria: string; accountId?: string; faturaMes?: string }
  ) => {
    const existing = transactions.find(t => t.id === id);
    const updatedTransaction: Transaction = {
      id,
      descricao: updatedData.descricao,
      valor: updatedData.valor,
      data: updatedData.data,
      categoria: updatedData.categoria,
      tipoItem,
      accountId: updatedData.accountId || existing?.accountId || 'santander',
      faturaMes: updatedData.faturaMes || existing?.faturaMes,
      created_at: existing?.created_at || new Date().toISOString()
    };

    if (firebaseUser) {
      try {
        await updateTransactionInFirestore(firebaseUser.uid, updatedTransaction);
      } catch (err) {
        console.warn('Firebase update error, fallback local:', err);
      }
    }

    const updated = transactions.map((t) => (t.id === id ? updatedTransaction : t));
    setTransactions(updated);

    saveLocal(`local_despesas_${currentUser!.email}`, updated.filter((t) => t.tipoItem === 'despesa'));
    saveLocal(`local_receitas_${currentUser!.email}`, updated.filter((t) => t.tipoItem === 'receita'));

    showToast('Lançamento atualizado com sucesso!', 'sucesso');
  };

  // Add continuous recurring rule
  const handleAddRecurrentRule = async (ruleData: Omit<RecurrentRule, 'id' | 'criadaEm'>) => {
    const newRule: RecurrentRule = {
      ...ruleData,
      id: safeRandomUUID(),
      criadaEm: new Date().toISOString()
    };

    if (firebaseUser) {
      try {
        await saveRecurrentRuleToFirestore(firebaseUser.uid, newRule);
      } catch (err) {
        console.warn('Firebase recurrent rule save error:', err);
      }
    }

    setRecurrentRules(prev => {
      const updated = [...prev.filter(r => r.id !== newRule.id), newRule];
      saveLocal(`local_recurrent_rules_${currentUser.email}`, updated);
      return updated;
    });

    showToast(`Lançamento fixo "${newRule.descricao}" configurado para repetir todo início de mês! 🔁`, 'sucesso');
  };

  // Toggle active/paused for continuous recurring rule
  const handleToggleRecurrentRule = async (ruleId: string) => {
    const rule = recurrentRules.find(r => r.id === ruleId);
    if (!rule) return;

    const updatedRule: RecurrentRule = {
      ...rule,
      ativa: !rule.ativa
    };

    if (firebaseUser) {
      try {
        await saveRecurrentRuleToFirestore(firebaseUser.uid, updatedRule);
      } catch (err) {
        console.warn('Firebase recurrent rule toggle error:', err);
      }
    }

    setRecurrentRules(prev => {
      const updated = prev.map(r => r.id === ruleId ? updatedRule : r);
      saveLocal(`local_recurrent_rules_${currentUser.email}`, updated);
      return updated;
    });

    showToast(
      updatedRule.ativa
        ? `Lançamento fixo "${rule.descricao}" reativado!`
        : `Lançamento fixo "${rule.descricao}" pausado!`,
      'info'
    );
  };

  // Delete continuous recurring rule
  const handleDeleteRecurrentRule = async (ruleId: string) => {
    const rule = recurrentRules.find(r => r.id === ruleId);
    if (!rule) return;

    if (!window.confirm(`Deseja remover a regra de lançamento fixo de "${rule.descricao}"? As transações já geradas anteriormente serão mantidas.`)) {
      return;
    }

    if (firebaseUser) {
      try {
        await deleteRecurrentRuleFromFirestore(firebaseUser.uid, ruleId);
      } catch (err) {
        console.warn('Firebase recurrent rule delete error:', err);
      }
    }

    setRecurrentRules(prev => {
      const updated = prev.filter(r => r.id !== ruleId);
      saveLocal(`local_recurrent_rules_${currentUser.email}`, updated);
      return updated;
    });

    showToast(`Regra de "${rule.descricao}" excluída com sucesso!`, 'info');
  };

  // Add dream/project planner handler
  const handleAddProject = async (nome: string, valor: number, dataAlvo: string) => {
    const projectId = safeRandomUUID();
    const newProj: Project = {
      id: projectId,
      nome,
      valor,
      dataAlvo
    };

    if (firebaseUser) {
      try {
        await addProjectToFirestore(firebaseUser.uid, newProj);
      } catch (err) {
        console.warn('Could not insert project on Firebase, fallback local:', err);
      }
    }

    const updated = [...projects, newProj];
    setProjects(updated);
    saveLocal(`local_projects_${currentUser!.email}`, updated);

    showToast(`Sonho "${nome}" projetado com sucesso! 🚀`, 'sucesso');
  };

  // Delete project handler
  const handleDeleteProject = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja apagar essa meta do seu planejador de sonhos?')) return;

    if (firebaseUser) {
      try {
        await deleteProjectFromFirestore(firebaseUser.uid, id);
      } catch (err) {
        console.warn('Firebase project delete issue, fallback local:', err);
      }
    }

    const updated = projects.filter((p) => p.id !== id);
    setProjects(updated);
    saveLocal(`local_projects_${currentUser!.email}`, updated);

    showToast('Projeto de meta deletado.', 'info');
  };

  // --- STATS ANALYSERS ---

  const currentYear = dataAncorada.getFullYear();
  const currentMonth = dataAncorada.getMonth();

  // Automated monthly generation of active continuous recurring expenses
  useEffect(() => {
    if (recurrentRules.length === 0) return;

    const currentYearMonth = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
    const newTransactionsToCreate: Transaction[] = [];
    const updatedRules: RecurrentRule[] = [];

    for (const rule of recurrentRules) {
      if (!rule.ativa) {
        updatedRules.push(rule);
        continue;
      }

      // Check if a transaction for this rule already exists in current month/year
      const alreadyHasInMonth = transactions.some(t => {
        if (!t.data || t.data.substring(0, 7) !== currentYearMonth) return false;
        return (
          t.descricao.toLowerCase().includes(rule.descricao.toLowerCase()) &&
          Math.abs(t.valor - rule.valor) < 0.01 &&
          t.tipoItem === rule.tipoItem
        );
      });

      if (!alreadyHasInMonth) {
        const maxDays = new Date(currentYear, currentMonth + 1, 0).getDate();
        const dayToUse = Math.min(rule.diaDoMes || 1, maxDays);
        const mm = String(currentMonth + 1).padStart(2, '0');
        const dd = String(dayToUse).padStart(2, '0');
        const dateStr = `${currentYear}-${mm}-${dd}`;

        const account = accounts.find(a => a.id === rule.accountId);
        let faturaMesForDate: string | undefined = undefined;
        if (account && account.tipo === 'credito') {
          faturaMesForDate = getBillMonthForDate(dateStr, account.diaFechamento);
        }

        const newTx: Transaction = {
          id: safeRandomUUID(),
          descricao: `${rule.descricao} (${mm}/${currentYear})`,
          valor: rule.valor,
          data: dateStr,
          categoria: rule.categoria,
          tipoItem: rule.tipoItem,
          accountId: rule.accountId,
          faturaMes: faturaMesForDate,
          created_at: new Date().toISOString()
        };

        newTransactionsToCreate.push(newTx);
        updatedRules.push({
          ...rule,
          ultimoMesGerado: currentYearMonth
        });
      } else {
        updatedRules.push(rule);
      }
    }

    if (newTransactionsToCreate.length > 0) {
      if (firebaseUser) {
        batchAddTransactionsToFirestore(firebaseUser.uid, newTransactionsToCreate).catch(console.warn);
      }
      setTransactions(prev => {
        const updated = deduplicateTransactions([...prev, ...newTransactionsToCreate]);
        saveLocal(`local_despesas_${currentUser.email}`, updated.filter(t => t.tipoItem === 'despesa'));
        saveLocal(`local_receitas_${currentUser.email}`, updated.filter(t => t.tipoItem === 'receita'));
        return updated;
      });

      setRecurrentRules(updatedRules);
      saveLocal(`local_recurrent_rules_${currentUser.email}`, updatedRules);
      if (firebaseUser) {
        updatedRules.forEach(r => saveRecurrentRuleToFirestore(firebaseUser.uid, r).catch(console.warn));
      }

      showToast(`${newTransactionsToCreate.length} lançamento(s) fixo(s) gerado(s) automaticamente para ${MONTHS[currentMonth]}! 📅`, 'sucesso');
    }
  }, [currentMonth, currentYear, recurrentRules.length, firebaseUser]);

  // --- MULTIBANCO ACCOUNT CALCULATORS ---
  const getAccountBalances = () => {
    const balances: { [accId: string]: number } = {};
    accounts.forEach((acc) => {
      if (acc.tipo === 'credito') {
        const cardExpenses = transactions.filter(t => t.accountId === acc.id && t.tipoItem === 'despesa').reduce((sum, t) => sum + t.valor, 0);
        const cardPayments = transactions.filter(t => t.accountId === acc.id && t.tipoItem === 'receita').reduce((sum, t) => sum + t.valor, 0);
        balances[acc.id] = cardExpenses - cardPayments; // spent amount
      } else {
        const income = transactions.filter(t => t.accountId === acc.id && t.tipoItem === 'receita').reduce((sum, t) => sum + t.valor, 0);
        const expenses = transactions.filter(t => t.accountId === acc.id && t.tipoItem === 'despesa').reduce((sum, t) => sum + t.valor, 0);
        balances[acc.id] = acc.saldoInicial + income - expenses;
      }
    });
    return balances;
  };

  const accountBalances = getAccountBalances();

  // Consolidated checking/savings accounts cash
  const totalCashConsolidated = accounts
    .filter(acc => acc.tipo !== 'credito')
    .reduce((sum, acc) => sum + (accountBalances[acc.id] ?? 0), 0);

  // Consolidated credit cards spent
  const totalCardSpentConsolidated = accounts
    .filter(acc => acc.tipo === 'credito')
    .reduce((sum, acc) => sum + (accountBalances[acc.id] ?? 0), 0);

  // Derive metrics depending on selected account tab
  const activeAccount = accounts.find((a) => a.id === selectedAccountId);

  // Filter the transactions depending on active tab
  const displayedTransactions = selectedAccountId === 'consolidado'
    ? transactions
    : transactions.filter((t) => t.accountId === selectedAccountId);

  // Filter list by currently selected month of the year
  const currentMonthTransactions = displayedTransactions.filter((t) => {
    if (!t.data) return false;
    const parts = t.data.split('-');
    if (parts.length < 3) return false;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // Convert 1-12 to 0-11
    return month === currentMonth && year === currentYear;
  });

  // For consolidated views, we ignore credit card transactions when computing monthly cash flow metrics (revenues, expenses, and end-of-month projection)
  const periodTransactionsForCashFlow = currentMonthTransactions.filter((t) => {
    if (selectedAccountId === 'consolidado') {
      const acc = accounts.find((a) => a.id === t.accountId);
      return !acc || acc.tipo !== 'credito';
    }
    return true;
  });

  const despesasMes = periodTransactionsForCashFlow.filter((t) => t.tipoItem === 'despesa');
  const totalDespesasMes = despesasMes.reduce((acc, t) => acc + t.valor, 0);

  const receitasMes = periodTransactionsForCashFlow.filter((t) => t.tipoItem === 'receita');
  const totalReceitasMes = receitasMes.reduce((acc, t) => acc + t.valor, 0);

  // Expected cash surplus at the end of the month
  const saldoProjetadoFimDoMes = totalReceitasMes - totalDespesasMes;

  // Real available cash or available credit depending on active account selection
  let saldoRealAcumulado = totalCashConsolidated;
  if (selectedAccountId !== 'consolidado' && activeAccount) {
    if (activeAccount.tipo === 'credito') {
      saldoRealAcumulado = Math.max((activeAccount.limiteCredito || 0) - (accountBalances[activeAccount.id] ?? 0), 0);
    } else {
      saldoRealAcumulado = accountBalances[activeAccount.id] ?? 0;
    }
  }

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

  // Automated budget & streak rules checks
  useEffect(() => {
    if (transactions.length === 0) return;

    const todayStr = new Date().toISOString().split('T')[0];

    // 1. Streak Alert (Lembrete de Registro Diário)
    const alreadyStreakWarned = notifications.some(
      (n) => n.tipo === 'ofensiva' && n.data.startsWith(todayStr)
    );
    if (!loggedToday && !alreadyStreakWarned) {
      sendSystemNotification(
        '🔥 Ofensiva em Risco!',
        'Você ainda não registrou transações hoje! Registre despesas ou receitas para manter seu streak ativo.',
        'ofensiva'
      );
    }

    // 2. Budget Thresholds Warning (50-30-20 Rules)
    const currentMonthTrans = transactions.filter((t) => {
      if (!t.data) return false;
      const parts = t.data.split('-');
      if (parts.length < 3) return false;
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      return month === currentMonth && year === currentYear;
    });

    const totalIncome = currentMonthTrans.filter(t => t.tipoItem === 'receita').reduce((s, t) => s + t.valor, 0);
    const despesasMes = currentMonthTrans.filter(t => t.tipoItem === 'despesa');

    const needsCategories = ['moradia', 'alimentação', 'alimentacao', 'transporte', 'saúde', 'saude', 'educação', 'educacao', 'contas'];
    const actualNeeds = despesasMes
      .filter((d) => needsCategories.includes(d.categoria.toLowerCase()))
      .reduce((s, d) => s + d.valor, 0);
      
    const actualWants = despesasMes
      .filter((d) => !needsCategories.includes(d.categoria.toLowerCase()))
      .reduce((s, d) => s + d.valor, 0);

    const incomeBase = totalIncome === 0 ? 5000 : totalIncome;
    const idealNeeds = incomeBase * 0.50;
    const idealWants = incomeBase * 0.30;

    // Check Needs
    if (actualNeeds > idealNeeds) {
      const warnedNeedsKey = `warn-needs-${currentYear}-${currentMonth}`;
      const alreadyWarnedNeeds = notifications.some(n => n.id === warnedNeedsKey);
      if (!alreadyWarnedNeeds) {
        const excess = actualNeeds - idealNeeds;
        const newNotif: AppNotification = {
          id: warnedNeedsKey,
          titulo: '⚠️ Limite de Necessidades Excedido',
          mensagem: `Seus gastos essenciais (R$ ${actualNeeds.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}) ultrapassaram a recomendação de 50% do seu orçamento em R$ ${excess.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`,
          data: new Date().toISOString(),
          lida: false,
          tipo: 'alerta'
        };
        setNotifications(prev => {
          const updated = [newNotif, ...prev];
          saveLocal('local_notifications', updated);
          return updated;
        });
        showToast('Atenção: Limite de Necessidades (50%) foi excedido!', 'erro');
      }
    }

    // Check Wants
    if (actualWants > idealWants) {
      const warnedWantsKey = `warn-wants-${currentYear}-${currentMonth}`;
      const alreadyWarnedWants = notifications.some(n => n.id === warnedWantsKey);
      if (!alreadyWarnedWants) {
        const excess = actualWants - idealWants;
        const newNotif: AppNotification = {
          id: warnedWantsKey,
          titulo: '⚠️ Limite de Lazer Excedido',
          mensagem: `Seus gastos de estilo de vida (R$ ${actualWants.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}) excederam o limite ideal de 30% em R$ ${excess.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`,
          data: new Date().toISOString(),
          lida: false,
          tipo: 'alerta'
        };
        setNotifications(prev => {
          const updated = [newNotif, ...prev];
          saveLocal('local_notifications', updated);
          return updated;
        });
        showToast('Atenção: Limite de Lazer & Desejos (30%) foi excedido!', 'erro');
      }
    }

    // 3. Projected Balance Warning
    if (saldoProjetadoFimDoMes < 0) {
      const warnedBalanceKey = `warn-balance-${currentYear}-${currentMonth}`;
      const alreadyWarnedBalance = notifications.some(n => n.id === warnedBalanceKey);
      if (!alreadyWarnedBalance) {
        const newNotif: AppNotification = {
          id: warnedBalanceKey,
          titulo: '🔴 Saldo Projetado Negativo',
          mensagem: `Suas despesas superaram suas receitas neste mês. Sua projeção atual é de fechar o mês com saldo negativo de R$ ${Math.abs(saldoProjetadoFimDoMes).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`,
          data: new Date().toISOString(),
          lida: false,
          tipo: 'alerta'
        };
        setNotifications(prev => {
          const updated = [newNotif, ...prev];
          saveLocal('local_notifications', updated);
          return updated;
        });
        showToast('Atenção: Seu saldo projetado está negativo para este mês!', 'erro');
      }
    }
  }, [transactions, currentMonth, currentYear, loggedToday, saldoProjetadoFimDoMes]);

  // Dreams overall progress ratio compared to real accumulative total balance
  const totalDreamCost = projects.reduce((sum, p) => sum + p.valor, 0);
  const dreamsProgressRatio =
    totalDreamCost > 0 ? Math.min((saldoRealAcumulado / totalDreamCost) * 100, 100) : 0;

  // Formatting helper
  const formatCurrency = (val: number) => {
    return `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const renderSidebarNavigation = (isMobile = false) => (
    <div className="flex flex-col h-full justify-between p-4 bg-white dark:bg-[#32323F] text-zinc-800 dark:text-[#DDD5D0]">
      {/* Top brand & navigation */}
      <div className="space-y-4">
        {/* Brand Lockup */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-200/80 dark:border-[#4C4E5D]/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#32323F] dark:bg-[#4C4E5D] text-white dark:text-[#DDD5D0] flex items-center justify-center font-black text-xs shadow-xs border border-[#4C4E5D]/50">
              FC
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold tracking-tight text-sm text-zinc-900 dark:text-[#DDD5D0]">
                  Fintech<span className="text-[#988E96] font-medium">Core</span>
                </span>
                <span className="text-[9px] px-1.5 py-0.2 bg-[#4C4E5D]/15 dark:bg-[#4C4E5D]/50 text-[#32323F] dark:text-[#BCABA8] rounded font-bold">
                  PRO
                </span>
              </div>
              <p className="text-[10px] text-zinc-500 dark:text-[#988E96]">Gestão & Nuvem</p>
            </div>
          </div>
          {isMobile && (
            <button
              onClick={() => setIsMobileSidebarOpen(false)}
              className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-[#4C4E5D] text-zinc-500 dark:text-[#988E96] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Primary Navigation Menu */}
        <div className="space-y-1">
          <p className="px-2 text-[10px] font-bold uppercase tracking-wider text-[#988E96]">
            Navegação
          </p>

          <button
            onClick={() => {
              setActiveNav('dashboard');
              if (isMobile) setIsMobileSidebarOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeNav === 'dashboard'
                ? 'bg-[#32323F] text-white dark:bg-[#4C4E5D] dark:text-[#DDD5D0] shadow-xs'
                : 'text-zinc-700 dark:text-[#988E96] hover:bg-zinc-100 dark:hover:bg-[#4C4E5D]/40 dark:hover:text-[#DDD5D0]'
            }`}
          >
            <LayoutDashboard className={`w-4 h-4 ${activeNav === 'dashboard' ? 'text-emerald-400' : 'text-zinc-500 dark:text-[#988E96]'}`} />
            <span>Dashboard</span>
          </button>

          <button
            onClick={() => {
              setActiveNav('transacoes');
              if (isMobile) setIsMobileSidebarOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeNav === 'transacoes'
                ? 'bg-[#32323F] text-white dark:bg-[#4C4E5D] dark:text-[#DDD5D0] shadow-xs'
                : 'text-zinc-700 dark:text-[#988E96] hover:bg-zinc-100 dark:hover:bg-[#4C4E5D]/40 dark:hover:text-[#DDD5D0]'
            }`}
          >
            <Receipt className={`w-4 h-4 ${activeNav === 'transacoes' ? 'text-blue-400' : 'text-zinc-500 dark:text-[#988E96]'}`} />
            <span>Lançamentos & Extrato</span>
          </button>

          <button
            onClick={() => {
              setActiveNav('sonhos');
              if (isMobile) setIsMobileSidebarOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeNav === 'sonhos'
                ? 'bg-[#32323F] text-white dark:bg-[#4C4E5D] dark:text-[#DDD5D0] shadow-xs'
                : 'text-zinc-700 dark:text-[#988E96] hover:bg-zinc-100 dark:hover:bg-[#4C4E5D]/40 dark:hover:text-[#DDD5D0]'
            }`}
          >
            <Target className={`w-4 h-4 ${activeNav === 'sonhos' ? 'text-amber-400' : 'text-zinc-500 dark:text-[#988E96]'}`} />
            <div className="flex-1 flex items-center justify-between">
              <span>Metas & Sonhos</span>
              <span className="text-[10px] font-mono opacity-80">{projects.length}</span>
            </div>
          </button>

          <button
            onClick={() => {
              setActiveNav('contas');
              if (isMobile) setIsMobileSidebarOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeNav === 'contas'
                ? 'bg-[#32323F] text-white dark:bg-[#4C4E5D] dark:text-[#DDD5D0] shadow-xs'
                : 'text-zinc-700 dark:text-[#988E96] hover:bg-zinc-100 dark:hover:bg-[#4C4E5D]/40 dark:hover:text-[#DDD5D0]'
            }`}
          >
            <Landmark className={`w-4 h-4 ${activeNav === 'contas' ? 'text-purple-400' : 'text-zinc-500 dark:text-[#988E96]'}`} />
            <div className="flex-1 flex items-center justify-between">
              <span>Contas & Cartões</span>
              <span className="text-[10px] font-mono opacity-80">{accounts.length}</span>
            </div>
          </button>

          <button
            onClick={() => {
              setActiveNav('categorias');
              if (isMobile) setIsMobileSidebarOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeNav === 'categorias'
                ? 'bg-[#32323F] text-white dark:bg-[#4C4E5D] dark:text-[#DDD5D0] shadow-xs'
                : 'text-zinc-700 dark:text-[#988E96] hover:bg-zinc-100 dark:hover:bg-[#4C4E5D]/40 dark:hover:text-[#DDD5D0]'
            }`}
          >
            <Tags className={`w-4 h-4 ${activeNav === 'categorias' ? 'text-rose-400' : 'text-zinc-500 dark:text-[#988E96]'}`} />
            <span>Categorias</span>
          </button>

          <button
            onClick={() => {
              setActiveNav('ia');
              if (isMobile) setIsMobileSidebarOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeNav === 'ia'
                ? 'bg-[#32323F] text-white dark:bg-[#4C4E5D] dark:text-[#DDD5D0] shadow-xs'
                : 'text-zinc-700 dark:text-[#988E96] hover:bg-zinc-100 dark:hover:bg-[#4C4E5D]/40 dark:hover:text-[#DDD5D0]'
            }`}
          >
            <Bot className={`w-4 h-4 ${activeNav === 'ia' ? 'text-teal-400' : 'text-zinc-500 dark:text-[#988E96]'}`} />
            <span>Assistente IA</span>
          </button>
        </div>

        {/* Quick Filter: Contas & Cartões */}
        <div className="space-y-2 pt-2 border-t border-zinc-200/80 dark:border-[#4C4E5D]/60">
          <div className="flex items-center justify-between px-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#988E96]">
              Filtro por Conta
            </span>
            <button
              onClick={() => setIsAddAccountModalOpen(true)}
              className="text-[10px] text-zinc-600 dark:text-[#BCABA8] hover:text-zinc-900 dark:hover:text-white font-bold cursor-pointer"
            >
              + Nova
            </button>
          </div>

          <div className="space-y-1 max-h-36 overflow-y-auto custom-scrollbar pr-1">
            <button
              onClick={() => {
                setSelectedAccountId('consolidado');
                if (isMobile) setIsMobileSidebarOpen(false);
              }}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                selectedAccountId === 'consolidado'
                  ? 'bg-zinc-200/80 dark:bg-[#4C4E5D] text-zinc-900 dark:text-[#DDD5D0] font-bold'
                  : 'text-zinc-600 dark:text-[#988E96] hover:bg-zinc-100 dark:hover:bg-[#4C4E5D]/30'
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                <span className="truncate">Consolidado</span>
              </div>
              <span className="text-[10px] font-mono tabular-nums shrink-0 opacity-80">
                {formatCurrency(totalCashConsolidated)}
              </span>
            </button>

            {accounts.map(acc => {
              const isSelected = selectedAccountId === acc.id;
              const isCard = acc.tipo === 'credito';
              const bal = accountBalances[acc.id] ?? 0;
              return (
                <button
                  key={acc.id}
                  onClick={() => {
                    setSelectedAccountId(acc.id);
                    if (isMobile) setIsMobileSidebarOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-zinc-200/80 dark:bg-[#4C4E5D] text-zinc-900 dark:text-[#DDD5D0] font-bold'
                      : 'text-zinc-600 dark:text-[#988E96] hover:bg-zinc-100 dark:hover:bg-[#4C4E5D]/30'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${acc.cor || 'bg-zinc-400'}`} />
                    <span className="truncate">{acc.nome}</span>
                  </div>
                  <span className="text-[10px] font-mono tabular-nums shrink-0 opacity-80">
                    {isCard ? (acc.limiteCredito ? `R$ ${Math.round(Math.max(acc.limiteCredito - bal, 0))}` : 'Cartão') : formatCurrency(bal)}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            onClick={() => {
              setIsImportModalOpen(true);
              if (isMobile) setIsMobileSidebarOpen(false);
            }}
            className="w-full mt-2 py-2 px-3 rounded-xl border border-dashed border-zinc-300 dark:border-[#4C4E5D] hover:bg-zinc-100 dark:hover:bg-[#4C4E5D]/30 text-zinc-700 dark:text-[#DDD5D0] text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95"
          >
            <Sparkles className="w-3.5 h-3.5 text-zinc-500 dark:text-[#BCABA8]" />
            <span>Importar Extrato PDF</span>
          </button>
        </div>
      </div>

      {/* Sidebar Footer: Cloud Sync Status, User Profile, Streak & Theme */}
      <div className="space-y-3 pt-3 border-t border-zinc-200/80 dark:border-[#4C4E5D]/60 mt-auto">
        {/* Cloud Status */}
        <div className="p-2.5 rounded-xl bg-zinc-100/70 dark:bg-[#252530] border border-zinc-200/70 dark:border-[#4C4E5D]/50 text-xs space-y-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 truncate">
              <Cloud className={`w-3.5 h-3.5 shrink-0 ${firebaseUser ? 'text-emerald-500' : 'text-amber-500'}`} />
              <span className="font-bold text-[11px] text-zinc-800 dark:text-[#DDD5D0] truncate">
                {firebaseUser ? 'Firebase Firestore' : 'Armazenamento'}
              </span>
            </div>
            <span className={`text-[9px] px-1.5 py-0.2 rounded-md font-bold shrink-0 ${
              firebaseUser
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
            }`}>
              {firebaseUser ? 'Nuvem' : 'Local'}
            </span>
          </div>

          <p className="text-[10px] text-zinc-500 dark:text-[#988E96] truncate">
            {firebaseUser ? firebaseUser.email || currentUser.email : 'Conecte para sincronizar em nuvem'}
          </p>

          {!firebaseUser ? (
            <button
              onClick={handleGoogleLogin}
              disabled={isSyncingFirebase}
              className="w-full mt-1 py-1 px-2 bg-[#32323F] hover:bg-[#4C4E5D] dark:bg-[#4C4E5D] dark:hover:bg-[#5B5D6E] text-white dark:text-[#DDD5D0] rounded-lg text-[10px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              {isSyncingFirebase ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Cloud className="w-3 h-3 text-amber-400" />}
              <span>{isSyncingFirebase ? 'Sincronizando...' : 'Conectar Firebase'}</span>
            </button>
          ) : (
            <div className="flex justify-end pt-0.5">
              <button
                onClick={handleGoogleLogout}
                className="text-[9px] text-[#988E96] hover:text-rose-500 flex items-center gap-1 transition-colors cursor-pointer"
                title="Desconectar Firebase"
              >
                <LogOut className="w-2.5 h-2.5" />
                <span>Desconectar</span>
              </button>
            </div>
          )}
        </div>

        {/* Streak & Theme Row */}
        <div className="flex items-center justify-between gap-2 px-1">
          <button
            onClick={() => setIsStreakModalOpen(true)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
              streak > 0
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400'
                : 'bg-zinc-100 dark:bg-[#252530] text-zinc-500 dark:text-[#988E96] border-zinc-200/80 dark:border-[#4C4E5D]/50'
            }`}
            title="Sequência diária de registros"
          >
            <Flame className={`w-3.5 h-3.5 ${streak > 0 ? 'fill-amber-500 text-amber-500' : ''}`} />
            <span>{streak} {streak === 1 ? 'dia' : 'dias'}</span>
          </button>

          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl bg-zinc-100 hover:bg-zinc-200/70 dark:bg-[#252530] dark:hover:bg-[#4C4E5D]/50 border border-zinc-200/80 dark:border-[#4C4E5D]/50 text-zinc-600 dark:text-[#DDD5D0] transition-colors cursor-pointer"
            title="Alternar Tema Claro / Escuro"
          >
            {isDarkMode ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4 text-zinc-700" />}
          </button>
        </div>
      </div>
    </div>
  );

  // Render view for Metas & Sonhos
  const renderSonhosView = () => (
    <div className="space-y-6">
      <div className="p-5 bg-white dark:bg-[#32323F] border border-zinc-200/80 dark:border-[#4C4E5D]/60 rounded-2xl shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-zinc-100 dark:border-[#4C4E5D]/50 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-900 dark:text-[#DDD5D0]">
                Metas & Projetos de Vida
              </h2>
              <p className="text-xs text-zinc-500 dark:text-[#988E96]">
                Acompanhe a viabilidade dos seus sonhos com base na sua poupança real.
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-xs text-[#988E96]">Custo Total Acumulado:</span>
            <p className="text-base font-black font-mono text-zinc-900 dark:text-[#DDD5D0]">
              {formatCurrency(totalDreamCost)}
            </p>
          </div>
        </div>

        {/* Embedded SubPanels metas view */}
        <SubPanels
          activeType="metas"
          transactions={transactions}
          projects={projects}
          onAddProject={handleAddProject}
          onDeleteProject={handleDeleteProject}
          saldoReal={saldoRealAcumulado}
          currentMonth={currentMonth}
          currentYear={currentYear}
        />
      </div>
    </div>
  );

  // Render view for Contas & Cartões
  const renderContasView = () => (
    <div className="space-y-6">
      <div className="p-5 bg-white dark:bg-[#32323F] border border-zinc-200/80 dark:border-[#4C4E5D]/60 rounded-2xl shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-zinc-100 dark:border-[#4C4E5D]/50 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center font-bold">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-900 dark:text-[#DDD5D0]">
                Gerenciador de Contas Bancárias & Cartões
              </h2>
              <p className="text-xs text-zinc-500 dark:text-[#988E96]">
                Cadastre suas contas correntes, cartões de crédito e carteiras.
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsAddAccountModalOpen(true)}
            className="px-3.5 py-2 bg-[#32323F] hover:bg-[#4C4E5D] dark:bg-[#4C4E5D] dark:hover:bg-[#5B5D6E] text-white dark:text-[#DDD5D0] rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Adicionar Conta / Cartão</span>
          </button>
        </div>

        {/* Accounts Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 max-h-[calc(100vh-220px)] overflow-y-auto pr-1 custom-scrollbar">
          {accounts.map(acc => {
            const isCard = acc.tipo === 'credito';
            const bal = accountBalances[acc.id] ?? 0;
            return (
              <div
                key={acc.id}
                className="p-4 rounded-xl border border-zinc-200/80 dark:border-[#4C4E5D]/60 bg-zinc-50/70 dark:bg-[#252530] flex flex-col justify-between space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className={`w-3 h-3 rounded-full ${acc.cor || 'bg-zinc-400'}`} />
                    <div>
                      <h3 className="text-xs font-bold text-zinc-900 dark:text-[#DDD5D0]">{acc.nome}</h3>
                      <p className="text-[10px] uppercase font-bold text-[#988E96]">
                        {isCard ? 'Cartão de Crédito' : acc.tipo === 'poupanca' ? 'Poupança' : 'Conta Corrente'}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm">{isCard ? '💳' : '🏦'}</span>
                </div>

                <div className="pt-2 border-t border-zinc-200/60 dark:border-[#4C4E5D]/40 space-y-1">
                  <p className="text-[10px] text-[#988E96]">{isCard ? 'Fatura Aberta' : 'Saldo Atual'}</p>
                  <p className="text-lg font-bold font-mono text-zinc-900 dark:text-[#DDD5D0]">
                    {formatCurrency(bal)}
                  </p>
                  {isCard && acc.limiteCredito && (
                    <div className="text-[10px] text-[#988E96] flex justify-between">
                      <span>Limite: {formatCurrency(acc.limiteCredito)}</span>
                      <span>Disp: {formatCurrency(Math.max(acc.limiteCredito - bal, 0))}</span>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-zinc-200/60 dark:border-[#4C4E5D]/40">
                  <button
                    onClick={() => setEditingAccount(acc)}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-zinc-200/70 hover:bg-zinc-300 dark:bg-[#4C4E5D]/50 dark:hover:bg-[#4C4E5D] text-zinc-800 dark:text-[#DDD5D0] cursor-pointer"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDeleteAccount(acc.id)}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 cursor-pointer"
                  >
                    Excluir
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  // Render view for Categorias
  const renderCategoriasView = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Despesas */}
      <div className="p-5 bg-white dark:bg-[#32323F] border border-zinc-200/80 dark:border-[#4C4E5D]/60 rounded-2xl shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-[#4C4E5D]/50 pb-3">
          <div className="flex items-center gap-2">
            <ArrowDownCircle className="w-4 h-4 text-rose-500" />
            <h2 className="text-sm font-bold text-zinc-900 dark:text-[#DDD5D0]">
              Categorias de Despesas ({categoriasDespesa.length})
            </h2>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (novaCatNome.trim()) {
              handleAddCategory(novaCatNome.trim(), 'despesa');
              setNovaCatNome('');
            }
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            placeholder="Nova categoria de despesa..."
            value={novaCatTipo === 'despesa' ? novaCatNome : ''}
            onChange={(e) => {
              setNovaCatTipo('despesa');
              setNovaCatNome(e.target.value);
            }}
            className="flex-1 bg-zinc-50 dark:bg-[#252530] border border-zinc-200/80 dark:border-[#4C4E5D]/60 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-[#DDD5D0] focus:outline-none focus:ring-1 focus:ring-[#BCABA8]"
          />
          <button
            type="submit"
            className="px-3 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold cursor-pointer transition-all shadow-xs"
          >
            Adicionar
          </button>
        </form>

        <div className="flex flex-wrap gap-2 pt-2 max-h-56 overflow-y-auto custom-scrollbar pr-1">
          {categoriasDespesa.map(cat => (
            <div
              key={cat}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-[#252530] border border-zinc-200/80 dark:border-[#4C4E5D]/50 text-xs font-semibold text-zinc-800 dark:text-[#DDD5D0]"
            >
              <span>{cat}</span>
              {categoriasDespesa.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleDeleteCategory(cat, 'despesa')}
                  className="text-zinc-400 hover:text-rose-500 transition-colors cursor-pointer"
                  title="Remover categoria"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Receitas */}
      <div className="p-5 bg-white dark:bg-[#32323F] border border-zinc-200/80 dark:border-[#4C4E5D]/60 rounded-2xl shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-[#4C4E5D]/50 pb-3">
          <div className="flex items-center gap-2">
            <ArrowUpCircle className="w-4 h-4 text-emerald-500" />
            <h2 className="text-sm font-bold text-zinc-900 dark:text-[#DDD5D0]">
              Categorias de Receitas ({categoriasReceita.length})
            </h2>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (novaCatNome.trim()) {
              handleAddCategory(novaCatNome.trim(), 'receita');
              setNovaCatNome('');
            }
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            placeholder="Nova categoria de receita..."
            value={novaCatTipo === 'receita' ? novaCatNome : ''}
            onChange={(e) => {
              setNovaCatTipo('receita');
              setNovaCatNome(e.target.value);
            }}
            className="flex-1 bg-zinc-50 dark:bg-[#252530] border border-zinc-200/80 dark:border-[#4C4E5D]/60 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-[#DDD5D0] focus:outline-none focus:ring-1 focus:ring-[#BCABA8]"
          />
          <button
            type="submit"
            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold cursor-pointer transition-all shadow-xs"
          >
            Adicionar
          </button>
        </form>

        <div className="flex flex-wrap gap-2 pt-2 max-h-56 overflow-y-auto custom-scrollbar pr-1">
          {categoriasReceita.map(cat => (
            <div
              key={cat}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-[#252530] border border-zinc-200/80 dark:border-[#4C4E5D]/50 text-xs font-semibold text-zinc-800 dark:text-[#DDD5D0]"
            >
              <span>{cat}</span>
              {categoriasReceita.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleDeleteCategory(cat, 'receita')}
                  className="text-zinc-400 hover:text-rose-500 transition-colors cursor-pointer"
                  title="Remover categoria"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // Render view for Personal AI Advisor
  const renderIAView = () => (
    <div className="p-6 bg-white dark:bg-[#32323F] border border-zinc-200/80 dark:border-[#4C4E5D]/60 rounded-2xl shadow-xs space-y-4">
      <div className="flex items-center gap-3 border-b border-zinc-100 dark:border-[#4C4E5D]/50 pb-3">
        <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-500 flex items-center justify-center font-bold">
          <Bot className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-zinc-900 dark:text-[#DDD5D0]">
            Assistente Financeiro Inteligente
          </h2>
          <p className="text-xs text-zinc-500 dark:text-[#988E96]">
            Utilize o botão flutuante no canto inferior direito para conversar com seu consultor em tempo real.
          </p>
        </div>
      </div>
      <p className="text-xs text-zinc-600 dark:text-[#988E96] leading-relaxed">
        O seu consultor IA monitora automaticamente seu fluxo de caixa, alerta quando os gastos se aproximam dos limites da regra 50-30-20 e sugere lançamentos automáticos com base no seu padrão financeiro.
      </p>
    </div>
  );

  // Main content switcher
  const renderMainContent = () => {
    if (activeNav === 'transacoes') {
      return (
        <div className="space-y-3.5">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">
            <div className="lg:col-span-4">
              <TransactionForm
                categoriasDespesa={categoriasDespesa}
                categoriasReceita={categoriasReceita}
                onAddTransaction={handleAddTransaction}
                onAddCategory={handleAddCategory}
                onAddRecurrentRule={handleAddRecurrentRule}
                recurrentRulesCount={recurrentRules.filter(r => r.ativa).length}
                onOpenManageRecurrentModal={() => setIsManageRecurrentModalOpen(true)}
                accounts={accounts}
                selectedAccountId={selectedAccountId}
              />
            </div>
            <div className="lg:col-span-8">
              <TransactionTable
                transactions={transactions}
                onDeleteTransaction={handleDeleteTransaction}
                onUpdateTransaction={handleUpdateTransaction}
                categorias={[...new Set([...categoriasDespesa, ...categoriasReceita])]}
                categoriasDespesa={categoriasDespesa}
                categoriasReceita={categoriasReceita}
                currentMonth={currentMonth}
                currentYear={currentYear}
                accounts={accounts}
                selectedAccountId={selectedAccountId}
                onOpenImportModal={() => setIsImportModalOpen(true)}
              />
            </div>
          </div>
        </div>
      );
    }

    if (activeNav === 'sonhos') {
      return renderSonhosView();
    }

    if (activeNav === 'contas') {
      return renderContasView();
    }

    if (activeNav === 'categorias') {
      return renderCategoriasView();
    }

    if (activeNav === 'ia') {
      return renderIAView();
    }

    // Default: activeNav === 'dashboard'
    return (
      <div className="space-y-3">
        {dashboardTab === 'geral' && (
          <>
            {/* Nudge Daily Focus */}
            <NudgeBanner streak={streak} registrouHoje={loggedToday} />

            {/* 5 Premium Metric Cards Grid */}
            <section className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
              <MetricCard
                id="card-saldo-real"
                title="Disponível Hoje"
                value={formatCurrency(saldoRealAcumulado)}
                subValue="Limite diário de gastos"
                icon={Wallet}
                isActive={subpainelAberto === 'saldo-real'}
                onClick={() => handleSubPanelToggle('saldo-real')}
                sparklineType="wave"
                trend={{ value: 'Em conta', neutral: true }}
              />
              <MetricCard
                id="card-saldo"
                title="Projeção Mês"
                value={formatCurrency(saldoProjetadoFimDoMes)}
                subValue="Regra orçamentária 50-30-20"
                icon={TrendingUp}
                isActive={subpainelAberto === 'saldo'}
                onClick={() => handleSubPanelToggle('saldo')}
                sparklineType={saldoProjetadoFimDoMes >= 0 ? 'up' : 'down'}
                trend={{
                  value: saldoProjetadoFimDoMes >= 0 ? 'Positivo' : 'Negativo',
                  isPositive: saldoProjetadoFimDoMes >= 0
                }}
              />
              <MetricCard
                id="card-receitas"
                title="Receitas"
                value={`+ ${formatCurrency(totalReceitasMes)}`}
                subValue="Entradas do período"
                icon={ArrowUpCircle}
                isActive={subpainelAberto === 'receitas'}
                onClick={() => handleSubPanelToggle('receitas')}
                sparklineType="up"
                trend={{ value: 'Entradas', isPositive: true }}
              />
              <MetricCard
                id="card-despesas"
                title="Despesas"
                value={`- ${formatCurrency(totalDespesasMes)}`}
                subValue="Saídas do período"
                icon={ArrowDownCircle}
                isActive={subpainelAberto === 'despesas'}
                onClick={() => handleSubPanelToggle('despesas')}
                sparklineType="down"
                trend={{ value: 'Saídas', isPositive: false }}
              />
              <MetricCard
                id="card-metas"
                title="Metas de Sonhos"
                value={`${dreamsProgressRatio.toFixed(0)}%`}
                subValue="Progresso acumulado"
                icon={Rocket}
                isActive={subpainelAberto === 'metas'}
                onClick={() => handleSubPanelToggle('metas')}
                sparklineType="progress"
                progressPercent={dreamsProgressRatio}
                trend={{ value: `${projects.length} ativas`, neutral: true }}
              />
            </section>

            {/* SubPanels Rich Expansion */}
            <div id="container-subpaineis" className="w-full">
              <SubPanels
                activeType={subpainelAberto}
                transactions={transactions}
                projects={projects}
                onAddProject={handleAddProject}
                onDeleteProject={handleDeleteProject}
                saldoReal={saldoRealAcumulado}
                currentMonth={currentMonth}
                currentYear={currentYear}
              />
            </div>

            {/* Quick 2-Column: Form + Ledger */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">
              <div className="lg:col-span-4">
                <TransactionForm
                  categoriasDespesa={categoriasDespesa}
                  categoriasReceita={categoriasReceita}
                  onAddTransaction={handleAddTransaction}
                  onAddCategory={handleAddCategory}
                  onAddRecurrentRule={handleAddRecurrentRule}
                  recurrentRulesCount={recurrentRules.filter(r => r.ativa).length}
                  onOpenManageRecurrentModal={() => setIsManageRecurrentModalOpen(true)}
                  accounts={accounts}
                  selectedAccountId={selectedAccountId}
                />
              </div>
              <div className="lg:col-span-8">
                <TransactionTable
                  transactions={transactions}
                  onDeleteTransaction={handleDeleteTransaction}
                  onUpdateTransaction={handleUpdateTransaction}
                  categorias={[...new Set([...categoriasDespesa, ...categoriasReceita])]}
                  categoriasDespesa={categoriasDespesa}
                  categoriasReceita={categoriasReceita}
                  currentMonth={currentMonth}
                  currentYear={currentYear}
                  accounts={accounts}
                  selectedAccountId={selectedAccountId}
                  onOpenImportModal={() => setIsImportModalOpen(true)}
                />
              </div>
            </div>
          </>
        )}

        {dashboardTab === 'graficos' && (
          <FinancialCharts
            transactions={transactions}
            categorias={categoriasDespesa}
            currentMonth={currentMonth}
            currentYear={currentYear}
            selectedAccountId={selectedAccountId}
            showCalendar={false}
            accounts={accounts}
          />
        )}

        {dashboardTab === 'calendario' && (
          <ExpenseCalendar
            transactions={selectedAccountId && selectedAccountId !== 'consolidado' ? transactions.filter(t => t.accountId === selectedAccountId) : transactions}
            currentMonth={currentMonth}
            currentYear={currentYear}
            periodoFiltro="mes"
          />
        )}

        {dashboardTab === 'cartoes' && (
          <div className="space-y-6">
            {accounts.filter(a => a.tipo === 'credito').length === 0 ? (
              <div className="p-8 text-center bg-white dark:bg-[#32323F] border border-zinc-200/80 dark:border-[#4C4E5D]/60 rounded-2xl">
                <CreditCard className="w-8 h-8 mx-auto text-[#988E96] mb-2" />
                <p className="text-sm font-bold text-zinc-900 dark:text-[#DDD5D0]">Nenhum cartão de crédito cadastrado</p>
                <p className="text-xs text-[#988E96] mt-1">Cadastre seu cartão Santander SX ou outros na barra lateral.</p>
                <button
                  onClick={() => setIsAddAccountModalOpen(true)}
                  className="mt-4 px-4 py-2 bg-[#32323F] dark:bg-[#4C4E5D] text-white dark:text-[#DDD5D0] rounded-xl text-xs font-bold"
                >
                  Cadastrar Cartão
                </button>
              </div>
            ) : (
              accounts.filter(a => a.tipo === 'credito').map(cardAcc => (
                <CreditCardBills
                  key={cardAcc.id}
                  activeAccount={cardAcc}
                  transactions={transactions}
                  checkingAccounts={accounts.filter(a => a.tipo !== 'credito')}
                  onAddTransaction={handleAddTransaction}
                  accountBalances={accountBalances}
                />
              ))
            )}
          </div>
        )}
      </div>
    );
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
    <div className="bg-[#F8F7F4] dark:bg-[#252530] text-zinc-900 dark:text-[#DDD5D0] h-screen w-screen overflow-hidden flex font-sans antialiased relative">
      {/* TOAST SYSTEM ALERTS STREAM */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none flex flex-col gap-2.5 w-full max-w-sm px-6">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg border text-xs font-bold transition-all duration-300 transform translate-y-0 opacity-100 pointer-events-auto bg-white dark:bg-[#32323F] border-[#E8E5DC] dark:border-[#4C4E5D]/60 ${
              t.type === 'sucesso'
                ? 'text-emerald-600 dark:text-emerald-400'
                : t.type === 'erro'
                ? 'text-rose-600 dark:text-rose-400'
                : 'text-zinc-700 dark:text-[#DDD5D0]'
            }`}
          >
            <div className={`w-2 h-2 rounded-full ${t.type === 'sucesso' ? 'bg-emerald-500' : t.type === 'erro' ? 'bg-rose-500' : 'bg-zinc-400'} animate-ping`} />
            <span>{t.msg}</span>
          </div>
        ))}
      </div>

      {/* DESKTOP SIDEBAR MENU LATERAL PERSISTENTE */}
      <aside className="hidden lg:flex w-64 xl:w-72 h-screen flex-shrink-0 bg-[#FDFCFB] dark:bg-[#32323F] border-r border-[#E8E5DC] dark:border-[#4C4E5D]/60 flex-col justify-between shadow-xs z-30">
        {renderSidebarNavigation(false)}
      </aside>

      {/* MAIN VIEWPORT STAGE */}
      <div className="flex-1 h-screen flex flex-col min-w-0 overflow-hidden bg-[#F5F4EE] dark:bg-[#252530]">
        {/* HEADER BAR */}
        <header className="h-16 flex-shrink-0 bg-[#FDFCFB]/95 border-b border-[#E8E5DC] dark:bg-[#32323F]/95 dark:border-[#4C4E5D]/60 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between z-20 shadow-xs">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="lg:hidden p-2 hover:bg-zinc-100 dark:hover:bg-[#4C4E5D]/40 border border-zinc-200/80 dark:border-[#4C4E5D]/60 rounded-xl cursor-pointer text-zinc-600 dark:text-[#DDD5D0] active:scale-95 transition-all flex items-center justify-center"
              title="Abrir Menu de Navegação"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-extrabold tracking-tight text-zinc-900 dark:text-[#DDD5D0] flex items-center gap-1.5">
                  {activeNav === 'dashboard' && 'Dashboard Financeiro'}
                  {activeNav === 'transacoes' && 'Lançamentos & Extrato'}
                  {activeNav === 'sonhos' && 'Metas & Sonhos'}
                  {activeNav === 'contas' && 'Contas & Cartões'}
                  {activeNav === 'categorias' && 'Categorias'}
                  {activeNav === 'ia' && 'Assistente IA'}
                </h1>
                <span
                  className={`inline-block w-2 h-2 rounded-full ${firebaseUser ? 'bg-emerald-500' : isOnline ? 'bg-blue-500' : 'bg-amber-500'}`}
                  title={firebaseUser ? 'Firebase Firestore Conectado (Nuvem em Tempo Real)' : isOnline ? 'Firebase Disponível' : 'Modo Local Ativo'}
                />
              </div>
              <p className="hidden sm:block text-[10px] text-zinc-500 dark:text-[#988E96]">
                {selectedAccountId === 'consolidado' ? 'Visão Consolidada de todas as contas' : `Conta selecionada: ${accounts.find(a => a.id === selectedAccountId)?.nome || ''}`}
              </p>
            </div>
          </div>

          {/* Month ruler and quick actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Month Ruler */}
            <div className="flex items-center gap-1 bg-[#F3F1EB] dark:bg-[#252530] p-1 rounded-xl border border-[#E8E5DC] dark:border-[#4C4E5D]/60">
              <button
                onClick={prevMonth}
                className="p-1 hover:bg-white dark:hover:bg-[#4C4E5D]/50 rounded-lg text-zinc-500 dark:text-[#988E96] cursor-pointer transition-all flex-shrink-0"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              <div className="flex items-center gap-0.5 overflow-x-auto scrollbar-none py-0.5 px-0.5 max-w-[120px] xs:max-w-[180px] sm:max-w-[280px] md:max-w-[360px] select-none">
                {MONTHS.map((m, idx) => {
                  const isSelected = currentMonth === idx;
                  const abbrev = m.substring(0, 3);
                  return (
                    <button
                      key={m}
                      onClick={() => selectMonth(idx)}
                      className={`relative px-2 py-1 text-[11px] font-semibold rounded-md cursor-pointer transition-colors z-10 flex-shrink-0 select-none ${
                        isSelected
                          ? 'text-white dark:text-[#DDD5D0] font-bold'
                          : 'text-zinc-500 dark:text-[#988E96] hover:text-zinc-900 dark:hover:text-[#DDD5D0]'
                      }`}
                    >
                      {isSelected && (
                        <motion.div
                          layoutId="activeMonthIndicator"
                          className="absolute inset-0 bg-[#32323F] dark:bg-[#4C4E5D] rounded-md -z-10 shadow-xs"
                          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                        />
                      )}
                      {abbrev}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={nextMonth}
                className="p-1 hover:bg-white dark:hover:bg-[#4C4E5D]/50 rounded-lg text-zinc-500 dark:text-[#988E96] cursor-pointer transition-all flex-shrink-0"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>

              <div className="h-3.5 w-[1px] bg-zinc-200 dark:bg-[#4C4E5D]/60 mx-0.5 flex-shrink-0" />

              <button
                onClick={resetToToday}
                className="text-[10px] bg-white dark:bg-[#4C4E5D]/40 px-2 py-1 rounded-lg hover:bg-zinc-50 text-zinc-700 dark:text-[#DDD5D0] font-bold transition-all cursor-pointer flex-shrink-0 shadow-xs border border-zinc-200/50 dark:border-transparent"
              >
                Hoje
              </button>

              <span className="text-[11px] font-bold font-mono text-zinc-700 dark:text-[#DDD5D0] px-1 flex-shrink-0">
                {currentYear}
              </span>
            </div>

            {/* Notification Center */}
            <NotificationCenter
              notifications={notifications}
              onMarkAllRead={handleMarkAllRead}
              onMarkRead={handleMarkRead}
              onDeleteNotification={handleDeleteNotification}
              onClearAll={handleClearAllNotifications}
              onSendTestNotification={handleSendTestNotification}
            />

            {/* Streak Modal Trigger */}
            <button
              onClick={() => setIsStreakModalOpen(true)}
              title="Clique para ver níveis, medalhas e resumo"
              className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all duration-200 cursor-pointer active:scale-95 ${
                streak > 0
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/15'
                  : 'bg-zinc-100 dark:bg-[#252530] text-zinc-500 dark:text-[#988E96] border-zinc-200/80 dark:border-[#4C4E5D]/60'
              }`}
            >
              <Flame className={`w-3.5 h-3.5 ${streak > 0 ? 'fill-amber-500 text-amber-500' : ''}`} />
              <span>{streak} {streak === 1 ? 'dia' : 'dias'}</span>
            </button>

            {/* PWA Install */}
            {deferredPrompt && (
              <button
                onClick={triggerInstallApp}
                className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 bg-[#32323F] hover:bg-[#4C4E5D] dark:bg-[#4C4E5D] dark:hover:bg-[#5B5D6E] text-white dark:text-[#DDD5D0] rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95"
                title="Instalar FintechCore como aplicativo"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Instalar</span>
              </button>
            )}

            {/* Light/Dark Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 bg-zinc-100 hover:bg-zinc-200/70 dark:bg-[#252530] dark:hover:bg-[#4C4E5D]/50 border border-zinc-200/80 dark:border-[#4C4E5D]/60 rounded-xl cursor-pointer text-zinc-600 dark:text-[#DDD5D0] transition-colors"
              title="Alternar tema"
            >
              {isDarkMode ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4 text-zinc-700" />}
            </button>
          </div>
        </header>

        {/* TOP MENU TABS FOR DASHBOARD - Exclusive Tabs separating Overview, Charts, Calendar, and Invoices */}
        {activeNav === 'dashboard' && (
          <div className="bg-[#FDFCFB]/90 dark:bg-[#32323F]/90 border-b border-[#E8E5DC] dark:border-[#4C4E5D]/60 px-4 sm:px-6 py-2.5 flex items-center justify-between flex-shrink-0 z-10">
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-0.5">
              <button
                onClick={() => setDashboardTab('geral')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  dashboardTab === 'geral'
                    ? 'bg-[#32323F] text-white dark:bg-[#4C4E5D] dark:text-[#DDD5D0] shadow-xs'
                    : 'text-zinc-600 dark:text-[#988E96] hover:bg-[#F3F1EB] dark:hover:bg-[#4C4E5D]/30 hover:text-zinc-900 dark:hover:text-[#DDD5D0]'
                }`}
              >
                <LayoutDashboard className="w-3.5 h-3.5 text-emerald-400" />
                <span>Visão Geral</span>
              </button>

              <button
                onClick={() => setDashboardTab('graficos')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  dashboardTab === 'graficos'
                    ? 'bg-[#32323F] text-white dark:bg-[#4C4E5D] dark:text-[#DDD5D0] shadow-xs'
                    : 'text-zinc-600 dark:text-[#988E96] hover:bg-[#F3F1EB] dark:hover:bg-[#4C4E5D]/30 hover:text-zinc-900 dark:hover:text-[#DDD5D0]'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
                <span>Gráficos & Relatórios</span>
              </button>

              <button
                onClick={() => setDashboardTab('calendario')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  dashboardTab === 'calendario'
                    ? 'bg-[#32323F] text-white dark:bg-[#4C4E5D] dark:text-[#DDD5D0] shadow-xs'
                    : 'text-zinc-600 dark:text-[#988E96] hover:bg-[#F3F1EB] dark:hover:bg-[#4C4E5D]/30 hover:text-zinc-900 dark:hover:text-[#DDD5D0]'
                }`}
              >
                <Calendar className="w-3.5 h-3.5 text-amber-400" />
                <span>Calendário Financeiro</span>
              </button>

              <button
                onClick={() => setDashboardTab('cartoes')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  dashboardTab === 'cartoes'
                    ? 'bg-[#32323F] text-white dark:bg-[#4C4E5D] dark:text-[#DDD5D0] shadow-xs'
                    : 'text-zinc-600 dark:text-[#988E96] hover:bg-[#F3F1EB] dark:hover:bg-[#4C4E5D]/30 hover:text-zinc-900 dark:hover:text-[#DDD5D0]'
                }`}
              >
                <CreditCard className="w-3.5 h-3.5 text-rose-400" />
                <span>Faturas de Cartão</span>
              </button>
            </div>

            <div className="hidden md:flex items-center gap-2 text-xs">
              <span className="text-[#988E96] text-[11px]">Disponível:</span>
              <span className="font-mono font-bold text-zinc-900 dark:text-[#DDD5D0] bg-[#F3F1EB] dark:bg-[#252530] px-2.5 py-1 rounded-lg border border-[#E8E5DC] dark:border-[#4C4E5D]/50">
                {formatCurrency(saldoRealAcumulado)}
              </span>
            </div>
          </div>
        )}

        {/* MAIN STAGE CONTENT - Viewport container with internal contained scroll */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-4.5 custom-scrollbar pb-8 md:pb-4">
          <div className="max-w-7xl mx-auto">
            {renderMainContent()}
          </div>
        </main>
      </div>

      {/* MOBILE DRAWER SIDEBAR */}
      {isMobileSidebarOpen && (
        <div className="fixed inset-0 bg-zinc-950/70 backdrop-blur-xs z-50 flex justify-start animate-in fade-in duration-200">
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="w-80 max-w-[85vw] bg-white dark:bg-[#32323F] border-r border-zinc-200 dark:border-[#4C4E5D]/60 h-full p-0 shadow-2xl flex flex-col justify-between"
          >
            {renderSidebarNavigation(true)}
          </motion.div>
          {/* Backdrop click closer */}
          <div className="flex-1" onClick={() => setIsMobileSidebarOpen(false)} />
        </div>
      )}

      {/* ACCOUNT REGISTRATION MODAL */}
      {isAddAccountModalOpen && (
        <div className="fixed inset-0 bg-zinc-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#32323F] border border-zinc-200/80 dark:border-[#4C4E5D]/60 rounded-2xl p-6 w-full max-w-sm shadow-xl animate-in zoom-in-95 duration-200">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-[#DDD5D0] mb-4 flex items-center gap-2 border-b border-zinc-100 dark:border-[#4C4E5D]/50 pb-3">
              <Wallet className="w-4 h-4 text-zinc-700 dark:text-[#BCABA8]" />
              Cadastrar Nova Conta / Cartão
            </h3>

            <form onSubmit={(e) => {
              e.preventDefault();
              const target = e.target as HTMLFormElement;
              const nome = (target.elements.namedItem('nome') as HTMLInputElement).value;
              const tipo = (target.elements.namedItem('tipo') as HTMLSelectElement).value as any;
              const saldoInicial = parseFloat((target.elements.namedItem('saldoInicial') as HTMLInputElement).value) || 0;
              const cor = (target.elements.namedItem('cor') as HTMLSelectElement).value;
              const limiteCredito = parseFloat((target.elements.namedItem('limiteCredito') as HTMLInputElement)?.value) || 0;
              const diaFechamento = parseInt((target.elements.namedItem('diaFechamento') as HTMLInputElement)?.value) || 5;
              const diaVencimento = parseInt((target.elements.namedItem('diaVencimento') as HTMLInputElement)?.value) || 12;

              if (!nome.trim()) return;

              const newAcc: BankAccount = {
                id: safeRandomUUID(),
                nome: nome.trim(),
                tipo,
                saldoInicial: tipo === 'credito' ? 0 : saldoInicial,
                cor,
                limiteCredito: tipo === 'credito' ? limiteCredito : undefined,
                diaFechamento: tipo === 'credito' ? diaFechamento : undefined,
                diaVencimento: tipo === 'credito' ? diaVencimento : undefined
              };

              setAccounts(prev => [...prev, newAcc]);
              setIsAddAccountModalOpen(false);
              showToast(`Conta "${nome}" cadastrada com sucesso!`, 'sucesso');
            }} className="space-y-3.5">
              <div>
                <label className="block text-[10px] uppercase font-bold text-zinc-500 dark:text-[#988E96] mb-1">
                  Nome da Conta / Cartão
                </label>
                <input
                  type="text"
                  name="nome"
                  required
                  placeholder="Ex: Inter, Santander, Itaú..."
                  className="w-full bg-zinc-50 dark:bg-[#252530] border border-zinc-200/80 dark:border-[#4C4E5D]/60 text-zinc-900 dark:text-[#DDD5D0] rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#BCABA8]/20 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-zinc-500 dark:text-[#988E96] mb-1">
                    Tipo de Conta
                  </label>
                  <select
                    name="tipo"
                    required
                    onChange={(e) => {
                      const limitDiv = document.getElementById('credit-card-fields');
                      const balanceLabel = document.getElementById('initial-balance-label');
                      const balanceInput = document.getElementById('initial-balance-input') as HTMLInputElement;
                      if (limitDiv && balanceLabel && balanceInput) {
                        if (e.target.value === 'credito') {
                          limitDiv.style.display = 'block';
                          balanceLabel.style.display = 'none';
                          balanceInput.style.display = 'none';
                          balanceInput.required = false;
                        } else {
                          limitDiv.style.display = 'none';
                          balanceLabel.style.display = 'block';
                          balanceInput.style.display = 'block';
                          balanceInput.required = true;
                        }
                      }
                    }}
                    className="w-full bg-zinc-50 dark:bg-[#252530] border border-zinc-200/80 dark:border-[#4C4E5D]/60 text-zinc-900 dark:text-[#DDD5D0] rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#BCABA8]/20 font-medium"
                  >
                    <option value="corrente">Conta Corrente</option>
                    <option value="poupanca">Conta Poupança</option>
                    <option value="carteira">Dinheiro em Carteira</option>
                    <option value="credito">Cartão de Crédito</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-zinc-500 dark:text-[#988E96] mb-1">
                    Cor Visual
                  </label>
                  <select
                    name="cor"
                    required
                    className="w-full bg-zinc-50 dark:bg-[#252530] border border-zinc-200/80 dark:border-[#4C4E5D]/60 text-zinc-900 dark:text-[#DDD5D0] rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#BCABA8]/20 font-medium"
                  >
                    <option value="bg-zinc-700">Preto Grafite</option>
                    <option value="bg-red-600">Vermelho Santander</option>
                    <option value="bg-emerald-600">Verde Esmeralda</option>
                    <option value="bg-blue-600">Azul Royal</option>
                    <option value="bg-orange-500">Laranja Inter</option>
                    <option value="bg-purple-600">Roxo Nubank</option>
                  </select>
                </div>
              </div>

              <div>
                <label id="initial-balance-label" className="block text-[10px] uppercase font-bold text-zinc-500 dark:text-[#988E96] mb-1">
                  Saldo Inicial (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  name="saldoInicial"
                  id="initial-balance-input"
                  defaultValue="0"
                  className="w-full bg-zinc-50 dark:bg-[#252530] border border-zinc-200/80 dark:border-[#4C4E5D]/60 text-zinc-900 dark:text-[#DDD5D0] rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#BCABA8]/20 font-medium font-mono"
                />
              </div>

              {/* CREDIT CARD FIELDS */}
              <div id="credit-card-fields" style={{ display: 'none' }} className="space-y-3">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-zinc-500 dark:text-[#988E96] mb-1">
                    Limite de Crédito (R$)
                  </label>
                  <input
                    type="number"
                    step="50"
                    name="limiteCredito"
                    placeholder="Ex: 5000"
                    className="w-full bg-zinc-50 dark:bg-[#252530] border border-zinc-200/80 dark:border-[#4C4E5D]/60 text-zinc-900 dark:text-[#DDD5D0] rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#BCABA8]/20 font-medium font-mono"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-zinc-500 dark:text-[#988E96] mb-1">
                      Dia Fechamento
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      name="diaFechamento"
                      defaultValue="5"
                      className="w-full bg-zinc-50 dark:bg-[#252530] border border-zinc-200/80 dark:border-[#4C4E5D]/60 text-zinc-900 dark:text-[#DDD5D0] rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#BCABA8]/20 font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-zinc-500 dark:text-[#988E96] mb-1">
                      Dia Vencimento
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      name="diaVencimento"
                      defaultValue="12"
                      className="w-full bg-zinc-50 dark:bg-[#252530] border border-zinc-200/80 dark:border-[#4C4E5D]/60 text-zinc-900 dark:text-[#DDD5D0] rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#BCABA8]/20 font-medium"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-2.5 pt-3 border-t border-zinc-100 dark:border-[#4C4E5D]/50">
                <button
                  type="button"
                  onClick={() => setIsAddAccountModalOpen(false)}
                  className="flex-1 px-4 py-2 bg-zinc-100 hover:bg-zinc-200/70 dark:bg-[#4C4E5D]/40 dark:hover:bg-[#4C4E5D] text-zinc-700 dark:text-[#DDD5D0] rounded-xl text-xs font-semibold transition-all cursor-pointer text-center"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-[#32323F] hover:bg-[#4C4E5D] dark:bg-[#4C4E5D] dark:hover:bg-[#5B5D6E] text-white dark:text-[#DDD5D0] rounded-xl text-xs font-bold transition-all cursor-pointer text-center shadow-xs"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ACCOUNT EDITING MODAL */}
      {editingAccount && (
        <div className="fixed inset-0 bg-zinc-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#32323F] border border-zinc-200/80 dark:border-[#4C4E5D]/60 rounded-2xl p-6 w-full max-w-sm shadow-xl animate-in zoom-in-95 duration-200">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-[#DDD5D0] mb-4 flex items-center gap-2 border-b border-zinc-100 dark:border-[#4C4E5D]/50 pb-3">
              <Wallet className="w-4 h-4 text-zinc-700 dark:text-[#BCABA8]" />
              Editar Conta / Cartão
            </h3>

            <form onSubmit={(e) => {
              e.preventDefault();
              const target = e.target as HTMLFormElement;
              const nome = (target.elements.namedItem('nome') as HTMLInputElement).value;
              const tipo = (target.elements.namedItem('tipo') as HTMLSelectElement).value as any;
              const saldoInicial = parseFloat((target.elements.namedItem('saldoInicial') as HTMLInputElement)?.value) || 0;
              const cor = (target.elements.namedItem('cor') as HTMLSelectElement).value;
              const limiteCredito = parseFloat((target.elements.namedItem('limiteCredito') as HTMLInputElement)?.value) || 0;
              const diaFechamento = parseInt((target.elements.namedItem('diaFechamento') as HTMLInputElement)?.value) || 5;
              const diaVencimento = parseInt((target.elements.namedItem('diaVencimento') as HTMLInputElement)?.value) || 12;

              if (!nome.trim()) return;

              const updatedAccounts = accounts.map((acc) => {
                if (acc.id === editingAccount.id) {
                  return {
                    ...acc,
                    nome: nome.trim(),
                    tipo,
                    saldoInicial: tipo === 'credito' ? 0 : saldoInicial,
                    cor,
                    limiteCredito: tipo === 'credito' ? limiteCredito : undefined,
                    diaFechamento: tipo === 'credito' ? diaFechamento : undefined,
                    diaVencimento: tipo === 'credito' ? diaVencimento : undefined,
                  };
                }
                return acc;
              });

              setAccounts(updatedAccounts);
              setEditingAccount(null);
              showToast(`Conta "${nome}" atualizada com sucesso!`, 'sucesso');
            }} className="space-y-3.5">
              <div>
                <label className="block text-[10px] uppercase font-bold text-zinc-500 dark:text-[#988E96] mb-1">
                  Nome da Conta / Cartão
                </label>
                <input
                  type="text"
                  name="nome"
                  required
                  defaultValue={editingAccount.nome}
                  placeholder="Ex: Inter, Santander, Itaú..."
                  className="w-full bg-zinc-50 dark:bg-[#252530] border border-zinc-200/80 dark:border-[#4C4E5D]/60 text-zinc-900 dark:text-[#DDD5D0] rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#BCABA8]/20 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-zinc-500 dark:text-[#988E96] mb-1">
                    Tipo de Conta
                  </label>
                  <select
                    name="tipo"
                    required
                    defaultValue={editingAccount.tipo}
                    className="w-full bg-zinc-50 dark:bg-[#252530] border border-zinc-200/80 dark:border-[#4C4E5D]/60 text-zinc-900 dark:text-[#DDD5D0] rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#BCABA8]/20 font-medium"
                  >
                    <option value="corrente">Conta Corrente</option>
                    <option value="poupanca">Conta Poupança</option>
                    <option value="carteira">Dinheiro em Carteira</option>
                    <option value="credito">Cartão de Crédito</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-zinc-500 dark:text-[#988E96] mb-1">
                    Cor Visual
                  </label>
                  <select
                    name="cor"
                    required
                    defaultValue={editingAccount.cor}
                    className="w-full bg-zinc-50 dark:bg-[#252530] border border-zinc-200/80 dark:border-[#4C4E5D]/60 text-zinc-900 dark:text-[#DDD5D0] rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#BCABA8]/20 font-medium"
                  >
                    <option value="bg-zinc-700">Preto Grafite</option>
                    <option value="bg-red-600">Vermelho Santander</option>
                    <option value="bg-emerald-600">Verde Esmeralda</option>
                    <option value="bg-blue-600">Azul Royal</option>
                    <option value="bg-orange-500">Laranja Inter</option>
                    <option value="bg-purple-600">Roxo Nubank</option>
                  </select>
                </div>
              </div>

              {editingAccount.tipo !== 'credito' && (
                <div>
                  <label className="block text-[10px] uppercase font-bold text-zinc-500 dark:text-[#988E96] mb-1">
                    Saldo Inicial (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    name="saldoInicial"
                    defaultValue={editingAccount.saldoInicial}
                    className="w-full bg-zinc-50 dark:bg-[#252530] border border-zinc-200/80 dark:border-[#4C4E5D]/60 text-zinc-900 dark:text-[#DDD5D0] rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#BCABA8]/20 font-medium font-mono"
                  />
                </div>
              )}

              {/* CREDIT CARD FIELDS */}
              {editingAccount.tipo === 'credito' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-zinc-500 dark:text-[#988E96] mb-1">
                      Limite de Crédito (R$)
                    </label>
                    <input
                      type="number"
                      step="50"
                      name="limiteCredito"
                      defaultValue={editingAccount.limiteCredito || 5000}
                      placeholder="Ex: 5000"
                      className="w-full bg-zinc-50 dark:bg-[#252530] border border-zinc-200/80 dark:border-[#4C4E5D]/60 text-zinc-900 dark:text-[#DDD5D0] rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#BCABA8]/20 font-medium font-mono"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-zinc-500 dark:text-[#988E96] mb-1">
                        Dia Fechamento
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="31"
                        name="diaFechamento"
                        defaultValue={editingAccount.diaFechamento || 5}
                        className="w-full bg-zinc-50 dark:bg-[#252530] border border-zinc-200/80 dark:border-[#4C4E5D]/60 text-zinc-900 dark:text-[#DDD5D0] rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#BCABA8]/20 font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-zinc-500 dark:text-[#988E96] mb-1">
                        Dia Vencimento
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="31"
                        name="diaVencimento"
                        defaultValue={editingAccount.diaVencimento || 12}
                        className="w-full bg-zinc-50 dark:bg-[#252530] border border-zinc-200/80 dark:border-[#4C4E5D]/60 text-zinc-900 dark:text-[#DDD5D0] rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#BCABA8]/20 font-medium"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-2.5 pt-3 border-t border-zinc-100 dark:border-[#4C4E5D]/50">
                <button
                  type="button"
                  onClick={() => setEditingAccount(null)}
                  className="flex-1 px-4 py-2 bg-zinc-100 hover:bg-zinc-200/70 dark:bg-[#4C4E5D]/40 dark:hover:bg-[#4C4E5D] text-zinc-700 dark:text-[#DDD5D0] rounded-xl text-xs font-semibold transition-all cursor-pointer text-center"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-[#32323F] hover:bg-[#4C4E5D] dark:bg-[#4C4E5D] dark:hover:bg-[#5B5D6E] text-white dark:text-[#DDD5D0] rounded-xl text-xs font-bold transition-all cursor-pointer text-center shadow-xs"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FLOATING ADVISORY AI SERVICES CHATBOT */}
      <PersonalAIAdvisor
        transactions={transactions}
        saldoReal={saldoRealAcumulado}
        onAddTransaction={handleAddTransaction}
        accounts={accounts}
        selectedAccountId={selectedAccountId}
        categoriasDespesa={categoriasDespesa}
        categoriasReceita={categoriasReceita}
      />

      {/* SYSTEM METERS BOTTOM NAVIGATION BAR (Exclusively mobile tab bar) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-[#32323F]/95 backdrop-blur-md border-t border-zinc-200/80 dark:border-[#4C4E5D]/60 z-40 flex justify-around py-2 lg:hidden shadow-lg">
        <button
          onClick={() => {
            setActiveNav('dashboard');
            setDashboardTab('geral');
          }}
          className={`flex flex-col items-center gap-1 transition-all cursor-pointer py-1 px-3 rounded-lg ${
            activeNav === 'dashboard' && dashboardTab === 'geral'
              ? 'text-zinc-900 dark:text-[#DDD5D0] font-bold'
              : 'text-zinc-400 dark:text-[#988E96]'
          }`}
        >
          <LayoutDashboard className="w-4 h-4 text-emerald-400" />
          <span className="text-[10px]">Visão Geral</span>
        </button>
        <button
          onClick={() => {
            setActiveNav('dashboard');
            setDashboardTab('graficos');
          }}
          className={`flex flex-col items-center gap-1 transition-all cursor-pointer py-1 px-3 rounded-lg ${
            activeNav === 'dashboard' && dashboardTab === 'graficos'
              ? 'text-zinc-900 dark:text-[#DDD5D0] font-bold'
              : 'text-zinc-400 dark:text-[#988E96]'
          }`}
        >
          <TrendingUp className="w-4 h-4 text-blue-400" />
          <span className="text-[10px]">Gráficos</span>
        </button>
        <button
          onClick={() => {
            setActiveNav('dashboard');
            setDashboardTab('calendario');
          }}
          className={`flex flex-col items-center gap-1 transition-all cursor-pointer py-1 px-3 rounded-lg ${
            activeNav === 'dashboard' && dashboardTab === 'calendario'
              ? 'text-zinc-900 dark:text-[#DDD5D0] font-bold'
              : 'text-zinc-400 dark:text-[#988E96]'
          }`}
        >
          <Calendar className="w-4 h-4 text-amber-400" />
          <span className="text-[10px]">Calendário</span>
        </button>
        <button
          onClick={() => {
            setActiveNav('transacoes');
          }}
          className={`flex flex-col items-center gap-1 transition-all cursor-pointer py-1 px-3 rounded-lg ${
            activeNav === 'transacoes'
              ? 'text-zinc-900 dark:text-[#DDD5D0] font-bold'
              : 'text-zinc-400 dark:text-[#988E96]'
          }`}
        >
          <Receipt className="w-4 h-4 text-rose-400" />
          <span className="text-[10px]">Extrato</span>
        </button>
      </nav>

      {/* STREAK REWARDS AND ROSTER MODAL OVERLAY */}
      <StreakModal
        isOpen={isStreakModalOpen}
        onClose={() => setIsStreakModalOpen(false)}
        streak={streak}
        transactions={transactions}
      />

      {/* BANK STATEMENT IMPORTER MODAL */}
      <ImportStatementModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        accounts={accounts}
        selectedAccountId={selectedAccountId}
        existingTransactions={transactions}
        categoriasDespesa={categoriasDespesa}
        categoriasReceita={categoriasReceita}
        onImportBatch={handleBatchAddTransactions}
      />

      {/* FIREBASE GITHUB / CUSTOM DOMAIN AUTHORIZATION HELPER MODAL */}
      <FirebaseDomainModal
        isOpen={domainModalError.isOpen}
        onClose={() => setDomainModalError({ isOpen: false })}
        errorCode={domainModalError.code}
        errorMessage={domainModalError.message}
      />

      {/* CONTINUOUS RECURRENT EXPENSES MANAGER MODAL */}
      <ManageRecurrentModal
        isOpen={isManageRecurrentModalOpen}
        onClose={() => setIsManageRecurrentModalOpen(false)}
        rules={recurrentRules}
        onToggleRule={handleToggleRecurrentRule}
        onDeleteRule={handleDeleteRecurrentRule}
        accounts={accounts}
      />
    </div>
  );
}
