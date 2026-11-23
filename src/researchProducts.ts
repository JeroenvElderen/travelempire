import {newProjects,technologyParents,type ResearchProject,type ResourceCosts,type ResourceKey} from './researchProgress';

/** Research products are automatically synthesized from real settled business
 * data. No factories, extra map traffic or manual inventory management.
 */
export const PRODUCT_KEYS=['marketBrief','routeReport','fleetReport','driverStudy','vehicleStudy',
 'depotAudit','brandStudy','creditMemo','harbourReport','guestProfile','buildReport','corporateReport',
 'demandForecast','navigationModel','maintenanceModel','trafficAnalysis','financialForecast',
 'hospitalityModel','maritimeStudy','propertyPlan','investmentStrategy',
 'integratedMobility','advancedVehicleTech','autonomousFleet','tourismNetwork',
 'constructionSystem','internationalStrategy',
 'ticketingModel','harbourSchedule','roadTelemetry','stayRevenueForecast',
 'parkingFlowModel','creditPortfolioReport','fleetReliabilityMap','developmentBlueprint'] as const;
export type ProductKey=typeof PRODUCT_KEYS[number];
export type ProductBag=Partial<Record<ProductKey,number>>;
export type Recipe={id:ProductKey;name:string;icon:string;inputs:ResourceCosts;parts?:ProductBag;unlock:{project:string;level:number}};
export const RECIPES:readonly Recipe[]=[
 {id:'marketBrief',name:'Passenger Market Report',icon:'📋',inputs:{passengers:8,revenue:120},unlock:{project:'pricing',level:1}},
 {id:'routeReport',name:'Route Report',icon:'🗺️',inputs:{roads:20,passengers:3},unlock:{project:'survey',level:1}},
 {id:'fleetReport',name:'Fleet Analysis',icon:'📊',inputs:{passengers:12,distance:70,revenue:150},unlock:{project:'fleetAnalytics',level:1}},
 {id:'driverStudy',name:'Driver Study',icon:'🧑‍✈️',inputs:{passengers:15,distance:80},unlock:{project:'trainingResearch',level:1}},
 {id:'vehicleStudy',name:'Engineering Report',icon:'🔧',inputs:{distance:110,revenue:180},unlock:{project:'engine',level:1}},
 {id:'depotAudit',name:'Depot Study',icon:'🏢',inputs:{distance:90,revenue:210},unlock:{project:'depotEfficiency',level:1}},
 {id:'brandStudy',name:'Brand Study',icon:'📣',inputs:{passengers:10,revenue:200},unlock:{project:'advertising',level:1}},
 {id:'creditMemo',name:'Financial Assessment',icon:'🏦',inputs:{revenue:600,passengers:4},unlock:{project:'procurement',level:1}},
 {id:'harbourReport',name:'Harbour Report',icon:'⚓',inputs:{ferries:35,roads:25},unlock:{project:'portAnalytics',level:1}},
 {id:'guestProfile',name:'Guest Profile',icon:'🛎️',inputs:{hotels:8,revenue:600},unlock:{project:'occupancyForecast',level:1}},
 {id:'buildReport',name:'Construction Report',icon:'🏗️',inputs:{construction:2,revenue:700},unlock:{project:'modularBuilding',level:1}},
 {id:'corporateReport',name:'Corporate Report',icon:'💼',inputs:{corporate:1,revenue:1000},unlock:{project:'corporateDueDiligence',level:1}},
 {id:'demandForecast',name:'Demand Forecast',icon:'📈',inputs:{revenue:900},parts:{marketBrief:3,fleetReport:2},unlock:{project:'fleetAnalytics',level:2}},
 {id:'navigationModel',name:'Navigation Model',icon:'🧭',inputs:{revenue:1200},parts:{routeReport:3,fleetReport:2},unlock:{project:'survey',level:2}},
 {id:'maintenanceModel',name:'Maintenance Model',icon:'⚙️',inputs:{maintenance:2},parts:{vehicleStudy:3,depotAudit:2},unlock:{project:'engine',level:2}},
 {id:'trafficAnalysis',name:'Traffic Analysis',icon:'🚦',inputs:{revenue:850},parts:{routeReport:3,marketBrief:3},unlock:{project:'peakPricing',level:2}},
 {id:'financialForecast',name:'Financial Forecast',icon:'💹',inputs:{revenue:1200},parts:{creditMemo:3,marketBrief:2},unlock:{project:'procurement',level:2}},
 {id:'hospitalityModel',name:'Hospitality Model',icon:'🏨',inputs:{revenue:950},parts:{guestProfile:3,marketBrief:2},unlock:{project:'occupancyForecast',level:1}},
 {id:'maritimeStudy',name:'Maritime Study',icon:'⛴️',inputs:{revenue:900},parts:{harbourReport:3,routeReport:2},unlock:{project:'portAnalytics',level:1}},
 {id:'propertyPlan',name:'Property Development Plan',icon:'🏘️',inputs:{parking:10},parts:{buildReport:2,depotAudit:2},unlock:{project:'modularBuilding',level:1}},
 {id:'investmentStrategy',name:'Investment Strategy',icon:'📑',inputs:{corporate:1},parts:{creditMemo:3,brandStudy:2},unlock:{project:'corporateDueDiligence',level:1}},
 {id:'integratedMobility',name:'Integrated Mobility System',icon:'🌐',inputs:{revenue:2500},parts:{demandForecast:2,navigationModel:2,trafficAnalysis:1},unlock:{project:'routing',level:2}},
 {id:'advancedVehicleTech',name:'Advanced Vehicle Technology',icon:'🚘',inputs:{distance:800},parts:{maintenanceModel:2,navigationModel:2,vehicleStudy:4},unlock:{project:'durability',level:2}},
 {id:'autonomousFleet',name:'Autonomous Fleet Network',icon:'🤖',inputs:{revenue:3000},parts:{integratedMobility:2,maintenanceModel:2,driverStudy:3},unlock:{project:'regionalReposition',level:1}},
 {id:'tourismNetwork',name:'Tourism Network',icon:'🌴',inputs:{revenue:3500},parts:{hospitalityModel:2,maritimeStudy:2,marketBrief:2},unlock:{project:'tourismPartnerships',level:1}},
 {id:'constructionSystem',name:'Construction Technology System',icon:'🏗️',inputs:{revenue:3000},parts:{propertyPlan:2,buildReport:5,creditMemo:1},unlock:{project:'materialLogistics',level:1}},
 {id:'internationalStrategy',name:'International Research Strategy',icon:'🌍',inputs:{revenue:5000},parts:{investmentStrategy:2,maritimeStudy:2,hospitalityModel:2},unlock:{project:'subsidiaryIntegration',level:1}},
 // New interlinked materials use existing earned operational resources. Each
 // recipe unlocks before any of its consuming technologies, avoiding cycles.
 {id:'ticketingModel',name:'Ticketing Model',icon:'🎟️',inputs:{passengers:20,revenue:500},parts:{marketBrief:2,trafficAnalysis:1},unlock:{project:'fareBundles',level:1}},
 {id:'harbourSchedule',name:'Harbour Schedule',icon:'⚓',inputs:{ferries:50,revenue:400},parts:{maritimeStudy:2,routeReport:2},unlock:{project:'harbourConnections',level:1}},
 {id:'roadTelemetry',name:'Road Telemetry',icon:'🛣️',inputs:{roads:250,distance:200},parts:{navigationModel:2,routeReport:2},unlock:{project:'terrainMapping',level:1}},
 {id:'stayRevenueForecast',name:'Stay Revenue Forecast',icon:'🏨',inputs:{hotels:35,revenue:1200},parts:{hospitalityModel:2,financialForecast:1},unlock:{project:'frontDeskAnalytics',level:1}},
 {id:'parkingFlowModel',name:'Parking Flow Model',icon:'🅿️',inputs:{parking:35,revenue:500},parts:{depotAudit:2,trafficAnalysis:1},unlock:{project:'parkingDemandPrediction',level:1}},
 {id:'creditPortfolioReport',name:'Credit Portfolio Report',icon:'💳',inputs:{passengers:30,revenue:1500},parts:{creditMemo:2,financialForecast:1},unlock:{project:'creditPortfolio',level:1}},
 {id:'fleetReliabilityMap',name:'Fleet Reliability Map',icon:'🛠️',inputs:{maintenance:3,distance:700},parts:{maintenanceModel:2,vehicleStudy:2},unlock:{project:'tyreTelemetry',level:1}},
 {id:'developmentBlueprint',name:'Development Blueprint',icon:'🏗️',inputs:{roads:300,construction:3},parts:{buildReport:2,routeReport:2},unlock:{project:'siteSurveys',level:1}}
];
export const recipeById=new Map<ProductKey,Recipe>(RECIPES.map(r=>[r.id,r]));
export const recipeAvailable=(id:ProductKey,levels:Partial<Record<string,number>>)=>{
 const r=recipeById.get(id);return Boolean(r&&(levels[r.unlock.project]??0)>=r.unlock.level);
};
const basic:readonly ProductKey[]=['marketBrief','vehicleStudy','fleetReport','routeReport',
 'driverStudy','depotAudit','brandStudy','creditMemo','harbourReport','guestProfile','buildReport','corporateReport'];
const mid:readonly ProductKey[]=['demandForecast','maintenanceModel','navigationModel','navigationModel',
 'demandForecast','maintenanceModel','trafficAnalysis','financialForecast','maritimeStudy','hospitalityModel','propertyPlan','investmentStrategy'];
const advanced:readonly ProductKey[]=['integratedMobility','advancedVehicleTech','integratedMobility','integratedMobility',
 'integratedMobility','constructionSystem','tourismNetwork','internationalStrategy','tourismNetwork','tourismNetwork',
 'constructionSystem','integratedMobility'];
const expert:readonly ProductKey[]=['integratedMobility','advancedVehicleTech','autonomousFleet','autonomousFleet',
 'autonomousFleet','constructionSystem','tourismNetwork','internationalStrategy','tourismNetwork','tourismNetwork',
 'constructionSystem','internationalStrategy'];

export function productRequirements(id:string,level:number,legacy:readonly ResearchProject[]):ProductBag{
 const previous=legacy.find(p=>p.id===id);
 const next=newProjects.find(p=>p.id===id);
 const category=previous?.category??next?.category;
 if(category===undefined)return {};
 const tier=previous?level:(next?.tier??1);
 // Newly authored branches deliberately combine different manufactured
 // resources. Legacy technologies retain their original automatic recipes.
 if(next?.products){
  for(const [key,quantity] of Object.entries(next.products))
   if(!recipeById.has(key as ProductKey)||!Number.isFinite(quantity)||quantity<=0)
    throw Error('Invalid manufactured research requirement '+id+' → '+key);
  return {...next.products} as ProductBag;
 }
 if(tier<2)return id==='explorerExpansion'?{navigationModel:2}:{};
 // Never require a product whose recipe is unlocked by the very same
 // technology. Corporate due diligence must open before Corporate Reports
 // can be manufactured, otherwise a fresh company could never progress.
 if(!previous&&(technologyParents(id).length===0||
  recipeById.get(basic[category])?.unlock.project===id))return {};
 const result:ProductBag={};
 const add=(key:ProductKey,n:number)=>{result[key]=(result[key]??0)+n;};
 if(tier===2)add(basic[category],previous?3:5);
 else if(tier===3){add(basic[category],previous?5:7);add(mid[category],previous?2:3);}
 else if(tier===4){add(mid[category],previous?7:9);add(advanced[category],previous?2:3);}
 else{add(mid[category],12);add(expert[category],previous?5:8);}
 return result;
}
export type Ingredient={kind:'raw';key:ResourceKey;count:number}|{kind:'product';key:ProductKey;count:number};
export function recipeIngredients(id:ProductKey):Ingredient[]{
 const r=recipeById.get(id);if(!r)return [];
 return [...Object.entries(r.inputs).map(([key,count])=>({kind:'raw' as const,key:key as ResourceKey,count})),
  ...Object.entries(r.parts??{}).map(([key,count])=>({kind:'product' as const,key:key as ProductKey,count}))];
}
