# Client Agent Guide

## Runtime
- Bun + Vite for dev (`bunx --bun vite` on port 5173)
- Vite proxies `/api` to http://localhost:8000

## File Map
- `src/main.ts` — Boot: WebRTC check, router setup, game lifecycle, disconnect handling
- `src/engine/Game.ts` — Orchestrator: connects systems, handles input, manages HUD
- `src/engine/SceneManager.ts` — Babylon.js Engine + Scene + lighting
- `src/engine/IsometricCamera.ts` — Orthographic camera at 35.264° elevation, 45° Y rotation
- `src/engine/Loop.ts` — Fixed 20Hz tick + variable render loop
- `src/engine/InputManager.ts` — WASD + click + Caps Lock handlers
- `src/ecs/EntityManager.ts` — Entity store + spatial grid (clean up empty cells!)
- `src/ecs/components/` — Position, Movement, Renderable, Identity, Stats, Combat
- `src/ecs/systems/` — Movement, Render, Animation, Interpolation, Combat (client-side removed)
- `src/net/NetworkManager.ts` — WebRTC connection via HTTP signaling, no WebSocket
- `src/net/StateSync.ts` — Server → client entity sync, numeric ID hash mapping
- `src/net/Protocol.ts` — Opcodes, binary pack/unpack
- `src/ui/Router.ts` — Screen state machine: login → onboard → create → select → game
- `src/ui/screens/` — LoginScreen, OnboardingScreen, CharacterCreateScreen, CharacterSelectScreen, GameHUD, LoadingScreen
- `src/dev/PlaywrightAPI.ts` — Dev-only `window.__game` testing interface

## Babylon.js Deep Imports
ALWAYS use specific paths. Never `from "@babylonjs/core"`.
```typescript
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import "@babylonjs/core/Culling/ray"; // Side-effect import for scene.pick()
```
This reduced the bundle from 5MB to 1.4MB.

## Adding ECS Components
1. Create `src/ecs/components/MyComponent.ts` with interface + factory
2. Add to union type in `EntityManager.ts`
3. Create system in `src/ecs/systems/MySystem.ts`
4. Wire into `Game.ts` render or tick loop

## Adding UI Screens
1. Create `src/ui/screens/MyScreen.ts` implementing `Screen` interface
2. Add to `ScreenName` union in Router.ts
3. Add case in `navigateTo()` switch
4. Set `pointer-events: auto` on clickable panels, `pointer-events: none` on container

## Remote Entity Interpolation
Remote entities don't snap to server positions. `InterpolationSystem` lerps toward `remoteTargetX/Z` each frame at `LERP_SPEED * dt`. Position component has `isRemote` flag.
