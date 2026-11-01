import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  MoreVertical, Bell, Zap, Volume2, VolumeX, Sun, Moon, Flame, Download, X,
  CheckCircle2, Sparkles, ChevronRight
} from 'lucide-react';
import { AppNotification } from '../types';
import { jarvisAudio, JarvisAudioSettings } from '../lib/jarvisAudio';

interface MobileHeaderMenuProps {
  notifications: AppNotification[];
  unreadNotificationsCount: number;
  onOpenNotifications: () => void;
  pendingSuggestionsCount: number;
  onOpenMacroDroid: () => void;
  isDarkMode: boolean;
  onToggleTheme: () => void;
  streak: number;
  onOpenStreak: () => void;
  deferredPrompt: any;
  onInstallApp: () => void;
}

export const MobileHeaderMenu: React.FC<MobileHeaderMenuProps> = ({
  notifications,
  unreadNotificationsCount,
  onOpenNotifications,
  pendingSuggestionsCount,
  onOpenMacroDroid,
  isDarkMode,
  onToggleTheme,
  streak,
  onOpenStreak,
  deferredPrompt,
  onInstallApp
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [audioSettings, setAudioSettings] = useState<JarvisAudioSettings>(jarvisAudio.getSettings());
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = jarvisAudio.subscribeSettings(setAudioSettings);
    return () => unsub();
  }, []);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const hasAlertBadge = unreadNotificationsCount > 0 || pendingSuggestionsCount > 0;

  const handleToggleAudio = (e: React.MouseEvent) => {
    e.stopPropagation();
    jarvisAudio.toggleMute();
  };

  return (
    <div className="relative" ref={menuRef}>
      {/* 3-dots trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Menu de opções rápidas"
        className={`p-2 rounded-xl border transition-all cursor-pointer relative flex items-center justify-center shrink-0 active:scale-95 ${
          isOpen
            ? 'bg-zinc-200 dark:bg-[#4C4E5D] text-zinc-900 dark:text-white border-zinc-300 dark:border-[#4C4E5D]'
            : 'bg-[#F3F1EB] dark:bg-[#252530] hover:bg-zinc-100 dark:hover:bg-[#4C4E5D]/40 text-zinc-700 dark:text-[#DDD5D0] border-[#E8E5DC] dark:border-[#4C4E5D]/60'
        }`}
        title="Mais opções"
      >
        <MoreVertical className="w-4 h-4" />
        {hasAlertBadge && (
          <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-rose-600 ring-2 ring-white dark:ring-[#252530]">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
          </span>
        )}
      </button>

      {/* Popover Menu for Mobile */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop for easy closing */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/30 backdrop-blur-2xs z-40 sm:hidden"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -8 }}
              transition={{ type: 'spring', stiffness: 380, damping: 28 }}
              className="fixed right-3 top-16 w-[calc(100vw-24px)] max-w-xs bg-white dark:bg-[#32323F] border border-zinc-200/90 dark:border-[#4C4E5D]/80 rounded-2xl shadow-2xl z-50 overflow-hidden divide-y divide-zinc-100 dark:divide-[#4C4E5D]/50"
            >
              {/* Menu Header */}
              <div className="px-4 py-3 bg-zinc-50 dark:bg-[#252530] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span className="text-xs font-black text-zinc-900 dark:text-white uppercase tracking-wider">
                    Opções Rápidas
                  </span>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Menu Items List */}
              <div className="p-2 space-y-1">
                {/* 1. Notificações */}
                <button
                  onClick={() => {
                    setIsOpen(false);
                    onOpenNotifications();
                  }}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-[#252530] transition-colors cursor-pointer text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                      <Bell className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-zinc-900 dark:text-[#DDD5D0] leading-tight">
                        Notificações
                      </p>
                      <p className="text-[10px] text-zinc-500 dark:text-[#988E96]">
                        Alertas do orçamento e sistema
                      </p>
                    </div>
                  </div>
                  {unreadNotificationsCount > 0 ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white animate-pulse">
                      {unreadNotificationsCount} novas
                    </span>
                  ) : (
                    <ChevronRight className="w-4 h-4 text-zinc-400" />
                  )}
                </button>

                {/* 2. Captura Bancária MacroDroid */}
                <button
                  onClick={() => {
                    setIsOpen(false);
                    onOpenMacroDroid();
                  }}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-[#252530] transition-colors cursor-pointer text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                      <Zap className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-zinc-900 dark:text-[#DDD5D0] leading-tight">
                        Captura Bancária (MacroDroid)
                      </p>
                      <p className="text-[10px] text-zinc-500 dark:text-[#988E96]">
                        Pix e cartões detectados
                      </p>
                    </div>
                  </div>
                  {pendingSuggestionsCount > 0 ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white animate-bounce">
                      {pendingSuggestionsCount} pendentes
                    </span>
                  ) : (
                    <ChevronRight className="w-4 h-4 text-zinc-400" />
                  )}
                </button>

                {/* 3. Efeitos Sci-Fi & Voz JARVIS */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-50/70 dark:bg-[#252530]/50 border border-zinc-200/60 dark:border-[#4C4E5D]/40">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      !audioSettings.muted
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : 'bg-zinc-200/60 dark:bg-zinc-800 text-zinc-400'
                    }`}>
                      {!audioSettings.muted ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-zinc-900 dark:text-[#DDD5D0] leading-tight">
                        Áudio & Voz JARVIS
                      </p>
                      <p className="text-[10px] text-zinc-500 dark:text-[#988E96]">
                        {!audioSettings.muted ? 'Efeitos sci-fi e anúncios ativos' : 'Som silenciado'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleToggleAudio}
                    className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                      !audioSettings.muted
                        ? 'bg-emerald-500 text-white'
                        : 'bg-zinc-200 dark:bg-[#4C4E5D] text-zinc-700 dark:text-zinc-200'
                    }`}
                  >
                    {!audioSettings.muted ? 'Ligado' : 'Mudo'}
                  </button>
                </div>

                {/* 4. Alternar Modo Noturno / Claro */}
                <button
                  onClick={onToggleTheme}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-[#252530] transition-colors cursor-pointer text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                      {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-zinc-700" />}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-zinc-900 dark:text-[#DDD5D0] leading-tight">
                        Tema Visual
                      </p>
                      <p className="text-[10px] text-zinc-500 dark:text-[#988E96]">
                        Modo {isDarkMode ? 'Escuro (Ativo)' : 'Claro (Ativo)'}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-[#252530] text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-[#4C4E5D]/60">
                    Alternar
                  </span>
                </button>

                {/* 5. Sequência Diária (Streak) */}
                <button
                  onClick={() => {
                    setIsOpen(false);
                    onOpenStreak();
                  }}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-[#252530] transition-colors cursor-pointer text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                      <Flame className="w-4 h-4 fill-amber-500" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-zinc-900 dark:text-[#DDD5D0] leading-tight">
                        Sequência de Registros
                      </p>
                      <p className="text-[10px] text-zinc-500 dark:text-[#988E96]">
                        {streak} {streak === 1 ? 'dia ativo' : 'dias ativos'} consecutivos
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-400" />
                </button>

                {/* 6. Instalar Aplicativo (PWA) */}
                {deferredPrompt && (
                  <button
                    onClick={() => {
                      setIsOpen(false);
                      onInstallApp();
                    }}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/40 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors cursor-pointer text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
                        <Download className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold leading-tight">
                          Instalar Aplicativo (PWA)
                        </p>
                        <p className="text-[10px] opacity-80">
                          Acesse direto pela tela inicial
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-600 text-white">
                      Instalar
                    </span>
                  </button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
