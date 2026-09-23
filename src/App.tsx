import { useEffect, useRef, useState, type FormEvent } from 'react';
import { TurnEngine, type SavedGame } from './core/turn.ts';
import { initialScenario, SCENARIO_TITLE } from './core/scenario.ts';
import { desktopAvailable, loadGame, localProvider, nativeStore, prepareModel, modelStatus, type ModelStatus } from './native.ts';

const initial:SavedGame={version:0,state:initialScenario(),turns:[]};
const waiting:ModelStatus={phase:'checking',message:'저장된 세계를 불러옵니다',downloaded:0,total:0,modelId:null,hardware:null};
export default function App() {
  const [game,setGame]=useState(initial),[status,setStatus]=useState(waiting);
  const [input,setInput]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[loaded,setLoaded]=useState(false);
  const engine=useRef<TurnEngine|null>(null),end=useRef<HTMLDivElement>(null),preparing=useRef(false),started=useRef(false);
  const restore=async()=>{
    const saved=await loadGame();engine.current=new TurnEngine(saved,localProvider,nativeStore);setGame(engine.current.snapshot());setLoaded(true);
  };
  const prepare=async()=>{
    if(preparing.current)return;preparing.current=true;setError('');
    try{setStatus(waiting);setStatus(await prepareModel());}catch(e){setError(String(e));setStatus(s=>({...s,phase:'error'}));}finally{preparing.current=false;}
  };
  useEffect(()=>{
    if(!desktopAvailable){setStatus({...waiting,phase:'desktop',message:'Windows 데스크톱 앱에서 플레이할 수 있습니다'});return;}
    if(!started.current){started.current=true;void restore().then(prepare).catch(e=>setError(String(e)));}
    const timer=setInterval(()=>{void modelStatus().then(setStatus).catch(()=>{});},700);
    return ()=>clearInterval(timer);
  },[]);
  useEffect(()=>{end.current?.scrollIntoView({behavior:'smooth',block:'nearest'});},[game.version,busy]);
  const send=async(e:FormEvent)=>{
    e.preventDefault();if(!engine.current||busy||status.phase!=='ready'||!input.trim())return;
    setBusy(true);setError('');
    try{await engine.current.submit(input);setGame(engine.current.snapshot());setInput('');}
    catch(e){setError(`이번 행동을 완료하지 못했습니다. ${String(e)}`);try{await restore();}catch{setError('저장 상태 확인에 실패했습니다. 입력을 보존했습니다. 앱을 재실행해 주세요.');setLoaded(false);}}
    finally{setBusy(false);}
  };
  const state=game.state,latest=game.turns.at(-1);
  const location=state.locations[state.player.locationId];
  const percent=status.total>0?Math.min(100,Math.floor(status.downloaded/status.total*100)):null;
  return <main className="shell">
    <header className="masthead"><div><p className="eyebrow">A WORLD THAT REMEMBERS</p><h1>삼국지 <span>서사록</span></h1></div><div className="chapter">{SCENARIO_TITLE}<small>로컬 플레이 · 턴 {game.version}</small></div></header>
    <section className="visual" aria-label="현재 상황 읽기 전용 시각 영역">
      <div className="visual-heading"><span className="tag">상황 기록</span><span>{state.calendar.year}년 {state.calendar.month}월 {state.calendar.day}일</span></div>
      <div className="visual-intro"><div className="seal" aria-hidden="true">蜀</div><div><p className="eyebrow">당신이 머무는 곳</p><h2>{location.name}</h2><p>{state.characters[state.player.characterId].name} · {state.player.factionId?state.factions[state.player.factionId].name:'무소속'}</p></div><div className="visual-note">당신의 말이 세계를 움직입니다.<br/>이 화면은 현재 상황을 보여줍니다.</div></div>
      <div className="locations">{Object.values(state.locations).map(l=><article className="location" key={l.id}><div><h3>{l.name}</h3><span>{l.ownerFactionId?state.factions[l.ownerFactionId].name:'무주지'}</span></div><p>{Object.values(state.characters).filter(c=>c.locationId===l.id&&c.alive).map(c=>c.name).join(' · ')||'주요 인물 없음'}</p><small>{Object.values(state.armies).filter(a=>a.locationId===l.id).map(a=>`${a.name} ${a.troops.toLocaleString()}명`).join(' / ')||'주둔 부대 없음'}</small></article>)}</div>
      <div className="events"><span>주요 사건</span>{state.activeEvents.filter(e=>e.active).slice(-3).map(e=><p key={e.id}>{e.title}</p>)}</div>
      <p className="visual-caption">Milestone 1 · 상태 요약 / 정밀 지도와 장면 이미지는 추후 추가됩니다.{latest?.requestedVisual.mode==='SCENE'?' 이번 장면은 상태 요약으로 표시합니다.':''}</p>
    </section>
    <section className="story" aria-label="이야기 기록" aria-live="polite">
      <div className="story-title"><h2>이어지는 이야기</h2><span>기록 {game.version}</span></div>
      {game.turns.length===0?<article className="entry opening"><span className="entry-label">서막</span><p>익주에 새로운 질서가 자리 잡기 시작했다. 성도에는 장비의 병사 2천과 수비대 5천이 머물고, 북쪽 한중에서는 장로군의 움직임이 심상치 않다.</p><p>제갈량이 지도를 접으며 묻는다. “주공, 이제 어디로 뜻을 펼치시겠습니까?”</p></article>:game.turns.map(turn=><article className="entry" key={turn.id}><div className="entry-label">제 {turn.number} 턴 · {turn.state.calendar.month}월 {turn.state.calendar.day}일</div><p className="player-line">{turn.input}</p><p>{turn.narration}</p><details><summary>확정된 변화</summary><p className="facts">{turn.summary}</p></details></article>)}
      {busy&&<p className="thinking" role="status">명령을 검토하고 이야기를 이어가는 중…</p>}<div ref={end}/>
    </section>
    <footer className="composer">
      <div className={`model-status ${status.phase}`} role="status"><span className="status-dot"/><span>{busy?'로컬 AI가 이번 턴을 처리하고 있습니다':status.message}{percent!==null&&status.phase==='downloading'?` · ${percent}% (${(status.downloaded/1e9).toFixed(2)} / ${(status.total/1e9).toFixed(2)} GB)`:''}</span>{status.phase==='ready'&&<small>{status.modelId}</small>}</div>
      {status.phase==='downloading'&&<progress max={status.total||1} value={status.downloaded}/>}
      {!['ready','error','desktop'].includes(status.phase)&&<p className="setup-note">최초 실행 시 모델을 자동으로 준비합니다. 기본 약 5GB, 저사양 약 2.5GB · 다운로드를 중단해도 다음 실행에서 이어받습니다.</p>}
      {status.phase==='desktop'&&<p className="setup-note">이 브라우저 화면은 UI 미리보기입니다. 실제 AI와 저장 기능은 데스크톱 앱에 포함됩니다.</p>}
      {error&&<div className="error" role="alert"><span>{error}</span>{!busy&&desktopAvailable&&<button type="button" onClick={()=>{if(!loaded)void restore().then(prepare).catch(e=>setError(String(e)));else if(status.phase!=='ready')void prepare();else setError('');}}>{status.phase==='ready'?'확인':'다시 시도'}</button>}</div>}
      <form onSubmit={send}><label className="sr-only" htmlFor="action">행동 입력</label><textarea id="action" value={input} onChange={e=>setInput(e.target.value)} maxLength={2000} rows={2} placeholder="장비에게 병사 3천을 맡겨 한중으로 보내고 나는 성도에 남는다." disabled={busy||!desktopAvailable} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();e.currentTarget.form?.requestSubmit();}}}/><button className="send" disabled={busy||!loaded||status.phase!=='ready'||!input.trim()}>{busy?'진행 중…':'이야기 잇기'}<span aria-hidden="true">↗</span></button></form>
      <div className="composer-hint"><span>Enter 전송 · Shift + Enter 줄바꿈</span><span>{game.version>0?'마지막 완료 턴 자동 저장됨':'행동을 자유롭게 입력하세요'}</span></div>
    </footer>
  </main>;
}
