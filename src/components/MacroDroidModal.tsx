import React, { useState, useEffect } from 'react';
import { X, Copy, Check, Smartphone, ShieldCheck, Zap, AlertTriangle, Activity, Send } from 'lucide-react';

interface MacroDroidModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CLOUD_RUN_BACKEND_URL = 'https://ais-pre-5bq7bqwn4g3kj3tckgqipi-628936338061.us-west2.run.app';

export const MacroDroidModal: React.FC<MacroDroidModalProps> = ({
  isOpen,
  onClose
}) => {
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedBody, setCopiedBody] = useState(false);
  const [serverStatus, setServerStatus] = useState<{
    online: boolean;
    lastReceived?: { text: string; timestamp: string };
    totalReceived?: number;
  }>({ online: false });
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  // Check if current hostname is GitHub Pages or other static hosting
  const isGitHubPages = typeof window !== 'undefined' && (
    window.location.hostname.includes('github.io') ||
    window.location.hostname.includes('pages.dev') ||
    window.location.hostname.includes('netlify.app')
  );

  // If on GitHub Pages, we must point directly to the live backend server
  const activeBaseUrl = isGitHubPages
    ? CLOUD_RUN_BACKEND_URL
    : (typeof window !== 'undefined' ? window.location.origin : CLOUD_RUN_BACKEND_URL);

  const webhookUrl = `${activeBaseUrl}/api/webhook/bank-notification`;

  const webhookBodyTemplate = JSON.stringify(
    {
      text: '{not_text}',
      title: '{not_title}'
    },
    null,
    2
  );

  // Check server health on open
  useEffect(() => {
    if (!isOpen) return;

    const checkServer = async () => {
      try {
        const res = await fetch(`${activeBaseUrl}/api/webhook/status`);
        if (res.ok) {
          const data = await res.json();
          setServerStatus({
            online: true,
            lastReceived: data.lastReceived,
            totalReceived: data.totalReceived
          });
        } else {
          setServerStatus({ online: false });
        }
      } catch {
        setServerStatus({ online: false });
      }
    };

    checkServer();
    const interval = setInterval(checkServer, 5000);
    return () => clearInterval(interval);
  }, [isOpen, activeBaseUrl]);

  if (!isOpen) return null;

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2500);
  };

  const handleCopyBody = () => {
    navigator.clipboard.writeText(webhookBodyTemplate);
    setCopiedBody(true);
    setTimeout(() => setCopiedBody(false), 2500);
  };

  // Test webhook directly from the modal to verify connectivity
  const handleTestPing = async () => {
    setIsTesting(true);
    setTestStatus(null);
    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: 'Santander: Compra teste de R$ 1,00 aprovada no cartão Santander SX',
          title: 'Santander'
        })
      });

      if (res.ok) {
        setTestStatus('✓ Sucesso (200 OK): O servidor recebeu a notificação teste com sucesso!');
      } else {
        setTestStatus(`Erro (${res.status}): O servidor retornou status ${res.status}.`);
      }
    } catch (err: any) {
      setTestStatus(`Falha de conexão: ${err.message || 'Não foi possível alcançar o servidor.'}`);
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-fade-in">
      <div className="bg-white dark:bg-[#32323F] border border-zinc-200/80 dark:border-[#4C4E5D]/60 rounded-3xl w-full max-w-xl max-h-[92vh] overflow-y-auto shadow-2xl flex flex-col relative animate-scale-up">
        {/* Header */}
        <div className="flex items-center justify-between p-5 sm:p-6 border-b border-zinc-200/80 dark:border-[#4C4E5D]/60 sticky top-0 bg-white/95 dark:bg-[#32323F]/95 backdrop-blur-sm z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-zinc-900 dark:text-[#DDD5D0] tracking-tight">
                Integração com Notificações Bancárias
              </h2>
              <p className="text-xs text-zinc-500 dark:text-[#988E96]">
                Conecte o MacroDroid (Android) para receber compras e Pix automaticamente
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-[#DDD5D0] hover:bg-zinc-100 dark:hover:bg-[#4C4E5D]/40 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 space-y-5 text-xs text-zinc-700 dark:text-[#DDD5D0]">
          {/* Status Live Indicator */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-zinc-50 dark:bg-[#252530] border border-zinc-200/80 dark:border-[#4C4E5D]/50">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-3 w-3">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${serverStatus.online ? 'bg-emerald-400 opacity-75' : 'bg-rose-400 opacity-75'}`} />
                <span className={`relative inline-flex rounded-full h-3 w-3 ${serverStatus.online ? 'bg-emerald-500' : 'bg-rose-500'}`} />
              </span>
              <div>
                <p className="font-bold text-zinc-900 dark:text-[#DDD5D0]">
                  Servidor Webhook: {serverStatus.online ? 'Online e Ativo' : 'Aguardando Servidor'}
                </p>
                <p className="text-[10px] text-zinc-500 dark:text-[#988E96]">
                  {serverStatus.lastReceived
                    ? `Último envio recebido: "${serverStatus.lastReceived.text.slice(0, 40)}..."`
                    : 'Nenhum disparo recebido ainda nesta sessão'}
                </p>
              </div>
            </div>

            <button
              onClick={handleTestPing}
              disabled={isTesting}
              className="px-3 py-1.5 bg-zinc-200/80 dark:bg-[#4C4E5D]/60 hover:bg-zinc-300 dark:hover:bg-[#4C4E5D] text-zinc-800 dark:text-[#DDD5D0] rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shrink-0"
              title="Testar se o servidor responde 200 OK"
            >
              <Activity className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
              <span>{isTesting ? 'Testando...' : 'Testar Conexão'}</span>
            </button>
          </div>

          {testStatus && (
            <div className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
              testStatus.startsWith('✓')
                ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-500/40 text-emerald-700 dark:text-emerald-400'
                : 'bg-rose-50 dark:bg-rose-950/20 border-rose-500/40 text-rose-700 dark:text-rose-400'
            }`}>
              <span>{testStatus}</span>
            </div>
          )}

          {/* Warning for GitHub Pages */}
          {isGitHubPages && (
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <span>Atenção: Hospedagem no GitHub Pages</span>
              </div>
              <p className="text-[11px] leading-relaxed text-zinc-600 dark:text-[#DDD5D0]">
                O GitHub Pages é uma hospedagem 100% estática (não roda Node.js/Express). Por isso, <strong>não use a URL do github.io</strong>. A URL abaixo já foi configurada automaticamente para o servidor ativo na nuvem (Cloud Run), garantindo que suas requisições cheguem com sucesso!
              </p>
            </div>
          )}

          {/* Webhook Configuration for MacroDroid */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-[#DDD5D0] flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-amber-500" />
              Dados para preencher no MacroDroid
            </h3>

            {/* Step 1: URL */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-zinc-600 dark:text-[#BCABA8] uppercase tracking-wider">
                1. URL de Destino (Método POST)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={webhookUrl}
                  className="flex-1 bg-zinc-100 dark:bg-[#252530] border border-zinc-200/80 dark:border-[#4C4E5D]/60 rounded-xl px-3 py-2 text-xs font-mono text-zinc-800 dark:text-[#DDD5D0] select-all outline-none"
                />
                <button
                  onClick={handleCopyUrl}
                  className="px-3.5 py-2 bg-[#32323F] hover:bg-[#4C4E5D] dark:bg-[#4C4E5D] dark:hover:bg-[#5B5D6E] text-white dark:text-[#DDD5D0] rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95 shrink-0"
                >
                  {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedUrl ? 'Copiado!' : 'Copiar URL'}</span>
                </button>
              </div>
            </div>

            {/* Step 2: Body payload */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-zinc-600 dark:text-[#BCABA8] uppercase tracking-wider">
                  2. Corpo da Requisição (JSON - application/json)
                </label>
                <button
                  onClick={handleCopyBody}
                  className="text-[11px] text-amber-600 dark:text-amber-400 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                >
                  {copiedBody ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedBody ? 'Copiado!' : 'Copiar JSON'}</span>
                </button>
              </div>
              <pre className="bg-zinc-100 dark:bg-[#252530] border border-zinc-200/80 dark:border-[#4C4E5D]/60 rounded-xl p-3 text-[11px] font-mono text-zinc-800 dark:text-[#DDD5D0] overflow-x-auto">
{webhookBodyTemplate}
              </pre>
            </div>

            {/* Step 3: Instructions & Troubleshooting */}
            <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-[#252530] border border-zinc-200/70 dark:border-[#4C4E5D]/40 space-y-2.5">
              <p className="font-bold text-zinc-800 dark:text-[#DDD5D0] text-[11px]">
                Como saber no MacroDroid se funcionou?
              </p>
              <ul className="space-y-1.5 text-zinc-500 dark:text-[#988E96] text-[11px] list-disc list-inside">
                <li>
                  <strong>Testar no celular:</strong> No MacroDroid, entre na sua macro, toque nos <strong>3 pontinhos (canto superior)</strong> e clique em <strong>"Testar Ações"</strong>.
                </li>
                <li>
                  <strong>Ver o log de resposta:</strong> Na tela inicial do MacroDroid, toque na aba <strong>"Registro do Sistema"</strong> (System Log). Lá aparecerá:
                  <br />
                  <code className="text-emerald-600 dark:text-emerald-400 font-mono">Requisição HTTP bem-sucedida: Código 200</code>.
                </li>
                <li>
                  <strong>No FintechCore:</strong> Quando a notificação chegar, o JARVIS avisará por voz e som, e o card com o botão <strong>[Aprovar Lançamento]</strong> aparecerá no topo do Dashboard.
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-200/80 dark:border-[#4C4E5D]/60 bg-zinc-50/80 dark:bg-[#252530]/60 flex items-center justify-between">
          <span className="text-[11px] text-zinc-500 dark:text-[#988E96]">
            💡 Compatível com Santander, Nubank, Itaú, Inter, C6 e qualquer app bancário.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#32323F] hover:bg-[#4C4E5D] dark:bg-[#4C4E5D] text-white dark:text-[#DDD5D0] rounded-xl text-xs font-bold cursor-pointer transition-all"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
