// Statement parser for Brazilian bank statements (Santander, Nubank, Itaú, OFX, CSV, Text)
import { Transaction, BankAccount } from '../types';

export interface ParsedItem {
  id: string;
  data: string; // YYYY-MM-DD
  descricao: string;
  valor: number;
  tipoItem: 'despesa' | 'receita';
  categoria: string;
  categoriaSugeridaConfiavel: boolean;
  requerAprovacao?: boolean;
  motivoDuvida?: string;
  sugestoesCategorias?: string[];
  isDuplicate: boolean;
  duplicateReason?: string;
  selected: boolean;
}

// Keyword-based automatic categorization rules with Santander merchant intelligence
const CATEGORY_RULES: { category: string; keywords: string[] }[] = [
  {
    category: 'Outros',
    keywords: [
      'iof', 'imposto', 'tarifa', 'anuidade', 'encargos', 'taxa', 'cet'
    ]
  },
  {
    category: 'Alimentação',
    keywords: [
      'panificad', 'padaria', 'lanche', 'restaurante', 'potiguar', 'supermercado', 'alimento',
      'cimir', 'açougue', 'acougue', 'ifood', 'mercado', 'comercial praciano', 'comercial de alimento',
      'mwn comercial', 'top lanches', 'javali burguer', 'dom jansen', 'ifd.', 'churrascaria',
      'pizzaria', 'hamburguer', 'burger', 'cafe', 'hortifruti', 'atacadão', 'atacadao', 'assaí', 'assai'
    ]
  },
  {
    category: 'Transporte',
    keywords: [
      'car petroleo', 'rede l car', 'l car', 'combustivel', 'gasolina', 'etanol',
      'uber', '99app', '99 app', 'estacionamento', 'protecao veicular', 'eleven protecao',
      'auto posto', 'rezende', 'posto luar', 'posto avenida', 'master posto', 'lubrific',
      'oficina', 'mecanica', 'pedagio', 'sem parar', 'veicular', 'posto '
    ]
  },
  {
    category: 'Moradia',
    keywords: [
      'claro', 'claro movel', 'telefone celular', 'vivo', 'tim', 'oi', 'enel', 'energia', 'luz',
      'cagece', 'sabesp', 'agua', 'aluguel', 'condominio', 'iptu', 'internet', 'fibra'
    ]
  },
  {
    category: 'Saúde',
    keywords: [
      'saude', 'aac saude', 'farmacia', 'drogaria', 'pague menos', 'pague men', 'drogasil', 'droga raia',
      'medico', 'clinica', 'laboratorio', 'hospital', 'dentista', 'odont', 'exame', 'consulta'
    ]
  },
  {
    category: 'Lazer',
    keywords: [
      'multicine', 'cinema', 'cinemark', 'cinepolis', 'livraria', 'papelaria', 'loio', 'show',
      'teatro', 'netflix', 'spotify', 'prime video', 'disney', 'ingresso', 'viagem', 'hotel',
      'airbnb', 'shpp brasil', 'shopee', 'baratao tecnologia'
    ]
  },
  {
    category: 'Educação',
    keywords: [
      'escola', 'faculdade', 'universidade', 'curso', 'udemy', 'alura', 'livro', 'mensalidade', 'colegio'
    ]
  },
  {
    category: 'Salário',
    keywords: [
      'liquido de vencimento', 'salario', 'salário', 'provento', 'remuneracao', 'folha de pagamento',
      'admissao', 'rescisao', '13o salario', 'adiantamento salarial'
    ]
  },
  {
    category: 'Pagamento de Fatura',
    keywords: [
      'debito aut. fatura cartao', 'fatura cartao', 'pagamento fatura', 'cartao credito',
      'pgto cartao', 'debito fatura', 'cartao visa'
    ]
  },
  {
    category: 'Investimentos',
    keywords: [
      'remuneracao aplicacao automatica', 'aplicacao automatica', 'rendimento', 'cdi', 'poupanca', 'tesouro'
    ]
  }
];

export function guessCategory(descricao: string, tipoItem: 'despesa' | 'receita', availableCategories: string[]): {
  categoria: string;
  confiavel: boolean;
  requerAprovacao: boolean;
  motivoDuvida?: string;
  sugestoesCategorias?: string[];
} {
  const lower = descricao.toLowerCase();

  // 1. Check for specific keywords
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some(k => lower.includes(k))) {
      const matched = availableCategories.find(c => c.toLowerCase() === rule.category.toLowerCase());
      const cat = matched || rule.category;
      return {
        categoria: cat,
        confiavel: true,
        requerAprovacao: false
      };
    }
  }

  // 2. Specific case: Transfer to own name / titularity
  if (lower.includes('sony emerson') || lower.includes('emerson rocha') || lower.includes('mesma titularidade')) {
    const defaultCat = availableCategories.find(c => c.toLowerCase().includes('outros')) || availableCategories[0] || 'Outros';
    return {
      categoria: defaultCat,
      confiavel: false,
      requerAprovacao: true,
      motivoDuvida: 'Transferência para conta pessoal - confirme a finalidade',
      sugestoesCategorias: ['Outros', 'Investimentos', 'Moradia'].filter(c => availableCategories.includes(c))
    };
  }

  // 3. ATM Cash withdrawals
  if (lower.includes('saque') || lower.includes('banco 24h')) {
    const defaultCat = availableCategories.find(c => c.toLowerCase().includes('outros')) || availableCategories[0] || 'Outros';
    return {
      categoria: defaultCat,
      confiavel: false,
      requerAprovacao: true,
      motivoDuvida: 'Saque em espécie - selecione onde o dinheiro foi utilizado',
      sugestoesCategorias: ['Alimentação', 'Transporte', 'Lazer', 'Outros'].filter(c => availableCategories.includes(c))
    };
  }

  // 4. Generic debit or physical store without clear category
  if (lower.includes('loja fisica') || lower.includes('miudezas') || lower.includes('hinova pay')) {
    const defaultCat = availableCategories.find(c => c.toLowerCase().includes('outros')) || availableCategories[0] || 'Outros';
    return {
      categoria: defaultCat,
      confiavel: false,
      requerAprovacao: true,
      motivoDuvida: 'Estabelecimento com descrição genérica - selecione a categoria correta',
      sugestoesCategorias: ['Alimentação', 'Transporte', 'Lazer', 'Moradia', 'Outros'].filter(c => availableCategories.includes(c))
    };
  }

  // 5. If it's a salary-like credit
  if (tipoItem === 'receita') {
    const salaryCat = availableCategories.find(c => c.toLowerCase().includes('salário') || c.toLowerCase().includes('salario'));
    if (salaryCat && (lower.includes('vencimento') || lower.includes('empresa') || lower.includes('remunera') || lower.includes('folha'))) {
      return { categoria: salaryCat, confiavel: true, requerAprovacao: false };
    }
    const otherRec = availableCategories.find(c => c.toLowerCase().includes('outras') || c.toLowerCase().includes('renda extra')) || availableCategories[0] || 'Outras Receitas';
    return {
      categoria: otherRec,
      confiavel: false,
      requerAprovacao: true,
      motivoDuvida: 'Receita identificada - confirme a origem',
      sugestoesCategorias: availableCategories.slice(0, 3)
    };
  }

  // 6. Generic PIX sent to unknown individual or entity
  if (lower.includes('pix enviado') || lower.includes('transferencia')) {
    const defaultCat = availableCategories.find(c => c.toLowerCase().includes('outros')) || availableCategories[0] || 'Outros';
    return {
      categoria: defaultCat,
      confiavel: false,
      requerAprovacao: true,
      motivoDuvida: 'PIX sem categoria evidente - selecione a categoria adequada',
      sugestoesCategorias: ['Alimentação', 'Transporte', 'Lazer', 'Moradia', 'Outros'].filter(c => availableCategories.includes(c))
    };
  }

  // Fallback for expenses: Not confident, requires user review
  const defaultCat = availableCategories.find(c => c.toLowerCase().includes('outros') || c.toLowerCase().includes('geral')) || availableCategories[0] || 'Outros';
  return {
    categoria: defaultCat,
    confiavel: false,
    requerAprovacao: true,
    motivoDuvida: 'Classificação automática incerta - favor revisar',
    sugestoesCategorias: ['Alimentação', 'Transporte', 'Lazer', 'Moradia', 'Outros'].filter(c => availableCategories.includes(c))
  };
}

// Anti-duplication check against existing transactions
export function checkDuplicate(
  item: { data: string; descricao: string; valor: number; tipoItem: 'despesa' | 'receita' },
  existingTransactions: Transaction[]
): { isDuplicate: boolean; reason?: string } {
  const itemDate = new Date(item.data + 'T12:00:00').getTime();
  const itemDescLower = item.descricao.toLowerCase().replace(/[^a-z0-9]/g, '');

  for (const t of existingTransactions) {
    // 1. Same amount (allowing 0.02 float diff)
    const sameAmount = Math.abs(t.valor - item.valor) < 0.02;
    if (!sameAmount) continue;

    // 2. Same transaction type (expense vs income)
    if (t.tipoItem !== item.tipoItem) continue;

    // 3. Date proximity (within +/- 2 days)
    const tDate = new Date(t.data + 'T12:00:00').getTime();
    const diffDays = Math.abs(itemDate - tDate) / (1000 * 60 * 60 * 24);
    if (diffDays > 2) continue;

    // 4. Description similarity
    const tDescLower = t.descricao.toLowerCase().replace(/[^a-z0-9]/g, '');
    const directMatch = tDescLower.includes(itemDescLower) || itemDescLower.includes(tDescLower);

    // Common words overlap
    const itemWords = item.descricao.toLowerCase().split(/\s+/).filter(w => w.length > 3 && !['enviado', 'recebido', 'internet', 'banking'].includes(w));
    const tWords = t.descricao.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const hasSharedWord = itemWords.some(w => tWords.includes(w));

    if (directMatch || hasSharedWord || (diffDays === 0 && itemWords.length === 0)) {
      const formattedDate = new Date(t.data + 'T12:00:00').toLocaleDateString('pt-BR');
      return {
        isDuplicate: true,
        reason: `Lançamento similar encontrado em ${formattedDate}: "${t.descricao}" (R$ ${t.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`
      };
    }
  }

  return { isDuplicate: false };
}

// Convert Brazilian currency string like "200,00-", "- 200,00-", "1.500,00-", "200,00", "5.877,98", "50,00 D", "89,24 C"
export function parseBRLAmount(rawVal: string): { valor: number; isNegative: boolean } | null {
  const cleaned = rawVal.trim().replace(/\s/g, '');
  if (!cleaned) return null;

  // Negative indicators: leading/trailing minus, D/d suffix, or parentheses
  const isNegative = cleaned.endsWith('-') || cleaned.startsWith('-') || /[dD]$/.test(cleaned) || /^\(.*\)$/.test(cleaned);
  const numOnly = cleaned.replace(/[^\d,]/g, '').replace(',', '.');
  const val = parseFloat(numOnly);

  if (isNaN(val) || val <= 0) return null;
  return { valor: val, isNegative };
}

// Clean and humanize Brazilian/Santander descriptions
export function cleanBankDescription(desc: string): string {
  return desc
    // Debit card purchases
    .replace(/^DEBITO VISA ELECTRON BRASIL(?:\s+\d{2}\/\d{2})?\s*-?\s*/i, 'Cartão Débito: ')
    .replace(/^COMPRA CART[ÃA]O D[ÉE]BITO(?:\s+\d{2}\/\d{2})?\s*-?\s*/i, 'Cartão Débito: ')
    // Auto debits
    .replace(/^DEBITO AUT\.\s+TELEFONE CELULAR\s*-?\s*/i, 'Débito Automático: ')
    .replace(/^D[ÉE]BITO AUTOM[ÁA]TICO\s*-?\s*/i, 'Débito Automático: ')
    // Card invoice debits
    .replace(/^DEBITO AUT\.\s+FATURA CARTAO VISA\s*(?:FINAL\s*(\d+))?/i, (_, finalDig) => finalDig ? `Fatura Cartão: VISA Final ${finalDig}` : 'Fatura Cartão: VISA')
    .replace(/^PAGTO FATURA CARTAO\s*-?\s*/i, 'Fatura Cartão: ')
    // Boletos
    .replace(/^PAGAMENTO DE BOLETO OUTROS BANCOS\s*-?\s*/i, 'Boleto: ')
    .replace(/^PAGAMENTO DE BOLETO\s*-?\s*/i, 'Boleto: ')
    .replace(/^PAGTO COBRANCA\s*-?\s*/i, 'Boleto: ')
    // Salary
    .replace(/^LIQUIDO DE VENCIMENTO(?:\s+CNPJ\s+\d+)?/i, 'Salário: Vencimento Folha')
    // Automatic investment yield
    .replace(/^REMUNERACAO APLICACAO AUTOMATICA/i, 'Rendimento: Aplicação Automática')
    .replace(/^RENDIMENTO APLIC\w*/i, 'Rendimento: Aplicação Automática')
    // ATM withdrawals
    .replace(/^SAQUE DINHEIRO BANCO 24H(?:\s+\d{2}\/\d{2}\s+\d{2}:\d{2})?/i, 'Saque Banco 24H')
    .replace(/^SAQUE TERMINAL BANCO 24H/i, 'Saque Banco 24H')
    // IOF taxes
    .replace(/^IOF IMPOSTO OPERACOES FINANCEIRAS.*/i, 'IOF Imposto Operações Financeiras')
    .replace(/^IOF ADICIONAL\s*-\s*AUTOMATICO.*/i, 'IOF Adicional Automático')
    // PIX Cleanups
    .replace(/^PIX ENVIADO OPEN FINANCE\s*-?\s*/i, 'PIX Enviado: ')
    .replace(/^PIX ENVIADO\s*-?\s*/i, 'PIX Enviado: ')
    .replace(/^PIX RECEBIDO\s*-?\s*/i, 'PIX Recebido: ')
    .replace(/^TRANSF\.?\s*PIX\s*-?\s*/i, 'PIX: ')
    // Shopee / popular merchants
    .replace(/SHPP BRASIL INSTITUICAO D.*/i, 'SHPP BRASIL (Shopee)')
    // General punctuation and space cleanup
    .replace(/:\s*:/g, ':')
    .replace(/^[-–\s:]+|[-–\s:]+$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// Result of cleaning introductory presentation and junk from statement text
export interface CleanStatementResult {
  cleanedText: string;
  removedLinesCount: number;
  detectedPeriod?: string;
}

/**
 * Intelligent cleaner that identifies where real transactions begin in Brazilian bank statements
 * and strips away document presentations, corporate headers, branch addresses, customer metadata,
 * marketing banners, and legal ombudsman footers.
 */
export function cleanStatementIntroAndJunk(rawText: string): CleanStatementResult {
  if (!rawText || !rawText.trim()) {
    return { cleanedText: '', removedLinesCount: 0 };
  }

  const lines = rawText.split(/\r?\n/);

  // 1. Detect month / year reference before stripping (e.g. "julho/2026", "julho de 2026", "07/2026", "08/2026")
  let detectedPeriod: string | undefined = undefined;
  const periodMatch = rawText.match(/(janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)[\/\s]+(20\d{2})/i)
    || rawText.match(/(janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+de\s+(20\d{2})/i)
    || rawText.match(/\b(0[1-9]|1[0-2])\/(20\d{2})\b/)
    || rawText.match(/\b(0[1-9]|1[0-2])\/(2[4-9])\b/);

  if (periodMatch) {
    detectedPeriod = periodMatch[0].trim();
  }

  // 2. Identify where transaction movements actually start
  // In Brazilian statements, transactions start after:
  // - "Movimentação" / "Lançamentos" / "Extrato de Conta"
  // - Table column header like "Data Descrição ... Movimento Saldo"
  // - "SALDO EM DD/MM" (opening balance)
  // - Or the first line that directly has DD/MM date with transaction text and currency
  const sectionStartRegex = /^(?:MOVIMENTA[CÇ][AÃ]O|MOVIMENTA[CÇ][OÕ]ES|LAN[CÇ]AMENTOS|HIST[OÓ]RICO|EXTRATO\s+DE\s+CONTA)/i;
  const tableHeaderRegex = /^(?:DATA\s+(?:DESCRI[CÇ][AÃ]O|HIST[OÓ]RICO|DOCTO|DOCUMENTO|LAN[CÇ]AMENTO))/i;
  const initialBalanceRegex = /^SALDO\s+EM\s+\d{2}\/\d{2}/i;
  const directTxRegex = /^\d{2}\/\d{2}(?:\/\d{2,4})?\s+[A-Za-z]/;

  let startIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;

    if (sectionStartRegex.test(trimmed)) {
      startIndex = i;
      break;
    }
    if (tableHeaderRegex.test(trimmed)) {
      startIndex = i;
      break;
    }
    if (initialBalanceRegex.test(trimmed)) {
      startIndex = i;
      break;
    }
    if (directTxRegex.test(trimmed) && /\d{1,3}(?:\.\d{3})*,\d{2}/.test(trimmed)) {
      startIndex = i;
      break;
    }
  }

  const candidateLines = startIndex !== -1 ? lines.slice(startIndex) : lines;
  const initialRemovedCount = startIndex !== -1 ? startIndex : 0;

  // Filter out any repeated header/presentation junk lines from the remaining text
  const isJunkOrPresentation = (l: string): boolean => {
    const t = l.trim().toUpperCase();
    if (!t) return false;

    if (t.startsWith('--- NOVA PAGINA') || t.startsWith('PAGINA:') || t.startsWith('PÁGINA:')) return true;
    if (/^P[AÁ]GINA\s+\d+\s+DE\s+\d+/i.test(t)) return true;

    if (t.includes('BANCO SANTANDER') || t.includes('BANCO BRADESCO') || t.includes('BANCO DO BRASIL') || t.includes('ITAU UNIBANCO')) return true;
    if (t.includes('PRESIDENTE JUSCELINO KUBITSCHEK') || t.includes('CIDADE DE DEUS') || t.includes('AV. PAULISTA')) return true;
    if (t.startsWith('CNPJ:') || t.startsWith('CPF:') || t.startsWith('AGÊNCIA:') || t.startsWith('AGENCIA:')) return true;
    if (t.startsWith('TITULAR:') || t.startsWith('NOME:') || t.startsWith('ENDEREÇO:') || t.startsWith('ENDERECO:')) return true;
    if (t.startsWith('CONTA CORRENTE:') || t.startsWith('CONTA:') || t.startsWith('TIPO DE CONTA:')) return true;

    if (t.startsWith('FALE CONOSCO') || t.startsWith('SAC ') || t.startsWith('OUVIDORIA')) return true;
    if (t.startsWith('CENTRAL DE ATENDIMENTO') || t.startsWith('CANAIS DIGITAIS')) return true;
    if (t.startsWith('PACOTE DE SERVIÇOS') || t.startsWith('PACOTE DE SERVICOS')) return true;
    if (t.startsWith('ÍNDICES ECONÔMICOS') || t.startsWith('INDICES ECONOMICOS')) return true;
    if (t.startsWith('PROTEJA-SE') || t.startsWith('DISPONÍVEL NO INTERNET BANKING') || t.startsWith('DISPONIVEL NO INTERNET BANKING')) return true;
    if (t.startsWith('SE VOCÊ NÃO TEM LIMITE') || t.startsWith('SE VOCE NAO TEM LIMITE')) return true;
    if (t.startsWith('BALP_UY_') || t.startsWith('EXTRATO_PF_')) return true;
    if (t.startsWith('RESUMO DE APLICAÇÕES') || t.startsWith('RESUMO DE APLICACOES')) return true;
    if (t.startsWith('SALDOS POR PERÍODO') || t.startsWith('SALDOS POR PERIODO')) return true;
    if (t.startsWith('TOTAL DE CRÉDITOS') || t.startsWith('TOTAL DE DÉBITOS') || t.startsWith('TOTAL DE CREDITO')) return true;
    if (t.startsWith('LIMITE SANTANDER') || t.startsWith('PROVISÃO DE ENCARGOS') || t.startsWith('PROVISAO DE ENCARGOS')) return true;
    if (t.startsWith('DATA DE EMISSÃO') || t.startsWith('DATA DE EMISSAO') || t.startsWith('EMISSÃO:') || t.startsWith('EMISSAO:')) return true;
    if (t.startsWith('EXTRATO REFERENTE') || t.startsWith('RESUMO DA CONTA') || t.startsWith('RESUMO -')) return true;

    // Discard column headers if repeated
    if (/^DATA\s+(?:DESCRI[CÇ][AÃ]O|HIST[OÓ]RICO).*?(?:VALOR|MOVIMENTO|SALDO)/i.test(t)) return true;
    if (/^MOVIMENTA[CÇ][AÃ]O$/i.test(t) || /^LAN[CÇ]AMENTOS$/i.test(t)) return true;

    return false;
  };

  const finalLines: string[] = [];
  let otherRemovedCount = 0;

  for (const line of candidateLines) {
    if (isJunkOrPresentation(line)) {
      otherRemovedCount++;
    } else {
      finalLines.push(line);
    }
  }

  // Prepend period indicator so month / year is always preserved for the parser
  const periodHeader = detectedPeriod ? `Período: ${detectedPeriod}\n` : '';
  const cleanedText = periodHeader + finalLines.join('\n').trim();

  return {
    cleanedText,
    removedLinesCount: initialRemovedCount + otherRemovedCount,
    detectedPeriod
  };
}

// Specialized Santander statement text & PDF parser
export function parseSantanderStatement(
  text: string,
  existingTransactions: Transaction[] = [],
  categoriesDespesa: string[] = ['Alimentação', 'Transporte', 'Moradia', 'Saúde', 'Lazer', 'Outros'],
  categoriesReceita: string[] = ['Salário', 'Outras Receitas']
): ParsedItem[] {
  // 1. Detect Year and Month from statement text (e.g. "julho/2026", "agosto/2026", "08/2026", "julho de 2026")
  let referenceYear = new Date().getFullYear();
  let referenceMonth = new Date().getMonth() + 1; // 1-12

  const monthNames = [
    'janeiro', 'fevereiro', 'março', 'marco', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
  ];

  const monthYearMatch = text.match(/(janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)[\/\s]+(20\d{2})/i)
    || text.match(/(janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+de\s+(20\d{2})/i)
    || text.match(/\b(0[1-9]|1[0-2])\/(20\d{2})\b/)
    || text.match(/\d{2}\/(0[1-9]|1[0-2])\/(20\d{2})/);

  if (monthYearMatch) {
    if (isNaN(Number(monthYearMatch[1]))) {
      const idx = monthNames.findIndex(m => m === monthYearMatch[1].toLowerCase());
      if (idx !== -1) {
        referenceMonth = (idx % 12) + 1;
        referenceYear = parseInt(monthYearMatch[2], 10);
      }
    } else {
      referenceMonth = parseInt(monthYearMatch[1], 10);
      referenceYear = parseInt(monthYearMatch[2] || monthYearMatch[3], 10);
    }
  }

  // Helper to format ISO date
  const formatIsoDate = (day: string, month: string, customYear?: number) => {
    const d = day.padStart(2, '0');
    const m = (month || String(referenceMonth)).padStart(2, '0');
    const y = customYear || referenceYear;
    return `${y}-${m}-${d}`;
  };

  const rawLines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const items: ParsedItem[] = [];

  let currentDay = '01';
  let currentMonthStr = String(referenceMonth).padStart(2, '0');
  let currentYearVal = referenceYear;

  // Skip Santander headers, metadata, footers and summary lines
  const isJunkLine = (l: string) => {
    const upper = l.toUpperCase();
    return (
      upper.startsWith('PERÍODO') ||
      upper.startsWith('PERIODO') ||
      upper.startsWith('REFERÊNCIA') ||
      upper.startsWith('REFERENCIA') ||
      upper.startsWith('DATA DE EMISSÃO') ||
      upper.startsWith('DATA DE EMISSAO') ||
      upper.startsWith('EMISSÃO:') ||
      upper.startsWith('EMISSAO:') ||
      upper.startsWith('ENDEREÇO') ||
      upper.startsWith('ENDERECO') ||
      upper.includes('JUSCELINO KUBITSCHEK') ||
      upper.includes('CIDADE DE DEUS') ||
      upper.includes('BANCO SANTANDER') ||
      upper.includes('BANCO BRADESCO') ||
      upper.includes('BANCO DO BRASIL') ||
      upper.includes('ITAU UNIBANCO') ||
      upper.startsWith('EXTRATO CONSOLIDADO') ||
      upper.startsWith('EXTRATO DE CONTA') ||
      upper.startsWith('EXTRATO CONTA') ||
      upper.startsWith('PAGINA:') ||
      upper.startsWith('PÁGINA:') ||
      upper.startsWith('--- NOVA PAGINA') ||
      upper.startsWith('FALE CONOSCO') ||
      upper.startsWith('PROTEJA-SE') ||
      upper.startsWith('BALP_UY_') ||
      upper.startsWith('EXTRATO_PF_') ||
      upper.startsWith('RESUMO -') ||
      upper.startsWith('RESUMO DA CONTA') ||
      upper.startsWith('DATA DESCRIÇÃO') ||
      upper.startsWith('DATA HISTÓRICO') ||
      upper.startsWith('DATA DOCTO') ||
      upper.startsWith('MOVIMENTAÇÃO') ||
      upper.startsWith('MOVIMENTACAO') ||
      upper.startsWith('CONTA CORRENTE') ||
      upper.startsWith('AGÊNCIA:') ||
      upper.startsWith('AGENCIA:') ||
      upper.startsWith('CONTA:') ||
      upper.startsWith('TITULAR:') ||
      upper.startsWith('NOME:') ||
      upper.startsWith('CPF:') ||
      upper.startsWith('CNPJ:') ||
      upper.startsWith('SALDO ') ||
      upper.startsWith('SALDO:') ||
      upper.startsWith('SALDO DE CONTA') ||
      upper.includes('SALDO ANTERIOR') ||
      upper.includes('SALDO ATUAL') ||
      upper.includes('SALDO FINAL') ||
      upper.includes('SALDO BLOQUEADO') ||
      upper.includes('SALDO DISPON') ||
      upper.startsWith('TOTAL DE CRÉDITOS') ||
      upper.startsWith('TOTAL DE CRÉDITO') ||
      upper.startsWith('TOTAL DE DÉBITOS') ||
      upper.startsWith('TOTAL DE DEBITOS') ||
      upper.startsWith('LIMITE SANTANDER') ||
      upper.startsWith('PROVISÃO DE ENCARGOS') ||
      upper.startsWith('PROVISAO DE ENCARGOS') ||
      upper.startsWith('SE VOCÊ NÃO TEM LIMITE') ||
      upper.startsWith('SALDOS POR PERÍODO') ||
      upper.startsWith('SALDOS POR PERIODO') ||
      upper.startsWith('RESUMO DE APLICAÇÕES') ||
      upper.startsWith('RESUMO DE APLICACOES') ||
      upper.startsWith('ÍNDICES ECONÔMICOS') ||
      upper.startsWith('INDICES ECONOMICOS') ||
      upper.startsWith('PACOTE DE SERVIÇOS') ||
      upper.startsWith('PACOTE DE SERVICOS') ||
      upper.startsWith('OUVIDORIA SANTANDER') ||
      upper.startsWith('CENTRAL DE ATENDIMENTO') ||
      upper.startsWith('SAC SANTANDER') ||
      upper.includes('DISPONÍVEL NO INTERNET BANKING')
    );
  };

  // Currency matching regex: matches "- 27,01-", "27,01-", "1.910,00", "89,24", "50,00 D", "R$ 50,00", etc.
  const currencyTokenRegex = /-?\s*R?\$?\s*\d{1,3}(?:\.\d{3})*,\d{2}\s*[-–]?(?:\s*[DDCc])?/g;

  let bufferedPrefix = '';

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];

    if (isJunkLine(line)) {
      continue;
    }

    // Check if line contains a transaction date (e.g., "01/07", "01/07/2026", "01/07/26")
    const dateMatch = line.match(/\b(\d{2})\/(\d{2})(?:\/(\d{2,4}))?\b/);
    if (dateMatch) {
      currentDay = dateMatch[1];
      currentMonthStr = dateMatch[2];
      if (dateMatch[3]) {
        currentYearVal = dateMatch[3].length === 2 ? parseInt(`20${dateMatch[3]}`, 10) : parseInt(dateMatch[3], 10);
      }
    }

    // Check if line contains currency amounts
    const currencyMatches = line.match(currencyTokenRegex);

    if (!currencyMatches || currencyMatches.length === 0) {
      // Line might be the description part of a wrapped multi-line transaction
      if (
        !line.toUpperCase().includes('SALDO') &&
        !line.match(/^\d+$/) &&
        line.length > 2 &&
        line.length < 80 &&
        !isJunkLine(line)
      ) {
        // Strip date from prefix if present
        let cleanLinePart = line;
        if (dateMatch) {
          cleanLinePart = cleanLinePart.replace(dateMatch[0], '').trim();
        }
        if (cleanLinePart.length > 1 && !isJunkLine(cleanLinePart)) {
          // Do not accumulate endless lines - retain only the immediate merchant name part
          bufferedPrefix = cleanLinePart;
        }
      }
      continue;
    }

    // In Santander Movimentação:
    // If there are 2 or more currency tokens on the line:
    // Token 0 is ALWAYS Movimento (R$)
    // Token 1 is ALWAYS Saldo (R$) (running balance)
    // If there is only 1 currency token:
    // Token 0 is Movimento (R$)
    const rawMovimentoToken = currencyMatches[0];
    const parsedVal = parseBRLAmount(rawMovimentoToken);

    if (!parsedVal || parsedVal.valor === 0) {
      bufferedPrefix = '';
      continue;
    }

    // Extract text before rawMovimentoToken
    const tokenIndex = line.indexOf(rawMovimentoToken);
    let descPart = tokenIndex !== -1 ? line.substring(0, tokenIndex) : line;

    // Strip leading date if present (including full YYYY or YY)
    descPart = descPart.replace(/^\s*\d{2}\/\d{2}(?:\/\d{2,4})?\s*/, '');

    // Strip internal transaction date if still present at the start of merchant
    descPart = descPart.replace(/\b\d{2}\/\d{2}(?:\/\d{2,4})?\b/, ' ');

    // Strip document number (like "328119", "010715", "484464" or "-") at the end of descPart
    descPart = descPart.replace(/\s+(?:\d{4,8}|-)\s*$/, '').trim();

    // If there was a buffered prefix from the previous line, combine
    let fullDesc = (bufferedPrefix ? `${bufferedPrefix} ${descPart}` : descPart).trim();
    bufferedPrefix = ''; // reset buffer

    // Skip empty descriptions or running balance rows
    if (!fullDesc || fullDesc.toUpperCase().includes('SALDO EM') || /^[0-9\s\.\-]+$/.test(fullDesc)) {
      continue;
    }

    // Humanize and clean Santander patterns
    const cleanDesc = cleanBankDescription(fullDesc);

    // Determine type: expense vs income
    let tipoItem: 'despesa' | 'receita' = parsedVal.isNegative ? 'despesa' : 'receita';
    const lower = cleanDesc.toLowerCase();

    if (
      lower.includes('pix recebido') ||
      lower.includes('salário') ||
      lower.includes('salario') ||
      lower.includes('rendimento: aplicação') ||
      lower.includes('remuneração aplicação') ||
      lower.includes('provento')
    ) {
      tipoItem = 'receita';
    } else if (
      parsedVal.isNegative ||
      lower.includes('pix enviado') ||
      lower.includes('cartão débito') ||
      lower.includes('cartao debito') ||
      lower.includes('débito') ||
      lower.includes('debito') ||
      lower.includes('saque') ||
      lower.includes('boleto') ||
      lower.includes('fatura') ||
      lower.includes('iof') ||
      lower.includes('tarifa')
    ) {
      tipoItem = 'despesa';
    }

    const availableCats = tipoItem === 'despesa' ? categoriesDespesa : categoriesReceita;
    const categoryResult = guessCategory(cleanDesc, tipoItem, availableCats);

    const isoDate = formatIsoDate(currentDay, currentMonthStr, currentYearVal);
    const dupCheck = checkDuplicate(
      { data: isoDate, descricao: cleanDesc, valor: parsedVal.valor, tipoItem },
      existingTransactions
    );

    items.push({
      id: `santander-${Date.now()}-${items.length}-${Math.random().toString(36).substring(2, 6)}`,
      data: isoDate,
      descricao: cleanDesc,
      valor: parsedVal.valor,
      tipoItem,
      categoria: categoryResult.categoria,
      categoriaSugeridaConfiavel: categoryResult.confiavel,
      requerAprovacao: categoryResult.requerAprovacao,
      motivoDuvida: categoryResult.motivoDuvida,
      sugestoesCategorias: categoryResult.sugestoesCategorias,
      isDuplicate: dupCheck.isDuplicate,
      duplicateReason: dupCheck.reason,
      selected: !dupCheck.isDuplicate
    });
  }

  // De-duplicate within the statement itself
  const finalItems: ParsedItem[] = [];
  const seenKeys = new Set<string>();

  for (const item of items) {
    const key = `${item.data}_${item.valor}_${item.tipoItem}_${item.descricao.toLowerCase().trim()}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      finalItems.push(item);
    }
  }

  return finalItems;
}

// Universal Brazilian Bank Statement Parser (Tier 2 Fallback)
// Handles any Brazilian bank format (Nubank, Itaú, Bradesco, Inter, Caixa, BB, Santander, C6, etc.)
export function parseUniversalBankStatement(
  text: string,
  existingTransactions: Transaction[] = [],
  categoriesDespesa: string[] = ['Alimentação', 'Transporte', 'Moradia', 'Saúde', 'Lazer', 'Outros'],
  categoriesReceita: string[] = ['Salário', 'Outras Receitas']
): ParsedItem[] {
  let referenceYear = new Date().getFullYear();
  let referenceMonth = new Date().getMonth() + 1;

  const yearMatch = text.match(/\b(202[4-9])\b/);
  if (yearMatch) referenceYear = parseInt(yearMatch[1], 10);

  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const items: ParsedItem[] = [];

  let currentIsoDate = `${referenceYear}-${String(referenceMonth).padStart(2, '0')}-01`;

  const currencyRegex = /-?\s*R?\$?\s*(\d{1,3}(?:\.\d{3})*,\d{2})\s*[-–]?(?:\s*[DDCc])?/g;

  for (const line of lines) {
    const upper = line.toUpperCase();

    // Skip summary lines
    if (
      upper.startsWith('SALDO') ||
      upper.includes('SALDO ANTERIOR') ||
      upper.includes('SALDO ATUAL') ||
      upper.includes('SALDO DISPONIVEL') ||
      upper.includes('TOTAL DE') ||
      upper.includes('EXTRATO DE') ||
      upper.includes('PÁGINA') ||
      upper.includes('PAGINA')
    ) {
      continue;
    }

    // Date search on line: DD/MM/YYYY, DD/MM/YY, or DD/MM
    const fullDateMatch = line.match(/\b(\d{2})\/(\d{2})\/(20\d{2})\b/);
    const shortYearDateMatch = line.match(/\b(\d{2})\/(\d{2})\/(\d{2})\b/);
    const dayMonthMatch = line.match(/\b(\d{2})\/(\d{2})\b/);

    if (fullDateMatch) {
      currentIsoDate = `${fullDateMatch[3]}-${fullDateMatch[2]}-${fullDateMatch[1]}`;
    } else if (shortYearDateMatch) {
      currentIsoDate = `20${shortYearDateMatch[3]}-${shortYearDateMatch[2]}-${shortYearDateMatch[1]}`;
    } else if (dayMonthMatch) {
      currentIsoDate = `${referenceYear}-${dayMonthMatch[2]}-${dayMonthMatch[1]}`;
    }

    // Currency values on line
    const currencyMatches = line.match(currencyRegex);
    if (!currencyMatches || currencyMatches.length === 0) continue;

    // First currency match is the transaction value
    const rawVal = currencyMatches[0];
    const parsed = parseBRLAmount(rawVal);
    if (!parsed || parsed.valor === 0) continue;

    // Clean description by removing currency, dates, and leading/trailing dashes
    let desc = line
      .replace(fullDateMatch ? fullDateMatch[0] : '', '')
      .replace(shortYearDateMatch ? shortYearDateMatch[0] : '', '')
      .replace(dayMonthMatch ? dayMonthMatch[0] : '', '')
      .replace(rawVal, '');

    // If second currency value exists (running balance), remove it too
    if (currencyMatches.length > 1) {
      desc = desc.replace(currencyMatches[1], '');
    }

    desc = cleanBankDescription(desc);
    if (!desc || desc.length < 2 || /^[0-9\s\.\-]+$/.test(desc)) continue;

    let tipoItem: 'despesa' | 'receita' = 'despesa';
    const lower = desc.toLowerCase();
    const rawUpper = rawVal.toUpperCase();

    if (
      lower.includes('pix recebido') ||
      lower.includes('salário') ||
      lower.includes('salario') ||
      lower.includes('rendimento') ||
      lower.includes('crédito') ||
      lower.includes('credito') ||
      lower.includes('depósito') ||
      lower.includes('deposito') ||
      rawUpper.endsWith('C') ||
      rawUpper.startsWith('+')
    ) {
      tipoItem = 'receita';
    } else {
      tipoItem = 'despesa';
    }

    const availableCats = tipoItem === 'despesa' ? categoriesDespesa : categoriesReceita;
    const categoryResult = guessCategory(desc, tipoItem, availableCats);

    const dupCheck = checkDuplicate(
      { data: currentIsoDate, descricao: desc, valor: parsed.valor, tipoItem },
      existingTransactions
    );

    items.push({
      id: `universal-${Date.now()}-${items.length}-${Math.random().toString(36).substring(2, 6)}`,
      data: currentIsoDate,
      descricao: desc,
      valor: parsed.valor,
      tipoItem,
      categoria: categoryResult.categoria,
      categoriaSugeridaConfiavel: categoryResult.confiavel,
      requerAprovacao: categoryResult.requerAprovacao,
      motivoDuvida: categoryResult.motivoDuvida,
      sugestoesCategorias: categoryResult.sugestoesCategorias,
      isDuplicate: dupCheck.isDuplicate,
      duplicateReason: dupCheck.reason,
      selected: !dupCheck.isDuplicate
    });
  }

  return items;
}

// Relaxed Multi-line Fragment Parser (Tier 3 Fallback)
// Handles fragmented extractions where date, text, and values are on separate lines
export function parseRelaxedStatement(
  text: string,
  existingTransactions: Transaction[] = [],
  categoriesDespesa: string[] = ['Alimentação', 'Transporte', 'Moradia', 'Saúde', 'Lazer', 'Outros'],
  categoriesReceita: string[] = ['Salário', 'Outras Receitas']
): ParsedItem[] {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const items: ParsedItem[] = [];

  const defaultYear = new Date().getFullYear();
  let bufferedDate = `${defaultYear}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`;
  let bufferedDescParts: string[] = [];

  for (const line of lines) {
    if (line.toUpperCase().includes('SALDO') || line.toUpperCase().startsWith('PAGINA')) {
      continue;
    }

    // Check if line is a date
    const dmy = line.match(/^(\d{2})\/(\d{2})(?:\/(20\d{2}|\d{2}))?$/);
    if (dmy) {
      const year = dmy[3] ? (dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3]) : String(defaultYear);
      bufferedDate = `${year}-${dmy[2]}-${dmy[1]}`;
      continue;
    }

    // Check if line is a currency value
    const curMatch = line.match(/^-?\s*R?\$?\s*(\d{1,3}(?:\.\d{3})*,\d{2})\s*[-–]?(?:\s*[DDCc])?$/);
    if (curMatch) {
      const parsed = parseBRLAmount(curMatch[0]);
      if (parsed && parsed.valor > 0 && bufferedDescParts.length > 0) {
        const fullDesc = cleanBankDescription(bufferedDescParts.join(' '));
        bufferedDescParts = [];

        if (fullDesc && fullDesc.length > 2) {
          const tipoItem: 'despesa' | 'receita' = parsed.isNegative ? 'despesa' : 'receita';
          const availableCats = tipoItem === 'despesa' ? categoriesDespesa : categoriesReceita;
          const categoryResult = guessCategory(fullDesc, tipoItem, availableCats);

          const dupCheck = checkDuplicate(
            { data: bufferedDate, descricao: fullDesc, valor: parsed.valor, tipoItem },
            existingTransactions
          );

          items.push({
            id: `relaxed-${Date.now()}-${items.length}-${Math.random().toString(36).substring(2, 6)}`,
            data: bufferedDate,
            descricao: fullDesc,
            valor: parsed.valor,
            tipoItem,
            categoria: categoryResult.categoria,
            categoriaSugeridaConfiavel: categoryResult.confiavel,
            requerAprovacao: categoryResult.requerAprovacao,
            motivoDuvida: categoryResult.motivoDuvida,
            sugestoesCategorias: categoryResult.sugestoesCategorias,
            isDuplicate: dupCheck.isDuplicate,
            duplicateReason: dupCheck.reason,
            selected: !dupCheck.isDuplicate
          });
        }
      }
      continue;
    }

    // Collect description line
    if (!line.match(/^\d+$/) && line.length > 1 && line.length < 80) {
      bufferedDescParts.push(line);
      if (bufferedDescParts.length > 4) {
        bufferedDescParts.shift(); // keep last 4 lines max
      }
    }
  }

  return items;
}

// Master Unified Bank Statement Parser (Runs Tier 1 -> Tier 2 -> Tier 3)
export function parseAnyBankStatement(
  text: string,
  existingTransactions: Transaction[] = [],
  categoriesDespesa: string[] = ['Alimentação', 'Transporte', 'Moradia', 'Saúde', 'Lazer', 'Outros'],
  categoriesReceita: string[] = ['Salário', 'Outras Receitas']
): ParsedItem[] {
  // First, clean introductory document presentation, marketing banners and non-transaction headers
  const { cleanedText } = cleanStatementIntroAndJunk(text);
  const textToParse = cleanedText && cleanedText.length > 20 ? cleanedText : text;

  // 1. Try Santander Specialized Parser on cleaned text
  let items = parseSantanderStatement(textToParse, existingTransactions, categoriesDespesa, categoriesReceita);
  if (items.length > 0) {
    return items;
  }

  // 2. Try Universal Brazilian Bank Statement Parser on cleaned text
  items = parseUniversalBankStatement(textToParse, existingTransactions, categoriesDespesa, categoriesReceita);
  if (items.length > 0) {
    return items;
  }

  // 3. Try Relaxed Multi-line Fragment Parser on cleaned text
  items = parseRelaxedStatement(textToParse, existingTransactions, categoriesDespesa, categoriesReceita);
  if (items.length > 0) {
    return items;
  }

  // Safe fallback to raw text if cleaned version yielded nothing
  if (textToParse !== text) {
    items = parseSantanderStatement(text, existingTransactions, categoriesDespesa, categoriesReceita);
    if (items.length > 0) return items;
    items = parseUniversalBankStatement(text, existingTransactions, categoriesDespesa, categoriesReceita);
    if (items.length > 0) return items;
    items = parseRelaxedStatement(text, existingTransactions, categoriesDespesa, categoriesReceita);
  }

  return items;
}

// OFX Statement Parser
export function parseOFXStatement(
  ofxContent: string,
  existingTransactions: Transaction[] = [],
  categoriesDespesa: string[] = ['Alimentação', 'Transporte', 'Moradia', 'Saúde', 'Lazer', 'Outros'],
  categoriesReceita: string[] = ['Salário', 'Outras Receitas']
): ParsedItem[] {
  const items: ParsedItem[] = [];
  const stmtTrnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
  let match;

  while ((match = stmtTrnRegex.exec(ofxContent)) !== null) {
    const block = match[1];

    const trnAmtMatch = block.match(/<TRNAMT>([\d\.\,\-]+)/i);
    const dtPostedMatch = block.match(/<DTPOSTED>(\d{8})/i);
    const memoMatch = block.match(/<MEMO>(.*?)(?:<\/MEMO>|\r|\n)/i);
    const nameMatch = block.match(/<NAME>(.*?)(?:<\/NAME>|\r|\n)/i);

    if (!trnAmtMatch || !dtPostedMatch) continue;

    const rawAmt = parseFloat(trnAmtMatch[1].replace(',', '.'));
    const isDespesa = rawAmt < 0;
    const valor = Math.abs(rawAmt);

    const dtStr = dtPostedMatch[1]; // YYYYMMDD
    const isoDate = `${dtStr.substring(0, 4)}-${dtStr.substring(4, 6)}-${dtStr.substring(6, 8)}`;

    const desc = (nameMatch ? nameMatch[1].trim() : '') || (memoMatch ? memoMatch[1].trim() : 'Transação Bancária');
    const tipoItem: 'despesa' | 'receita' = isDespesa ? 'despesa' : 'receita';

    const availableCats = tipoItem === 'despesa' ? categoriesDespesa : categoriesReceita;
    const { categoria, confiavel } = guessCategory(desc, tipoItem, availableCats);

    const dupCheck = checkDuplicate(
      { data: isoDate, descricao: desc, valor, tipoItem },
      existingTransactions
    );

    items.push({
      id: `ofx-${Date.now()}-${items.length}-${Math.random().toString(36).substring(2, 6)}`,
      data: isoDate,
      descricao: desc,
      valor,
      tipoItem,
      categoria,
      categoriaSugeridaConfiavel: confiavel,
      isDuplicate: dupCheck.isDuplicate,
      duplicateReason: dupCheck.reason,
      selected: !dupCheck.isDuplicate
    });
  }

  return items;
}

// CSV / Table Parser
export function parseCSVStatement(
  csvText: string,
  existingTransactions: Transaction[] = [],
  categoriesDespesa: string[] = ['Alimentação', 'Transporte', 'Moradia', 'Saúde', 'Lazer', 'Outros'],
  categoriesReceita: string[] = ['Salário', 'Outras Receitas']
): ParsedItem[] {
  const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  const firstLine = lines[0];
  const sep = firstLine.includes(';') ? ';' : ',';

  const items: ParsedItem[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(sep).map(c => c.replace(/^["']|["']$/g, '').trim());
    if (cols.length < 3) continue;

    let dateStr = '';
    let desc = '';
    let valor = 0;
    let isNegative = true;

    for (const col of cols) {
      const dmy = col.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (dmy) {
        dateStr = `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
        continue;
      }
      const ymd = col.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (ymd) {
        dateStr = col;
        continue;
      }

      const parsedVal = parseBRLAmount(col);
      if (parsedVal && parsedVal.valor > 0) {
        valor = parsedVal.valor;
        isNegative = parsedVal.isNegative;
        continue;
      }

      if (!desc && col.length > 2 && isNaN(Number(col))) {
        desc = col;
      }
    }

    if (dateStr && desc && valor > 0) {
      const tipoItem: 'despesa' | 'receita' = isNegative ? 'despesa' : 'receita';
      const availableCats = tipoItem === 'despesa' ? categoriesDespesa : categoriesReceita;
      const { categoria, confiavel } = guessCategory(desc, tipoItem, availableCats);

      const dupCheck = checkDuplicate(
        { data: dateStr, descricao: desc, valor, tipoItem },
        existingTransactions
      );

      items.push({
        id: `csv-${Date.now()}-${items.length}-${Math.random().toString(36).substring(2, 6)}`,
        data: dateStr,
        descricao: desc,
        valor,
        tipoItem,
        categoria,
        categoriaSugeridaConfiavel: confiavel,
        isDuplicate: dupCheck.isDuplicate,
        duplicateReason: dupCheck.reason,
        selected: !dupCheck.isDuplicate
      });
    }
  }

  return items;
}
