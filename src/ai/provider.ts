import type { WorldState } from "../core/types";
import type { ProposedTurn } from "../core/operations";

export interface NarrativeMemory {
  player: string;
  narrator: string;
}

export interface NarrativeContext {
  recentNarrative?: NarrativeMemory[];
  stateBefore: WorldState;
  stateAfter: WorldState;
  playerInput: string;
  resolvedSummary: string;
}

export interface VisualDecision {
  mode: "NONE" | "STATE_BOARD" | "SCENE";
  importance: number;
  reason: string;
  scenePrompt?: string;
}

export interface TextAIProvider {
  interpretPlayerAction(
    input: string,
    state: WorldState,
    recentNarrative?: NarrativeMemory[]
  ): Promise<ProposedTurn>;

  narrate(context: NarrativeContext): Promise<string>;

  chooseVisual(
    context: NarrativeContext,
    narration: string
  ): Promise<VisualDecision>;
}

export interface SceneImageProvider {
  isAvailable(): Promise<boolean>;
  generate(prompt: string): Promise<{
    assetPath: string;
    seed?: number;
    metadata?: Record<string, unknown>;
  }>;
}
