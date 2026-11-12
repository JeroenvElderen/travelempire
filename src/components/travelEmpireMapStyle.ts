import type maplibregl from 'maplibre-gl';

/** The selected MapTiler basemap retains its native labels and road hierarchy.
 * Only optional 3D building extrusions are added at close zoom. */
export type MapDayPhase='day'|'dusk'|'night';
export function mapDayPhase(hour:number):MapDayPhase {
 return hour>=20||hour<5?'night':hour>=18||hour<7?'dusk':'day';
}
const extrusionId='travelempire-3d-buildings';
export function applyTravelEmpireStyle(map:maplibregl.Map,_phase:MapDayPhase,threeD:boolean):void {
 if(!map.isStyleLoaded())return;
 if(map.getLayer(extrusionId)){
  if(!threeD)map.removeLayer(extrusionId);
  return;
 }
 if(!threeD)return;
 const layers=map.getStyle().layers??[];
 const building=layers.find(layer=>layer.type==='fill'&&'source-layer' in layer&&layer['source-layer']==='building'&&'source' in layer&&typeof layer.source==='string');
 if(!building||!('source' in building)||typeof building.source!=='string')return;
 const firstLabel=layers.find(layer=>layer.type==='symbol'&&!/travelempire|explor|ferry|territory/i.test(layer.id));
 try {
  map.addLayer({
   id:extrusionId,type:'fill-extrusion',source:building.source,'source-layer':'building',minzoom:15,
   paint:{
    'fill-extrusion-color':'#304451',
    'fill-extrusion-height':['interpolate',['linear'],['zoom'],15,0,16,['coalesce',['get','render_height'],['get','height'],12]],
    'fill-extrusion-base':['coalesce',['get','render_min_height'],['get','min_height'],0],
    'fill-extrusion-opacity':0.58,
   },
  },firstLabel?.id);
 }catch(error){console.warn('[TravelEmpire] 3D buildings unavailable for current basemap',error);}
}
