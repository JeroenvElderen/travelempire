import type {FleetState,Taxi,Point} from './taxi';
import {energySpec} from './energy';

/** Level 1 Universal Explorer Infrastructure: two EXTRA vehicles per role.
 * Stable IDs prevent duplicate rewards even if the previous save used the
 * legacy explorerExpansionApplied flag without granting any vehicles.
 */
export const EXPANSION_ROLES=['highway','primary','secondary','residential','poi'] as const;
const LABELS={
 highway:'Highway Explorer',primary:'Primary Explorer',
 secondary:'Secondary Explorer',residential:'Local Street Explorer',poi:'POI Explorer'
} as const;
export function grantExplorerInfrastructure(fleet:FleetState,position:Point):FleetState{
 if(fleet.explorerExpansionVehiclesGranted)return fleet;
 const ids=new Set(fleet.taxis.map(t=>t.id));
 const added:Taxi[]=[];
 for(const role of EXPANSION_ROLES){
  for(let slot=1;slot<=2;slot++){
   const id=`research-explorer-expansion-${role}-${slot}`;
   if(ids.has(id))continue;
   const name=`${LABELS[role]} ${slot+1}`;
   added.push({
    id,kind:'explorer',explorerRole:role,name,driver:'Autonomous',
    position:[...position],status:'IDLE',path:[],edgeIds:[],
    leg:0,distanceIntoLeg:0,fare:0,completed:0,
    ownership:'owned',purchasePrice:0,vehicleModel:LABELS[role],
    vehicleYear:2026,vehicleFuel:'Petrol',vehicleClass:'Economy',
    vehicleCondition:100,vehicleMileage:0,
    energyRemaining:energySpec({vehicleFuel:'Petrol'}).capacity,depotId:'main'
   });
   ids.add(id);
  }
 }
 return {...fleet,taxis:[...fleet.taxis,...added],
  explorerExpansionApplied:true,explorerExpansionVehiclesGranted:true};
}
