import type { Screen } from "../UIManager";

export interface TargetInfo {
  name: string;
  hp: number;
  maxHp: number;
}

export class GameHUD implements Screen {
  private container: HTMLElement | null = null;
  private targetPanel: HTMLElement | null = null;
  private targetName: HTMLElement | null = null;
  private targetHpFill: HTMLElement | null = null;
  private targetHpText: HTMLElement | null = null;
  private autoAttackBtn: HTMLElement | null = null;
  private combatIndicator: HTMLElement | null = null;
  private playerPanel: HTMLElement | null = null;

  private onAutoAttackToggle: (() => void) | null = null;

  setOnAutoAttackToggle(handler: () => void) {
    this.onAutoAttackToggle = handler;
  }

  render(): HTMLElement {
    this.container = document.createElement("div");
    this.container.style.cssText = "width: 100%; height: 100%; position: relative; pointer-events: none;";
    // All child panels re-enable pointer-events individually

    this.container.appendChild(this.createPlayerInfo());
    this.container.appendChild(this.createTargetPanel());
    this.container.appendChild(this.createActionBar());

    return this.container;
  }

  updateTarget(info: TargetInfo | null) {
    if (!this.targetPanel) return;

    if (!info) {
      this.targetPanel.style.display = "none";
      return;
    }

    this.targetPanel.style.display = "block";
    if (this.targetName) this.targetName.textContent = info.name;
    if (this.targetHpFill) {
      const pct = Math.max(0, (info.hp / info.maxHp) * 100);
      this.targetHpFill.style.width = `${pct}%`;
      this.targetHpFill.style.background = pct > 50 ? "#e74c3c" : pct > 25 ? "#e67e22" : "#c0392b";
    }
    if (this.targetHpText) this.targetHpText.textContent = `${info.hp} / ${info.maxHp}`;
  }

  updateAutoAttack(active: boolean) {
    if (!this.autoAttackBtn) return;
    this.autoAttackBtn.style.background = active ? "#cc333388" : "#0a0a1a88";
    this.autoAttackBtn.style.borderColor = active ? "#ff4444" : "#444";
    this.autoAttackBtn.style.color = active ? "#ff6666" : "#555";
  }

  updateCombat(inCombat: boolean) {
    if (!this.combatIndicator) return;
    this.combatIndicator.style.display = inCombat ? "block" : "none";
    if (this.playerPanel) {
      this.playerPanel.style.borderColor = inCombat ? "#cc3333" : "#333";
    }
  }

  updatePlayerHp(hp: number, maxHp: number, mana: number, maxMana: number, stamina: number, maxStamina: number) {
    this.updateBar("hp", hp, maxHp);
    this.updateBar("mp", mana, maxMana);
    this.updateBar("st", stamina, maxStamina);
  }

  private updateBar(id: string, value: number, max: number) {
    const fill = this.container?.querySelector(`#bar-fill-${id}`) as HTMLElement | null;
    const text = this.container?.querySelector(`#bar-text-${id}`) as HTMLElement | null;
    if (fill) fill.style.width = `${Math.max(0, (value / max) * 100)}%`;
    if (text) text.textContent = `${value}`;
  }

  private createActionBar(): HTMLElement {
    const bar = document.createElement("div");
    bar.style.cssText = `
      position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); pointer-events: auto;
      display: flex; gap: 4px; background: #16213ecc; border: 1px solid #333;
      border-radius: 8px; padding: 8px;
    `;

    // Auto-attack button (first slot)
    this.autoAttackBtn = document.createElement("div");
    this.autoAttackBtn.style.cssText = `
      width: 52px; height: 52px; background: #0a0a1a88;
      border: 2px solid #444; border-radius: 6px;
      display: flex; align-items: center; justify-content: center; flex-direction: column;
      color: #555; font-size: 10px; cursor: pointer;
      transition: all 0.15s; user-select: none;
    `;
    this.autoAttackBtn.innerHTML = `<span style="font-size:18px">⚔</span><span>Attack</span>`;
    this.autoAttackBtn.title = "Toggle Auto-Attack (Caps Lock)";
    this.autoAttackBtn.onclick = () => {
      if (this.onAutoAttackToggle) this.onAutoAttackToggle();
    };
    bar.appendChild(this.autoAttackBtn);

    // Remaining empty slots
    for (let i = 1; i < 6; i++) {
      const slot = document.createElement("div");
      slot.style.cssText = `
        width: 52px; height: 52px; background: #0a0a1a88;
        border: 1px solid #444; border-radius: 6px;
        display: flex; align-items: center; justify-content: center;
        color: #555; font-size: 12px; cursor: pointer;
        transition: border-color 0.15s;
      `;
      slot.textContent = String(i + 1);
      slot.onmouseenter = () => (slot.style.borderColor = "#13ef93");
      slot.onmouseleave = () => (slot.style.borderColor = "#444");
      bar.appendChild(slot);
    }

    return bar;
  }

  private createPlayerInfo(): HTMLElement {
    this.playerPanel = document.createElement("div");
    this.playerPanel.style.cssText = `
      position: absolute; top: 12px; left: 12px; pointer-events: auto;
      background: #16213ecc; border: 2px solid #333; border-radius: 8px;
      padding: 12px 16px; min-width: 160px; transition: border-color 0.3s;
    `;

    const name = document.createElement("div");
    name.textContent = "Player";
    name.style.cssText = "font-size: 14px; font-weight: 600; color: #e0e0e0; margin-bottom: 8px; position: relative;";

    this.combatIndicator = document.createElement("span");
    this.combatIndicator.textContent = " IN COMBAT";
    this.combatIndicator.style.cssText = `
      font-size: 10px; color: #ff4444; font-weight: 700; letter-spacing: 1px; display: none;
    `;
    name.appendChild(this.combatIndicator);

    this.playerPanel.appendChild(name);

    const bars = [
      { id: "hp", label: "HP", color: "#e74c3c", value: 50, max: 50 },
      { id: "mp", label: "MP", color: "#3498db", value: 50, max: 50 },
      { id: "st", label: "ST", color: "#f39c12", value: 50, max: 50 },
    ];

    for (const bar of bars) {
      const row = document.createElement("div");
      row.style.cssText = "display: flex; align-items: center; gap: 6px; margin-bottom: 4px;";

      const label = document.createElement("span");
      label.textContent = bar.label;
      label.style.cssText = "width: 20px; font-size: 11px; color: #888;";

      const track = document.createElement("div");
      track.style.cssText = "flex: 1; height: 6px; background: #333; border-radius: 3px; overflow: hidden;";

      const fill = document.createElement("div");
      fill.id = `bar-fill-${bar.id}`;
      fill.style.cssText = `height: 100%; background: ${bar.color}; border-radius: 3px; width: ${(bar.value / bar.max) * 100}%; transition: width 0.2s;`;
      track.appendChild(fill);

      const text = document.createElement("span");
      text.id = `bar-text-${bar.id}`;
      text.textContent = `${bar.value}`;
      text.style.cssText = "width: 28px; text-align: right; font-size: 11px; color: #aaa;";

      row.append(label, track, text);
      this.playerPanel.appendChild(row);
    }

    return this.playerPanel;
  }

  private createTargetPanel(): HTMLElement {
    this.targetPanel = document.createElement("div");
    this.targetPanel.style.cssText = `
      position: absolute; top: 12px; left: 50%; transform: translateX(-50%); pointer-events: auto;
      background: #16213ecc; border: 1px solid #555; border-radius: 8px;
      padding: 10px 16px; min-width: 180px; display: none; text-align: center;
    `;

    this.targetName = document.createElement("div");
    this.targetName.style.cssText = "font-size: 13px; font-weight: 600; color: #e0e0e0; margin-bottom: 6px;";
    this.targetName.textContent = "";

    const hpTrack = document.createElement("div");
    hpTrack.style.cssText = "height: 8px; background: #333; border-radius: 4px; overflow: hidden; margin-bottom: 4px;";

    this.targetHpFill = document.createElement("div");
    this.targetHpFill.style.cssText = "height: 100%; background: #e74c3c; border-radius: 4px; width: 100%; transition: width 0.2s;";
    hpTrack.appendChild(this.targetHpFill);

    this.targetHpText = document.createElement("div");
    this.targetHpText.style.cssText = "font-size: 11px; color: #aaa;";

    this.targetPanel.append(this.targetName, hpTrack, this.targetHpText);
    return this.targetPanel;
  }

  dispose() {
    this.container = null;
    this.targetPanel = null;
    this.autoAttackBtn = null;
  }
}
