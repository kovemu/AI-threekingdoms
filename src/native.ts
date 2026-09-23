import { invoke, isTauri } from '@tauri-apps/api/core';
import { initialScenario } from './core/scenario.ts';
import type { SavedGame, TurnRecord } from './core/turn.ts';
import { LocalTextProvider } from './ai/local.ts';
export const desktopAvailable=isTauri();
export interface ModelStatus {phase:string;message:string;downloaded:number;total:number;modelId:string|null;hardware:{ramGb:number;vramGb:number;freeVramGb:number}|null;}
export const loadGame=()=>invoke<SavedGame>('load_game',{initial:initialScenario()});
export const nativeStore={commit:(expectedVersion:number,turn:TurnRecord)=>invoke<void>('save_turn',{expectedVersion,turn})};
export const localProvider=new LocalTextProvider(request=>invoke<string>('complete_text',{request}));
export const prepareModel=()=>invoke<ModelStatus>('prepare_model');
export const modelStatus=()=>invoke<ModelStatus>('model_status');
