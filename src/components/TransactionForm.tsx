import React, { useState } from 'react';
import { PlusCircle, ListTodo } from 'lucide-react';
import { Category, Transaction, BankAccount, getBillMonthForDate } from '../types';

interface TransactionFormProps {
  categoriasDespesa: string[];
  categoriasReceita: string[];
  onAddTransaction: (
    descricao: string,
    valor: number,
    data: string,
    categoria: string,
    tipoItem: 'despesa' | 'receita',
    accountId: string,
    faturaMes?: string
  ) => Promise<void>;
  onAddCategory: (nome: string, tipoItem: 'despesa' | 'receita') => Promise<void>;
  accounts: BankAccount[];
  selectedAccountId?: string;
}

export const TransactionForm: React.FC<TransactionFormProps> = ({
  categoriasDespesa,
  categoriasReceita,
  onAddTransaction,
  onAddCategory,
  accounts = [],
  selectedAccountId
}) => {
  const [modo, setModo] = useState<'despesa' | 'receita'>('despesa');
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [data, setData] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });

  const [accountId, setAccountId] = useState(() => {
    if (selectedAccountId && selectedAccountId !== 'consolidado') return selectedAccountId;
    return accounts[0]?.id || 'geral';
  });

  React.useEffect(() => {
    if (selectedAccountId && selectedAccountId !== 'consolidado') {
      setAccountId(selectedAccountId);
    }
  }, [selectedAccountId]);

  const activeCategorias = modo === 'despesa' ? categoriasDespesa : categoriasReceita;
  const [categoria, setCategoria] = useState('');

  React.useEffect(() => {
    const currentCats = modo === 'despesa' ? categoriasDespesa : categoriasReceita;
    if (!currentCats.includes(categoria)) {
      setCategoria(currentCats[0] || 'Outros');
    }
  }, [modo, categoriasDespesa, categoriasReceita]);

  const [criandoCategoria, setCriandoCategoria] = useState(false);
  const [novaCategoriaNome, setNovaCategoriaNome] = useState('');

  const [tipoGasto, setTipoGasto] = useState<'variavel' | 'fixo'>('variavel');
  const [validadeFixo, setValidadeFixo] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!descricao || !valor || !data) return;

    const account = accounts.find(a => a.id === accountId);
    const catToUse = categoria;

    if (modo === 'despesa' && tipoGasto === 'fixo' && validadeFixo) {
      try {
        const startDate = new Date(data + 'T12:00:00');
        const [limitYearStr, limitMonthStr] = validadeFixo.split('-');
        const limitYear = parseInt(limitYearStr, 10);
        const limitMonth = parseInt(limitMonthStr, 10) - 1; // 0-indexed month

        let currentYear = startDate.getFullYear();
        let currentMonth = startDate.getMonth();
        const targetDay = startDate.getDate();

        while (true) {
          if (currentYear > limitYear || (currentYear === limitYear && currentMonth > limitMonth)) {
            break;
          }

          const d = new Date(currentYear, currentMonth, 1);
          const maxDays = new Date(currentYear, currentMonth + 1, 0).getDate();
          const dayToUse = Math.min(targetDay, maxDays);
          
          const yyyy = currentYear;
          const mm = String(currentMonth + 1).padStart(2, '0');
          const dd = String(dayToUse).padStart(2, '0');
          const dateStr = `${yyyy}-${mm}-${dd}`;

          let faturaMesForDate: string | undefined = undefined;
          if (account && account.tipo === 'credito') {
            faturaMesForDate = getBillMonthForDate(dateStr, account.diaFechamento);
          }

          const formattedMonth = String(currentMonth + 1).padStart(2, '0');
          const recDescricao = `${descricao} (${formattedMonth}/${currentYear})`;

          await onAddTransaction(
            recDescricao,
            parseFloat(valor),
            dateStr,
            catToUse,
            modo,
            accountId,
            faturaMesForDate
          );

          currentMonth++;
          if (currentMonth > 11) {
            currentMonth = 0;
            currentYear++;
          }
        }
      } catch (err) {
        console.error('Error generating recurring transactions:', err);
        let faturaMes: string | undefined = undefined;
        if (account && account.tipo === 'credito') {
          faturaMes = getBillMonthForDate(data, account.diaFechamento);
        }
        await onAddTransaction(descricao, parseFloat(valor), data, catToUse, modo, accountId, faturaMes);
      }
    } else {
      let faturaMes: string | undefined = undefined;
      if (account && account.tipo === 'credito') {
        faturaMes = getBillMonthForDate(data, account.diaFechamento);
      }
      await onAddTransaction(descricao, parseFloat(valor), data, catToUse, modo, accountId, faturaMes);
    }

    // Reset fields
    setDescricao('');
    setValor('');
  };

  const handleCriarCategoria = async () => {
    const nomeLimpo = novaCategoriaNome.trim();
    if (nomeLimpo) {
      const activeCats = modo === 'despesa' ? categoriasDespesa : categoriasReceita;
      if (!activeCats.includes(nomeLimpo)) {
        await onAddCategory(nomeLimpo, modo);
        setCategoria(nomeLimpo);
        setNovaCategoriaNome('');
        setCriandoCategoria(false);
      }
    }
  };

  return (
    <div className="bg-white dark:bg-[#1A1A1E] border border-zinc-200/80 dark:border-[#27272A] rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-4 self-start">
      <div className="flex bg-zinc-100/90 dark:bg-[#141416] p-1 rounded-xl border border-zinc-200/80 dark:border-[#27272A]">
        <button
          type="button"
          onClick={() => setModo('despesa')}
          className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
            modo === 'despesa'
              ? 'bg-white dark:bg-[#27272A] text-rose-600 dark:text-rose-400 shadow-xs'
              : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
          }`}
        >
          Despesa
        </button>
        <button
          type="button"
          onClick={() => setModo('receita')}
          className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
            modo === 'receita'
              ? 'bg-white dark:bg-[#27272A] text-emerald-600 dark:text-emerald-400 shadow-xs'
              : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
          }`}
        >
          Receita
        </button>
      </div>

      <h2 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2 border-b border-zinc-100 dark:border-[#27272A] pb-2.5">
        <ListTodo className={`w-4 h-4 ${modo === 'despesa' ? 'text-rose-500' : 'text-emerald-500'}`} />
        {modo === 'despesa' ? 'Nova Despesa' : 'Nova Receita'}
      </h2>

      <form onSubmit={handleSubmit} className="space-y-3.5">
        <div>
          <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block mb-1">
            Conta / Cartão
          </label>
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="w-full bg-zinc-50 dark:bg-[#141416] border border-zinc-200/80 dark:border-[#27272A] text-zinc-900 dark:text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10 transition-all font-medium"
          >
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.nome} ({acc.tipo === 'credito' ? 'Crédito' : `Saldo: R$ ${acc.saldoInicial.toFixed(0)}`})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block mb-1">
            Descrição
          </label>
          <input
            type="text"
            required
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Ex: Supermercado, Aluguel, Freelance"
            className="w-full bg-zinc-50 dark:bg-[#141416] border border-zinc-200/80 dark:border-[#27272A] text-zinc-900 dark:text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10 transition-all font-medium placeholder:text-zinc-400"
          />
        </div>

        <div>
          <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block mb-1">
            Valor (R$)
          </label>
          <input
            type="number"
            step="0.01"
            required
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder="0.00"
            className="w-full bg-zinc-50 dark:bg-[#141416] border border-zinc-200/80 dark:border-[#27272A] text-zinc-900 dark:text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10 transition-all font-mono font-bold"
          />
        </div>

        <div>
          <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block mb-1">
            Data
          </label>
          <input
            type="date"
            required
            value={data}
            onChange={(e) => setData(e.target.value)}
            className="w-full bg-zinc-50 dark:bg-[#141416] border border-zinc-200/80 dark:border-[#27272A] text-zinc-900 dark:text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10 transition-all font-medium"
          />
        </div>

        {/* Categoria */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              Categoria
            </label>
            <button
              type="button"
              onClick={() => setCriandoCategoria(!criandoCategoria)}
              className="text-[10px] text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 font-semibold cursor-pointer"
            >
              {criandoCategoria ? 'Selecionar Existente' : '+ Nova Categoria'}
            </button>
          </div>

          {!criandoCategoria ? (
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className="w-full bg-zinc-50 dark:bg-[#141416] border border-zinc-200/80 dark:border-[#27272A] text-zinc-900 dark:text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10 transition-all font-medium"
            >
              {activeCategorias.map((cat) => (
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
                className="flex-1 bg-zinc-50 dark:bg-[#141416] border border-zinc-200/80 dark:border-[#27272A] text-zinc-900 dark:text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10 font-medium"
              />
              <button
                type="button"
                onClick={handleCriarCategoria}
                className="bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-950 text-xs px-3 rounded-xl font-bold transition-all cursor-pointer shadow-xs"
              >
                Criar
              </button>
            </div>
          )}
        </div>

        {modo === 'despesa' && (
          <>
            <div>
              <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block mb-1">
                Tipo de Gasto
              </label>
              <select
                value={tipoGasto}
                onChange={(e) => setTipoGasto(e.target.value as 'variavel' | 'fixo')}
                className="w-full bg-zinc-50 dark:bg-[#141416] border border-zinc-200/80 dark:border-[#27272A] text-zinc-900 dark:text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10 font-medium"
              >
                <option value="variavel">Lançamento Único (Variável)</option>
                <option value="fixo">Lançamento Fixo (Recorrente Mensal)</option>
              </select>
            </div>

            {tipoGasto === 'fixo' && (
              <div>
                <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block mb-1">
                  Mês Limite Recorrência
                </label>
                <input
                  type="month"
                  value={validadeFixo}
                  onChange={(e) => setValidadeFixo(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-[#141416] border border-zinc-200/80 dark:border-[#27272A] text-zinc-900 dark:text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10 font-medium"
                />
              </div>
            )}
          </>
        )}

        <button
          type="submit"
          className={`w-full text-white text-xs font-bold py-2.5 rounded-xl transition-all shadow-xs active:scale-[0.98] flex items-center justify-center gap-1.5 cursor-pointer ${
            modo === 'despesa'
              ? 'bg-rose-600 hover:bg-rose-700'
              : 'bg-emerald-600 hover:bg-emerald-700'
          }`}
        >
          <PlusCircle className="w-4 h-4" />
          {modo === 'despesa' ? 'Adicionar Despesa' : 'Adicionar Receita'}
        </button>
      </form>
    </div>
  );
};
