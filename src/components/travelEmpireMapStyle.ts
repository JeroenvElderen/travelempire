import type maplibregl from 'maplibre-gl';

/** Signature TravelEmpire cartography: distinct in daylight as well as at night.
 * Paint-only updates never replace vector sources, fog, exploration or vehicles. */
export type MapDayPhase='day'|'dusk'|'night';
export function mapDayPhase(hour:number):MapDayPhase {
 return hour>=20||hour<5?'night':hour>=18||hour<7?'dusk':'day';
}
type Feature='land'|'water'|'waterway'|'forest'|'park'|'grass'|'farmland'|'building'|'motorway'|'major'|'minor'|'rail'|'border';
const colors:Record<MapDayPhase,Record<Feature,string>>={
 day:{land:'#f1e8d2',water:'#4aabd0',waterway:'#4aabd0',forest:'#4e9e6b',park:'#81c88b',grass:'#b8d9a1',farmland:'#dfd6a7',building:'#d7bba3',motorway:'#e6a35c',major:'#fff4dc',minor:'#ffffff',rail:'#9d958b',border:'#b0a48f'},
 dusk:{land:'#cbbba7',water:'#367f9d',waterway:'#367f9d',forest:'#427e60',park:'#6a9d76',grass:'#9fb58a',farmland:'#b8a982',building:'#ae8f7c',motorway:'#e8a369',major:'#f3d7b7',minor:'#e9dfd1',rail:'#8b8179',border:'#91877e'},
 night:{land:'#263943',water:'#173e5c',waterway:'#235779',forest:'#264d43',park:'#366354',grass:'#415f50',farmland:'#4c584b',building:'#55606a',motorway:'#d99b62',major:'#9dabb0',minor:'#667b83',rail:'#68747d',border:'#647079'},
};
const extrusionId='travelempire-3d-buildings';
const originals=new WeakMap<maplibregl.Map,Map<string,unknown>>();
const isGameLayer=(id:string)=>/travelempire|explor|territory|ferry|survey|purple|fog|discovered|owned|road-status/i.test(id);
function feature(layer:{id:string;type:string;'source-layer'?:string;source?:unknown}):Feature|null{
 const id=layer.id.toLowerCase();
 if(isGameLayer(id))return null;
 const source=typeof layer.source==='string'?layer.source.toLowerCase():'';
 // Only restyle MapTiler's vector basemap, never app-managed GeoJSON sources.
 if(/explor|territory|ferry|travelempire|survey|roads-|graph|station/.test(source))return null;
 const sourceLayer=layer['source-layer']?.toLowerCase()??'';
 const name=id+' '+sourceLayer;
 if(layer.type==='background')return 'land';
 if(layer.type==='fill'){
  if(/water|ocean|lake|reservoir/.test(name))return 'water';
  if(/building/.test(name))return 'building';
  if(/forest|wood/.test(name))return 'forest';
  if(/park|garden|recreation/.test(name))return 'park';
  if(/farmland|farm|agricult/.test(name))return 'farmland';
  if(/grass|meadow|scrub|landcover|landuse/.test(name))return 'grass';
  if(/land|earth/.test(name))return 'land';
 }
 if(layer.type==='line'){
  if(/water|river|stream|canal/.test(name))return 'waterway';
  if(/rail/.test(name))return 'rail';
  if(/boundary|border/.test(name))return 'border';
  // Preserve provider casings and bridges: only recolor road centerlines.
  if(/casing|outline|tunnel|bridge/.test(id))return null;
  if(/motorway|trunk/.test(name))return 'motorway';
  if(/primary|secondary|tertiary/.test(name))return 'major';
  if(/road|street|transportation|residential|service/.test(name))return 'minor';
 }
 return null;
}
export function applyTravelEmpireStyle(map:maplibregl.Map,phase:MapDayPhase,threeD:boolean):void{
 if(!map.isStyleLoaded())return;
 const layers=map.getStyle().layers??[];
 let original=originals.get(map);
 if(!original){original=new Map();originals.set(map,original);}
 for(const layer of layers){
  const kind=feature(layer);
  if(!kind)continue;
  const property=layer.type==='background'?'background-color':layer.type==='fill'?'fill-color':layer.type==='line'?'line-color':null;
  if(!property)continue;
  const key=layer.id+':'+property;
  if(!original.has(key))original.set(key,(layer.paint as Record<string,unknown>|undefined)?.[property]);
  try{map.setPaintProperty(layer.id,property,colors[phase][kind]);}catch{/* Retain unsupported provider paint layers. */}
 }
 if(map.getLayer(extrusionId)){
  if(!threeD){map.removeLayer(extrusionId);return;}
  map.setPaintProperty(extrusionId,'fill-extrusion-color',colors[phase].building);
  return;
 }
 if(!threeD)return;
 const building=layers.find(layer=>layer.type==='fill'&&'source-layer' in layer&&layer['source-layer']==='building'&&'source' in layer&&typeof layer.source==='string');
 if(!building||!('source' in building)||typeof building.source!=='string')return;
 const firstLabel=layers.find(layer=>layer.type==='symbol'&&!isGameLayer(layer.id));
 try{
  map.addLayer({
   id:extrusionId,type:'fill-extrusion',source:building.source,'source-layer':'building',minzoom:15,
   paint:{
    'fill-extrusion-color':colors[phase].building,
    'fill-extrusion-height':['interpolate',['linear'],['zoom'],15,0,16,['coalesce',['get','render_height'],['get','height'],12]],
    'fill-extrusion-base':['coalesce',['get','render_min_height'],['get','min_height'],0],
    'fill-extrusion-opacity':0.68,
   },
  },firstLabel?.id);
 }catch(error){console.warn('[TravelEmpire] 3D buildings unavailable',error);}
}
