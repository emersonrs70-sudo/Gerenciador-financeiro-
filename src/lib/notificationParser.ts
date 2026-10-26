import { BankAccount, PendingSuggestion, safeRandomUUID } from '../types';

export interface ParseResult {
  banco: string;
  descricao: string;
  valor: number;
  tipoItem: 'despesa' | 'receita';
  categoria: string;
  accountId: string;
  data: string;
}

/**
 * Intelligent parser for bank notifications from Brazilian banks
 * (Santander, Nubank, Itaú, Inter, C6, Bradesco, Caixa, Banco do Brasil, PicPay, Mercado Pago)
 */
export function parseBankNotification(
  text: string,
  accounts: BankAccount[] = [],
  customCategoriesDespesa: string[] = [],
  customCategoriesReceita: string[] = []
): ParseResult | null {
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return null;
  }

  const cleanText = text.trim();
  const lower = cleanText.toLowerCase();

  // 1. Detect Amount (R$ XX,XX or XX.XX)
  // Match patterns like R$ 45,90, R$45.90, BRL 100,00, 45,90 BRL
  const amountRegex = /(?:r\$|brl|\$)?\s*([0-9]{1,3}(?:\.[0-9]{3})*|\d+)[,\.]([0-9]{2})\b/i;
  const matchAmount = cleanText.match(amountRegex);

  let valor = 0;
  if (matchAmount) {
    const intPart = matchAmount[1].replace(/\./g, '');
    const decPart = matchAmount[2];
    valor = parseFloat(`${intPart}.${decPart}`);
  }

  if (isNaN(valor) || valor <= 0) {
    // Try fallback for integer currency like R$ 50
    const intCurrencyRegex = /(?:r\$|brl)\s*([0-9]{1,3}(?:\.[0-9]{3})*|\d+)\b/i;
    const matchInt = cleanText.match(intCurrencyRegex);
    if (matchInt) {
      valor = parseFloat(matchInt[1].replace(/\./g, ''));
    }
  }

  if (isNaN(valor) || valor <= 0) {
    return null; // A valid transaction notification must have an identifiable positive amount
  }

  // 2. Detect Institution / Bank
  let banco = 'Banco';
  let matchedAccountId = 'santander';

  if (lower.includes('santander') || lower.includes('way') || lower.includes('sx')) {
    banco = 'Santander';
    const cardAcc = accounts.find(a => a.tipo === 'credito' && (a.id.includes('santander') || a.nome.toLowerCase().includes('santander')));
    const checkingAcc = accounts.find(a => a.tipo === 'corrente' && a.id.includes('santander'));
    
    // If credit card mentioned
    if (lower.includes('crédito') || lower.includes('cartão') || lower.includes('fatura') || lower.includes('sx')) {
      matchedAccountId = cardAcc ? cardAcc.id : 'santander-cartao';
    } else {
      matchedAccountId = checkingAcc ? checkingAcc.id : 'santander';
    }
  } else if (lower.includes('nubank') || lower.includes('nu pagamentos') || lower.includes('roxinho')) {
    banco = 'Nubank';
    const nuAcc = accounts.find(a => a.nome.toLowerCase().includes('nubank') || a.id.toLowerCase().includes('nubank'));
    matchedAccountId = nuAcc ? nuAcc.id : 'santander';
  } else if (lower.includes('itaú') || lower.includes('itau') || lower.includes('iti')) {
    banco = 'Itaú';
    const itauAcc = accounts.find(a => a.nome.toLowerCase().includes('itau') || a.id.toLowerCase().includes('itau'));
    matchedAccountId = itauAcc ? itauAcc.id : 'santander';
  } else if (lower.includes('inter') || lower.includes('banco inter')) {
    banco = 'Inter';
    const interAcc = accounts.find(a => a.nome.toLowerCase().includes('inter') || a.id.toLowerCase().includes('inter'));
    matchedAccountId = interAcc ? interAcc.id : 'santander';
  } else if (lower.includes('c6') || lower.includes('c6 bank')) {
    banco = 'C6 Bank';
  } else if (lower.includes('bradesco') || lower.includes('next')) {
    banco = 'Bradesco';
  } else if (lower.includes('picpay')) {
    banco = 'PicPay';
  } else if (lower.includes('mercado pago') || lower.includes('mercadopago')) {
    banco = 'Mercado Pago';
  }

  // 3. Detect Transaction Type (Receita vs Despesa)
  let tipoItem: 'despesa' | 'receita' = 'despesa';
  const isIncomeKeyword =
    lower.includes('recebeu') ||
    lower.includes('recebido') ||
    lower.includes('transferência recebida') ||
    lower.includes('pix recebido') ||
    lower.includes('depósito recebido') ||
    lower.includes('reembolso') ||
    lower.includes('estorno') ||
    lower.includes('salário creditado') ||
    lower.includes('crédito em conta');

  if (isIncomeKeyword) {
    tipoItem = 'receita';
  }

  // 4. Extract Establishment / Counterparty (Descrição)
  let descricao = '';

  // Patterns like "em NOME_DO_ESTABELECIMENTO"
  const emMatch = cleanText.match(/\bem\s+([A-Za-z0-9\s\*\.\-\_\&]{2,40}?)(?:\s+(?:às|as|no dia|em|valor|com|final|\.|\,|$))/i);
  // Patterns like "de NOME_DA_PESSOA" (for incoming Pix)
  const deMatch = cleanText.match(/\bde\s+([A-Za-z0-9\s\*\.\-\_]{2,35}?)(?:\s+(?:às|as|no dia|em|valor|com|\.|\,|$))/i);
  // Patterns like "para NOME_DA_PESSOA" (for outgoing Pix/transfers)
  const paraMatch = cleanText.match(/\bpara\s+([A-Za-z0-9\s\*\.\-\_]{2,35}?)(?:\s+(?:às|as|no dia|em|valor|com|\.|\,|$))/i);

  if (tipoItem === 'receita' && deMatch && deMatch[1].trim().length > 1) {
    descricao = `Pix de ${deMatch[1].trim()}`;
  } else if (emMatch && emMatch[1].trim().length > 1) {
    descricao = emMatch[1].trim();
  } else if (paraMatch && paraMatch[1].trim().length > 1) {
    descricao = `Pix para ${paraMatch[1].trim()}`;
  } else {
    // Fallback: search for words after "compra aprovada" or "compra de"
    if (tipoItem === 'receita') {
      descricao = `Pix Recebido - ${banco}`;
    } else {
      descricao = `Compra no ${banco}`;
    }
  }

  // Clean description punctuation and multiple spaces
  descricao = descricao
    .replace(/^[\s\.\,\-]+|[\s\.\,\-]+$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (!descricao) {
    descricao = tipoItem === 'receita' ? 'Entrada Pix' : `Despesa ${banco}`;
  }

  // 5. Intelligent Category Assignment
  let categoria = tipoItem === 'receita' ? 'Outros' : 'Outros';

  const descLower = descricao.toLowerCase();
  const fullLower = lower;

  if (tipoItem === 'receita') {
    if (fullLower.includes('salário') || fullLower.includes('salario') || fullLower.includes('holerite')) {
      categoria = 'Salário';
    } else if (fullLower.includes('rendimento') || fullLower.includes('dividendo') || fullLower.includes('juros')) {
      categoria = 'Investimentos';
    } else if (fullLower.includes('estorno') || fullLower.includes('devolução')) {
      categoria = 'Reembolso';
    } else if (customCategoriesReceita.includes('Pix')) {
      categoria = 'Pix';
    } else {
      categoria = 'Outros';
    }
  } else {
    // Despesas category inference
    if (
      descLower.includes('uber') ||
      descLower.includes('99') ||
      descLower.includes('posto') ||
      descLower.includes('combustivel') ||
      descLower.includes('gasolina') ||
      descLower.includes('estacionamento') ||
      descLower.includes('ipva') ||
      descLower.includes('sem parar') ||
      descLower.includes('veloe')
    ) {
      categoria = 'Transporte';
    } else if (
      descLower.includes('mercado') ||
      descLower.includes('supermercado') ||
      descLower.includes('padaria') ||
      descLower.includes('ifood') ||
      descLower.includes('burger') ||
      descLower.includes('mcdonald') ||
      descLower.includes('acougue') ||
      descLower.includes('hortifruti') ||
      descLower.includes('restaurante') ||
      descLower.includes('lanchonete') ||
      descLower.includes('pizza') ||
      descLower.includes('cafe')
    ) {
      categoria = 'Alimentação';
    } else if (
      descLower.includes('farmacia') ||
      descLower.includes('drogaria') ||
      descLower.includes('hospital') ||
      descLower.includes('laboratorio') ||
      descLower.includes('medico') ||
      descLower.includes('odonto') ||
      descLower.includes('unimed') ||
      descLower.includes('panvel') ||
      descLower.includes('raia') ||
      descLower.includes('drogasil')
    ) {
      categoria = 'Saúde';
    } else if (
      descLower.includes('netflix') ||
      descLower.includes('spotify') ||
      descLower.includes('cinema') ||
      descLower.includes('steam') ||
      descLower.includes('amazon prime') ||
      descLower.includes('hbo') ||
      descLower.includes('disney') ||
      descLower.includes('ingresso') ||
      descLower.includes('bar ') ||
      descLower.includes('cervejaria')
    ) {
      categoria = 'Lazer';
    } else if (
      descLower.includes('aluguel') ||
      descLower.includes('condominio') ||
      descLower.includes('enel') ||
      descLower.includes('cpfl') ||
      descLower.includes('sabesp') ||
      descLower.includes('luz') ||
      descLower.includes('agua') ||
      descLower.includes('internet') ||
      descLower.includes('claro') ||
      descLower.includes('vivo') ||
      descLower.includes('tim')
    ) {
      categoria = 'Moradia';
    } else if (
      descLower.includes('faculdade') ||
      descLower.includes('escola') ||
      descLower.includes('curso') ||
      descLower.includes('udemy') ||
      descLower.includes('livraria') ||
      descLower.includes('livro')
    ) {
      categoria = 'Educação';
    } else {
      categoria = 'Outros';
    }
  }

  // 6. Current Local Date (YYYY-MM-DD)
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const data = `${year}-${month}-${day}`;

  return {
    banco,
    descricao,
    valor,
    tipoItem,
    categoria,
    accountId: matchedAccountId,
    data
  };
}

/**
 * Helper to build a complete PendingSuggestion from raw notification text
 */
export function createPendingSuggestionFromNotification(
  rawText: string,
  accounts: BankAccount[] = [],
  userId: string = 'emersonrs70@gmail.com'
): PendingSuggestion | null {
  const parsed = parseBankNotification(textFix(rawText), accounts);
  if (!parsed) return null;

  return {
    id: safeRandomUUID(),
    rawText: rawText.trim(),
    banco: parsed.banco,
    descricao: parsed.descricao,
    valor: parsed.valor,
    tipoItem: parsed.tipoItem,
    categoria: parsed.categoria,
    accountId: parsed.accountId,
    data: parsed.data,
    status: 'pendente',
    userId,
    createdAt: new Date().toISOString()
  };
}

function textFix(str: string): string {
  return str.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
}
