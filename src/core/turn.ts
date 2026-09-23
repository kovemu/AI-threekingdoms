import { applyOperations, assertWorld, parseProposal } from './validation.ts';
import { consequences } from './consequences.ts';
import type { WorldState } from './types.ts';
import type { TextAIProvider, VisualDecision } from '../ai/provider.ts';
import type { WorldOperation } from './operations.ts';
export interface TurnRecord { id:string; number:number; input:string; narration:string; summary:string; operations:WorldOperation[]; state:WorldState; visual:VisualDecision; requestedVisual:VisualDecision; createdAt:string; }
export interface SavedGame { version:number; state:WorldState; turns:TurnRecord[]; }
export interface TurnStore { commit(expectedVersion:number,turn:TurnRecord):Promise<void>; }
export class TurnEngine {
  busy=false;
  private save:SavedGame;
  private ai:TextAIProvider;
  private store:TurnStore;
  constructor(save:SavedGame,ai:TextAIProvider,store:TurnStore) {
    assertWorld(save.state);this.save=structuredClone(save);this.ai=ai;this.store=store;
  }
  snapshot():SavedGame { return structuredClone(this.save); }
  async submit(input:string):Promise<TurnRecord> {
    if(this.busy)throw new Error('이전 턴을 처리 중입니다.');
    input=input.trim();
    if(!input||input.length>2000)throw new Error('1~2,000자로 행동을 입력해 주세요.');
    this.busy=true;
    try {
      const before=structuredClone(this.save.state);
      const proposed=parseProposal(await this.ai.interpretPlayerAction(input,structuredClone(before)));
      const draft=applyOperations(before,proposed.operations);
      const number=this.save.version+1;
      const resolved=consequences(before,draft,proposed.operations,number);
      const context={stateBefore:before,stateAfter:resolved.state,playerInput:input,resolvedSummary:resolved.summary};
      const narration=await this.ai.narrate(structuredClone(context));
      if(!narration.trim()||narration.length>12000)throw new Error('AI 응답이 비어 있거나 너무 깁니다. 다시 시도해 주세요.');
      let requestedVisual:VisualDecision={mode:'STATE_BOARD',importance:1,reason:'시각화 기본값'};
      try { requestedVisual=await this.ai.chooseVisual(structuredClone(context),narration); } catch { /* Presentation never blocks the transaction. */ }
      if(!['STATE_BOARD','SCENE','NONE'].includes(requestedVisual.mode))requestedVisual={mode:'STATE_BOARD',importance:1,reason:'알 수 없는 시각화'};
      const visual:VisualDecision=requestedVisual.mode==='SCENE'?{mode:'STATE_BOARD',importance:requestedVisual.importance,reason:'장면 생성 미지원: 현재 상황을 표시합니다.'}:requestedVisual;
      const turn:TurnRecord={id:crypto.randomUUID(),number,input,narration,summary:resolved.summary,operations:proposed.operations,state:resolved.state,visual,requestedVisual,createdAt:new Date().toISOString()};
      await this.store.commit(this.save.version,structuredClone(turn));
      this.save={version:number,state:structuredClone(resolved.state),turns:[...this.save.turns,structuredClone(turn)].slice(-100)};
      return structuredClone(turn);
    } finally { this.busy=false; }
  }
}
