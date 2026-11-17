/** Phase 5: bounded passenger and traffic reporting.
 *
 * These are actual fare-settlement events, NOT open-job quotes or a reconstruction
 * of the truncated recent-transactions list. "Estimated direct costs" are the
 * worker's original booking estimate; authoritative P&L stays in taxiAnalytics.
 * Traffic delay is modelled against free-flow travel time at boarding; it is
 * NOT asserted to be GPS-observed congestion history.
 */
import type {PassengerKind} from './passengerProfiles';
import type {PassengerPlaceKind} from './passengerPlaces';
import type {Point,PassengerRequest} from './taxi';
import type {TaxiAnalyticsRange} from './taxiAnalytics';

export type TransportSlice={
 trips:number;revenue:number;estimatedDirectCosts:number;
 costQuotedTrips:number;satisfactionTotal:number;satisfactionCount:number;
 estimatedTrafficDelaySeconds:number;trafficDelayTrips:number;
};
export type TransportAreaSlice=TransportSlice&{name:string};
export type TransportDay={
 categories:Record<string,TransportSlice>;
 areas:Record<string,TransportAreaSlice>;
 missed:number;missedByCategory:Record<string,number>;
 reroutes:number;estimatedSecondsSaved:number;
};
export type TransportAnalytics={
 version:1;days:Record<string,TransportDay>;
 recentPaidIds:string[];recentMissedIds:string[];
};
export type TransportFareEvent={
 id:string;fare:number;pickup:Point;
 passengerType?:PassengerKind;pickupPlaceKind?:PassengerPlaceKind;
 pickupPlaceName?:string;estimatedDirectCost?:number;
 satisfaction?:number;estimatedTrafficDelaySeconds?:number;
};
export type MissedTransportRequest=Pick<PassengerRequest,'id'|'passengerType'>;
export const TRANSPORT_MAX_DAYS=90;
const KEY_LIMIT=512;
const AREA_LIMIT=40;
const validDay=(day:string)=>/^\d{4}-\d{2}-\d{2}$/.test(day);
const finiteNonnegative=(x:unknown):x is number=>typeof x==='number'&&Number.isFinite(x)&&x>=0;
const finitePositive=(x:unknown):x is number=>finiteNonnegative(x)&&x>0;
const blankSlice=():TransportSlice=>({
 trips:0,revenue:0,estimatedDirectCosts:0,costQuotedTrips:0,
 satisfactionTotal:0,satisfactionCount:0,
 estimatedTrafficDelaySeconds:0,trafficDelayTrips:0,
});
const blankDay=():TransportDay=>({
 categories:{},areas:{},missed:0,missedByCategory:{},
 reroutes:0,estimatedSecondsSaved:0,
});
export const emptyTransportAnalytics=():TransportAnalytics=>({
 version:1,days:{},recentPaidIds:[],recentMissedIds:[],
});
function mutateDay(state:TransportAnalytics|undefined,day:string):TransportAnalytics|null{
 if(!validDay(day))return null;
 const existing=state?.version===1?state:emptyTransportAnalytics();
 const days={...existing.days,[day]:{
  ...blankDay(),...(existing.days[day]??{}),
  categories:{...(existing.days[day]?.categories??{})},
  areas:{...(existing.days[day]?.areas??{})},
  missedByCategory:{...(existing.days[day]?.missedByCategory??{})},
 }};
 const keys=Object.keys(days).sort();
 for(const old of keys.slice(0,-TRANSPORT_MAX_DAYS))delete days[old];
 return {...existing,days};
}
export function transportAreaFor(pickup:Point,name?:string):{id:string;name:string}{
 if(!pickup||!Number.isFinite(pickup[0])||!Number.isFinite(pickup[1]))
  return {id:'unknown',name:'Unknown pickup area'};
 // One regional cell is roughly 8–11 km across in Greece; it is a
 // reporting bucket, not a new road network or a simulated service area.
 const lon=Math.floor(pickup[0]*10)/10,lat=Math.floor(pickup[1]*10)/10;
 return {id:lon.toFixed(1)+','+lat.toFixed(1),
  name:name?.trim().slice(0,64)||'Region '+lat.toFixed(1)+'°N, '+lon.toFixed(1)+'°E'};
}
function addFareSlice(previous:TransportSlice|undefined,event:TransportFareEvent):TransportSlice{
 const item={...(previous??blankSlice())};
 item.trips++;
 item.revenue+=event.fare;
 if(finiteNonnegative(event.estimatedDirectCost)){
  item.estimatedDirectCosts+=event.estimatedDirectCost;
  item.costQuotedTrips++;
 }
 if(finiteNonnegative(event.satisfaction)){
  item.satisfactionTotal+=Math.min(100,event.satisfaction);
  item.satisfactionCount++;
 }
 if(finiteNonnegative(event.estimatedTrafficDelaySeconds)){
  item.estimatedTrafficDelaySeconds+=event.estimatedTrafficDelaySeconds;
  item.trafficDelayTrips++;
 }
 return item;
}
export function recordCompletedTransportFares(
 state:TransportAnalytics|undefined,day:string,events:readonly TransportFareEvent[],
):TransportAnalytics|undefined{
 if(!events.length)return state;
 const next=mutateDay(state,day);
 if(!next)return state;
 const paidIds=new Set(next.recentPaidIds);
 const target=next.days[day];
 let added=false;
 for(const event of events){
  if(!event.id||paidIds.has(event.id)||!finitePositive(event.fare))continue;
  paidIds.add(event.id);added=true;
  const category=event.passengerType??'unclassified';
  target.categories[category]=addFareSlice(target.categories[category],event);
  const area=transportAreaFor(event.pickup,event.pickupPlaceName);
  const key=target.areas[area.id]||Object.keys(target.areas).length<AREA_LIMIT?
   area.id:'other';
  const old=target.areas[key];
  target.areas[key]={...addFareSlice(old,event),
   name:key==='other'?'Other discovered areas':old?.name??area.name};
 }
 if(!added)return state;
 next.recentPaidIds=[...paidIds].slice(-KEY_LIMIT);
 return next;
}
export function recordExpiredTransportRequests(
 state:TransportAnalytics|undefined,day:string,requests:readonly MissedTransportRequest[],
):TransportAnalytics|undefined{
 if(!requests.length)return state;
 const next=mutateDay(state,day);
 if(!next)return state;
 const seen=new Set(next.recentMissedIds);
 let count=0;
 for(const request of requests){
  if(!request.id||seen.has(request.id))continue;
  seen.add(request.id);count++;
  const type=request.passengerType??'unclassified';
  next.days[day].missedByCategory[type]=(next.days[day].missedByCategory[type]??0)+1;
 }
 if(!count)return state;
 next.days[day].missed+=count;
 next.recentMissedIds=[...seen].slice(-KEY_LIMIT);
 return next;
}
export function recordTransportReroute(
 state:TransportAnalytics|undefined,day:string,savedSeconds:number,
):TransportAnalytics|undefined{
 if(!finitePositive(savedSeconds))return state;
 const next=mutateDay(state,day);
 if(!next)return state;
 next.days[day].reroutes++;
 next.days[day].estimatedSecondsSaved+=savedSeconds;
 return next;
}
export type TransportCategoryRow=TransportSlice&{
 id:string;name:string;missed:number;estimatedDirectContribution:number|null;
 averageSatisfaction:number|null;
};
export type TransportAreaRow=TransportAreaSlice&{
 id:string;estimatedDirectContribution:number|null;
 averageSatisfaction:number|null;
};
export type TransportReport={
 range:TaxiAnalyticsRange;fromDay:string;toDay:string;
 trips:number;revenue:number;missed:number;
 estimatedDirectCosts:number;estimatedDirectContribution:number|null;
 costQuotedTrips:number;averageSatisfaction:number|null;
 estimatedTrafficDelaySeconds:number;trafficDelayTrips:number;
 reroutes:number;estimatedSecondsSaved:number;
 categories:TransportCategoryRow[];areas:TransportAreaRow[];
};
const labels:Record<string,string>={
 commuter:'Commuters',business:'Business',tourist:'Tourists',
 family:'Families & groups',nightlife:'Nightlife',local:'Local residents',
 unclassified:'Older / unclassified',
};
const summary=(s:TransportSlice)=>({
 estimatedDirectContribution:s.costQuotedTrips===s.trips&&s.trips>0?
  s.revenue-s.estimatedDirectCosts:null,
 averageSatisfaction:s.satisfactionCount>0?
  Math.round(s.satisfactionTotal/s.satisfactionCount):null,
});
const accumulate=(dest:TransportSlice,source:TransportSlice)=>{
 dest.trips+=source.trips;dest.revenue+=source.revenue;
 dest.estimatedDirectCosts+=source.estimatedDirectCosts;
 dest.costQuotedTrips+=source.costQuotedTrips;
 dest.satisfactionTotal+=source.satisfactionTotal;
 dest.satisfactionCount+=source.satisfactionCount;
 dest.estimatedTrafficDelaySeconds+=source.estimatedTrafficDelaySeconds;
 dest.trafficDelayTrips+=source.trafficDelayTrips;
};
export function transportAnalyticsReport(
 state:TransportAnalytics|undefined,gameNow:number,range:TaxiAnalyticsRange,
):TransportReport{
 const at=Number.isFinite(gameNow)?gameNow:Date.now();
 const days=range==='today'?1:range==='7d'?7:30;
 const date=new Date(at),midnight=Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),date.getUTCDate());
 const fromDay=new Date(midnight-(days-1)*86400000).toISOString().slice(0,10);
 const toDay=date.toISOString().slice(0,10);
 const categories=new Map<string,{slice:TransportSlice;missed:number}>();
 const areas=new Map<string,TransportAreaSlice>();
 const totals=blankSlice();let missed=0,reroutes=0,estimatedSecondsSaved=0;
 for(const [day,data] of Object.entries(state?.version===1?state.days:{})){
  if(day<fromDay||day>toDay)continue;
  missed+=data.missed??0;reroutes+=data.reroutes??0;
  estimatedSecondsSaved+=data.estimatedSecondsSaved??0;
  for(const [key,cell] of Object.entries(data.categories??{})){
   const current=categories.get(key)??{slice:blankSlice(),missed:0};
   accumulate(current.slice,cell);categories.set(key,current);
   accumulate(totals,cell);
  }
  for(const [key,count] of Object.entries(data.missedByCategory??{})){
   const current=categories.get(key)??{slice:blankSlice(),missed:0};
   current.missed+=count;categories.set(key,current);
  }
  for(const [key,cell] of Object.entries(data.areas??{})){
   let existing=areas.get(key);
   if(!existing){existing={...blankSlice(),name:cell.name};areas.set(key,existing);}
   accumulate(existing,cell);
  }
 }
 return {range,fromDay,toDay,trips:totals.trips,revenue:totals.revenue,
  missed,estimatedDirectCosts:totals.estimatedDirectCosts,
  estimatedDirectContribution:summary(totals).estimatedDirectContribution,
  costQuotedTrips:totals.costQuotedTrips,
  averageSatisfaction:summary(totals).averageSatisfaction,
  estimatedTrafficDelaySeconds:totals.estimatedTrafficDelaySeconds,
  trafficDelayTrips:totals.trafficDelayTrips,reroutes,estimatedSecondsSaved,
  categories:[...categories.entries()].map(([id,v])=>({
   id,name:labels[id]??id,...v.slice,missed:v.missed,...summary(v.slice),
  })).sort((a,b)=>b.revenue-a.revenue||b.missed-a.missed),
  areas:[...areas.entries()].map(([id,v])=>({id,...v,...summary(v)}))
   .sort((a,b)=>(b.estimatedDirectContribution??b.revenue)-
    (a.estimatedDirectContribution??a.revenue)).slice(0,20),
 };
}
