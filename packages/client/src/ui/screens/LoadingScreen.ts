import type { Screen } from "../UIManager";

export class LoadingScreen implements Screen {
  private container: HTMLElement | null = null;
  private statusEl: HTMLElement | null = null;
  private progressFill: HTMLElement | null = null;

  render(): HTMLElement {
    this.container = document.createElement("div");
    this.container.style.cssText = `
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      width: 100%; height: 100%; gap: 24px; background: #1a1a2e;
    `;

    const title = document.createElement("h1");
    title.textContent = "Isometric MMO";
    title.style.cssText = `
      font-size: 36px; font-weight: 300; letter-spacing: 4px;
      color: #e0e0e0; text-transform: uppercase;
    `;

    const progressTrack = document.createElement("div");
    progressTrack.style.cssText = `
      width: 280px; height: 4px; background: #333; border-radius: 2px; overflow: hidden;
    `;

    this.progressFill = document.createElement("div");
    this.progressFill.style.cssText = `
      height: 100%; width: 30%; background: #13ef93; border-radius: 2px;
      transition: width 0.3s ease;
    `;
    progressTrack.appendChild(this.progressFill);

    this.statusEl = document.createElement("div");
    this.statusEl.textContent = "Connecting...";
    this.statusEl.style.cssText = "font-size: 14px; color: #888; letter-spacing: 1px;";

    this.container.append(title, progressTrack, this.statusEl);
    return this.container;
  }

  setStatus(text: string, progress?: number) {
    if (this.statusEl) this.statusEl.textContent = text;
    if (this.progressFill && progress !== undefined) {
      this.progressFill.style.width = `${Math.min(100, Math.max(0, progress))}%`;
    }
  }
}
