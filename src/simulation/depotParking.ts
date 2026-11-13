import type {Company} from '../company';
import {depotCapacity,upgradesFor} from '../depotFinance';
import type {FleetState} from './taxi';

/** Reservations include taxis awaiting delivery, not just parked/idle taxis.
 * Road explorers have their own separate parking spaces.
 */
export type DepotParking={
 id:string;name:string;capacity:number;occupied:number;available:number;overCapacity:number;
};

export function depotParkingChoices(
 company:Pick<Company,'headquarters'|'depots'>,
 fleet:Pick<FleetState,'taxis'|'upgrades'|'depotUpgrades'>,
):DepotParking[]{
 const legacyMainExtra=5*(fleet.upgrades??[]).filter(kind=>kind==='depot-capacity').length;
 const depots=[
  {id:'main',name:'Main depot · '+company.headquarters.label,capacity:5+legacyMainExtra},
  ...(company.depots??[]),
 ];
 return depots.map(depot=>{
  const capacity=depotCapacity(depot,upgradesFor(fleet as FleetState,depot.id));
  // Count all non-explorer fleet vehicles, including cars not delivered yet.
  const occupied=fleet.taxis.filter(t=>t.kind!=='explorer'&&(t.depotId??'main')===depot.id).length;
  return {id:depot.id,name:depot.name,capacity,occupied,
   available:Math.max(0,capacity-occupied),overCapacity:Math.max(0,occupied-capacity)};
 });
}

/** Shared guard for the showroom, Fleet marketplace, and the actual checkout.
 * Never charge money or create vehicle records unless the whole order fits.
 */
export function requireDepotParking(
 company:Pick<Company,'headquarters'|'depots'>,
 fleet:Pick<FleetState,'taxis'|'upgrades'|'depotUpgrades'>,
 depotId:string,
 quantity:number,
):DepotParking{
 if(!Number.isInteger(quantity)||quantity<1)throw Error('Enter a valid number of vehicles.');
 const selected=depotParkingChoices(company,fleet).find(d=>d.id===depotId);
 if(!selected)throw Error('Select an existing delivery depot.');
 if(quantity>selected.available){
  const over=selected.overCapacity>0?` (${selected.overCapacity} already over capacity)`:'';
  throw Error(`${selected.name}: ${selected.occupied}/${selected.capacity} taxi spaces occupied${over}; ${selected.available} available, but this order needs ${quantity}. Choose another depot or expand taxi parking.`);
 }
 return selected;
}
