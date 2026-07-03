import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  Wallet, TrendingUp, ArrowUpCircle, ArrowDownCircle, Rocket,
  ChevronLeft, ChevronRight, Sun, Moon, Flame, Download, LogOut, User
} from 'lucide-react';
import {
  Transaction, Project, SubPainelType, ExtratoFilter, AppNotification, BankAccount, safeRandomUUID
} from './types';
import {
  supabase, testConnection, DEFAULT_CATEGORIES_DESPESA, DEFAULT_CATEGORIES_RECEITA,
  DEFAULT_DESPESAS, DEFAULT_RECEITAS, DEFAULT_PROJETOS, getLocal, saveLocal
} from './lib/supabase';
import { NudgeBanner } from './components/NudgeBanner';
import { MetricCard } from './components/MetricCard';
import { SubPanels } from './components/SubPanels';
import { TransactionForm } from './components/TransactionForm';
import { TransactionTable } from './components/TransactionTable';
import { FinancialCharts } from './components/FinancialCharts';
import { PersonalAIAdvisor } from './components/PersonalAIAdvisor';
import { StreakModal } from './components/StreakModal';
import { NotificationCenter } from './components/NotificationCenter';
import { AuthScreen } from './components/AuthScreen';
import { CreditCardBills } from './components/CreditCardBills';

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

export default function App() {
  // Current logged in user profile
  const [currentUser, setCurrentUser] = useState<{ email: string; name: string } | null>(() => {
    return getLocal<{ email: string; name: string } | null>('fintech_current_user', null);
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
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);

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

      if (!currentUser) return;

      let fetchedDespesas: Transaction[] = [];
      let fetchedReceitas: Transaction[] = [];
      let fetchedProjetos: Project[] = [];
      let fetchedCategoriasDespesa: string[] = [...DEFAULT_CATEGORIES_DESPESA];
      let fetchedCategoriasReceita: string[] = [...DEFAULT_CATEGORIES_RECEITA];

      const cachedCategoriasDespesa = getLocal<string[]>(`local_categorias_despesa_${currentUser.email}`, DEFAULT_CATEGORIES_DESPESA);
      const cachedCategoriasReceita = getLocal<string[]>(`local_categorias_receita_${currentUser.email}`, DEFAULT_CATEGORIES_RECEITA);

      if (connected) {
        try {
          // Fetch despesas first
          const { data: despData } = await supabase.from('fin_despesas').select('*');
          if (despData) {
            fetchedDespesas = despData
              .filter(d => {
                const desc = d.descricao || '';
                if (desc.startsWith('__profile__ |')) return false;
                const match = desc.match(/(.*?) \| user:(.*)/);
                if (match) {
                  return match[2].trim().toLowerCase() === currentUser.email.trim().toLowerCase();
                }
                return currentUser.email.trim().toLowerCase() === 'emersonrs70@gmail.com';
              })
              .map(d => parseTransactionFromDb(d, 'despesa'));
          }

          // Fetch receitas
          const { data: recData } = await supabase.from('fin_receitas').select('*');
          if (recData) {
            fetchedReceitas = recData
              .filter(r => {
                const desc = r.descricao || '';
                const match = desc.match(/(.*?) \| user:(.*)/);
                if (match) {
                  return match[2].trim().toLowerCase() === currentUser.email.trim().toLowerCase();
                }
                return currentUser.email.trim().toLowerCase() === 'emersonrs70@gmail.com';
              })
              .map(r => parseTransactionFromDb(r, 'receita'));
          }

          // Fetch custom categories
          const { data: catData } = await supabase.from('fin_categorias').select('nome');
          if (catData && catData.length > 0) {
            const dbNames = catData.map((c) => c.nome);
            const newDespesaSet = new Set([...DEFAULT_CATEGORIES_DESPESA]);
            const newReceitaSet = new Set([...DEFAULT_CATEGORIES_RECEITA]);

            dbNames.forEach((name) => {
              if (DEFAULT_CATEGORIES_RECEITA.includes(name)) {
                newReceitaSet.add(name);
              } else if (DEFAULT_CATEGORIES_DESPESA.includes(name)) {
                newDespesaSet.add(name);
              } else {
                const isCachedReceita = cachedCategoriasReceita.includes(name);
                const isCachedDespesa = cachedCategoriasDespesa.includes(name);
                if (isCachedReceita && !isCachedDespesa) {
                  newReceitaSet.add(name);
                } else if (isCachedDespesa && !isCachedReceita) {
                  newDespesaSet.add(name);
                } else {
                  const usedInReceitas = fetchedReceitas.some((r) => r.categoria === name);
                  const usedInDespesas = fetchedDespesas.some((d) => d.categoria === name);
                  if (usedInReceitas) {
                    newReceitaSet.add(name);
                  } else if (usedInDespesas) {
                    newDespesaSet.add(name);
                  } else {
                    newDespesaSet.add(name);
                  }
                }
              }
            });

            fetchedCategoriasDespesa = [...newDespesaSet];
            fetchedCategoriasReceita = [...newReceitaSet];
          }

          // Fetch projects
          const { data: projData } = await supabase.from('fin_projetos').select('*');
          if (projData) {
            fetchedProjetos = projData
              .filter(p => {
                const name = p.nome || '';
                const match = name.match(/(.*?) \| user:(.*)/);
                if (match) {
                  return match[2].trim().toLowerCase() === currentUser.email.trim().toLowerCase();
                }
                return currentUser.email.trim().toLowerCase() === 'emersonrs70@gmail.com';
              })
              .map(p => {
                const name = p.nome || '';
                const match = name.match(/(.*?) \| user:(.*)/);
                return {
                  ...p,
                  nome: match ? match[1].trim() : name
                };
              });
          }

          showToast('Sincronizado com Supabase com sucesso!', 'sucesso');
        } catch (err) {
          console.error('Err fetching from Supabase tables:', err);
          showToast('Erro ao sincronizar, usando dados locais.', 'erro');
        }
      }

      // If online fetched arrays are empty AND we have no local cache, seed with defaults so the user has an operational starting screen
      const cachedDespesas = getLocal<Transaction[]>(`local_despesas_${currentUser.email}`, []);
      const cachedReceitas = getLocal<Transaction[]>(`local_receitas_${currentUser.email}`, []);
      const cachedProjects = getLocal<Project[]>(`local_projects_${currentUser.email}`, []);

      const hasInitialized = localStorage.getItem(`fintech_initialized_${currentUser.email}`) === 'true';
      let finalDespesas: Transaction[] = [];
      let finalReceitas: Transaction[] = [];
      let finalProjects: Project[] = [];
      let finalCategoriasDespesa: string[] = [];
      let finalCategoriasReceita: string[] = [];

      if (!hasInitialized) {
        if (connected) {
          if (fetchedDespesas.length === 0 && fetchedReceitas.length === 0 && fetchedProjetos.length === 0) {
            // Seed to Supabase with proper format
            const baseTime = Date.now();
            const despesasToSeed = DEFAULT_DESPESAS.map(({ tipoItem, ...rest }, index) => {
              let accountId = 'santander';
              let faturaMes = undefined;
              if (index === 2 || index === 3) {
                accountId = 'santander-cartao';
                faturaMes = '2026-07';
              }
              const seedCreatedAt = new Date(baseTime + index * 1000).toISOString();
              const descWithAcc = `${rest.descricao} [acc:${accountId}]${faturaMes ? ` [bill:${faturaMes}]` : ''} [created:${seedCreatedAt}]`;
              return {
                id: safeRandomUUID(),
                descricao: `${descWithAcc} | user:${currentUser.email}`,
                valor: rest.valor,
                data: rest.data,
                categoria: rest.categoria
              };
            });
            const receitasToSeed = DEFAULT_RECEITAS.map(({ tipoItem, ...rest }, index) => {
              let accountId = 'santander';
              const seedCreatedAt = new Date(baseTime + (index + despesasToSeed.length) * 1000).toISOString();
              const descWithAcc = `${rest.descricao} [acc:${accountId}] [created:${seedCreatedAt}]`;
              return {
                id: safeRandomUUID(),
                descricao: `${descWithAcc} | user:${currentUser.email}`,
                valor: rest.valor,
                data: rest.data,
                categoria: rest.categoria
              };
            });
            const projetosToSeed = DEFAULT_PROJETOS.map(p => ({
              ...p,
              id: safeRandomUUID(),
              nome: `${p.nome} | user:${currentUser.email}`
            }));

            fetchedDespesas = despesasToSeed.map(d => parseTransactionFromDb(d, 'despesa'));
            fetchedReceitas = receitasToSeed.map(r => parseTransactionFromDb(r, 'receita'));
            fetchedProjetos = projetosToSeed.map(p => ({ ...p, nome: p.nome.split(' | user:')[0] }));
            fetchedCategoriasDespesa = [...DEFAULT_CATEGORIES_DESPESA];
            fetchedCategoriasReceita = [...DEFAULT_CATEGORIES_RECEITA];

            await Promise.all([
              supabase.from('fin_despesas').insert(despesasToSeed),
              supabase.from('fin_receitas').insert(receitasToSeed),
              supabase.from('fin_projetos').insert(projetosToSeed)
            ]).catch(err => console.warn('Supabase initial seed error:', err));
          }
          finalDespesas = fetchedDespesas;
          finalReceitas = fetchedReceitas;
          finalProjects = fetchedProjetos;
          finalCategoriasDespesa = fetchedCategoriasDespesa;
          finalCategoriasReceita = fetchedCategoriasReceita;
        } else {
          // Offline and first load, fallback to defaults with standard random UUIDs
          const baseTime = Date.now();
          finalDespesas = cachedDespesas.length > 0 ? cachedDespesas : DEFAULT_DESPESAS.map((d, index) => {
            let accountId = 'santander';
            let faturaMes = undefined;
            if (index === 2 || index === 3) {
              accountId = 'santander-cartao';
              faturaMes = '2026-07';
            }
            return {
              ...d,
              id: safeRandomUUID(),
              accountId,
              faturaMes,
              created_at: new Date(baseTime + index * 1000).toISOString()
            };
          });
          finalReceitas = cachedReceitas.length > 0 ? cachedReceitas : DEFAULT_RECEITAS.map((r, index) => {
            let accountId = 'santander';
            return {
              ...r,
              id: safeRandomUUID(),
              accountId,
              created_at: new Date(baseTime + (index + 10) * 1000).toISOString()
            };
          });
          finalProjects = cachedProjects.length > 0 ? cachedProjects : DEFAULT_PROJETOS.map(p => ({ ...p, id: safeRandomUUID() }));
          finalCategoriasDespesa = cachedCategoriasDespesa.length > 0 ? cachedCategoriasDespesa : DEFAULT_CATEGORIES_DESPESA;
          finalCategoriasReceita = cachedCategoriasReceita.length > 0 ? cachedCategoriasReceita : DEFAULT_CATEGORIES_RECEITA;
        }
        localStorage.setItem(`fintech_initialized_${currentUser.email}`, 'true');
      } else {
        // App is already initialized. We strictly respect the direct state (even if empty lists).
        if (connected) {
          finalDespesas = fetchedDespesas;
          finalReceitas = fetchedReceitas;
          finalProjects = fetchedProjetos;
          finalCategoriasDespesa = fetchedCategoriasDespesa;
          finalCategoriasReceita = fetchedCategoriasReceita;
        } else {
          finalDespesas = cachedDespesas;
          finalReceitas = cachedReceitas;
          finalProjects = cachedProjects;
          finalCategoriasDespesa = cachedCategoriasDespesa;
          finalCategoriasReceita = cachedCategoriasReceita;
        }
      }

      const finalTransactions = [...finalDespesas, ...finalReceitas];

      setTransactions(finalTransactions);
      setCategoriasDespesa(finalCategoriasDespesa);
      setCategoriasReceita(finalCategoriasReceita);
      setProjects(finalProjects);

      // Save to local storage for subsequent offline entries
      saveLocal(`local_despesas_${currentUser.email}`, finalTransactions.filter(t => t.tipoItem === 'despesa'));
      saveLocal(`local_receitas_${currentUser.email}`, finalTransactions.filter(t => t.tipoItem === 'receita'));
      saveLocal(`local_projects_${currentUser.email}`, finalProjects);
      saveLocal(`local_categorias_despesa_${currentUser.email}`, finalCategoriasDespesa);
      saveLocal(`local_categorias_receita_${currentUser.email}`, finalCategoriasReceita);
    }

    initData();
  }, [currentUser]);

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
    let success = false;
    if (isOnline) {
      try {
        const { error } = await supabase.from('fin_categorias').insert([{ nome }]);
        if (!error) success = true;
      } catch (err) {
        console.warn('Could not insert category on Supabase, fallback locally:', err);
      }
    }

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

    if (isOnline) {
      try {
        const table = tipoItem === 'despesa' ? 'fin_despesas' : 'fin_receitas';
        const { tipoItem: _, accountId: _acc, faturaMes: _fat, created_at: _cat, ...dbTransaction } = newTransaction;
        const serializedDesc = `${descricao} [acc:${accountId}]${faturaMes ? ` [bill:${faturaMes}]` : ''}${newTransaction.created_at ? ` [created:${newTransaction.created_at}]` : ''}`;
        const dbTransactionWithUser = {
          ...dbTransaction,
          descricao: `${serializedDesc} | user:${currentUser!.email}`
        };
        const { error } = await supabase.from(table).insert([dbTransactionWithUser]);
        if (error) {
          console.warn('Supabase insertion error, proceeding local-only:', error);
        }
      } catch (err) {
        console.warn('Supabase offline or table schema issue, fallback local:', err);
      }
    }

    setTransactions(prev => {
      const updated = [...prev, newTransaction];
      // Filter and update local caches
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
    const accId = updatedData.accountId || 'geral';
    const fatStr = updatedData.faturaMes || '';
    const serializedDesc = `${updatedData.descricao} [acc:${accId}]${fatStr ? ` [bill:${fatStr}]` : ''}`;

    if (isOnline) {
      try {
        const table = tipoItem === 'despesa' ? 'fin_despesas' : 'fin_receitas';
        const { error } = await supabase
          .from(table)
          .update({
            descricao: `${serializedDesc} | user:${currentUser!.email}`,
            valor: updatedData.valor,
            data: updatedData.data,
            categoria: updatedData.categoria
          })
          .eq('id', id);
        if (error) {
          console.warn('Supabase update error:', error);
        }
      } catch (err) {
        console.warn('Supabase connectivity issue during update, fallback local:', err);
      }
    }

    const updated = transactions.map((t) => {
      if (t.id === id) {
        return { ...t, ...updatedData };
      }
      return t;
    });
    setTransactions(updated);

    saveLocal(`local_despesas_${currentUser!.email}`, updated.filter((t) => t.tipoItem === 'despesa'));
    saveLocal(`local_receitas_${currentUser!.email}`, updated.filter((t) => t.tipoItem === 'receita'));

    showToast('Lançamento atualizado com sucesso!', 'sucesso');
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

    if (isOnline) {
      try {
        const dbProject = {
          ...newProj,
          nome: `${nome} | user:${currentUser!.email}`
        };
        const { error } = await supabase.from('fin_projetos').insert([dbProject]);
        if (error) console.warn('Supabase projects insertion error:', error);
      } catch (err) {
        console.warn('Could not insert project on Supabase, fallback local:', err);
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
    saveLocal(`local_projects_${currentUser!.email}`, updated);

    showToast('Projeto de meta deletado.', 'info');
  };

  const handleLogout = () => {
    if (window.confirm('Deseja realmente fechar seu cofre financeiro?')) {
      setCurrentUser(null);
      localStorage.removeItem('fintech_current_user');
      setTransactions([]);
      setProjects([]);
      setCategoriasDespesa(DEFAULT_CATEGORIES_DESPESA);
      setCategoriasReceita(DEFAULT_CATEGORIES_RECEITA);
      showToast('Cofre FintechCore fechado com sucesso!', 'info');
    }
  };

  // --- STATS ANALYSERS ---

  const currentYear = dataAncorada.getFullYear();
  const currentMonth = dataAncorada.getMonth();

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

  const despesasMes = currentMonthTransactions.filter((t) => t.tipoItem === 'despesa');
  const totalDespesasMes = despesasMes.reduce((acc, t) => acc + t.valor, 0);

  const receitasMes = currentMonthTransactions.filter((t) => t.tipoItem === 'receita');
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

  const renderSidebarContent = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center border-b border-slate-150 dark:border-slate-800 pb-2.5">
        <div className="flex items-center gap-1.5">
          <Wallet className="w-4.5 h-4.5 text-purple-600 shrink-0" />
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Contas & Cartões
          </h3>
        </div>
        <button
          onClick={() => setIsAddAccountModalOpen(true)}
          className="text-[9px] bg-purple-600 hover:bg-purple-700 text-white font-extrabold px-2.5 py-1.5 rounded-lg transition-all shadow-xs cursor-pointer hover:scale-[1.02]"
        >
          + Cadastrar
        </button>
      </div>

      <div className="flex flex-col gap-2.5 max-h-[500px] overflow-y-auto pr-1">
        {/* Consolidated View Button */}
        <button
          onClick={() => {
            setSelectedAccountId('consolidado');
            setIsMobileSidebarOpen(false);
          }}
          className={`w-full p-3 rounded-xl border text-left transition-all cursor-pointer flex justify-between items-center group relative ${
            selectedAccountId === 'consolidado'
              ? 'bg-slate-800 dark:bg-slate-100 dark:text-slate-900 text-white border-transparent shadow-md'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850 text-slate-800 dark:text-slate-100'
          }`}
        >
          <div className="truncate pr-2">
            <p className={`text-[8px] font-extrabold uppercase tracking-wider ${selectedAccountId === 'consolidado' ? 'text-white/80 dark:text-slate-600' : 'text-slate-400'}`}>
              Geral
            </p>
            <p className="text-xs font-black truncate mt-0.5">Consolidado</p>
            <p className="text-[10px] font-semibold mt-1 opacity-90 truncate">
              Disp: {formatCurrency(totalCashConsolidated)}
            </p>
          </div>
          <div className={`p-1.5 rounded-lg shrink-0 ${selectedAccountId === 'consolidado' ? 'bg-white/10 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
            Σ
          </div>
        </button>

        {/* Individual accounts list */}
        {accounts.map((acc) => {
          const isSelected = selectedAccountId === acc.id;
          const isCard = acc.tipo === 'credito';
          const balance = accountBalances[acc.id] ?? 0;
          
          let displayBalance = balance;
          if (isCard) {
            const currentBillMonthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
            const cardExpensesForMonth = transactions
              .filter(t => t.accountId === acc.id && t.tipoItem === 'despesa' && t.faturaMes === currentBillMonthStr)
              .reduce((sum, t) => sum + t.valor, 0);
            const cardPaymentsForMonth = transactions
              .filter(t => t.accountId === acc.id && t.tipoItem === 'receita' && t.faturaMes === currentBillMonthStr)
              .reduce((sum, t) => sum + t.valor, 0);
            displayBalance = cardExpensesForMonth - cardPaymentsForMonth;
          }

          return (
            <div
              key={acc.id}
              className={`w-full p-3 rounded-xl border text-left transition-all flex flex-col gap-2 group relative ${
                isSelected
                  ? `${acc.cor} text-white border-transparent shadow-md`
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850 text-slate-800 dark:text-slate-100'
              }`}
            >
              <div 
                className="cursor-pointer flex justify-between items-start"
                onClick={() => {
                  setSelectedAccountId(acc.id);
                  setIsMobileSidebarOpen(false);
                }}
              >
                <div className="truncate pr-2 flex-1">
                  <p className={`text-[8px] font-extrabold uppercase tracking-wider ${isSelected ? 'text-white/80' : 'text-slate-400'}`}>
                    {isCard ? 'Cartão de Crédito' : 'Deb/Corrente'}
                  </p>
                  <p className="text-xs font-black truncate mt-0.5">{acc.nome}</p>
                  <p className="text-[10px] font-semibold mt-1">
                    {isCard ? 'Fatura: ' : 'Saldo: '}
                    {formatCurrency(isCard ? displayBalance : balance)}
                  </p>
                  {isCard && acc.limiteCredito && (
                    <p className={`text-[8px] font-semibold opacity-80 mt-0.5`}>
                      Disponível: {formatCurrency(Math.max(acc.limiteCredito - balance, 0))}
                    </p>
                  )}
                </div>

                <div className={`p-1.5 rounded-lg shrink-0 ${isSelected ? 'bg-white/15' : 'bg-slate-100 dark:bg-slate-800'}`}>
                  {isCard ? (
                    <span className="text-[10px]">💳</span>
                  ) : (
                    <span className="text-[10px]">🏦</span>
                  )}
                </div>
              </div>

              {/* Edit and Delete operations */}
              <div className="flex justify-end gap-1.5 border-t border-dotted border-slate-200/40 pt-1.5 mt-0.5 opacity-80 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingAccount(acc);
                  }}
                  className={`p-1 rounded-md text-[9px] font-black cursor-pointer flex items-center gap-1 hover:scale-[1.03] active:scale-95 transition-all ${
                    isSelected 
                      ? 'bg-white/10 text-white hover:bg-white/20' 
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-slate-850 dark:text-slate-300 dark:hover:bg-slate-750'
                  }`}
                  title="Editar Conta"
                >
                  ⚙️ Editar
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteAccount(acc.id);
                  }}
                  className={`p-1 rounded-md text-[9px] font-black cursor-pointer flex items-center gap-1 hover:scale-[1.03] active:scale-95 transition-all ${
                    isSelected 
                      ? 'bg-red-500/20 text-red-100 hover:bg-red-500/30' 
                      : 'bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-950/20 dark:text-red-400 dark:hover:bg-red-950/40'
                  }`}
                  title="Excluir Conta"
                >
                  🗑️ Excluir
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

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

  if (!currentUser) {
    return <AuthScreen onLoginSuccess={(user) => { setCurrentUser(user); saveLocal('fintech_current_user', user); }} isOnline={isOnline} />;
  }

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
                ? 'border-red-200 dark:border-red-950 text-red-600 dark:text-red-400'
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
          <div className="flex items-center justify-between w-full sm:w-auto">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsMobileSidebarOpen(true)}
                className="lg:hidden p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl cursor-pointer text-slate-500 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center"
                title="Ver Contas e Cartões"
              >
                <Wallet className="w-4.5 h-4.5 text-purple-600" />
              </button>
              <div className="w-9 h-9 rounded-xl bg-purple-600 flex items-center justify-center text-white font-black text-base shadow-md shadow-purple-500/20 uppercase tracking-tight">
                F
              </div>
              <div>
                <h1 className="text-base font-black tracking-tight flex items-center gap-1 text-slate-800 dark:text-white">
                  Fintech<span className="text-purple-600">Core</span>
                  <span className="hidden sm:inline-block text-[9px] px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 rounded-md font-bold uppercase ml-1">
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

            {/* Streak & Notification for mobile header */}
            <div className="flex items-center gap-2 sm:hidden">
              <NotificationCenter
                notifications={notifications}
                onMarkAllRead={handleMarkAllRead}
                onMarkRead={handleMarkRead}
                onDeleteNotification={handleDeleteNotification}
                onClearAll={handleClearAllNotifications}
                onSendTestNotification={handleSendTestNotification}
              />
              <button
                onClick={() => setIsStreakModalOpen(true)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-black border transition-all duration-300 cursor-pointer ${
                  streak > 0
                    ? 'bg-amber-50/70 border-amber-200 text-amber-600 dark:bg-amber-950/20 dark:border-amber-900/40 dark:text-amber-400'
                    : 'bg-slate-100 dark:bg-slate-950 text-slate-400 dark:text-slate-600 border-slate-200 dark:border-slate-800/80'
                }`}
              >
                <Flame className={`w-3.5 h-3.5 ${streak > 0 ? 'fill-amber-500 text-amber-500 animate-pulse' : ''}`} />
                <span>{streak}</span>
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between w-full sm:w-auto gap-3">
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800 w-full sm:w-auto justify-between sm:justify-start">
              <button
                onClick={prevMonth}
                className="p-1 hover:bg-white dark:hover:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400 cursor-pointer hover:shadow-2xs transition-all flex-shrink-0"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {/* Régua de meses com animação de seleção */}
              <div className="flex items-center gap-0.5 overflow-x-auto scrollbar-none py-0.5 px-0.5 max-w-[200px] xs:max-w-[240px] sm:max-w-[340px] md:max-w-[420px] lg:max-w-md xl:max-w-lg select-none">
                {MONTHS.map((m, idx) => {
                  const isSelected = currentMonth === idx;
                  const abbrev = m.substring(0, 3);
                  return (
                    <button
                      key={m}
                      onClick={() => selectMonth(idx)}
                      className={`relative px-2 py-1 text-[11px] font-black rounded-md cursor-pointer transition-colors z-10 flex-shrink-0 select-none ${
                        isSelected
                          ? 'text-white font-extrabold'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
                      }`}
                    >
                      {isSelected && (
                        <motion.div
                          layoutId="activeMonthIndicator"
                          className="absolute inset-0 bg-purple-600 rounded-md -z-10 shadow-xs"
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
                className="p-1 hover:bg-white dark:hover:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400 cursor-pointer hover:shadow-2xs transition-all flex-shrink-0"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-800 mx-1 flex-shrink-0" />

              <button
                onClick={resetToToday}
                className="text-[10px] bg-white dark:bg-slate-800 px-2 py-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 font-bold transition-all hover:shadow-3xs cursor-pointer flex-shrink-0"
              >
                Hoje
              </button>

              <span className="text-[10px] font-black text-purple-600 dark:text-purple-400 px-1.5 flex-shrink-0">
                {currentYear}
              </span>
            </div>

            {/* Desktop Actions Only */}
            <div className="hidden sm:flex items-center gap-3">
              {currentUser && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-500/10 border border-purple-500/25 rounded-xl text-xs font-black text-purple-600 dark:text-purple-400">
                  <User className="w-3.5 h-3.5" />
                  <span>{currentUser.name}</span>
                </div>
              )}

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

              <NotificationCenter
                notifications={notifications}
                onMarkAllRead={handleMarkAllRead}
                onMarkRead={handleMarkRead}
                onDeleteNotification={handleDeleteNotification}
                onClearAll={handleClearAllNotifications}
                onSendTestNotification={handleSendTestNotification}
              />

              {/* LIGHT/DARK MODE TOGGLE */}
              <button
                onClick={toggleTheme}
                className="p-2.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl hover:shadow-2xs cursor-pointer text-slate-500 dark:text-slate-400 transition-all font-bold"
              >
                {isDarkMode ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-slate-600" />}
              </button>

              {/* LOGOUT BUTTON */}
              <button
                onClick={handleLogout}
                className="p-2.5 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 text-rose-500 rounded-xl cursor-pointer transition-all hover:shadow-2xs active:scale-95"
                title="Sair do Cofre"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* CENTER STAGE CONTAINER */}
      <main className="max-w-7xl mx-auto px-4 md:px-6 mt-5">
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          
          {/* DESKTOP SIDEBAR MENU LATERAL */}
          <aside className="hidden lg:block w-72 flex-shrink-0 bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800 p-5 rounded-2xl shadow-2xs self-start sticky top-24 space-y-4">
            {renderSidebarContent()}
          </aside>

          {/* MAIN STAGE CONTENTS */}
          <div className="flex-1 w-full space-y-6">
            
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

            {/* CREDIT CARD BILLING STATEMENTS EXPANSION */}
            {activeAccount && activeAccount.tipo === 'credito' && (
              <CreditCardBills
                activeAccount={activeAccount}
                transactions={transactions}
                checkingAccounts={accounts.filter(a => a.tipo !== 'credito')}
                onAddTransaction={handleAddTransaction}
                accountBalances={accountBalances}
              />
            )}

            {/* SUBPANELS RICH EXPANSION container */}
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
          </div>
        </div>

        {/* ACCOUNT REGISTRATION MODAL */}
        {isAddAccountModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-800 pb-2">
                <Wallet className="w-4 h-4 text-purple-600" />
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
                  <label className="block text-[10px] uppercase font-black text-slate-400 dark:text-slate-500 mb-1.5">
                    Nome da Conta / Cartão
                  </label>
                  <input
                    type="text"
                    name="nome"
                    required
                    placeholder="Ex: Inter, Santander, Caixa..."
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 dark:text-white rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 font-semibold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] uppercase font-black text-slate-400 dark:text-slate-500 mb-1.5">
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
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 dark:text-white rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 font-semibold"
                    >
                      <option value="corrente">Conta Corrente</option>
                      <option value="poupanca">Conta Poupança</option>
                      <option value="carteira">Dinheiro em Carteira</option>
                      <option value="credito">Cartão de Crédito</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-black text-slate-400 dark:text-slate-500 mb-1.5">
                      Cor Visual
                    </label>
                    <select
                      name="cor"
                      required
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 dark:text-white rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 font-semibold"
                    >
                      <option value="bg-purple-600">Roxo</option>
                      <option value="bg-orange-500">Laranja</option>
                      <option value="bg-red-600">Vermelho</option>
                      <option value="bg-emerald-600">Verde</option>
                      <option value="bg-blue-600">Azul</option>
                      <option value="bg-slate-700">Preto Slate</option>
                      <option value="bg-pink-600">Rosa</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label id="initial-balance-label" className="block text-[10px] uppercase font-black text-slate-400 dark:text-slate-500 mb-1.5">
                    Saldo Inicial (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    name="saldoInicial"
                    id="initial-balance-input"
                    defaultValue="0"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 dark:text-white rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 font-semibold"
                  />
                </div>

                {/* CREDIT CARD FIELDS */}
                <div id="credit-card-fields" style={{ display: 'none' }} className="space-y-3">
                  <div>
                    <label className="block text-[10px] uppercase font-black text-slate-400 dark:text-slate-500 mb-1.5">
                      Limite de Crédito (R$)
                    </label>
                    <input
                      type="number"
                      step="50"
                      name="limiteCredito"
                      placeholder="Ex: 5000"
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 dark:text-white rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 font-semibold"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] uppercase font-black text-slate-400 dark:text-slate-500 mb-1.5">
                        Dia Fechamento
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="31"
                        name="diaFechamento"
                        defaultValue="5"
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 dark:text-white rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-black text-slate-400 dark:text-slate-500 mb-1.5">
                        Dia Vencimento
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="31"
                        name="diaVencimento"
                        defaultValue="12"
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 dark:text-white rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 font-semibold"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsAddAccountModalOpen(false)}
                    className="flex-1 px-4 py-2 bg-slate-100 dark:bg-slate-850 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-350 rounded-xl text-xs font-black transition-all cursor-pointer text-center"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black transition-all cursor-pointer text-center shadow-md shadow-purple-500/10"
                  >
                    Salvar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ROW 2: TRANSACTIONS ADDITION AND LEDGER HISTORIES */}
        <div className={mobileTabActive === 'transacoes' ? 'block' : 'hidden md:block'}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <TransactionForm
              categoriasDespesa={categoriasDespesa}
              categoriasReceita={categoriasReceita}
              onAddTransaction={handleAddTransaction}
              onAddCategory={handleAddCategory}
              accounts={accounts}
              selectedAccountId={selectedAccountId}
            />
            <div className="lg:col-span-2">
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
              />
            </div>
          </div>
        </div>

        {/* ROW 3: VISUAL METRICS ESTATÍSTICA DE CARGA */}
        <div className={mobileTabActive === 'planejador' ? 'block' : 'hidden md:block'}>
          <FinancialCharts
            transactions={transactions}
            categorias={categoriasDespesa}
            currentMonth={currentMonth}
            currentYear={currentYear}
            selectedAccountId={selectedAccountId}
          />
        </div>

          </div> {/* end of flex-1 w-full space-y-6 */}
        </div> {/* end of flex flex-col lg:flex-row gap-6 items-start */}
      </main>

      {/* MOBILE DRAWER SIDEBAR */}
      {isMobileSidebarOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex justify-start animate-in fade-in duration-200">
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="w-80 max-w-[85vw] bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 h-full p-5 shadow-2xl flex flex-col justify-between"
          >
            <div className="flex-1 overflow-y-auto pr-1">
              <div className="flex justify-between items-center mb-4">
                <span className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-1.5">
                  🏦 Menu de Contas
                </span>
                <button
                  onClick={() => setIsMobileSidebarOpen(false)}
                  className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl cursor-pointer text-slate-500 active:scale-95 transition-all text-xs font-black"
                >
                  X
                </button>
              </div>
              {renderSidebarContent()}
            </div>

            {/* Mobile Actions and Config Drawer Section */}
            <div className="space-y-3.5 border-t border-slate-150 dark:border-slate-800 pt-4 mt-auto">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Ações & Ajustes
              </p>
              
              {currentUser && (
                <div className="flex items-center gap-2 px-3 py-2 bg-purple-500/10 border border-purple-500/25 rounded-xl text-xs font-black text-purple-600 dark:text-purple-400">
                  <User className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{currentUser.name}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                {/* Theme Switch */}
                <button
                  onClick={toggleTheme}
                  className="flex items-center justify-center gap-1.5 p-2 bg-slate-50 dark:bg-slate-850 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-850 rounded-xl cursor-pointer text-slate-700 dark:text-slate-300 transition-all text-xs font-black active:scale-95"
                >
                  {isDarkMode ? (
                    <>
                      <Sun className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <span>Claro</span>
                    </>
                  ) : (
                    <>
                      <Moon className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                      <span>Escuro</span>
                    </>
                  )}
                </button>

                {/* Sair do Cofre */}
                <button
                  onClick={handleLogout}
                  className="flex items-center justify-center gap-1.5 p-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-500 rounded-xl cursor-pointer transition-all text-xs font-black active:scale-95"
                  title="Sair do Cofre"
                >
                  <LogOut className="w-3.5 h-3.5 shrink-0" />
                  <span>Sair</span>
                </button>
              </div>

              {/* Install PWA Option */}
              {deferredPrompt && (
                <button
                  onClick={triggerInstallApp}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-xl text-xs font-black transition-all cursor-pointer shadow-xs active:scale-95 border border-emerald-400/20"
                >
                  <Download className="w-3.5 h-3.5 shrink-0" />
                  <span>Instalar Aplicativo</span>
                </button>
              )}

              <div className="text-[9px] text-slate-400 text-center pt-1.5">
                Toque fora ou no X para fechar
              </div>
            </div>
          </motion.div>
          {/* Backdrop click closer */}
          <div className="flex-1" onClick={() => setIsMobileSidebarOpen(false)} />
        </div>
      )}

      {/* ACCOUNT EDITING MODAL */}
      {editingAccount && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-800 pb-2">
              <Wallet className="w-4.5 h-4.5 text-purple-600" />
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
                <label className="block text-[10px] uppercase font-black text-slate-400 dark:text-slate-500 mb-1.5">
                  Nome da Conta / Cartão
                </label>
                <input
                  type="text"
                  name="nome"
                  required
                  defaultValue={editingAccount.nome}
                  placeholder="Ex: Inter, Santander, Caixa..."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 dark:text-white rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase font-black text-slate-400 dark:text-slate-500 mb-1.5">
                    Tipo de Conta
                  </label>
                  <select
                    name="tipo"
                    required
                    defaultValue={editingAccount.tipo}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 dark:text-white rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 font-semibold"
                  >
                    <option value="corrente">Conta Corrente</option>
                    <option value="poupanca">Conta Poupança</option>
                    <option value="carteira">Dinheiro em Carteira</option>
                    <option value="credito">Cartão de Crédito</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-black text-slate-400 dark:text-slate-500 mb-1.5">
                    Cor Visual
                  </label>
                  <select
                    name="cor"
                    required
                    defaultValue={editingAccount.cor}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 dark:text-white rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 font-semibold"
                  >
                    <option value="bg-purple-600">Roxo</option>
                    <option value="bg-orange-500">Laranja</option>
                    <option value="bg-red-600">Vermelho</option>
                    <option value="bg-red-750">Vermelho Escuro</option>
                    <option value="bg-emerald-600">Verde</option>
                    <option value="bg-blue-600">Azul</option>
                    <option value="bg-slate-700">Preto Slate</option>
                    <option value="bg-pink-600">Rosa</option>
                  </select>
                </div>
              </div>

              {editingAccount.tipo !== 'credito' && (
                <div>
                  <label className="block text-[10px] uppercase font-black text-slate-400 dark:text-slate-500 mb-1.5">
                    Saldo Inicial (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    name="saldoInicial"
                    defaultValue={editingAccount.saldoInicial}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 dark:text-white rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 font-semibold"
                  />
                </div>
              )}

              {/* CREDIT CARD FIELDS */}
              {editingAccount.tipo === 'credito' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] uppercase font-black text-slate-400 dark:text-slate-500 mb-1.5">
                      Limite de Crédito (R$)
                    </label>
                    <input
                      type="number"
                      step="50"
                      name="limiteCredito"
                      defaultValue={editingAccount.limiteCredito || 5000}
                      placeholder="Ex: 5000"
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 dark:text-white rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 font-semibold"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] uppercase font-black text-slate-400 dark:text-slate-500 mb-1.5">
                        Dia Fechamento
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="31"
                        name="diaFechamento"
                        defaultValue={editingAccount.diaFechamento || 5}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 dark:text-white rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-black text-slate-400 dark:text-slate-500 mb-1.5">
                        Dia Vencimento
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="31"
                        name="diaVencimento"
                        defaultValue={editingAccount.diaVencimento || 12}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 dark:text-white rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 font-semibold"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingAccount(null)}
                  className="flex-1 px-4 py-2 bg-slate-100 dark:bg-slate-850 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-350 rounded-xl text-xs font-black transition-all cursor-pointer text-center"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black transition-all cursor-pointer text-center shadow-md shadow-purple-500/10"
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
      />

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
