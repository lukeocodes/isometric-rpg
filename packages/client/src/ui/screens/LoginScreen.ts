import type { Screen } from "../UIManager";

export class LoginScreen implements Screen {
  private onLogin: () => void;
  private onDevLogin: (username: string, password: string) => void;

  constructor(onLogin: () => void, onDevLogin?: (username: string, password: string) => void) {
    this.onLogin = onLogin;
    this.onDevLogin = onDevLogin || (() => {});
  }

  render(): HTMLElement {
    const container = document.createElement("div");
    container.style.cssText = `
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      width: 100%; height: 100%; gap: 32px;
    `;

    const title = document.createElement("h1");
    title.textContent = "Isometric MMO";
    title.style.cssText = `
      font-size: 48px; font-weight: 300; letter-spacing: 4px;
      color: #e0e0e0; text-transform: uppercase;
    `;

    const subtitle = document.createElement("p");
    subtitle.textContent = "A world awaits";
    subtitle.style.cssText = "font-size: 16px; color: #888; letter-spacing: 2px;";

    // Dev login form
    const form = document.createElement("div");
    form.style.cssText = `
      display: flex; flex-direction: column; gap: 12px; width: 280px;
      background: #16213e; border: 1px solid #333; border-radius: 12px; padding: 24px;
    `;

    const formLabel = document.createElement("div");
    formLabel.textContent = "Dev Login";
    formLabel.style.cssText = "font-size: 14px; color: #888; text-align: center; margin-bottom: 4px;";

    const usernameInput = document.createElement("input");
    usernameInput.type = "text";
    usernameInput.placeholder = "Username";
    usernameInput.style.cssText = this.inputStyle();

    const passwordInput = document.createElement("input");
    passwordInput.type = "password";
    passwordInput.placeholder = "Password";
    passwordInput.style.cssText = this.inputStyle();

    const errorEl = document.createElement("div");
    errorEl.style.cssText = "color: #ff6347; font-size: 13px; min-height: 18px; text-align: center;";

    const loginBtn = document.createElement("button");
    loginBtn.textContent = "Sign In";
    loginBtn.style.cssText = `
      padding: 12px 32px; font-size: 16px; background: #13ef93; color: #1a1a2e;
      border: none; border-radius: 6px; cursor: pointer; font-weight: 600;
      letter-spacing: 1px; transition: background 0.2s;
    `;
    loginBtn.onmouseenter = () => (loginBtn.style.background = "#0fd882");
    loginBtn.onmouseleave = () => (loginBtn.style.background = "#13ef93");

    const doLogin = () => {
      const username = usernameInput.value.trim();
      if (!username) {
        errorEl.textContent = "Username required";
        return;
      }
      errorEl.textContent = "";
      loginBtn.disabled = true;
      loginBtn.textContent = "Signing in...";
      this.onDevLogin(username, passwordInput.value);
    };

    loginBtn.onclick = doLogin;
    usernameInput.onkeydown = (e) => { if (e.key === "Enter") passwordInput.focus(); };
    passwordInput.onkeydown = (e) => { if (e.key === "Enter") doLogin(); };

    form.append(formLabel, usernameInput, passwordInput, errorEl, loginBtn);

    container.append(title, subtitle, form);

    // Auto-focus username
    setTimeout(() => usernameInput.focus(), 50);

    return container;
  }

  private inputStyle(): string {
    return `
      width: 100%; padding: 10px 12px; font-size: 14px; background: #0a0a1a;
      color: #e0e0e0; border: 1px solid #333; border-radius: 6px; box-sizing: border-box;
    `;
  }
}
