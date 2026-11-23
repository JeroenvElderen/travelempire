import type {ComponentType,SVGProps} from 'react';
import {
 BarChart3, Banknote, BedDouble, Building2, CalendarDays, CarFront, CheckCheck,
 ClipboardCheck, Coins, Compass, CreditCard, Fuel, Gauge, HardHat, Hotel, Landmark,
 Map, Megaphone, Navigation, Package, Route, Settings2, ShieldCheck, Ship,
 SquareParking, Star, Target, TrendingUp, Truck, Users, Wrench,
} from 'lucide-react';
import type {DivisionKey} from '../researchHierarchy';

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
