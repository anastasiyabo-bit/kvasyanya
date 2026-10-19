/* Thin wrapper over Yandex Games SDK v2. Works without the SDK (local dev / other hosts). */

interface YaPlayer {
  getData(keys?: string[]): Promise<Record<string, unknown>>;
  setData(data: Record<string, unknown>, flush?: boolean): Promise<void>;
}

interface YaSdk {
  features?: {
    LoadingAPI?: { ready(): void };
    GameplayAPI?: { start(): void; stop(): void };
  };
  adv: {
    showFullscreenAdv(o: { callbacks: Record<string, (...a: unknown[]) => void> }): void;
    showRewardedVideo(o: { callbacks: Record<string, (...a: unknown[]) => void> }): void;
  };
  getPlayer(o?: { scopes?: boolean }): Promise<YaPlayer>;
  on?(event: string, cb: (...a: unknown[]) => void): void;
  environment?: { i18n?: { lang?: string } };
  EVENTS?: {
    ACCOUNT_SELECTION_DIALOG_CLOSED: string;
    HISTORY_BACK: string;
    EXIT: string;
  };
}

declare global {
  interface Window {
    YaGames?: { init(): Promise<YaSdk> };
  }
}

type Listener = () => void;

const INTERSTITIAL_COOLDOWN_MS = 70_000;
const CIS = new Set(['ru', 'be', 'kk', 'uk', 'uz']);

class YandexBridge {
  sdk: YaSdk | null = null;
  player: YaPlayer | null = null;
  adShowing = false;
  /** Raw ISO 639-1 from SDK. Always captured at init for requirement 2.14. */
  detectedLang = 'ru';
  private gameplay = false;
  private lastInterstitial = 0;
  private pauseListeners: Listener[] = [];
  private resumeListeners: Listener[] = [];

  async init(): Promise<void> {
    try {
      if (!window.YaGames) {
        if (import.meta.env.DEV) {
          this.captureLang(undefined);
          return;
        }
        await waitFor(() => !!window.YaGames, 8_000);
        if (!window.YaGames) await loadScript('/sdk.js', 12_000);
      }
      if (!window.YaGames) {
        this.captureLang(undefined);
        return;
      }
      this.sdk = await withTimeout(window.YaGames.init(), 10_000);
      // Requirement 2.14: read environment.i18n.lang at startup, even for a RU-only game.
      try {
        const i18n = this.sdk.environment && this.sdk.environment.i18n;
        this.captureLang(i18n ? i18n.lang : undefined);
      } catch {
        this.captureLang(undefined);
      }
      this.sdk.on?.('game_api_pause', () => this.emitPause());
      this.sdk.on?.('game_api_resume', () => this.emitResume());
      const closed = this.sdk.EVENTS?.ACCOUNT_SELECTION_DIALOG_CLOSED;
      if (closed) {
        this.sdk.on?.(closed, () => {
          window.location.reload();
        });
      }
    } catch {
      this.sdk = null;
      this.captureLang(undefined);
    }
  }

  private captureLang(raw: string | undefined) {
    const code = (raw || 'ru').toLowerCase().slice(0, 2);
    this.detectedLang = code || 'ru';
    const htmlLang = CIS.has(this.detectedLang) ? 'ru' : this.detectedLang;
    document.documentElement.lang = htmlLang;
  }

  async loadPlayerData(): Promise<Record<string, unknown> | null> {
    if (!this.sdk) return null;
    try {
      this.player = await withTimeout(this.sdk.getPlayer({ scopes: false }), 8_000);
      const data = await withTimeout(this.player.getData(), 8_000);
      return (data?.save as Record<string, unknown>) ?? null;
    } catch {
      return null;
    }
  }

  saveRemote(data: unknown) {
    if (!this.player) return;
    this.player.setData({ save: data }, true).catch(() => undefined);
  }

  ready() {
    try {
      this.sdk?.features?.LoadingAPI?.ready();
    } catch {
      /* ignore */
    }
  }

  gameplayStart() {
    if (this.gameplay) return;
    this.gameplay = true;
    try {
      this.sdk?.features?.GameplayAPI?.start();
    } catch {
      /* ignore */
    }
  }

  gameplayStop() {
    if (!this.gameplay) return;
    this.gameplay = false;
    try {
      this.sdk?.features?.GameplayAPI?.stop();
    } catch {
      /* ignore */
    }
  }

  onPause(cb: Listener) {
    this.pauseListeners.push(cb);
  }

  onResume(cb: Listener) {
    this.resumeListeners.push(cb);
  }

  private emitPause() {
    for (const l of this.pauseListeners) l();
  }

  private emitResume() {
    for (const l of this.resumeListeners) l();
  }

  canShowInterstitial() {
    return Date.now() - this.lastInterstitial >= INTERSTITIAL_COOLDOWN_MS;
  }

  /** Resolves when the ad is closed (or immediately if there is none). */
  showInterstitial(): Promise<void> {
    if (!this.sdk || this.adShowing || !this.canShowInterstitial()) return Promise.resolve();
    return this.runAd((callbacks) => this.sdk!.adv.showFullscreenAdv({ callbacks }), false).then(() => undefined);
  }

  /** Resolves true only if the player watched the video to the end. */
  showRewarded(): Promise<boolean> {
    if (!this.sdk) {
      // Local / GitHub Pages: no Yandex SDK, still grant the optional reward.
      if (!window.YaGames) return new Promise((r) => setTimeout(() => r(true), 400));
      return Promise.resolve(false);
    }
    if (this.adShowing) return Promise.resolve(false);
    return this.runAd((callbacks) => this.sdk!.adv.showRewardedVideo({ callbacks }), true);
  }

  private runAd(
    show: (callbacks: Record<string, (...a: unknown[]) => void>) => void,
    trackReward: boolean,
  ): Promise<boolean> {
    return new Promise((resolve) => {
      let rewarded = false;
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        this.adShowing = false;
        this.emitResume();
        resolve(trackReward ? rewarded : false);
      };
      try {
        show({
          onOpen: () => {
            this.adShowing = true;
            this.lastInterstitial = Date.now();
            this.emitPause();
          },
          onRewarded: () => {
            rewarded = true;
          },
          onClose: () => finish(),
          onError: () => finish(),
          onOffline: () => finish(),
        });
      } catch {
        finish();
      }
      setTimeout(() => {
        if (!this.adShowing) finish();
      }, 8_000);
      setTimeout(finish, 120_000);
    });
  }
}

function waitFor(pred: () => boolean, ms: number): Promise<void> {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const tick = () => {
      if (pred() || Date.now() - t0 >= ms) return resolve();
      window.setTimeout(tick, 50);
    };
    tick();
  });
}

function loadScript(src: string, timeout: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    const t = setTimeout(() => reject(new Error('sdk timeout')), timeout);
    s.onload = () => {
      clearTimeout(t);
      resolve();
    };
    s.onerror = () => {
      clearTimeout(t);
      reject(new Error('sdk load error'));
    };
    document.head.appendChild(s);
  });
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

export const Ya = new YandexBridge();
