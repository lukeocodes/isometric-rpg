export class MiniMap {
  render(): HTMLElement {
    const container = document.createElement("div");
    container.style.cssText = `
      background: #16213ecc; border: 1px solid #333; border-radius: 8px;
      width: 120px; height: 120px; display: flex; align-items: center;
      justify-content: center;
    `;

    const label = document.createElement("span");
    label.textContent = "Map";
    label.style.cssText = "font-size: 12px; color: #555;";
    container.appendChild(label);

    return container;
  }
}
