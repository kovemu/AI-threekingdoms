import type { WorldState } from './types.ts';
import { routes } from './scenario.ts';

export function compactProjection(s:WorldState,input:string) {
  const places=new Set([s.player.locationId,...(routes[s.player.locationId]??[])]);
  for(const l of Object.values(s.locations))if(input.includes(l.name)||input.toLowerCase().includes(l.id))places.add(l.id);
  for(const c of Object.values(s.characters))if(input.includes(c.name)||input.toLowerCase().includes(c.id))places.add(c.locationId);
  const characters=Object.values(s.characters).filter(c=>places.has(c.locationId)).slice(0,16);
  const armies=Object.values(s.armies).filter(a=>places.has(a.locationId)||input.includes(a.name)).slice(0,12);
  // A small location directory permits references to faraway destinations without the full world.
  const locations=Object.values(s.locations).slice(0,24);
  const owned=armies.filter(a=>a.factionId===s.player.factionId);
  const commandableArmies=owned.map(a=>({id:a.id,name:a.name,commanderName:a.commanderCharacterId?s.characters[a.commanderCharacterId]?.name:null,
    locationId:a.locationId,troops:a.troops,
    reinforcementSources:owned.filter(b=>b.id!==a.id&&b.locationId===a.locationId).map(b=>({id:b.id,troops:b.troops})),
  }));
  return {
    calendar:s.calendar,player:s.player,commandableArmies,locations,characters,armies,
    factions:Object.values(s.factions).map(f=>({id:f.id,name:f.name})).slice(0,8),
    relations:Object.entries(s.relations).filter(([,r])=>r.aFactionId===s.player.factionId||r.bFactionId===s.player.factionId).slice(0,8).map(([id,r])=>({id,...r})),
    events:s.activeEvents.filter(e=>e.active&&(!e.locationId||places.has(e.locationId))).slice(-6),
  };
}
