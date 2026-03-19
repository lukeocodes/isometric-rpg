import type { Screen } from "../UIManager";
import type { CharacterSummary } from "../../state/SessionState";

export class CharacterSelectScreen implements Screen {
  private characters: CharacterSummary[];
  private onPlay: (characterId: string) => void;
  private onCreate: () => void;
  private onLogout: () => void;

  constructor(
    characters: CharacterSummary[],
    onPlay: (characterId: string) => void,
    onCreate: () => void,
    onLogout: () => void,
  ) {
    this.characters = characters;
    this.onPlay = onPlay;
    this.onCreate = onCreate;
    this.onLogout = onLogout;
  }

  render(): HTMLElement {
    const container = document.createElement("div");
    container.style.cssText = `
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      width: 100%; height: 100%; gap: 24px; padding: 32px;
    `;

    const title = document.createElement("h2");
    title.textContent = "Select Character";
    title.style.cssText = "font-size: 28px; color: #e0e0e0; margin: 0;";
    container.appendChild(title);

    const grid = document.createElement("div");
    grid.style.cssText = "display: flex; gap: 16px; flex-wrap: wrap; justify-content: center;";

    for (const char of this.characters) {
      grid.appendChild(this.createCard(char));
    }

    if (this.characters.length < 5) {
      grid.appendChild(this.createNewCard());
    }

    container.appendChild(grid);

    const logoutBtn = document.createElement("button");
    logoutBtn.textContent = "Sign Out";
    logoutBtn.style.cssText = `
      padding: 10px 24px; font-size: 14px; background: transparent;
      color: #888; border: 1px solid #333; border-radius: 6px; cursor: pointer;
      margin-top: 16px;
    `;
    logoutBtn.onclick = () => this.onLogout();
    container.appendChild(logoutBtn);

    return container;
  }

  private createCard(char: CharacterSummary): HTMLElement {
    const card = document.createElement("div");
    card.style.cssText = `
      background: #16213e; border: 1px solid #333; border-radius: 12px;
      padding: 24px; width: 200px; text-align: center; cursor: pointer;
      transition: border-color 0.2s;
    `;
    card.onmouseenter = () => (card.style.borderColor = "#13ef93");
    card.onmouseleave = () => (card.style.borderColor = "#333");

    const avatar = document.createElement("div");
    avatar.style.cssText = `
      width: 64px; height: 64px; border-radius: 50%; margin: 0 auto 12px;
      background: #13ef9333; display: flex; align-items: center; justify-content: center;
      font-size: 24px; color: #13ef93;
    `;
    avatar.textContent = char.name.charAt(0).toUpperCase();

    const name = document.createElement("div");
    name.textContent = char.name;
    name.style.cssText = "font-size: 18px; font-weight: 600; color: #e0e0e0; margin-bottom: 4px;";

    const info = document.createElement("div");
    info.textContent = `${char.race.charAt(0).toUpperCase() + char.race.slice(1)} · Level ${char.level}`;
    info.style.cssText = "font-size: 13px; color: #888; margin-bottom: 16px;";

    const playBtn = document.createElement("button");
    playBtn.textContent = "Play";
    playBtn.style.cssText = `
      padding: 8px 24px; font-size: 14px; background: #13ef93; color: #1a1a2e;
      border: none; border-radius: 6px; cursor: pointer; font-weight: 600; width: 100%;
    `;
    playBtn.onclick = (e) => {
      e.stopPropagation();
      this.onPlay(char.id);
    };

    card.append(avatar, name, info, playBtn);
    card.onclick = () => this.onPlay(char.id);
    return card;
  }

  private createNewCard(): HTMLElement {
    const card = document.createElement("div");
    card.style.cssText = `
      background: #16213e; border: 2px dashed #333; border-radius: 12px;
      padding: 24px; width: 200px; text-align: center; cursor: pointer;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      min-height: 180px; transition: border-color 0.2s;
    `;
    card.onmouseenter = () => (card.style.borderColor = "#13ef93");
    card.onmouseleave = () => (card.style.borderColor = "#333");

    const plus = document.createElement("div");
    plus.textContent = "+";
    plus.style.cssText = "font-size: 48px; color: #555; margin-bottom: 8px;";

    const label = document.createElement("div");
    label.textContent = "New Character";
    label.style.cssText = "font-size: 14px; color: #888;";

    card.append(plus, label);
    card.onclick = () => this.onCreate();
    return card;
  }
}
