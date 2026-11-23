import type {ComponentType,SVGProps} from 'react';
import {
 BarChart3, Banknote, BedDouble, Building2, CalendarDays, CarFront, CheckCheck,
 ClipboardCheck, Coins, Compass, CreditCard, Fuel, Gauge, HardHat, Hotel, Landmark,
 Map, Megaphone, Navigation, Package, Route, Settings2, ShieldCheck, Ship,
 SquareParking, Star, Target, TrendingUp, Truck, Users, Wrench,
} from 'lucide-react';
import type {DivisionKey} from '../researchHierarchy';
import type {ResourceKey} from '../researchProgress';
import type {ProductKey} from '../researchProducts';


/** TravelEmpire's own Aurora Glass icon vocabulary. Unlike the former
 * Builderment-style pixel sprites these are crisp vectors at every zoom.
 * These present existing technologies; they do not affect research logic. */
type Glyph=ComponentType<SVGProps<SVGSVGElement>&{size?:number;strokeWidth?:number}>;
const DIVISION_ICONS:Record<DivisionKey,Glyph>={
 revenue:Coins,taxis:CarFront,explorers:Compass,hotels:Hotel,
 parking:SquareParking,finance:Landmark,vehicles:Wrench,construction:HardHat
};
const STARTER_ICONS:readonly Glyph[]=[Map,CarFront,ClipboardCheck,TrendingUp,Star];
const TECH_ICONS:Readonly<Record<string,Glyph>>={
 pricing:Coins,peakPricing:TrendingUp,premium:Star,longDistance:Route,
 demandIntelligence:BarChart3,airportMarkets:Navigation,corporatePassengers:Users,
 advertising:Megaphone,brand:Target,loyalty:Users,regionalReputation:Star,
 tourismPartnerships:Building2,customerRetention:Users,
 fleetAnalytics:BarChart3,dispatchResearch:CarFront,routing:Route,
 regionalReposition:Navigation,multiDepotDispatch:Building2,
 profitAwareFleet:TrendingUp,trainingResearch:Users,ecoDriving:Fuel,
 defensive:ShieldCheck,driverSpecialisation:Star,
 advancedScheduling:CalendarDays,safetyCertification:ShieldCheck,
 portAnalytics:Ship,ferryTimetabling:CalendarDays,fleetTurnaround:Ship,
 survey:Map,navigation:Compass,patrol:Route,explorerExpansion:Truck,
 coordinatedFrontiers:Navigation,coverageIntelligence:BarChart3,
 harbourSurvey:Ship,
 occupancyForecast:BedDouble,guestExperience:Star,hotelAutomation:Settings2,
 depotEfficiency:Building2,parkingYield:SquareParking,networkLogistics:Route,
 procurement:CreditCard,insuranceResearch:ShieldCheck,efficiency:Gauge,
 creditRiskModels:BarChart3,financeNegotiation:Banknote,treasuryForecast:TrendingUp,
 corporateDueDiligence:ClipboardCheck,subsidiaryIntegration:Building2,
 crossBorderTreasury:Landmark,
 engine:Gauge,fuelInjection:Fuel,durability:ShieldCheck,lubrication:Wrench,
 lightweight:Package,conditionPrediction:Gauge,
 powertrainAdaptation:Fuel,vehicleLifecycle:CarFront,
 workshopResearch:Wrench,parts:Package,preventiveCalendar:CalendarDays,
 modularBuilding:Building2,materialLogistics:Truck,qualityInspection:CheckCheck,
 // Extra original Aurora Glass technology symbols for the new branches.
 fareBundles:Coins,commuterPasses:CreditCard,eventSurgeForecast:TrendingUp,
 vipTransfers:Star,destinationPackages:Map,
 smartPooling:Users,fleetShiftHandover:CalendarDays,harbourConnections:Ship,
 interIslandTickets:CreditCard,hubTransfers:Route,premiumFerryServices:Star,
 terrainMapping:Map,expeditionPlanning:Compass,roadGraphInference:Route,islandRecon:Ship,
 frontDeskAnalytics:ClipboardCheck,roomYield:TrendingUp,conciergeNetwork:Users,resortOperations:Hotel,
 parkingDemandPrediction:BarChart3,smartTariffs:Coins,automatedAccess:SquareParking,
 hotelParkingPackages:Hotel,
 liquiditySignals:TrendingUp,creditPortfolio:CreditCard,financeAutomation:Settings2,
 assetBackedFunding:Landmark,globalSettlement:Building2,
 tyreTelemetry:Gauge,hybridPowertrains:Fuel,partsStandardisation:Package,fleetLifecycleAI:CarFront,
 siteSurveys:Map,greenBuildings:Building2,supplyChains:Truck,prefabHotels:Hotel,
 mixedUseProjects:Building2,
};
const CATEGORY_FALLBACK:readonly Glyph[]=[
 Coins,Gauge,CarFront,Compass,Users,Wrench,Megaphone,Landmark,Ship,Hotel,HardHat,Building2,
];
/** Distinguish all newly researched items by subject, without relying on
 * platform-dependent emojis or a wall of identical category pictograms.
 */
const topicIcon=(id:string,category:number):Glyph=>{
 const text=id.replace(/([A-Z])/g,' $1').toLowerCase();
 if(/island|harbour|maritime|ferry|port|berth/.test(text))return Ship;
 if(/hotel|guest|room|resort|conference|reservation|concierge|hospitality/.test(text))return Hotel;
 if(/parking|valet|park ride|sensor/.test(text))return SquareParking;
 if(/bank|funding|lending|loan|liquidity|credit|treasury|capital|settlement|finance/.test(text))return Landmark;
 if(/fleet|taxi|driver|dispatch|vehicle|passenger|transfer/.test(text))return CarFront;
 if(/tyre|battery|fuel|brake|engine|component|workshop|reliability/.test(text))return Wrench;
 if(/mapping|atlas|recon|road|route|traffic|survey|terrain/.test(text))return Map;
 if(/demand|price|fare|yield|revenue|forecast|subscription/.test(text))return TrendingUp;
 if(/construction|contractor|material|build|site|structural|procurement/.test(text))return HardHat;
 if(/loyalty|family|travel|journey|destination/.test(text))return Users;
 if(/planning|coordination|operations|automation/.test(text))return Settings2;
 return CATEGORY_FALLBACK[Math.max(0,Math.min(CATEGORY_FALLBACK.length-1,category))];
};
export default function ResearchTechIcon({
 kind,division,projectId,category,level=1,size=27,
}:{
 kind:'starter'|'division'|'research';
 division?:DivisionKey;projectId:string;category:number;level?:number;size?:number;
}){
 const Glyph:Glyph=kind==='starter'?STARTER_ICONS[Math.max(0,Math.min(STARTER_ICONS.length-1,level-1))]:
  kind==='division'?DIVISION_ICONS[division??'revenue']:
  TECH_ICONS[projectId]??topicIcon(projectId,category);
 return <Glyph aria-hidden="true" size={size} strokeWidth={kind==='division'?2.2:1.9}
  className="factory-vector-icon"/>;
}

/** Raw operating resources and manufactured research ingredients share the
 * same line icon treatment as the tree, without changing underlying data. */
const RESOURCE_ICONS:Record<ResourceKey,Glyph>={
 roads:Route,passengers:CarFront,revenue:Coins,parking:SquareParking,
 hotels:Hotel,ferries:Ship,distance:Compass,maintenance:Wrench,
 construction:HardHat,corporate:Building2,
};
const PRODUCT_ICONS:Partial<Record<ProductKey,Glyph>>={
 marketBrief:ClipboardCheck,routeReport:Map,fleetReport:BarChart3,
 driverStudy:Users,vehicleStudy:Gauge,depotAudit:Building2,
 brandStudy:Megaphone,creditMemo:Landmark,harbourReport:Ship,
 guestProfile:BedDouble,buildReport:HardHat,corporateReport:Building2,
 demandForecast:TrendingUp,navigationModel:Compass,maintenanceModel:Wrench,
 trafficAnalysis:Route,financialForecast:Banknote,hospitalityModel:Hotel,
 maritimeStudy:Ship,propertyPlan:Building2,investmentStrategy:CreditCard,
 integratedMobility:Navigation,advancedVehicleTech:Gauge,
 autonomousFleet:CarFront,tourismNetwork:Map,
 constructionSystem:HardHat,internationalStrategy:Landmark,
 ticketingModel:CreditCard,harbourSchedule:Ship,roadTelemetry:Route,
 stayRevenueForecast:TrendingUp,parkingFlowModel:SquareParking,
 creditPortfolioReport:Landmark,fleetReliabilityMap:Wrench,developmentBlueprint:HardHat,
 fareMatrix:TrendingUp,dispatchProtocol:Route,cartographyAtlas:Map,
 guestJourneyMap:Hotel,parkingAutomationPlan:SquareParking,
 bankRiskGrid:Landmark,componentBlueprint:Wrench,siteDigitalTwin:Building2
};
export function ResearchResourceIcon({resource,size=18}:{resource:ResourceKey;size?:number}){
 const Icon=RESOURCE_ICONS[resource];
 return <Icon className="factory-vector-icon" aria-hidden="true" size={size} strokeWidth={1.9}/>;
}
export function ResearchProductIcon({product,size=18}:{product:ProductKey;size?:number}){
 const Icon=PRODUCT_ICONS[product]??Package;
 return <Icon className="factory-vector-icon" aria-hidden="true" size={size} strokeWidth={1.9}/>;
}
