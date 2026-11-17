/** Phase 3: location-driven passenger demand on the real discovered OSM network.
 * Place coordinates are influence centres, NEVER synthetic pickup nodes or roads.
 * Ferry terminals and live hotels are provided by the existing simulation.
 * Only an already-discovered passenger stop near a place can receive a request.
 */
import {meters,type Point} from './taxi';

export type PassengerPlaceKind='airport'|'harbour'|'hotel'|'business'|'nightlife'|'residential';
export type PassengerDemandPlace={
 id:string;name:string;kind:PassengerPlaceKind;position:Point;
};

/** Verified airport reference locations (lon, lat); actual taxi stops must
 * separately qualify on discovered OSM road nodes within the access radius.
 * Coordinates from Greek airport reference datasets (ATH, SKG, HER, CHQ, RHO,
 * CFU and JTR). No aircraft or flight schedules are simulated.
 */
export const GREEK_AIRPORT_DEMAND_PLACES:readonly PassengerDemandPlace[]=[
 {id:'airport:ATH',name:'Athens International Airport',kind:'airport',position:[23.9445,37.9364]},
 {id:'airport:SKG',name:'Thessaloniki Airport',kind:'airport',position:[22.9700,40.5193]},
 {id:'airport:HER',name:'Heraklion Airport',kind:'airport',position:[25.1803,35.3397]},
 {id:'airport:CHQ',name:'Chania Airport',kind:'airport',position:[24.1507,35.5312]},
 {id:'airport:RHO',name:'Rhodes Airport',kind:'airport',position:[28.0862,36.4054]},
 {id:'airport:CFU',name:'Corfu Airport',kind:'airport',position:[19.9122,39.6014]},
 {id:'airport:JTR',name:'Santorini Airport',kind:'airport',position:[25.4786,36.4000]},
];

/** Urban district centres, not building-by-building POI classifications.
 * Proximity influences the probability of a booking; valid pickup roads
 * remain the same discoverable OSM nodes as in the existing game.
 */
export const GREEK_DISTRICT_DEMAND_PLACES:readonly PassengerDemandPlace[]=[
 {id:'district:athens-center',name:'Athens city centre',kind:'business',position:[23.735,37.975]},
 {id:'district:thessaloniki-center',name:'Thessaloniki city centre',kind:'business',position:[22.943,40.632]},
 {id:'district:patras-center',name:'Patras city centre',kind:'business',position:[21.735,38.247]},
 {id:'district:heraklion-center',name:'Heraklion city centre',kind:'business',position:[25.1335,35.339]},
 {id:'district:larissa-center',name:'Larissa city centre',kind:'business',position:[22.418,39.640]},
 {id:'district:athens-gazi',name:'Athens Gazi',kind:'nightlife',position:[23.715,37.979]},
 {id:'district:thessaloniki-ladadika',name:'Thessaloniki Ladadika',kind:'nightlife',position:[22.941,40.635]},
 {id:'district:chania-old-harbour',name:'Chania Old Harbour',kind:'nightlife',position:[24.018,35.518]},
 {id:'district:rhodes-old-town',name:'Rhodes Old Town',kind:'nightlife',position:[28.227,36.444]},
];

/** A tight, real road-access area around a location. Airport runways are
 * never taxi pickup points; the nearest suitable discovered road is used.
 */
export function passengerPlaceAccessRadius(kind:PassengerPlaceKind):number{
 switch(kind){
  case 'airport':return 1400;
  case 'harbour':return 650;
  case 'hotel':return 420;
  case 'business':return 1100;
  case 'nightlife':return 850;
  case 'residential':return 500;
 }
}
const athensTime=new Intl.DateTimeFormat('en-GB',{
 timeZone:'Europe/Athens',hour:'2-digit',month:'numeric',weekday:'short',hourCycle:'h23',
});
export function greekDemandPeriod(at:number):{hour:number;month:number;weekend:boolean}{
 const parts=athensTime.formatToParts(new Date(at));
 const get=(t:string)=>parts.find(p=>p.type===t)?.value??'';
 return {hour:Number(get('hour')),month:Number(get('month')),
  weekend:['Sat','Sun'].includes(get('weekday'))};
}
/** Relative origin demand at a place, by Greece-local clock. A zero weight
 * suppresses the venue rather than fabricating opening hours or timetable data.
 */
export function passengerPlaceWeight(kind:PassengerPlaceKind,at:number):number{
 const {hour,month,weekend}=greekDemandPeriod(at);
 const rush=!weekend&&(hour>=7&&hour<10||hour>=16&&hour<20);
 const late=hour>=21||hour<4;
 switch(kind){
  case 'airport':return 12;
  case 'harbour':return hour>=6&&hour<23?(month>=5&&month<=9?12:8):2;
  case 'hotel':return hour>=7&&hour<12||hour>=15&&hour<23?12:5;
  case 'business':return !weekend&&hour>=7&&hour<20?(rush?15:11):2;
  case 'nightlife':return late?(weekend?20:14):hour>=17?5:1;
  case 'residential':return rush?12:weekend?8:6;
 }
}
function hash(seed:string):number{
 let h=2166136261;
 for(let i=0;i<seed.length;i++)h=Math.imul(h^seed.charCodeAt(i),16777619);
 return h>>>0;
}
/** Bounded ranking of nearby potential origin hotspots. The caller MUST
 * check actual discovered pickup nodes near each result before using it.
 * At most three areas need a spatial-index lookup in one dispatch cycle.
 */
export function passengerHotspotCandidates(
 region:Point,places:readonly PassengerDemandPlace[],at:number,sequence:number,
 limit=3,
):PassengerDemandPlace[]{
 const options:Array<{place:PassengerDemandPlace;score:number}>=[];
 for(const place of places){
  if(!place.position?.every(Number.isFinite))continue;
  const distance=meters(region,place.position),radius=passengerPlaceAccessRadius(place.kind);
  if(distance>5200+radius)continue;
  const weight=passengerPlaceWeight(place.kind,at);
  if(!weight)continue;
  const jitter=.5+(hash(place.id+':'+Math.floor(sequence)+':'+Math.floor(at/3600000))%1000)/1000;
  options.push({place,score:weight*jitter/(1+distance/3000)});
 }
 options.sort((a,b)=>b.score-a.score);
 return options.slice(0,Math.max(0,Math.min(5,limit))).map(x=>x.place);
}
/** Avoid claiming a landmark supplied a pickup when generation fell back
 * to a different road. Also enables genuine residential road classifications.
 */
export function pickupPlaceForRoad(
 pickup:Point,nearby:readonly PassengerDemandPlace[],
 residentialRoad:boolean,
):PassengerDemandPlace|null{
 let nearest:PassengerDemandPlace|null=null,closest=Infinity;
 for(const place of nearby){
  const distance=meters(pickup,place.position);
  if(distance>passengerPlaceAccessRadius(place.kind)||distance>=closest)continue;
  closest=distance;nearest=place;
 }
 return nearest??(residentialRoad?{
  id:'zone:residential',name:'Residential neighbourhood',
  kind:'residential',position:pickup,
 }:null);
}
