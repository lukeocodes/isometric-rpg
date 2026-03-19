export type Screen = {
  render(): HTMLElement;
  dispose?(): void;
};

export class UIManager {
  private overlay: HTMLElement;
  private currentScreen: Screen | null = null;

  constructor() {
    this.overlay = document.getElementById("ui-overlay")!;
  }

  showScreen(screen: Screen) {
    if (this.currentScreen?.dispose) {
      this.currentScreen.dispose();
    }
    this.overlay.innerHTML = "";
    this.currentScreen = screen;
    this.overlay.appendChild(screen.render());
  }

  clearScreen() {
    if (this.currentScreen?.dispose) {
      this.currentScreen.dispose();
    }
    this.overlay.innerHTML = "";
    this.currentScreen = null;
  }

  getOverlay(): HTMLElement {
    return this.overlay;
  }
}
