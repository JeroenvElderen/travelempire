import type {Taxi} from './taxi';

export type EnergyKind='petrol'|'diesel'|'hybrid'|'electric';
export type EnergySpec={kind:EnergyKind;capacity:number;per100km:number;unit:'L'|'kWh';pricePerUnit:number};
// Approximate gameplay assumptions for Greece, not live station prices or model-specific homologation figures.
export function energySpec(t:Pick<Taxi,'vehicleFuel'>):EnergySpec {
 const fuel=(t.vehicleFuel??'petrol').toLowerCase();
 if(fuel.includes('electric'))return {kind:'electric',capacity:60,per100km:17,unit:'kWh',pricePerUnit:0.35};
 if(fuel.includes('hybrid'))return {kind:'hybrid',capacity:45,per100km:4.5,unit:'L',pricePerUnit:1.85};
 if(fuel.includes('diesel'))return {kind:'diesel',capacity:55,per100km:5.5,unit:'L',pricePerUnit:1.65};
 return {kind:'petrol',capacity:50,per100km:7,unit:'L',pricePerUnit:1.85};
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
