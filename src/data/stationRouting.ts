import {meters,nearest,type Point,type RoadGraph} from '../simulation/taxi';
import type {Station,StationKind} from './stations';

export type StationRoute={station:Station;roadKm:number;approachMeters:number;path:Point[];edgeIds:string[]};
// Only consider POIs close to the imported road network. Snapping farther away
// would imply an imaginary off-road connection.
export function reachableStations(graph:RoadGraph,origin:Point,stations:Station[],kind:StationKind,rangeKm=Infinity,limit=12):StationRoute[]{
 if(!graph.nodeKeys.length)return [];
 const start=nearest(graph,origin);if(!start)return [];
 const candidates=stations.filter(s=>s.kind===kind&&s.access!=='private'&&s.access!=='no')
  .map(s=>({s,straight:meters(origin,[s.lng,s.lat] as Point)}))
  .sort((a,b)=>a.straight-b.straight).slice(0,Math.max(1,limit));
 const destinations=new Map<string,{station:Station;approach:number}[]>();
 for(const {s} of candidates){const point:[number,number]=[s.lng,s.lat];const k=nearest(graph,point);if(!k)continue;
  const approach=meters(graph.nodes.get(k)!,point);if(approach>250)continue;
  const list=destinations.get(k)??[];list.push({station:s,approach});destinations.set(k,list);
 }
 if(!destinations.size)return [];
 const dist=new Map<string,number>([[start,0]]),prev=new Map<string,{from:string;edge:string}>();
 const heap:Array<[number,string]>=[[0,start]];
 const push=(v:[number,string])=>{heap.push(v);let i=heap.length-1;while(i){const parent=(i-1)>>1;if(heap[parent][0]<=v[0])break;heap[i]=heap[parent];i=parent;}heap[i]=v;};
 const pop=():[number,string]|undefined=>{if(!heap.length)return;const first=heap[0],last=heap.pop()!;if(heap.length){let i=0;while(2*i+1<heap.length){let c=2*i+1;if(c+1<heap.length&&heap[c+1][0]<heap[c][0])c++;if(heap[c][0]>=last[0])break;heap[i]=heap[c];i=c;}heap[i]=last;}return first;};
 const results:StationRoute[]=[];let visits=0;
 while(heap.length&&visits++<60000&&results.length<candidates.length){const [distance,k]=pop()!;
  if(distance!==(dist.get(k)??Infinity))continue;
  if(distance>rangeKm*1000)break;
  const matched=destinations.get(k);
  if(matched){const keys=[k],ids:string[]=[];let cur=k;
   while(cur!==start){const previous=prev.get(cur);if(!previous)break;ids.push(previous.edge);keys.push(previous.from);cur=previous.from;}
   if(cur===start){keys.reverse();ids.reverse();for(const entry of matched){const total=distance+entry.approach+meters(origin,graph.nodes.get(start)!);
    if(total/1000<=rangeKm)results.push({station:entry.station,roadKm:total/1000,approachMeters:entry.approach,path:keys.map(n=>graph.nodes.get(n)!),edgeIds:ids});}}
   destinations.delete(k);if(!destinations.size)break;
  }
  for(const edge of graph.edges.get(k)??[]){const next=distance+edge.meters;if(next<(dist.get(edge.to)??Infinity)){dist.set(edge.to,next);prev.set(edge.to,{from:k,edge:edge.id});push([next,edge.to]);}}
 }
 return results.sort((a,b)=>a.roadKm-b.roadKm);
}
