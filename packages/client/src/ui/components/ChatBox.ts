export class ChatBox {
  render(): HTMLElement {
    const container = document.createElement("div");
    container.style.cssText = `
      position: absolute; bottom: 90px; left: 12px;
      background: #16213eaa; border: 1px solid #333; border-radius: 8px;
      width: 320px; height: 160px; display: flex; flex-direction: column;
      overflow: hidden;
    `;

    const messages = document.createElement("div");
    messages.style.cssText = "flex: 1; overflow-y: auto; padding: 8px; font-size: 13px; color: #ccc;";
    messages.innerHTML = '<div style="color: #888; font-style: italic;">Chat coming soon...</div>';

    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "Type a message...";
    input.disabled = true;
    input.style.cssText = `
      padding: 8px 12px; font-size: 13px; background: #0a0a1a;
      color: #e0e0e0; border: none; border-top: 1px solid #333;
    `;

    container.append(messages, input);
    return container;
  }
}
