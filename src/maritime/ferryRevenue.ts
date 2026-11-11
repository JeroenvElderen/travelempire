/** One income event per completed one-way sailing. All time values use
 * TravelEmpire's simulated game clock, never the browser wall clock.
 */
export type FerryCrossing={routeId:string;completedAt:number;durationMinutes:number};
export type FerryRevenueSettlement={departures:Record<string,number>;crossings:FerryCrossing[];changed:boolean};
const MINUTE=60000;
export function settleFerryCrossings(
 routes:readonly {id:string;durationMinutes:number}[],
 previous:Readonly<Record<string,number>>,
 gameNow:number,
 maxCatchupPerRoute=48
):FerryRevenueSettlement{
 const departures={...previous};
 const crossings:FerryCrossing[]=[];
 let changed=false;
 if(!Number.isFinite(gameNow))return {departures,crossings,changed};
 for(const route of routes){
  const duration=Math.max(10,route.durationMinutes)*MINUTE;
  if(!Number.isFinite(duration))continue;
  const prior=departures[route.id];
  // For an existing purchased route with no settlement marker, start now.
  // Never backpay hourly fictional voyages from before this feature existed.
  if(!Number.isFinite(prior)||prior>gameNow){
   departures[route.id]=gameNow;changed=true;continue;
  }
  const count=Math.min(Math.max(0,maxCatchupPerRoute),Math.floor((gameNow-prior)/duration));
  if(count===0)continue;
  for(let i=1;i<=count;i++)crossings.push({
   routeId:route.id,completedAt:prior+i*duration,durationMinutes:duration/MINUTE
  });
  departures[route.id]=prior+count*duration;changed=true;
 }
 return {departures,crossings,changed};
}
