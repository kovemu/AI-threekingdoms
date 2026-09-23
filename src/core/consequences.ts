import type { WorldState } from './types.ts';
import type { WorldOperation } from './operations.ts';
import { routeDistance, assertWorld } from './validation.ts';

export function consequences(before:WorldState, draft:WorldState, ops:WorldOperation[], turn:number): {state:WorldState;summary:string} {
  const s=structuredClone(draft), notes:string[]=[];
  let days=ops.length?1:0;
  for(const a of Object.values(s.armies)) {
    const old=before.armies[a.id];
    if(old.locationId!==a.locationId) {
      days=Math.max(days,routeDistance(old.locationId,a.locationId));
      notes.push(`${a.name} ${a.troops}명이 ${s.locations[old.locationId].name}에서 ${s.locations[a.locationId].name}으로 이동했다.`);
    }
    if(old.troops!==a.troops)notes.push(`${a.name} 병력: ${old.troops} → ${a.troops}명.`);
  }
  for(const c of Object.values(s.characters)) if(before.characters[c.id].locationId!==c.locationId) {
    days=Math.max(days,routeDistance(before.characters[c.id].locationId,c.locationId));
    notes.push(`${c.name}의 현재 위치는 ${s.locations[c.locationId].name}이다.`);
  }
  for(const l of Object.values(s.locations)) if(before.locations[l.id].ownerFactionId!==l.ownerFactionId)notes.push(`${l.name} 소유 세력: ${l.ownerFactionId===null?'없음':s.factions[l.ownerFactionId].name}.`);
  for(const [id,r] of Object.entries(s.relations)) if(before.relations[id].score!==r.score)notes.push(`외교 ${id}: ${r.score} (${r.status}).`);
  for(const e of s.activeEvents) {
    const old=before.activeEvents.find(x=>x.id===e.id);
    if(!old)notes.push(`새 사건: ${e.title}.`);
    else if(old.active&&!e.active)notes.push(`종료된 사건: ${e.title}.`);
  }
  for(const l of Object.values(s.locations)) {
    const here=Object.values(s.armies).filter(a=>a.locationId===l.id&&a.troops>0);
    const friendly=here.some(a=>a.factionId===s.player.factionId);
    const hostile=here.some(a=>a.factionId!==s.player.factionId&&Object.values(s.relations).some(r=>[r.aFactionId,r.bFactionId].includes(a.factionId)&&[r.aFactionId,r.bFactionId].includes(s.player.factionId!)&&['hostile','war'].includes(r.status)));
    if(friendly&&hostile&&!s.activeEvents.some(e=>e.active&&e.type==='battle'&&e.locationId===l.id)) {
      s.activeEvents.push({id:`contact_${l.id}_${turn}`,type:'battle',title:`${l.name}에서 양군 대치`,locationId:l.id,active:true});
      notes.push(`${l.name}에서 양군이 대치한다. 전투 결과·피해·점령은 아직 확정되지 않았다.`);
    }
  }
  const d=new Date(Date.UTC(s.calendar.year,s.calendar.month-1,s.calendar.day+days));
  s.calendar={year:d.getUTCFullYear(),month:d.getUTCMonth()+1,day:d.getUTCDate()};
  assertWorld(s);
  return {state:s,summary:notes.length?notes.join('\n'):'세계 상태 변화 없음. 대화로 이어간다.'};
}
