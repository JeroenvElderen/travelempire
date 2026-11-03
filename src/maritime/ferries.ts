/** Ferry links are transfers between road networks, not independently owned vessels.
 * A ferry is eligible only when source data explicitly confirms vehicle carriage.
 * Unknown capacity is deliberately excluded to prevent taxis boarding passenger-only boats.
 */
export type Coordinate=[number,number];
export type FerryPort={id:string;name:string;position:Coordinate;roadAccess?:Coordinate};
export type FerryRoute={id:string;from:string;to:string;geometry:Coordinate[];durationMinutes:number;motorVehicle:true;source:string;name?:string};
export type FerryNetwork={version:1;ports:FerryPort[];routes:FerryRoute[]};
export type FerryTransfer={routeId:string;fromPortId:string;toPortId:string;geometry:Coordinate[];durationMinutes:number};
export const EMPTY_FERRY_NETWORK:FerryNetwork={version:1,ports:[],routes:[]};
const validPoint=(p:unknown):p is Coordinate=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&Math.abs(p[0])<=180&&Math.abs(p[1])<=90;
export function validateFerryNetwork(input:unknown):FerryNetwork{
 if(!input||typeof input!=='object')throw new Error('Invalid ferry network');
 const obj=input as Partial<FerryNetwork>;
 if(obj.version!==1||!Array.isArray(obj.ports)||!Array.isArray(obj.routes))throw new Error('Unsupported ferry network version');
 const ports=new Map<string,FerryPort>();
 for(const p of obj.ports){if(!p||typeof p.id!=='string'||!p.id||!validPoint(p.position)||ports.has(p.id))throw new Error('Invalid or duplicate ferry port');ports.set(p.id,p);}
 const routes:FerryRoute[]=[];const ids=new Set<string>();
 for(const r of obj.routes){if(!r||typeof r.id!=='string'||!r.id||ids.has(r.id)||r.motorVehicle!==true||!ports.has(r.from)||!ports.has(r.to)||r.from===r.to||!Number.isFinite(r.durationMinutes)||r.durationMinutes<=0||!Array.isArray(r.geometry)||r.geometry.length<2||!r.geometry.every(validPoint))throw new Error('Invalid vehicle ferry route');ids.add(r.id);routes.push(r);}
 return {version:1,ports:[...ports.values()],routes};
}
/** Only validated road-compatible ferry links are returned. No arbitrary sea shortcuts. */
export function ferryTransfers(network:FerryNetwork,portId:string):FerryTransfer[]{
 return network.routes.flatMap(r=>{
  if(r.from===portId)return [{routeId:r.id,fromPortId:r.from,toPortId:r.to,geometry:r.geometry,durationMinutes:r.durationMinutes}];
  if(r.to===portId)return [{routeId:r.id,fromPortId:r.to,toPortId:r.from,geometry:[...r.geometry].reverse(),durationMinutes:r.durationMinutes}];
  return [];
 });
}
export async function loadFerryNetwork(url='/data/ferries/GRC.json'):Promise<FerryNetwork>{
 const response=await fetch(url);if(!response.ok)throw new Error('Ferry network data unavailable');
 return validateFerryNetwork(await response.json());
}
