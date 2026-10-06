import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Upload, FileText, CheckCircle2, AlertTriangle, X, ArrowUpCircle, ArrowDownCircle,
  HelpCircle, Sparkles, Filter, Trash2, Check, RefreshCw, Layers, Loader2
} from 'lucide-react';
import { Transaction, BankAccount, safeRandomUUID, getBillMonthForDate } from '../types';
import {
  ParsedItem, parseSantanderStatement, parseOFXStatement, parseCSVStatement
} from '../lib/statementParser';
import { extractTextFromPdf, isPdfBuffer } from '../lib/pdfTextExtractor';

interface ImportStatementModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: BankAccount[];
  selectedAccountId: string;
  existingTransactions: Transaction[];
  categoriasDespesa: string[];
  categoriasReceita: string[];
  onImportBatch: (
    newItems: Array<{
      descricao: string;
      valor: number;
      data: string;
      categoria: string;
      tipoItem: 'despesa' | 'receita';
      accountId: string;
      faturaMes?: string;
    }>
  ) => Promise<void>;
}

export const ImportStatementModal: React.FC<ImportStatementModalProps> = ({
  isOpen,
  onClose,
  accounts,
  selectedAccountId,
  existingTransactions,
  categoriasDespesa,
  categoriasReceita,
  onImportBatch,
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'paste'>('upload');
  const [targetAccountId, setTargetAccountId] = useState<string>(() => {
    return selectedAccountId !== 'consolidado' ? selectedAccountId : (accounts[0]?.id || 'santander');
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Raw paste input state
  const [pastedText, setPastedText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Parsed review items
  const [parsedItems, setParsedItems] = useState<ParsedItem[]>([]);
  const [hasParsed, setHasParsed] = useState(false);
  const [filterMode, setFilterMode] = useState<'todos' | 'duplicatas' | 'pendentes' | 'despesas' | 'receitas'>('todos');

  // Drag and drop state
  const [isDragging, setIsDragging] = useState(false);

  if (!isOpen) return null;

  const currentAccount = accounts.find(a => a.id === targetAccountId) || accounts[0];

  // Process extracted text
  const processRawText = (text: string, fileType: 'pdf' | 'ofx' | 'csv' | 'text' = 'text') => {
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      let items: ParsedItem[] = [];

      if (fileType === 'ofx' || text.includes('<OFX>') || text.includes('<STMTTRN>')) {
        items = parseOFXStatement(text, existingTransactions, categoriasDespesa, categoriasReceita);
      } else if (fileType === 'csv' || (text.includes(';') && text.includes('\n'))) {
        items = parseCSVStatement(text, existingTransactions, categoriasDespesa, categoriasReceita);
      } else {
        // Santander or general Brazilian text statement
        items = parseSantanderStatement(text, existingTransactions, categoriasDespesa, categoriasReceita);
      }

      if (items.length === 0) {
        setErrorMessage('Nenhuma movimentação foi identificada no documento. Se for uma foto/imagem escaneada sem texto ou com layout diferente, você pode copiar as linhas de extrato e colar na aba "Copiar e Colar Texto".');
        setParsedItems([]);
        setHasParsed(false);
      } else {
        setParsedItems(items);
        setHasParsed(true);
      }
    } catch (err: any) {
      console.error('Error parsing statement:', err);
      setErrorMessage(`Ocorreu um erro ao processar o extrato: ${err?.message || 'Formato não reconhecido'}`);
    } finally {
      setIsProcessing(false);
      setProcessingStatus('');
    }
  };

  // Handle file drop or selection
  const handleFileUpload = async (file: File) => {
    setIsProcessing(true);
    setProcessingStatus(`Lendo arquivo "${file.name}" (${(file.size / 1024).toFixed(0)} KB)...`);
    setErrorMessage(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const fileName = (file.name || '').toLowerCase();
      const isPdf = fileName.endsWith('.pdf') || file.type.toLowerCase().includes('pdf') || isPdfBuffer(arrayBuffer);

      if (isPdf) {
        setProcessingStatus('Extraindo páginas e movimentações do PDF...');
        const extractedText = await extractTextFromPdf(arrayBuffer);
        setProcessingStatus('Analisando transações e cruzando dados...');
        processRawText(extractedText, 'pdf');
      } else if (fileName.endsWith('.ofx')) {
        setProcessingStatus('Processando arquivo bancário OFX...');
        const text = new TextDecoder('latin1').decode(arrayBuffer);
        processRawText(text, 'ofx');
      } else if (fileName.endsWith('.csv')) {
        setProcessingStatus('Processando arquivo CSV...');
        const text = new TextDecoder('utf-8').decode(arrayBuffer);
        processRawText(text, 'csv');
      } else {
        setProcessingStatus('Processando texto do extrato...');
        const text = new TextDecoder('utf-8').decode(arrayBuffer);
        processRawText(text, 'text');
      }
    } catch (err: any) {
      console.error('Error reading statement file:', err);
      setErrorMessage(`Não foi possível processar o arquivo "${file.name}": ${err?.message || 'Arquivo inacessível ou formato não reconhecido'}. Você também pode copiar o texto da fatura/extrato e colar diretamente na aba "Copiar e Colar Texto".`);
      setIsProcessing(false);
      setProcessingStatus('');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  // Batch toggle actions
  const toggleItemSelection = (id: string) => {
    setParsedItems(prev => prev.map(item => item.id === id ? { ...item, selected: !item.selected } : item));
  };

  const selectAllValid = () => {
    setParsedItems(prev => prev.map(item => ({
      ...item,
      selected: !item.isDuplicate
    })));
  };

  const unselectAll = () => {
    setParsedItems(prev => prev.map(item => ({ ...item, selected: false })));
  };

  const updateItemCategory = (id: string, newCategory: string) => {
    setParsedItems(prev => prev.map(item => {
      if (item.id === id) {
        return {
          ...item,
          categoria: newCategory,
          categoriaSugeridaConfiavel: true // User confirmed it!
        };
      }
      return item;
    }));
  };

  const removeItem = (id: string) => {
    setParsedItems(prev => prev.filter(item => item.id !== id));
  };

  // Metric summaries
  const totalItems = parsedItems.length;
  const selectedItems = parsedItems.filter(i => i.selected);
  const duplicateCount = parsedItems.filter(i => i.isDuplicate).length;
  const pendingCategoryCount = parsedItems.filter(i => !i.categoriaSugeridaConfiavel).length;

  const totalReceitas = selectedItems.filter(i => i.tipoItem === 'receita').reduce((acc, curr) => acc + curr.valor, 0);
  const totalDespesas = selectedItems.filter(i => i.tipoItem === 'despesa').reduce((acc, curr) => acc + curr.valor, 0);

  // Filtered list for display
  const displayedItems = parsedItems.filter(item => {
    if (filterMode === 'duplicatas') return item.isDuplicate;
    if (filterMode === 'pendentes') return !item.categoriaSugeridaConfiavel;
    if (filterMode === 'despesas') return item.tipoItem === 'despesa';
    if (filterMode === 'receitas') return item.tipoItem === 'receita';
    return true;
  });

  // Final confirmation to commit transactions
  const handleConfirmImport = async () => {
    if (selectedItems.length === 0) {
      alert('Selecione pelo menos um lançamento para importar.');
      return;
    }

    setIsProcessing(true);

    const itemsToSave = selectedItems.map(item => {
      let faturaMes: string | undefined = undefined;
      if (currentAccount?.tipo === 'credito') {
        faturaMes = getBillMonthForDate(item.data, currentAccount.diaFechamento);
      }

      return {
        descricao: item.descricao,
        valor: item.valor,
        data: item.data,
        categoria: item.categoria,
        tipoItem: item.tipoItem,
        accountId: targetAccountId,
        faturaMes
      };
    });

    await onImportBatch(itemsToSave);
    setIsProcessing(false);
    onClose();
  };

  // Pre-load example text from Santander extract
  const loadExampleSantander = () => {
    const example = `03/08 PIX RECEBIDO Francisco Edson dos Santo - 200,00
PIX ENVIADO Sony Emerson Rocha dos Sa - 200,00-
PIX ENVIADO S de Lima Costa Panificad - 19,00-
PIX ENVIADO Sony Emerson Rocha dos Sa - 4.800,00-
PIX ENVIADO Sony Emerson Rocha dos Sa - 2.000,00-
DEBITO AUT. TELEFONE CELULAR CLARO MOVEL - 27,01-
04/08 PIX RECEBIDO JOSE MARIA DOS SANTOS - 2.000,00
05/08 PIX ENVIADO TOP LANCHES LTDA - 25,00-
08/08 DEBITO VISA ELECTRON BRASIL GRUPO REZENDE - 71,22-
PIX ENVIADO RESTAURANTE TOCA POTIGUARA - 38,20-
10/08 PIX ENVIADO Francisco Ronaldo Meneses - 4,50-
12/08 PIX ENVIADO LIVRARIA E PAPELARIA LOIO - 72,00-
13/08 PIX ENVIADO Supermercado Cimir Ltda - 19,20-
17/08 DEBITO VISA ELECTRON BRASIL REDE L CAR - 83,83-
20/08 PIX RECEBIDO A A C SAUDE MORRINHOS - 805,00
20/08 PAGAMENTO DE BOLETO OUTROS BANCOS ELEVEN PROTECAO VEICULAR - 101,89-
24/08 DEBITO VISA ELECTRON BRASIL POSTO LUAR DO SERTA - 50,00-
24/08 PIX ENVIADO L CAR PETROLEO E LUBRIFIC - 210,83-
28/08 LIQUIDO DE VENCIMENTO CNPJ 010656452000180 - 214,43
31/08 PIX ENVIADO MULTICINE CINEMAS LTDA - 45,00-
31/08 PIX ENVIADO AUTO POSTO REZENDE LTDA - 56,26-
31/08 DEBITO AUT. FATURA CARTAO VISA FINAL 0245 - 419,83-`;

    setPastedText(example);
    setActiveTab('paste');
    processRawText(example, 'text');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-5 bg-black/70 backdrop-blur-sm overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="bg-white dark:bg-[#1A1A1E] border border-zinc-200/80 dark:border-[#27272A] rounded-2xl sm:rounded-3xl w-full max-w-5xl shadow-2xl flex flex-col max-h-[96vh] sm:max-h-[92vh] overflow-hidden"
      >
        {/* MODAL HEADER */}
        <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b border-zinc-100 dark:border-[#27272A] bg-zinc-50/50 dark:bg-[#141416]/60">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-zinc-900/10 dark:bg-white/10 text-zinc-900 dark:text-white flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-zinc-700 dark:text-zinc-300" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-white tracking-tight truncate">
                  Importar Extrato Bancário
                </h2>
                <span className="text-[9px] sm:text-[11px] font-semibold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 dark:bg-[#27272A] dark:text-zinc-300 whitespace-nowrap">
                  Santander • OFX • CSV • PDF
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-zinc-400 dark:text-zinc-400 truncate">
                Leitura inteligente com detecção de duplicadas e categorias
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 rounded-xl text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-[#27272A] dark:hover:text-zinc-200 transition-colors shrink-0 ml-2 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-6 space-y-4 sm:space-y-5">
          {/* CONFIGURATION & SOURCE SELECTION */}
          {!hasParsed ? (
            <div className="space-y-5">
              {/* TARGET ACCOUNT SELECTOR */}
              <div className="bg-zinc-50/80 dark:bg-[#141416] p-4 rounded-2xl border border-zinc-200/80 dark:border-[#27272A] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
                  <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    Conta bancária de destino dos lançamentos:
                  </span>
                </div>
                <select
                  value={targetAccountId}
                  onChange={(e) => setTargetAccountId(e.target.value)}
                  className="bg-white dark:bg-[#1A1A1E] border border-zinc-200/80 dark:border-[#27272A] rounded-xl px-3 py-2 text-xs font-semibold text-zinc-800 dark:text-zinc-100 focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10 outline-none"
                >
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.nome} ({acc.tipo === 'credito' ? 'Cartão de Crédito' : 'Conta Corrente'})
                    </option>
                  ))}
                </select>
              </div>

              {/* TABS: UPLOAD FILE vs PASTE TEXT */}
              <div className="flex gap-2 border-b border-zinc-100 dark:border-[#27272A] pb-2">
                <button
                  onClick={() => setActiveTab('upload')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'upload'
                      ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 shadow-xs'
                      : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-[#222226]'
                  }`}
                >
                  <Upload className="w-4 h-4" />
                  Upload de Arquivo (PDF, OFX, CSV)
                </button>
                <button
                  onClick={() => setActiveTab('paste')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'paste'
                      ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 shadow-xs'
                      : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-[#222226]'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  Copiar e Colar Texto
                </button>
              </div>

              {/* TAB 1: FILE UPLOAD (DRAG & DROP) */}
              {activeTab === 'upload' && (
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-3xl p-8 sm:p-12 text-center transition-all ${
                    isDragging
                      ? 'border-zinc-900 dark:border-zinc-300 bg-zinc-50 dark:bg-[#141416]'
                      : 'border-zinc-300 dark:border-[#27272A] bg-zinc-50/50 dark:bg-[#141416]/40'
                  }`}
                >
                  <div className="w-16 h-16 rounded-3xl bg-zinc-100 dark:bg-[#27272A] text-zinc-800 dark:text-zinc-200 mx-auto flex items-center justify-center mb-4">
                    <Upload className="w-8 h-8" />
                  </div>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 mb-1">
                    Arraste o arquivo do extrato ou clique para selecionar
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-6 max-w-md mx-auto">
                    Suporta extratos em <strong>PDF Santander</strong>, arquivos bancários <strong>OFX</strong>, tabelas <strong>CSV</strong> ou arquivos de texto puro.
                  </p>

                  {isProcessing ? (
                    <div className="flex flex-col items-center justify-center gap-3 py-6 px-4 bg-zinc-100/80 dark:bg-[#222226] rounded-2xl border border-zinc-200 dark:border-[#27272A]">
                      <Loader2 className="w-8 h-8 text-zinc-900 dark:text-zinc-100 animate-spin" />
                      <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200 animate-pulse">
                        {processingStatus || 'Processando extrato bancário...'}
                      </p>
                    </div>
                  ) : (
                    <div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="application/pdf,.pdf,.ofx,.csv,.txt,text/plain,text/csv"
                        className="sr-only"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            handleFileUpload(file);
                          }
                          e.target.value = '';
                        }}
                      />

                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-950 active:scale-95 text-white font-bold text-xs cursor-pointer shadow-xs transition-all"
                      >
                        <FileText className="w-4 h-4" />
                        Escolher Arquivo do Celular / Computador
                      </button>
                    </div>
                  )}

                  <div className="mt-8 pt-6 border-t border-zinc-200/80 dark:border-[#27272A] flex justify-center">
                    <button
                      onClick={loadExampleSantander}
                      className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:underline flex items-center gap-1.5 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Ou teste agora com um exemplo real do Santander (Ago/2026)
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 2: PASTE TEXT */}
              {activeTab === 'paste' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                      Cole aqui o texto do extrato ou da fatura bancária:
                    </label>
                    <button
                      onClick={loadExampleSantander}
                      className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Preencher Exemplo Santander
                    </button>
                  </div>
                  <textarea
                    rows={10}
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value)}
                    placeholder="Exemplo:&#10;03/08 PIX RECEBIDO Francisco Edson dos Santo - 200,00&#10;PIX ENVIADO S de Lima Costa Panificad - 19,00-&#10;DEBITO AUT. TELEFONE CELULAR CLARO MOVEL - 27,01-&#10;05/08 PIX ENVIADO TOP LANCHES LTDA - 25,00-"
                    className="w-full bg-zinc-50 dark:bg-[#141416] border border-zinc-200/80 dark:border-[#27272A] rounded-2xl p-4 text-xs font-mono text-zinc-800 dark:text-zinc-200 focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10 outline-none resize-y"
                  />
                  <div className="flex justify-end">
                    <button
                      disabled={!pastedText.trim() || isProcessing}
                      onClick={() => processRawText(pastedText, 'text')}
                      className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-950 disabled:opacity-50 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4" />
                      {isProcessing ? 'Processando...' : 'Analisar e Identificar Movimentações'}
                    </button>
                  </div>
                </div>
              )}

              {/* ERROR ALERT */}
              {errorMessage && (
                <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-start sm:items-center gap-3">
                    <AlertTriangle className="w-5 h-5 shrink-0 text-rose-500 mt-0.5 sm:mt-0" />
                    <span>{errorMessage}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMessage(null);
                      setActiveTab('paste');
                    }}
                    className="shrink-0 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs cursor-pointer transition-all self-end sm:self-auto"
                  >
                    Colar Texto do Extrato
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* PREVIEW AND REVISION SCREEN */
            <div className="space-y-3.5 sm:space-y-4">
              {/* SUMMARY METRIC CARDS */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
                <div className="bg-zinc-50 dark:bg-[#141416] p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border border-zinc-200/80 dark:border-[#27272A]">
                  <span className="text-[9px] sm:text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block">Identificados</span>
                  <span className="text-sm sm:text-xl font-black text-zinc-900 dark:text-white font-mono">
                    {totalItems} <span className="text-[10px] sm:text-xs font-normal text-zinc-400">({selectedItems.length} sel.)</span>
                  </span>
                </div>

                <div className="bg-emerald-50 dark:bg-emerald-950/30 p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border border-emerald-200 dark:border-emerald-800/50">
                  <span className="text-[9px] sm:text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">Receitas</span>
                  <span className="text-sm sm:text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono truncate block">
                    R$ {totalReceitas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="bg-rose-50 dark:bg-rose-950/30 p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border border-rose-200 dark:border-rose-800/50">
                  <span className="text-[9px] sm:text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider block">Despesas</span>
                  <span className="text-sm sm:text-xl font-black text-rose-600 dark:text-rose-400 font-mono truncate block">
                    R$ {totalDespesas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className={`p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border ${
                  duplicateCount > 0
                    ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/50'
                    : 'bg-zinc-50 dark:bg-[#141416] border-zinc-200/80 dark:border-[#27272A]'
                }`}>
                  <span className="text-[9px] sm:text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">
                    Duplicatas
                  </span>
                  <span className="text-sm sm:text-xl font-black text-amber-600 dark:text-amber-400 truncate block">
                    {duplicateCount} <span className="text-[10px] sm:text-xs font-normal text-zinc-500">bloqueadas</span>
                  </span>
                </div>
              </div>

              {/* ACTION TOOLBAR & FILTER TABS */}
              <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2.5 bg-zinc-50 dark:bg-[#141416] p-2.5 sm:p-3 rounded-2xl border border-zinc-200/80 dark:border-[#27272A]">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                  <button
                    onClick={() => setFilterMode('todos')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                      filterMode === 'todos' ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 shadow-xs' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/60 dark:hover:bg-[#27272A]'
                    }`}
                  >
                    Todos ({totalItems})
                  </button>
                  {duplicateCount > 0 && (
                    <button
                      onClick={() => setFilterMode('duplicatas')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 flex items-center gap-1 cursor-pointer ${
                        filterMode === 'duplicatas' ? 'bg-amber-600 text-white shadow-xs' : 'text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-950/40'
                      }`}
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Duplicatas ({duplicateCount})
                    </button>
                  )}
                  {pendingCategoryCount > 0 && (
                    <button
                      onClick={() => setFilterMode('pendentes')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 flex items-center gap-1 cursor-pointer ${
                        filterMode === 'pendentes' ? 'bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-950 shadow-xs' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Definir Categoria ({pendingCategoryCount})
                    </button>
                  )}
                  <button
                    onClick={() => setFilterMode('despesas')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                      filterMode === 'despesas' ? 'bg-rose-600 text-white shadow-xs' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/60 dark:hover:bg-[#27272A]'
                    }`}
                  >
                    Despesas
                  </button>
                  <button
                    onClick={() => setFilterMode('receitas')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                      filterMode === 'receitas' ? 'bg-emerald-600 text-white shadow-xs' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/60 dark:hover:bg-[#27272A]'
                    }`}
                  >
                    Receitas
                  </button>
                </div>

                <div className="flex items-center gap-2 justify-between sm:justify-end pt-1 sm:pt-0 border-t sm:border-t-0 border-zinc-200 dark:border-[#27272A]">
                  <button
                    onClick={selectAllValid}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-[#27272A] transition-colors cursor-pointer"
                  >
                    Marcar Válidas
                  </button>
                  <button
                    onClick={unselectAll}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold text-zinc-500 hover:bg-zinc-200/60 dark:hover:bg-[#27272A] transition-colors cursor-pointer"
                  >
                    Desmarcar Todas
                  </button>
                  <button
                    onClick={() => setHasParsed(false)}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold text-zinc-500 hover:bg-zinc-200/60 dark:hover:bg-[#27272A] transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Novo</span>
                  </button>
                </div>
              </div>

              {/* MOBILE VIEW: CARDS (Visible on screens < md) */}
              <div className="block md:hidden space-y-2.5 max-h-[52vh] overflow-y-auto pr-0.5">
                {displayedItems.length === 0 ? (
                  <div className="p-8 text-center text-zinc-400 dark:text-zinc-500 text-xs font-bold">
                    Nenhuma movimentação encontrada neste filtro.
                  </div>
                ) : (
                  displayedItems.map((item) => {
                    const availableCats = item.tipoItem === 'despesa' ? categoriasDespesa : categoriasReceita;
                    const isDesp = item.tipoItem === 'despesa';

                    return (
                      <div
                        key={item.id}
                        className={`p-3 rounded-2xl border transition-all ${
                          item.selected
                            ? 'border-zinc-400 dark:border-zinc-500 bg-white dark:bg-[#1A1A1E] shadow-xs'
                            : 'border-zinc-200/80 dark:border-[#27272A] bg-zinc-50/50 dark:bg-[#141416]/40 opacity-75'
                        } ${item.isDuplicate ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800' : ''}`}
                      >
                        {/* Card Top Row: Checkbox, Date, Tag, Amount */}
                        <div className="flex items-center justify-between gap-2">
                          <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
                            <input
                              type="checkbox"
                              checked={item.selected}
                              onChange={() => toggleItemSelection(item.id)}
                              className="w-4.5 h-4.5 rounded text-zinc-900 focus:ring-zinc-900 dark:text-white dark:focus:ring-white cursor-pointer shrink-0"
                            />
                            <span className="text-[11px] font-mono font-bold text-zinc-500 dark:text-zinc-400">
                              {new Date(item.data + 'T12:00:00').toLocaleDateString('pt-BR')}
                            </span>
                            <span
                              className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0 ${
                                isDesp
                                  ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
                                  : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                              }`}
                            >
                              {isDesp ? 'Saída' : 'Entrada'}
                            </span>
                          </label>

                          <span
                            className={`font-black font-mono text-xs sm:text-sm shrink-0 ${
                              isDesp ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                            }`}
                          >
                            {isDesp ? '-' : '+'} R$ {item.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>

                        {/* Description */}
                        <div className="mt-2 pl-6.5">
                          <p className="text-xs font-bold text-zinc-900 dark:text-white leading-snug break-words">
                            {item.descricao}
                          </p>

                          {/* Duplicate Notice */}
                          {item.isDuplicate && (
                            <div className="mt-1.5 p-2 rounded-xl bg-amber-100/70 dark:bg-amber-950/50 border border-amber-300/60 dark:border-amber-800 text-[10px] font-bold text-amber-800 dark:text-amber-200 flex items-start gap-1.5">
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                              <span>{item.duplicateReason || 'Possível duplicata já cadastrada'}</span>
                            </div>
                          )}

                          {/* Category Dropdown & Remove Button */}
                          <div className="mt-2.5 flex items-center justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              {!item.categoriaSugeridaConfiavel && (
                                <span className="text-[9px] font-black text-amber-600 dark:text-amber-400 block mb-0.5">
                                  ⚠️ Confirmar Categoria:
                                </span>
                              )}
                              <select
                                value={item.categoria}
                                onChange={(e) => updateItemCategory(item.id, e.target.value)}
                                className={`w-full py-1.5 px-2 rounded-xl text-xs font-bold outline-none border transition-all cursor-pointer ${
                                  !item.categoriaSugeridaConfiavel
                                    ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 ring-2 ring-amber-400/30'
                                    : 'bg-white dark:bg-[#1A1A1E] border-zinc-200/80 dark:border-[#27272A] text-zinc-800 dark:text-zinc-200'
                                }`}
                              >
                                {availableCats.map((cat) => (
                                  <option key={cat} value={cat}>
                                    {cat}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <button
                              onClick={() => removeItem(item.id)}
                              className="p-2 rounded-xl text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors shrink-0 self-end"
                              title="Remover este item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* DESKTOP VIEW: TABLE (Visible on screens >= md) */}
              <div className="hidden md:block border border-zinc-200/80 dark:border-[#27272A] rounded-2xl overflow-hidden max-h-[48vh] overflow-y-auto">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse min-w-[720px]">
                    <thead className="bg-zinc-100 dark:bg-[#141416] sticky top-0 z-10 text-[11px] font-black text-zinc-600 dark:text-zinc-400 border-b border-zinc-200/80 dark:border-[#27272A]">
                      <tr>
                        <th className="py-2.5 px-3 w-10 text-center">
                          <input
                            type="checkbox"
                            checked={selectedItems.length > 0 && selectedItems.length === parsedItems.filter(i => !i.isDuplicate).length}
                            onChange={(e) => e.target.checked ? selectAllValid() : unselectAll()}
                            className="rounded text-zinc-900 focus:ring-zinc-900 dark:text-white cursor-pointer"
                          />
                        </th>
                        <th className="py-2.5 px-3 w-24">Data</th>
                        <th className="py-2.5 px-3">Descrição / Histórico</th>
                        <th className="py-2.5 px-3 w-48">Categoria Sugerida</th>
                        <th className="py-2.5 px-3 w-32 text-right">Valor</th>
                        <th className="py-2.5 px-3 w-10 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-[#27272A]/60">
                      {displayedItems.map((item) => {
                        const availableCats = item.tipoItem === 'despesa' ? categoriasDespesa : categoriasReceita;
                        return (
                          <tr
                            key={item.id}
                            className={`transition-colors ${
                              item.isDuplicate
                                ? 'bg-amber-50/60 dark:bg-amber-950/20'
                                : !item.categoriaSugeridaConfiavel
                                ? 'bg-zinc-100/50 dark:bg-[#222226]/50'
                                : 'hover:bg-zinc-50 dark:hover:bg-[#222226]/40'
                            }`}
                          >
                            <td className="py-2.5 px-3 text-center">
                              <input
                                type="checkbox"
                                checked={item.selected}
                                onChange={() => toggleItemSelection(item.id)}
                                className="rounded text-zinc-900 focus:ring-zinc-900 dark:text-white cursor-pointer"
                              />
                            </td>
                            <td className="py-2.5 px-3 font-mono font-medium text-zinc-600 dark:text-zinc-300">
                              {new Date(item.data + 'T12:00:00').toLocaleDateString('pt-BR')}
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-zinc-800 dark:text-zinc-100">
                                  {item.descricao}
                                </span>
                                {item.tipoItem === 'despesa' ? (
                                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
                                    Saída
                                  </span>
                                ) : (
                                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                                    Entrada
                                  </span>
                                )}
                              </div>
                              {item.isDuplicate && (
                                <div className="text-[10px] font-bold text-amber-600 dark:text-amber-400 mt-0.5 flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3 shrink-0" />
                                  {item.duplicateReason || 'Possível duplicata já cadastrada'}
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="relative">
                                <select
                                  value={item.categoria}
                                  onChange={(e) => updateItemCategory(item.id, e.target.value)}
                                  className={`w-full py-1.5 px-2 rounded-xl text-xs font-bold outline-none border transition-all cursor-pointer ${
                                    !item.categoriaSugeridaConfiavel
                                      ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 ring-2 ring-amber-400/30'
                                      : 'bg-white dark:bg-[#1A1A1E] border-zinc-200/80 dark:border-[#27272A] text-zinc-800 dark:text-zinc-200'
                                  }`}
                                >
                                  {availableCats.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                  ))}
                                </select>
                                {!item.categoriaSugeridaConfiavel && (
                                  <span className="block text-[9px] font-black text-amber-600 dark:text-amber-400 mt-0.5">
                                    ⚠️ Confirmar categoria
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className={`py-2.5 px-3 text-right font-black font-mono ${
                              item.tipoItem === 'despesa' ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                            }`}>
                              {item.tipoItem === 'despesa' ? '-' : '+'} R$ {item.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <button
                                onClick={() => removeItem(item.id)}
                                className="text-zinc-400 hover:text-rose-600 p-1 rounded transition-colors"
                                title="Remover da lista de importação"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="px-4 py-3 sm:px-6 sm:py-4 border-t border-zinc-100 dark:border-[#27272A] bg-zinc-50/50 dark:bg-[#141416]/60 flex flex-col sm:flex-row justify-between items-center gap-2.5 sm:gap-3">
          <div className="text-[11px] sm:text-xs text-zinc-400 dark:text-zinc-400 text-center sm:text-left w-full sm:w-auto">
            {hasParsed ? (
              <span>
                Conta: <strong>{currentAccount?.nome}</strong> • <strong>{selectedItems.length}</strong> de {totalItems} selecionados
              </span>
            ) : (
              <span>Processamento local seguro no seu dispositivo.</span>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={onClose}
              className="flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-[#27272A] transition-colors text-center cursor-pointer"
            >
              Cancelar
            </button>

            {hasParsed && (
              <button
                disabled={selectedItems.length === 0 || isProcessing}
                onClick={handleConfirmImport}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-950 disabled:opacity-50 text-white font-bold text-xs shadow-xs transition-all cursor-pointer active:scale-95 whitespace-nowrap"
              >
                <Check className="w-4 h-4 shrink-0" />
                <span>{isProcessing ? 'Importando...' : `Lançar ${selectedItems.length} Itens`}</span>
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};
