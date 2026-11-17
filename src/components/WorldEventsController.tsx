import {useEffect,useRef} from 'react';
import type {GameClock} from '../simulation/gameClock';
import {GAME_TIME_SCALE} from '../simulation/gameClock';
import type {TrafficIncident} from '../simulation/trafficConditions';
import type {Point,RoadGraph} from '../simulation/taxi';
import type {RoadFeature} from './purpleRoadDiff';
import {advanceWorldState,incidentStatus,newWorldState,weatherAt,
 type IncidentKind,type WorldState,type WorldWeather} from '../simulation/livingWorld';

/** Headless world events: no map sources, symbols, paths, NPC cars or markers. */
export type WorldActivitySnapshot={
 weather:WorldWeather;
 incidents:Array<{
  id:string;kind:IncidentKind;status:'responding'|'on-scene'|'clearing';
  responders:string[];roadId:string;
 }>;
};
type Props={
 companyId?:string;
 gameClock?:GameClock|null;
 graph?:RoadGraph|null;
 roads:()=>ReadonlyMap<string,RoadFeature>;
 discovered:()=>Set<string>;
 center:()=>Point;
 onStatus:(summary:WorldActivitySnapshot|null)=>void;
 onTrafficChange?:(incidents:TrafficIncident[])=>void;
};
const storageKey=(companyId:string)=>'travelempire.world.v1.'+companyId;
function restore(companyId:string):WorldState{
 try{
  const parsed=JSON.parse(localStorage.getItem(storageKey(companyId))??'null') as WorldState|null;
  if(parsed&&Number.isFinite(parsed.lastBucket)&&Array.isArray(parsed.incidents))
   return {lastBucket:parsed.lastBucket,incidents:parsed.incidents.filter(i=>
    i&&typeof i.id==='string'&&Number.isFinite(i.endsAt)&&Array.isArray(i.responders)).slice(-3)};
 }catch{ /* Corrupt or older save; regenerate only event state. */ }
 return newWorldState();
}
function save(companyId:string,state:WorldState){
 try{localStorage.setItem(storageKey(companyId),JSON.stringify(state));}
 catch{ /* Private mode / quota: simulation remains usable in memory. */ }
}
export function snapshotOfWorld(state:WorldState,at:number,center:Point):WorldActivitySnapshot{
 return {
  weather:weatherAt(center,at),
  incidents:state.incidents.filter(i=>i.startedAt<=at&&i.endsAt>at)
   .map(i=>({id:i.id,kind:i.kind,status:incidentStatus(i,at),
    responders:i.responders.map(r=>r.kind),roadId:i.roadId})),
 };
}
export default function WorldEventsController({companyId,gameClock,graph,roads,discovered,center,onStatus,onTrafficChange}:Props){
 const stateRef=useRef<WorldState>(newWorldState());
 const clockRef=useRef(gameClock);clockRef.current=gameClock;
 const graphRef=useRef(graph);graphRef.current=graph;
 const roadsRef=useRef(roads);roadsRef.current=roads;
 const discoveryRef=useRef(discovered);discoveryRef.current=discovered;
 const centerRef=useRef(center);centerRef.current=center;
 const publishRef=useRef(onStatus);publishRef.current=onStatus;
 const trafficRef=useRef(onTrafficChange);trafficRef.current=onTrafficChange;
 useEffect(()=>{
  if(!companyId){publishRef.current(null);return;}
  let stopped=false;
  let lastSummary='',lastTraffic='';
  stateRef.current=restore(companyId);
  const update=()=>{
   if(stopped||document.hidden)return;
   const clock=clockRef.current;
   const at=clock?clock.epochMs+Math.max(0,Date.now()-clock.lastRealMs)*GAME_TIME_SCALE:Date.now();
   const previous=stateRef.current;
   const next=advanceWorldState(previous,at,
    [...roadsRef.current().values()],graphRef.current??null,discoveryRef.current(),companyId);
   stateRef.current=next;
   const active=next.incidents.filter(i=>i.startedAt<=at&&i.endsAt>at).map(i=>({
    roadId:i.roadId,kind:i.kind,startedAt:i.startedAt,endsAt:i.endsAt,
   }));
   const signature=JSON.stringify(active);
   if(signature!==lastTraffic){lastTraffic=signature;trafficRef.current?.(active);}
   if(next.lastBucket!==previous.lastBucket||next.incidents.length!==previous.incidents.length)
    save(companyId,next);
   const snapshot=snapshotOfWorld(next,at,centerRef.current());
   const serialized=JSON.stringify(snapshot);
   if(serialized!==lastSummary){lastSummary=serialized;publishRef.current(snapshot);}
  };
  update();
  const timer=window.setInterval(update,4000);
  const onVisible=()=>{if(!document.hidden)update();};
  document.addEventListener('visibilitychange',onVisible);
  return()=>{
   trafficRef.current?.([]);
   stopped=true;
   window.clearInterval(timer);
   document.removeEventListener('visibilitychange',onVisible);
  };
 },[companyId]);
 return null;
}
