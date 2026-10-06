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
      // Find matching available category in user's categories list (case-insensitive)
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
    // 1. Same amount (allowing 0.01 float diff)
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

// Convert Brazilian currency string like "200,00-", "1.500,00-", "200,00", "5.877,98"
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
  existingTransactions: Transaction[],
  categoriesDespesa: string[],
  categoriesReceita: string[]
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

  // We scan through the text identifying transaction blocks
  let currentDay = '01';
  let currentMonthStr = String(referenceMonth).padStart(2, '0');

  // Let's identify lines that match the Santander table structure:
  // e.g. "03/08 PIX RECEBIDO ... 200,00"
  // or "PIX ENVIADO S de Lima ... 19,00-"
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Ignore known header / footer / summary lines
    if (
      line.includes('EXTRATO CONSOLIDADO') ||
      line.includes('Sua segurança') ||
      line.includes('Proteja-se contra golpes') ||
      line.includes('Fale Conosco') ||
      line.includes('Resumo -') ||
      line.includes('Saldo de Conta Corrente') ||
      line.includes('Total de Créditos') ||
      line.includes('Total de Débitos') ||
      line.includes('Limite Santander') ||
      line.includes('Saldo Disponível') ||
      line.includes('Provisão de Encargos') ||
      line.includes('SALDO EM') ||
      line.includes('Saldos por Período') ||
      line.includes('Créditos Contratados') ||
      line.includes('Índices Econômicos') ||
      line.includes('Pacote de Serviços') ||
      line.startsWith('Data Descrição') ||
      line.startsWith('Movimentação') ||
      line.startsWith('Pagina:')
    ) {
      continue;
    }

    // Pattern A: Line contains a date like "03/08" at start or within
    const dateMatch = line.match(/^(\d{2})\/(\d{2})\b/);
    if (dateMatch) {
      currentDay = dateMatch[1];
      currentMonthStr = dateMatch[2];
    }

    // Check if this line or next line contains a monetary value at the end like "200,00" or "19,00-"
    // Santander monetary pattern: [\d\.]+,\d{2}-?
    const valueMatch = line.match(/([\d\.]+,\d{2}-?)\s*(?:[\d\.]+,\d{2}-?)?$/);

    if (valueMatch) {
      const rawVal = valueMatch[1];
      const parsedVal = parseBRLAmount(rawVal);

      if (parsedVal) {
        // Extract description
        let rawDesc = line
          .replace(/^(\d{2})\/(\d{2})\b/, '') // remove date if at start
          .replace(new RegExp(`${valueMatch[0]}$`), '') // remove values
          .trim();

        // Check if there was a preceding descriptive line (e.g. "PIX ENVIADO")
        // Or if previous line had no value and was part of this description
        if (i > 0) {
          const prevLine = lines[i - 1];
          if (
            !prevLine.match(/[\d\.]+,\d{2}/) &&
            !prevLine.includes('SALDO') &&
            !prevLine.includes('Data Descrição') &&
            prevLine.length > 2 &&
            prevLine.length < 60
          ) {
            // Prepend if not already inside
            if (!rawDesc.toLowerCase().includes(prevLine.toLowerCase())) {
              rawDesc = `${prevLine} - ${rawDesc}`.trim();
            }
          }
        }

        // Check if NEXT line is an elaboration (e.g. "Francisco Edson dos Santo" or "CLARO MOVEL")
        if (i + 1 < lines.length) {
          const nextLine = lines[i + 1];
          if (
            !nextLine.match(/[\d\.]+,\d{2}/) &&
            !nextLine.match(/^\d{2}\/\d{2}/) &&
            !nextLine.includes('SALDO') &&
            nextLine.length > 2 &&
            nextLine.length < 50
          ) {
            rawDesc = `${rawDesc} - ${nextLine}`.trim();
          }
        }

        // Clean up redundant chars/dashes
        let cleanDesc = rawDesc
          .replace(/^[-–\s]+|[-–\s]+$/g, '')
          .replace(/\s{2,}/g, ' ');

        // Skip if empty or if it was just "SALDO"
        if (!cleanDesc || cleanDesc.toUpperCase().includes('SALDO')) {
          continue;
        }

        // Santander specifics:
        // PIX ENVIADO / DEBITO / SAQUE / IOF -> Despesa (or if ends with -)
        // PIX RECEBIDO / LIQUIDO DE VENCIMENTO / REMUNERACAO -> Receita
        let tipoItem: 'despesa' | 'receita' = parsedVal.isNegative ? 'despesa' : 'receita';
        const lowerDesc = cleanDesc.toLowerCase();

        if (lowerDesc.includes('pix enviado') || lowerDesc.includes('debito') || lowerDesc.includes('saque') || lowerDesc.includes('iof')) {
          tipoItem = 'despesa';
        } else if (lowerDesc.includes('pix recebido') || lowerDesc.includes('liquido de vencimento') || lowerDesc.includes('salario') || lowerDesc.includes('remuneracao aplicacao')) {
          tipoItem = 'receita';
        }

        // Nice display label formatting
        if (cleanDesc.startsWith('PIX ENVIADO -')) {
          cleanDesc = cleanDesc.replace(/^PIX ENVIADO\s*-\s*/i, 'PIX Enviado: ');
        } else if (cleanDesc.startsWith('PIX RECEBIDO -')) {
          cleanDesc = cleanDesc.replace(/^PIX RECEBIDO\s*-\s*/i, 'PIX Recebido: ');
        }

        const availableCats = tipoItem === 'despesa' ? categoriesDespesa : categoriesReceita;
        const { categoria, confiavel } = guessCategory(cleanDesc, tipoItem, availableCats);

        const isoDate = formatIsoDate(currentDay, currentMonthStr);
        const dupCheck = checkDuplicate(
          { data: isoDate, descricao: cleanDesc, valor: parsedVal.valor, tipoItem },
          existingTransactions
        );

        items.push({
          id: `extrato-${Date.now()}-${items.length}-${Math.random().toString(36).substring(2, 6)}`,
          data: isoDate,
          descricao: cleanDesc,
          valor: parsedVal.valor,
          tipoItem,
          categoria,
          categoriaSugeridaConfiavel: confiavel,
          isDuplicate: dupCheck.isDuplicate,
          duplicateReason: dupCheck.reason,
          selected: !dupCheck.isDuplicate // Auto-uncheck duplicates!
        });
      }
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
  existingTransactions: Transaction[],
  categoriesDespesa: string[],
  categoriesReceita: string[]
): ParsedItem[] {
  const items: ParsedItem[] = [];
  const stmtTrnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
  let match;

  while ((match = stmtTrnRegex.exec(ofxContent)) !== null) {
    const block = match[1];

    // Extract TRNTYPE, DTPOSTED, TRNAMT, MEMO / NAME
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
  existingTransactions: Transaction[],
  categoriesDespesa: string[],
  categoriesReceita: string[]
): ParsedItem[] {
  const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  // Determine separator: ';' or ','
  const firstLine = lines[0];
  const sep = firstLine.includes(';') ? ';' : ',';

  const items: ParsedItem[] = [];

  // Try to find headers
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(sep).map(c => c.replace(/^["']|["']$/g, '').trim());
    if (cols.length < 3) continue;

    // Look for date in cols
    let dateStr = '';
    let desc = '';
    let valor = 0;
    let isNegative = true;

    for (const col of cols) {
      // Date format: DD/MM/YYYY or YYYY-MM-DD
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

      // Value format
      const parsedVal = parseBRLAmount(col);
      if (parsedVal && parsedVal.valor > 0) {
        valor = parsedVal.valor;
        isNegative = parsedVal.isNegative;
        continue;
      }

      // Otherwise assume description
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
