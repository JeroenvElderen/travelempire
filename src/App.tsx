import {readExploration,writeExploration,clearExploration} from './data/explorationStore';
import {energySpec,energyRemaining,energyUsed,energyPercent,energyRangeKm} from './simulation/energy';
import {loadStationTile,type Station} from './data/stations';
import {demandAt} from './simulation/demand';
import { useEffect, useState } from "react";
import { BarChart3, Building2, CarFront, Compass, FlaskConical, Landmark, Map as MapIcon, Ship, Menu, X, PanelLeftClose, PanelLeftOpen, LockKeyhole, CircleDollarSign, Activity } from "lucide-react";
import WorldMap from "./components/WorldMap";
import FleetPanel from "./components/FleetPanel";
import OperationsPanel from "./components/OperationsPanel";
import FinancePanel from "./components/FinancePanel";
import FerryRoutesPanel from "./components/FerryRoutesPanel";
import {advanceLoans,createLoan,LOAN_OFFERS,UPGRADES} from "./economy";
import type {EconomyUpgrade} from "./simulation/taxi";
import {loadRoadGraph,loadFleet,saveFleet,tickTaxi,DRIVER_COST,nearest,route,type RoadGraph,type FleetState, type Taxi, type PassengerRequest,meters,type FinancialTransaction} from "./simulation/taxi";
import "./taxi.css";
import {deliveryRoute, type VehicleOffer} from "./dealership";
import ResearchPanel from "./components/ResearchPanel";
import * as Research from "./research";
import CompanySetup from "./components/CompanySetup";
import {clearCompany,loadCompany, saveCompany,type Company,type Headquarters} from './company';
import "./map-update.css";
import "./company.css";

import {RoadNetworkManager} from './data/roadNetworkManager';
import {loadFerryNetwork} from './maritime/ferries';
import {useRef} from 'react';
import {loadGameClock,advanceGameClock,saveGameClock,isShiftActive,type GameClock} from './simulation/gameClock';


const navigation=[{name:"World",icon:MapIcon},{name:"Fleet",icon:CarFront},{name:"Operations",icon:Compass},{name:"Ferries",icon:Ship},{name:"Company",icon:Building2},{name:"Finance",icon:Landmark},{name:"Empire",icon:BarChart3},{name:"Research",icon:FlaskConical}] as const;
type Page=(typeof navigation)[number]['name'];
type RecoveryJob={truck:Taxi;targetId:string;phase:'pickup'|'transport'|'return';destination:[number,number];purpose:'fuel'|'service'|'depot';atDepot:boolean};

export default function App(){
 const [page,setPage]=useState<Page>('World');const [sidebarCollapsed,setSidebarCollapsed]=useState(()=>{try{return localStorage.getItem('travelempire.sidebar.collapsed')==='true'}catch{return false}});useEffect(()=>{try{localStorage.setItem('travelempire.sidebar.collapsed',String(sidebarCollapsed))}catch{}},[sidebarCollapsed]);const [drawerOpen,setDrawerOpen]=useState(false);const [company,setCompany]=useState<Company|null>(loadCompany);const [selection,setSelection]=useState<Headquarters|null>(null);const [selecting,setSelecting]=useState(false);const [showSetup,setShowSetup]=useState(false);const [placingDepot,setPlacingDepot]=useState(false);
 const [gameClock,setGameClock]=useState<GameClock|null>(()=>company?loadGameClock(company.id):null);
 const gameClockRef=useRef(gameClock);gameClockRef.current=gameClock;
 useEffect(()=>{
  if(!company){setGameClock(null);return;}
  const id=company.id;
  let current=loadGameClock(id);
  gameClockRef.current=current;setGameClock(current);
  const update=()=>{current=advanceGameClock(current);gameClockRef.current=current;setGameClock(current);saveGameClock(id,current);};
  const timer=window.setInterval(update,1000);
  window.addEventListener('pagehide',update);
  return()=>{window.clearInterval(timer);window.removeEventListener('pagehide',update);saveGameClock(id,current);};
 },[company?.id]);
 const [shiftHours,setShiftHours]=useState<8|10>(()=>{
  try{return localStorage.getItem('travelempire.shiftHours')==='10'?10:8}catch{return 8}
 });
 useEffect(()=>{try{localStorage.setItem('travelempire.shiftHours',String(shiftHours))}catch{}},[shiftHours]);
 const [graph,setGraph]=useState<RoadGraph|null>(null);
 const networkRef=useRef<RoadNetworkManager|null>(null);
 const stationsRef=useRef<Map<string,Station>>(new Map());
 const stationLoadedRef=useRef<Set<string>>(new Set());
 const [roadPackages,setRoadPackages]=useState(0);
 const [roadDiagnostics,setRoadDiagnostics]=useState({queued:0,edges:0,workerEdges:0});
 const [missionQueue,setMissionQueue]=useState<PassengerRequest[]>([]);
 const queueRef=useRef<PassengerRequest[]>([]);
 const lastMissionAt=useRef(0);

 const dispatchWorkerRef=useRef<Worker|null>(null);
 const dispatchBusyRef=useRef(false);
 const graphRevisionRef=useRef(0);
 const workerReadyRef=useRef(false);
 const roadSyncPendingRef=useRef(0);
 const workerRoadCountRef=useRef(0);
 const territoryDiscoveryAllowedRef=useRef<Set<string>>(new Set());
 const discoveredCacheRef=useRef<{ids:string[];set:Set<string>}|null>(null);
 const roadLengthByIdRef=useRef<Map<string,number>>(new Map());
 const [companyTab,setCompanyTab]=useState<'overview'|'depots'|'vehicles'|'settings'>('overview');
 const [fleet,setFleet]=useState<FleetState>(()=>company?loadFleet(company.id):{taxis:[],revenue:0,completed:0});
 const companyRef=useRef(company);companyRef.current=company;
 const pendingCashRef=useRef(0);
 useEffect(()=>{
  if(!company)return;
  const timer=window.setInterval(()=>{
   const points:[[number,number],...Array<[number,number]>]=[[company.headquarters.lng,company.headquarters.lat],...taxisRef.current.map(t=>t.position)];
   for(const [lng,lat] of points){
    const tile=`${Math.floor(lng*10)}_${Math.floor(lat*10)}`;
    if(stationLoadedRef.current.has(tile))continue;
    stationLoadedRef.current.add(tile);
    void loadStationTile(lng,lat).then(stations=>{for(const station of stations)stationsRef.current.set(station.id,station)}).catch(()=>stationLoadedRef.current.delete(tile));
   }
  },5000);
  return()=>window.clearInterval(timer);
 },[company?.id]);
 const taxisRef=useRef(fleet.taxis);
 taxisRef.current=fleet.taxis;
 // A single depot-based recovery truck serves the entire fleet.
 const [recovery,setRecovery]=useState<RecoveryJob|null>(null);
 const recoveryRef=useRef<RecoveryJob|null>(null);recoveryRef.current=recovery;
 const idleWatch=useRef(new Map<string,{position:[number,number];since:number}>());
 useEffect(()=>{
  if(!company||!graph)return;
  const depot:[number,number]=[company.headquarters.lng,company.headquarters.lat];
  const buildRoute=(a:[number,number],b:[number,number])=>{
   const from=nearest(graph,a),to=nearest(graph,b);
   return from&&to?route(graph,from,to):null;
  };
  const timer=window.setInterval(()=>{
   const now=Date.now();
   const vehicles=taxisRef.current;
   const ids=new Set(vehicles.map(t=>t.id));
   for(const id of idleWatch.current.keys())if(!ids.has(id))idleWatch.current.delete(id);
   for(const t of vehicles){
    if(t.deliveryUntil&&t.deliveryUntil>now)continue;
    const previous=idleWatch.current.get(t.id);
    if(!previous||meters(previous.position,t.position)>10||t.status==='TO_PICKUP'||t.status==='TO_DROPOFF'){
     idleWatch.current.set(t.id,{position:[...t.position],since:now});
    }
   }
   const job=recoveryRef.current;
   if(job){
    const moving=tickTaxi(job.truck,graph,1).taxi;
    if(moving.status!=='PAUSED'){
     const next={...job,truck:moving};
     recoveryRef.current=next;setRecovery(next);
     if(job.phase==='transport')setFleet(old=>({...old,taxis:old.taxis.map(t=>t.id===job.targetId?{...t,position:moving.position}:t)}));
     return;
    }
    if(job.phase==='pickup'){
     const path=buildRoute(moving.position,job.destination);
     if(!path)return;
     const next:RecoveryJob={...job,phase:'transport',truck:{...moving,status:'RETURNING',pauseAtHome:true,path:path.path,edgeIds:path.edgeIds,leg:0,distanceIntoLeg:0,journeyEdges:[]}};
     setFleet(old=>({...old,taxis:old.taxis.map(t=>t.id===job.targetId?{...t,status:'PAUSED',recoveryPending:true,position:moving.position,path:[],edgeIds:[],speedKph:0}:t)}));
     recoveryRef.current=next;setRecovery(next);return;
    }
    if(job.phase==='transport'){
     setFleet(old=>({...old,taxis:old.taxis.map(t=>t.id===job.targetId?{
      ...t,position:moving.position,recoveryPending:false,path:[],edgeIds:[],leg:0,distanceIntoLeg:0,speedKph:0,
      status:job.purpose==='fuel'?'REFUELLING':job.purpose==='service'?'SERVICING':'PAUSED',
      refillDestination:job.purpose==='fuel'?job.destination:undefined,refillAtDepot:job.purpose==='fuel'?job.atDepot:undefined,
      refillUntil:undefined,serviceUntil:undefined,pauseAtHome:false,shiftParked:job.purpose==='depot'&&(!t.kind||t.kind==='taxi')
     }:t)}));
     const path=buildRoute(moving.position,depot);
     if(!path){recoveryRef.current=null;setRecovery(null);return;}
     const next:RecoveryJob={...job,phase:'return',truck:{...moving,status:'RETURNING',pauseAtHome:true,path:path.path,edgeIds:path.edgeIds,leg:0,distanceIntoLeg:0,journeyEdges:[]}};
     recoveryRef.current=next;setRecovery(next);return;
    }
    recoveryRef.current=null;setRecovery(null);return;
   }
   for(const t of vehicles){
    if(t.recoveryPending||t.status==='PAUSED'||t.status==='REFUELLING'||t.status==='SERVICING'||(t.deliveryUntil??0)>now)continue;
    const watch=idleWatch.current.get(t.id);
    const stalled=!!watch&&now-watch.since>=120000;
    const empty=energyPercent(t)<=0;
    const stranded=empty||((t.status==='IDLE'||t.status==='RETURNING'||t.status==='EXPLORING')&&stalled);
    if(!stranded)continue;
    const serviceDue=(t.vehicleCondition??100)<=(t.serviceThreshold??60)||(t.operatingKm??0)-(t.lastServiceKm??0)>=250;
    const purpose:RecoveryJob['purpose']=serviceDue?'service':empty||t.refillDestination?'fuel':'depot';
    const pickup=buildRoute(depot,t.position);
    if(!pickup)continue;
    const candidates=purpose==='fuel'?
     [...stationsRef.current.values()].filter(st=>st.kind===(energySpec(t).kind==='electric'?'charging':'fuel')&&st.access!=='private')
      .map(st=>({point:[st.lng,st.lat] as [number,number],atDepot:false})).concat([{point:depot,atDepot:true}]):
     [{point:depot,atDepot:true}];
    const options=candidates.map(c=>({...c,path:buildRoute(t.position,c.point)})).filter(c=>!!c.path).sort((a,b)=>(a.path!.length)-(b.path!.length));
    const destination=options[0];
    if(!destination)continue;
    const start=graph.nodes.get(nearest(graph,depot))??depot;
    const truck:Taxi={id:'heavy-recovery-truck',kind:'recovery',name:'Heavy Recovery Truck',driver:'Roadside Assistance',position:start,
     status:'RETURNING',pauseAtHome:true,path:pickup.path,edgeIds:pickup.edgeIds,leg:0,distanceIntoLeg:0,fare:0,completed:0,journeyEdges:[]};
    const next:RecoveryJob={truck,targetId:t.id,phase:'pickup',destination:destination.point,purpose,atDepot:destination.atDepot};
    recoveryRef.current=next;setRecovery(next);
    setFleet(old=>({...old,taxis:old.taxis.map(v=>v.id===t.id?{...v,status:'PAUSED',recoveryPending:true,path:[],edgeIds:[],speedKph:0}:v)}));
    break;
   }
  },1000);
  return()=>window.clearInterval(timer);
 },[company?.id,graph]);

 const [simError,setSimError]=useState('');
 const [research,setResearch]=useState<Research.ResearchState>(()=>company?Research.settle(Research.load(company.id)):Research.empty());
 const [researchError,setResearchError]=useState('');
 useEffect(()=>{setResearch(company?Research.settle(Research.load(company.id)):Research.empty())},[company?.id]);
 useEffect(()=>{if(company)Research.save(company.id,research)},[company?.id,research]);
 useEffect(()=>{if(!company)return;const timer=setInterval(()=>setResearch(old=>Research.settle(old)),1000);return()=>clearInterval(timer)},[company?.id]);
 // Prefetch the actual road graph at purchased ferry endpoints (including islands).
 // RoadNetworkManager queues at most 96 tiles and loads only two concurrently.
 useEffect(()=>{
  const manager=networkRef.current;
  const purchased=company?.purchasedFerryRouteIds??[];
  if(!manager||!graph||!purchased.length)return;
  let cancelled=false;
  void loadFerryNetwork().then(network=>{
   if(cancelled||networkRef.current!==manager)return;
   const owned=new Set(purchased);
   const portIds=new Set<string>();
   for(const route of network.routes)if(owned.has(route.id)){portIds.add(route.from);portIds.add(route.to);}
   // Do not prefetch all 128 routes; only bought endpoints.
   const points=network.ports.filter(p=>portIds.has(p.id)).map(p=>p.roadAccess??p.position);
   // Queue a bounded number of destination harbours per turn to avoid
   // saturating the existing prefetch queue or freezing mobile browsers.
   let offset=0;
   const enqueue=()=>{
    if(cancelled||networkRef.current!==manager)return;
    manager.consider(points.slice(offset,offset+2));
    offset+=2;
    if(offset<points.length)window.setTimeout(enqueue,1500);
   };
   enqueue();
  }).catch(error=>console.warn('[TravelEmpire] Ferry destination road prefetch unavailable',error));
  return()=>{cancelled=true};
 },[company?.id,company?.purchasedFerryRouteIds?.join('|'),Boolean(graph)]);
 const startResearch=(id:Research.ResearchId)=>{if(!company)return;try{const ready=Research.settle(research);const cost=Research.price(id,Research.level(ready,id)+1);if(company.cash<cost)throw Error('Insufficient funds');const next=Research.start(ready,id);const updated={...company,cash:Math.round((company.cash-cost)*100)/100};saveCompany(updated);Research.save(company.id,next);setCompany(updated);setResearch(next);setResearchError('')}catch(e){setResearchError(String(e))}};
 const cancelResearch=()=>setResearch(old=>({...old,active:undefined}));
 useEffect(()=>{
  let active=true;
  networkRef.current?.dispose();networkRef.current=null;
  setGraph(null);setRoadPackages(0);setSimError('');
  if(!company)return()=>{active=false};
  const run=async()=>{
   try{
    const manager=new RoadNetworkManager((next,count)=>{
      if(active){setGraph(next);setRoadPackages(count);}
    },message=>{if(active)console.warn('[TravelEmpire road tiles]',message)},roads=>{
       if(!active)return;
       const worker=dispatchWorkerRef.current;
       if(!worker)return;
       // Synchronize newly loaded tile edges with the dispatch worker.
       workerReadyRef.current=false;
       for(let i=0;i<roads.length;i+=2000){
        roadSyncPendingRef.current++;
        worker.postMessage({type:'addRoads',revision:graphRevisionRef.current,roads:roads.slice(i,i+2000)});
       }
     });
    networkRef.current=manager;
    await manager.initialize([company.headquarters.lng,company.headquarters.lat]);
   }catch(error){
    if(!active)return;
    console.error('[TravelEmpire] Road tiles:',error);
    setSimError(`Road tiles unavailable: ${String(error)}. Falling back to preview.`);
    try{const fallback=await loadRoadGraph();if(active)setGraph(fallback);}catch(e){if(active)setSimError(String(e));}
   }
  };
  void run();
  return()=>{active=false;networkRef.current?.dispose();networkRef.current=null};
 },[company?.id,company?.headquarters.lng,company?.headquarters.lat]);
 // Route searches and passenger generation run in a dedicated worker.
 // Worker persists for the company; new road packages are synchronized as deltas.
 useEffect(()=>{
  if(!company)return;
  const worker=new Worker(new URL('./simulation/dispatch.worker.ts',import.meta.url),{type:'module'});
  dispatchWorkerRef.current=worker;workerReadyRef.current=false;dispatchBusyRef.current=false;roadSyncPendingRef.current=0;workerRoadCountRef.current=0;
  const revision=++graphRevisionRef.current;
  worker.onmessage=(event:MessageEvent<{type:string;revision:number;taxis?:Taxi[];queue?:PassengerRequest[];error?:string;roadCount?:number;assignedCount?:number;generatedMission?:boolean;discoveryEligible?:string[]}>)=>{
   const message=event.data;
   if(message.revision!==graphRevisionRef.current)return;
   if(message.type==='ready'){workerReadyRef.current=roadSyncPendingRef.current===0&&workerRoadCountRef.current>0;return;}
   if(message.type==='roadsAdded'){roadSyncPendingRef.current=Math.max(0,roadSyncPendingRef.current-1);workerRoadCountRef.current=message.roadCount??workerRoadCountRef.current;workerReadyRef.current=roadSyncPendingRef.current===0&&workerRoadCountRef.current>0;return;}
   dispatchBusyRef.current=false;
   if(message.type==='error'){console.warn('[TravelEmpire] Dispatch worker:',message.error);setSimError('Dispatch worker: '+message.error);return;}
   if(message.type!=='result'||!message.taxis||!message.queue)return;
   if(message.discoveryEligible)territoryDiscoveryAllowedRef.current=new Set(message.discoveryEligible);
   if(message.generatedMission)lastMissionAt.current=Date.now();
   const byId=new Map(message.taxis.map(t=>[t.id,t]));
   setFleet(old=>({...old,taxis:old.taxis.map(t=>{
    const assigned=byId.get(t.id);
    // Apply boundary enforcement from the worker to already-moving Explorers.
    // Keep the current simulated position instead of reverting to the worker snapshot.
    if((t.kind==='explorer'||t.kind==='surveyor')&&t.status==='EXPLORING'&&assigned&&
       (assigned.status==='IDLE'||assigned.edgeIds.length<t.edgeIds.length)){
     if(assigned.status==='IDLE')return {...t,status:'IDLE',path:[],edgeIds:[],leg:0,distanceIntoLeg:0,speedKph:0};
     if(assigned.edgeIds.length>t.leg&&
        assigned.edgeIds.every((id,i)=>t.edgeIds[i]===id))
      return {...t,path:assigned.path,edgeIds:assigned.edgeIds};
     return {...t,status:'IDLE',path:[],edgeIds:[],leg:0,distanceIntoLeg:0,speedKph:0};
    }
    // Preserve live position, speed and leg when the worker extends a moving
    // Explorer route. Never rewind movement to an older worker snapshot.
    if(t.kind==='explorer'&&t.status==='EXPLORING'&&assigned?.status==='EXPLORING'&&
       assigned.edgeIds.length>t.edgeIds.length&&
       t.edgeIds.every((id,i)=>assigned.edgeIds[i]===id)){
     return {...t,path:assigned.path,edgeIds:assigned.edgeIds,scoutingRuns:assigned.scoutingRuns};
    }
    // Never overwrite a taxi that became busy while the worker was calculating.
    return t.status==='IDLE'&&!t.deliveryUntil&&assigned&&assigned.status!=='IDLE'?assigned:t;
   })}));
   const queue=message.queue.filter(q=>q.expiresAt>Date.now());
   queueRef.current=queue;
   setMissionQueue(old=>old.length===queue.length&&old.every((q,i)=>q.id===queue[i].id)?old:queue);
  };
  worker.onerror=(event)=>{dispatchBusyRef.current=false;console.warn('[TravelEmpire] Dispatch worker error',event.message)};
  worker.postMessage({type:'init',revision});
  return()=>{worker.terminate();if(dispatchWorkerRef.current===worker)dispatchWorkerRef.current=null;workerReadyRef.current=false;dispatchBusyRef.current=false;roadSyncPendingRef.current=0;workerRoadCountRef.current=0;workerRoadCountRef.current=0;};
 },[company?.id]);
 useEffect(()=>{
  if(!company||!graph)return;
  const timer=window.setInterval(()=>{
   if(!workerReadyRef.current||dispatchBusyRef.current||!dispatchWorkerRef.current)return;
   const now=Date.now();
   const taxis=taxisRef.current;
   if(!taxis.length)return;
   const revision=graphRevisionRef.current;
   const queue=queueRef.current.filter(q=>q.expiresAt>now);
   const discovered=discoveredCacheRef.current?.ids??fleetSaveRef.current.exploredEdgeIds??[];
   dispatchBusyRef.current=true;
   dispatchWorkerRef.current.postMessage({type:'dispatch',revision,now,taxis,queue,discovered,territory:fleetSaveRef.current.territoryEdgeIds??[],
    hq:[company.headquarters.lng,company.headquarters.lat],allowTaxiShift:!!gameClockRef.current&&isShiftActive(gameClockRef.current,8,shiftHours),allowMission:!!gameClockRef.current&&isShiftActive(gameClockRef.current,8,shiftHours)&&taxis.some(t=>(!t.kind||t.kind==='taxi'))&&now-lastMissionAt.current>=demandAt(now,taxis.filter(t=>(!t.kind||t.kind==='taxi')).length).intervalMs,
    allowScout:true});
   // Do not suppress retries merely because a dispatch message was sent.
   // Mission/scout cooldowns are applied after the worker reports an actual result.
  },500);
  return()=>window.clearInterval(timer);
 },[company?.id,graph,shiftHours]);
 // Prefetch roads near active vehicles and destinations without resetting their routes.
 useEffect(()=>{
  if(!company||!graph)return;
  const check=()=>{
   const positions:[number,number][]=[[company.headquarters.lng,company.headquarters.lat]];
   for(const taxi of taxisRef.current){
     positions.push(taxi.position);
     if(taxi.pickup)positions.push(taxi.pickup);
     if(taxi.dropoff)positions.push(taxi.dropoff);
     // Look ahead along an active journey so the next package loads before arrival.
     // Sample the path to avoid thousands of boundary checks every tick.
     if(taxi.path?.length){
       // Proactively request every road package intersecting the upcoming journey.
       // The manager samples long segments to avoid missing narrow regions.
       // Prefetch the next section rather than queueing an entire cross-country route.
       networkRef.current?.considerRoute(taxi.path.slice(Math.max(0,taxi.leg),Math.max(0,taxi.leg)+60));
       const start=Math.max(0,Math.min(taxi.leg,taxi.path.length-1));
       const end=Math.min(taxi.path.length,start+160);
       const stride=Math.max(1,Math.ceil((end-start)/24));
       for(let i=start;i<end;i+=stride)positions.push(taxi.path[i]);
       positions.push(taxi.path[end-1]);
     }
   }
   networkRef.current?.consider(positions);
   const manager=networkRef.current;
   if(manager)setRoadDiagnostics({queued:manager.queuedCount,edges:manager.edgeCount,workerEdges:workerRoadCountRef.current});
  };
  check();const timer=window.setInterval(check,12000);
  return()=>window.clearInterval(timer);
 },[company?.id,graph]);
 useEffect(()=>{setFleet(company?loadFleet(company.id):{taxis:[],revenue:0,completed:0});queueRef.current=[];discoveredCacheRef.current=null;setMissionQueue([]);lastMissionAt.current=0},[company?.id]);
 // Restore historical discoveries from IndexedDB and merge with any progress made
 // while the database was opening. Legacy localStorage discoveries are migrated.
 useEffect(()=>{if(!company)return;const id=company.id;let cancelled=false;
  readExploration(id).then(record=>{if(cancelled||!record)return;
   setFleet(old=>{const merged=[...new Set([...(old.exploredEdgeIds??[]),...record.ids])];discoveredCacheRef.current={ids:merged,set:new Set(merged)};return {...old,exploredEdgeIds:merged};});
  }).catch(error=>console.error('[TravelEmpire] Exploration restore failed',error));
  return()=>{cancelled=true};
 },[company?.id]);
 // Persist periodically instead of serialising the entire explored-road set every second.
 const fleetSaveRef=useRef(fleet);fleetSaveRef.current=fleet;
 // Keep synchronous localStorage writes outside the one-second movement callback.
 // Financial deltas are accumulated and flushed together with fleet persistence.
 useEffect(()=>{if(!company)return;const id=company.id;
  const flush=()=>{const delta=pendingCashRef.current;if(delta===0)return;
   pendingCashRef.current=0;
   const current=companyRef.current;
   if(!current||current.id!==id)return;
   const updated={...current,cash:Math.round((current.cash+delta)*100)/100};
   companyRef.current=updated;setCompany(updated);saveCompany(updated);
  };
  const timer=window.setInterval(flush,5000);
  window.addEventListener('pagehide',flush);
  return()=>{window.clearInterval(timer);window.removeEventListener('pagehide',flush);flush()};
 },[company?.id]);
 // Persist discoveries promptly rather than waiting for a five-second fleet snapshot.
 // IndexedDB merges the IDs transactionally with geometry written by WorldMap.
 useEffect(()=>{if(!company)return;const id=company.id;let busy=false;let pending=false;
  const saveExploration=async()=>{if(busy){pending=true;return;}busy=true;
   try{do{pending=false;const ids=fleetSaveRef.current.exploredEdgeIds??[];
    if(ids.length)await writeExploration(id,{ids,segments:{}});
   }while(pending)}catch(error){console.error('[TravelEmpire] Exploration save failed',error)}finally{busy=false;}
  };
  const timer=window.setInterval(saveExploration,5000);
  window.addEventListener('pagehide',saveExploration);
  return()=>{window.clearInterval(timer);window.removeEventListener('pagehide',saveExploration);void saveExploration()};
 },[company?.id]);
 // Cloud synchronization is throttled; IndexedDB writes remain immediate.
 useEffect(()=>{if(!company||!fleet.exploredEdgeIds?.length)return;
  const timer=window.setTimeout(()=>{void writeExploration(company.id,{ids:fleet.exploredEdgeIds??[],segments:{}}).catch(error=>console.error('[TravelEmpire] Discovery save failed',error));},350);
  return()=>window.clearTimeout(timer);
 },[company?.id,fleet.exploredEdgeIds]);
 useEffect(()=>{if(!company)return;const id=company.id;const save=()=>{try{saveFleet(id,{...fleetSaveRef.current,exploredEdgeIds:[]})}catch(error){console.error('[TravelEmpire] Fleet save failed',error)}};
  const timer=window.setInterval(save,5000);
  window.addEventListener('pagehide',save);
  return()=>{window.clearInterval(timer);window.removeEventListener('pagehide',save);save()};
 },[company?.id]);
 useEffect(()=>{
  if(!company||!graph||!fleet.taxis.length)return;
  let previousTick=performance.now();
  const timer=window.setInterval(()=>{
   const clock=performance.now();
   // Use measured elapsed time, limiting large jumps after background throttling.
   const elapsedSeconds=Math.min(5,Math.max(0,(clock-previousTick)/1000));
   previousTick=clock;
   const now=Date.now();
   setFleet(old=>{
    const savedIds=old.exploredEdgeIds??[];
    const cache=discoveredCacheRef.current;
    const discovered=cache&&cache.ids===savedIds?cache.set:new Set<string>(savedIds);
    const initialDiscoveryCount=discovered.size;
    const territory=new Set(old.territoryEdgeIds??[]);
    const initialTerritoryCount=territory.size;
    let revenue=0,completed=0,fuelExpense=0,maintenanceExpense=0,serviceExpense=0,explorationExpense=0,distanceKm=0,driverWages=0,insuranceExpense=0;
    const transactions:FinancialTransaction[]=[];
    const driverUpdates=new Map<string,{trips:number;km:number;revenue:number;wages:number}>();
    const taxis=old.taxis.map(t=>{
     const delivered=t.deliveryUntil&&now>=t.deliveryUntil?{...t,deliveryUntil:undefined,deliveryStartedAt:undefined,deliveryPath:undefined}:t;
     if(delivered.deliveryUntil)return delivered;
     const passengerTaxi=!delivered.kind||delivered.kind==='taxi';
     const onShift=!!gameClockRef.current&&isShiftActive(gameClockRef.current,8,shiftHours);
     if(passengerTaxi&&onShift&&delivered.status==='PAUSED'&&delivered.shiftParked)
      return {...delivered,status:'IDLE' as const,shiftParked:false,pauseAtHome:false};
     if(passengerTaxi&&!onShift&&delivered.status==='IDLE'&&energyPercent(delivered)>10&&!delivered.refillRequested){
      const assigned=(company!.depots??[]).find(d=>d.id===delivered.depotId);
      const target:[number,number]=assigned?[assigned.lng,assigned.lat]:[company!.headquarters.lng,company!.headquarters.lat];
      const from=nearest(graph,delivered.position),to=nearest(graph,target);
      const homeRoute=from&&to?route(graph,from,to):null;
      if(homeRoute){
       if(homeRoute.path.length<2)return {...delivered,status:'PAUSED' as const,shiftParked:true,pauseAtHome:false,path:[],edgeIds:[],speedKph:0};
       return {...delivered,status:'RETURNING' as const,pauseAtHome:true,shiftParked:true,serviceDestination:undefined,refillDestination:undefined,path:homeRoute.path,edgeIds:homeRoute.edgeIds,leg:0,distanceIntoLeg:0,speedKph:0,journeyEdges:[]};
      }
     }

     // Automatic scheduled service: vehicles stop accepting work at 60% condition.
     // Service is billed on completion; insufficient cash postpones completion.
     if(delivered.status==='SERVICING'){
      const until=delivered.serviceUntil??now+120000;
      if(now<until)return {...delivered,serviceUntil:until};
      const cost=150;
      if((companyRef.current?.cash??0)+pendingCashRef.current<cost)return {...delivered,serviceUntil:now+60000};
      pendingCashRef.current-=cost;serviceExpense+=cost;
      transactions.push({id:crypto.randomUUID(),time:now,taxiId:t.id,description:`${t.name} · automatic scheduled service`,amount:-cost});
      return {...delivered,status:'IDLE' as const,serviceUntil:undefined,vehicleCondition:Math.min(100,(delivered.vehicleCondition??100)+40),serviceCount:(delivered.serviceCount??0)+1,lastServiceKm:delivered.operatingKm??0};
     }
     // All vehicle types travel to the main headquarters workshop before service.
     // Do not teleport to the workshop or service on the roadside if routing fails.
     const serviceDue=(delivered.vehicleCondition??100)<=(delivered.serviceThreshold??60)
      ||(delivered.operatingKm??0)-(delivered.lastServiceKm??0)>=250;
     if(delivered.status==='IDLE'&&serviceDue&&energyPercent(delivered)>10&&!delivered.refillRequested){
      const start=nearest(graph,delivered.position);
      const home:[number,number]=[company!.headquarters.lng,company!.headquarters.lat];
      const end=nearest(graph,home);
      const path=start&&end?route(graph,start,end):null;
      if(path){
       if(path.path.length<2)return {...delivered,status:'SERVICING' as const,serviceUntil:now+120000,path:[],edgeIds:[],speedKph:0,serviceDestination:undefined};
       return {...delivered,status:'RETURNING' as const,serviceDestination:home,refillDestination:undefined,pauseAtHome:false,
        path:path.path,edgeIds:path.edgeIds,leg:0,distanceIntoLeg:0,speedKph:0,journeyEdges:[]};
      }
      return delivered;
     }
     if(delivered.status==='REFUELLING'){
      const spec=energySpec(delivered);
      const until=delivered.refillUntil??(now+(spec.unit==='L'?180000:delivered.refillAtDepot?3600000:1200000));
      if(now<until)return {...delivered,refillUntil:until};
      const quantity=Math.max(0,spec.capacity-energyRemaining(delivered));
      const cost=quantity*spec.pricePerUnit*((old.upgrades??[]).includes('fuel')?0.95:1);
      if((companyRef.current?.cash??0)+pendingCashRef.current<cost)return {...delivered,refillUntil:now+60000};
      pendingCashRef.current-=cost;fuelExpense+=cost;
      transactions.push({id:crypto.randomUUID(),time:now,taxiId:t.id,description:`${t.name} · automatic ${spec.unit==='L'?'refuel':'charge'} (${quantity.toFixed(1)} ${spec.unit})`,amount:-cost});
      return {...delivered,status:'IDLE' as const,energyRemaining:spec.capacity,energyPurchased:(t.energyPurchased??0)+quantity,
       fuelExpense:(t.fuelExpense??0)+cost,refillDestination:undefined,refillAtDepot:undefined,refillUntil:undefined,refillRequested:false};
     }
     let working=delivered;
     if(delivered.status==='IDLE'&&(energyPercent(delivered)<=10||delivered.refillRequested)){
      const start=nearest(graph,delivered.position);
      const assignedDepot=(company!.depots??[]).find(d=>d.id===delivered.depotId);
      const hq:[number,number]=assignedDepot?[assignedDepot.lng,assignedDepot.lat]:[company!.headquarters.lng,company!.headquarters.lat];
      const stations=[...stationsRef.current.values()].filter(st=>st.kind===(energySpec(delivered).kind==='electric'?'charging':'fuel')&&st.access!=='private')
       .sort((a,b)=>meters(delivered.position,[a.lng,a.lat])-meters(delivered.position,[b.lng,b.lat])).slice(0,12);
      const targets=[...stations.map(st=>({point:[st.lng,st.lat] as [number,number],depot:false})),{point:hq,depot:true}];
      for(const target of targets){
       const end=nearest(graph,target.point);if(!start||!end)continue;
       const path=route(graph,start,end);if(!path)continue;
       const routeKm=path.path.reduce((sum,p,i)=>i?sum+meters(p,path.path[i-1])/1000:sum,0);
       if(routeKm>energyRangeKm(delivered)*0.95)continue;
       if(path.path.length<2){working={...delivered,status:'REFUELLING',refillDestination:target.point,refillAtDepot:target.depot,refillRequested:false};break;}
       working={...delivered,status:'RETURNING',path:path.path,edgeIds:path.edgeIds,leg:0,distanceIntoLeg:0,
        refillDestination:target.point,refillAtDepot:target.depot,refillRequested:false,journeyEdges:[]};break;
      }
     }
     const next=tickTaxi(working,graph,elapsedSeconds,discovered);
     // The movement integrator reports the exact distance travelled this tick,
     // including junction crossings and the final step before route reset.
     const km=next.distanceMeters/1000;
     const spec=energySpec(delivered);
     const person=(old.drivers??[]).find(d=>d.name.toLowerCase()===t.driver.toLowerCase());
     const experience=person?.completedTrips??0;
     // Career skills are derived from persistent driver trip counts (save compatible).
     const skill=Math.min(5,1+Math.floor(experience/25));
     const efficiencyBonus=(skill-1)*0.03;
     const careBonus=(skill-1)*0.0375;
     const serviceBonus=(skill-1)*0.02;
     const consumed=energyUsed(delivered,km,efficiencyBonus)*(t.drivingPolicy==='economy'?0.85:t.drivingPolicy==='performance'?1.12:1);
     // Energy purchases are charged at refill time, never again per driven kilometre.
     const fuel=0,maintenance=km*0.075*((old.upgrades??[]).includes('workshop')?0.9:1);
     const explorerTravelCost=(t.kind==='explorer'||t.kind==='surveyor')?km*2.50:0;
     explorationExpense+=explorerTravelCost;
     const wearPerKm=0.025*(1-careBonus)*(t.drivingPolicy==='economy'?0.85:t.drivingPolicy==='performance'?1.25:1); // Condition points lost per kilometre
     const wage=(t.kind==='explorer'||t.kind==='surveyor')?0:0.009*(old.wageMultiplier??1)*(1+Math.min(0.20,Math.floor(experience/25)*0.04)); // €32.40 per simulated hour, including employer costs
     const insurance=(t.kind==='explorer'||t.kind==='surveyor')?0.00045:0.00085; // €3.06 per simulated hour per taxi
     driverWages+=wage;insuranceExpense+=insurance;
     distanceKm+=km;fuelExpense+=fuel;maintenanceExpense+=maintenance;
     const earned=next.earned*(1+0.05*Research.level(research,'pricing'))*(1+serviceBonus)*((old.upgrades??[]).includes('dispatch')?1.05:1);
     revenue+=earned;
     if(earned)transactions.push({id:crypto.randomUUID(),time:now,taxiId:t.id,description:`${t.name} · passenger fare`,amount:earned});
     if(next.finished)completed++;
     if(person){const previous=driverUpdates.get(person.id)??{trips:0,km:0,revenue:0,wages:0};driverUpdates.set(person.id,{trips:previous.trips+(next.finished?((old.upgrades??[]).includes('training')?1.2:1):0),km:previous.km+km,revenue:previous.revenue+earned,wages:previous.wages+wage});}
     if(roadLengthByIdRef.current.size===0){for(const links of graph.edges.values())for(const edge of links)roadLengthByIdRef.current.set(edge.id,edge.meters);}
     let newRoadKm=0;
     next.discovered.forEach(id=>{if(t.status==='EXPLORING'){
      const eligible=t.kind==='explorer';
      const survey=t.kind==='surveyor';
      if(eligible&&!discovered.has(id)||survey&&!territory.has(id)){
       const length=roadLengthByIdRef.current.get(id)??0;
       newRoadKm+=length/1000;
      }
      if(eligible)discovered.add(id);if(survey)territory.add(id);
     }});
     return {...next.taxi,discoveredKm:(t.discoveredKm??0)+((t.kind==='explorer'||t.kind==='surveyor')&&t.status==='EXPLORING'?km:0),uniqueDiscoveredKm:(t.uniqueDiscoveredKm??0)+newRoadKm,vehicleCondition:Math.max(0,(t.vehicleCondition??100)-km*wearPerKm),operatingKm:(t.operatingKm??0)+km,vehicleMileage:(t.vehicleMileage??0)+km,
       fuelExpense:(t.fuelExpense??0)+fuel,maintenanceExpense:(t.maintenanceExpense??0)+maintenance,explorationExpense:(t.explorationExpense??0)+explorerTravelCost,
       energyRemaining:Math.max(0,energyRemaining(delivered)-consumed),
       refillRequested:next.taxi.refillRequested||energyRemaining(delivered)-consumed<=spec.capacity*0.10,
       fuelLitres:(t.fuelLitres??0)+(spec.unit==='L'?consumed:0),tripRevenue:(t.tripRevenue??0)+earned,
       driverWages:(t.driverWages??0)+wage,insuranceExpense:(t.insuranceExpense??0)+insurance};
    });
    // A small office/depot overhead accrues in simulated time, including idle periods.
    const overhead=old.taxis.length*(0.00045)+0.0012; // €4.32/hr base + €1.62/hr per vehicle
    const loanTick=advanceLoans(old.loans??[],4);
    const net=revenue-fuelExpense-maintenanceExpense-serviceExpense-explorationExpense-driverWages-insuranceExpense-overhead-loanTick.payments;
    if(net!==0)pendingCashRef.current+=net;
    const updatedIds=discovered.size===initialDiscoveryCount?savedIds:[...discovered];
    const updatedTerritory=territory.size===initialTerritoryCount?(old.territoryEdgeIds??[]):[...territory];
    discoveredCacheRef.current={ids:updatedIds,set:discovered};
    const drivers=(old.drivers??[]).map(d=>{const u=driverUpdates.get(d.id);return u?{...d,completedTrips:(d.completedTrips??0)+u.trips,distanceKm:(d.distanceKm??0)+u.km,revenueGenerated:(d.revenueGenerated??0)+u.revenue,wagesEarned:(d.wagesEarned??0)+u.wages}:d;});
    return{...old,drivers,taxis,revenue:old.revenue+revenue,completed:old.completed+completed,exploredEdgeIds:updatedIds,territoryEdgeIds:updatedTerritory,
      fuelExpense:(old.fuelExpense??0)+fuelExpense,maintenanceExpense:(old.maintenanceExpense??0)+maintenanceExpense,serviceExpense:(old.serviceExpense??0)+serviceExpense,explorationExpense:(old.explorationExpense??0)+explorationExpense,
      distanceKm:(old.distanceKm??0)+distanceKm,driverWages:(old.driverWages??0)+driverWages,
      insuranceExpense:(old.insuranceExpense??0)+insuranceExpense,overheadExpense:(old.overheadExpense??0)+overhead,
      financeHistory:(()=>{const day=new Date(now).toISOString().slice(0,10);const list=[...(old.financeHistory??[])];const last=list[list.length-1];const cost=fuelExpense+maintenanceExpense+serviceExpense+explorationExpense+driverWages+insuranceExpense+overhead+loanTick.interest;if(last?.day===day)list[list.length-1]={...last,revenue:last.revenue+revenue,expenses:last.expenses+cost,trips:last.trips+completed};else list.push({day,revenue,expenses:cost,trips:completed});return list.slice(-365);})(),
      loans:loanTick.loans,loanInterestExpense:(old.loanInterestExpense??0)+loanTick.interest,loanPrincipalPaid:(old.loanPrincipalPaid??0)+loanTick.principal,transactions:[...transactions,...(old.transactions??[])].slice(0,100)};
   });
  },1000);
  return()=>window.clearInterval(timer);
 },[company?.id,graph,fleet.taxis.length,research]);

 const buyExplorer=()=>{if(!company||!graph)return;try{
  const cost=15000;
  if(fleet.taxis.some(t=>t.kind==='surveyor'||(t.kind==='explorer'&&(t.vehicleModel==='Black Explorer'||t.name==='Black Explorer'))))throw Error('Only one Black Explorer is allowed per company.');
  if(company.cash<cost)throw Error('Insufficient company funds for an Explorer (€15,000).');
  const hq:[number,number]=[company.headquarters.lng,company.headquarters.lat];
  const node=nearest(graph,hq);if(!node)throw Error('No roads near headquarters.');
  const now=Date.now();
  const explorer:Taxi={id:crypto.randomUUID(),kind:'surveyor',name:'Black Explorer',driver:'Autonomous',position:graph.nodes.get(node)!,status:'IDLE',path:[],edgeIds:[],leg:0,distanceIntoLeg:0,fare:0,completed:0,vehicleModel:'Black Explorer',vehicleYear:2026,vehicleFuel:'Electric',vehicleClass:'Economy',vehicleCondition:100,vehicleMileage:0,energyRemaining:energySpec({vehicleFuel:'Electric'}).capacity,deliveryStartedAt:now,deliveryUntil:now+90000,deliveryPath:deliveryRoute(graph,hq)};
  const updated={...company,cash:Math.round((company.cash-cost)*100)/100};
  saveCompany(updated);setCompany(updated);setFleet(old=>({...old,taxis:[...old.taxis,explorer],transactions:[{id:crypto.randomUUID(),time:now,description:'Explorer vehicle purchase',amount:-cost},...(old.transactions??[])].slice(0,100)}));setSimError('');
 }catch(e){setSimError(String(e))}};
 const buyRoadExplorer=()=>{if(!company||!graph)return;try{
  const cost=12000;
  if(company.cash<cost)throw Error('Insufficient company funds for an Explorer (€15,000).');
  const hq:[number,number]=[company.headquarters.lng,company.headquarters.lat];
  const node=nearest(graph,hq);if(!node)throw Error('No roads near headquarters.');
  const now=Date.now();
  const explorer:Taxi={id:crypto.randomUUID(),kind:'explorer',name:`Road Explorer ${fleet.taxis.filter(t=>t.kind==='explorer').length+1}`,driver:'Autonomous',position:graph.nodes.get(node)!,status:'IDLE',path:[],edgeIds:[],leg:0,distanceIntoLeg:0,fare:0,completed:0,vehicleModel:'Road Explorer',vehicleYear:2026,vehicleFuel:'Electric',vehicleClass:'Economy',vehicleCondition:100,vehicleMileage:0,energyRemaining:energySpec({vehicleFuel:'Electric'}).capacity,deliveryStartedAt:now,deliveryUntil:now+90000,deliveryPath:deliveryRoute(graph,hq)};
  const updated={...company,cash:Math.round((company.cash-cost)*100)/100};
  saveCompany(updated);setCompany(updated);setFleet(old=>({...old,taxis:[...old.taxis,explorer],transactions:[{id:crypto.randomUUID(),time:now,description:'Road Explorer vehicle purchase',amount:-cost},...(old.transactions??[])].slice(0,100)}));setSimError('');
 }catch(e){setSimError(String(e))}};
 const buyTaxi=(driver:string,offer:VehicleOffer)=>{if(!company||!graph)return;try{
  if(!driver.trim())throw Error('Enter a driver name.');
  const discount=Research.level(research,'procurement')*0.04;
  const cost=Math.round((offer.price*(1-discount)+DRIVER_COST)*100)/100;
  if(company.cash<cost)throw Error('Insufficient company funds.');
  const hq:[number,number]=[company.headquarters.lng,company.headquarters.lat];
  const node=nearest(graph,hq);if(!node)throw Error('No roads near headquarters.');
  const now=Date.now();
  const taxi:Taxi={id:crypto.randomUUID(),name:`Taxi ${fleet.taxis.length+1}`,driver:driver.trim(),position:graph.nodes.get(node)!,status:'IDLE',path:[],edgeIds:[],leg:0,distanceIntoLeg:0,fare:0,completed:0,
   vehicleModel:offer.model,vehicleYear:offer.year,vehicleFuel:offer.fuel,vehicleClass:offer.className,vehicleCondition:offer.condition,vehicleMileage:offer.mileage,energyRemaining:energySpec({vehicleFuel:offer.fuel}).capacity,
   deliveryStartedAt:now,deliveryUntil:now+90_000,deliveryPath:deliveryRoute(graph,hq)};
  const updated={...company,cash:Math.round((company.cash-cost)*100)/100};
  saveCompany(updated);setCompany(updated);setFleet(old=>({...old,drivers:[...(old.drivers??[]),...((old.drivers??[]).some(d=>d.name.toLowerCase()===taxi.driver.toLowerCase())?[]:[{id:crypto.randomUUID(),name:taxi.driver,hiredAt:Date.now()}])],taxis:[...old.taxis,taxi]}));setSimError('');
 }catch(e){setSimError(String(e))}};
 const hireDriver=(name:string)=>{const cleaned=name.trim();if(!cleaned){setSimError('Enter a driver name.');return;}if((fleet.drivers??[]).some(d=>d.name.toLowerCase()===cleaned.toLowerCase())){setSimError('This driver is already employed.');return;}if(!companyRef.current||companyRef.current.cash+pendingCashRef.current<DRIVER_COST){setSimError('Insufficient funds to hire a driver.');return;}pendingCashRef.current-=DRIVER_COST;setFleet(old=>({...old,drivers:[...(old.drivers??[]),{id:crypto.randomUUID(),name:cleaned,hiredAt:Date.now()}],transactions:[{id:crypto.randomUUID(),time:Date.now(),description:`Driver onboarding · ${cleaned}`,amount:-DRIVER_COST},...(old.transactions??[])].slice(0,100)}));setSimError('');};
 const dismissDriver=(driverId:string)=>{const person=(fleet.drivers??[]).find(d=>d.id===driverId);if(!person)return;if(fleet.taxis.some(t=>t.driver.toLowerCase()===person.name.toLowerCase())){setSimError('Reassign this driver before dismissal.');return;}setFleet(old=>({...old,drivers:(old.drivers??[]).filter(d=>d.id!==driverId)}));setSimError('');};
 const assignDriver=(id:string,name:string)=>{const driver=(fleet.drivers??[]).find(d=>d.name===name);const taxi=fleet.taxis.find(t=>t.id===id);if(!driver||!taxi){setSimError('Select an employed driver.');return;}if(taxi.status!=='IDLE'||(taxi.deliveryUntil??0)>Date.now()){setSimError('Taxi must be idle and delivered to reassign its driver.');return;}if(fleet.taxis.some(t=>t.id!==id&&t.driver.toLowerCase()===driver.name.toLowerCase())){setSimError('Driver is already assigned to another taxi.');return;}setFleet(old=>({...old,taxis:old.taxis.map(t=>t.id===id?{...t,driver:driver.name}:t)}));setSimError('');};
 const controlExplorer=(id:string,action:'home'|'resume')=>{
  const explorer=fleet.taxis.find(t=>t.id===id&&(t.kind==='explorer'||t.kind==='surveyor'));
  if(!explorer||!graph||!company)return;
  if(action==='resume'){
   setFleet(old=>({...old,taxis:old.taxis.map(t=>t.id===id&&t.status==='PAUSED'?{...t,status:'IDLE' as const,pauseAtHome:false}:t)}));
   setSimError('');return;
  }
  if(explorer.status==='PAUSED'||(explorer.status==='RETURNING'&&explorer.pauseAtHome))return;
  const depot=(company.depots??[]).find(d=>d.id===explorer.depotId);
  const from=nearest(graph,explorer.position),to=nearest(graph,depot?[depot.lng,depot.lat]:[company.headquarters.lng,company.headquarters.lat]);
  if(!from||!to){setSimError('Cannot send Explorer home: headquarters roads are not loaded.');return;}
  const homeRoute=route(graph,from,to);
  if(!homeRoute){setSimError('Cannot send Explorer home: no connected road route to headquarters.');return;}
  setFleet(old=>({...old,taxis:old.taxis.map(t=>t.id!==id?t:homeRoute.path.length<2?{...t,status:'PAUSED' as const,pauseAtHome:false,path:[],edgeIds:[],leg:0,distanceIntoLeg:0,speedKph:0}:{...t,status:'RETURNING' as const,pauseAtHome:true,refillDestination:undefined,path:homeRoute.path,edgeIds:homeRoute.edgeIds,leg:0,distanceIntoLeg:0,speedKph:0,journeyEdges:[]})}));
  setSimError('');
 };
 const depots=company?.depots??[];
 const assignDepot=(id:string,depotId:string)=>{
  const taxi=fleet.taxis.find(t=>t.id===id);
  if(!taxi||taxi.status!=='IDLE'&&taxi.status!=='PAUSED'){setSimError('Vehicle must be idle or paused before changing depots.');return;}
  const target=depotId==='main'?null:depots.find(d=>d.id===depotId);
  if(depotId!=='main'&&!target)return;
  const capacity=target?.capacity??(5+5*(fleet.upgrades??[]).filter(u=>u==='depot-capacity').length);
  const occupied=fleet.taxis.filter(t=>t.id!==id&&(t.depotId??'main')===depotId).length;
  if(occupied>=capacity){setSimError('That depot has no available parking spaces.');return;}
  setFleet(old=>({...old,taxis:old.taxis.map(t=>t.id===id?{...t,depotId}:t)}));setSimError('');
 };
 const setExplorationMode=(id:string,mode:'local'|'frontier')=>setFleet(old=>({...old,taxis:old.taxis.map(t=>t.id===id&&(t.kind==='explorer'||t.kind==='surveyor')?{...t,explorationMode:mode}:t)}));
 const setAutoDepotService=(id:string,enabled:boolean)=>setFleet(old=>({...old,taxis:old.taxis.map(t=>t.id===id?{...t,autoDepotService:enabled}:t)}));
 const setVehiclePolicy=(id:string,policy:'economy'|'balanced'|'performance')=>setFleet(old=>({...old,taxis:old.taxis.map(t=>t.id===id?{...t,drivingPolicy:policy}:t)}));
 const setServiceThreshold=(id:string,threshold:number)=>setFleet(old=>({...old,taxis:old.taxis.map(t=>t.id===id?{...t,serviceThreshold:threshold}:t)}));
 const sellVehicle=(id:string)=>{const t=fleet.taxis.find(x=>x.id===id);if(!t||!companyRef.current)return;if(t.status!=='IDLE'&&t.status!=='PAUSED'){setSimError('Vehicle must be idle or parked before selling.');return;}if(t.deliveryUntil&&t.deliveryUntil>Date.now()){setSimError('Cannot sell a vehicle awaiting delivery.');return;}const otherBlack=fleet.taxis.filter(x=>x.id!==id&&x.kind==='surveyor');if(t.kind==='surveyor'&&otherBlack.length){setSimError('Invalid Black Explorer fleet state.');return;}const age=Math.max(0,new Date().getFullYear()-(t.vehicleYear??new Date().getFullYear()));const value=Math.max(1000,Math.round(15000*Math.pow(.88,age)*Math.pow(.92,(t.vehicleMileage??0)/30000)*(t.vehicleCondition??100)/100));pendingCashRef.current+=value;setFleet(old=>({...old,taxis:old.taxis.filter(x=>x.id!==id),transactions:[{id:crypto.randomUUID(),time:Date.now(),taxiId:id,description:`${t.name} · vehicle sale`,amount:value},...(old.transactions??[])].slice(0,100)}));setSimError('');};
 const resumeDepotTaxi=(id:string)=>{setFleet(old=>({...old,taxis:old.taxis.map(t=>t.id===id&&t.status==='PAUSED'?{...t,status:'IDLE' as const,pauseAtHome:false}:t)}));setSimError('');};
 const returnToDepot=(id:string)=>{
  const taxi=fleet.taxis.find(t=>t.id===id);if(!taxi||!graph||!company||taxi.status!=='IDLE'&&taxi.status!=='PAUSED'){setSimError('Vehicle must be idle or paused to return to depot.');return;}
  const depot=depots.find(d=>d.id===taxi.depotId);
  const target:[number,number]=depot?[depot.lng,depot.lat]:[company.headquarters.lng,company.headquarters.lat];
  const start=nearest(graph,taxi.position),end=nearest(graph,target);if(!start||!end){setSimError('Depot roads are not loaded.');return;}
  const path=route(graph,start,end);if(!path){setSimError('No connected road route to assigned depot.');return;}
  setFleet(old=>({...old,taxis:old.taxis.map(t=>t.id!==id?t:path.path.length<2?{...t,status:'PAUSED' as const,pauseAtHome:false,path:[],edgeIds:[],speedKph:0}:{...t,status:'RETURNING' as const,pauseAtHome:true,path:path.path,edgeIds:path.edgeIds,leg:0,distanceIntoLeg:0,speedKph:0,refillDestination:undefined,journeyEdges:[]})}));setSimError('');
 };
 const addDepot=(location:Headquarters)=>{
  if(!companyRef.current||!graph)return;
  const cash=companyRef.current.cash+pendingCashRef.current;
  if(cash<10000){setSimError('A new depot costs €10,000.');return;}
  const node=nearest(graph,[location.lng,location.lat]);
  if(!node||meters(graph.nodes.get(node)!,[location.lng,location.lat])>1500){setSimError('Choose a location within 1.5 km of a loaded road.');return;}
  const point=graph.nodes.get(node)!;
  const depot={id:crypto.randomUUID(),name:location.label||'New depot',lng:point[0],lat:point[1],capacity:5};
  const updated={...companyRef.current,depots:[...(companyRef.current.depots??[]),depot]};
  pendingCashRef.current-=10000;companyRef.current=updated;setCompany(updated);saveCompany(updated);
  setFleet(old=>({...old,transactions:[{id:crypto.randomUUID(),time:Date.now(),description:`New depot · ${depot.name}`,amount:-10000},...(old.transactions??[])].slice(0,100)}));
  setPlacingDepot(false);setSelecting(false);setPage('Company');setSimError('');
 };
 const refillTaxi=(id:string)=>{const taxi=fleet.taxis.find(t=>t.id===id);if(!taxi||!companyRef.current)return;
  if(taxi.status!=='IDLE'||(taxi.deliveryUntil??0)>Date.now()){setSimError('Vehicle must be idle and delivered to refuel or recharge.');return;}
  const spec=energySpec(taxi),quantity=Math.max(0,spec.capacity-energyRemaining(taxi));
  const discount=(fleet.upgrades??[]).includes('fuel')?0.95:1;
  const cost=Math.round(quantity*spec.pricePerUnit*discount*100)/100;
  if(quantity<0.01){setSimError('Tank or battery is already full.');return;}
  if(companyRef.current.cash+pendingCashRef.current<cost){setSimError(`Insufficient funds to ${spec.unit==='L'?'refuel':'recharge'} (€${cost.toFixed(2)}).`);return;}
  pendingCashRef.current-=cost;
  setFleet(old=>({...old,fuelExpense:(old.fuelExpense??0)+cost,transactions:[{id:crypto.randomUUID(),time:Date.now(),taxiId:id,description:`${taxi.name} · ${spec.unit==='L'?'fuel purchase':'electricity purchase'} (${quantity.toFixed(1)} ${spec.unit})`,amount:-cost},...(old.transactions??[])].slice(0,100),taxis:old.taxis.map(t=>t.id===id?{...t,energyRemaining:spec.capacity,energyPurchased:(t.energyPurchased??0)+quantity,fuelExpense:(t.fuelExpense??0)+cost}:t)}));
  setSimError('');
 };
 const serviceTaxi=(id:string)=>{if(!companyRef.current)return;const taxi=fleet.taxis.find(t=>t.id===id);if(!taxi||taxi.deliveryUntil&&taxi.deliveryUntil>Date.now()||taxi.status!=="IDLE"){setSimError("Taxi must be idle and delivered before servicing.");return;}const cost=150;if(companyRef.current.cash+pendingCashRef.current<cost){setSimError("Insufficient funds for servicing (€150).");return;}pendingCashRef.current-=cost;setFleet(old=>({...old,serviceExpense:(old.serviceExpense??0)+cost,transactions:[{id:crypto.randomUUID(),time:Date.now(),taxiId:id,description:`${taxi.name} · scheduled service`,amount:-cost},...(old.transactions??[])].slice(0,100),taxis:old.taxis.map(t=>t.id===id?{...t,vehicleCondition:Math.min(100,(t.vehicleCondition??100)+20),serviceCount:(t.serviceCount??0)+1,lastServiceKm:t.operatingKm??0}:t)}));setSimError("");};
 const takeLoan=(amount:number)=>{const offer=LOAN_OFFERS.find(l=>l.amount===amount);if(!offer||!companyRef.current)return;
  if((fleet.loans??[]).length>=2){setSimError('Maximum two active loans.');return;}
  const debt=(fleet.loans??[]).reduce((n,l)=>n+l.balance,0);
  if(debt+amount>75000){setSimError('Total borrowing limit is €75,000.');return;}
  pendingCashRef.current+=amount;
  setFleet(old=>({...old,loans:[...(old.loans??[]),createLoan(offer.amount,offer.rate,offer.days)],transactions:[{id:crypto.randomUUID(),time:Date.now(),description:'Business loan disbursement',amount},...(old.transactions??[])].slice(0,100)}));setSimError('');};
 const buyUpgrade=(id:EconomyUpgrade)=>{const offer=UPGRADES.find(u=>u.id===id);if(!offer||!companyRef.current)return;
  if((fleet.upgrades??[]).includes(id))return;
  if(companyRef.current.cash+pendingCashRef.current<offer.cost){setSimError('Insufficient cash for this upgrade.');return;}
  pendingCashRef.current-=offer.cost;
  setFleet(old=>({...old,upgrades:[...(old.upgrades??[]),id],transactions:[{id:crypto.randomUUID(),time:Date.now(),description:offer.name,amount:-offer.cost},...(old.transactions??[])].slice(0,100)}));setSimError('');};
 const purchaseFerryRoute=(routeId:string,price:number)=>{const current=companyRef.current;if(!current||!Number.isFinite(price)||price<2000||current.cash<price||(current.purchasedFerryRouteIds??[]).includes(routeId))return;const updated={...current,cash:Math.round((current.cash-price)*100)/100,purchasedFerryRouteIds:[...(current.purchasedFerryRouteIds??[]),routeId]};companyRef.current=updated;saveCompany(updated);setCompany(updated);setFleet(old=>({...old,transactions:[{id:crypto.randomUUID(),time:Date.now(),description:'Ferry route purchase · '+routeId,amount:-price},...(old.transactions??[])].slice(0,100)}));};
 const go=(name:Page)=>{setPage(name);setDrawerOpen(false);};
 const onLocation=(value:Headquarters)=>{if(placingDepot){addDepot(value);return;}setSelection(value);setSelecting(false);setPage('Company');setShowSetup(true);};
 return <div className={`shell nav-v216 ${sidebarCollapsed?'nav-collapsed':''} ${page==='World'?'nav-map-mode':''}`}><aside className={`sidebar ${drawerOpen?'open':''}`}><header className="brand"><div className="brand-mark"><CarFront size={23}/></div><div className="nav-brand-copy"><strong>TravelEmpire</strong><small>v2.1.6 · MANAGEMENT</small></div><button className="nav-collapse-button" title={sidebarCollapsed?'Expand sidebar':'Collapse sidebar'} aria-label={sidebarCollapsed?'Expand sidebar':'Collapse sidebar'} onClick={()=>setSidebarCollapsed(v=>!v)}>{sidebarCollapsed?<PanelLeftOpen size={18}/>:<PanelLeftClose size={18}/>}</button><button className="close-menu" aria-label="Close menu" onClick={()=>setDrawerOpen(false)}><X size={19}/></button></header><nav className="navigation" aria-label="Main navigation"><div className="nav-group-label">OPERATIONS</div>{navigation.filter(n=>['World','Fleet','Operations','Ferries'].includes(n.name)).map(({name,icon:Icon})=><button key={name} title={name==='World'?'World Map':name} aria-current={page===name?'page':undefined} className={page===name?'selected':''} onClick={()=>go(name)}><Icon size={19}/><span>{name==='World'?'World Map':name}</span></button>)}<div className="nav-group-label">MANAGEMENT</div>{navigation.filter(n=>['Company','Finance','Research'].includes(n.name)).map(({name,icon:Icon})=><button key={name} title={name} aria-current={page===name?'page':undefined} className={page===name?'selected':''} onClick={()=>go(name)}><Icon size={19}/><span>{name}</span></button>)}<div className="nav-group-label">FUTURE</div><button type="button" disabled title="Empire is not available yet" className="nav-locked"><BarChart3 size={19}/><span>Empire</span><LockKeyhole size={14} className="nav-lock-icon"/></button></nav><button className="sidebar-bottom nav-company-shortcut" title={company?.name??'Company'} onClick={()=>go('Company')}><span className="nav-company-avatar"><CarFront size={20}/></span><span className="nav-company-copy"><strong>{company?.name??'Create company'}</strong><small>{company?'Company workspace':'Set up your company'}</small></span></button></aside>
 {drawerOpen&&<button className="backdrop" aria-label="Close navigation" onClick={()=>setDrawerOpen(false)}/>}<main className="main"><header className="topbar"><button className="menu-toggle" aria-label="Open navigation" onClick={()=>setDrawerOpen(true)}><Menu size={21}/></button><div className="nav-page-identity"><strong>{page==='World'?'World Map':page}</strong><small>{({World:'Explore roads and monitor vehicles',Fleet:'Vehicles, drivers and dealerships',Operations:'Dispatch and exploration control',Ferries:'Ferry routes, purchases and maritime network',Company:'Depots and company management',Finance:'Business performance and cash flow',Research:'Company upgrades and development',Empire:'Coming soon'} as Record<Page,string>)[page]}</small></div><div className="nav-top-stats">{company&&<><span className="nav-top-stat"><CircleDollarSign size={16}/><strong>{new Intl.NumberFormat('en-IE',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(company.cash)}</strong></span><span className="nav-top-stat nav-vehicles"><CarFront size={16}/>{fleet.taxis.length} vehicles</span></>}<span className="nav-sim-status"><Activity size={14}/> LIVE</span></div></header>
 <section className="world" style={{display:page==='World'?'block':'none'}}><WorldMap companyId={company?.id} purchasedFerryRouteIds={company?.purchasedFerryRouteIds??[]} selecting={selecting} onLocationSelected={onLocation} depots={company?.depots??[]} headquarters={company?.headquarters??null} taxis={fleet.taxis} exploredEdgeIds={fleet.exploredEdgeIds??[]} territoryEdgeIds={fleet.territoryEdgeIds??[]} graph={graph} gameClock={gameClock} shiftHours={shiftHours} onShiftHoursChange={setShiftHours} onExplorerCommand={controlExplorer}/>{selecting&&<div className="location-hint"><strong>{placingDepot?'Choose new depot':'Choose headquarters'}</strong><span>Click a location on the map to select it.</span><button onClick={()=>{setSelecting(false);setPlacingDepot(false);setPage('Company');}}>Cancel</button></div>}</section>
 {page==='Company'&&(!company||showSetup)?<CompanySetup selection={selection} selecting={selecting} onSelectingChange={setSelecting} onShowMap={()=>setPage('World')} onCreated={value=>{setCompany(value);setShowSetup(false);setPage('Company');}}/>:null}
 {page==='Company'&&company&&!showSetup&&<section className="company-dashboard company-v213"><div className="company-v213-heading"><div><span className="eyebrow">COMPANY MANAGEMENT · V2.1.3</span><h1>Company</h1><p>Manage your company, depots and operational settings.</p></div><span className="company-v213-status">● COMPANY ACTIVE</span></div><div className="company-v213-identity"><div className="company-v213-icon">🚕</div><div className="company-v213-name"><strong>{company.name}</strong><small>Taxi & exploration company</small><span>Headquarters · {company.headquarters.label}</span></div><div className="company-v213-identity-stats"><div><small>Vehicles</small><strong>{fleet.taxis.length}</strong></div><div><small>Drivers</small><strong>{(fleet.drivers??[]).length}</strong></div><div><small>Depots</small><strong>{1+(company.depots??[]).length}</strong></div><div><small>Completed trips</small><strong>{fleet.completed.toLocaleString('en-IE')}</strong></div></div></div><div className="ui-section-tabs" role="tablist" aria-label="Company sections">{([["overview","Overview"],["depots","Depots"],["vehicles","Assignments"],["settings","Settings"]] as const).map(([id,label])=><button key={id} role="tab" aria-selected={companyTab===id} className={companyTab===id?"active":""} onClick={()=>setCompanyTab(id)}>{label}</button>)}</div><div className="company-v213-overview" style={{display:companyTab==="overview"?"block":"none"}}><div className="company-v213-section-title"><h2>Company overview</h2><span>Live business statistics</span></div><div className="company-metrics"><article><small>MAIN DEPOT</small><strong>{company.headquarters.label}</strong></article><article><small>ASSIGNED VEHICLES</small><strong>{fleet.taxis.length}</strong></article><article><small>DEPOT CAPACITY</small><strong>{Math.max(5,5+5*(fleet.upgrades??[]).filter(u=>u==='depot-capacity').length)} spaces</strong></article><article><small>AVAILABLE SPACES</small><strong>{Math.max(0,Math.max(5,5+5*(fleet.upgrades??[]).filter(u=>u==='depot-capacity').length)-fleet.taxis.length)}</strong></article></div><div className="company-v213-columns"><article className="company-v213-card"><h3>Company performance</h3><p>Lifetime operating results</p><div className="company-v213-row"><span>Passenger revenue</span><strong>€{fleet.revenue.toLocaleString("en-IE",{maximumFractionDigits:2})}</strong></div><div className="company-v213-row"><span>Completed trips</span><strong>{fleet.completed.toLocaleString("en-IE")}</strong></div><div className="company-v213-row"><span>Operating distance</span><strong>{(fleet.distanceKm??0).toFixed(1)} km</strong></div><div className="company-v213-row"><span>Available capital</span><strong>€{company.cash.toLocaleString("en-IE",{maximumFractionDigits:2})}</strong></div></article><article className="company-v213-card"><h3>Operational status</h3><p>Fleet and depot availability</p><div className="company-v213-row"><span>Available vehicles</span><strong>{fleet.taxis.filter(t=>t.status==="IDLE").length} / {fleet.taxis.length}</strong></div><div className="company-v213-progress"><div style={{width:`${fleet.taxis.length?100*fleet.taxis.filter(t=>t.status==="IDLE").length/fleet.taxis.length:0}%`}}/></div><div className="company-v213-row"><span>Assigned drivers</span><strong>{fleet.taxis.filter(t=>t.kind!=="explorer"&&t.kind!=="surveyor"&&!!t.driver).length}</strong></div><div className="company-v213-row"><span>Depot locations</span><strong>{1+(company.depots??[]).length}</strong></div></article></div><div className="company-v213-actions"><h3>Quick actions</h3><div><button onClick={()=>setCompanyTab("depots")}>Manage depots →</button><button onClick={()=>setCompanyTab("vehicles")}>Vehicle assignments →</button><button onClick={()=>setCompanyTab("settings")}>Company settings →</button><button onClick={()=>setPage("Finance")}>Financial reports →</button></div></div></div><div className="company-v213-subpage" style={{display:companyTab==="depots"?"block":"none"}}><button type="button" disabled={company.cash<2500} onClick={()=>{if(!companyRef.current||companyRef.current.cash+pendingCashRef.current<2500){setSimError('Insufficient funds for depot expansion (€2,500).');return;}pendingCashRef.current-=2500;setFleet(old=>({...old,upgrades:[...(old.upgrades??[]),'depot-capacity'],transactions:[{id:crypto.randomUUID(),time:Date.now(),description:'Main depot expansion (+5 spaces)',amount:-2500},...(old.transactions??[])].slice(0,100)}));setSimError('');}}>Expand main depot (+5 spaces) · €2,500</button><h2>Depot network</h2><p>Purchase a depot on the map for €10,000. Each new depot starts with five spaces. Vehicles must be idle or paused to change their assigned depot.</p><button type="button" onClick={()=>{setPlacingDepot(true);setSelecting(true);setPage('World');setSimError('');}}>+ Place new depot on map · €10,000</button>{[...([{id:'main',name:'Main depot · '+company.headquarters.label,capacity:5+5*(fleet.upgrades??[]).filter(u=>u==='depot-capacity').length}]),...(company.depots??[])].map(d=><article key={d.id}><strong>{d.name}</strong> · {fleet.taxis.filter(t=>(t.depotId??'main')===d.id).length} / {d.capacity} spaces {d.id!=='main'&&<button type="button" onClick={()=>{if(!companyRef.current||companyRef.current.cash+pendingCashRef.current<2500){setSimError('Insufficient funds (€2,500).');return;}pendingCashRef.current-=2500;const updated={...companyRef.current,depots:(companyRef.current.depots??[]).map(x=>x.id===d.id?{...x,capacity:x.capacity+5}:x)};companyRef.current=updated;setCompany(updated);saveCompany(updated);setFleet(old=>({...old,transactions:[{id:crypto.randomUUID(),time:Date.now(),description:'Depot expansion (+5 spaces)',amount:-2500},...(old.transactions??[])].slice(0,100)}));}}>Expand +5 · €2,500</button>}</article>)}</div><div className="company-v213-subpage" style={{display:companyTab==="vehicles"?"block":"none"}}><h2>Vehicle assignments</h2><p>Choose each vehicle’s home depot. Only idle or paused vehicles can be reassigned.</p>{fleet.taxis.map(t=><div key={t.id} style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap',marginBottom:8}}><strong>{t.name}</strong><select aria-label={`Depot for ${t.name}`} value={t.depotId??'main'} onChange={e=>assignDepot(t.id,e.target.value)}><option value="main">Main depot</option>{(company.depots??[]).map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select><button type="button" disabled={t.status!=='IDLE'&&t.status!=='PAUSED'} onClick={()=>returnToDepot(t.id)}>Return & park</button>{t.status==='PAUSED'&&<button type="button" onClick={()=>resumeDepotTaxi(t.id)}>Resume operations</button>}<small>{t.status}</small></div>)}</div>{simError&&<p role="alert">{simError}</p>}<div className="company-v213-subpage" style={{display:companyTab==="settings"?"block":"none"}}><h2>Company settings</h2><p>Your company profile is saved in this browser. Taxi operations run locally while this browser tab is open.</p><div className="company-metrics"><article><small>AVAILABLE CAPITAL</small><strong>€{company.cash.toLocaleString('en-IE')}</strong></article><article><small>HEADQUARTERS</small><strong>{company.headquarters.label}</strong></article><article><small>FLEET</small><strong>{fleet.taxis.filter(t=>(!t.kind||t.kind==='taxi')).length} taxis · {fleet.taxis.filter(t=>t.kind==='explorer').length} road explorers · {fleet.taxis.filter(t=>t.kind==='surveyor').length} black explorers</strong></article></div><p className="setup-disclaimer">No administrative ownership restrictions. Greek roads load automatically near headquarters and active taxis from Supabase.</p><button className="setup-secondary" onClick={()=>setPage('World')}>View headquarters on map</button><button className="danger-button" onClick={()=>{if(window.confirm('Delete this locally saved company? This cannot be undone.')){Research.clear(company.id);void clearExploration(company.id);clearCompany();localStorage.removeItem(`travelempire.fleet.v0.8.${company.id}`);setFleet({taxis:[],revenue:0,completed:0});setCompany(null);setSelection(null);setShowSetup(false);}}}>Delete local company</button></div></section>}
 {page==='Fleet'&&<FleetPanel company={company} fleet={fleet} graph={graph} onBuy={buyTaxi} onBuyExplorer={buyExplorer} onBuyRoadExplorer={buyRoadExplorer} onAssignDriver={assignDriver} onHireDriver={hireDriver} onDismissDriver={dismissDriver} onService={serviceTaxi} onRefill={refillTaxi} onSell={sellVehicle} onPolicy={setVehiclePolicy} onServiceThreshold={setServiceThreshold} onAutoDepotService={setAutoDepotService}/>}
 {page==='Operations'&&<OperationsPanel fleet={fleet} graph={graph} missionCount={missionQueue.length} roadPackages={roadPackages} diagnostics={roadDiagnostics} error={simError} onExplorationMode={setExplorationMode}/>}
 {page==='Ferries'&&<FerryRoutesPanel company={company} onPurchase={purchaseFerryRoute} graph={graph} exploredEdgeIds={fleet.exploredEdgeIds??[]}/>}
 {page==='Finance'&&<FinancePanel company={company} fleet={fleet} onLoan={takeLoan} onUpgrade={buyUpgrade} onWageChange={multiplier=>setFleet(old=>({...old,wageMultiplier:multiplier}))} error={simError}/>}
 {page==='Research'&&<><ResearchPanel company={company} state={research} onStart={startResearch} onCancel={cancelResearch}/>{researchError&&<p role="alert">{researchError}</p>}</>}
 {page!=='Research'&&page!=='World'&&page!=='Company'&&page!=='Fleet'&&page!=='Operations'&&page!=='Ferries'&&page!=='Finance'&&<section className="placeholder"><span className="eyebrow">MANAGEMENT CENTER</span><h1>{page}</h1><p>This module is reserved for an upcoming milestone. No simulated figures are shown until the authoritative backend is implemented.</p><div className="placeholder-card"><span>MODULE STATUS</span><strong>Planned</strong><small>Foundation preview · no live company data</small></div></section>}
 {!company&&page==='World'&&!selecting&&<button className="start-company-button" onClick={()=>{setPage('Company');setShowSetup(true);}}>+ Create company</button>}
 </main><nav className="mobile-tabs" aria-label="Mobile navigation">{navigation.filter(n=>['World','Fleet','Ferries','Company'].includes(n.name)).map(({name,icon:Icon})=><button key={name} className={page===name?'active':''} onClick={()=>go(name)}><Icon size={19}/><span>{name==='World'?'Map':name==='Operations'?'Ops':name}</span></button>)}<button onClick={()=>setDrawerOpen(true)}><Menu size={19}/><span>More</span></button></nav></div>;
}
