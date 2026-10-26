import React, { useState } from 'react';
import { X, Copy, Check, Smartphone, ShieldCheck, Zap } from 'lucide-react';

interface MacroDroidModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MacroDroidModal: React.FC<MacroDroidModalProps> = ({
  isOpen,
  onClose
}) => {
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedBody, setCopiedBody] = useState(false);

  if (!isOpen) return null;

  const webhookUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/webhook/bank-notification`
    : '/api/webhook/bank-notification';

  const webhookBodyTemplate = JSON.stringify(
    {
      text: '{not_text}',
      title: '{not_title}'
    },
    null,
    2
  );

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-fade-in">
      <div className="bg-white dark:bg-[#32323F] border border-zinc-200/80 dark:border-[#4C4E5D]/60 rounded-3xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col relative animate-scale-up">
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
          {/* Concept Banner */}
          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-[#252530] border border-zinc-200/80 dark:border-[#4C4E5D]/50 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-zinc-900 dark:text-[#DDD5D0]">
                Como funciona
              </p>
              <p className="text-zinc-500 dark:text-[#988E96] leading-relaxed">
                Ao receber uma notificação de compra ou Pix no celular, o <strong>MacroDroid</strong> envia o texto para o seu FintechCore. O sistema extrai automaticamente o valor, categoria e conta, exibindo a sugestão com 1 toque para aprovar.
              </p>
            </div>
          </div>

          {/* Webhook Configuration for MacroDroid */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-[#DDD5D0] flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-amber-500" />
              Dados para configurar a Macro
            </h3>

            {/* Step 1: URL */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-zinc-600 dark:text-[#BCABA8] uppercase tracking-wider">
                1. URL do Webhook (Método POST)
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

            {/* Step 3: Instructions */}
            <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-[#252530] border border-zinc-200/70 dark:border-[#4C4E5D]/40 space-y-2">
              <p className="font-bold text-zinc-800 dark:text-[#DDD5D0] text-[11px]">
                Passos no aplicativo MacroDroid (Android):
              </p>
              <ol className="list-decimal list-inside space-y-1 text-zinc-500 dark:text-[#988E96] text-[11px]">
                <li>Crie uma nova macro com <strong>Gatilho:</strong> Notificação &gt; Notificação Recebida &gt; Selecione seus bancos (Santander, Nubank, etc.).</li>
                <li>Adicione a <strong>Ação:</strong> Conectividade &gt; Requisição HTTP.</li>
                <li>Selecione <strong>POST</strong>, cole a URL acima, escolha <code>application/json</code> e cole o JSON.</li>
                <li>Salve a macro. Sempre que houver uma compra, ela aparecerá no FintechCore para aprovação.</li>
              </ol>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-200/80 dark:border-[#4C4E5D]/60 bg-zinc-50/80 dark:bg-[#252530]/60 flex items-center justify-between">
          <span className="text-[11px] text-zinc-500 dark:text-[#988E96]">
            💡 O JARVIS anunciará por voz e som sempre que uma compra for identificada.
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
