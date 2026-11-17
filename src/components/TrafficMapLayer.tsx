import {useEffect,useRef} from 'react';
import maplibregl from 'maplibre-gl';
import type {RoadGraph} from '../simulation/taxi';
import type {RoadFeature} from './purpleRoadDiff';
import {trafficBandForFeature,type RoadTrafficBand,ROAD_TRAFFIC_COLORS} from './trafficRoadColors';
import {ROAD_LEVEL_DEBUG_LAYER_IDS} from './roadLevelsDebug';

const SOURCE_ID='explored-road-network-source';
const NORMAL_LAYER='te-congestion-visible-roads';
const TUNNEL_LAYER='te-congestion-visible-tunnels';
const palette:maplibregl.ExpressionSpecification=[
 'match',['coalesce',['feature-state','trafficBand'],'clear'],
 'clear',ROAD_TRAFFIC_COLORS.clear,
 'moderate',ROAD_TRAFFIC_COLORS.moderate,
 'heavy',ROAD_TRAFFIC_COLORS.heavy,
 'severe',ROAD_TRAFFIC_COLORS.severe,
 ROAD_TRAFFIC_COLORS.clear,
];

/** GPU-only traffic colouring on the EXISTING discovered-road GeoJSON source.
 * This never creates another road source, NPC car, marker or simulation timer.
 * Updates feature-state in bounded slices to avoid blocking mobile Safari.
 */
export default function TrafficMapLayer({
 map,enabled,graph,visibleRoads,roadRevision,gameBucket,gameTime,
 incidentRevision,showRoadLevelsDebug,
}:{
 map:maplibregl.Map|null;
 enabled:boolean;
 graph:RoadGraph|null|undefined;
 visibleRoads:()=>ReadonlyMap<string,RoadFeature>;
 roadRevision:number;
 gameBucket:number;
 gameTime:number;
 incidentRevision:number;
 showRoadLevelsDebug:boolean;
}){
 const roadsRef=useRef(visibleRoads);roadsRef.current=visibleRoads;
 const timeRef=useRef(gameTime);timeRef.current=gameTime;
 const previouslySet=useRef<Map<string,RoadTrafficBand>>(new Map());
 const lastSource=useRef<maplibregl.Source|null>(null);
 useEffect(()=>{
  if(!map)return;
  const remove=()=>{
   if(!map.isStyleLoaded())return;
   if(map.getLayer(TUNNEL_LAYER))map.removeLayer(TUNNEL_LAYER);
   if(map.getLayer(NORMAL_LAYER))map.removeLayer(NORMAL_LAYER);
  };
  if(!enabled||!graph){
   remove();previouslySet.current.clear();lastSource.current=null;
   return;
  }
  let cancelled=false;
  let timer:ReturnType<typeof setTimeout>|undefined;
  let sourceRefresh:ReturnType<typeof setTimeout>|undefined;
  const sync=()=>{
   if(cancelled||!map.isStyleLoaded())return;
   const source=map.getSource(SOURCE_ID);
   // WorldMap asynchronously constructs the source after viewport scanning.
   if(!source)return;
   if(lastSource.current!==source){
    previouslySet.current.clear();lastSource.current=source;
   }
   if(!map.getLayer(NORMAL_LAYER))map.addLayer({
    id:NORMAL_LAYER,type:'line',source:SOURCE_ID,minzoom:8,
    filter:['!=',['get','tunnel'],true],
    layout:{'line-cap':'round','line-join':'round'},
    paint:{
     'line-color':palette,
     'line-opacity':0.90,
     'line-width':['interpolate',['linear'],['zoom'],8,1.2,12,2.4,16,4.0,19,5.2],
    },
   });
   if(!map.getLayer(TUNNEL_LAYER))map.addLayer({
    id:TUNNEL_LAYER,type:'line',source:SOURCE_ID,minzoom:8,
    filter:['==',['get','tunnel'],true],
    layout:{'line-cap':'round','line-join':'round'},
    paint:{
     'line-color':palette,'line-opacity':0.85,
     'line-dasharray':[2,2],
     'line-width':['interpolate',['linear'],['zoom'],8,1.2,12,2.4,16,4.0,19,5.2],
    },
   });
   // WorldMap periodically moves the original blue roads to the top.
   // Reassert traffic colouring after each completed viewport scan.
   map.moveLayer(NORMAL_LAYER);
   map.moveLayer(TUNNEL_LAYER);
   if(showRoadLevelsDebug)for(const id of ROAD_LEVEL_DEBUG_LAYER_IDS){
    if(map.getLayer(id))map.moveLayer(id);
   }
   if(timer!==undefined)clearTimeout(timer);
   const visible=roadsRef.current();
   const seen=new Set<string>();
   const iter=visible.values();
   const at=timeRef.current;
   const batch=()=>{
    if(cancelled||!map.isStyleLoaded()||map.getSource(SOURCE_ID)!==source)return;
    const started=performance.now();
    let processed=0;
    while(processed<180&&performance.now()-started<2.5){
     const next=iter.next();
     if(next.done){
      // Keep only viewport IDs, not all discovered roads across Greece.
      for(const id of previouslySet.current.keys()){
       if(!seen.has(id))previouslySet.current.delete(id);
      }
      return;
     }
     const feature=next.value;
     const id=String(feature.properties?.roadId??'');
     if(!id)continue;
     seen.add(id);
     const band=trafficBandForFeature(feature,graph,at);
     if(band&&previouslySet.current.get(id)!==band){
      try{
       map.setFeatureState({source:SOURCE_ID,id},{trafficBand:band});
       previouslySet.current.set(id,band);
      }catch{
       // Style swaps can invalidate the source while a slice is executing.
       return;
      }
     }
     processed++;
    }
    timer=setTimeout(batch,0);
   };
   batch();
  };
  sync();
  const onStyle=()=>{
   lastSource.current=null;previouslySet.current.clear();
   if(sourceRefresh!==undefined)clearTimeout(sourceRefresh);
   sourceRefresh=setTimeout(sync,100);
  };
  map.on('style.load',onStyle);
  return()=>{
   cancelled=true;
   if(timer!==undefined)clearTimeout(timer);
   if(sourceRefresh!==undefined)clearTimeout(sourceRefresh);
   map.off('style.load',onStyle);
  };
 },[map,enabled,graph,roadRevision,gameBucket,incidentRevision,showRoadLevelsDebug]);
 return null;
}
