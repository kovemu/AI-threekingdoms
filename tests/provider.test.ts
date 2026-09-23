import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialScenario } from '../src/core/scenario.ts';
import { compactProjection } from '../src/core/projection.ts';
import { LocalTextProvider } from '../src/ai/local.ts';

test('projection includes referenced remote characters but excludes unrelated distant armies and transcript',()=>{
  const s=initialScenario();
  const p=compactProjection(s,'장로와 한중에 대해 논의한다');
  assert.ok(p.characters.some(c=>c.id==='zhang_lu'));
  assert.ok(p.armies.some(a=>a.id==='zhang_lu_army'));
  assert.ok(!p.characters.some(c=>c.id==='cao_cao'));
  assert.ok(JSON.stringify(p).length<9000);
});
test('local provider requests structured JSON and validates rather than accepts state replacement',async()=>{
  const requests:Record<string,unknown>[]=[];
  const ai=new LocalTextProvider(async r=>{requests.push(r);return '{"summary":"대화","operations":[]}';});
  const result=await ai.interpretPlayerAction('안녕',initialScenario());
  assert.deepEqual(result.operations,[]);
  assert.ok(requests[0].jsonSchema);
  // llama.cpp constrains tokens with json_schema but does not teach the model its fields.
  const messages=requests[0].messages as {role:string;content:string}[];
  assert.ok(messages[0].content.includes(JSON.stringify(requests[0].jsonSchema)));
  const bad=new LocalTextProvider(async()=>'{"summary":"x","operations":[],"state":{}}');
  await assert.rejects(()=>bad.interpretPlayerAction('안녕',initialScenario()));
});
test('narrator uses validated result and never proposal summary as fact',async()=>{
  let content='';
  const ai=new LocalTextProvider(async r=>{content=JSON.stringify(r);return '장비가 명을 기다린다.';});
  const s=initialScenario();
  assert.equal(await ai.narrate({stateBefore:s,stateAfter:s,playerInput:'한중 점령!',resolvedSummary:'점령하지 못했다.'}),'장비가 명을 기다린다.');
  assert.ok(content.includes('점령하지 못했다.'));
});
