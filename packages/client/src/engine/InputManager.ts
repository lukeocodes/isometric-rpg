export interface InputState {
  moveForward: boolean;
  moveBackward: boolean;
  moveLeft: boolean;
  moveRight: boolean;
}

type KeyAction = keyof InputState;

const DEFAULT_BINDINGS: Record<string, KeyAction> = {
  KeyW: "moveForward",
  KeyS: "moveBackward",
  KeyA: "moveLeft",
  KeyD: "moveRight",
  ArrowUp: "moveForward",
  ArrowDown: "moveBackward",
  ArrowLeft: "moveLeft",
  ArrowRight: "moveRight",
};

export class InputManager {
  private state: InputState = {
    moveForward: false,
    moveBackward: false,
    moveLeft: false,
    moveRight: false,
  };

  private bindings: Record<string, KeyAction>;
  private enabled = true;
  private onRightClick: ((screenX: number, screenY: number) => void) | null = null;
  private onLeftClick: ((screenX: number, screenY: number) => void) | null = null;
  private onToggleAutoAttack: (() => void) | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.bindings = { ...DEFAULT_BINDINGS };

    window.addEventListener("keydown", (e) => this.onKey(e, true));
    window.addEventListener("keyup", (e) => this.onKey(e, false));

    // Reset all keys when window loses focus
    window.addEventListener("blur", () => this.resetAll());

    // Left-click on canvas
    canvas.addEventListener("click", (e) => {
      if (this.enabled && this.onLeftClick) {
        this.onLeftClick(e.offsetX, e.offsetY);
      }
    });

    // Right-click on canvas
    canvas.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      if (this.enabled && this.onRightClick) {
        this.onRightClick(e.offsetX, e.offsetY);
      }
    });

    // Allow canvas to receive focus
    canvas.tabIndex = 1;
  }

  getState(): Readonly<InputState> {
    return this.state;
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled) this.resetAll();
  }

  setOnLeftClick(handler: (screenX: number, screenY: number) => void) {
    this.onLeftClick = handler;
  }

  setOnRightClick(handler: (screenX: number, screenY: number) => void) {
    this.onRightClick = handler;
  }

  setOnToggleAutoAttack(handler: () => void) {
    this.onToggleAutoAttack = handler;
  }

  rebind(code: string, action: KeyAction) {
    this.bindings[code] = action;
  }

  private onKey(e: KeyboardEvent, pressed: boolean) {
    if (!this.enabled) return;

    // Caps Lock toggles auto-attack (fire on keydown only)
    if (e.code === "CapsLock" && pressed) {
      e.preventDefault();
      if (this.onToggleAutoAttack) this.onToggleAutoAttack();
      return;
    }

    const action = this.bindings[e.code];
    if (action) {
      e.preventDefault();
      this.state[action] = pressed;
    }
  }

  private resetAll() {
    this.state.moveForward = false;
    this.state.moveBackward = false;
    this.state.moveLeft = false;
    this.state.moveRight = false;
  }
}
