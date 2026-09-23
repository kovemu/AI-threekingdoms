import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialScenario } from '../src/core/scenario.ts';
import { applyOperations, assertWorld, parseProposal } from '../src/core/validation.ts';

test('scenario has six locations, eight characters and four factions', () => {
  const s = initialScenario();
  assert.equal(Object.keys(s.locations).length, 6);
  assert.equal(Object.keys(s.characters).length, 8);
  assert.equal(Object.keys(s.factions).length, 4);
  assertWorld(s);
});
test('transfer and march preserve troops and synchronize commander position', () => {
  const s = initialScenario();
  const next = applyOperations(s, [
    {type:'transfer_troops', fromArmyId:'garrison', toArmyId:'zhang_army', amount:1000},
    {type:'move_army', armyId:'zhang_army', toLocationId:'jiameng'},
  ]);
  assert.equal(next.armies.zhang_army.troops, 3000);
  assert.equal(next.armies.garrison.troops, 4000);
  assert.equal(next.characters.zhang_fei.locationId, 'jiameng');
  assert.equal(s.armies.zhang_army.locationId, 'chengdu');
});
test('an invalid second operation leaves input world exactly unchanged', () => {
  const s=initialScenario(), before=structuredClone(s);
  assert.throws(()=>applyOperations(s,[
    {type:'move_army',armyId:'zhang_army',toLocationId:'jiameng'},
    {type:'transfer_troops',fromArmyId:'zhang_army',toArmyId:'garrison',amount:5000},
  ]));
  assert.deepEqual(s,before);
});
for (const amount of [-1, 0, 0.5, Infinity, NaN, 999999]) {
  test(`reject troop amount ${amount}`,()=>assert.throws(()=>applyOperations(initialScenario(),[
    {type:'transfer_troops',fromArmyId:'garrison',toArmyId:'zhang_army',amount},
  ])));
}
test('reject unknown fields, unknown operation, prototype keys and more than 12 operations',()=>{
  for (const operations of [
    [{type:'set_world',state:{}}],
    [{type:'move_army',armyId:'zhang_army',toLocationId:'jiameng',troops:9999}],
    [{type:'move_army',armyId:'__proto__',toLocationId:'jiameng'}],
    Array.from({length:13},()=>({type:'move_army',armyId:'zhang_army',toLocationId:'jiameng'})),
  ]) assert.throws(()=>parseProposal({summary:'x',operations}));
});
test('cannot command enemy army or teleport independently from army',()=>{
  assert.throws(()=>applyOperations(initialScenario(),[{type:'move_army',armyId:'zhang_lu_army',toLocationId:'chengdu'}]));
  assert.throws(()=>applyOperations(initialScenario(),[{type:'move_character',characterId:'zhang_fei',toLocationId:'jiameng'}]));
});
test('capture requires occupation and absence of hostile troops',()=>{
  assert.throws(()=>applyOperations(initialScenario(),[{type:'change_territory_owner',locationId:'hanzhong',ownerFactionId:'liu'}]));
});
test('dead commander and mismatched player state fail invariants',()=>{
  const s=initialScenario(); s.characters.zhang_fei.alive=false;
  assert.throws(()=>assertWorld(s));
  const t=initialScenario(); t.player.locationId='hanzhong';
  assert.throws(()=>assertWorld(t));
});
test('events reject duplicate IDs and missing event resolution',()=>{
  const s=initialScenario();
  assert.throws(()=>applyOperations(s,[{type:'create_event',event:{id:s.activeEvents[0].id,type:'war',title:'x'}}]));
  assert.throws(()=>applyOperations(s,[{type:'resolve_event',eventId:'missing'}]));
});
