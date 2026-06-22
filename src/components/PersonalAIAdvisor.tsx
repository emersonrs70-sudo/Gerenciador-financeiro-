import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Sparkles, Minus, Send, Bot, User } from 'lucide-react';
import { Transaction } from '../types';

interface Message {
  id: string;
  sender: 'user' | 'bot';
  text: string;
}

interface PersonalAIAdvisorProps {
  transactions: Transaction[];
  saldoReal: number;
}

export const PersonalAIAdvisor: React.FC<PersonalAIAdvisorProps> = ({
  transactions,
  saldoReal
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputVal, setInputVal] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'init',
      sender: 'bot',
      text: 'Olá! Sou seu Consultor Financeiro Inteligente. Digite "dica" para dicas rápidas ou "saldo" para analisarmos sua saúde financeira real. O que gostaria de analisar hoje?'
    }
  ]);

  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Auto Scroll Chat
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  const handleSend = (textToSend?: string) => {
    const text = (textToSend || inputVal).trim();
    if (!text) return;

    // Add user message
    const userMsg: Message = {
      id: crypto.randomUUID(),
      sender: 'user',
      text
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputVal('');

    // Process responses based on financial datasets
    setTimeout(() => {
      const lowerText = text.toLowerCase();
      let replyText = '';

      // 1. Calculate stats for context answers
      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth();

      const currentMonthTrans = transactions.filter((t) => {
        const d = new Date(t.data);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      });

      const despesasMes = currentMonthTrans.filter((t) => t.tipoItem === 'despesa');
      const totalDespesas = despesasMes.reduce((s, t) => s + t.valor, 0);

      // Group categories
      const categoryBudgets: { [key: string]: number } = {};
      despesasMes.forEach((d) => {
        categoryBudgets[d.categoria] = (categoryBudgets[d.categoria] || 0) + d.valor;
      });

      let highestCategory = 'Nenhuma';
      let highestVal = 0;
      Object.entries(categoryBudgets).forEach(([cat, val]) => {
        if (val > highestVal) {
          highestVal = val;
          highestCategory = cat;
        }
      });

      const formatCurrency = (val: number) =>
        `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

      // 2. Matching rules (Matches original app.js matches perfectly while expanding)
      if (lowerText.includes('dica') || lowerText.includes('ajuda') || lowerText.includes('insight')) {
        if (highestVal > 0) {
          replyText = `💡 Inteligência Fintech: Identifiquei que sua principal despesa este mês está em "${highestCategory}" com um total de ${formatCurrency(highestVal)}. Recomendo simular cortes de 10% nesta categoria usando a aba "Gráficos" para liberar caixa. Seu saldo disponível completo hoje é de ${formatCurrency(saldoReal)}.`;
        } else {
          replyText = `💡 Inteligência Fintech: Seu orçamento está limpo este mês! Seu saldo total disponível completo hoje é de ${formatCurrency(saldoReal)}. Excelente momento para definir metas de poupança unificadas.`;
        }
      } else if (lowerText.includes('saldo') || lowerText.includes('como gastar') || lowerText.includes('caixa')) {
        const dRestantes = Math.max(1, new Date(currentYear, currentMonth + 1, 0).getDate() - new Date().getDate() + 1);
        const limiteDiario = Math.max(0, saldoReal / dRestantes);
        replyText = `📊 Balanço Atualizado: Seu saldo real acumulado ao longo de todo o histórico é de ${formatCurrency(saldoReal)}. Para terminar o mês no azul, seu gasto diário máximo seguro deve ser de ${formatCurrency(limiteDiario)} pelos próximos ${dRestantes} dias.`;
      } else if (lowerText.includes('investimento') || lowerText.includes('poupar') || lowerText.includes('cdb')) {
        const base = Math.max(0, saldoReal);
        const poupanca = base * 0.0617;
        const cdb = base * 0.105;
        replyText = `📈 Projeção Recomendada: Com sua liquidez atual de ${formatCurrency(saldoReal)}, investir em um CDB renderia aproximadamente ${formatCurrency(cdb)} em um ano (+ R$ ${(cdb - poupanca).toFixed(2)} a mais do que a poupança clássica)! Procure opções com liquidez diária.`;
      } else if (lowerText.includes('gargalo') || lowerText.includes('cortar') || lowerText.includes('gasto')) {
        if (highestVal > 0) {
          replyText = `⚠️ Avaliação de Gargalos: Seu maior canal de consumo este mês é "${highestCategory}" com ${formatCurrency(highestVal)}. A categoria consome uma fatia do seu total de despesas atuais (${formatCurrency(totalDespesas)}). Tente apertar o Cortador de Gordura!`;
        } else {
          replyText = `Não detectei despesas significativas até o momento neste mês. Continue monitorando suas transações rotineiramente!`;
        }
      } else {
        replyText = `Não entendi sua solicitação com precisão. Você pode perguntar sobre "dica" (insights gerais), "saldo" (limite de gasto diário) ou "investimento" (projeções financeiras).`;
      }

      const botMsg: Message = {
        id: crypto.randomUUID(),
        sender: 'bot',
        text: replyText
      };

      setMessages((prev) => [...prev, botMsg]);
    }, 600);
  };

  return (
    <div className="fixed bottom-20 md:bottom-6 right-4 z-45 flex flex-col items-end gap-2">
      {/* CHAT WINDOW */}
      {isOpen && (
        <div className="w-80 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col gap-3 transition-all duration-300 transform scale-100 animate-in fade-in slide-in-from-bottom-4">
          <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-805 pb-2">
            <h3 className="text-xs font-black text-purple-600 dark:text-purple-400 flex items-center gap-1.5 uppercase tracking-wide">
              <Sparkles className="w-3.5 h-3.5" />
              Consultor Financeiro AI
            </h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <Minus className="w-4 h-4" />
            </button>
          </div>

          <div
            ref={chatContainerRef}
            className="text-[11px] h-48 overflow-y-auto p-2 bg-slate-50 dark:bg-slate-950 rounded-xl leading-relaxed space-y-3 scroll-smooth no-scrollbar"
          >
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex gap-2 items-start max-w-[85%] ${
                  m.sender === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'
                }`}
              >
                <div
                  className={`p-1.5 rounded-lg flex-shrink-0 ${
                    m.sender === 'user'
                      ? 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
                      : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {m.sender === 'user' ? <User className="w-3 h-3" /> : <Bot className="w-3 h-3" />}
                </div>
                <div
                  className={`px-3 py-2 rounded-xl text-xs font-medium ${
                    m.sender === 'user'
                      ? 'bg-purple-600 text-white rounded-tr-none'
                      : 'bg-white dark:bg-slate-905 border border-slate-150 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-tl-none shadow-2xs'
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
          </div>

          {/* QUICK TOPICS PRESSETS BUTTONS */}
          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => handleSend('dica')}
              className="text-[9px] bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-500 dark:text-slate-300 px-2 py-1 rounded-md font-bold transition-all cursor-pointer"
            >
              💡 Dicas Gerais
            </button>
            <button
              onClick={() => handleSend('saldo')}
              className="text-[9px] bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-500 dark:text-slate-300 px-2 py-1 rounded-md font-bold transition-all cursor-pointer"
            >
              🎯 Gasto Seguro
            </button>
            <button
              onClick={() => handleSend('investimento')}
              className="text-[9px] bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-500 dark:text-slate-300 px-2 py-1 rounded-md font-bold transition-all cursor-pointer"
            >
              📈 Poupar / Investir
            </button>
          </div>

          {/* INPUT FIELDS */}
          <div className="flex gap-1.5 border-t border-slate-100 dark:border-slate-800 pt-2">
            <input
              type="text"
              placeholder="Digite sua dúvida..."
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSend();
              }}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 dark:text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
            <button
              onClick={() => handleSend()}
              className="bg-purple-600 text-white p-2 rounded-xl font-bold hover:bg-purple-700 active:scale-95 transition-all flex items-center justify-center cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* FLOATING TRIGGER BUTTON */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-3.5 rounded-full shadow-xl hover:scale-105 active:scale-95 transition-all cursor-pointer hover:shadow-purple-500/25 relative"
      >
        <MessageSquare className="w-5 h-5" />
        <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-purple-500"></span>
        </span>
      </button>
    </div>
  );
};
