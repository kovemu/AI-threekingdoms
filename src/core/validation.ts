import { z } from 'zod';
import type { WorldState } from './types.ts';
import type { ProposedTurn, WorldOperation } from './operations.ts';
import { routes } from './scenario.ts';

const id = z.string().regex(/^[a-z][a-z0-9_]{0,63}$/).refine(v=>!['constructor','prototype','__proto__'].includes(v));
const operationSchema = z.discriminatedUnion('type', [
  z.object({type:z.literal('move_army'),armyId:id,toLocationId:id}).strict(),
  z.object({type:z.literal('transfer_troops'),fromArmyId:id,toArmyId:id,amount:z.number().int().positive().max(1000000)}).strict(),
  z.object({type:z.literal('move_character'),characterId:id,toLocationId:id}).strict(),
  z.object({type:z.literal('change_relation'),relationId:id,delta:z.number().int().min(-10).max(10)}).strict(),
  z.object({type:z.literal('change_territory_owner'),locationId:id,ownerFactionId:id.nullable()}).strict(),
  z.object({type:z.literal('create_event'),event:z.object({id,type:z.enum(['diplomacy','court','travel','feast','rumor']),title:z.string().trim().min(1).max(160),locationId:id.optional()}).strict()}).strict(),
  z.object({type:z.literal('resolve_event'),eventId:id}).strict(),
]);
export function parseProposal(value: unknown): ProposedTurn {
  return z.object({summary:z.string().trim().min(1).max(500),operations:z.array(operationSchema).max(12)}).strict().parse(value);
}
function requireRule(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(message);
}
function get<T>(items: Record<string,T>, key: string): T {
  requireRule(Object.hasOwn(items,key), `존재하지 않는 ID: ${key}`);
  return items[key];
}
export function routeDistance(from: string, to: string): number {
  const queue: [string,number][]=[[from,0]], seen=new Set<string>();
  while(queue.length) {
    const [place,distance]=queue.shift()!;
    if(place===to) return distance;
    if(seen.has(place)) continue;
    seen.add(place);
    for(const next of routes[place] ?? []) queue.push([next,distance+1]);
  }
  throw new Error('이동 가능한 경로가 없습니다.');
}
export function assertWorld(s: WorldState): void {
  requireRule(s.schemaVersion===1,'지원하지 않는 저장 버전입니다.');
  const {year,month,day}=s.calendar;
  const date=new Date(Date.UTC(year,month-1,day));
  requireRule(Number.isInteger(year)&&year>=100&&year<=9999&&date.getUTCFullYear()===year&&date.getUTCMonth()===month-1&&date.getUTCDate()===day,'날짜가 잘못되었습니다.');
  for(const table of [s.characters,s.armies,s.locations,s.factions]) for(const [key,v] of Object.entries(table)) requireRule(id.safeParse(key).success&&key===v.id,'ID 불일치');
  const player=get(s.characters,s.player.characterId);
  requireRule(player.alive&&player.locationId===s.player.locationId&&player.factionId===s.player.factionId,'플레이어 상태 불일치');
  for(const c of Object.values(s.characters)) {
    get(s.locations,c.locationId); if(c.factionId!==null)get(s.factions,c.factionId);
  }
  for(const f of Object.values(s.factions)) {
    requireRule(Number.isFinite(f.food)&&f.food>=0&&Number.isFinite(f.treasury)&&f.treasury>=0,'자원 오류');
    if(f.leaderCharacterId!==null) requireRule(get(s.characters,f.leaderCharacterId).factionId===f.id,'세력 지도자 오류');
  }
  for(const l of Object.values(s.locations)) if(l.ownerFactionId!==null)get(s.factions,l.ownerFactionId);
  const commanders=new Set<string>();
  for(const a of Object.values(s.armies)) {
    get(s.locations,a.locationId); get(s.factions,a.factionId);
    requireRule(Number.isSafeInteger(a.troops)&&a.troops>=0&&a.troops<=1000000,'병력 오류');
    requireRule(Number.isFinite(a.morale)&&a.morale>=0&&a.morale<=100,'사기 오류');
    if(a.commanderCharacterId!==null) {
      const c=get(s.characters,a.commanderCharacterId);
      requireRule(c.alive&&c.locationId===a.locationId&&c.factionId===a.factionId&&!commanders.has(c.id),'지휘관 상태 오류');
      commanders.add(c.id);
    }
  }
  for(const [key,r] of Object.entries(s.relations)) {
    requireRule(id.safeParse(key).success&&r.aFactionId!==r.bFactionId,'외교 ID 오류');
    get(s.factions,r.aFactionId);get(s.factions,r.bFactionId);
    requireRule(Number.isFinite(r.score)&&r.score>=-100&&r.score<=100,'외교 수치 오류');
    requireRule(['allied','friendly','neutral','hostile','war'].includes(r.status),'외교 상태 오류');
  }
  const eventIds=new Set<string>();
  for(const e of s.activeEvents) {
    requireRule(id.safeParse(e.id).success&&!eventIds.has(e.id),'사건 ID 중복');eventIds.add(e.id);
    if(e.locationId)get(s.locations,e.locationId);
  }
}
export function applyOperations(state: WorldState, operations: WorldOperation[]): WorldState {
  assertWorld(state);
  const ops=z.array(operationSchema).max(12).parse(operations);
  const s=structuredClone(state);
  const owned=(faction:string|null)=>requireRule(faction!==null&&faction===s.player.factionId,'다른 세력에 직접 명령할 수 없습니다.');
  for(const op of ops) {
    switch(op.type) {
      case 'move_army': {
        const a=get(s.armies,op.armyId); owned(a.factionId);get(s.locations,op.toLocationId);
        requireRule(a.troops>0,'병력이 없는 부대는 이동할 수 없습니다.');routeDistance(a.locationId,op.toLocationId);
        a.locationId=op.toLocationId;
        if(a.commanderCharacterId) get(s.characters,a.commanderCharacterId).locationId=op.toLocationId;
        if(a.commanderCharacterId===s.player.characterId)s.player.locationId=op.toLocationId;
        break;
      }
      case 'transfer_troops': {
        const from=get(s.armies,op.fromArmyId),to=get(s.armies,op.toArmyId);
        owned(from.factionId);owned(to.factionId);
        requireRule(from.id!==to.id&&from.locationId===to.locationId,'병력은 같은 지역의 다른 부대로만 보낼 수 있습니다.');
        requireRule(from.troops>=op.amount,`${from.name}의 병력이 부족합니다. 현재 ${from.troops}명입니다.`);
        from.troops-=op.amount;to.troops+=op.amount;break;
      }
      case 'move_character': {
        const c=get(s.characters,op.characterId);owned(c.factionId);get(s.locations,op.toLocationId);
        requireRule(c.alive,'사망한 인물은 이동할 수 없습니다.');
        requireRule(c.locationId===op.toLocationId||!Object.values(s.armies).some(a=>a.commanderCharacterId===c.id),'지휘관은 부대 이동 명령으로 이동합니다.');
        routeDistance(c.locationId,op.toLocationId);c.locationId=op.toLocationId;
        if(c.id===s.player.characterId)s.player.locationId=op.toLocationId;break;
      }
      case 'change_relation': {
        const r=get(s.relations,op.relationId);
        requireRule([r.aFactionId,r.bFactionId].includes(s.player.factionId!),'관련 없는 세력의 외교는 변경할 수 없습니다.');
        r.score=Math.max(-100,Math.min(100,r.score+op.delta));
        r.status=r.score<=-75?'war':r.score<-25?'hostile':r.score<25?'neutral':r.score<75?'friendly':'allied';break;
      }
      case 'change_territory_owner': {
        const l=get(s.locations,op.locationId);owned(op.ownerFactionId);
        requireRule(Object.values(s.armies).some(a=>a.locationId===l.id&&a.factionId===op.ownerFactionId&&a.troops>0),'점령할 부대가 없습니다.');
        requireRule(!Object.values(s.armies).some(a=>a.locationId===l.id&&a.factionId!==op.ownerFactionId&&a.troops>0),'상대 부대가 있는 지역을 즉시 점령할 수 없습니다.');
        l.ownerFactionId=op.ownerFactionId;break;
      }
      case 'create_event': {
        requireRule(!s.activeEvents.some(e=>e.id===op.event.id),'사건 ID 중복');
        requireRule(s.activeEvents.filter(e=>e.active).length<30,'진행 중인 사건이 너무 많습니다.');
        if(op.event.locationId)get(s.locations,op.event.locationId);
        s.activeEvents.push({...op.event,active:true});break;
      }
      case 'resolve_event': {
        const e=s.activeEvents.find(e=>e.id===op.eventId&&e.active);
        requireRule(e,'해결할 사건이 없습니다.');
        requireRule(!['conflict','battle','siege'].includes(e.type),'군사 충돌은 대화만으로 해결할 수 없습니다.');e.active=false;break;
      }
    }
    assertWorld(s);
  }
  return s;
}
