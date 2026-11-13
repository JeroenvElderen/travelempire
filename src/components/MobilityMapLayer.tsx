import {useEffect,useMemo,useRef,useState} from 'react';
import maplibregl from 'maplibre-gl';
import type {FerryNetwork} from '../maritime/ferries';
import {mobilityManifest,type MobilityMode,type MobilityPoint} from '../data/mobilityTiles';
import {MobilityController} from '../simulation/mobilityController';
import {mobilityMetres} from '../simulation/mobilityExploration';
import './mobility-exploration.css';

const SOURCE='te-mobility-discovery';
const AVAILABLE='te-mobility-available';
const WALKED='te-mobility-walked';
const CYCLED='te-mobility-cycled';
const LAYERS=[AVAILABLE,WALKED,CYCLED];
type Props={map:maplibregl.Map|null;enabled:boolean;companyId?:string;
 ferryNetwork:FerryNetwork|null;unlockedHarbourIds:string[]};

function removeLayers(map:maplibregl.Map){
 for(const id of [...LAYERS].reverse())if(map.getLayer(id))map.removeLayer(id);
 if(map.getSource(SOURCE))map.removeSource(SOURCE);
}
function ensureLayers(map:maplibregl.Map){
 if(map.getSource(SOURCE))return;
 const empty:GeoJSON.FeatureCollection={type:'FeatureCollection',features:[]};
 map.addSource(SOURCE,{type:'geojson',data:empty});
 map.addLayer({id:AVAILABLE,type:'line',source:SOURCE,
  filter:['==',['get','state'],'available'],minzoom:13,
  paint:{'line-color':'#8f9bad','line-width':['interpolate',['linear'],['zoom'],13,1,18,2.6],
   'line-opacity':0.42,'line-dasharray':[2,2]}});
 map.addLayer({id:WALKED,type:'line',source:SOURCE,
  filter:['==',['get','state'],'walked'],
  paint:{'line-color':'#54e7ac','line-width':['interpolate',['linear'],['zoom'],10,2,18,5],
   'line-opacity':0.94}});
 map.addLayer({id:CYCLED,type:'line',source:SOURCE,
  filter:['==',['get','state'],'cycled'],
  paint:{'line-color':'#37c3f0','line-width':['interpolate',['linear'],['zoom'],10,2,18,5],
   'line-opacity':0.95}});
}

export default function MobilityMapLayer({map,enabled,companyId,ferryNetwork,unlockedHarbourIds}:Props){
 const [status,setStatus]=useState('Walking & cycling paths are not loaded');
 const [selectedPort,setSelectedPort]=useState('');
 const [busy,setBusy]=useState(false);
 const [showAvailable,setShowAvailable]=useState(true);
 const [version,setVersion]=useState(0);
 const controllerRef=useRef<MobilityController|null>(null);
 const markers=useRef(new Map<MobilityMode,maplibregl.Marker>());
 const lastTick=useRef(0);
 const unlockedKey=unlockedHarbourIds.join('|');
 const ports=useMemo(()=>{
  const allowed=new Set(unlockedHarbourIds);
  return (ferryNetwork?.ports??[])
   .filter(port=>allowed.has(port.id))
   .sort((a,b)=>a.name.localeCompare(b.name));
 // unlockedKey reflects contents even if the array reference is reused.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[ferryNetwork,unlockedKey]);

 // Prefer the nearest already-unlocked harbour to the current camera.
 useEffect(()=>{
  if(!enabled||!ports.length)return;
  if(ports.some(p=>p.id===selectedPort))return;
  const center=map?.getCenter();
  const camera:MobilityPoint=center?[center.lng,center.lat]:ports[0].position;
  const closest=[...ports].sort((a,b)=>
   mobilityMetres(a.position,camera)-mobilityMetres(b.position,camera))[0];
  setSelectedPort(closest.id);
 },[enabled,ports,selectedPort,map]);

 useEffect(()=>{
  if(!enabled||!companyId)return;
  let cancelled=false;
  setStatus('Checking pedestrian/cycling dataset…');
  (async()=>{
   try{
    const manifest=await mobilityManifest();
    if(cancelled)return;
    if(!Object.keys(manifest.tiles).length){
     setStatus('Mobility tiles not deployed yet. Build and upload the Greece foot/bicycle dataset first.');
     return;
    }
    const controller=new MobilityController(companyId,manifest,()=>{
     if(!cancelled)setVersion(v=>v+1);
    });
    controllerRef.current=controller;
    await controller.restore();
    if(cancelled)return;
    setStatus('Ready. Choose an unlocked harbour to deploy a walking or cycling explorer.');
    const restored=Object.values(controller.sessions);
    for(const session of restored)if(session)await controller.loadNear(session.position);
   }catch(error){
    if(!cancelled)setStatus('Mobility dataset unavailable: '+String(error));
   }
  })();
  return()=>{
   cancelled=true;
   void controllerRef.current?.persist();
   controllerRef.current=null;
  };
 },[enabled,companyId]);

 useEffect(()=>{
  if(!map||!enabled)return;
  const refresh=()=>{
   if(!map.isStyleLoaded())return;
   try{
    ensureLayers(map);
    const controller=controllerRef.current;
    if(!controller)return;
    const {segments,discovered}=controller.snapshot;
    const bounds=map.getBounds();
    const zoom=map.getZoom();
    const features:GeoJSON.Feature<GeoJSON.LineString>[]=[];
    // Limit GeoJSON work on mobile: no nationwide map data loaded or drawn.
    const limit=7000;
    for(const road of segments){
     if(features.length>=limit)break;
     const a=road.coordinates[0],b=road.coordinates[1];
     if(Math.max(a[0],b[0])<bounds.getWest()||Math.min(a[0],b[0])>bounds.getEast()||
        Math.max(a[1],b[1])<bounds.getSouth()||Math.min(a[1],b[1])>bounds.getNorth())
      continue;
     const walked=discovered.walk.has(road.id);
     const cycled=discovered.cycle.has(road.id);
     if(!walked&&!cycled&&(!showAvailable||zoom<13))continue;
     // When both modes used this same segment, cycling is drawn above walking.
     const state=cycled?'cycled':walked?'walked':'available';
     features.push({type:'Feature',properties:{id:road.id,state,kind:road.highway,
       bridge:road.bridge??false,tunnel:road.tunnel??false,layer:road.layer??0},
      geometry:{type:'LineString',coordinates:road.coordinates}});
    }
    const source=map.getSource(SOURCE) as maplibregl.GeoJSONSource|undefined;
    source?.setData({type:'FeatureCollection',features});
   }catch(error){console.warn('Mobility map overlay unavailable',error)}
  };
  map.on('style.load',refresh);
  map.on('moveend',refresh);
  refresh();
  return()=>{map.off('style.load',refresh);map.off('moveend',refresh);removeLayers(map)};
 },[map,enabled,version,showAvailable]);

 useEffect(()=>{
  if(!enabled||!map)return;
  const controller=controllerRef.current;
  for(const mode of ['walk','cycle'] as MobilityMode[]){
   const session=controller?.sessions[mode];
   let marker=markers.current.get(mode);
   if(!session){
    marker?.remove();markers.current.delete(mode);continue;
   }
   if(!marker){
    const element=document.createElement('div');
    element.className='te-mobility-marker '+mode;
    element.textContent=mode==='walk'?'🚶':'🚴';
    element.title=mode==='walk'?'Walking Explorer':'Cycling Explorer';
    marker=new maplibregl.Marker({element,anchor:'center'})
     .setLngLat(session.position).addTo(map);
    markers.current.set(mode,marker);
   }else marker.setLngLat(session.position);
  }
 },[map,enabled,version]);

 useEffect(()=>{
  if(!enabled||!map)return;
  const timer=window.setInterval(()=>{
   const controller=controllerRef.current;
   if(!controller)return;
   const now=performance.now();
   const elapsed=lastTick.current?Math.min(2,(now-lastTick.current)/1000):1;
   lastTick.current=now;
   void controller.tick(elapsed);
  },1000);
  return()=>{window.clearInterval(timer);lastTick.current=0};
 },[enabled,map]);

 useEffect(()=>{
  if(enabled)return;
  for(const marker of markers.current.values())marker.remove();
  markers.current.clear();
 },[enabled]);
 useEffect(()=>()=>{
  for(const marker of markers.current.values())marker.remove();
  markers.current.clear();
 },[]);

 const deploy=async(mode:MobilityMode)=>{
  const port=ports.find(p=>p.id===selectedPort);
  const controller=controllerRef.current;
  if(!port||!controller||busy)return;
  setBusy(true);
  setStatus('Loading legal '+(mode==='walk'?'walking':'cycling')+' routes near '+port.name+'…');
  try{
   const ok=await controller.deploy(mode,port.id,port.position);
   if(ok){
    setStatus((mode==='walk'?'Walking':'Cycling')+' explorer deployed at '+port.name);
    map?.easeTo({center:port.position,zoom:Math.max(13,map.getZoom()),duration:600});
   }else setStatus(controller.error??'No legal paths found near this harbour');
  }catch(error){setStatus('Deployment failed: '+String(error))}
  finally{setBusy(false);setVersion(v=>v+1)}
 };
 if(!enabled)return null;
 const controller=controllerRef.current;
 const snapshot=controller?.snapshot;
 return <aside className="te-mobility-panel" aria-label="Walking and cycling exploration">
  <div className="te-mobility-heading">
   <span className="te-mobility-heading-icon">🚶 🚴</span>
   <span><strong>Island exploration</strong><small>Separate pedestrian and bicycle networks</small></span>
  </div>
  <p className="te-mobility-status" role="status">{snapshot?.error??status}</p>
  <label htmlFor="te-mobility-port">Unlocked ferry harbour</label>
  <select id="te-mobility-port" value={selectedPort} onChange={e=>setSelectedPort(e.target.value)}
   disabled={!ports.length||busy}>
   {!ports.length&&<option value="">No unlocked harbours</option>}
   {ports.map(port=><option key={port.id} value={port.id}>{port.name}</option>)}
  </select>
  <div className="te-mobility-actions">
   <button type="button" disabled={!controller?.hasAccess||!selectedPort||busy}
    onClick={()=>void deploy('walk')}>🚶 Deploy walker</button>
   <button type="button" disabled={!controller?.hasAccess||!selectedPort||busy}
    onClick={()=>void deploy('cycle')}>🚴 Deploy cyclist</button>
  </div>
  <div className="te-mobility-stats">
   <span><b>{snapshot?.discovered.walk.size.toLocaleString()??0}</b> walked paths</span>
   <span><b>{snapshot?.discovered.cycle.size.toLocaleString()??0}</b> cycled paths</span>
   <span><b>{snapshot?.loadedTiles??0}</b> loaded tiles</span>
  </div>
  <div className="te-mobility-legend">
   <span><i style={{background:'#54e7ac'}}/> Walking</span>
   <span><i style={{background:'#37c3f0'}}/> Cycling</span>
   <span><i style={{background:'#8f9bad'}}/> Accessible (not discovered)</span>
  </div>
  <label className="te-mobility-option">
   <input type="checkbox" checked={showAvailable} onChange={e=>setShowAvailable(e.target.checked)}/>
   Show unvisited accessible paths when zoomed in
  </label>
  <small>Starts only at mapped paths within 250 m of unlocked harbours. Routes follow original OSM node connections; taxis cannot use these paths.</small>
 </aside>;
}
