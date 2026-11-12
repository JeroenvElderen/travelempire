import {meters,type Taxi} from './taxi';

export type LiveJobMeter={
 phase:'pickup'|'passenger';
 earnedSoFar:number;
 expectedFare:number;
 drivenKm:number;
 totalKm:number;
 remainingKm:number;
 progress:number;
};

/** Display-only estimate. Passenger revenue is booked by tickTaxi at dropoff.
 * Keep pickup travel separate so it never earns a passenger fare.
 * Older saves may lack the new distance fields; derive progress from the
 * current road route until their next job starts.
 */
export function liveJobMeter(t:Taxi):LiveJobMeter|null{
 if(t.kind==='explorer'||t.kind==='recovery'||
   (t.status!=='TO_PICKUP'&&t.status!=='TO_DROPOFF'))return null;
 const pickup=t.status==='TO_PICKUP';
 const path=t.path??[];
 const routeMeters=path.slice(1).reduce((total,p,i)=>total+meters(path[i],p),0);
 const totalMeters=Math.max(0,pickup?routeMeters:
  (t.jobDistanceMeters&&t.jobDistanceMeters>0?t.jobDistanceMeters:routeMeters));
 const completedLegs=path.slice(1,Math.min(path.length,Math.max(0,t.leg)+1))
  .reduce((total,p,i)=>total+meters(path[i],p),0);
 const travelled=Math.min(totalMeters,Math.max(0,pickup?
  completedLegs+(t.distanceIntoLeg??0):
  t.jobDrivenMeters??completedLegs+(t.distanceIntoLeg??0)));
 // Edge lengths and the old request's quotation sometimes disagree.
 // Derive remaining kilometres from the ACTIVE road path, so the meter
 // cannot finish early while the vehicle still has edges to traverse.
 let routeRemaining=0;
 for(let leg=Math.max(0,t.leg);leg<path.length-1;leg++){
  const segment=meters(path[leg],path[leg+1]);
  routeRemaining+=Math.max(0,segment-(leg===t.leg?(t.distanceIntoLeg??0):0));
 }
 const accurateTotal=pickup?totalMeters:Math.max(totalMeters,travelled+routeRemaining);
 // A 100% bar means the ride has already been settled; TO_DROPOFF is
 // explicitly still in progress. The panel vanishes on confirmed arrival.
 const progress=accurateTotal>0?Math.min(pickup?1:0.995,travelled/accurateTotal):0;
 const expectedFare=Math.max(0,t.jobFareTotal??t.fare??0);
 return {phase:pickup?'pickup':'passenger',
  earnedSoFar:pickup?0:Math.round(expectedFare*progress*100)/100,
  expectedFare,drivenKm:travelled/1000,totalKm:accurateTotal/1000,
  remainingKm:Math.max(0,accurateTotal-travelled)/1000,progress};
}
