import {useEffect,useRef,useState} from 'react';
import maplibregl,{Popup} from 'maplibre-gl';
import type {GameClock} from '../simulation/gameClock';
import {GAME_TIME_SCALE} from '../simulation/gameClock';
import type {RoadGraph,Point} from '../simulation/taxi';
import type {RoadFeature} from './purpleRoadDiff';
import {advanceWorldState,newWorldState,trafficLoadAt,visibleWorldVehicles,weatherAt,incidentStatus,
 type WorldState,type WorldWeather} from '../simulation/livingWorld';
import {advanceAmbientCar,ambientVehicleBudget,spawnAmbientCar,type AmbientCar} from '../simulation/livingNpcTraffic';

const INCIDENT_SOURCE='te-world-incidents';
const INCIDENT_LAYER='te-world-incidents-layer';
const TRAFFIC_SOURCE='te-world-traffic';
const TRAFFIC_LAYER='te-world-traffic-layer';
type Props={
 map:maplibregl.Map|null;companyId?:string;gameClock?:GameClock|null;graph:RoadGraph|null|undefined;
 roads:()=>ReadonlyMap<string,RoadFeature>;discovered:()=>Set<string>;
 traffic:boolean;npcs:boolean;events:boolean;weather:boolean;
};
type PointFeature=GeoJSON.Feature<GeoJSON.Point>;
type AmbientVehicle= {id:string;kind:'civilian'|'police'|'ambulance';point:Point;bearing:number;color?:number};
const emptyCollection=():GeoJSON.FeatureCollection=>({type:'FeatureCollection',features:[]});
const storageKey=(companyId:string)=>'travelempire.world.v1.'+companyId;
const PAINT_FILTERS=[
 'hue-rotate(180deg) saturate(0.9)',
 'hue-rotate(135deg) saturate(1.1)',
 'hue-rotate(325deg) saturate(1.0)',
 'hue-rotate(245deg) saturate(0.8)',
 'grayscale(1) brightness(0.72)',
 'grayscale(1) brightness(1.8)',
 'hue-rotate(55deg) saturate(0.7)',
];
function loadWorld(companyId?:string):WorldState{
 if(!companyId)return newWorldState();
 try{
  const value=JSON.parse(localStorage.getItem(storageKey(companyId))??'null') as WorldState|null;
  if(value&&Number.isFinite(value.lastBucket)&&Array.isArray(value.incidents))
   return {lastBucket:value.lastBucket,incidents:value.incidents.filter(item=>
    item&&typeof item.id==='string'&&Array.isArray(item.responders)&&Number.isFinite(item.endsAt)).slice(-3)};
 }catch{ /* Saved world may predate this version. */ }
 return newWorldState();
}
function source(map:maplibregl.Map,id:string){
 if(!map.getSource(id))map.addSource(id,{type:'geojson',data:emptyCollection()});
 return map.getSource(id) as maplibregl.GeoJSONSource;
}
function pointFeature(id:string,point:Point,properties:Record<string,string|number>):PointFeature{
 return {type:'Feature',id,geometry:{type:'Point',coordinates:point},properties};
}
function addLayers(map:maplibregl.Map){
 if(!map.isStyleLoaded())return;
 source(map,TRAFFIC_SOURCE);source(map,INCIDENT_SOURCE);
 if(!map.getLayer(TRAFFIC_LAYER))map.addLayer({
  id:TRAFFIC_LAYER,type:'line',source:TRAFFIC_SOURCE,
  layout:{'line-cap':'round','line-join':'round'},
  paint:{'line-color':['step',['get','density'],'#20a984',35,'#e4af40',65,'#ea584e'],
   'line-width':['interpolate',['linear'],['zoom'],11,1.3,16,2.7],
   'line-offset':['interpolate',['linear'],['zoom'],11,1.6,16,3.1],
   'line-opacity':0.68},
 });
 if(!map.getLayer(INCIDENT_LAYER))map.addLayer({
  id:INCIDENT_LAYER,type:'circle',source:INCIDENT_SOURCE,
  paint:{'circle-radius':['interpolate',['linear'],['zoom'],11,5,16,9],
   'circle-color':['match',['get','kind'],'medical','#e95a63','roadworks','#e7a848','#e5494b'],
   'circle-stroke-color':'#fff','circle-stroke-width':2,'circle-opacity':0.96},
 });
}
const weatherLabel:Record<WorldWeather,string>={
 clear:'Clear',rain:'Rain',storm:'Thunderstorms',wind:'Windy',snow:'Snow / ice',
};
function buildVehicleElement(kind:AmbientVehicle['kind'],color=0):HTMLElement{
 const element=document.createElement('div');
 // Exactly the same car artwork and marker proportions as player-owned taxis.
 element.className='taxi-map-marker te-ambient-vehicle';
 element.style.pointerEvents='none';
 if(kind!=='civilian'){
  element.style.width=kind==='ambulance'?'13px':'10px';
  element.style.height=kind==='ambulance'?'25px':'21px';
 }
 const image=document.createElement('img');
 const base=import.meta.env.BASE_URL+'assets/';
 image.src=base+(kind==='civilian'?'car_topview.svg':kind==='police'?'world_police.svg':'world_ambulance.svg');
 image.alt='';image.draggable=false;
 if(kind==='civilian')image.style.filter=PAINT_FILTERS[color%PAINT_FILTERS.length];
 element.title=kind==='civilian'?'Civilian traffic':kind==='police'?'Police response':'Ambulance response';
 element.appendChild(image);
 return element;
}
export default function LivingWorldLayer({map,companyId,gameClock,graph,roads,discovered,traffic,npcs,events,weather}:Props){
 const worldRef=useRef<WorldState>(loadWorld(companyId));
 const clockRef=useRef(gameClock);clockRef.current=gameClock;
 const graphRef=useRef(graph);graphRef.current=graph;
 const roadsRef=useRef(roads);roadsRef.current=roads;
 const discoveredRef=useRef(discovered);discoveredRef.current=discovered;
 const flagsRef=useRef({traffic,npcs,events,weather});flagsRef.current={traffic,npcs,events,weather};
 const [summary,setSummary]=useState({weather:'Clear',load:0,incidents:0});
 useEffect(()=>{worldRef.current=loadWorld(companyId);},[companyId]);
 useEffect(()=>{
  if(!map)return;
  let disposed=false,lastTrafficUpdate=0,lastWorldUpdate=0,lastSpawn=0;
  let lastFrame=0,animation=0;
  const mobile=/iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const agents=new Map<string,AmbientCar>();
  const markers=new Map<string,maplibregl.Marker>();
  const headings=new Map<string,number>();
  const nowGame=()=>{
   const clock=clockRef.current;
   return clock?clock.epochMs+Math.max(0,Date.now()-clock.lastRealMs)*GAME_TIME_SCALE:Date.now();
  };
  const persist=(state:WorldState)=>{
   if(!companyId)return;
   try{localStorage.setItem(storageKey(companyId),JSON.stringify(state));}catch{ /* Storage full */ }
  };
  const removeMarker=(id:string)=>{
   markers.get(id)?.remove();markers.delete(id);headings.delete(id);
  };
  const drawVehicle=(v:AmbientVehicle,elapsed:number)=>{
   if(!map.getBounds().contains(v.point)){removeMarker(v.id);return;}
   let marker=markers.get(v.id);
   if(!marker){
    marker=new maplibregl.Marker({element:buildVehicleElement(v.kind,v.color),
     anchor:'center',rotationAlignment:'map',pitchAlignment:'map'})
     .setLngLat(v.point).setRotation(v.bearing).addTo(map);
    markers.set(v.id,marker);headings.set(v.id,v.bearing);
   }else{
    marker.setLngLat(v.point);
    const old=headings.get(v.id)??v.bearing;
    const turn=((v.bearing-old+540)%360)-180;
    const next=old+turn*(1-Math.exp(-Math.max(0,elapsed)/0.16));
    headings.set(v.id,next);
    marker.setRotation(next);
   }
  };
  const onIncidentClick=(event:maplibregl.MapMouseEvent)=>{
   if(!flagsRef.current.events||!map.getLayer(INCIDENT_LAYER))return;
   const feature=map.queryRenderedFeatures(event.point,{layers:[INCIDENT_LAYER]})[0];
   if(!feature)return;
   const incident=worldRef.current.incidents.find(item=>item.id===String(feature.properties?.id));
   if(!incident)return;
   const title=incident.kind==='collision'?'Road collision':incident.kind==='medical'?'Medical emergency':'Roadworks';
   const response=incident.responders.map(r=>r.kind==='police'?'Police':'Ambulance').join(' + ');
   new Popup({offset:14,maxWidth:'260px'}).setLngLat(incident.point)
    .setText(title+' · '+incidentStatus(incident,nowGame())+(response?' · '+response:' · No reachable responder'))
    .addTo(map);
  };
  const install=()=>{
   if(disposed||!map.isStyleLoaded())return;
   try{addLayers(map);}catch(error){console.warn('Living-world overlays unavailable',error);}
  };
  const updateWorld=()=>{
   if(disposed||!map.isStyleLoaded())return;
   const at=nowGame(),flags=flagsRef.current;
   const center=map.getCenter(),centerPoint:Point=[center.lng,center.lat];
   const load=trafficLoadAt(centerPoint,at),condition=weatherAt(centerPoint,at);
   const roadsNow=[...roadsRef.current().values()];
   const next=advanceWorldState(worldRef.current,at,roadsNow,
    graphRef.current??null,discoveredRef.current(),companyId??'world');
   if(next.lastBucket!==worldRef.current.lastBucket||next.incidents.length!==worldRef.current.incidents.length)
    persist(next);
   worldRef.current=next;
   setSummary(current=>{
    const label=weatherLabel[condition];
    return current.weather===label&&current.load===load&&current.incidents===next.incidents.length
     ?current:{weather:label,load,incidents:next.incidents.length};
   });
   if(map.getSource(INCIDENT_SOURCE)){
    const bounds=map.getBounds();
    (map.getSource(INCIDENT_SOURCE) as maplibregl.GeoJSONSource).setData({
     type:'FeatureCollection',
     features:flags.events?next.incidents.filter(i=>bounds.contains(i.point))
      .map(i=>pointFeature(i.id,i.point,{id:i.id,kind:i.kind})):[],
    });
   }
   if(map.getSource(TRAFFIC_SOURCE)&&Date.now()-lastTrafficUpdate>=9000){
    lastTrafficUpdate=Date.now();
    const lines:GeoJSON.Feature<GeoJSON.LineString>[]=[];
    if(flags.traffic&&map.getZoom()>=11.5)for(const road of roadsNow.slice(0,1500)){
     const point=road.geometry.coordinates[0];
     if(!point||!Number.isFinite(point[0])||!Number.isFinite(point[1]))continue;
     lines.push({type:'Feature',id:String(road.id),geometry:road.geometry,
      properties:{density:trafficLoadAt(point as Point,at)}});
    }
    (map.getSource(TRAFFIC_SOURCE) as maplibregl.GeoJSONSource).setData({
     type:'FeatureCollection',features:lines,
    });
   }
   for(const [id,on] of [[TRAFFIC_LAYER,flags.traffic],[INCIDENT_LAYER,flags.events]] as const)
    if(map.getLayer(id))map.setLayoutProperty(id,'visibility',on?'visible':'none');
  };
  const refillFleet=(timestamp:number)=>{
   const flags=flagsRef.current,graphNow=graphRef.current;
   const limit=ambientVehicleBudget(map.getZoom(),
    trafficLoadAt([map.getCenter().lng,map.getCenter().lat],nowGame()),
    mobile,roadsRef.current().size);
   if(!flags.npcs||!graphNow||limit===0){
    agents.clear();
    for(const id of [...markers.keys()])if(id.startsWith('npc:'))removeMarker(id);
    return;
   }
   if(timestamp-lastSpawn<2500&&agents.size>0)return;
   lastSpawn=timestamp;
   while(agents.size>limit){
    const id=agents.keys().next().value;
    if(!id)break;
    agents.delete(id);removeMarker(id);
   }
   if(agents.size>=limit)return;
   const visible=[...roadsRef.current().values()];
   const stride=Math.max(1,Math.floor(visible.length/Math.max(1,limit*5)));
   let added=0;
   for(let i=0;i<visible.length&&agents.size<limit;i+=stride){
    const car=spawnAmbientCar(visible[i],graphNow,discoveredRef.current());
    if(!car||agents.has(car.id))continue;
    agents.set(car.id,car);added++;
   }
   if(!added&&agents.size===0)lastSpawn=timestamp-1500;
  };
  const animate=(timestamp:number)=>{
   animation=requestAnimationFrame(animate);
   if(disposed||document.hidden||!map.isStyleLoaded()){lastFrame=timestamp;return;}
   const interval=mobile?50:33; // Match taxi motion without excessive iPhone DOM work.
   if(timestamp-lastFrame<interval)return;
   const elapsed=lastFrame?Math.min(0.25,(timestamp-lastFrame)/1000):0;
   lastFrame=timestamp;
   if(timestamp-lastWorldUpdate>1400){lastWorldUpdate=timestamp;updateWorld();}
   refillFleet(timestamp);
   const flags=flagsRef.current,graphNow=graphRef.current,at=nowGame();
   const desired=new Set<string>();
   if(flags.npcs&&graphNow){
    for(const [id,old] of agents){
     const moved=advanceAmbientCar(old,graphNow,discoveredRef.current(),elapsed,at);
     if(!moved||!map.getBounds().contains(moved.taxi.position)){
      agents.delete(id);removeMarker(id);continue;
     }
     agents.set(id,moved);
     const a=moved.taxi.path[moved.taxi.leg],b=moved.taxi.path[moved.taxi.leg+1];
     const east=a&&b?(b[0]-a[0])*Math.cos((a[1]+b[1])*Math.PI/360):0;
     const heading=a&&b?Math.atan2(east,b[1]-a[1])*180/Math.PI:moved.bearing;
     desired.add(id);
     drawVehicle({id,kind:'civilian',point:moved.taxi.position,bearing:heading,color:moved.color},elapsed);
    }
   }
   if(flags.events){
    // Emergency paths interpolate every render frame using game time, not a 1.1s timer.
    const emergency=visibleWorldVehicles([],null,new Set(),at,Date.now(),worldRef.current.incidents,0);
    for(const v of emergency){
     if(!map.getBounds().contains(v.point))continue;
     desired.add(v.id);
     drawVehicle(v,elapsed);
    }
   }
   for(const id of markers.keys())if(!desired.has(id))removeMarker(id);
  };
  const onStyleLoad=()=>{lastTrafficUpdate=0;install();};
  const onMove=()=>{lastTrafficUpdate=0;lastSpawn=0;updateWorld();};
  map.on('style.load',onStyleLoad);map.on('moveend',onMove);map.on('click',onIncidentClick);
  install();
  animation=requestAnimationFrame(animate);
  return()=>{
   disposed=true;cancelAnimationFrame(animation);
   map.off('style.load',onStyleLoad);map.off('moveend',onMove);map.off('click',onIncidentClick);
   for(const marker of markers.values())marker.remove();
   markers.clear();headings.clear();agents.clear();
   for(const id of [INCIDENT_LAYER,TRAFFIC_LAYER])if(map.getLayer(id))map.removeLayer(id);
   for(const id of [INCIDENT_SOURCE,TRAFFIC_SOURCE])if(map.getSource(id))map.removeSource(id);
  };
 },[map,companyId]);
 if(!companyId)return null;
 return <div className="te-world-weather" aria-label="Living world status" style={{
  position:'absolute',left:12,top:100,zIndex:8,pointerEvents:'none',
  background:'rgba(16,31,43,.85)',border:'1px solid rgba(188,215,232,.25)',
  borderRadius:12,color:'#f5f9fc',padding:'8px 10px',fontSize:11,
  boxShadow:'0 4px 15px rgba(0,0,0,.15)',maxWidth:'min(70vw,245px)'}}>
  <strong style={{fontSize:12}}>World activity</strong>
  <div>{flagsRef.current.weather?summary.weather+' · ':''}{summary.load}% traffic · {summary.incidents} incident{summary.incidents===1?'':'s'}</div>
 </div>;
}
