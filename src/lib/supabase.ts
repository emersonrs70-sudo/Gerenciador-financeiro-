import { createClient } from '@supabase/supabase-js';
import { Transaction, Category, Project } from '../types';

const SUPABASE_URL = 'https://uhvxrxqioovjvwjqbyes.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVodnhyeHFpb292anZ3anFieWVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0NTMxMjcsImV4cCI6MjA5NzAyOTEyN30.8RDULQ6XpN3WqLg7i_jrAFB4210gMD85HXWQO7yFIvs';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Helper to check if we can successfully query Supabase
export async function testConnection(): Promise<boolean> {
  try {
    const { data, error } = await supabase.from('fin_categorias').select('nome').limit(1);
    if (error) throw error;
    return true;
  } catch (err) {
    console.warn('Supabase could not connect or tables are missing, using local sandbox fallback:', err);
    return false;
  }
}

// Default static lists
export const DEFAULT_CATEGORIES = ["Moradia", "Alimentação", "Transporte", "Lazer", "Outros"];

export const DEFAULT_DESPESAS: Transaction[] = [
  { id: 'd1', descricao: 'Supermercado da Semana', valor: 350.50, data: '2026-06-15', categoria: 'Alimentação', tipoItem: 'despesa' },
  { id: 'd2', descricao: 'Mensalidade Internet', valor: 120.00, data: '2026-06-10', categoria: 'Moradia', tipoItem: 'despesa' },
  { id: 'd3', descricao: 'Uber Trabalho', valor: 45.90, data: '2026-06-18', categoria: 'Transporte', tipoItem: 'despesa' },
  { id: 'd4', descricao: 'Cinema e Jantar', valor: 180.00, data: '2026-06-20', categoria: 'Lazer', tipoItem: 'despesa' }
];

export const DEFAULT_RECEITAS: Transaction[] = [
  { id: 'r1', descricao: 'Salário Principal', valor: 5500.00, data: '2026-06-05', categoria: 'Receita', tipoItem: 'receita' },
  { id: 'r2', descricao: 'Projeto Freelance', valor: 1500.00, data: '2026-06-18', categoria: 'Receita', tipoItem: 'receita' }
];

export const DEFAULT_PROJETOS: Project[] = [
  { id: 'p1', nome: 'Viagem de Fim de Ano', valor: 6000.00, dataAlvo: '2026-12-31' },
  { id: 'p2', nome: 'Notebook Novo', valor: 4500.00, dataAlvo: '2026-09-30' }
];

// Local state helpers for offline recovery
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
  localStorage.setItem(key, JSON.stringify(value));
}
