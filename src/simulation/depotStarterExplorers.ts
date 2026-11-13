import {energySpec} from './energy';
import {SPECIALIST_EXPLORERS} from './explorerRoles';
import type {Depot} from '../company';
import type {Point,Taxi,FleetState} from './taxi';

/** Every newly constructed depot receives its own five free specialists.
 * Do not transfer the HQ explorers or reuse their vehicle IDs.
 * The depot's first real road edge is seeded separately by the caller so
 * all five vehicles start on a discovered road.
 */
export function createDepotStarterExplorers(depotId:string,depotName:string,position:Point):Taxi[]{
 return SPECIALIST_EXPLORERS.map(({role,name})=>({
  id:`depot-starter-${depotId}-${role}`,
  kind:'explorer' as const,
  explorerRole:role,
  name:`${name} · ${depotName}`,
  driver:'Autonomous',
  position:[...position] as Point,
  status:'IDLE' as const,
  path:[],
  edgeIds:[],
  leg:0,
  distanceIntoLeg:0,
  fare:0,
  completed:0,
  ownership:'owned' as const,
  purchasePrice:0,
  vehicleModel:name,
  vehicleYear:2026,
  vehicleFuel:'Petrol',
  vehicleClass:'Economy',
  vehicleCondition:100,
  vehicleMileage:0,
  energyRemaining:energySpec({vehicleFuel:'Petrol'}).capacity,
  depotId,
 }));
}

/** A verified, already-loaded OSM road at a depot. Never invent connectivity. */
export type DepotStarterAnchor={position:Point;roadId:string};

/** Heal saves created before depot starter vehicles were reliably awarded.
 * Once a depot's starter grant is recorded, selling or reassigning vehicles
 * must NEVER cause free replacements to respawn.
 *
 * Count existing assigned specialists of each role toward the original five.
 * If a role is missing, spawn it only when its depot's real road is loaded.
 */
export function reconcileDepotStarterExplorers(
 fleet:FleetState,
 depots:readonly Depot[],
 anchors:ReadonlyMap<string,DepotStarterAnchor>,
):FleetState{
 if(!depots.length)return fleet;
 const grants={...(fleet.depotStarterExplorerGrants??{})};
 const currentIds=new Set(fleet.taxis.map(t=>t.id));
 const additions:Taxi[]=[];
 const seeded=new Set(fleet.exploredEdgeIds??[]);
 const events:NonNullable<FleetState['transactions']>=[];
 let changed=false;
 for(const depot of depots){
  if(grants[depot.id])continue;
  const assigned=new Set(fleet.taxis.filter(t=>
   t.kind==='explorer'&&t.depotId===depot.id).map(t=>t.explorerRole));
  const missing=SPECIALIST_EXPLORERS.filter(({role})=>!assigned.has(role));
  const anchor=anchors.get(depot.id);
  if(missing.length&&!anchor)continue; // Streaming graph may not have arrived.
  if(missing.length&&anchor){
   const starters=createDepotStarterExplorers(depot.id,depot.name,anchor.position);
   for(const vehicle of starters){
    if(assigned.has(vehicle.explorerRole))continue;
    if(currentIds.has(vehicle.id))continue;
    currentIds.add(vehicle.id);additions.push(vehicle);
   }
   // A real OSM road becomes discovered so the new explorers can depart.
   seeded.add(anchor.roadId);
   if(additions.length)
    events.push({id:`depot-starter-grant-${depot.id}`,time:Date.now(),
     description:`Depot ${depot.name} · original starter explorers restored`,amount:0});
  }
  grants[depot.id]=true;
  changed=true;
 }
 if(!changed)return fleet;
 return {...fleet,depotStarterExplorerGrants:grants,
  taxis:[...fleet.taxis,...additions],
  exploredEdgeIds:[...seeded],
  transactions:[...events,...(fleet.transactions??[])].slice(0,100)};
}
