# AI Three Kingdoms — Agent Instructions

Read all files in `docs/` before making architectural changes.

## Product intent

This is not a conventional clickable strategy game. The player's primary control is free-form text.

The top visual is a generated representation of the current situation:
- strategic map/status visualization when spatial clarity matters,
- cinematic scene illustration for battles, meetings, sieges, journeys, court scenes, etc.

The visual itself does not need to be interactive.

## Non-negotiable architecture

1. Local-first AI. The default game must never require the player to paste an API key.
2. Zero-config play. First launch may download a model automatically, but the user should not configure inference software.
3. LLM output is not canonical truth.
4. Canonical truth lives in structured `WorldState`.
5. LLM proposes operations; deterministic code validates/applies them.
6. Narrative memory and factual world state are separate.
7. AI providers are behind interfaces so models/runtimes can be replaced.
8. Generated visuals must never silently mutate world state.
9. Keep the first scenario intentionally small.
10. Do not add large systems until the core loop is fun.

## First target

Build a desktop-first prototype:
- Tauri shell
- React + TypeScript UI
- local llama.cpp-compatible text inference
- persistent local SQLite save
- deterministic situation-board renderer
- pluggable local image-generation provider

First playable loop:
`player text -> intent -> validated operations -> state update -> narration -> visual decision -> display -> save`.

## Working style

Prefer small commits and runnable vertical slices.
Do not introduce Supabase, authentication, cloud accounts, subscriptions, or external APIs in the MVP unless explicitly requested.
