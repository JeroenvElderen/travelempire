import type {RoadGraph} from '../simulation/taxi';
import type {FerryNetwork} from './ferries';

// Select harbour-local *road segments*, not a single arbitrary nearest junction edge.
// The spatial grid avoids a full graph scan for every harbour.
export async function harbourRoadEdges(network:FerryNetwork,graph:RoadGraph,signal?:AbortSignal):Promise<Map<string,string[]>>{
 const yieldFrame=()=>new Promise<void>(resolve=>setTimeout(resolve,0));
 const cell=0.01;
 type Segment={id:string;a:[number,number];b:[number,number]};
 const bins=new Map<string,Segment[]>();
 const key=(x:number,y:number)=>x+','+y;
 const seen=new Set<string>();
 let indexed=0;
 for(const [from,edges] of graph.edges){
  if(signal?.aborted)return new Map();
  if(++indexed%2500===0)await yieldFrame();
  const a=graph.nodes.get(from);if(!a)continue;
  for(const edge of edges){
   if(seen.has(edge.id))continue;
   const b=graph.nodes.get(edge.to);if(!b)continue;
   seen.add(edge.id);
   const segment:Segment={id:edge.id,a,b};
   const minX=Math.floor(Math.min(a[0],b[0])/cell),maxX=Math.floor(Math.max(a[0],b[0])/cell);
   const minY=Math.floor(Math.min(a[1],b[1])/cell),maxY=Math.floor(Math.max(a[1],b[1])/cell);
   // Extremely long segments remain searchable through their endpoints.
   if((maxX-minX+1)*(maxY-minY+1)>100)continue;
   for(let x=minX;x<=maxX;x++)for(let y=minY;y<=maxY;y++){
    const k=key(x,y),list=bins.get(k);
    if(list)list.push(segment);else bins.set(k,[segment]);
   }
  }
 }
 const result=new Map<string,string[]>();
 let processed=0;
 for(const port of network.ports){
  if(signal?.aborted)return new Map();
  if(++processed%8===0)await yieldFrame();
  const point=port.roadAccess??port.position;
  const x=Math.floor(point[0]/cell),y=Math.floor(point[1]/cell);
  const cos=Math.cos(point[1]*Math.PI/180);
  let best=Infinity,closest:string|undefined;
  // A ferry terminal often has several short connected access segments.
  // Index all plausible entrance segments, not only one arbitrary nearest ID.
  const nearby:Array<{id:string;distance:number}>=[];
  const checked=new Set<string>();
  for(let radius=0;radius<=16;radius++){
   for(let dx=-radius;dx<=radius;dx++)for(let dy=-radius;dy<=radius;dy++){
    if(radius&&Math.max(Math.abs(dx),Math.abs(dy))!==radius)continue;
    for(const segment of bins.get(key(x+dx,y+dy))??[]){
     if(checked.has(segment.id))continue;checked.add(segment.id);
     const ax=(segment.a[0]-point[0])*cos,ay=segment.a[1]-point[1];
     const bx=(segment.b[0]-point[0])*cos,by=segment.b[1]-point[1];
     const vx=bx-ax,vy=by-ay;
     const t=Math.max(0,Math.min(1,-(ax*vx+ay*vy)/(vx*vx+vy*vy||1)));
     const d=Math.hypot(ax+t*vx,ay+t*vy);
     if(d<best){best=d;closest=segment.id;}
     // Keep only harbour-local road segments; do not unlock a port from
     // a road several blocks away or an unrelated distant highway.
     if(d<=0.002)nearby.push({id:segment.id,distance:d});
    }
   }
   // A road in a searched square cannot beat an already found closer segment
   // once the entire surrounding grid margin is farther away.
   if(closest&&radius*cell>best*2+cell)break;
  }
  if(closest){
   // Include roads within 120m of the port's mapped road access and within
   // 90m of its nearest entrance. This handles multi-segment quays and
   // segmented terminal approach roads while avoiding unrelated streets.
   const cutoff=Math.min(0.00108,best+0.00081);
   const matches=nearby.filter(candidate=>candidate.distance<=cutoff)
    .sort((a,b)=>a.distance-b.distance).slice(0,32).map(candidate=>candidate.id);
   result.set(port.id,matches.length?matches:[closest]);
  }
 }
 return result;
}
export function harbourStorageKey(companyId:string){return 'travelempire.harbourUnlocks.'+companyId;}
