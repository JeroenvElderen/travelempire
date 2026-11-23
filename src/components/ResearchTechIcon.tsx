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
};
const CATEGORY_FALLBACK:readonly Glyph[]=[
 Coins,Gauge,CarFront,Compass,Users,Wrench,Megaphone,Landmark,Ship,Hotel,HardHat,Building2,
];
export default function ResearchTechIcon({
 kind,division,projectId,category,level=1,size=27,
}:{
 kind:'starter'|'division'|'research';
 division?:DivisionKey;projectId:string;category:number;level?:number;size?:number;
}){
 const Glyph:Glyph=kind==='starter'?STARTER_ICONS[Math.max(0,Math.min(STARTER_ICONS.length-1,level-1))]:
  kind==='division'?DIVISION_ICONS[division??'revenue']:
  TECH_ICONS[projectId]??CATEGORY_FALLBACK[Math.max(0,Math.min(CATEGORY_FALLBACK.length-1,category))];
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
 constructionSystem:HardHat,internationalStrategy:Landmark
};
export function ResearchResourceIcon({resource,size=18}:{resource:ResourceKey;size?:number}){
 const Icon=RESOURCE_ICONS[resource];
 return <Icon className="factory-vector-icon" aria-hidden="true" size={size} strokeWidth={1.9}/>;
}
export function ResearchProductIcon({product,size=18}:{product:ProductKey;size?:number}){
 const Icon=PRODUCT_ICONS[product]??Package;
 return <Icon className="factory-vector-icon" aria-hidden="true" size={size} strokeWidth={1.9}/>;
}
