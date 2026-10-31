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
  transferTargetAccountId?: string; // For transfers: ID of the other account
  transferLinkedId?: string; // Linked reciprocal transaction ID
  isTransferCounterpart?: boolean; // True if this was automatically generated as counterpart
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

export interface BankColorOption {
  value: string;
  label: string;
  bank: string;
  bgClass: string;
  dotClass: string;
}

export const BANK_COLOR_OPTIONS: BankColorOption[] = [
  { value: 'bg-red-600', label: 'Vermelho', bank: 'Santander / Bradesco', bgClass: 'bg-red-600', dotClass: 'bg-red-600' },
  { value: 'bg-purple-600', label: 'Roxo', bank: 'Nubank', bgClass: 'bg-purple-600', dotClass: 'bg-purple-600' },
  { value: 'bg-orange-500', label: 'Laranja', bank: 'Inter', bgClass: 'bg-orange-500', dotClass: 'bg-orange-500' },
  { value: 'bg-blue-600', label: 'Azul Royal', bank: 'Itaú', bgClass: 'bg-blue-600', dotClass: 'bg-blue-600' },
  { value: 'bg-amber-400', label: 'Amarelo Ouro', bank: 'Banco do Brasil', bgClass: 'bg-amber-400', dotClass: 'bg-amber-400' },
  { value: 'bg-sky-700', label: 'Azul Marinho', bank: 'Caixa Econômica', bgClass: 'bg-sky-700', dotClass: 'bg-sky-700' },
  { value: 'bg-zinc-900', label: 'Preto Carbon', bank: 'C6 Bank', bgClass: 'bg-zinc-900', dotClass: 'bg-zinc-900' },
  { value: 'bg-emerald-500', label: 'Verde Neon', bank: 'PicPay', bgClass: 'bg-emerald-500', dotClass: 'bg-emerald-500' },
  { value: 'bg-cyan-600', label: 'Ciano', bank: 'Mercado Pago', bgClass: 'bg-cyan-600', dotClass: 'bg-cyan-600' },
  { value: 'bg-teal-500', label: 'Azul Turquesa', bank: 'Neon', bgClass: 'bg-teal-500', dotClass: 'bg-teal-500' },
  { value: 'bg-slate-800', label: 'Azul Noite', bank: 'BTG Pactual', bgClass: 'bg-slate-800', dotClass: 'bg-slate-800' },
  { value: 'bg-amber-600', label: 'Dourado Escuro', bank: 'XP Investimentos', bgClass: 'bg-amber-600', dotClass: 'bg-amber-600' },
  { value: 'bg-green-700', label: 'Verde Floresta', bank: 'Sicredi', bgClass: 'bg-green-700', dotClass: 'bg-green-700' },
  { value: 'bg-rose-800', label: 'Bordô / Vinho', bank: 'Banco Original', bgClass: 'bg-rose-800', dotClass: 'bg-rose-800' },
  { value: 'bg-zinc-700', label: 'Grafite Neutro', bank: 'Carteira / Outros', bgClass: 'bg-zinc-700', dotClass: 'bg-zinc-700' },
];

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


