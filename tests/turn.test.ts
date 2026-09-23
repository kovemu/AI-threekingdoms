import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialScenario } from '../src/core/scenario.ts';
import { TurnEngine, type SavedGame, type TurnRecord } from '../src/core/turn.ts';
import type { TextAIProvider } from '../src/ai/provider.ts';

const provider: TextAIProvider = {
  interpretPlayerAction: async()=>({summary:'장비 이동',operations:[{type:'move_army',armyId:'zhang_army',toLocationId:'hanzhong'}]}),
  narrate: async c=>`${c.stateAfter.characters.zhang_fei.locationId}에서 장로군과 대치한다.`,
  chooseVisual: async()=>({mode:'SCENE',importance:8,reason:'충돌'}),
};
function setup(ai=provider, failSave=false) {
  let saved:SavedGame={version:0,state:initialScenario(),turns:[]};
  const engine=new TurnEngine(saved,ai,{commit:async(expected:number,turn:TurnRecord)=>{
    if(failSave)throw new Error('disk full');
    assert.equal(expected,saved.version);
    saved={version:expected+1,state:structuredClone(turn.state),turns:[...saved.turns,turn]};
  }});
  return {engine,saved:()=>saved};
}
test('turn commits canonical consequences and stores visual fallback',async()=>{
  const {engine,saved}=setup();const t=await engine.submit('장비를 한중으로 보낸다');
  assert.equal(saved().version,1);
  assert.equal(t.state.calendar.day,3);
  assert.ok(t.state.activeEvents.some(e=>e.type==='battle'));
  assert.equal(t.visual.mode,'STATE_BOARD');
  assert.equal(t.requestedVisual.mode,'SCENE');
  assert.deepEqual(engine.snapshot().state,saved().state);
});
test('narration failure and disk failure roll back world and release busy lock',async()=>{
  for(const opts of [{ai:{...provider,narrate:async()=>{throw new Error('AI timeout');}},disk:false},{ai:provider,disk:true}]) {
    const {engine,saved}=setup(opts.ai,opts.disk);const before=engine.snapshot();
    await assert.rejects(()=>engine.submit('진군'));
    assert.deepEqual(engine.snapshot(),before);assert.equal(saved().version,0);assert.equal(engine.busy,false);
  }
});
test('concurrent submissions rejected, saved snapshot cannot mutate canonical state',async()=>{
  let release!:()=>void;
  const gate=new Promise<void>(r=>{release=r;});
  const {engine}=setup({...provider,narrate:async()=>{await gate;return '진군했습니다.';}});
  const first=engine.submit('진군');await assert.rejects(()=>engine.submit('또 진군'));
  release();await first;
  const copy=engine.snapshot();copy.state.armies.zhang_army.troops=999999;
  assert.equal(engine.snapshot().state.armies.zhang_army.troops,2000);
});
test('AI receives isolated copies and cannot directly rewrite canonical state',async()=>{
  const {engine}=setup({...provider,interpretPlayerAction:async(_,s)=>{s.armies.zhang_army.troops=99999;return {summary:'대화',operations:[]};}});
  await engine.submit('안녕');assert.equal(engine.snapshot().state.armies.zhang_army.troops,2000);
});
test('visual failure does not block saving a valid turn',async()=>{
  const {engine}=setup({...provider,chooseVisual:async()=>{throw new Error('visual failed');}});
  assert.equal((await engine.submit('진군')).visual.mode,'STATE_BOARD');
});

test('restored narrative context is bounded and isolated from factual state',async()=>{
  let recent:unknown;
  const {engine}=setup({...provider,narrate:async c=>{recent=c.recentNarrative;return '나는 약속을 기억한다.';}});
  await engine.submit('기억해라');
  const restored=new TurnEngine(engine.snapshot(),{...provider,narrate:async c=>{recent=c.recentNarrative;return '약속을 기억하고 있다.';}},{commit:async()=>{}});
  await restored.submit('무슨 말을 했지?');
  assert.deepEqual(recent,[{player:'기억해라',narrator:'나는 약속을 기억한다.'}]);
});
