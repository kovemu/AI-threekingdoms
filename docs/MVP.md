# MVP

## Goal

Prove one experience:

**Free-form text changes a persistent historical world, and the resulting world is understandable and immersive through automatic visualisation.**

## Scenario scope

Do not begin with all of China.

First scenario:
- mid-190s Three Kingdoms setting
- 5-6 locations
- 6-10 important characters
- 3-4 factions
- a small set of armies
- one active political/military conflict

Exact year and starting protagonist can be changed after the core loop works.

## Milestone 1 — text-only vertical slice

- app launches
- local model runtime starts automatically
- player can type a turn
- action is parsed
- operations validate
- state persists
- narrator responds
- reload preserves the save

## Milestone 2 — situation board

- fixed map
- faction ownership overlay
- army markers
- character markers
- current date
- active event label

No generated image needed yet.

## Milestone 3 — visual director

Every turn returns:
- NONE
- STATE_BOARD
- SCENE

## Milestone 4 — local scene image

For major events:
- create scene prompt from canonical state + narrative event
- generate locally
- show text immediately
- attach image when ready
- cache result

## Milestone 5 — 15-minute playtest

Test only:
- freedom of input
- continuity
- clarity
- immersion
- latency

Do not add economy, crafting, multiplayer, achievements, workshop, or full-China simulation before this playtest.
