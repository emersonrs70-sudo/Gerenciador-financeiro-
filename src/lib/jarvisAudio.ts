/**
 * JARVIS Audio & Sci-Fi Sound FX Engine
 * Combines procedural Web Audio API synthesis for zero-latency futuristic UI sounds
 * with calibrated Portuguese masculine speech synthesis tuned for a fluid, natural JARVIS persona.
 */

export interface JarvisAudioSettings {
  muted: boolean;
  volume: number;        // 0.0 to 1.0
  voiceEnabled: boolean;
  effectsEnabled: boolean;
  speechRate: number;    // 1.0 to 1.5, default 1.18 for fluid natural pacing
  selectedVoiceURI?: string;
}

const SETTINGS_KEY = 'fintech_jarvis_audio_settings';

const DEFAULT_SETTINGS: JarvisAudioSettings = {
  muted: false,
  volume: 0.85,
  voiceEnabled: true,
  effectsEnabled: true,
  speechRate: 1.18,      // Increased speed diminishes robotic artifacts significantly
  selectedVoiceURI: ''
};

export type SoundType = 'click' | 'success' | 'delete' | 'tab' | 'warning' | 'wake';

class JarvisAudioManager {
  private settings: JarvisAudioSettings;
  private audioCtx: AudioContext | null = null;
  private isSpeaking: boolean = false;
  private settingsListeners: Set<(settings: JarvisAudioSettings) => void> = new Set();
  private speakingListeners: Set<(isSpeaking: boolean) => void> = new Set();
  private cachedVoice: SpeechSynthesisVoice | null = null;
  private availableVoices: SpeechSynthesisVoice[] = [];
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.settings = this.loadSettings();
    if (typeof window !== 'undefined') {
      this.initVoices();
    }
  }

  private loadSettings(): JarvisAudioSettings {
    if (typeof window === 'undefined') return DEFAULT_SETTINGS;
    try {
      const stored = localStorage.getItem(SETTINGS_KEY);
      if (stored) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      }
    } catch {
      // ignore
    }
    return DEFAULT_SETTINGS;
  }

  public getSettings(): JarvisAudioSettings {
    return { ...this.settings };
  }

  public getAvailableVoices(): SpeechSynthesisVoice[] {
    return [...this.availableVoices];
  }

  public getActiveVoice(): SpeechSynthesisVoice | null {
    return this.cachedVoice;
  }

  public updateSettings(partial: Partial<JarvisAudioSettings>): void {
    this.settings = { ...this.settings, ...partial };
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
    } catch {
      // ignore
    }

    if (partial.selectedVoiceURI !== undefined) {
      this.reselectVoice();
    }

    this.notifySettings();

    // If muted or voice disabled, stop ongoing speech
    if ((this.settings.muted || !this.settings.voiceEnabled) && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      this.setSpeaking(false);
    }
  }

  public toggleMute(): boolean {
    const newMuted = !this.settings.muted;
    this.updateSettings({ muted: newMuted });
    if (!newMuted) {
      this.playSound('click');
    }
    return newMuted;
  }

  public subscribeSettings(listener: (settings: JarvisAudioSettings) => void): () => void {
    this.settingsListeners.add(listener);
    listener(this.getSettings());
    return () => this.settingsListeners.delete(listener);
  }

  public subscribeSpeaking(listener: (isSpeaking: boolean) => void): () => void {
    this.speakingListeners.add(listener);
    listener(this.isSpeaking);
    return () => this.speakingListeners.delete(listener);
  }

  private notifySettings(): void {
    for (const listener of this.settingsListeners) {
      listener(this.getSettings());
    }
  }

  private setSpeaking(speaking: boolean): void {
    if (this.isSpeaking !== speaking) {
      this.isSpeaking = speaking;
      for (const listener of this.speakingListeners) {
        listener(speaking);
      }
    }
  }

  /**
   * Lazily initialize AudioContext on user interaction to comply with browser autoplay policies.
   */
  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  /**
   * Procedural Sci-Fi Sound Generation via Web Audio API
   */
  public playSound(type: SoundType): void {
    if (this.settings.muted || !this.settings.effectsEnabled) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    const baseVol = Math.max(0, Math.min(1, this.settings.volume));
    const now = ctx.currentTime;

    switch (type) {
      case 'click': {
        // High-tech tactile micro-blip (1400Hz -> 800Hz, 30ms)
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1400, now);
        osc.frequency.exponentialRampToValueAtTime(800, now + 0.03);

        gain.gain.setValueAtTime(baseVol * 0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.03);
        break;
      }

      case 'tab': {
        // Smooth futuristic data sweep (440Hz -> 880Hz, 70ms)
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.07);

        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(baseVol * 0.28, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.08);
        break;
      }

      case 'success': {
        // Futuristic harmonic ascending chord (C5 - E5 - G5 - C6)
        const freqs = [523.25, 659.25, 783.99, 1046.50];
        freqs.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const noteStart = now + idx * 0.035;

          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, noteStart);

          gain.gain.setValueAtTime(baseVol * 0.26, noteStart);
          gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + 0.18);

          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(noteStart);
          osc.stop(noteStart + 0.2);
        });
        break;
      }

      case 'delete': {
        // Subtle downward sci-fi dissolution glissando (580Hz -> 180Hz)
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(580, now);
        osc.frequency.exponentialRampToValueAtTime(180, now + 0.12);

        gain.gain.setValueAtTime(baseVol * 0.22, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.14);
        break;
      }

      case 'warning': {
        // Dual-tone cautionary harmonic pulse (350Hz + 525Hz)
        [350, 525].forEach((freq) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now);
          osc.frequency.setValueAtTime(freq * 1.1, now + 0.06);

          gain.gain.setValueAtTime(baseVol * 0.32, now);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);

          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.17);
        });
        break;
      }

      case 'wake': {
        // Signature JARVIS interface greeting tone (three fast harmonic blips)
        [659.25, 880, 1174.66].forEach((f, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const start = now + idx * 0.045;

          osc.type = 'sine';
          osc.frequency.setValueAtTime(f, start);

          gain.gain.setValueAtTime(baseVol * 0.35, start);
          gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.14);

          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(start);
          osc.stop(start + 0.15);
        });
        break;
      }
    }
  }

  /**
   * Reselect voice based on user preference or automatic best masculine Portuguese matching
   */
  private reselectVoice(): void {
    if (this.availableVoices.length === 0) return;

    // 1. If user explicitly picked a voice URI, find and use it
    if (this.settings.selectedVoiceURI) {
      const match = this.availableVoices.find(v => v.voiceURI === this.settings.selectedVoiceURI);
      if (match) {
        this.cachedVoice = match;
        return;
      }
    }

    const isFemaleName = (name: string): boolean => {
      const lower = name.toLowerCase();
      const femaleKeywords = [
        'maria', 'luciana', 'francisca', 'female', 'mulher', 'fernanda',
        'leticia', 'camila', 'vitoria', 'joana', 'raquel', 'zira', 'helena', 'elza'
      ];
      return femaleKeywords.some(kw => lower.includes(kw));
    };

    const isMaleName = (name: string): boolean => {
      const lower = name.toLowerCase();
      const maleKeywords = [
        'daniel', 'felipe', 'luciano', 'antonio', 'alvaro', 'jorge', 'male',
        'homem', 'ricardo', 'pedro', 'gabriel', 'carlos', 'man', 'brasileiro'
      ];
      return maleKeywords.some(kw => lower.includes(kw));
    };

    // 2. Priority A: Explicitly male Portuguese voice (pt-BR or pt-PT)
    const explicitMalePtVoice = this.availableVoices.find(v => {
      const lang = v.lang.toLowerCase();
      const isPt = lang.includes('pt') || lang.includes('br');
      return isPt && isMaleName(v.name) && !isFemaleName(v.name);
    });

    if (explicitMalePtVoice) {
      this.cachedVoice = explicitMalePtVoice;
      return;
    }

    // 3. Priority B: Any Portuguese voice that is NOT explicitly named female
    const nonFemalePtVoice = this.availableVoices.find(v => {
      const lang = v.lang.toLowerCase();
      const isPt = lang.includes('pt') || lang.includes('br');
      return isPt && !isFemaleName(v.name);
    });

    if (nonFemalePtVoice) {
      this.cachedVoice = nonFemalePtVoice;
      return;
    }

    // 4. Priority C: Any pt-BR voice
    const ptBrVoice = this.availableVoices.find(v => v.lang.toLowerCase().replace('_', '-').includes('pt-br'));
    if (ptBrVoice) {
      this.cachedVoice = ptBrVoice;
      return;
    }

    // 5. Priority D: Any Portuguese voice
    const ptVoice = this.availableVoices.find(v => v.lang.toLowerCase().startsWith('pt'));
    if (ptVoice) {
      this.cachedVoice = ptVoice;
      return;
    }

    // Fallback: system default
    this.cachedVoice = this.availableVoices[0] || null;
  }

  /**
   * Initialize and select best masculine Portuguese JARVIS voice
   */
  private initVoices(): void {
    if (!('speechSynthesis' in window)) return;

    const load = () => {
      const voices = window.speechSynthesis.getVoices();
      if (!voices || voices.length === 0) return;
      this.availableVoices = voices;
      this.reselectVoice();
    };

    load();
    window.speechSynthesis.onvoiceschanged = () => {
      load();
    };
  }

  /**
   * Speak with JARVIS persona
   * @param text Sentence to speak
   * @param options Config options: interrupt, debounceMs
   */
  public speak(text: string, options: { interrupt?: boolean; debounceMs?: number } = {}): void {
    if (this.settings.muted || !this.settings.voiceEnabled) return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    const executeSpeak = () => {
      try {
        if (options.interrupt !== false) {
          window.speechSynthesis.cancel();
        }

        const utterance = new SpeechSynthesisUtterance(text);
        if (this.cachedVoice) {
          utterance.voice = this.cachedVoice;
        }

        // JARVIS Natural Calibration:
        // rate ~1.18: Faster, fluid, eliminates robotic dragging and pauses
        // pitch ~0.94: Naturally masculine and clear without heavy synthetic modulation
        utterance.pitch = 0.94;
        utterance.rate = this.settings.speechRate || 1.18;
        utterance.volume = Math.max(0, Math.min(1, this.settings.volume));
        utterance.lang = 'pt-BR';

        utterance.onstart = () => {
          this.setSpeaking(true);
        };

        utterance.onend = () => {
          this.setSpeaking(false);
        };

        utterance.onerror = () => {
          this.setSpeaking(false);
        };

        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.warn('[JARVIS Voice] Synthesis error:', err);
        this.setSpeaking(false);
      }
    };

    if (options.debounceMs && options.debounceMs > 0) {
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
      }
      this.debounceTimer = setTimeout(() => {
        executeSpeak();
        this.debounceTimer = null;
      }, options.debounceMs);
    } else {
      executeSpeak();
    }
  }

  /**
   * Pre-packaged JARVIS vocal statements
   */
  public announceNavigation(tabName: string): void {
    this.playSound('tab');
    const announcements: Record<string, string> = {
      dashboard: 'Painel principal consolidado, senhor.',
      geral: 'Visão geral do orçamento em exibição.',
      graficos: 'Carregando gráficos e distribuição por categorias.',
      calendario: 'Calendário de vencimentos sincronizado.',
      cartoes: 'Faturas e cartões de crédito em análise.',
      transacoes: 'Extrato financeiro e lançamentos ativos.',
      sonhos: 'Metas e projetos de futuro carregados.',
      contas: 'Saldos das instituições bancárias atualizados.',
      categorias: 'Classificação de despesas e receitas.',
      ia: 'Consultor pessoal ativado. Como posso ser útil, senhor?'
    };

    const text = announcements[tabName] || `Acessando ${tabName}.`;
    this.speak(text, { interrupt: true, debounceMs: 140 });
  }

  public announceTransactionAdded(tipo: 'despesa' | 'receita', valor: number, desc?: string): void {
    this.playSound('success');
    const valorFormatado = valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const tipoTexto = tipo === 'despesa' ? 'Despesa' : 'Receita';
    const text = `${tipoTexto} de ${valorFormatado} registrada com sucesso, senhor.`;
    this.speak(text, { interrupt: true });
  }

  public announceTransactionUpdated(): void {
    this.playSound('success');
    this.speak('Registro financeiro atualizado com sucesso, senhor.', { interrupt: true });
  }

  public announceTransactionDeleted(): void {
    this.playSound('delete');
    this.speak('Registro financeiro removido com sucesso, senhor.', { interrupt: true });
  }

  public announceNotification(title: string): void {
    this.playSound('warning');
    this.speak(`Notificação do sistema: ${title}`, { interrupt: true });
  }

  public announceStreak(dias: number): void {
    this.playSound('wake');
    const text = dias === 1
      ? 'Sequência diária iniciada. Excelente primeiro passo, senhor.'
      : `Sequência de ${dias} dias mantida. Sua disciplina financeira permanece impecável, senhor.`;
    this.speak(text, { interrupt: true });
  }

  public testVoice(): void {
    this.playSound('wake');
    setTimeout(() => {
      this.speak('Olá, senhor. Sistemas de voz do JARVIS operando com velocidade calibrada e entonação natural.', { interrupt: true });
    }, 180);
  }
}

export const jarvisAudio = new JarvisAudioManager();
