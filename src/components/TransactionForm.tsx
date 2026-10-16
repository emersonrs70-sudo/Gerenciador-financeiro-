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
    <div className="bg-white dark:bg-[#32323F] border border-[#E8E5DC] dark:border-[#4C4E5D]/60 rounded-2xl p-3.5 sm:p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-2.5 self-start">
      <div className="flex bg-[#F3F1EB] dark:bg-[#252530] p-1 rounded-xl border border-[#E8E5DC] dark:border-[#4C4E5D]/50">
        <button
          type="button"
          onClick={() => setModo('despesa')}
          className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
            modo === 'despesa'
              ? 'bg-white dark:bg-[#4C4E5D] text-rose-600 dark:text-rose-300 shadow-xs'
              : 'text-zinc-600 hover:text-zinc-900 dark:text-[#988E96] dark:hover:text-[#DDD5D0]'
          }`}
        >
          Despesa
        </button>
        <button
          type="button"
          onClick={() => setModo('receita')}
          className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
            modo === 'receita'
              ? 'bg-white dark:bg-[#4C4E5D] text-emerald-600 dark:text-emerald-400 shadow-xs'
              : 'text-zinc-600 hover:text-zinc-900 dark:text-[#988E96] dark:hover:text-[#DDD5D0]'
          }`}
        >
          Receita
        </button>
      </div>

      <h2 className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-1.5 border-b border-[#EAE7E0] dark:border-[#4C4E5D]/60 pb-2">
        <ListTodo className={`w-3.5 h-3.5 ${modo === 'despesa' ? 'text-rose-500' : 'text-emerald-500'}`} />
        {modo === 'despesa' ? 'Nova Despesa' : 'Nova Receita'}
      </h2>

      <form onSubmit={handleSubmit} className="space-y-2.5">
        <div>
          <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block mb-1">
            Conta / Cartão
          </label>
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="w-full bg-[#F8F7F4] dark:bg-[#252530] border border-[#E8E5DC] dark:border-[#4C4E5D]/60 text-zinc-900 dark:text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10 transition-all font-medium"
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
            className="w-full bg-[#F8F7F4] dark:bg-[#252530] border border-[#E8E5DC] dark:border-[#4C4E5D]/60 text-zinc-900 dark:text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10 transition-all font-medium placeholder:text-zinc-400"
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
            className="w-full bg-[#F8F7F4] dark:bg-[#252530] border border-[#E8E5DC] dark:border-[#4C4E5D]/60 text-zinc-900 dark:text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10 transition-all font-mono font-bold"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              Data
            </label>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => {
                  const d = new Date();
                  setData(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
                }}
                className="text-[9px] px-1.5 py-0.5 rounded bg-[#F3F1EB] dark:bg-[#252530] text-zinc-600 dark:text-zinc-400 font-semibold hover:bg-zinc-200 cursor-pointer"
              >
                Hoje
              </button>
              <button
                type="button"
                onClick={() => {
                  const d = new Date();
                  d.setDate(d.getDate() - 1);
                  setData(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
                }}
                className="text-[9px] px-1.5 py-0.5 rounded bg-[#F3F1EB] dark:bg-[#252530] text-zinc-600 dark:text-zinc-400 font-semibold hover:bg-zinc-200 cursor-pointer"
              >
                Ontem
              </button>
            </div>
          </div>
          <input
            type="date"
            required
            value={data}
            onChange={(e) => setData(e.target.value)}
            className="w-full bg-[#F8F7F4] dark:bg-[#252530] border border-[#E8E5DC] dark:border-[#4C4E5D]/60 text-zinc-900 dark:text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10 transition-all font-medium"
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
              className="w-full bg-[#F8F7F4] dark:bg-[#252530] border border-[#E8E5DC] dark:border-[#4C4E5D]/60 text-zinc-900 dark:text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10 transition-all font-medium"
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
                className="flex-1 bg-[#F8F7F4] dark:bg-[#252530] border border-[#E8E5DC] dark:border-[#4C4E5D]/60 text-zinc-900 dark:text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10 font-medium"
              />
              <button
                type="button"
                onClick={handleCriarCategoria}
                className="bg-[#32323F] hover:bg-[#252530] dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-950 text-xs px-3 rounded-xl font-bold transition-all cursor-pointer shadow-xs"
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
                className="w-full bg-[#F8F7F4] dark:bg-[#252530] border border-[#E8E5DC] dark:border-[#4C4E5D]/60 text-zinc-900 dark:text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10 font-medium"
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
                  className="w-full bg-[#F8F7F4] dark:bg-[#252530] border border-[#E8E5DC] dark:border-[#4C4E5D]/60 text-zinc-900 dark:text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10 font-medium"
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
