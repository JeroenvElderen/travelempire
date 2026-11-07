import type {RoadGraph} from '../simulation/taxi';
import type {FerryNetwork} from './ferries';

// Select the closest *road segment*, not the nearest junction's arbitrary edges.
// The spatial grid avoids a full graph scan for every harbour.
export function harbourRoadEdges(network:FerryNetwork,graph:RoadGraph):Map<string,string[]>{
 const cell=0.01;
 type Segment={id:string;a:[number,number];b:[number,number]};
 const bins=new Map<string,Segment[]>();
 const key=(x:number,y:number)=>x+','+y;
 const seen=new Set<string>();
 for(const [from,edges] of graph.edges){
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
 for(const port of network.ports){
  const point=port.roadAccess??port.position;
  const x=Math.floor(point[0]/cell),y=Math.floor(point[1]/cell);
  const cos=Math.cos(point[1]*Math.PI/180);
  let best=Infinity,closest:string|undefined;
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
    }
   }
   // A road in a searched square cannot beat an already found closer segment
   // once the entire surrounding grid margin is farther away.
   if(closest&&radius*cell>best*2+cell)break;
  }
  if(closest)result.set(port.id,[closest]);
 }
 return result;
}
export function harbourStorageKey(companyId:string){return 'travelempire.harbourUnlocks.'+companyId;}
