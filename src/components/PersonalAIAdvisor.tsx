import React, { useState, useRef, useEffect } from 'react';
import { 
  MessageSquare, 
  Send, 
  Sparkles,
  Trash2, 
  Minus,
  Check,
  Info,
  Flame,
  TrendingDown,
  TrendingUp,
  BrainCircuit,
  Calendar,
  CreditCard,
  Tag,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Transaction, BankAccount, safeRandomUUID } from '../types';

interface TransactionSuggestion {
  id: string;
  descricao: string;
  valor: number;
  data: string;
  categoria: string;
  tipoItem: 'despesa' | 'receita';
  accountId?: string;
  status: 'pending' | 'confirmed' | 'cancelled';
}

interface Message {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  time: string;
  suggestion?: TransactionSuggestion;
}

interface PersonalAIAdvisorProps {
  transactions: Transaction[];
  saldoReal: number;
  onAddTransaction: (
    descricao: string,
    valor: number,
    data: string,
    categoria: string,
    tipoItem: 'despesa' | 'receita',
    accountId?: string
  ) => Promise<void>;
  accounts?: BankAccount[];
  selectedAccountId?: string;
  categoriasDespesa?: string[];
  categoriasReceita?: string[];
}

interface SuggestionCardProps {
  initialSuggestion: TransactionSuggestion;
  status: 'pending' | 'confirmed' | 'cancelled';
  accounts: BankAccount[];
  categoriasDespesa: string[];
  categoriasReceita: string[];
  onConfirm: (descricao: string, valor: number, data: string, categoria: string, accountId?: string) => void;
  onCancel: () => void;
}

const SuggestionCard: React.FC<SuggestionCardProps> = ({
  initialSuggestion,
  status,
  accounts,
  categoriasDespesa,
  categoriasReceita,
  onConfirm,
  onCancel
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [descricao, setDescricao] = useState(initialSuggestion.descricao);
  const [valor, setValor] = useState(initialSuggestion.valor.toString());
  const [data, setData] = useState(initialSuggestion.data);
  const [categoria, setCategoria] = useState(initialSuggestion.categoria);
  const [accountId, setAccountId] = useState(initialSuggestion.accountId || accounts[0]?.id || 'geral');

  const availableCategorias = initialSuggestion.tipoItem === 'despesa'
    ? (categoriasDespesa.length > 0 ? categoriasDespesa : ["Alimentação", "Transporte", "Moradia", "Saúde", "Lazer", "Outros"])
    : (categoriasReceita.length > 0 ? categoriasReceita : ["Salário", "Freelance", "Investimentos", "Outras Receitas"]);

  const accountObj = accounts.find(a => a.id === accountId);

  const formatCurrency = (val: number) => {
    return `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDateBR = (iso: string) => {
    try {
      const parts = iso.split('-');
      if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    } catch {}
    return iso;
  };

  if (status === 'confirmed') {
    return (
      <div className="mt-2.5 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-700 dark:text-emerald-400 animate-in fade-in duration-200">
        <p className="text-xs font-black flex items-center gap-1.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          Lançamento Confirmado com Sucesso!
        </p>
        <div className="text-[10px] mt-1.5 font-medium text-zinc-600 dark:text-zinc-300 space-y-0.5">
          <p><strong>{descricao}</strong> • <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(parseFloat(valor || '0'))}</span></p>
          <p className="text-zinc-500 dark:text-zinc-400">Categoria: {categoria} • Conta: {accountObj?.nome || 'Geral'} • {formatDateBR(data)}</p>
        </div>
      </div>
    );
  }

  if (status === 'cancelled') {
    return (
      <div className="mt-2.5 p-2 bg-[#F3F1EB] dark:bg-[#4C4E5D]/40 border border-[#E8E5DC] dark:border-[#4C4E5D]/60 rounded-xl text-zinc-400 dark:text-zinc-500 text-[10px] font-medium italic text-center">
        Lançamento descartado
      </div>
    );
  }

  const isDespesa = initialSuggestion.tipoItem === 'despesa';

  return (
    <div className="mt-3 p-3.5 bg-white dark:bg-[#252530] border-2 border-emerald-500/40 dark:border-emerald-500/30 rounded-2xl shadow-sm space-y-3 text-zinc-800 dark:text-zinc-200 animate-in fade-in zoom-in-95 duration-200">
      {/* BALÃO DE PRÉVIA HEADER */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold">
            <Sparkles className="w-3 h-3" />
          </div>
          <span className="text-[11px] font-extrabold text-zinc-900 dark:text-white">
            Prévia de Lançamento
          </span>
        </div>
        <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold tracking-wide uppercase ${
          isDespesa
            ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
            : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
        }`}>
          {isDespesa ? 'Despesa' : 'Receita'}
        </span>
      </div>

      {/* PROMINENT MONETARY VALUE & DESCRIPTION */}
      <div className="p-2.5 bg-[#F8F7F4] dark:bg-[#32323F] rounded-xl border border-[#E8E5DC] dark:border-[#4C4E5D]/50 flex items-center justify-between">
        <div className="min-w-0 pr-2">
          <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium block">Descrição detectada:</span>
          <p className="text-xs font-bold text-zinc-900 dark:text-white truncate">
            {descricao}
          </p>
        </div>
        <div className="text-right shrink-0">
          <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium block">Valor:</span>
          <span className={`text-sm font-extrabold font-mono ${isDespesa ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
            {isDespesa ? '-' : '+'} {formatCurrency(parseFloat(valor || '0'))}
          </span>
        </div>
      </div>

      {/* QUICK METADATA CHIPS */}
      <div className="grid grid-cols-3 gap-1.5 text-[10px]">
        <div className="p-1.5 bg-[#F8F7F4] dark:bg-[#32323F] rounded-lg border border-[#E8E5DC] dark:border-[#4C4E5D]/40 text-center">
          <span className="text-zinc-400 dark:text-zinc-500 block text-[8px] font-bold">CATEGORIA</span>
          <span className="font-semibold text-zinc-700 dark:text-zinc-200 truncate block">{categoria}</span>
        </div>
        <div className="p-1.5 bg-[#F8F7F4] dark:bg-[#32323F] rounded-lg border border-[#E8E5DC] dark:border-[#4C4E5D]/40 text-center">
          <span className="text-zinc-400 dark:text-zinc-500 block text-[8px] font-bold">DATA</span>
          <span className="font-semibold text-zinc-700 dark:text-zinc-200 truncate block">{formatDateBR(data)}</span>
        </div>
        <div className="p-1.5 bg-[#F8F7F4] dark:bg-[#32323F] rounded-lg border border-[#E8E5DC] dark:border-[#4C4E5D]/40 text-center">
          <span className="text-zinc-400 dark:text-zinc-500 block text-[8px] font-bold">CONTA</span>
          <span className="font-semibold text-zinc-700 dark:text-zinc-200 truncate block">{accountObj?.nome || 'Geral'}</span>
        </div>
      </div>

      {/* EDIT ACCORDION TOGGLE */}
      {isEditing && (
        <div className="space-y-2 p-2.5 bg-[#F8F7F4] dark:bg-[#32323F] rounded-xl border border-[#E8E5DC] dark:border-[#4C4E5D]/50 text-[10px]">
          <div>
            <label className="text-zinc-500 dark:text-zinc-400 font-bold block mb-0.5">Descrição</label>
            <input
              type="text"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className="w-full bg-white dark:bg-[#252530] border border-[#E8E5DC] dark:border-[#4C4E5D]/60 rounded-lg px-2 py-1 text-xs font-semibold text-zinc-800 dark:text-zinc-200 focus:outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-zinc-500 dark:text-zinc-400 font-bold block mb-0.5">Valor (R$)</label>
              <input
                type="number"
                step="0.01"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                className="w-full bg-white dark:bg-[#252530] border border-[#E8E5DC] dark:border-[#4C4E5D]/60 rounded-lg px-2 py-1 text-xs font-bold font-mono text-zinc-800 dark:text-zinc-200 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-zinc-500 dark:text-zinc-400 font-bold block mb-0.5">Data</label>
              <input
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                className="w-full bg-white dark:bg-[#252530] border border-[#E8E5DC] dark:border-[#4C4E5D]/60 rounded-lg px-2 py-1 text-xs font-semibold text-zinc-800 dark:text-zinc-200 focus:outline-none"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-zinc-500 dark:text-zinc-400 font-bold block mb-0.5">Categoria</label>
              <select
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                className="w-full bg-white dark:bg-[#252530] border border-[#E8E5DC] dark:border-[#4C4E5D]/60 rounded-lg px-2 py-1 text-xs font-semibold text-zinc-800 dark:text-zinc-200 focus:outline-none"
              >
                {availableCategorias.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-zinc-500 dark:text-zinc-400 font-bold block mb-0.5">Conta</label>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="w-full bg-white dark:bg-[#252530] border border-[#E8E5DC] dark:border-[#4C4E5D]/60 rounded-lg px-2 py-1 text-xs font-semibold text-zinc-800 dark:text-zinc-200 focus:outline-none"
              >
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>{a.nome}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* 1-CLICK CONFIRMATION BUTTON & ACTIONS */}
      <div className="space-y-1.5 pt-1">
        <button
          onClick={() => {
            const parsedVal = parseFloat(valor);
            if (!descricao.trim()) return;
            if (isNaN(parsedVal) || parsedVal <= 0) return;
            onConfirm(descricao, parsedVal, data, categoria, accountId);
          }}
          className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold shadow-sm active:scale-98 transition-all cursor-pointer flex items-center justify-center gap-1.5"
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>Confirmar Lançamento (1 Clique)</span>
        </button>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setIsEditing(!isEditing)}
            className="flex-1 py-1.5 px-2 bg-[#F3F1EB] hover:bg-[#EBE7DF] dark:bg-[#32323F] dark:hover:bg-[#4C4E5D] text-zinc-700 dark:text-zinc-300 rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1"
          >
            {isEditing ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {isEditing ? 'Fechar Edição' : 'Editar Dados'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="py-1.5 px-3 bg-zinc-100 hover:bg-zinc-200 dark:bg-[#32323F] dark:hover:bg-[#4C4E5D] text-zinc-500 hover:text-rose-600 dark:text-zinc-400 dark:hover:text-rose-400 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
          >
            Descartar
          </button>
        </div>
      </div>
    </div>
  );
};

export const PersonalAIAdvisor: React.FC<PersonalAIAdvisorProps> = ({
  transactions,
  saldoReal,
  onAddTransaction,
  accounts = [],
  selectedAccountId,
  categoriasDespesa = [],
  categoriasReceita = []
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      sender: 'bot',
      text: 'Olá! Sou seu Assistente Financeiro Inteligente. Você pode conversar comigo sobre seu fluxo de caixa ou lançar transações rapidamente:\n\n*Exemplos inteligentes:*\n- *"Almoço 35 hoje"*\n- *"Gastei 42 no Uber ontem no Nubank"*\n- *"Recebi 2500 de salário no Itaú"*\n- *"Mercado 190,50 dia 15"*\n- *"Quanto gastei com alimentação este mês?"*\n\nComo posso ajudar agora?',
      time: 'Agora'
    }
  ]);
  const [inputVal, setInputVal] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const getFormattedTime = () => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const handleConfirmSuggestion = async (
    msgId: string,
    descricao: string,
    valor: number,
    data: string,
    categoria: string,
    accountId?: string
  ) => {
    const targetMsg = messages.find((m) => m.id === msgId);
    if (!targetMsg || !targetMsg.suggestion) return;

    const tipoItem = targetMsg.suggestion.tipoItem;
    const targetAccId = accountId || targetMsg.suggestion.accountId || accounts[0]?.id || 'geral';

    await onAddTransaction(descricao, valor, data, categoria, tipoItem, targetAccId);

    setMessages((prev) =>
      prev.map((m) => {
        if (m.id === msgId && m.suggestion) {
          return {
            ...m,
            suggestion: {
              ...m.suggestion,
              status: 'confirmed',
              descricao,
              valor,
              data,
              categoria,
              accountId: targetAccId
            }
          };
        }
        return m;
      })
    );

    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      const acc = accounts.find(a => a.id === targetAccId);
      const botMsg: Message = {
        id: safeRandomUUID(),
        sender: 'bot',
        text: `*Lançamento Confirmado!* ✅\nAdicionei a ${tipoItem === 'despesa' ? 'despesa' : 'receita'} de *${descricao}* no valor de *R$ ${valor.toFixed(2)}* na conta *${acc?.nome || 'Geral'}* com categoria *${categoria}*. Seu extrato e gráficos foram atualizados!`,
        time: getFormattedTime()
      };
      setMessages((prev) => [...prev, botMsg]);
    }, 600);
  };

  const handleCancelSuggestion = (msgId: string) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id === msgId && m.suggestion) {
          return {
            ...m,
            suggestion: {
              ...m.suggestion,
              status: 'cancelled'
            }
          };
        }
        return m;
      })
    );
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  // Upgraded Natural Language Engine
  const handleSend = (textToSend?: string) => {
    const text = (textToSend || inputVal).trim();
    if (!text) return;

    const userMsg: Message = {
      id: safeRandomUUID(),
      sender: 'user',
      text,
      time: getFormattedTime()
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputVal('');

    setIsTyping(true);

    setTimeout(() => {
      setIsTyping(false);
      const lower = text.toLowerCase();

      // Check general inquiries (saldo, dicas, gargalos, regras)
      if (lower === 'saldo' || lower.includes('meu saldo') || lower.includes('saldo disponivel') || lower.includes('saldo real')) {
        const botMsg: Message = {
          id: safeRandomUUID(),
          sender: 'bot',
          text: `Seu *saldo real disponível* no momento é de *${formatCurrency(saldoReal)}*.\n\nEste saldo consolida suas contas ativas e deduz as despesas do período.`,
          time: getFormattedTime()
        };
        setMessages((prev) => [...prev, botMsg]);
        return;
      }

      if (lower === 'dica' || lower.includes('pedir dica') || lower.includes('conselho')) {
        const botMsg: Message = {
          id: safeRandomUUID(),
          sender: 'bot',
          text: `*Dica de Ouro:* A regra 50-30-20 recomenda que até 50% da sua renda vá para necessidades essenciais, 30% para desejos e pelo menos 20% para investimentos. Verifique o novo card no painel de gráficos para monitorar seus percentuais deste mês!`,
          time: getFormattedTime()
        };
        setMessages((prev) => [...prev, botMsg]);
        return;
      }

      if (lower === 'gargalos' || lower.includes('gargalo') || lower.includes('onde estou gastando mais')) {
        const despesasMes = transactions.filter(t => t.tipoItem === 'despesa');
        const catMap: { [c: string]: number } = {};
        despesasMes.forEach(d => {
          catMap[d.categoria] = (catMap[d.categoria] || 0) + d.valor;
        });
        const sortedCats = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
        if (sortedCats.length > 0) {
          const top = sortedCats[0];
          const botMsg: Message = {
            id: safeRandomUUID(),
            sender: 'bot',
            text: `Seu maior volume de despesas está concentrado em *"${top[0]}"*, somando *${formatCurrency(top[1])}*.\n\nSugiro conferir o gráfico de pizza de categorias no módulo de Gráficos para avaliar possíveis cortes!`,
            time: getFormattedTime()
          };
          setMessages((prev) => [...prev, botMsg]);
          return;
        }
      }

      // 1. Check for transaction query/search
      if (lower.includes('quanto gastei') || lower.includes('gastos com') || lower.includes('despesas com') || lower.includes('quanto custou')) {
        const cleanTerm = lower
          .replace(/quanto gastei com/g, '')
          .replace(/quanto gastei em/g, '')
          .replace(/gastos com/g, '')
          .replace(/despesas com/g, '')
          .replace(/quanto custou/g, '')
          .replace(/\?/g, '')
          .trim();

        if (cleanTerm.length >= 2) {
          const found = transactions.filter(t =>
            t.descricao.toLowerCase().includes(cleanTerm) ||
            t.categoria.toLowerCase().includes(cleanTerm)
          );
          if (found.length > 0) {
            const sum = found.reduce((acc, t) => acc + t.valor, 0);
            const botMsg: Message = {
              id: safeRandomUUID(),
              sender: 'bot',
              text: `Localizei *${found.length}* lançamentos relacionados a *"${cleanTerm}"*, totalizando *${formatCurrency(sum)}*.`,
              time: getFormattedTime()
            };
            setMessages((prev) => [...prev, botMsg]);
            return;
          }
        }
      }

      // 2. Intelligent Transaction Insertion Parsing
      // Identify monetary value: e.g. "R$ 45,90", "45.90", "45,90", "35"
      const valueMatch = text.match(/(?:r\$?\s*)?(\d+(?:\.\d{3})*(?:,\d{1,2})|\d+(?:\.\d{1,2})|\b\d{1,6}\b)/i);
      
      // Determine if text suggests income vs expense
      const isIncome = /(recebi|ganhei|faturei|salario|salário|freela|freelance|deposito|depósito|pix recebido|rendimento|venda)/i.test(lower);
      const isExpense = /(gastei|paguei|comprei|lançar|despesa|almoço|jantar|lanche|uber|gasolina|mercado|farmacia|pizza|café|comida|conta de|pagamento)/i.test(lower) || !isIncome;

      if (valueMatch) {
        let valStr = valueMatch[1];
        if (valStr.includes(',') && valStr.includes('.')) {
          valStr = valStr.replace(/\./g, '').replace(',', '.');
        } else if (valStr.includes(',')) {
          valStr = valStr.replace(',', '.');
        }
        const parsedVal = parseFloat(valStr);

        if (!isNaN(parsedVal) && parsedVal > 0) {
          // Identify date
          const now = new Date();
          let parsedDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

          if (lower.includes('ontem')) {
            const d = new Date();
            d.setDate(d.getDate() - 1);
            parsedDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          } else if (lower.includes('anteontem')) {
            const d = new Date();
            d.setDate(d.getDate() - 2);
            parsedDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          } else if (lower.includes('amanha') || lower.includes('amanhã')) {
            const d = new Date();
            d.setDate(d.getDate() + 1);
            parsedDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          } else {
            const dayMatch = lower.match(/\bdia\s*(\d{1,2})\b/);
            if (dayMatch) {
              const dayNum = parseInt(dayMatch[1], 10);
              if (dayNum >= 1 && dayNum <= 31) {
                parsedDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
              }
            } else {
              const fullDateMatch = text.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
              if (fullDateMatch) {
                const dayNum = parseInt(fullDateMatch[1], 10);
                const monthNum = parseInt(fullDateMatch[2], 10);
                let yearNum = fullDateMatch[3] ? parseInt(fullDateMatch[3], 10) : now.getFullYear();
                if (yearNum < 100) yearNum += 2000;
                parsedDateStr = `${yearNum}-${String(monthNum).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
              }
            }
          }

          // Identify Bank Account
          let targetAccountId = accounts[0]?.id || 'geral';
          if (selectedAccountId && selectedAccountId !== 'consolidado') {
            targetAccountId = selectedAccountId;
          }
          for (const acc of accounts) {
            const accClean = acc.nome.toLowerCase();
            if (lower.includes(accClean)) {
              targetAccountId = acc.id;
              break;
            }
          }

          // Identify Category
          let category = isIncome ? 'Salário' : 'Outros';
          if (isIncome) {
            if (lower.includes('freela') || lower.includes('freelance') || lower.includes('bico')) category = 'Freelance';
            else if (lower.includes('investimento') || lower.includes('rendimento') || lower.includes('dividendo')) category = 'Investimentos';
            else if (lower.includes('venda')) category = 'Vendas';
            else if (categoriasReceita.length > 0) category = categoriasReceita[0];
          } else {
            if (lower.includes('almoço') || lower.includes('jantar') || lower.includes('lanche') || lower.includes('comida') || lower.includes('restaurante') || lower.includes('mercado') || lower.includes('padaria') || lower.includes('pizza') || lower.includes('ifood') || lower.includes('café') || lower.includes('feira')) {
              category = 'Alimentação';
            } else if (lower.includes('uber') || lower.includes('99') || lower.includes('gasolina') || lower.includes('combustivel') || lower.includes('posto') || lower.includes('onibus') || lower.includes('metrô') || lower.includes('transporte') || lower.includes('pedagio') || lower.includes('estacionamento')) {
              category = 'Transporte';
            } else if (lower.includes('aluguel') || lower.includes('luz') || lower.includes('energia') || lower.includes('agua') || lower.includes('água') || lower.includes('condominio') || lower.includes('internet') || lower.includes('moradia') || lower.includes('casa')) {
              category = 'Moradia';
            } else if (lower.includes('farmacia') || lower.includes('farmácia') || lower.includes('remedio') || lower.includes('remédio') || lower.includes('medico') || lower.includes('médico') || lower.includes('dentista') || lower.includes('saúde')) {
              category = 'Saúde';
            } else if (lower.includes('cinema') || lower.includes('netflix') || lower.includes('spotify') || lower.includes('show') || lower.includes('bar') || lower.includes('cerveja') || lower.includes('futebol') || lower.includes('jogo') || lower.includes('lazer')) {
              category = 'Lazer';
            } else if (lower.includes('curso') || lower.includes('livro') || lower.includes('faculdade') || lower.includes('educação')) {
              category = 'Educação';
            } else if (categoriasDespesa.length > 0) {
              category = categoriasDespesa[0];
            }
          }

          // Extract Description
          let desc = text
            .replace(valueMatch[0], '')
            .replace(/\b(gastei|paguei|comprei|lançar|despesa|recebi|ganhei|faturei|receita|hoje|ontem|anteontem|amanhã|amanha|no|na|com|de|em|pro|para|dia\s*\d{1,2})\b/gi, '')
            .replace(/\s+/g, ' ')
            .trim();

          // Remove account names from description if matched
          accounts.forEach(acc => {
            const reg = new RegExp(`\\b${acc.nome}\\b`, 'gi');
            desc = desc.replace(reg, '').trim();
          });

          if (!desc || desc.length < 2) {
            desc = isIncome ? 'Receita Avulsa' : (category !== 'Outros' ? category : 'Despesa');
          } else {
            // Capitalize first letter
            desc = desc.charAt(0).toUpperCase() + desc.slice(1);
          }

          const botMsg: Message = {
            id: safeRandomUUID(),
            sender: 'bot',
            text: `Entendi! Processei sua mensagem e gerei uma prévia inteligente. Confira e clique em *Confirmar* para efetivar:`,
            time: getFormattedTime(),
            suggestion: {
              id: safeRandomUUID(),
              descricao: desc,
              valor: parsedVal,
              data: parsedDateStr,
              categoria: category,
              tipoItem: isIncome ? 'receita' : 'despesa',
              accountId: targetAccountId,
              status: 'pending'
            }
          };

          setMessages((prev) => [...prev, botMsg]);
          return;
        }
      }

      // Default fallback guidance
      const botMsg: Message = {
        id: safeRandomUUID(),
        sender: 'bot',
        text: `Não consegui identificar todos os dados para registrar automaticamente.\n\nExperimente enviar algo como:\n- *"Almoço 32 hoje"*\n- *"Uber 25 ontem"*\n- *"Salário 3000 dia 5"*\n\nOu me pergunte sobre *"saldo"*, *"gargalos"* ou *"dicas"*.`,
        time: getFormattedTime()
      };
      setMessages((prev) => [...prev, botMsg]);
    }, 500);
  };

  const renderMessageText = (txt: string) => {
    return txt.split('\n').map((line, idx) => {
      const parts = line.split(/(\*[^*]+\*)/g);
      return (
        <span key={idx} className="block min-h-[1.1em]">
          {parts.map((p, pIdx) => {
            if (p.startsWith('*') && p.endsWith('*')) {
              return <strong key={pIdx} className="font-extrabold">{p.slice(1, -1)}</strong>;
            }
            return p;
          })}
        </span>
      );
    });
  };

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end">
      {/* FLOATING WINDOW */}
      {isOpen && (
        <div className="mb-3 w-80 sm:w-96 bg-white dark:bg-[#32323F] border border-[#E8E5DC] dark:border-[#4C4E5D]/60 rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-5 duration-200">
          {/* HEADER */}
          <div className="p-4 bg-[#F8F7F4] dark:bg-[#252530] border-b border-[#EAE7E0] dark:border-[#4C4E5D]/60 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#32323F] dark:bg-[#4C4E5D] text-white flex items-center justify-center font-bold shadow-xs">
                <BrainCircuit className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                  JARVIS Financeiro
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                </h3>
                <span className="text-[10px] text-zinc-500 dark:text-[#988E96]">Assistente com Lançamento em 1-Clique</span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setMessages([{
                  id: '1',
                  sender: 'bot',
                  text: 'Histórico limpo. Como posso ajudar com seus lançamentos?',
                  time: 'Agora'
                }])}
                className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-lg cursor-pointer transition-colors"
                title="Limpar conversa"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-lg cursor-pointer transition-colors"
                title="Minimizar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* CHAT MESSAGES STREAM */}
          <div
            ref={chatContainerRef}
            className="text-[11px] h-80 overflow-y-auto p-4 flex flex-col gap-3 leading-relaxed bg-[#FAF9F5]/70 dark:bg-[#252530]/40 custom-scrollbar"
          >
            {messages.map((m) => {
              const isUser = m.sender === 'user';
              return (
                <div
                  key={m.id}
                  className={`flex flex-col max-w-[88%] ${isUser ? 'self-end' : 'self-start'}`}
                >
                  <div
                    className={`px-3.5 py-2.5 rounded-2xl text-xs relative shadow-2xs ${
                      isUser
                        ? 'bg-[#32323F] text-white dark:bg-[#4C4E5D] dark:text-[#DDD5D0] rounded-tr-none'
                        : 'bg-white text-zinc-800 rounded-tl-none border border-[#E8E5DC] dark:bg-[#32323F] dark:text-zinc-200 dark:border-[#4C4E5D]/60'
                    }`}
                  >
                    <div className="whitespace-pre-wrap leading-relaxed pb-3 pr-2">
                      {renderMessageText(m.text)}
                    </div>

                    <div className={`absolute bottom-1 right-2.5 text-[8px] font-bold ${
                      isUser ? 'text-zinc-400' : 'text-zinc-400 dark:text-zinc-500'
                    }`}>
                      {m.time}
                    </div>

                    {/* INTERACTIVE 1-CLICK PREVIEW BALLOON */}
                    {m.suggestion && (
                      <SuggestionCard
                        initialSuggestion={m.suggestion}
                        status={m.suggestion.status}
                        accounts={accounts}
                        categoriasDespesa={categoriasDespesa}
                        categoriasReceita={categoriasReceita}
                        onConfirm={(desc, val, d, cat, accId) =>
                          handleConfirmSuggestion(m.id, desc, val, d, cat, accId)
                        }
                        onCancel={() => handleCancelSuggestion(m.id)}
                      />
                    )}
                  </div>
                </div>
              );
            })}

            {isTyping && (
              <div className="self-start max-w-[85%]">
                <div className="bg-white dark:bg-[#32323F] border border-[#E8E5DC] dark:border-[#4C4E5D]/60 px-3.5 py-2 rounded-2xl rounded-tl-none text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
                  <div className="flex gap-1 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="text-[10px] font-bold italic text-zinc-600 dark:text-zinc-400">Processando...</span>
                </div>
              </div>
            )}
          </div>

          {/* QUICK SUGGESTION CHIPS */}
          <div className="bg-white dark:bg-[#32323F] px-3 py-2 border-t border-[#EAE7E0] dark:border-[#4C4E5D]/60 flex flex-wrap gap-1.5">
            <button
              onClick={() => handleSend('saldo')}
              className="text-[10px] bg-[#F8F7F4] hover:bg-[#F0EEE6] dark:bg-[#252530] dark:hover:bg-[#4C4E5D]/40 border border-[#E8E5DC] dark:border-[#4C4E5D]/50 text-zinc-700 dark:text-zinc-300 px-2.5 py-1 rounded-full font-semibold transition-all cursor-pointer flex items-center gap-1"
            >
              <TrendingUp className="w-3 h-3 text-emerald-500" /> Meu Saldo
            </button>
            <button
              onClick={() => handleSend('Almoço 35 hoje')}
              className="text-[10px] bg-[#F8F7F4] hover:bg-[#F0EEE6] dark:bg-[#252530] dark:hover:bg-[#4C4E5D]/40 border border-[#E8E5DC] dark:border-[#4C4E5D]/50 text-zinc-700 dark:text-zinc-300 px-2.5 py-1 rounded-full font-semibold transition-all cursor-pointer flex items-center gap-1"
            >
              <Sparkles className="w-3 h-3 text-amber-500" /> Testar Lançamento
            </button>
            <button
              onClick={() => handleSend('gargalos')}
              className="text-[10px] bg-[#F8F7F4] hover:bg-[#F0EEE6] dark:bg-[#252530] dark:hover:bg-[#4C4E5D]/40 border border-[#E8E5DC] dark:border-[#4C4E5D]/50 text-zinc-700 dark:text-zinc-300 px-2.5 py-1 rounded-full font-semibold transition-all cursor-pointer flex items-center gap-1"
            >
              <TrendingDown className="w-3 h-3 text-rose-500" /> Onde gastei mais?
            </button>
          </div>

          {/* INPUT BAR */}
          <div className="bg-[#F8F7F4] dark:bg-[#252530] px-3 py-2.5 flex items-center gap-2 border-t border-[#EAE7E0] dark:border-[#4C4E5D]/60">
            <input
              type="text"
              placeholder="Ex: Almoço 35 hoje, Uber 40 ontem no Nubank..."
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSend();
              }}
              className="flex-1 bg-white dark:bg-[#32323F] border border-[#E8E5DC] dark:border-[#4C4E5D]/60 text-zinc-800 dark:text-white rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-medium placeholder:text-zinc-400"
            />

            <button
              onClick={() => handleSend()}
              className="bg-[#32323F] hover:bg-[#252530] dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-950 p-2 rounded-xl font-bold active:scale-95 transition-all flex items-center justify-center cursor-pointer shadow-xs shrink-0"
              title="Enviar mensagem"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* FLOATING TRIGGER BUTTON */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-[#32323F] hover:bg-[#252530] dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-950 p-3.5 rounded-full shadow-2xl hover:scale-105 active:scale-95 transition-all cursor-pointer relative border-2 border-white dark:border-[#252530] flex items-center gap-2"
        title="Assistente Financeiro JARVIS"
      >
        <BrainCircuit className="w-5 h-5 text-emerald-400 dark:text-emerald-600" />
        <span className="hidden sm:inline text-xs font-bold pr-1">Chat IA</span>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-white text-[8px] font-black border border-white">
            {unreadCount}
          </span>
        )}
      </button>
    </div>
  );
};
