import {readExploration,writeExploration,syncExploration,cloudExplorationEnabled,readExplorationMask,type Segment} from '../data/explorationStore';
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
import {energySpec,energyRangeKm} from '../simulation/energy';
import {reachableStations,type StationRoute} from '../data/stationRouting';

// The delivery SVG faces right (east) at zero rotation. Rotate it to the
// bearing of the current road segment, not the overall delivery route.
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
type Props={depots?:Array<{id:string;name:string;lng:number;lat:number;capacity:number}>;companyId?:string;purchasedFerryRouteIds?:string[];selecting:boolean;onLocationSelected:(location:Headquarters)=>void;headquarters:Headquarters|null;taxis?:Taxi[];exploredEdgeIds?:string[];territoryEdgeIds?:string[];graph?:RoadGraph|null;onExplorerCommand?:(id:string,action:'home'|'resume')=>void};
const key=import.meta.env.VITE_MAPTILER_KEY?.trim();const customStyle=import.meta.env.VITE_MAP_STYLE_URL?.trim();
function styleFor(mode:Basemap):string|null{if(mode==='standard'&&customStyle)return customStyle;if(!key)return null;return `https://api.maptiler.com/maps/${mode==='standard'?'streets-v2':'hybrid'}/style.json?key=${encodeURIComponent(key)}`;}
export default function WorldMap({depots=[],companyId,purchasedFerryRouteIds=[],selecting,onLocationSelected,headquarters,taxis=[],exploredEdgeIds=[],territoryEdgeIds=[],graph,onExplorerCommand}:Props){
 const [ferryNetwork,setFerryNetwork]=useState<FerryNetwork|null>(null);
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
 const container=useRef<HTMLDivElement>(null);const map=useRef<maplibregl.Map|null>(null);const marker=useRef<maplibregl.Marker|null>(null);const onLocationRef=useRef(onLocationSelected);onLocationRef.current=onLocationSelected;

 const selectingRef=useRef(selecting);selectingRef.current=selecting;
 const [roadsVisible,setRoadsVisible]=useState(true); const [explorationVisible,setExplorationVisible]=useState(true);const [roadStatus,setRoadStatus]=useState('Waiting for geographic road tiles');const [basemap,setBasemap]=useState<Basemap>('standard');const [error,setError]=useState<string|null>(null);const [ready,setReady]=useState(false);const [selectorOpen,setSelectorOpen]=useState(false);const [lookingUp,setLookingUp]=useState(false);const busy=useRef(false);
 useEffect(()=>{const style=styleFor('standard');if(!container.current||!style)return;const instance=new maplibregl.Map({container:container.current,style,center:[-6.1,53.2],zoom:9,minZoom:1,maxZoom:19,attributionControl:false});map.current=instance;instance.addControl(new maplibregl.NavigationControl({showCompass:true}),'bottom-right');instance.addControl(new maplibregl.AttributionControl({compact:true}),'bottom-left');instance.on('styleimagemissing',event=>{
  if(!event.id||instance.hasImage(event.id))return;
  instance.addImage(event.id,{width:1,height:1,data:new Uint8Array(4)});
 });instance.on('load',()=>{setReady(true);});instance.on('error',e=>{console.error('MapLibre:',e.error);setError('Some map resources failed to load. Check your API key and network.');});
 instance.on('click',async e=>{if(!selectingRef.current)return;if(busy.current)return;busy.current=true;setLookingUp(true);setError(null);const {lng,lat}=e.lngLat;try{if(!key)throw Error('MapTiler API key required for location lookup.');const response=await fetch(`https://api.maptiler.com/geocoding/${lng},${lat}.json?key=${encodeURIComponent(key)}&language=en`);if(!response.ok)throw Error(`Location lookup failed (${response.status})`);const data=await response.json() as {features?:Array<{text?:string;place_name?:string;place_type?:string[];properties?:Record<string,unknown>;context?:Array<{id?:string;text?:string;short_code?:string}>}>};const features=data.features??[];const place=features[0];const context=[...(place?.context??[])];for(const f of features){if(f.place_type?.includes('country'))context.push({id:'country',text:f.text,short_code:String(f.properties?.short_code??'')});if(f.place_type?.includes('region'))context.push({id:'region',text:f.text});}const country=context.find(c=>c.id?.startsWith('country'));const region=context.find(c=>c.id?.startsWith('region'));if(!country?.text)throw Error('Select a location on land within a recognized country.');onLocationRef.current({lng,lat,label:place?.text||place?.place_name||`${lat.toFixed(4)}, ${lng.toFixed(4)}`,country:country.text,countryCode:country.short_code??'',region:region?.text??''});}catch(err){setError(err instanceof Error?err.message:'Unable to identify this location.');}finally{busy.current=false;setLookingUp(false);}});
 return()=>{taxiMarkers.current.forEach(m=>m.remove());taxiMarkers.current.clear();stationMarkers.current.forEach(m=>m.remove());stationMarkers.current.clear();depotMarkers.current.forEach(m=>m.remove());depotMarkers.current.clear();deliveryMarkers.current.forEach(m=>m.remove());deliveryMarkers.current.clear();marker.current?.remove();marker.current=null;map.current=null;instance.remove();};},[]);
 useEffect(()=>{if(!map.current)return;map.current.getCanvas().style.cursor=selecting?'crosshair':'';},[selecting]);
 useEffect(()=>{if(!map.current)return;marker.current?.remove();marker.current=null;if(headquarters){marker.current=new maplibregl.Marker({color:'#4bd9ac'}).setLngLat([headquarters.lng,headquarters.lat]).setPopup(new maplibregl.Popup({offset:20}).setText(`${headquarters.label} — ${headquarters.country}`)).addTo(map.current);marker.current.getElement().style.zIndex='3';map.current.flyTo({center:[headquarters.lng,headquarters.lat],zoom:Math.max(map.current.getZoom(),11)});}},[headquarters]);
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
    const kind=energySpec(t).unit==='kWh'?'charging':'fuel';
    output[t.id]=reachableStations(graph,t.position,stations,kind,energyRangeKm(t))[0]??null;
   }
   if(!cancelled)setStationRoutes(output);
  },100);
  return()=>{cancelled=true;clearTimeout(timer);};
 },[graph,stations,stationsVisible,taxis.map(t=>`${t.id}:${Math.floor(t.position[0]*1000)}:${Math.floor(t.position[1]*1000)}`).join('|')]);
 const nearestInfo=taxis.slice(0,4).map(t=>{const kind=energySpec(t).unit==='kWh'?'charging':'fuel';const point={lng:t.position[0],lat:t.position[1]};const match=stationRoutes[t.id]??null;return {taxi:t.name,kind,match,distance:match?.roadKm??null,straight:match?stationDistanceKm(point,match.station):null};});
 const taxisRef=useRef(taxis);taxisRef.current=taxis;
 // Render one simulation tick behind the authoritative state. This avoids running
 // the road integrator on every animation frame and prevents one-second jumps.
 const graphRef=useRef(graph);graphRef.current=graph;
 const taxiSnapshots=useRef(new Map<string,{from:Taxi;to:Taxi;forecast:Taxi;at:number}>());
 const taxiHeadingState=useRef(new Map<string,{angle:number;position:[number,number];at:number}>());
 // Render-only state. Simulation position, job status and saved coordinates are untouched.
 const renderedPosition=useRef(new Map<string,[number,number]>());
 useEffect(()=>{const now=performance.now();const ids=new Set(taxis.filter(t=>!t.deliveryUntil||t.deliveryUntil<=Date.now()).map(t=>t.id));for(const [id,m] of taxiMarkers.current){if(!ids.has(id)){m.remove();taxiMarkers.current.delete(id);taxiSnapshots.current.delete(id);taxiHeadingState.current.delete(id);renderedPosition.current.delete(id);}}for(const taxi of taxis){if(taxi.deliveryUntil && taxi.deliveryUntil> Date.now())continue;const previous=taxiSnapshots.current.get(taxi.id);
  if(!previous || previous.to.position[0]!==taxi.position[0] || previous.to.position[1]!==taxi.position[1]){
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
  }else{
   // Keep route/status current without restarting the animation clock.
   taxiSnapshots.current.set(taxi.id,{...previous,to:taxi});
  }if(!taxiMarkers.current.has(taxi.id)&&map.current){const el=document.createElement('div');el.className='taxi-map-marker';const img=document.createElement('img');img.src=`${import.meta.env.BASE_URL??'/'}assets/${taxi.kind==='surveyor'?'car_black.svg':taxi.kind==='explorer'?'SimplePurpleCarTopView.svg':'car_topview.svg'}`;img.alt='';img.draggable=false;el.appendChild(img);el.title=taxi.name;
   if(taxi.kind==='explorer'||taxi.kind==='surveyor'){
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
   const m=new maplibregl.Marker({element:el,anchor:'center',rotationAlignment:'map',pitchAlignment:'map'}).setLngLat(taxi.position).addTo(map.current);m.getElement().style.zIndex='3';taxiMarkers.current.set(taxi.id,m);}}},[taxis]);
 useEffect(()=>{
  let frame=0;
  const animate=()=>{
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
   const now=performance.now();
   for(const [id,snapshot] of taxiSnapshots.current){
    const marker=taxiMarkers.current.get(id);if(!marker)continue;
    const taxi=snapshot.to;
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
      marker.setRotation(previousHeading.angle);
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
 const explorationDebugPrevious=useRef<Set<string>>(new Set());
 const [debugOpen,setDebugOpen]=useState(false);
 const [debugEntries,setDebugEntries]=useState<string[]>([]);
 const debugStarted=useRef(false);
 const lastExplorerTelemetry=useRef<Map<string,{leg:number;edge:string;status:string}>>(new Map());
 const completedEdgeQueue=useRef<Set<string>>(new Set());
 useEffect(()=>{
  for(const taxi of taxis){
   if(taxi.kind!=='explorer')continue;
   const edge=taxi.edgeIds[taxi.leg]??'(none)';
   const previous=lastExplorerTelemetry.current.get(taxi.id);
   if(!previous||previous.leg!==taxi.leg||previous.edge!==edge||previous.status!==taxi.status){
    if(previous&&previous.leg!==taxi.leg){
     const completed=taxi.edgeIds[Math.max(0,taxi.leg-1)]??previous.edge;
     completedEdgeQueue.current.add(completed);
     addDebug(`NODE reached: ${taxi.name}, leg ${previous.leg}→${taxi.leg}, edge ${completed.slice(0,24)}, state=${exploredEdgeIds.includes(completed)?'explored':'PENDING'}`);
    }else if(!previous||previous.status!==taxi.status){
     addDebug(`Explorer ${taxi.name}: ${taxi.status}, leg ${taxi.leg}, route edges ${taxi.edgeIds.length}`);
    }
    lastExplorerTelemetry.current.set(taxi.id,{leg:taxi.leg,edge,status:taxi.status});
   }
  }
 },[taxis,exploredEdgeIds]);

 const addDebug=(message:string)=>{
  const entry=`${new Date().toLocaleTimeString()}  ${message}`;
  setDebugEntries(previous=>[...previous.slice(-79),entry]);
 };


 const currentExploredRoads=useRef<Set<string>>(new Set());
 currentExploredRoads.current=new Set(exploredEdgeIds);
 useEffect(()=>{
  const instance=map.current;
  if(!instance||!ready||!instance.isStyleLoaded())return;
  const source=instance.getSource('explored-road-network-source') as maplibregl.GeoJSONSource|undefined;
  const explored=currentExploredRoads.current;
  const newlyDiscovered=[...explored].filter(id=>!explorationDebugPrevious.current.has(id));
  explorationDebugPrevious.current=new Set(explored);
  const visibleIds=new Set(visibleRoadFeatures.current.map(feature=>String(feature.properties?.roadId??'')));
  if(!debugStarted.current){
   debugStarted.current=true;
   addDebug(`Initial exploration: ${explored.size} saved road IDs`);
  }else if(newlyDiscovered.length){
   addDebug(`+${newlyDiscovered.length} completed edges; ${newlyDiscovered.filter(id=>visibleIds.has(id)).length} in visible road cache; source ${source?'OK':'MISSING'}`);
  }
  if(newlyDiscovered.length)console.info('[TravelEmpire:exploration] New road IDs received by map',{count:newlyDiscovered.length,ids:newlyDiscovered.slice(0,20),visible:newlyDiscovered.filter(id=>visibleIds.has(id)).length,missingFromVisibleGeometry:newlyDiscovered.filter(id=>!visibleIds.has(id)).slice(0,20),sourceExists:!!source,styleLoaded:instance.isStyleLoaded()});
  if(!source){
   if(newlyDiscovered.length)console.warn('[TravelEmpire:exploration] Purple road source missing; cannot repaint completed edges');
   return;
  }
  // A newly completed edge may not yet exist in the viewport cache.
  // Resolve its actual graph geometry immediately instead of waiting for moveend.
  const missing=new Set(newlyDiscovered.filter(id=>!visibleIds.has(id)));
  if(missing.size&&graph){
   const bounds=instance.getBounds();
   for(const [from,edges] of graph.edges){
    const a=graph.nodes.get(from);
    if(!a)continue;
    for(const edge of edges){
     if(!missing.has(edge.id))continue;
     const b=graph.nodes.get(edge.to);
     if(!b)continue;
     if(!bounds.contains(a)&&!bounds.contains(b))continue;
     visibleRoadFeatures.current.push({type:'Feature',properties:{roadId:edge.id},geometry:{type:'LineString',coordinates:[a,b]}});
     visibleIds.add(edge.id);
     missing.delete(edge.id);
    }
    if(!missing.size)break;
   }
   addDebug(`Resolved ${newlyDiscovered.length-missing.size} completed edges into visible road geometry; ${missing.size} outside viewport/not loaded`);
  }
  const features=visibleRoadFeatures.current.filter(feature=>explored.has(String(feature.properties?.roadId??'')));
  source.setData({type:'FeatureCollection',features});
  if(newlyDiscovered.length)addDebug(`Map repainted: ${features.length} purple / ${visibleRoadFeatures.current.length} visible road edges`);
  if(newlyDiscovered.length)console.info('[TravelEmpire:exploration] Purple GeoJSON updated',{renderedEdges:features.length,cachedVisibleEdges:visibleRoadFeatures.current.length});
  instance.triggerRepaint();
 },[exploredEdgeIds,ready,graph]);
 // Rebuild visible geometry only when the viewport, graph or map style changes.
 useEffect(()=>{
  const instance=map.current;
  if(!instance)return;
  let cancelled=false;
  const sourceId='active-road-network';
  const purpleSourceId='explored-road-network-source';
  const exploredLayerId='explored-road-network';
  const empty:GeoJSON.FeatureCollection={type:'FeatureCollection',features:[]};
  const remove=()=>{
   if(instance.getLayer(exploredLayerId))instance.removeLayer(exploredLayerId);
   if(instance.getLayer(sourceId))instance.removeLayer(sourceId);
   if(instance.getSource(purpleSourceId))instance.removeSource(purpleSourceId);
   if(instance.getSource(sourceId))instance.removeSource(sourceId);
   visibleRoadFeatures.current=[];
  };
  const update=()=>{
   if(cancelled||!instance.isStyleLoaded())return;
   if(!graph){remove();setRoadStatus('Waiting for geographic road tiles');return;}
   const exploredSet=currentExploredRoads.current;
   const bounds=instance.getBounds();
   const west=bounds.getWest(),east=bounds.getEast(),south=bounds.getSouth(),north=bounds.getNorth();
   const features:GeoJSON.Feature[]=[];
   const seen=new Set<string>();
   const MAX_VISIBLE=12000;
   outer:for(const [from,edges] of graph.edges){
    const a=graph.nodes.get(from);
    if(!a)continue;
    for(const edge of edges){
     if(!roadsVisible&&!exploredSet.has(edge.id))continue;
     if(seen.has(edge.id))continue;
     seen.add(edge.id);
     const b=graph.nodes.get(edge.to);
     if(!b)continue;
     if(Math.max(a[0],b[0])<west||Math.min(a[0],b[0])>east||Math.max(a[1],b[1])<south||Math.min(a[1],b[1])>north)continue;
     features.push({type:'Feature',properties:{roadId:edge.id},geometry:{type:'LineString',coordinates:[a,b]}});
     if(features.length>=MAX_VISIBLE)break outer;
    }
   }
   visibleRoadFeatures.current=features;
   const data:GeoJSON.FeatureCollection=features.length?{type:'FeatureCollection',features}:empty;
   const purple:GeoJSON.FeatureCollection={type:'FeatureCollection',features:features.filter(feature=>exploredSet.has(String(feature.properties?.roadId??'')))};
   const existing=instance.getSource(sourceId) as maplibregl.GeoJSONSource|undefined;
   if(existing)existing.setData(data);
   else instance.addSource(sourceId,{type:'geojson',data});
   const purpleSource=instance.getSource(purpleSourceId) as maplibregl.GeoJSONSource|undefined;
   if(purpleSource)purpleSource.setData(purple);
   else instance.addSource(purpleSourceId,{type:'geojson',data:purple});
   if(!instance.getLayer(sourceId))instance.addLayer({id:sourceId,type:'line',source:sourceId,paint:{'line-color':'#f04452','line-width':['interpolate',['linear'],['zoom'],8,0.55,13,1.15,17,1.9],'line-opacity':roadsVisible?0.78:0}});
   if(!instance.getLayer(exploredLayerId))instance.addLayer({id:exploredLayerId,type:'line',source:purpleSourceId,paint:{'line-color':'#c026ff','line-width':['interpolate',['linear'],['zoom'],8,1.0,13,1.8,17,2.8],'line-opacity':1}});
   if(instance.getLayer(sourceId))instance.setPaintProperty(sourceId,'line-opacity',roadsVisible?0.78:0);
   setRoadStatus(`${purple.features.length.toLocaleString()} explored / ${features.length.toLocaleString()} visible regional road segments${features.length===MAX_VISIBLE?' (display limit)':''} · ${graph.nodeKeys.length.toLocaleString()} loaded nodes`);
   instance.triggerRepaint();
  };
  instance.on('moveend',update);
  instance.on('style.load',update);
  if(instance.isStyleLoaded())update();
  // The routing graph is incrementally mutated as Supabase tiles arrive.
  // A stationary map otherwise keeps a stale viewport cache until moveend.
  // Reconcile only when a discovered edge is absent from the cached viewport
  // or when graph geometry grows; never rebuild the graph every animation frame.
  let previousNodeCount=graph?.nodes.size??0;
  let previousEdgeCount=graph?.edges.size??0;
  const reconcile=()=>{
   if(cancelled||!instance.isStyleLoaded()||!graph)return;
   const nodeCount=graph.nodes.size,edgeCount=graph.edges.size;
   const visibleIds=new Set(visibleRoadFeatures.current.map(f=>String(f.properties?.roadId??'')));
   const bounds=instance.getBounds();
   const missingIds=new Set([...currentExploredRoads.current].filter(id=>!visibleIds.has(id)));
   let missingVisibleDiscovery=false;
   if(missingIds.size)for(const [from,edges] of graph.edges){
    const a=graph.nodes.get(from);
    if(!a)continue;
    for(const edge of edges){
     if(!missingIds.has(edge.id))continue;
     const b=graph.nodes.get(edge.to);
     if(b&&(bounds.contains(a)||bounds.contains(b))){missingVisibleDiscovery=true;break;}
    }
    if(missingVisibleDiscovery)break;
   }
   if(missingVisibleDiscovery||nodeCount!==previousNodeCount||edgeCount!==previousEdgeCount){
    previousNodeCount=nodeCount;previousEdgeCount=edgeCount;
    update();
   }
  };
  const refreshTimer=window.setInterval(reconcile,1500);
  return()=>{cancelled=true;window.clearInterval(refreshTimer);instance.off('moveend',update);instance.off('style.load',update);};
 },[roadsVisible,graph,ready,basemap]);

 // Directly reconcile completed Explorer edges against the visible purple source.
 // This is independent of map panning and of the whole explored-ID array identity.
 useEffect(()=>{
  if(!ready||!graph||!map.current?.isStyleLoaded())return;
  const instance=map.current;
  const source=instance.getSource('explored-road-network-source') as maplibregl.GeoJSONSource|undefined;
  if(!source)return;
  const explored=currentExploredRoads.current;
  const ids=new Set(visibleRoadFeatures.current.map(f=>String(f.properties?.roadId??'')));
  let added=0,already=0,pending=0,outside=0;
  const bounds=instance.getBounds();
  for(const id of completedEdgeQueue.current){
   if(!explored.has(id)){pending++;continue;}
   if(ids.has(id)){already++;completedEdgeQueue.current.delete(id);continue;}
   let found=false;
   for(const [from,edges] of graph.edges){
    const a=graph.nodes.get(from);
    if(!a)continue;
    for(const edge of edges){
     if(edge.id!==id)continue;
     const b=graph.nodes.get(edge.to);
     if(!b||(!bounds.contains(a)&&!bounds.contains(b)))continue;
     visibleRoadFeatures.current.push({type:'Feature',properties:{roadId:id},geometry:{type:'LineString',coordinates:[a,b]}});
     ids.add(id);added++;found=true;break;
    }
    if(found)break;
   }
   if(!found)outside++;
   completedEdgeQueue.current.delete(id);
  }
  if(added||already||pending||outside){
   const features=visibleRoadFeatures.current.filter(f=>explored.has(String(f.properties?.roadId??'')));
   source.setData({type:'FeatureCollection',features});
   instance.triggerRepaint();
   addDebug(`Edge render: +${added} geometry, ${already} cached, ${pending} pending state, ${outside} offscreen/missing; purple=${features.length}`);
  }
 },[taxis,exploredEdgeIds,graph,ready]);
 // Keep the exploration overlay mounted while road discovery updates every tick.
 // The geometry worker is persistent: restarting it every second can prevent any result.
 const explorationInputs=useRef({graph,territoryEdgeIds,headquarters});
 explorationInputs.current={graph,territoryEdgeIds,headquarters};
 const explorationLast=useRef<{coverage:GeoJSON.FeatureCollection;locked:GeoJSON.FeatureCollection}|null>(null);
 const explorationApply=useRef<((coverage:GeoJSON.FeatureCollection,locked:GeoJSON.FeatureCollection)=>void)|null>(null);
 const persistentSegments=useRef<Map<string,Segment[]>>(new Map());
 const explorationCompany=useRef<string|undefined>(undefined);
 const persistBusy=useRef(false);
 const persistAgain=useRef(false);
 const explorationLastSignature=useRef('');
 const explorationGeneration=useRef(0);
 useEffect(()=>{explorationCompany.current=companyId;persistentSegments.current=new Map();explorationLast.current=null;explorationLastSignature.current='';explorationGeneration.current++;
  if(!companyId)return;let cancelled=false;
  // Restore the last proven fog mask immediately; rebuilding large unions can
  // take time or fail, but must never erase already discovered territory.
  void readExplorationMask(companyId).then(mask=>{
   if(cancelled||explorationCompany.current!==companyId||!mask)return;
   if(!explorationLast.current){
    explorationLast.current=mask;
    explorationApply.current?.(mask.coverage,mask.locked);
   }
  }).catch(error=>console.error('[TravelEmpire] Cached fog restore failed',error));

  readExploration(companyId).then(record=>{if(cancelled||explorationCompany.current!==companyId)return;
   // Merge rather than replace discoveries made while storage was loading.
   for(const [id,segments] of Object.entries(record?.segments??{}))if(id.startsWith('territory:')&&!id.startsWith('territory:sea:')&&!persistentSegments.current.has(id.slice(10)))persistentSegments.current.set(id.slice(10),segments);
   explorationLastSignature.current='';
   fogDraw.current?.();
  }).catch(error=>console.error('[TravelEmpire] Geometry restore failed',error));
  if(cloudExplorationEnabled())void syncExploration(companyId).then(record=>{
   if(cancelled||explorationCompany.current!==companyId||!record)return;
   for(const [id,segments] of Object.entries(record.segments)){
    if(!id.startsWith('territory:')||id.startsWith('territory:sea:')&&!id.startsWith('territory:sea:v2:'))continue;
    const key=id.slice(10);
    const current=persistentSegments.current.get(key);
    if(!current||(!current.length&&segments.length))persistentSegments.current.set(key,segments);
   }
   explorationLastSignature.current='';
   fogDraw.current?.();
  }).catch(error=>console.error('[TravelEmpire] Cloud geometry restore failed',error));
  return()=>{cancelled=true};
 },[companyId]);
 const persistGeometry=async()=>{const id=explorationCompany.current;if(!id||persistBusy.current){persistAgain.current=true;return;}persistBusy.current=true;
  try{do{persistAgain.current=false;const old=await readExploration(id);const segments={...(old?.segments??{})};
   for(const [key,value] of persistentSegments.current)segments['territory:'+key]=value;
   await writeExploration(id,{ids:old?.ids??[],segments});
  }while(persistAgain.current&&explorationCompany.current===id)}catch(error){console.error('[TravelEmpire] Geometry save failed',error)}finally{persistBusy.current=false;}
 };
 // Build a stable edge geometry index only when the graph changes.
 const explorationEdgeIndex=useRef<{graph:RoadGraph|null|undefined;edgeCount:number;entries:Map<string,Array<[[number,number],[number,number]]>>}>({graph:null,edgeCount:-1,entries:new Map()});
 // Draw fog as a screen-space canvas mask. No Turf polygon unions or
 // world-sized GeoJSON subtraction: each discovered segment clears its own
 // geographic-width corridor, even when the road tile is no longer loaded.
 const fogDraw=useRef<(()=>void)|null>(null);
 const seaLast=useRef(new Map<string,{point:[number,number];at:number}>());
 const seaDirty=useRef(false);
 useEffect(()=>{seaLast.current.clear();seaDirty.current=false;},[companyId]);
 useEffect(()=>{
  if(!ready||!ferryNetwork||!map.current)return;
  const stop=startAutomaticFerryMarkers(map.current,ferryNetwork,new Set(purchasedFerryRouteIds),headquarters?[headquarters.lng,headquarters.lat]:undefined,(routeId,sailedSegments)=>{
   if(!explorationCompany.current||!sailedSegments.length)return;
   // v2 avoids reusing legacy straight-chord sea discoveries.
   const key='sea:v2:'+routeId;
   const segments=persistentSegments.current.get(key)??[];
   if(segments.length>=3000)return;
   segments.push(...sailedSegments.slice(0,3000-segments.length));
   persistentSegments.current.set(key,segments);
   seaDirty.current=true;
   fogDraw.current?.();
  },companyId);
  const save=window.setInterval(()=>{if(seaDirty.current){seaDirty.current=false;void persistGeometry();}},30000);
  return()=>{stop();window.clearInterval(save);if(seaDirty.current){seaDirty.current=false;void persistGeometry();}};
 },[ready,ferryNetwork,companyId,purchasedFerryRouteIds.join('|'),headquarters?.lng,headquarters?.lat]);

 useEffect(()=>{
  const instance=map.current;
  if(!instance||!ready||!container.current)return;
  const host=container.current;
  const canvas=document.createElement('canvas');
  canvas.setAttribute('aria-hidden','true');
  canvas.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:1';
  host.appendChild(canvas);
  const ctx=canvas.getContext('2d');
  if(!ctx){canvas.remove();return;}
  let frame=0;
  const draw=()=>{
   frame=0;
   const width=host.clientWidth,height=host.clientHeight;
   if(!width||!height)return;
   const dpr=Math.min(window.devicePixelRatio||1,2);
   if(canvas.width!==Math.round(width*dpr)||canvas.height!==Math.round(height*dpr)){
    canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
   }
   ctx.setTransform(dpr,0,0,dpr,0,0);
   ctx.clearRect(0,0,width,height);
   if(!explorationVisible||!headquarters)return;
   ctx.globalCompositeOperation='source-over';
   ctx.fillStyle='rgba(211,107,107,0.58)';
   ctx.fillRect(0,0,width,height);
   ctx.globalCompositeOperation='destination-out';
   // No free headquarters reveal: exploration requires the Black Explorer.
   // One path per segment. A 150 m radius remains geographic at every zoom.
   const bounds=instance.getBounds();
   const west=bounds.getWest()-0.03,east=bounds.getEast()+0.03;
   const south=bounds.getSouth()-0.03,north=bounds.getNorth()+0.03;
   // Batch strokes by approximate width to avoid a canvas draw call per road.
   const batches=new Map<number,Path2D>();
   for(const [segmentKey,segments] of persistentSegments.current)for(const [a,b] of segments){
    if(Math.max(a[0],b[0])<west||Math.min(a[0],b[0])>east||
       Math.max(a[1],b[1])<south||Math.min(a[1],b[1])>north)continue;
    const p=instance.project(a),q=instance.project(b);
    const lat=(a[1]+b[1])/2;
    const metersPerDegree=111320*Math.max(0.01,Math.cos(lat*Math.PI/180));
    const edge=instance.project([a[0]+(segmentKey.startsWith('sea:')?300:150)/metersPerDegree,a[1]]);
    const width=Math.max(1,Math.round(2*Math.abs(edge.x-p.x)*2)/2);
    let path=batches.get(width);
    if(!path){path=new Path2D();batches.set(width,path);}
    path.moveTo(p.x,p.y);path.lineTo(q.x,q.y);
   }
   ctx.lineCap='round';ctx.lineJoin='round';
   for(const [width,path] of batches){ctx.lineWidth=width;ctx.stroke(path);}
   ctx.globalCompositeOperation='source-over';
  };
  const schedule=()=>{if(document.hidden)return;if(!frame)frame=requestAnimationFrame(draw);};
  const onVisibilityChange=()=>{if(!document.hidden)schedule();};
  document.addEventListener('visibilitychange',onVisibilityChange);
  fogDraw.current=schedule;
  instance.on('move',schedule);
  instance.on('moveend',schedule);
  instance.on('resize',schedule);
  instance.on('style.load',schedule);
  schedule();
  return()=>{
   fogDraw.current=null;
   instance.off('move',schedule);instance.off('moveend',schedule);instance.off('resize',schedule);
   instance.off('style.load',schedule);
   document.removeEventListener('visibilitychange',onVisibilityChange);
   if(frame)cancelAnimationFrame(frame);
   canvas.remove();
  };
 },[ready,explorationVisible,headquarters?.lng,headquarters?.lat,basemap]);
 useEffect(()=>{
  const currentGraph=graph;
  if(currentGraph){
   const edgeCount=[...currentGraph.edges.values()].reduce((n,edges)=>n+edges.length,0);
   if(explorationEdgeIndex.current.graph!==currentGraph||explorationEdgeIndex.current.edgeCount!==edgeCount){
    const entries=new Map<string,Segment[]>();
    const seen=new Set<string>();
    for(const [from,edges] of currentGraph.edges)for(const edge of edges){
     const unique=[from,edge.to].sort().join('|');
     if(seen.has(unique))continue;seen.add(unique);
     const a=currentGraph.nodes.get(from),b=currentGraph.nodes.get(edge.to);
     if(a&&b){const list=entries.get(edge.id)??[];list.push([[a[0],a[1]],[b[0],b[1]]]);entries.set(edge.id,list);}
    }
    explorationEdgeIndex.current={graph:currentGraph,edgeCount,entries};
   }
  }
  let changed=false;
  for(const id of territoryEdgeIds){
   const existing=persistentSegments.current.get(id);
   if(existing?.length)continue;
   const found=explorationEdgeIndex.current.entries.get(id);
   if(found?.length){persistentSegments.current.set(id,found);changed=true;}
  }
  if(changed)void persistGeometry();
  fogDraw.current?.();
 },[graph,territoryEdgeIds,explorationVisible]);
 const selectBasemap=(mode:Basemap)=>{if(mode===basemap){setSelectorOpen(false);return;}const style=styleFor(mode);if(!style||!map.current)return;setError(null);map.current.setStyle(style);setBasemap(mode);setSelectorOpen(false);};
 return <div className="map-container"><div style={{position:'absolute',bottom:78,left:12,zIndex:30,maxWidth:'calc(100% - 24px)',pointerEvents:'auto'}}>
 <button type="button" onClick={()=>setDebugOpen(value=>!value)} style={{background:'#14243a',color:'white',border:'1px solid #64748b',borderRadius:8,padding:'9px 12px',fontSize:13,fontWeight:700}}>🛠 Exploration log ({debugEntries.length})</button>
 {debugOpen&&<div style={{width:'min(420px,calc(100vw - 24px))',maxHeight:270,overflowY:'auto',background:'rgba(9,18,32,.97)',color:'#d1fae5',border:'1px solid #64748b',borderRadius:8,padding:10,fontSize:11,marginTop:6,boxSizing:'border-box',fontFamily:'monospace',whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>
 <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginBottom:8}}><button type="button" onClick={()=>{void navigator.clipboard?.writeText(debugEntries.join('\\n'));}} style={{color:'white',background:'#334155',border:0,borderRadius:4,padding:'5px 8px'}}>Copy logs</button><button type="button" onClick={()=>setDebugEntries([])} style={{color:'white',background:'#334155',border:0,borderRadius:4,padding:'5px 8px'}}>Clear</button></div>
 {debugEntries.length?debugEntries.map((entry,index)=><div key={index} style={{padding:'3px 0',borderBottom:'1px solid #25344a'}}>{entry}</div>):'Waiting for road discovery events…'}
 </div>}
 </div><div className="map-canvas" ref={container} role="application" aria-label="Interactive world street map"/><div className="map-layer-control"><button className="map-layer-trigger" type="button" aria-expanded={selectorOpen} aria-controls="map-layer-options" onClick={()=>setSelectorOpen(v=>!v)}><Layers3 size={17}/> Map layers</button>{selectorOpen&&<div id="map-layer-options" className="map-layer-options" role="group" aria-label="Map appearance"><button type="button" className={basemap==='standard'?'active':''} aria-pressed={basemap==='standard'} onClick={()=>selectBasemap('standard')}><MapIcon size={17}/> Standard</button><button type="button" className={basemap==='satellite'?'active':''} aria-pressed={basemap==='satellite'} onClick={()=>selectBasemap('satellite')} disabled={!key}><Satellite size={17}/> Satellite</button><div className="map-layer-note"><div>{exploredEdgeIds.length.toLocaleString()} roads discovered · 150 m Black Explorer corridor</div><label className="territory-toggle"><input type="checkbox" checked={explorationVisible} onChange={e=>setExplorationVisible(e.target.checked)}/> Show WorldFront exploration area</label><label className="territory-toggle"><input type="checkbox" checked={stationsVisible} onChange={e=>setStationsVisible(e.target.checked)}/> Show fuel, EV charging and workshop locations</label><div>{stationStatus}</div>{stationsVisible&&nearestInfo.map(item=><div key={item.taxi} className="te-nearest-station">{item.taxi}: {item.match?`${item.match.station.name} (${item.distance?.toFixed(1)} km by road · ${item.straight?.toFixed(1)} km direct)`:`No reachable ${item.kind} station within current range / loaded roads`}</div>)}<label className="territory-toggle"><input type="checkbox" checked={roadsVisible} onChange={e=>setRoadsVisible(e.target.checked)}/> Show undiscovered roads (red)</label><div>{roadStatus}</div><div>Reddish = unexplored. Clear = territory revealed by the Black Explorer (150 m radius). Purple Explorer-discovered roads unlock passenger jobs.</div></div></div>}</div>{!styleFor('standard')&&<div className="map-error" role="alert">Set VITE_MAPTILER_KEY in .env.local and restart the server.</div>}{error&&<div className="map-error" role="alert">{error}</div>}{lookingUp&&<div className="map-loading" role="status">Identifying selected location…</div>}{!ready&&styleFor('standard')&&<div className="map-loading" role="status">Loading world map…</div>}</div>;
}
