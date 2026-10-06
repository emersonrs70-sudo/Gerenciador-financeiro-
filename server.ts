import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { PDFParse } from 'pdf-parse';
import { GoogleGenAI } from '@google/genai';
import { parseSantanderStatement, parseOFXStatement, parseCSVStatement } from './src/lib/statementParser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Body parsers with generous limits for file uploads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', serverTime: new Date().toISOString() });
});

// Dedicated statement parsing endpoint (bypasses all browser web worker and CORS restrictions)
app.post('/api/parse-statement', async (req, res) => {
  try {
    const { base64, filename = '', text = '' } = req.body;
    console.log(`[API /api/parse-statement] Incoming request - filename: "${filename}", base64 length: ${base64 ? base64.length : 0}, text length: ${text ? text.length : 0}`);

    if (!base64 && !text) {
      return res.status(400).json({ success: false, error: 'Nenhum conteúdo enviado para análise.' });
    }

    const lowerFilename = filename.toLowerCase();
    const isPdf = base64 && (lowerFilename.endsWith('.pdf') || lowerFilename.includes('pdf') || base64.startsWith('JVBERi0'));

    // 1. If it's a PDF and GEMINI_API_KEY is available: Use Gemini 3.8 Flash for 100% human-grade PDF extraction
    if (isPdf && process.env.GEMINI_API_KEY) {
      try {
        console.log('[API /api/parse-statement] Using Gemini 3.8 Flash document analysis...');
        const ai = new GoogleGenAI({});
        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: [
            {
              role: 'user',
              parts: [
                {
                  inlineData: {
                    mimeType: 'application/pdf',
                    data: base64
                  }
                },
                {
                  text: `Você é um leitor contábil de extratos bancários de alta precisão.
Analise todas as páginas deste extrato bancário (Santander ou banco brasileiro).
Identifique cada transação financeira real nas seções de movimentação, transferências e pagamentos.

Regras importantes:
- Ignore linhas de resumo geral (saldo anterior, saldo final da conta, limites de crédito, total de créditos, total de débitos).
- Para cada lançamento individual, identifique:
  - data: no formato "YYYY-MM-DD" (se o ano for 2026 e o mês agosto, ex: "2026-08-03")
  - descricao: nome limpo com o tipo e favorecido (ex: "PIX Enviado: S de Lima Costa Panificad", "Cartão Débito: Grupo Rezende", "Salário: Líquido de Vencimento")
  - valor: número positivo (ex: 19.00)
  - tipoItem: "despesa" se for saída/débito/pagamento/saque, ou "receita" se for entrada/crédito/salário
  - categoria: escolha uma entre "Alimentação", "Transporte", "Moradia", "Saúde", "Lazer", "Educação", "Salário", "Pagamento de Fatura", "Investimentos", "Outros"

Responda exclusivamente com um array JSON válido contendo os objetos:
[
  {
    "data": "2026-08-03",
    "descricao": "PIX Enviado: S de Lima Costa Panificad",
    "valor": 19.00,
    "tipoItem": "despesa",
    "categoria": "Alimentação"
  }
]`
                }
              ]
            }
          ],
          config: {
            responseMimeType: 'application/json'
          }
        });

        const rawJsonText = response.text || '[]';
        const aiTransactions = JSON.parse(rawJsonText);

        if (Array.isArray(aiTransactions) && aiTransactions.length > 0) {
          const formattedItems = aiTransactions.map((t: any, idx: number) => ({
            id: `ai-${Date.now()}-${idx}`,
            data: t.data || new Date().toISOString().split('T')[0],
            descricao: t.descricao || 'Movimentação Bancária',
            valor: Math.abs(typeof t.valor === 'number' ? t.valor : parseFloat(String(t.valor).replace(',', '.'))),
            tipoItem: t.tipoItem === 'receita' ? 'receita' : 'despesa',
            categoria: t.categoria || 'Outros',
            categoriaSugeridaConfiavel: !!t.categoria && t.categoria !== 'Outros',
            isDuplicate: false,
            selected: true
          }));

          console.log(`[API /api/parse-statement] Gemini successfully parsed ${formattedItems.length} transactions from PDF!`);
          return res.json({
            success: true,
            source: 'gemini',
            filename,
            itemsCount: formattedItems.length,
            items: formattedItems
          });
        }
      } catch (geminiError: any) {
        console.warn('[API /api/parse-statement] Gemini PDF parsing note (falling back to local parser):', geminiError?.message || geminiError);
      }
    }

    // 2. Fallback: Local Server Parsing using pdf-parse and statementParser
    let rawExtractedText = text || '';

    if (base64) {
      const buffer = Buffer.from(base64, 'base64');
      const isBufferPdf = isPdf || (buffer.length > 4 && buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46);

      if (isBufferPdf) {
        console.log(`[API /api/parse-statement] Parsing PDF buffer locally (${buffer.length} bytes)...`);
        const parser = new PDFParse(new Uint8Array(buffer));
        const textResult = await parser.getText();
        rawExtractedText = (textResult && typeof textResult === 'object' && 'text' in textResult) ? (textResult as any).text : String(textResult || '');
        console.log(`[API /api/parse-statement] Extracted ${rawExtractedText.length} characters from PDF.`);
        try {
          await parser.destroy();
        } catch {
          // ignore cleanup err
        }
      } else if (lowerFilename.endsWith('.ofx')) {
        rawExtractedText = buffer.toString('latin1');
      } else {
        rawExtractedText = buffer.toString('utf-8');
      }
    }

    if (!rawExtractedText || rawExtractedText.trim().length === 0) {
      return res.status(422).json({
        success: false,
        error: 'O arquivo foi recebido, mas não contém texto extraível.'
      });
    }

    // Determine parser
    let items = [];
    if (lowerFilename.endsWith('.ofx') || rawExtractedText.includes('<OFX>') || rawExtractedText.includes('<STMTTRN>')) {
      items = parseOFXStatement(rawExtractedText);
    } else if (lowerFilename.endsWith('.csv') || (rawExtractedText.includes(';') && rawExtractedText.includes('\n'))) {
      items = parseCSVStatement(rawExtractedText);
    } else {
      items = parseSantanderStatement(rawExtractedText);
    }

    console.log(`[API /api/parse-statement] Parsed ${items.length} items from statement text.`);

    return res.json({
      success: true,
      source: 'local',
      filename,
      itemsCount: items.length,
      textLength: rawExtractedText.length,
      rawText: rawExtractedText,
      items
    });
  } catch (error: any) {
    console.error('[API /api/parse-statement] Server PDF Parsing Error:', error);
    return res.status(500).json({
      success: false,
      error: `Erro no servidor ao processar o arquivo: ${error?.message || 'Falha na leitura do PDF'}`
    });
  }
});

// Setup Vite in Dev mode or static files in Production
const isProd = process.env.NODE_ENV === 'production';

async function startServer() {
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, host: '0.0.0.0', port: PORT },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT} (${isProd ? 'Production' : 'Development'})`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
