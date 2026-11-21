// Minimal typings for the YouTube Playables SDK (https://www.youtube.com/game_api/v1).
declare global {
  interface Window {
    ytgame?: YTGame;
  }

  interface YTGame {
    IN_PLAYABLES_ENV: boolean;
    SDK_VERSION: string;
    game: {
      firstFrameReady(): void;
      gameReady(): void;
      loadData(): Promise<string>;
      saveData(data: string): Promise<void>;
    };
    system: {
      isAudioEnabled(): boolean;
      onAudioEnabledChange(cb: (enabled: boolean) => void): () => void;
      onPause(cb: () => void): () => void;
      onResume(cb: () => void): () => void;
      getLanguage(): Promise<string>;
    };
    engagement: {
      sendScore(score: { value: number }): Promise<void>;
    };
    health: {
      logError(): void;
      logWarning(): void;
    };
  }
}

export {};
