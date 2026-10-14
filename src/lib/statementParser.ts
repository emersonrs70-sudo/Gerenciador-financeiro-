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
      'car petroleo', 'rede l car', 'l car', 'posto', 'combustivel', 'gasolina', 'etanol',
      'uber', '99app', '99 app', 'estacionamento', 'protecao veicular', 'eleven protecao',
      'auto posto', 'rezende', 'posto luar', 'posto avenida', 'master posto', 'lubrific',
      'oficina', 'mecanica', 'pedagio', 'sem parar', 'veicular'
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

// Convert Brazilian currency string like "200,00-", "- 200,00-", "1.500,00-", "200,00", "5.877,98"
export function parseBRLAmount(rawVal: string): { valor: number; isNegative: boolean } | null {
  const cleaned = rawVal.trim().replace(/\s/g, '');
  if (!cleaned) return null;

  const isNegative = cleaned.endsWith('-') || cleaned.startsWith('-');
  const numOnly = cleaned.replace(/-/g, '').replace(/\./g, '').replace(',', '.');
  const val = parseFloat(numOnly);

  if (isNaN(val) || val <= 0) return null;
  return { valor: val, isNegative };
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

  const monthYearMatch = text.match(/(janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)[\/\s]+(\d{4})/i)
    || text.match(/\b(0[1-9]|1[0-2])\/(\d{4})\b/);

  if (monthYearMatch) {
    if (isNaN(Number(monthYearMatch[1]))) {
      const idx = monthNames.findIndex(m => m === monthYearMatch[1].toLowerCase());
      if (idx !== -1) {
        referenceMonth = (idx % 12) + 1;
        referenceYear = parseInt(monthYearMatch[2], 10);
      }
    } else {
      referenceMonth = parseInt(monthYearMatch[1], 10);
      referenceYear = parseInt(monthYearMatch[2], 10);
    }
  }

  // Helper to format ISO date
  const formatIsoDate = (day: string, month: string) => {
    const d = day.padStart(2, '0');
    const m = (month || String(referenceMonth)).padStart(2, '0');
    return `${referenceYear}-${m}-${d}`;
  };

  // 2. Isolate the Movimentação table to eliminate junk tables (Saldos por Período, Comprovantes repetidos, Pacote de Serviços, etc.)
  let relevantText = text;

  // Cut off after Movimentação table ends
  const cutoffKeywords = [
    'Saldos por Período',
    'Saldos por Periodo',
    'Débito Automático em Conta Corrente',
    'Debito Automatico em Conta Corrente',
    'Compras com Cartão de Débito',
    'Compras com Cartao de Debito',
    'Comprovantes de Pagamento',
    'Créditos Contratados',
    'Creditos Contratados',
    'Pacote de Serviços',
    'Índices Econômicos'
  ];

  for (const kw of cutoffKeywords) {
    const idx = relevantText.indexOf(kw);
    if (idx !== -1) {
      relevantText = relevantText.substring(0, idx);
      break;
    }
  }

  // Discard intro headers before "Conta Corrente" / "Movimentação" / "Data Descrição"
  const startIdx = relevantText.search(/(?:Conta Corrente\s+)?Movimenta[çc][ãa]o/i);
  if (startIdx !== -1) {
    relevantText = relevantText.substring(startIdx);
  }

  const rawLines = relevantText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const items: ParsedItem[] = [];

  let currentDay = '01';
  let currentMonthStr = String(referenceMonth).padStart(2, '0');

  // Skip table headers and summary lines
  const isJunkLine = (l: string) => {
    const upper = l.toUpperCase();
    return (
      upper.startsWith('EXTRATO CONSOLIDADO') ||
      upper.startsWith('PAGINA:') ||
      upper.startsWith('FALE CONOSCO') ||
      upper.startsWith('PROTEJA-SE') ||
      upper.startsWith('BALP_UY_') ||
      upper.startsWith('EXTRATO_PF_') ||
      upper.startsWith('RESUMO -') ||
      upper.startsWith('DATA DESCRIÇÃO') ||
      upper.startsWith('MOVIMENTAÇÃO') ||
      upper.startsWith('CONTA CORRENTE') ||
      upper.startsWith('NOME') ||
      upper.startsWith('AGÊNCIA') ||
      upper.startsWith('SALDO EM') ||
      upper.startsWith('SALDO DE CONTA') ||
      upper.startsWith('TOTAL DE CRÉDITOS') ||
      upper.startsWith('TOTAL DE DÉBITOS') ||
      upper.startsWith('TOTAL DE DEBITOS') ||
      upper.startsWith('SALDO DISPONÍVEL') ||
      upper.startsWith('SALDO DISPONIVEL') ||
      upper.startsWith('LIMITE SANTANDER') ||
      upper.startsWith('PROVISÃO DE ENCARGOS') ||
      upper.startsWith('SE VOCÊ NÃO TEM LIMITE')
    );
  };

  // Currency matching regex: matches "- 27,01-", "27,01-", "1.910,00", "89,24", etc.
  const currencyTokenRegex = /-?\s*\d{1,3}(?:\.\d{3})*,\d{2}-?/g;

  let bufferedPrefix = '';

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];

    if (isJunkLine(line)) {
      continue;
    }

    // Check if line begins with a transaction date "01/07", "15/07"
    const leadingDateMatch = line.match(/^(\d{2})\/(\d{2})\b/);
    if (leadingDateMatch) {
      currentDay = leadingDateMatch[1];
      currentMonthStr = leadingDateMatch[2];
    }

    // Check if line contains currency amounts
    const currencyMatches = line.match(currencyTokenRegex);

    if (!currencyMatches || currencyMatches.length === 0) {
      // Line might be the first part of a wrapped multi-line description (e.g. "01/07 DEBITO AUT. TELEFONE CELULAR")
      if (
        !line.toUpperCase().includes('SALDO') &&
        !line.match(/^\d+$/) &&
        line.length > 2 &&
        line.length < 80
      ) {
        bufferedPrefix = (bufferedPrefix ? `${bufferedPrefix} ` : '') + line.replace(/^\d{2}\/\d{2}\s*/, '').trim();
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

    // Strip leading date if present
    descPart = descPart.replace(/^\d{2}\/\d{2}\s*/, '');

    // Strip document number (like "328119", "010715", "484464" or "-") at the end of descPart
    descPart = descPart.replace(/\s+(?:\d{5,8}|-)\s*$/, '').trim();

    // If there was a buffered prefix from the previous line, combine
    let fullDesc = (bufferedPrefix ? `${bufferedPrefix} ${descPart}` : descPart).trim();
    bufferedPrefix = ''; // reset buffer

    if (!fullDesc || fullDesc.toUpperCase().includes('SALDO EM') || /^[0-9\s\.\-]+$/.test(fullDesc)) {
      continue;
    }

    // Humanize and clean Santander patterns
    let cleanDesc = fullDesc
      // Debit card purchases: "DEBITO VISA ELECTRON BRASIL 12/07 POSTO AVENIDA" -> "Cartão Débito: POSTO AVENIDA"
      .replace(/^DEBITO VISA ELECTRON BRASIL(?:\s+\d{2}\/\d{2})?\s*-?\s*/i, 'Cartão Débito: ')
      // Auto debits: "DEBITO AUT. TELEFONE CELULAR CLARO MOVEL" -> "Débito Automático: CLARO MOVEL"
      .replace(/^DEBITO AUT\.\s+TELEFONE CELULAR\s*-?\s*/i, 'Débito Automático: ')
      // Card invoice debits: "DEBITO AUT. FATURA CARTAO VISA FINAL 0245" -> "Fatura Cartão: VISA Final 0245"
      .replace(/^DEBITO AUT\.\s+FATURA CARTAO VISA\s*(?:FINAL\s*(\d+))?/i, (_, finalDig) => finalDig ? `Fatura Cartão: VISA Final ${finalDig}` : 'Fatura Cartão: VISA')
      // Boletos: "PAGAMENTO DE BOLETO OUTROS BANCOS ENEL DISTRIBUICAO CEARA" -> "Boleto: ENEL DISTRIBUICAO CEARA"
      .replace(/^PAGAMENTO DE BOLETO OUTROS BANCOS\s*-?\s*/i, 'Boleto: ')
      // Salary: "LIQUIDO DE VENCIMENTO CNPJ 010656452000180" -> "Salário: Vencimento Folha"
      .replace(/^LIQUIDO DE VENCIMENTO(?:\s+CNPJ\s+\d+)?/i, 'Salário: Vencimento Folha')
      // Automatic investment yield: "REMUNERACAO APLICACAO AUTOMATICA"
      .replace(/^REMUNERACAO APLICACAO AUTOMATICA/i, 'Rendimento: Aplicação Automática')
      // ATM withdrawals: "SAQUE DINHEIRO BANCO 24H 07/07 10:45" -> "Saque Banco 24H"
      .replace(/^SAQUE DINHEIRO BANCO 24H(?:\s+\d{2}\/\d{2}\s+\d{2}:\d{2})?/i, 'Saque Banco 24H')
      // IOF taxes
      .replace(/^IOF IMPOSTO OPERACOES FINANCEIRAS.*/i, 'IOF Imposto Operações Financeiras')
      .replace(/^IOF ADICIONAL\s*-\s*AUTOMATICO.*/i, 'IOF Adicional Automático')
      // PIX Cleanups
      .replace(/^PIX ENVIADO OPEN FINANCE\s*-?\s*/i, 'PIX Enviado: ')
      .replace(/^PIX ENVIADO\s*-?\s*/i, 'PIX Enviado: ')
      .replace(/^PIX RECEBIDO\s*-?\s*/i, 'PIX Recebido: ')
      // Shopee store cleanup
      .replace(/SHPP BRASIL INSTITUICAO D.*/i, 'SHPP BRASIL (Shopee)')
      // General cleanup
      .replace(/^[-–\s]+|[-–\s]+$/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim();

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

    const isoDate = formatIsoDate(currentDay, currentMonthStr);
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
