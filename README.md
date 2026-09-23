# AI Three Kingdoms

AI-driven Three Kingdoms roleplay where the player types natural-language actions and the game continuously:

1. interprets the player's intent,
2. updates a persistent world state,
3. narrates the consequences,
4. visualizes the current situation,
5. continues from the recorded state on the next turn.

## Core product rule

The visual area is **not an interactive strategy-game UI**. It is an AI-produced visualization of the current narrative/world state.

The player should be able to launch the game and start typing immediately. No API key, provider selection, model setup, or account configuration is required for the default experience.

## Default AI policy

- Text AI: local inference by default.
- Runtime: bundled/managed by the app.
- Model: downloaded automatically on first launch if it is not bundled.
- User configuration: zero required.
- Paid APIs: optional future enhancement only, never required for normal play.
- World truth is stored in structured state, not in model memory.

See:
- `docs/PRODUCT.md`
- `docs/ARCHITECTURE.md`
- `docs/LOCAL_AI.md`
- `docs/WORLD_STATE.md`
- `docs/MVP.md`
- `AGENTS.md`

## Milestone 1 implementation

The playable target is **Windows x64**, 8GB VRAM, 16GB RAM minimum / 32GB recommended.
The initial scenario is an explicitly fictional 214 CE Yizhou opening: six locations,
eight characters, four factions and four armies. No full-China database is included.

### Player installation

Download the `ai-threekingdoms-windows-x64` artifact from a successful **Windows MVP**
GitHub Actions run on the `feat/milestone-1` branch, unzip it and run the NSIS installer.
Launch **AI Three Kingdoms**. The app automatically detects memory, downloads and
verifies its model/runtime, then enables the chat. The first launch needs Internet;
subsequent normal play is local. No API keys, Python, Ollama or model settings.
This development installer is unsigned. Windows GPU acceptance testing is still required
before treating it as a public release; see `docs/MILESTONE1_STATUS.md` for actual evidence.

### Develop from source (Windows)

Developers need Node.js 24+, stable Rust, Visual Studio C++ Build Tools with the Windows
SDK, and WebView2. These are build requirements, **not requirements for players**.

```powershell
git clone --branch feat/milestone-1 https://github.com/kovemu/AI-threekingdoms.git
cd AI-threekingdoms
npm ci
npm run desktop:dev
```

Create the Windows installer:

```powershell
npm run desktop:build -- --bundles nsis
```

Output: `src-tauri/target/release/bundle/nsis/`.
`npm run dev` is a browser UI preview only; it deliberately does not pretend to run local AI or save games.

### Verify

```powershell
npm test
npm run typecheck
npm run build
cargo test --manifest-path src-tauri/Cargo.toml --no-default-features --locked
```

The Rust unit suite runs without GUI libraries. Windows CI additionally builds the
installer and runs a real managed model startup/inference/restart smoke test on CPU:

```powershell
cargo test --manifest-path src-tauri/Cargo.toml --no-default-features managed_runtime_smoke -- --ignored --nocapture
```

That explicit smoke test downloads about 2.5GB. It is excluded from normal unit tests.

### Local AI and storage

`src/ai/model-manifest.json` pins model revision, bytes and SHA-256 plus llama.cpp b6642
Windows runtime archives. Default: Qwen3-8B Q4_K_M (5,027,783,488 bytes); fallback:
Qwen3-4B Q4_K_M (2,497,280,256 bytes). Both use a 4,096-token context with thinking disabled.
NVIDIA VRAM is detected using an optional driver-provided `nvidia-smi`; if detection is
unavailable, the app conservatively chooses the 4B CPU path. No separate service is required.
GPU launch failure tries the smaller model, then the CPU runtime. Network failures preserve
partial downloads for retry instead of silently downloading another model.

Saves live under Tauri's per-user application-data directory for
`com.kovemu.aithreekingdoms`: `game.sqlite`, `models/`, `runtime/`, `runtime.log`.
Do not delete this directory to repair a failed model download: the UI offers retry.
On Windows this is normally `%APPDATA%\com.kovemu.aithreekingdoms`.
The database uses WAL, FULL synchronization, one transaction per turn, optimistic version
checks and unique turn IDs. It stores every turn; the UI restores the latest 100 records.
World facts come from the snapshot, not the conversation. Only three short narrative
excerpts enter the prompt as non-authoritative dialogue memory.

### Scope limits

- Troop transfer, marching, character movement, limited diplomacy, eligible occupation,
  non-military event creation/resolution and deterministic contact events are implemented.
- Battle arrival creates a standoff. Casualties, victory, death and battle resolution are
  deliberately unsupported in this slice; the LLM cannot invent them as state changes.
- The large read-only area summarizes factual state. A geographic SVG STATE_BOARD is M2.
- Visual decisions support NONE/STATE_BOARD/SCENE, but SCENE falls back to the state area.
- Inference is two bounded non-streaming calls. Token streaming, GPU benchmarking,
  richer dialogue memory, AMD/Intel adapter detection and 12B–14B profiles remain future work.
