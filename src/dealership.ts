import type {Point,Taxi,RoadGraph} from './simulation/taxi';
import {meters,nearest,route} from './simulation/taxi';

export type VehicleOffer={id:string;model:string;year:number;fuel:'Petrol';className:'Economy'|'Standard'|'Comfort'|'Premium'|'XL';price:number;mileage:number;condition:number;seats:number;kind:'New'|'Used'};
export const OFFERS:VehicleOffer[]=[
 {id:'prius-used',model:'Toyota Prius',year:2018,fuel:'Petrol',className:'Economy',price:10500,mileage:165000,condition:74,seats:4,kind:'Used'},
 {id:'octavia-used',model:'Skoda Octavia',year:2021,fuel:'Petrol',className:'Standard',price:17900,mileage:82000,condition:89,seats:4,kind:'Used'},
 {id:'corolla-new',model:'Toyota Corolla',year:2026,fuel:'Petrol',className:'Standard',price:26500,mileage:0,condition:100,seats:4,kind:'New'},
 {id:'eclass-used',model:'Mercedes E-Class',year:2023,fuel:'Petrol',className:'Premium',price:49900,mileage:45000,condition:94,seats:4,kind:'Used'},
 {id:'model3-new',model:'Volkswagen Passat',year:2026,fuel:'Petrol',className:'Comfort',price:38500,mileage:0,condition:100,seats:4,kind:'New'},
 {id:'multivan-new',model:'Volkswagen Multivan',year:2026,fuel:'Petrol',className:'XL',price:57000,mileage:0,condition:100,seats:6,kind:'New'},
];
export const DELIVERY_MS=90_000; // 90 real-world seconds for initial mobile testing.
export const eur=(n:number)=>new Intl.NumberFormat('en-IE',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(n);
export function deliveryRoute(graph:RoadGraph,hq:Point):Point[]{
 const target=nearest(graph,hq);
 if(!target)return [hq];
 const destination=graph.nodes.get(target)!;
 // Find a connected starting point a few kilometres away, using the existing road graph.
 const candidates=graph.nodeKeys.filter((k,i)=>i%17===0&&meters(graph.nodes.get(k)!,destination)>900&&meters(graph.nodes.get(k)!,destination)<5000);
 for(let attempt=0;attempt<Math.min(30,candidates.length);attempt++){
  const k=candidates[Math.floor(Math.random()*candidates.length)];
  const found=route(graph,k,target);
  if(found&&found.path.length>2&&found.length>700)return found.path;
 }
 return [destination]; // Delivery still completes if the local preview has disconnected roads.
}
export function deliveryPosition(taxi:Taxi,now=Date.now()):Point|null{
 if(!taxi.deliveryUntil||!taxi.deliveryStartedAt||!taxi.deliveryPath?.length)return null;
 const path=taxi.deliveryPath;
 if(path.length===1)return path[0];
 const fraction=Math.max(0,Math.min(1,(now-taxi.deliveryStartedAt)/(taxi.deliveryUntil-taxi.deliveryStartedAt)));
 const lengths=path.slice(1).map((p,i)=>meters(path[i],p));
 const total=lengths.reduce((a,b)=>a+b,0);let distance=total*fraction;
 for(let i=0;i<lengths.length;i++){
  if(distance<=lengths[i]){const t=lengths[i]?distance/lengths[i]:0;return [path[i][0]+(path[i+1][0]-path[i][0])*t,path[i][1]+(path[i+1][1]-path[i][1])*t];}
  distance-=lengths[i];
 }
 return path[path.length-1];
}
