import { Engine, DisplayMode, Color } from "excalibur";
import { NetworkManager } from "./net/NetworkManager.js";
import { GameScene } from "./scenes/GameScene.js";

const API = "";

function setLoading(pct: number, text: string) {
  const bar = document.getElementById("loading-bar");
  const label = document.getElementById("loading-text");
  if (bar) bar.style.width = `${pct}%`;
  if (label) label.textContent = text;
}

async function devLogin(): Promise<{ token: string; characterId: string }> {
  setLoading(10, "Logging in...");
  const res = await fetch(`${API}/api/auth/dev-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "lukeocodes", password: "password" }),
  });
  if (!res.ok) throw new Error("Dev login failed");
  const data = await res.json();
  const token: string = data.gameJwt;

  const chars: Array<{ id: string; name: string; role: string | null }> = data.characters ?? [];
  // The game client (index.html) plays as the main character.
  const main = chars.find(c => c.role === "main") ?? chars[0];
  if (!main) throw new Error("No main character — dev-login should have seeded one");
  return { token, characterId: main.id };
}

async function main() {
  try {
    const { token, characterId } = await devLogin();

    setLoading(30, "Connecting to server...");
    const net = new NetworkManager();
    await net.connect(token, characterId);

    setLoading(80, "Loading world...");

    const game = new Engine({
      displayMode: DisplayMode.FillScreen,
      backgroundColor: Color.fromHex("#1a1a2e"),
      antialiasing: false,
      pixelArt: true,
    });

    const scene = new GameScene(net, characterId);
    game.addScene("game", scene);

    await game.start();
    await game.goToScene("game");
    (window as any).__game = game;

    setLoading(100, "Ready!");
    const loadEl = document.getElementById("loading");
    if (loadEl) loadEl.classList.add("hidden");

  } catch (err) {
    const label = document.getElementById("loading-text");
    if (label) label.textContent = `Error: ${(err as Error).message}`;
    console.error(err);
  }
}

main();
