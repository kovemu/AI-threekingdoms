# Architecture

## Recommended stack

Desktop-first:
- Tauri 2
- React
- TypeScript
- Vite
- SQLite
- Rust/Tauri commands for native/local inference integration

Why desktop first:
- local AI is a core requirement,
- Steam distribution is a likely target,
- browser sandbox restrictions make bundled model/runtime management harder,
- local saves and GPU/runtime detection are easier.

## Core pipeline

```
Player text
   |
   v
Intent Interpreter (local LLM)
   |
   v
Proposed Operations
   |
   v
Rules / Validation Engine
   |
   v
Canonical WorldState
   |
   +--> Consequence Engine
   |
   v
Narrator (local LLM)
   |
   v
Visual Director
   |                \
   v                 v
STATE_BOARD         SCENE
deterministic       local image generation
renderer            provider
   \                 /
    v               v
       Player view
          |
          v
       Save turn
```

## Canonical truth

Only deterministic application code may commit changes to `WorldState`.

The model may propose:
- move_army
- assign_commander
- change_relation
- create_event
- resolve_event
- transfer_troops
- change_location
- add_memory

The engine validates these operations before applying them.

## Persistence

MVP uses local SQLite.

Suggested tables:
- saves
- turns
- world_snapshots
- narrative_entries
- memories
- generated_assets
- model_registry

Do not require a cloud database for single-player MVP.

## AI provider interfaces

Text and image providers must be replaceable.

Default:
- Text: local llama.cpp-compatible runtime
- Image: local provider when supported; deterministic board always available

Optional later:
- cloud provider adapters
- workshop/scenario downloads
- multiplayer/cloud saves

## Failure behavior

If local image generation is unavailable:
- gameplay must continue,
- show STATE_BOARD or cached/static art,
- never block the turn.

If text model fails:
- preserve the last valid state,
- do not commit partial operations,
- offer retry.
