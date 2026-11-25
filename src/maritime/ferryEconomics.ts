/** Shared ferry ticket demand and operating costs for live settlements and forecasts.
 * These are bounded gameplay estimates, not real ferry passenger statistics. */
import {greekDemandPeriod} from '../simulation/passengerPlaces';
export const FERRY_PASSENGER_CAPACITY=90;
const cents=(n:number)=>Math.round(n*100)/100;
const safeDuration=(minutes:number)=>Math.max(10,Number.isFinite(minutes)?minutes:10);
export const standardFerryFare=(minutes:number)=>cents(Math.min(100,4+safeDuration(minutes)*.16));

/** Demand is based on departure, when customers choose to sail, rather than
 * the time the boat happens to reach its destination. All times use Athens
 * local time, including daylight saving. The existing operating cost is
 * retained and no extra cash is posted by forecasts. */
export function ferryVoyageEconomics(durationMinutes:number,departureAt:number,configuredFare?:number){
 const duration=safeDuration(durationMinutes);
 const {hour,month,weekend}=greekDemandPeriod(Number.isFinite(departureAt)?departureAt:0);
 const daily=(hour>=7&&hour<10)||(hour>=16&&hour<20)?1.45:(hour>=22||hour<6)?.35:1;
 const season=month>=6&&month<=9?1.25:month===4||month===5||month===10?1.05:.85;
 const weekendFactor=weekend&&hour>=7&&hour<22?1.1:1;
 const standardFare=standardFerryFare(duration);
 const ticket=typeof configuredFare==='number'&&Number.isFinite(configuredFare)&&configuredFare>=1&&configuredFare<=100?configuredFare:standardFare;
 const ratio=ticket/standardFare;
 // Discounting attracts more customers up to capacity; steep premiums
 // face stronger price resistance instead of guaranteeing higher revenue.
 const multiplier=Math.min(1.8,Math.pow(ratio,ratio>1?-1.35:-.75));
 const passengers=Math.min(FERRY_PASSENGER_CAPACITY,Math.max(0,Math.round((12+Math.min(55,duration*.22))*daily*season*weekendFactor*multiplier)));
 const revenue=cents(passengers*ticket),cost=cents(24+duration*.9);
 return {passengers,ticket,revenue,cost,net:cents(revenue-cost),capacity:FERRY_PASSENGER_CAPACITY,
  occupancy:passengers/FERRY_PASSENGER_CAPACITY};
}
