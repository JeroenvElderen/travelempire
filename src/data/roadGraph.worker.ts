import {hardcodedRoadSpeedKph} from './hardcodedSpeedLimits';
import type {RoadSegment} from './roadTiles';
type Edge={to:string;meters:number;id:string;speedKph:number;highway?:string;layer?:number;bridge?:boolean;tunnel?:boolean;level?:number;taxiOnly?:boolean};
type Result={id:number;nodes:[string,[number,number]][];edges:[string,Edge[]][];count:number};
const seen=new Set<string>();
self.onmessage=(event:MessageEvent<{id:number;roads:RoadSegment[]}>)=>{
 const {id,roads}=event.data;
 const nodes=new Map<string,[number,number]>();
 const edges=new Map<string,Edge[]>();
 let count=0;
 for(const road of roads){
  if(seen.has(road.id)||road.coordinates?.length!==2||!Number.isFinite(road.length)||road.length<=0)continue;
  seen.add(road.id);count++;
  const a=String(road.a),b=String(road.b);
  if(!nodes.has(a))nodes.set(a,road.coordinates[0]);
  if(!nodes.has(b))nodes.set(b,road.coordinates[1]);
  const add=(from:string,to:string)=>{
   let links=edges.get(from);if(!links){links=[];edges.set(from,links)}
   links.push({to,meters:road.length,id:road.id,speedKph:hardcodedRoadSpeedKph(road.highway),highway:road.highway,
    layer:road.layer,bridge:road.bridge,tunnel:road.tunnel,level:road.level});
  };
  if(road.oneway!==-1)add(a,b);
  if(road.oneway!==1)add(b,a);
 }
 const result:Result={id,nodes:[...nodes],edges:[...edges],count};
 self.postMessage(result);
};
