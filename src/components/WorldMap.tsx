import {diagnostic,diagnosticReport} from '../frontendDiagnostics';
import {enablePerformanceMonitor,performanceMonitorEnabled,recordPerformance,incrementPerformance,readPerformance,recordActiveFrame,markMonitorSuspended,recordActivity,recordLongTask,type PerformanceSnapshot} from '../performanceMonitor';
import {applyTravelEmpireStyle,mapDayPhase} from './travelEmpireMapStyle';
import {gameHour} from '../simulation/gameClock';
import {formatGameClock,type GameClock} from '../simulation/gameClock';
import './station-markers.css';
import {useEffect,useRef,useState} from 'react';
import {loadFerryNetwork,type FerryNetwork} from '../maritime/ferries';
import {syncFerryMapLayer} from './FerryMapLayer';
import {startAutomaticFerryMarkers} from '../maritime/automaticFerryMarkers';
import type {FerryConnectionResult} from '../maritime/roadConnections';
import maplibregl from 'maplibre-gl';
import {Layers3,Map as MapIcon,Satellite} from 'lucide-react';
import type {Headquarters} from '../company';
import {advanceTaxi,type Taxi,type RoadGraph} from '../simulation/taxi';
import {deliveryPosition} from '../dealership';
import {loadStationTile,stationTileKey,stationDistanceKm,type Station} from '../data/stations';
import {energyRangeKm} from '../simulation/energy';
import {reachableStations,type StationRoute} from '../data/stationRouting';

// The delivery SVG faces right (east) at zero rotation. Rotate it to the
// bearing of the current road segment, not the overall delivery route.

// In-memory, bounded startup trace. No vehicle coordinates or save contents are included.
const startupStarted=typeof performance!=='undefined'?performance.timeOrigin:Date.now();
const startupEvents:{ms:number;event:string;detail?:string}[]=[];
function startupTrace(event:string,detail?:string){
 const ms=typeof performance!=='undefined'?Math.round(performance.now()):0;
 startupEvents.push({ms,event,detail});diagnostic('map',event+(detail?' '+detail:''));
 if(startupEvents.length>120)startupEvents.shift();
}
function startupReport(){
 const navigation=typeof performance!=='undefined'?performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming|undefined:undefined;
 const rows=['TravelEmpire startup trace','Build: '+import.meta.env.MODE,'Elapsed: '+Math.round(Date.now()-startupStarted)+' ms',
  'Navigation: '+(navigation?JSON.stringify({domInteractive:Math.round(navigation.domInteractive),domComplete:Math.round(navigation.domComplete),loadEventEnd:Math.round(navigation.loadEventEnd)}):'unavailable'),
  'User agent: '+navigator.userAgent,
  ...startupEvents.map(e=>e.ms+' ms | '+e.event+(e.detail?' | '+e.detail:''))];
 return rows.join('\\n')+'\\n\\n'+diagnosticReport();
}

function deliveryHeading(path: [number,number][], started: number, until: number, now: number): number {
 if (path.length < 2 || until <= started) return 0;
 const lengths = path.slice(1).map((p,i) => {
  const a=path[i];
  const lat=(a[1]+p[1])*Math.PI/360;
  return Math.hypot((p[0]-a[0])*111320*Math.cos(lat),(p[1]-a[1])*111320);
 });
 const total=lengths.reduce((sum,n)=>sum+n,0);
 let remaining=total*Math.max(0,Math.min(1,(now-started)/(until-started)));
 let index=lengths.length-1;
 for(let i=0;i<lengths.length;i++){
  if(remaining<=lengths[i]){index=i;break;}
  remaining-=lengths[i];
 }
 // Skip zero-length segments, which have no meaningful direction.
 if(lengths[index]<0.01){const found=lengths.findIndex(n=>n>=0.01);if(found<0)return 0;index=found;}
 const a=path[index],b=path[index+1];
 const east=(b[0]-a[0])*Math.cos((a[1]+b[1])*Math.PI/360);
 const north=b[1]-a[1];
 const bearing=Math.atan2(east,north)*180/Math.PI;
 return bearing-90;
}
// Interpolate the distance travelled along the actual OSM route, not the
// straight chord between simulation snapshots (which cuts across corners).
function positionOnTravelledRoute(from:Taxi,to:Taxi,fraction:number):[number,number]{
 const start=from.position,end=to.position;
 if(fraction<=0)return start;
 if(fraction>=1)return end;
 if(from.path.length<2||to.path.length<2||from.path!==to.path && (from.edgeIds.length>to.edgeIds.length||!from.edgeIds.every((id,i)=>id===to.edgeIds[i]))){
  return [start[0]+(end[0]-start[0])*fraction,start[1]+(end[1]-start[1])*fraction];
 }
 const path=to.path;
 // On a mission transition, the old and new routes differ: don't attempt
 // to traverse unrelated geometry.
 if(from.leg>to.leg||from.leg>=path.length-1||to.leg>=path.length)return [start[0]+(end[0]-start[0])*fraction,start[1]+(end[1]-start[1])*fraction];
 const points:[number,number][]=[start];
 for(let leg=from.leg;leg<to.leg&&leg<path.length-1;leg++)points.push(path[leg+1]);
 points.push(end);
 const distances:number[]=[];let total=0;
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i];
  const dx=(b[0]-a[0])*111320*Math.cos((a[1]+b[1])*Math.PI/360);
  const dy=(b[1]-a[1])*111320;
  const length=Math.hypot(dx,dy);distances.push(length);total+=length;
 }
 if(total<0.001)return end;
 let remaining=total*fraction;
 for(let i=0;i<distances.length;i++){
  if(remaining<=distances[i]||i===distances.length-1){
   const t=distances[i]>0?Math.min(1,remaining/distances[i]):1;
   return [points[i][0]+(points[i+1][0]-points[i][0])*t,points[i][1]+(points[i+1][1]-points[i][1])*t];
  }
  remaining-=distances[i];
 }
 return end;
}
type Basemap='standard'|'satellite';
type Props={depots?:Array<{id:string;name:string;lng:number;lat:number;capacity:number}>;companyId?:string;purchasedFerryRouteIds?:string[];selecting:boolean;onLocationSelected:(location:Headquarters)=>void;headquarters:Headquarters|null;taxis?:Taxi[];exploredEdgeIds?:string[];graph?:RoadGraph|null;onExplorerCommand?:(id:string,action:'home'|'resume')=>void;gameClock?:GameClock|null;shiftHours?:8|10;onShiftHoursChange?:(hours:8|10)=>void};
const key=import.meta.env.VITE_MAPTILER_KEY?.trim();const customStyle=import.meta.env.VITE_MAP_STYLE_URL?.trim();
function styleFor(mode:Basemap):string|null{if(mode==='standard'&&customStyle)return customStyle;if(!key)return null;return `https://api.maptiler.com/maps/${mode==='standard'?'streets-v4':'hybrid'}/style.json?key=${encodeURIComponent(key)}`;}
export default function WorldMap({depots=[],companyId,purchasedFerryRouteIds=[],selecting,onLocationSelected,headquarters,taxis=[],exploredEdgeIds=[],graph,onExplorerCommand,gameClock}:Props){
 const [perfOpen,setPerfOpen]=useState(false);
 const [perfSnapshot,setPerfSnapshot]=useState<PerformanceSnapshot|null>(null);
 useEffect(()=>{
  enablePerformanceMonitor(perfOpen);
  if(!perfOpen){setPerfSnapshot(null);return;}
  recordPerformance({visibleExplored:visibleExploredFeatures.current.size,exploredRoads:currentExploredRoads.current.size});
  setPerfSnapshot(readPerformance());
  const timer=window.setInterval(()=>setPerfSnapshot(readPerformance()),1000);
  return()=>{window.clearInterval(timer);enablePerformanceMonitor(false);};
 },[perfOpen]);
 const [ferryNetwork,setFerryNetwork]=useState<FerryNetwork|null>(null);
 useEffect(()=>{if(!perfOpen)return;const onVisibility=()=>markMonitorSuspended();document.addEventListener('visibilitychange',onVisibility);window.addEventListener('pageshow',onVisibility);window.addEventListener('pagehide',onVisibility);return()=>{document.removeEventListener('visibilitychange',onVisibility);window.removeEventListener('pageshow',onVisibility);window.removeEventListener('pagehide',onVisibility);};},[perfOpen]);
 useEffect(()=>{
  if(!perfOpen||typeof PerformanceObserver==='undefined')return;
  let observer:PerformanceObserver|undefined;
  try{
   observer=new PerformanceObserver(list=>{for(const entry of list.getEntries())recordLongTask(entry.duration);});
   observer.observe({entryTypes:['longtask']});
  }catch{observer?.disconnect();}
  return()=>observer?.disconnect();
 },[perfOpen]);
 useEffect(()=>{
  if(!perfOpen)return;
  const instance=map.current;if(!instance)return;
  let lastRender=0;
  const onRender=()=>{
   const now=performance.now();
   // Only report gaps between frames in an active rendering burst.
   // A long idle period followed by a render is not a blocked frame.
   if(lastRender&&now-lastRender>50&&now-lastRender<250&&instance.isMoving())recordActivity('map:render',now-lastRender);
   lastRender=now;
  };
  instance.on('render',onRender);
  return()=>{instance.off('render',onRender);};
 },[perfOpen]);
 useEffect(()=>{let active=true;loadFerryNetwork().then(data=>{if(active)setFerryNetwork(data)}).catch(err=>console.warn('Ferry overlay unavailable',err));return()=>{active=false}},[]);
 const [ferryConnections,setFerryConnections]=useState<FerryConnectionResult|undefined>(undefined);
 // Build a small spatial lookup in bounded batches, never inside a map event handler.
 useEffect(()=>{
  setFerryConnections(undefined);
  if(!graph||!ferryNetwork)return;
  let cancelled=false;
  let timer:ReturnType<typeof setTimeout>|undefined;
  const cells=new Map<string,string[]>();
  const cellSize=0.002;
  const keyFor=(lng:number,lat:number)=>`${Math.floor(lng/cellSize)}:${Math.floor(lat/cellSize)}`;
  let offset=0;
  const build=()=>{
   if(cancelled)return;
   const until=Math.min(offset+2000,graph.nodeKeys.length);
   for(;offset<until;offset++){
    const id=graph.nodeKeys[offset];
    const p=graph.nodes.get(id);
    if(!p||!graph.edges.get(id)?.length)continue;
    const key=keyFor(p[0],p[1]);
    const list=cells.get(key);
    if(list)list.push(id);else cells.set(key,[id]);
   }
   if(offset<graph.nodeKeys.length){timer=setTimeout(build,0);return;}
   const connected:FerryConnectionResult['connected']=[];
   const unconnected:FerryConnectionResult['unconnected']=[];
   for(const port of ferryNetwork.ports){
    const access=port.roadAccess??port.position;
    const x=Math.floor(access[0]/cellSize),y=Math.floor(access[1]/cellSize);
    let bestId:string|undefined,bestDistance=Infinity;
    for(let dx=-2;dx<=2;dx++)for(let dy=-2;dy<=2;dy++){
     for(const id of cells.get(`${x+dx}:${y+dy}`)??[]){
      const p=graph.nodes.get(id)!;
      const lngMeters=(p[0]-access[0])*111320*Math.cos(access[1]*Math.PI/180);
      const latMeters=(p[1]-access[1])*111320;
      const distance=Math.hypot(lngMeters,latMeters);
      if(distance<bestDistance){bestDistance=distance;bestId=id;}
     }
    }
    if(bestId&&bestDistance<=250)connected.push({portId:port.id,roadNodeId:bestId,roadPoint:graph.nodes.get(bestId)!,distanceMeters:bestDistance});
    else unconnected.push({portId:port.id,reason:'No loaded drivable road node within 250 m'});
   }
   if(!cancelled)setFerryConnections({connected,unconnected});
  };
  timer=setTimeout(build,0);
  return()=>{cancelled=true;if(timer!==undefined)clearTimeout(timer)};
 },[graph,ferryNetwork]);
 useEffect(()=>{
  const instance=map.current;
  if(!instance||!ferryNetwork)return;
  const owned=new Set(purchasedFerryRouteIds);
  const update=()=>{if(instance.isStyleLoaded())syncFerryMapLayer(instance,ferryNetwork,owned,ferryConnections)};
  instance.on('style.load',update);
  update();
  return()=>{instance.off('style.load',update);};
 },[ferryNetwork,purchasedFerryRouteIds,ferryConnections]);
 const taxiMarkers=useRef(new Map<string,maplibregl.Marker>());
 const explorerCommandRef=useRef(onExplorerCommand);explorerCommandRef.current=onExplorerCommand;
 const taxiStateRef=useRef(taxis);taxiStateRef.current=taxis;
 const stationMarkers=useRef(new Map<string,maplibregl.Marker>());
 const depotMarkers=useRef(new Map<string,maplibregl.Marker>());
 const [stationsVisible,setStationsVisible]=useState(true);
 const [stations,setStations]=useState<Station[]>([]);
 const [stationStatus,setStationStatus]=useState('Station lookup waiting');
 const [stationRoutes,setStationRoutes]=useState<Record<string,StationRoute|null>>({});
 const deliveryMarkers=useRef(new Map<string,maplibregl.Marker>());
 const initialHeadquarters=useRef(headquarters);
 const firstHeadquartersPositioned=useRef(false);
 const container=useRef<HTMLDivElement>(null);const map=useRef<maplibregl.Map|null>(null);const marker=useRef<maplibregl.Marker|null>(null);const onLocationRef=useRef(onLocationSelected);onLocationRef.current=onLocationSelected;

 const selectingRef=useRef(selecting);selectingRef.current=selecting;
 const [startupLogOpen,setStartupLogOpen]=useState(false);const [startupCopied,setStartupCopied]=useState(false);
 useEffect(()=>{startupTrace('WorldMap mounted');},[]);
 useEffect(()=>{startupTrace('Road graph changed',graph?('nodes='+graph.nodeKeys.length):'not ready');},[graph]);
 useEffect(()=>{startupTrace('Exploration changed','roads='+exploredEdgeIds.length);},[exploredEdgeIds.length]);
 const copyStartupLog=async()=>{const report=startupReport();try{await navigator.clipboard.writeText(report);setStartupCopied(true);}catch{setStartupLogOpen(true);}};
 const [roadsVisible,setRoadsVisible]=useState(true);const [roadStatus,setRoadStatus]=useState('Waiting for geographic road tiles');const [basemap,setBasemap]=useState<Basemap>('standard');const [error,setError]=useState<string|null>(null);const [ready,setReady]=useState(false);const [selectorOpen,setSelectorOpen]=useState(false);const [lookingUp,setLookingUp]=useState(false);const busy=useRef(false);
 useEffect(()=>{const style=styleFor('standard');if(!container.current||!style)return;startupTrace('MapLibre constructor started');const instance=new maplibregl.Map({container:container.current,style,center:initialHeadquarters.current?[initialHeadquarters.current.lng,initialHeadquarters.current.lat]:[-6.1,53.2],zoom:initialHeadquarters.current?11:9,minZoom:1,maxZoom:19,attributionControl:false});map.current=instance;instance.addControl(new maplibregl.NavigationControl({showCompass:true}),'bottom-right');instance.addControl(new maplibregl.AttributionControl({compact:true}),'bottom-left');instance.on('styleimagemissing',event=>{
  if(!event.id||instance.hasImage(event.id))return;
  instance.addImage(event.id,{width:1,height:1,data:new Uint8Array(4)});
 });instance.on('load',()=>{startupTrace('MapLibre load event');setReady(true);});instance.on('error',e=>{diagnostic('map:error',String(e.error).slice(0,200));console.error('MapLibre:',e.error);setError('Some map resources failed to load. Check your API key and network.');});
 instance.on('click',async e=>{if(!selectingRef.current)return;if(busy.current)return;busy.current=true;setLookingUp(true);setError(null);const {lng,lat}=e.lngLat;try{if(!key)throw Error('MapTiler API key required for location lookup.');const response=await fetch(`https://api.maptiler.com/geocoding/${lng},${lat}.json?key=${encodeURIComponent(key)}&language=en`);if(!response.ok)throw Error(`Location lookup failed (${response.status})`);const data=await response.json() as {features?:Array<{text?:string;place_name?:string;place_type?:string[];properties?:Record<string,unknown>;context?:Array<{id?:string;text?:string;short_code?:string}>}>};const features=data.features??[];const place=features[0];const context=[...(place?.context??[])];for(const f of features){if(f.place_type?.includes('country'))context.push({id:'country',text:f.text,short_code:String(f.properties?.short_code??'')});if(f.place_type?.includes('region'))context.push({id:'region',text:f.text});}const country=context.find(c=>c.id?.startsWith('country'));const region=context.find(c=>c.id?.startsWith('region'));if(!country?.text)throw Error('Select a location on land within a recognized country.');onLocationRef.current({lng,lat,label:place?.text||place?.place_name||`${lat.toFixed(4)}, ${lng.toFixed(4)}`,country:country.text,countryCode:country.short_code??'',region:region?.text??''});}catch(err){setError(err instanceof Error?err.message:'Unable to identify this location.');}finally{busy.current=false;setLookingUp(false);}});
 return()=>{taxiMarkers.current.forEach(m=>m.remove());taxiMarkers.current.clear();stationMarkers.current.forEach(m=>m.remove());stationMarkers.current.clear();depotMarkers.current.forEach(m=>m.remove());depotMarkers.current.clear();deliveryMarkers.current.forEach(m=>m.remove());deliveryMarkers.current.clear();marker.current?.remove();marker.current=null;map.current=null;instance.remove();};},[]);
 useEffect(()=>{if(!map.current)return;map.current.getCanvas().style.cursor=selecting?'crosshair':'';},[selecting]);
 useEffect(()=>{if(!map.current)return;marker.current?.remove();marker.current=null;if(headquarters){marker.current=new maplibregl.Marker({color:'#4bd9ac'}).setLngLat([headquarters.lng,headquarters.lat]).setPopup(new maplibregl.Popup({offset:20}).setText(`${headquarters.label} — ${headquarters.country}`)).addTo(map.current);marker.current.getElement().style.zIndex='3';if(!firstHeadquartersPositioned.current){firstHeadquartersPositioned.current=true;map.current.jumpTo({center:[headquarters.lng,headquarters.lat],zoom:Math.max(map.current.getZoom(),11)});}else{map.current.flyTo({center:[headquarters.lng,headquarters.lat],zoom:Math.max(map.current.getZoom(),11)});}}},[headquarters]);
 useEffect(()=>{if(!map.current)return;const ids=new Set(depots.map(d=>d.id));for(const [id,m] of depotMarkers.current)if(!ids.has(id)){m.remove();depotMarkers.current.delete(id);}for(const d of depots){const existing=depotMarkers.current.get(d.id);if(existing){existing.setLngLat([d.lng,d.lat]);continue;}const marker=new maplibregl.Marker({color:'#f7ae43'}).setLngLat([d.lng,d.lat]).setPopup(new maplibregl.Popup({offset:18}).setText(`${d.name} · ${d.capacity} spaces`)).addTo(map.current);depotMarkers.current.set(d.id,marker);}},[depots]);
 // Query small OSM cells near operating vehicles. Cap requests to avoid overwhelming public servers.
 useEffect(()=>{
  if(!stationsVisible||!ready||!taxis.length){setStations([]);setStationStatus(!stationsVisible?'Stations hidden':'Waiting for taxis');return;}
  let cancelled=false;let busyLoading=false;
  const load=async()=>{
   if(busyLoading)return;busyLoading=true;
   const coords=taxis.filter(t=>Number.isFinite(t.position[0])&&Number.isFinite(t.position[1])).map(t=>({lng:t.position[0],lat:t.position[1]}));
   const unique=new Map<string,{lng:number;lat:number}>();for(const p of coords){const key=stationTileKey(p.lng,p.lat);if(!unique.has(key))unique.set(key,p);if(unique.size>=6)break;}
   if(!unique.size){busyLoading=false;setStationStatus('No valid taxi positions');return;}
   setStationStatus('Loading offline OSM station tiles…');
   const results=await Promise.allSettled([...unique.values()].map(p=>loadStationTile(p.lng,p.lat)));
   busyLoading=false;if(cancelled)return;
   const found=new Map<string,Station>();for(const result of results)if(result.status==='fulfilled')for(const station of result.value)found.set(station.id,station);
   setStations([...found.values()]);const failed=results.filter(r=>r.status==='rejected').length;
   setStationStatus(`${found.size} offline OSM locations nearby${failed?` · ${failed} tile(s) unavailable`:''}`);
  };
  void load();const timer=setInterval(()=>void load(),60000);
  return()=>{cancelled=true;clearInterval(timer);};
 },[ready,stationsVisible,taxis.map(t=>stationTileKey(t.position[0],t.position[1])).join('|')]);
 useEffect(()=>{
  const instance=map.current;if(!instance)return;
  const visible=stationsVisible?stations:[];const ids=new Set(visible.map(s=>s.id));
  for(const [id,marker] of stationMarkers.current)if(!ids.has(id)){marker.remove();stationMarkers.current.delete(id);}
  for(const station of visible){if(stationMarkers.current.has(station.id))continue;
   const element=document.createElement('div');element.className=`te-station-marker te-station-${station.kind}`;element.textContent=station.kind==='fuel'?'⛽':station.kind==='charging'?'⚡':'🔧';element.title=station.name;
   const popup=new maplibregl.Popup({offset:15}).setText(`${station.name} · ${station.kind==='fuel'?'Fuel':station.kind==='charging'?'EV charging':'Vehicle workshop'}${station.operator?' · '+station.operator:''}${station.access?' · Access: '+station.access:''}`);
   const marker=new maplibregl.Marker({element,anchor:'bottom'}).setLngLat([station.lng,station.lat]).setPopup(popup).addTo(instance);stationMarkers.current.set(station.id,marker);
  }
 },[stations,stationsVisible,ready]);
 // Route calculations run only when station data or the road graph changes,
 // not on every taxi animation frame. Keep the UI responsive for large fleets.
 useEffect(()=>{
  if(!stationsVisible||!graph||!stations.length){setStationRoutes({});return;}
  let cancelled=false;
  const timer=setTimeout(()=>{
   const output:Record<string,StationRoute|null>={};
   for(const t of taxis.slice(0,8)){
    const kind='fuel';
    output[t.id]=reachableStations(graph,t.position,stations,kind,energyRangeKm(t))[0]??null;
   }
   if(!cancelled)setStationRoutes(output);
  },100);
  return()=>{cancelled=true;clearTimeout(timer);};
 },[graph,stations,stationsVisible,taxis.map(t=>`${t.id}:${Math.floor(t.position[0]*1000)}:${Math.floor(t.position[1]*1000)}`).join('|')]);
 const nearestInfo=taxis.slice(0,4).map(t=>{const kind='fuel';const point={lng:t.position[0],lat:t.position[1]};const match=stationRoutes[t.id]??null;return {taxi:t.name,kind,match,distance:match?.roadKm??null,straight:match?stationDistanceKm(point,match.station):null};});
 const taxisRef=useRef(taxis);taxisRef.current=taxis;
 // Render one simulation tick behind the authoritative state. This avoids running
 // the road integrator on every animation frame and prevents one-second jumps.
 const graphRef=useRef(graph);graphRef.current=graph;
 const taxiSnapshots=useRef(new Map<string,{from:Taxi;to:Taxi;forecast:Taxi;at:number}>());
 const taxiHeadingState=useRef(new Map<string,{angle:number;position:[number,number];at:number}>());
 // Render-only state. Simulation position, job status and saved coordinates are untouched.
 const renderedPosition=useRef(new Map<string,[number,number]>());
 useEffect(()=>{
 const started=performance.now();
 const now=started;
 const wallNow=Date.now();
 let changed=0,unchanged=0,created=0,removed=0;
 const ids=new Set<string>();
 for(const taxi of taxis)if(!taxi.deliveryUntil||taxi.deliveryUntil<=wallNow)ids.add(taxi.id);
 for(const [id,m] of taxiMarkers.current){
  if(!ids.has(id)){m.remove();taxiMarkers.current.delete(id);taxiSnapshots.current.delete(id);taxiHeadingState.current.delete(id);renderedPosition.current.delete(id);removed++;}
 }
 for(const taxi of taxis){
  if(taxi.deliveryUntil&&taxi.deliveryUntil>wallNow)continue;
  const previous=taxiSnapshots.current.get(taxi.id);
  // React may supply new Taxi objects with unchanged render-relevant state.
  // Preserve the animation clock and forecast in that case.
  const sameMotion=!!previous&&previous.to.position[0]===taxi.position[0]&&previous.to.position[1]===taxi.position[1]&&previous.to.status===taxi.status&&previous.to.path===taxi.path&&previous.to.edgeIds===taxi.edgeIds&&previous.to.leg===taxi.leg&&previous.to.distanceIntoLeg===taxi.distanceIntoLeg&&previous.to.speedKph===taxi.speedKph;
  if(sameMotion){unchanged++;}else{changed++;}
  if(!sameMotion){
   const forecast=graphRef.current&&taxi.status!=='IDLE'?advanceTaxi(taxi,graphRef.current,0.65).taxi:taxi;
   // Preserve the last rendered position across simulation ticks to avoid
   // one-frame jumps when the simulation and animation clocks differ.
   // Only do this on the same route; a new job must not interpolate from
   // the old job's unrelated path.
   const sameRoute=!!previous&&previous.to.edgeIds.length<=taxi.edgeIds.length&&
    previous.to.edgeIds.every((id,i)=>id===taxi.edgeIds[i])&&previous.to.leg<=taxi.leg;
   const displayed=renderedPosition.current.get(taxi.id);
   const from=sameRoute&&displayed?{...previous.to,position:displayed}:previous?.to??taxi;
   taxiSnapshots.current.set(taxi.id,{from,to:taxi,forecast,at:now});
  }if(!taxiMarkers.current.has(taxi.id)&&map.current){const el=document.createElement('div');el.className='taxi-map-marker';const img=document.createElement('img');img.src=`${import.meta.env.BASE_URL??'/'}assets/${taxi.kind==='recovery'?'heavy_recovery_truck.svg':taxi.kind==='explorer'?'SimplePurpleCarTopView.svg':'car_topview.svg'}`;img.alt='';img.draggable=false;el.appendChild(img);el.title=taxi.name;
   if(taxi.kind==='explorer'){
    el.style.cursor='pointer';el.setAttribute('role','button');el.setAttribute('tabindex','0');
    const openControls=(event:Event)=>{event.stopPropagation();const current=taxiStateRef.current.find(t=>t.id===taxi.id);if(!current||!map.current)return;
     const popupContent=document.createElement('div');const label=document.createElement('strong');label.textContent=current.name;popupContent.appendChild(label);
     const status=document.createElement('p');status.textContent=current.status==='PAUSED'?'Paused at headquarters':current.pauseAtHome?'Returning home to pause':current.status;popupContent.appendChild(status);
     const button=document.createElement('button');button.type='button';const paused=current.status==='PAUSED';button.textContent=paused?'Resume exploration':'Send home & pause';button.disabled=!paused&&current.status==='RETURNING'&&Boolean(current.pauseAtHome);
     button.addEventListener('click',()=>{explorerCommandRef.current?.(current.id,paused?'resume':'home');popup.remove();});popupContent.appendChild(button);
     const popup=new maplibregl.Popup({offset:22,closeOnClick:true}).setLngLat(current.position).setDOMContent(popupContent).addTo(map.current);
    };
    el.addEventListener('click',openControls);
    el.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();openControls(event);}});
   }
   const m=new maplibregl.Marker({element:el,anchor:'center',rotationAlignment:'map',pitchAlignment:'map'}).setLngLat(taxi.position).addTo(map.current);m.getElement().style.zIndex='3';taxiMarkers.current.set(taxi.id,m);created++;}}
 const duration=performance.now()-started;
 if(duration>12)console.warn('[TravelEmpire] Slow vehicle snapshot update',{durationMs:Math.round(duration),fleet:taxis.length,changed,unchanged,created,removed});
},[taxis]);
 useEffect(()=>{
  let frame=0;
  let lastDeliveryRefresh=0;
  let lastFrameAt=0,frameSamples=0,slowFrames=0,maxFrameGap=0;
  let lastPerfReport=performance.now();
  const animate=()=>{
   const frameNow=performance.now();
   if(performanceMonitorEnabled())recordActiveFrame(frameNow);

   if(lastFrameAt){const gap=frameNow-lastFrameAt;frameSamples++;if(gap>50)slowFrames++;maxFrameGap=Math.max(maxFrameGap,gap);}
   lastFrameAt=frameNow;
   if(frameNow-lastPerfReport>=30000){if(slowFrames>5)console.warn('[TravelEmpire] Map frame delays',{slowFrames,frameSamples,maxGapMs:Math.round(maxFrameGap),markers:taxiMarkers.current.size});frameSamples=0;slowFrames=0;maxFrameGap=0;lastPerfReport=frameNow;}
   // Delivery animations are less frequent than vehicle position interpolation.
   if(frameNow-lastDeliveryRefresh>=100){
    lastDeliveryRefresh=frameNow;
    const wallNow=Date.now();
   const deliveries=taxisRef.current.filter(t=>t.deliveryUntil&&t.deliveryUntil>wallNow);
   const activeIds=new Set(deliveries.map(t=>t.id));
   for(const [id,m] of deliveryMarkers.current)if(!activeIds.has(id)){m.remove();deliveryMarkers.current.delete(id)}
   for(const taxi of deliveries){
    const point=deliveryPosition(taxi,wallNow);if(!point||!map.current)continue;
    let m=deliveryMarkers.current.get(taxi.id);
    if(!m){const el=document.createElement('div');el.className='delivery-map-marker';const img=document.createElement('img');img.src=`${import.meta.env.BASE_URL}assets/delivery_truck.svg`;img.alt='Vehicle delivery';el.appendChild(img);m=new maplibregl.Marker({element:el,anchor:'center',rotationAlignment:'map',pitchAlignment:'map'}).setLngLat(point).addTo(map.current);m.getElement().style.zIndex='3';deliveryMarkers.current.set(taxi.id,m)}
    m.setLngLat(point);
    if(taxi.deliveryPath&&taxi.deliveryStartedAt&&taxi.deliveryUntil){
     m.setRotation(deliveryHeading(taxi.deliveryPath,taxi.deliveryStartedAt,taxi.deliveryUntil,wallNow));
    }
    m.getElement().title=`Delivering ${taxi.vehicleModel??taxi.name}`;
   }
   }
   const now=frameNow;
   for(const [id,snapshot] of taxiSnapshots.current){
    const marker=taxiMarkers.current.get(id);if(!marker)continue;
    const taxi=snapshot.to;
    if(snapshot.from.position[0]===snapshot.to.position[0]&&snapshot.from.position[1]===snapshot.to.position[1]&&snapshot.to.position[0]===snapshot.forecast.position[0]&&snapshot.to.position[1]===snapshot.forecast.position[1]&&renderedPosition.current.has(id))continue;
    const elapsed=Math.max(0,(now-snapshot.at)/1000);
    // Continue a short distance along the actual road after a late simulation tick.
    // Forecast is computed only when authoritative state changes, never per frame.
    const position=elapsed<=1
      ?positionOnTravelledRoute(snapshot.from,snapshot.to,Math.min(1,elapsed))
      :positionOnTravelledRoute(snapshot.to,snapshot.forecast,Math.min(1,(elapsed-1)/0.65));
    const lastRendered=renderedPosition.current.get(id);
    if(!lastRendered||Math.abs(lastRendered[0]-position[0])+Math.abs(lastRendered[1]-position[1])>1e-9){
     marker.setLngLat(position);
     renderedPosition.current.set(id,position);
    }
    // Derive heading from the interpolated *displayed* motion, not the next
    // simulation leg: otherwise rotation leads the marker at intersections.
    const previousHeading=taxiHeadingState.current.get(id);
    if(previousHeading){
     const dx=(position[0]-previousHeading.position[0])*Math.cos(position[1]*Math.PI/180);
     const dy=position[1]-previousHeading.position[1];
     const distanceSquared=dx*dx+dy*dy;
     if(distanceSquared>1e-15){
      const target=Math.atan2(dx,dy)*180/Math.PI;
      const delta=((target-previousHeading.angle+540)%360)-180;
      const dt=Math.min(0.1,Math.max(0,(now-previousHeading.at)/1000));
      // Smooth short-arc turning, including wraparound at 0/360 degrees.
      // A speed-aware turn response avoids snapping at intersections while
      // keeping fast-moving taxis aligned with the road direction.
      const blend=1-Math.exp(-dt/((taxi.speedKph ?? 0)>45?0.12:0.20));
      previousHeading.angle+=delta*blend;
      if(Math.abs(delta*blend)>0.05)marker.setRotation(previousHeading.angle);
     }
     previousHeading.position=position;
     previousHeading.at=now;
    }else{
     let initial=0;
     if(taxi.path.length>1){
      const index=Math.min(taxi.leg,taxi.path.length-2);
      const a=taxi.path[index],b=taxi.path[index+1];
      initial=Math.atan2((b[0]-a[0])*Math.cos((a[1]+b[1])*Math.PI/360),b[1]-a[1])*180/Math.PI;
     }
     taxiHeadingState.current.set(id,{angle:initial,position,at:now});
     marker.setRotation(initial);
    }
    // Avoid mutating DOM attributes on every animation frame.
    const title=`${taxi.name} · ${taxi.status} · ${Math.round(taxi.speedKph??0)} km/h`;
    if(marker.getElement().title!==title)marker.getElement().title=title;
   }
   frame=requestAnimationFrame(animate);
  };
  frame=requestAnimationFrame(animate);
  return()=>cancelAnimationFrame(frame);
 },[]);
 // Keep visible road geometry separate from the fast-changing purple overlay.
 // Discovery updates must not depend on the map moving or on a full graph scan.
 const visibleRoadFeatures=useRef<GeoJSON.Feature[]>([]);
 const refreshRoadLines=useRef<(()=>void)|null>(null);
 const lastExplorerTelemetry=useRef<Map<string,{leg:number;edge:string;status:string}>>(new Map());
 useEffect(()=>{
  for(const taxi of taxis){
   if(taxi.kind!=='explorer')continue;
   const edge=taxi.edgeIds[taxi.leg]??'(none)';
   const previous=lastExplorerTelemetry.current.get(taxi.id);
   if(!previous||previous.leg!==taxi.leg||previous.edge!==edge||previous.status!==taxi.status){
    if(previous&&previous.leg!==taxi.leg){
     const completed=taxi.edgeIds[Math.max(0,taxi.leg-1)]??previous.edge;
     addDebug(`NODE reached: ${taxi.name}, leg ${previous.leg}→${taxi.leg}, edge ${completed.slice(0,24)}, state=${exploredEdgeIds.includes(completed)?'explored':'PENDING'}`);
    }else if(!previous||previous.status!==taxi.status){
     addDebug(`Explorer ${taxi.name}: ${taxi.status}, leg ${taxi.leg}, route edges ${taxi.edgeIds.length}`);
    }
    lastExplorerTelemetry.current.set(taxi.id,{leg:taxi.leg,edge,status:taxi.status});
   }
  }
 },[taxis,exploredEdgeIds]);

 const addDebug=(_message:string)=>{};


 const currentExploredRoads=useRef<Set<string>>(new Set());
 const visibleExploredFeatures=useRef<Map<string,GeoJSON.Feature>>(new Map());
 const visibleRoadIndex=useRef<Map<string,GeoJSON.Feature>>(new Map());
 const lastPurpleSourceUpdate=useRef(0);
 const purpleRenderStats=useRef({updates:0,slow:0,maxMs:0,lastReport:0});
 const purpleRefreshTimer=useRef<number|null>(null);
 const purpleRevision=useRef(0);
 const flushedPurpleRevision=useRef(-1);
 const viewportSourceSignature=useRef('');
 const viewportGraphRef=useRef<typeof graph>(null);
 const purpleSourceId='explored-road-network-source';
 const refreshPurpleRoads=()=>{
  const instance=map.current;
  if(!instance||!instance.isStyleLoaded())return;
  const source=instance.getSource(purpleSourceId) as maplibregl.GeoJSONSource|undefined;
  if(!source)return;
  if(flushedPurpleRevision.current===purpleRevision.current)return;
  const started=performance.now();
  const features=[...visibleExploredFeatures.current.values()];
  source.setData({type:'FeatureCollection',features});
  flushedPurpleRevision.current=purpleRevision.current;
  if(performanceMonitorEnabled())recordActivity('map:purple-source',performance.now()-started);
  lastPurpleSourceUpdate.current=started;
  const stats=purpleRenderStats.current;const duration=performance.now()-started;
  if(performanceMonitorEnabled()){incrementPerformance('sourceUpdates');recordPerformance({sourceMs:duration,visibleExplored:features.length});}
  stats.updates++;if(duration>12)stats.slow++;stats.maxMs=Math.max(stats.maxMs,duration);
  if(started-stats.lastReport>30000){if(stats.slow)console.warn('[TravelEmpire] Explored road source updates',{updates:stats.updates,slow:stats.slow,maxMs:Math.round(stats.maxMs),features:features.length});stats.updates=0;stats.slow=0;stats.maxMs=0;stats.lastReport=started;}
  setRoadStatus(`${features.length.toLocaleString()} explored / ${visibleRoadFeatures.current.length.toLocaleString()} visible regional road segments`);
 };
 useEffect(()=>{
  const previous=currentExploredRoads.current;
  const next=new Set(exploredEdgeIds);
  currentExploredRoads.current=next;
  if(performanceMonitorEnabled()){let additions=0;for(const id of next)if(!previous.has(id))additions++;if(additions)incrementPerformance('explorationDelta',additions);}
  // Incremental discovery: index visible geometry once per viewport update,
  // then add only changed IDs instead of rebuilding the whole road graph.
  const visible=visibleRoadIndex.current;
  let changed=false;
  for(const id of next){
   if(previous.has(id))continue;
   const feature=visible.get(id);
   if(feature){visibleExploredFeatures.current.set(id,feature);changed=true;}
  }
  for(const id of previous){
   if(next.has(id))continue;
   if(visibleExploredFeatures.current.delete(id))changed=true;
  }
  if(!changed)return;
  purpleRevision.current++;
  // Coalesce continuous discoveries without indefinitely postponing source updates.
  if(purpleRefreshTimer.current===null){
   const delay=Math.max(0,150-(performance.now()-lastPurpleSourceUpdate.current));
   purpleRefreshTimer.current=window.setTimeout(()=>{purpleRefreshTimer.current=null;refreshPurpleRoads();},delay);
  }
 },[exploredEdgeIds,ready,graph]);
 // Rebuild visible geometry only when the viewport, graph or map style changes.
 useEffect(()=>{
  const instance=map.current;
  if(!instance)return;
  let cancelled=false;
  let scanRevision=0;
  let scanTimer:ReturnType<typeof setTimeout>|undefined;
  const sourceId='active-road-network';
  const purpleSourceId='explored-road-network-source';
  const exploredLayerId='explored-road-network';
  const empty:GeoJSON.FeatureCollection={type:'FeatureCollection',features:[]};
  const remove=()=>{
   if(instance.getLayer(exploredLayerId))instance.removeLayer(exploredLayerId);
   if(instance.getLayer(sourceId))instance.removeLayer(sourceId);
   if(instance.getSource(purpleSourceId))instance.removeSource(purpleSourceId);
   if(instance.getSource(sourceId))instance.removeSource(sourceId);
   visibleRoadFeatures.current=[];visibleRoadIndex.current.clear();viewportSourceSignature.current='';
  };
  const update=()=>{
   if(cancelled||!instance.isStyleLoaded())return;
   if(!graph){remove();setRoadStatus('Waiting for geographic road tiles');return;}
   if(scanTimer!==undefined)clearTimeout(scanTimer);
   ++scanRevision;
   const exploredSet=currentExploredRoads.current;
   const bounds=instance.getBounds();
   const west=bounds.getWest(),east=bounds.getEast(),south=bounds.getSouth(),north=bounds.getNorth();
   // Ignore duplicate moveend notifications when neither bounds nor sources changed.
   // Source existence is checked to support map-style reloads.
   const signature=[west,east,south,north].map(v=>v.toFixed(5)).join(':')+'|'+roadsVisible;
   if(signature===viewportSourceSignature.current&&viewportGraphRef.current===graph&&instance.getSource(sourceId)&&instance.getSource(purpleSourceId))return;
   viewportSourceSignature.current=signature;
   viewportGraphRef.current=graph;
   const geometryStarted=performance.now();
   const features:GeoJSON.Feature[]=[];
   const seen=new Set<string>();
   const MAX_VISIBLE=12000;
   // Scan the large graph in small slices so iPhone Safari can render between batches.
   // Cancel stale scans when the viewport, graph or style changes.
   const scanId=++scanRevision;
   const iterator=graph.edges.entries();
   let examined=0;
   const scan=()=>{
    if(cancelled||scanId!==scanRevision)return;
    const sliceStart=performance.now();
    let done=false;
    while(performance.now()-sliceStart<3&&features.length<MAX_VISIBLE){
     const next=iterator.next();
     if(next.done){done=true;break;}
     const [from,edges]=next.value;
     examined++;
     const a=graph.nodes.get(from);
     if(!a)continue;
     for(const edge of edges){
      if(!roadsVisible&&!exploredSet.has(edge.id))continue;
      if(seen.has(edge.id))continue;
      const b=graph.nodes.get(edge.to);
      if(!b)continue;
      if(Math.max(a[0],b[0])<west||Math.min(a[0],b[0])>east||Math.max(a[1],b[1])<south||Math.min(a[1],b[1])>north)continue;
      seen.add(edge.id);
      features.push({type:'Feature',properties:{roadId:edge.id},geometry:{type:'LineString',coordinates:[a,b]}});
      if(features.length>=MAX_VISIBLE)break;
     }
    }
    if(!done&&features.length<MAX_VISIBLE){scanTimer=window.setTimeout(scan,0);return;}
    startupTrace('Visible road scan complete','nodes='+examined+' visible='+features.length+' elapsed='+Math.round(performance.now()-geometryStarted)+'ms');
    finishScan();
   };
   const finishScan=()=>{
    if(cancelled||scanId!==scanRevision)return;
   visibleRoadFeatures.current=features;
   visibleRoadIndex.current=new Map(features.map(f=>[String(f.properties?.roadId??''),f]));
   visibleExploredFeatures.current=new Map(features.filter(f=>exploredSet.has(String(f.properties?.roadId??''))).map(f=>[String(f.properties?.roadId??''),f]));
   const data:GeoJSON.FeatureCollection=features.length?{type:'FeatureCollection',features}:empty;
   const purple:GeoJSON.FeatureCollection={type:'FeatureCollection',features:[...visibleExploredFeatures.current.values()]};
   const existing=instance.getSource(sourceId) as maplibregl.GeoJSONSource|undefined;
   if(existing)existing.setData(data);
   else instance.addSource(sourceId,{type:'geojson',data});
   const purpleSource=instance.getSource(purpleSourceId) as maplibregl.GeoJSONSource|undefined;
   const purpleStarted=performance.now();
   if(purpleSource)purpleSource.setData(purple);
   else instance.addSource(purpleSourceId,{type:'geojson',data:purple});
   startupTrace('Visible road sources ready','visible='+features.length+' purple='+purple.features.length+' elapsed='+Math.round(performance.now()-geometryStarted)+'ms');
   flushedPurpleRevision.current=purpleRevision.current;
   if(performanceMonitorEnabled())recordActivity('map:purple-source',performance.now()-purpleStarted);
   if(performanceMonitorEnabled()){
    incrementPerformance('sourceUpdates');
    recordPerformance({sourceMs:performance.now()-purpleStarted,visibleExplored:purple.features.length});
   }
   if(!instance.getLayer(sourceId))instance.addLayer({id:sourceId,type:'line',source:sourceId,paint:{'line-color':'#f04452','line-width':['interpolate',['linear'],['zoom'],8,0.55,13,1.15,17,1.9],'line-opacity':roadsVisible?0.78:0}});
   if(!instance.getLayer(exploredLayerId))instance.addLayer({id:exploredLayerId,type:'line',source:purpleSourceId,layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#c026ff','line-width':['interpolate',['linear'],['zoom'],8,1.2,13,2,17,3],'line-opacity':1}});
   // Style changes and other overlays can insert layers above discovered roads.
   // Always keep the purple network above the red road network and basemap.
   // This changes rendering only; vehicle simulation and discovery stay intact.
   if(instance.getLayer(exploredLayerId))instance.moveLayer(exploredLayerId);
   if(instance.getLayer(sourceId))instance.setPaintProperty(sourceId,'line-opacity',roadsVisible?0.78:0);
   setRoadStatus(`${purple.features.length.toLocaleString()} explored / ${features.length.toLocaleString()} visible regional road segments${features.length===MAX_VISIBLE?' (display limit)':''} · ${graph.nodeKeys.length.toLocaleString()} loaded nodes`);
   instance.triggerRepaint();
   };
   scanTimer=window.setTimeout(scan,0);
  };
  refreshRoadLines.current=update;
  instance.on('moveend',update);
  instance.on('style.load',update);
  if(instance.isStyleLoaded())update();
  return()=>{cancelled=true;++scanRevision;if(scanTimer!==undefined)clearTimeout(scanTimer);if(refreshRoadLines.current===update)refreshRoadLines.current=null;instance.off('moveend',update);instance.off('style.load',update);};
 },[roadsVisible,graph,ready,basemap]);

 // Ferries remain operational; sea routes no longer generate territory fog.
 useEffect(()=>{
  if(!ready||!ferryNetwork||!map.current)return;
  return startAutomaticFerryMarkers(map.current,ferryNetwork,new Set(purchasedFerryRouteIds),headquarters?[headquarters.lng,headquarters.lat]:undefined,()=>{},companyId);
 },[ready,ferryNetwork,companyId,purchasedFerryRouteIds.join('|'),headquarters?.lng,headquarters?.lat]);

 // Repaint only when the game enters a different lighting phase. Never call
 // setStyle for the clock: that would discard exploration/ferry layers and stutter taxis.
 const phase=gameClock?mapDayPhase(gameHour(gameClock)):'day';
 useEffect(()=>{
   const instance=map.current;
   if(!instance||!ready||basemap!=='standard')return;
   const apply=()=>{if(instance.isStyleLoaded())applyTravelEmpireStyle(instance,phase,true);};
   instance.on('style.load',apply);
   apply();
   return()=>{instance.off('style.load',apply);};
 },[ready,basemap,phase]);
 const selectBasemap=(mode:Basemap)=>{if(mode===basemap){setSelectorOpen(false);return;}const style=styleFor(mode);if(!style||!map.current)return;setError(null);map.current.setStyle(style);setBasemap(mode);setSelectorOpen(false);};
 return <div className="map-container">
 <div style={{position:'absolute',bottom:16,left:12,zIndex:25,maxWidth:'min(85vw,280px)',fontSize:12}}>
  <button type="button" onClick={()=>setPerfOpen(v=>!v)} aria-expanded={perfOpen} style={{background:'#152b34',color:'#fff',border:'1px solid #4a6570',borderRadius:10,padding:'7px 11px',cursor:'pointer'}}>{perfOpen?'Hide performance':'Performance'}</button>
  {perfOpen&&perfSnapshot&&<div role="status" style={{background:'#10232deF',color:'#f5f9fb',padding:12,borderRadius:12,marginTop:6,boxShadow:'0 3px 15px #0008',lineHeight:1.8}}>
   <strong>Mobile performance</strong>
   <div>Rolling 60s FPS: {perfSnapshot.fps} · Spikes: {perfSnapshot.frameSpikes}</div>
   <div>Active frames: {perfSnapshot.activeFrames} · Resumes: {perfSnapshot.resumeCount}</div>
   <div>Max frame gap: {perfSnapshot.maxFrameMs.toFixed(1)} ms</div>
   <div>Simulation: {perfSnapshot.simulationMs.toFixed(1)} ms · Vehicles: {perfSnapshot.vehicles}</div>
   <div>Tick avg/max: {perfSnapshot.simulationAvgMs.toFixed(1)} / {perfSnapshot.simulationMaxMs.toFixed(1)} ms</div>
   <div>Movement/accounting: {perfSnapshot.simulationMovementMs.toFixed(1)} / {perfSnapshot.simulationAccountingMs.toFixed(1)} ms</div>
   <div>Slowest: {perfSnapshot.slowestVehicle} · {perfSnapshot.slowestVehicleMs.toFixed(1)} ms</div>
   <div>Routing preparation: {perfSnapshot.routingMs.toFixed(1)} ms</div>
   <div>Integrator: {perfSnapshot.integratorMs.toFixed(1)} ms · Discovery: {perfSnapshot.discoveryMs.toFixed(1)} ms</div>
   <div>Other vehicle work: {perfSnapshot.otherVehicleMs.toFixed(1)} ms</div>
   <div>Last spike near: {perfSnapshot.lastSpikeCause}</div>
   <div>Long tasks: {perfSnapshot.longTasks} · Max: {perfSnapshot.longestTaskMs.toFixed(0)} ms</div>
   <div>Map render gaps: {perfSnapshot.mapRenderCount} · Latest: {perfSnapshot.mapRenderMs.toFixed(0)} ms</div>
   <div>Last save: {perfSnapshot.saveKind} · {perfSnapshot.saveMs.toFixed(1)} ms</div>
   <div>Save prep / async: {perfSnapshot.savePrepareMs.toFixed(1)} / {perfSnapshot.saveAwaitMs.toFixed(1)} ms</div>
   <div>IDB merge prep: {perfSnapshot.saveSerializationMs.toFixed(1)} ms</div>
   <div>Explored roads: {perfSnapshot.exploredRoads.toLocaleString()} · New: {perfSnapshot.explorationDelta}</div>
   <div>Purple source: {perfSnapshot.sourceMs.toFixed(1)} ms · Updates: {perfSnapshot.sourceUpdates}</div>
   <div>Visible purple roads: {perfSnapshot.visibleExplored}</div>
  </div>}
 </div><div style={{position:'absolute',bottom:70,right:12,zIndex:25,maxWidth:'min(92vw,420px)',fontSize:12}}>
 <button type="button" onClick={()=>setStartupLogOpen(v=>!v)} style={{padding:'8px 10px',background:'#102b36',color:'white',borderRadius:9}}>Startup log</button>
 {startupLogOpen&&<div style={{marginTop:6,background:'#102b36',color:'white',padding:10,borderRadius:10,maxHeight:'45vh',overflow:'auto'}}>
  <button type="button" onClick={()=>void copyStartupLog()} style={{padding:'7px 10px',background:'#23667b',color:'white',borderRadius:8}}>{startupCopied?'Copied!':'Copy full log'}</button>
  <textarea readOnly aria-label="Startup diagnostic log" value={startupReport()} onFocus={e=>e.currentTarget.select()} style={{display:'block',marginTop:8,width:'100%',height:280,color:'#14252c',background:'white',fontSize:11}}/>
 </div>}
 </div><div className="map-canvas" ref={container} role="application" aria-label="Interactive world street map"/><div className="map-layer-control" style={{display:"flex",alignItems:"flex-start",gap:8}}>{gameClock&&<div style={{background:"#152b34",color:"#f5f9fb",borderRadius:12,padding:"8px 10px",fontSize:12,boxShadow:"0 2px 8px #0004",display:"flex",flexDirection:"column",gap:3}} title="Game time continues while offline"><strong>🕒 {formatGameClock(gameClock)}</strong><span>Automatic taxi shifts · 12h duty · 30m break</span></div>}<button className="map-layer-trigger" type="button" aria-expanded={selectorOpen} aria-controls="map-layer-options" onClick={()=>setSelectorOpen(v=>!v)}><Layers3 size={17}/> Map layers</button>{selectorOpen&&<div id="map-layer-options" className="map-layer-options" role="group" aria-label="Map appearance"><button type="button" className={basemap==='standard'?'active':''} aria-pressed={basemap==='standard'} onClick={()=>selectBasemap('standard')}><MapIcon size={17}/> MapTiler Streets v4</button><button type="button" className={basemap==='satellite'?'active':''} aria-pressed={basemap==='satellite'} onClick={()=>selectBasemap('satellite')} disabled={!key}><Satellite size={17}/> Satellite</button><div className="map-layer-note"><div>{exploredEdgeIds.length.toLocaleString()} roads discovered</div><label className="territory-toggle"><input type="checkbox" checked={stationsVisible} onChange={e=>setStationsVisible(e.target.checked)}/> Show fuel, EV charging and workshop locations</label><div>{stationStatus}</div>{stationsVisible&&nearestInfo.map(item=><div key={item.taxi} className="te-nearest-station">{item.taxi}: {item.match?`${item.match.station.name} (${item.distance?.toFixed(1)} km by road · ${item.straight?.toFixed(1)} km direct)`:`No reachable ${item.kind} station within current range / loaded roads`}</div>)}<label className="territory-toggle"><input type="checkbox" checked={roadsVisible} onChange={e=>setRoadsVisible(e.target.checked)}/> Show undiscovered roads (red)</label><div>{roadStatus}</div><div>Reddish = undiscovered roads. Purple = roads discovered by Purple Explorers; discovered roads unlock passenger jobs.</div></div></div>}</div>{!styleFor('standard')&&<div className="map-error" role="alert">Set VITE_MAPTILER_KEY in .env.local and restart the server.</div>}{error&&<div className="map-error" role="alert">{error}</div>}{lookingUp&&<div className="map-loading" role="status">Identifying selected location…</div>}{!ready&&styleFor('standard')&&<div className="map-loading" role="status">Loading world map…</div>}</div>;
}
