/** Small live explorer telemetry projected from the dispatcher.
 * No road graphs, planner frontiers, or unbounded route arrays.
 */
import type {Taxi} from './taxi';

export type ExplorerLiveVehicle={
 id:string;role:string;status:string;missionId:number|null;
 remainingEdges:number;idleMs:number;retryInMs:number;
 lastPlannedAt:number|null;ferryReady?:boolean;
 planningAttempts?:number;planningSkipReason?:string|null;
 recoveryReason?:string|null;savedRouteHealth?:string|null;
 exhaustionProven?:boolean;pauseReason?:string|null;
 idleReason?:string|null;returnReason?:string|null;
 singleWorkerPlanner?:string|null;
};
export type ExplorerRecoveryEvent={
 id:string;vehicleId:string;
 kind:'stalled-replan'|'invalid-route'|'directed-return'|'ferry-ready'|'ferry-booked';
 description:string;at:number;
};
export type ExplorerOperationsSnapshot={
 at:number;vehicles:ExplorerLiveVehicle[];
 poolWorkers:number;poolBusy:number;
};
export function mergeExplorerRecoveryHistory(
 previous:readonly ExplorerRecoveryEvent[],
 incoming:readonly ExplorerRecoveryEvent[],limit=40,
):ExplorerRecoveryEvent[]{
 const seen=new Set<string>();
 const sorted=[...incoming,...previous].filter(event=>
  !!event&&typeof event.id==='string'&&event.id.length<=110&&
  typeof event.vehicleId==='string'&&event.vehicleId.length<=110&&
  typeof event.description==='string'&&event.description.length<=180&&
  ['stalled-replan','invalid-route','directed-return','ferry-ready','ferry-booked'].includes(event.kind)&&
  Number.isFinite(event.at)&&event.at>0&&event.at<=8.64e15)
  .sort((a,b)=>b.at-a.at);
 return sorted.filter(event=>{
  if(seen.has(event.id))return false;
  seen.add(event.id);return true;
 }).slice(0,Math.max(0,Math.min(limit,100)));
}
export function explorerEfficiency(uniqueKm:number,travelledKm:number):number|null{
 if(!Number.isFinite(uniqueKm)||!Number.isFinite(travelledKm)||travelledKm<=0)return null;
 return Math.round(Math.max(0,Math.min(100,uniqueKm/travelledKm*100)));
}
export type ExplorerSituation={label:string;detail:string;tone:'moving'|'waiting'|'attention'};
/** Never report a successor as "ready" merely because it is being searched. */
export function explorerSituation(taxi:Taxi,live?:ExplorerLiveVehicle):ExplorerSituation{
 if(taxi.ferryTrip){
  const stage=taxi.ferryTrip.stage;
  return {label:stage==='sailing'?'Sailing':stage==='boarding'?'Boarding ferry':'Waiting for ferry',
   detail:stage==='sailing'?'Crossing to the next harbour':stage==='boarding'?'Travelling to the harbour':'Waiting for scheduled departure',tone:'waiting'};
 }
 if(taxi.recoveryPending||taxi.recoveryTransitOnly)
  return {label:'Recovering',detail:taxi.recoveryPending?'Recovery vehicle assigned':'Driving a legal return route',tone:'attention'};
 if(live?.savedRouteHealth==='waiting-for-tiles'||live?.recoveryReason?.startsWith('waiting-for-road-tiles')||live?.recoveryReason?.startsWith('discovery-state-loading'))
  return {label:'Loading roads',detail:'Keeping the saved mission while road data loads',tone:'waiting'};
 if(live?.recoveryReason?.startsWith('stalled-'))
  return {label:'Recovering',detail:reasonForExplorer(live.recoveryReason),tone:'attention'};
 if(live?.recoveryReason?.startsWith('invalid-saved-route'))
  return {label:'Checking route',detail:'Saved route rejected; looking for a legal departure',tone:'attention'};
 if(taxi.status==='EXPLORING'){
  const successor=live?.planningSkipReason==='pool-successor'||live?.planningSkipReason?.startsWith('successor-');
  return {label:'Exploring',detail:successor?'Searching for the next connected route':'Driving a connected discovery mission',tone:'moving'};
 }
 if(taxi.status==='REFUELLING'||taxi.refillRequested)
  return {label:'Refuelling',detail:'Energy replenishment in progress',tone:'waiting'};
 if(taxi.status==='SERVICING'||taxi.serviceDestination)
  return {label:'Servicing',detail:'Maintenance or service journey',tone:'waiting'};
 if(taxi.status==='RETURNING')
  return {label:'Returning',detail:taxi.restStopName?'Travelling to '+taxi.restStopName:'Travelling on an assigned route',tone:'moving'};
 if(taxi.status==='PAUSED'){
  if(taxi.restStopId||live?.pauseReason==='active-rest')return {label:'Resting',detail:'Scheduled driver rest',tone:'waiting'};
  if(taxi.shiftParked)return {label:'Parked',detail:live?.exhaustionProven?'No connected roads left; ferry transfer eligible':'Waiting for a new assignment',tone:'waiting'};
  return {label:'Paused',detail:reasonForExplorer(live?.pauseReason)||'Paused by operations',tone:'waiting'};
 }
 if(live?.exhaustionProven)
  return {label:'Area explored',detail:'No reachable new roads confirmed; ferry may be considered',tone:'waiting'};
 const reason=live?.recoveryReason||live?.planningSkipReason||live?.idleReason;
 return {label:'Searching',detail:reasonForExplorer(reason)||'Looking for a reachable undiscovered road',tone:'waiting'};
}
export function reasonForExplorer(raw:string|null|undefined):string{
 if(!raw)return '';
 if(raw.startsWith('waiting-for-road-tiles')||raw==='discovery-state-loading')
  return 'Waiting for road tiles to load';
 if(raw.startsWith('stalled-awaiting-legal-purple'))
  return 'Stopped mid-road; waiting for a legal purple junction';
 if(raw.startsWith('stalled-replanning'))return 'Restarting exploration at a connected purple junction';
 if(raw.startsWith('stalled-replan-cooldown'))return 'Automatic recovery retry cooling down';
 if(raw.startsWith('invalid-saved-route'))return 'Saved mission is not legally connected';
 if(raw.startsWith('parked-frontier-exhausted'))return 'Reachable local roads exhausted';
 if(raw.startsWith('parked-frontier-incomplete')||raw.startsWith('parked-component-search-incomplete'))
  return 'Road search is incomplete; retry required';
 if(raw.startsWith('pool-successor'))return 'Planning the next mission';
 if(raw.startsWith('pool-search'))return 'Finding a connected route';
 if(raw.startsWith('pool-not-ready')||raw.startsWith('pool-search-timeout'))return 'Planner restarting';
 if(raw.startsWith('preferred-class-search-incomplete')||raw.startsWith('successor-incomplete'))
  return 'Checking more roads of the preferred class';
 if(raw.startsWith('unchanged-directed-component'))return 'Waiting for new roads or changed reservations';
 if(raw.startsWith('no-purple'))return 'No reachable discovered start road yet';
 if(raw.startsWith('waiting-for-connected'))return 'Waiting for the required road class to connect';
 if(raw.startsWith('stranded-no-legal-directed'))return 'No legal return route is currently loaded';
 if(raw.startsWith('directed-component-recovery'))return 'Returning to connected roads';
 if(raw.startsWith('poi-cooldown'))return 'Harbour search will retry shortly';
 if(raw==='operational-unavailable'||raw==='low-energy')return 'Rest, fuel or maintenance is required';
 if(raw==='retry-cooldown')return 'Route search will retry shortly';
 if(raw==='no-eligible-candidates'||raw==='no-reachable-specialist-frontier')
  return 'No reachable eligible road found in this search';
 if(raw==='awaiting-planning')return 'Waiting for the next planning turn';
 if(raw.startsWith('single-worker:planned'))return 'Mission assigned';
 if(raw.startsWith('road-frontier:incomplete'))return 'Searching further through the road network';
 if(raw.startsWith('road-frontier:exhausted'))return 'No reachable preferred roads found';
 if(raw==='searching-wider')return 'Expanding the route search';
 return 'Route planner is evaluating the network';
}
export function explorerRoleName(role:string|undefined):string{
 const names:Record<string,string>={highway:'Highway',motorway:'Highway',
  trunk:'Highway',primary:'Primary',secondary:'Secondary',tertiary:'Secondary',
  residential:'Local streets',rural:'Local streets',urban:'Local streets',
  poi:'Service & harbour',service:'Service & harbour',completion:'Completion',
  balanced:'General'};
 return names[role??'']??'Explorer';
}
