import {energySpec,energyRemaining,energyUsed} from './simulation/energy';
import {demandAt} from './simulation/demand';
import { useEffect, useState } from "react";
import { BarChart3, Building2, CarFront, Compass, FlaskConical, Landmark, Map as MapIcon, Menu, X } from "lucide-react";
import WorldMap from "./components/WorldMap";
import FleetPanel from "./components/FleetPanel";
import FinancePanel from "./components/FinancePanel";
import {advanceLoans,createLoan,LOAN_OFFERS,UPGRADES} from "./economy";
import type {EconomyUpgrade} from "./simulation/taxi";
import {loadRoadGraph,loadFleet,saveFleet,tickTaxi,DRIVER_COST,nearest,type RoadGraph,type FleetState, type Taxi, type PassengerRequest,meters,type FinancialTransaction} from "./simulation/taxi";
import "./taxi.css";
import {deliveryRoute, type VehicleOffer} from "./dealership";
import ResearchPanel from "./components/ResearchPanel";
import * as Research from "./research";
import CompanySetup from "./components/CompanySetup";
import {clearCompany,loadCompany, saveCompany,type Company,type Headquarters} from './company';
import "./map-update.css";
import "./company.css";

import {RoadNetworkManager} from './data/roadNetworkManager';
import {useRef} from 'react';


const navigation=[{name:"World",icon:MapIcon},{name:"Fleet",icon:CarFront},{name:"Operations",icon:Compass},{name:"Company",icon:Building2},{name:"Finance",icon:Landmark},{name:"Empire",icon:BarChart3},{name:"Research",icon:FlaskConical}] as const;
type Page=(typeof navigation)[number]['name'];
export default function App(){
 const [page,setPage]=useState<Page>('World');const [drawerOpen,setDrawerOpen]=useState(false);const [company,setCompany]=useState<Company|null>(loadCompany);const [selection,setSelection]=useState<Headquarters|null>(null);const [selecting,setSelecting]=useState(false);const [showSetup,setShowSetup]=useState(false);
 const [graph,setGraph]=useState<RoadGraph|null>(null);
 const networkRef=useRef<RoadNetworkManager|null>(null);
 const [roadPackages,setRoadPackages]=useState(0);
 const [roadDiagnostics,setRoadDiagnostics]=useState({queued:0,edges:0,workerEdges:0});
 const [missionQueue,setMissionQueue]=useState<PassengerRequest[]>([]);
 const queueRef=useRef<PassengerRequest[]>([]);
 const lastMissionAt=useRef(0);
 const lastScoutAt=useRef(0);

 const dispatchWorkerRef=useRef<Worker|null>(null);
 const dispatchBusyRef=useRef(false);
 const graphRevisionRef=useRef(0);
 const workerReadyRef=useRef(false);
 const roadSyncPendingRef=useRef(0);
 const workerRoadCountRef=useRef(0);
 const discoveredCacheRef=useRef<{ids:string[];set:Set<string>}|null>(null);
 const [fleet,setFleet]=useState<FleetState>(()=>company?loadFleet(company.id):{taxis:[],revenue:0,completed:0});
 const companyRef=useRef(company);companyRef.current=company;
 const pendingCashRef=useRef(0);
 const taxisRef=useRef(fleet.taxis);
 taxisRef.current=fleet.taxis;
 const [simError,setSimError]=useState('');
 const [research,setResearch]=useState<Research.ResearchState>(()=>company?Research.settle(Research.load(company.id)):Research.empty());
 const [researchError,setResearchError]=useState('');
 useEffect(()=>{setResearch(company?Research.settle(Research.load(company.id)):Research.empty())},[company?.id]);
 useEffect(()=>{if(company)Research.save(company.id,research)},[company?.id,research]);
 useEffect(()=>{if(!company)return;const timer=setInterval(()=>setResearch(old=>Research.settle(old)),1000);return()=>clearInterval(timer)},[company?.id]);
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
  worker.onmessage=(event:MessageEvent<{type:string;revision:number;taxis?:Taxi[];queue?:PassengerRequest[];error?:string;roadCount?:number;assignedCount?:number;generatedMission?:boolean}>)=>{
   const message=event.data;
   if(message.revision!==graphRevisionRef.current)return;
   if(message.type==='ready'){workerReadyRef.current=roadSyncPendingRef.current===0&&workerRoadCountRef.current>0;return;}
   if(message.type==='roadsAdded'){roadSyncPendingRef.current=Math.max(0,roadSyncPendingRef.current-1);workerRoadCountRef.current=message.roadCount??workerRoadCountRef.current;workerReadyRef.current=roadSyncPendingRef.current===0&&workerRoadCountRef.current>0;return;}
   dispatchBusyRef.current=false;
   if(message.type==='error'){console.warn('[TravelEmpire] Dispatch worker:',message.error);setSimError('Dispatch worker: '+message.error);return;}
   if(message.type!=='result'||!message.taxis||!message.queue)return;
   if(message.generatedMission)lastMissionAt.current=Date.now();
   if(message.assignedCount)lastScoutAt.current=Date.now();
   const byId=new Map(message.taxis.map(t=>[t.id,t]));
   setFleet(old=>({...old,taxis:old.taxis.map(t=>{
    const assigned=byId.get(t.id);
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
   dispatchWorkerRef.current.postMessage({type:'dispatch',revision,now,taxis,queue,discovered,
    hq:[company.headquarters.lng,company.headquarters.lat],allowMission:now-lastMissionAt.current>=demandAt(now,taxis.length).intervalMs,
    allowScout:now-lastScoutAt.current>=30000});
   // Do not suppress retries merely because a dispatch message was sent.
   // Mission/scout cooldowns are applied after the worker reports an actual result.
  },3000);
  return()=>window.clearInterval(timer);
 },[company?.id,graph]);
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
 useEffect(()=>{if(!company)return;const id=company.id;const save=()=>saveFleet(id,fleetSaveRef.current);
  const timer=window.setInterval(save,5000);
  window.addEventListener('pagehide',save);
  return()=>{window.clearInterval(timer);window.removeEventListener('pagehide',save);save()};
 },[company?.id]);
 useEffect(()=>{
  if(!company||!graph||!fleet.taxis.length)return;
  const timer=window.setInterval(()=>{
   const now=Date.now();
   setFleet(old=>{
    const savedIds=old.exploredEdgeIds??[];
    const cache=discoveredCacheRef.current;
    const discovered=cache&&cache.ids===savedIds?cache.set:new Set<string>(savedIds);
    const initialDiscoveryCount=discovered.size;
    let revenue=0,completed=0,fuelExpense=0,maintenanceExpense=0,distanceKm=0,driverWages=0,insuranceExpense=0;
    const transactions:FinancialTransaction[]=[];
    const driverUpdates=new Map<string,{trips:number;km:number;revenue:number;wages:number}>();
    const taxis=old.taxis.map(t=>{
     const delivered=t.deliveryUntil&&now>=t.deliveryUntil?{...t,deliveryUntil:undefined,deliveryStartedAt:undefined,deliveryPath:undefined}:t;
     if(delivered.deliveryUntil)return delivered;
     const next=tickTaxi(delivered,graph,1);
     const km=meters(delivered.position,next.taxi.position)/1000;
     const spec=energySpec(delivered);
     const person=(old.drivers??[]).find(d=>d.name.toLowerCase()===t.driver.toLowerCase());
     const experience=person?.completedTrips??0;
     // Career skills are derived from persistent driver trip counts (save compatible).
     const skill=Math.min(5,1+Math.floor(experience/25));
     const efficiencyBonus=(skill-1)*0.03;
     const careBonus=(skill-1)*0.0375;
     const serviceBonus=(skill-1)*0.02;
     const consumed=energyUsed(delivered,km,efficiencyBonus);
     // Energy purchases are charged at refill time, never again per driven kilometre.
     const fuel=0,maintenance=km*0.075*((old.upgrades??[]).includes('workshop')?0.9:1);
     const wearPerKm=0.025*(1-careBonus); // Condition points lost per kilometre
     const wage=0.009*(1+Math.min(0.20,Math.floor(experience/25)*0.04)); // €32.40 per simulated hour, including employer costs
     const insurance=0.00085; // €3.06 per simulated hour per taxi
     driverWages+=wage;insuranceExpense+=insurance;
     distanceKm+=km;fuelExpense+=fuel;maintenanceExpense+=maintenance;
     const earned=next.earned*(1+0.05*Research.level(research,'pricing'))*(1+serviceBonus)*((old.upgrades??[]).includes('dispatch')?1.05:1);
     revenue+=earned;
     if(earned)transactions.push({id:crypto.randomUUID(),time:now,taxiId:t.id,description:`${t.name} · passenger fare`,amount:earned});
     if(next.finished)completed++;
     if(person){const previous=driverUpdates.get(person.id)??{trips:0,km:0,revenue:0,wages:0};driverUpdates.set(person.id,{trips:previous.trips+(next.finished?((old.upgrades??[]).includes('training')?1.2:1):0),km:previous.km+km,revenue:previous.revenue+earned,wages:previous.wages+wage});}
     next.discovered.forEach(id=>discovered.add(id));
     return {...next.taxi,vehicleCondition:Math.max(0,(t.vehicleCondition??100)-km*wearPerKm),operatingKm:(t.operatingKm??0)+km,vehicleMileage:(t.vehicleMileage??0)+km,
       fuelExpense:(t.fuelExpense??0)+fuel,maintenanceExpense:(t.maintenanceExpense??0)+maintenance,
       energyRemaining:Math.max(0,energyRemaining(delivered)-consumed),
       fuelLitres:(t.fuelLitres??0)+(spec.unit==='L'?consumed:0),tripRevenue:(t.tripRevenue??0)+earned,
       driverWages:(t.driverWages??0)+wage,insuranceExpense:(t.insuranceExpense??0)+insurance};
    });
    // A small office/depot overhead accrues in simulated time, including idle periods.
    const overhead=old.taxis.length*(0.00045)+0.0012; // €4.32/hr base + €1.62/hr per vehicle
    const loanTick=advanceLoans(old.loans??[],4);
    const net=revenue-fuelExpense-maintenanceExpense-driverWages-insuranceExpense-overhead-loanTick.payments;
    if(net!==0)pendingCashRef.current+=net;
    const updatedIds=discovered.size===initialDiscoveryCount?savedIds:[...discovered];
    discoveredCacheRef.current={ids:updatedIds,set:discovered};
    const drivers=(old.drivers??[]).map(d=>{const u=driverUpdates.get(d.id);return u?{...d,completedTrips:(d.completedTrips??0)+u.trips,distanceKm:(d.distanceKm??0)+u.km,revenueGenerated:(d.revenueGenerated??0)+u.revenue,wagesEarned:(d.wagesEarned??0)+u.wages}:d;});
    return{...old,drivers,taxis,revenue:old.revenue+revenue,completed:old.completed+completed,exploredEdgeIds:updatedIds,
      fuelExpense:(old.fuelExpense??0)+fuelExpense,maintenanceExpense:(old.maintenanceExpense??0)+maintenanceExpense,
      distanceKm:(old.distanceKm??0)+distanceKm,driverWages:(old.driverWages??0)+driverWages,
      insuranceExpense:(old.insuranceExpense??0)+insuranceExpense,overheadExpense:(old.overheadExpense??0)+overhead,
      loans:loanTick.loans,loanInterestExpense:(old.loanInterestExpense??0)+loanTick.interest,loanPrincipalPaid:(old.loanPrincipalPaid??0)+loanTick.principal,transactions:[...transactions,...(old.transactions??[])].slice(0,100)};
   });
  },1000);
  return()=>window.clearInterval(timer);
 },[company?.id,graph,fleet.taxis.length,research]);

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
 const go=(name:Page)=>{setPage(name);setDrawerOpen(false);};
 const onLocation=(value:Headquarters)=>{setSelection(value);setSelecting(false);setPage('Company');setShowSetup(true);};
 return <div className="shell"><aside className={`sidebar ${drawerOpen?'open':''}`}><header className="brand"><div className="brand-mark">T</div><div><strong>TRAVELEMPIRE</strong><small>WORLDFRONT 2.0</small></div><button className="close-menu" aria-label="Close menu" onClick={()=>setDrawerOpen(false)}><X size={19}/></button></header><div className="side-label">MANAGEMENT</div><nav className="navigation" aria-label="Main navigation">{navigation.map(({name,icon:Icon})=><button key={name} className={page===name?'selected':''} onClick={()=>go(name)}><Icon size={19}/><span>{name}</span></button>)}</nav><div className="sidebar-bottom"><span className="status-dot"/>{company?company.name:'Foundation preview'}<small>{company?'Saved locally · backend not connected':'Simulation not connected'}</small></div></aside>
 {drawerOpen&&<button className="backdrop" aria-label="Close navigation" onClick={()=>setDrawerOpen(false)}/>}<main className="main"><header className="topbar"><button className="menu-toggle" aria-label="Open navigation" onClick={()=>setDrawerOpen(true)}><Menu size={21}/></button><div className="breadcrumbs">TRAVELEMPIRE <span>/</span> <b>{page.toUpperCase()}</b></div><div className="phase">GEOGRAPHIC ROAD TILES · V1.9.6 · WORKER · PERFORMANCE{roadPackages>0?` · ${roadPackages} LOADED`:""}</div></header>
 <section className="world" style={{display:page==='World'?'block':'none'}}><WorldMap selecting={selecting} onLocationSelected={onLocation} headquarters={company?.headquarters??null} taxis={fleet.taxis} exploredEdgeIds={fleet.exploredEdgeIds??[]} graph={graph}/>{selecting&&<div className="location-hint"><strong>Choose headquarters</strong><span>Click a location on the map to select it.</span><button onClick={()=>{setSelecting(false);setPage('Company');}}>Cancel</button></div>}</section>
 {page==='Company'&&(!company||showSetup)?<CompanySetup selection={selection} selecting={selecting} onSelectingChange={setSelecting} onShowMap={()=>setPage('World')} onCreated={value=>{setCompany(value);setShowSetup(false);setPage('Company');}}/>:null}
 {page==='Company'&&company&&!showSetup&&<section className="company-dashboard"><span className="eyebrow">COMPANY OVERVIEW · LOCAL PREVIEW</span><h1>{company.name}</h1><p>Your company profile is saved in this browser. Taxi operations run locally while this browser tab is open.</p><div className="company-metrics"><article><small>AVAILABLE CAPITAL</small><strong>€{company.cash.toLocaleString('en-IE')}</strong></article><article><small>HEADQUARTERS</small><strong>{company.headquarters.label}</strong></article><article><small>FLEET</small><strong>{fleet.taxis.length} taxis</strong></article></div><p className="setup-disclaimer">No administrative ownership restrictions. Greek roads load automatically near headquarters and active taxis from Supabase.</p><button className="setup-secondary" onClick={()=>setPage('World')}>View headquarters on map</button><button className="danger-button" onClick={()=>{if(window.confirm('Delete this locally saved company? This cannot be undone.')){Research.clear(company.id);clearCompany();localStorage.removeItem(`travelempire.fleet.v0.8.${company.id}`);setFleet({taxis:[],revenue:0,completed:0});setCompany(null);setSelection(null);setShowSetup(false);}}}>Delete local company</button></section>}
 {page==='Fleet'&&<FleetPanel company={company} fleet={fleet} graph={graph} onBuy={buyTaxi} onAssignDriver={assignDriver} onHireDriver={hireDriver} onDismissDriver={dismissDriver} onService={serviceTaxi} onRefill={refillTaxi}/>}
 {page==='Operations'&&<section className="company-dashboard"><span className="eyebrow">AUTOMATIC DISPATCH · V1.9.3</span><h1>Operations</h1><p>Automatic dispatch is enabled whenever this browser tab is open. Passenger stops stay on discovered roads. Waiting passenger requests expire after two minutes. Passenger demand and fares vary by the time of day in Greece. Idle taxis take the closest eligible passenger; when there are no waiting passengers, a taxi can scout the unexplored frontier.</p><div className="company-metrics"><article><small>DEMAND IN GREECE</small><strong>{demandAt(Date.now(),fleet.taxis.length).level}</strong></article><article><small>RUSH-HOUR FARE MULTIPLIER</small><strong>{demandAt(Date.now(),fleet.taxis.length).fareMultiplier.toFixed(2)}×</strong></article><article><small>ACTIVE TAXIS</small><strong>{fleet.taxis.filter(t=>t.status!=='IDLE').length}</strong></article><article><small>WAITING PASSENGERS</small><strong>{missionQueue.length}</strong></article><article><small>EXPLORED ROAD IDS</small><strong>{(fleet.exploredEdgeIds??[]).length.toLocaleString()}</strong></article><article><small>SCOUTING TAXIS</small><strong>{fleet.taxis.filter(t=>t.status==='EXPLORING').length}</strong></article><article><small>COMPLETED TRIPS</small><strong>{fleet.completed}</strong></article><article><small>TRIP REVENUE</small><strong>€{fleet.revenue.toFixed(2)}</strong></article><article><small>ROAD GRAPH</small><strong>{graph?`${graph.nodeKeys.length.toLocaleString()} nodes`:'Loading'}</strong></article><article><small>LOADED ROAD TILES</small><strong>{roadPackages}</strong></article><article><small>QUEUED TILE LOADS</small><strong>{roadDiagnostics.queued}</strong></article><article><small>ROUTING EDGES</small><strong>{roadDiagnostics.edges.toLocaleString()}</strong></article><article><small>DISPATCH WORKER EDGES</small><strong>{roadDiagnostics.workerEdges.toLocaleString()}</strong></article></div>{simError&&<p role="alert">{simError}</p>}</section>}
 {page==='Finance'&&<FinancePanel company={company} fleet={fleet} onLoan={takeLoan} onUpgrade={buyUpgrade} error={simError}/>}
 {page==='Research'&&<><ResearchPanel company={company} state={research} onStart={startResearch} onCancel={cancelResearch}/>{researchError&&<p role="alert">{researchError}</p>}</>}
 {page!=='Research'&&page!=='World'&&page!=='Company'&&page!=='Fleet'&&page!=='Operations'&&page!=='Finance'&&<section className="placeholder"><span className="eyebrow">MANAGEMENT CENTER</span><h1>{page}</h1><p>This module is reserved for an upcoming milestone. No simulated figures are shown until the authoritative backend is implemented.</p><div className="placeholder-card"><span>MODULE STATUS</span><strong>Planned</strong><small>Foundation preview · no live company data</small></div></section>}
 {!company&&page==='World'&&!selecting&&<button className="start-company-button" onClick={()=>{setPage('Company');setShowSetup(true);}}>+ Create company</button>}
 </main><nav className="mobile-tabs" aria-label="Mobile navigation">{navigation.slice(0,5).map(({name,icon:Icon})=><button key={name} className={page===name?'active':''} onClick={()=>go(name)}><Icon size={19}/><span>{name}</span></button>)}<button onClick={()=>setDrawerOpen(true)}><Menu size={19}/><span>More</span></button></nav></div>;
}
