import type {RoadGraph,Point} from './taxi';
import {meters,routeDiscovered} from './taxi';
import type {RoadFeature} from '../components/purpleRoadDiff';

/** Living-world data is deterministic and bounded; it never discovers or mutates roads. */
export type WorldWeather='clear'|'rain'|'storm'|'wind'|'snow';
export type IncidentKind='collision'|'medical'|'roadworks';
export type ResponderKind='police'|'ambulance';
export type WorldResponder={
 id:string;kind:ResponderKind;path:Point[];departAt:number;arriveAt:number;
};
export type WorldIncident={
 id:string;kind:IncidentKind;roadId:string;point:Point;startedAt:number;endsAt:number;
 responders:WorldResponder[];
};
export type WorldState={lastBucket:number;incidents:WorldIncident[]};
const HOUR=3600000;
const EMPTY_STATE:WorldState={lastBucket:-1,incidents:[]};
export const newWorldState=():WorldState=>({lastBucket:-1,incidents:[]});
function hash(s:string):number{let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return h>>>0;}
function key(point:Point):string{return point[0].toFixed(6)+','+point[1].toFixed(6);}
function fraction(a:number,b:number,t:number){return a+(b-a)*t;}
function roadEnds(road:RoadFeature):[Point,Point]|null{
 const points=road.geometry.coordinates;
 if(points.length<2)return null;
 return [points[0] as Point,points[points.length-1] as Point];
}
function roadNodeKeys(road:RoadFeature):[string,string]|null{
 const from=road.properties?.fromNode,to=road.properties?.toNode;
 if(typeof from==='string'&&typeof to==='string'&&from&&to)return [from,to];
 const ends=roadEnds(road);
 return ends?[key(ends[0]),key(ends[1])]:null;
}
function validRoad(road:RoadFeature):boolean{
 const ends=roadEnds(road);
 return !!ends&&!road.properties?.tunnel&&meters(ends[0],ends[1])>16&&meters(ends[0],ends[1])<1200;
}
export function weatherAt(point:Point,at:number):WorldWeather{
 const region=Math.floor(point[0]*2)+':'+Math.floor(point[1]*2);
 const day=Math.floor(at/(24*HOUR));
 const roll=hash(region+':'+day)%100;
 const month=new Date(at).getUTCMonth();
 const winter=month<=1||month===11;
 if(winter&&point[1]>39&&roll<9)return 'snow';
 if(roll<7)return 'storm';
 if(roll<24)return 'rain';
 if(roll<38)return 'wind';
 return 'clear';
}
/** Keep real weather effects, but no fictional civilian traffic or congestion. */
export function weatherTaxiSpeedFactor(point:Point,at:number):number{
 const conditions=weatherAt(point,at);
 return conditions==='snow'?0.70:conditions==='storm'?0.80:
  conditions==='rain'?0.90:conditions==='wind'?0.98:1;
}
export function incidentStatus(incident:WorldIncident,now:number):'responding'|'on-scene'|'clearing'{
 if(incident.responders.some(r=>r.arriveAt>now))return 'responding';
 return now<incident.endsAt-5*60000?'on-scene':'clearing';
}
export function pointOnPath(path:Point[],progress:number):{point:Point;bearing:number}|null{
 if(!path.length)return null;
 if(path.length===1)return {point:path[0],bearing:0};
 const lengths:number[]=[];let total=0;
 for(let i=1;i<path.length;i++){const d=meters(path[i-1],path[i]);lengths.push(d);total+=d;}
 if(total<=0)return {point:path[0],bearing:0};
 let left=Math.max(0,Math.min(1,progress))*total;
 for(let i=0;i<lengths.length;i++){
  const d=lengths[i];
  if(left<=d||i===lengths.length-1){
   const a=path[i],b=path[i+1],f=d>0?Math.min(1,left/d):1;
   const east=(b[0]-a[0])*Math.cos((a[1]+b[1])*Math.PI/360);
   return {point:[fraction(a[0],b[0],f),fraction(a[1],b[1],f)],
    bearing:Math.atan2(east,b[1]-a[1])*180/Math.PI};
  }
  left-=d;
 }
 return {point:path[path.length-1],bearing:0};
}
/** Use the game's actual turn-aware, discovery-limited router for responders. */
export function dispatchResponders(
 road:RoadFeature, roads:readonly RoadFeature[],graph:RoadGraph,discovered:Set<string>,at:number,
 kind:IncidentKind,id:string,
):WorldResponder[]{
 const ends=roadEnds(road);
 if(!ends)return [];
 const targetKeys=roadNodeKeys(road);
 if(!targetKeys)return [];
 const ordered=roads.filter(validRoad)
  .map(r=>({r,d:Math.min(...(roadEnds(r)??ends).map(p=>meters(p,ends[0])))}))
  .filter(item=>String(item.r.id??item.r.properties?.roadId)!==String(road.id??road.properties?.roadId)&&item.d<=2600)
  .sort((a,b)=>a.d-b.d).slice(0,8);
 const responders:WorldResponder[]=[];
 const kinds:ResponderKind[]=kind==='roadworks'?[]:kind==='medical'?['ambulance']:['police','ambulance'];
 for(const emergencyKind of kinds){
  let routeAttempts=0;
  let best:{path:Point[];distance:number}|null=null;
  for(const candidate of ordered){
   const fromKeys=roadNodeKeys(candidate.r);
   if(!fromKeys)continue;
   for(const from of fromKeys){
    if(routeAttempts>=3)break;
    const origin=graph.nodes.get(from);
    if(!origin)continue;
    for(const target of targetKeys){
     if(routeAttempts>=3)break;
     if(!graph.nodes.has(target))continue;
     // A short geographic prefilter bounds routing work on very large graphs.
     const targetPoint=graph.nodes.get(target)!;
     if(meters(origin,targetPoint)>1800)continue;
     routeAttempts++;
     const routed=routeDiscovered(graph,from,target,discovered);
     if(!routed||routed.edgeIds.includes(String(road.id??road.properties?.roadId))||routed.path.length<2)continue;
     // routeDiscovered returns travel-time cost, not physical metres.
     const roadMeters=routed.path.slice(1).reduce((total,p,i)=>total+meters(routed.path[i],p),0);
     if(roadMeters>80&&(!best||roadMeters<best.distance))
      best={path:routed.path,distance:roadMeters};
    }
   }
   if(best)break;
  }
  const chosen=best as {path:Point[];distance:number}|null;
  if(!chosen)continue; // No illegal straight-line or teleport fallback.
  const distance=chosen.distance;
  const travelGameMs=Math.max(2*60000,Math.min(15*60000,distance/12*1000));
  const departAt=at+(emergencyKind==='police'?30000:90000);
  responders.push({id:id+':'+emergencyKind,kind:emergencyKind,path:chosen.path,departAt,arriveAt:departAt+travelGameMs});
 }
 return responders;
}
function incidentOnRoad(road:RoadFeature,roads:readonly RoadFeature[],graph:RoadGraph,discovered:Set<string>,at:number,seed:number):WorldIncident|null{
 const ends=roadEnds(road);
 if(!ends)return null;
 const point:Point=[fraction(ends[0][0],ends[1][0],0.5),fraction(ends[0][1],ends[1][1],0.5)];
 const kind:IncidentKind=seed%8===0?'roadworks':seed%5===0?'medical':'collision';
 const id='world:'+Math.floor(at/HOUR)+':'+String(road.id??road.properties?.roadId);
 return {id,kind,roadId:String(road.id??road.properties?.roadId),point,startedAt:at,
  endsAt:at+(kind==='roadworks'?85:kind==='medical'?35:45)*60000,
  responders:dispatchResponders(road,roads,graph,discovered,at,kind,id)};
}
/** One incident opportunity every four in-game hours; cap three simultaneous events. */
export function advanceWorldState(state:WorldState|undefined,now:number,
 roads:readonly RoadFeature[],graph:RoadGraph|null,discovered:Set<string>,seed='world'):WorldState{
 const current=state??EMPTY_STATE;
 const incidents=current.incidents.filter(i=>i.endsAt>now&&i.startedAt<=now).slice(-3);
 const bucket=Math.floor(now/(4*HOUR));
 if(bucket<=current.lastBucket)return {lastBucket:current.lastBucket,incidents};
 if(!graph||discovered.size<5||roads.length<5)return {lastBucket:current.lastBucket,incidents};
 const candidates=roads.filter(road=>{
  if(!validRoad(road))return false;
  const nodes=roadNodeKeys(road);
  return !!nodes&&graph.nodes.has(nodes[0])&&graph.nodes.has(nodes[1]);
 });
 if(candidates.length<5)return {lastBucket:current.lastBucket,incidents};
 const next:WorldState={lastBucket:bucket,incidents};
 const roll=hash(seed+':'+bucket);
 if(incidents.length>=2||roll%4===0)return next;
 const chosen=candidates[roll%candidates.length];
 const incident=incidentOnRoad(chosen,candidates,graph,discovered,now,roll);
 if(incident)next.incidents=[...incidents,incident];
 return next;
}
