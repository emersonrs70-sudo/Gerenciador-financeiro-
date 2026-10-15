import {
  collection, doc, setDoc, deleteDoc, onSnapshot, getDocs, writeBatch
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType, getLocal, saveLocal } from './firebase';
import { Transaction, Project, BankAccount } from '../types';

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

    // Check if Firestore already has transactions for this user
    const existingSnap = await getDocs(collection(db, transactionsPath));
    if (!existingSnap.empty) {
      // User already has records in Firestore, no need to overwrite with seed defaults
      return { migratedCount: existingSnap.size };
    }

    onProgress?.('Identificando dados locais para migração ao Firebase...');

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

    // Deduplicate by ID
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

    const transactionsToMigrate = Array.from(uniqueTransactionsMap.values());
    const projectsToMigrate = Array.from(uniqueProjectsMap.values());
    const accountsToMigrate = Array.from(uniqueAccountsMap.values());

    let migrated = 0;

    // Use batches to write efficiently
    if (transactionsToMigrate.length > 0) {
      onProgress?.(`Migrando ${transactionsToMigrate.length} transações para o Firebase Firestore...`);
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

  return () => {
    unsubTransactions();
    unsubProjects();
    unsubAccounts();
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
