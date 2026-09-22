export type WorldOperation =
  | {
      type: "move_army";
      armyId: string;
      toLocationId: string;
    }
  | {
      type: "transfer_troops";
      fromArmyId: string;
      toArmyId: string;
      amount: number;
    }
  | {
      type: "move_character";
      characterId: string;
      toLocationId: string;
    }
  | {
      type: "change_relation";
      relationId: string;
      delta: number;
    }
  | {
      type: "change_territory_owner";
      locationId: string;
      ownerFactionId: string | null;
    }
  | {
      type: "create_event";
      event: {
        id: string;
        type: string;
        title: string;
        locationId?: string;
      };
    }
  | {
      type: "resolve_event";
      eventId: string;
    };

export interface ProposedTurn {
  summary: string;
  operations: WorldOperation[];
}
