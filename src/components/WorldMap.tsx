import {useEffect,useRef,useState} from 'react';
import maplibregl from 'maplibre-gl';
import {Layers3,Map as MapIcon,Satellite} from 'lucide-react';
import type {Headquarters} from '../company';
import {advanceTaxi,type Taxi,type RoadGraph} from '../simulation/taxi';
import {regionId,regionName,type RegionCollection,type ClaimedRegion} from '../territories';
type Basemap='standard'|'satellite';
type Props={selecting:boolean;onLocationSelected:(location:Headquarters)=>void;headquarters:Headquarters|null; regions?:RegionCollection|null; claimedRegion?:ClaimedRegion|null; onRegionSelected?:(id:string)=>void;taxis?:Taxi[];exploredEdgeIds?:string[];graph?:RoadGraph|null};
const key=import.meta.env.VITE_MAPTILER_KEY?.trim();const customStyle=import.meta.env.VITE_MAP_STYLE_URL?.trim();
function styleFor(mode:Basemap):string|null{if(mode==='standard'&&customStyle)return customStyle;if(!key)return null;return `https://api.maptiler.com/maps/${mode==='standard'?'streets-v2':'hybrid'}/style.json?key=${encodeURIComponent(key)}`;}
export default function WorldMap({selecting,onLocationSelected,headquarters,regions,claimedRegion,onRegionSelected,taxis=[],exploredEdgeIds=[],graph}:Props){
 const taxiMarkers=useRef(new Map<string,maplibregl.Marker>());
 const container=useRef<HTMLDivElement>(null);const map=useRef<maplibregl.Map|null>(null);const marker=useRef<maplibregl.Marker|null>(null);const onLocationRef=useRef(onLocationSelected);onLocationRef.current=onLocationSelected;
 const onRegionRef=useRef(onRegionSelected);onRegionRef.current=onRegionSelected;
 const selectingRef=useRef(selecting);selectingRef.current=selecting;
 const explorationSignature=exploredEdgeIds.join('\u001f');
 const [explorationVisible,setExplorationVisible]=useState(true);const [diagnosticVisible,setDiagnosticVisible]=useState(false);const [roadsVisible,setRoadsVisible]=useState(true);const [roadStatus,setRoadStatus]=useState('Not generated');const [territoriesVisible,setTerritoriesVisible]=useState(true);const [territoryError,setTerritoryError]=useState<string|null>(null);const [basemap,setBasemap]=useState<Basemap>('standard');const [error,setError]=useState<string|null>(null);const [ready,setReady]=useState(false);const [selectorOpen,setSelectorOpen]=useState(false);const [lookingUp,setLookingUp]=useState(false);const busy=useRef(false);
 useEffect(()=>{const style=styleFor('standard');if(!container.current||!style)return;const instance=new maplibregl.Map({container:container.current,style,center:[-6.1,53.2],zoom:9,minZoom:1,maxZoom:19,attributionControl:false});map.current=instance;instance.addControl(new maplibregl.NavigationControl({showCompass:true}),'bottom-right');instance.addControl(new maplibregl.AttributionControl({compact:true}),'bottom-left');instance.on('load',()=>{setReady(true);});instance.on('error',e=>{console.error('MapLibre:',e.error);setError('Some map resources failed to load. Check your API key and network.');});
 instance.on('click',async e=>{if(!selectingRef.current){const layers=instance.getStyle()?.layers??[];if(layers.some(layer=>layer.id==='territory-fill')){const hits=instance.queryRenderedFeatures(e.point,{layers:['territory-fill']});if(hits.length){onRegionRef.current?.(String(hits[0].properties?.regionKey??''));}}return;}if(busy.current)return;busy.current=true;setLookingUp(true);setError(null);const {lng,lat}=e.lngLat;try{if(!key)throw Error('MapTiler API key required for location lookup.');const response=await fetch(`https://api.maptiler.com/geocoding/${lng},${lat}.json?key=${encodeURIComponent(key)}&language=en`);if(!response.ok)throw Error(`Location lookup failed (${response.status})`);const data=await response.json() as {features?:Array<{text?:string;place_name?:string;place_type?:string[];properties?:Record<string,unknown>;context?:Array<{id?:string;text?:string;short_code?:string}>}>};const features=data.features??[];const place=features[0];const context=[...(place?.context??[])];for(const f of features){if(f.place_type?.includes('country'))context.push({id:'country',text:f.text,short_code:String(f.properties?.short_code??'')});if(f.place_type?.includes('region'))context.push({id:'region',text:f.text});}const country=context.find(c=>c.id?.startsWith('country'));const region=context.find(c=>c.id?.startsWith('region'));if(!country?.text)throw Error('Select a location on land within a recognized country.');onLocationRef.current({lng,lat,label:place?.text||place?.place_name||`${lat.toFixed(4)}, ${lng.toFixed(4)}`,country:country.text,countryCode:country.short_code??'',region:region?.text??''});}catch(err){setError(err instanceof Error?err.message:'Unable to identify this location.');}finally{busy.current=false;setLookingUp(false);}});
 return()=>{taxiMarkers.current.forEach(m=>m.remove());taxiMarkers.current.clear();marker.current?.remove();marker.current=null;map.current=null;instance.remove();};},[]);
 useEffect(()=>{if(!map.current)return;map.current.getCanvas().style.cursor=selecting?'crosshair':'';},[selecting]);
 useEffect(()=>{if(!map.current)return;marker.current?.remove();marker.current=null;if(headquarters){marker.current=new maplibregl.Marker({color:'#4bd9ac'}).setLngLat([headquarters.lng,headquarters.lat]).setPopup(new maplibregl.Popup({offset:20}).setText(`${headquarters.label} — ${headquarters.country}`)).addTo(map.current);map.current.flyTo({center:[headquarters.lng,headquarters.lat],zoom:Math.max(map.current.getZoom(),11)});}},[headquarters]);
 const taxiSnapshots=useRef(new Map<string,{taxi:Taxi;at:number}>());
 useEffect(()=>{const now=performance.now();const ids=new Set(taxis.map(t=>t.id));for(const [id,m] of taxiMarkers.current){if(!ids.has(id)){m.remove();taxiMarkers.current.delete(id);taxiSnapshots.current.delete(id);}}for(const taxi of taxis){taxiSnapshots.current.set(taxi.id,{taxi,at:now});if(!taxiMarkers.current.has(taxi.id)&&map.current){const el=document.createElement('div');el.className='taxi-map-marker';const img=document.createElement('img');img.src=`${import.meta.env.BASE_URL??'/'}assets/car_topview.svg`;img.alt='';img.draggable=false;el.appendChild(img);el.title=taxi.name;const m=new maplibregl.Marker({element:el,anchor:'center',rotationAlignment:'map',pitchAlignment:'map'}).setLngLat(taxi.position).addTo(map.current);taxiMarkers.current.set(taxi.id,m);}}},[taxis]);
 useEffect(()=>{
  let frame=0;
  const animate=()=>{
   const now=performance.now();
   for(const [id,snapshot] of taxiSnapshots.current){
    const marker=taxiMarkers.current.get(id);if(!marker)continue;
    const taxi=snapshot.taxi;
    const elapsed=Math.min(1,Math.max(0,(now-snapshot.at)/1000));
    const projected=graph&&taxi.status!=='IDLE'?advanceTaxi(taxi,graph,elapsed).taxi:taxi;
    marker.setLngLat(projected.position);
    if(projected.status!=='IDLE'&&projected.path.length>1){
     const index=Math.min(projected.leg,projected.path.length-2);
     const a=projected.path[index],b=projected.path[index+1];
     const bearing=Math.atan2((b[0]-a[0])*Math.cos((a[1]+b[1])*Math.PI/360),b[1]-a[1])*180/Math.PI;
     marker.setRotation(bearing);
    }
    marker.getElement().title=`${taxi.name} · ${taxi.status} · ${Math.round(projected.speedKph??0)} km/h`;
   }
   frame=requestAnimationFrame(animate);
  };
  frame=requestAnimationFrame(animate);
  return()=>cancelAnimationFrame(frame);
 },[graph]);
 // Territory source is independent of the base map style and must be restored after setStyle().
 // Wait for style.load, which guarantees that addSource/addLayer can be called.
 useEffect(()=>{
  const instance=map.current;
  if(!instance)return;
  let disposed=false;
  const clear=()=>{
   for(const id of ['territory-diagnostic-border','territory-diagnostic-fill','territory-label','territory-border','territory-fill']){
    if(instance.getLayer(id))instance.removeLayer(id);
   }
   if(instance.getSource('territories'))instance.removeSource('territories');
  };
  const apply=()=>{
   if(disposed || !instance.isStyleLoaded())return;
   try{
    clear();
    if(!regions || !territoriesVisible){setTerritoryError(null);return;}
    const code=claimedRegion?.countryCode??'';
    const collection:GeoJSON.FeatureCollection={
     type:'FeatureCollection',
     features:regions.features.map((f,i)=>({...f,properties:{...f.properties,
      displayName:regionName(f),regionKey:regionId(f,i,code),
      owned:claimedRegion?.id===regionId(f,i,code)?1:0}}))
    };
    instance.addSource('territories',{type:'geojson',data:collection});
    instance.addLayer({id:'territory-fill',type:'fill',source:'territories',
     paint:{'fill-color':['case',['==',['get','owned'],1],'#000000','#63747e'],
      'fill-opacity':['case',['==',['get','owned'],1],0,0.20]}});
    instance.addLayer({id:'territory-border',type:'line',source:'territories',
     paint:{'line-color':['case',['==',['get','owned'],1],'#caa24c','#a68c56'],
      'line-width':['case',['==',['get','owned'],1],1.7,1.0],
      'line-opacity':0.7},layout:{'line-join':'round','line-cap':'round'}});
    if(diagnosticVisible && claimedRegion){
     instance.addLayer({id:'territory-diagnostic-fill',type:'fill',source:'territories',filter:['==',['get','owned'],1],paint:{'fill-color':'#ff4d8d','fill-opacity':0.22}});
     instance.addLayer({id:'territory-diagnostic-border',type:'line',source:'territories',filter:['==',['get','owned'],1],layout:{'line-join':'round','line-cap':'round'},paint:{'line-color':'#ff4d8d','line-width':3,'line-opacity':1}});
    }
    setTerritoryError(null);
    console.info(`[TravelEmpire] Rendered ${regions.features.length} territory regions`);
   }catch(e){
    console.error('[TravelEmpire] Territory overlay failed:',e);
    setTerritoryError(e instanceof Error?e.message:String(e));
   }
  };
  // Register first: style.load may fire between checking readiness and registering.
  instance.on('style.load',apply);
  if(instance.isStyleLoaded())apply();
  return()=>{disposed=true;instance.off('style.load',apply);};
 },[regions,claimedRegion,territoriesVisible,diagnosticVisible,ready]);
 // Road preview is static OSM data. It does NOT mark roads explored or change ownership.
 useEffect(()=>{
  const instance=map.current;if(!instance)return;
  let cancelled=false;
  const apply=()=>{
   if(cancelled||!instance.isStyleLoaded())return;
   if(instance.getLayer('road-network-preview'))instance.removeLayer('road-network-preview');
   if(instance.getSource('road-network-preview'))instance.removeSource('road-network-preview');
   if(!roadsVisible)return;
   const url=`${import.meta.env.BASE_URL??'/'}data/roads/preview.geojson`;
   fetch(url).then(async response=>{
    if(!response.ok)throw Error('Generate road preview using scripts/build_roads.py');
    const data=await response.json() as GeoJSON.FeatureCollection;
    if(data.type!=='FeatureCollection'||!Array.isArray(data.features))throw Error('Invalid road GeoJSON');
    if(cancelled||!instance.isStyleLoaded())return;
    if(instance.getLayer('road-network-preview'))instance.removeLayer('road-network-preview');
    if(instance.getSource('road-network-preview'))instance.removeSource('road-network-preview');
    instance.addSource('road-network-preview',{type:'geojson',data});
    instance.addLayer({id:'road-network-preview',type:'line',source:'road-network-preview',
      paint:{'line-color':'#2586c8','line-width':['interpolate',['linear'],['zoom'],8,0.6,13,2.2,17,4],'line-opacity':0.75}});
    setRoadStatus(`${data.features.length.toLocaleString()} OSM road segments (preview)`);
   }).catch(err=>{if(!cancelled)setRoadStatus(err instanceof Error?err.message:'Road preview unavailable');});
  };
  instance.on('style.load',apply);
  if(instance.isStyleLoaded())apply();
  return()=>{cancelled=true;instance.off('style.load',apply);};
 },[roadsVisible,ready,basemap]);

 // WorldFront's actual approach: geographic polygon union + world minus coverage.
 // Geometry is computed off the main thread; animation never triggers a rebuild.
 useEffect(()=>{
  const instance=map.current;if(!instance)return;
  let disposed=false;
  const remove=()=>{
   for(const id of ['service-coverage-line','service-coverage-fill','locked-territory-fill','exploration-fog'])if(instance.getLayer(id))instance.removeLayer(id);
   for(const id of ['service-coverage','locked-territory','exploration-fog-source'])if(instance.getSource(id))instance.removeSource(id);
  };
  if(!explorationVisible||!headquarters||!graph){
   if(instance.isStyleLoaded())remove();
   return;
  }
  const ids=new Set(exploredEdgeIds);
  const segments:Array<[[number,number],[number,number]]>=[];
  const seen=new Set<string>();
  for(const [from,edges] of graph.edges)for(const edge of edges){
   if(!ids.has(edge.id))continue;
   const unique=[from,edge.to].sort().join('|');if(seen.has(unique))continue;seen.add(unique);
   const a=graph.nodes.get(from),b=graph.nodes.get(edge.to);
   if(a&&b)segments.push([[a[0],a[1]],[b[0],b[1]]]);
  }
  const worker=new Worker(new URL('../simulation/explorationGeometry.worker.ts',import.meta.url),{type:'module'});
  const apply=(coverage:GeoJSON.FeatureCollection,locked:GeoJSON.FeatureCollection)=>{
   if(disposed||!instance.isStyleLoaded())return;
   // Remove legacy image/raster fog from v0.9.4/v0.9.5.
   if(instance.getLayer('exploration-fog'))instance.removeLayer('exploration-fog');
   if(instance.getSource('exploration-fog-source'))instance.removeSource('exploration-fog-source');
   const oldLocked=instance.getSource('locked-territory') as maplibregl.GeoJSONSource|undefined;
   const oldCoverage=instance.getSource('service-coverage') as maplibregl.GeoJSONSource|undefined;
   if(oldLocked&&oldCoverage){oldLocked.setData(locked);oldCoverage.setData(coverage);return;}
   remove();
   instance.addSource('locked-territory',{type:'geojson',data:locked});
   instance.addLayer({id:'locked-territory-fill',type:'fill',source:'locked-territory',paint:{'fill-color':'#ef7777','fill-opacity':0.24}});
   instance.addSource('service-coverage',{type:'geojson',data:coverage});
   instance.addLayer({id:'service-coverage-fill',type:'fill',source:'service-coverage',paint:{'fill-color':'#19cdb3','fill-opacity':0}});
   instance.addLayer({id:'service-coverage-line',type:'line',source:'service-coverage',paint:{'line-color':'#5eead4','line-width':2,'line-opacity':0.85}});
  };
  let lastResult:{coverage:GeoJSON.FeatureCollection;locked:GeoJSON.FeatureCollection}|null=null;
  const onStyle=()=>{if(lastResult)apply(lastResult.coverage,lastResult.locked)};
  instance.on('style.load',onStyle);
  worker.onmessage=(event:MessageEvent<{coverage?:GeoJSON.FeatureCollection;locked?:GeoJSON.FeatureCollection;error?:string}>)=>{
   if(disposed)return;
   if(event.data.error){console.error('[TravelEmpire] WorldFront exploration geometry:',event.data.error);return;}
   if(event.data.coverage&&event.data.locked){lastResult={coverage:event.data.coverage,locked:event.data.locked};apply(lastResult.coverage,lastResult.locked);}
  };
  worker.onerror=e=>console.error('[TravelEmpire] Exploration worker:',e.message);
  worker.postMessage({headquarters:[headquarters.lng,headquarters.lat],segments});
  return()=>{disposed=true;worker.terminate();instance.off('style.load',onStyle)};
 },[headquarters?.lng,headquarters?.lat,graph,explorationVisible,explorationSignature,ready,basemap]);
 const selectBasemap=(mode:Basemap)=>{if(mode===basemap){setSelectorOpen(false);return;}const style=styleFor(mode);if(!style||!map.current)return;setError(null);map.current.setStyle(style);setBasemap(mode);setSelectorOpen(false);};
 return <div className="map-container"><div className="map-canvas" ref={container} role="application" aria-label="Interactive world street map"/><div className="map-layer-control"><button className="map-layer-trigger" type="button" aria-expanded={selectorOpen} aria-controls="map-layer-options" onClick={()=>setSelectorOpen(v=>!v)}><Layers3 size={17}/> Map layers</button>{selectorOpen&&<div id="map-layer-options" className="map-layer-options" role="group" aria-label="Map appearance"><button type="button" className={basemap==='standard'?'active':''} aria-pressed={basemap==='standard'} onClick={()=>selectBasemap('standard')}><MapIcon size={17}/> Standard</button><button type="button" className={basemap==='satellite'?'active':''} aria-pressed={basemap==='satellite'} onClick={()=>selectBasemap('satellite')} disabled={!key}><Satellite size={17}/> Satellite</button><div className="map-layer-note"><label className="territory-toggle"><input type="checkbox" checked={territoriesVisible} onChange={e=>setTerritoriesVisible(e.target.checked)}/> Show ADM3 territories</label><label className="territory-toggle"><input type="checkbox" checked={diagnosticVisible} onChange={e=>setDiagnosticVisible(e.target.checked)}/> Highlight owned ADM3 boundary (diagnostic)</label><label className="territory-toggle"><input type="checkbox" checked={explorationVisible} onChange={e=>setExplorationVisible(e.target.checked)}/> Show WorldFront polygon exploration</label><div>{exploredEdgeIds.length.toLocaleString()} discovered road IDs · 500 m HQ seed</div><label className="territory-toggle"><input type="checkbox" checked={roadsVisible} onChange={e=>setRoadsVisible(e.target.checked)}/> Show OSM road preview</label><div>{roadStatus}</div><div>Passenger pickups and drop-offs must both be in explored areas. Fog clears along roads after completed journeys.</div></div></div>}</div>{!styleFor('standard')&&<div className="map-error" role="alert">Set VITE_MAPTILER_KEY in .env.local and restart the server.</div>}{error&&<div className="map-error" role="alert">{error}</div>}{territoryError&&<div className="map-error" role="alert">Territory overlay: {territoryError}</div>}{lookingUp&&<div className="map-loading" role="status">Identifying selected location…</div>}{!ready&&styleFor('standard')&&<div className="map-loading" role="status">Loading world map…</div>}</div>;
}
