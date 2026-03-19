export class TokenStore {
  private token: string | null = null;

  setToken(token: string) {
    this.token = token;
    sessionStorage.setItem("gameJwt", token);
  }

  getToken(): string | null {
    return this.token || sessionStorage.getItem("gameJwt");
  }

  clearToken() {
    this.token = null;
    sessionStorage.removeItem("gameJwt");
  }

  isValid(): boolean {
    const token = this.getToken();
    if (!token) return false;

    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      return payload.exp * 1000 > Date.now();
    } catch {
      return false;
    }
  }
}
