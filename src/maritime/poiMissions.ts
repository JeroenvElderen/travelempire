import type {Taxi,Point} from '../simulation/taxi';
import type {FerryPort} from './ferries';

export type PoiHarbourMission={vehicleId:string;portId:string;point:Point};
/** Keep a port for each POI explorer until it is earned, so streaming road
 * packages and dispatcher retries cannot randomly change the destination.
 * Each available destination is reserved by only one explorer at a time.
 * Road routing (not this initial geographic ranking) determines driving. */
export function assignPoiHarbours(
 taxis:readonly Taxi[],ports:readonly FerryPort[],unlocked:ReadonlySet<string>,
):{taxis:Taxi[];missions:PoiHarbourMission[];changed:boolean}{
 const candidates=ports.filter(p=>!unlocked.has(p.id));
 const used=new Set<string>();
 let changed=false;
 const result=taxis.map(t=>{
  if(t.kind!=='explorer'||t.explorerRole!=='poi')return t;
  const saved=candidates.find(p=>p.id===t.poiTargetId);
  const chosen=saved&&!used.has(saved.id)?saved:
   [...candidates].filter(p=>!used.has(p.id)).sort((a,b)=>
    distance(t.position,a.roadAccess??a.position)-distance(t.position,b.roadAccess??b.position))[0];
  if(chosen)used.add(chosen.id);
  if((chosen?.id??undefined)===t.poiTargetId&&
     (chosen?.name??undefined)===t.poiTargetName)return t;
  changed=true;
  return {...t,poiTargetId:chosen?.id,poiTargetName:chosen?.name};
 });
 const missions: PoiHarbourMission[]=result.flatMap(t=>{
  if(t.kind!=='explorer'||t.explorerRole!=='poi'||!t.poiTargetId)return [];
  const p=candidates.find(p=>p.id===t.poiTargetId);
  return p?[{vehicleId:t.id,portId:p.id,point:p.roadAccess??p.position}]:[];
 });
 return {taxis:result,missions,changed};
}
function distance(a:Point,b:Point):number{
 const cos=Math.cos((a[1]+b[1])*Math.PI/360);
 return Math.hypot((a[0]-b[0])*cos,a[1]-b[1]);
}
