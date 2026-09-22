# GPT-6 Handoff Prompt

You are taking over development of repository `kovemu/AI-threekingdoms`.

Read these files first and treat them as product requirements:
- `README.md`
- `AGENTS.md`
- every file under `docs/`
- `src/core/types.ts`
- `src/core/operations.ts`
- `src/ai/provider.ts`

## Product

This is a Three Kingdoms AI roleplay game.

The player mainly interacts through a free-form chat prompt. The AI continues the roleplay while a persistent structured world state records factual reality.

The large visual area is NOT a clickable strategy-game UI. It is a visual representation of the current narrative:
- STATE_BOARD: accurate strategic summary/map of territory, armies, people, fronts, date, etc.
- SCENE: immersive generated image for battles, meetings, sieges, journeys, court scenes, major events.
- NONE: no new image for minor turns.

Example:
Player: "Give Zhang Fei 3,000 troops and send him toward Hanzhong."

The system should:
1. parse intent,
2. validate against current world state,
3. commit legal state changes atomically,
4. produce narrative continuation,
5. decide visual mode,
6. render/generate the visual,
7. save the turn so the next prompt continues from it.

## Critical requirement: zero-configuration AI

The default game MUST NOT require:
- API keys,
- Ollama installation,
- Python,
- provider selection,
- environment-variable editing,
- account creation.

Use local inference as the shipping default.

Target architecture:
- Tauri 2 desktop application
- React + TypeScript + Vite frontend
- local SQLite saves
- bundled/managed llama.cpp-compatible native inference runtime
- model manifest + automatic model acquisition and checksum verification
- automatic hardware detection and sensible model profile selection
- provider abstraction preserved

The player experience should be:
Install -> launch -> automatic one-time model preparation if necessary -> type immediately -> play.

Do NOT make a paid API part of the required path.
Do NOT depend on a separately installed Ollama daemon.
Optional cloud adapters can exist later but must never be required.

Development/shipping target hardware:
- Windows
- 8GB VRAM GPU as the primary target
- 16GB system RAM minimum
- 32GB system RAM recommended

Optimize the default local text model around a 7B-9B Q4-class GGUF model. Do not assume 12GB+ VRAM. Design lower-tier fallbacks as described in `docs/LOCAL_AI.md`.

For 8GB GPUs, image generation must not jeopardize text gameplay. Prefer STATE_BOARD by default and use local SCENE generation only when memory can be safely freed/reallocated.

## Image generation

Do not block gameplay on scene-image generation.

Phase order:
1. deterministic STATE_BOARD renderer first,
2. local SCENE image provider abstraction,
3. local image generation integration after the core turn loop works.

Narrative text should stream/show before a scene image finishes.

## Your immediate task

Build Milestone 1 as a runnable vertical slice.

1. Scaffold Tauri 2 + React + TypeScript + Vite in this repository.
2. Preserve the current docs and architecture.
3. Implement local SQLite persistence.
4. Implement a minimal initial scenario with only a few locations, factions, characters and armies.
5. Implement an atomic turn engine around `WorldState`.
6. Validate `WorldOperation` before applying it.
7. Add a text-provider interface implementation suitable for a llama.cpp sidecar.
8. Add a mock provider only as a developer fallback; the production/default path is local inference.
9. Add a first-run model manager:
   - detect model
   - download automatically from manifest when missing
   - show simple progress
   - SHA-256 verify
   - start inference automatically
10. Build one-screen UI:
    - large visual placeholder/state area
    - narrative log
    - bottom free-text prompt
    - send button
    - local model preparation/status indicator that requires no user configuration
11. Save every valid turn and restore it after restart.
12. Add tests for state invariants and operation validation.
13. Add setup/run commands to README.
14. Run typecheck/tests/build and fix failures.
15. Commit the completed vertical slice to the repository.

## Constraints

- Do not add Supabase.
- Do not add authentication.
- Do not add multiplayer.
- Do not build a full China simulation.
- Do not add menus for AI provider/API keys.
- Do not allow the LLM to directly rewrite canonical state.
- Do not use chat transcript alone as game memory.
- Do not start image-generation integration before the core turn loop is runnable.
- Avoid copyrighted game assets; use neutral placeholders for now.
- Keep code modular enough that text/image models can be replaced later.

## Completion report

When done, report:
- commit SHA
- exact run command
- what works
- model/runtime chosen
- approximate model download size
- expected VRAM/RAM use
- tests/build status
- what remains for Milestone 2 (STATE_BOARD)
