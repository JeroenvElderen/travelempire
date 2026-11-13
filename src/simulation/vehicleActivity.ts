import type {Taxi} from './taxi';

export type VehicleActivity={icon:string;label:string};

/** Pure status mapping; badges update on simulation ticks, not animation frames. */
export function vehicleActivity(t:Taxi):VehicleActivity{
 if(t.ferryTrip?.stage==='boarding')return {icon:'⚓',label:'Driving to ferry terminal'};
 if(t.ferryTrip?.stage==='waiting')return {icon:'⛴️',label:'Waiting at harbour for scheduled ferry'};
 if(t.ferryTrip?.stage==='sailing')return {icon:'⛴️',label:'Travelling aboard ferry'};
 if(t.recoveryPending)return {icon:'🛻',label:'Awaiting roadside assistance'};
 if(t.status==='REFUELLING')return {icon:(t.vehicleFuel??'').toLowerCase().includes('electric')?'🔋':'⛽',label:'Refuelling / charging'};
 if(t.status==='SERVICING')return {icon:'🔧',label:'Maintenance'};
 if(t.restStopId){
  const hotel=t.restStopId.startsWith('hotel:');
  if(t.status==='PAUSED')return hotel?{icon:'💤',label:'Resting at hotel'}:{icon:'☕',label:'Taking a break'};
  return hotel?{icon:'🛏️',label:'Going to hotel'}:{icon:'🅿️',label:'Going to parking'};
 }
 if(t.refillRequested||t.refillDestination)return {icon:(t.vehicleFuel??'').toLowerCase().includes('electric')?'🔋':'⛽',label:'Going to fuel / charging station'};
 if(t.status==='TO_PICKUP')return {icon:'🚕',label:'Picking up passenger'};
 if(t.status==='TO_DROPOFF')return {icon:'👤',label:'Driving passenger'};
 if(t.status==='EXPLORING')return {icon:'🧭',label:'Exploring roads'};
 if(t.status==='RETURNING')return {icon:'↩️',label:'Travelling to destination'};
 if(t.status==='PAUSED')return {icon:'💤',label:'Paused'};
 if(t.kind==='recovery')return {icon:'🛻',label:'Roadside recovery'};
 return {icon:'⏳',label:t.kind==='explorer'?'Waiting to explore':'Waiting for job'};
}
