import {
  collection, doc, setDoc, deleteDoc, onSnapshot, getDocs, writeBatch
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType, getLocal, saveLocal } from './firebase';
import { Transaction, Project, BankAccount, RecurrentRule, PendingSuggestion } from '../types';

export interface SyncDataState {
  transactions: Transaction[];
  projects: Project[];
  categoriesDespesa: string[];
  categoriesReceita: string[];
  accounts: BankAccount[];
}

/**
 * Perform one-time automated migration from localStorage / legacy cache into Firestore
 * if the user has local data but their Firestore account is fresh/empty.
 */
export async function migrateLocalDataToFirestore(
  userId: string,
  userEmail: string,
  onProgress?: (msg: string) => void
): Promise<{ migratedCount: number }> {
  try {
    const transactionsPath = `users/${userId}/transactions`;
    const projectsPath = `users/${userId}/projects`;
    const accountsPath = `users/${userId}/accounts`;

    // Check which records already exist in Firestore for this user
    const existingSnap = await getDocs(collection(db, transactionsPath));
    const cloudTransactionIds = new Set<string>();
    existingSnap.forEach(d => cloudTransactionIds.add(d.id));

    const existingProjectsSnap = await getDocs(collection(db, projectsPath));
    const cloudProjectIds = new Set<string>();
    existingProjectsSnap.forEach(d => cloudProjectIds.add(d.id));

    const existingAccountsSnap = await getDocs(collection(db, accountsPath));
    const cloudAccountIds = new Set<string>();
    existingAccountsSnap.forEach(d => cloudAccountIds.add(d.id));

    onProgress?.('Verificando novos lançamentos locais para sincronização com a nuvem...');

    // Gather all local data
    const cachedDespesas = getLocal<Transaction[]>(`local_despesas_${userEmail}`, [])
      .concat(getLocal<Transaction[]>('local_despesas_emersonrs70@gmail.com', []));
    const cachedReceitas = getLocal<Transaction[]>(`local_receitas_${userEmail}`, [])
      .concat(getLocal<Transaction[]>('local_receitas_emersonrs70@gmail.com', []));
    const cachedProjects = getLocal<Project[]>(`local_projects_${userEmail}`, [])
      .concat(getLocal<Project[]>('local_projects_emersonrs70@gmail.com', []));
    const cachedAccounts = getLocal<BankAccount[]>('local_bank_accounts', []);
    const cachedCatDesp = getLocal<string[]>(`local_categorias_despesa_${userEmail}`, []);
    const cachedCatRec = getLocal<string[]>(`local_categorias_receita_${userEmail}`, []);

    // Deduplicate local items by ID
    const uniqueTransactionsMap = new Map<string, Transaction>();
    [...cachedDespesas, ...cachedReceitas].forEach(t => {
      if (t && t.id) uniqueTransactionsMap.set(t.id, t);
    });

    const uniqueProjectsMap = new Map<string, Project>();
    cachedProjects.forEach(p => {
      if (p && p.id) uniqueProjectsMap.set(p.id, p);
    });

    const uniqueAccountsMap = new Map<string, BankAccount>();
    cachedAccounts.forEach(a => {
      if (a && a.id) uniqueAccountsMap.set(a.id, a);
    });

    // Only upload items that do not exist yet in Firestore
    const transactionsToMigrate = Array.from(uniqueTransactionsMap.values())
      .filter(t => !cloudTransactionIds.has(t.id));
    const projectsToMigrate = Array.from(uniqueProjectsMap.values())
      .filter(p => !cloudProjectIds.has(p.id));
    const accountsToMigrate = Array.from(uniqueAccountsMap.values())
      .filter(a => !cloudAccountIds.has(a.id));

    let migrated = 0;

    // Use batches to write efficiently
    if (transactionsToMigrate.length > 0) {
      onProgress?.(`Enviando ${transactionsToMigrate.length} novos lançamentos locais para a nuvem...`);
      const batch = writeBatch(db);
      for (const t of transactionsToMigrate) {
        const docRef = doc(db, transactionsPath, t.id);
        batch.set(docRef, {
          descricao: t.descricao || 'Sem descrição',
          valor: Number(t.valor) || 0,
          data: t.data || new Date().toISOString().split('T')[0],
          categoria: t.categoria || 'Outros',
          tipoItem: t.tipoItem || 'despesa',
          accountId: t.accountId || 'santander',
          faturaMes: t.faturaMes || '',
          userId: userId,
          created_at: t.created_at || new Date().toISOString()
        });
        migrated++;
      }
      await batch.commit();
    }

    if (projectsToMigrate.length > 0) {
      const batch = writeBatch(db);
      for (const p of projectsToMigrate) {
        const docRef = doc(db, projectsPath, p.id);
        batch.set(docRef, {
          nome: p.nome || 'Meta',
          valor: Number(p.valor) || 0,
          dataAlvo: p.dataAlvo || new Date().toISOString().split('T')[0],
          userId: userId,
          createdAt: new Date().toISOString()
        });
      }
      await batch.commit();
    }

    if (accountsToMigrate.length > 0) {
      const batch = writeBatch(db);
      for (const a of accountsToMigrate) {
        const docRef = doc(db, accountsPath, a.id);
        batch.set(docRef, {
          nome: a.nome,
          tipo: a.tipo,
          saldoInicial: Number(a.saldoInicial) || 0,
          cor: a.cor || 'bg-red-600',
          limiteCredito: Number(a.limiteCredito) || 0,
          diaFechamento: Number(a.diaFechamento) || 5,
          diaVencimento: Number(a.diaVencimento) || 12,
          userId: userId
        });
      }
      await batch.commit();
    }

    // Save custom categories
    const categoriesPath = `users/${userId}/categories`;
    const batchCat = writeBatch(db);
    cachedCatDesp.forEach((cat, idx) => {
      const safeId = `desp_${idx}_${encodeURIComponent(cat).replace(/[^a-zA-Z0-9]/g, '_')}`;
      batchCat.set(doc(db, categoriesPath, safeId), {
        nome: cat,
        tipo: 'despesa',
        userId: userId
      });
    });
    cachedCatRec.forEach((cat, idx) => {
      const safeId = `rec_${idx}_${encodeURIComponent(cat).replace(/[^a-zA-Z0-9]/g, '_')}`;
      batchCat.set(doc(db, categoriesPath, safeId), {
        nome: cat,
        tipo: 'receita',
        userId: userId
      });
    });
    await batchCat.commit();

    return { migratedCount: migrated };
  } catch (error) {
    console.error('Error during Firebase migration:', error);
    handleFirestoreError(error, OperationType.WRITE, `users/${userId}`);
    return { migratedCount: 0 };
  }
}

/**
 * Subscribe to real-time updates for a user's collection in Firestore
 */
export function subscribeToUserFinance(
  userId: string,
  callbacks: {
    onTransactions: (items: Transaction[]) => void;
    onProjects: (items: Project[]) => void;
    onAccounts: (items: BankAccount[]) => void;
    onRecurrentRules?: (items: RecurrentRule[]) => void;
    onCategories?: (despesas: string[], receitas: string[]) => void;
    onPendingSuggestions?: (items: PendingSuggestion[]) => void;
    onError: (err: any) => void;
  }
): () => void {
  const unsubTransactions = onSnapshot(
    collection(db, `users/${userId}/transactions`),
    (snapshot) => {
      const list: Transaction[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        list.push({
          id: d.id,
          descricao: data.descricao,
          valor: data.valor,
          data: data.data,
          categoria: data.categoria,
          tipoItem: data.tipoItem,
          accountId: data.accountId,
          faturaMes: data.faturaMes,
          created_at: data.created_at
        });
      });
      callbacks.onTransactions(list);
    },
    (err) => {
      callbacks.onError(err);
      handleFirestoreError(err, OperationType.LIST, `users/${userId}/transactions`);
    }
  );

  const unsubProjects = onSnapshot(
    collection(db, `users/${userId}/projects`),
    (snapshot) => {
      const list: Project[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        list.push({
          id: d.id,
          nome: data.nome,
          valor: data.valor,
          dataAlvo: data.dataAlvo
        });
      });
      callbacks.onProjects(list);
    },
    (err) => {
      callbacks.onError(err);
      handleFirestoreError(err, OperationType.LIST, `users/${userId}/projects`);
    }
  );

  const unsubAccounts = onSnapshot(
    collection(db, `users/${userId}/accounts`),
    (snapshot) => {
      const list: BankAccount[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        list.push({
          id: d.id,
          nome: data.nome,
          tipo: data.tipo,
          saldoInicial: data.saldoInicial,
          cor: data.cor,
          limiteCredito: data.limiteCredito,
          diaFechamento: data.diaFechamento,
          diaVencimento: data.diaVencimento
        });
      });
      if (list.length > 0) {
        callbacks.onAccounts(list);
      }
    },
    (err) => {
      callbacks.onError(err);
      handleFirestoreError(err, OperationType.LIST, `users/${userId}/accounts`);
    }
  );

  const unsubRecurrentRules = onSnapshot(
    collection(db, `users/${userId}/recurrent_rules`),
    (snapshot) => {
      const list: RecurrentRule[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        list.push({
          id: d.id,
          descricao: data.descricao,
          valor: data.valor,
          diaDoMes: data.diaDoMes,
          categoria: data.categoria,
          tipoItem: data.tipoItem,
          accountId: data.accountId,
          ativa: data.ativa !== false,
          criadaEm: data.criadaEm,
          ultimoMesGerado: data.ultimoMesGerado
        });
      });
      if (callbacks.onRecurrentRules) {
        callbacks.onRecurrentRules(list);
      }
    },
    (err) => {
      callbacks.onError(err);
      handleFirestoreError(err, OperationType.LIST, `users/${userId}/recurrent_rules`);
    }
  );

  const unsubCategories = onSnapshot(
    collection(db, `users/${userId}/categories`),
    (snapshot) => {
      const despesasSet = new Set<string>();
      const receitasSet = new Set<string>();
      snapshot.forEach((d) => {
        const data = d.data();
        if (data.tipo === 'despesa' && data.nome) {
          despesasSet.add(data.nome);
        } else if (data.tipo === 'receita' && data.nome) {
          receitasSet.add(data.nome);
        }
      });
      if (callbacks.onCategories && (despesasSet.size > 0 || receitasSet.size > 0)) {
        callbacks.onCategories(Array.from(despesasSet), Array.from(receitasSet));
      }
    },
    (err) => {
      callbacks.onError(err);
      handleFirestoreError(err, OperationType.LIST, `users/${userId}/categories`);
    }
  );

  const unsubSuggestions = onSnapshot(
    collection(db, `users/${userId}/pending_suggestions`),
    (snapshot) => {
      const list: PendingSuggestion[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        if (data.status === 'pendente') {
          list.push({
            id: d.id,
            rawText: data.rawText || '',
            banco: data.banco || 'Banco',
            descricao: data.descricao || 'Lançamento',
            valor: Number(data.valor) || 0,
            tipoItem: data.tipoItem === 'receita' ? 'receita' : 'despesa',
            categoria: data.categoria || 'Outros',
            accountId: data.accountId || 'santander',
            data: data.data || new Date().toISOString().split('T')[0],
            status: data.status,
            userId: data.userId,
            createdAt: data.createdAt || new Date().toISOString()
          });
        }
      });
      // Sort newest first
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      if (callbacks.onPendingSuggestions) {
        callbacks.onPendingSuggestions(list);
      }
    },
    (err) => {
      callbacks.onError(err);
      handleFirestoreError(err, OperationType.LIST, `users/${userId}/pending_suggestions`);
    }
  );

  return () => {
    unsubTransactions();
    unsubProjects();
    unsubAccounts();
    unsubRecurrentRules();
    unsubCategories();
    unsubSuggestions();
  };
}

/**
 * Firestore CRUD helpers
 */
export async function addTransactionToFirestore(userId: string, item: Transaction): Promise<void> {
  const path = `users/${userId}/transactions/${item.id}`;
  try {
    await setDoc(doc(db, `users/${userId}/transactions`, item.id), {
      descricao: item.descricao,
      valor: item.valor,
      data: item.data,
      categoria: item.categoria,
      tipoItem: item.tipoItem,
      accountId: item.accountId || 'santander',
      faturaMes: item.faturaMes || '',
      userId: userId,
      created_at: item.created_at || new Date().toISOString()
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function batchAddTransactionsToFirestore(userId: string, items: Transaction[]): Promise<void> {
  const path = `users/${userId}/transactions`;
  try {
    const batch = writeBatch(db);
    for (const item of items) {
      const docRef = doc(db, path, item.id);
      batch.set(docRef, {
        descricao: item.descricao,
        valor: item.valor,
        data: item.data,
        categoria: item.categoria,
        tipoItem: item.tipoItem,
        accountId: item.accountId || 'santander',
        faturaMes: item.faturaMes || '',
        userId: userId,
        created_at: item.created_at || new Date().toISOString()
      });
    }
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function deleteTransactionFromFirestore(userId: string, transactionId: string): Promise<void> {
  const path = `users/${userId}/transactions/${transactionId}`;
  try {
    await deleteDoc(doc(db, `users/${userId}/transactions`, transactionId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function updateTransactionInFirestore(userId: string, item: Transaction): Promise<void> {
  const path = `users/${userId}/transactions/${item.id}`;
  try {
    await setDoc(doc(db, `users/${userId}/transactions`, item.id), {
      descricao: item.descricao,
      valor: item.valor,
      data: item.data,
      categoria: item.categoria,
      tipoItem: item.tipoItem,
      accountId: item.accountId || 'santander',
      faturaMes: item.faturaMes || '',
      userId: userId,
      created_at: item.created_at || new Date().toISOString()
    }, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function addProjectToFirestore(userId: string, project: Project): Promise<void> {
  const path = `users/${userId}/projects/${project.id}`;
  try {
    await setDoc(doc(db, `users/${userId}/projects`, project.id), {
      nome: project.nome,
      valor: project.valor,
      dataAlvo: project.dataAlvo,
      userId: userId,
      createdAt: new Date().toISOString()
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function deleteProjectFromFirestore(userId: string, projectId: string): Promise<void> {
  const path = `users/${userId}/projects/${projectId}`;
  try {
    await deleteDoc(doc(db, `users/${userId}/projects`, projectId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function saveRecurrentRuleToFirestore(userId: string, rule: RecurrentRule): Promise<void> {
  const path = `users/${userId}/recurrent_rules/${rule.id}`;
  try {
    await setDoc(doc(db, `users/${userId}/recurrent_rules`, rule.id), {
      id: rule.id,
      descricao: rule.descricao,
      valor: rule.valor,
      diaDoMes: rule.diaDoMes || 1,
      categoria: rule.categoria,
      tipoItem: rule.tipoItem,
      accountId: rule.accountId || 'santander',
      ativa: rule.ativa !== false,
      criadaEm: rule.criadaEm || new Date().toISOString(),
      ultimoMesGerado: rule.ultimoMesGerado || '',
      userId: userId
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function deleteRecurrentRuleFromFirestore(userId: string, ruleId: string): Promise<void> {
  const path = `users/${userId}/recurrent_rules/${ruleId}`;
  try {
    await deleteDoc(doc(db, `users/${userId}/recurrent_rules`, ruleId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function addCategoryToFirestore(userId: string, nome: string, tipo: 'despesa' | 'receita'): Promise<void> {
  const safeId = `${tipo}_${encodeURIComponent(nome).replace(/[^a-zA-Z0-9]/g, '_')}`.slice(0, 120);
  const path = `users/${userId}/categories/${safeId}`;
  try {
    await setDoc(doc(db, `users/${userId}/categories`, safeId), {
      nome,
      tipo,
      userId
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function deleteCategoryFromFirestore(userId: string, nome: string, tipo: 'despesa' | 'receita'): Promise<void> {
  const safeId = `${tipo}_${encodeURIComponent(nome).replace(/[^a-zA-Z0-9]/g, '_')}`.slice(0, 120);
  const path = `users/${userId}/categories/${safeId}`;
  try {
    await deleteDoc(doc(db, `users/${userId}/categories`, safeId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function savePendingSuggestionToFirestore(userId: string, item: PendingSuggestion): Promise<void> {
  const path = `users/${userId}/pending_suggestions/${item.id}`;
  try {
    await setDoc(doc(db, `users/${userId}/pending_suggestions`, item.id), {
      id: item.id,
      rawText: item.rawText,
      banco: item.banco,
      descricao: item.descricao,
      valor: item.valor,
      tipoItem: item.tipoItem,
      categoria: item.categoria,
      accountId: item.accountId,
      data: item.data,
      status: item.status,
      userId: userId,
      createdAt: item.createdAt || new Date().toISOString()
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function updatePendingSuggestionStatusInFirestore(
  userId: string,
  suggestionId: string,
  status: 'aprovada' | 'descartada'
): Promise<void> {
  const path = `users/${userId}/pending_suggestions/${suggestionId}`;
  try {
    await setDoc(doc(db, `users/${userId}/pending_suggestions`, suggestionId), {
      status
    }, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function deletePendingSuggestionFromFirestore(userId: string, suggestionId: string): Promise<void> {
  const path = `users/${userId}/pending_suggestions/${suggestionId}`;
  try {
    await deleteDoc(doc(db, `users/${userId}/pending_suggestions`, suggestionId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

/**
 * Real-time listener for incoming bank notifications from mobile MacroDroid directly via Firestore.
 * Works seamlessly on static GitHub Pages, local dev, or anywhere without an Express server.
 */
export function subscribeToIncomingNotifications(
  onNotification: (notif: { id: string; text: string; title?: string; app?: string }) => void
): () => void {
  try {
    const notifsCol = collection(db, 'incoming_notifications');
    const unsubscribe = onSnapshot(notifsCol, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          if (data && data.text) {
            onNotification({
              id: change.doc.id,
              text: data.text,
              title: data.title,
              app: data.app
            });
            // Delete from incoming buffer so it doesn't process multiple times
            deleteDoc(doc(db, 'incoming_notifications', change.doc.id)).catch(() => {});
          }
        }
      });
    }, (err) => {
      console.warn('Incoming notifications listener notice:', err);
    });
    return unsubscribe;
  } catch (err) {
    console.warn('Failed to subscribe to incoming notifications:', err);
    return () => {};
  }
}

