import {meters,nearest,routeDiscovered,type Point,type RoadGraph} from './simulation/taxi';

export const COLLECTOR_PARTS=['mechanical','electronics','business','construction','marine','research','energy','rare'] as const;
export type CollectorPart=typeof COLLECTOR_PARTS[number];
export const COLLECTOR_NAMES:Record<CollectorPart,string>={mechanical:'Mechanical parts',electronics:'Electronic components',business:'Business resources',construction:'Construction materials',marine:'Marine components',research:'Research data',energy:'Energy components',rare:'Rare components'};
export type CollectorStock=Partial<Record<CollectorPart,number>>;
export type CollectorTrip={path:Point[];outboundMetres:number;distance:number;startedAt:number;endsAt:number;part:CollectorPart;quantity:number};
export type CollectorState={stock:CollectorStock;delivered:CollectorStock;trips:number;trip?:CollectorTrip;vehicles?:CollectorVehicle[]};
export const emptyCollector=():CollectorState=>({stock:{},delivered:{},trips:0});
const categoryParts:CollectorPart[]=['business','mechanical','electronics','research','business','mechanical','business','rare','marine','business','construction','energy'];
export function collectorRequirement(category:number,level:number):{part:CollectorPart;quantity:number}{
 return {part:categoryParts[category]??'research',quantity:Math.max(1,Math.ceil(level*2))};
}
export function collectorPosition(trip:CollectorTrip,now:number):Point{
 if(now<=trip.startedAt)return trip.path[0];
 if(now>=trip.endsAt)return trip.path[trip.path.length-1];
 let left=trip.distance*Math.max(0,Math.min(1,(now-trip.startedAt)/(trip.endsAt-trip.startedAt)));
 for(let i=1;i<trip.path.length;i++){
  const a=trip.path[i-1],b=trip.path[i],d=meters(a,b);
  if(left<=d&&d>0){const f=left/d;return [a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f];}
  left-=d;
 }
 return trip.path[trip.path.length-1];
}
/** An independent depot-based collector. Only discovered, non-taxi-only roads
 * are eligible. A shipment is credited once, on return to the depot.
 * Prototype supply sites are reachable road nodes, not OSM business POIs. */
export function tickCollector(state:CollectorState,now:number,graph:RoadGraph|null,discovered:Set<string>,hq:Point,options:{capacity?:number;speed?:number;priority?:CollectorPart;offset?:number;loadingMs?:number}={}):CollectorState{
 if(state.trip){
  if(now<state.trip.endsAt)return state;
  const {part,quantity}=state.trip;
  return {...state,trip:undefined,trips:state.trips+1,stock:{...state.stock,[part]:(state.stock[part]??0)+quantity},delivered:{...state.delivered,[part]:(state.delivered[part]??0)+quantity}};
 }
 if(!graph||!discovered.size)return state;
 const start=nearest(graph,hq),origin=graph.nodes.get(start);
 if(!origin||meters(origin,hq)>500)return state;
 const queue=[start],seen=new Set(queue),candidates:string[]=[];
 for(let i=0;i<queue.length&&i<700;i++){
  const node=queue[i],point=graph.nodes.get(node);
  if(point&&meters(origin,point)>300)candidates.push(node);
  for(const e of graph.edges.get(node)??[]){
   if(e.taxiOnly||!discovered.has(e.id)||seen.has(e.to))continue;
   seen.add(e.to);queue.push(e.to);
  }
 }
 if(!candidates.length)return state;
 const part=options.priority??COLLECTOR_PARTS[(state.trips+(options.offset??0))%COLLECTOR_PARTS.length];
 for(let i=0;i<Math.min(8,candidates.length);i++){
  const end=candidates[(state.trips*17+(options.offset??0)*23+i*13)%candidates.length];
  const out=routeDiscovered(graph,start,end,discovered,'',false,3000);
  const back=routeDiscovered(graph,end,start,discovered,'',false,3000);
  if(!out||!back||out.path.length<2||back.path.length<2)continue;
  const path=[...out.path,...back.path.slice(1)];
  const distance=path.slice(1).reduce((n,p,j)=>n+meters(path[j],p),0);
  if(distance<600)continue;
  const duration=Math.max(180000,Math.round(distance/1000/(options.speed??35)*3600000+(options.loadingMs??0)));
  return {...state,trip:{path,outboundMetres:out.length,distance,startedAt:now,endsAt:now+duration,part,quantity:options.capacity??12}};
 }
 return state;
}

export const COLLECTOR_MODELS={
 light:{name:'Light collector van',price:18000,capacity:12,speed:35,research:'collectorBasics'},
 medium:{name:'Medium collector van',price:42000,capacity:30,speed:42,research:'collectorMedium'},
 heavy:{name:'Heavy collector truck',price:85000,capacity:65,speed:32,research:'collectorHeavy'},
 offroad:{name:'Utility collector pickup',price:56000,capacity:22,speed:38,research:'collectorUtility'}
} as const;
export type CollectorModel=keyof typeof COLLECTOR_MODELS;
export type CollectorVehicle={id:string;model:CollectorModel;trips:number;trip?:CollectorTrip;priority?:CollectorPart;paused?:boolean;offset:number;distanceKm:number};
type Levels=Partial<Record<string,number>>;
export function collectorVehicles(state:CollectorState):CollectorVehicle[]{
 return state.vehicles??[{id:'starter-collector',model:'light',trips:state.trips,trip:state.trip,offset:0,distanceKm:0}];
}
export function collectorLimit(levels:Levels):number{
 return levels.collectorRegional?12:levels.collectorDispatch?6:levels.collectorBasics?3:1;
}
export function collectorPurchaseLock(state:CollectorState,model:CollectorModel,levels:Levels):string|null{
 if(!levels[COLLECTOR_MODELS[model].research])return 'Requires '+COLLECTOR_MODELS[model].research+' research';
 if(collectorVehicles(state).length>=collectorLimit(levels))return 'Collector fleet capacity reached';
 return null;
}
export function addCollector(state:CollectorState,model:CollectorModel,id:string,levels:Levels):CollectorState{
 const reason=collectorPurchaseLock(state,model,levels);if(reason)throw Error(reason);
 const vehicles=collectorVehicles(state);
 return {...state,trip:undefined,vehicles:[...vehicles,{id,model,trips:0,offset:vehicles.length,distanceKm:0}]};
}
export function configureCollector(state:CollectorState,id:string,change:{priority?:CollectorPart|null;paused?:boolean},levels:Levels):CollectorState{
 const vehicles=collectorVehicles(state);
 if(!vehicles.some(v=>v.id===id))return state;
 if(change.priority!==undefined&&!levels.collectorPriority)return state;
 return {...state,trip:undefined,vehicles:vehicles.map(v=>v.id===id?{...v,...(change.paused!==undefined?{paused:change.paused}:{}),...(change.priority!==undefined?{priority:change.priority??undefined}:{})}:v)};
}
export function collectorCapacity(model:CollectorModel,levels:Levels):number{
 return Math.floor(COLLECTOR_MODELS[model].capacity*(levels.collectorCargo?1.25:1));
}
/** Preserve the old starter journey, settle each van once, and share one depot inventory. */
export function tickCollectorFleet(state:CollectorState,now:number,graph:RoadGraph|null,discovered:Set<string>,hq:Point,levels:Levels):CollectorState{
 let stock=state.stock,delivered=state.delivered,trips=state.trips,changed=!state.vehicles;
 const vehicles=collectorVehicles(state).map(v=>{
  if(v.paused&&!v.trip)return v;
  if(v.trip&&now<v.trip.endsAt)return v;
  const previous:CollectorState={stock,delivered,trips:v.trips,trip:v.trip};
  const model=COLLECTOR_MODELS[v.model];
  const next=tickCollector(previous,now,graph,discovered,hq,{capacity:collectorCapacity(v.model,levels),speed:model.speed*(levels.collectorRouting?1.15:1),priority:v.priority,offset:v.offset,loadingMs:levels.collectorLoading?30000:90000});
  if(next===previous)return v;
  changed=true;stock=next.stock;delivered=next.delivered;
  trips+=next.trips-v.trips;
  return {...v,trips:next.trips,trip:next.trip,distanceKm:v.distanceKm+(v.trip&&!next.trip?v.trip.distance/1000:0)};
 });
 return changed?{...state,stock,delivered,trips,trip:undefined,vehicles}:state;
}
