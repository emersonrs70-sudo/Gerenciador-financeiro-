export interface Transaction {
  id: string;
  descricao: string;
  valor: number;
  data: string; // YYYY-MM-DD
  categoria: string;
  tipoItem: 'despesa' | 'receita';
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

