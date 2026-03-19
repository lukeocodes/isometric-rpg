export interface AccountInfo {
  id: string;
  email: string;
  displayName: string;
  isOnboarded: boolean;
}

export interface CharacterSummary {
  id: string;
  name: string;
  race: string;
  level: number;
}

export class SessionState {
  private gameJwt: string | null = null;
  private account: AccountInfo | null = null;
  private characters: CharacterSummary[] = [];
  private pkceVerifier: string | null = null;

  setSession(jwt: string, account: AccountInfo, characters: CharacterSummary[]) {
    this.gameJwt = jwt;
    this.account = account;
    this.characters = characters;
    sessionStorage.setItem("gameJwt", jwt);
  }

  clearSession() {
    this.gameJwt = null;
    this.account = null;
    this.characters = [];
    sessionStorage.removeItem("gameJwt");
  }

  isAuthenticated(): boolean {
    return !!(this.gameJwt || sessionStorage.getItem("gameJwt"));
  }

  getToken(): string | null {
    return this.gameJwt || sessionStorage.getItem("gameJwt");
  }

  getAccount(): AccountInfo | null {
    return this.account;
  }

  getCharacters(): CharacterSummary[] {
    return this.characters;
  }

  setCharacters(chars: CharacterSummary[]) {
    this.characters = chars;
  }

  needsOnboarding(): boolean {
    return this.account !== null && !this.account.isOnboarded;
  }

  setPKCEVerifier(verifier: string) {
    this.pkceVerifier = verifier;
    sessionStorage.setItem("pkce_verifier", verifier);
  }

  getPKCEVerifier(): string | null {
    return this.pkceVerifier || sessionStorage.getItem("pkce_verifier");
  }

  clearPKCEVerifier() {
    this.pkceVerifier = null;
    sessionStorage.removeItem("pkce_verifier");
  }
}
