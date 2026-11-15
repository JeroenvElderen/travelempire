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
export type VisibleWorldVehicle={id:string;kind:'civilian'|ResponderKind;point:Point;bearing:number};
const HOUR=3600000;
const EMPTY_STATE:WorldState={lastBucket:-1,incidents:[]};
const HOUR_FORMAT=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Athens',hour:'2-digit',hourCycle:'h23'});
const WEEKDAY_FORMAT=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Athens',weekday:'short'});
let cachedTrafficMinute=NaN,cachedHour=0,cachedWeekday='';
export const newWorldState=():WorldState=>({lastBucket:-1,incidents:[]});
function hash(s:string):number{let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return h>>>0;}
function key(point:Point):string{return point[0].toFixed(6)+','+point[1].toFixed(6);}
function fraction(a:number,b:number,t:number){return a+(b-a)*t;}
function roadEnds(road:RoadFeature):[Point,Point]|null{
 const points=road.geometry.coordinates;
 if(points.length<2)return null;
 return [points[0] as Point,points[points.length-1] as Point];
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
export function trafficLoadAt(point:Point,at:number):number{
 const minute=Math.floor(at/60000);
 if(minute!==cachedTrafficMinute){
  const date=new Date(at);
  cachedTrafficMinute=minute;cachedHour=Number(HOUR_FORMAT.format(date));
  cachedWeekday=WEEKDAY_FORMAT.format(date);
 }
 const hour=cachedHour,weekday=cachedWeekday;
 const weekend=weekday==='Sat'||weekday==='Sun';
 const rush=!weekend&&(hour>=7&&hour<10||hour>=16&&hour<19);
 const daytime=hour>=10&&hour<21;
 const overnight=hour<6||hour>=23;
 const variability=hash(Math.floor(point[0]*5)+':'+Math.floor(point[1]*5))%19;
 const weather=weatherAt(point,at);
 const weatherLoad=weather==='storm'?16:weather==='rain'?9:weather==='snow'?12:0;
 return Math.max(5,Math.min(99,(rush?70:overnight?12:daytime?42:27)+(weekend?-7:0)+variability+weatherLoad));
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
 const targetKeys=ends.map(key);
 const ordered=roads.filter(validRoad)
  .map(r=>({r,d:Math.min(...(roadEnds(r)??ends).map(p=>meters(p,ends[0])))}))
  .filter(item=>item.d>=120&&item.d<=2600)
  .sort((a,b)=>a.d-b.d).slice(0,8);
 const responders:WorldResponder[]=[];
 const kinds:ResponderKind[]=kind==='roadworks'?[]:kind==='medical'?['ambulance']:['police','ambulance'];
 for(const emergencyKind of kinds){
  let routeAttempts=0;
  let best:{path:Point[];distance:number}|null=null;
  for(const candidate of ordered){
   const fromEnds=roadEnds(candidate.r);
   if(!fromEnds)continue;
   for(const origin of fromEnds){
    if(routeAttempts>=6)break;
    const from=key(origin);
    if(!graph.nodes.has(from))continue;
    for(const target of targetKeys){
     if(routeAttempts>=6)break;
     if(!graph.nodes.has(target))continue;
     // A short geographic prefilter bounds routing work on very large graphs.
     const targetPoint=graph.nodes.get(target)!;
     if(meters(origin,targetPoint)>3100)continue;
     routeAttempts++;
     const routed=routeDiscovered(graph,from,target,discovered);
     if(routed&&routed.path.length>=2&&routed.length>80&&(!best||routed.length<best.distance))
      best={path:routed.path,distance:routed.length};
    }
   }
   if(best)break;
  }
  if(!best)continue; // No illegal straight-line or teleport fallback.
  const distance=best.distance;
  const travelGameMs=Math.max(2*60000,Math.min(15*60000,distance/12*1000));
  const departAt=at+(emergencyKind==='police'?30000:90000);
  responders.push({id:id+':'+emergencyKind,kind:emergencyKind,path:best.path,departAt,arriveAt:departAt+travelGameMs});
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
  const ends=roadEnds(road)!;
  return graph.nodes.has(key(ends[0]))&&graph.nodes.has(key(ends[1]));
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
export function visibleWorldVehicles(roads:readonly RoadFeature[],graph:RoadGraph|null,
 discovered:Set<string>,at:number,realNow:number,incidents:readonly WorldIncident[],limit=40):VisibleWorldVehicle[]{
 const output:VisibleWorldVehicle[]=[];
 if(graph){
  const max=Math.max(0,Math.min(60,Math.floor(limit)));
  const density=roads.length?trafficLoadAt(roadEnds(roads[0])?.[0]??[23.7,37.9],at):0;
  // Sample without sorting or retaining millions of road segments.
  const stride=Math.max(1,Math.floor(roads.length/Math.max(1,max*4)));
  for(let i=0;i<roads.length&&output.length<max;i+=stride){
   const road=roads[i],ends=roadEnds(road),id=String(road.id??road.properties?.roadId??i);
   if(!ends||!validRoad(road)||!discovered.has(id)||hash(id)%100>=density*0.58)continue;
   const ak=key(ends[0]),bk=key(ends[1]);
   const fwd=(graph.edges.get(ak)??[]).some(e=>e.to===bk&&e.id===id&&!e.taxiOnly);
   const rev=(graph.edges.get(bk)??[]).some(e=>e.to===ak&&e.id===id&&!e.taxiOnly);
   if(!fwd&&!rev)continue;
   const reverse=!fwd||rev&&hash(id+'reverse')%2===0;
   const path:Point[]=reverse?[ends[1],ends[0]]:[ends[0],ends[1]];
   let previous=path[0],cursor=path[1];
   for(let j=0;j<3;j++){
    const options=(graph.edges.get(key(cursor))??[]).filter(e=>
     discovered.has(e.id)&&!e.taxiOnly&&e.to!==key(previous)&&graph.nodes.has(e.to)&&e.id!==id);
    if(!options.length)break;
    const chosen=options[hash(id+':'+j)%options.length];
    previous=cursor;cursor=graph.nodes.get(chosen.to)!;path.push(cursor);
   }
   const length=path.slice(1).reduce((sum,p,j)=>sum+meters(path[j],p),0);
   if(length<20)continue;
   const speed=weatherAt(path[0],at)==='snow'?5:weatherAt(path[0],at)==='storm'?8:13;
   const t=(((realNow/1000*speed+hash(id)%Math.max(1,length))%length)+length)%length/length;
   const sample=pointOnPath(path,t);
   if(sample)output.push({id:'npc:'+id,kind:'civilian',point:sample.point,bearing:sample.bearing});
  }
 }
 for(const incident of incidents){
  for(const responder of incident.responders){
   if(at<responder.departAt||at>=incident.endsAt)continue;
   const progress=Math.min(1,(at-responder.departAt)/Math.max(1,responder.arriveAt-responder.departAt));
   const sample=pointOnPath(responder.path,progress);
   if(sample)output.push({id:responder.id,kind:responder.kind,point:sample.point,bearing:sample.bearing});
  }
 }
 return output;
}