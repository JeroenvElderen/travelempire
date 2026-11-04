import type maplibregl from 'maplibre-gl';

/** TravelEmpire Natural Cinematic: retain MapTiler's realistic streets, labels,
 * road casings and land-use detail; tune only a few atmospheric accents. */
export type MapDayPhase = 'day' | 'dusk' | 'night';
export function mapDayPhase(hour:number):MapDayPhase {
 return hour>=20||hour<5?'night':hour>=18||hour<7?'dusk':'day';
}
const extrusionId='travelempire-3d-buildings';
const palettes={
 day:{water:'#79b7d1',park:'#9bc99b',forest:'#76ad83',building:'#d9c9b5',extrusion:'#d5c3ad',road:'#f4d9a9'},
 dusk:{water:'#608da9',park:'#7ea789',forest:'#628c74',building:'#c2ad9e',extrusion:'#baa294',road:'#f1d3a6'},
 night:{water:'#345a76',park:'#567763',forest:'#405f51',building:'#7c7c7a',extrusion:'#767979',road:'#c3ae94'},
} as const;
const basemapOriginals=new WeakMap<maplibregl.Map,Map<string,{property:string;value:unknown}>>();
const modifiedLayerIds=new WeakMap<maplibregl.Map,Set<string>>();
const isGameLayer=(id:string)=>/travelempire|explor|territory|ferry|survey|purple|road-status|fog|owned|discovered/i.test(id);
function naturalTarget(layer:maplibregl.AnyLayer):'water'|'park'|'forest'|'building'|'road'|null {
 const id=layer.id.toLowerCase();
 if(isGameLayer(id))return null;
 const sourceLayer=('source-layer' in layer&&typeof layer['source-layer']==='string'?layer['source-layer']:'').toLowerCase();
 const name=id+' '+sourceLayer;
 if(layer.type==='fill'){
   if(/water|ocean|lake/.test(name))return 'water';
   if(/forest|wood/.test(name))return 'forest';
   if(/park|garden/.test(name))return 'park';
   if(/building/.test(name))return 'building';
 }
 // Only tint high-priority roads slightly at dusk/night. Keep their widths,
 // outlines, tunnels, bridges, and ordinary local street colors untouched.
 if(layer.type==='line'&&/motorway|trunk/.test(id)&&/road|transportation|motorway|trunk/.test(name)&&!/casing|outline|bridge|tunnel/.test(id))return 'road';
 return null;
}
export function applyTravelEmpireStyle(map:maplibregl.Map,phase:MapDayPhase,threeD:boolean):void {
 if(!map.isStyleLoaded())return;
 const layers=map.getStyle().layers??[];
 let originals=basemapOriginals.get(map);
 if(!originals){originals=new Map();basemapOriginals.set(map,originals);}
 let modified=modifiedLayerIds.get(map);
 if(!modified){modified=new Set();modifiedLayerIds.set(map,modified);}
 // When a provider basemap is reloaded, old layer IDs can be reused; restore
 // from the new style's actual paint values instead of stale cached values.
 const liveIds=new Set(layers.map(layer=>layer.id));
 for(const id of [...modified])if(!liveIds.has(id)){modified.delete(id);originals.delete(id);}
 for(const layer of layers){
   const target=naturalTarget(layer);
   if(!target)continue;
   const property=layer.type==='line'?'line-color':'fill-color';
   if(layer.type!=='fill'&&layer.type!=='line')continue;
   const key=layer.id;
   if(!originals.has(key)){
     const value=(layer.paint as Record<string,unknown>|undefined)?.[property];
     if(value===undefined)continue;
     originals.set(key,{property,value});
   }
   const original=originals.get(key);
   if(!original)continue;
   try{
     // Daytime is the authentic MapTiler cartography. At dusk and night we
     // selectively change natural areas, without flattening the whole map.
     map.setPaintProperty(layer.id,property,phase==='day'?original.value:palettes[phase][target]);
     modified.add(key);
   }catch{/* Leave incompatible provider layers unchanged. */}
 }
 if(map.getLayer(extrusionId)){
   if(!threeD){map.removeLayer(extrusionId);return;}
   map.setPaintProperty(extrusionId,'fill-extrusion-color',palettes[phase].extrusion);
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
       'fill-extrusion-color':palettes[phase].extrusion,
       'fill-extrusion-height':['interpolate',['linear'],['zoom'],15,0,16,['coalesce',['get','render_height'],['get','height'],12]],
       'fill-extrusion-base':['coalesce',['get','render_min_height'],['get','min_height'],0],
       'fill-extrusion-opacity':0.65,
     },
   },firstLabel?.id);
 }catch(error){console.warn('[TravelEmpire] 3D buildings unavailable',error);}
}
