/** Simulated taxi customers, without visualising civilians or NPC vehicles. */
import type {Taxi,PassengerRequest} from './taxi';
export type PassengerKind='commuter'|'business'|'tourist'|'family'|'nightlife'|'local';
export type PassengerProfile={passengerType:PassengerKind;partySize:number;luggageCount:number;minimumClass?:'Premium';fareBonus:number};
const timeFormat=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Athens',weekday:'short',month:'numeric',hour:'2-digit',hourCycle:'h23'});
function hash(s:string){let v=2166136261;for(const c of s)v=Math.imul(v^c.charCodeAt(0),16777619);return v>>>0;}
export function passengerProfileFor(job:Pick<PassengerRequest,'id'|'pickup'|'tripType'>,gameAt:number):PassengerProfile{
 const parts=timeFormat.formatToParts(new Date(gameAt)),get=(t:string)=>parts.find(p=>p.type===t)?.value??'';
 const hour=Number(get('hour')),month=Number(get('month')),weekend=['Sat','Sun'].includes(get('weekday'));
 const rush=!weekend&&(hour>=7&&hour<10||hour>=16&&hour<19),night=hour>=21||hour<4;
 const seed=hash(job.id+':'+job.pickup[0].toFixed(4)+':'+job.pickup[1].toFixed(4));
 const scores:Array<[PassengerKind,number]>=[
  ['commuter',rush?36:weekend?7:13],['business',!weekend&&hour>=7&&hour<20?22:7],
  ['tourist',(month>=5&&month<=9?23:12)+(job.tripType!=='local'?12:0)],
  ['family',weekend?20:14],['nightlife',night?30:3],['local',22],
 ];
 let selection=seed%scores.reduce((sum,v)=>sum+v[1],0),kind:PassengerKind='local';
 for(const [name,weight] of scores){if(selection<weight){kind=name;break;}selection-=weight;}
 const partySize=kind==='family'?4+(seed>>>8)%3:kind==='tourist'||kind==='nightlife'?1+(seed>>>8)%4:1+(seed>>>8)%2;
 const luggageCount=kind==='tourist'?Math.min(4,partySize+(seed>>>12)%2):
  kind==='family'?2+(seed>>>12)%3:kind==='business'?(seed>>>12)%2:0;
 const minimumClass=kind==='business'&&seed%4===0?'Premium' as const:undefined;
 const fareBonus=kind==='business'?1.16:kind==='tourist'?1.08:kind==='nightlife'?1.12:kind==='family'?1.04:1;
 return {passengerType:kind,partySize,luggageCount,minimumClass,fareBonus};
}
export function passengerCapacity(taxi:Pick<Taxi,'vehicleSeats'|'vehicleClass'>):number{
 return Number.isFinite(taxi.vehicleSeats)?Math.max(1,Math.min(8,Math.floor(taxi.vehicleSeats!))):taxi.vehicleClass==='XL'?6:4;
}
export function passengerCompatible(taxi:Pick<Taxi,'vehicleSeats'|'vehicleClass'>,job:Pick<PassengerRequest,'partySize'|'luggageCount'|'minimumClass'>):boolean{
 return passengerCapacity(taxi)>=(job.partySize??1)&&
  (job.minimumClass!=='Premium'||taxi.vehicleClass==='Premium')&&
  ((job.luggageCount??0)<=3||taxi.vehicleClass==='XL');
}
