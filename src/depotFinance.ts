import type {Depot} from './company';
import type {DepotFinanceRecord,DepotUpgradeKind,DepotUpgradeState,FleetState} from './simulation/taxi';
export const MAIN_DEPOT_ID='main';
export const DEPOT_UPGRADES:{id:DepotUpgradeKind;name:string;cost:number;description:string;max:number}[]=[
 {id:'workshop',name:'Workshop',cost:8000,description:'10% lower maintenance per level',max:3},
 {id:'charging',name:'Charging station',cost:6500,description:'12% lower electric charging costs per level',max:3},
 {id:'fuel',name:'Fuel storage',cost:7000,description:'8% lower fuel purchases per level',max:3},
 {id:'dispatch',name:'Dispatch centre',cost:12000,description:'3% higher passenger revenue per level',max:3},
 {id:'capacity',name:'Parking expansion',cost:10000,description:'5 extra vehicle spaces per level',max:4},
];
export function upgradesFor(fleet:FleetState,depotId:string):DepotUpgradeState{return fleet.depotUpgrades?.[depotId]??{};}
export function depotCapacity(depot:Pick<Depot,'capacity'>|undefined,upgrades:DepotUpgradeState):number{return (depot?.capacity??5)+(upgrades.capacity??0)*5;}
export function depotDailyCost(isMain:boolean,upgrades:DepotUpgradeState,capacity:number){
 const base=isMain?25:42;
 return {rent:isMain?0:18,utilities:base*.35+capacity*.45+(upgrades.charging??0)*5,insurance:base*.2+capacity*.35,facilities:base*.3+(upgrades.workshop??0)*8+(upgrades.fuel??0)*5,administration:base*.15+(upgrades.dispatch??0)*7};
}
export function depotDailyTotal(isMain:boolean,upgrades:DepotUpgradeState,capacity:number):number{return Object.values(depotDailyCost(isMain,upgrades,capacity)).reduce((a,b)=>a+b,0);}
export function aggregateDepot(records:DepotFinanceRecord[]){
 return records.reduce((a,r)=>({revenue:a.revenue+r.revenue,vehicleExpenses:a.vehicleExpenses+r.vehicleExpenses,facilityExpenses:a.facilityExpenses+r.facilityExpenses,allocatedOverhead:a.allocatedOverhead+r.allocatedOverhead,trips:a.trips+r.trips,km:a.km+r.km}),{revenue:0,vehicleExpenses:0,facilityExpenses:0,allocatedOverhead:0,trips:0,km:0});
}
