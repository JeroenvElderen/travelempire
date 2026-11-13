import type maplibregl from 'maplibre-gl';
import type {RoadGraph,Point} from '../simulation/taxi';

export type DebugRoad={id:string;a:Point;b:Point;aNode:string;bNode:string;forward:boolean;reverse:boolean;layer?:number;level?:number;bridge?:boolean;tunnel?:boolean};
const SOURCE='te-road-levels-debug',NODES='te-road-levels-nodes';
const KINDS=['surface','tunnel','bridge','below','above'] as const;
const ROAD_LAYERS=KINDS.map(k=>'te-road-level-'+k);
const ARROWS='te-road-level-directions',TERMINALS='te-road-level-terminals';
export const ROAD_LEVEL_DEBUG_LAYER_IDS=[...ROAD_LAYERS,ARROWS,TERMINALS];

export function roadLevelKind(road:Pick<DebugRoad,'tunnel'|'bridge'|'layer'>):typeof KINDS[number]{
 if(road.tunnel)return 'tunnel';
 if(road.bridge)return 'bridge';
 if((road.layer??0)<0)return 'below';
 if((road.layer??0)>0)return 'above';
 return 'surface';
}
export function roadLevelDirection(road:Pick<DebugRoad,'forward'|'reverse'>):'both'|'forward'|'reverse'|'none'{
 if(road.forward&&road.reverse)return 'both';
 if(road.forward)return 'forward';
 if(road.reverse)return 'reverse';
 return 'none';
}
export function removeRoadLevelsDebug(map:maplibregl.Map):void{
 for(const layer of [...ROAD_LEVEL_DEBUG_LAYER_IDS].reverse())
  if(map.getLayer(layer))map.removeLayer(layer);
 for(const source of [NODES,SOURCE])if(map.getSource(source))map.removeSource(source);
}
/** Shows only roads already loaded into the simulation's directed OSM graph.
 * Overlapping lines never imply connectivity. No road topology is modified. */
export function syncRoadLevelsDebug(map:maplibregl.Map,roads:readonly DebugRoad[],graph:RoadGraph){
 const features:GeoJSON.Feature<GeoJSON.LineString>[]=[];
 const nodeIds=new Set<string>();
 let oneWays=0,tunnels=0,bridges=0;
 for(const road of roads){
  if(features.length>=6000)break;
  const direction=roadLevelDirection(road),kind=roadLevelKind(road);
  if(direction!=='both')oneWays++;
  if(kind==='tunnel')tunnels++;
  if(kind==='bridge')bridges++;
  nodeIds.add(road.aNode);nodeIds.add(road.bNode);
  features.push({type:'Feature',properties:{roadId:road.id,kind,direction,layer:road.layer??0,level:road.level??null,aNode:road.aNode,bNode:road.bNode},
   geometry:{type:'LineString',coordinates:direction==='reverse'?[road.b,road.a]:[road.a,road.b]}});
 }
 const lines:GeoJSON.FeatureCollection<GeoJSON.LineString>={type:'FeatureCollection',features};
 const existing=map.getSource(SOURCE) as maplibregl.GeoJSONSource|undefined;
 if(existing)existing.setData(lines);else map.addSource(SOURCE,{type:'geojson',data:lines});
 const colors:Record<typeof KINDS[number],string>={surface:'#91a1ad',tunnel:'#b660ff',bridge:'#ffb249',below:'#e85ad6',above:'#ff8d57'};
 for(const kind of KINDS){
  const id='te-road-level-'+kind;
  if(map.getLayer(id))continue;
  map.addLayer({id,type:'line',source:SOURCE,filter:['==',['get','kind'],kind],
   layout:{'line-cap':'round','line-join':'round'},
   paint:{'line-color':colors[kind],'line-width':['interpolate',['linear'],['zoom'],13,1.3,16,3,19,5],
    'line-opacity':0.95,...(kind==='tunnel'||kind==='below'?{'line-dasharray':[2,1.5]}:{})}});
 }
 if(!map.getLayer(ARROWS))map.addLayer({id:ARROWS,type:'symbol',source:SOURCE,
  filter:['any',['==',['get','direction'],'forward'],['==',['get','direction'],'reverse']],minzoom:15,
  layout:{'symbol-placement':'line','symbol-spacing':95,'text-field':'➜','text-size':16,'text-rotation-alignment':'map','text-allow-overlap':true,'text-ignore-placement':true},
  paint:{'text-color':'#00e0ff','text-halo-color':'#09192c','text-halo-width':1.5}});
 const incoming=new Map<string,number>();
 const nodeKinds=new Map<string,Set<string>>();
 for(const road of roads){
  if(road.forward)incoming.set(road.bNode,(incoming.get(road.bNode)??0)+1);
  if(road.reverse)incoming.set(road.aNode,(incoming.get(road.aNode)??0)+1);
  for(const node of [road.aNode,road.bNode]){
   let kinds=nodeKinds.get(node);
   if(!kinds){kinds=new Set();nodeKinds.set(node,kinds);}
   kinds.add(roadLevelKind(road));
  }
 }
 const markers:GeoJSON.Feature<GeoJSON.Point>[]=[];
 for(const node of nodeIds){
  if(markers.length>=450)break;
  const point=graph.nodes.get(node);if(!point)continue;
  const outgoing=(graph.edges.get(node)??[]).length,arriving=incoming.get(node)??0;
  const kind=arriving>0&&outgoing===0?'no-exit':
   (nodeKinds.get(node)?.size??0)>1?'level-transition':null;
  if(kind)markers.push({type:'Feature',properties:{node,kind,incoming:arriving,outgoing},
   geometry:{type:'Point',coordinates:point}});
 }
 const nodes:GeoJSON.FeatureCollection<GeoJSON.Point>={type:'FeatureCollection',features:markers};
 const nodeSource=map.getSource(NODES) as maplibregl.GeoJSONSource|undefined;
 if(nodeSource)nodeSource.setData(nodes);else map.addSource(NODES,{type:'geojson',data:nodes});
 if(!map.getLayer(TERMINALS))map.addLayer({id:TERMINALS,type:'circle',source:NODES,minzoom:15,
  paint:{'circle-radius':['interpolate',['linear'],['zoom'],15,4,18,7],
   'circle-color':['match',['get','kind'],'no-exit','#ff465f','level-transition','#4dffad','#ff465f'],
   'circle-stroke-color':'#ffffff','circle-stroke-width':1.5,'circle-opacity':0.95}});
 return{roads:features.length,oneWays,tunnels,bridges,noExit:markers.filter(f=>f.properties?.kind==='no-exit').length,transitions:markers.filter(f=>f.properties?.kind==='level-transition').length};
}
