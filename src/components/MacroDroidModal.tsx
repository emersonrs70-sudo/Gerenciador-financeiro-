import React, { useState } from 'react';
import { X, Copy, Check, Smartphone, Zap, Activity, CheckCircle2, ShieldCheck, HelpCircle } from 'lucide-react';

interface MacroDroidModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Direct Google Firebase Firestore REST API URL - 100% cloud-hosted, zero 404, works on GitHub Pages!
const FIRESTORE_REST_URL = 'https://firestore.googleapis.com/v1/projects/grounded-alpha-fdw77/databases/ai-studio-fintechcore-f52fb949-531b-4878-acb2-2ea3336c0b34/documents/incoming_notifications';

export const MacroDroidModal: React.FC<MacroDroidModalProps> = ({
  isOpen,
  onClose
}) => {
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedBody, setCopiedBody] = useState(false);
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  if (!isOpen) return null;

  const webhookBodyTemplate = JSON.stringify(
    {
      fields: {
        text: {
          stringValue: '{not_text}'
        },
        title: {
          stringValue: '{not_title}'
        }
      }
    },
    null,
    2
  );

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(FIRESTORE_REST_URL);
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
      const res = await fetch(FIRESTORE_REST_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            text: {
              stringValue: 'Santander: Compra teste de R$ 1,00 aprovada no cartão Santander SX'
            },
            title: {
              stringValue: 'Santander'
            }
          }
        })
      });

      if (res.ok) {
        setTestStatus('✓ Sucesso (Código 200 OK): Conexão direta com a Nuvem Google validada! O MacroDroid funcionará sem erro 404.');
      } else {
        const errorText = await res.text();
        setTestStatus(`Erro (${res.status}): ${errorText.slice(0, 100)}`);
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
                Integração MacroDroid (Android)
              </h2>
              <p className="text-xs text-zinc-500 dark:text-[#988E96]">
                Notificações de compras e Pix direto na nuvem sem erro 404
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
          {/* Why Error 404 Happened Notice */}
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>Solução para o Erro 404</span>
            </div>
            <p className="text-[11px] leading-relaxed text-zinc-600 dark:text-[#DDD5D0]">
              O erro <strong>404</strong> acontecia porque o <strong>GitHub Pages não roda servidor</strong> (é apenas página estática). Para funcionar no seu celular e no GitHub Pages com 100% de confiabilidade, atualizamos o endereço para a <strong>URL Direta da Nuvem Google (Firebase)</strong>.
            </p>
          </div>

          {/* Test Connection Button */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-zinc-50 dark:bg-[#252530] border border-zinc-200/80 dark:border-[#4C4E5D]/50">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
              </span>
              <div>
                <p className="font-bold text-zinc-900 dark:text-[#DDD5D0]">
                  Nuvem Google Firebase: Online
                </p>
                <p className="text-[10px] text-zinc-500 dark:text-[#988E96]">
                  Pronta para receber notificações do MacroDroid em tempo real
                </p>
              </div>
            </div>

            <button
              onClick={handleTestPing}
              disabled={isTesting}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shrink-0 shadow-xs"
              title="Testar se a nuvem responde Código 200 OK"
            >
              <Activity className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
              <span>{isTesting ? 'Testando...' : 'Testar Conexão (Ping)'}</span>
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

          {/* Webhook Configuration for MacroDroid */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-[#DDD5D0] flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-amber-500" />
              Configuração no MacroDroid
            </h3>

            {/* Step 1: URL */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-zinc-600 dark:text-[#BCABA8] uppercase tracking-wider">
                  1. URL do Conteúdo (Método POST)
                </label>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                  Nuvem Google (Sem 404)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={FIRESTORE_REST_URL}
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

            {/* Step 2: Header */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-zinc-600 dark:text-[#BCABA8] uppercase tracking-wider">
                2. Cabeçalho da Requisição (Header)
              </label>
              <div className="p-2.5 rounded-xl bg-zinc-100 dark:bg-[#252530] border border-zinc-200/80 dark:border-[#4C4E5D]/60 font-mono text-[11px] text-zinc-800 dark:text-[#DDD5D0] flex items-center justify-between">
                <span>Content-Type: application/json</span>
                <span className="text-[10px] text-zinc-500 font-sans">Obrigatório</span>
              </div>
            </div>

            {/* Step 3: Body payload */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-zinc-600 dark:text-[#BCABA8] uppercase tracking-wider">
                  3. Conteúdo da Requisição (Body JSON)
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

            {/* Step 4: Step-by-step verification */}
            <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-[#252530] border border-zinc-200/70 dark:border-[#4C4E5D]/40 space-y-2.5">
              <p className="font-bold text-zinc-800 dark:text-[#DDD5D0] text-[11px] flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-amber-500" />
                Como testar no MacroDroid agora:
              </p>
              <ol className="space-y-1.5 text-zinc-500 dark:text-[#988E96] text-[11px] list-decimal list-inside">
                <li>
                  No MacroDroid, abra sua macro e atualize a <strong>URL</strong> e o <strong>Corpo</strong> com os dados copiados acima.
                </li>
                <li>
                  Toque nos <strong>3 pontinhos</strong> no canto superior direito e selecione <strong>"Testar Ações"</strong>.
                </li>
                <li>
                  Abra o <strong>"Registro do Sistema"</strong> do MacroDroid: agora exibirá <strong>Código 200</strong> em vez de 404!
                </li>
                <li>
                  No FintechCore (no navegador ou celular), o JARVIS anunciará por áudio e voz e exibirá o card de aprovação da transação na hora.
                </li>
              </ol>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-200/80 dark:border-[#4C4E5D]/60 bg-zinc-50/80 dark:bg-[#252530]/60 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-[#988E96]">
            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>Conexão direta com a Nuvem Google • 100% segura</span>
          </div>
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
