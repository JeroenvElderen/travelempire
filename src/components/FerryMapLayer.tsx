import {useEffect} from 'react';
import type maplibregl from 'maplibre-gl';
import type {FerryNetwork} from '../maritime/ferries';
import type {FerryConnectionResult} from '../maritime/roadConnections';
import {meters} from '../simulation/taxi';

const SOURCE='travelempire-ferry-routes';
const LINE='travelempire-ferry-lines';
const PORTS='travelempire-ferry-ports';
const LABELS='travelempire-ferry-labels';

export function syncFerryMapLayer(map:maplibregl.Map,network:FerryNetwork,purchased:ReadonlySet<string>,connections?:FerryConnectionResult):void{
 const ready=new Set(connections?.connected.map(c=>c.portId)??[]);
 // OSM ferry ways often share virtually identical endpoints. Display one
 // marker per physical harbour without changing route/port identifiers.
 const grouped: Array<{position:[number,number];ready:boolean;count:number}> = [];
 for(const port of network.ports){
  const match=grouped.find(g=>meters(g.position,port.position)<=35);
  if(match){match.count++;match.ready ||= ready.has(port.id);}
  else grouped.push({position:port.position,ready:ready.has(port.id),count:1});
 }
 const features:GeoJSON.Feature[]=[
  ...network.routes.map(r=>({type:'Feature' as const,properties:{id:r.id,name:r.name||r.id,owned:purchased.has(r.id)},geometry:{type:'LineString' as const,coordinates:r.geometry}})),
  ...grouped.map((p,i)=>({type:'Feature' as const,properties:{id:`harbour-${i}`,name:'Ferry terminal',port:true,ready:p.ready,count:p.count},geometry:{type:'Point' as const,coordinates:p.position}})),
 ];
 const data:GeoJSON.FeatureCollection={type:'FeatureCollection',features};
 if(map.getSource(SOURCE)){(map.getSource(SOURCE) as maplibregl.GeoJSONSource).setData(data);return;}
 map.addSource(SOURCE,{type:'geojson',data});
 map.addLayer({id:LINE,type:'line',source:SOURCE,filter:['==',['geometry-type'],'LineString'],paint:{'line-color':['case',['get','owned'],'#48d6c2','#eeae57'],'line-width':['interpolate',['linear'],['zoom'],4,1.5,9,3.5],'line-opacity':0.8,'line-dasharray':[2,2]}});
 map.addLayer({id:PORTS,type:'circle',source:SOURCE,filter:['==',['geometry-type'],'Point'],paint:{'circle-color':['case',['get','ready'],'#42d6a4','#fff0c1'],'circle-radius':['interpolate',['linear'],['zoom'],4,3,11,7],'circle-stroke-color':'#205a7e','circle-stroke-width':2}});
 map.addLayer({id:LABELS,type:'symbol',source:SOURCE,filter:['==',['geometry-type'],'Point'],minzoom:9,layout:{'text-field':['concat','Ferry terminal',['case',['get','ready'],' (road connected)',' (road access unverified)']],'text-size':11,'text-offset':[0,1.3],'text-anchor':'top'},paint:{'text-color':'#fff3d9','text-halo-color':'#152b3b','text-halo-width':1.5}});
}
/** Hook reruns on map style reload as well as network/ownership changes. */
export function useFerryMapLayer(map:maplibregl.Map|null,network:FerryNetwork|null,purchased:ReadonlySet<string>):void{
 useEffect(()=>{if(!map||!network)return;const refresh=()=>{if(map.isStyleLoaded())syncFerryMapLayer(map,network,purchased)};map.on('styledata',refresh);refresh();return()=>{map.off('styledata',refresh)}},[map,network,purchased]);
}
