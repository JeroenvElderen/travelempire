import {useEffect,useRef} from 'react';
import maplibregl from 'maplibre-gl';
import {collectorMotion,COLLECTOR_NAMES,COLLECTOR_MODELS,type CollectorVehicle} from '../resourceCollectors';
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
    const motion=collectorMotion(trip,now),point=motion.position;
    if(!map.getBounds().contains(point))continue;
    visible.add(vehicle.id);
    let marker=markers.get(vehicle.id);
    if(!marker){
     const element=document.createElement('div');
     element.style.cssText='width:20px;height:38px;pointer-events:auto;filter:drop-shadow(0 1px 2px #0008);';
     const image=document.createElement('img');image.src=import.meta.env.BASE_URL+'assets/collector-truck.png';image.alt='';image.draggable=false;image.style.cssText='width:100%;height:100%;object-fit:contain;display:block;';element.appendChild(image);
     marker=new maplibregl.Marker({element,anchor:'center',rotationAlignment:'map',pitchAlignment:'map'}).setLngLat(point).addTo(map);
     markers.set(vehicle.id,marker);
    }
    marker.setLngLat(point).setRotation(motion.heading);
    marker.getElement().title=COLLECTOR_MODELS[vehicle.model].name+' · '+COLLECTOR_NAMES[trip.part]+' · '+trip.quantity+' units · '+Math.round(motion.speedKph)+' km/h';
   }
   for(const [id,marker] of markers)if(!visible.has(id)){marker.remove();markers.delete(id);}
  };
  update();const timer=window.setInterval(update,50);
  return()=>{window.clearInterval(timer);markers.forEach(marker=>marker.remove());};
 },[map]);
 return null;
}
