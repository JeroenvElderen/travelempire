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

/** Bounded candidate window for route-finding. Search nearby unlocked ports as
 * well as the current destination, so an island or missing road tile cannot
 * strand a POI scout when a different harbour is reachable.
 * The worker chooses the final destination using directed road distance. */
export function poiRouteCandidates(
 taxis:readonly Taxi[],ports:readonly FerryPort[],unlocked:ReadonlySet<string>,
 perExplorer=18,
):Array<{vehicleId:string;portId:string;point:Point}>{
 const available=ports.filter(p=>!unlocked.has(p.id));
 const scouts=taxis.filter(t=>t.kind==='explorer'&&t.explorerRole==='poi'&&!t.ferryTrip);
 const assigned=new Set(scouts.map(t=>t.poiTargetId).filter((id):id is string=>!!id));
 const result:Array<{vehicleId:string;portId:string;point:Point}>=[];
 for(const scout of scouts){
  const own=available.find(p=>p.id===scout.poiTargetId);
  // Do not steal destinations that another scout is already working toward.
  const choices=available.filter(p=>!assigned.has(p.id)||p.id===scout.poiTargetId)
   .sort((a,b)=>distance(scout.position,a.roadAccess??a.position)-
     distance(scout.position,b.roadAccess??b.position));
  // Combine nearby and progressively more distant harbours. The nearest
  // ports may be on islands with no road route from the current landmass.
  // A geographically farther mainland harbour can be the first reachable one.
  const selected:FerryPort[]=[];
  if(own)selected.push(own);
  const remaining=choices.filter(p=>p.id!==own?.id);
  const immediate=Math.min(8,Math.max(0,perExplorer-selected.length));
  selected.push(...remaining.slice(0,immediate));
  const ranks=[11,16,23,33,48,70,100,145,210,300];
  for(const rank of ranks){
   if(selected.length>=perExplorer)break;
   const candidate=remaining[rank];
   if(candidate&&!selected.includes(candidate))selected.push(candidate);
  }
  // Short lists contain no distant ranks; fill leftover capacity with nearby
  // unassigned ports so every game region can still be explored.
  for(const candidate of remaining){
   if(selected.length>=perExplorer)break;
   if(!selected.includes(candidate))selected.push(candidate);
  }
  for(const port of selected)result.push({vehicleId:scout.id,portId:port.id,
   point:port.roadAccess??port.position});
 }
 return result;
}
