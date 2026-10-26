import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface WebhookNotification {
  id: string;
  text: string;
  title?: string;
  package?: string;
  timestamp: string;
}

// In-memory buffer of notifications received via webhook
const pendingWebhookNotifications: WebhookNotification[] = [];

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Basic middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // CORS for external webhook requests (e.g. from mobile phone MacroDroid / Tasker)
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-webhook-token');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Health check
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  let totalReceivedCount = 0;
  let lastReceivedWebhook: WebhookNotification | null = null;

  // Friendly GET endpoint so visiting the webhook in a browser confirms it is online
  app.get('/api/webhook/bank-notification', (req: Request, res: Response) => {
    res.status(200).json({
      status: 'online',
      message: 'Servidor do FintechCore ativo e pronto para receber notificações do MacroDroid!',
      methodRequired: 'POST',
      headersRequired: { 'Content-Type': 'application/json' },
      expectedJsonBody: {
        text: '{not_text}',
        title: '{not_title}'
      },
      serverTime: new Date().toISOString()
    });
  });

  // Webhook status endpoint for the UI to monitor connectivity and recent receipts
  app.get('/api/webhook/status', (req: Request, res: Response) => {
    res.json({
      status: 'online',
      totalReceived: totalReceivedCount,
      lastReceived: lastReceivedWebhook,
      serverTime: new Date().toISOString()
    });
  });

  // 1. Webhook endpoint to receive bank notifications from MacroDroid or external automation
  app.post('/api/webhook/bank-notification', (req: Request, res: Response) => {
    try {
      // Support body as JSON or raw string or form
      let text = '';
      let title = '';
      let pkg = '';

      if (typeof req.body === 'string') {
        text = req.body;
      } else if (req.body && typeof req.body === 'object') {
        text = req.body.text || req.body.mensagem || req.body.conteudo || req.body.body || '';
        title = req.body.title || req.body.titulo || req.body.app || '';
        pkg = req.body.package || req.body.pacote || '';
      }

      // If text query param was passed
      if (!text && req.query.text) {
        text = String(req.query.text);
      }

      if (!text || text.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Texto da notificação ausente. Envie { "text": "sua notificação aqui" }'
        });
      }

      const item: WebhookNotification = {
        id: `wh_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        text: text.trim(),
        title: title || undefined,
        package: pkg || undefined,
        timestamp: new Date().toISOString()
      };

      totalReceivedCount++;
      lastReceivedWebhook = item;
      pendingWebhookNotifications.push(item);
      console.log(`[Webhook] Notificação recebida com sucesso: "${item.text.slice(0, 60)}..."`);

      return res.status(200).json({
        success: true,
        message: 'Notificação recebida com sucesso pelo FintechCore!',
        id: item.id,
        receivedAt: item.timestamp
      });
    } catch (err: any) {
      console.error('[Webhook] Erro ao processar:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 2. Poll pending notifications for the web application
  app.get('/api/webhook/pending', (req: Request, res: Response) => {
    // Return all pending items and clear queue
    const items = [...pendingWebhookNotifications];
    pendingWebhookNotifications.length = 0; // Clear consumed buffer
    res.json({ success: true, notifications: items });
  });

  // 3. Vite development server integration vs Production static files
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[FintechCore Server] Servidor ativo em http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[FintechCore Server] Falha ao iniciar:', err);
  process.exit(1);
});
