export interface Transaction {
  id: string;
  descricao: string;
  valor: number;
  data: string; // YYYY-MM-DD
  categoria: string;
  tipoItem: 'despesa' | 'receita';
  created_at?: string;
  accountId?: string; // Links to a BankAccount
  faturaMes?: string; // Links to a specific credit card bill (e.g. "2026-07")
}

export interface BankAccount {
  id: string;
  nome: string;
  tipo: 'corrente' | 'poupanca' | 'carteira' | 'credito';
  saldoInicial: number;
  cor: string; // Tailwind bg color class
  limiteCredito?: number; // For credit cards
  diaFechamento?: number; // For credit cards (e.g., 5)
  diaVencimento?: number; // For credit cards (e.g., 12)
}

export function getBillMonthForDate(dateStr: string, closingDay: number = 5): string {
  const date = new Date(dateStr + 'T12:00:00'); // avoid timezone offsets
  if (isNaN(date.getTime())) return dateStr.substring(0, 7);
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-indexed
  const day = date.getDate();

  if (day > closingDay) {
    // Falls into the next month's bill
    const nextDate = new Date(year, month + 1, 1);
    const nextYear = nextDate.getFullYear();
    const nextMonth = String(nextDate.getMonth() + 1).padStart(2, '0');
    return `${nextYear}-${nextMonth}`;
  } else {
    // Falls into the current month's bill
    const currentMonth = String(month + 1).padStart(2, '0');
    return `${year}-${currentMonth}`;
  }
}

export interface Category {
  nome: string;
}

export interface Project {
  id: string;
  nome: string;
  valor: number;
  dataAlvo: string; // YYYY-MM-DD
}

export type ExtratoFilter = 'todos' | 'despesas' | 'receitas';

export type SubPainelType = 'saldo-real' | 'saldo' | 'receitas' | 'despesas' | 'metas' | null;

export interface AppNotification {
  id: string;
  titulo: string;
  mensagem: string;
  data: string; // ISO string
  lida: boolean;
  tipo: 'alerta' | 'ofensiva' | 'sucesso' | 'info';
}

export function safeRandomUUID(): string {
  if (typeof window !== 'undefined' && window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}


