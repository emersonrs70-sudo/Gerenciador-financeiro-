import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Upload, FileText, CheckCircle2, AlertTriangle, X, ArrowUpCircle, ArrowDownCircle,
  HelpCircle, Sparkles, Filter, Trash2, Check, RefreshCw, Layers, Loader2
} from 'lucide-react';
import { Transaction, BankAccount, safeRandomUUID, getBillMonthForDate } from '../types';
import {
  ParsedItem, parseSantanderStatement, parseOFXStatement, parseCSVStatement, checkDuplicate
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
      const fileName = (file.name || '').toLowerCase();

      // Read file to base64 using native FileReader (fast and memory-safe on mobile)
      setProcessingStatus('Preparando arquivo para análise...');
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const res = reader.result as string;
          const commaIdx = res.indexOf(',');
          resolve(commaIdx !== -1 ? res.slice(commaIdx + 1) : res);
        };
        reader.onerror = () => reject(new Error('Falha ao ler o arquivo no dispositivo.'));
        reader.readAsDataURL(file);
      });

      // Attempt 1: Server-side parser (100% reliable, avoids mobile browser sandbox limitations)
      let serverSuccess = false;
      try {
        setProcessingStatus('Processando extrato bancário no servidor...');
        const res = await fetch('/api/parse-statement', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ base64, filename: file.name })
        });

        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.items) && data.items.length > 0) {
            const itemsWithDup = data.items.map((it: any) => {
              const dup = checkDuplicate(it, existingTransactions);
              return {
                ...it,
                isDuplicate: dup.isDuplicate,
                duplicateReason: dup.reason,
                selected: !dup.isDuplicate
              };
            });
            setParsedItems(itemsWithDup);
            setHasParsed(true);
            serverSuccess = true;
          } else if (data.success && (!data.items || data.items.length === 0)) {
            // Text was extracted, but parser didn't match automatic pattern
            if (data.rawText && data.rawText.length > 10) {
              setPastedText(data.rawText);
              setActiveTab('paste');
              setErrorMessage(`O arquivo foi lido (${data.rawText.length} caracteres), mas nenhuma linha correspondeu ao formato de extrato. O texto foi carregado abaixo para você revisar.`);
              serverSuccess = true;
            }
          }
        } else {
          const errData = await res.json().catch(() => ({}));
          console.warn('Server parser returned error:', errData);
        }
      } catch (srvErr) {
        console.warn('Server parser unreachable, fallback to client:', srvErr);
      }

      if (serverSuccess) {
        return;
      }

      // Attempt 2: Client-side local parsing fallback
      const arrayBuffer = await file.arrayBuffer();
      const isPdf = fileName.endsWith('.pdf') || file.type.toLowerCase().includes('pdf') || isPdfBuffer(arrayBuffer);

      if (isPdf) {
        setProcessingStatus('Tentando leitura local do PDF...');
        const extractedText = await extractTextFromPdf(arrayBuffer);
        setProcessingStatus('Analisando transações...');
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
    } finally {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-5xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
      >
        {/* MODAL HEADER */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-150 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-600/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                Leitor Inteligente de Extratos
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                  Santander • OFX • CSV • PDF
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Importe transações reais com detecção automática de duplicadas e sugestão de categorias
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {/* CONFIGURATION & SOURCE SELECTION */}
          {!hasParsed ? (
            <div className="space-y-5">
              {/* TARGET ACCOUNT SELECTOR */}
              <div className="bg-slate-50 dark:bg-slate-950/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-purple-600" />
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Conta bancária de destino dos lançamentos:
                  </span>
                </div>
                <select
                  value={targetAccountId}
                  onChange={(e) => setTargetAccountId(e.target.value)}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-purple-500 outline-none"
                >
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.nome} ({acc.tipo === 'credito' ? 'Cartão de Crédito' : 'Conta Corrente'})
                    </option>
                  ))}
                </select>
              </div>

              {/* TABS: UPLOAD FILE vs PASTE TEXT */}
              <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                <button
                  onClick={() => setActiveTab('upload')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
                    activeTab === 'upload'
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Upload className="w-4 h-4" />
                  Upload de Arquivo (PDF, OFX, CSV)
                </button>
                <button
                  onClick={() => setActiveTab('paste')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
                    activeTab === 'paste'
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
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
                      ? 'border-purple-500 bg-purple-50/50 dark:bg-purple-950/30'
                      : 'border-slate-250 dark:border-slate-750 bg-slate-50/50 dark:bg-slate-950/30'
                  }`}
                >
                  <div className="w-16 h-16 rounded-3xl bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 mx-auto flex items-center justify-center mb-4">
                    <Upload className="w-8 h-8" />
                  </div>
                  <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-1">
                    Arraste o arquivo do extrato ou clique para selecionar
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 max-w-md mx-auto">
                    Suporta extratos em <strong>PDF Santander</strong>, arquivos bancários <strong>OFX</strong>, tabelas <strong>CSV</strong> ou arquivos de texto puro.
                  </p>

                  {isProcessing ? (
                    <div className="flex flex-col items-center justify-center gap-3 py-6 px-4 bg-purple-50/80 dark:bg-purple-950/40 rounded-2xl border border-purple-200 dark:border-purple-800">
                      <Loader2 className="w-8 h-8 text-purple-600 dark:text-purple-400 animate-spin" />
                      <p className="text-xs font-black text-purple-700 dark:text-purple-300 animate-pulse">
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
                        className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-purple-600 hover:bg-purple-700 active:scale-95 text-white font-black text-xs cursor-pointer shadow-lg shadow-purple-600/25 transition-all"
                      >
                        <FileText className="w-4 h-4" />
                        Escolher Arquivo do Celular / Computador
                      </button>
                    </div>
                  )}

                  <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800 flex justify-center">
                    <button
                      onClick={loadExampleSantander}
                      className="text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1.5"
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
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Cole aqui o texto do extrato ou da fatura bancária:
                    </label>
                    <button
                      onClick={loadExampleSantander}
                      className="text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
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
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-xs font-mono text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-purple-500 outline-none resize-y"
                  />
                  <div className="flex justify-end">
                    <button
                      disabled={!pastedText.trim() || isProcessing}
                      onClick={() => processRawText(pastedText, 'text')}
                      className="flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-black text-xs shadow-lg shadow-purple-600/20 transition-all cursor-pointer"
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
            <div className="space-y-4">
              {/* SUMMARY METRIC CARDS */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Identificados</span>
                  <span className="text-xl font-black text-slate-800 dark:text-white">
                    {totalItems} <span className="text-xs font-normal text-slate-400">({selectedItems.length} selecionados)</span>
                  </span>
                </div>

                <div className="bg-emerald-50 dark:bg-emerald-950/30 p-3.5 rounded-2xl border border-emerald-200 dark:border-emerald-800/50">
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">Total Receitas</span>
                  <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                    R$ {totalReceitas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="bg-rose-50 dark:bg-rose-950/30 p-3.5 rounded-2xl border border-rose-200 dark:border-rose-800/50">
                  <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider block">Total Despesas</span>
                  <span className="text-xl font-black text-rose-600 dark:text-rose-400">
                    R$ {totalDespesas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className={`p-3.5 rounded-2xl border ${
                  duplicateCount > 0
                    ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/50'
                    : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800'
                }`}>
                  <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">
                    Duplicatas Bloqueadas
                  </span>
                  <span className="text-xl font-black text-amber-600 dark:text-amber-400">
                    {duplicateCount} <span className="text-xs font-normal text-slate-500">desmarcadas</span>
                  </span>
                </div>
              </div>

              {/* ACTION TOOLBAR & FILTER TABS */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-50 dark:bg-slate-950/60 p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    onClick={() => setFilterMode('todos')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      filterMode === 'todos' ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-850'
                    }`}
                  >
                    Todos ({totalItems})
                  </button>
                  {duplicateCount > 0 && (
                    <button
                      onClick={() => setFilterMode('duplicatas')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                        filterMode === 'duplicatas' ? 'bg-amber-600 text-white shadow-xs' : 'text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-950'
                      }`}
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Duplicatas ({duplicateCount})
                    </button>
                  )}
                  {pendingCategoryCount > 0 && (
                    <button
                      onClick={() => setFilterMode('pendentes')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                        filterMode === 'pendentes' ? 'bg-indigo-600 text-white shadow-xs' : 'text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-950'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Definir Categoria ({pendingCategoryCount})
                    </button>
                  )}
                  <button
                    onClick={() => setFilterMode('despesas')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      filterMode === 'despesas' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-850'
                    }`}
                  >
                    Despesas
                  </button>
                  <button
                    onClick={() => setFilterMode('receitas')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      filterMode === 'receitas' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-850'
                    }`}
                  >
                    Receitas
                  </button>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    onClick={selectAllValid}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/50 transition-colors"
                  >
                    Marcar Válidas
                  </button>
                  <button
                    onClick={unselectAll}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                  >
                    Desmarcar Todas
                  </button>
                  <button
                    onClick={() => setHasParsed(false)}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors flex items-center gap-1"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Novo Arquivo
                  </button>
                </div>
              </div>

              {/* TABLE LIST OF ITEMS */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden max-h-[48vh] overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 dark:bg-slate-950 sticky top-0 z-10 text-[11px] font-black text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={selectedItems.length > 0 && selectedItems.length === parsedItems.filter(i => !i.isDuplicate).length}
                          onChange={(e) => e.target.checked ? selectAllValid() : unselectAll()}
                          className="rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
                        />
                      </th>
                      <th className="py-2.5 px-3 w-24">Data</th>
                      <th className="py-2.5 px-3">Descrição / Histórico</th>
                      <th className="py-2.5 px-3 w-48">Categoria Sugerida</th>
                      <th className="py-2.5 px-3 w-32 text-right">Valor</th>
                      <th className="py-2.5 px-3 w-10 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {displayedItems.map((item) => {
                      const availableCats = item.tipoItem === 'despesa' ? categoriasDespesa : categoriasReceita;
                      return (
                        <tr
                          key={item.id}
                          className={`transition-colors ${
                            item.isDuplicate
                              ? 'bg-amber-50/60 dark:bg-amber-950/20'
                              : !item.categoriaSugeridaConfiavel
                              ? 'bg-indigo-50/30 dark:bg-indigo-950/15'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-850/40'
                          }`}
                        >
                          <td className="py-2.5 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={item.selected}
                              onChange={() => toggleItemSelection(item.id)}
                              className="rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
                            />
                          </td>
                          <td className="py-2.5 px-3 font-mono font-medium text-slate-600 dark:text-slate-300">
                            {new Date(item.data + 'T12:00:00').toLocaleDateString('pt-BR')}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-slate-800 dark:text-slate-100">
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
                                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200'
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
                              className="text-slate-400 hover:text-rose-600 p-1 rounded transition-colors"
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
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="px-6 py-4 border-t border-slate-150 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="text-xs text-slate-500 dark:text-slate-400 text-center sm:text-left">
            {hasParsed ? (
              <span>
                Conta: <strong>{currentAccount?.nome}</strong> • {selectedItems.length} selecionados para inclusão
              </span>
            ) : (
              <span>Os dados são processados localmente no seu navegador para total segurança.</span>
            )}
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
            >
              Cancelar
            </button>

            {hasParsed && (
              <button
                disabled={selectedItems.length === 0 || isProcessing}
                onClick={handleConfirmImport}
                className="flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-black text-xs shadow-lg shadow-purple-600/20 transition-all cursor-pointer hover:scale-102"
              >
                <Check className="w-4 h-4" />
                {isProcessing ? 'Importando...' : `Confirmar e Lançar ${selectedItems.length} Movimentações`}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};
