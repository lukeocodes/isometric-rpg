import type { Screen } from "../UIManager";

export class OnboardingScreen implements Screen {
  private onComplete: () => void;
  private currentStep = 0;

  private steps = [
    {
      title: "Welcome, Adventurer",
      text: "You've entered a world of mystery and danger. Your journey begins here.",
    },
    {
      title: "Controls",
      text: "Use WASD to move your character. The world is viewed from an isometric perspective — north is to the upper-right.",
    },
    {
      title: "Your Character",
      text: "Next, you'll create your character. Choose your race, allocate stats, and pick starting skills wisely.",
    },
  ];

  constructor(onComplete: () => void) {
    this.onComplete = onComplete;
  }

  render(): HTMLElement {
    const container = document.createElement("div");
    container.style.cssText = `
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      width: 100%; height: 100%; gap: 24px;
    `;

    const card = document.createElement("div");
    card.style.cssText = `
      background: #16213e; border: 1px solid #333; border-radius: 12px;
      padding: 48px; max-width: 500px; text-align: center;
    `;

    const title = document.createElement("h2");
    title.style.cssText = "font-size: 28px; margin-bottom: 16px; color: #e0e0e0;";

    const text = document.createElement("p");
    text.style.cssText = "font-size: 16px; color: #aaa; line-height: 1.6; margin-bottom: 32px;";

    const dots = document.createElement("div");
    dots.style.cssText = "display: flex; gap: 8px; justify-content: center; margin-bottom: 24px;";

    const button = document.createElement("button");
    button.style.cssText = `
      padding: 12px 32px; font-size: 16px; background: #13ef93; color: #1a1a2e;
      border: none; border-radius: 6px; cursor: pointer; font-weight: 600;
    `;

    const updateStep = () => {
      const step = this.steps[this.currentStep];
      title.textContent = step.title;
      text.textContent = step.text;
      button.textContent = this.currentStep < this.steps.length - 1 ? "Continue" : "Create Character";

      dots.innerHTML = "";
      for (let i = 0; i < this.steps.length; i++) {
        const dot = document.createElement("div");
        dot.style.cssText = `
          width: 10px; height: 10px; border-radius: 50%;
          background: ${i === this.currentStep ? "#13ef93" : "#333"};
        `;
        dots.appendChild(dot);
      }
    };

    button.onclick = () => {
      if (this.currentStep < this.steps.length - 1) {
        this.currentStep++;
        updateStep();
      } else {
        this.onComplete();
      }
    };

    card.append(title, text, dots, button);
    container.appendChild(card);
    updateStep();
    return container;
  }
}
