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
