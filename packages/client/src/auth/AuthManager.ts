import { SessionState } from "../state/SessionState";
import { generatePKCEPair } from "./PKCEUtils";

interface AuthConfig {
  clientId: string;
  issuer: string;
  redirectUri: string;
}

export class AuthManager {
  private session: SessionState;
  private config: AuthConfig | null = null;

  constructor(session: SessionState) {
    this.session = session;
  }

  async fetchConfig(): Promise<AuthConfig> {
    if (this.config) return this.config;
    const res = await fetch("/api/auth/config");
    this.config = await res.json();
    return this.config!;
  }

  async startLogin(): Promise<void> {
    const config = await this.fetchConfig();
    const { verifier, challenge } = await generatePKCEPair();
    this.session.setPKCEVerifier(verifier);

    const params = new URLSearchParams({
      response_type: "code",
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      scope: "openid profile email",
      code_challenge: challenge,
      code_challenge_method: "S256",
    });

    window.location.href = `${config.issuer}/oauth2/auth?${params.toString()}`;
  }

  async handleCallback(code: string): Promise<void> {
    const verifier = this.session.getPKCEVerifier();
    if (!verifier) throw new Error("Missing PKCE verifier");

    const res = await fetch("/api/auth/callback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, code_verifier: verifier }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Auth failed" }));
      throw new Error(err.detail || "Auth callback failed");
    }

    const data = await res.json();
    this.session.setSession(data.gameJwt, data.account, data.characters);
    this.session.clearPKCEVerifier();
    window.history.replaceState({}, "", "/");
  }

  async refreshSession(): Promise<void> {
    const token = this.session.getToken();
    if (!token) throw new Error("No token to refresh");

    const res = await fetch("/api/auth/refresh", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      this.session.clearSession();
      throw new Error("Session refresh failed");
    }

    const data = await res.json();
    this.session.setSession(data.gameJwt, data.account, data.characters);
  }

  async devLogin(username: string, password: string): Promise<void> {
    const res = await fetch("/api/auth/dev-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Login failed" }));
      throw new Error(err.detail || "Login failed");
    }

    const data = await res.json();
    this.session.setSession(data.gameJwt, data.account, data.characters);
  }

  logout() {
    this.session.clearSession();
  }
}
