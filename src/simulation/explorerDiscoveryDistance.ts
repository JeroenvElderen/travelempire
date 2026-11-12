import type {Point} from './taxi';

/** Road tiles expand after initial graph publication. Count genuinely newly
 * discovered road length using the live tile index, with the driven geometry
 * as a fallback for roads absent from older cached index snapshots. */
export function registerNewRoadDistance(
 crossed:readonly string[],discovered:Set<string>,
 lengthById:Map<string,number>,edgeIds:readonly string[],
 path:readonly Point[],
):{kilometres:number;roads:number}{
 let metres=0,roads=0;
 for(const id of crossed){
  if(discovered.has(id))continue;
  discovered.add(id);
  roads++;
  let length=lengthById.get(id);
  if(length===undefined||!Number.isFinite(length)||length<=0){
   const i=edgeIds.indexOf(id);
   if(i>=0&&path[i]&&path[i+1]){
    const a=path[i],b=path[i+1];
    const lat=(a[1]+b[1])*Math.PI/360;
    length=111320*Math.hypot((b[0]-a[0])*Math.cos(lat),b[1]-a[1]);
    if(length>0&&Number.isFinite(length))lengthById.set(id,length);
   }
  }
  if(length&&Number.isFinite(length)&&length>0)metres+=length;
 }
 return{kilometres:metres/1000,roads};
}
