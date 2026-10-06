import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { PDFParse } from 'pdf-parse';
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

    if (!base64 && !text) {
      return res.status(400).json({ success: false, error: 'Nenhum conteúdo enviado para análise.' });
    }

    let rawExtractedText = text || '';
    const lowerFilename = filename.toLowerCase();

    // If file base64 is provided
    if (base64) {
      const buffer = Buffer.from(base64, 'base64');
      const isPdf = lowerFilename.endsWith('.pdf') || (buffer.length > 4 && buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46);

      if (isPdf) {
        // High-reliability server-side PDF text extraction
        const parser = new PDFParse(new Uint8Array(buffer));
        const textResult = await parser.getText();
        rawExtractedText = (textResult && typeof textResult === 'object' && 'text' in textResult) ? (textResult as any).text : String(textResult || '');
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
        error: 'O arquivo foi recebido, mas não contém texto extraível (pode ser um PDF protegido ou imagem escaneada).'
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

    return res.json({
      success: true,
      filename,
      itemsCount: items.length,
      textLength: rawExtractedText.length,
      items
    });
  } catch (error: any) {
    console.error('Server PDF Parsing Error:', error);
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
