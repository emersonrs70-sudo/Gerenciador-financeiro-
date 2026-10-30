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

  // Test notification simulator directly from the modal to verify end-to-end recognition
  const handleSendTestNotification = async (sampleText: string, sampleTitle: string, label: string) => {
    setIsTesting(true);
    setTestStatus(null);
    try {
      const res = await fetch(FIRESTORE_REST_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            text: {
              stringValue: sampleText
            },
            title: {
              stringValue: sampleTitle
            }
          }
        })
      });

      if (res.ok) {
        setTestStatus(`✓ Sucesso (200 OK): Teste de "${label}" enviado com sucesso à Nuvem Google! O card deve surgir no painel com som de alerta.`);
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

  const handleTestPing = () => {
    handleSendTestNotification(
      'Santander: Compra teste de R$ 35,00 aprovada no cartão Santander SX em Restaurante Sabor',
      'Santander',
      'Compra Cartão SX'
    );
  };

  const handleTestPixEnviado = () => {
    handleSendTestNotification(
      'Santander: Pix enviado de R$ 50,00 para João da Silva no dia de hoje',
      'Santander',
      'Pix Enviado (Despesa)'
    );
  };

  const handleTestPixRecebido = () => {
    handleSendTestNotification(
      'Santander: Pix recebido de R$ 120,00 de Maria Souza Santos',
      'Santander',
      'Pix Recebido (Receita)'
    );
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

          {/* Test Connection Buttons Grid */}
          <div className="space-y-2 p-3.5 rounded-2xl bg-zinc-50 dark:bg-[#252530] border border-zinc-200/80 dark:border-[#4C4E5D]/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                </span>
                <span className="font-bold text-zinc-900 dark:text-[#DDD5D0] text-xs">
                  Simulador de Teste (Nuvem Google)
                </span>
              </div>
              <span className="text-[10px] text-zinc-500 dark:text-[#988E96]">
                Valide o som, toast e card em tempo real
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
              <button
                onClick={handleTestPixEnviado}
                disabled={isTesting}
                className="px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-xs disabled:opacity-50"
                title="Testar Pix enviado (saída/despesa)"
              >
                <Activity className={`w-3 h-3 ${isTesting ? 'animate-spin' : ''}`} />
                <span>Testar Pix Enviado</span>
              </button>

              <button
                onClick={handleTestPixRecebido}
                disabled={isTesting}
                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-xs disabled:opacity-50"
                title="Testar Pix recebido (entrada/receita)"
              >
                <Activity className={`w-3 h-3 ${isTesting ? 'animate-spin' : ''}`} />
                <span>Testar Pix Recebido</span>
              </button>

              <button
                onClick={handleTestPing}
                disabled={isTesting}
                className="px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-xs disabled:opacity-50"
                title="Testar Compra no Cartão Santander SX"
              >
                <Activity className={`w-3 h-3 ${isTesting ? 'animate-spin' : ''}`} />
                <span>Testar Compra SX</span>
              </button>
            </div>
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

            {/* Explanation of Code 202 vs 200 */}
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 space-y-1">
              <p className="font-bold text-amber-800 dark:text-amber-300 text-[11px]">
                ⚠️ Atenção: Por que o seu teste pode ter mostrado "Código 202"?
              </p>
              <p className="text-[10px] text-zinc-600 dark:text-[#DDD5D0] leading-relaxed">
                O código <strong>202 (Accepted)</strong> no MacroDroid aparece quando você usa o <em>Webhook interno do MacroDroid</em> (<code className="text-amber-700 dark:text-amber-300 font-mono">trigger.macrodroid.com</code>) em vez da ação de <strong>Requisição HTTP</strong>. Para enviar ao FintechCore, a ação deve ser <strong>"Fazer Requisição HTTP" (POST)</strong> com a URL da Nuvem Google abaixo, que responde com <strong>Código 200 OK</strong>.
              </p>
            </div>

            {/* Step 1: URL */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-zinc-600 dark:text-[#BCABA8] uppercase tracking-wider">
                  1. URL do Conteúdo (Método POST)
                </label>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                  Nuvem Google (Responde 200 OK)
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

            {/* Step 4: Step-by-step verification checklist */}
            <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-[#252530] border border-zinc-200/70 dark:border-[#4C4E5D]/40 space-y-2.5">
              <p className="font-bold text-zinc-800 dark:text-[#DDD5D0] text-[11px] flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-amber-500" />
                Checklist para o Pix e Compras funcionarem na prática:
              </p>
              <ul className="space-y-2 text-zinc-600 dark:text-[#988E96] text-[11px]">
                <li className="flex items-start gap-1.5">
                  <span className="text-amber-500 font-bold shrink-0">1.</span>
                  <div>
                    <strong>Marcar Santander E Way no Gatilho:</strong> No Santander, compras e cartão geram notificação pelo <em>Santander Way</em>, mas <strong>Pix enviado e recebido gera notificação pelo app Santander principal</strong>. Selecione ambos no gatilho <em>"Notificação Recebida"</em>.
                  </div>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-amber-500 font-bold shrink-0">2.</span>
                  <div>
                    <strong>Filtro de Conteúdo = "Qualquer conteúdo":</strong> Em <em>Correspondência de Conteúdo</em> do gatilho, deixe <strong>Qualquer conteúdo</strong> marcado. Se tiver palavras específicas, o MacroDroid ignorará os Pix enviados.
                  </div>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-amber-500 font-bold shrink-0">3.</span>
                  <div>
                    <strong>Transações Suportadas:</strong> O sistema reconhece <strong>Pix enviado (despesa/saída)</strong>, <strong>Pix recebido (receita/entrada)</strong>, <strong>compras no cartão de crédito/débito</strong>, boletos e transferências.
                  </div>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-amber-500 font-bold shrink-0">4.</span>
                  <div>
                    <strong>Bateria do MacroDroid (Android):</strong> No Android, vá em <em>Configurações &gt; Aplicativos &gt; MacroDroid &gt; Bateria</em> e selecione <strong>"Sem restrições"</strong> para que o Android não pause o MacroDroid em segundo plano.
                  </div>
                </li>
              </ul>
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
