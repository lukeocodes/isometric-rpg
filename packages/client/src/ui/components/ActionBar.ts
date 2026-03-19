export class ActionBar {
  private slots: Array<{ name: string; icon: string } | null>;
  private container: HTMLElement | null = null;

  constructor(slotCount = 6) {
    this.slots = new Array(slotCount).fill(null);
  }

  setSlot(index: number, name: string, icon: string) {
    if (index >= 0 && index < this.slots.length) {
      this.slots[index] = { name, icon };
    }
  }

  clearSlot(index: number) {
    if (index >= 0 && index < this.slots.length) {
      this.slots[index] = null;
    }
  }

  render(): HTMLElement {
    this.container = document.createElement("div");
    this.container.style.cssText = `
      display: flex; gap: 4px; background: #16213ecc;
      border: 1px solid #333; border-radius: 8px; padding: 8px;
    `;

    for (let i = 0; i < this.slots.length; i++) {
      const slot = this.slots[i];
      const el = document.createElement("div");
      el.style.cssText = `
        width: 52px; height: 52px; background: #0a0a1a88;
        border: 1px solid #444; border-radius: 6px;
        display: flex; align-items: center; justify-content: center;
        color: #555; font-size: 12px; cursor: pointer;
      `;
      el.textContent = slot ? slot.name : String(i + 1);
      el.title = slot ? slot.name : `Slot ${i + 1}`;
      this.container.appendChild(el);
    }

    return this.container;
  }
}
