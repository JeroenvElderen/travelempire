import type {Taxi} from './taxi';

export type EnergyKind='petrol'|'diesel'|'hybrid'|'electric';
export type EnergySpec={kind:EnergyKind;capacity:number;per100km:number;unit:'L'|'kWh';pricePerUnit:number};
// Simplified game balance figures, not homologated WLTP figures for individual models.
// Vehicles saved before drivetrain support retain the original petrol specification.
export function energySpec(t:Pick<Taxi,'vehicleFuel'>):EnergySpec {
 switch((t.vehicleFuel??'Petrol').toLowerCase()){
  case 'diesel':return {kind:'diesel',capacity:55,per100km:5.8,unit:'L',pricePerUnit:1.75};
  case 'hybrid':return {kind:'hybrid',capacity:45,per100km:4.6,unit:'L',pricePerUnit:1.85};
  case 'electric':return {kind:'electric',capacity:70,per100km:18,unit:'kWh',pricePerUnit:0.32};
  default:return {kind:'petrol',capacity:50,per100km:8,unit:'L',pricePerUnit:1.85};
 }
}
export function energyRemaining(t:Taxi):number {
 const spec=energySpec(t);
 return Math.min(spec.capacity,Math.max(0,t.energyRemaining??spec.capacity));
}
export function energyPercent(t:Taxi):number{return energyRemaining(t)/energySpec(t).capacity*100;}
export function energyRangeKm(t:Taxi):number {
 const spec=energySpec(t);return energyRemaining(t)*100/spec.per100km;
}
export function energyUsed(t:Taxi,km:number,efficiencyBonus=0):number {
 return Math.max(0,km)*energySpec(t).per100km/100*(1-Math.max(0,Math.min(0.12,efficiencyBonus)));
}
