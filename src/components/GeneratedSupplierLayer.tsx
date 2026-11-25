import {useEffect,useRef} from 'react';
import maplibregl from 'maplibre-gl';
import {supplierStock,supplierVisible,SUPPLIER_PRODUCTION_HOURS,SUPPLIER_COLORS,type GeneratedSupplier} from '../generatedSuppliers';
import {COLLECTOR_NAMES} from '../resourceCollectors';
type Props={map:maplibregl.Map|null;suppliers?:Record<string,GeneratedSupplier>;enabled:boolean;now:number};
export default function GeneratedSupplierLayer({map,suppliers,enabled,now}:Props){
 const current=useRef({suppliers,now});current.current={suppliers,now};
 const updateRef=useRef<(()=>void)|null>(null);
 useEffect(()=>{
  if(!map||!enabled)return;
  const markers=new Map<string,maplibregl.Marker>();
  const update=()=>{
   const bounds=map.getBounds(),visible=new Set<string>();
   if(map.getZoom()>=11){
    const centre=map.getCenter();
    const list=Object.values(current.current.suppliers??{}).filter(s=>supplierVisible(s,current.current.now)&&bounds.contains(s.position))
     .sort((a,b)=>Math.hypot(a.position[0]-centre.lng,a.position[1]-centre.lat)-Math.hypot(b.position[0]-centre.lng,b.position[1]-centre.lat)).slice(0,120);
    for(const supplier of list){
     visible.add(supplier.id);let marker=markers.get(supplier.id);
     if(!marker){
      const element=document.createElement('button');element.type='button';
      element.style.cssText='width:20px;height:20px;border:2px solid white;border-radius:5px;box-shadow:0 1px 5px #0008;color:white;font-size:12px;display:grid;place-items:center;padding:0;cursor:pointer;';
      element.textContent='▣';
      element.addEventListener('click',event=>event.stopPropagation());
      marker=new maplibregl.Marker({element,anchor:'center'}).setLngLat(supplier.position).addTo(map);
      markers.set(supplier.id,marker);
     }
     const stock=supplierStock(supplier,current.current.now),element=marker.getElement();
     element.style.background=SUPPLIER_COLORS[supplier.part];
     const title=supplier.name+' · '+COLLECTOR_NAMES[supplier.part]+' · '+stock+'/'+supplier.capacity+' units · +2 every '+SUPPLIER_PRODUCTION_HOURS[supplier.part]+' game hours';
     element.title=title;element.setAttribute('aria-label',title);
     const popup=document.createElement('div');popup.textContent=title;
     const existing=marker.getPopup();if(existing)existing.setDOMContent(popup);else marker.setPopup(new maplibregl.Popup({offset:14}).setDOMContent(popup));
    }
   }
   for(const [id,marker] of markers)if(!visible.has(id)){marker.remove();markers.delete(id);}
  };
  updateRef.current=update;update();map.on('moveend',update);
  return()=>{updateRef.current=null;map.off('moveend',update);markers.forEach(m=>m.remove());};
 },[map,enabled]);
 useEffect(()=>{updateRef.current?.();},[suppliers,now]);
 return null;
}
