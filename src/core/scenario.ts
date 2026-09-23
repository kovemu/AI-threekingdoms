import type { WorldState } from './types.ts';

// A deliberately small alternate-history opening, not a claim of historical accuracy.
export const SCENARIO_TITLE = '익주, 214년 · 가상 분기';
export const routes: Record<string, string[]> = {
  chengdu: ['jiameng', 'bazhong'], jiameng: ['chengdu', 'hanzhong'],
  hanzhong: ['jiameng', 'bazhong', 'xiangyang'], bazhong: ['chengdu', 'hanzhong', 'jiangling'],
  jiangling: ['bazhong', 'xiangyang'], xiangyang: ['hanzhong', 'jiangling'],
};
export function initialScenario(): WorldState {
  return {
    schemaVersion: 1, calendar: { year: 214, month: 6, day: 1 },
    player: { characterId: 'liu_bei', factionId: 'liu', locationId: 'chengdu' },
    factions: {
      liu: { id:'liu', name:'유비군', leaderCharacterId:'liu_bei', treasury:100, food:100 },
      zhang: { id:'zhang', name:'장로군', leaderCharacterId:'zhang_lu', treasury:100, food:100 },
      cao: { id:'cao', name:'조조군', leaderCharacterId:'cao_cao', treasury:100, food:100 },
      sun: { id:'sun', name:'손권군', leaderCharacterId:'sun_quan', treasury:100, food:100 },
    },
    characters: {
      liu_bei: {id:'liu_bei',name:'유비',factionId:'liu',locationId:'chengdu',alive:true},
      zhang_fei: {id:'zhang_fei',name:'장비',factionId:'liu',locationId:'chengdu',alive:true},
      zhuge_liang: {id:'zhuge_liang',name:'제갈량',factionId:'liu',locationId:'chengdu',alive:true},
      zhao_yun: {id:'zhao_yun',name:'조운',factionId:'liu',locationId:'chengdu',alive:true},
      huang_zhong: {id:'huang_zhong',name:'황충',factionId:'liu',locationId:'bazhong',alive:true},
      zhang_lu: {id:'zhang_lu',name:'장로',factionId:'zhang',locationId:'hanzhong',alive:true},
      cao_cao: {id:'cao_cao',name:'조조',factionId:'cao',locationId:'xiangyang',alive:true},
      sun_quan: {id:'sun_quan',name:'손권',factionId:'sun',locationId:'jiangling',alive:true},
    },
    locations: {
      chengdu: {id:'chengdu',name:'성도',ownerFactionId:'liu'},
      jiameng: {id:'jiameng',name:'가맹관',ownerFactionId:'liu'},
      bazhong: {id:'bazhong',name:'파중',ownerFactionId:'liu'},
      hanzhong: {id:'hanzhong',name:'한중',ownerFactionId:'zhang'},
      xiangyang: {id:'xiangyang',name:'양양',ownerFactionId:'cao'},
      jiangling: {id:'jiangling',name:'강릉',ownerFactionId:'sun'},
    },
    armies: {
      garrison: {id:'garrison',name:'성도 수비대',commanderCharacterId:'zhao_yun',factionId:'liu',locationId:'chengdu',troops:5000,morale:75},
      zhang_army: {id:'zhang_army',name:'장비 부대',commanderCharacterId:'zhang_fei',factionId:'liu',locationId:'chengdu',troops:2000,morale:80},
      huang_army: {id:'huang_army',name:'황충 부대',commanderCharacterId:'huang_zhong',factionId:'liu',locationId:'bazhong',troops:1500,morale:70},
      zhang_lu_army: {id:'zhang_lu_army',name:'한중 수비대',commanderCharacterId:'zhang_lu',factionId:'zhang',locationId:'hanzhong',troops:4000,morale:70},
    },
    relations: {
      liu_zhang: {aFactionId:'liu',bFactionId:'zhang',score:-60,status:'hostile'},
      liu_cao: {aFactionId:'liu',bFactionId:'cao',score:-80,status:'war'},
      liu_sun: {aFactionId:'liu',bFactionId:'sun',score:30,status:'friendly'},
    },
    activeEvents: [{id:'hanzhong_tension',type:'conflict',title:'한중 방면의 긴장',locationId:'hanzhong',active:true}],
    flags: { scenario: 'yizhou-214-v1' },
  };
}
