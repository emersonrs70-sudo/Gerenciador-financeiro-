import { BankAccount, PendingSuggestion, safeRandomUUID } from '../types';

export interface ParseResult {
  banco: string;
  descricao: string;
  valor: number;
  tipoItem: 'despesa' | 'receita';
  categoria: string;
  accountId: string;
  data: string;
  parcelas?: number;
  valorTotal?: number;
}

/**
 * Intelligent parser for bank notifications from Brazilian banks
 * (Santander, Nubank, Itaú, Inter, C6, Bradesco, Caixa, Banco do Brasil, PicPay, Mercado Pago)
 * Handles:
 * - Pix enviado / Você transferiu / Pix realizado / Pix pago (Despesa)
 * - Pix recebido / Transferência recebida / Salário (Receita)
 * - Compras de cartão de crédito e débito (Despesa, com suporte a parcelas)
 * - Boletos pagos e transferências
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

  const cleanText = text.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
  const lower = cleanText.toLowerCase();

  // 1. Detect Installments (Parcelamento: ex: "em 3x de R$ 100,00", "em 3x", "parcelado em 5x")
  let parcelas: number | undefined = undefined;
  let valorTotal: number | undefined = undefined;

  const installmentDeRegex = /(?:em\s+)?([1-9]|1[0-9]|2[0-4]|3[6])x\s*(?:de\s*)?(?:r\$|brl|\$)?\s*([0-9]{1,3}(?:\.[0-9]{3})*|\d+)[,\.]([0-9]{2})/i;
  const matchInstDe = cleanText.match(installmentDeRegex);
  if (matchInstDe) {
    const pCount = parseInt(matchInstDe[1], 10);
    const instInt = matchInstDe[2].replace(/\./g, '');
    const instDec = matchInstDe[3];
    const valorParcela = parseFloat(`${instInt}.${instDec}`);
    if (valorParcela > 0 && pCount > 1) {
      parcelas = pCount;
      valorTotal = valorParcela * pCount;
    }
  } else {
    const simpleInstRegex = /(?:em|parcelad[oa]\s+em)\s*([1-9]|1[0-9]|2[0-4]|3[6])\s*(?:x|vezes|parcelas)\b/i;
    const matchSimpleInst = cleanText.match(simpleInstRegex);
    if (matchSimpleInst) {
      const parsedCount = parseInt(matchSimpleInst[1], 10);
      if (parsedCount > 1) {
        parcelas = parsedCount;
      }
    }
  }

  // 2. Detect Amount (R$ XX,XX or XX.XX or R$ XX)
  let valor = 0;

  // Standard R$ 45,90 or 45,90 BRL or R$ 1.250,00
  const amountWithDecimalsRegex = /(?:r\$|brl|\$)?\s*([0-9]{1,3}(?:\.[0-9]{3})*|\d+)[,\.]([0-9]{2})\b/i;
  const matchAmount = cleanText.match(amountWithDecimalsRegex);

  if (matchAmount) {
    const intPart = matchAmount[1].replace(/\./g, '');
    const decPart = matchAmount[2];
    valor = parseFloat(`${intPart}.${decPart}`);
  }

  // Fallback for integer currency e.g. "R$ 50" or "R$ 100" or "50 reais"
  if (isNaN(valor) || valor <= 0) {
    const intCurrencyRegex = /(?:r\$|brl|\$)\s*([0-9]{1,3}(?:\.[0-9]{3})*|\d+)\b/i;
    const matchInt = cleanText.match(intCurrencyRegex);
    if (matchInt) {
      valor = parseFloat(matchInt[1].replace(/\./g, ''));
    }
  }

  // Fallback for "XX reais"
  if (isNaN(valor) || valor <= 0) {
    const reaisRegex = /\b([0-9]{1,3}(?:\.[0-9]{3})*|\d+)\s*reais\b/i;
    const matchReais = cleanText.match(reaisRegex);
    if (matchReais) {
      valor = parseFloat(matchReais[1].replace(/\./g, ''));
    }
  }

  if (valorTotal && valorTotal > 0) {
    valor = valorTotal;
  }

  if (isNaN(valor) || valor <= 0) {
    return null; // A valid transaction notification must have an identifiable positive amount
  }

  // 3. Detect Institution / Bank
  let banco = 'Santander'; // Default primary bank
  let matchedAccountId = 'santander';

  if (lower.includes('santander') || lower.includes('way') || lower.includes('sx')) {
    banco = 'Santander';
    const cardAcc = accounts.find(a => a.tipo === 'credito' && (a.id.includes('santander') || a.nome.toLowerCase().includes('santander')));
    const checkingAcc = accounts.find(a => a.tipo === 'corrente' && a.id.includes('santander'));
    
    if (lower.includes('crédito') || lower.includes('cartão') || lower.includes('fatura') || lower.includes('sx') || parcelas) {
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
  } else if (lower.includes('banco do brasil') || lower.includes('bb ')) {
    banco = 'Banco do Brasil';
  } else if (lower.includes('caixa')) {
    banco = 'Caixa';
  }

  // 4. Detect Transaction Type (Receita vs Despesa)
  // Incoming income triggers
  const isIncomeKeyword =
    lower.includes('recebeu') ||
    lower.includes('recebido') ||
    lower.includes('transferência recebida') ||
    lower.includes('pix recebido') ||
    lower.includes('depósito recebido') ||
    lower.includes('reembolso') ||
    lower.includes('estorno') ||
    lower.includes('salário creditado') ||
    lower.includes('crédito em conta') ||
    lower.includes('rendimento');

  // Outgoing Pix triggers (Despesa)
  const isPixOutgoing =
    lower.includes('pix enviado') ||
    lower.includes('você transferiu') ||
    lower.includes('você enviou') ||
    lower.includes('você fez um pix') ||
    lower.includes('pix realizado') ||
    lower.includes('transferência realizada') ||
    lower.includes('pagamento pix') ||
    lower.includes('pix pago') ||
    lower.includes('envio de pix');

  let tipoItem: 'despesa' | 'receita' = isIncomeKeyword && !isPixOutgoing ? 'receita' : 'despesa';

  // 5. Extract Counterparty / Establishment (Descrição)
  let descricao = '';

  // Match "para NOME" (e.g. "para João da Silva" or "para Maria Santos")
  const paraMatch = cleanText.match(/\b(?:para|a favor de|destinat[aá]rio:?)\s+([A-Za-z0-9\s\*\.\-\_]{2,35}?)(?:(?:\s+(?:às|as|no dia|em|valor|com|final|\.|\,|$))|$)/i);
  // Match "de NOME" (e.g. "de João da Silva")
  const deMatch = cleanText.match(/\b(?:de|remetente:?)\s+([A-Za-z0-9\s\*\.\-\_]{2,35}?)(?:(?:\s+(?:às|as|no dia|em|valor|com|final|\.|\,|$))|$)/i);
  // Match "em NOME_DO_ESTABELECIMENTO" (e.g. "em Padaria do Zé")
  const emMatch = cleanText.match(/\bem\s+([A-Za-z0-9\s\*\.\-\_\&]{2,40}?)(?:(?:\s+(?:às|as|no dia|em|valor|com|final|\.|\,|$))|$)/i);

  if (tipoItem === 'receita') {
    if (deMatch && deMatch[1].trim().length > 1) {
      descricao = `Pix de ${deMatch[1].trim()}`;
    } else {
      descricao = `Pix Recebido - ${banco}`;
    }
  } else {
    // Outgoing transaction (Despesa)
    if (isPixOutgoing || lower.includes('pix')) {
      if (paraMatch && paraMatch[1].trim().length > 1) {
        descricao = `Pix para ${paraMatch[1].trim()}`;
      } else if (emMatch && emMatch[1].trim().length > 1) {
        descricao = `Pix em ${emMatch[1].trim()}`;
      } else {
        descricao = `Pix Enviado (${banco})`;
      }
    } else {
      // Card / Purchase
      if (emMatch && emMatch[1].trim().length > 1) {
        descricao = emMatch[1].trim();
      } else if (paraMatch && paraMatch[1].trim().length > 1) {
        descricao = `Pagamento para ${paraMatch[1].trim()}`;
      } else {
        descricao = `Compra no ${banco}`;
      }
    }
  }

  // Clean description
  descricao = descricao
    .replace(/^[\s\.\,\-]+|[\s\.\,\-]+$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (!descricao) {
    descricao = tipoItem === 'receita' ? 'Entrada Pix' : `Despesa ${banco}`;
  }

  // 6. Intelligent Category Assignment
  let categoria = 'Outros';

  const descLower = descricao.toLowerCase();
  const fullLower = lower;

  if (tipoItem === 'receita') {
    if (fullLower.includes('salário') || fullLower.includes('salario') || fullLower.includes('holerite')) {
      categoria = 'Salário';
    } else if (fullLower.includes('rendimento') || fullLower.includes('dividendo') || fullLower.includes('juros')) {
      categoria = 'Investimentos';
    } else if (fullLower.includes('estorno') || fullLower.includes('devolução') || fullLower.includes('reembolso')) {
      categoria = 'Reembolsos';
    } else {
      categoria = 'Pix';
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

  // 7. Current Date (YYYY-MM-DD)
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
    data,
    parcelas,
    valorTotal
  };
}

/**
 * Helper to build a complete PendingSuggestion from raw notification text and optional title
 */
export function createPendingSuggestionFromNotification(
  rawText: string,
  accounts: BankAccount[] = [],
  userId: string = 'emersonrs70@gmail.com',
  title?: string
): PendingSuggestion | null {
  // Combine title and raw text if available for maximal context (bank name, transaction type, etc.)
  const fullTextToParse = title && !rawText.toLowerCase().includes(title.toLowerCase())
    ? `${title}: ${rawText}`
    : rawText;

  const parsed = parseBankNotification(fullTextToParse, accounts);
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
    createdAt: new Date().toISOString(),
    parcelas: parsed.parcelas,
    valorTotal: parsed.valorTotal
  };
}
