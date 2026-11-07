/** Driver rest rules. All durations use the simulated game clock, not wall time. */
export type RestStopKind='parking'|'rest_area'|'services'|'hotel';
export type RestPreference='automatic'|'parking'|'hotel'|'depot';
export type RestStop={id:string;name:string;kind:RestStopKind;position:[number,number];roadEdgeId?:string};
export type RestPlan={stop:RestStop;durationGameMs:number;cost:number;fatigueRecovered:number};
export const REST_RULES={
 shortBreakAfterDrivingMs:4*60*60*1000,
 overnightAfterDrivingMs:9*60*60*1000,
 shortBreakGameMs:30*60*1000,
 overnightGameMs:9*60*60*1000,
 parkingCost:3,
 hotelCost:75,
} as const;
export function restStopKind(tags:Record<string,string|undefined>):RestStopKind|null{
 if(tags.tourism==='hotel'||tags.tourism==='motel'||tags.tourism==='guest_house')return 'hotel';
 if(tags.highway==='rest_area')return 'rest_area';
 if(tags.highway==='services')return 'services';
 if(tags.amenity==='parking')return 'parking';
 return null;
}
export function restDue(drivingGameMs:number):'overnight'|'short'|null{
 if(drivingGameMs>=REST_RULES.overnightAfterDrivingMs)return 'overnight';
 if(drivingGameMs>=REST_RULES.shortBreakAfterDrivingMs)return 'short';
 return null;
}
/** Only consider stops whose access-road edge is already discovered. */
export function eligibleRestStops(stops:readonly RestStop[],discovered:ReadonlySet<string>):RestStop[]{
 return stops.filter(stop=>Boolean(stop.roadEdgeId&&discovered.has(stop.roadEdgeId)));
}
export function planRest(stop:RestStop,overnight:boolean):RestPlan|null{
 if(overnight&&stop.kind!=='hotel')return null;
 const hotel=stop.kind==='hotel';
 return {stop,durationGameMs:overnight?REST_RULES.overnightGameMs:REST_RULES.shortBreakGameMs,
  cost:hotel?REST_RULES.hotelCost:stop.kind==='parking'?REST_RULES.parkingCost:0,
  fatigueRecovered:overnight?100:40};
}
