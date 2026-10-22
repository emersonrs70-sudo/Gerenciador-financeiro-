import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Volume2, VolumeX, Mic, BellRing, Sparkles, Play, Gauge } from 'lucide-react';
import { jarvisAudio, JarvisAudioSettings } from '../lib/jarvisAudio';

export const AudioControls: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [settings, setSettings] = useState<JarvisAudioSettings>(jarvisAudio.getSettings());
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubSettings = jarvisAudio.subscribeSettings(setSettings);
    const unsubSpeaking = jarvisAudio.subscribeSpeaking(setIsSpeaking);

    const updateVoices = () => {
      setAvailableVoices(jarvisAudio.getAvailableVoices());
    };
    updateVoices();

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }

    return () => {
      unsubSettings();
      unsubSpeaking();
    };
  }, []);

  // Filter Portuguese or relevant voices for selection
  const ptVoices = availableVoices.filter(v => {
    const lang = v.lang.toLowerCase();
    return lang.includes('pt') || lang.includes('br');
  });

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
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

  const handleToggleMute = () => {
    jarvisAudio.toggleMute();
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value);
    jarvisAudio.updateSettings({ volume: vol, muted: vol === 0 ? true : settings.muted });
  };

  const handleSpeedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rate = parseFloat(e.target.value);
    jarvisAudio.updateSettings({ speechRate: rate });
  };

  const handleVoiceSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    jarvisAudio.updateSettings({ selectedVoiceURI: e.target.value });
  };

  const handleToggleVoice = () => {
    const nextVal = !settings.voiceEnabled;
    jarvisAudio.updateSettings({ voiceEnabled: nextVal });
    if (nextVal && !settings.muted) {
      jarvisAudio.speak('Voz do JARVIS reativada, senhor.', { interrupt: true });
    }
  };

  const handleToggleEffects = () => {
    const nextVal = !settings.effectsEnabled;
    jarvisAudio.updateSettings({ effectsEnabled: nextVal });
    if (nextVal && !settings.muted) {
      jarvisAudio.playSound('success');
    }
  };

  const handleTest = () => {
    jarvisAudio.testVoice();
  };

  const activeVoice = jarvisAudio.getActiveVoice();

  return (
    <div className="relative" ref={containerRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        title={settings.muted ? 'Áudio JARVIS Silenciado' : 'Controles de Áudio & Voz JARVIS'}
        className={`relative p-2 rounded-xl transition-all cursor-pointer border flex items-center justify-center active:scale-95 ${
          settings.muted
            ? 'bg-zinc-100 hover:bg-zinc-200/70 dark:bg-[#252530] dark:hover:bg-[#4C4E5D]/50 border-zinc-200/80 dark:border-[#4C4E5D]/60 text-zinc-400 dark:text-zinc-500'
            : isSpeaking
            ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-600 dark:text-cyan-400 shadow-xs shadow-cyan-500/20 animate-pulse'
            : 'bg-zinc-100 hover:bg-zinc-200/70 dark:bg-[#252530] dark:hover:bg-[#4C4E5D]/50 border-zinc-200/80 dark:border-[#4C4E5D]/60 text-zinc-700 dark:text-[#DDD5D0]'
        }`}
      >
        {settings.muted ? (
          <VolumeX className="w-4 h-4" />
        ) : (
          <Volume2 className="w-4 h-4" />
        )}

        {/* Real-time speaking holographic indicator dot */}
        {!settings.muted && (
          <span
            className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full transition-colors ${
              isSpeaking
                ? 'bg-cyan-400 ring-2 ring-cyan-400/30 animate-ping'
                : 'bg-emerald-500'
            }`}
          />
        )}
      </button>

      {/* Popover Card */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -8 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-84 bg-white dark:bg-[#1E1E26] rounded-2xl shadow-2xl border border-zinc-200/80 dark:border-[#4C4E5D]/60 z-50 overflow-hidden text-zinc-900 dark:text-white"
          >
            {/* Header */}
            <div className="p-3.5 border-b border-zinc-100 dark:border-[#4C4E5D]/40 bg-zinc-50/70 dark:bg-[#252530]/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-lg ${isSpeaking ? 'bg-cyan-500/20 text-cyan-500' : 'bg-zinc-200/80 dark:bg-[#32323F] text-zinc-700 dark:text-[#DDD5D0]'}`}>
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-1.5">
                    Sistema de Áudio JARVIS
                  </h4>
                  <p className="text-[10px] text-zinc-500 dark:text-[#988E96]">
                    {settings.muted ? 'Silenciado' : isSpeaking ? 'Falando no momento...' : 'Ativo e em prontidão'}
                  </p>
                </div>
              </div>

              {/* Master Mute Button */}
              <button
                onClick={handleToggleMute}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
                  settings.muted
                    ? 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900/60 text-red-600 dark:text-red-400 hover:bg-red-100'
                    : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/60 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100'
                }`}
              >
                {settings.muted ? 'Desmutar' : 'Silenciar'}
              </button>
            </div>

            {/* Body */}
            <div className="p-4 space-y-3.5 text-xs">
              {/* Volume Slider */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-zinc-600 dark:text-[#DDD5D0]">
                  <span className="font-medium">Volume Geral</span>
                  <span className="font-mono text-[11px] tabular-nums font-bold text-zinc-900 dark:text-white">
                    {settings.muted ? '0%' : `${Math.round(settings.volume * 100)}%`}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={settings.muted ? 0 : settings.volume}
                  onChange={handleVolumeChange}
                  className="w-full h-1.5 bg-zinc-200 dark:bg-[#32323F] rounded-lg appearance-none cursor-pointer accent-cyan-500"
                />
              </div>

              {/* Speech Rate Slider (Fluency / Less robotic) */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-zinc-600 dark:text-[#DDD5D0]">
                  <span className="font-medium flex items-center gap-1.5">
                    <Gauge className="w-3.5 h-3.5 text-cyan-500" />
                    Velocidade da Voz (Fluidez)
                  </span>
                  <span className="font-mono text-[11px] tabular-nums font-bold text-cyan-600 dark:text-cyan-400">
                    {(settings.speechRate || 1.18).toFixed(2)}x
                  </span>
                </div>
                <input
                  type="range"
                  min="1.0"
                  max="1.4"
                  step="0.02"
                  value={settings.speechRate || 1.18}
                  onChange={handleSpeedChange}
                  className="w-full h-1.5 bg-zinc-200 dark:bg-[#32323F] rounded-lg appearance-none cursor-pointer accent-cyan-500"
                />
                <div className="flex justify-between text-[9px] text-zinc-400 dark:text-zinc-500">
                  <span>Padrão (1.0x)</span>
                  <span className="font-medium text-cyan-600 dark:text-cyan-400">Natural rápida (1.18x)</span>
                  <span>Dinâmica (1.4x)</span>
                </div>
              </div>

              {/* Voice Selector if browser has multiple voices */}
              {ptVoices.length > 0 && (
                <div className="space-y-1 pt-1 border-t border-zinc-100 dark:border-[#4C4E5D]/40">
                  <label className="text-[10px] text-zinc-500 dark:text-[#988E96] font-medium block">
                    Voz Masculina Selecionada
                  </label>
                  <select
                    value={settings.selectedVoiceURI || activeVoice?.voiceURI || ''}
                    onChange={handleVoiceSelect}
                    className="w-full p-1.5 rounded-lg text-[11px] bg-zinc-50 dark:bg-[#252530] border border-zinc-200 dark:border-[#4C4E5D]/60 text-zinc-800 dark:text-[#DDD5D0] outline-none cursor-pointer truncate"
                  >
                    {ptVoices.map(v => (
                      <option key={v.voiceURI} value={v.voiceURI}>
                        {v.name} ({v.lang})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Toggles */}
              <div className="space-y-2 pt-1 border-t border-zinc-100 dark:border-[#4C4E5D]/40">
                {/* Voice toggle */}
                <button
                  type="button"
                  onClick={handleToggleVoice}
                  className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-zinc-50 dark:hover:bg-[#252530] transition-colors cursor-pointer text-left"
                >
                  <div className="flex items-center gap-2">
                    <Mic className="w-3.5 h-3.5 text-cyan-500" />
                    <div>
                      <div className="font-semibold text-zinc-800 dark:text-[#DDD5D0]">Voz Natural Masculina JARVIS</div>
                      <div className="text-[10px] text-zinc-500 dark:text-[#988E96]">Feedback falado em ações e telas</div>
                    </div>
                  </div>
                  <div
                    className={`w-9 h-5 rounded-full transition-colors relative flex items-center p-0.5 ${
                      settings.voiceEnabled && !settings.muted
                        ? 'bg-cyan-500'
                        : 'bg-zinc-300 dark:bg-[#4C4E5D]'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white transition-transform ${
                        settings.voiceEnabled && !settings.muted
                          ? 'translate-x-4'
                          : 'translate-x-0'
                      }`}
                    />
                  </div>
                </button>

                {/* SFX toggle */}
                <button
                  type="button"
                  onClick={handleToggleEffects}
                  className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-zinc-50 dark:hover:bg-[#252530] transition-colors cursor-pointer text-left"
                >
                  <div className="flex items-center gap-2">
                    <BellRing className="w-3.5 h-3.5 text-amber-500" />
                    <div>
                      <div className="font-semibold text-zinc-800 dark:text-[#DDD5D0]">Efeitos Sonoros Sci-Fi</div>
                      <div className="text-[10px] text-zinc-500 dark:text-[#988E96]">Sons sutis de interface e notificações</div>
                    </div>
                  </div>
                  <div
                    className={`w-9 h-5 rounded-full transition-colors relative flex items-center p-0.5 ${
                      settings.effectsEnabled && !settings.muted
                        ? 'bg-cyan-500'
                        : 'bg-zinc-300 dark:bg-[#4C4E5D]'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white transition-transform ${
                        settings.effectsEnabled && !settings.muted
                          ? 'translate-x-4'
                          : 'translate-x-0'
                      }`}
                    />
                  </div>
                </button>
              </div>

              {/* Test Voice CTA */}
              <button
                type="button"
                onClick={handleTest}
                className="w-full py-2 px-3 bg-zinc-900 hover:bg-zinc-800 dark:bg-cyan-600 dark:hover:bg-cyan-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs active:scale-98"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Testar Voz do JARVIS</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
