import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldAlert, ExternalLink, Copy, Check, X, Globe, KeyRound } from 'lucide-react';
import { firebaseConfig } from '../lib/firebase';

interface FirebaseDomainModalProps {
  isOpen: boolean;
  onClose: () => void;
  errorCode?: string;
  errorMessage?: string;
}

export const FirebaseDomainModal: React.FC<FirebaseDomainModalProps> = ({
  isOpen,
  onClose,
  errorCode,
  errorMessage
}) => {
  const [copied, setCopied] = useState(false);
  const currentHostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const projectId = firebaseConfig?.projectId || 'grounded-alpha-fdw77';
  const consoleAuthSettingsUrl = `https://console.firebase.google.com/project/${projectId}/authentication/settings`;

  const handleCopyHostname = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(currentHostname);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="w-full max-w-lg bg-white dark:bg-[#32323F] border border-zinc-200 dark:border-[#4C4E5D]/60 rounded-2xl shadow-2xl p-6 text-zinc-900 dark:text-zinc-100 relative overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3 pb-4 border-b border-zinc-200/80 dark:border-[#4C4E5D]/60">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold tracking-tight">
                  Autorização de Domínio no Firebase
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Necessário para conectar pelo acesso do GitHub
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Explanation */}
          <div className="mt-4 space-y-4 text-xs">
            <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/40 text-amber-900 dark:text-amber-200/90 leading-relaxed">
              <p className="font-semibold mb-1 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 shrink-0" />
                Por que isso ocorre no GitHub?
              </p>
              O Google Firebase possui uma proteção de segurança rigorosa: apenas endereços previamente autorizados no console do seu projeto podem realizar login OAuth. No AI Studio ele já vem pré-autorizado, mas o domínio do seu GitHub precisa ser adicionado na lista de domínios permitidos.
            </div>

            {/* Current Hostname Display */}
            <div>
              <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                Domínio a autorizar:
              </label>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-100 dark:bg-[#252530] border border-zinc-200/80 dark:border-[#4C4E5D]/60 font-mono text-xs">
                <span className="font-bold text-zinc-900 dark:text-zinc-100 truncate">
                  {currentHostname || 'seu-usuario.github.io'}
                </span>
                <button
                  onClick={handleCopyHostname}
                  className="flex items-center gap-1 px-2.5 py-1 bg-white dark:bg-[#3B3B49] hover:bg-zinc-50 dark:hover:bg-[#2A2A30] border border-zinc-200 dark:border-[#333338] rounded-lg text-[11px] font-bold transition-all cursor-pointer text-zinc-700 dark:text-zinc-300 ml-2 shrink-0 active:scale-95"
                >
                  {copied ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-500" />
                      <span className="text-emerald-600 dark:text-emerald-400">Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copiar</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Step-by-step instructions */}
            <div className="space-y-2">
              <p className="font-bold text-zinc-800 dark:text-zinc-200">
                Passo a passo (leva menos de 1 minuto):
              </p>
              <ol className="list-decimal list-inside space-y-1.5 text-zinc-600 dark:text-zinc-300 pl-1 leading-relaxed">
                <li>
                  Abra as configurações do seu Firebase no botão abaixo.
                </li>
                <li>
                  Na aba <strong>Configurações (Settings)</strong>, desça até <strong>Domínios autorizados (Authorized domains)</strong>.
                </li>
                <li>
                  Clique em <strong>Adicionar domínio</strong>, cole <code className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono text-[11px]">{currentHostname || 'seu-usuario.github.io'}</code> e clique em <strong>Salvar</strong>.
                </li>
                <li>
                  Volte para esta tela e clique em <strong>Conectar Firebase</strong> novamente!
                </li>
              </ol>
            </div>

            {errorCode && (
              <p className="text-[10px] text-zinc-400 font-mono">
                Código do erro: {errorCode} {errorMessage ? `(${errorMessage})` : ''}
              </p>
            )}
          </div>

          {/* Footer Actions */}
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-end gap-2.5 pt-4 border-t border-zinc-200/80 dark:border-[#4C4E5D]/60">
            <button
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-[#222226] transition-colors cursor-pointer"
            >
              Fechar
            </button>
            <a
              href={consoleAuthSettingsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white transition-all shadow-xs cursor-pointer active:scale-95"
            >
              <span>Abrir Firebase Console</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
