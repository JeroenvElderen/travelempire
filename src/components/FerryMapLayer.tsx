import {useEffect} from 'react';
import type maplibregl from 'maplibre-gl';
import type {FerryNetwork} from '../maritime/ferries';
import type {FerryConnectionResult} from '../maritime/roadConnections';

const SOURCE='travelempire-ferry-routes';
const LINE='travelempire-ferry-lines';
const PORTS='travelempire-ferry-ports';
const LABELS='travelempire-ferry-labels';

export function syncFerryMapLayer(map:maplibregl.Map,network:FerryNetwork,purchased:ReadonlySet<string>,connections?:FerryConnectionResult,unlocked:ReadonlySet<string>=new Set()):void{
 const connected=new Set(connections?.connected.map(c=>c.portId)??[]);
 // Adjacent OSM ferry endpoints often represent the same visible harbour.
 // Collapse display markers only; keep every original port/route ID for routing.
 const displayPorts:typeof network.ports=[];
 for(const port of network.ports){
  if(!unlocked.has(port.id))continue;
  const existing=displayPorts.find(p=>{
   const dx=(p.position[0]-port.position[0])*111320*Math.cos(port.position[1]*Math.PI/180);
   const dy=(p.position[1]-port.position[1])*111320;
   return Math.hypot(dx,dy)<35;
  });
  if(!existing)displayPorts.push(port);
  else if(connected.has(port.id)&&!connected.has(existing.id)){
   displayPorts[displayPorts.indexOf(existing)]=port;
  }
 }
 const features:GeoJSON.Feature[]=[
  ...network.routes.filter(r=>unlocked.has(r.from)||unlocked.has(r.to)).map(r=>({type:'Feature' as const,properties:{id:r.id,name:r.name||r.id,owned:purchased.has(r.id)},geometry:{type:'LineString' as const,coordinates:r.geometry}})),
  ...displayPorts.map(p=>({type:'Feature' as const,properties:{id:p.id,name:p.name,port:true,connected:connected.has(p.id)},geometry:{type:'Point' as const,coordinates:p.position}})),
 ];
 const data:GeoJSON.FeatureCollection={type:'FeatureCollection',features};
 if(map.getSource(SOURCE)){(map.getSource(SOURCE) as maplibregl.GeoJSONSource).setData(data);return;}
 map.addSource(SOURCE,{type:'geojson',data});
 map.addLayer({id:LINE,type:'line',source:SOURCE,filter:['==',['geometry-type'],'LineString'],paint:{'line-color':['case',['get','owned'],'#48d6c2','#eeae57'],'line-width':['interpolate',['linear'],['zoom'],4,1.5,9,3.5],'line-opacity':0.8,'line-dasharray':[2,2]}});
 map.addLayer({id:PORTS,type:'circle',source:SOURCE,filter:['==',['geometry-type'],'Point'],paint:{'circle-color':['case',['get','connected'],'#42d6a4','#fff0c1'],'circle-radius':['interpolate',['linear'],['zoom'],4,3,11,7],'circle-stroke-color':'#205a7e','circle-stroke-width':2}});
 map.addLayer({id:LABELS,type:'symbol',source:SOURCE,filter:['==',['geometry-type'],'Point'],minzoom:9,layout:{'text-field':['concat',['get','name'],['case',['get','connected'],' (road connected)',' (road access unverified)']],'text-size':11,'text-offset':[0,1.3],'text-anchor':'top'},paint:{'text-color':'#fff3d9','text-halo-color':'#152b3b','text-halo-width':1.5}});
}
/** Hook reruns on map style reload as well as network/ownership changes. */
export function useFerryMapLayer(map:maplibregl.Map|null,network:FerryNetwork|null,purchased:ReadonlySet<string>):void{
 useEffect(()=>{if(!map||!network)return;const refresh=()=>{if(map.isStyleLoaded())syncFerryMapLayer(map,network,purchased)};map.on('style.load',refresh);refresh();return()=>{map.off('style.load',refresh)}},[map,network,purchased]);
}
