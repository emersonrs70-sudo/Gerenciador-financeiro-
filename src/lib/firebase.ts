import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import {
  getFirestore, doc, getDoc, getDocFromServer, setDoc, deleteDoc,
  collection, query, onSnapshot, Unsubscribe
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { Transaction, Project, BankAccount } from '../types';

// Initialize Firebase App and Services
export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validate Connection to Firestore on startup
export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore offline:', error.message);
      return false;
    }
    // Reaching server (even with doc not found or permissions) confirms connection
    return true;
  }
}

// Default static lists
export const DEFAULT_CATEGORIES_DESPESA = ["Moradia", "Alimentação", "Transporte", "Lazer", "Outros"];
export const DEFAULT_CATEGORIES_RECEITA = ["Salário", "Freelance", "Investimentos", "Reembolsos", "Outras Receitas"];
export const DEFAULT_CATEGORIES = DEFAULT_CATEGORIES_DESPESA;

export const DEFAULT_DESPESAS: Transaction[] = [
  { id: 'd1', descricao: 'Supermercado da Semana', valor: 350.50, data: '2026-06-15', categoria: 'Alimentação', tipoItem: 'despesa' },
  { id: 'd2', descricao: 'Mensalidade Internet', valor: 120.00, data: '2026-06-10', categoria: 'Moradia', tipoItem: 'despesa' },
  { id: 'd3', descricao: 'Uber Trabalho', valor: 45.90, data: '2026-06-18', categoria: 'Transporte', tipoItem: 'despesa' },
  { id: 'd4', descricao: 'Cinema e Jantar', valor: 180.00, data: '2026-06-20', categoria: 'Lazer', tipoItem: 'despesa' }
];

export const DEFAULT_RECEITAS: Transaction[] = [
  { id: 'r1', descricao: 'Salário Principal', valor: 5500.00, data: '2026-06-05', categoria: 'Salário', tipoItem: 'receita' },
  { id: 'r2', descricao: 'Projeto Freelance', valor: 1500.00, data: '2026-06-18', categoria: 'Freelance', tipoItem: 'receita' }
];

export const DEFAULT_PROJETOS: Project[] = [
  { id: 'p1', nome: 'Viagem de Fim de Ano', valor: 6000.00, dataAlvo: '2026-12-31' },
  { id: 'p2', nome: 'Notebook Novo', valor: 4500.00, dataAlvo: '2026-09-30' }
];

// Local state helpers for offline recovery & caching
export function getLocal<T>(key: string, defaultValue: T): T {
  const stored = localStorage.getItem(key);
  if (!stored) return defaultValue;
  try {
    return JSON.parse(stored) as T;
  } catch {
    return defaultValue;
  }
}

export function saveLocal<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn('Error saving to localStorage:', e);
  }
}

// Sign In with Google
export async function loginWithGoogle(): Promise<FirebaseUser> {
  const result = await signInWithPopup(auth, googleProvider);
  const user = result.user;
  
  // Save or update user profile in Firestore
  const userRef = doc(db, 'users', user.uid);
  try {
    await setDoc(userRef, {
      email: user.email || '',
      name: user.displayName || user.email?.split('@')[0] || 'Usuário',
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
  }

  return user;
}

// Log Out
export async function logoutUser(): Promise<void> {
  await signOut(auth);
}
