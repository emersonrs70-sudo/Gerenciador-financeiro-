import React, { useState } from 'react';
import { PlusCircle, ListTodo } from 'lucide-react';
import { Category, Transaction } from '../types';

interface TransactionFormProps {
  categorias: string[];
  onAddTransaction: (
    descricao: string,
    valor: number,
    data: string,
    categoria: string,
    tipoItem: 'despesa' | 'receita'
  ) => Promise<void>;
  onAddCategory: (nome: string) => Promise<void>;
}

export const TransactionForm: React.FC<TransactionFormProps> = ({
  categorias,
  onAddTransaction,
  onAddCategory
}) => {
  const [modo, setModo] = useState<'despesa' | 'receita'>('despesa');
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [data, setData] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });

  const [categoria, setCategoria] = useState(categorias[0] || 'Outros');
  const [criandoCategoria, setCriandoCategoria] = useState(false);
  const [novaCategoriaNome, setNovaCategoriaNome] = useState('');

  const [tipoGasto, setTipoGasto] = useState<'variavel' | 'fixo'>('variavel');
  const [validadeFixo, setValidadeFixo] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!descricao || !valor || !data) return;

    const catToUse = categoria;
    await onAddTransaction(descricao, parseFloat(valor), data, catToUse, modo);

    // Reset fields
    setDescricao('');
    setValor('');
  };

  const handleCriarCategoria = async () => {
    const nomeLimpo = novaCategoriaNome.trim();
    if (nomeLimpo && !categorias.includes(nomeLimpo)) {
      await onAddCategory(nomeLimpo);
      setCategoria(nomeLimpo);
      setNovaCategoriaNome('');
      setCriandoCategoria(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4 self-start">
      <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded-xl">
        <button
          onClick={() => setModo('despesa')}
          className={`flex-1 py-2.5 text-xs font-black rounded-lg transition-all cursor-pointer ${
            modo === 'despesa'
              ? 'bg-red-600 text-white shadow-xs'
              : 'text-slate-500 dark:text-slate-400 hover:bg-slate-250 dark:hover:bg-slate-900'
          }`}
        >
          📉 Registrar Gasto
        </button>
        <button
          onClick={() => setModo('receita')}
          className={`flex-1 py-2.5 text-xs font-black rounded-lg transition-all cursor-pointer ${
            modo === 'receita'
              ? 'bg-emerald-500 text-white shadow-xs'
              : 'text-slate-500 dark:text-slate-400 hover:bg-slate-250 dark:hover:bg-slate-900'
          }`}
        >
          📈 Injetar Receita
        </button>
      </div>

      <h2 className="text-sm font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-850 pb-2">
        <ListTodo className={`w-4 h-4 ${modo === 'despesa' ? 'text-red-500' : 'text-emerald-500'}`} />
        {modo === 'despesa' ? 'Nova Despesa' : 'Nova Receita'}
      </h2>

      <form onSubmit={handleSubmit} className="space-y-3.5">
        <div>
          <label className="text-[10px] font-black text-slate-400 dark:text-slate-550 uppercase tracking-wider">
            Descrição
          </label>
          <input
            type="text"
            required
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Ex: Supermercado, Aluguel, Freelance"
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 dark:text-white rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all font-medium"
          />
        </div>

        <div>
          <label className="text-[10px] font-black text-slate-400 dark:text-slate-550 uppercase tracking-wider">
            Valor (R$)
          </label>
          <input
            type="number"
            step="0.01"
            required
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder="0.00"
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 dark:text-white rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all font-bold"
          />
        </div>

        <div>
          <label className="text-[10px] font-black text-slate-400 dark:text-slate-550 uppercase tracking-wider">
            Data de Competência
          </label>
          <input
            type="date"
            required
            value={data}
            onChange={(e) => setData(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 dark:text-white rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all font-bold"
          />
        </div>

        {/* Categoria is now displayed for both expenses and incomes */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-[10px] font-black text-slate-400 dark:text-slate-550 uppercase tracking-wider">
              Categoria
            </label>
            <button
              type="button"
              onClick={() => setCriandoCategoria(!criandoCategoria)}
              className="text-[10px] text-purple-600 hover:underline font-bold cursor-pointer"
            >
              {criandoCategoria ? 'Selecionar Existente' : '+ Criar Nova'}
            </button>
          </div>

          {!criandoCategoria ? (
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 dark:text-white rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all font-medium"
            >
              {categorias.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          ) : (
            <div className="flex gap-1.5 mt-1">
              <input
                type="text"
                placeholder="Ex: Viagens, Pets"
                value={novaCategoriaNome}
                onChange={(e) => setNovaCategoriaNome(e.target.value)}
                className="flex-1 bg-slate-50 dark:bg-slate-950 border border-purple-200 dark:border-slate-800 dark:text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <button
                type="button"
                onClick={handleCriarCategoria}
                className="bg-purple-600 text-white text-xs px-3 rounded-xl font-bold hover:bg-purple-700 active:scale-95 transition-all cursor-pointer"
              >
                Criar
              </button>
            </div>
          )}
        </div>

        {modo === 'despesa' && (
          <>
            <div>
              <label className="text-[10px] font-black text-slate-400 dark:text-slate-455 uppercase tracking-wider">
                Tipo de Gasto
              </label>
              <select
                value={tipoGasto}
                onChange={(e) => setTipoGasto(e.target.value as 'variavel' | 'fixo')}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 dark:text-white rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium"
              >
                <option value="variavel">Lançamento Único (Variável)</option>
                <option value="fixo">Lançamento Fixo (Recorrente Mensal)</option>
              </select>
            </div>

            {tipoGasto === 'fixo' && (
              <div>
                <label className="text-[10px] font-black text-purple-600 uppercase tracking-wider">
                  Mês Limite Recorrência
                </label>
                <input
                  type="month"
                  value={validadeFixo}
                  onChange={(e) => setValidadeFixo(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-purple-200 dark:border-purple-900 dark:text-white rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 font-bold"
                />
              </div>
            )}
          </>
        )}

        <button
          type="submit"
          className={`w-full text-white text-xs font-black py-3 rounded-xl transition-all shadow-xs active:scale-98 flex items-center justify-center gap-1.5 uppercase tracking-wider cursor-pointer ${
            modo === 'despesa' ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-500 hover:bg-emerald-600'
          }`}
        >
          <PlusCircle className="w-4 h-4" />
          {modo === 'despesa' ? 'Adicionar Lançamento' : 'Injetar Receita'}
        </button>
      </form>
    </div>
  );
};
