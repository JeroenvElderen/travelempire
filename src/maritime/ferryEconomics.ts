/** Shared ferry ticket demand and operating costs for live settlements and forecasts. */
export function ferryVoyageEconomics(durationMinutes:number,completedAt:number,configuredFare?:number){
 const duration=Math.max(10,durationMinutes);
 const hour=new Date(completedAt).getUTCHours();
 const demand=(hour>=7&&hour<10)||(hour>=16&&hour<20)?1.45:(hour>=22||hour<6)?0.35:1;
 const passengers=Math.round((12+Math.min(55,duration*.22))*demand);
 const standardFare=4+duration*.16;
 const ticket=typeof configuredFare==='number'&&Number.isFinite(configuredFare)&&configuredFare>=1&&configuredFare<=100?configuredFare:standardFare;
 const multiplier=Math.max(.2,Math.min(1.8,Math.pow(ticket/standardFare,-.75)));
 const adjustedPassengers=Math.min(90,Math.max(0,Math.round(passengers*multiplier)));
 return {passengers:adjustedPassengers,ticket,revenue:Math.round(adjustedPassengers*ticket*100)/100,cost:Math.round((24+duration*.9)*100)/100};
}
