import {meters,nearest,routeDiscovered,type Point,type RoadGraph} from './simulation/taxi';

export const COLLECTOR_PARTS=['mechanical','electronics','business','construction','marine','research','energy','rare'] as const;
export type CollectorPart=typeof COLLECTOR_PARTS[number];
export const COLLECTOR_NAMES:Record<CollectorPart,string>={mechanical:'Mechanical parts',electronics:'Electronic components',business:'Business resources',construction:'Construction materials',marine:'Marine components',research:'Research data',energy:'Energy components',rare:'Rare components'};
export type CollectorStock=Partial<Record<CollectorPart,number>>;
export type CollectorTrip={path:Point[];outboundMetres:number;distance:number;startedAt:number;endsAt:number;part:CollectorPart;quantity:number};
export type CollectorState={stock:CollectorStock;delivered:CollectorStock;trips:number;trip?:CollectorTrip};
export const emptyCollector=():CollectorState=>({stock:{},delivered:{},trips:0});
const categoryParts:CollectorPart[]=['business','mechanical','electronics','research','business','mechanical','business','rare','marine','business','construction','energy'];
export function collectorRequirement(category:number,level:number):{part:CollectorPart;quantity:number}{
 return {part:categoryParts[category]??'research',quantity:Math.max(1,Math.ceil(level*2))};
}
export function collectorPosition(trip:CollectorTrip,now:number):Point{
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
export function tickCollector(state:CollectorState,now:number,graph:RoadGraph|null,discovered:Set<string>,hq:Point):CollectorState{
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
 const part=COLLECTOR_PARTS[state.trips%COLLECTOR_PARTS.length];
 for(let i=0;i<Math.min(8,candidates.length);i++){
  const end=candidates[(state.trips*17+i*13)%candidates.length];
  const out=routeDiscovered(graph,start,end,discovered,'',false,3000);
  const back=routeDiscovered(graph,end,start,discovered,'',false,3000);
  if(!out||!back||out.path.length<2||back.path.length<2)continue;
  const path=[...out.path,...back.path.slice(1)];
  const distance=path.slice(1).reduce((n,p,j)=>n+meters(path[j],p),0);
  if(distance<600)continue;
  const duration=Math.max(180000,Math.round(distance/1000/35*3600000));
  return {...state,trip:{path,outboundMetres:out.length,distance,startedAt:now,endsAt:now+duration,part,quantity:12}};
 }
 return state;
}
