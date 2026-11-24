import {useEffect,useRef} from 'react';
import maplibregl from 'maplibre-gl';
import {collectorPosition,COLLECTOR_NAMES,type CollectorTrip} from '../resourceCollectors';
import {GAME_TIME_SCALE,type GameClock} from '../simulation/gameClock';
type Props={map:maplibregl.Map|null;trip?:CollectorTrip;gameClock?:GameClock|null};
export default function ResourceCollectorLayer({map,trip,gameClock}:Props){
 const tripRef=useRef(trip);tripRef.current=trip;
 const clockRef=useRef(gameClock);clockRef.current=gameClock;
 useEffect(()=>{
  if(!map)return;
  let marker:maplibregl.Marker|undefined;
  const update=()=>{
   const current=tripRef.current,clock=clockRef.current;
   if(!current||!clock){marker?.remove();marker=undefined;return;}
   const now=Math.min(current.endsAt,clock.epochMs+Math.max(0,Date.now()-clock.lastRealMs)*GAME_TIME_SCALE);
   const point=collectorPosition(current,now);
   if(!map.getBounds().contains(point)){marker?.remove();marker=undefined;return;}
   if(!marker){
    const element=document.createElement('div');
    element.style.cssText='width:44px;height:24px;border-radius:5px;background:#e6a126;border:2px solid #fff;box-shadow:0 2px 5px #0008;display:grid;place-items:center;font-size:16px;pointer-events:auto;';
    element.textContent='🚚';
    marker=new maplibregl.Marker({element,anchor:'center'}).setLngLat(point).addTo(map);
   }
   marker.setLngLat(point);
   marker.getElement().title='Resource collector · '+COLLECTOR_NAMES[current.part];
  };
  update();const timer=window.setInterval(update,150);
  return()=>{window.clearInterval(timer);marker?.remove();};
 },[map]);
 return null;
}
