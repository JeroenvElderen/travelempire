/** Management upgrades for the hotel and headquarters economy.
 * These systems are intentionally distinct from map/depot upgrades.
 * All effective times use game-clock hours to keep offline settlement deterministic.
 */
export type HotelRate='value'|'standard'|'premium';
export type HotelStaff='lean'|'balanced'|'full';
export type HotelPolicy={rate:HotelRate;staffing:HotelStaff};
export const DEFAULT_HOTEL_POLICY:HotelPolicy={rate:'standard',staffing:'balanced'};
export type HotelPolicyChange={fromHour:number;policy:HotelPolicy};
export type OfficeDepartment='reservations'|'marketing'|'facilities';
export type OfficeUpgrade={id:OfficeDepartment;level:number;effectiveHour:number};
export const OFFICE_DEPARTMENTS=[
 {id:'reservations',title:'Reservations team',subtitle:'Improve hotel occupancy',bonus:'+3% occupancy per level',baseCost:18000,max:3},
 {id:'marketing',title:'Property marketing',subtitle:'Improve average room rates',bonus:'+3% room price per level',baseCost:24000,max:3},
 {id:'facilities',title:'Facilities department',subtitle:'Control hotel fixed costs',bonus:'−4% fixed costs per level',baseCost:20000,max:3}
] as const;
export function officeLevel(upgrades:readonly OfficeUpgrade[]|undefined,id:OfficeDepartment,hour=Infinity):number{
 let level=0;
 for(const upgrade of upgrades??[]){
  if(upgrade?.id===id&&Number.isFinite(upgrade.effectiveHour)&&upgrade.effectiveHour<=hour)
   level=Math.max(level,Math.max(0,Math.min(3,Math.trunc(upgrade.level)||0)));
 }
 return level;
}
export function officeCost(id:OfficeDepartment,nextLevel:number):number{
 const department=OFFICE_DEPARTMENTS.find(o=>o.id===id);
 if(!department||!Number.isInteger(nextLevel)||nextLevel<1||nextLevel>department.max)throw Error('Invalid headquarters upgrade level.');
 return department.baseCost*nextLevel;
}
export function hotelPolicyAt(changes:readonly HotelPolicyChange[]|undefined,hour:number):HotelPolicy{
 let selected=DEFAULT_HOTEL_POLICY,since=-Infinity;
 for(const change of changes??[]){
  if(!Number.isFinite(change?.fromHour)||change.fromHour>hour||change.fromHour<since)continue;
  const p=change.policy;
  if(!p||!(['value','standard','premium'] as string[]).includes(p.rate)||!(['lean','balanced','full'] as string[]).includes(p.staffing))continue;
  selected=p;since=change.fromHour;
 }
 return selected;
}
