import maplibregl from 'maplibre-gl';
import type {FerryNetwork,Coordinate} from '../maritime/ferries';
import {ferryPhase} from './ferryService';

// Visual timetable only: ferries move automatically even without a vehicle aboard.
// No simulation state, purchases, or taxi routes are modified.
type Sailing={id:string;geometry:Coordinate[];cumulative:number[];length:number;durationMinutes:number};
function distance(a:Coordinate,b:Coordinate):number{
 const lat=(a[1]+b[1])*Math.PI/360;
 return Math.hypot((b[0]-a[0])*111320*Math.cos(lat),(b[1]-a[1])*111320);
}
function position(s:Sailing,progress:number):{point:Coordinate;bearing:number}{
 const target=progress*s.length;
 let i=1;
 while(i<s.cumulative.length-1&&s.cumulative[i]<target)i++;
 const a=s.geometry[i-1],b=s.geometry[i];
 const span=s.cumulative[i]-s.cumulative[i-1];
 const t=span>0?Math.max(0,Math.min(1,(target-s.cumulative[i-1])/span)):0;
 const east=(b[0]-a[0])*Math.cos((a[1]+b[1])*Math.PI/360);
 return {point:[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t],bearing:Math.atan2(east,b[1]-a[1])*180/Math.PI};
}
export function startAutomaticFerryMarkers(map:maplibregl.Map,network:FerryNetwork,owned:ReadonlySet<string>,home:Coordinate|undefined,onSailed?:(routeId:string,segments:Array<[Coordinate,Coordinate]>)=>void,_companyId?:string,onPositions?:(positions:Array<{id:string;point:Coordinate}>)=>void,getGameNow:()=>number=()=>Date.now(),getServiceStarts:()=>Readonly<Record<string,number>>=()=>({})):()=>void{
 const ports=new Map(network.ports.map(p=>[p.id,p.position]));
 const sailings:Sailing[]=network.routes.flatMap(r=>{
  if(!owned.has(r.id)||r.geometry.length<2||r.durationMinutes<=0)return [];
  const from=ports.get(r.from),to=ports.get(r.to);
  if(!from||!to)return [];
  // OSM 'from' is an import direction, not the player's departure harbour.
  // For automatic service start at the endpoint closest to headquarters.
  const origin=home&&distance(home,to)<distance(home,from)?to:from;
  // OSM way geometry can be stored in either direction. Start at the
  // route's declared origin harbour, not at an arbitrary OSM endpoint.
  const geometry=distance(r.geometry[0],origin)<=distance(r.geometry[r.geometry.length-1],origin)
   ?r.geometry:[...r.geometry].reverse();
  const cumulative=[0];
  for(let i=1;i<geometry.length;i++)cumulative.push(cumulative[i-1]+distance(geometry[i-1],geometry[i]));
  const length=cumulative[cumulative.length-1];
  return length>1?[{id:r.id,geometry,cumulative,length,durationMinutes:r.durationMinutes}]:[];
 });
 const markers=new Map<string,maplibregl.Marker>();
 const lastSailed=new Map<string,{progress:number;cycle:number;at:number}>();
 let stopped=false;
 const refresh=()=>{
  if(stopped)return;
  const now=Date.now();
  const bounds=map.getBounds();
  const active=new Set<string>();
  const positions:Array<{id:string;point:Coordinate}>=[];
  // Cap DOM markers and work per update. Do not bind to map move/render events.
  for(const sailing of sailings){
   if(active.size>=35)break;
   const started=getServiceStarts()[sailing.id];
   if(!Number.isFinite(started))continue;
   const phase=ferryPhase(started,sailing.durationMinutes,getGameNow());
   const forward=phase.direction==='outbound';
   const progress=forward?phase.progress:1-phase.progress;
   const {point,bearing}=position(sailing,progress);
   const prior=lastSailed.get(sailing.id);
   const cycleIndex=phase.voyageIndex;
   if(!prior||prior.cycle!==cycleIndex){
    lastSailed.set(sailing.id,{progress,cycle:cycleIndex,at:now});
   }else if(phase.phase==='sailing'&&now-prior.at>=2000&&Math.abs(progress-prior.progress)>0.000001){
    // Trace each imported route vertex rather than drawing a shortcut
    // between two sampled boat positions around bends.
    const lo=Math.min(prior.progress,progress)*sailing.length;
    const hi=Math.max(prior.progress,progress)*sailing.length;
    const points:Coordinate[]=[position(sailing,lo/sailing.length).point];
    for(let j=1;j<sailing.cumulative.length-1;j++){
     if(sailing.cumulative[j]>lo&&sailing.cumulative[j]<hi)points.push(sailing.geometry[j]);
    }
    points.push(position(sailing,hi/sailing.length).point);
    if(progress<prior.progress)points.reverse();
    const segments:Array<[Coordinate,Coordinate]>=[];
    for(let j=1;j<points.length;j++)segments.push([points[j-1],points[j]]);
    onSailed?.(sailing.id,segments);
    lastSailed.set(sailing.id,{progress,cycle:cycleIndex,at:now});
   }
   positions.push({id:sailing.id,point});
   if(!bounds.contains(point))continue;
   active.add(sailing.id);
   let marker=markers.get(sailing.id);
   if(!marker){
    const el=document.createElement('img');
    el.src='/assets/passenger_ferry_professional.svg';
    el.alt='Moving ferry';
    el.title='Ferry sailing automatically';
    el.style.cssText='width:52px;height:19px;object-fit:contain;pointer-events:none;user-select:none;filter:drop-shadow(0 1px 2px rgba(0,0,0,.45));';
    marker=new maplibregl.Marker({element:el,rotationAlignment:'map',pitchAlignment:'map'}).setLngLat(point).addTo(map);
    markers.set(sailing.id,marker);
   }
   marker.setLngLat(point);
   marker.setRotation((forward?bearing:bearing+180)-90);
  }
  onPositions?.(positions);
  for(const [id,marker] of markers)if(!active.has(id)){marker.remove();markers.delete(id);}
 };
 const timer=window.setInterval(()=>{if(!document.hidden)refresh()},250);
 refresh();
 return()=>{stopped=true;window.clearInterval(timer);for(const marker of markers.values())marker.remove();markers.clear();lastSailed.clear();};
}
