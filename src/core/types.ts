export type VisualMode = "NONE" | "STATE_BOARD" | "SCENE";

export interface GameDate {
  year: number;
  month: number;
  day: number;
}

export interface PlayerState {
  characterId: string;
  factionId: string | null;
  locationId: string;
}

export interface FactionState {
  id: string;
  name: string;
  leaderCharacterId: string | null;
  treasury: number;
  food: number;
}

export interface CharacterState {
  id: string;
  name: string;
  factionId: string | null;
  locationId: string;
  alive: boolean;
}

export interface LocationState {
  id: string;
  name: string;
  ownerFactionId: string | null;
}

export interface ArmyState {
  id: string;
  name: string;
  commanderCharacterId: string | null;
  factionId: string;
  locationId: string;
  troops: number;
  morale: number;
}

export interface RelationState {
  aFactionId: string;
  bFactionId: string;
  score: number;
  status: "allied" | "friendly" | "neutral" | "hostile" | "war";
}

export interface EventState {
  id: string;
  type: string;
  title: string;
  locationId?: string;
  active: boolean;
}

export interface WorldState {
  schemaVersion: 1;
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
