import type {Taxi} from './taxi';

export type EnergyKind='petrol';
export type EnergySpec={kind:EnergyKind;capacity:number;per100km:number;unit:'L';pricePerUnit:number};
// Petrol-only gameplay: realistic baseline fuel consumption, measured by distance driven.
export function energySpec(_t:Pick<Taxi,'vehicleFuel'>):EnergySpec {
 return {kind:'petrol',capacity:50,per100km:8,unit:'L',pricePerUnit:1.85};
}
export function energyRemaining(t:Taxi):number {
 const spec=energySpec(t);
 // Older saves had cumulative fuelLitres but no tank state. Migrate as a full tank,
 // rather than interpreting lifetime fuel consumption as current fuel.
 return Math.min(spec.capacity,Math.max(0,t.energyRemaining??spec.capacity));
}
export function energyPercent(t:Taxi):number{return energyRemaining(t)/energySpec(t).capacity*100;}
export function energyRangeKm(t:Taxi):number {
 const spec=energySpec(t);return energyRemaining(t)*100/spec.per100km;
}
export function energyUsed(t:Taxi,km:number,efficiencyBonus=0):number {
 return Math.max(0,km)*energySpec(t).per100km/100*(1-Math.max(0,Math.min(0.12,efficiencyBonus)));
}
