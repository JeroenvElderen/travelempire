import {energySpec} from './energy';
import {SPECIALIST_EXPLORERS} from './explorerRoles';
import type {Point,Taxi} from './taxi';

/** Every newly constructed depot receives its own five free specialists.
 * Do not transfer the HQ explorers or reuse their vehicle IDs.
 * The depot's first real road edge is seeded separately by the caller so
 * all five vehicles start on a discovered road.
 */
export function createDepotStarterExplorers(depotId:string,depotName:string,position:Point):Taxi[]{
 return SPECIALIST_EXPLORERS.map(({role,name})=>({
  id:crypto.randomUUID(),
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
