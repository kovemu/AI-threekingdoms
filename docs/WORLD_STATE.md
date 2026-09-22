# World State

## Principle

The conversation transcript is history.
`WorldState` is truth.

Never reconstruct critical facts only from chat history.

## Initial TypeScript shape

```ts
export interface WorldState {
  schemaVersion: number;
  calendar: GameDate;
  player: PlayerState;
  factions: Record<string, FactionState>;
  characters: Record<string, CharacterState>;
  locations: Record<string, LocationState>;
  armies: Record<string, ArmyState>;
  relations: Record<string, RelationState>;
  activeEvents: EventState[];
  flags: Record<string, boolean | number | string>;
}
```

## Required invariants

- One army has exactly one current location.
- An army cannot transfer more troops than it owns.
- A character cannot be in two locations at once.
- Territory ownership must reference an existing faction.
- Dead characters cannot command active armies.
- Dates only advance forward.
- A turn is atomic: either all validated operations commit, or none do.

## Model interaction

The model receives a compact projection of state relevant to the turn, not necessarily the entire database.

The model outputs proposed operations in a validated schema.

Example:

```json
{
  "operations": [
    {
      "type": "transfer_troops",
      "fromArmyId": "chengdu_garrison",
      "toArmyId": "zhang_fei_hanzhong",
      "amount": 3000
    },
    {
      "type": "move_army",
      "armyId": "zhang_fei_hanzhong",
      "toLocationId": "hanzhong_south"
    }
  ]
}
```

Application code validates and commits them.

## Memory types

### factual
Facts that must remain consistent.

### narrative
Character impressions, promises, grudges, rumors, emotional continuity.

### historical
Real historical reference material used by the scenario.

Historical reference does not force history to occur exactly as recorded once the player diverges.
