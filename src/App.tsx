import {diagnostic} from './frontendDiagnostics';
let lastTaxiDispatchSignature='';
let lastTaxiDispatchLogAt=0;
let lastMajorExplorerLogAt=0;
let lastMissionPerfLogAt=0;
let lastWorkerPerfLogAt=0;
let lastSlowDispatchLogAt=0;
import {recordSimulationTick,recordActivity,performanceMonitorEnabled} from './performanceMonitor';
import {readExploration,writeExploration,clearExploration} from './data/explorationStore';
import {energySpec,energyRemaining,energyUsed,energyPercent,energyRangeKm} from './simulation/energy';
import {loadStationTile,type Station} from './data/stations';
import {loadRestStopTile} from './data/restStops';
import InvestmentsPanel from './components/InvestmentsPanel';
import FutureModulePanel from './components/FutureModulePanel';
import {isFutureModule} from './futureModules';
import {loadPortfolio,savePortfolio,buyPropertyShare,settlePropertyDividends,type InvestablePOI} from './investments';
import type {RestStop} from './simulation/driverRest';
import {demandAt} from './simulation/demand';
import { useEffect, useMemo, useState, startTransition } from "react";
import { BarChart3, Building2, CarFront, Compass, FlaskConical, Landmark, Map as MapIcon, Ship, Menu, Hotel, X, PanelLeftClose, PanelLeftOpen, CircleDollarSign, CalendarClock, Layers3, ScrollText, Plane, Truck, BusFront, Car, Anchor, Zap, ChartNoAxesCombined, HardHat, Palmtree, BriefcaseBusiness, GraduationCap } from "lucide-react";
import WorldMap from "./components/WorldMap";
import {resolvePurpleExplorerStart} from './simulation/explorerStart';
import {grantExplorerInfrastructure,EXPANSION_ROLES} from './simulation/researchExplorerGrant';
import DriversPanel from "./components/DriversPanel";
import {canAcceptPassengerJob,driverSchedule} from './simulation/driverSchedule';
import {shiftRestTargets,isAtShiftRestStop} from './simulation/shiftRest';
import {shouldAutomaticallyRecover} from './simulation/recoveryEligibility';
import {resetVehicleAtDepot} from './simulation/vehicleReset';
import {settlePassengerFare} from './simulation/passengerSettlement';
import {nearbyExplorerRestStops,reasonableExplorerRestRoute} from './simulation/explorerRestPolicy';
import FleetPanel from "./components/FleetPanel";
import DealershipPage from './components/DealershipPage';
import OperationsPanel from "./components/OperationsPanel";
import FinancePanel from "./components/FinancePanel";
import FrontendConsole from "./components/FrontendConsole";
import FinancialConsole from "./components/FinancialConsole";
import {recordFinancialAudit} from "./financialDiagnostics";
import FerryRoutesPanel from "./components/FerryRoutesPanel";
import {advanceLoans,advanceLeases,financeQuote,leaseQuote,createLoan,UPGRADES} from "./economy";
import {securedQuote,createSecuredLoan,advanceSecuredLoans} from './simulation/securedLoans';
import {partnershipOffer,collectBankRevenue,bookBankCollection,bookBankLenderCollections,revenueAverage,type BankPartnership} from './simulation/bankPartnerships';
import {bankOf,bankEntry,appendBankEntries,transferBank} from "./banking";
import {DEPOT_UPGRADES,upgradesFor,depotCapacity,explorerDepotCapacity,depotDailyTotal} from './depotFinance';
import {equityOf,valueCompany,investorOffers,issueShares,payDividend,buybackShares,distributableProfit,recordValuation} from './equity';
import {establishForeignSubsidiary,acquireForeignBusiness,crossBorderTransfer} from './international';
import {acquireCompany,foundSubsidiary,transferCorporateCash,mergeSubsidiaries,restructureSubsidiary,transferSubsidiaryAssets,advanceCorporate,corporateCreditCapacity} from './corporate';
import type {CorporateState,CorporateEvent} from './simulation/taxi';
import {bookAccounting,settleAccounting,periodMonth,depreciationTick,accountingOf} from './accounting';
import type {AccountingSettings} from './simulation/taxi';
import type {DepotUpgradeKind,DepotFinanceRecord} from './simulation/taxi';
import type {EconomyUpgrade} from "./simulation/taxi";
import {loadRoadGraph,loadFleet,saveFleet,tickTaxi,DRIVER_COST,nearest,route,type RoadGraph,type FleetState, type Taxi, type PassengerRequest,meters,type FinancialTransaction} from "./simulation/taxi";
import {registerNewRoadDistance} from './simulation/explorerDiscoveryDistance';
import {passengerRouteIssue,passengerRouteAdvanced} from './simulation/passengerRouteRecovery';
import {createDepotStarterExplorers,reconcileDepotStarterExplorers,type DepotStarterAnchor} from './simulation/depotStarterExplorers';
import {missingDepotAccessSeeds} from './simulation/depotRoadSeeds';
import {depotParkingChoices,requireDepotParking} from './simulation/depotParking';
import "./taxi.css";
import {deliveryRoute, type VehicleOffer} from "./dealership";
import ResearchPanel from "./components/ResearchPanel";
import LiveFinanceTicker from "./components/LiveFinanceTicker";
import DailySummaryModal from './components/DailySummaryModal';
import {buildDailySummary,dayBaseline,gameDay,readSummaryBaseline,saveSummaryBaseline,type DailySummary} from './simulation/dailySummary';
import * as Research from "./research";
import CompanySetup from "./components/CompanySetup";
import {clearCompany,loadCompany, saveCompany,type Company,type Headquarters} from './company';
import "./map-update.css";
import "./company.css";
import "./midnight-glass.css";
import "./aurora-glass.css";

import {RoadNetworkManager} from './data/roadNetworkManager';
import {isIOSWebKit,dispatchAllowed,IOS_DISPATCH_INTERVAL_MS,DESKTOP_DISPATCH_INTERVAL_MS} from './data/roadMemoryPolicy';
import {loadFerryNetwork,englishFerryName,type FerryNetwork} from './maritime/ferries';
import {ferryRoutePrice} from './maritime/routePlanning';
import {completedFerryArrivals,ferryStartsAtFrom,nextPassengerDeparture,mayBoardPassengerFerry,PUBLIC_PASSENGER_FERRY_EPOCH_MS} from './maritime/ferryService';
import {arrivedHarbourIds,mergeUnlockedHarbours} from './maritime/ferryArrivalUnlocks';
import {ferryArrivalRoadIds,ferryArrivalRoadsKey,ferryArrivalRoadsPendingKey} from './maritime/ferryArrivalRoads';
import {choosePassengerFerry,ferryPosition} from './maritime/explorerPassengerFerry';
import {harbourRoadEdges,harbourStorageKey} from './maritime/harbourUnlocks';
import {type PoiHarbourMission} from './maritime/poiMissions';
import {useRef} from 'react';
import {loadGameClock,advanceGameClock,saveGameClock,formatGameClock,type GameClock} from './simulation/gameClock';


const futureNavigation=[
 {name:'Empire',icon:BarChart3},
 {name:'Aviation',icon:Plane},
 {name:'Logistics',icon:Truck},
 {name:'Public Transport',icon:BusFront},
 {name:'Real Estate',icon:Building2},
 {name:'Automotive',icon:Car},
 {name:'Shipping',icon:Anchor},
 {name:'Energy',icon:Zap},
 {name:'Stock Market',icon:ChartNoAxesCombined},
 {name:'Infrastructure',icon:HardHat},
 {name:'Tourism',icon:Palmtree},
 {name:'Contracts',icon:BriefcaseBusiness},
 {name:'Workforce',icon:GraduationCap}
] as const;
const navigation=[{name:"World",icon:MapIcon},{name:"Fleet",icon:CarFront},{name:"Dealership",icon:Building2},{name:"Drivers",icon:CalendarClock},{name:"Operations",icon:Compass},{name:"Ferries",icon:Ship},{name:"Investments",icon:Hotel},{name:"Company",icon:Building2},{name:"Finance",icon:Landmark},{name:"Research",icon:FlaskConical},...futureNavigation] as const;
type Page=(typeof navigation)[number]['name'];
type RecoveryJob={truck:Taxi;targetId:string;phase:'pickup'|'transport'|'return';destination:[number,number];purpose:'fuel'|'service'|'depot';atDepot:boolean};

export default function App(){
 const [page,setPage]=useState<Page>('World');const [consoleOpen,setConsoleOpen]=useState(false);const [consoleMode,setConsoleMode]=useState<'general'|'financial'>('general');const [sidebarCollapsed,setSidebarCollapsed]=useState(()=>{try{return localStorage.getItem('travelempire.sidebar.collapsed')==='true'}catch{return false}});useEffect(()=>{try{localStorage.setItem('travelempire.sidebar.collapsed',String(sidebarCollapsed))}catch{}},[sidebarCollapsed]);const [drawerOpen,setDrawerOpen]=useState(false);const [layersToggleToken,setLayersToggleToken]=useState(0);const [company,setCompany]=useState<Company|null>(loadCompany);const [selection,setSelection]=useState<Headquarters|null>(null);const [selecting,setSelecting]=useState(false);const [showSetup,setShowSetup]=useState(false);const [placingDepot,setPlacingDepot]=useState(false);
 const [gameClock,setGameClock]=useState<GameClock|null>(()=>company?loadGameClock(company.id):null);
 const gameClockRef=useRef(gameClock);gameClockRef.current=gameClock;
 useEffect(()=>{
  if(!company){setGameClock(null);return;}
  const id=company.id;
  let current=loadGameClock(id);
  gameClockRef.current=current;setGameClock(current);
  const update=()=>{
   if(document.visibilityState!=='visible')return;
   current=advanceGameClock(current);
   gameClockRef.current=current;setGameClock(current);saveGameClock(id,current);
  };
  const pause=()=>{
   current={...current,lastRealMs:Date.now()};
   gameClockRef.current=current;saveGameClock(id,current);
  };
  const resume=()=>{
   current={...current,lastRealMs:Date.now()};
   gameClockRef.current=current;setGameClock(current);saveGameClock(id,current);
  };
  const visibility=()=>{if(document.visibilityState==='visible')resume();else pause();};
  const timer=window.setInterval(update,1000);
  window.addEventListener('visibilitychange',visibility);
  window.addEventListener('pagehide',pause);
  window.addEventListener('pageshow',resume);
  return()=>{window.clearInterval(timer);window.removeEventListener('visibilitychange',visibility);window.removeEventListener('pagehide',pause);window.removeEventListener('pageshow',resume);pause();};
 },[company?.id]);
 // Settle owned ferry fares only when the same game-time boat timetable used
 // by the map completes a crossing, including the return trip.
 useEffect(()=>{
  if(!company?.id)return;
  let cancelled=false;
  let busy=false;
  let ferryRoutes=new Map<string,{durationMinutes:number;name:string;from:string;to:string}>();
  let portNames=new Map<string,string>();
  let knownPortIds=new Set<string>();
  void loadFerryNetwork().then(network=>{
   if(cancelled)return;
   portNames=new Map(network.ports.map(port=>[port.id,port.name]));
   knownPortIds=new Set(network.ports.map(port=>port.id));
   const positions=new Map(network.ports.map(port=>[port.id,port.position]));
   const home=companyRef.current?.headquarters;
   ferryRoutes=new Map(network.routes.map(route=>{
    const a=positions.get(route.from),b=positions.get(route.to);
    const homePoint:[number,number]=home?[home.lng,home.lat]:[0,0];
    const reverse=!!home&&!!a&&!!b&&meters(homePoint,b)<meters(homePoint,a);
    return [route.id,{durationMinutes:route.durationMinutes,name:route.name??route.id,
     from:reverse?route.to:route.from,to:reverse?route.from:route.to}] as const;
   }));
  }).catch(error=>console.warn('[TravelEmpire] Ferry revenue data unavailable',error));
  const settle=()=>{
   if(cancelled||busy||!ferryRoutes.size)return;
   const current=companyRef.current;
   const clock=gameClockRef.current;
   if(!current||current.id!==company.id||!clock)return;
   const owned=current.purchasedFerryRouteIds??[];
   if(!owned.length)return;
   const nowGame=clock.epochMs;
   const routes=owned.flatMap(id=>{
    const route=ferryRoutes.get(id);
    return route?[{id,durationMinutes:route.durationMinutes}]:[];
   });
   const starts={...(current.ferryServiceStartedAt??{})};
   let initialized=false;
   for(const route of routes)if(!Number.isFinite(starts[route.id])){
    // Migrating an older save starts a new voyage NOW, without re-paying
    // fictitious offline departures from the previous hourly scheme.
    starts[route.id]=nowGame;initialized=true;
   }
   const settlement=completedFerryArrivals(routes,starts,current.ferryLastPaidVoyage??{},nowGame);
   if(initialized||settlement.changed){
    const updated={...current,ferryServiceStartedAt:starts,
     ferryLastPaidVoyage:settlement.paid};
    companyRef.current=updated;saveCompany(updated);setCompany(updated);
   }
   if(!settlement.arrivals.length)return;
   // Automatically operated ferries unlock only the harbour they actually
   // reach. The same timetable powers moving map boats and fare settlements.
   // Persist per company immediately, including arrivals processed after a
   // page reload; never infer unlocks from a mere route purchase.
   const destinations=arrivedHarbourIds(settlement.arrivals,ferryRoutes,knownPortIds);
   if(destinations.length){
    const key=harbourStorageKey(current.id);
    let saved:string[]=[];
    try{const value=JSON.parse(localStorage.getItem(key)??'[]') as unknown;
     if(Array.isArray(value))saved=value.filter((id):id is string=>typeof id==='string'&&knownPortIds.has(id));
    }catch{}
    const merged=mergeUnlockedHarbours(saved,destinations);
    try{localStorage.setItem(key,JSON.stringify(merged));}catch{}
    setUnlockedHarbours(previous=>mergeUnlockedHarbours(previous,destinations));
    // Queue once per actually reached harbour, independently of unlocks.
    try{
     const done=new Set(JSON.parse(localStorage.getItem(ferryArrivalRoadsKey(current.id))??'[]') as string[]);
     const pending=new Set(JSON.parse(localStorage.getItem(ferryArrivalRoadsPendingKey(current.id))??'[]') as string[]);
     for(const id of destinations)if(!done.has(id))pending.add(id);
     localStorage.setItem(ferryArrivalRoadsPendingKey(current.id),JSON.stringify([...pending]));
    }catch(error){diagnostic('ferry:arrival-road-queue-error',String(error));}
    diagnostic('ferry:harbours-unlocked',destinations.join(','));
   }
   busy=true;
   let gross=0,costs=0;
   const events:Array<{description:string;amount:number;time:number}>=[];
   for(const arrival of settlement.arrivals){
    const route=ferryRoutes.get(arrival.routeId);
    if(!route)continue;
    const duration=arrival.durationMinutes;
    const hour=new Date(arrival.completedAt).getUTCHours();
    const demand=hour>=7&&hour<10||hour>=16&&hour<20?1.45:hour>=22||hour<6?0.35:1;
    const passengers=Math.round((12+Math.min(55,duration*0.22))*demand);
    const standardFare=4+duration*0.16;
    const configuredFare=current.ferryTicketPrices?.[arrival.routeId];
    const ticket=typeof configuredFare==='number'&&Number.isFinite(configuredFare)&&configuredFare>=1&&configuredFare<=100?configuredFare:standardFare;
    const priceMultiplier=Math.max(0.2,Math.min(1.8,Math.pow(ticket/standardFare,-0.75)));
    const adjustedPassengers=Math.min(90,Math.max(0,Math.round(passengers*priceMultiplier)));
    const revenue=Math.round(adjustedPassengers*ticket*100)/100;
    const cost=Math.round((24+duration*0.9)*100)/100;
    gross+=revenue;costs+=cost;
    // A real-world OSM import direction is the initial outbound orientation.
    // The boat and the revenue model use the same persisted departure epoch.
    const origin=arrival.direction==='outbound'?route.from:route.to;
    const destination=arrival.direction==='outbound'?route.to:route.from;
    const passage=`${portNames.get(origin)??origin} → ${portNames.get(destination)??destination}`;
    events.push({description:`Ferry fare · ${passage} · ${adjustedPassengers} passengers`,
     amount:revenue,time:arrival.completedAt});
    events.push({description:`Ferry operating costs · ${passage}`,amount:-cost,
     time:arrival.completedAt});
   }
   const net=Math.round((gross-costs)*100)/100;
   // Even a break-even crossing has gross receipts subject to bank revenue share.
   if(net!==0||gross>0){
    pendingCashRef.current+=net;
    setFleet(old=>{
     const savingsBank=bankOf(old.bank);
     const available=Math.max(0,(companyRef.current?.cash??0)+pendingCashRef.current-savingsBank.minimumOperatingCash);
     const savingsAmount=Math.floor(Math.min(available,Math.max(0,gross)*savingsBank.autoSavePercent/100)*100)/100;
     if(savingsAmount>0)pendingCashRef.current-=savingsAmount;
     const updatedBank=savingsAmount>0?appendBankEntries({...savingsBank,savings:savingsBank.savings+savingsAmount},[
      bankEntry('Automatic savings · ferry income',-savingsAmount,'operating','transfer'),
      bankEntry('Automatic savings · ferry income',savingsAmount,'savings','transfer')
     ]):old.bank;
     // Revenue financing is collected on owned ferry receipts as well as taxi fares.
     const partnership=collectBankRevenue(old.bankPartnerships??[],gross);
     const pendingBeforeFerry=pendingCashRef.current;
     if(partnership.paid>0)pendingCashRef.current-=partnership.paid;
     if(gross!==0||costs!==0||partnership.paid!==0||savingsAmount!==0)recordFinancialAudit({gameTime:new Date(nowGame).toISOString(),kind:'ferry',description:'Ferry receipts; lenders: '+partnership.settlements.map(x=>x.bank+' '+x.amount.toFixed(2)).join(', '),gross,operatingCost:costs,bankShare:partnership.paid,savings:savingsAmount,other:0,cashBefore:companyRef.current?.cash??0,pendingBefore:pendingBeforeFerry-net+savingsAmount,pendingAfter:pendingCashRef.current,breakdown:{'Ferry operating costs':costs},bankLenders:Object.fromEntries(partnership.settlements.map(x=>[x.bank,x.amount])),reference:'ferry-arrivals:'+settlement.arrivals.map(x=>x.routeId+':'+x.completedAt).join(',')});
     const partnershipBank=partnership.paid>0?appendBankEntries(bankOf(updatedBank),
      partnership.settlements.map(item=>bankEntry('Revenue partnership · '+item.bank,-item.amount,'operating','repayment'))):updatedBank;
     const day=new Date(settlement.arrivals.at(-1)?.completedAt??nowGame).toISOString().slice(0,10);
     const history=[...(old.financeHistory??[])];
     const lastDay=history[history.length-1];
     if(lastDay?.day===day)history[history.length-1]={...lastDay,revenue:lastDay.revenue+gross,expenses:lastDay.expenses+costs};
     else history.push({day,revenue:gross,expenses:costs,trips:0});
     const ferryAccounting=bookAccounting(old.accounting,periodMonth(nowGame),gross,costs,costs,0);
     return {...old,accounting:ferryAccounting,bank:partnershipBank,bankPartnerships:partnership.deals,bankPartnershipPaid:(old.bankPartnershipPaid??0)+partnership.paid,bankPartnershipPaidByDay:bookBankCollection(old.bankPartnershipPaidByDay,day,partnership.paid),bankPartnershipPaidByLenderByDay:bookBankLenderCollections(old.bankPartnershipPaidByLenderByDay,day,partnership.settlements),revenue:old.revenue+gross,overheadExpense:(old.overheadExpense??0)+costs,
      ferryRevenueByDay:(()=>{const days={...(old.ferryRevenueByDay??{})};days[day]=Math.round(((days[day]??0)+gross)*100)/100;const keys=Object.keys(days).sort();for(const oldDay of keys.slice(0,-45))delete days[oldDay];return days;})(),
      financeHistory:history.slice(-365),
      transactions:[...partnership.settlements.map(item=>({id:crypto.randomUUID(),time:nowGame,description:'Revenue partnership · '+item.bank,amount:-item.amount})),...events.map(event=>({id:crypto.randomUUID(),...event})),
       ...(old.transactions??[])].slice(0,100)};
    });
   }
   busy=false;
  };
  const timer=window.setInterval(settle,5000);
  return()=>{cancelled=true;window.clearInterval(timer)};
 },[company?.id]);
 // Ferry arrivals grant a small purple starting network once per harbour.
 // Wait until the road graph has streamed the destination's OSM tiles.
 useEffect(()=>{
  if(!company?.id)return;
  const companyId=company.id;
  let working=false;
  const apply=async()=>{
   if(working||!graphRef.current)return;
   let pending:string[]=[];
   let completed:string[]=[];
   try{
    const p=JSON.parse(localStorage.getItem(ferryArrivalRoadsPendingKey(companyId))??'[]') as unknown;
    const d=JSON.parse(localStorage.getItem(ferryArrivalRoadsKey(companyId))??'[]') as unknown;
    if(Array.isArray(p))pending=p.filter((x):x is string=>typeof x==='string');
    if(Array.isArray(d))completed=d.filter((x):x is string=>typeof x==='string');
   }catch{return;}
   if(!pending.length)return;
   working=true;
   try{
    const network=await loadFerryNetwork();
    const done=new Set(completed),waiting=new Set(pending);
    for(const portId of pending){
     if(done.has(portId)){waiting.delete(portId);continue;}
     const port=network.ports.find(p=>p.id===portId);
     if(!port){waiting.delete(portId);continue;}
     const point=port.roadAccess??port.position;
     networkRef.current?.considerHarbour(point);
     const graph=graphRef.current;
     if(!graph)continue;
     const ids=ferryArrivalRoadIds(graph,point);
     if(!ids.length)continue;
     const current=fleetSaveRef.current;
     const merged=[...new Set([...(current.exploredEdgeIds??[]),...(discoveredCacheRef.current?.ids??[]),...ids])];
     discoveredCacheRef.current={ids:merged,set:new Set(merged)};
     fleetSaveRef.current={...current,exploredEdgeIds:merged};
     setFleet(old=>({...old,exploredEdgeIds:[...new Set([...(old.exploredEdgeIds??[]),...ids])]}));
     await writeExploration(companyId,{ids,segments:{}});
     done.add(portId);waiting.delete(portId);
     diagnostic('ferry:arrival-road-seed',portId+' edges='+ids.length+' radius=50m');
    }
    localStorage.setItem(ferryArrivalRoadsKey(companyId),JSON.stringify([...done]));
    localStorage.setItem(ferryArrivalRoadsPendingKey(companyId),JSON.stringify([...waiting]));
   }catch(error){diagnostic('ferry:arrival-road-seed-error',String(error));}
   finally{working=false;}
  };
  void apply();
  const timer=window.setInterval(()=>{void apply()},5000);
  return()=>window.clearInterval(timer);
 },[company?.id]);
 // Diagnose stalls that occur after graph publication, including Safari scheduling pauses.
 useEffect(()=>{
  let previous=performance.now();
  const timer=window.setInterval(()=>{
   const now=performance.now();const delay=now-previous-500;previous=now;
   if(delay>250)diagnostic('main:heartbeat-gap',`delayMs=${Math.round(delay)} visibility=${document.visibilityState}`);
  },500);
  return()=>window.clearInterval(timer);
 },[]);
 // Lightweight diagnostics: correlate React commits, animation frames and browser pauses.
 const [graph,setGraph]=useState<RoadGraph|null>(null);
 const graphRef=useRef<RoadGraph|null>(null);
 const [roadGraphVersion,setRoadGraphVersion]=useState(0);
 const graphEnqueueRef=useRef<{nodes:number;at:number}|null>(null);
 useEffect(()=>{
  if(!graph)return;
  const pending=graphEnqueueRef.current;
  if(pending&&pending.nodes===graph.nodeKeys.length){
   diagnostic('roads:react-commit',`nodes=${pending.nodes} latencyMs=${Math.round(performance.now()-pending.at)}`);
   graphEnqueueRef.current=null;
  }
 },[graph]);
 useEffect(()=>{
  let previous=performance.now();let frame=0;let lastReport=previous;
  let stopped=false;
  const tick=(now:number)=>{
   if(stopped)return;
   const gap=now-previous;previous=now;
   if(gap>250)diagnostic('main:raf-gap',`gapMs=${Math.round(gap)} visibility=${document.visibilityState}`);
   frame++;
   if(now-lastReport>=10000){
    const memory=(performance as Performance & {memory?:{usedJSHeapSize:number;jsHeapSizeLimit:number}}).memory;
    diagnostic('main:health',`frames=${frame} periodMs=${Math.round(now-lastReport)} heapMB=${memory?Math.round(memory.usedJSHeapSize/1048576):'unavailable'} heapLimitMB=${memory?Math.round(memory.jsHeapSizeLimit/1048576):'unavailable'} visibility=${document.visibilityState}`);
    frame=0;lastReport=now;
   }
   requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  const visibility=()=>diagnostic('main:visibility',`state=${document.visibilityState}`);
  document.addEventListener('visibilitychange',visibility);
  let observer:PerformanceObserver|undefined;
  try{
   observer=new PerformanceObserver(list=>{
    for(const entry of list.getEntries())if(entry.duration>=100)diagnostic('main:long-task',`durationMs=${Math.round(entry.duration)} startMs=${Math.round(entry.startTime)}`);
   });
   observer.observe({entryTypes:['longtask']});
  }catch{observer?.disconnect();observer=undefined;}
  return()=>{stopped=true;observer?.disconnect();document.removeEventListener('visibilitychange',visibility);};
 },[]);

 const networkRef=useRef<RoadNetworkManager|null>(null);
 const stationsRef=useRef<Map<string,Station>>(new Map());
 const restStopsRef=useRef<Map<string,RestStop>>(new Map());
 const [investmentPois,setInvestmentPois]=useState<InvestablePOI[]>([]);
 const [portfolio,setPortfolio]=useState(()=>loadPortfolio(company?.id));
 const portfolioRef=useRef(portfolio);portfolioRef.current=portfolio;
 const [investmentError,setInvestmentError]=useState('');
 useEffect(()=>{const next=loadPortfolio(company?.id);portfolioRef.current=next;setPortfolio(next);setInvestmentPois([]);restStopsRef.current.clear();restLoadedRef.current.clear();setInvestmentError('');},[company?.id]);
 const restLoadedRef=useRef<Set<string>>(new Set());
 const harbourPoiRef=useRef<Array<[number,number]>>([]);
 const harbourMissionsRef=useRef<PoiHarbourMission[]>([]);
 const harbourCandidatesRef=useRef<PoiHarbourMission[]>([]);
 const harbourPrefetchProgressRef=useRef(new Map<string,number>());
 const harbourPrefetchCursorRef=useRef(0);
 const stationLoadedRef=useRef<Set<string>>(new Set());
 const [roadPackages,setRoadPackages]=useState(0);
 const [roadDiagnostics,setRoadDiagnostics]=useState({queued:0,edges:0,workerEdges:0});
 const [missionQueue,setMissionQueue]=useState<PassengerRequest[]>([]);
 const queueRef=useRef<PassengerRequest[]>([]);
 const lastMissionAt=useRef(0);

 const dispatchWorkerRef=useRef<Worker|null>(null);
 const dispatchBusyRef=useRef(false);
 const dispatchStartedRef=useRef(0);
 const routeSequenceRef=useRef(0);
 // Per-passenger-job progress tracking, never persisted in a fleet save.
 const passengerRouteWatchRef=useRef(new Map<string,{
  job:string;status:'TO_PICKUP'|'TO_DROPOFF';leg:number;distanceIntoLeg:number;
  lastProgressAt:number;lastAttemptAt:number;pending:boolean
 }>());
 // Ignore dispatcher responses computed before a manual vehicle reset.
 const resetVehicleTargetsRef=useRef(new Map<string,[number,number]>());
 const shiftRestRetryRef=useRef(new Map<string,number>());
 const operationalRoutesRef=useRef(new Map<string,{requestId:number;purpose:'shift'|'service';position:[number,number];status:string;at:number;graph:RoadGraph;path:[number,number][]|null;edgeIds:string[]|null;target?:[number,number]|null;ready:boolean}>());
 const pendingFuelRef=useRef(new Map<string,{requestId:number;position:[number,number];at:number;graph:RoadGraph}>());
 const pendingRoutesRef=useRef(new Map<number,{vehicleId:string;position:[number,number];status:string;onResult:(path:[number,number][]|null,edgeIds:string[]|null,reason?:string)=>void}>());
 const ferryReadinessRef=useRef(new Map<string,{ready:boolean;idleMs:number}>());
 const ferryBookingRef=useRef(new Set<string>());
 const ferryAttemptRef=useRef(new Map<string,number>());
 const graphRevisionRef=useRef(0);
 const workerReadyRef=useRef(false);
 const roadSyncPendingRef=useRef(0);
  const roadSyncAcksRef=useRef<Array<()=>void>>([]);
 const workerRoadCountRef=useRef(0);
 const discoveredCacheRef=useRef<{ids:string[];set:Set<string>}|null>(null);
 const roadLengthByIdRef=useRef<Map<string,number>>(new Map());
 const simulationPerfRef=useRef({samples:0,totalMs:0,maxMs:0,lastReport:0});
 const fuelPlanCacheRef=useRef(new Map<string,{at:number;position:[number,number];graph:RoadGraph|null;stationCount:number;target:{point:[number,number];depot:boolean;roadKm:number;path:ReturnType<typeof route>}|null}>());
 const [companyTab,setCompanyTab]=useState<'overview'|'depots'|'vehicles'|'settings'>('overview');
 // Preserve existing specialists, progress and discovered roads.
 const universalFleet=(loaded:FleetState):FleetState=>loaded;
 const [fleet,setFleet]=useState<FleetState>(()=>company?universalFleet(loadFleet(company.id)):{taxis:[],revenue:0,completed:0});
 const companyRef=useRef(company);companyRef.current=company;
 const pendingCashRef=useRef(0);
 useEffect(()=>{
  if(!company)return;
  const timer=window.setInterval(()=>{
   const points:[[number,number],...Array<[number,number]>]=[[company.headquarters.lng,company.headquarters.lat],...taxisRef.current.filter(t=>t.ferryTrip?.stage!=='sailing').map(t=>t.position)];
   for(const [lng,lat] of points){
    const tile=`${Math.floor(lng*10)}_${Math.floor(lat*10)}`;
    if(!restLoadedRef.current.has(tile)){
     restLoadedRef.current.add(tile);
     void loadRestStopTile(lng,lat).then(stops=>{
       for(const stop of stops)restStopsRef.current.set(stop.id,stop);
       const investable=stops.filter((p):p is InvestablePOI=>p.kind==='hotel'||p.kind==='parking');
       if(investable.length)setInvestmentPois(old=>{
        const seen=new Map(old.map(p=>[p.id,p]));
        for(const p of investable)seen.set(p.id,p);
        return [...seen.values()].slice(0,1200);
       });
      }).catch(()=>restLoadedRef.current.delete(tile));
    }
    if(stationLoadedRef.current.has(tile))continue;
    stationLoadedRef.current.add(tile);
    void loadStationTile(lng,lat).then(stations=>{for(const station of stations)stationsRef.current.set(station.id,station)}).catch(()=>stationLoadedRef.current.delete(tile));
   }
  },5000);
  return()=>window.clearInterval(timer);
 },[company?.id]);
 const taxisRef=useRef(fleet.taxis);
 taxisRef.current=fleet.taxis;
 // Multiple independent recovery jobs, compatible with legacy single-job saves.
 const [recoveries,setRecoveries]=useState<RecoveryJob[]>(()=>{
  if(!company)return [];
  try{const raw=localStorage.getItem('travelempire.recovery.'+company.id);const parsed=raw?JSON.parse(raw):[];
   const jobs:RecoveryJob[]=Array.isArray(parsed)?parsed:[parsed];
   return jobs.filter(job=>job?.truck?.kind==='recovery'&&job.targetId&&['pickup','transport','return'].includes(job.phase));
  }catch{return []}
 });
 const recoveriesRef=useRef(recoveries);recoveriesRef.current=recoveries;
 const manualRecoveryRequestsRef=useRef(new Set<string>());
 const manualRecoveryPurposeRef=useRef(new Map<string,'fuel'|'depot'>());
 const requestRecoveryTruck=(id:string,purpose:'fuel'|'depot'='depot')=>{
  if(!companyRef.current||!graph||recoveriesRef.current.some(j=>j.targetId===id))return;
  const target=taxisRef.current.find(t=>t.id===id);
  if(!target||target.kind==='recovery'||target.recoveryPending||Boolean(target.deliveryUntil&&target.deliveryUntil>Date.now()))return;
  manualRecoveryPurposeRef.current.set(id,purpose);manualRecoveryRequestsRef.current.add(id);
 };
 useEffect(()=>{if(!company)return;try{localStorage.setItem('travelempire.recovery.'+company.id,JSON.stringify(recoveries))}catch(error){console.warn('[TravelEmpire] Recovery save failed',error)}},[company?.id,recoveries]);
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
   const updated:RecoveryJob[]=[];
   for(const job of recoveriesRef.current){
    const moving=tickTaxi(job.truck,graph,1).taxi;
    if(moving.status!=='PAUSED'){
     updated.push({...job,truck:moving});
     if(job.phase==='transport')setFleet(old=>({...old,taxis:old.taxis.map(t=>t.id===job.targetId?{...t,position:moving.position}:t)}));
     continue;
    }
    if(job.phase==='pickup'){
     const path=buildRoute(moving.position,job.destination);
     if(!path){updated.push({...job,truck:moving});continue;}
     updated.push({...job,phase:'transport',truck:{...moving,status:'RETURNING',pauseAtHome:true,path:path.path,edgeIds:path.edgeIds,leg:0,distanceIntoLeg:0,journeyEdges:[]}});
     setFleet(old=>({...old,taxis:old.taxis.map(t=>t.id===job.targetId?{...t,status:'PAUSED',recoveryPending:true,position:moving.position,path:[],edgeIds:[],speedKph:0}:t)}));
     continue;
    }
    if(job.phase==='transport'){
     setFleet(old=>({...old,taxis:old.taxis.map(t=>t.id===job.targetId?{
      ...t,position:moving.position,recoveryPending:false,path:[],edgeIds:[],leg:0,distanceIntoLeg:0,speedKph:0,
      status:job.purpose==='fuel'?'REFUELLING':job.purpose==='service'?'SERVICING':(!t.kind||t.kind==='taxi')?'PAUSED':'IDLE',
      refillDestination:job.purpose==='fuel'?job.destination:undefined,refillAtDepot:job.purpose==='fuel'?job.atDepot:undefined,
      refillUntil:undefined,serviceUntil:undefined,pauseAtHome:false,shiftParked:job.purpose==='depot'&&(!t.kind||t.kind==='taxi')
     }:t)}));
     const path=buildRoute(moving.position,depot);
     if(path)updated.push({...job,phase:'return',truck:{...moving,status:'RETURNING',pauseAtHome:true,path:path.path,edgeIds:path.edgeIds,leg:0,distanceIntoLeg:0,journeyEdges:[]}});
    }
   }
   for(const t of vehicles){
    const manual=manualRecoveryRequestsRef.current.has(t.id);
    if(updated.some(job=>job.targetId===t.id)||t.recoveryPending||(!manual&&(t.status==='PAUSED'||t.status==='REFUELLING'||t.status==='SERVICING'))||(t.deliveryUntil??0)>now)continue;
    const watch=idleWatch.current.get(t.id);
    const stalledMs=watch?now-watch.since:0;
    // A normal hotel/parking transfer must never call a heavy truck simply
    // because its route waits for a tile or worker update. Manual calls and
    // genuinely depleted fuel still work as before.
    const stranded=shouldAutomaticallyRecover(t,stalledMs);
    if(!manual&&(!stranded||meters(t.position,depot)<75))continue;
    const serviceDue=(t.vehicleCondition??100)<=(t.serviceThreshold??40)||(t.operatingKm??0)-(t.lastServiceKm??0)>=250;
    const purpose:RecoveryJob['purpose']=manual?(manualRecoveryPurposeRef.current.get(t.id)??'depot'):serviceDue?'service':energyPercent(t)<=0||t.refillDestination?'fuel':'depot';
    const pickup=buildRoute(depot,t.position);
    if(!pickup)continue;
    const parking=[...restStopsRef.current.values()].filter(p=>p.kind==='parking'||p.kind==='services'||p.kind==='rest_area')
     .sort((a,b)=>meters(t.position,a.position)-meters(t.position,b.position)).slice(0,12).map(p=>p.position);
    const fuelKind=(t.vehicleFuel??'').toLowerCase().includes('electric')?'charging':'fuel';
    const candidates=purpose==='fuel'?
     [...stationsRef.current.values()].filter(st=>st.kind===fuelKind&&st.access!=='private')
      .map(st=>({point:[st.lng,st.lat] as [number,number],atDepot:false})):
     parking.map(point=>({point,atDepot:false}));
    const options=candidates.map(c=>({...c,path:buildRoute(t.position,c.point)}))
     .filter(c=>!!c.path)
     .sort((a,b)=>a.path!.edgeIds.reduce((sum,id)=>sum+(roadLengthByIdRef.current.get(id)??100),0)-b.path!.edgeIds.reduce((sum,id)=>sum+(roadLengthByIdRef.current.get(id)??100),0));
    const destination=options[0];
    if(!destination)continue;
    const start=graph.nodes.get(nearest(graph,depot))??depot;
    const truck:Taxi={id:crypto.randomUUID(),kind:'recovery',name:'Heavy Recovery Truck',driver:'Roadside Assistance',position:start,
     status:'RETURNING',pauseAtHome:true,path:pickup.path,edgeIds:pickup.edgeIds,leg:0,distanceIntoLeg:0,fare:0,completed:0,journeyEdges:[]};
    const next:RecoveryJob={truck,targetId:t.id,phase:'pickup',destination:destination.point,purpose,atDepot:destination.atDepot};
    updated.push(next);
    manualRecoveryRequestsRef.current.delete(t.id);
    manualRecoveryPurposeRef.current.delete(t.id);
    setFleet(old=>({...old,taxis:old.taxis.map(v=>v.id===t.id?{...v,status:'PAUSED',recoveryPending:true,path:[],edgeIds:[],speedKph:0}:v)}));
   }
   recoveriesRef.current=updated;
   setRecoveries(updated);
  },1000);
  return()=>window.clearInterval(timer);
 },[company?.id,graph]);

 const [simError,setSimError]=useState('');
 const [research,setResearch]=useState<Research.ResearchState>(()=>company?Research.settle(Research.migrateToGameTime(Research.load(company.id),gameClockRef.current?.epochMs??loadGameClock(company.id).epochMs),gameClockRef.current?.epochMs??loadGameClock(company.id).epochMs):Research.empty());
 const [researchError,setResearchError]=useState('');
 useEffect(()=>{if(!company){setResearch(Research.empty());return;}const now=gameClockRef.current?.epochMs??loadGameClock(company.id).epochMs;setResearch(Research.settle(Research.migrateToGameTime(Research.load(company.id),now),now))},[company?.id]);
 useEffect(()=>{if(company)Research.save(company.id,research)},[company?.id,research]);
 useEffect(()=>{if(!company||!gameClock)return;setResearch(old=>Research.settle(old,gameClock.epochMs))},[company?.id,gameClock?.epochMs]);
 // Ferry purchases must not enqueue distant road tiles. Active vehicle journeys
 // request destination roads through the existing on-demand route prefetcher.
 const startResearch=(id:Research.ResearchId)=>{if(!company)return;try{if(id==='explorerExpansion'){const roads=Math.max(discoveredCacheRef.current?.ids.length??0,fleetSaveRef.current.exploredEdgeIds?.length??0);const roles=new Set(fleetSaveRef.current.taxis.filter(t=>t.kind==='explorer'&&t.explorerRole).map(t=>t.explorerRole));if(roads<5000||roles.size<1)throw Error('Requires 5,000 discovered roads and the universal explorer.');}const gameNow=gameClockRef.current?.epochMs;if(gameNow===undefined)throw Error('Game clock is not ready');const ready=Research.settle(research,gameNow);const cost=Research.price(id,Research.level(ready,id)+1);if(company.cash<cost)throw Error('Insufficient funds');const next=Research.start(ready,id,gameNow);const updated={...company,cash:Math.round((company.cash-cost)*100)/100};saveCompany(updated);Research.save(company.id,next);setCompany(updated);setResearch(next);setResearchError('')}catch(e){setResearchError(String(e))}};
 const cancelResearch=()=>setResearch(old=>({...old,active:undefined}));
 // Grant two additional vehicles of EVERY explorer role when level 1
 // finishes. A legacy research completion only set explorerExpansionApplied
 // without spawning anything; the separate marker grants those saves too.
 // Wait for actual purple roads so new vehicles never spawn on red segments.
 useEffect(()=>{
  if(!company||!graph||!graph.nodes.size||
     Research.level(research,'explorerExpansion')<1)return;
  const current=fleetSaveRef.current;
  if(current.explorerExpansionVehiclesGranted||!current.taxis.length)return;
  if(!EXPANSION_ROLES.every(role=>current.taxis.some(t=>
   t.kind==='explorer'&&t.explorerRole===role)))return;
  const discovered=new Set([...(discoveredCacheRef.current?.ids??[]),
   ...(current.exploredEdgeIds??[])]);
  if(!discovered.size)return;
  const hq:[number,number]=[company.headquarters.lng,company.headquarters.lat];
  let location:[number,number]|undefined;
  let best=Infinity;
  for(const [node,links] of graph.edges){
   if(!links.some(link=>discovered.has(link.id)))continue;
   const point=graph.nodes.get(node);
   if(!point)continue;
   const distance=meters(point,hq);
   if(distance<best){best=distance;location=[...point];}
  }
  if(!location)return; // A future road-tile update can retry this.
  const updated=grantExplorerInfrastructure(current,location);
  if(updated===current)return;
  const newCount=updated.taxis.length-current.taxis.length;
  const rewarded:FleetState={...updated,transactions:[
   {id:crypto.randomUUID(),time:Date.now(),
    description:`Universal Explorer Infrastructure: ${newCount} explorers granted`,amount:0},
   ...(current.transactions??[])].slice(0,100)};
  fleetSaveRef.current=rewarded;
  setFleet(rewarded);
  saveFleet(company.id,{...rewarded,exploredEdgeIds:[]});
  diagnostic('research:explorer-expansion',`granted=${newCount} total=${rewarded.taxis.length}`);
 },[company?.id,graph,research,fleet.taxis.length]);

 useEffect(()=>{
  let active=true;
  networkRef.current?.dispose();networkRef.current=null;
  graphRef.current=null;setGraph(null);setRoadGraphVersion(0);setRoadPackages(0);setSimError('');
  if(!company)return()=>{active=false};

  const run=async()=>{
   const roadStartupAt=performance.now();
   diagnostic('roads:startup',`begin company=${company.id}`);
   try{
    // Road length cache follows streamed tiles, not just the initial map.
    roadLengthByIdRef.current.clear();
    const manager=new RoadNetworkManager((next,count)=>{
      if(active){
       // Road graph updates are background work; keep user input and vehicle UI responsive.
       // Do not clone the graph: the road manager already publishes a snapshot.
       const queuedAt=performance.now();
       graphEnqueueRef.current={nodes:next.nodeKeys.length,at:queuedAt};
       const firstGraph=graphRef.current===null;
       graphRef.current=next;
       startTransition(()=>{
        // React receives the graph only once. Subsequent road additions mutate
        // the same graph instance; a lightweight revision refreshes map geometry.
        if(firstGraph)setGraph(next);
        else setRoadGraphVersion(v=>v+1);
        setRoadPackages(count);
       });
       diagnostic('roads:react-enqueue',`nodes=${next.nodeKeys.length} ms=${Math.round(performance.now()-queuedAt)}`);
      }
    },message=>{if(active)console.warn('[TravelEmpire road tiles]',message)},async roads=>{
       if(!active)return;
       // A later road tile must contribute actual metres to new discoveries.
       for(const road of roads)if(road.length>0)roadLengthByIdRef.current.set(road.id,road.length);
       const worker=dispatchWorkerRef.current;
       if(!worker)return;
       // Serialize dispatch-worker transfers: one 4000-road batch in flight.
       // The previous unbounded postMessage loop could queue 100+ copies.
       const syncStarted=performance.now();
       const revision=graphRevisionRef.current;
       let batches=0;
       for(let i=0;i<roads.length;i+=4000){
        if(!active||dispatchWorkerRef.current!==worker||revision!==graphRevisionRef.current)break;
        workerReadyRef.current=false;
        roadSyncPendingRef.current++;
        await new Promise<void>(resolve=>{
         roadSyncAcksRef.current.push(resolve);
         try{
          worker.postMessage({type:'addRoads',revision,roads:roads.slice(i,i+4000)});
         }catch(error){
          roadSyncPendingRef.current=Math.max(0,roadSyncPendingRef.current-1);
          roadSyncAcksRef.current.pop();
          resolve();
          diagnostic('dispatch:sync-error',String(error));
         }
        });
        batches++;
       }
       diagnostic('dispatch:enqueue',`segments=${roads.length} ackedBatches=${batches} ms=${Math.round(performance.now()-syncStarted)} pending=${roadSyncPendingRef.current}`);
     });
    networkRef.current=manager;
    diagnostic('roads:startup',`initialize-start elapsedMs=${Math.round(performance.now()-roadStartupAt)}`);
    await manager.initialize([company.headquarters.lng,company.headquarters.lat]);
    // Remote depots and explorers must get their ACTUAL road tile before
    // optional HQ/viewport expansion consumes Safari's small memory budget.
    manager.considerEssentialLocations([
     ...(company.depots??[]).map(d=>[d.lng,d.lat] as [number,number]),
     ...taxisRef.current.filter(t=>t.kind==='explorer'&&!t.ferryTrip)
      .map(t=>t.position),
    ]);
    diagnostic('roads:startup',`initialize-complete elapsedMs=${Math.round(performance.now()-roadStartupAt)}`);

   }catch(error){
    diagnostic('roads:startup',`initialize-failed elapsedMs=${Math.round(performance.now()-roadStartupAt)} error=${String(error)}`);
    if(!active)return;
    console.error('[TravelEmpire] Road tiles:',error);
    setSimError(`Road tiles unavailable: ${String(error)}. Falling back to preview.`);
    try{const fallback=await loadRoadGraph();if(active){graphRef.current=fallback;setGraph(fallback);}}catch(e){if(active)setSimError(String(e));}
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
  pendingRoutesRef.current.clear();pendingFuelRef.current.clear();operationalRoutesRef.current.clear();fuelPlanCacheRef.current.clear();passengerRouteWatchRef.current.clear();
  for(const ack of roadSyncAcksRef.current.splice(0))ack();dispatchWorkerRef.current=worker;workerReadyRef.current=false;dispatchBusyRef.current=false;roadSyncPendingRef.current=0;workerRoadCountRef.current=0;
  const revision=++graphRevisionRef.current;
  worker.onmessage=(event:MessageEvent<{type:string;revision:number;taxis?:Taxi[];queue?:PassengerRequest[];error?:string;roadCount?:number;assignedCount?:number;generatedMission?:boolean;discoveryEligible?:string[]}>)=>{
   const message=event.data;
   if(message.revision!==graphRevisionRef.current)return;
   if(message.type==='operationalRouteResult'){
    const result=message as typeof message & {vehicleId:string;requestId:number;purpose:'shift'|'service';path:[number,number][]|null;edgeIds:string[]|null;target:[number,number]|null;durationMs:number};
    const pending=operationalRoutesRef.current.get(result.vehicleId);
    if(!pending||pending.requestId!==result.requestId||pending.purpose!==result.purpose)return;
    const current=taxisRef.current.find(t=>t.id===result.vehicleId);
    if(!current||current.status!==pending.status||meters(current.position,pending.position)>15){operationalRoutesRef.current.delete(result.vehicleId);return;}
    operationalRoutesRef.current.set(result.vehicleId,{...pending,path:result.path,edgeIds:result.edgeIds,target:result.target,ready:true,at:Date.now()});
    if(result.durationMs>100)console.warn('[TravelEmpire] Slow operational routing',{purpose:result.purpose,durationMs:Math.round(result.durationMs)});
    return;
   }
   if(message.type==='fuelPlanResult'){
    const result=message as typeof message & {vehicleId:string;requestId:number;target:{point:[number,number];depot:boolean;roadKm:number;path:ReturnType<typeof route>}|null;durationMs:number;perf?:{nearestMs:number;targets:number}};
    const pending=pendingFuelRef.current.get(result.vehicleId);
    if(!pending||pending.requestId!==result.requestId)return;
    pendingFuelRef.current.delete(result.vehicleId);
    const current=taxisRef.current.find(t=>t.id===result.vehicleId);
    if(!current||meters(current.position,pending.position)>300)return;
    fuelPlanCacheRef.current.set(result.vehicleId,{at:Date.now(),position:pending.position,graph:pending.graph,stationCount:stationsRef.current.size,target:result.target});
    if(result.durationMs>100){diagnostic('routing:fuel-slow',`durationMs=${Math.round(result.durationMs)} vehicle=${result.vehicleId} targets=${result.perf?.targets??'unknown'} nearestMs=${Math.round(result.perf?.nearestMs??0)} roadSyncPending=${roadSyncPendingRef.current}`);console.warn('[TravelEmpire] Slow fuel routing',{durationMs:Math.round(result.durationMs),vehicleId:result.vehicleId,roadSyncPending:roadSyncPendingRef.current});}
    return;
   }
   if(message.type==='routeResult'){
    const response=message as typeof message & {requestId:number;path:[number,number][]|null;edgeIds:string[]|null;durationMs?:number;reason?:string;originNode?:string;targetNode?:string;originOffsetMeters?:number|null;targetOffsetMeters?:number|null};
    const pending=pendingRoutesRef.current.get(response.requestId);
    if(!pending)return;
    pendingRoutesRef.current.delete(response.requestId);
    const current=taxisRef.current.find(t=>t.id===pending.vehicleId);
    if(!current||current.status!==pending.status||meters(current.position,pending.position)>15)return;
    if((response.durationMs??0)>100)console.warn('[TravelEmpire] Slow worker route',{durationMs:Math.round(response.durationMs??0)});
    if(response.reason&&response.reason!=='ok')diagnostic('routing:directed-failure',
     `vehicle=${pending.vehicleId} reason=${response.reason} originNode=${response.originNode??'none'} targetNode=${response.targetNode??'none'} originOffsetM=${response.originOffsetMeters??'none'} targetOffsetM=${response.targetOffsetMeters??'none'} pendingTiles=${networkRef.current?.queuedCount??'unknown'}`);
    pending.onResult(response.path,response.edgeIds,response.reason);
    return;
   }
   if(message.type==='ready'){workerReadyRef.current=roadSyncPendingRef.current===0&&workerRoadCountRef.current>0;return;}
   if(message.type==='roadsAdded'){roadSyncPendingRef.current=Math.max(0,roadSyncPendingRef.current-1);workerRoadCountRef.current=message.roadCount??workerRoadCountRef.current;workerReadyRef.current=roadSyncPendingRef.current===0&&workerRoadCountRef.current>0;roadSyncAcksRef.current.shift()?.();if(roadSyncPendingRef.current===0)diagnostic('dispatch:roads-ready',`workerRoads=${workerRoadCountRef.current}`);return;}
   dispatchBusyRef.current=false;
   if(message.type==='result'){
    const ferryPerf=(message as typeof message & {perf?:{explorationMissions?:{vehicles:Array<{id:string;ferryReady?:boolean;idleMs:number}>}}}).perf?.explorationMissions?.vehicles;
    if(ferryPerf)for(const item of ferryPerf)ferryReadinessRef.current.set(item.id,{ready:!!item.ferryReady,idleMs:item.idleMs});
    const perf=(message as typeof message & {perf?:{workerMs:number;preparationMs:number;passengerMs:number;scoutMs:number;graphNodes:number;graphRoads:number;vehicles:number;missions:number}}).perf;
    const missionPerf=(message as typeof message & {perf?:{explorationMissions?:{active:number;idlePlans:number;vehicles:Array<{id:string;role:string;status:string;missionId:number|null;remainingEdges:number;retryInMs:number;lastPlannedAt:number|null}>};scoutTimings?:Array<{vehicleId:string;role:string;ms:number;phase:string;result?:string}>}}).perf;
    if(missionPerf?.explorationMissions&&(perf?.workerMs??0)>100&&performance.now()-lastMissionPerfLogAt>12000){lastMissionPerfLogAt=performance.now();const m=missionPerf.explorationMissions;diagnostic('dispatch:missions',`active=${m.active} idlePlans=${m.idlePlans} queue=${JSON.stringify((missionPerf as typeof missionPerf & {planningQueue?:{phase:string;searches:number;queued:number;cursor:number}}).planningQueue??{})} scouts=${(missionPerf.scoutTimings??[]).map(t=>`${t.role}:${t.phase}:${t.ms}ms:${t.result??''}`).join(',')} vehicles=${JSON.stringify(m.vehicles)}`);}
    if(performance.now()-lastMajorExplorerLogAt>15000){
     const explorers=(message as typeof message & {perf?:{explorationMissions?:{vehicles:Array<{id:string;role:string;status:string;planningAttempts?:number;planningSkipReason?:string|null;singleWorkerPlanner?:string|null;majorRoadSearch?:{outcome:string;eligible:number;candidates:number;entries:number;visits:number;attempts:number}|null}>}}}).perf?.explorationMissions?.vehicles;
     if(explorers){lastMajorExplorerLogAt=performance.now();diagnostic('dispatch:explorer-routing',JSON.stringify(explorers.map(v=>({id:v.id,role:v.role,status:v.status,planningAttempts:v.planningAttempts??0,skip:v.planningSkipReason??null,singleWorker:v.singleWorkerPlanner??null,routing:v.majorRoadSearch??null}))));}
     const pool=(message as typeof message & {perf?:{plannerPool?:{workers:number;busy:number;pending:number;results:number;vehicles:Array<{id:string;role:string;result:string;ms:number;queueMs:number;waiting:boolean}>}}}).perf?.plannerPool;
     if(pool)diagnostic('dispatch:explorer-planner-pool',
      `workers=${pool.workers} busy=${pool.busy} pending=${pool.pending} results=${pool.results} vehicles=${JSON.stringify(pool.vehicles.map(v=>({id:v.id,role:v.role,outcome:v.result,routeMs:Math.round(v.ms),queueMs:Math.round(v.queueMs),waiting:v.waiting})))}`);
    }
    const taxiPerf=(message as typeof message & {perf?:{passengerDispatch?:{allowMission:boolean;allowTaxiShift:boolean;queueLength:number;queueLimit:number;eligibleStops:number;created:number;requestGenerationFailures:number;assignments:number;routeFailures:number;completed:number;depots?:Array<{id:string;available:number;waiting:number;limit:number;localStops:number|null}>;vehicles:Array<{id:string;status:string;idleMs:number;shiftEligible:boolean;energyPercent:number}>}}}).perf?.passengerDispatch;
    if(taxiPerf){
     const idleTaxis=taxiPerf.vehicles.filter(t=>t.status==='IDLE');
     const taxiSignature=JSON.stringify({queue:taxiPerf.queueLength,created:taxiPerf.created,rejected:taxiPerf.requestGenerationFailures,assigned:taxiPerf.assignments,completed:taxiPerf.completed,failed:taxiPerf.routeFailures,depots:taxiPerf.depots?.map(d=>[d.id,d.available,d.waiting,d.localStops]),idle:idleTaxis.map(t=>t.id)});
     if(performance.now()-lastTaxiDispatchLogAt>12000&&
       (taxiSignature!==lastTaxiDispatchSignature||performance.now()-lastTaxiDispatchLogAt>30000)){
      lastTaxiDispatchSignature=taxiSignature;lastTaxiDispatchLogAt=performance.now();
      diagnostic('dispatch:taxis',`allowMission=${taxiPerf.allowMission} allowTaxiShift=${taxiPerf.allowTaxiShift} queue=${taxiPerf.queueLength}/${taxiPerf.queueLimit} eligibleStops=${taxiPerf.eligibleStops} created=${taxiPerf.created} generationFailures=${taxiPerf.requestGenerationFailures} assignments=${taxiPerf.assignments} completed=${taxiPerf.completed} routeFailures=${taxiPerf.routeFailures} depots=${JSON.stringify(taxiPerf.depots??[])} vehicles=${JSON.stringify(taxiPerf.vehicles)}`);
     }
    }
    if(perf&&perf.workerMs>150&&performance.now()-lastWorkerPerfLogAt>10000){
     lastWorkerPerfLogAt=performance.now();
     diagnostic('dispatch:worker-phases',`workerMs=${Math.round(perf.workerMs)} prepareMs=${Math.round(perf.preparationMs)} passengerMs=${Math.round(perf.passengerMs)} scoutMs=${Math.round(perf.scoutMs)} nodes=${perf.graphNodes} roads=${perf.graphRoads} vehicles=${perf.vehicles} missions=${perf.missions}`);
    }
   }
   if(dispatchStartedRef.current){
    const duration=performance.now()-dispatchStartedRef.current;dispatchStartedRef.current=0;
    if(duration>150&&(duration>1800||performance.now()-lastSlowDispatchLogAt>10000)){
     lastSlowDispatchLogAt=performance.now();
     diagnostic('dispatch:slow',`roundTripMs=${Math.round(duration)} vehicles=${taxisRef.current.length} roadSyncPending=${roadSyncPendingRef.current} workerRoads=${workerRoadCountRef.current}`);
     if(duration>1800)console.warn('[TravelEmpire] Severe dispatcher stall',{roundTripMs:Math.round(duration),vehicles:taxisRef.current.length});
    }
   }
   if(message.type==='error'){console.warn('[TravelEmpire] Dispatch worker:',message.error);setSimError('Dispatch worker: '+message.error);return;}
   if(message.type!=='result'||!message.taxis||!message.queue)return;
   if(message.generatedMission)lastMissionAt.current=Date.now();
   const byId=new Map(message.taxis.map(t=>[t.id,t]));
   setFleet(old=>({...old,taxis:old.taxis.map(t=>{
    const assigned=byId.get(t.id);
    const teleportTarget=resetVehicleTargetsRef.current.get(t.id);
    if(teleportTarget){
     if(!assigned||meters(assigned.position,teleportTarget)>15)return t;
     resetVehicleTargetsRef.current.delete(t.id);
    }
    // The main simulation owns rest travel, rest timers and wake-up.
    // A stale rest-stop ID must not override a newly planned directed
    // component-recovery route. Active rest/service journeys still belong to
    // the main simulation and are otherwise left untouched.
    if(t.kind==='explorer'&&t.restStopId&&
       !(t.status==='IDLE'&&assigned?.recoveryTransitOnly))return t;
    // Apply boundary enforcement from the worker to already-moving Explorers.
    // Keep the current simulated position instead of reverting to the worker snapshot.
    if((t.kind==='explorer')&&t.status==='EXPLORING'&&assigned&&
       (assigned.status==='IDLE'||assigned.edgeIds.length<t.edgeIds.length)){
     if(assigned.status==='IDLE'){
       // Worker road sync can temporarily lag the main map. If the current
       // road is still present locally, never stop a moving explorer merely
       // because a worker snapshot temporarily lacks that road ID.
       const activeRoadId=t.edgeIds[t.leg];
       if(!assigned.routeInvalid&&activeRoadId&&roadLengthByIdRef.current.has(activeRoadId))return t;
       return {...t,status:'IDLE',path:[],edgeIds:[],leg:0,distanceIntoLeg:0,speedKph:0};
      }
     if(assigned.edgeIds.length>t.leg&&
        assigned.edgeIds.every((id,i)=>t.edgeIds[i]===id))
      return {...t,path:assigned.path,edgeIds:assigned.edgeIds,discoveryEdgeIds:assigned.discoveryEdgeIds};
     return {...t,status:'IDLE',path:[],edgeIds:[],leg:0,distanceIntoLeg:0,speedKph:0};
    }
    // Preserve live position, speed and leg when the worker extends a moving
    // Explorer route. Never rewind movement to an older worker snapshot.
    if(t.kind==='explorer'&&t.status==='EXPLORING'&&assigned?.status==='EXPLORING'&&
       assigned.edgeIds.length>t.edgeIds.length&&
       t.edgeIds.every((id,i)=>assigned.edgeIds[i]===id)){
     return {...t,path:assigned.path,edgeIds:assigned.edgeIds,discoveryEdgeIds:assigned.discoveryEdgeIds,scoutingRuns:assigned.scoutingRuns,
      explorationSection:assigned.explorationSection,explorationSectionCompleted:assigned.explorationSectionCompleted,
      explorationSectionTotal:assigned.explorationSectionTotal};
    }
    // Worker state is authoritative for automatic Explorer parking. A stale
    // PAUSED snapshot must not survive after the worker clears that state.
    if(t.kind==='explorer'&&t.status==='PAUSED'&&!t.recoveryPending&&
       assigned?.status==='IDLE')
     return {...t,status:'IDLE',shiftParked:false,pauseAtHome:false,
      path:[],edgeIds:[],leg:0,distanceIntoLeg:0,speedKph:0};
    if(t.kind==='explorer'&&t.status==='PAUSED'&&!t.recoveryPending&&assigned?.status==='EXPLORING')
     return {...assigned,position:t.position,shiftParked:false,pauseAtHome:false};
    // Accept parking, returning, and automatic wake-up for purple Explorers.
    if(t.kind==='explorer'&&assigned&&
       ((t.status==='IDLE'&&assigned.status==='RETURNING'&&assigned.shiftParked)||
        (t.status==='IDLE'&&assigned.status==='PAUSED'&&assigned.shiftParked)||
        (t.status==='PAUSED'&&t.shiftParked&&assigned.status==='EXPLORING')))
     return {...assigned,position:t.position};
    // Never overwrite a taxi that became busy while the worker was calculating.
    if(t.kind==='explorer'&&assigned&&t.status==='EXPLORING')
     return {...t,explorationSection:assigned.explorationSection,
      explorationSectionCompleted:assigned.explorationSectionCompleted,
      explorationSectionTotal:assigned.explorationSectionTotal};
    // A worker result may arrive after an Explorer has already finished its
     // previous leg. Never reapply a mission planned from an obsolete position:
     // that would rewind the marker and trigger EXPLORING/IDLE oscillation.
     if(t.kind==='explorer'&&t.status==='IDLE'&&assigned?.status==='EXPLORING'&&
        (!assigned.path.length||meters(t.position,assigned.path[0])>15))return t;
     return t.status==='IDLE'&&!t.deliveryUntil&&assigned&&assigned.status!=='IDLE'?assigned:t;
   })}));
   const queue=message.queue.filter(q=>q.expiresAt>Date.now());
   queueRef.current=queue;
   setMissionQueue(old=>old.length===queue.length&&old.every((q,i)=>q.id===queue[i].id)?old:queue);
  };
  worker.onerror=(event)=>{dispatchBusyRef.current=false;dispatchStartedRef.current=0;workerReadyRef.current=false;diagnostic('dispatch:worker-error',String(event.message));for(const ack of roadSyncAcksRef.current.splice(0))ack();console.warn('[TravelEmpire] Dispatch worker error',event.message)};
  // iPhone Safari is memory-constrained: keep only the existing dispatcher
  // road graph. Two additional full-graph planner workers triple copies.
  const reducedMemory=/iPhone|iPad|iPod/i.test(navigator.userAgent);
  diagnostic('dispatch:memory-mode',reducedMemory?'iOS reduced-memory: planner pool disabled':'standard planner pool');
  worker.postMessage({type:'init',revision,plannerPoolEnabled:!reducedMemory});
  return()=>{pendingRoutesRef.current.clear();pendingFuelRef.current.clear();operationalRoutesRef.current.clear();worker.terminate();for(const ack of roadSyncAcksRef.current.splice(0))ack();if(dispatchWorkerRef.current===worker)dispatchWorkerRef.current=null;workerReadyRef.current=false;dispatchBusyRef.current=false;roadSyncPendingRef.current=0;workerRoadCountRef.current=0;workerRoadCountRef.current=0;};
 },[company?.id]);
 useEffect(()=>{
  if(!company||!graph)return;
  const timer=window.setInterval(()=>{
   if(!dispatchAllowed(document.visibilityState==='visible',workerReadyRef.current,
       dispatchBusyRef.current)||!dispatchWorkerRef.current)return;
   const now=Date.now();
   const taxis=taxisRef.current;
   if(!taxis.length)return;
   const revision=graphRevisionRef.current;
   const queue=queueRef.current.filter(q=>q.expiresAt>now);
   const discovered=discoveredCacheRef.current?.ids??fleetSaveRef.current.exploredEdgeIds??[];
   dispatchBusyRef.current=true;
   dispatchStartedRef.current=performance.now();
   dispatchWorkerRef.current.postMessage({type:'dispatch',revision,now,taxis,queue,discovered,
    hq:[company.headquarters.lng,company.headquarters.lat],
    depots:[{id:'main',position:[company.headquarters.lng,company.headquarters.lat] as [number,number]},
     ...(company.depots??[]).map(d=>({id:d.id,position:[d.lng,d.lat] as [number,number]}))],
    harbourTargets:harbourCandidatesRef.current.map(m=>m.point),poiTargets:harbourCandidatesRef.current.map(m=>m.point),poiMissions:harbourCandidatesRef.current,parkingTargets:[...restStopsRef.current.values()].filter(p=>p.kind==='parking').slice(0,120).map(p=>p.position),stations:[...stationsRef.current.values()].filter(s=>s.kind==='fuel'&&s.access!=='private').map(s=>[s.lng,s.lat] as [number,number]),availableTaxiIds:taxis.filter(t=>(!t.kind||t.kind==='taxi')&&t.status==='IDLE'&&!t.shiftParked&&!t.restStopId&&canAcceptPassengerJob(t,fleetSaveRef.current.drivers??[],gameClockRef.current?.epochMs??now)).map(t=>t.id),allowTaxiShift:true,allowMission:!!gameClockRef.current&&taxis.some(t=>(!t.kind||t.kind==='taxi'))&&now-lastMissionAt.current>=demandAt(now,taxis.filter(t=>(!t.kind||t.kind==='taxi')).length).intervalMs,
    // iOS suspends background tabs; avoid expensive route planning while hidden.
    allowScout:document.visibilityState==='visible'});
   // Do not suppress retries merely because a dispatch message was sent.
   // Mission/scout cooldowns are applied after the worker reports an actual result.
  },typeof navigator!=='undefined'&&isIOSWebKit(navigator.userAgent)
   ?IOS_DISPATCH_INTERVAL_MS:DESKTOP_DISPATCH_INTERVAL_MS);
  return()=>window.clearInterval(timer);
 },[company?.id,graph]);
 // Prefetch roads near active vehicles and destinations without resetting their routes.
 useEffect(()=>{
  if(!company||!graph)return;
  const check=()=>{
   const positions:[number,number][]=[
    [company.headquarters.lng,company.headquarters.lat],
    // Preload saved depot regions so a depot created on an earlier version
    // can receive its missing starter explorers after the local tiles load.
    ...(company.depots??[]).map(d=>[d.lng,d.lat] as [number,number]),
   ];
   for(const taxi of taxisRef.current){
     if(taxi.ferryTrip?.stage==='sailing')continue;
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
   // Essential direct depot/vehicle tiles are allowed within a reserved,
   // bounded memory margin even after speculative expansion is paused.
   // Do these first so island depots don't get starved by the HQ frontier.
   networkRef.current?.considerEssentialLocations([
    ...(company.depots??[]).map(d=>[d.lng,d.lat] as [number,number]),
    ...taxisRef.current.filter(t=>!t.ferryTrip&&
     (t.kind==='explorer'&&(t.status==='IDLE'||t.status==='PAUSED')||
      (!t.kind||t.kind==='taxi')&&t.status==='IDLE'))
     .map(t=>t.position),
   ]);
   networkRef.current?.consider(positions);
   // Load neighbouring road packages even when an explorer is stationary.
   // Otherwise the loaded graph ends at its current tile and the planner
   // cannot find a legal frontier in the next one. Use idle scouts first;
   // include moving explorers with short remaining routes for lookahead.
   const expansionScouts=taxisRef.current.filter(t=>
    t.kind==='explorer'&&!t.ferryTrip&&!t.deliveryUntil&&
    (t.status==='IDLE'||t.status==='EXPLORING'&&t.edgeIds.length-t.leg<=6));
   networkRef.current?.considerExplorerExpansion(expansionScouts.map(t=>t.position));
   // Preload one destination and one bounded corridor segment each scan.
   // A permanent target is never blocked merely because its road tile has not
   // been loaded yet. Advance streaming requests at most ~3 km per scan and
   // keep the existing iPhone tile queue/backpressure intact.
   const missions=harbourMissionsRef.current;
   const allCandidates=harbourCandidatesRef.current;
   const prefetchSlot=harbourPrefetchCursorRef.current++;
   // Stream alternative candidate harbour tiles as well as the assigned
   // destination. Otherwise only the unreachable assigned port is loaded,
   // and the shortest-reachable route planner has no other road endpoints.
   if(allCandidates.length){
    const alternative=allCandidates[prefetchSlot%allCandidates.length];
    if(networkRef.current&&networkRef.current.queuedCount<4)
     networkRef.current.considerHarbour(alternative.point);
   }
   if(missions.length){
    const mission=missions[prefetchSlot%missions.length];
    const explorer=taxisRef.current.find(t=>t.id===mission.vehicleId);
    if(explorer&&!explorer.ferryTrip){
     const manager=networkRef.current;
     manager?.considerHarbour(mission.point);
     const distance=meters(explorer.position,mission.point);
     const progress=Math.min(distance,harbourPrefetchProgressRef.current.get(mission.vehicleId)??0);
     const next=Math.min(distance,progress+3000);
     if(distance>0&&manager&&manager.queuedCount<4){
      const pointAt=(metersAlong:number):[number,number]=>{
       const ratio=metersAlong/distance;
       return [explorer.position[0]+(mission.point[0]-explorer.position[0])*ratio,
        explorer.position[1]+(mission.point[1]-explorer.position[1])*ratio];
      };
      // This is tile prefetch only. Vehicles STILL follow road-graph routes,
      // never this straight line or a shortcut across water.
      manager?.considerHarbour(pointAt(next));
      harbourPrefetchProgressRef.current.set(mission.vehicleId,next>=distance?0:next);
     }
    }
   }
   const manager=networkRef.current;
   if(manager)setRoadDiagnostics({queued:manager.queuedCount,edges:manager.edgeCount,workerEdges:workerRoadCountRef.current});
  };
  check();const timer=window.setInterval(check,12000);
  return()=>window.clearInterval(timer);
 },[company?.id,graph]);
 useEffect(()=>{setFleet(company?universalFleet(loadFleet(company.id)):{taxis:[],revenue:0,completed:0});queueRef.current=[];discoveredCacheRef.current=null;setMissionQueue([]);lastMissionAt.current=0},[company?.id]);
 // Restore historical discoveries from IndexedDB and merge with any progress made
 // while the database was opening. Legacy localStorage discoveries are migrated.
 useEffect(()=>{if(!company)return;const id=company.id;let cancelled=false;
  readExploration(id).then(record=>{if(cancelled||!record)return;
   setFleet(old=>{const merged=[...new Set([...(old.exploredEdgeIds??[]),...record.ids])];discoveredCacheRef.current={ids:merged,set:new Set(merged)};return {...old,exploredEdgeIds:merged};});
  }).catch(error=>console.error('[TravelEmpire] Exploration restore failed',error));
  return()=>{cancelled=true};
 },[company?.id]);
 // Migrate existing depots that never received their original five specialists.
 // Grant exactly once per depot: a stored marker prevents repeated free
 // replacement vehicles after a player sells or reassigns their explorers.
 const depotGrantKeys=(company?.depots??[]).map(d=>d.id).join('|');
 useEffect(()=>{
  if(!company||!graph||!company.depots?.length)return;
  const current=fleetSaveRef.current;
  if(company.depots.every(d=>current.depotStarterExplorerGrants?.[d.id]))return;
  const anchors=new Map<string,DepotStarterAnchor>();
  for(const depot of company.depots){
   if(current.depotStarterExplorerGrants?.[depot.id])continue;
   const near=nearest(graph,[depot.lng,depot.lat]);
   const pos=near?graph.nodes.get(near):undefined;
   if(!pos||meters(pos,[depot.lng,depot.lat])>25)continue;
   const road=(graph.edges.get(near)??[]).find(e=>e.meters>0&&!e.taxiOnly);
   if(road)anchors.set(depot.id,{position:[...pos],roadId:road.id});
  }
  const migrated=reconcileDepotStarterExplorers(current,company.depots,anchors);
  if(migrated===current)return;
  fleetSaveRef.current=migrated;
  setFleet(migrated);
  saveFleet(company.id,{...migrated,exploredEdgeIds:[]});
  const previous=new Set(current.exploredEdgeIds??[]);
  const added=(migrated.exploredEdgeIds??[]).filter(id=>!previous.has(id));
  if(added.length)
   void writeExploration(company.id,{ids:added,segments:{}}).catch(error=>
    diagnostic('depots:retroactive-seed-save-failed',String(error)));
  diagnostic('depots:starter-reconcile',
   `depots=${company.depots.length} added=${migrated.taxis.length-current.taxis.length} anchors=${anchors.size}`);
 },[company?.id,depotGrantKeys,graph,roadGraphVersion,fleet.taxis.length]);

 // Persist periodically instead of serialising the entire explored-road set every second.
 const fleetSaveRef=useRef(fleet);fleetSaveRef.current=fleet;
 // Older second-depot saves can have their five starter explorers but no
 // purple launch road after a streamed graph migration. Repair ONLY the
 // actual legal OSM road at that depot and retain all existing progress.
 useEffect(()=>{
  if(!company||!graph)return;
  const current=fleetSaveRef.current;
  if(!current.taxis.some(t=>t.kind==='explorer'))return;
  const explored=discoveredCacheRef.current?.set??new Set(current.exploredEdgeIds??[]);
  const seeds=missingDepotAccessSeeds(company,current,graph,explored);
  if(!seeds.length)return;
  const ids=[...new Set([...(current.exploredEdgeIds??[]),...seeds.map(s=>s.edgeId)])];
  const next={...current,exploredEdgeIds:ids};
  fleetSaveRef.current=next;
  discoveredCacheRef.current={ids,set:new Set(ids)};
  setFleet(next);
  // The database merge is additive. Discovery on other islands is untouched.
  void writeExploration(company.id,{ids:seeds.map(s=>s.edgeId),segments:{}})
   .catch(error=>diagnostic('depots:access-seed-save-error',String(error)));
  diagnostic('depots:access-seeded',
   seeds.map(seed=>seed.depotId+':'+seed.edgeId).join(','));
 },[company?.id,graph,roadGraphVersion,fleet.taxis.length]);
 // Persist one valuation snapshot per simulated day without affecting operating profit.
 useEffect(()=>{
  if(!company)return;
  const snapshot=()=>{
   const current=companyRef.current,clock=gameClockRef.current,old=fleetSaveRef.current;
   if(!current||!clock)return;
   const day=new Date(clock.epochMs).toISOString().slice(0,10);
   if(old.equity?.lastValuationDay===day)return;
   const next=recordValuation(old.equity,valueCompany({...current,cash:current.cash+pendingCashRef.current},old,clock.epochMs),clock.epochMs);
   const updated={...old,equity:next};
   fleetSaveRef.current=updated;setFleet(updated);
  };
  snapshot();
  const timer=window.setInterval(snapshot,15000);
  return()=>window.clearInterval(timer);
 },[company?.id]);
 // Corporate subsidiaries and acquisition loans settle on simulated day boundaries.
 // Parent cash and its accounting remain separate from subsidiary operating income.
 useEffect(()=>{
  if(!company)return;
  const settle=()=>{
   const current=companyRef.current,clock=gameClockRef.current,old=fleetSaveRef.current;
   if(!current||!clock||!old.corporate)return;
   const result=advanceCorporate(old.corporate,clock.epochMs,accountingOf(old.accounting).settings.corporateRate);
   if(result.state.lastProcessedDay===old.corporate.lastProcessedDay)return;
   pendingCashRef.current=Math.round((pendingCashRef.current+result.parentCashDelta)*100)/100;
   const entries=result.events.filter(e=>e.kind==='repayment').map(e=>bankEntry(e.description,e.parentCashDelta,'operating','repayment'));
   const updated={...old,corporate:result.state,accounting:result.interest>0?bookAccounting(old.accounting,periodMonth(clock.epochMs),0,result.interest,0,0):old.accounting,bank:entries.length?appendBankEntries(bankOf(old.bank),entries):old.bank,transactions:result.parentCashDelta!==0?[{id:crypto.randomUUID(),time:gameClockRef.current?.epochMs??Date.now(),description:'Acquisition loan repayments',amount:result.parentCashDelta},...(old.transactions??[])].slice(0,100):old.transactions};
   fleetSaveRef.current=updated;setFleet(updated);
  };
  settle();
  const timer=window.setInterval(settle,10000);
  return()=>window.clearInterval(timer);
 },[company?.id]);
 // Keep synchronous localStorage writes outside the one-second movement callback.
 // Financial deltas are accumulated and flushed together with fleet persistence.
 useEffect(()=>{if(!company)return;const id=company.id;
  const flush=()=>{const delta=pendingCashRef.current;if(delta===0)return;
   pendingCashRef.current=0;
   const current=companyRef.current;
   if(!current||current.id!==id)return;
   const updated={...current,cash:Math.round((current.cash+delta)*100)/100};
   recordFinancialAudit({gameTime:new Date(gameClockRef.current?.epochMs??Date.now()).toISOString(),kind:'cash-flush',description:'Commit pending operating cash to company balance',gross:0,operatingCost:0,bankShare:0,savings:0,other:delta,cashBefore:current.cash,cashAfter:updated.cash,pendingBefore:delta,pendingAfter:0});
   companyRef.current=updated;setCompany(updated);const started=performance.now();saveCompany(updated);if(performanceMonitorEnabled())recordActivity('save:company',performance.now()-started);
  };
  const timer=window.setInterval(flush,5000);
  window.addEventListener('pagehide',flush);
  return()=>{window.clearInterval(timer);window.removeEventListener('pagehide',flush);flush()};
 },[company?.id]);
 // Persist discoveries promptly rather than waiting for a five-second fleet snapshot.
 // IndexedDB merges the IDs transactionally with geometry written by WorldMap.
 useEffect(()=>{if(!company)return;const id=company.id;let busy=false;let pending=false;
  let lastSavedIds:readonly string[]|null=null;
  const unchanged=(ids:readonly string[])=>lastSavedIds!==null&&ids.length===lastSavedIds.length&&ids.every((value,index)=>value===lastSavedIds![index]);
  const saveExploration=async()=>{if(busy){pending=true;return;}busy=true;
   try{do{pending=false;
    const prepareStarted=performance.now();
    const ids=fleetSaveRef.current.exploredEdgeIds??[];
    const skip=unchanged(ids);
    if(performanceMonitorEnabled())recordActivity('save:exploration-prepare',performance.now()-prepareStarted);
    if(!skip&&ids.length){
     // Snapshot IDs before awaiting IndexedDB; never mark unsaved changes as persisted.
     const snapshot=ids.slice();
     const started=performance.now();
     await writeExploration(id,{ids:snapshot,segments:{}});
     lastSavedIds=snapshot;
     if(performanceMonitorEnabled())recordActivity('save:exploration-await',performance.now()-started);
    }
   }while(pending)}catch(error){console.error('[TravelEmpire] Exploration save failed',error)}finally{busy=false;}
  };
  // Mobile Safari can suspend the page without pagehide; checkpoint more often.
  const onVisibilityChange=()=>{if(document.visibilityState==='hidden')void saveExploration();};
  const timer=window.setInterval(saveExploration,2000);
  window.addEventListener('pagehide',saveExploration);
  document.addEventListener('visibilitychange',onVisibilityChange);
  return()=>{window.clearInterval(timer);window.removeEventListener('pagehide',saveExploration);document.removeEventListener('visibilitychange',onVisibilityChange);void saveExploration()};
 },[company?.id]);
 useEffect(()=>{if(!company)return;const id=company.id;const save=()=>{try{const started=performance.now();saveFleet(id,{...fleetSaveRef.current,exploredEdgeIds:[]});if(performanceMonitorEnabled())recordActivity('save:fleet',performance.now()-started)}catch(error){console.error('[TravelEmpire] Fleet save failed',error)}};
  const timer=window.setInterval(save,5000);
  window.addEventListener('pagehide',save);
  return()=>{window.clearInterval(timer);window.removeEventListener('pagehide',save);save()};
 },[company?.id]);
 useEffect(()=>{
  if(!company||!graph||!fleet.taxis.length)return;
  // No offline catch-up: freeze movement and finances while Safari is hidden.
  let previousTick=performance.now();
  const resetTick=()=>{previousTick=performance.now();};
  document.addEventListener('visibilitychange',resetTick);
  window.addEventListener('pageshow',resetTick);
  const timer=window.setInterval(()=>{
   const clock=performance.now();
   if(document.visibilityState!=='visible'){previousTick=clock;return;}
   const elapsedSeconds=Math.min(2,Math.max(0,(clock-previousTick)/1000));
   previousTick=clock;
   if(elapsedSeconds<=0)return;
   const now=Date.now();
   setFleet(old=>{
    const tickStarted=performance.now();
    const savedIds=old.exploredEdgeIds??[];
    const cache=discoveredCacheRef.current;
    const discovered=cache&&cache.ids===savedIds?cache.set:new Set<string>(savedIds);
    const initialDiscoveryCount=discovered.size;
    const canDepartPurple=(vehicle:Taxi)=>{
     const node=nearest(graph,vehicle.position);
     return !!node&&(graph.edges.get(node)??[]).some(edge=>discovered.has(edge.id));
    };
    
    
    let revenue=0,completed=0,fuelExpense=0,maintenanceExpense=0,serviceExpense=0,explorationExpense=0,distanceKm=0,driverWages=0,insuranceExpense=0;
    const driversByName=new Map((old.drivers??[]).map(d=>[d.name.toLowerCase(),d]));
    const gameNow=gameClockRef.current?.epochMs??now;
    const tickDay=new Date(gameNow).toISOString().slice(0,10);
    const assignedByDepot=new Map<string,number>();
    for(const vehicle of old.taxis){const id=vehicle.depotId??'main';assignedByDepot.set(id,(assignedByDepot.get(id)??0)+1);}

    const transactions:FinancialTransaction[]=[];
    const paidPassengerJobs=new Set(old.paidPassengerJobIds??[]);
    const driverUpdates=new Map<string,{trips:number;km:number;revenue:number;wages:number}>();
    let slowestVehicleMs=0,slowestVehicle='—',routingMs=0,integratorMs=0,discoveryMs=0;
    const depotUpgradesById=new Map<string,ReturnType<typeof upgradesFor>>();
    const depotLevelsFor=(id:string)=>{let value=depotUpgradesById.get(id);if(!value){value=upgradesFor(old,id);depotUpgradesById.set(id,value);}return value;};
    const taxis=old.taxis.map(t=>{
     const vehicleStarted=performance.now();
     try{
     const delivered=t.deliveryUntil&&now>=t.deliveryUntil?{...t,deliveryUntil:undefined,deliveryStartedAt:undefined,deliveryPath:undefined}:t;
     if(delivered.deliveryUntil)return delivered;
     // A booked ferry ticket is not permission to drive into the sea.
     // Explore ONLY on legal motor roads to the terminal; stay parked there
     // until a matching scheduled vessel departs from this side of the route.
     if(delivered.ferryTrip){
      const crossing=delivered.ferryTrip;
      if(crossing.stage==='boarding'){
       const approach=delivered.path.length>=2?tickTaxi(delivered,graph,elapsedSeconds).taxi:delivered;
       if(approach.status==='PAUSED'||approach.path.length<2||
          approach.leg>=Math.max(0,approach.path.length-1)){
        const dock=crossing.boarding??approach.position;
        const serviceStart=crossing.serviceStartGameMs??PUBLIC_PASSENGER_FERRY_EPOCH_MS;
        const slot=nextPassengerDeparture(serviceStart,
         crossing.durationGameMs/60000,gameNow,crossing.fromInitialPort??true);
        return {...approach,status:'PAUSED' as const,position:dock,
         path:[],edgeIds:[],leg:0,distanceIntoLeg:0,speedKph:0,pauseAtHome:false,
         ferryTrip:{...crossing,stage:'waiting' as const,
          departureGameMs:slot.departureGameMs}};
       }
       return approach;
      }
      if(crossing.stage==='waiting'){
       const dock=crossing.boarding??delivered.position;
       const serviceStart=crossing.serviceStartGameMs??PUBLIC_PASSENGER_FERRY_EPOCH_MS;
       const departure=crossing.departureGameMs??nextPassengerDeparture(
        serviceStart,crossing.durationGameMs/60000,gameNow,
        crossing.fromInitialPort??true).departureGameMs;
       if(!mayBoardPassengerFerry(departure,gameNow)){
        // If Safari was suspended past departure, do not teleport onto a
        // vessel already kilometres away; book the next correct-direction
        // sailing and keep the vehicle parked on the dock.
        const next=gameNow>departure?nextPassengerDeparture(
         serviceStart,crossing.durationGameMs/60000,gameNow,
         crossing.fromInitialPort??true).departureGameMs:departure;
        return {...delivered,status:'PAUSED' as const,position:dock,
         path:[],edgeIds:[],leg:0,distanceIntoLeg:0,speedKph:0,
         ferryTrip:{...crossing,departureGameMs:next}};
       }
       // A normal 1 s real-time physics tick advances 24 game seconds.
       // Board only at the reserved departure (no independent sea movement).
       const sailing={...crossing,stage:'sailing' as const,
        startedGameMs:departure,departureGameMs:departure};
       return {...delivered,status:'PAUSED' as const,position:dock,
        path:[],edgeIds:[],leg:0,distanceIntoLeg:0,speedKph:0,
        ferryTrip:sailing};
      }
      // Legacy mid-sea voyages finish safely on the new release; on-screen
      // car markers are hidden for ALL sailing vehicles.
      const progress=Math.max(0,(gameNow-(crossing.startedGameMs??gameNow))/crossing.durationGameMs);
      if(progress>=1){
       if(crossing.seedRoadId)discovered.add(crossing.seedRoadId);
       return {...delivered,status:'IDLE' as const,position:crossing.destination,
        ferryTrip:undefined,ferryVisitedPorts:[...(delivered.ferryVisitedPorts??[]),crossing.fromPortId,crossing.toPortId].slice(-40),
        path:[],edgeIds:[],leg:0,distanceIntoLeg:0,speedKph:0,shiftParked:false,pauseAtHome:false,journeyEdges:[]};
      }
      return {...delivered,status:'PAUSED' as const,position:ferryPosition(crossing.geometry,progress),
       speedKph:0,shiftParked:false,pauseAtHome:false};
     }
     const passengerTaxi=!delivered.kind||delivered.kind==='taxi';
     if(passengerTaxi){
      const schedule=driverSchedule(delivered,old.drivers??[],gameNow);
      const canWork=canAcceptPassengerJob(delivered,old.drivers??[],gameNow);
      // Passenger trips are never interrupted. Once a taxi becomes IDLE,
      // drive it to a real rest facility instead of spawning Zzz on the road.
      // Old saves may contain a roadside roster pause with no rest stop:
      // clear those and find a proper destination.
      // Legacy saves may retain a roadside PAUSED flag from the pre-roster
      // implementation, without any facility destination to validate.
      if(delivered.status==='PAUSED'&&delivered.shiftParked&&
         !delivered.scheduledShiftParked&&!delivered.recoveryPending&&
         !delivered.restStopPosition){
       return {...delivered,status:'IDLE' as const,shiftParked:false,
        pauseAtHome:false,restStopId:undefined,restStopName:undefined,
        restUntilGameMs:undefined};
      }
      if(delivered.scheduledShiftParked&&delivered.status==='PAUSED'){
       const parkedAtActualStop=!!delivered.restStopId&&!!delivered.restStopPosition&&
        meters(delivered.position,delivered.restStopPosition)<=180;
       if(!canWork&&parkedAtActualStop)return delivered;
       // Repair older saves that incorrectly parked a taxi on an arbitrary
       // road or have no verified rest-location metadata.
       return {...delivered,status:'IDLE' as const,shiftParked:false,
        scheduledShiftParked:false,pauseAtHome:false,restStopId:undefined,
        restStopName:undefined,restStopPosition:undefined,restUntilGameMs:undefined};
      }
      if(delivered.scheduledShiftParked&&delivered.status==='RETURNING'){
       // Off-duty taxis MUST still drive to the assigned rest facility.
       // Never return early here: the movement integrator below advances
       // RETURNING along its route, even outside a rostered shift.
       if(canWork){
        // Driver is back on duty: cancel the unfinished rest transfer.
        return {...delivered,status:'IDLE' as const,shiftParked:false,
         scheduledShiftParked:false,pauseAtHome:false,path:[],edgeIds:[],
         leg:0,distanceIntoLeg:0,speedKph:0,restStopId:undefined,
         restStopName:undefined,restStopPosition:undefined};
       }
       // Do not leave a corrupt legacy save stuck in RETURNING forever.
       // The IDLE branch below will request a fresh route on the next tick.
       if(delivered.path.length<2||delivered.edgeIds.length===0||
          delivered.leg>=delivered.edgeIds.length){
        return {...delivered,status:'IDLE' as const,shiftParked:false,
         scheduledShiftParked:false,pauseAtHome:false,path:[],edgeIds:[],
         leg:0,distanceIntoLeg:0,speedKph:0,restStopId:undefined,
         restStopName:undefined,restStopPosition:undefined};
       }
       // Valid off-duty journey: fall through to tickTaxi for movement.
      }
      if(delivered.status==='IDLE'&&!canWork){
       const overnight=!schedule.onDuty;
       const companyNow=companyRef.current;
       if(!companyNow)return delivered;
       const stops=shiftRestTargets(delivered,[...restStopsRef.current.values()],
        companyNow,overnight);
       const cached=operationalRoutesRef.current.get(delivered.id);
       if(cached?.purpose==='shift'&&cached.graph===graph&&
          cached.status===delivered.status&&meters(cached.position,delivered.position)<15){
        if(cached.ready){
         operationalRoutesRef.current.delete(delivered.id);
         if(cached.path&&cached.edgeIds){
          const last=cached.path.at(-1)??delivered.position;
          // Use the exact POI selected by the worker's directed-road search.
          // Never infer a hotel from a nearby (possibly unrelated) road node.
          const destination=cached.target?stops.find(s=>
           meters(s.position,cached.target!)<1):undefined;
          if(destination&&meters(last,destination.position)<=180){
           const atStop=cached.path.length<2&&isAtShiftRestStop(delivered,destination,180);
           const extra={scheduledShiftParked:true,shiftParked:true,
            restStopId:destination.id,restStopName:destination.name,
            restStopPosition:destination.position,
            restUntilGameMs:undefined};
           if(atStop)return {...delivered,...extra,status:'PAUSED' as const,
            pauseAtHome:false,path:[],edgeIds:[],speedKph:0};
           if(cached.path.length>=2)return {...delivered,...extra,
            status:'RETURNING' as const,pauseAtHome:true,path:cached.path,
            edgeIds:cached.edgeIds,leg:0,distanceIntoLeg:0,speedKph:0,
            journeyEdges:[]};
          }
         }
        }else if(now-cached.at<12000)return delivered;
       }
       if(cached&&!cached.ready&&now-cached.at<12000)return delivered;
       // Do not spam route requests on iPhone when no stop is reachable yet.
       if(now-(shiftRestRetryRef.current.get(delivered.id)??0)<8000)return delivered;
       const worker=dispatchWorkerRef.current;
       if(worker&&workerReadyRef.current&&stops.length){
        shiftRestRetryRef.current.set(delivered.id,now);
        const requestId=++routeSequenceRef.current;
        operationalRoutesRef.current.set(delivered.id,{requestId,purpose:'shift',
         position:[...delivered.position],status:delivered.status,at:now,
         graph,path:null,edgeIds:null,ready:false});
        worker.postMessage({type:'operationalRoute',revision:graphRevisionRef.current,
         requestId,vehicleId:delivered.id,purpose:'shift',from:delivered.position,allowTaxiOnly:delivered.kind!=='explorer'&&delivered.kind!=='surveyor'&&delivered.kind!=='recovery',
         targets:stops.map(p=>p.position)});
       }
       // IDLE means waiting for a route, not sleeping. Dispatcher eligibility
       // still excludes taxis outside their rostered on-duty window.
       return delivered;
      }
     }
      if(passengerTaxi||delivered.kind==='explorer'){
       const drivingMs=delivered.drivingSinceRestGameMs??0;
       const hotelDrivingMs=delivered.drivingSinceHotelGameMs??0;
       if(delivered.status==='PAUSED'&&delivered.shiftParked){
        const until=delivered.restUntilGameMs??(gameNow+((delivered.restStopId?.startsWith('hotel:')||delivered.restStopId?.startsWith('overnight:'))?9*3600000:30*60000));
        if(gameNow<until)return {...delivered,restUntilGameMs:until};
        return {...delivered,status:'IDLE' as const,shiftParked:false,pauseAtHome:false,restUntilGameMs:undefined,drivingSinceRestGameMs:0,drivingSinceHotelGameMs:(delivered.restStopId?.startsWith('hotel:')||delivered.restStopId?.startsWith('overnight:'))?0:(delivered.drivingSinceHotelGameMs??0),restStopId:undefined,restStopName:undefined,restStopPosition:undefined};
       }
       // Passenger taxis use the roster's 12-hour shift and 30-minute
       // scheduled break, not an independent one-hour-driving rest timer.
       if(delivered.kind==='explorer'&&delivered.status==='IDLE'&&
         (drivingMs>=4*3600000||hotelDrivingMs>=9*3600000)&&!delivered.refillRequested){
        if(delivered.kind==='explorer'&&!canDepartPurple(delivered))return delivered;
        const overnight=hotelDrivingMs>=9*3600000;
        const stops=nearbyExplorerRestStops(delivered.position,
         [...restStopsRef.current.values()],overnight);
        if(stops.length){
         const key=delivered.id;
         const cached=operationalRoutesRef.current.get(key);
         if(cached?.purpose==='shift'&&cached.graph===graph&&cached.status===delivered.status&&meters(cached.position,delivered.position)<15){
          if(cached.ready){
           if(cached.path&&cached.edgeIds&&
              reasonableExplorerRestRoute(cached.path,overnight)){
            operationalRoutesRef.current.delete(key);
            const last=cached.path[cached.path.length-1];
            const destination=[...stops].sort((x,y)=>meters(x.position,last)-meters(y.position,last))[0];
            if(destination){
             const hotel=destination.kind==='hotel';
             const extra={shiftParked:true,restUntilGameMs:undefined,
              restStopId:(hotel?'hotel:':overnight?'overnight:parking:':'parking:')+destination.id,
              restStopName:destination.name};
             if(cached.path.length<2)return {...delivered,...extra,status:'PAUSED' as const,
              pauseAtHome:false,path:[],edgeIds:[],speedKph:0};
             return {...delivered,...extra,status:'RETURNING' as const,
              pauseAtHome:true,path:cached.path,edgeIds:cached.edgeIds,leg:0,
              distanceIntoLeg:0,speedKph:0,journeyEdges:[]};
            }
           }
           // The route is missing or too long. Try again later, not every tick.
           if(now-cached.at<30000)return delivered;
           operationalRoutesRef.current.delete(key);
          }else if(now-cached.at<12000)return delivered;
         }
         const worker=dispatchWorkerRef.current;
         if(worker&&workerReadyRef.current){
          const requestId=++routeSequenceRef.current;
          operationalRoutesRef.current.set(key,{requestId,purpose:'shift',position:[...delivered.position],status:delivered.status,at:now,graph,path:null,edgeIds:null,ready:false});
          worker.postMessage({type:'operationalRoute',revision:graphRevisionRef.current,requestId,vehicleId:key,purpose:'shift',from:delivered.position,allowTaxiOnly:delivered.kind!=='explorer'&&delivered.kind!=='surveyor'&&delivered.kind!=='recovery',targets:stops.map(p=>p.position)});
         }
        }
        return delivered;
       }
      }
     // Automatic scheduled service: vehicles stop accepting work at 40% condition.
     // Service is billed on completion; insufficient cash postpones completion.
     if(delivered.status==='SERVICING'){
      const until=delivered.serviceUntil??now+120000;
      if(now<until)return {...delivered,serviceUntil:until};
      const cost=150*(1-0.10*Math.min(3,depotLevelsFor(t.depotId??'main').workshop??0));
      if((companyRef.current?.cash??0)+pendingCashRef.current<cost)return {...delivered,serviceUntil:now+60000};
      pendingCashRef.current-=cost;serviceExpense+=cost;
      transactions.push({id:crypto.randomUUID(),time:now,taxiId:t.id,description:`${t.name} · automatic scheduled service`,amount:-cost});
      return {...delivered,maintenanceExpense:(t.maintenanceExpense??0)+cost,status:'IDLE' as const,serviceUntil:undefined,vehicleCondition:Math.min(100,(delivered.vehicleCondition??100)+40),serviceCount:(delivered.serviceCount??0)+1,lastServiceKm:delivered.operatingKm??0};
     }
     // All vehicle types travel to the main headquarters workshop before service.
     // Do not teleport to the workshop or service on the roadside if routing fails.
     const serviceDue=(delivered.vehicleCondition??100)<=(delivered.serviceThreshold??40)
      ||(delivered.operatingKm??0)-(delivered.lastServiceKm??0)>=250;
     if(delivered.status==='IDLE'&&serviceDue&&energyPercent(delivered)>10&&!delivered.refillRequested){
      if(delivered.kind==='explorer'&&!canDepartPurple(delivered))return delivered;
      const nearby=[...restStopsRef.current.values()].filter(p=>p.kind==='parking'||p.kind==='services'||p.kind==='rest_area').sort((a,b)=>meters(a.position,delivered.position)-meters(b.position,delivered.position)).slice(0,8);
      if(!nearby.length)return delivered;
      const home:[number,number]=nearby[0].position;
      const key=delivered.id;
      const cached=operationalRoutesRef.current.get(key);
      if(cached?.purpose==='service'&&cached.graph===graph&&cached.status===delivered.status&&meters(cached.position,delivered.position)<15){
       if(cached.ready){
        if(cached.path&&cached.edgeIds){
         operationalRoutesRef.current.delete(key);
         if(cached.path.length<2)return {...delivered,status:'SERVICING' as const,serviceUntil:now+120000,path:[],edgeIds:[],speedKph:0,serviceDestination:undefined};
         return {...delivered,status:'RETURNING' as const,serviceDestination:home,refillDestination:undefined,pauseAtHome:false,
          path:cached.path,edgeIds:cached.edgeIds,leg:0,distanceIntoLeg:0,speedKph:0,journeyEdges:[]};
        }
        if(now-cached.at<10000)return delivered;
       }else if(now-cached.at<12000)return delivered;
      }
      const worker=dispatchWorkerRef.current;
      if(worker&&workerReadyRef.current){
       const requestId=++routeSequenceRef.current;
       operationalRoutesRef.current.set(key,{requestId,purpose:'service',position:[...delivered.position],status:delivered.status,at:now,graph,path:null,edgeIds:null,ready:false});
       worker.postMessage({type:'operationalRoute',revision:graphRevisionRef.current,requestId,vehicleId:key,purpose:'service',from:delivered.position,allowTaxiOnly:delivered.kind!=='explorer'&&delivered.kind!=='surveyor'&&delivered.kind!=='recovery',targets:nearby.map(p=>p.position)});
      }
      return delivered;
     }
     if(delivered.status==='REFUELLING'){
      const spec=energySpec(delivered);
      // Petrol refuelling takes 20 seconds at a station or depot.
       const until=delivered.refillUntil??(now+20000);
      if(now<until)return {...delivered,refillUntil:until};
      const quantity=Math.max(0,spec.capacity-energyRemaining(delivered));
      const depotLevels=upgradesFor(old,t.depotId??'main');
      const discount=spec.unit==='L'?0.08*(depotLevels.fuel??0):0.12*(depotLevels.charging??0);
      const cost=quantity*spec.pricePerUnit*((old.upgrades??[]).includes('fuel')?0.95:1)*(1-discount);
      if((companyRef.current?.cash??0)+pendingCashRef.current<cost)return {...delivered,refillUntil:now+60000};
      pendingCashRef.current-=cost;fuelExpense+=cost;
      transactions.push({id:crypto.randomUUID(),time:now,taxiId:t.id,description:`${t.name} · automatic ${spec.unit==='L'?'refuel':'charge'} (${quantity.toFixed(1)} ${spec.unit})`,amount:-cost});
      return {...delivered,status:'IDLE' as const,energyRemaining:spec.capacity,energyPurchased:(t.energyPurchased??0)+quantity,
       fuelExpense:(t.fuelExpense??0)+cost,refillDestination:undefined,refillAtDepot:undefined,refillUntil:undefined,refillRequested:false};
     }

     // Stalled passenger jobs are replanned on the existing routing worker.
     // No geometrical shortcuts: directed OSM edges (and discovered passenger
     // roads for drop-off legs) are always authoritative.
     if(passengerTaxi&&(delivered.status==='TO_PICKUP'||delivered.status==='TO_DROPOFF')){
      const status=delivered.status;
      const job=delivered.activeJobId??'legacy:'+String(delivered.pickup)+':'+String(delivered.dropoff);
      const previous=passengerRouteWatchRef.current.get(delivered.id);
      const fresh=!previous||previous.job!==job||previous.status!==status;
      const watch=fresh?
       {job,status,leg:delivered.leg,distanceIntoLeg:delivered.distanceIntoLeg,
        lastProgressAt:now,lastAttemptAt:0,pending:false}:previous!;
      const issue=passengerRouteIssue(delivered);
      if(!fresh&&passengerRouteAdvanced(watch,delivered)){
       watch.lastProgressAt=now;
       watch.pending=false;
      }
      watch.leg=delivered.leg;
      watch.distanceIntoLeg=delivered.distanceIntoLeg;
      passengerRouteWatchRef.current.set(delivered.id,watch);
      const targetPosition=status==='TO_PICKUP'?delivered.pickup:delivered.dropoff;
      const alreadyAtTarget=!!targetPosition&&meters(delivered.position,targetPosition)<=12;
      const stalled=now-watch.lastProgressAt>12000;
      // A route request lost during a worker reset must not block recovery forever.
      if(watch.pending&&now-watch.lastAttemptAt>18000)watch.pending=false;
      if(((issue&&!alreadyAtTarget)||stalled)&&now-watch.lastAttemptAt>=15000&&!watch.pending){
       const target=status==='TO_PICKUP'?delivered.pickup:delivered.dropoff;
       const worker=dispatchWorkerRef.current;
       if(target&&worker&&workerReadyRef.current){
        const currentEdge=delivered.edgeIds[delivered.leg];
        const segmentStart=delivered.path[delivered.leg];
        const segmentEnd=delivered.path[delivered.leg+1];
        if(!currentEdge||!segmentStart||!segmentEnd){
         // Without the real current OSM edge ID, a nearest-node recovery
         // could switch the taxi from an underpass onto an overpass.
         watch.lastAttemptAt=now;
         diagnostic('taxi:route-anchor-unavailable',
          `taxi=${delivered.name} id=${delivered.id} reason=missing-active-road edge=${currentEdge??'none'}`);
         networkRef.current?.consider([delivered.position,target]);
         return delivered;
        }
        watch.lastAttemptAt=now;
        watch.pending=true;
        const requestId=++routeSequenceRef.current;
        const from:[number,number]=[...delivered.position];
        diagnostic('taxi:route-recovery-request',
         `taxi=${delivered.name} id=${delivered.id} job=${job} status=${status} reason=${issue??'stalled'} leg=${delivered.leg} edge=${delivered.edgeIds[delivered.leg]??'none'} from=${from.join(',')} target=${target.join(',')}`);
        pendingRoutesRef.current.set(requestId,{
         vehicleId:delivered.id,position:from,status,
         onResult:(path,edgeIds,routeReason)=>{
          watch.pending=false;
          const valid=!!path&&!!edgeIds&&path.length>1&&edgeIds.length===path.length-1&&
           meters(path[0],from)<=15&&meters(path[path.length-1],target)<=100;
          diagnostic(valid?'taxi:route-recovered':'taxi:route-recovery-unavailable',
           `taxi=${delivered.name} id=${delivered.id} job=${job} status=${status} reason=${routeReason??issue??'stalled'} ${valid?`newEdges=${edgeIds?.length}`:'no connected route (or unsafe snap)'}`);
          if(!valid){
           networkRef.current?.consider([from,target]);
           return;
          }
          setFleet(latest=>({...latest,taxis:latest.taxis.map(vehicle=>
           vehicle.id===delivered.id&&vehicle.status===status&&
           (vehicle.activeJobId??'legacy:'+String(vehicle.pickup)+':'+String(vehicle.dropoff))===job&&
           meters(vehicle.position,from)<=15
            ?{...vehicle,path:path!,edgeIds:edgeIds!,leg:0,distanceIntoLeg:0,speedKph:0,routeInvalid:false}
            :vehicle
          )}));
          watch.lastProgressAt=Date.now();
         }
        });
        worker.postMessage({type:'routeRequest',revision:graphRevisionRef.current,
         requestId,from,to:target,discoveredOnly:status==='TO_DROPOFF',allowTaxiOnly:true,
         activeRoad:{edgeId:currentEdge,start:segmentStart,end:segmentEnd}});
       }
      }
      // Do not silently end an active fare because its saved path is corrupt.
      if(issue&&!alreadyAtTarget)return delivered;
     }else passengerRouteWatchRef.current.delete(delivered.id);
     const routeStarted=performance.now();
     // Refuel according to the shortest reachable road route, not a fixed tank percentage.
     // Cache routing for 10 seconds to avoid expensive pathfinding on every simulation tick.
     const remainingKm=energyRangeKm(delivered);
     const stationCount=stationsRef.current.size;
     const cached=fuelPlanCacheRef.current.get(delivered.id);
     const planFresh=cached&&now-cached.at<10000&&cached.graph===graph&&cached.stationCount===stationCount&&meters(cached.position,delivered.position)<300;
     let fuelTarget=planFresh?cached.target:null;
     if(!planFresh&&graph){
      const pending=pendingFuelRef.current.get(delivered.id);
      const worker=dispatchWorkerRef.current;
      if(worker&&workerReadyRef.current&&(!pending||pending.graph!==graph||now-pending.at>12000||meters(pending.position,delivered.position)>300)){
       const candidates=[...stationsRef.current.values()]
        .filter(st=>st.kind===((delivered.vehicleFuel??'').toLowerCase().includes('electric')?'charging':'fuel')&&st.access!=='private'&&st.access!=='no')
        .sort((x,y)=>meters(delivered.position,[x.lng,x.lat])-meters(delivered.position,[y.lng,y.lat])).slice(0,12);
       const targets=candidates.map(st=>({point:[st.lng,st.lat] as [number,number],depot:false}));
       const requestId=++routeSequenceRef.current;
       pendingFuelRef.current.set(delivered.id,{requestId,position:[...delivered.position],at:now,graph});
       worker.postMessage({type:'fuelPlan',revision:graphRevisionRef.current,requestId,vehicleId:delivered.id,from:delivered.position,targets,allowTaxiOnly:delivered.kind!=='explorer'&&delivered.kind!=='surveyor'&&delivered.kind!=='recovery'});
      }
      fuelTarget=cached?.target??null;
     }
     const thresholdKm=fuelTarget?fuelTarget.roadKm*1.25+2:Math.max(2,remainingKm*0.25);
     const needsEnergy=!!delivered.refillRequested||remainingKm<=thresholdKm;
     // Passenger taxis finish their current fare; explorers turn back before they strand themselves.
     const stopExploring=needsEnergy&&delivered.status==='EXPLORING';
     let working=stopExploring?{...delivered,status:'IDLE' as const,path:[],edgeIds:[],leg:0,distanceIntoLeg:0,speedKph:0,journeyEdges:[]}:delivered;
     if(working.status==='IDLE'&&needsEnergy&&fuelTarget&&fuelTarget.roadKm<=remainingKm*0.95&&
       (working.kind!=='explorer'||canDepartPurple(working))){
      const target=fuelTarget;
      if(target.path&&target.path.path.length<2)working={...working,status:'REFUELLING',refillDestination:target.point,refillAtDepot:target.depot,refillRequested:false};
      else if(target.path)working={...working,status:'RETURNING',path:target.path.path,edgeIds:target.path.edgeIds,leg:0,distanceIntoLeg:0,
       refillDestination:target.point,refillAtDepot:target.depot,refillRequested:false,journeyEdges:[]};
     }
     routingMs+=performance.now()-routeStarted;
     const integratorStarted=performance.now();
     const next=tickTaxi(working,graph,elapsedSeconds,discovered);
     integratorMs+=performance.now()-integratorStarted;
     // The movement integrator reports the exact distance travelled this tick,
     // including junction crossings and the final step before route reset.
     const km=next.distanceMeters/1000;
     const spec=energySpec(delivered);
     const person=driversByName.get(t.driver.toLowerCase());
     const experience=person?.completedTrips??0;
     // Career skills are derived from persistent driver trip counts (save compatible).
     const skill=Math.min(5,1+Math.floor(experience/25));
     const efficiencyBonus=(skill-1)*0.03;
     const careBonus=(skill-1)*0.0375;
     const serviceBonus=(skill-1)*0.02;
     const consumed=energyUsed(delivered,km,efficiencyBonus)*(1-Math.min(0.45,Research.level(research,'engine')*0.05+Research.level(research,'fuelInjection')*0.02+Research.level(research,'lightweight')*0.02+Research.level(research,'ecoDriving')*0.03+(t.kind==='explorer'?Research.level(research,'patrol')*0.02:0)))*(t.drivingPolicy==='economy'?0.85:t.drivingPolicy==='performance'?1.12:1);
     // Energy purchases are charged at refill time, never again per driven kilometre.
     const depotLevels=upgradesFor(old,t.depotId??'main');
     const fuel=0,maintenance=km*0.075*(1-Math.min(0.45,Research.level(research,'lubrication')*0.04+Research.level(research,'routing')*0.02+Research.level(research,'workshopResearch')*0.04+Research.level(research,'parts')*0.03))*((old.upgrades??[]).includes('workshop')?0.9:1)*(1-0.10*(depotLevels.workshop??0));
     const explorerTravelCost=(t.kind==='explorer')?km*0.50*(1-Math.min(0.45,Research.level(research,'survey')*0.06+Research.level(research,'navigation')*0.03)):0;
     explorationExpense+=explorerTravelCost;
     const wearPerKm=0.025*(1-careBonus)*(1-Math.min(0.50,Research.level(research,'durability')*0.07+Research.level(research,'defensive')*0.03))*(t.drivingPolicy==='economy'?0.85:t.drivingPolicy==='performance'?1.25:1); // Condition points lost per kilometre
     const wage=(t.kind==='explorer')?0:0.009*(old.wageMultiplier??1)*(1+Math.min(0.20,Math.floor(experience/25)*0.04)); // €32.40 per simulated hour, including employer costs
     const insurance=((t.kind==='explorer')?0.00045:0.00085)*(1-Research.level(research,'insuranceResearch')*0.05); // €3.06 per simulated hour per taxi
     driverWages+=wage;insuranceExpense+=insurance;
     distanceKm+=km;fuelExpense+=fuel;maintenanceExpense+=maintenance;
     const fareMultiplier=Math.min(1.6,(1+Math.max(0,Math.min(200,t.vehicleRevenueBonus??0))/100)*(1+Math.min(0.75,0.05*Research.level(research,'pricing')+0.03*Research.level(research,'peakPricing')+0.03*Research.level(research,'premium')+0.02*Research.level(research,'longDistance')+0.02*Research.level(research,'dispatchResearch')+0.01*Research.level(research,'fleetAnalytics')+0.02*Research.level(research,'trainingResearch')+0.02*Research.level(research,'advertising')+0.02*Research.level(research,'brand')+0.01*Research.level(research,'loyalty')))*(1+serviceBonus)*((old.upgrades??[]).includes('dispatch')?1.05:1)*(1+0.03*(depotLevels.dispatch??0)) );
     // Stable request IDs prevent a delayed worker result or save replay from
     // booking the same completed passenger journey more than once.
     const {earned,duplicate}=settlePassengerFare(
      working.activeJobId,next.finished,next.earned,fareMultiplier,paidPassengerJobs);
     revenue+=earned;
     if(earned){
      const tripKm=((working.jobDrivenMeters??0)+next.distanceMeters)/1000;
      transactions.push({id:crypto.randomUUID(),time:now,taxiId:t.id,
       description:`${t.name} · passenger fare · ${tripKm.toFixed(2)} km`,
       amount:earned});
     }
     if(next.finished&&!duplicate)completed++;
     if(person){const previous=driverUpdates.get(person.id)??{trips:0,km:0,revenue:0,wages:0};driverUpdates.set(person.id,{trips:previous.trips+(next.finished&&!duplicate?((old.upgrades??[]).includes('training')?1.2:1):0),km:previous.km+km,revenue:previous.revenue+earned,wages:previous.wages+wage});}
     const discoveryStarted=performance.now();
     const newRoadKm=t.kind==='explorer'
      ?registerNewRoadDistance(next.discovered,discovered,roadLengthByIdRef.current,
        working.edgeIds,working.path).kilometres:0;
     discoveryMs+=performance.now()-discoveryStarted;
     return {...next.taxi,
      completed:duplicate?t.completed:next.taxi.completed,
      jobFareTotal:next.taxi.status==='TO_DROPOFF'?
       Math.round(Math.max(0,next.taxi.fare*fareMultiplier)*100)/100:undefined,
      discoveredKm:(t.discoveredKm??0)+((t.kind==='explorer')&&(t.status==='EXPLORING'||(t.status==='RETURNING'&&Boolean(t.restStopId||t.refillDestination||t.serviceDestination)))?km:0),uniqueDiscoveredKm:(t.uniqueDiscoveredKm??0)+newRoadKm,vehicleCondition:Math.max(0,(t.vehicleCondition??100)-km*wearPerKm),operatingKm:(t.operatingKm??0)+km,vehicleMileage:(t.vehicleMileage??0)+km,
       fuelExpense:(t.fuelExpense??0)+fuel,maintenanceExpense:(t.maintenanceExpense??0)+maintenance,explorationExpense:(t.explorationExpense??0)+explorerTravelCost,
       energyRemaining:Math.max(0,energyRemaining(delivered)-consumed),
       refillRequested:next.taxi.refillRequested||energyRemaining(delivered)-consumed<=0,
       fuelLitres:(t.fuelLitres??0)+(spec.unit==='L'?consumed:0),tripRevenue:(t.tripRevenue??0)+earned,
       driverWages:(t.driverWages??0)+wage,insuranceExpense:(t.insuranceExpense??0)+insurance,
       drivingSinceRestGameMs:(delivered.drivingSinceRestGameMs??0)+(next.distanceMeters>0?elapsedSeconds*1000*24:0),
       drivingSinceHotelGameMs:(delivered.drivingSinceHotelGameMs??0)+(next.distanceMeters>0?elapsedSeconds*1000*24:0)};
     }finally{
      const duration=performance.now()-vehicleStarted;
      if(duration>slowestVehicleMs){slowestVehicleMs=duration;slowestVehicle=t.name;}
     }
    });
    const movementMs=performance.now()-tickStarted;
    // Depreciation is non-cash; book it on owned vehicles only.
    let depreciation=0;
    for(let index=0;index<taxis.length;index++){
     const charge=depreciationTick(taxis[index],4);
     if(charge>0){depreciation+=charge;taxis[index]={...taxis[index],accumulatedDepreciation:(taxis[index].accumulatedDepreciation??0)+charge};}
    }
    const vehicleFinanceDeltas=taxis.map((t,index)=>{
     const before=old.taxis[index];
     const delta=(field:'tripRevenue'|'fuelExpense'|'maintenanceExpense'|'explorationExpense'|'driverWages'|'insuranceExpense'|'operatingKm')=>Math.max(0,(t[field]??0)-(before[field]??0));
     const revenueDelta=delta('tripRevenue');
     return {day:tickDay,taxiId:t.id,name:t.name,depotId:t.depotId??'main',revenue:revenueDelta,
      expenses:delta('fuelExpense')+delta('maintenanceExpense')+delta('explorationExpense')+delta('driverWages')+delta('insuranceExpense'),
      km:delta('operatingKm'),trips:Math.max(0,t.completed-before.completed)};
    }).filter(v=>v.revenue>0||v.expenses>0||v.km>0||v.trips>0);
    // A small office/depot overhead accrues in simulated time, including idle periods.
    const overhead=old.taxis.length*(0.00045)+0.0012; // €4.32/hr base + €1.62/hr per vehicle
    // Facility costs are NEW operating expenses; legacy office overhead remains separate.
    const depotDefinitions=[{id:'main',name:'Headquarters',capacity:5},...(companyRef.current?.depots??[])];
    const facilityByDepot=depotDefinitions.map(d=>{
      const assigned=assignedByDepot.get(d.id)??0;
      const daily=depotDailyTotal(d.id==='main',upgradesFor(old,d.id),depotCapacity(d,upgradesFor(old,d.id)));
      return {id:d.id,name:d.name,assigned,cost:daily*4/86400*(1-Research.level(research,'depotEfficiency')*0.04)};
    });
    const facilityCost=facilityByDepot.reduce((a,d)=>a+d.cost,0);
    const depotHistory:DepotFinanceRecord[]=[...(old.depotFinanceHistory??[])];
    const historyDay=tickDay;
    for(const d of facilityByDepot){
      const related=vehicleFinanceDeltas.filter(v=>v.depotId===d.id);
      const vehicleExpenses=related.reduce((a,v)=>a+v.expenses,0);
      const income=related.reduce((a,v)=>a+v.revenue,0);
      const allocatedOverhead=overhead*(old.taxis.length?d.assigned/old.taxis.length:d.id==='main'?1:0);
      const entry=depotHistory.find(v=>v.day===historyDay&&v.depotId===d.id);
      if(entry){entry.revenue+=income;entry.vehicleExpenses+=vehicleExpenses;entry.facilityExpenses+=d.cost;entry.allocatedOverhead+=allocatedOverhead;entry.trips+=related.reduce((a,v)=>a+v.trips,0);entry.km+=related.reduce((a,v)=>a+v.km,0);}
      else depotHistory.push({day:historyDay,depotId:d.id,depotName:d.name,revenue:income,vehicleExpenses,facilityExpenses:d.cost,allocatedOverhead,trips:related.reduce((a,v)=>a+v.trips,0),km:related.reduce((a,v)=>a+v.km,0)});
    }
    const leaseTick=advanceLeases(old.leases??[],4);
    // Legacy vehicle finance keeps its existing repayment behaviour.
    // Secured business loans may pay only from actual positive cash.
    const legacyTick=advanceLoans((old.loans??[]).filter(l=>!l.secured),4);
    const operatingNet=revenue-fuelExpense-maintenanceExpense-serviceExpense-
     explorationExpense-driverWages-insuranceExpense-overhead-facilityCost-
     legacyTick.payments-leaseTick.payments;
    const availableForLoans=Math.max(0,(companyRef.current?.cash??0)+
     pendingCashRef.current+operatingNet);
    const securedTick=advanceSecuredLoans((old.loans??[]).filter(l=>l.secured),4,
     availableForLoans,taxis);
    const loanTick={loans:[...legacyTick.loans,...securedTick.loans],
     payments:legacyTick.payments+securedTick.payments,
     principal:legacyTick.principal+securedTick.principal,
     interest:legacyTick.interest+securedTick.interest};
    const repaymentCount=legacyTick.loans.reduce((n,l)=>{
     const previous=(old.loans??[]).find(x=>x.id===l.id);
     return n+Math.max(0,(l.paymentsMade??0)-(previous?.paymentsMade??0));
    },0)+securedTick.paymentCount;
    if(securedTick.missed>0)
     diagnostic('bank:missed-instalment',`missed=${securedTick.missed} outstanding=${loanTick.loans.length}`);
    for(const recovered of securedTick.repossessions){
     transactions.push({id:crypto.randomUUID(),time:gameNow,
      description:`Bank repossession · ${recovered.vehicleName} · ${recovered.value.toFixed(2)} debt recovered (non-cash)`,
      taxiId:recovered.vehicleId,amount:0});
    }
    const partnership=collectBankRevenue(old.bankPartnerships??[],revenue);
    const net=operatingNet-securedTick.payments-partnership.paid;
     const pendingBeforeSettlement=pendingCashRef.current;
    if(net!==0)pendingCashRef.current+=net;
    // Sweep a percentage of each passenger-income settlement immediately.
    // Loan proceeds, transfers and asset sales are not operating income.
    const savingsBank=bankOf(old.bank);
    const operatingAvailable=Math.max(0,(companyRef.current?.cash??0)+pendingCashRef.current-savingsBank.minimumOperatingCash);
    const savingsAmount=Math.floor(Math.min(operatingAvailable,Math.max(0,revenue)*savingsBank.autoSavePercent/100)*100)/100;
    if(savingsAmount>0)pendingCashRef.current-=savingsAmount;
    const updatedBank=savingsAmount>0?appendBankEntries({...savingsBank,savings:savingsBank.savings+savingsAmount},[
      bankEntry('Automatic savings · passenger income',-savingsAmount,'operating','transfer'),
      bankEntry('Automatic savings · passenger income',savingsAmount,'savings','transfer')
    ]):old.bank;
    const month=periodMonth(gameClockRef.current?.epochMs??now);
    // Principal repayments and capital purchases are financing/investing cash flows, not P&L expenses.
    const grossOperatingExpenses=fuelExpense+maintenanceExpense+serviceExpense+explorationExpense+driverWages+insuranceExpense+overhead+facilityCost+leaseTick.payments+loanTick.interest;
    const vatEligibleExpenses=fuelExpense+maintenanceExpense+serviceExpense+facilityCost;
    const booked=bookAccounting(old.accounting,month,revenue,grossOperatingExpenses,vatEligibleExpenses,depreciation);
    const taxSettlement=settleAccounting(booked,month,(companyRef.current?.cash??0)+pendingCashRef.current,gameNow);
    const taxPaid=taxSettlement.paidVat+taxSettlement.paidCorporate;
    if(taxPaid>0)pendingCashRef.current-=taxPaid;
     if(revenue!==0||operatingNet!==0||partnership.paid!==0||savingsAmount!==0||taxPaid!==0)recordFinancialAudit({gameTime:new Date(gameNow).toISOString(),kind:'taxi-and-operations',description:'Simulation tick; lenders: '+partnership.settlements.map(x=>x.bank+' '+x.amount.toFixed(2)).join(', '),gross:revenue,operatingCost:revenue-operatingNet,bankShare:partnership.paid,savings:savingsAmount,other:-securedTick.payments-taxPaid,cashBefore:companyRef.current?.cash??0,pendingBefore:pendingBeforeSettlement,pendingAfter:pendingCashRef.current,bankLenders:Object.fromEntries(partnership.settlements.map(x=>[x.bank,x.amount])),breakdown:{
 'Fuel':fuelExpense,'Maintenance':maintenanceExpense,'Vehicle service':serviceExpense,
 'Exploration':explorationExpense,'Driver wages':driverWages,'Insurance':insuranceExpense,
 'Overhead':overhead,'Depot/facility':facilityCost,'Legacy loan instalments':legacyTick.payments,
 'Vehicle leases':leaseTick.payments,'Secured loan payments':securedTick.payments,
 'VAT settlement':taxSettlement.paidVat,'Corporate tax settlement':taxSettlement.paidCorporate
 }});
    const expiredLeaseIds=new Set(leaseTick.expired.map(l=>l.vehicleId));
    const updatedIds=discovered.size===initialDiscoveryCount?savedIds:[...discovered];
    discoveredCacheRef.current={ids:updatedIds,set:discovered};
    const drivers=(old.drivers??[]).map(d=>{const u=driverUpdates.get(d.id);return u?{...d,completedTrips:(d.completedTrips??0)+u.trips,distanceKm:(d.distanceKm??0)+u.km,revenueGenerated:(d.revenueGenerated??0)+u.revenue,wagesEarned:(d.wagesEarned??0)+u.wages}:d;});
    const tickMs=performance.now()-tickStarted;
    if(performanceMonitorEnabled())recordActivity('simulation',tickMs);
    recordSimulationTick(tickMs,movementMs,tickMs-movementMs,old.taxis.length,discovered.size,slowestVehicle,slowestVehicleMs,routingMs,integratorMs,discoveryMs);
    const perf=simulationPerfRef.current;
    perf.samples++;perf.totalMs+=tickMs;perf.maxMs=Math.max(perf.maxMs,tickMs);
    if(tickMs>50&&now-perf.lastReport>15000){
     console.warn('[TravelEmpire] Slow simulation tick',{durationMs:Math.round(tickMs),vehicles:old.taxis.length,exploredRoads:discovered.size,averageMs:Math.round(perf.totalMs/perf.samples),maxMs:Math.round(perf.maxMs)});
     perf.lastReport=now;perf.samples=0;perf.totalMs=0;perf.maxMs=0;
    }
    return{...old,accounting:taxSettlement.accounting,depotFinanceHistory:depotHistory.filter(h=>h.day>=new Date(gameNow-365*86400000).toISOString().slice(0,10)).slice(-2500),depotFacilityExpense:(old.depotFacilityExpense??0)+facilityCost,financePaymentsMade:(old.financePaymentsMade??0)+repaymentCount,
      creditMisses:(old.creditMisses??0)+securedTick.missed,
      creditDefaults:(old.creditDefaults??0)+securedTick.repossessions.length,
      drivers,taxis:securedTick.taxis.filter(t=>!expiredLeaseIds.has(t.id)),leases:leaseTick.leases,leaseExpense:(old.leaseExpense??0)+leaseTick.payments,revenue:old.revenue+revenue,completed:old.completed+completed,paidPassengerJobIds:[...paidPassengerJobs].slice(-512),exploredEdgeIds:updatedIds,
      fuelExpense:(old.fuelExpense??0)+fuelExpense,maintenanceExpense:(old.maintenanceExpense??0)+maintenanceExpense,serviceExpense:(old.serviceExpense??0)+serviceExpense,explorationExpense:(old.explorationExpense??0)+explorationExpense,
      distanceKm:(old.distanceKm??0)+distanceKm,driverWages:(old.driverWages??0)+driverWages,
      insuranceExpense:(old.insuranceExpense??0)+insuranceExpense,overheadExpense:(old.overheadExpense??0)+overhead+facilityCost,
      financeHistory:(()=>{const day=tickDay;const list=[...(old.financeHistory??[])];const last=list[list.length-1];const categories={fuel:fuelExpense,maintenance:maintenanceExpense+serviceExpense,exploration:explorationExpense,payroll:driverWages,insurance:insuranceExpense,overhead:overhead+facilityCost,interest:loanTick.interest};const cost=Object.values(categories).reduce((a,b)=>a+b,0)+leaseTick.payments;if(last?.day===day){const previous=last.categories;list[list.length-1]={...last,revenue:last.revenue+revenue,expenses:last.expenses+cost,trips:last.trips+completed,categories:Object.fromEntries(Object.entries(categories).map(([k,v])=>[k,v+(previous?.[k as keyof typeof categories]??0)])) as typeof categories};}else list.push({day,revenue,expenses:cost,trips:completed,categories});return list.slice(-365);})(),
      vehicleFinanceHistory:(()=>{const list=[...(old.vehicleFinanceHistory??[])];for(const entry of vehicleFinanceDeltas){const existing=list.find(v=>v.day===entry.day&&v.taxiId===entry.taxiId);if(existing){existing.revenue+=entry.revenue;existing.expenses+=entry.expenses;existing.km+=entry.km;existing.trips+=entry.trips;}else list.push(entry);}const cutoff=new Date(gameNow-365*86400000).toISOString().slice(0,10);return list.filter(v=>v.day>=cutoff).slice(-5000);})(),
      bank:loanTick.payments>0||leaseTick.payments>0||taxPaid>0||partnership.paid>0?appendBankEntries(bankOf(updatedBank),[...(partnership.settlements.map(item=>bankEntry('Revenue partnership · '+item.bank,-item.amount,'operating','repayment'))),...(loanTick.payments>0?[bankEntry('Scheduled loan repayment',-loanTick.payments,'operating','repayment')]:[]),...(leaseTick.payments>0?[bankEntry('Vehicle lease instalments',-leaseTick.payments,'operating','repayment')]:[]),...(taxSettlement.paidVat>0?[bankEntry('Monthly VAT settlement',-taxSettlement.paidVat,'operating','repayment')]:[]),...(taxSettlement.paidCorporate>0?[bankEntry('Monthly corporate tax settlement',-taxSettlement.paidCorporate,'operating','repayment')]:[])]):updatedBank,
      bankPartnerships:partnership.deals,bankPartnershipPaid:(old.bankPartnershipPaid??0)+partnership.paid,bankPartnershipPaidByDay:bookBankCollection(old.bankPartnershipPaidByDay,tickDay,partnership.paid),bankPartnershipPaidByLenderByDay:bookBankLenderCollections(old.bankPartnershipPaidByLenderByDay,tickDay,partnership.settlements),loans:loanTick.loans,loanInterestExpense:(old.loanInterestExpense??0)+loanTick.interest,loanPrincipalPaid:(old.loanPrincipalPaid??0)+loanTick.principal+securedTick.repossessions.reduce((sum,event)=>sum+event.value,0),transactions:[...partnership.settlements.map(item=>({id:crypto.randomUUID(),time:gameNow,description:'Revenue partnership · '+item.bank,amount:-item.amount})),...transactions,...(old.transactions??[])].slice(0,100)};
   });
  },1000);
  return()=>{window.clearInterval(timer);document.removeEventListener('visibilitychange',resetTick);window.removeEventListener('pageshow',resetTick);};
 },[company?.id,graph,fleet.taxis.length,research]);

 // An untouched company needs one real HQ road before any specialist can
 // start. This is the ONLY bootstrap exception to connected discovery.
 useEffect(()=>{
  if(!company||!graph||fleet.taxis.length===0||(fleet.exploredEdgeIds?.length??0)>0)return;
  const hq:[number,number]=[company.headquarters.lng,company.headquarters.lat];
  const node=nearest(graph,hq),position=graph.nodes.get(node);
  if(!position||meters(position,hq)>500)return;
  const first=(graph.edges.get(node)??[]).find(e=>e.meters>0);
  if(!first)return;
  setFleet(old=>{
   if((old.exploredEdgeIds?.length??0)>0||old.taxis.length===0)return old;
   diagnostic('explorers:hq-seed',`road=${first.id}`);
   return {...old,exploredEdgeIds:[first.id]};
  });
 },[company?.id,graph,fleet.taxis.length,fleet.exploredEdgeIds?.length]);
 // Grant the initial fleet exactly once, after the headquarters road graph is ready.
 // Existing companies are untouched. Starter vehicles have no delivery timer or purchase charge.
 useEffect(()=>{
  if(!company||!graph||!graph.nodes.size)return;
  const key='travelempire.starterFleet.'+company.id;
  if(localStorage.getItem(key)!=='pending')return;
  const hq:[number,number]=[company.headquarters.lng,company.headquarters.lat];
  const node=nearest(graph,hq);if(!node)return;
  const position=graph.nodes.get(node);if(!position||meters(position,hq)>500)return;
  const launchRoad=(graph.edges.get(node)??[]).find(e=>e.meters>0&&!e.taxiOnly);
  if(!launchRoad)return;
  const roles:NonNullable<Taxi['explorerRole']>[]=['highway','primary','secondary','residential','poi'];
  const now=Date.now();
  const explorers:Taxi[]=roles.map(role=>({id:crypto.randomUUID(),kind:'explorer',explorerRole:role,name:role==='highway'?'Highway Explorer':role==='primary'?'Primary Explorer':role==='secondary'?'Secondary Explorer':role==='residential'?'Local Street Explorer':'POI Explorer',driver:'Autonomous',position:[...position],status:'IDLE',path:[],edgeIds:[],leg:0,distanceIntoLeg:0,fare:0,completed:0,ownership:'owned',purchasePrice:0,vehicleModel:role==='highway'?'Highway Explorer':role==='primary'?'Primary Explorer':role==='secondary'?'Secondary Explorer':role==='residential'?'Local Street Explorer':'POI Explorer',vehicleYear:2026,vehicleFuel:'Petrol',vehicleClass:'Economy',vehicleCondition:100,vehicleMileage:0,energyRemaining:energySpec({vehicleFuel:'Petrol'}).capacity,depotId:'main'}));
  const driver={id:crypto.randomUUID(),name:'Alex Morgan',hiredAt:now};
  const taxi:Taxi={id:crypto.randomUUID(),kind:'taxi',name:'Taxi 1',driver:driver.name,position:[...position],status:'IDLE',path:[],edgeIds:[],leg:0,distanceIntoLeg:0,fare:0,completed:0,ownership:'owned',purchasePrice:0,vehicleModel:'Starter Taxi',vehicleYear:2026,vehicleFuel:'Petrol',vehicleClass:'Economy',vehicleCondition:100,vehicleMileage:0,energyRemaining:energySpec({vehicleFuel:'Petrol'}).capacity,depotId:'main'};
  const current=loadFleet(company.id);
  if(current.taxis.length===0){const seeded=[...new Set([...(current.exploredEdgeIds??[]),launchRoad.id])];const updated={...current,taxis:[taxi,...explorers],drivers:[...(current.drivers??[]),driver],exploredEdgeIds:seeded};saveFleet(company.id,{...updated,exploredEdgeIds:[]});fleetSaveRef.current=updated;discoveredCacheRef.current={ids:seeded,set:new Set(seeded)};setFleet(updated);void writeExploration(company.id,{ids:[launchRoad.id],segments:{}}).catch(error=>diagnostic('explorers:initial-seed-save-failed',String(error)));diagnostic('explorers:initial-launch',`road=${launchRoad.id} vehicles=${explorers.length}`);}
  localStorage.setItem(key,'done');
 },[company?.id,graph]);
 // Five specialists are free and always start at a purple-discovered node.
 // Existing companies receive the same five free specialists without
 // losing their saved vehicles, discovered roads, ferries or finances.
 useEffect(()=>{
  if(!company||!graph||!graph.nodes.size)return;
  setFleet(old=>{
   if(!old.taxis.length)return old; // Starter-fleet effect owns new companies.
   // A published Greece road graph may contain hundreds of thousands of
   // nodes. Once all specialists exist, never rescan it on graph revisions.
   const requiredRoles:NonNullable<Taxi['explorerRole']>[]=['highway','primary','secondary','residential','poi'];
   if(requiredRoles.every(role=>old.taxis.some(t=>t.kind==='explorer'&&t.explorerRole===role)))return old;
   const discovered=new Set([...(discoveredCacheRef.current?.ids??[]),...(old.exploredEdgeIds??[])]);
   const hq:[number,number]=[company.headquarters.lng,company.headquarters.lat];
   let node:string|undefined,best=Infinity;
   for(const [candidate,edges] of graph.edges){
    if(!edges.some(e=>discovered.has(e.id)))continue;
    const point=graph.nodes.get(candidate);if(!point)continue;
    const distance=meters(point,hq);
    if(distance<best){best=distance;node=candidate;}
   }
   if(!node)return old; // Never spawn onto an undiscovered road.
   const roles:NonNullable<Taxi['explorerRole']>[]=['highway','primary','secondary','residential','poi'];
   const names=['Highway Explorer','Primary Explorer','Secondary Explorer','Local Street Explorer','POI Explorer'];
   const existing=new Set(old.taxis.filter(t=>t.kind==='explorer').map(t=>t.explorerRole));
   const oldUniversal=old.taxis.find(t=>t.kind==='explorer'&&(!t.explorerRole||t.explorerRole==='balanced'));
   const taxis=oldUniversal&&!existing.has('highway')?old.taxis.map(t=>
    t.id===oldUniversal.id?{...t,explorerRole:'highway' as const,name:names[0],
     vehicleModel:names[0]}:t):[...old.taxis];
   if(oldUniversal&&!existing.has('highway'))existing.add('highway');
   const missing=roles.filter(role=>!existing.has(role));
   if(!missing.length&&taxis.length===old.taxis.length&&taxis.every((t,i)=>t===old.taxis[i]))return old;
   for(const role of missing){
    const name=names[roles.indexOf(role)];
    taxis.push({id:crypto.randomUUID(),kind:'explorer',explorerRole:role,
     name,driver:'Autonomous',position:[...graph.nodes.get(node)!],status:'IDLE',
     path:[],edgeIds:[],leg:0,distanceIntoLeg:0,fare:0,completed:0,
     ownership:'owned',purchasePrice:0,vehicleModel:name,vehicleYear:2026,
     vehicleFuel:'Petrol',vehicleClass:'Economy',vehicleCondition:100,
     vehicleMileage:0,energyRemaining:energySpec({vehicleFuel:'Petrol'}).capacity,depotId:'main'});
   }
   return {...old,taxis};
  });
 },[company?.id,graph,roadGraphVersion,fleet.taxis.length,fleet.exploredEdgeIds?.length]);

 const buyRoadExplorer=(requested?:Taxi['explorerRole'])=>{
  if(!company||!graph)return;
  const roles:NonNullable<Taxi['explorerRole']>[]=['highway','primary','secondary','residential','poi'];
  const role=(roles.includes(requested as NonNullable<Taxi['explorerRole']>)?requested:
   roles.find(r=>!fleet.taxis.some(t=>t.kind==='explorer'&&t.explorerRole===r))) as NonNullable<Taxi['explorerRole']>|undefined;
  if(!role||fleet.taxis.some(t=>t.kind==='explorer'&&t.explorerRole===role))return;
  const discovered=new Set([...(discoveredCacheRef.current?.ids??[]),...(fleet.exploredEdgeIds??[])]);
  const hq:[number,number]=[company.headquarters.lng,company.headquarters.lat];
  let node:string|undefined,best=Infinity;
  for(const [candidate,edges] of graph.edges){
   if(!edges.some(e=>discovered.has(e.id)))continue;
   const p=graph.nodes.get(candidate);if(!p)continue;
   const d=meters(p,hq);if(d<best){best=d;node=candidate;}
  }
  if(!node){setSimError('The first purple headquarters road must be discovered before an explorer can start.');return;}
  const name=role==='highway'?'Highway Explorer':role==='primary'?'Primary Explorer':
   role==='secondary'?'Secondary Explorer':role==='residential'?'Local Street Explorer':'POI Explorer';
  const explorer:Taxi={id:crypto.randomUUID(),kind:'explorer',explorerRole:role,
   name,driver:'Autonomous',position:[...graph.nodes.get(node)!],status:'IDLE',
   path:[],edgeIds:[],leg:0,distanceIntoLeg:0,fare:0,completed:0,
   ownership:'owned',purchasePrice:0,vehicleModel:name,vehicleYear:2026,
   vehicleFuel:'Petrol',vehicleClass:'Economy',vehicleCondition:100,
   vehicleMileage:0,energyRemaining:energySpec({vehicleFuel:'Petrol'}).capacity,depotId:'main'};
  setFleet(old=>old.taxis.some(t=>t.kind==='explorer'&&t.explorerRole===role)?old:
   {...old,taxis:[...old.taxis,explorer]});
  setSimError('');
 };
 const bankTransfer=(from:'operating'|'savings'|'reserve',to:'operating'|'savings'|'reserve',amount:number)=>{
  const current=companyRef.current;if(!current)return;
  try{const result=transferBank(bankOf(fleet.bank),from,to,amount,current.cash+pendingCashRef.current);
   const pendingBeforeTransfer=pendingCashRef.current;
   pendingCashRef.current+=result.operatingDelta;
   recordFinancialAudit({gameTime:new Date(gameClockRef.current?.epochMs??Date.now()).toISOString(),kind:'bank-transfer',description:from+' → '+to+' transfer',gross:0,operatingCost:0,bankShare:0,savings:0,other:result.operatingDelta,cashBefore:current.cash,pendingBefore:pendingBeforeTransfer,pendingAfter:pendingCashRef.current,breakdown:{['Transfer '+from+' to '+to]:amount}});
   setFleet(old=>({...old,bank:result.bank}));setSimError('');
  }catch(error){setSimError(error instanceof Error?error.message:String(error));}
 };
 const accountingSettings=(corporateRate:number,vatRate:number)=>{
  if(!Number.isFinite(corporateRate)||!Number.isFinite(vatRate))return;
  const settings:AccountingSettings={...accountingOf(fleetSaveRef.current.accounting).settings,corporateRate:Math.max(0,Math.min(40,corporateRate)),vatRate:Math.max(0,Math.min(25,vatRate)),settlement:'scheduled'};
  setFleet(old=>({...old,accounting:{...accountingOf(old.accounting),settings}}));
 };
 const commitEquity=(next:ReturnType<typeof equityOf>,cashDelta:number,description:string,events:import('./simulation/taxi').EquityEvent[])=>{
  const current=companyRef.current;if(!current)return;
  const now=Date.now();
  pendingCashRef.current=Math.round((pendingCashRef.current+cashDelta)*100)/100;
  const old=fleetSaveRef.current;
  const entries=events.map(event=>bankEntry(description+' · '+event.holderName,event.amount,'operating','equity'));
  const updated={...old,equity:next,bank:appendBankEntries(bankOf(old.bank),entries),transactions:[{id:crypto.randomUUID(),time:now,description,amount:cashDelta},...(old.transactions??[])].slice(0,100)};
  fleetSaveRef.current=updated;setFleet(updated);setSimError('');
 };
 const investInCompany=(investorId:string)=>{
  const current=companyRef.current;if(!current)return;
  try{
   const old=fleetSaveRef.current;
   const valuation=valueCompany({...current,cash:current.cash+pendingCashRef.current},old,gameClockRef.current?.epochMs??Date.now());
   const offer=investorOffers(valuation,equityOf(old.equity)).find(o=>o.id===investorId);
   if(!offer)throw Error('Investor offer is no longer available.');
   const issued=issueShares(old.equity,offer.id,offer.name,offer.amount,offer.preMoney,gameClockRef.current?.epochMs??Date.now());
   commitEquity(issued.state,issued.cashDelta,'Investor share subscription',[issued.event]);
  }catch(error){setSimError(error instanceof Error?error.message:String(error));}
 };
 const issueCompanyShares=(investorId:string,amount:number)=>{
  const current=companyRef.current;if(!current)return;
  try{
   if(!Number.isFinite(amount)||amount<100||amount>1000000)throw Error('Investment must be between €100 and €1,000,000.');
   const old=fleetSaveRef.current;
   const valuation=valueCompany({...current,cash:current.cash+pendingCashRef.current},old,gameClockRef.current?.epochMs??Date.now());
   const names=['Hellenic Mobility Partners','Aegean Growth Capital','Urban Transit Ventures'];
   const index=Number(investorId.replace('investor-',''));
   if(!Number.isInteger(index)||index<0||index>=names.length)throw Error('Unknown investor.');
   if(valuation.investorConfidence<35)throw Error('Investor confidence is too low to issue external equity.');
   const issued=issueShares(old.equity,investorId,names[index],Math.round(amount*100)/100,valuation.value,gameClockRef.current?.epochMs??Date.now());
   commitEquity(issued.state,issued.cashDelta,'New shares issued',[issued.event]);
  }catch(error){setSimError(error instanceof Error?error.message:String(error));}
 };
 const distributeDividend=(amount:number)=>{
  const current=companyRef.current;if(!current)return;
  try{
   const old=fleetSaveRef.current;
   const cash=current.cash+pendingCashRef.current;
   const reserve=bankOf(old.bank).minimumOperatingCash;
   const result=payDividend(old.equity,amount,cash,distributableProfit(old,equityOf(old.equity)),reserve,gameClockRef.current?.epochMs??Date.now());
   commitEquity(result.state,result.cashDelta,'Shareholder dividend',result.events);
  }catch(error){setSimError(error instanceof Error?error.message:String(error));}
 };
 const repurchaseShares=(holderId:string,shares:number)=>{
  const current=companyRef.current;if(!current)return;
  try{
   const old=fleetSaveRef.current;
   const cash=current.cash+pendingCashRef.current;
   const value=valueCompany({...current,cash},old,gameClockRef.current?.epochMs??Date.now()).value;
   const result=buybackShares(old.equity,holderId,shares,value,cash,bankOf(old.bank).minimumOperatingCash,gameClockRef.current?.epochMs??Date.now());
   commitEquity(result.state,result.cashDelta,'Share buyback',[result.event]);
  }catch(error){setSimError(error instanceof Error?error.message:String(error));}
 };
 const commitCorporate=(state:CorporateState,parentCashDelta:number,events:CorporateEvent[],label:string)=>{
  const current=companyRef.current;if(!current)return;
  pendingCashRef.current=Math.round((pendingCashRef.current+parentCashDelta)*100)/100;
  const old=fleetSaveRef.current;
  const entries=events.filter(e=>e.parentCashDelta!==0).map(e=>bankEntry(e.description,e.parentCashDelta,'operating',e.kind==='loan'?'loan':e.kind==='repayment'?'repayment':'corporate'));
  const updated={...old,corporate:state,bank:entries.length?appendBankEntries(bankOf(old.bank),entries):old.bank,transactions:parentCashDelta!==0?[{id:crypto.randomUUID(),time:gameClockRef.current?.epochMs??Date.now(),description:label,amount:parentCashDelta},...(old.transactions??[])].slice(0,100):old.transactions};
  fleetSaveRef.current=updated;setFleet(updated);setSimError('');
 };
 const acquireSubsidiary=(id:string,discount:number,loanPercent:number)=>{
  const current=companyRef.current;if(!current)return;
  try{
   const old=fleetSaveRef.current;
   const result=acquireCompany(old.corporate,old,id,discount,loanPercent,current.cash+pendingCashRef.current,bankOf(old.bank).minimumOperatingCash,gameClockRef.current?.epochMs??Date.now());
   commitCorporate(result.state,result.parentCashDelta,result.events,'Acquisition of '+result.subsidiary.name);
  }catch(error){setSimError(error instanceof Error?error.message:String(error));}
 };
 const createSubsidiary=(name:string,city:string,capital:number)=>{
  const current=companyRef.current;if(!current)return;
  try{
   const old=fleetSaveRef.current;
   const result=foundSubsidiary(old.corporate,name,city,capital,current.cash+pendingCashRef.current,bankOf(old.bank).minimumOperatingCash,gameClockRef.current?.epochMs??Date.now());
   commitCorporate(result.state,result.parentCashDelta,result.events,'Subsidiary formation: '+result.subsidiary.name);
  }catch(error){setSimError(error instanceof Error?error.message:String(error));}
 };
 const transferSubsidiary=(id:string,amount:number,direction:'to'|'from')=>{
  const current=companyRef.current;if(!current)return;
  try{
   const old=fleetSaveRef.current;
   const result=transferCorporateCash(old.corporate,id,amount,direction,current.cash+pendingCashRef.current,bankOf(old.bank).minimumOperatingCash,gameClockRef.current?.epochMs??Date.now());
   commitCorporate(result.state,result.parentCashDelta,result.events,'Intercompany transfer');
  }catch(error){setSimError(error instanceof Error?error.message:String(error));}
 };
 const mergeCorporate=(sourceId:string,targetId:string)=>{
  try{
   const old=fleetSaveRef.current;
   const result=mergeSubsidiaries(old.corporate,sourceId,targetId,gameClockRef.current?.epochMs??Date.now());
   commitCorporate(result.state,0,result.events,'Subsidiary merger');
  }catch(error){setSimError(error instanceof Error?error.message:String(error));}
 };
 const restructureCorporate=(id:string,vehicles:number,depots:number)=>{
  try{
   const old=fleetSaveRef.current;
   const result=restructureSubsidiary(old.corporate,id,vehicles,depots,gameClockRef.current?.epochMs??Date.now());
   commitCorporate(result.state,0,result.events,'Subsidiary restructuring');
  }catch(error){setSimError(error instanceof Error?error.message:String(error));}
 };
 const moveSubsidiaryAssets=(sourceId:string,targetId:string,vehicles:number,depots:number)=>{
  try{
   const old=fleetSaveRef.current;
   const result=transferSubsidiaryAssets(old.corporate,sourceId,targetId,vehicles,depots,gameClockRef.current?.epochMs??Date.now());
   commitCorporate(result.state,0,result.events,'Intercompany asset transfer');
  }catch(error){setSimError(error instanceof Error?error.message:String(error));}
 };
 const foundForeign=(name:string,city:string,countryCode:string,capital:number)=>{
  const current=companyRef.current;if(!current)return;
  try{
   const old=fleetSaveRef.current;
   const result=establishForeignSubsidiary(old.corporate,name,city,countryCode as import('./international').CountryCode,capital,current.cash+pendingCashRef.current,bankOf(old.bank).minimumOperatingCash,gameClockRef.current?.epochMs??Date.now());
   commitCorporate(result.state,result.parentCashDelta,result.events,'International subsidiary: '+result.subsidiary.name);
  }catch(error){setSimError(error instanceof Error?error.message:String(error));}
 };
 const acquireForeign=(id:string,loanPercent:number)=>{
  const current=companyRef.current;if(!current)return;
  try{
   const old=fleetSaveRef.current;
   const result=acquireForeignBusiness(old.corporate,old,id,loanPercent,current.cash+pendingCashRef.current,bankOf(old.bank).minimumOperatingCash,gameClockRef.current?.epochMs??Date.now());
   commitCorporate(result.state,result.parentCashDelta,result.events,'Foreign acquisition: '+result.subsidiary.name);
  }catch(error){setSimError(error instanceof Error?error.message:String(error));}
 };
 const transferForeign=(id:string,amount:number,direction:'to'|'from')=>{
  const current=companyRef.current;if(!current)return;
  try{
   const old=fleetSaveRef.current;
   const result=crossBorderTransfer(old.corporate,id,amount,direction,current.cash+pendingCashRef.current,bankOf(old.bank).minimumOperatingCash,gameClockRef.current?.epochMs??Date.now());
   const expense=result.fee;
   const accounting=bookAccounting(fleetSaveRef.current.accounting,periodMonth(gameClockRef.current?.epochMs??Date.now()),0,expense,0,0);
   commitCorporate(result.state,result.parentCashDelta,result.events,'Cross-border cash transfer');
   const latest=fleetSaveRef.current;
   const updated={...latest,accounting};
   fleetSaveRef.current=updated;setFleet(updated);
  }catch(error){setSimError(error instanceof Error?error.message:String(error));}
 };
 const bankSettings=(percent:number,minimum:number)=>{
  if(!Number.isFinite(percent)||!Number.isFinite(minimum))return;
  setFleet(old=>({...old,bank:{...bankOf(old.bank),autoSavePercent:Math.max(0,Math.min(100,percent)),minimumOperatingCash:Math.max(0,minimum)}}));
 };
 const buyTaxiBatch=(offer:VehicleOffer,quantity:number,mode:'cash'|'finance'|'lease'='cash',depositPercent=25,termDays=90,depotId='main')=>{
  const current=companyRef.current;
  const currentFleet=fleetSaveRef.current;
  if(!current||!graph)return;
  try{
   if(!Number.isInteger(quantity)||quantity<1||quantity>50)throw Error('Choose 1–50 vehicles.');
   // Enforce parking *before* charging or preparing finance. Pending vehicle
   // deliveries already occupy their assigned depot's capacity reservation.
   const deliveryDepot=requireDepotParking(current,currentFleet,depotId,quantity);
   if(![30,60,90,180].includes(termDays)||![10,20,25,30,40,50].includes(depositPercent))throw Error('Invalid finance terms.');
   const discount=Research.level(research,'procurement')*0.04;
   const price=Math.round(offer.price*(1-discount)*100)/100;
   const quote=financeQuote(price,depositPercent,termDays);
   const lease=leaseQuote(price,termDays);
   const perVehicle=mode==='cash'?price+DRIVER_COST:mode==='finance'?quote.deposit+DRIVER_COST:lease.upfront+DRIVER_COST;
   const total=Math.round(perVehicle*quantity*100)/100;
   if(current.cash+pendingCashRef.current<total)throw Error('Insufficient company funds for the entire batch.');
   if(mode==='finance'&&(currentFleet.loans??[]).length+quantity>2)throw Error('Maximum two active loans, including vehicle finance.');
   if(mode==='finance'&&quote.principal*quantity>corporateCreditCapacity(currentFleet))throw Error('Batch exceeds available borrowing capacity.');
   const location=depotId==='main'?current.headquarters:current.depots?.find(d=>d.id===depotId);
   if(!location)throw Error('Delivery depot no longer exists.');
   const destination:[number,number]=[location.lng,location.lat];
   const node=nearest(graph,destination);
   const position=node?graph.nodes.get(node):undefined;
   if(!position||meters(position,destination)>1500)
    throw Error('Roads near '+deliveryDepot.name+' are not loaded. View that depot on the map before ordering.');
   const now=Date.now();
   const path=deliveryRoute(graph,position);
   const usedNames=new Set([...(currentFleet.drivers??[]).map(d=>d.name.toLowerCase()),...currentFleet.taxis.map(t=>t.driver.toLowerCase())]);
   const firstNames=['Alex','Maria','Nikos','Sofia','Dimitris','Elena','Andreas','Katerina','Petros','Anna','George','Irene','Lucas','Eva','Theo','Christina','Markos','Nina','Stavros','Lena'];
   const lastNames=['Papadopoulos','Georgiou','Nikolaou','Ioannou','Pappas','Vasileiou','Dimitriou','Karagiannis','Antoniou','Kostas','Martin','Smith','Brown','Wilson','Taylor','Murphy'];
   const drivers=Array.from({length:quantity},(_,i)=>{
    let name='';let attempt=0;
    do{const n=usedNames.size+i+attempt;name=firstNames[n%firstNames.length]+' '+lastNames[Math.floor(n/firstNames.length)%lastNames.length];attempt++;}while(usedNames.has(name.toLowerCase()));
    usedNames.add(name.toLowerCase());return {id:crypto.randomUUID(),name,hiredAt:now};
   });
   const existingNumbers=new Set(currentFleet.taxis.map(t=>t.name));
   let number=currentFleet.taxis.length+1;
   const taxis=drivers.map(d=>{
    while(existingNumbers.has('Taxi '+number))number++;
    const name='Taxi '+number++;existingNumbers.add(name);
    return {id:crypto.randomUUID(),name,ownership:mode==='lease'?'leased' as const:'owned' as const,driver:d.name,position,status:'IDLE' as const,path:[] as [number,number][],edgeIds:[] as string[],leg:0,distanceIntoLeg:0,fare:0,completed:0,purchasePrice:mode==='lease'?undefined:price,vehicleModel:offer.model,vehicleYear:offer.year,vehicleFuel:offer.fuel,vehicleTrim:offer.trim,vehicleOptionIds:offer.optionIds,vehiclePaintHex:offer.paintHex,vehicleRevenueBonus:offer.revenueBonus,vehicleClass:offer.className,vehicleCondition:offer.condition,vehicleMileage:offer.mileage,energyRemaining:energySpec({vehicleFuel:offer.fuel}).capacity,deliveryStartedAt:now,deliveryUntil:now+90_000,deliveryPath:path,depotId} satisfies Taxi;
   });
   const updated={...current,cash:Math.round((current.cash+pendingCashRef.current-total)*100)/100};
   pendingCashRef.current=0;companyRef.current=updated;saveCompany(updated);setCompany(updated);
   const loans=mode==='finance'?taxis.map(t=>({...createLoan(quote.principal,0.09,termDays),purpose:'vehicle' as const,vehicleId:t.id})):[];
   const leases=mode==='lease'?taxis.map(t=>({id:crypto.randomUUID(),vehicleId:t.id,vehicleName:t.name,dailyPayment:lease.daily,remainingDays:termDays,termDays,accruedGameSeconds:0,totalPaid:0})):[];
   const entries=taxis.flatMap(t=>[...(mode==='finance'?[bankEntry('Taxi finance disbursement · '+t.name,quote.principal,'operating','loan')]:[]),bankEntry((mode==='lease'?'Lease initiation · ':'Vehicle purchase · ')+t.name,-perVehicle,'operating','purchase')]);
   // Commit the reservation immediately; rapid consecutive orders must see
   // the first order before React's next render or the 5-second disk save.
   const ordered:FleetState={...currentFleet,taxis:[...currentFleet.taxis,...taxis],drivers:[...(currentFleet.drivers??[]),...drivers],loans:[...(currentFleet.loans??[]),...loans],leases:[...(currentFleet.leases??[]),...leases],leaseExpense:(currentFleet.leaseExpense??0)+(mode==='lease'?lease.upfront*quantity:0),bank:appendBankEntries(bankOf(currentFleet.bank),entries),transactions:[{id:crypto.randomUUID(),time:now,description:'Batch vehicle order · '+quantity+' × '+offer.model+' → '+deliveryDepot.name,amount:-total},...(currentFleet.transactions??[])].slice(0,100)};
   fleetSaveRef.current=ordered;
   setFleet(ordered);
   saveFleet(current.id,{...ordered,exploredEdgeIds:[]});
   setSimError('');
  }catch(error){setSimError(error instanceof Error?error.message:String(error));}
 };
 const buyTaxi=(driver:string,offer:VehicleOffer,mode:'cash'|'finance'|'lease'='cash',depositPercent=25,termDays=90,depotId='main')=>{if(!company||!graph)return;try{
  const currentFleet=fleetSaveRef.current;
  const deliveryDepot=requireDepotParking(company,currentFleet,depotId,1);
  if(!driver.trim())throw Error('Enter a driver name.');
  const discount=Research.level(research,'procurement')*0.04;
  const cost=Math.round((offer.price*(1-discount)+DRIVER_COST)*100)/100;
  if(![30,60,90,180].includes(termDays)||![10,20,25,30,40,50].includes(depositPercent))throw Error('Invalid finance terms.');
  const price=Math.round(offer.price*(1-discount)*100)/100;
  const quote=financeQuote(price,depositPercent,termDays);
  const lease=leaseQuote(price,termDays);
  const financed=mode==='finance'?quote.principal:0;
  const cashDue=mode==='cash'?cost:mode==='finance'?quote.deposit+DRIVER_COST:lease.upfront+DRIVER_COST;
  if(mode==='finance'&&(fleet.loans??[]).length>=2)throw Error('Maximum two active loans, including vehicle finance.');
  if(mode==='finance'&&financed>corporateCreditCapacity(fleet))throw Error('Borrowing limit of €75,000 exceeded.');
  if(company.cash+pendingCashRef.current<cashDue)throw Error('Insufficient company funds.');
  const location=depotId==='main'?company.headquarters:company.depots?.find(d=>d.id===depotId);
  if(!location)throw Error('Delivery depot no longer exists.');
  const destination:[number,number]=[location.lng,location.lat];
  const node=nearest(graph,destination);
  if(!node||meters(graph.nodes.get(node)!,destination)>1500)
   throw Error('Roads near '+deliveryDepot.name+' are not loaded. View that depot on the map before ordering.');
  const now=Date.now();
  const taxi:Taxi={id:crypto.randomUUID(),name:`Taxi ${fleet.taxis.length+1}`,ownership:mode==='lease'?'leased':'owned',driver:driver.trim(),position:graph.nodes.get(node)!,status:'IDLE',path:[],edgeIds:[],leg:0,distanceIntoLeg:0,fare:0,completed:0,
   purchasePrice:mode==='lease'?undefined:price,vehicleModel:offer.model,vehicleYear:offer.year,vehicleFuel:offer.fuel,vehicleTrim:offer.trim,vehicleOptionIds:offer.optionIds,vehicleRevenueBonus:offer.revenueBonus,vehicleClass:offer.className,vehicleCondition:offer.condition,vehicleMileage:offer.mileage,energyRemaining:energySpec({vehicleFuel:offer.fuel}).capacity,
   deliveryStartedAt:now,deliveryUntil:now+90_000,deliveryPath:deliveryRoute(graph,graph.nodes.get(node)!),depotId};
  const updated={...company,cash:Math.round((company.cash+pendingCashRef.current-cashDue)*100)/100};
  pendingCashRef.current=0;companyRef.current=updated;
  saveCompany(updated);setCompany(updated);
  const old=currentFleet;
  const ordered:FleetState={...old,
   loans:financed>0?[...(old.loans??[]),{...createLoan(financed,0.09,termDays),purpose:'vehicle' as const,vehicleId:taxi.id}]:old.loans,
   leases:mode==='lease'?[...(old.leases??[]),{id:crypto.randomUUID(),vehicleId:taxi.id,vehicleName:taxi.name,dailyPayment:lease.daily,remainingDays:termDays,termDays,accruedGameSeconds:0,totalPaid:0}]:old.leases,
   leaseExpense:(old.leaseExpense??0)+(mode==='lease'?lease.upfront:0),
   accounting:mode==='lease'?bookAccounting(old.accounting,periodMonth(gameClockRef.current?.epochMs??now),0,lease.upfront,0,0):old.accounting,
   financeHistory:mode==='lease'?(()=>{const day=new Date(gameClockRef.current?.epochMs??now).toISOString().slice(0,10);const list=[...(old.financeHistory??[])];const last=list[list.length-1];if(last?.day===day)list[list.length-1]={...last,expenses:last.expenses+lease.upfront};else list.push({day,revenue:0,expenses:lease.upfront,trips:0});return list.slice(-365);})():old.financeHistory,
   bank:appendBankEntries(bankOf(old.bank),[...(financed>0?[bankEntry('Taxi finance disbursement · '+taxi.name,financed,'operating','loan')]:[]),bankEntry((mode==='lease'?'Lease initiation · ':'Vehicle purchase · ')+taxi.name,-(mode==='lease'?cashDue:cost),'operating','purchase')]),
   transactions:[{id:crypto.randomUUID(),time:gameClockRef.current?.epochMs??now,taxiId:taxi.id,description:(mode==='lease'?'Lease initiation · ':'Vehicle purchase · ')+taxi.name+' → '+deliveryDepot.name,amount:-(mode==='lease'?cashDue:cost)},...(old.transactions??[])].slice(0,100),
   drivers:[...(old.drivers??[]),...((old.drivers??[]).some(d=>d.name.toLowerCase()===taxi.driver.toLowerCase())?[]:[{id:crypto.randomUUID(),name:taxi.driver,hiredAt:Date.now()}])],taxis:[...old.taxis,taxi]};
  fleetSaveRef.current=ordered;setFleet(ordered);
  saveFleet(company.id,{...ordered,exploredEdgeIds:[]});
  setSimError('');
 }catch(e){setSimError(e instanceof Error?e.message:String(e))}};
 const hireDriver=(name:string)=>{const cleaned=name.trim();if(!cleaned){setSimError('Enter a driver name.');return;}if((fleet.drivers??[]).some(d=>d.name.toLowerCase()===cleaned.toLowerCase())){setSimError('This driver is already employed.');return;}if(!companyRef.current||companyRef.current.cash+pendingCashRef.current<DRIVER_COST){setSimError('Insufficient funds to hire a driver.');return;}pendingCashRef.current-=DRIVER_COST;setFleet(old=>({...old,drivers:[...(old.drivers??[]),{id:crypto.randomUUID(),name:cleaned,hiredAt:Date.now()}],transactions:[{id:crypto.randomUUID(),time:gameClockRef.current?.epochMs??Date.now(),description:`Driver onboarding · ${cleaned}`,amount:-DRIVER_COST},...(old.transactions??[])].slice(0,100)}));setSimError('');};
 const dismissDriver=(driverId:string)=>{const person=(fleet.drivers??[]).find(d=>d.id===driverId);if(!person)return;if(fleet.taxis.some(t=>t.driver.toLowerCase()===person.name.toLowerCase())){setSimError('Reassign this driver before dismissal.');return;}setFleet(old=>({...old,drivers:(old.drivers??[]).filter(d=>d.id!==driverId)}));setSimError('');};
 const assignDriver=(id:string,name:string)=>{const driver=(fleet.drivers??[]).find(d=>d.name===name);const taxi=fleet.taxis.find(t=>t.id===id);if(!driver||!taxi){setSimError('Select an employed driver.');return;}if(taxi.status!=='IDLE'||(taxi.deliveryUntil??0)>Date.now()){setSimError('Taxi must be idle and delivered to reassign its driver.');return;}if(fleet.taxis.some(t=>t.id!==id&&t.driver.toLowerCase()===driver.name.toLowerCase())){setSimError('Driver is already assigned to another taxi.');return;}setFleet(old=>({...old,taxis:old.taxis.map(t=>t.id===id?{...t,driver:driver.name}:t)}));setSimError('');};
 const controlExplorer=(id:string,action:'home'|'resume'|'teleport')=>{
  if(action==='teleport'){
   const current=fleet.taxis.find(t=>t.id===id&&(t.kind==='explorer'||t.kind==='taxi'||!t.kind));
   if(!current||!company||!graph){setSimError('Vehicle or road network unavailable.');return;}
   if(current.ferryTrip||current.recoveryPending||
      (current.deliveryUntil&&current.deliveryUntil>Date.now())||
      recoveriesRef.current.some(job=>job.targetId===id)){
    setSimError('Finish the ferry, delivery or active recovery before teleporting.');return;
   }
   const assigned=(company.depots??[]).find(d=>d.id===current.depotId);
   const depotPoint:[number,number]=assigned?
    [assigned.lng,assigned.lat]:[company.headquarters.lng,company.headquarters.lat];
   // Both passenger taxis and explorers must reset onto an already
   // discovered road at their assigned depot, never a red road.
   const purple=resolvePurpleExplorerStart(graph,depotPoint,
    new Set(fleet.exploredEdgeIds??[]),undefined,80);
   if(!purple){
    setSimError('No discovered road is loaded at this depot. Explore or load its road tile first.');
    return;
   }
   const destination=graph.nodes.get(purple.node);
   if(!destination){setSimError('The depot road junction is not loaded.');return;}
   // Cancel pending routes and cached rest/fuel plans for the old position.
   operationalRoutesRef.current.delete(id);
   pendingFuelRef.current.delete(id);
   fuelPlanCacheRef.current.delete(id);
   shiftRestRetryRef.current.delete(id);
   for(const [key,pending] of pendingRoutesRef.current)
    if(pending.vehicleId===id)pendingRoutesRef.current.delete(key);
   manualRecoveryRequestsRef.current.delete(id);
   manualRecoveryPurposeRef.current.delete(id);
   resetVehicleTargetsRef.current.set(id,[...destination]);
   setFleet(old=>({...old,taxis:old.taxis.map(t=>
    t.id===id?resetVehicleAtDepot(t,destination):t)}));
   diagnostic('vehicle:reset-to-depot',`returned ${current.name} to assigned depot purple road`);
   setSimError('');
   return;
  }
  const explorer=fleet.taxis.find(t=>t.id===id&&t.kind==='explorer');
  if(!explorer||!graph||!company)return;
  if(action==='resume'){
   setFleet(old=>({...old,taxis:old.taxis.map(t=>t.id===id&&t.status==='PAUSED'?{...t,status:'IDLE' as const,pauseAtHome:false}:t)}));
   setSimError('');return;
  }
  if(explorer.status==='PAUSED'||(explorer.status==='RETURNING'&&explorer.pauseAtHome))return;
  const depot=(company.depots??[]).find(d=>d.id===explorer.depotId);
  const target:[number,number]=depot?[depot.lng,depot.lat]:[company.headquarters.lng,company.headquarters.lat];
  const worker=dispatchWorkerRef.current;
  if(!worker||!workerReadyRef.current){setSimError('Road routing is still loading. Try again shortly.');return;}
  for(const [key,pending] of pendingRoutesRef.current)if(pending.vehicleId===id)pendingRoutesRef.current.delete(key);
  const requestId=++routeSequenceRef.current;
  pendingRoutesRef.current.set(requestId,{vehicleId:id,position:[...explorer.position],status:explorer.status,onResult:(path,edgeIds)=>{
   if(!path||!edgeIds){setSimError('Cannot send Explorer home: no connected road route to headquarters.');return;}
   setFleet(old=>({...old,taxis:old.taxis.map(t=>t.id!==id?t:path.length<2?{...t,status:'PAUSED' as const,pauseAtHome:false,path:[],edgeIds:[],leg:0,distanceIntoLeg:0,speedKph:0}:{...t,status:'RETURNING' as const,pauseAtHome:true,refillDestination:undefined,path,edgeIds,leg:0,distanceIntoLeg:0,speedKph:0,journeyEdges:[]})}));
   setSimError('');
  }});
  worker.postMessage({type:'routeRequest',revision:graphRevisionRef.current,requestId,from:explorer.position,to:target});
 };
 const depots=company?.depots??[];
 const assignDepot=(id:string,depotId:string)=>{
  const taxi=fleet.taxis.find(t=>t.id===id);
  if(!taxi||taxi.status!=='IDLE'&&taxi.status!=='PAUSED'){setSimError('Vehicle must be idle or paused before changing depots.');return;}
  const target=depotId==='main'?null:depots.find(d=>d.id===depotId);
  if(depotId!=='main'&&!target)return;
  if((taxi.depotId??'main')===depotId)return;
  const parking=company?depotParkingChoices(company,fleet).find(d=>d.id===depotId):undefined;
  const capacity=taxi.kind==='explorer'?explorerDepotCapacity(upgradesFor(fleet,depotId),Research.level(research,'explorerExpansion')):(parking?.capacity??0);
  const occupied=taxi.kind==='explorer'
   ?fleet.taxis.filter(t=>t.id!==id&&(t.depotId??'main')===depotId&&t.kind==='explorer').length
   :(parking?.occupied??0);
  if(occupied>=capacity){setSimError('That depot has no available parking spaces.');return;}
  setFleet(old=>({...old,taxis:old.taxis.map(t=>t.id===id?{...t,depotId}:t)}));setSimError('');
 };
 const setAutoDepotService=(id:string,enabled:boolean)=>setFleet(old=>({...old,taxis:old.taxis.map(t=>t.id===id?{...t,autoDepotService:enabled}:t)}));
 const setVehiclePolicy=(id:string,policy:'economy'|'balanced'|'performance')=>setFleet(old=>({...old,taxis:old.taxis.map(t=>t.id===id?{...t,drivingPolicy:policy}:t)}));
 const setServiceThreshold=(id:string,threshold:number)=>setFleet(old=>({...old,taxis:old.taxis.map(t=>t.id===id?{...t,serviceThreshold:threshold}:t)}));
 const sellVehicle=(id:string)=>{
  const t=fleet.taxis.find(x=>x.id===id);if(!t||!companyRef.current)return;
  if(t.status!=='IDLE'&&t.status!=='PAUSED'){setSimError('Vehicle must be idle or parked before selling.');return;}
  if(t.deliveryUntil&&t.deliveryUntil>Date.now()){setSimError('Cannot sell a vehicle awaiting delivery.');return;}
  if(t.ownership==='leased'||(fleet.leases??[]).some(l=>l.vehicleId===id)){setSimError('Leased vehicles cannot be sold. The vehicle returns when the lease ends.');return;}
  const gameYear=new Date(gameClockRef.current?.epochMs??Date.now()).getUTCFullYear();const age=Math.max(0,gameYear-(t.vehicleYear??gameYear));
  const value=Math.max(1000,Math.round(15000*Math.pow(.88,age)*Math.pow(.92,(t.vehicleMileage??0)/30000)*(t.vehicleCondition??100)/100));
  const balance=(fleet.loans??[]).filter(l=>l.vehicleId===id).reduce((a,l)=>a+l.balance,0);
  if(value+companyRef.current.cash+pendingCashRef.current<balance){setSimError('Insufficient funds to settle outstanding vehicle finance.');return;}
  const proceeds=Math.round((value-balance)*100)/100;
  pendingCashRef.current+=proceeds;
  setFleet(old=>({...old,taxis:old.taxis.filter(x=>x.id!==id),loans:(old.loans??[]).filter(l=>l.vehicleId!==id),
   bank:appendBankEntries(bankOf(old.bank),[bankEntry('Vehicle sale · '+t.name,value,'operating','purchase'),...(balance>0?[bankEntry('Vehicle finance settlement · '+t.name,-balance,'operating','repayment')]:[])]),
   loanPrincipalPaid:(old.loanPrincipalPaid??0)+balance,
   transactions:[{id:crypto.randomUUID(),time:gameClockRef.current?.epochMs??Date.now(),taxiId:id,description:`${t.name} · vehicle sale (net of finance)`,amount:proceeds},...(old.transactions??[])].slice(0,100)}));setSimError('');
 };
 const repayVehicleLoan=(loanId:string)=>{
  const loan=(fleet.loans??[]).find(l=>l.id===loanId&&l.purpose==='vehicle');
  if(!loan||!companyRef.current)return;
  const amount=Math.round(loan.balance*100)/100;
  if(companyRef.current.cash+pendingCashRef.current<amount){setSimError('Insufficient operating cash to repay this loan.');return;}
  pendingCashRef.current-=amount;
  setFleet(old=>({...old,loans:(old.loans??[]).filter(l=>l.id!==loanId),loanPrincipalPaid:(old.loanPrincipalPaid??0)+amount,financePaymentsMade:(old.financePaymentsMade??0)+1,
   bank:appendBankEntries(bankOf(old.bank),[bankEntry('Early vehicle finance payoff',-amount,'operating','repayment')]),
   transactions:[{id:crypto.randomUUID(),time:gameClockRef.current?.epochMs??Date.now(),description:'Early vehicle finance payoff',amount:-amount},...(old.transactions??[])].slice(0,100)}));setSimError('');
 };
 const resumeDepotTaxi=(id:string)=>{setFleet(old=>({...old,taxis:old.taxis.map(t=>t.id===id&&t.status==='PAUSED'?{...t,status:'IDLE' as const,pauseAtHome:false}:t)}));setSimError('');};
 const returnToDepot=(id:string)=>{
  const taxi=fleet.taxis.find(t=>t.id===id);if(!taxi||!graph||!company||taxi.status!=='IDLE'&&taxi.status!=='PAUSED'){setSimError('Vehicle must be idle or paused to return to depot.');return;}
  const depot=depots.find(d=>d.id===taxi.depotId);
  const target:[number,number]=depot?[depot.lng,depot.lat]:[company.headquarters.lng,company.headquarters.lat];
  const start=nearest(graph,taxi.position),end=nearest(graph,target);if(!start||!end){setSimError('Depot roads are not loaded.');return;}
  const path=route(graph,start,end);if(!path){setSimError('No connected road route to assigned depot.');return;}
  setFleet(old=>({...old,taxis:old.taxis.map(t=>t.id!==id?t:path.path.length<2?{...t,status:'PAUSED' as const,pauseAtHome:false,path:[],edgeIds:[],speedKph:0}:{...t,status:'RETURNING' as const,pauseAtHome:true,path:path.path,edgeIds:path.edgeIds,leg:0,distanceIntoLeg:0,speedKph:0,refillDestination:undefined,journeyEdges:[]})}));setSimError('');
 };
 const upgradeDepot=(depotId:string,kind:DepotUpgradeKind)=>{
  if(!companyRef.current)return;
  if(depotId!=='main'&&!(companyRef.current.depots??[]).some(d=>d.id===depotId)){setSimError('Depot not found.');return;}
  const offer=DEPOT_UPGRADES.find(u=>u.id===kind);if(!offer)return;
  const level=upgradesFor(fleet,depotId)[kind]??0;
  if(level>=offer.max){setSimError('Maximum upgrade level reached.');return;}
  if(companyRef.current.cash+pendingCashRef.current<offer.cost){setSimError('Insufficient operating cash for depot upgrade.');return;}
  pendingCashRef.current-=offer.cost;
  setFleet(old=>({...old,depotUpgrades:{...old.depotUpgrades,[depotId]:{...upgradesFor(old,depotId),[kind]:(upgradesFor(old,depotId)[kind]??0)+1}},
    transactions:[{id:crypto.randomUUID(),time:gameClockRef.current?.epochMs??Date.now(),description:'Depot '+depotId+' · '+offer.name,amount:-offer.cost},...(old.transactions??[])].slice(0,100)}));
  setSimError('');
 };
 const addDepot=(location:Headquarters)=>{
  if(!companyRef.current||!graph)return;
  const cash=companyRef.current.cash+pendingCashRef.current;
  if(cash<10000){setSimError('A new depot costs €10,000.');return;}
  const node=nearest(graph,[location.lng,location.lat]);
  if(!node||meters(graph.nodes.get(node)!,[location.lng,location.lat])>1500){setSimError('Choose a location within 1.5 km of a loaded road.');return;}
  const point=graph.nodes.get(node)!;
  // The depot needs a genuinely routable OSM edge to let its specialists
  // depart. Seed that one real road purple, just like the initial HQ seed;
  // never create a shortcut across bridges, tunnels or disconnected roads.
  const initialRoad=(graph.edges.get(node)??[]).find(edge=>edge.meters>0&&!edge.taxiOnly);
  if(!initialRoad){setSimError('Choose a depot location with a connected, drivable road.');return;}
  const depot={id:crypto.randomUUID(),name:location.label||'New depot',lng:point[0],lat:point[1],capacity:5};
  const starterExplorers=createDepotStarterExplorers(depot.id,depot.name,point);
  const updated={...companyRef.current,depots:[...(companyRef.current.depots??[]),depot]};
  pendingCashRef.current-=10000;companyRef.current=updated;setCompany(updated);saveCompany(updated);
  // Grant AND save the five explorers in the same purchase operation.
  // Otherwise a reload, slow mobile render or older saved depot can leave
  // the building present without its free vehicles.
  const currentFleet=fleetSaveRef.current;
  const currentIds=currentFleet.exploredEdgeIds??[];
  const exploredEdgeIds=currentIds.includes(initialRoad.id)?currentIds:[...currentIds,initialRoad.id];
  const nextFleet:FleetState={...currentFleet,
   taxis:[...currentFleet.taxis,...starterExplorers],
   depotStarterExplorerGrants:{...currentFleet.depotStarterExplorerGrants,[depot.id]:true},
   exploredEdgeIds,
   transactions:[{id:crypto.randomUUID(),time:gameClockRef.current?.epochMs??Date.now(),description:`New depot · ${depot.name} · 5 starter explorers`,amount:-10000},...(currentFleet.transactions??[])].slice(0,100),
  };
  discoveredCacheRef.current={ids:exploredEdgeIds,set:new Set(exploredEdgeIds)};
  fleetSaveRef.current=nextFleet;
  setFleet(nextFleet);
  // The main 5-second save cycle remains, but the grant is durable now.
  saveFleet(updated.id,{...nextFleet,exploredEdgeIds:[]});
  void writeExploration(updated.id,{ids:[initialRoad.id],segments:{}}).catch(error=>
   diagnostic('depots:seed-save-failed',String(error)));
  diagnostic('depots:starter-explorers',`depot=${depot.id} name=${depot.name} vehicles=${starterExplorers.length} seedRoad=${initialRoad.id}`);
  setPlacingDepot(false);setSelecting(false);setPage('Company');setSimError('');
 };
 const resetVehicle=(id:string)=>{
  const vehicle=fleet.taxis.find(t=>t.id===id);
  if(!vehicle||!companyRef.current)return;
  const spec=energySpec(vehicle);
  const quantity=Math.max(0,spec.capacity-energyRemaining(vehicle));
  const fuelCost=Math.round(quantity*spec.pricePerUnit*((fleet.upgrades??[]).includes('fuel')?0.95:1)*100)/100;
  const serviceCost=150;
  const total=fuelCost+serviceCost;
  if(companyRef.current.cash+pendingCashRef.current<total){setSimError(`Reset requires €${total.toFixed(2)} for full ${spec.unit==='L'?'refuelling':'charging'} and service. Insufficient funds.`);return;}
  const remaining=recoveriesRef.current.filter(job=>job.targetId!==id);
  if(remaining.length!==recoveriesRef.current.length){recoveriesRef.current=remaining;setRecoveries(remaining);}
  idleWatch.current.delete(id);
  pendingCashRef.current-=total;
  const now=Date.now();
  setFleet(old=>({...old,
   fuelExpense:(old.fuelExpense??0)+fuelCost,
   serviceExpense:(old.serviceExpense??0)+serviceCost,
   transactions:[
    {id:crypto.randomUUID(),time:now,taxiId:id,description:`${vehicle.name} · reset ${spec.unit==='L'?'refuel':'recharge'} (${quantity.toFixed(1)} ${spec.unit})`,amount:-fuelCost},
    {id:crypto.randomUUID(),time:now,taxiId:id,description:`${vehicle.name} · reset full service`,amount:-serviceCost},
    ...(old.transactions??[])
   ].slice(0,100),
   taxis:old.taxis.map(t=>t.id!==id?t:{...t,
    status:'IDLE' as const,path:[],edgeIds:[],leg:0,distanceIntoLeg:0,speedKph:0,
    journeyEdges:[],pickup:undefined,dropoff:undefined,fare:0,
    recoveryPending:false,refillDestination:undefined,refillAtDepot:undefined,refillUntil:undefined,
    serviceDestination:undefined,serviceUntil:undefined,pauseAtHome:false,shiftParked:false,
    refillRequested:false,energyRemaining:spec.capacity,energyPurchased:(t.energyPurchased??0)+quantity,
    fuelExpense:(t.fuelExpense??0)+fuelCost,vehicleCondition:100,
    serviceCount:(t.serviceCount??0)+1,lastServiceKm:t.operatingKm??0
   })}));
  setSimError('');
 };
 const refillTaxi=(id:string)=>{const taxi=fleet.taxis.find(t=>t.id===id);if(!taxi||!companyRef.current)return;
  if(taxi.status!=='IDLE'||(taxi.deliveryUntil??0)>Date.now()){setSimError('Vehicle must be idle and delivered to refuel or recharge.');return;}
  const spec=energySpec(taxi),quantity=Math.max(0,spec.capacity-energyRemaining(taxi));
  const discount=(fleet.upgrades??[]).includes('fuel')?0.95:1;
  const cost=Math.round(quantity*spec.pricePerUnit*discount*100)/100;
  if(quantity<0.01){setSimError('Tank or battery is already full.');return;}
  if(companyRef.current.cash+pendingCashRef.current<cost){setSimError(`Insufficient funds to ${spec.unit==='L'?'refuel':'recharge'} (€${cost.toFixed(2)}).`);return;}
  pendingCashRef.current-=cost;
  setFleet(old=>({...old,fuelExpense:(old.fuelExpense??0)+cost,transactions:[{id:crypto.randomUUID(),time:gameClockRef.current?.epochMs??Date.now(),taxiId:id,description:`${taxi.name} · ${spec.unit==='L'?'fuel purchase':'electricity purchase'} (${quantity.toFixed(1)} ${spec.unit})`,amount:-cost},...(old.transactions??[])].slice(0,100),taxis:old.taxis.map(t=>t.id===id?{...t,energyRemaining:spec.capacity,energyPurchased:(t.energyPurchased??0)+quantity,fuelExpense:(t.fuelExpense??0)+cost}:t)}));
  setSimError('');
 };
 const serviceTaxi=(id:string)=>{if(!companyRef.current)return;const taxi=fleet.taxis.find(t=>t.id===id);if(!taxi||taxi.deliveryUntil&&taxi.deliveryUntil>Date.now()||taxi.status!=="IDLE"){setSimError("Taxi must be idle and delivered before servicing.");return;}const cost=150;if(companyRef.current.cash+pendingCashRef.current<cost){setSimError("Insufficient funds for servicing (€150).");return;}pendingCashRef.current-=cost;setFleet(old=>({...old,serviceExpense:(old.serviceExpense??0)+cost,transactions:[{id:crypto.randomUUID(),time:gameClockRef.current?.epochMs??Date.now(),taxiId:id,description:`${taxi.name} · scheduled service`,amount:-cost},...(old.transactions??[])].slice(0,100),taxis:old.taxis.map(t=>t.id===id?{...t,vehicleCondition:Math.min(100,(t.vehicleCondition??100)+20),serviceCount:(t.serviceCount??0)+1,lastServiceKm:t.operatingKm??0}:t)}));setSimError("");};
 const acceptBankPartnership=(bankId:string,request:number,share:number)=>{
  const current=companyRef.current;
  if(!current)return;
  const state=fleetSaveRef.current;
  const clock=gameClockRef.current?.epochMs??Date.now();
  const valuation=valueCompany(current,state,clock).value;
  const score=securedQuote(current,state,clock,1000,365).score;
  const offer=partnershipOffer(bankId,request,valuation,revenueAverage(state.financeHistory??[]),score,state.bankPartnerships??[],share);
  if(!offer.approved){setSimError(offer.reason);return;}
  const contract:BankPartnership={id:crypto.randomUUID(),bank:offer.bank,
   principal:offer.funding,revenueShare:offer.revenueShare,
   repaymentMultiple:offer.repaymentMultiple,repaymentCap:offer.repaymentCap,repaid:0,startedAt:clock};
  pendingCashRef.current+=offer.funding;
  setFleet(old=>({...old,bankPartnerships:[...(old.bankPartnerships??[]),contract],
   bank:appendBankEntries(bankOf(old.bank),[bankEntry('Bank partnership funding · '+offer.bank,offer.funding,'operating','loan')]),
   transactions:[{id:crypto.randomUUID(),time:clock,description:'Revenue partnership funding · '+offer.bank,amount:offer.funding},...(old.transactions??[])].slice(0,100)}));
  setSimError('');
 };
 const buyOutBankPartnership=(id:string)=>{
  const current=companyRef.current;
  const contract=fleetSaveRef.current.bankPartnerships?.find(d=>d.id===id);
  if(!current||!contract)return;
  const remaining=Math.max(0,Math.round((contract.repaymentCap-contract.repaid)*100)/100);
  if(remaining<=0)return;
  if(current.cash+pendingCashRef.current<remaining){setSimError('Insufficient operating cash to buy out the partnership.');return;}
  pendingCashRef.current-=remaining;
  setFleet(old=>({...old,bankPartnerships:(old.bankPartnerships??[]).map(d=>d.id===id?{...d,repaid:d.repaymentCap}:d),
   bankPartnershipPaid:(old.bankPartnershipPaid??0)+remaining,
   bank:appendBankEntries(bankOf(old.bank),[bankEntry('Bank partnership buyout · '+contract.bank,-remaining,'operating','repayment')]),
   transactions:[{id:crypto.randomUUID(),time:gameClockRef.current?.epochMs??Date.now(),description:'Bank partnership buyout · '+contract.bank,amount:-remaining},...(old.transactions??[])].slice(0,100)}));
  setSimError('');
 };
 const takeLoan=(amount:number,days:number)=>{
  const current=companyRef.current;
  if(!current)return;
  // The UI quote is informational: compute approval again at submission.
  const loanAmount=Math.round(amount*100)/100;
  const gameNow=gameClockRef.current?.epochMs??Date.now();
  const quote=securedQuote({...current,cash:current.cash+pendingCashRef.current},
   fleetSaveRef.current,gameNow,loanAmount,days);
  if(!quote.approved){
   setSimError('Loan declined: check your asset-backed limit, credit score, amount and term.');
   return;
  }
  pendingCashRef.current+=loanAmount;
  setFleet(old=>({...old,
   bank:appendBankEntries(bankOf(old.bank),[
    bankEntry('Secured business loan disbursement',loanAmount,'operating','loan')]),
   loans:[...(old.loans??[]),createSecuredLoan(loanAmount,quote.rate,days)],
   transactions:[{id:crypto.randomUUID(),time:gameNow,
    description:`Secured loan approved · ${days} game days · ${(quote.rate*100).toFixed(1)}%`,
    amount:loanAmount},...(old.transactions??[])].slice(0,100)
  }));
  setSimError('');
 };
 const buyUpgrade=(id:EconomyUpgrade)=>{const offer=UPGRADES.find(u=>u.id===id);if(!offer||!companyRef.current)return;
  if((fleet.upgrades??[]).includes(id))return;
  if(companyRef.current.cash+pendingCashRef.current<offer.cost){setSimError('Insufficient cash for this upgrade.');return;}
  pendingCashRef.current-=offer.cost;
  setFleet(old=>({...old,upgrades:[...(old.upgrades??[]),id],transactions:[{id:crypto.randomUUID(),time:gameClockRef.current?.epochMs??Date.now(),description:offer.name,amount:-offer.cost},...(old.transactions??[])].slice(0,100)}));setSimError('');};
 const [harbourNetwork,setHarbourNetwork]=useState<FerryNetwork|null>(null);
 const reloadHarbourNetwork=async()=>{
  const data=await loadFerryNetwork(undefined,true);
  harbourPoiRef.current=data.ports.map(p=>p.roadAccess??p.position);
  setHarbourNetwork(data);
 };
 const [unlockedHarbours,setUnlockedHarbours]=useState<string[]>([]);
 // Service Explorers no longer chase harbour markers. Preserve the saved
 // vehicle and discovered roads, but clear obsolete POI mission assignments.
 useEffect(()=>{
  harbourMissionsRef.current=[];
  harbourCandidatesRef.current=[];
  harbourPrefetchProgressRef.current.clear();
  if(!company)return;
  setFleet(old=>{
   if(!old.taxis.some(t=>t.explorerRole==='poi'&&(t.poiTargetId||t.poiTargetName)))return old;
   return {...old,taxis:old.taxis.map(t=>t.explorerRole==='poi'
    ?{...t,poiTargetId:undefined,poiTargetName:undefined}:t)};
  });
 },[company?.id]);
 const [harbourNotice,setHarbourNotice]=useState<{id:string;name:string}|null>(null);
 const harbourSeenRef=useRef(false);
 useEffect(()=>{let cancelled=false;void loadFerryNetwork().then(data=>{if(!cancelled){harbourPoiRef.current=data.ports.map(p=>p.roadAccess??p.position);setHarbourNetwork(data)}}).catch(console.warn);return()=>{cancelled=true}},[]);

 // Automatic explorer ferry passenger tickets: never require route ownership.
 useEffect(()=>{
  ferryReadinessRef.current.clear();ferryBookingRef.current.clear();ferryAttemptRef.current.clear();
  if(!company?.id||!graph||!harbourNetwork)return;
  const companyId=company.id;
  const timer=window.setInterval(()=>{
   if(document.visibilityState==='hidden'||!workerReadyRef.current||!dispatchWorkerRef.current)return;
   if(companyRef.current?.id!==companyId)return;
   const now=Date.now();
   // A discarded worker request must not permanently block a stranded scout.
   for(const id of ferryBookingRef.current){
    if(now-(ferryAttemptRef.current.get(id)??now)>45000)ferryBookingRef.current.delete(id);
   }
   const discovered=discoveredCacheRef.current?.set??new Set(fleetSaveRef.current.exploredEdgeIds??[]);
   const candidates=taxisRef.current.filter(t=>{
    const signal=ferryReadinessRef.current.get(t.id);
    return t.kind==='explorer'&&t.status==='IDLE'&&!t.ferryTrip&&!t.refillRequested&&
     !t.recoveryPending&&!t.deliveryUntil&&energyPercent(t)>15&&
     !!signal&&signal.ready&&signal.idleMs>=90000&&!ferryBookingRef.current.has(t.id)&&
     now-(ferryAttemptRef.current.get(t.id)??0)>25000;
   }).slice(0,2);
   for(const scout of candidates){
    ferryAttemptRef.current.set(scout.id,now);
    // Preload only nearby linked destination harbours. When road data is not
    // present yet, retry on a subsequent scan rather than jumping across water.
    const starts=harbourNetwork.ports
     .filter(p=>meters(scout.position,p.roadAccess??p.position)<=7500)
     .sort((a,b)=>meters(scout.position,a.roadAccess??a.position)-meters(scout.position,b.roadAccess??b.position))
     .slice(0,3);
    let queued=0;
    for(const start of starts){
     for(const link of harbourNetwork.routes){
      if(queued>=4)break;
      const destinationId=link.from===start.id?link.to:link.to===start.id?link.from:null;
      if(!destinationId)continue;
      const port=harbourNetwork.ports.find(p=>p.id===destinationId);
      if(port){networkRef.current?.considerHarbour(port.roadAccess??port.position);queued++;}
     }
    }
    const offer=choosePassengerFerry(scout,harbourNetwork,graph,discovered);
    if(!offer)continue;
    const worker=dispatchWorkerRef.current;
    if(!worker)continue;
    ferryBookingRef.current.add(scout.id);
    const requestId=++routeSequenceRef.current;
    pendingRoutesRef.current.set(requestId,{vehicleId:scout.id,position:[...scout.position],status:'IDLE',
     onResult:(path,edgeIds)=>{
      ferryBookingRef.current.delete(scout.id);
      if(!path||!edgeIds||!path.length)return;
      const latest=taxisRef.current.find(t=>t.id===scout.id);
      const current=companyRef.current;
      if(!latest||latest.status!=='IDLE'||latest.ferryTrip||!current||current.id!==companyId)return;
      // The visual ferry and passenger ticket must share the exact same
      // ship orientation and clock. Unowned routes use a permanent public
      // timetable; owned routes use the company vessel's saved start.
      const routeInfo=harbourNetwork.routes.find(r=>r.id===offer.routeId);
      const portFrom=harbourNetwork.ports.find(p=>p.id===routeInfo?.from);
      const portTo=harbourNetwork.ports.find(p=>p.id===routeInfo?.to);
      if(!routeInfo||!portFrom||!portTo)return;
      const home:[number,number]=[current.headquarters.lng,current.headquarters.lat];
      const startsAtFrom=ferryStartsAtFrom(portFrom.position,portTo.position,home);
      const initialPortId=startsAtFrom?routeInfo.from:routeInfo.to;
      const fromInitialPort=offer.fromPortId===initialPortId;
      const serviceStart=(current.purchasedFerryRouteIds??[]).includes(offer.routeId)
       ?current.ferryServiceStartedAt?.[offer.routeId]??PUBLIC_PASSENGER_FERRY_EPOCH_MS
       :PUBLIC_PASSENGER_FERRY_EPOCH_MS;
      const fare=offer.ticketEuros;
      if(current.cash+pendingCashRef.current<fare){
       diagnostic('explorers:ferry-ticket','insufficient funds for '+scout.id);return;
      }
      const updated={...current,cash:Math.round((current.cash+pendingCashRef.current-fare)*100)/100};
      pendingCashRef.current=0;companyRef.current=updated;saveCompany(updated);setCompany(updated);
      setFleet(old=>({...old,
       explorationExpense:(old.explorationExpense??0)+fare,
       transactions:[{id:crypto.randomUUID(),time:gameClockRef.current?.epochMs??Date.now(),
        taxiId:scout.id,description:`${scout.name} · passenger ferry ticket · ${offer.routeId}`,amount:-fare},
        ...(old.transactions??[])].slice(0,100),
       taxis:old.taxis.map(t=>t.id!==scout.id?t:{
        ...t,status:'RETURNING' as const,pauseAtHome:false,shiftParked:false,
        path,edgeIds,leg:0,distanceIntoLeg:0,speedKph:0,journeyEdges:[],
        ferryTrip:{stage:'boarding' as const,routeId:offer.routeId,
         fromPortId:offer.fromPortId,toPortId:offer.toPortId,
         boarding:offer.boarding,
         geometry:offer.geometry,destination:offer.destination,
         durationGameMs:Math.max(1,offer.durationMinutes)*60000,ticketEuros:fare,
         serviceStartGameMs:serviceStart,fromInitialPort,seedRoadId:offer.seedRoadId}
       })
      }));
      networkRef.current?.considerHarbour(offer.destination);
      diagnostic('explorers:ferry-booked',`vehicle=${scout.id} route=${offer.routeId} fare=${fare} durationMin=${offer.durationMinutes}`);
     }});
    worker.postMessage({type:'routeRequest',revision:graphRevisionRef.current,requestId,from:scout.position,to:offer.boarding,discoveredOnly:true});
    break; // At most one passenger ticket route search per scan.
   }
  },12000);
  return()=>window.clearInterval(timer);
 },[company?.id,graph,harbourNetwork]);

 useEffect(()=>{
  harbourSeenRef.current=false;setHarbourNotice(null);setUnlockedHarbours([]);
 },[company?.id]);
 const [harbourEdges,setHarbourEdges]=useState<Map<string,string[]>|null>(null);
 useEffect(()=>{
  setHarbourEdges(null);
  if(!harbourNetwork||!graph)return;
  const controller=new AbortController();
  let indexing=false;
  let lastIndexedNodes=-1;
  let lastIndexedEdgeNodes=-1;
  // The road graph is expanded IN PLACE when new tiles arrive: 'graph' itself
  // does not change identity. Re-index periodically so newly loaded harbour
  // access roads can unlock ports without a full page refresh.
  const update=async()=>{
   if(indexing||controller.signal.aborted)return;
   const nodes=graph.nodeKeys.length,edgeNodes=graph.edges.size;
   if(nodes===lastIndexedNodes&&edgeNodes===lastIndexedEdgeNodes)return;
   indexing=true;
   try{
    const result=await harbourRoadEdges(harbourNetwork,graph,controller.signal);
    if(!controller.signal.aborted){
     lastIndexedNodes=nodes;lastIndexedEdgeNodes=edgeNodes;
     setHarbourEdges(result);
    }
   }catch(error){
    if(!controller.signal.aborted)console.error('Harbour road indexing failed',error);
   }finally{indexing=false;}
  };
  void update();
  const timer=window.setInterval(()=>{void update()},12000);
  return()=>{controller.abort();window.clearInterval(timer)};
 },[harbourNetwork,graph]);
 // Changes only when a completed passenger-ferry trip records a new port.
 // Do not re-run the expensive harbour road-index scan on every vehicle tick.
 const ferryVisitedPortsKey=fleet.taxis.flatMap(t=>t.ferryVisitedPorts??[]).join('|');
 useEffect(()=>{
  if(!company||!harbourNetwork)return;
  // Unlocks are permanent achievements. Never revoke them when a road tile
  // unloads, the graph rebuilds, or an old discovered segment is not in
  // today's local index. Persist previously saved achievements and merge new
  // verified segments instead of replacing the entire history.
  const knownPorts=new Set(harbourNetwork.ports.map(p=>p.id));
  const earned=new Set<string>();
  try{
   const saved=JSON.parse(localStorage.getItem(harbourStorageKey(company.id))??'[]') as unknown;
   if(Array.isArray(saved))for(const id of saved)
    if(typeof id==='string'&&knownPorts.has(id))earned.add(id);
  }catch{}
  for(const id of unlockedHarbours)if(knownPorts.has(id))earned.add(id);
  // Ferry passengers physically arriving at a destination also unlock it.
  // These port IDs are recorded only at completed vehicle ferry crossings.
  for(const taxi of fleet.taxis)for(const id of taxi.ferryVisitedPorts??[])
   if(knownPorts.has(id))earned.add(id);
  const discovered=discoveredCacheRef.current?.set??new Set(fleet.exploredEdgeIds??[]);
  // A purchased ferry route does not grant harbour access. Do not infer an
  // unlocked terminal from route endpoints when the road index is incomplete.
  // Historical achievements remain saved; only real road discovery or ferry
  // arrivals can grant additional unlocks.
  const newlyUnlocked:string[]=[];
  // A POI mission may physically arrive at its mapped terminal access even
  // when the static OSM harbour-to-road index selected a different berth
  // spur. Count a REAL explorer arriving on the driven road network; a map
  // viewport or proximity of some unrelated vehicle never unlocks a port.
  for(const mission of harbourMissionsRef.current){
   if(earned.has(mission.portId))continue;
   const vehicle=fleet.taxis.find(t=>t.id===mission.vehicleId);
   const port=harbourNetwork.ports.find(p=>p.id===mission.portId);
   if(!vehicle||!port||vehicle.explorerRole!=='poi'||vehicle.poiTargetId!==port.id)continue;
   const radius=port.roadAccess?125:180;
   if(meters(vehicle.position,port.roadAccess??port.position)>radius)continue;
   // Require a completed, recorded access road, not just a vehicle marker
   // that starts near the port before driving anything.
   const edges=harbourEdges?.get(port.id)??[];
   if(!edges.some(id=>discovered.has(id)))continue;
   earned.add(port.id);newlyUnlocked.push(port.id);
  }
  for(const [id,edges] of harbourEdges??[]){
   if(!knownPorts.has(id)||earned.has(id))continue;
   if(edges.some(edge=>discovered.has(edge))){
    earned.add(id);newlyUnlocked.push(id);
   }
  }
  const next=[...earned];
  if(next.length!==unlockedHarbours.length||next.some(id=>!unlockedHarbours.includes(id)))
   setUnlockedHarbours(next);
  try{
   const key=harbourStorageKey(company.id);
   const encoded=JSON.stringify(next);
   if(localStorage.getItem(key)!==encoded)localStorage.setItem(key,encoded);
  }catch{}
  if(harbourSeenRef.current&&newlyUnlocked.length){
   const port=harbourNetwork.ports.find(p=>p.id===newlyUnlocked[0]);
   if(port)setHarbourNotice({id:port.id,name:englishFerryName(port.name)});
  }
  harbourSeenRef.current=true;
 },[company?.id,company?.purchasedFerryRouteIds,harbourEdges,harbourNetwork,fleet.exploredEdgeIds,ferryVisitedPortsKey,unlockedHarbours]);
 // Show a single end-of-day report when the accelerated game clock passes midnight.
 // Baselines are company-specific and saved separately from the fleet so restarting
 // Safari cannot repeatedly generate the same daily report.
 const [dailyReport,setDailyReport]=useState<DailySummary|null>(null);
 const dailyBaselineRef=useRef<ReturnType<typeof dayBaseline>|null>(null);
 useEffect(()=>{dailyBaselineRef.current=null;setDailyReport(null)},[company?.id]);
 useEffect(()=>{
  if(!company||!gameClock)return;
  const day=gameDay(gameClock.epochMs);
  const baseline=dailyBaselineRef.current??readSummaryBaseline(company.id);
  const snapshotFleet=fleetSaveRef.current;
  const currentCash=(companyRef.current?.cash??company.cash)+pendingCashRef.current;
  if(!baseline){
   const first=dayBaseline(day,snapshotFleet,currentCash,unlockedHarbours.length);
   dailyBaselineRef.current=first;saveSummaryBaseline(company.id,first);
   return;
  }
  dailyBaselineRef.current=baseline;
  if(baseline.day>=day)return;
  // Offline skips can span days; only generate a report for a day that
  // actually reached midnight during the current session.
  const elapsed=(Date.parse(day+'T00:00:00Z')-Date.parse(baseline.day+'T00:00:00Z'))/86400000;
  if(elapsed===1){
   const report=buildDailySummary(baseline.day,snapshotFleet,baseline,currentCash,unlockedHarbours.length);
   setDailyReport(report);
   try{localStorage.setItem('travelempire.lastDailyReport.v1.'+company.id,JSON.stringify(report))}catch{}
  }
  const next=dayBaseline(day,snapshotFleet,currentCash,unlockedHarbours.length);
  dailyBaselineRef.current=next;saveSummaryBaseline(company.id,next);
 },[company?.id,gameClock?.epochMs,unlockedHarbours.length]);
 // POI explorers return to their depot after the full harbour network is unlocked.
 // Keep the retirement request stable across simulation updates and page changes.
 const harbourRetireRequestedRef=useRef(new Set<string>());
 useEffect(()=>{
  if(!company||!graph||!harbourNetwork||!harbourEdges||!harbourNetwork.ports.length)return;
  const allPorts=harbourNetwork.ports;
  // Do not retire based on a partially loaded road index.
  if(allPorts.some(port=>!harbourEdges.has(port.id)))return;
  const discovered=discoveredCacheRef.current?.set??new Set(fleet.exploredEdgeIds??[]);
  if(allPorts.some(port=>!(harbourEdges.get(port.id)??[]).some(edge=>discovered.has(edge))))return;
  for(const explorer of fleet.taxis){
   if(explorer.kind!=='explorer'||explorer.explorerRole!=='poi')continue;
   if(harbourRetireRequestedRef.current.has(explorer.id))continue;
   harbourRetireRequestedRef.current.add(explorer.id);
   if(explorer.status==='PAUSED'||explorer.status==='IDLE'){
    const assigned=(company.depots??[]).find(d=>d.id===explorer.depotId);
    const home:[number,number]=assigned?[assigned.lng,assigned.lat]:[company.headquarters.lng,company.headquarters.lat];
    if(meters(explorer.position,home)<150){
     setFleet(old=>({...old,taxis:old.taxis.map(t=>t.id===explorer.id?{...t,status:'PAUSED' as const,shiftParked:true}:t)}));
     continue;
    }
   }
   controlExplorer(explorer.id,'home');
  }
 },[company?.id,graph,harbourNetwork,harbourEdges,fleet.taxis,fleet.exploredEdgeIds]);
 const setFerryTicketPrice=(routeId:string,fare:number)=>{const current=companyRef.current;if(!current||!(current.purchasedFerryRouteIds??[]).includes(routeId)||!Number.isFinite(fare))return;const value=Math.max(1,Math.min(100,Math.round(fare*2)/2));const updated={...current,ferryTicketPrices:{...(current.ferryTicketPrices??{}),[routeId]:value}};companyRef.current=updated;saveCompany(updated);setCompany(updated);};
 const purchaseFerryRoute=(routeId:string,_displayedPrice:number)=>{const current=companyRef.current;const price=ferryRoutePrice(routeId);if(!current||!Number.isFinite(price)||current.cash<price||(current.purchasedFerryRouteIds??[]).includes(routeId))return;const updated={...current,cash:Math.round((current.cash-price)*100)/100,purchasedFerryRouteIds:[...(current.purchasedFerryRouteIds??[]),routeId],ferryServiceStartedAt:{...(current.ferryServiceStartedAt??{}),[routeId]:gameClockRef.current?.epochMs??Date.now()},ferryLastPaidVoyage:{...(current.ferryLastPaidVoyage??{}),[routeId]:0}};companyRef.current=updated;saveCompany(updated);setCompany(updated);setFleet(old=>({...old,transactions:[{id:crypto.randomUUID(),time:gameClockRef.current?.epochMs??Date.now(),description:'Ferry route purchase · '+routeId,amount:-price},...(old.transactions??[])].slice(0,100)}));};
 const investInProperty=(poi:InvestablePOI,amountEuros:number):string|null=>{
  const current=companyRef.current,clock=gameClockRef.current;
  if(!current||!clock)return 'Create a company before buying property shares.';
  const cost=Math.round(amountEuros*100);
  if(!Number.isFinite(amountEuros)||!Number.isSafeInteger(cost)||cost<=0||
    Math.abs(amountEuros*100-cost)>0.000001)return 'Invalid investment amount.';
  const available=Math.round((current.cash+pendingCashRef.current)*100);
  if(cost>available)return 'Insufficient company cash.';
  let next;
  try{
   next=buyPropertyShare(portfolioRef.current,poi,cost,clock.epochMs);
   savePortfolio(current.id,next);
  }catch(error){return error instanceof Error?error.message:'Investment could not be saved.';}
  portfolioRef.current=next;setPortfolio(next);
  const updated={...current,cash:Math.round((current.cash+pendingCashRef.current)*100-cost)/100};
  pendingCashRef.current=0;
  companyRef.current=updated;saveCompany(updated);setCompany(updated);
  setFleet(old=>({...old,transactions:[{
   id:crypto.randomUUID(),time:clock.epochMs,
   description:`Property shares · ${poi.name||poi.kind}`,amount:-amountEuros
  },...(old.transactions??[])].slice(0,100)}));
  setInvestmentError('');
  return null;
 };
 // Fractional-property dividends settle once per completed simulated hour.
 useEffect(()=>{
  if(!company?.id)return;
  const companyId=company.id;
  const settle=()=>{
   if(document.visibilityState==='hidden'||companyRef.current?.id!==companyId)return;
   const now=gameClockRef.current?.epochMs;if(now===undefined)return;
   const result=settlePropertyDividends(portfolioRef.current,now);
   if(result.portfolio===portfolioRef.current)return;
   try{savePortfolio(companyId,result.portfolio)}catch(error){diagnostic('investments:save-error',String(error));return;}
   portfolioRef.current=result.portfolio;setPortfolio(result.portfolio);
   if(result.incomeCents>0){
    const income=Math.round(result.incomeCents)/100;
    // Persist the cash credit immediately alongside the settled-hour marker.
    // A Safari restart must not drop a pending dividend after its hour is marked paid.
    const current=companyRef.current;
    if(current&&current.id===companyId){
     const pendingBeforeDividend=pendingCashRef.current;
     const updated={...current,cash:Math.round((current.cash+pendingBeforeDividend+income)*100)/100};
     pendingCashRef.current=0;
     recordFinancialAudit({gameTime:new Date(now).toISOString(),kind:'property',description:'Property income '+result.hours+' simulated hour(s), includes pending flush',gross:income,operatingCost:0,bankShare:0,savings:0,other:0,cashBefore:current.cash,cashAfter:updated.cash,pendingBefore:pendingBeforeDividend,pendingAfter:0});
     companyRef.current=updated;saveCompany(updated);setCompany(updated);
    }
    setFleet(old=>{
     const date=new Date(now).toISOString().slice(0,10);
     const history=[...(old.financeHistory??[])];
     const previous=history[history.length-1];
     if(previous?.day===date)history[history.length-1]={...previous,revenue:previous.revenue+income};
     else history.push({day:date,revenue:income,expenses:0,trips:0});
     return {...old,
      accounting:bookAccounting(old.accounting,periodMonth(now),income,0,0,0),
      financeHistory:history.slice(-365),
      transactions:[{id:crypto.randomUUID(),time:now,description:`Property income · ${result.hours} simulated hour(s)`,amount:income},...(old.transactions??[])].slice(0,100)
     };
    });
    diagnostic('investments:dividends',`amount=${income.toFixed(2)} hours=${result.hours}`);
   }
  };
  const timer=window.setInterval(settle,10000);return()=>window.clearInterval(timer);
 },[company?.id]);
 const go=(name:Page)=>{setPage(name);setConsoleOpen(false);setDrawerOpen(false);};
 const onLocation=(value:Headquarters)=>{if(placingDepot){addDepot(value);return;}setSelection(value);setSelecting(false);setPage('Company');setShowSetup(true);};
 const activeResearch=research.active;
 const activeResearchProject=activeResearch?Research.projects.find(project=>project.id===activeResearch.id):undefined;
 const researchGameNow=gameClock?.epochMs??Date.now();
 const researchProgress=activeResearch?Math.max(0,Math.min(100,100*(researchGameNow-activeResearch.startedAt)/Math.max(1,activeResearch.endsAt-activeResearch.startedAt))):0;
 const researchRemaining=activeResearch?Math.max(0,activeResearch.endsAt-researchGameNow):0;
 const researchRemainingLabel=researchRemaining>=3600000?`${Math.ceil(researchRemaining/3600000)}h remaining`:`${Math.ceil(researchRemaining/60000)}m remaining`;
 const dailyReportCredit=company&&dailyReport?securedQuote(company,fleet,gameClock?.epochMs??Date.now(),1000,365):null;
 const ownedMapProperties=useMemo(()=>Object.values(portfolio.holdings).filter(h=>h.investedCents>0),[portfolio]);
 const parkingByDepot=new Map((company?depotParkingChoices(company,fleet):[]).map(p=>[p.id,p]));
 return <div className={`shell nav-v216 ${sidebarCollapsed?'nav-collapsed':''} ${page==='World'&&!consoleOpen?'nav-map-mode':''}`}><aside className={`sidebar ${drawerOpen?'open':''}`}><header className="brand"><div className="brand-mark"><CarFront size={23}/></div><div className="nav-brand-copy"><strong>TravelEmpire</strong><small>v2.1.6 · MANAGEMENT</small></div><button className="nav-collapse-button" title={sidebarCollapsed?'Expand sidebar':'Collapse sidebar'} aria-label={sidebarCollapsed?'Expand sidebar':'Collapse sidebar'} onClick={()=>setSidebarCollapsed(v=>!v)}>{sidebarCollapsed?<PanelLeftOpen size={18}/>:<PanelLeftClose size={18}/>}</button><button className="close-menu" aria-label="Close menu" onClick={()=>setDrawerOpen(false)}><X size={19}/></button></header><nav className="navigation" aria-label="Main navigation"><div className="nav-group-label">OPERATIONS</div>{navigation.filter(n=>['World','Fleet','Dealership','Drivers','Operations','Ferries'].includes(n.name)).map(({name,icon:Icon})=><button key={name} title={name==='World'?'World Map':name} aria-current={page===name?'page':undefined} className={page===name?'selected':''} onClick={()=>go(name)}><Icon size={19}/><span>{name==='World'?'World Map':name}</span></button>)}<div className="nav-group-label">MANAGEMENT</div>{navigation.filter(n=>['Company','Finance','Investments','Research','Explorer AI'].includes(n.name)).map(({name,icon:Icon})=><button key={name} title={name} aria-current={page===name?'page':undefined} className={page===name?'selected':''} onClick={()=>go(name)}><Icon size={19}/><span>{name}</span></button>)}<div className="nav-group-label">DIAGNOSTICS</div><button type="button" className={consoleOpen?"selected":""} onClick={()=>{setPage('World');setConsoleMode('general');setConsoleOpen(true);setDrawerOpen(false)}}><ScrollText size={19}/><span>Frontend console</span></button><button type="button" className={consoleOpen&&consoleMode==='financial'?"selected":""} onClick={()=>{setPage('World');setConsoleMode('financial');setConsoleOpen(true);setDrawerOpen(false)}}><CircleDollarSign size={19}/><span>Financial console</span></button><div className="nav-group-label">FUTURE</div>{futureNavigation.map(({name,icon:Icon})=><button key={name} type="button" title={`${name} · Development brief`} aria-current={page===name?'page':undefined} className={page===name?'selected':''} onClick={()=>go(name)}><Icon size={19}/><span>{name}</span></button>)}</nav><button className="sidebar-bottom nav-company-shortcut" title={company?.name??'Company'} onClick={()=>go('Company')}><span className="nav-company-avatar"><CarFront size={20}/></span><span className="nav-company-copy"><strong>{company?.name??'Create company'}</strong><small>{company?'Company workspace':'Set up your company'}</small></span></button></aside>
 {dailyReport&&<DailySummaryModal summary={dailyReport} onClose={()=>setDailyReport(null)} companyName={company?.name??'TravelEmpire'} valuation={dailyReportCredit?.companyValue} creditScore={dailyReportCredit?.score} researchName={activeResearchProject?.name}/>}
 {drawerOpen&&<button className="backdrop" aria-label="Close navigation" onClick={()=>setDrawerOpen(false)}/>}<main className="main"><header className={`topbar ${page==='World'&&!consoleOpen?'world-topbar world-minimal-topbar':''}`}>{page==='World'&&!consoleOpen?<><span className="world-minimal-date" title="In-game date and time"><CalendarClock size={16}/>{gameClock?formatGameClock(gameClock):'Simulation paused'}</span><span className="world-minimal-money" title="Available company funds"><CircleDollarSign size={17}/>{company?new Intl.NumberFormat('en-IE',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(company.cash):'€0'}</span><button type="button" className="world-minimal-layers" aria-label="Toggle map layers" title="Map layers" aria-controls="map-layer-options" onClick={()=>setLayersToggleToken(v=>v+1)}><Layers3 size={19}/></button></>:<><button className="menu-toggle" aria-label="Open navigation" onClick={()=>setDrawerOpen(true)}><Menu size={21}/></button><div className="nav-page-identity"><strong>{consoleOpen?(consoleMode==='financial'?'Financial console':'Frontend console'):page}</strong><small>TravelEmpire</small></div><div className="nav-top-stats">{company&&<span className="nav-top-stat"><CircleDollarSign size={16}/><strong>{new Intl.NumberFormat('en-IE',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(company.cash)}</strong></span>}</div></>}</header>
 {company&&(activeResearchProject?
 <button type="button" className="research-header-progress" onClick={()=>go('Research')} aria-label={`Research: ${activeResearchProject.name}, ${Math.round(researchProgress)} percent complete`}>
  <span className="research-header-progress-info"><span className="research-header-progress-title">{`RESEARCH · ${activeResearchProject.name} · LVL ${activeResearch?.level}`}</span><span className="research-header-progress-time">{`${Math.floor(researchProgress)}% · ${researchRemainingLabel}`}</span></span>
  <span className="research-header-progress-track"><span style={{width:`${researchProgress}%`}}/></span>
 </button>:
 <LiveFinanceTicker history={fleet.financeHistory??[]} transactions={fleet.transactions??[]}
  bankCollectionsByDay={fleet.bankPartnershipPaidByDay} gameNow={gameClock?.epochMs??Date.now()}/> )}
 {consoleOpen&&(consoleMode==='financial'?<FinancialConsole/>:<FrontendConsole/>)}<div style={{display:consoleOpen?'none':'contents'}}><section className="world" style={{display:page==='World'?'block':'none'}}><WorldMap onViewportChange={bounds=>networkRef.current?.considerViewport(bounds.west,bounds.east,bounds.south,bounds.north)} layersToggleToken={layersToggleToken} companyId={company?.id} purchasedFerryRouteIds={company?.purchasedFerryRouteIds??[]} ferryServiceStartedAt={company?.ferryServiceStartedAt??{}} unlockedHarbourIds={unlockedHarbours} selecting={selecting} onLocationSelected={onLocation} depots={company?.depots??[]} headquarters={company?.headquarters??null} ownedProperties={ownedMapProperties} taxis={[...fleet.taxis,...recoveries.map(job=>job.truck)]} exploredEdgeIds={fleet.exploredEdgeIds??[]} graph={graph} roadGraphVersion={roadGraphVersion} gameClock={gameClock} onExplorerCommand={controlExplorer} onRequestRecovery={requestRecoveryTruck} recoveryTargetIds={recoveries.map(j=>j.targetId)} recoveryRequestedIds={[...manualRecoveryRequestsRef.current]}/>{harbourNotice&&<div role="status" aria-live="polite" style={{position:'absolute',top:90,left:'50%',transform:'translateX(-50%)',zIndex:30,width:'min(90vw,380px)',background:'#102c39',color:'white',border:'1px solid #42d5a9',borderRadius:14,padding:'14px 16px',boxShadow:'0 8px 28px #0006',display:'flex',alignItems:'center',gap:12}}><div style={{flex:1}}><strong>⚓ Harbour unlocked!</strong><div>{harbourNotice.name}</div><small>New ferry connections available</small></div><button type="button" aria-label="Close harbour notification" onClick={()=>setHarbourNotice(null)} style={{color:'white',fontSize:22}}>×</button><button type="button" onClick={()=>{setHarbourNotice(null);setPage('Ferries')}} style={{color:'#6ef1ce'}}>View</button></div>}{selecting&&<div className="location-hint"><strong>{placingDepot?'Choose new depot':'Choose headquarters'}</strong><span>Click a location on the map to select it.</span><button onClick={()=>{setSelecting(false);setPlacingDepot(false);setPage('Company');}}>Cancel</button></div>}</section>
 </div>{page==='Company'&&(!company||showSetup)?<CompanySetup selection={selection} selecting={selecting} onSelectingChange={setSelecting} onShowMap={()=>setPage('World')} onCreated={value=>{setCompany(value);setShowSetup(false);setPage('Company');}}/>:null}
 {page==='Company'&&company&&!showSetup&&<section className="company-dashboard company-v213"><div className="company-v213-heading"><div><span className="eyebrow">COMPANY MANAGEMENT · V2.1.3</span><h1>Company</h1><p>Manage your company, depots and operational settings.</p></div><span className="company-v213-status">● COMPANY ACTIVE</span></div><div className="company-v213-identity"><div className="company-v213-icon">🚕</div><div className="company-v213-name"><strong>{company.name}</strong><small>Taxi & exploration company</small><span>Headquarters · {company.headquarters.label}</span></div><div className="company-v213-identity-stats"><div><small>Vehicles</small><strong>{fleet.taxis.length}</strong></div><div><small>Drivers</small><strong>{(fleet.drivers??[]).length}</strong></div><div><small>Depots</small><strong>{1+(company.depots??[]).length}</strong></div><div><small>Completed trips</small><strong>{fleet.completed.toLocaleString('en-IE')}</strong></div></div></div><div className="ui-section-tabs" role="tablist" aria-label="Company sections">{([["overview","Overview"],["depots","Depots"],["vehicles","Assignments"],["settings","Settings"]] as const).map(([id,label])=><button key={id} role="tab" aria-selected={companyTab===id} className={companyTab===id?"active":""} onClick={()=>setCompanyTab(id)}>{label}</button>)}</div><div className="company-v213-overview" style={{display:companyTab==="overview"?"block":"none"}}><div className="company-v213-section-title"><h2>Company overview</h2><span>Live business statistics</span></div><div className="company-metrics"><article><small>MAIN DEPOT</small><strong>{company.headquarters.label}</strong></article><article><small>ASSIGNED VEHICLES</small><strong>{fleet.taxis.length}</strong></article><article><small>DEPOT CAPACITY</small><strong>{Math.max(5,5+5*(fleet.upgrades??[]).filter(u=>u==='depot-capacity').length)} spaces</strong></article><article><small>EXPLORER PARKING</small><strong>{fleet.taxis.filter(t=>t.kind==='explorer'&&(t.depotId??'main')==='main').length} / {explorerDepotCapacity(upgradesFor(fleet,'main'),Research.level(research,'explorerExpansion'))}</strong></article><article><small>AVAILABLE SPACES</small><strong>{Math.max(0,Math.max(5,5+5*(fleet.upgrades??[]).filter(u=>u==='depot-capacity').length)-fleet.taxis.filter(t=>t.kind!=='explorer'&&(t.depotId??'main')==='main').length)}</strong></article></div><div className="company-v213-columns"><article className="company-v213-card"><h3>Company performance</h3><p>Lifetime operating results</p><div className="company-v213-row"><span>Passenger revenue</span><strong>€{fleet.revenue.toLocaleString("en-IE",{maximumFractionDigits:2})}</strong></div><div className="company-v213-row"><span>Completed trips</span><strong>{fleet.completed.toLocaleString("en-IE")}</strong></div><div className="company-v213-row"><span>Operating distance</span><strong>{(fleet.distanceKm??0).toFixed(1)} km</strong></div><div className="company-v213-row"><span>Available capital</span><strong>€{company.cash.toLocaleString("en-IE",{maximumFractionDigits:2})}</strong></div></article><article className="company-v213-card"><h3>Operational status</h3><p>Fleet and depot availability</p><div className="company-v213-row"><span>Available vehicles</span><strong>{fleet.taxis.filter(t=>t.status==="IDLE").length} / {fleet.taxis.length}</strong></div><div className="company-v213-progress"><div style={{width:`${fleet.taxis.length?100*fleet.taxis.filter(t=>t.status==="IDLE").length/fleet.taxis.length:0}%`}}/></div><div className="company-v213-row"><span>Assigned drivers</span><strong>{fleet.taxis.filter(t=>t.kind!=="explorer"&&!!t.driver).length}</strong></div><div className="company-v213-row"><span>Depot locations</span><strong>{1+(company.depots??[]).length}</strong></div></article></div><div className="company-v213-actions"><h3>Quick actions</h3><div><button onClick={()=>setCompanyTab("depots")}>Manage depots →</button><button onClick={()=>setCompanyTab("vehicles")}>Vehicle assignments →</button><button onClick={()=>setCompanyTab("settings")}>Company settings →</button><button onClick={()=>setPage("Finance")}>Financial reports →</button></div></div></div><div className="company-v213-subpage" style={{display:companyTab==="depots"?"block":"none"}}><button type="button" disabled={company.cash<2500} onClick={()=>{if(!companyRef.current||companyRef.current.cash+pendingCashRef.current<2500){setSimError('Insufficient funds for depot expansion (€2,500).');return;}pendingCashRef.current-=2500;setFleet(old=>({...old,upgrades:[...(old.upgrades??[]),'depot-capacity'],transactions:[{id:crypto.randomUUID(),time:gameClockRef.current?.epochMs??Date.now(),description:'Main depot expansion (+5 spaces)',amount:-2500},...(old.transactions??[])].slice(0,100)}));setSimError('');}}>Expand main depot (+5 spaces) · €2,500</button><h2>Depot network</h2><p>Every depot includes 5 separate explorer spaces free, in addition to its taxi parking. Explorer parking upgrades cost €1,000 for 2 spaces. Vehicles must be idle or paused to change depots.</p><button type="button" onClick={()=>{setPlacingDepot(true);setSelecting(true);setPage('World');setSimError('');}}>+ Place new depot on map · €10,000</button>{[...([{id:'main',name:'Main depot · '+company.headquarters.label,capacity:5+5*(fleet.upgrades??[]).filter(u=>u==='depot-capacity').length}]),...(company.depots??[])].map(d=><article key={d.id}><strong>{d.name}</strong> · {parkingByDepot.get(d.id)?.occupied??0} / {parkingByDepot.get(d.id)?.capacity??0} taxi spaces {(parkingByDepot.get(d.id)?.overCapacity??0)>0&&<span className="depot-capacity-warning" role="alert">⚠ Over capacity by {parkingByDepot.get(d.id)?.overCapacity} taxis · Reassign vehicles in Assignments or expand taxi parking.</span>} · {fleet.taxis.filter(t=>(t.depotId??'main')===d.id&&t.kind==='explorer').length} / {explorerDepotCapacity(upgradesFor(fleet,d.id),Research.level(research,'explorerExpansion'))} explorer spaces <button type="button" onClick={()=>upgradeDepot(d.id,'explorer-parking')} disabled={(upgradesFor(fleet,d.id)['explorer-parking']??0)>=10}>+2 explorer spaces · €1,000</button> {d.id!=='main'&&<button type="button" onClick={()=>{if(!companyRef.current||companyRef.current.cash+pendingCashRef.current<2500){setSimError('Insufficient funds (€2,500).');return;}pendingCashRef.current-=2500;const updated={...companyRef.current,depots:(companyRef.current.depots??[]).map(x=>x.id===d.id?{...x,capacity:x.capacity+5}:x)};companyRef.current=updated;setCompany(updated);saveCompany(updated);setFleet(old=>({...old,transactions:[{id:crypto.randomUUID(),time:gameClockRef.current?.epochMs??Date.now(),description:'Depot expansion (+5 spaces)',amount:-2500},...(old.transactions??[])].slice(0,100)}));}}>Expand +5 · €2,500</button>}</article>)}</div><div className="company-v213-subpage" style={{display:companyTab==="vehicles"?"block":"none"}}><h2>Vehicle assignments</h2><p>Choose each vehicle’s home depot. Only idle or paused vehicles can be reassigned.</p>{fleet.taxis.map(t=><div key={t.id} style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap',marginBottom:8}}><strong>{t.name}</strong><select aria-label={`Depot for ${t.name}`} value={t.depotId??'main'} onChange={e=>assignDepot(t.id,e.target.value)}><option value="main">Main depot</option>{(company.depots??[]).map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select><button type="button" disabled={t.status!=='IDLE'&&t.status!=='PAUSED'} onClick={()=>returnToDepot(t.id)}>Return & park</button>{t.status==='PAUSED'&&<button type="button" onClick={()=>resumeDepotTaxi(t.id)}>Resume operations</button>}<small>{t.status}</small></div>)}</div>{simError&&<p role="alert">{simError}</p>}<div className="company-v213-subpage" style={{display:companyTab==="settings"?"block":"none"}}><h2>Company settings</h2><p>Your company profile is saved in this browser. Taxi operations run locally while this browser tab is open.</p><div className="company-metrics"><article><small>AVAILABLE CAPITAL</small><strong>€{company.cash.toLocaleString('en-IE')}</strong></article><article><small>HEADQUARTERS</small><strong>{company.headquarters.label}</strong></article><article><small>FLEET</small><strong>{fleet.taxis.filter(t=>(!t.kind||t.kind==='taxi')).length} taxis · {fleet.taxis.filter(t=>t.kind==='explorer').length} road explorers</strong></article></div><p className="setup-disclaimer">No administrative ownership restrictions. Greek roads load automatically near headquarters and active taxis from Supabase.</p><button className="setup-secondary" onClick={()=>setPage('World')}>View headquarters on map</button><button className="danger-button" onClick={()=>{if(window.confirm('Delete this locally saved company? This cannot be undone.')){Research.clear(company.id);void clearExploration(company.id);clearCompany();localStorage.removeItem(`travelempire.fleet.v0.8.${company.id}`);setFleet({taxis:[],revenue:0,completed:0});setCompany(null);setSelection(null);setShowSetup(false);}}}>Delete local company</button></div></section>}
 {page==='Drivers'&&<DriversPanel fleet={fleet} gameClock={gameClock}/>}
  {page==='Fleet'&&<FleetPanel company={company} fleet={fleet} graph={graph} error={simError} onBuy={buyTaxi} onBuyBatch={buyTaxiBatch} onBuyRoadExplorer={buyRoadExplorer} onAssignDriver={assignDriver} onHireDriver={hireDriver} onDismissDriver={dismissDriver} onService={serviceTaxi} onRefill={refillTaxi} onSell={sellVehicle} onReset={resetVehicle} onRequestRecovery={requestRecoveryTruck} recoveryRequests={[...manualRecoveryRequestsRef.current]} recoveryJobs={recoveries.map(j=>({targetId:j.targetId,phase:j.phase}))} onPolicy={setVehiclePolicy} onServiceThreshold={setServiceThreshold} onAutoDepotService={setAutoDepotService}/>}
 {page==='Dealership'&&company&&<DealershipPage cash={company.cash} ready={Boolean(graph)} depots={depotParkingChoices(company,fleet)} error={simError} onDepotChange={()=>setSimError('')} onOrder={buyTaxiBatch}/>}
 {page==='Operations'&&<OperationsPanel fleet={fleet} graph={graph} missionCount={missionQueue.length} roadPackages={roadPackages} diagnostics={roadDiagnostics} error={simError}/>}
 {page==='Ferries'&&<FerryRoutesPanel company={company} onPurchase={purchaseFerryRoute} onTicketPriceChange={setFerryTicketPrice} unlockedHarbourIds={unlockedHarbours} network={harbourNetwork} onReloadNetwork={reloadHarbourNetwork} gameNow={gameClock?.epochMs??Date.now()} headquarters={company?.headquarters??null} ferryRevenueByDay={fleet.ferryRevenueByDay??{}}/>}
 {page==='Investments'&&<InvestmentsPanel available={investmentPois} portfolio={portfolio} gameNow={gameClock?.epochMs??Date.now()} companyCash={(company?.cash??0)+pendingCashRef.current} onInvest={investInProperty} error={investmentError}/>}
 {page==='Finance'&&<FinancePanel company={company} fleet={fleet} gameEpochMs={gameClock?.epochMs??Date.now()} onAcquire={acquireSubsidiary} onFoundSubsidiary={createSubsidiary} onCorporateTransfer={transferSubsidiary} onCorporateMerge={mergeCorporate} onCorporateRestructure={restructureCorporate} onCorporateAssetTransfer={moveSubsidiaryAssets} onFoundForeign={foundForeign} onAcquireForeign={acquireForeign} onTransferForeign={transferForeign} onInvest={investInCompany} onIssueShares={issueCompanyShares} onDividend={distributeDividend} onBuyback={repurchaseShares} onLoan={takeLoan} onBankPartnership={acceptBankPartnership} onBankPartnershipBuyout={buyOutBankPartnership} onEarlyRepayment={repayVehicleLoan} onTransfer={bankTransfer} onBankSettings={bankSettings} onDepotUpgrade={upgradeDepot} onAccountingSettings={accountingSettings} onUpgrade={buyUpgrade} onWageChange={multiplier=>setFleet(old=>({...old,wageMultiplier:multiplier}))} error={simError}/>}
 {page==='Research'&&<><ResearchPanel company={company} state={research} discoveredRoads={Math.max(discoveredCacheRef.current?.ids.length??0,fleet.exploredEdgeIds?.length??0)} explorerSpecializations={new Set(fleet.taxis.filter(t=>t.kind==='explorer'&&t.explorerRole).map(t=>t.explorerRole)).size} gameNow={gameClock?.epochMs??Date.now()} onStart={startResearch} onCancel={cancelResearch}/>{researchError&&<p role="alert">{researchError}</p>}</>}
 {isFutureModule(page)&&<FutureModulePanel key={page} moduleId={page}/>}
 {!company&&page==='World'&&!selecting&&<button className="start-company-button" onClick={()=>{setPage('Company');setShowSetup(true);}}>+ Create company</button>}
 </main><nav className="mobile-tabs" aria-label="Mobile navigation">{navigation.filter(n=>['World','Fleet','Dealership','Company'].includes(n.name)).map(({name,icon:Icon})=><button key={name} className={page===name?'active':''} onClick={()=>go(name)}><Icon size={19}/><span>{name==='World'?'Map':name==='Dealership'?'Dealer':name==='Operations'?'Ops':name}</span></button>)}<button onClick={()=>setDrawerOpen(true)}><Menu size={19}/><span>More</span></button></nav></div>;
}

