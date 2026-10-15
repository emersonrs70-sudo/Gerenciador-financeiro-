import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Upload, FileText, CheckCircle2, AlertTriangle, X, ArrowUpCircle, ArrowDownCircle,
  HelpCircle, Sparkles, Filter, Trash2, Check, RefreshCw, Layers, Loader2
} from 'lucide-react';
import { Transaction, BankAccount, safeRandomUUID, getBillMonthForDate } from '../types';
import {
  ParsedItem, parseSantanderStatement, parseAnyBankStatement, parseOFXStatement, parseCSVStatement,
  cleanStatementIntroAndJunk
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
  const [lastExtractedText, setLastExtractedText] = useState<string>('');
  const [showExtractedPreview, setShowExtractedPreview] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cleanedInfo, setCleanedInfo] = useState<{ removedCount: number; period?: string } | null>(null);

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

    let textToProcess = text;
    if (fileType !== 'ofx' && fileType !== 'csv') {
      const cleanRes = cleanStatementIntroAndJunk(text);
      if (cleanRes.removedLinesCount > 0) {
        setCleanedInfo({
          removedCount: cleanRes.removedLinesCount,
          period: cleanRes.detectedPeriod
        });
        textToProcess = cleanRes.cleanedText.length > 20 ? cleanRes.cleanedText : text;
      }
    }

    setLastExtractedText(textToProcess);

    try {
      let items: ParsedItem[] = [];

      if (fileType === 'ofx' || textToProcess.includes('<OFX>') || textToProcess.includes('<STMTTRN>')) {
        items = parseOFXStatement(textToProcess, existingTransactions, categoriasDespesa, categoriasReceita);
      } else if (fileType === 'csv' || (textToProcess.includes(';') && textToProcess.includes('\n'))) {
        items = parseCSVStatement(textToProcess, existingTransactions, categoriasDespesa, categoriasReceita);
      } else {
        // Multi-tier parser: Santander -> Universal Brazilian Bank -> Relaxed Multi-line
        items = parseAnyBankStatement(textToProcess, existingTransactions, categoriasDespesa, categoriasReceita);
      }

      if (items.length === 0) {
        setErrorMessage('Nenhuma movimentação foi detectada automaticamente nas linhas deste documento. Você pode conferir o texto lido abaixo ou copiá-lo para a aba "Copiar e Colar".');
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
    setCleanedInfo(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const fileName = (file.name || '').toLowerCase();
      const isPdf = fileName.endsWith('.pdf') || file.type.toLowerCase().includes('pdf') || isPdfBuffer(arrayBuffer);

      if (isPdf) {
        setProcessingStatus('Extraindo páginas e excluindo dados de apresentação...');
        const extractedText = await extractTextFromPdf(arrayBuffer);
        const cleanRes = cleanStatementIntroAndJunk(extractedText);
        setCleanedInfo({
          removedCount: cleanRes.removedLinesCount,
          period: cleanRes.detectedPeriod
        });
        const finalTxt = cleanRes.cleanedText.length > 20 ? cleanRes.cleanedText : extractedText;
        setLastExtractedText(finalTxt);
        setProcessingStatus('Analisando transações e cruzando dados...');
        processRawText(finalTxt, 'pdf');
      } else if (fileName.endsWith('.ofx')) {
        setProcessingStatus('Processando arquivo bancário OFX...');
        const text = new TextDecoder('latin1').decode(arrayBuffer);
        setLastExtractedText(text);
        processRawText(text, 'ofx');
      } else if (fileName.endsWith('.csv')) {
        setProcessingStatus('Processando arquivo CSV...');
        const text = new TextDecoder('utf-8').decode(arrayBuffer);
        setLastExtractedText(text);
        processRawText(text, 'csv');
      } else {
        setProcessingStatus('Processando texto do extrato...');
        const text = new TextDecoder('utf-8').decode(arrayBuffer);
        const cleanRes = cleanStatementIntroAndJunk(text);
        setCleanedInfo({
          removedCount: cleanRes.removedLinesCount,
          period: cleanRes.detectedPeriod
        });
        const finalTxt = cleanRes.cleanedText.length > 20 ? cleanRes.cleanedText : text;
        setLastExtractedText(finalTxt);
        processRawText(finalTxt, 'text');
      }
    } catch (err: any) {
      console.error('Error reading statement file:', err);
      setErrorMessage(`Não foi possível ler o arquivo "${file.name}": ${err?.message || 'Arquivo inacessível ou formato não reconhecido'}.`);
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

  const updateItemDescription = (id: string, newDesc: string) => {
    setParsedItems(prev => prev.map(item => {
      if (item.id === id) {
        return {
          ...item,
          descricao: newDesc
        };
      }
      return item;
    }));
  };

  const updateItemCategory = (id: string, newCategory: string) => {
    setParsedItems(prev => prev.map(item => {
      if (item.id === id) {
        return {
          ...item,
          categoria: newCategory,
          categoriaSugeridaConfiavel: true, // User confirmed it!
          requerAprovacao: false
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
  const pendingReviewCount = parsedItems.filter(i => i.requerAprovacao || !i.categoriaSugeridaConfiavel).length;

  const totalReceitas = selectedItems.filter(i => i.tipoItem === 'receita').reduce((acc, curr) => acc + curr.valor, 0);
  const totalDespesas = selectedItems.filter(i => i.tipoItem === 'despesa').reduce((acc, curr) => acc + curr.valor, 0);

  // Filtered list for display
  const displayedItems = parsedItems.filter(item => {
    if (filterMode === 'duplicatas') return item.isDuplicate;
    if (filterMode === 'pendentes') return item.requerAprovacao || !item.categoriaSugeridaConfiavel;
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

  // Pre-load example text from real Santander extract (julho/2026)
  const loadExampleSantander = () => {
    const example = `Resumo - julho/2026
Conta Corrente 01.054578-9
Movimentação
Data Descrição Nº Documento Movimento (R$) Saldo (R$)
SALDO EM 30/06 1.718,18
01/07 DEBITO AUT. TELEFONE CELULAR CLARO MOVEL - 27,01-
PIX ENVIADO LIVRARIA E PAPELARIA LOIO - 4,00-
IOF IMPOSTO OPERACOES FINANCEIRAS PERIODO: 01/06 A 30/06/26 - 0,51-
IOF ADICIONAL - AUTOMATICO PERIODO: 01/06 A 30/06/26 - 16,49- 1.670,17
02/07 PIX RECEBIDO Sony Emerson Rocha dos Sa - 89,24
PIX ENVIADO Sony Emerson Rocha dos Sa - 750,00-
PIX RECEBIDO EMMANUEL R ANDRADE - 445,00
PIX RECEBIDO EMMANUEL R ANDRADE - 42,50 1.496,91
03/07 PIX ENVIADO Francisca das Chagas Sant - 890,00-
REMUNERACAO APLICACAO AUTOMATICA - 0,01 606,92
06/07 PIX ENVIADO Daniel Lucas Farrapo Lima - 5,00-
PIX ENVIADO 07 665 770 Jose Sales de - 20,00-
PIX ENVIADO Renan de Sousa Barros - 9,50-
PIX ENVIADO J I MENDES MANCO - 25,50-
PIX ENVIADO BARATAO TECNOLOGIA S A - 64,01-
PIX RECEBIDO MARIA CLAUDIA ROCHA DOS S - 200,00 682,91
07/07 PIX RECEBIDO MARIA CLAUDIA ROCHA DOS S - 1.500,00
PIX ENVIADO Sony Emerson Rocha dos Sa - 200,00-
SAQUE DINHEIRO BANCO 24H 07/07 10:43 328119 1.000,00-
SAQUE DINHEIRO BANCO 24H 07/07 10:45 503119 500,00- 482,91
08/07 PIX ENVIADO M DE JESUS MARANHAO RODRI - 63,70- 419,21
10/07 PIX RECEBIDO EMMANUEL R ANDRADE - 110,00 529,21
13/07 DEBITO VISA ELECTRON BRASIL 12/07 POSTO AVENIDA 304364 30,00-
PIX RECEBIDO SONY EMERSON ROCHA DOS SA - 4.000,00
PIX ENVIADO Sony Emerson Rocha dos Sa - 4.000,00-
PIX ENVIADO EMPREENDIMENTOS PAGUE MEN - 75,09-
PIX ENVIADO ATACADAO S A - 3,99-
DEBITO VISA ELECTRON BRASIL 13/07 JAVALI BURGUER 484464 24,47- 395,66
14/07 DEBITO VISA ELECTRON BRASIL 14/07 CaetanoJuscelino 571064 46,00- 349,66
15/07 LIQUIDO DE VENCIMENTO CNPJ 010656452000180 010715 1.910,00
PAGAMENTO DE BOLETO OUTROS BANCOS HINOVA PAY INSTITUICAO DE - 101,84-
PAGAMENTO DE BOLETO OUTROS BANCOS ENEL DISTRIBUICAO CEARA - 245,84- 1.911,98
16/07 PIX RECEBIDO A A C SAUDE MORRINHOS - 805,00
PIX ENVIADO Sony Emerson Rocha dos Sa - 1.500,00-
PIX ENVIADO Ana Sarah da Cunha Rocha - 155,00-
PIX ENVIADO OPEN FINANCE BARATAO TECNOLOGIA S A - 66,12- 995,86
17/07 PIX ENVIADO Zhao Lijun - 11,00-
PIX ENVIADO COMERCIAL DE MIUDEZAS FRE - 21,97-
PIX ENVIADO Rannielle Pereira Nascime - 10,00- 952,89
20/07 PIX ENVIADO 46 303 065 Juscelino da C - 18,00- 934,89
21/07 DEBITO VISA ELECTRON BRASIL 21/07 IFD.DOM JANSEN REST 400764 55,92- 878,97
22/07 PIX ENVIADO Claudio Inacio Silva - 25,00-
PIX ENVIADO Sony Emerson Rocha dos Sa - 500,00-
REMUNERACAO APLICACAO AUTOMATICA - 0,02 353,99
23/07 PIX RECEBIDO JEREMIAS BEZERRA SALES - 18,91
DEBITO VISA ELECTRON BRASIL 23/07 RESTAURANTE LANCHE 060464 18,00-
PIX ENVIADO OPEN FINANCE BARATAO TECNOLOGIA S A - 66,63- 288,27
24/07 DEBITO VISA ELECTRON BRASIL 24/07 RESTAURANTE LANCHE 350664 19,00- 269,27
27/07 PIX ENVIADO MWN COMERCIAL DE ALIMENTO 523383 29,13-
DEBITO VISA ELECTRON BRASIL 25/07 LOJA FISICA LJ 15 D 472164 23,60-
DEBITO VISA ELECTRON BRASIL 26/07 LOJA FISICA LJ 15 D 442764 25,16-
DEBITO VISA ELECTRON BRASIL 26/07 LOJA FISICA LJ 15 D 240364 10,29-
PIX ENVIADO Maria Juliana Araujo Paix - 20,00- 161,09
28/07 PIX ENVIADO SHPP BRASIL INSTITUICAO D - 116,39-
PIX ENVIADO Maria Elane Araujo Braga - 20,00-
PIX ENVIADO 46 303 065 Juscelino da C - 28,00- 3,30-
29/07 LIQUIDO DE VENCIMENTO CNPJ 010656452000180 010729 6.000,96
PIX ENVIADO OPEN FINANCE BARATAO TECNOLOGIA S A - 33,86-
PIX ENVIADO MASTER POSTO COMERCIO DE - 23,00-
DEBITO VISA ELECTRON BRASIL 29/07 M DE JESUS MARANH 410464 30,00- 5.910,80
30/07 LIQUIDO DE VENCIMENTO CNPJ 010656452000180 010730 2.865,71
DEBITO AUT. FATURA CARTAO VISA FINAL 0245 - 388,89-
PIX ENVIADO SHPP BRASIL INSTITUICAO D - 54,86-
PIX ENVIADO Maria Elane Araujo Braga - 50,00-
PIX ENVIADO Antonio Estenio Sousa Ara - 40,00-
PIX ENVIADO Marcio Robson Lopes - 29,50- 8.213,26
SALDO EM 31/07 8.213,26`;

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
        className="bg-white dark:bg-[#32323F] border border-zinc-200/80 dark:border-[#4C4E5D]/60 rounded-2xl sm:rounded-3xl w-full max-w-5xl shadow-2xl flex flex-col max-h-[96vh] sm:max-h-[92vh] overflow-hidden"
      >
        {/* MODAL HEADER */}
        <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b border-zinc-100 dark:border-[#4C4E5D]/60 bg-zinc-50/50 dark:bg-[#252530]/60">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-zinc-900/10 dark:bg-white/10 text-zinc-900 dark:text-white flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-zinc-700 dark:text-zinc-300" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-white tracking-tight truncate">
                  Importar Extrato Bancário
                </h2>
                <span className="text-[9px] sm:text-[11px] font-semibold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 dark:bg-[#4C4E5D] dark:text-zinc-300 whitespace-nowrap">
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
            className="p-1.5 sm:p-2 rounded-xl text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-[#4C4E5D] dark:hover:text-zinc-200 transition-colors shrink-0 ml-2 cursor-pointer"
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
              <div className="bg-zinc-50/80 dark:bg-[#252530] p-4 rounded-2xl border border-zinc-200/80 dark:border-[#4C4E5D]/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
                  <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    Conta bancária de destino dos lançamentos:
                  </span>
                </div>
                <select
                  value={targetAccountId}
                  onChange={(e) => setTargetAccountId(e.target.value)}
                  className="bg-white dark:bg-[#32323F] border border-zinc-200/80 dark:border-[#4C4E5D]/60 rounded-xl px-3 py-2 text-xs font-semibold text-zinc-800 dark:text-zinc-100 focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10 outline-none"
                >
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.nome} ({acc.tipo === 'credito' ? 'Cartão de Crédito' : 'Conta Corrente'})
                    </option>
                  ))}
                </select>
              </div>

              {/* TABS: UPLOAD FILE vs PASTE TEXT */}
              <div className="flex gap-2 border-b border-zinc-100 dark:border-[#4C4E5D]/60 pb-2">
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
                      ? 'border-zinc-900 dark:border-zinc-300 bg-zinc-50 dark:bg-[#252530]'
                      : 'border-zinc-300 dark:border-[#4C4E5D]/60 bg-zinc-50/50 dark:bg-[#252530]/40'
                  }`}
                >
                  <div className="w-16 h-16 rounded-3xl bg-zinc-100 dark:bg-[#4C4E5D] text-zinc-800 dark:text-zinc-200 mx-auto flex items-center justify-center mb-4">
                    <Upload className="w-8 h-8" />
                  </div>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 mb-1">
                    Arraste o arquivo do extrato ou clique para selecionar
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-6 max-w-md mx-auto">
                    Suporta extratos em <strong>PDF Santander</strong>, arquivos bancários <strong>OFX</strong>, tabelas <strong>CSV</strong> ou arquivos de texto puro.
                  </p>

                  {isProcessing ? (
                    <div className="flex flex-col items-center justify-center gap-3 py-6 px-4 bg-zinc-100/80 dark:bg-[#3B3B49] rounded-2xl border border-zinc-200 dark:border-[#4C4E5D]/60">
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

                  <div className="mt-8 pt-6 border-t border-zinc-200/80 dark:border-[#4C4E5D]/60 flex justify-center">
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
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                      Cole aqui o texto do extrato ou da fatura bancária:
                    </label>
                    <div className="flex items-center gap-3">
                      {pastedText.trim() && (
                        <button
                          type="button"
                          onClick={() => {
                            const res = cleanStatementIntroAndJunk(pastedText);
                            setPastedText(res.cleanedText);
                            setCleanedInfo({ removedCount: res.removedLinesCount, period: res.detectedPeriod });
                          }}
                          className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                          title="Exclui cabeçalhos, agência, conta, ouvidoria e mensagens institucionais"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          Excluir Apresentação & Cabeçalhos
                        </button>
                      )}
                      <button
                        onClick={loadExampleSantander}
                        className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        Preencher Exemplo Santander
                      </button>
                    </div>
                  </div>
                  <textarea
                    rows={10}
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value)}
                    placeholder="Exemplo:&#10;03/08 PIX RECEBIDO Francisco Edson dos Santo - 200,00&#10;PIX ENVIADO S de Lima Costa Panificad - 19,00-&#10;DEBITO AUT. TELEFONE CELULAR CLARO MOVEL - 27,01-&#10;05/08 PIX ENVIADO TOP LANCHES LTDA - 25,00-"
                    className="w-full bg-zinc-50 dark:bg-[#252530] border border-zinc-200/80 dark:border-[#4C4E5D]/60 rounded-2xl p-4 text-xs font-mono text-zinc-800 dark:text-zinc-200 focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10 outline-none resize-y"
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

              {/* ERROR ALERT & EXTRACTED TEXT INSPECTOR */}
              {errorMessage && (
                <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-200 text-xs space-y-3">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                      <div>
                        <p className="font-semibold">{errorMessage}</p>
                        {lastExtractedText && (
                          <p className="text-[11px] text-amber-700/80 dark:text-amber-300/80 mt-0.5">
                            Foram extraídos {lastExtractedText.length} caracteres do documento.
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                      {lastExtractedText && (
                        <button
                          type="button"
                          onClick={() => setShowExtractedPreview(prev => !prev)}
                          className="px-3 py-1.5 rounded-xl bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-semibold text-xs cursor-pointer transition-all"
                        >
                          {showExtractedPreview ? 'Ocultar Texto' : 'Ver Texto Lido'}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          if (lastExtractedText) {
                            setPastedText(lastExtractedText);
                          }
                          setErrorMessage(null);
                          setActiveTab('paste');
                        }}
                        className="px-3.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-950 font-bold text-xs cursor-pointer transition-all"
                      >
                        {lastExtractedText ? 'Editar Texto na Aba Colar' : 'Colar Texto do Extrato'}
                      </button>
                    </div>
                  </div>

                  {showExtractedPreview && lastExtractedText && (
                    <div className="pt-2 border-t border-amber-200/60 dark:border-amber-900/40 space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">
                        <span>Texto bruto capturado do arquivo:</span>
                        <button
                          type="button"
                          onClick={() => processRawText(lastExtractedText, 'text')}
                          className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline cursor-pointer"
                        >
                          Reprocessar no Modo Universal
                        </button>
                      </div>
                      <textarea
                        readOnly
                        value={lastExtractedText}
                        rows={6}
                        className="w-full p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-[11px] font-mono text-zinc-700 dark:text-zinc-300 select-all"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* PREVIEW AND REVISION SCREEN */
            <div className="space-y-3.5 sm:space-y-4">
              {/* CLEANED HEADER BANNER */}
              {cleanedInfo && cleanedInfo.removedCount > 0 && (
                <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-900/60 text-emerald-900 dark:text-emerald-200 text-xs">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <div className="flex-1">
                    <span className="font-bold">Apresentação institucional e cabeçalhos excluídos automaticamente: </span>
                    <span className="text-emerald-700 dark:text-emerald-300">
                      {cleanedInfo.removedCount} linhas irrelevantes foram filtradas. Somente as movimentações e transações reais foram consideradas{cleanedInfo.period ? ` (${cleanedInfo.period})` : ''}.
                    </span>
                  </div>
                </div>
              )}

              {/* SUMMARY METRIC CARDS */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
                <div className="bg-zinc-50 dark:bg-[#252530] p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border border-zinc-200/80 dark:border-[#4C4E5D]/60">
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
                    : 'bg-zinc-50 dark:bg-[#252530] border-zinc-200/80 dark:border-[#4C4E5D]/60'
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
              <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2.5 bg-zinc-50 dark:bg-[#252530] p-2.5 sm:p-3 rounded-2xl border border-zinc-200/80 dark:border-[#4C4E5D]/60">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                  <button
                    onClick={() => setFilterMode('todos')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                      filterMode === 'todos' ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 shadow-xs' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/60 dark:hover:bg-[#4C4E5D]'
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
                  {pendingReviewCount > 0 && (
                    <button
                      onClick={() => setFilterMode('pendentes')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                        filterMode === 'pendentes'
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'bg-amber-100/80 text-amber-900 dark:bg-amber-950/50 dark:text-amber-300 hover:bg-amber-200/80'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                      Requer Revisão ({pendingReviewCount})
                    </button>
                  )}
                  <button
                    onClick={() => setFilterMode('despesas')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                      filterMode === 'despesas' ? 'bg-rose-600 text-white shadow-xs' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/60 dark:hover:bg-[#4C4E5D]'
                    }`}
                  >
                    Despesas
                  </button>
                  <button
                    onClick={() => setFilterMode('receitas')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                      filterMode === 'receitas' ? 'bg-emerald-600 text-white shadow-xs' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/60 dark:hover:bg-[#4C4E5D]'
                    }`}
                  >
                    Receitas
                  </button>
                </div>

                <div className="flex items-center gap-2 justify-between sm:justify-end pt-1 sm:pt-0 border-t sm:border-t-0 border-zinc-200 dark:border-[#4C4E5D]/60">
                  <button
                    onClick={selectAllValid}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-[#4C4E5D] transition-colors cursor-pointer"
                  >
                    Marcar Válidas
                  </button>
                  <button
                    onClick={unselectAll}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold text-zinc-500 hover:bg-zinc-200/60 dark:hover:bg-[#4C4E5D] transition-colors cursor-pointer"
                  >
                    Desmarcar Todas
                  </button>
                  <button
                    onClick={() => setHasParsed(false)}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold text-zinc-500 hover:bg-zinc-200/60 dark:hover:bg-[#4C4E5D] transition-colors flex items-center gap-1 cursor-pointer"
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
                    const needsReview = item.requerAprovacao || !item.categoriaSugeridaConfiavel;

                    return (
                      <div
                        key={item.id}
                        className={`p-3 rounded-2xl border transition-all ${
                          item.selected
                            ? 'border-zinc-400 dark:border-zinc-500 bg-white dark:bg-[#32323F] shadow-xs'
                            : 'border-zinc-200/80 dark:border-[#4C4E5D]/60 bg-zinc-50/50 dark:bg-[#252530]/40 opacity-75'
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

                        {/* Description with inline editing */}
                        <div className="mt-2 pl-6.5 space-y-1.5">
                          <input
                            type="text"
                            value={item.descricao}
                            onChange={(e) => updateItemDescription(item.id, e.target.value)}
                            className="w-full bg-zinc-50 dark:bg-[#252530] border border-zinc-200 dark:border-[#4C4E5D]/60 rounded-lg px-2 py-1 text-xs font-bold text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-zinc-400"
                            placeholder="Descrição da transação"
                          />

                          {/* Approval / Uncertainty Notice */}
                          {needsReview && item.motivoDuvida && (
                            <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-[10px] font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                              <Sparkles className="w-3 h-3 shrink-0 text-amber-600 dark:text-amber-400" />
                              <span>{item.motivoDuvida}</span>
                            </div>
                          )}

                          {/* Duplicate Notice */}
                          {item.isDuplicate && (
                            <div className="p-2 rounded-xl bg-amber-100/70 dark:bg-amber-950/50 border border-amber-300/60 dark:border-amber-800 text-[10px] font-bold text-amber-800 dark:text-amber-200 flex items-start gap-1.5">
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                              <span>{item.duplicateReason || 'Possível duplicata já cadastrada'}</span>
                            </div>
                          )}

                          {/* Quick Category Suggestion Pills */}
                          {needsReview && item.sugestoesCategorias && item.sugestoesCategorias.length > 0 && (
                            <div className="pt-1 flex items-center gap-1 flex-wrap">
                              <span className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500">Sugerir:</span>
                              {item.sugestoesCategorias.map((sug) => (
                                <button
                                  key={sug}
                                  type="button"
                                  onClick={() => updateItemCategory(item.id, sug)}
                                  className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-[#4C4E5D] text-zinc-700 dark:text-zinc-300 hover:bg-zinc-900 hover:text-white dark:hover:bg-white dark:hover:text-black transition-all cursor-pointer"
                                >
                                  {sug}
                                </button>
                              ))}
                            </div>
                          )}

                          {/* Category Dropdown & Remove Button */}
                          <div className="mt-2 flex items-center justify-between gap-2 pt-1">
                            <div className="flex-1 min-w-0">
                              <select
                                value={item.categoria}
                                onChange={(e) => updateItemCategory(item.id, e.target.value)}
                                className={`w-full py-1.5 px-2 rounded-xl text-xs font-bold outline-none border transition-all cursor-pointer ${
                                  needsReview
                                    ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 ring-2 ring-amber-400/30'
                                    : 'bg-white dark:bg-[#32323F] border-zinc-200/80 dark:border-[#4C4E5D]/60 text-zinc-800 dark:text-zinc-200'
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
              <div className="hidden md:block border border-zinc-200/80 dark:border-[#4C4E5D]/60 rounded-2xl overflow-hidden max-h-[48vh] overflow-y-auto">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse min-w-[760px]">
                    <thead className="bg-zinc-100 dark:bg-[#252530] sticky top-0 z-10 text-[11px] font-black text-zinc-600 dark:text-zinc-400 border-b border-zinc-200/80 dark:border-[#4C4E5D]/60">
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
                        <th className="py-2.5 px-3 w-56">Categoria Sugerida</th>
                        <th className="py-2.5 px-3 w-32 text-right">Valor</th>
                        <th className="py-2.5 px-3 w-10 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-[#4C4E5D]/40/60">
                      {displayedItems.map((item) => {
                        const availableCats = item.tipoItem === 'despesa' ? categoriasDespesa : categoriasReceita;
                        const needsReview = item.requerAprovacao || !item.categoriaSugeridaConfiavel;

                        return (
                          <tr
                            key={item.id}
                            className={`transition-colors ${
                              item.isDuplicate
                                ? 'bg-amber-50/60 dark:bg-amber-950/20'
                                : needsReview
                                ? 'bg-amber-50/30 dark:bg-amber-950/15'
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
                                <input
                                  type="text"
                                  value={item.descricao}
                                  onChange={(e) => updateItemDescription(item.id, e.target.value)}
                                  className="font-bold text-zinc-900 dark:text-zinc-100 bg-transparent hover:bg-zinc-100 dark:hover:bg-[#4C4E5D] px-1.5 py-0.5 rounded border border-transparent hover:border-zinc-300 dark:hover:border-zinc-700 focus:bg-white dark:focus:bg-[#1A1A1E] focus:border-zinc-400 focus:outline-none flex-1 min-w-[200px]"
                                  title="Clique para editar a descrição"
                                />
                                {item.tipoItem === 'despesa' ? (
                                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 shrink-0">
                                    Saída
                                  </span>
                                ) : (
                                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 shrink-0">
                                    Entrada
                                  </span>
                                )}
                              </div>

                              {/* Uncertainty / Approval Reason Notice */}
                              {needsReview && item.motivoDuvida && (
                                <div className="text-[10px] font-bold text-amber-700 dark:text-amber-300 mt-1 flex items-center gap-1">
                                  <Sparkles className="w-3 h-3 text-amber-500 shrink-0" />
                                  <span>{item.motivoDuvida}</span>
                                </div>
                              )}

                              {item.isDuplicate && (
                                <div className="text-[10px] font-bold text-amber-600 dark:text-amber-400 mt-0.5 flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3 shrink-0" />
                                  {item.duplicateReason || 'Possível duplicata já cadastrada'}
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="space-y-1">
                                <select
                                  value={item.categoria}
                                  onChange={(e) => updateItemCategory(item.id, e.target.value)}
                                  className={`w-full py-1 px-2 rounded-xl text-xs font-bold outline-none border transition-all cursor-pointer ${
                                    needsReview
                                      ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 ring-2 ring-amber-400/30'
                                      : 'bg-white dark:bg-[#32323F] border-zinc-200/80 dark:border-[#4C4E5D]/60 text-zinc-800 dark:text-zinc-200'
                                  }`}
                                >
                                  {availableCats.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                  ))}
                                </select>

                                {/* 1-Click Suggestion Pills */}
                                {needsReview && item.sugestoesCategorias && item.sugestoesCategorias.length > 0 && (
                                  <div className="flex items-center gap-1 flex-wrap">
                                    <span className="text-[8px] font-bold text-zinc-400">Opções:</span>
                                    {item.sugestoesCategorias.map((sug) => (
                                      <button
                                        key={sug}
                                        type="button"
                                        onClick={() => updateItemCategory(item.id, sug)}
                                        className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-zinc-100 hover:bg-zinc-900 hover:text-white dark:bg-[#4C4E5D] dark:text-zinc-300 dark:hover:bg-white dark:hover:text-black transition-all cursor-pointer"
                                        title={`Definir como ${sug}`}
                                      >
                                        {sug}
                                      </button>
                                    ))}
                                  </div>
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
        <div className="px-4 py-3 sm:px-6 sm:py-4 border-t border-zinc-100 dark:border-[#4C4E5D]/60 bg-zinc-50/50 dark:bg-[#252530]/60 flex flex-col sm:flex-row justify-between items-center gap-2.5 sm:gap-3">
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
              className="flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-[#4C4E5D] transition-colors text-center cursor-pointer"
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
