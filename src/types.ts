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

/**
 * Computes the target billing month (YYYY-MM) for the (installmentIndex + 1)-th installment.
 * installmentIndex is 0-indexed (0 = 1ª parcela, 1 = 2ª parcela, etc.).
 * If purchase date is after closingDay, the 1st installment (index 0) falls into next month's bill!
 */
export function getInstallmentBillMonth(dateStr: string, installmentIndex: number, closingDay: number = 5): string {
  const baseBillMonth = getBillMonthForDate(dateStr, closingDay);
  const [bYearStr, bMonthStr] = baseBillMonth.split('-');
  const baseYear = parseInt(bYearStr, 10);
  const baseMonth = parseInt(bMonthStr, 10) - 1; // 0-indexed

  const targetDate = new Date(baseYear, baseMonth + installmentIndex, 1);
  const targetYear = targetDate.getFullYear();
  const targetMonth = String(targetDate.getMonth() + 1).padStart(2, '0');
  return `${targetYear}-${targetMonth}`;
}

/**
 * Computes the transaction date (YYYY-MM-DD) for the (installmentIndex + 1)-th installment.
 */
export function getInstallmentTransactionDate(dateStr: string, installmentIndex: number): string {
  if (installmentIndex === 0) return dateStr;
  const date = new Date(dateStr + 'T12:00:00');
  if (isNaN(date.getTime())) return dateStr;
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();

  const targetDate = new Date(year, month + installmentIndex, 1);
  const maxDays = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0).getDate();
  const targetDay = Math.min(day, maxDays);

  const yyyy = targetDate.getFullYear();
  const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
  const dd = String(targetDay).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
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

export interface RecurrentRule {
  id: string;
  descricao: string;
  valor: number;
  diaDoMes: number; // Day of the month (e.g. 5, 10, 20)
  categoria: string;
  tipoItem: 'despesa' | 'receita';
  accountId: string;
  ativa: boolean;
  criadaEm: string;
  ultimoMesGerado?: string; // e.g. "2026-10"
}

export interface AppNotification {
  id: string;
  titulo: string;
  mensagem: string;
  data: string; // ISO string
  lida: boolean;
  tipo: 'alerta' | 'ofensiva' | 'sucesso' | 'info';
}

export interface PendingSuggestion {
  id: string;
  rawText: string;
  banco: string;
  descricao: string;
  valor: number;
  tipoItem: 'despesa' | 'receita';
  categoria: string;
  accountId: string;
  data: string; // YYYY-MM-DD
  status: 'pendente' | 'aprovada' | 'descartada';
  userId?: string;
  createdAt: string;
  parcelas?: number;
  valorTotal?: number;
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


