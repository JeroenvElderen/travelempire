/** Deterministic regional congestion and incident delays.
 * No civilian vehicles, live feed, road discovery, or map markers.
 */
export type TrafficPoint=[number,number];
export type TrafficIncident={roadId:string;kind:'collision'|'medical'|'roadworks';startedAt:number;endsAt:number};
const format=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Athens',hour:'2-digit',weekday:'short',hourCycle:'h23'});
let cachedMinute=NaN,cachedHour=12,cachedWeekend=false;
let currentGameTime=Date.now();
let incidents=new Map<string,TrafficIncident>();
export function setTrafficGameTime(at:number){if(Number.isFinite(at))currentGameTime=at;}
export function trafficGameTime(){return currentGameTime;}
export function setTrafficIncidents(active:readonly TrafficIncident[]){
 incidents=new Map(active.slice(0,3).filter(i=>i&&typeof i.roadId==='string'&&
  Number.isFinite(i.startedAt)&&Number.isFinite(i.endsAt)).map(i=>[i.roadId,i]));
}
const cities:ReadonlyArray<[number,number,number]>=[
 [23.7275,37.9838,19],[22.9444,40.6401,13],[21.7346,38.2466,9],
 [25.1442,35.3387,9],[22.4176,39.6390,8],[22.9408,39.3610,7],
 [28.2278,36.4349,7],[24.0180,35.5138,6],[20.8519,39.6650,6],
];
/** 0 means rural, 1 means an urban centre; radii are in kilometres. */
export function urbanTrafficIntensity(point:TrafficPoint):number{
 let strength=0;
 for(const [lon,lat,radius] of cities){
  const dx=(point[0]-lon)*111*Math.cos(lat*Math.PI/180),dy=(point[1]-lat)*111;
  const ratio=(dx*dx+dy*dy)/(radius*radius);
  if(ratio<1)strength=Math.max(strength,1-ratio*.9);
 }
 return strength;
}
export function incidentTrafficFactor(roadId:string|undefined,at:number):number{
 const incident=roadId?incidents.get(roadId):undefined;
 if(!incident||at<incident.startedAt||at>=incident.endsAt)return 1;
 // Severe incidents create expensive legal detours in timed route searches.
 // No hard block: vehicles already on a committed path are never stranded.
 return incident.kind==='collision'?.28:incident.kind==='roadworks'?.48:.78;
}
export function regionalTrafficFactor(speedKph:number,at:number=currentGameTime,point?:TrafficPoint,roadId?:string):number{
 const minute=Math.floor(at/60000);
 if(minute!==cachedMinute){
  cachedMinute=minute;
  const parts=format.formatToParts(new Date(at));
  cachedHour=Number(parts.find(p=>p.type==='hour')?.value??12);
  cachedWeekend=['Sat','Sun'].includes(parts.find(p=>p.type==='weekday')?.value??'');
 }
 const rush=!cachedWeekend&&(cachedHour>=7&&cachedHour<10||cachedHour>=16&&cachedHour<19);
 const busy=cachedHour>=11&&cachedHour<17;
 const peak=cachedHour>=22||cachedHour<6?.04:rush?.52:busy?.27:cachedWeekend?.17:.11;
 const urban=point?urbanTrafficIntensity(point):.65;
 const roadWeight=speedKph<=50?1:speedKph<=80?.55:.17;
 const base=Math.max(.35,1-roadWeight*peak*(.32+urban*.88));
 return Math.max(.18,base*incidentTrafficFactor(roadId,at));
}
export function trafficLevel(speedKph:number,at:number,point:TrafficPoint):'Clear'|'Moderate'|'Heavy'{
 const factor=regionalTrafficFactor(speedKph,at,point);
 return factor<.65?'Heavy':factor<.87?'Moderate':'Clear';
}
