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
  isDuplicate: boolean;
  duplicateReason?: string;
  selected: boolean;
}

// Keyword-based automatic categorization rules
const CATEGORY_RULES: { category: string; keywords: string[] }[] = [
  {
    category: 'Alimentação',
    keywords: [
      'panificad', 'padaria', 'lanche', 'restaurante', 'potiguar', 'supermercado', 'alimento',
      'cimir', 'açougue', 'acougue', 'ifood', 'mercado', 'comercial praciano', 'comercial de alimento',
      'top lanches', 'mwn comercial', 'churrascaria', 'pizzaria', 'hamburguer', 'burger', 'cafe',
      'baratao tecnologia', 'hortifruti', 'atacadão', 'atacadao', 'assaí', 'assai'
    ]
  },
  {
    category: 'Transporte',
    keywords: [
      'car petroleo', 'rede l car', 'l car', 'posto', 'combustivel', 'gasolina', 'etanol',
      'uber', '99app', '99 app', 'estacionamento', 'protecao veicular', 'eleven protecao',
      'auto posto', 'rezende', 'posto luar', 'lubrific', 'oficina', 'mecanica', 'pedagio', 'sem parar'
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
      'saude', 'aac saude', 'farmacia', 'drogaria', 'pague menos', 'drogasil', 'droga raia',
      'medico', 'clinica', 'laboratorio', 'hospital', 'dentista', 'odont', 'exame', 'consulta'
    ]
  },
  {
    category: 'Lazer',
    keywords: [
      'multicine', 'cinema', 'cinemark', 'cinepolis', 'livraria', 'papelaria', 'loio', 'show',
      'teatro', 'netflix', 'spotify', 'prime video', 'disney', 'ingresso', 'viagem', 'hotel', 'airbnb'
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
      'liquido de vencimento', 'salario', 'provento', 'remuneracao', 'folha de pagamento',
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
} {
  const lower = descricao.toLowerCase();

  // Check specific rules first
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some(k => lower.includes(k))) {
      const matched = availableCategories.find(c => c.toLowerCase() === rule.category.toLowerCase());
      if (matched) {
        return { categoria: matched, confiavel: true };
      }
      return { categoria: rule.category, confiavel: true };
    }
  }

  // If it's a salary-like credit
  if (tipoItem === 'receita') {
    const salaryCat = availableCategories.find(c => c.toLowerCase().includes('salário') || c.toLowerCase().includes('salario'));
    if (salaryCat && (lower.includes('vencimento') || lower.includes('empresa') || lower.includes('remunera'))) {
      return { categoria: salaryCat, confiavel: true };
    }
    const otherRec = availableCategories.find(c => c.toLowerCase().includes('outras') || c.toLowerCase().includes('renda extra')) || availableCategories[0] || 'Outras Receitas';
    return { categoria: otherRec, confiavel: false };
  }

  // Fallback for expenses: Not confident, requires user review
  const defaultCat = availableCategories.find(c => c.toLowerCase().includes('outros') || c.toLowerCase().includes('geral')) || availableCategories[0] || 'Outros';
  return { categoria: defaultCat, confiavel: false };
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

// Specialized Santander statement text parser
export function parseSantanderStatement(
  text: string,
  existingTransactions: Transaction[] = [],
  categoriesDespesa: string[] = ['Alimentação', 'Transporte', 'Moradia', 'Saúde', 'Lazer', 'Outros'],
  categoriesReceita: string[] = ['Salário', 'Outras Receitas']
): ParsedItem[] {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const items: ParsedItem[] = [];

  // 1. Detect Year and Month from statement text (e.g. "agosto/2026", "08/2026", "agosto de 2026")
  let referenceYear = new Date().getFullYear();
  let referenceMonth = new Date().getMonth() + 1; // 1-12

  const monthNames = [
    'janeiro', 'fevereiro', 'março', 'marco', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
  ];

  for (const line of lines) {
    const monthYearMatch = line.match(/(janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)[\/\s]+(\d{4})/i);
    if (monthYearMatch) {
      const idx = monthNames.findIndex(m => m === monthYearMatch[1].toLowerCase());
      if (idx !== -1) {
        referenceMonth = (idx % 12) + 1;
        referenceYear = parseInt(monthYearMatch[2], 10);
        break;
      }
    }
  }

  // Helper to format ISO date
  const formatIsoDate = (day: string, month: string) => {
    const d = day.padStart(2, '0');
    const m = (month || String(referenceMonth)).padStart(2, '0');
    return `${referenceYear}-${m}-${d}`;
  };

  let currentDay = '01';
  let currentMonthStr = String(referenceMonth).padStart(2, '0');

  // Skip summary patterns
  const isSummaryLine = (l: string) => {
    const upper = l.toUpperCase();
    return (
      upper.includes('SALDO EM') ||
      upper.includes('SALDO DE CONTA') ||
      upper.includes('TOTAL DE CRÉDITOS') ||
      upper.includes('TOTAL DE DEBITOS') ||
      upper.includes('TOTAL DE DÉBITOS') ||
      upper.includes('SALDO DISPONÍVEL') ||
      upper.includes('SALDO DISPONIVEL') ||
      upper.includes('LIMITE SANTANDER') ||
      upper.includes('PROVISÃO DE ENCARGOS') ||
      upper.includes('RESUMO -') ||
      upper.includes('EXTRATO CONSOLIDADO') ||
      upper.includes('FALE CONOSCO') ||
      upper.includes('PROTEJA-SE') ||
      upper.includes('ÍNDICES ECONÔMICOS') ||
      upper.includes('PACOTE DE SERVIÇOS') ||
      upper.startsWith('DATA DESCRIÇÃO') ||
      upper.startsWith('MOVIMENTAÇÃO') ||
      upper.startsWith('PAGINA:')
    );
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (isSummaryLine(line)) {
      continue;
    }

    // Check for date in line: "03/08", "03/08/2026"
    const dateMatch = line.match(/^(\d{2})\/(\d{2})\b/) || line.match(/\b(\d{2})\/(\d{2})\b/);
    if (dateMatch) {
      currentDay = dateMatch[1];
      currentMonthStr = dateMatch[2];
    }

    // Check for monetary value in line: e.g. "19,00-", "- 19,00-", "200,00", "- 200,00", "4.800,00-", "71,22-"
    const valMatch = line.match(/(?:^|\s)-?\s*([\d\.]+,\d{2}-?)(?:\s|$)/);
    if (valMatch) {
      const parsedVal = parseBRLAmount(valMatch[1]);
      if (!parsedVal || parsedVal.valor === 0) continue;

      // Extract description from this line
      let desc = line
        .replace(valMatch[0], '')
        .replace(/^\d{2}\/\d{2}\s*/, '')
        .replace(/^-+\s*/, '')
        .trim();

      // If desc is empty or too short, look back at preceding lines in the same block
      if (!desc || desc.length < 3 || /^[0-9\s\.\-]+$/.test(desc)) {
        const parts: string[] = [];
        for (let j = Math.max(0, i - 2); j < i; j++) {
          const prev = lines[j];
          if (
            !isSummaryLine(prev) &&
            !prev.match(/[\d\.]+,\d{2}/) &&
            prev.length > 2 &&
            prev.length < 70
          ) {
            parts.push(prev.replace(/^\d{2}\/\d{2}\s*/, '').trim());
          }
        }
        desc = parts.join(' - ');
      }

      // Check if following line has details (e.g. "CLARO MOVEL" or "BARATAO TECNOLOGIA")
      if (i + 1 < lines.length) {
        const next = lines[i + 1].trim();
        const isNextStartOfNewTransaction = /^(PIX|DEBITO|DÉBITO|CREDITO|CRÉDITO|SAQUE|TRANSFERENCIA|TRANSFERÊNCIA|PAGAMENTO|LIQUIDO|LÍQUIDO|REMUNERACAO|REMUNERAÇÃO|IOF|SALDO)/i.test(next);

        if (
          !isNextStartOfNewTransaction &&
          !isSummaryLine(next) &&
          !next.match(/[\d\.]+,\d{2}/) &&
          !next.match(/^\d{2}\/\d{2}/) &&
          next.length > 2 &&
          next.length < 50
        ) {
          if (!desc.toLowerCase().includes(next.toLowerCase())) {
            desc = `${desc} - ${next}`.trim();
          }
        }
      }

      // Clean up description
      let cleanDesc = desc
        .replace(/^[-–\s]+|[-–\s]+$/g, '')
        .replace(/\s{2,}/g, ' ')
        .trim();

      if (!cleanDesc || cleanDesc.toUpperCase().includes('SALDO')) {
        continue;
      }

      // Format Santander titles cleanly
      cleanDesc = cleanDesc
        .replace(/^PIX ENVIADO\s*-\s*/i, 'PIX Enviado: ')
        .replace(/^PIX RECEBIDO\s*-\s*/i, 'PIX Recebido: ')
        .replace(/^DEBITO VISA ELECTRON BRASIL\s*-\s*/i, 'Cartão Débito: ')
        .replace(/^DEBITO AUT\. TELEFONE CELULAR\s*-\s*/i, 'Débito Automático: ')
        .replace(/^DEBITO AUT\. FATURA CARTAO VISA\s*-\s*/i, 'Fatura Cartão: ')
        .replace(/^LIQUIDO DE VENCIMENTO\s*-\s*/i, 'Salário: ');

      // Determine item type (expense vs income)
      let tipoItem: 'despesa' | 'receita' = parsedVal.isNegative ? 'despesa' : 'receita';
      const lower = cleanDesc.toLowerCase();

      if (
        lower.includes('pix recebido') ||
        lower.includes('liquido de vencimento') ||
        lower.includes('salario') ||
        lower.includes('salário') ||
        lower.includes('provento') ||
        lower.includes('remuneracao aplicacao') ||
        lower.includes('remuneração aplicação')
      ) {
        tipoItem = 'receita';
      } else if (
        parsedVal.isNegative ||
        lower.includes('pix enviado') ||
        lower.includes('debito') ||
        lower.includes('d\u00e9bito') ||
        lower.includes('saque') ||
        lower.includes('boleto') ||
        lower.includes('iof') ||
        lower.includes('tarifa') ||
        lower.includes('fatura')
      ) {
        tipoItem = 'despesa';
      }

      const availableCats = tipoItem === 'despesa' ? categoriesDespesa : categoriesReceita;
      const { categoria, confiavel } = guessCategory(cleanDesc, tipoItem, availableCats);

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
        categoria,
        categoriaSugeridaConfiavel: confiavel,
        isDuplicate: dupCheck.isDuplicate,
        duplicateReason: dupCheck.reason,
        selected: !dupCheck.isDuplicate
      });
    }
  }

  // De-duplicate items within the parsed list itself
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
