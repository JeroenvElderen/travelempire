import type {DriverRecord,Taxi} from './taxi';

// Stable automatic preferences: hire order distributes the workforce across
// morning, day, evening and night, with staggered starts inside each group.
export type ShiftPreference='morning'|'day'|'evening'|'night';
const shifts=[{name:'Morning',start:6},{name:'Day',start:12},{name:'Evening',start:18},{name:'Night',start:0}] as const;
export function driverSchedule(taxi:Taxi,drivers:DriverRecord[],epochMs:number){
 const sorted=[...drivers].sort((a,b)=>a.hiredAt-b.hiredAt||a.id.localeCompare(b.id));
 const index=sorted.findIndex(d=>d.name.toLowerCase()===taxi.driver.toLowerCase());
 let hash=0;for(const ch of taxi.id)hash=(Math.imul(hash,31)+ch.charCodeAt(0))|0;
 const slot=index>=0?index:(hash>>>0);
 const group=slot%4;
 const start=(((shifts[group].start+Math.floor(slot/4)%4)%24)+24)%24;
 const current=((epochMs/3600000)%24+24)%24;
 const elapsed=(current-start+24)%24;
 return {start,preference:shifts[group].name,onDuty:elapsed<12,onBreak:elapsed>=5.75&&elapsed<6.25,
  breakEndsAt:epochMs+(6.25-elapsed)*3600000,current,elapsed};
}
export function clockLabel(hour:number){
 const minutes=((Math.round(hour*60)%1440)+1440)%1440;
 return String(Math.floor(minutes/60)).padStart(2,'0')+':'+String(minutes%60).padStart(2,'0');
}

/** Single source of truth for passenger job eligibility and Drivers UI. */
export function canAcceptPassengerJob(taxi:Taxi,drivers:DriverRecord[],gameEpochMs:number):boolean{
 const schedule=driverSchedule(taxi,drivers,gameEpochMs);
 return schedule.onDuty&&!schedule.onBreak;
}
