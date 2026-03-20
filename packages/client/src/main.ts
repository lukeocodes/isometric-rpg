import { Router } from "./ui/Router";
import { UIManager } from "./ui/UIManager";
import { AuthManager } from "./auth/AuthManager";
import { SessionState } from "./state/SessionState";
import { Game } from "./engine/Game";
import { checkWebRTCSupport } from "./net/WebRTCCheck";
import type { LoadingScreen } from "./ui/screens/LoadingScreen";

let game: Game | null = null;

// Dev-only Playwright API
if (import.meta.env.DEV) {
  import("./dev/PlaywrightAPI").then(({ createPlaywrightAPI }) => {
    (window as any).__game = createPlaywrightAPI(() => game);
    console.log("[Dev] Playwright API available at window.__game");
  });
}

async function boot() {
  const session = new SessionState();
  const auth = new AuthManager(session);
  const uiManager = new UIManager();
  const router = new Router(uiManager, auth, session);

  // Early WebRTC check — runs in background while user logs in
  const webrtcCheck = checkWebRTCSupport();
  webrtcCheck.then((supported) => {
    if (!supported) {
      router.showError(
        "WebRTC is restricted in this browser. Use Chrome, Firefox, or Safari for the best experience."
      );
    }
  });

  const canvas = document.getElementById("render-canvas") as HTMLCanvasElement;

  router.setOnEnterGame(async (characterId: string, loading: LoadingScreen) => {
    if (game) game.stop();
    game = new Game(canvas);

    game.setOnDisconnect((reason) => {
      console.error("[Disconnect]", reason);
      if (game) { game.stop(); game = null; }
      session.clearSession();
      router.navigateTo("login");
      router.showError(`Disconnected from server: ${reason}. Please sign in again.`);
    });

    const token = session.getToken();
    if (!token) throw new Error("Not authenticated");

    loading.setStatus("Generating world...", 10);
    // Run worldgen and server connection in parallel
    await Promise.all([
      game.generateWorldAsync(42),
      (async () => {
        loading.setStatus("Connecting to server...", 30);
        await game.connectToServer(token, characterId);
        loading.setStatus("Loading entities...", 80);
      })(),
    ]);

    loading.setStatus("Entering world...", 95);
    game.start(characterId);

    // Give the HUD reference after Router swaps to it
    setTimeout(() => {
      const hud = (router as any)._activeHud;
      if (hud && game) game.setHUD(hud);

      // Expose audio dev API for console testing
      if (import.meta.env.DEV && game) {
        (window as any).__audio = {
          getState: () => game?.getAudioSystem().getMusicStateMachine()?.getState(),
          getCurrentSide: () => game?.getAudioSystem().getCrossfadeManager()?.getCurrentSide(),
          requestState: (s: string) => game?.getAudioSystem().getMusicStateMachine()?.requestState(s as any),
          forceState: (s: string) => game?.getAudioSystem().getMusicStateMachine()?.forceState(s as any),
          startTestTone: (side: string) => game?.getAudioSystem().getCrossfadeManager()?.startTestTone(side as any),
          stopTestTone: (side: string) => game?.getAudioSystem().getCrossfadeManager()?.stopTestTone(side as any),
          setIntensity: (v: number) => { if (game) game.getAudioSystem().intensity = v; },
          getIntensity: () => game?.getAudioSystem().intensity,
          getFadeValue: () => game?.getAudioSystem().getCrossfadeManager()?.getCrossFade().fade.value,
        };
        console.log("[Dev] Audio API available at window.__audio");
      }
    }, 50);
  });

  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  if (code) {
    await router.handleAuthCallback(code);
    return;
  }

  if (session.isAuthenticated()) {
    try {
      await auth.refreshSession();
      router.navigateTo(session.needsOnboarding() ? "onboarding" : "character-select");
    } catch {
      router.navigateTo("login");
    }
  } else {
    router.navigateTo("login");
  }
}

boot().catch(console.error);
