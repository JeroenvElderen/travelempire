import {useEffect,useRef,useState} from 'react';
import maplibregl,{Popup} from 'maplibre-gl';
import type {GameClock} from '../simulation/gameClock';
import {GAME_TIME_SCALE} from '../simulation/gameClock';
import type {RoadGraph} from '../simulation/taxi';
import type {RoadFeature} from './purpleRoadDiff';
import {advanceWorldState,newWorldState,trafficLoadAt,visibleWorldVehicles,weatherAt,incidentStatus,type WorldState,type WorldWeather} from '../simulation/livingWorld';
import {parkedCarSprites} from './parkedCars';

const CAR_SOURCE='te-world-vehicles';
const CAR_LAYER='te-world-vehicles-layer';
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
const emptyCollection=():GeoJSON.FeatureCollection=>({type:'FeatureCollection',features:[]});
const storageKey=(companyId:string)=>'travelempire.world.v1.'+companyId;
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
function addSprite(map:maplibregl.Map,id:string,width:number,height:number,data:Uint8Array){
 if(!map.hasImage(id))map.addImage(id,{width,height,data});
}
async function addSvgSprite(map:maplibregl.Map,id:string,path:string,w:number,h:number):Promise<boolean>{
 if(map.hasImage(id))return true;
 return new Promise(resolve=>{
  const image=new Image();
  image.onload=()=>{
   try{
    if(!map.isStyleLoaded())return resolve(false);
    const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
    const context=canvas.getContext('2d');
    if(!context)return resolve(false);
    context.clearRect(0,0,w,h);context.drawImage(image,0,0,w,h);
    const pixels=context.getImageData(0,0,w,h);
    addSprite(map,id,w,h,new Uint8Array(pixels.data));
    resolve(true);
   }catch{resolve(false);}
  };
  image.onerror=()=>resolve(false);
  image.src=path;
 });
}
function source(map:maplibregl.Map,id:string){
 if(!map.getSource(id))map.addSource(id,{type:'geojson',data:emptyCollection()});
 return map.getSource(id) as maplibregl.GeoJSONSource;
}
function pointFeature(id:string,point:[number,number],properties:Record<string,string|number>):PointFeature{
 return {type:'Feature',id,geometry:{type:'Point',coordinates:point},properties};
}
function validPoint(point:readonly number[]):point is [number,number]{
 return point.length>=2&&Number.isFinite(point[0])&&Number.isFinite(point[1]);
}
function addLayers(map:maplibregl.Map){
 if(!map.isStyleLoaded())return;
 source(map,TRAFFIC_SOURCE);source(map,INCIDENT_SOURCE);source(map,CAR_SOURCE);
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
 if(!map.getLayer(CAR_LAYER))map.addLayer({
  id:CAR_LAYER,type:'symbol',source:CAR_SOURCE,
  layout:{'icon-image':['get','sprite'],'icon-size':1,'icon-rotate':['get','bearing'],
   'icon-rotation-alignment':'map','icon-pitch-alignment':'map',
   'icon-allow-overlap':true,'icon-ignore-placement':true},
  paint:{'icon-opacity':0.97},
 });
}
function hideLayers(map:maplibregl.Map,traffic:boolean,npcs:boolean,events:boolean,weather:boolean){
 // Weather remains a regional status indicator, rather than obscuring roads with a full-screen tint.
 void weather;
 for(const [id,shown] of [[TRAFFIC_LAYER,traffic],[CAR_LAYER,npcs||events],[INCIDENT_LAYER,events]] as const){
  if(map.getLayer(id))map.setLayoutProperty(id,'visibility',shown?'visible':'none');
 }
}
const weatherLabel:Record<WorldWeather,string>={
 clear:'Clear',rain:'Rain',storm:'Thunderstorms',wind:'Windy',snow:'Snow / ice',
};
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
  let disposed=false,installed=false,installing=false,lastTrafficUpdate=0;
  const currentGameTime=()=>{
   const clock=clockRef.current;
   return clock?clock.epochMs+Math.max(0,Date.now()-clock.lastRealMs)*GAME_TIME_SCALE:Date.now();
  };
  const persist=(state:WorldState)=>{
   if(!companyId)return;
   try{localStorage.setItem(storageKey(companyId),JSON.stringify(state));}catch{ /* Storage full */ }
  };
  const onIncidentClick=(event:maplibregl.MapMouseEvent)=>{
   if(!flagsRef.current.events||!map.getLayer(INCIDENT_LAYER))return;
   const feature=map.queryRenderedFeatures(event.point,{layers:[INCIDENT_LAYER]})[0];
   if(!feature)return;
   const incident=worldRef.current.incidents.find(item=>item.id===String(feature.properties?.id));
   if(!incident)return;
   const name=incident.kind==='collision'?'Road collision':incident.kind==='medical'?'Medical emergency':'Roadworks';
   const response=incident.responders.map(r=>r.kind==='police'?'Police':'Ambulance').join(' + ');
   // Text-only popup: never interpolate incident data into HTML.
   new Popup({offset:14,maxWidth:'260px'})
    .setLngLat(incident.point).setText(name+' · '+incidentStatus(incident,currentGameTime())+
      (response?' · '+response:' · No nearby responder route')).addTo(map);
  };
  const install=async()=>{
   if(disposed||installing||!map.isStyleLoaded())return;
   installing=true;
   try{
    const parked=parkedCarSprites()[0];
    addSprite(map,'te-world-civilian',parked.width,parked.height,parked.data);
    const base=import.meta.env.BASE_URL+'assets/';
    await Promise.all([
     addSvgSprite(map,'te-world-police',base+'world_police.svg',25,49),
     addSvgSprite(map,'te-world-ambulance',base+'world_ambulance.svg',27,50),
    ]);
    if(disposed||!map.isStyleLoaded())return;
    addLayers(map);installed=true;
    hideLayers(map,flagsRef.current.traffic,flagsRef.current.npcs,flagsRef.current.events,flagsRef.current.weather);
    update();
   }catch(e){console.warn('Living world map layer unavailable',e);}
   finally{installing=false;}
  };
  const update=()=>{
   if(disposed||document.hidden||!map.isStyleLoaded())return;
   const now=currentGameTime();
   const flags=flagsRef.current;
   const center=map.getCenter(),point:[number,number]=[center.lng,center.lat];
   const condition=weatherAt(point,now);
   const load=trafficLoadAt(point,now);
   const visible=[...roadsRef.current().values()];
   const discoveredRoads=discoveredRef.current();
   const next=advanceWorldState(worldRef.current,now,visible,graphRef.current??null,discoveredRoads,companyId??'world');
   if(next.lastBucket!==worldRef.current.lastBucket||next.incidents.length!==worldRef.current.incidents.length)persist(next);
   worldRef.current=next;
   const incidentCount=next.incidents.length;
   setSummary(previous=>{
    const label=weatherLabel[condition];
    return previous.weather===label&&previous.load===load&&previous.incidents===incidentCount
     ?previous:{weather:label,load,incidents:incidentCount};
   });
   if(!installed||!map.getSource(CAR_SOURCE))return;
   hideLayers(map,flags.traffic,flags.npcs,flags.events,flags.weather);
   const inDetail=map.getZoom()>=13.5;
   const vehicles=visibleWorldVehicles(flags.npcs&&inDetail?visible:[],
    graphRef.current??null,discoveredRoads,now,Date.now(),
    flags.events?next.incidents:[],inDetail?28:0);
   const bounds=map.getBounds();
   const output=vehicles.filter(vehicle=>
    bounds.contains(vehicle.point)&&
    (vehicle.kind==='civilian'?flags.npcs:flags.events));
   const symbols:PointFeature[]=output.map(vehicle=>
    pointFeature(vehicle.id,vehicle.point,{sprite:'te-world-'+vehicle.kind,bearing:vehicle.bearing}));
   (map.getSource(CAR_SOURCE) as maplibregl.GeoJSONSource).setData({
    type:'FeatureCollection',features:symbols});
   const incidentFeatures:PointFeature[]=flags.events?next.incidents.filter(i=>bounds.contains(i.point))
    .map(i=>pointFeature(i.id,i.point,{id:i.id,kind:i.kind})):[];
   (map.getSource(INCIDENT_SOURCE) as maplibregl.GeoJSONSource).setData({
    type:'FeatureCollection',features:incidentFeatures});
   const wallNow=Date.now();
   if(wallNow-lastTrafficUpdate>9000){
    lastTrafficUpdate=wallNow;
    const sampled=flags.traffic&&map.getZoom()>=11.5?visible.slice(0,1500):[];
    const lines:GeoJSON.Feature<GeoJSON.LineString>[]=[];
    for(const road of sampled){
     const coords=road.geometry.coordinates;
     if(!coords.length||!validPoint(coords[0]))continue;
     const density=trafficLoadAt(coords[0],now);
     lines.push({type:'Feature',id:String(road.id),
      geometry:road.geometry,properties:{density}});
    }
    (map.getSource(TRAFFIC_SOURCE) as maplibregl.GeoJSONSource).setData({
     type:'FeatureCollection',features:lines});
   }
  };
  const onStyleLoad=()=>{installed=false;lastTrafficUpdate=0;void install();};
  const onMove=()=>{lastTrafficUpdate=0;update();};
  map.on('style.load',onStyleLoad);map.on('moveend',onMove);map.on('click',onIncidentClick);
  void install();
  const timer=window.setInterval(update,1100);
  return()=>{
   disposed=true;window.clearInterval(timer);
   map.off('style.load',onStyleLoad);map.off('moveend',onMove);
   map.off('click',onIncidentClick);
   for(const id of [CAR_LAYER,INCIDENT_LAYER,TRAFFIC_LAYER])if(map.getLayer(id))map.removeLayer(id);
   for(const id of [CAR_SOURCE,INCIDENT_SOURCE,TRAFFIC_SOURCE])if(map.getSource(id))map.removeSource(id);
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
