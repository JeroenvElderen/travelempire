import type maplibregl from 'maplibre-gl';

/** Colorful, geographically detailed TravelEmpire palette. Recolors the existing
 * MapTiler vector basemap in place, without replacing sources or gameplay layers. */
export type MapDayPhase = 'day' | 'dusk' | 'night';
export function mapDayPhase(hour: number): MapDayPhase {
  return hour >= 20 || hour < 5 ? 'night' : hour >= 18 || hour < 7 ? 'dusk' : 'day';
}
const palettes = {
  day: {land:'#f7f1df',water:'#69bce2',park:'#8bd49b',forest:'#5ebc81',grass:'#b9dea1',building:'#e3c7a8',minor:'#ffffff',major:'#fff3d5',motorway:'#f6c47c',rail:'#a69d91',boundary:'#ab9888',label:'#35434a'},
  dusk: {land:'#d8c7b4',water:'#538bb7',park:'#7ba783',forest:'#538c72',grass:'#a2b38b',building:'#bd9d88',minor:'#e6d5c1',major:'#f5dbb5',motorway:'#f2b56f',rail:'#8f7f7b',boundary:'#8b7b7a',label:'#303e4e'},
  night: {land:'#233848',water:'#173f64',park:'#315b58',forest:'#254b46',grass:'#365957',building:'#4a5768',minor:'#637a88',major:'#a6a3a0',motorway:'#dba16c',rail:'#647380',boundary:'#52616e',label:'#d6e5e8'},
} as const;
const OWNED_PREFIX = 'travelempire-';
const extrusionId = 'travelempire-3d-buildings';

export function applyTravelEmpireStyle(map: maplibregl.Map, phase: MapDayPhase, threeD: boolean): void {
  if (!map.isStyleLoaded()) return;
  const palette = palettes[phase];
  const layers = map.getStyle().layers ?? [];
  // Only style provider basemap layers, never discovery, fog, ferry or vehicle overlays.
  for (const layer of layers) {
    const id = layer.id.toLowerCase();
    if (id.startsWith(OWNED_PREFIX) || id.includes('explor') || id.includes('territory') || id.includes('ferry') || id.includes('road-status') || id.includes('purple') || id.includes('survey')) continue;
    const sourceLayer = ('source-layer' in layer && typeof layer['source-layer'] === 'string' ? layer['source-layer'] : '').toLowerCase();
    const name = id + ' ' + sourceLayer;
    let color: string | undefined;
    let property: string | undefined;
    if (layer.type === 'background') {property='background-color';color=palette.land;}
    else if (layer.type === 'fill') {
      property='fill-color';
      if (/water|ocean|lake|river/.test(name)) color=palette.water;
      else if (/building/.test(name)) color=palette.building;
      else if (/forest|wood/.test(name)) color=palette.forest;
      else if (/park|garden|recreation/.test(name)) color=palette.park;
      else if (/grass|meadow|landcover|landuse|farmland/.test(name)) color=palette.grass;
      else if (/land|earth/.test(name)) color=palette.land;
    } else if (layer.type === 'line') {
      property='line-color';
      if (/water|river|stream/.test(name)) color=palette.water;
      else if (/motorway|trunk|highway/.test(id)) color=palette.motorway;
      else if (/road|street|transportation|bridge|tunnel/.test(name)) color=/primary|secondary|major/.test(id)?palette.major:palette.minor;
      else if (/rail/.test(name)) color=palette.rail;
      else if (/boundary|border/.test(name)) color=palette.boundary;
    } else if (layer.type === 'symbol') {
      // Keep icon colors and custom markers unchanged; adjust only provider text.
      if (/label|place|poi|road|street|country|city|town|village/.test(name)) {property='text-color';color=palette.label;}
    }
    if (color && property) {
      try { map.setPaintProperty(layer.id, property, color); } catch { /* Some style layers use unsupported paint expressions. */ }
    }
  }
  if (map.getLayer(extrusionId)) {
    map.setPaintProperty(extrusionId,'fill-extrusion-color',palette.building);
    return;
  }
  if (!threeD) return;
  const building = layers.find(layer=>layer.type==='fill' && 'source-layer' in layer && layer['source-layer']==='building' && 'source' in layer && typeof layer.source==='string');
  if (!building || !('source' in building) || typeof building.source!=='string') return;
  const firstLabel = layers.find(layer=>layer.type==='symbol' && !/travelempire|explor|ferry|territory/.test(layer.id.toLowerCase()));
  try {
    map.addLayer({
      id:extrusionId,type:'fill-extrusion',source:building.source,'source-layer':'building',
      minzoom:15,
      paint:{
        'fill-extrusion-color':palette.building,
        'fill-extrusion-height':['interpolate',['linear'],['zoom'],15,0,16,['coalesce',['get','render_height'],['get','height'],12]],
        'fill-extrusion-base':['coalesce',['get','render_min_height'],['get','min_height'],0],
        'fill-extrusion-opacity':0.72,
      },
    },firstLabel?.id);
  } catch (error) { console.warn('[TravelEmpire] 3D buildings unavailable for this basemap',error); }
}
