import maplibregl from 'maplibre-gl';
import type {FerryNetwork,Coordinate} from '../maritime/ferries';

// Visual timetable only: ferries move automatically even without a vehicle aboard.
// No simulation state, purchases, or taxi routes are modified.
type Sailing={id:string;geometry:Coordinate[];cumulative:number[];length:number;durationMs:number};
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
export function startAutomaticFerryMarkers(map:maplibregl.Map,network:FerryNetwork):()=>void{
 const sailings:Sailing[]=network.routes.flatMap(r=>{
  if(r.geometry.length<2||r.durationMinutes<=0)return [];
  const cumulative=[0];
  for(let i=1;i<r.geometry.length;i++)cumulative.push(cumulative[i-1]+distance(r.geometry[i-1],r.geometry[i]));
  const length=cumulative[cumulative.length-1];
  return length>1?[{id:r.id,geometry:r.geometry,cumulative,length,durationMs:Math.max(60000,r.durationMinutes*60000/4)}]:[];
 });
 const markers=new Map<string,maplibregl.Marker>();
 const started=performance.now();
 let stopped=false;
 const refresh=()=>{
  if(stopped)return;
  const now=performance.now()-started;
  const bounds=map.getBounds();
  const active=new Set<string>();
  // Cap DOM markers and work per update. Do not bind to map move/render events.
  for(const sailing of sailings){
   if(active.size>=35)break;
   const cycle=(now/sailing.durationMs)%2;
   const forward=cycle<1;
   const progress=forward?cycle:2-cycle;
   const {point,bearing}=position(sailing,progress);
   if(!bounds.contains(point))continue;
   active.add(sailing.id);
   let marker=markers.get(sailing.id);
   if(!marker){
    const el=document.createElement('img');
    el.src='/assets/passenger_ferry_professional.svg';
    el.alt='Moving ferry';
    el.title='Ferry sailing automatically';
    el.style.cssText='width:27px;height:27px;object-fit:contain;pointer-events:none;user-select:none;';
    marker=new maplibregl.Marker({element:el,rotationAlignment:'map',pitchAlignment:'map'}).setLngLat(point).addTo(map);
    markers.set(sailing.id,marker);
   }
   marker.setLngLat(point);
   marker.setRotation((forward?bearing:bearing+180)-90);
  }
  for(const [id,marker] of markers)if(!active.has(id)){marker.remove();markers.delete(id);}
 };
 const timer=window.setInterval(()=>{if(!document.hidden)refresh()},250);
 refresh();
 return()=>{stopped=true;window.clearInterval(timer);for(const marker of markers.values())marker.remove();markers.clear();};
}
