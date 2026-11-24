import type {CollectorState} from './resourceCollectors';
import {MEGA_RESEARCH_BRANCHES} from './researchMegaCatalog';

/**
 * Resource-driven Research Centre. All resources originate in settled company
 * operations. The selected technology receives them automatically, excess is
 * retained and the queue advances without manual resource deposits.
 */
export const RESOURCE_INFO={
 roads:{name:'Road Data',icon:'map',unit:'segments'},
 passengers:{name:'Taxi Drop-offs',icon:'car-front',unit:'trips'},
 revenue:{name:'Cash Earned',icon:'coins',unit:'€'},
 parking:{name:'Parking Guests',icon:'square-parking',unit:'space-hours'},
 hotels:{name:'Hotel Guests',icon:'hotel',unit:'stays'},
 ferries:{name:'Ferry Guests',icon:'ship',unit:'passengers'},
 distance:{name:'Distance Travelled',icon:'gauge',unit:'km'},
 maintenance:{name:'Vehicle Services',icon:'wrench',unit:'jobs'},
 construction:{name:'Construction Milestones',icon:'hard-hat',unit:'milestones'},
 corporate:{name:'Corporate Milestones',icon:'building-2',unit:'events'}
} as const;
export type ResourceKey=keyof typeof RESOURCE_INFO;
export type ResourceBag=Record<ResourceKey,number>;
export const EMPTY_RESOURCES:ResourceBag={roads:0,passengers:0,revenue:0,parking:0,hotels:0,ferries:0,distance:0,maintenance:0,construction:0,corporate:0};
export const resourceKeys=Object.keys(RESOURCE_INFO) as ResourceKey[];
export type ResourceCosts=Partial<Record<ResourceKey,number>>;
export type AdvancedProject={
 id:string;name:string;category:number;tier:number;requires:readonly string[];
 resources:ResourceCosts;effect:string;bonus:'taxi'|'energy'|'maintenance'|'explorer'|'depot'|'parking'|'hotel'|'ferry'|'construction'|'finance'|'corporate';
 rate:number;
 /** Optional explicitly composed research products for new branches. */
 products?:Readonly<Record<string,number>>;
};
export const newProjects:readonly AdvancedProject[]=[
 {id:'demandIntelligence',name:'Passenger Demand Intelligence',category:0,tier:1,requires:['pricing'],resources:{passengers:50,roads:300,revenue:5000},effect:'Improve passenger fares by 2% through regional demand analysis',bonus:'taxi',rate:.02},
 {id:'airportMarkets',name:'Airport & Event Markets',category:0,tier:3,requires:['demandIntelligence','premium'],resources:{passengers:400,roads:1500,revenue:50000},effect:'Improve premium passenger revenue by 3%',bonus:'taxi',rate:.03},
 {id:'corporatePassengers',name:'Corporate Passenger Contracts',category:0,tier:4,requires:['airportMarkets'],resources:{passengers:2000,revenue:300000},effect:'Improve passenger earnings by 4%',bonus:'taxi',rate:.04},
 {id:'conditionPrediction',name:'Condition Prediction',category:1,tier:2,requires:['durability'],resources:{distance:2000,maintenance:10,revenue:20000},effect:'Reduce maintenance spending by 3% using condition records',bonus:'maintenance',rate:.03},
 {id:'powertrainAdaptation',name:'Powertrain Adaptation',category:1,tier:3,requires:['engine'],resources:{distance:5000,maintenance:20,revenue:60000},effect:'Reduce energy consumption by 3%',bonus:'energy',rate:.03},
 {id:'vehicleLifecycle',name:'Vehicle Lifecycle Management',category:1,tier:4,requires:['conditionPrediction','powertrainAdaptation'],resources:{distance:20000,maintenance:100,revenue:400000},effect:'Reduce vehicle maintenance spending by 5%',bonus:'maintenance',rate:.05},
 {id:'regionalReposition',name:'Regional Repositioning',category:2,tier:2,requires:['fleetAnalytics','routing'],resources:{passengers:300,roads:1500,revenue:35000},effect:'Improve fleet passenger income by 2%',bonus:'taxi',rate:.02},
 {id:'multiDepotDispatch',name:'Multi-Depot Dispatch',category:2,tier:3,requires:['regionalReposition'],resources:{passengers:1000,roads:8000,revenue:120000},effect:'Improve fleet passenger income by 3%',bonus:'taxi',rate:.03},
 {id:'profitAwareFleet',name:'Profit-Aware Fleet Network',category:2,tier:5,requires:['multiDepotDispatch','demandIntelligence'],resources:{passengers:5000,roads:25000,revenue:900000},effect:'Improve fleet passenger income by 5%',bonus:'taxi',rate:.05},
 {id:'coordinatedFrontiers',name:'Coordinated Frontiers',category:3,tier:2,requires:['survey','navigation'],resources:{roads:4000,distance:2000,revenue:40000},effect:'Lower explorer operating charges by 5%',bonus:'explorer',rate:.05},
 {id:'coverageIntelligence',name:'Road Coverage Intelligence',category:3,tier:3,requires:['coordinatedFrontiers'],resources:{roads:10000,distance:8000,revenue:120000},effect:'Lower explorer operating charges by 5%',bonus:'explorer',rate:.05},
 {id:'harbourSurvey',name:'Harbour Access Survey',category:3,tier:4,requires:['coverageIntelligence'],resources:{roads:20000,distance:15000,revenue:300000},effect:'Lower explorer travel charges by 6%',bonus:'explorer',rate:.06},
 {id:'driverSpecialisation',name:'Driver Specialisation',category:4,tier:2,requires:['trainingResearch'],resources:{passengers:150,distance:4000,revenue:15000},effect:'Increase passenger income by 2%',bonus:'taxi',rate:.02},
 {id:'advancedScheduling',name:'Advanced Scheduling',category:4,tier:3,requires:['driverSpecialisation'],resources:{passengers:600,distance:20000,revenue:60000},effect:'Increase passenger income by 2%',bonus:'taxi',rate:.02},
 {id:'safetyCertification',name:'Safety & Certification',category:4,tier:4,requires:['advancedScheduling','defensive'],resources:{passengers:2000,maintenance:100,revenue:150000},effect:'Reduce maintenance spending by 4%',bonus:'maintenance',rate:.04},
 {id:'preventiveCalendar',name:'Preventive Service Calendar',category:5,tier:2,requires:['workshopResearch'],resources:{maintenance:20,distance:2500,revenue:20000},effect:'Reduce maintenance spending by 3%',bonus:'maintenance',rate:.03},
 {id:'parkingYield',name:'Parking Yield Management',category:5,tier:3,requires:['depotEfficiency'],resources:{parking:500,revenue:75000},effect:'Increase parking returns by 4%',bonus:'parking',rate:.04},
 {id:'networkLogistics',name:'Network Logistics',category:5,tier:4,requires:['preventiveCalendar','depotEfficiency'],resources:{passengers:2000,roads:5000,revenue:180000},effect:'Reduce depot operating charges by 4%',bonus:'depot',rate:.04},
 {id:'regionalReputation',name:'Regional Reputation',category:6,tier:1,requires:['advertising'],resources:{passengers:100,revenue:10000},effect:'Improve passenger income by 2%',bonus:'taxi',rate:.02},
 {id:'tourismPartnerships',name:'Tourism Partnerships',category:6,tier:3,requires:['regionalReputation'],resources:{revenue:75000},effect:'Increase hotel and ferry income by 3%',bonus:'hotel',rate:.03},
 {id:'customerRetention',name:'Customer Retention Intelligence',category:6,tier:4,requires:['regionalReputation','loyalty'],resources:{passengers:1000,revenue:150000},effect:'Increase passenger income by 3%',bonus:'taxi',rate:.03},
 {id:'creditRiskModels',name:'Credit Risk Models',category:7,tier:2,requires:['procurement'],resources:{passengers:100,revenue:50000},effect:'Reduce vehicle financing servicing overhead through improved treasury analysis',bonus:'finance',rate:.02},
 {id:'financeNegotiation',name:'Vehicle Finance Negotiation',category:7,tier:3,requires:['creditRiskModels'],resources:{distance:1500,maintenance:40,revenue:300000},effect:'Support better quoted vehicle finance rates (up to 0.5 percentage points)',bonus:'finance',rate:.03},
 {id:'treasuryForecast',name:'Treasury Forecasting',category:7,tier:4,requires:['creditRiskModels','efficiency'],resources:{passengers:2000,revenue:1000000},effect:'Reduce eligible financing interest charges through treasury planning',bonus:'finance',rate:.03},
 {id:'portAnalytics',name:'Port Analytics',category:8,tier:1,requires:[],resources:{passengers:100,roads:1000,revenue:20000},effect:'Improve ferry fare revenue by 2%',bonus:'ferry',rate:.02},
 {id:'ferryTimetabling',name:'Ferry Timetabling',category:8,tier:3,requires:['portAnalytics'],resources:{ferries:1000,revenue:90000},effect:'Improve ferry fare revenue by 3%',bonus:'ferry',rate:.03},
 {id:'fleetTurnaround',name:'Ferry Fleet Turnaround',category:8,tier:4,requires:['ferryTimetabling'],resources:{ferries:8000,roads:15000,revenue:500000},effect:'Improve ferry fare revenue by 5%',bonus:'ferry',rate:.05},
 {id:'occupancyForecast',name:'Occupancy Forecasting',category:9,tier:1,requires:[],resources:{hotels:100,revenue:30000},effect:'Improve managed hotel room revenue by 2%',bonus:'hotel',rate:.02},
 {id:'guestExperience',name:'Guest Experience',category:9,tier:3,requires:['occupancyForecast'],resources:{hotels:400,revenue:100000},effect:'Improve managed hotel revenue by 3%',bonus:'hotel',rate:.03},
 {id:'hotelAutomation',name:'Hotel Operations Automation',category:9,tier:4,requires:['guestExperience'],resources:{hotels:2000,revenue:500000},effect:'Improve managed hotel revenue by 5%',bonus:'hotel',rate:.05},
 {id:'modularBuilding',name:'Modular Building',category:10,tier:2,requires:[],resources:{roads:800,revenue:50000},effect:'Reduce eligible construction project costs by 2%',bonus:'construction',rate:.02},
 {id:'materialLogistics',name:'Material Logistics',category:10,tier:3,requires:['modularBuilding'],resources:{construction:25,roads:3000,revenue:150000},effect:'Reduce eligible construction project costs by 3%',bonus:'construction',rate:.03},
 {id:'qualityInspection',name:'Quality & Inspection',category:10,tier:4,requires:['materialLogistics'],resources:{construction:75,revenue:600000},effect:'Reduce eligible construction project costs by 4%',bonus:'construction',rate:.04},
 {id:'corporateDueDiligence',name:'Corporate Due Diligence',category:11,tier:2,requires:[],resources:{corporate:1,revenue:150000},effect:'Improve oversight of corporate overhead by 2%',bonus:'corporate',rate:.02},
 {id:'subsidiaryIntegration',name:'Subsidiary Integration',category:11,tier:4,requires:['corporateDueDiligence'],resources:{corporate:3,revenue:500000},effect:'Improve corporate operating results by 3%',bonus:'corporate',rate:.03},
 {id:'crossBorderTreasury',name:'Cross-Border Treasury',category:11,tier:5,requires:['subsidiaryIntegration'],resources:{corporate:10,revenue:1000000},effect:'Improve corporate operating results by 5%',bonus:'corporate',rate:.05},
 {id:"fareBundles",name:"Fare Bundles",category:0,tier:2,requires:["peakPricing"],resources:{"passengers":180,"revenue":15000,"roads":500},products:{"marketBrief":4,"trafficAnalysis":1},effect:"Additional +2% passenger fares through combined trip tickets",bonus:"taxi",rate:0.02},
 {id:"commuterPasses",name:"Commuter Passes",category:0,tier:3,requires:["fareBundles","loyalty"],resources:{"passengers":550,"revenue":70000,"roads":1400},products:{"ticketingModel":4,"brandStudy":3},effect:"Additional +2% passenger fares from recurring traveller packages",bonus:"taxi",rate:0.02},
 {id:"eventSurgeForecast",name:"Event Surge Forecasting",category:0,tier:3,requires:["demandIntelligence","peakPricing","fleetAnalytics"],resources:{"passengers":650,"revenue":95000,"roads":3000},products:{"trafficAnalysis":2,"demandForecast":1},effect:"Additional +3% taxi fares using demand and fleet forecasting",bonus:"taxi",rate:0.03},
 {id:"vipTransfers",name:"VIP Transfers",category:0,tier:4,requires:["airportMarkets","premium"],resources:{"passengers":1500,"revenue":240000,"roads":5500},products:{"trafficAnalysis":2,"marketBrief":5},effect:"Additional +3% passenger fares for premium transfers",bonus:"taxi",rate:0.03},
 {id:"destinationPackages",name:"Destination Packages",category:0,tier:4,requires:["tourismPartnerships","airportMarkets","fareBundles"],resources:{"hotels":250,"ferries":200,"passengers":1000,"revenue":300000},products:{"tourismNetwork":2,"ticketingModel":2},effect:"Additional +3% hotel revenue through combined travel packages",bonus:"hotel",rate:0.03},
 {id:"smartPooling",name:"Shared-Ride Dispatch",category:2,tier:2,requires:["routing","dispatchResearch","survey"],resources:{"passengers":450,"roads":1800,"distance":2000,"revenue":32000},products:{"fleetReport":4,"routeReport":3},effect:"Additional +2% taxi income through efficient shared-trip allocation",bonus:"taxi",rate:0.02},
 {id:"fleetShiftHandover",name:"Fleet Shift Handover",category:4,tier:3,requires:["advancedScheduling","driverSpecialisation"],resources:{"passengers":1100,"distance":9000,"revenue":110000},products:{"driverStudy":4,"fleetReport":3},effect:"Additional +2% taxi income from more consistent driver operations",bonus:"taxi",rate:0.02},
 {id:"harbourConnections",name:"Harbour Connections",category:8,tier:2,requires:["portAnalytics","routing"],resources:{"ferries":300,"roads":1700,"passengers":300,"revenue":38000},products:{"maritimeStudy":2,"routeReport":3},effect:"Additional +2% ferry income from improved port connections",bonus:"ferry",rate:0.02},
 {id:"interIslandTickets",name:"Inter-Island Tickets",category:8,tier:4,requires:["ferryTimetabling","harbourConnections","tourismPartnerships"],resources:{"ferries":1800,"hotels":140,"revenue":210000},products:{"harbourSchedule":3,"tourismNetwork":2},effect:"Additional +3% ferry revenue from island-hopping ticket bundles",bonus:"ferry",rate:0.03},
 {id:"hubTransfers",name:"Transfer Hub Coordination",category:2,tier:4,requires:["multiDepotDispatch","smartPooling"],resources:{"passengers":2400,"roads":11000,"revenue":330000},products:{"integratedMobility":2,"fleetReport":4},effect:"Additional +3% taxi revenue through coordinated transfer hubs",bonus:"taxi",rate:0.03},
 {id:"premiumFerryServices",name:"Premium Ferry Services",category:8,tier:5,requires:["interIslandTickets","guestExperience"],resources:{"ferries":7000,"hotels":550,"revenue":850000},products:{"harbourSchedule":5,"tourismNetwork":3},effect:"Additional +3% ferry revenue from premium ferry experiences",bonus:"ferry",rate:0.03},
 {id:"terrainMapping",name:"Terrain Mapping",category:3,tier:2,requires:["navigation","survey"],resources:{"roads":2500,"distance":1500,"revenue":35000},products:{"navigationModel":2,"routeReport":5},effect:"Reduce explorer operating charges a further 3% through terrain mapping",bonus:"explorer",rate:0.03},
 {id:"expeditionPlanning",name:"Expedition Planning",category:3,tier:3,requires:["coordinatedFrontiers","explorerExpansion","terrainMapping"],resources:{"roads":6500,"distance":6500,"revenue":125000},products:{"roadTelemetry":3,"navigationModel":2},effect:"Reduce explorer operating charges a further 3% by improving expedition planning",bonus:"explorer",rate:0.03},
 {id:"roadGraphInference",name:"Road-Graph Inference",category:3,tier:4,requires:["coverageIntelligence","terrainMapping"],resources:{"roads":17000,"distance":13000,"revenue":325000},products:{"roadTelemetry":5,"routeReport":6},effect:"Reduce explorer operating charges a further 4% from connected-road intelligence",bonus:"explorer",rate:0.04},
 {id:"islandRecon",name:"Island Reconnaissance",category:3,tier:5,requires:["harbourSurvey","expeditionPlanning","portAnalytics"],resources:{"roads":29000,"distance":23000,"ferries":500,"revenue":680000},products:{"roadTelemetry":5,"maritimeStudy":2},effect:"Reduce explorer operating charges a further 4% on island networks",bonus:"explorer",rate:0.04},
 {id:"frontDeskAnalytics",name:"Front Desk Analytics",category:9,tier:2,requires:["occupancyForecast"],resources:{"hotels":160,"revenue":45000},products:{"guestProfile":3,"marketBrief":2},effect:"Additional +2% hotel revenue through improved guest arrivals",bonus:"hotel",rate:0.02},
 {id:"roomYield",name:"Room Yield Optimisation",category:9,tier:3,requires:["frontDeskAnalytics","occupancyForecast"],resources:{"hotels":550,"revenue":145000},products:{"hospitalityModel":3,"guestProfile":5},effect:"Additional +3% hotel revenue through better room revenue forecasts",bonus:"hotel",rate:0.03},
 {id:"conciergeNetwork",name:"Concierge Network",category:9,tier:4,requires:["guestExperience","tourismPartnerships"],resources:{"hotels":1400,"ferries":250,"revenue":345000},products:{"tourismNetwork":2,"hospitalityModel":3},effect:"Additional +3% hotel revenue through connected guest services",bonus:"hotel",rate:0.03},
 {id:"resortOperations",name:"Resort Operations",category:9,tier:5,requires:["hotelAutomation","roomYield","conciergeNetwork","procurement"],resources:{"hotels":5500,"revenue":1100000},products:{"stayRevenueForecast":3,"tourismNetwork":3},effect:"Additional +4% hotel revenue through integrated resort operations",bonus:"hotel",rate:0.04},
 {id:"parkingDemandPrediction",name:"Parking Demand Prediction",category:5,tier:2,requires:["parkingYield"],resources:{"parking":650,"revenue":85000},products:{"depotAudit":5},effect:"Additional +2% parking income from local demand forecasting",bonus:"parking",rate:0.02},
 {id:"smartTariffs",name:"Smart Parking Tariffs",category:5,tier:3,requires:["parkingDemandPrediction","peakPricing"],resources:{"parking":1800,"passengers":300,"revenue":230000},products:{"parkingFlowModel":3,"trafficAnalysis":2},effect:"Additional +3% parking income from dynamic tariffs",bonus:"parking",rate:0.03},
 {id:"automatedAccess",name:"Automated Parking Access",category:5,tier:3,requires:["parkingYield","workshopResearch","engine"],resources:{"parking":1500,"maintenance":25,"revenue":220000},products:{"depotAudit":4,"vehicleStudy":3},effect:"Additional +3% parking income from automated parking access",bonus:"parking",rate:0.03},
 {id:"hotelParkingPackages",name:"Hotel Parking Packages",category:5,tier:4,requires:["smartTariffs","roomYield"],resources:{"parking":3800,"hotels":900,"revenue":520000},products:{"parkingFlowModel":4,"hospitalityModel":3},effect:"Additional +4% parking income through accommodation bundles",bonus:"parking",rate:0.04},
 {id:"liquiditySignals",name:"Liquidity Signals",category:7,tier:2,requires:["procurement"],resources:{"passengers":300,"revenue":65000},products:{"financialForecast":2,"creditMemo":3},effect:"Reduce vehicle financing APR by a further 0.10 percentage points",bonus:"finance",rate:0.02},
 {id:"creditPortfolio",name:"Credit Portfolio Analytics",category:7,tier:3,requires:["creditRiskModels","liquiditySignals"],resources:{"passengers":700,"revenue":210000},products:{"financialForecast":3,"creditMemo":5},effect:"Reduce vehicle financing APR by a further 0.15 percentage points",bonus:"finance",rate:0.03},
 {id:"financeAutomation",name:"Finance Automation",category:7,tier:3,requires:["liquiditySignals","efficiency"],resources:{"revenue":340000,"distance":3300},products:{"financialForecast":3,"creditMemo":4},effect:"Reduce vehicle financing APR by a further 0.10 percentage points",bonus:"finance",rate:0.02},
 {id:"assetBackedFunding",name:"Asset-Backed Funding",category:7,tier:4,requires:["financeNegotiation","creditPortfolio","treasuryForecast"],resources:{"maintenance":80,"passengers":1200,"revenue":720000},products:{"creditPortfolioReport":3,"financialForecast":4},effect:"Reduce vehicle financing APR by a further 0.20 percentage points",bonus:"finance",rate:0.04},
 {id:"globalSettlement",name:"Global Settlement Network",category:7,tier:5,requires:["assetBackedFunding","crossBorderTreasury"],resources:{"corporate":9,"passengers":2500,"revenue":1800000},products:{"creditPortfolioReport":4,"internationalStrategy":2},effect:"Reduce vehicle financing APR by a further 0.20 percentage points",bonus:"finance",rate:0.04},
 {id:"tyreTelemetry",name:"Tyre Telemetry",category:1,tier:3,requires:["conditionPrediction","durability","engine"],resources:{"maintenance":35,"distance":9000,"revenue":155000},products:{"maintenanceModel":3,"vehicleStudy":5},effect:"Reduce vehicle maintenance spending a further 3% with tyre telemetry",bonus:"maintenance",rate:0.03},
 {id:"hybridPowertrains",name:"Hybrid Powertrains",category:1,tier:4,requires:["powertrainAdaptation","fuelInjection","durability"],resources:{"maintenance":65,"distance":19000,"revenue":470000},products:{"advancedVehicleTech":3,"vehicleStudy":5},effect:"Reduce vehicle fuel consumption a further 3% through powertrain upgrades",bonus:"energy",rate:0.03},
 {id:"partsStandardisation",name:"Parts Standardisation",category:1,tier:3,requires:["parts","lightweight"],resources:{"maintenance":50,"distance":10000,"revenue":170000},products:{"vehicleStudy":5,"depotAudit":3},effect:"Reduce vehicle maintenance costs a further 3% through standardised parts",bonus:"maintenance",rate:0.03},
 {id:"fleetLifecycleAI",name:"Fleet Lifecycle Intelligence",category:1,tier:5,requires:["vehicleLifecycle","tyreTelemetry","partsStandardisation"],resources:{"maintenance":155,"distance":45000,"revenue":1150000},products:{"fleetReliabilityMap":3,"advancedVehicleTech":2},effect:"Reduce vehicle maintenance spending a further 4% with lifecycle intelligence",bonus:"maintenance",rate:0.04},
 {id:"siteSurveys",name:"Site Surveys",category:10,tier:2,requires:["modularBuilding","survey"],resources:{"roads":3300,"construction":10,"revenue":100000},products:{"buildReport":3,"routeReport":3},effect:"Reduce construction spending a further 2% with site surveying",bonus:"construction",rate:0.02},
 {id:"greenBuildings",name:"Green Buildings",category:10,tier:3,requires:["siteSurveys","materialLogistics"],resources:{"construction":55,"roads":5000,"revenue":330000},products:{"developmentBlueprint":2,"buildReport":4},effect:"Reduce construction spending a further 3% through greener projects",bonus:"construction",rate:0.03},
 {id:"supplyChains",name:"Construction Supply Chains",category:10,tier:3,requires:["materialLogistics","siteSurveys"],resources:{"construction":70,"roads":6500,"revenue":380000},products:{"developmentBlueprint":3,"depotAudit":4},effect:"Reduce construction spending a further 3% using connected material logistics",bonus:"construction",rate:0.03},
 {id:"prefabHotels",name:"Prefabricated Hotels",category:10,tier:4,requires:["qualityInspection","guestExperience","siteSurveys"],resources:{"construction":190,"hotels":750,"revenue":950000},products:{"developmentBlueprint":4,"hospitalityModel":3},effect:"Reduce construction spending a further 4% through prefabricated hospitality",bonus:"construction",rate:0.04},
 {id:"mixedUseProjects",name:"Mixed-Use Developments",category:10,tier:5,requires:["prefabHotels","greenBuildings","parkingYield"],resources:{"construction":360,"parking":2300,"hotels":1250,"revenue":2200000},products:{"propertyPlan":3,"developmentBlueprint":4},effect:"Reduce construction spending a further 4% on integrated mixed-use developments",bonus:"construction",rate:0.04},
 {"id":"collectorBasics","name":"Collector Operations","category":2,"tier":1,"requires":[],"resources":{"roads":150,"revenue":2500},"effect":"Unlock light vans and up to 3 collectors","bonus":"depot","rate":0,"products":{}},
 {"id":"collectorMedium","name":"Medium Cargo Vans","category":2,"tier":2,"requires":["collectorBasics"],"resources":{"roads":500,"revenue":8000},"effect":"Unlock medium collector vans","bonus":"depot","rate":0,"products":{}},
 {"id":"collectorHeavy","name":"Heavy Cargo Trucks","category":2,"tier":3,"requires":["collectorMedium","collectorCargo"],"resources":{"roads":1500,"revenue":25000},"effect":"Unlock heavy collector trucks","bonus":"depot","rate":0,"products":{}},
 {"id":"collectorUtility","name":"Utility Collection Vehicles","category":2,"tier":2,"requires":["collectorBasics"],"resources":{"roads":900,"revenue":12000},"effect":"Unlock utility collector pickups","bonus":"depot","rate":0,"products":{}},
 {"id":"collectorCargo","name":"Cargo Optimisation","category":2,"tier":2,"requires":["collectorBasics"],"resources":{"roads":400,"revenue":6000},"effect":"Increase all collector cargo capacities by 25%","bonus":"depot","rate":0,"products":{}},
 {"id":"collectorLoading","name":"Loading Efficiency","category":2,"tier":3,"requires":["collectorCargo"],"resources":{"roads":900,"revenue":14000},"effect":"Reduce collection handling time","bonus":"depot","rate":0,"products":{}},
 {"id":"collectorPriority","name":"Resource Priorities","category":2,"tier":2,"requires":["collectorBasics"],"resources":{"roads":300,"revenue":5000},"effect":"Choose a resource for each collector","bonus":"depot","rate":0,"products":{}},
 {"id":"collectorRouting","name":"Smart Collector Routing","category":2,"tier":3,"requires":["collectorPriority"],"resources":{"roads":1200,"revenue":16000},"effect":"Improve collector travel speed by 15%","bonus":"depot","rate":0,"products":{}},
 {"id":"collectorDispatch","name":"Fleet Dispatch Expansion","category":2,"tier":3,"requires":["collectorMedium","collectorPriority"],"resources":{"roads":1800,"revenue":30000},"effect":"Increase collector fleet limit to 6","bonus":"depot","rate":0,"products":{}},
 {"id":"collectorRegional","name":"Regional Collector Network","category":2,"tier":4,"requires":["collectorDispatch","collectorHeavy","collectorRouting"],"resources":{"roads":4000,"revenue":70000},"effect":"Increase collector fleet limit to 12","bonus":"depot","rate":0,"products":{}},
 ...MEGA_RESEARCH_BRANCHES
] as const;

/** Genuine links for existing programmes, preserved on older saves.
 * Completed legacy levels remain completed even when a newly added parent
 * technology has not yet been researched.
 */
export const legacyTechnologyLinks:Readonly<Record<string,readonly string[]>>={
 peakPricing:['pricing'],premium:['peakPricing'],longDistance:['premium'],
 fuelInjection:['engine'],durability:['engine'],lubrication:['durability'],lightweight:['engine'],
 dispatchResearch:['fleetAnalytics'],routing:['dispatchResearch'],
 navigation:['survey'],patrol:['navigation'],explorerExpansion:['navigation'],
 ecoDriving:['trainingResearch'],defensive:['trainingResearch'],
 workshopResearch:['depotEfficiency'],parts:['workshopResearch'],
 brand:['advertising'],loyalty:['brand'],
 insuranceResearch:['procurement'],efficiency:['procurement']
};
/** A small foundation opens first, then branches split and join as company
 * operations diversify. These are research prerequisites, not hard locks on
 * already-functional gameplay or previously completed save levels.
 */
export const hierarchyFoundationLinks:Readonly<Record<string,readonly string[]>>={
 // Passenger revenue and financial research form independent paths.
 // Fleet operations, surveying and depots need not be linked to those paths.
 trainingResearch:['fleetAnalytics'],
 advertising:['pricing'],
 engine:['depotEfficiency'],
 portAnalytics:['survey'],
 occupancyForecast:['advertising'],
 modularBuilding:['depotEfficiency'],
 corporateDueDiligence:['procurement'],
 // A three-way merge followed by two different branches: regional operations
 // demand fleet analytics, route optimisation and actual navigation research.
 regionalReposition:['navigation'],
 advancedScheduling:['regionalReposition'],
 profitAwareFleet:['advancedScheduling']
};
export function technologyParents(id:string):readonly string[]{
 const primary=newProjects.find(p=>p.id===id)?.requires??legacyTechnologyLinks[id]??[];
 return [...new Set([...primary,...(hierarchyFoundationLinks[id]??[])])];
}
export const ADVANCED_CATEGORIES=['Passenger Markets & Pricing','Vehicle Engineering','Fleet Management & Dispatch','Exploration & Cartography','Drivers & Personnel','Depots, Maintenance & Parking','Marketing & Reputation','Banking & Financial Technology','Maritime & Ports','Hotels & Hospitality','Construction & Property','Corporate & International'] as const;
export type ResearchSnapshot=ResourceBag;
export type ResourceState={
 collector?:CollectorState;
 resources?:ResourceBag;earned?:ResourceBag;sourceSnapshot?:ResourceBag;
 contributions?:Record<string,ResourceCosts>;selected?:string;queue?:string[];
 researchV3?:true;
 automaticVersion?:1;starterLevel?:number;
 resourceCursor?:Partial<Record<ResourceKey,number>>;
 /** Versioned production-chain resource accounting. All inventories persist. */
 productVersion?:1;
 productInventory?:Record<string,number>;
 productProduced?:Record<string,number>;
 productConsumed?:Record<string,number>;
 productContributions?:Record<string,Record<string,number>>;
 productRawSpent?:ResourceBag;
 productCursor?:number;
};
export type ResearchProject={id:string;name:string;category:number;effect:string;base:number};
export type OperationalContext={explorers:number;roads:number;depots:number;freshStart?:boolean;starterLevel?:number};

export const safeBag=(bag?:ResourceCosts):ResourceBag=>Object.fromEntries(resourceKeys.map(k=>[k,Math.max(0,Number(bag?.[k]??0)||0)])) as ResourceBag;
export const allResearch=(legacy:readonly ResearchProject[])=>[...legacy,...newProjects];
export function maximum(id:string){return id==='explorerExpansion'||newProjects.some(p=>p.id===id)?1:5;}
export function researchCosts(id:string,l:number,legacy:readonly ResearchProject[]):ResourceCosts{
 const project=newProjects.find(p=>p.id===id);
 if(project)return project.resources;
 const old=legacy.find(p=>p.id===id);
 if(!old)return {};
 const factor=Math.pow(2.25,Math.max(0,l-1));
 const base:ResourceCosts=old.category===0?{passengers:40,revenue:4000}:
  old.category===1?{distance:500,revenue:3500}:
  old.category===2?{passengers:40,roads:150,revenue:4000}:
  old.category===3?{roads:400,distance:100,revenue:3000}:
  old.category===4?{passengers:30,distance:300,revenue:3000}:
  old.category===5?{distance:200,revenue:4000}:
  old.category===6?{passengers:45,revenue:4000}:{revenue:4500,passengers:15};
 if(id==='explorerExpansion')return {roads:5000,distance:2000,revenue:25000};
 return Object.fromEntries(Object.entries(base).map(([k,v])=>[k,Math.ceil(v*factor)])) as ResourceCosts;
}
export function prerequisites(id:string,levels:Partial<Record<string,number>>,context:OperationalContext):string[]{
 const missing=technologyParents(id).filter(dependency=>(levels[dependency]??0)<1)
  .map(dependency=>allResearchNames[dependency]??dependency);
 if(id==='explorerExpansion'&&(context.roads<5000||context.explorers<1))
  missing.push('5,000 discovered roads and at least one explorer');
 if(id==='multiDepotDispatch'&&context.depots<2)missing.push('2 operating depots');
 return missing;
}
const allResearchNames:Record<string,string>=Object.fromEntries(newProjects.map(p=>[p.id,p.name]));
/** New branches gradually expand the relevant operational research bonus
 * ceiling. Existing saves with none of these 96 branches retain the original
 * 30% limit and their existing income and operating costs.
 */
export function megaResearchMastery(levels:Partial<Record<string,number>>,group:AdvancedProject['bonus']):number{
 const completed=MEGA_RESEARCH_BRANCHES.filter(p=>p.bonus===group&&(levels[p.id]??0)>0).length;
 return Math.min(.25,completed*.012);
}
export function unlockedBonus(levels:Record<string,number>|Partial<Record<string,number>>,group:AdvancedProject['bonus']){
 const earned=newProjects.filter(p=>p.bonus===group&&(levels[p.id]??0)>0).reduce((a,p)=>a+p.rate,0);
 return Math.min(.30+megaResearchMastery(levels,group),earned);
}
export function normalizeResources<T extends ResourceState>(s:T):T{
 if(s.researchV3)return s;
 const result={...s,resources:safeBag(s.resources),earned:safeBag(s.earned),
  contributions:s.contributions??{},queue:s.queue??[],researchV3:true as const};
 return result as T;
}
export function observation<T extends ResourceState>(state:T,snapshot:ResearchSnapshot):T{
 const s=normalizeResources(state);
 if(!s.sourceSnapshot){
  // Recognise a bounded proportion of prior operations on migration, never
  // replay all of a mature company's life or backpay financial transfers.
  const historical=safeBag(Object.fromEntries(resourceKeys.map(k=>
   [k,Math.min(snapshot[k],k==='revenue'?250000:k==='roads'?8000:2000)])) as ResourceCosts);
  return {...s,sourceSnapshot:safeBag(snapshot),resources:historical,earned:historical};
 }
 const delta=safeBag(Object.fromEntries(resourceKeys.map(k=>
  [k,Math.max(0,snapshot[k]-(s.sourceSnapshot?.[k]??0))])) as ResourceCosts);
 if(!resourceKeys.some(k=>delta[k]>0))return s;
 return {...s,sourceSnapshot:safeBag(Object.fromEntries(resourceKeys.map(k=>
  [k,Math.max(snapshot[k],s.sourceSnapshot?.[k]??0)])) as ResourceCosts),
  resources:safeBag(Object.fromEntries(resourceKeys.map(k=>[k,(s.resources?.[k]??0)+delta[k]])) as ResourceCosts),
  earned:safeBag(Object.fromEntries(resourceKeys.map(k=>[k,(s.earned?.[k]??0)+delta[k]])) as ResourceCosts)};
}
export function autoContribute<T extends ResourceState & {levels:Partial<Record<string,number>>;active?:unknown}>(
 state:T,legacy:readonly ResearchProject[],context:OperationalContext
):T{
 let s=normalizeResources(state);
 let levels={...s.levels};
 let queue=[...(s.queue??[])];
 let selected=s.selected;
 let resources=safeBag(s.resources);
 let contributions={...(s.contributions??{})};
 let updated=false;
 let iterations=0;
 while(iterations++<16){
  if(!selected){const next=queue.shift();if(!next)break;selected=next;updated=true;}
  const max=maximum(selected);
  if((levels[selected]??0)>=max){selected=undefined;updated=true;continue;}
  const missing=prerequisites(selected,levels,context);
  if(missing.length)break;
  const l=(levels[selected]??0)+1;
  const base=researchCosts(selected,l,legacy);
  const efficiency=selected==='efficiency'?1:1-Math.min(.25,(levels.efficiency??0)*.05);
  const goal=Object.fromEntries(Object.entries(base).map(([k,n])=>
   [k,Math.max(1,Math.ceil(n*efficiency))])) as ResourceCosts;
  const key=selected+':'+l;
  const current={...(contributions[key]??{})};
  for(const k of resourceKeys){
   const need=Math.max(0,(goal[k]??0)-(current[k]??0));
   const delivered=Math.min(need,resources[k]);
   if(delivered>0){current[k]=(current[k]??0)+delivered;resources[k]-=delivered;updated=true;}
  }
  contributions[key]=current;
  if(resourceKeys.some(k=>(current[k]??0)<(goal[k]??0)))break;
  levels[selected]=l;
  selected=undefined;
  updated=true;
 }
 return updated?{...s,levels,queue,selected,resources,contributions}:s;
}
export function selectTechnology<T extends ResourceState & {levels:Partial<Record<string,number>>}>(
 state:T,id:string,legacy:readonly ResearchProject[],context:OperationalContext
):T{
 const available=allResearch(legacy).some(p=>p.id===id);
 if(!available)throw new Error('Unknown research technology');
 if((state.levels[id]??0)>=maximum(id))throw new Error('Technology is already complete');
 const queue=(state.queue??[]).filter(p=>p!==id&&p!==state.selected);
 const chosen={...state,selected:id,queue:state.selected&&state.selected!==id?[state.selected,...queue].slice(0,5):queue};
 return autoContribute(chosen,legacy,context);
}
export function queueTechnology<T extends ResourceState & {levels:Partial<Record<string,number>>}>(
 state:T,id:string,legacy:readonly ResearchProject[],context:OperationalContext
):T{
 if(!allResearch(legacy).some(p=>p.id===id)||((state.levels[id]??0)>=maximum(id)))return state;
 if(id===state.selected||(state.queue??[]).includes(id))return state;
 const next={...state,queue:[...(state.queue??[]),id].slice(0,5)};
 return autoContribute(next,legacy,context);
}
