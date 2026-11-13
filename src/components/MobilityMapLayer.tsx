import {useEffect,useRef,useState} from 'react';
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

function paintMobility(map:maplibregl.Map,controller:MobilityController|null,showAvailable:boolean){
 if(!map.isStyleLoaded())return;
 try{
  ensureLayers(map);
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
}

export default function MobilityMapLayer({map,enabled,companyId,ferryNetwork,unlockedHarbourIds}:Props){
 const [version,setVersion]=useState(0);
 const [initialized,setInitialized]=useState(false);
 const showAvailable=false; // Only draw explored roads; no permanent map-wide grey overlay.
 const controllerRef=useRef<MobilityController|null>(null);
 const markers=useRef(new Map<MobilityMode,maplibregl.Marker>());
 const lastTick=useRef(0);
 const unlockedKey=unlockedHarbourIds.join('|');
 const autoAttempted=useRef<Record<MobilityMode,string>>({walk:'',cycle:''});
 useEffect(()=>{
  if(!enabled||!companyId)return;
  let cancelled=false;
  setInitialized(false);
  autoAttempted.current={walk:'',cycle:''};
  (async()=>{
   try{
    const manifest=await mobilityManifest();
    if(cancelled)return;
    if(!Object.keys(manifest.tiles).length){
     console.warn('Walking/cycling dataset is not deployed; the mobility layer is inactive.');
     return;
    }
    const controller=new MobilityController(companyId,manifest,()=>{
     if(!cancelled)setVersion(v=>v+1);
    });
    controllerRef.current=controller;
    await controller.restore();
    if(cancelled)return;
    setInitialized(true);
    const restored=Object.values(controller.sessions);
    for(const session of restored)if(session)await controller.loadNear(session.position);
   }catch(error){
    if(!cancelled)console.warn('Walking/cycling paths unavailable',error);
   }
  })();
  return()=>{
   cancelled=true;
   void controllerRef.current?.persist();
   controllerRef.current=null;
  };
 },[enabled,companyId]);


 // The map is the interface. No large harbour-selection panel: walkers and
 // cyclists resume automatically, or start at a nearby already-unlocked
 // harbour with an actual mode-permitted OSM node. Never invent access.
 useEffect(()=>{
  const controller=controllerRef.current;
  if(!enabled||!initialized||!controller||!ferryNetwork||!map)return;
  let cancelled=false;
  const ports=ferryNetwork.ports.filter(p=>unlockedHarbourIds.includes(p.id));
  if(!ports.length)return;
  const center=map.getCenter();
  const here:MobilityPoint=[center.lng,center.lat];
  const byDistance=[...ports].sort((a,b)=>
   mobilityMetres(a.roadAccess??a.position,here)-
   mobilityMetres(b.roadAccess??b.position,here));
  const run=async()=>{
   for(const mode of ['walk','cycle'] as MobilityMode[]){
    if(cancelled||controllerRef.current!==controller)return;
    if(controller.sessions[mode])continue; // Resume previously discovered work.
    if(autoAttempted.current[mode]===unlockedKey)continue;
    autoAttempted.current[mode]=unlockedKey;
    for(const port of byDistance.slice(0,3)){
     if(cancelled||controllerRef.current!==controller)return;
     const ok=await controller.deploy(mode,port.id,port.roadAccess??port.position);
     if(ok)break;
    }
   }
  };
  void run();
  return()=>{cancelled=true;};
 // unlockedKey captures the actual unlocked harbour ID list.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[enabled,initialized,companyId,map,ferryNetwork,unlockedKey]);
 useEffect(()=>{
  if(!map||!enabled)return;
  const refresh=()=>paintMobility(map,controllerRef.current,showAvailable);
  map.on('style.load',refresh);
  map.on('moveend',refresh);
  refresh();
  return()=>{
   map.off('style.load',refresh);map.off('moveend',refresh);
   removeLayers(map);
  };
 },[map,enabled,showAvailable]);
 const lastPaintAt=useRef(0);
 useEffect(()=>{
  if(!map||!enabled)return;
  const now=performance.now();
  if(now-lastPaintAt.current<2500)return; // Throttle GeoJSON rebuilds on iPhone.
  lastPaintAt.current=now;
  paintMobility(map,controllerRef.current,showAvailable);
 },[map,enabled,version]);

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

 // No UI panel. The existing Map Layers toggle controls visibility and
 // automatic exploration; walkers and cyclists appear as small map markers.
 return null;
}
