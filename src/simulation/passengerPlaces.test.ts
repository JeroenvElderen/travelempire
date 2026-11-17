import {describe,expect,it} from 'vitest';
import {createPassengerRequest,meters,type RoadGraph,type Point} from './taxi';
import {passengerProfileFor} from './passengerProfiles';
import {
 GREEK_AIRPORT_DEMAND_PLACES,GREEK_DISTRICT_DEMAND_PLACES,
 passengerHotspotCandidates,passengerPlaceAccessRadius,passengerPlaceWeight,
 pickupPlaceForRoad,type PassengerDemandPlace,
} from './passengerPlaces';

const ATH:Point=[23.9445,37.9364];
const MondayMorning=Date.parse('2026-11-16T06:30:00Z'); // 08:30 in Greece
const FridayNight=Date.parse('2026-11-20T22:00:00Z'); // Midnight Greece

describe('geographically authentic passenger origins',()=>{
 it('contains stable real airports and urban districts, not generic fake stops',()=>{
  expect(GREEK_AIRPORT_DEMAND_PLACES).toHaveLength(7);
  expect(GREEK_AIRPORT_DEMAND_PLACES.some(p=>p.id==='airport:ATH'&&meters(p.position,ATH)<1)).toBe(true);
  expect(GREEK_DISTRICT_DEMAND_PLACES.some(p=>p.kind==='nightlife')).toBe(true);
 });
 it('prefers business areas during weekday rush, nightlife late evening',()=>{
  expect(passengerPlaceWeight('business',MondayMorning)).toBeGreaterThan(passengerPlaceWeight('nightlife',MondayMorning));
  expect(passengerPlaceWeight('nightlife',FridayNight)).toBeGreaterThan(passengerPlaceWeight('business',FridayNight));
  expect(passengerPlaceWeight('harbour',MondayMorning)).toBeGreaterThan(0);
 });
 it('offers only nearby actual POI influence zones, not distant airports',()=>{
  const options=passengerHotspotCandidates(ATH,GREEK_AIRPORT_DEMAND_PLACES,MondayMorning,2);
  expect(options.map(p=>p.id)).toContain('airport:ATH');
  expect(options.some(p=>p.id==='airport:SKG')).toBe(false);
  expect(passengerHotspotCandidates([22,38],GREEK_AIRPORT_DEMAND_PLACES,MondayMorning,2)).toEqual([]);
 });
 it('recognises a real terminal only close to that terminal',()=>{
  const airport=GREEK_AIRPORT_DEMAND_PLACES[0];
  const close:Point=[ATH[0]+0.004,ATH[1]];
  expect(meters(close,ATH)).toBeLessThan(passengerPlaceAccessRadius('airport'));
  expect(pickupPlaceForRoad(close,[airport],false)?.id).toBe('airport:ATH');
  expect(pickupPlaceForRoad([22,38],[airport],false)).toBeNull();
  expect(pickupPlaceForRoad([22,38],[airport],true)?.kind).toBe('residential');
 });
 it('accepts game-provided harbour and working hotel hotspots without inventing roads',()=>{
  const places:PassengerDemandPlace[]=[
   {id:'harbour:xy',name:'Port XYZ',kind:'harbour',position:[23.72,37.98]},
   {id:'hotel:abc',name:'Hotel ABC',kind:'hotel',position:[23.7206,37.98]},
  ];
  expect(passengerHotspotCandidates([23.72,37.98],places,MondayMorning,5).length).toBe(2);
  expect(pickupPlaceForRoad([23.7206,37.98],places,false)?.id).toBe('hotel:abc');
 });

 it('generates pickups only from the preferred, genuinely discovered OSM node',()=>{
  const a:Point=[23.72,37.98],b:Point=[23.727,37.98],c:Point=[23.734,37.98];
  const nodes=new Map<string,Point>([['a',a],['b',b],['c',c]]);
  const edges:RoadGraph['edges']=new Map([
   ['a',[{to:'b',meters:meters(a,b),id:'ab',speedKph:40}]],
   ['b',[{to:'a',meters:meters(a,b),id:'ab',speedKph:40},
          {to:'c',meters:meters(b,c),id:'bc',speedKph:40}]],
   ['c',[{to:'b',meters:meters(b,c),id:'bc',speedKph:40}]],
  ]);
  const graph:RoadGraph={nodes,edges,nodeKeys:[...nodes.keys()]};
  const available=new Set(['a','b','c']);
  const route=createPassengerRequest(graph,new Set(['ab','bc']),a,Date.now(),1,
   available,new Set(),['a']);
  expect(route).not.toBeNull();
  expect(route?.pickup).toEqual(a);
  expect(route?.tripDistanceMeters).toBeGreaterThanOrEqual(500);
  expect(available.has(['a','b','c'].find(k=>nodes.get(k)===route?.dropoff)??'a')).toBe(true);
 });

 it('makes tourists likely at airport pickups, business travel at offices',()=>{
  const make=(kind:'airport'|'business'|'nightlife')=>{
   const counts:Record<string,number>={};
   for(let i=0;i<200;i++){
    const p=passengerProfileFor({id:'ride-'+i,pickup:ATH,pickupPlaceKind:kind},kind==='nightlife'?FridayNight:MondayMorning);
    counts[p.passengerType]=(counts[p.passengerType]??0)+1;
   }
   return counts;
  };
  expect(make('airport').tourist).toBeGreaterThan(55);
  expect(make('business').business).toBeGreaterThan(55);
  expect(make('nightlife').nightlife).toBeGreaterThan(75);
 });
});
