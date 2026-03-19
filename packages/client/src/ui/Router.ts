import { UIManager } from "./UIManager";
import { AuthManager } from "../auth/AuthManager";
import { SessionState } from "../state/SessionState";
import { LoginScreen } from "./screens/LoginScreen";
import { OnboardingScreen } from "./screens/OnboardingScreen";
import { CharacterCreateScreen, type CharacterCreateData } from "./screens/CharacterCreateScreen";
import { CharacterSelectScreen } from "./screens/CharacterSelectScreen";
import { GameHUD } from "./screens/GameHUD";
import { LoadingScreen } from "./screens/LoadingScreen";

export type ScreenName =
  | "login"
  | "onboarding"
  | "character-create"
  | "character-select"
  | "game";

export class Router {
  private uiManager: UIManager;
  private auth: AuthManager;
  private session: SessionState;
  private currentScreen: ScreenName | null = null;
  private onEnterGame: ((characterId: string, loading: LoadingScreen) => Promise<void>) | null = null;
  private _pendingCharId: string | null = null;
  private _activeHud: GameHUD | null = null;

  constructor(uiManager: UIManager, auth: AuthManager, session: SessionState) {
    this.uiManager = uiManager;
    this.auth = auth;
    this.session = session;
  }

  setOnEnterGame(handler: (characterId: string, loading: LoadingScreen) => Promise<void>) {
    this.onEnterGame = handler;
  }

  navigateTo(screen: ScreenName) {
    this.currentScreen = screen;

    switch (screen) {
      case "login":
        this.uiManager.showScreen(
          new LoginScreen(
            () => this.auth.startLogin(),
            (username, password) => this.handleDevLogin(username, password),
          )
        );
        break;

      case "onboarding":
        this.uiManager.showScreen(
          new OnboardingScreen(async () => {
            const token = this.session.getToken();
            if (token) {
              await fetch("/api/characters/onboard", {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
              });
            }
            this.navigateTo("character-create");
          })
        );
        break;

      case "character-create":
        this.uiManager.showScreen(
          new CharacterCreateScreen(
            (data: CharacterCreateData) => this.createCharacter(data),
            () => this.navigateTo("character-select"),
          )
        );
        break;

      case "character-select":
        this.uiManager.showScreen(
          new CharacterSelectScreen(
            this.session.getCharacters(),
            (charId: string) => this.enterGame(charId),
            () => this.navigateTo("character-create"),
            () => {
              this.auth.logout();
              this.navigateTo("login");
            },
          )
        );
        break;

      case "game": {
        const loading = new LoadingScreen();
        this.uiManager.showScreen(loading);
        if (this.onEnterGame && this._pendingCharId) {
          const charId = this._pendingCharId;
          this._pendingCharId = null;
          this.onEnterGame(charId, loading).then(() => {
            const hud = new GameHUD();
            this.uiManager.showScreen(hud);
            this._activeHud = hud;
          }).catch((err) => {
            console.error("Failed to enter game:", err);
            this.navigateTo("character-select");
            this.showError(err?.message || "Failed to connect to server");
          });
        }
        break;
      }
    }
  }

  async handleAuthCallback(code: string) {
    try {
      await this.auth.handleCallback(code);
      this.navigateTo(
        this.session.needsOnboarding() ? "onboarding" : "character-select"
      );
    } catch (err) {
      console.error("Auth callback failed:", err);
      this.navigateTo("login");
    }
  }

  showError(message: string) {
    const overlay = this.uiManager.getOverlay();
    const toast = document.createElement("div");
    toast.style.cssText = `
      position: fixed; top: 24px; left: 50%; transform: translateX(-50%);
      background: #cc3333dd; color: #fff; padding: 14px 28px; border-radius: 8px;
      font-size: 14px; z-index: 9999; pointer-events: auto; cursor: pointer;
      box-shadow: 0 4px 12px rgba(0,0,0,0.4);
    `;
    toast.textContent = message;
    toast.onclick = () => toast.remove();
    overlay.appendChild(toast);
    setTimeout(() => toast.remove(), 5000);
  }

  getCurrentScreen(): ScreenName | null {
    return this.currentScreen;
  }

  private async createCharacter(data: CharacterCreateData) {
    const token = this.session.getToken();
    if (!token) {
      this.navigateTo("login");
      return;
    }

    const res = await fetch("/api/characters", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Failed to create character" }));
      alert(err.detail || "Failed to create character");
      return;
    }

    // Refresh character list
    await this.refreshCharacters();
    this.navigateTo("character-select");
  }

  private async refreshCharacters() {
    const token = this.session.getToken();
    if (!token) return;

    const res = await fetch("/api/characters", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      this.session.setCharacters(data.characters);
    }
  }

  private async handleDevLogin(username: string, password: string) {
    try {
      await this.auth.devLogin(username, password);
      this.navigateTo(
        this.session.needsOnboarding() ? "onboarding" : "character-select"
      );
    } catch (err) {
      console.error("Dev login failed:", err);
      this.navigateTo("login");
    }
  }

  private enterGame(characterId: string) {
    this._pendingCharId = characterId;
    this.navigateTo("game");
  }
}
