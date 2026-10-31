import {useEffect,useRef,useState} from 'react';
import maplibregl from 'maplibre-gl';
import {Layers3,Map as MapIcon,Satellite} from 'lucide-react';
import type {Headquarters} from '../company';
import {advanceTaxi,type Taxi,type RoadGraph} from '../simulation/taxi';
import {deliveryPosition} from '../dealership';

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
 if(from.path.length<2||to.path.length<2||from.path!==to.path && (from.path.length!==to.path.length||from.edgeIds[0]!==to.edgeIds[0])){
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
type Props={selecting:boolean;onLocationSelected:(location:Headquarters)=>void;headquarters:Headquarters|null;taxis?:Taxi[];exploredEdgeIds?:string[];graph?:RoadGraph|null};
const key=import.meta.env.VITE_MAPTILER_KEY?.trim();const customStyle=import.meta.env.VITE_MAP_STYLE_URL?.trim();
function styleFor(mode:Basemap):string|null{if(mode==='standard'&&customStyle)return customStyle;if(!key)return null;return `https://api.maptiler.com/maps/${mode==='standard'?'streets-v2':'hybrid'}/style.json?key=${encodeURIComponent(key)}`;}
export default function WorldMap({selecting,onLocationSelected,headquarters,taxis=[],exploredEdgeIds=[],graph}:Props){
 const taxiMarkers=useRef(new Map<string,maplibregl.Marker>());
 const deliveryMarkers=useRef(new Map<string,maplibregl.Marker>());
 const container=useRef<HTMLDivElement>(null);const map=useRef<maplibregl.Map|null>(null);const marker=useRef<maplibregl.Marker|null>(null);const onLocationRef=useRef(onLocationSelected);onLocationRef.current=onLocationSelected;

 const selectingRef=useRef(selecting);selectingRef.current=selecting;
 const [roadsVisible,setRoadsVisible]=useState(false); const [explorationVisible,setExplorationVisible]=useState(true);const [roadStatus,setRoadStatus]=useState('Waiting for regional roads');const [basemap,setBasemap]=useState<Basemap>('standard');const [error,setError]=useState<string|null>(null);const [ready,setReady]=useState(false);const [selectorOpen,setSelectorOpen]=useState(false);const [lookingUp,setLookingUp]=useState(false);const busy=useRef(false);
 useEffect(()=>{const style=styleFor('standard');if(!container.current||!style)return;const instance=new maplibregl.Map({container:container.current,style,center:[-6.1,53.2],zoom:9,minZoom:1,maxZoom:19,attributionControl:false});map.current=instance;instance.addControl(new maplibregl.NavigationControl({showCompass:true}),'bottom-right');instance.addControl(new maplibregl.AttributionControl({compact:true}),'bottom-left');instance.on('load',()=>{setReady(true);});instance.on('error',e=>{console.error('MapLibre:',e.error);setError('Some map resources failed to load. Check your API key and network.');});
 instance.on('click',async e=>{if(!selectingRef.current)return;if(busy.current)return;busy.current=true;setLookingUp(true);setError(null);const {lng,lat}=e.lngLat;try{if(!key)throw Error('MapTiler API key required for location lookup.');const response=await fetch(`https://api.maptiler.com/geocoding/${lng},${lat}.json?key=${encodeURIComponent(key)}&language=en`);if(!response.ok)throw Error(`Location lookup failed (${response.status})`);const data=await response.json() as {features?:Array<{text?:string;place_name?:string;place_type?:string[];properties?:Record<string,unknown>;context?:Array<{id?:string;text?:string;short_code?:string}>}>};const features=data.features??[];const place=features[0];const context=[...(place?.context??[])];for(const f of features){if(f.place_type?.includes('country'))context.push({id:'country',text:f.text,short_code:String(f.properties?.short_code??'')});if(f.place_type?.includes('region'))context.push({id:'region',text:f.text});}const country=context.find(c=>c.id?.startsWith('country'));const region=context.find(c=>c.id?.startsWith('region'));if(!country?.text)throw Error('Select a location on land within a recognized country.');onLocationRef.current({lng,lat,label:place?.text||place?.place_name||`${lat.toFixed(4)}, ${lng.toFixed(4)}`,country:country.text,countryCode:country.short_code??'',region:region?.text??''});}catch(err){setError(err instanceof Error?err.message:'Unable to identify this location.');}finally{busy.current=false;setLookingUp(false);}});
 return()=>{taxiMarkers.current.forEach(m=>m.remove());taxiMarkers.current.clear();deliveryMarkers.current.forEach(m=>m.remove());deliveryMarkers.current.clear();marker.current?.remove();marker.current=null;map.current=null;instance.remove();};},[]);
 useEffect(()=>{if(!map.current)return;map.current.getCanvas().style.cursor=selecting?'crosshair':'';},[selecting]);
 useEffect(()=>{if(!map.current)return;marker.current?.remove();marker.current=null;if(headquarters){marker.current=new maplibregl.Marker({color:'#4bd9ac'}).setLngLat([headquarters.lng,headquarters.lat]).setPopup(new maplibregl.Popup({offset:20}).setText(`${headquarters.label} — ${headquarters.country}`)).addTo(map.current);marker.current.getElement().style.zIndex='3';map.current.flyTo({center:[headquarters.lng,headquarters.lat],zoom:Math.max(map.current.getZoom(),11)});}},[headquarters]);
 const taxisRef=useRef(taxis);taxisRef.current=taxis;
 // Render one simulation tick behind the authoritative state. This avoids running
 // the road integrator on every animation frame and prevents one-second jumps.
 const graphRef=useRef(graph);graphRef.current=graph;
 const taxiSnapshots=useRef(new Map<string,{from:Taxi;to:Taxi;forecast:Taxi;at:number}>());
 const taxiHeadingState=useRef(new Map<string,{angle:number;position:[number,number];at:number}>());
 useEffect(()=>{const now=performance.now();const ids=new Set(taxis.filter(t=>!t.deliveryUntil||t.deliveryUntil<=Date.now()).map(t=>t.id));for(const [id,m] of taxiMarkers.current){if(!ids.has(id)){m.remove();taxiMarkers.current.delete(id);taxiSnapshots.current.delete(id);taxiHeadingState.current.delete(id);}}for(const taxi of taxis){if(taxi.deliveryUntil && taxi.deliveryUntil> Date.now())continue;const previous=taxiSnapshots.current.get(taxi.id);
  if(!previous || previous.to.position[0]!==taxi.position[0] || previous.to.position[1]!==taxi.position[1]){
   const forecast=graphRef.current&&taxi.status!=='IDLE'?advanceTaxi(taxi,graphRef.current,0.65).taxi:taxi;
   taxiSnapshots.current.set(taxi.id,{from:previous?.to??taxi,to:taxi,forecast,at:now});
  }else{
   // Keep route/status current without restarting the animation clock.
   taxiSnapshots.current.set(taxi.id,{...previous,to:taxi});
  }if(!taxiMarkers.current.has(taxi.id)&&map.current){const el=document.createElement('div');el.className='taxi-map-marker';const img=document.createElement('img');img.src=`${import.meta.env.BASE_URL??'/'}assets/car_topview.svg`;img.alt='';img.draggable=false;el.appendChild(img);el.title=taxi.name;const m=new maplibregl.Marker({element:el,anchor:'center',rotationAlignment:'map',pitchAlignment:'map'}).setLngLat(taxi.position).addTo(map.current);m.getElement().style.zIndex='3';taxiMarkers.current.set(taxi.id,m);}}},[taxis]);
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
    marker.setLngLat(position);
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
      const blend=1-Math.exp(-dt/0.16);
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
    marker.getElement().title=`${taxi.name} · ${taxi.status} · ${Math.round(taxi.speedKph??0)} km/h`;
   }
   frame=requestAnimationFrame(animate);
  };
  frame=requestAnimationFrame(animate);
  return()=>cancelAnimationFrame(frame);
 },[]);
 // Display the same regional OSM graph that taxis use. Never fetch preview.geojson.
 // Only road segments inside the visible viewport are sent to MapLibre.
 useEffect(()=>{
  const instance=map.current;
  if(!instance)return;
  let cancelled=false;
  const sourceId='active-road-network';
  const exploredLayerId='explored-road-network';
  const exploredSet=new Set(exploredEdgeIds);
  const empty:GeoJSON.FeatureCollection={type:'FeatureCollection',features:[]};
  const remove=()=>{
   if(instance.getLayer(exploredLayerId))instance.removeLayer(exploredLayerId);
   if(instance.getLayer(sourceId))instance.removeLayer(sourceId);
   if(instance.getSource(sourceId))instance.removeSource(sourceId);
  };
  const update=()=>{
   if(cancelled||!instance.isStyleLoaded())return;
   if(!roadsVisible||!graph){remove();setRoadStatus(graph?'Road overlay hidden':'Waiting for regional roads');return;}
   const bounds=instance.getBounds();
   const west=bounds.getWest(),east=bounds.getEast(),south=bounds.getSouth(),north=bounds.getNorth();
   const features:GeoJSON.Feature[]=[];
   const seen=new Set<string>();
   const MAX_VISIBLE=12000;
   outer:for(const [from,edges] of graph.edges){
    const a=graph.nodes.get(from);
    if(!a)continue;
    for(const edge of edges){
     if(seen.has(edge.id))continue;
     seen.add(edge.id);
     const b=graph.nodes.get(edge.to);
     if(!b)continue;
     if(Math.max(a[0],b[0])<west||Math.min(a[0],b[0])>east||Math.max(a[1],b[1])<south||Math.min(a[1],b[1])>north)continue;
     features.push({type:'Feature',properties:{roadId:edge.id,explored:exploredSet.has(edge.id)},geometry:{type:'LineString',coordinates:[a,b]}});
     if(features.length>=MAX_VISIBLE)break outer;
    }
   }
   const data:GeoJSON.FeatureCollection=features.length?{type:'FeatureCollection',features}:empty;
   const existing=instance.getSource(sourceId) as maplibregl.GeoJSONSource|undefined;
   if(existing)existing.setData(data);
   else{
    instance.addSource(sourceId,{type:'geojson',data});
    instance.addLayer({id:sourceId,type:'line',source:sourceId,paint:{'line-color':'#2586c8','line-width':['interpolate',['linear'],['zoom'],8,0.7,13,2.1,17,3.5],'line-opacity':0.55}});
    instance.addLayer({id:exploredLayerId,type:'line',source:sourceId,filter:['==',['get','explored'],true],paint:{'line-color':'#21db82','line-width':['interpolate',['linear'],['zoom'],8,2.0,13,4.0,17,6.0],'line-opacity':0.98}});
   }
   setRoadStatus(`${features.filter(f=>f.properties?.explored===true).length.toLocaleString()} explored / ${features.length.toLocaleString()} visible regional road segments${features.length===MAX_VISIBLE?' (display limit)':''} · ${graph.nodeKeys.length.toLocaleString()} loaded nodes`);
  };
  instance.on('moveend',update);
  instance.on('style.load',update);
  if(instance.isStyleLoaded())update();
  return()=>{cancelled=true;instance.off('moveend',update);instance.off('style.load',update);};
 },[roadsVisible,graph,ready,basemap,exploredEdgeIds]);

 // Keep the exploration overlay mounted while road discovery updates every tick.
 // The geometry worker is persistent: restarting it every second can prevent any result.
 const explorationWorker=useRef<Worker|null>(null);
 const explorationBusy=useRef(false);
 const explorationPending=useRef(false);
 const explorationInputs=useRef({graph,exploredEdgeIds,headquarters});
 explorationInputs.current={graph,exploredEdgeIds,headquarters};
 const explorationLast=useRef<{coverage:GeoJSON.FeatureCollection;locked:GeoJSON.FeatureCollection}|null>(null);
 const explorationSchedule=useRef<(()=>void)|null>(null);
 // Build a stable edge geometry index only when the graph changes.
 const explorationEdgeIndex=useRef<{graph:RoadGraph|null|undefined;entries:Map<string,Array<[[number,number],[number,number]]>>}>({graph:null,entries:new Map()});
 useEffect(()=>{
  const instance=map.current;
  if(!instance||!ready)return;
  const remove=()=>{
   for(const id of ['service-coverage-line','service-coverage-fill','locked-territory-fill','exploration-fog'])if(instance.getLayer(id))instance.removeLayer(id);
   for(const id of ['service-coverage','locked-territory','exploration-fog-source'])if(instance.getSource(id))instance.removeSource(id);
  };
  const apply=(coverage:GeoJSON.FeatureCollection,locked:GeoJSON.FeatureCollection)=>{
   if(!instance.isStyleLoaded())return;
   const oldLocked=instance.getSource('locked-territory') as maplibregl.GeoJSONSource|undefined;
   const oldCoverage=instance.getSource('service-coverage') as maplibregl.GeoJSONSource|undefined;
   if(oldLocked&&oldCoverage){oldLocked.setData(locked);oldCoverage.setData(coverage);return;}
   remove();
   instance.addSource('locked-territory',{type:'geojson',data:locked});
   instance.addLayer({id:'locked-territory-fill',type:'fill',source:'locked-territory',paint:{'fill-color':'#d36b6b','fill-opacity':0.58}});
   instance.addSource('service-coverage',{type:'geojson',data:coverage});
   instance.addLayer({id:'service-coverage-fill',type:'fill',source:'service-coverage',paint:{'fill-opacity':0}});
  };
  if(!explorationVisible||!headquarters){remove();return;}
  // Immediate starting overlay, even before the first expensive road union finishes.
  // GeoJSON holes require the opposite winding order to the outer ring.
  const lng=headquarters.lng,lat=headquarters.lat;
  const ring:Array<[number,number]>=[];
  for(let i=0;i<=96;i++){
   const angle=-i*Math.PI*2/96;
   ring.push([lng+0.5*Math.sin(angle)/(111.32*Math.cos(lat*Math.PI/180)),lat+0.5*Math.cos(angle)/111.32]);
  }
  const outer:Array<[number,number]>=[[-179.9,-85],[179.9,-85],[179.9,85],[-179.9,85],[-179.9,-85]];
  const fallback:GeoJSON.FeatureCollection={type:'FeatureCollection',features:[{type:'Feature',properties:{},geometry:{type:'Polygon',coordinates:[outer,ring]}}]};
  if(explorationLast.current)apply(explorationLast.current.coverage,explorationLast.current.locked);
  else apply({type:'FeatureCollection',features:[]},fallback);
  const worker=new Worker(new URL('../simulation/explorationGeometry.worker.ts',import.meta.url),{type:'module'});
  explorationWorker.current=worker;
  explorationBusy.current=false;
  const send=()=>{
   if(explorationBusy.current){explorationPending.current=true;return;}
   const {graph:currentGraph,exploredEdgeIds:currentIds,headquarters:currentHQ}=explorationInputs.current;
   if(!currentGraph||!currentHQ)return;
   // Index each road ID once per graph version; avoid scanning 600k+ nodes on every tick.
   if(explorationEdgeIndex.current.graph!==currentGraph){
    const entries=new Map<string,Array<[[number,number],[number,number]]>>();
    const seen=new Set<string>();
    for(const [from,edges] of currentGraph.edges)for(const edge of edges){
     const unique=[from,edge.to].sort().join('|');if(seen.has(unique))continue;seen.add(unique);
     const a=currentGraph.nodes.get(from),b=currentGraph.nodes.get(edge.to);
     if(a&&b){let list=entries.get(edge.id);if(!list){list=[];entries.set(edge.id,list);}list.push([[a[0],a[1]],[b[0],b[1]]]);}
    }
    explorationEdgeIndex.current={graph:currentGraph,entries};
   }
   const segments:Array<[[number,number],[number,number]]>=[];
   for(const id of new Set(currentIds)){
    const found=explorationEdgeIndex.current.entries.get(id);
    if(found)segments.push(...found);
   }
   explorationBusy.current=true;
   worker.postMessage({headquarters:[currentHQ.lng,currentHQ.lat],segments});
  };
  explorationSchedule.current=send;
  worker.onmessage=(event:MessageEvent<{coverage?:GeoJSON.FeatureCollection;locked?:GeoJSON.FeatureCollection;error?:string}>)=>{
   explorationBusy.current=false;
   if(event.data.error)console.error('[TravelEmpire] Exploration geometry:',event.data.error);
   if(event.data.coverage&&event.data.locked){
    explorationLast.current={coverage:event.data.coverage,locked:event.data.locked};
    apply(event.data.coverage,event.data.locked);
   }
   if(explorationPending.current){explorationPending.current=false;window.setTimeout(send,200);}
  };
  worker.onerror=e=>{explorationBusy.current=false;console.error('[TravelEmpire] Exploration worker:',e.message)};
  const onStyle=()=>{if(explorationLast.current)apply(explorationLast.current.coverage,explorationLast.current.locked);else apply({type:'FeatureCollection',features:[]},fallback);};
  instance.on('style.load',onStyle);
  send();
  return()=>{explorationSchedule.current=null;worker.terminate();explorationWorker.current=null;instance.off('style.load',onStyle)};
 },[headquarters?.lng,headquarters?.lat,explorationVisible,ready,basemap]);
 // Coalesce frequent simulation ticks rather than rebuilding the polygons every second.
 useEffect(()=>{if(!explorationVisible)return;explorationSchedule.current?.();},[graph,exploredEdgeIds,explorationVisible]);
 const selectBasemap=(mode:Basemap)=>{if(mode===basemap){setSelectorOpen(false);return;}const style=styleFor(mode);if(!style||!map.current)return;setError(null);map.current.setStyle(style);setBasemap(mode);setSelectorOpen(false);};
 return <div className="map-container"><div className="map-canvas" ref={container} role="application" aria-label="Interactive world street map"/><div className="map-layer-control"><button className="map-layer-trigger" type="button" aria-expanded={selectorOpen} aria-controls="map-layer-options" onClick={()=>setSelectorOpen(v=>!v)}><Layers3 size={17}/> Map layers</button>{selectorOpen&&<div id="map-layer-options" className="map-layer-options" role="group" aria-label="Map appearance"><button type="button" className={basemap==='standard'?'active':''} aria-pressed={basemap==='standard'} onClick={()=>selectBasemap('standard')}><MapIcon size={17}/> Standard</button><button type="button" className={basemap==='satellite'?'active':''} aria-pressed={basemap==='satellite'} onClick={()=>selectBasemap('satellite')} disabled={!key}><Satellite size={17}/> Satellite</button><div className="map-layer-note"><div>{exploredEdgeIds.length.toLocaleString()} roads discovered · 50 m exploration corridor</div><label className="territory-toggle"><input type="checkbox" checked={explorationVisible} onChange={e=>setExplorationVisible(e.target.checked)}/> Show WorldFront exploration area</label><label className="territory-toggle"><input type="checkbox" checked={roadsVisible} onChange={e=>setRoadsVisible(e.target.checked)}/> Show loaded OSM roads</label><div>{roadStatus}</div><div>Reddish = unexplored. Clear = explored WorldFront polygons (50 m either side). Passenger stops stay inside explored areas.</div></div></div>}</div>{!styleFor('standard')&&<div className="map-error" role="alert">Set VITE_MAPTILER_KEY in .env.local and restart the server.</div>}{error&&<div className="map-error" role="alert">{error}</div>}{lookingUp&&<div className="map-loading" role="status">Identifying selected location…</div>}{!ready&&styleFor('standard')&&<div className="map-loading" role="status">Loading world map…</div>}</div>;
}
