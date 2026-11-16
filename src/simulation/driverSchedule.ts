import type {DriverRecord,Taxi} from './taxi';

// Original four-shift stagger remains the default for every existing save.
// Individual drivers may override hours; all times use the existing game clock.
export type ShiftPreference='morning'|'day'|'evening'|'night';
const shifts=[{name:'Morning',start:6},{name:'Day',start:12},
 {name:'Evening',start:18},{name:'Night',start:0}] as const;

export type DriverShiftPatch=Partial<Pick<DriverRecord,
 'shiftStartHour'|'shiftDurationHours'|'shiftBreakAtHour'>>;
const validStart=(value:unknown):value is number=>
 typeof value==='number'&&Number.isInteger(value)&&value>=0&&value<=23;
const validDuration=(value:unknown):value is number=>
 typeof value==='number'&&Number.isInteger(value)&&value>=6&&value<=12;
const validBreak=(value:unknown,duration:number):value is number=>
 typeof value==='number'&&Number.isFinite(value)&&
 value>=1&&value<=duration-.5&&Math.round(value*4)===value*4;

/** Bound saved form values so corrupted or older save data cannot create
 * permanent zero-length shifts or breaks outside of working hours.
 */
export function updateDriverShift(driver:DriverRecord,patch:DriverShiftPatch):DriverRecord{
 const next={...driver,...patch};
 if(!validStart(next.shiftStartHour))delete next.shiftStartHour;
 if(!validDuration(next.shiftDurationHours))delete next.shiftDurationHours;
 const duration=next.shiftDurationHours??12;
 if(!validBreak(next.shiftBreakAtHour,duration))delete next.shiftBreakAtHour;
 return next;
}

export function driverSchedule(taxi:Taxi,drivers:DriverRecord[],epochMs:number){
 const sorted=[...drivers].sort((a,b)=>a.hiredAt-b.hiredAt||a.id.localeCompare(b.id));
 const index=sorted.findIndex(d=>d.name.toLowerCase()===taxi.driver.toLowerCase());
 const driver=index>=0?sorted[index]:undefined;
 let hash=0;for(const ch of taxi.id)hash=(Math.imul(hash,31)+ch.charCodeAt(0))|0;
 const slot=index>=0?index:(hash>>>0);
 const group=slot%4;
 const automaticStart=(((shifts[group].start+Math.floor(slot/4)%4)%24)+24)%24;
 const start=validStart(driver?.shiftStartHour)?driver.shiftStartHour:automaticStart;
 const duration=validDuration(driver?.shiftDurationHours)?driver.shiftDurationHours:12;
 const automaticBreak=Math.min(5.75,Math.max(2,duration/2));
 const breakStart=validBreak(driver?.shiftBreakAtHour,duration)?
  driver.shiftBreakAtHour:automaticBreak;
 const current=((epochMs/3600000)%24+24)%24;
 const elapsed=(current-start+24)%24;
 return {start,duration,breakStart,breakEnd:breakStart+.5,
  preference:validStart(driver?.shiftStartHour)?'Custom':shifts[group].name,
  onDuty:elapsed<duration,onBreak:elapsed>=breakStart&&elapsed<breakStart+.5,
  breakEndsAt:epochMs+(breakStart+.5-elapsed)*3600000,current,elapsed,
  automatic:!validStart(driver?.shiftStartHour),
 };
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
