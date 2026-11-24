import {useEffect,useRef} from 'react';
import maplibregl from 'maplibre-gl';
import {collectorPosition,COLLECTOR_NAMES,COLLECTOR_MODELS,type CollectorVehicle} from '../resourceCollectors';
import {GAME_TIME_SCALE,type GameClock} from '../simulation/gameClock';
type Props={map:maplibregl.Map|null;vehicles:readonly CollectorVehicle[];gameClock?:GameClock|null};
export default function ResourceCollectorLayer({map,vehicles,gameClock}:Props){
 const vehiclesRef=useRef(vehicles);vehiclesRef.current=vehicles;
 const clockRef=useRef(gameClock);clockRef.current=gameClock;
 useEffect(()=>{
  if(!map)return;
  const markers=new Map<string,maplibregl.Marker>();
  const update=()=>{
   const clock=clockRef.current,visible=new Set<string>();
   if(clock)for(const vehicle of vehiclesRef.current){
    const trip=vehicle.trip;if(!trip)continue;
    const now=Math.min(trip.endsAt,clock.epochMs+Math.max(0,Date.now()-clock.lastRealMs)*GAME_TIME_SCALE);
    const point=collectorPosition(trip,now);
    if(!map.getBounds().contains(point))continue;
    visible.add(vehicle.id);
    let marker=markers.get(vehicle.id);
    if(!marker){
     const element=document.createElement('div');
     element.style.cssText='width:44px;height:24px;border-radius:5px;background:#e6a126;border:2px solid #fff;box-shadow:0 2px 5px #0008;display:grid;place-items:center;font-size:16px;pointer-events:auto;';
     element.textContent=vehicle.model==='heavy'?'🚛':vehicle.model==='offroad'?'🛻':'🚚';
     marker=new maplibregl.Marker({element,anchor:'center'}).setLngLat(point).addTo(map);
     markers.set(vehicle.id,marker);
    }
    marker.setLngLat(point);
    marker.getElement().title=COLLECTOR_MODELS[vehicle.model].name+' · '+COLLECTOR_NAMES[trip.part]+' · '+trip.quantity+' units';
   }
   for(const [id,marker] of markers)if(!visible.has(id)){marker.remove();markers.delete(id);}
  };
  update();const timer=window.setInterval(update,150);
  return()=>{window.clearInterval(timer);markers.forEach(marker=>marker.remove());};
 },[map]);
 return null;
}
