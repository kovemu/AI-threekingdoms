# Product Definition

## One sentence

A living Three Kingdoms roleplay where the player says what they do, AI advances the story, and the game turns the accumulated story into a visual snapshot of the world and scene.

## What the player experiences

Example:

> "I order Zhang Fei to take 3,000 men toward Hanzhong while I remain in Chengdu."

The game:
1. understands the order,
2. checks what is currently possible,
3. updates troop locations and command assignments,
4. generates the next narrative,
5. shows either a strategic situation image or a dramatic scene,
6. remembers all of this next turn.

## Important distinction

The visual panel is not a clickable simulation UI.

It is a **visualized memory of the roleplay**.

Its job is to solve a weakness of long-form text RPGs: after many turns, the player forgets who controls what, where armies are, where characters are, and what is currently happening.

## Visual modes

### STATE_BOARD
Use when clarity matters:
- territory ownership
- army locations
- important character locations
- current fronts
- date
- key active events

Prefer deterministic SVG/canvas rendering so geography and labels stay consistent.

### SCENE
Use for immersion:
- battle
- siege
- diplomacy
- court audience
- assassination attempt
- feast
- travel
- surrender
- major death
- coronation

Scene art may be generated locally.

### NONE
Minor conversational turns do not need a new image.

## MVP success test

After 15 minutes of play, the player should feel:
- "I can say almost anything."
- "The world remembers what happened."
- "I understand the current strategic situation."
- "The image makes the scene feel present."
