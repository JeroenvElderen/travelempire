/** Shared, deterministic timetable used by both ferry graphics and revenue.
 * An owned connection operates ONE boat: boarding, outbound crossing,
 * turnaround, return crossing, turnaround, repeat.
 */
export const FERRY_TURNAROUND_MINUTES=15;
const MINUTE_MS=60000;
export type FerryPhase={
 direction:'outbound'|'return';
 phase:'boarding'|'sailing'|'turnaround';
 progress:number;
 voyageIndex:number;
 completedCount:number;
 lastArrivalAt?:number;
};
export function ferryPhase(startGameMs:number,durationMinutes:number,nowGameMs:number,
 turnaroundMinutes=FERRY_TURNAROUND_MINUTES):FerryPhase{
 const duration=Math.max(10,Number.isFinite(durationMinutes)?durationMinutes:10)*MINUTE_MS;
 const turnaround=Math.max(0,turnaroundMinutes)*MINUTE_MS;
 const elapsed=Math.max(0,nowGameMs-startGameMs);
 if(elapsed<turnaround)return {direction:'outbound',phase:'boarding',progress:0,
  voyageIndex:0,completedCount:0};
 const sailingElapsed=elapsed-turnaround;
 const cycle=duration+turnaround;
 const voyageIndex=Math.floor(sailingElapsed/cycle);
 const into=sailingElapsed-voyageIndex*cycle;
 const completedCount=voyageIndex+(into>=duration?1:0);
 const direction=voyageIndex%2===0?'outbound':'return';
 const phase=into<duration?'sailing':'turnaround';
 const progress=phase==='sailing'?Math.min(1,into/duration):1;
 return {direction,phase,progress,voyageIndex,completedCount,
  lastArrivalAt:completedCount>0?startGameMs+turnaround+
   completedCount*duration+(completedCount-1)*turnaround:undefined};
}
export type FerryArrival={routeId:string;direction:'outbound'|'return';
 completedAt:number;durationMinutes:number;voyageIndex:number};
export function completedFerryArrivals(
 routes:readonly {id:string;durationMinutes:number}[],
 starts:Readonly<Record<string,number>>,
 lastPaid:Readonly<Record<string,number>>,
 gameNow:number
):{paid:Record<string,number>;arrivals:FerryArrival[];changed:boolean}{
 const paid={...lastPaid};
 const arrivals:FerryArrival[]=[];
 let changed=false;
 for(const route of routes){
  const start=starts[route.id];
  if(!Number.isFinite(start)||!Number.isFinite(gameNow))continue;
  const phase=ferryPhase(start,route.durationMinutes,gameNow);
  const previously=lastPaid[route.id];
  // Existing purchased routes migrate with zero paid crossings.
  const last=Number.isFinite(previously)?Math.max(0,previously):0;
  if(phase.completedCount<last){paid[route.id]=phase.completedCount;changed=true;continue;}
  if(phase.completedCount===last)continue;
  // At most one event per service update. A long time jump never invents
  // dozens of payments; older unobserved arrivals are marked as skipped.
  const index=phase.completedCount-1;
  arrivals.push({routeId:route.id,voyageIndex:index,
   direction:index%2===0?'outbound':'return',
   completedAt:phase.lastArrivalAt!,durationMinutes:route.durationMinutes});
  paid[route.id]=phase.completedCount;changed=true;
 }
 return {paid,arrivals,changed};
}
