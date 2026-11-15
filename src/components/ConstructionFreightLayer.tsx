import {useEffect,useRef} from 'react';
import maplibregl from 'maplibre-gl';
import type {GameClock} from '../simulation/gameClock';
import {GAME_TIME_SCALE} from '../simulation/gameClock';
import {freightPosition,freightStage,type ConstructionFreight} from '../constructionLogistics';
import {HOUR_MS} from '../internalConstruction';

type Cargo={id:string;siteName:string;freight:ConstructionFreight};
type Props={map:maplibregl.Map|null;shipments:readonly Cargo[];gameClock?:GameClock|null};
/** Only contracted construction deliveries appear: ordinary NPC traffic stays removed. */
export default function ConstructionFreightLayer({map,shipments,gameClock}:Props){
 const shipmentsRef=useRef(shipments);shipmentsRef.current=shipments;
 const clockRef=useRef(gameClock);clockRef.current=gameClock;
 useEffect(()=>{
  if(!map)return;
  let frame=0,lastDraw=0;
  const markers=new Map<string,{marker:maplibregl.Marker;kind:'ship'|'truck'}>();
  const release=(id:string)=>{markers.get(id)?.marker.remove();markers.delete(id);};
  const update=(timestamp:number)=>{
   frame=requestAnimationFrame(update);
   if(document.hidden||timestamp-lastDraw<110)return;
   lastDraw=timestamp;
   const clock=clockRef.current;
   if(!clock)return;
   const hour=(clock.epochMs+Math.max(0,Date.now()-clock.lastRealMs)*GAME_TIME_SCALE)/HOUR_MS;
   const active=new Set<string>();
   for(const cargo of shipmentsRef.current){
    const current=freightPosition(cargo.freight,hour);
    if(!current)continue;
    if(!map.getBounds().contains(current.point)){release(cargo.id);continue;}
    active.add(cargo.id);
    const existing=markers.get(cargo.id);
    if(existing&&existing.kind!==current.kind)release(cargo.id);
    let entry=markers.get(cargo.id);
    if(!entry){
     const node=document.createElement('div');
     node.style.cssText='width:34px;height:18px;pointer-events:auto;filter:drop-shadow(0 1px 2px #0008);';
     const img=document.createElement('img');
     img.src=(import.meta.env.BASE_URL??'/')+'assets/'+(current.kind==='ship'?'construction_cargo_ship.svg':'delivery_truck.svg');
     img.style.cssText='width:100%;height:100%;object-fit:contain;pointer-events:none;';
     img.alt='';
     node.appendChild(img);
     const marker=new maplibregl.Marker({element:node,anchor:'center',rotationAlignment:'map',
      pitchAlignment:'map'}).setLngLat(current.point).addTo(map);
     entry={marker,kind:current.kind};
     markers.set(cargo.id,entry);
    }
    const phase=freightStage(cargo.freight,hour);
    entry.marker.getElement().title=(current.kind==='ship'?'Construction cargo ship':'Construction delivery truck')+
     ' · '+cargo.siteName+' · '+(phase==='unloading'?'Unloading at harbour':phase==='trucking'?'Delivering to site':'Under way');
    entry.marker.setLngLat(current.point);
    // Both supplied top-down SVG assets face east at zero rotation.
    entry.marker.setRotation(current.bearing-90);
   }
   for(const id of markers.keys())if(!active.has(id))release(id);
  };
  frame=requestAnimationFrame(update);
  return()=>{cancelAnimationFrame(frame);for(const id of [...markers.keys()])release(id);};
 },[map]);
 return null;
}
