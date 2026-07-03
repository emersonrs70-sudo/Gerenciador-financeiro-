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
  BrainCircuit
} from 'lucide-react';
import { Transaction, safeRandomUUID } from '../types';

interface TransactionSuggestion {
  id: string;
  descricao: string;
  valor: number;
  data: string;
  categoria: string;
  tipoItem: 'despesa' | 'receita';
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
    tipoItem: 'despesa' | 'receita'
  ) => Promise<void>;
}

interface SuggestionCardProps {
  initialSuggestion: {
    descricao: string;
    valor: number;
    data: string;
    categoria: string;
    tipoItem: 'despesa' | 'receita';
  };
  status: 'pending' | 'confirmed' | 'cancelled';
  onConfirm: (descricao: string, valor: number, data: string, categoria: string) => void;
  onCancel: () => void;
}

const SuggestionCard: React.FC<SuggestionCardProps> = ({
  initialSuggestion,
  status,
  onConfirm,
  onCancel
}) => {
  const [descricao, setDescricao] = useState(initialSuggestion.descricao);
  const [valor, setValor] = useState(initialSuggestion.valor.toString());
  const [data, setData] = useState(initialSuggestion.data);
  const [categoria, setCategoria] = useState(initialSuggestion.categoria);

  const categorias = initialSuggestion.tipoItem === 'despesa'
    ? ["Moradia", "Alimentação", "Transporte", "Lazer", "Outros"]
    : ["Salário", "Freelance", "Investimentos", "Reembolsos", "Outras Receitas"];

  if (status === 'confirmed') {
    return (
      <div className="mt-2.5 p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-600 dark:text-emerald-400">
        <p className="text-[10px] font-black flex items-center gap-1">
          ✓ Lançamento Registrado com Sucesso!
        </p>
        <p className="text-[9px] mt-1 font-semibold text-slate-500 dark:text-slate-400">
          {descricao} • R$ {parseFloat(valor || '0').toFixed(2)} ({categoria})
        </p>
      </div>
    );
  }

  if (status === 'cancelled') {
    return (
      <div className="mt-2.5 p-2 bg-slate-100 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800/60 rounded-xl text-slate-400 dark:text-slate-500 text-[9px] font-medium italic text-center">
        Lançamento descartado
      </div>
    );
  }

  return (
    <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2 text-slate-800 dark:text-slate-200 animate-in fade-in duration-150">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-wider flex items-center gap-1">
          <BrainCircuit className="w-3.5 h-3.5" /> Confirmar Lançamento?
        </span>
        <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
          initialSuggestion.tipoItem === 'despesa'
            ? 'bg-rose-50 text-rose-650 dark:bg-rose-950/45 dark:text-rose-400'
            : 'bg-emerald-50 text-emerald-650 dark:bg-emerald-950/45 dark:text-emerald-400'
        }`}>
          {initialSuggestion.tipoItem === 'despesa' ? 'Despesa' : 'Receita'}
        </span>
      </div>

      <div className="space-y-1.5">
        <div>
          <label className="text-[8px] text-slate-400 dark:text-slate-500 font-bold block mb-0.5">Descrição</label>
          <input
            type="text"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-lg px-2 py-1 text-[10px] font-bold focus:outline-none focus:ring-1 focus:ring-purple-500 text-slate-800 dark:text-slate-200"
          />
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <div>
            <label className="text-[8px] text-slate-400 dark:text-slate-500 font-bold block mb-0.5">Valor (R$)</label>
            <input
              type="number"
              step="0.01"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-lg px-2 py-1 text-[10px] font-bold focus:outline-none focus:ring-1 focus:ring-purple-500 text-slate-800 dark:text-slate-200"
            />
          </div>
          <div>
            <label className="text-[8px] text-slate-400 dark:text-slate-500 font-bold block mb-0.5">Data</label>
            <input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-lg px-1.5 py-0.5 text-[9px] font-bold focus:outline-none focus:ring-1 focus:ring-purple-500 text-slate-800 dark:text-slate-200"
            />
          </div>
        </div>

        <div>
          <label className="text-[8px] text-slate-400 dark:text-slate-500 font-bold block mb-0.5">Categoria</label>
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-lg px-1.5 py-1 text-[10px] font-bold focus:outline-none focus:ring-1 focus:ring-purple-500 cursor-pointer text-slate-800 dark:text-slate-200"
          >
            {categorias.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex gap-1.5 pt-1">
        <button
          onClick={() => {
            const parsedVal = parseFloat(valor);
            if (!descricao.trim()) return;
            if (isNaN(parsedVal) || parsedVal <= 0) return;
            onConfirm(descricao, parsedVal, data, categoria);
          }}
          className="flex-1 bg-purple-600 hover:bg-purple-700 text-white text-[9px] font-black py-1.5 px-2 rounded-lg transition-all cursor-pointer text-center shadow-sm"
        >
          Confirmar no Sistema
        </button>
        <button
          onClick={onCancel}
          className="bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-[9px] font-black py-1.5 px-2 rounded-lg transition-all cursor-pointer text-center"
        >
          Descartar
        </button>
      </div>
    </div>
  );
};

export const PersonalAIAdvisor: React.FC<PersonalAIAdvisorProps> = ({
  transactions,
  saldoReal,
  onAddTransaction
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputVal, setInputVal] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [unreadCount, setUnreadCount] = useState(1);

  const getFormattedTime = () => {
    const d = new Date();
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'init',
      sender: 'bot',
      text: 'Olá, senhor! Sou o *JARVIS*, seu assistente financeiro de Inteligência Artificial. 🦾\n\nEstou conectado ao sistema em tempo real para interpretar seus comandos por texto e ajudar a planejar seu fluxo de caixa.\n\n*Como posso ajudá-lo?*\n\n1. *Registrar gastos ou receitas*:\n   - *"gastei 45 com mercado ontem"*\n   - *"recebi 1200 de freelance hoje"*\n\n2. *Pesquisar transações registradas*:\n   - *"quanto gastei com lazer?"*\n   - *"qual o valor de mercado?"*\n\n3. *Análise de Orçamento e Dicas*:\n   - Digite *"saldo"*, *"gargalo"*, *"dica"* ou *"investimento"*\n\nO que deseja analisar agora, senhor?',
      time: getFormattedTime()
    }
  ]);

  const chatContainerRef = useRef<HTMLDivElement>(null);

  const [incompleteTx, setIncompleteTx] = useState<{
    descricao?: string;
    valor?: number;
    data?: string;
    categoria?: string;
    tipoItem: 'despesa' | 'receita';
    step: 'waiting_for_value';
  } | null>(null);

  // Auto Scroll Chat
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, isOpen, isTyping]);

  // Clean unread count when chat opens
  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0);
    }
  }, [isOpen]);

  const handleConfirmSuggestion = async (
    msgId: string,
    descricao: string,
    valor: number,
    data: string,
    categoria: string
  ) => {
    const msg = messages.find((m) => m.id === msgId);
    if (!msg || !msg.suggestion) return;

    const tipoItem = msg.suggestion.tipoItem;

    await onAddTransaction(descricao, valor, data, categoria, tipoItem);

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
              categoria
            }
          };
        }
        return m;
      })
    );

    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      const botMsg: Message = {
        id: safeRandomUUID(),
        sender: 'bot',
        text: `*Lançamento Confirmado!* ✅\nAdicionei a ${tipoItem === 'despesa' ? 'despesa' : 'receita'} de *${descricao}* no valor de *R$ ${valor.toFixed(2)}* (categoria *${categoria}*) com sucesso. Seu saldo real foi atualizado!`,
        time: getFormattedTime()
      };
      setMessages((prev) => [...prev, botMsg]);
    }, 800);
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
      const lowerText = text.toLowerCase();

      // Cancel check
      if (lowerText.includes('cancela') || lowerText.includes('esquece') || lowerText.includes('parar') || lowerText.includes('sair')) {
        if (incompleteTx) {
          setIncompleteTx(null);
          const botMsg: Message = {
            id: safeRandomUUID(),
            sender: 'bot',
            text: 'Entendido, senhor. Operação pendente cancelada. Como posso ajudá-lo agora?',
            time: getFormattedTime()
          };
          setMessages((prev) => [...prev, botMsg]);
          return;
        }
      }

      // Check if user is asking a general question
      const isQuestion = lowerText.includes('dica') || 
                         lowerText.includes('ajuda') || 
                         lowerText.includes('insight') || 
                         lowerText.includes('saldo') || 
                         lowerText.includes('como gastar') || 
                         lowerText.includes('caixa') || 
                         lowerText.includes('investimento') || 
                         lowerText.includes('poupar') || 
                         lowerText.includes('cdb') || 
                         lowerText.includes('gargalo') || 
                         lowerText.includes('cortar') || 
                         lowerText.includes('gasto') ||
                         lowerText.includes('quanto') ||
                         lowerText.includes('qual') ||
                         lowerText.includes('valor');

      if (isQuestion && incompleteTx) {
        setIncompleteTx(null);
      }

      // Check for active incomplete transaction state
      if (incompleteTx && !isQuestion) {
        if (incompleteTx.step === 'waiting_for_value') {
          const valueMatch = lowerText.match(/(?:r\$?\s*)?(\d+(?:\.\d{3})*(?:,\d{2})?|\d+(?:,\d+)?|\d+(?:\.\d+)?)/i);
          if (valueMatch) {
            let valStr = valueMatch[1];
            if (valStr.includes(',') && valStr.includes('.')) {
              valStr = valStr.replace(/\./g, '').replace(',', '.');
            } else if (valStr.includes(',')) {
              const parts = valStr.split(',');
              if (parts[1].length === 3) {
                valStr = valStr.replace(/,/g, '');
              } else {
                valStr = valStr.replace(',', '.');
              }
            }
            const parsed = parseFloat(valStr);
            if (!isNaN(parsed) && parsed > 0) {
              const updatedTx = {
                ...incompleteTx,
                valor: parsed
              };
              setIncompleteTx(null);

              const botMsg: Message = {
                id: safeRandomUUID(),
                sender: 'bot',
                text: `Entendido, senhor. Registrei o valor de *R$ ${parsed.toFixed(2)}*. Confirme os detalhes do lançamento abaixo para consolidarmos no sistema:`,
                time: getFormattedTime(),
                suggestion: {
                  id: safeRandomUUID(),
                  descricao: updatedTx.descricao || (updatedTx.tipoItem === 'despesa' ? 'Nova Despesa' : 'Nova Receita'),
                  valor: parsed,
                  data: updatedTx.data || new Date().toISOString().split('T')[0],
                  categoria: updatedTx.categoria || (updatedTx.tipoItem === 'despesa' ? 'Outros' : 'Outras Receitas'),
                  tipoItem: updatedTx.tipoItem,
                  status: 'pending'
                }
              };
              setMessages((prev) => [...prev, botMsg]);
              return;
            }
          }

          const botMsg: Message = {
            id: safeRandomUUID(),
            sender: 'bot',
            text: `Perdão, senhor. Não identifiquei um valor monetário válido para *"#{incompleteTx.descricao}"*. Qual o valor em reais?`,
            time: getFormattedTime()
          };
          setMessages((prev) => [...prev, botMsg]);
          return;
        }
      }

      // 1. Intelligent Natural Language search query parsing
      let matchesSearch = false;
      let queryResponse = '';

      if (lowerText.includes('quanto') || lowerText.includes('qual') || lowerText.includes('buscar') || lowerText.includes('pesquisar') || lowerText.includes('valor de') || lowerText.includes('valor do') || lowerText.includes('valor da') || lowerText.includes('gastos com') || lowerText.includes('despesas com')) {
        let searchTerm = '';
        const preps = [' com ', ' de ', ' do ', ' da ', ' para ', ' em ', ' valor do ', ' valor da ', ' valor de ', ' gastei com ', ' pago em ', ' de '];
        
        for (const prep of preps) {
          if (lowerText.includes(prep)) {
            searchTerm = lowerText.split(prep)[1]?.trim();
            break;
          }
        }
        
        if (!searchTerm) {
          const words = lowerText.split(' ');
          const indexFoi = words.indexOf('foi');
          const indexGastei = words.indexOf('gastei');
          if (indexFoi !== -1 && indexFoi < words.length - 1) {
            searchTerm = words.slice(indexFoi + 1).join(' ');
          } else if (indexGastei !== -1 && indexGastei < words.length - 1) {
            searchTerm = words.slice(indexGastei + 1).join(' ');
          }
        }

        searchTerm = searchTerm.replace(/\?/g, '').trim();

        if (searchTerm && searchTerm.length >= 2) {
          const found = transactions.filter(t => 
            t.descricao.toLowerCase().includes(searchTerm) || 
            t.categoria.toLowerCase().includes(searchTerm)
          );

          if (found.length > 0) {
            const total = found.reduce((acc, curr) => acc + curr.valor, 0);
            const listStr = found.map(t => `- *${t.descricao}* (${t.categoria}): *R$ ${t.valor.toFixed(2)}* em ${t.data.split('-').reverse().join('/')}`).join('\n');
            
            queryResponse = `Senhor, localizei *${found.length}* lançamentos para *"${searchTerm}"*:\n\n${listStr}\n\n*Total acumulado:* *R$ ${total.toFixed(2)}*`;
            matchesSearch = true;
          } else {
            queryResponse = `Não encontrei nenhum lançamento correspondente a *"${searchTerm}"* no sistema financeiro, senhor.`;
            matchesSearch = true;
          }
        }
      }

      // Check for list requests
      if (!matchesSearch && (lowerText.includes('lançamento') || lowerText.includes('transaç') || lowerText.includes('gastos') || lowerText.includes('despesas') || lowerText.includes('receitas') || lowerText.includes('extrato') || lowerText.includes('compras'))) {
        const isDespesaOnly = lowerText.includes('gasto') || lowerText.includes('despesa') || lowerText.includes('compras');
        const isReceitaOnly = lowerText.includes('receita');
        
        let list = transactions;
        if (isDespesaOnly) {
          list = transactions.filter(t => t.tipoItem === 'despesa');
        } else if (isReceitaOnly) {
          list = transactions.filter(t => t.tipoItem === 'receita');
        }

        const lastItems = list.slice(-5);
        if (lastItems.length > 0) {
          const listStr = lastItems.map(t => `- *${t.descricao}* (${t.categoria}): *R$ ${t.valor.toFixed(2)}* em ${t.data.split('-').reverse().join('/')}`).join('\n');
          queryResponse = `Senhor, estes são os últimos 5 lançamentos registrados:\n\n${listStr}\n\nO extrato completo pode ser filtrado na seção principal do aplicativo.`;
          matchesSearch = true;
        } else {
          queryResponse = `Nenhum lançamento registrado atende a esses filtros, senhor.`;
          matchesSearch = true;
        }
      }

      if (matchesSearch) {
        const botMsg: Message = {
          id: safeRandomUUID(),
          sender: 'bot',
          text: queryResponse,
          time: getFormattedTime()
        };
        setMessages((prev) => [...prev, botMsg]);
        return;
      }

      // 2. Natural Language Transaction Insertion Parsing
      const isLancarMatch = /(gastei|paguei|comprei|recebi|ganhei|faturei|receita|despesa|salario|salário|freela|freelance|deposito|depósito|gasto|custou)/i.test(lowerText);
      const hasNumber = /(?:r\$?\s*)?\d+/i.test(lowerText);

      if (isLancarMatch && !hasNumber) {
        const now = new Date();
        let parsedDateStr = now.toISOString().split('T')[0];
        let textForExtraction = text;

        const dateMatch = text.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
        if (dateMatch) {
          const day = parseInt(dateMatch[1]);
          const month = parseInt(dateMatch[2]) - 1;
          let year = dateMatch[3] ? parseInt(dateMatch[3]) : now.getFullYear();
          if (year < 100) year += 2000;
          const d = new Date(year, month, day);
          if (!isNaN(d.getTime())) {
            parsedDateStr = d.toISOString().split('T')[0];
          }
          textForExtraction = textForExtraction.replace(dateMatch[0], '');
        } else if (lowerText.includes('ontem')) {
          const d = new Date();
          d.setDate(d.getDate() - 1);
          parsedDateStr = d.toISOString().split('T')[0];
        } else if (lowerText.includes('anteontem')) {
          const d = new Date();
          d.setDate(d.getDate() - 2);
          parsedDateStr = d.toISOString().split('T')[0];
        } else {
          const dayMatch = text.match(/dia\s*(\d{1,2})\b/i);
          if (dayMatch) {
            const day = parseInt(dayMatch[1]);
            const d = new Date(now.getFullYear(), now.getMonth(), day);
            if (!isNaN(d.getTime())) {
              parsedDateStr = d.toISOString().split('T')[0];
            }
            textForExtraction = textForExtraction.replace(dayMatch[0], '');
          }
        }

        let description = textForExtraction
          .replace(/(gastei|paguei|comprei|recebi|ganhei|faturei|receita|despesa|salario|salário|freela|freelance|deposito|depósito|gasto|com|de|em|ontem|anteontem)/gi, '')
          .replace(/\s+/g, ' ')
          .trim();

        if (!description) {
          description = lowerText.includes('recebi') || lowerText.includes('ganhei') || lowerText.includes('faturei') ? 'Receita Extra' : 'Despesa Extra';
        }

        const isReceita = /(recebi|ganhei|faturei|salario|salário|freela|freelance|deposito|depósito)/i.test(lowerText);
        const tipoItem = isReceita ? 'receita' : 'despesa';

        setIncompleteTx({
          descricao: description,
          data: parsedDateStr,
          tipoItem,
          step: 'waiting_for_value'
        });

        const botMsg: Message = {
          id: safeRandomUUID(),
          sender: 'bot',
          text: `Perfeito. Preparando o registro de uma ${tipoItem === 'despesa' ? 'despesa' : 'receita'} para *"${description}"*. Qual o valor correspondente, senhor?`,
          time: getFormattedTime()
        };

        setMessages((prev) => [...prev, botMsg]);
        return;
      }

      if (isLancarMatch && hasNumber) {
        const now = new Date();
        let parsedDateStr = now.toISOString().split('T')[0];
        let textForExtraction = text;

        const dateMatch = text.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
        if (dateMatch) {
          const day = parseInt(dateMatch[1]);
          const month = parseInt(dateMatch[2]) - 1;
          let year = dateMatch[3] ? parseInt(dateMatch[3]) : now.getFullYear();
          if (year < 100) year += 2000;
          const d = new Date(year, month, day);
          if (!isNaN(d.getTime())) {
            parsedDateStr = d.toISOString().split('T')[0];
          }
          textForExtraction = textForExtraction.replace(dateMatch[0], '');
        } else if (lowerText.includes('ontem')) {
          const d = new Date();
          d.setDate(d.getDate() - 1);
          parsedDateStr = d.toISOString().split('T')[0];
        } else if (lowerText.includes('anteontem')) {
          const d = new Date();
          d.setDate(d.getDate() - 2);
          parsedDateStr = d.toISOString().split('T')[0];
        } else {
          const dayMatch = text.match(/dia\s*(\d{1,2})\b/i);
          if (dayMatch) {
            const day = parseInt(dayMatch[1]);
            const d = new Date(now.getFullYear(), now.getMonth(), day);
            if (!isNaN(d.getTime())) {
              parsedDateStr = d.toISOString().split('T')[0];
            }
            textForExtraction = textForExtraction.replace(dayMatch[0], '');
          }
        }

        const valueMatch = textForExtraction.match(/(?:r\$?\s*)?(\d+(?:\.\d{3})*(?:,\d{2})?|\d+(?:,\d+)?|\d+(?:\.\d+)?)/i);
        let parsedValue = 0;
        if (valueMatch) {
          let valStr = valueMatch[1];
          if (valStr.includes(',') && valStr.includes('.')) {
            valStr = valStr.replace(/\./g, '').replace(',', '.');
          } else if (valStr.includes(',')) {
            const parts = valStr.split(',');
            if (parts[1].length === 3) {
              valStr = valStr.replace(/,/g, '');
            } else {
              valStr = valStr.replace(',', '.');
            }
          }
          parsedValue = parseFloat(valStr);
          textForExtraction = textForExtraction.replace(valueMatch[0], '');
        }

        let description = textForExtraction
          .replace(/(gastei|paguei|comprei|recebi|ganhei|faturei|receita|despesa|salario|salário|freela|freelance|deposito|depósito|gasto|com|de|em|ontem|anteontem)/gi, '')
          .replace(/\s+/g, ' ')
          .trim();

        if (!description) {
          description = lowerText.includes('recebi') || lowerText.includes('ganhei') || lowerText.includes('faturei') ? 'Receita Extra' : 'Despesa Extra';
        }

        const isReceita = /(recebi|ganhei|faturei|salario|salário|freela|freelance|deposito|depósito)/i.test(lowerText);
        const tipoItem = isReceita ? 'receita' : 'despesa';

        let category = 'Outros';
        if (tipoItem === 'receita') {
          category = 'Outras Receitas';
          if (lowerText.includes('salario') || lowerText.includes('salário')) category = 'Salário';
          else if (lowerText.includes('freela') || lowerText.includes('freelance')) category = 'Freelance';
          else if (lowerText.includes('investimento')) category = 'Investimentos';
        } else {
          if (lowerText.includes('mercado') || lowerText.includes('comida') || lowerText.includes('almoço') || lowerText.includes('jantar') || lowerText.includes('restaurante') || lowerText.includes('lanche') || lowerText.includes('pão') || lowerText.includes('padaria')) category = 'Alimentação';
          else if (lowerText.includes('uber') || lowerText.includes('taxi') || lowerText.includes('táxi') || lowerText.includes('onibus') || lowerText.includes('ônibus') || lowerText.includes('metrô') || lowerText.includes('combustivel') || lowerText.includes('gasolina') || lowerText.includes('viagem')) category = 'Transporte';
          else if (lowerText.includes('cinema') || lowerText.includes('show') || lowerText.includes('bar') || lowerText.includes('cerveja') || lowerText.includes('futebol') || lowerText.includes('jogo') || lowerText.includes('lazer')) category = 'Lazer';
          else if (lowerText.includes('aluguel') || lowerText.includes('luz') || lowerText.includes('agua') || lowerText.includes('água') || lowerText.includes('internet') || lowerText.includes('condominio') || lowerText.includes('reforma') || lowerText.includes('casa') || lowerText.includes('moradia')) category = 'Moradia';
        }

        if (parsedValue > 0) {
          const botMsg: Message = {
            id: safeRandomUUID(),
            sender: 'bot',
            text: `Perfeito, senhor. Consegui processar o comando. Confirme os dados abaixo para adicionarmos no FintechCore:`,
            time: getFormattedTime(),
            suggestion: {
              id: safeRandomUUID(),
              descricao: description,
              valor: parsedValue,
              data: parsedDateStr,
              categoria: category,
              tipoItem,
              status: 'pending'
            }
          };
          setMessages((prev) => [...prev, botMsg]);
        } else {
          const botMsg: Message = {
            id: safeRandomUUID(),
            sender: 'bot',
            text: `Reconheci o comando de lançamento para *"${description}"*, mas não encontrei um valor numérico válido. Qual o valor, senhor?`,
            time: getFormattedTime()
          };
          setMessages((prev) => [...prev, botMsg]);
        }
        return;
      }

      // 3. Fallback and general answers
      let replyText = '';
      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth();

      // Category Bottlenecks Calculation
      const categoryTotals: { [key: string]: number } = {};
      transactions.filter(t => t.tipoItem === 'despesa').forEach((t) => {
        categoryTotals[t.categoria] = (categoryTotals[t.categoria] || 0) + t.valor;
      });
      let highestCategory = 'Nenhuma';
      let highestVal = 0;
      Object.entries(categoryTotals).forEach(([cat, val]) => {
        if (val > highestVal) {
          highestVal = val;
          highestCategory = cat;
        }
      });

      if (lowerText.includes('dica') || lowerText.includes('ajuda') || lowerText.includes('insight')) {
        if (highestVal > 0) {
          replyText = `Senhor, sua maior categoria de gastos é *"${highestCategory}"* totalizando *${formatCurrency(highestVal)}*. Recomendo um teto de gastos de 10% menor para as próximas semanas. Seu saldo disponível hoje é *${formatCurrency(saldoReal)}*.`;
        } else {
          replyText = `Nenhuma despesa expressiva registrada este mês até agora, senhor. Seu saldo total atual é de *${formatCurrency(saldoReal)}*. Excelente oportunidade para poupar!`;
        }
      } else if (lowerText.includes('saldo') || lowerText.includes('como gastar') || lowerText.includes('caixa')) {
        const dRestantes = Math.max(1, new Date(currentYear, currentMonth + 1, 0).getDate() - new Date().getDate() + 1);
        const limiteDiario = saldoReal / dRestantes;
        replyText = `Senhor, seu saldo geral de caixa é de *${formatCurrency(saldoReal)}*. Para atingir suas metas com segurança, recomendo um limite de gastos médio diário de *${formatCurrency(limiteDiario)}* até o final do mês.`;
      } else if (lowerText.includes('investimento') || lowerText.includes('poupar') || lowerText.includes('cdb')) {
        const base = Math.max(0, saldoReal);
        const cdb = base * 0.1055;
        replyText = `Alocando seu capital consolidado de *${formatCurrency(saldoReal)}* em investimentos conservadores de renda fixa (CDB a 100% do CDI), o senhor terá um rendimento projetado de aproximadamente *${formatCurrency(cdb)}* ao ano, senhor.`;
      } else if (lowerText.includes('gargalo') || lowerText.includes('cortar') || lowerText.includes('gasto')) {
        if (highestVal > 0) {
          replyText = `O principal gargalo nas despesas do sistema é a categoria *"${highestCategory}"*, onde foram aplicados *${formatCurrency(highestVal)}*. Cortar pequenos excessos aqui trará o maior retorno sobre economia.`;
        } else {
          replyText = `Nenhum ralo ou gargalo financeiro de grande escala foi identificado no momento. Parabéns pelo gerenciamento rigoroso, senhor!`;
        }
      } else {
        replyText = `Perdão, senhor, não entendi o comando. Pode solicitar por *"dica"*, *"saldo"*, *"investimentos"*, *"gargalos"* ou descrever um gasto espontaneamente (Ex: *"gastei 30 com lanche"*).`;
      }

      const botMsg: Message = {
        id: safeRandomUUID(),
        sender: 'bot',
        text: replyText,
        time: getFormattedTime()
      };

      setMessages((prev) => [...prev, botMsg]);
    }, 650);
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: 'init',
        sender: 'bot',
        text: 'Histórico de interações reiniciado, senhor. Em que posso auxiliá-lo com suas análises orçamentárias agora?',
        time: getFormattedTime()
      }
    ]);
    setIncompleteTx(null);
  };

  const renderMessageText = (text: string) => {
    if (!text) return '';
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      const parts = line.split(/(\*[^*]+\*)/g);
      const content = parts.map((part, pIdx) => {
        if (part.startsWith('*') && part.endsWith('*')) {
          return <strong key={pIdx} className="font-extrabold text-purple-700 dark:text-purple-300">{part.slice(1, -1)}</strong>;
        }
        return part;
      });

      return (
        <div key={idx} className={idx > 0 ? "mt-1.5" : ""}>
          {content}
        </div>
      );
    });
  };

  return (
    <div className="fixed bottom-20 md:bottom-6 right-4 z-45 flex flex-col items-end gap-2">
      {/* STANDARD JARVIS ASSISTANT WINDOW (Elegant Tech styling) */}
      {isOpen && (
        <div className="w-[330px] md:w-[380px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-350 transform scale-100 animate-in fade-in slide-in-from-bottom-4">
          
          {/* ASSISTANT HEADER */}
          <div className="bg-slate-950 text-white px-4 py-3 flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center font-black text-xs shadow-md shadow-purple-500/20">
                  JV
                </div>
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-purple-500 border border-slate-950 rounded-full animate-pulse"></span>
              </div>
              
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-xs font-black leading-tight tracking-wide text-slate-100">JARVIS Assistant</h3>
                  <span className="bg-purple-500/10 text-purple-400 px-1 py-0.5 rounded text-[7px] font-bold uppercase tracking-wider">
                    AI
                  </span>
                </div>
                <span className="text-[9px] text-slate-400 font-medium">
                  {isTyping ? 'Analisando dados...' : 'Pronto para instruir'}
                </span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-1.5 text-slate-400">
              <button 
                onClick={handleClearChat} 
                className="hover:bg-slate-800 dark:hover:bg-slate-800 text-slate-400 hover:text-red-400 rounded-lg p-1.5 transition-colors cursor-pointer"
                title="Limpar Histórico"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="hover:bg-slate-800 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg p-1.5 transition-colors cursor-pointer"
                title="Minimizar"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-950/40 text-slate-500 dark:text-slate-400 text-[8px] py-1 px-3 text-center border-b border-slate-200/40 dark:border-slate-800 flex items-center justify-center gap-1">
            <Info className="w-2.5 h-2.5 text-purple-400" />
            <span>Processamento inteligente, autônomo e sem armazenamento externo de dados.</span>
          </div>

          {/* CHAT MESSAGES CONTAINER */}
          <div
            ref={chatContainerRef}
            className="text-[11px] h-72 overflow-y-auto p-4 flex flex-col gap-3.5 leading-relaxed bg-slate-50/50 dark:bg-slate-950/20 scroll-smooth no-scrollbar"
          >
            {messages.map((m) => {
              const isUser = m.sender === 'user';
              return (
                <div
                  key={m.id}
                  className={`flex flex-col max-w-[85%] ${
                    isUser ? 'self-end' : 'self-start'
                  }`}
                >
                  <div
                    className={`px-3.5 py-2.5 rounded-2xl text-xs relative shadow-2xs ${
                      isUser
                        ? 'bg-purple-600 text-white rounded-tr-none'
                        : 'bg-white text-slate-800 rounded-tl-none border border-slate-200/60 dark:bg-slate-900 dark:text-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <div className="whitespace-pre-wrap leading-relaxed pb-3 pr-2">
                      {renderMessageText(m.text)}
                    </div>
                    
                    <div className="absolute bottom-1 right-2 flex items-center gap-1 text-[7px] text-slate-400 font-bold">
                      <span>{m.time}</span>
                    </div>

                    {/* Suggestions Inside Bubble */}
                    {m.suggestion && (
                      <SuggestionCard
                        initialSuggestion={m.suggestion}
                        status={m.suggestion.status}
                        onConfirm={(descricao, valor, data, categoria) =>
                          handleConfirmSuggestion(m.id, descricao, valor, data, categoria)
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
                <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 px-3.5 py-2.5 rounded-2xl rounded-tl-none text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <div className="flex gap-1 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-bounce duration-500" style={{ animationDelay: '0ms' }}></span>
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-bounce duration-500" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-bounce duration-500" style={{ animationDelay: '300ms' }}></span>
                  </div>
                  <span className="text-[9px] font-bold italic text-purple-600 dark:text-purple-400">JARVIS está calculando...</span>
                </div>
              </div>
            )}
          </div>

          {/* CHIP SUGGESTIONS BAR */}
          <div className="bg-white dark:bg-slate-900 px-2.5 py-2 border-t border-slate-150 dark:border-slate-800/80 flex flex-wrap gap-1.5">
            <button
              onClick={() => handleSend('saldo')}
              className="text-[9px] bg-slate-50 hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-350 px-2.5 py-1 rounded-full font-bold transition-all cursor-pointer shadow-3xs flex items-center gap-1"
            >
              <TrendingUp className="w-3 h-3 text-emerald-500" /> Meu Saldo
            </button>
            <button
              onClick={() => handleSend('dica')}
              className="text-[9px] bg-slate-50 hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-350 px-2.5 py-1 rounded-full font-bold transition-all cursor-pointer shadow-3xs flex items-center gap-1"
            >
              <Sparkles className="w-3 h-3 text-purple-500" /> Pedir Dica
            </button>
            <button
              onClick={() => handleSend('gargalos')}
              className="text-[9px] bg-slate-50 hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-350 px-2.5 py-1 rounded-full font-bold transition-all cursor-pointer shadow-3xs flex items-center gap-1"
            >
              <TrendingDown className="w-3 h-3 text-rose-500" /> Gargalo de Gastos
            </button>
            <button
              onClick={() => handleSend('investimento')}
              className="text-[9px] bg-slate-50 hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-350 px-2.5 py-1 rounded-full font-bold transition-all cursor-pointer shadow-3xs flex items-center gap-1"
            >
              <BrainCircuit className="w-3 h-3 text-indigo-500" /> Poupar / Investir
            </button>
          </div>

          {/* INPUT BAR */}
          <div className="bg-slate-50 dark:bg-slate-950 px-3 py-2.5 flex items-center gap-2 border-t border-slate-200 dark:border-slate-805">
            <input
              type="text"
              placeholder="Pergunte ao JARVIS ou lance despesas..."
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSend();
              }}
              className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-purple-500 shadow-3xs"
            />

            <button
              onClick={() => handleSend()}
              className="bg-purple-600 hover:bg-purple-700 text-white p-2 rounded-xl font-bold active:scale-95 transition-all flex items-center justify-center cursor-pointer shadow-sm shrink-0"
              title="Enviar"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* FLOATING TRIGGER BUTTON */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-purple-600 hover:bg-purple-700 text-white p-4 rounded-full shadow-2xl hover:scale-105 active:scale-95 transition-all cursor-pointer relative border-2 border-white dark:border-slate-950 shadow-purple-500/10"
        title="Assistente Financeiro JARVIS"
      >
        <BrainCircuit className="w-5.5 h-5.5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white text-[8px] font-black border border-white">
            {unreadCount}
          </span>
        )}
      </button>
    </div>
  );
};
