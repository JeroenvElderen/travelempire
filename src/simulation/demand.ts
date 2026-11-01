/** Passenger demand follows the simulated local time in Greece (Europe/Athens). */
export type DemandLevel = 'Quiet' | 'Normal' | 'Busy' | 'Rush hour';
export type DemandSnapshot = {hour:number;level:DemandLevel;multiplier:number;fareMultiplier:number;intervalMs:number;queueLimit:number};
export function demandAt(now:number, taxiCount:number):DemandSnapshot {
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Athens',hour:'2-digit',hourCycle:'h23'}).formatToParts(new Date(now));
 const hour=Number(parts.find(p=>p.type==='hour')?.value??12);
 const rush=(hour>=7&&hour<10)||(hour>=16&&hour<19);
 const busy=(hour>=10&&hour<16)||(hour>=19&&hour<23);
 const quiet=hour>=23||hour<6;
 const level:DemandLevel=rush?'Rush hour':quiet?'Quiet':busy?'Busy':'Normal';
 const multiplier=rush?1.6:quiet?0.55:busy?1.2:1;
 // Preserve the existing ten-second cadence in normal hours.
 const intervalMs=Math.round(10000/multiplier);
 const queueLimit=Math.min(16,Math.max(3,Math.ceil(taxiCount*2*multiplier)));
 const fareMultiplier=rush?1.25:busy?1.1:1;
 return {hour,level,multiplier,fareMultiplier,intervalMs,queueLimit};
}
export function fareForDistance(metres:number, multiplier:number):number {
 return Math.round((4+metres/1000*1.8)*multiplier*100)/100;
}
