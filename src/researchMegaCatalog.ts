/**
 * TravelEmpire Research Centre: 96 additional technology branches.
 *
 * Data-only, save-compatible definitions. All use existing real-world
 * operating counters and automatic manufacturing: no manual input, no
 * extra vehicles or artificial production buildings.
 */
import type {AdvancedProject} from './researchProgress';

export const MEGA_RESEARCH_BRANCHES:readonly AdvancedProject[]=[
 {
  "id": "fareElasticity",
  "name": "Fare Elasticity Models",
  "category": 0,
  "tier": 2,
  "requires": [
   "eventSurgeForecast",
   "liquiditySignals"
  ],
  "resources": {
   "passengers": 130,
   "roads": 350,
   "revenue": 17000
  },
  "products": {
   "marketBrief": 3,
   "trafficAnalysis": 1
  },
  "effect": "Contributes 0.80% towards stronger passenger fare returns (subject to cap)",
  "bonus": "taxi",
  "rate": 0.008
 },
 {
  "id": "journeyPassbook",
  "name": "Journey Passbook",
  "category": 0,
  "tier": 2,
  "requires": [
   "fareElasticity",
   "commuterPasses"
  ],
  "resources": {
   "passengers": 142,
   "roads": 382,
   "revenue": 18530
  },
  "products": {
   "fareMatrix": 2,
   "trafficAnalysis": 1
  },
  "effect": "Contributes 0.80% towards stronger passenger fare returns (subject to cap)",
  "bonus": "taxi",
  "rate": 0.008
 },
 {
  "id": "neighbourhoodDemand",
  "name": "Neighbourhood Demand Maps",
  "category": 0,
  "tier": 2,
  "requires": [
   "demandIntelligence",
   "fareElasticity"
  ],
  "resources": {
   "passengers": 154,
   "roads": 413,
   "revenue": 20060
  },
  "products": {
   "fareMatrix": 2,
   "trafficAnalysis": 1
  },
  "effect": "Contributes 0.80% towards stronger passenger fare returns (subject to cap)",
  "bonus": "taxi",
  "rate": 0.008
 },
 {
  "id": "businessTravelHub",
  "name": "Business Travel Hub",
  "category": 0,
  "tier": 3,
  "requires": [
   "corporatePassengers",
   "journeyPassbook",
   "fareElasticity"
  ],
  "resources": {
   "passengers": 273,
   "roads": 735,
   "revenue": 35700
  },
  "products": {
   "fareMatrix": 3,
   "trafficAnalysis": 2
  },
  "effect": "Contributes 0.80% towards stronger passenger fare returns (subject to cap)",
  "bonus": "taxi",
  "rate": 0.008
 },
 {
  "id": "airportPeakPlanner",
  "name": "Airport Peak Planner",
  "category": 0,
  "tier": 3,
  "requires": [
   "vipTransfers",
   "neighbourhoodDemand",
   "fareElasticity"
  ],
  "resources": {
   "passengers": 292,
   "roads": 785,
   "revenue": 38080
  },
  "products": {
   "fareMatrix": 3,
   "trafficAnalysis": 2
  },
  "effect": "Contributes 0.80% towards stronger passenger fare returns (subject to cap)",
  "bonus": "taxi",
  "rate": 0.008
 },
 {
  "id": "familyFarePlans",
  "name": "Family Fare Plans",
  "category": 0,
  "tier": 3,
  "requires": [
   "fareBundles",
   "journeyPassbook",
   "fareElasticity"
  ],
  "resources": {
   "passengers": 311,
   "roads": 837,
   "revenue": 40630
  },
  "products": {
   "fareMatrix": 3,
   "trafficAnalysis": 2
  },
  "effect": "Contributes 0.80% towards stronger passenger fare returns (subject to cap)",
  "bonus": "taxi",
  "rate": 0.008
 },
 {
  "id": "nightTravelMarkets",
  "name": "Night Travel Markets",
  "category": 0,
  "tier": 4,
  "requires": [
   "eventSurgeForecast",
   "airportPeakPlanner",
   "fareElasticity"
  ],
  "resources": {
   "passengers": 545,
   "roads": 1467,
   "revenue": 71230
  },
  "products": {
   "fareMatrix": 3,
   "trafficAnalysis": 2
  },
  "effect": "Contributes 0.80% towards stronger passenger fare returns (subject to cap)",
  "bonus": "taxi",
  "rate": 0.008
 },
 {
  "id": "subscriptionEconomy",
  "name": "Subscription Economy",
  "category": 0,
  "tier": 4,
  "requires": [
   "familyFarePlans",
   "businessTravelHub",
   "fareElasticity"
  ],
  "resources": {
   "passengers": 578,
   "roads": 1555,
   "revenue": 75480
  },
  "products": {
   "fareMatrix": 3,
   "trafficAnalysis": 2
  },
  "effect": "Contributes 0.80% towards stronger passenger fare returns (subject to cap)",
  "bonus": "taxi",
  "rate": 0.008
 },
 {
  "id": "regionalPriceZones",
  "name": "Regional Price Zones",
  "category": 0,
  "tier": 4,
  "requires": [
   "neighbourhoodDemand",
   "peakPricing",
   "fareElasticity"
  ],
  "resources": {
   "passengers": 609,
   "roads": 1638,
   "revenue": 79560
  },
  "products": {
   "fareMatrix": 3,
   "trafficAnalysis": 2
  },
  "effect": "Contributes 0.80% towards stronger passenger fare returns (subject to cap)",
  "bonus": "taxi",
  "rate": 0.008
 },
 {
  "id": "fareYieldEngine",
  "name": "Fare Yield Engine",
  "category": 0,
  "tier": 5,
  "requires": [
   "regionalPriceZones",
   "subscriptionEconomy",
   "fareElasticity"
  ],
  "resources": {
   "passengers": 1057,
   "roads": 2846,
   "revenue": 138210
  },
  "products": {
   "fareMatrix": 4,
   "trafficAnalysis": 3
  },
  "effect": "Contributes 1.25% towards stronger passenger fare returns (subject to cap)",
  "bonus": "taxi",
  "rate": 0.0125
 },
 {
  "id": "loyaltyPartnerships",
  "name": "Loyalty Partnerships",
  "category": 0,
  "tier": 5,
  "requires": [
   "customerRetention",
   "journeyPassbook",
   "fareElasticity"
  ],
  "resources": {
   "passengers": 1111,
   "roads": 2989,
   "revenue": 145180
  },
  "products": {
   "fareMatrix": 4,
   "trafficAnalysis": 3
  },
  "effect": "Contributes 1.25% towards stronger passenger fare returns (subject to cap)",
  "bonus": "taxi",
  "rate": 0.0125
 },
 {
  "id": "destinationRevenue",
  "name": "Destination Revenue Intelligence",
  "category": 0,
  "tier": 5,
  "requires": [
   "destinationPackages",
   "loyaltyPartnerships",
   "fareElasticity"
  ],
  "resources": {
   "passengers": 1163,
   "roads": 3129,
   "revenue": 151980
  },
  "products": {
   "fareMatrix": 4,
   "trafficAnalysis": 3
  },
  "effect": "Contributes 1.25% towards stronger passenger fare returns (subject to cap)",
  "bonus": "taxi",
  "rate": 0.0125
 },
 {
  "id": "seasonalPricing",
  "name": "Seasonal Pricing Research",
  "category": 0,
  "tier": 6,
  "requires": [
   "nightTravelMarkets",
   "fareYieldEngine",
   "fareElasticity"
  ],
  "resources": {
   "passengers": 2005,
   "roads": 5397,
   "revenue": 262140
  },
  "products": {
   "fareMatrix": 4,
   "trafficAnalysis": 3
  },
  "effect": "Contributes 1.25% towards stronger passenger fare returns (subject to cap)",
  "bonus": "taxi",
  "rate": 0.0125
 },
 {
  "id": "premiumMarketReach",
  "name": "Premium Market Reach",
  "category": 0,
  "tier": 6,
  "requires": [
   "destinationRevenue",
   "vipTransfers",
   "fareElasticity"
  ],
  "resources": {
   "passengers": 2091,
   "roads": 5628,
   "revenue": 273360
  },
  "products": {
   "fareMatrix": 4,
   "trafficAnalysis": 3
  },
  "effect": "Contributes 1.25% towards stronger passenger fare returns (subject to cap)",
  "bonus": "taxi",
  "rate": 0.0125
 },
 {
  "id": "dispatchTelemetry",
  "name": "Dispatch Telemetry",
  "category": 2,
  "tier": 2,
  "requires": [
   "hubTransfers",
   "fleetAnalytics"
  ],
  "resources": {
   "passengers": 280,
   "roads": 1100,
   "distance": 1000,
   "revenue": 27000
  },
  "products": {
   "fleetReport": 3,
   "routeReport": 1
  },
  "effect": "Contributes 0.80% towards stronger taxi dispatch returns (subject to cap)",
  "bonus": "taxi",
  "rate": 0.008
 },
 {
  "id": "urbanRouteBalancing",
  "name": "Urban Route Balancing",
  "category": 2,
  "tier": 2,
  "requires": [
   "dispatchTelemetry",
   "smartPooling"
  ],
  "resources": {
   "passengers": 306,
   "roads": 1199,
   "distance": 1090,
   "revenue": 29431
  },
  "products": {
   "dispatchProtocol": 2,
   "routeReport": 1
  },
  "effect": "Contributes 0.80% towards stronger taxi dispatch returns (subject to cap)",
  "bonus": "taxi",
  "rate": 0.008
 },
 {
  "id": "priorityPassengerRouting",
  "name": "Priority Passenger Routing",
  "category": 2,
  "tier": 2,
  "requires": [
   "dispatchTelemetry",
   "routing"
  ],
  "resources": {
   "passengers": 331,
   "roads": 1298,
   "distance": 1180,
   "revenue": 31860
  },
  "products": {
   "dispatchProtocol": 2,
   "routeReport": 1
  },
  "effect": "Contributes 0.80% towards stronger taxi dispatch returns (subject to cap)",
  "bonus": "taxi",
  "rate": 0.008
 },
 {
  "id": "intercityDemandDesk",
  "name": "Intercity Demand Desk",
  "category": 2,
  "tier": 3,
  "requires": [
   "priorityPassengerRouting",
   "longDistance",
   "dispatchTelemetry"
  ],
  "resources": {
   "passengers": 588,
   "roads": 2310,
   "distance": 2100,
   "revenue": 56700
  },
  "products": {
   "dispatchProtocol": 3,
   "routeReport": 2
  },
  "effect": "Contributes 0.80% towards stronger taxi dispatch returns (subject to cap)",
  "bonus": "taxi",
  "rate": 0.008
 },
 {
  "id": "driverAvailabilityForecast",
  "name": "Driver Availability Forecast",
  "category": 2,
  "tier": 3,
  "requires": [
   "fleetShiftHandover",
   "dispatchTelemetry"
  ],
  "resources": {
   "passengers": 628,
   "roads": 2465,
   "distance": 2240,
   "revenue": 60481
  },
  "products": {
   "dispatchProtocol": 3,
   "routeReport": 2
  },
  "effect": "Contributes 0.80% towards stronger taxi dispatch returns (subject to cap)",
  "bonus": "taxi",
  "rate": 0.008
 },
 {
  "id": "dynamicFleetCoverage",
  "name": "Dynamic Fleet Coverage",
  "category": 2,
  "tier": 3,
  "requires": [
   "urbanRouteBalancing",
   "driverAvailabilityForecast",
   "dispatchTelemetry"
  ],
  "resources": {
   "passengers": 670,
   "roads": 2629,
   "distance": 2390,
   "revenue": 64530
  },
  "products": {
   "dispatchProtocol": 3,
   "routeReport": 2
  },
  "effect": "Contributes 0.80% towards stronger taxi dispatch returns (subject to cap)",
  "bonus": "taxi",
  "rate": 0.008
 },
 {
  "id": "depotFleetCoordination",
  "name": "Depot Fleet Coordination",
  "category": 2,
  "tier": 4,
  "requires": [
   "multiDepotDispatch",
   "dynamicFleetCoverage",
   "dispatchTelemetry"
  ],
  "resources": {
   "passengers": 1174,
   "roads": 4609,
   "distance": 4190,
   "revenue": 113131
  },
  "products": {
   "dispatchProtocol": 3,
   "routeReport": 2
  },
  "effect": "Contributes 0.80% towards stronger taxi dispatch returns (subject to cap)",
  "bonus": "taxi",
  "rate": 0.008
 },
 {
  "id": "trafficIncidentForecast",
  "name": "Traffic Incident Forecast",
  "category": 2,
  "tier": 4,
  "requires": [
   "priorityPassengerRouting",
   "roadGraphInference",
   "dispatchTelemetry"
  ],
  "resources": {
   "passengers": 1244,
   "roads": 4884,
   "distance": 4440,
   "revenue": 119881
  },
  "products": {
   "dispatchProtocol": 3,
   "routeReport": 2
  },
  "effect": "Contributes 0.80% towards stronger taxi dispatch returns (subject to cap)",
  "bonus": "taxi",
  "rate": 0.008
 },
 {
  "id": "fleetRevenueCommand",
  "name": "Fleet Revenue Command",
  "category": 2,
  "tier": 4,
  "requires": [
   "dynamicFleetCoverage",
   "eventSurgeForecast",
   "dispatchTelemetry"
  ],
  "resources": {
   "passengers": 1311,
   "roads": 5148,
   "distance": 4680,
   "revenue": 126360
  },
  "products": {
   "dispatchProtocol": 3,
   "routeReport": 2
  },
  "effect": "Contributes 0.80% towards stronger taxi dispatch returns (subject to cap)",
  "bonus": "taxi",
  "rate": 0.008
 },
 {
  "id": "airportTransferNetwork",
  "name": "Airport Transfer Network",
  "category": 2,
  "tier": 5,
  "requires": [
   "intercityDemandDesk",
   "airportMarkets",
   "dispatchTelemetry"
  ],
  "resources": {
   "passengers": 2277,
   "roads": 8943,
   "distance": 8131,
   "revenue": 219511
  },
  "products": {
   "dispatchProtocol": 4,
   "routeReport": 3
  },
  "effect": "Contributes 1.25% towards stronger taxi dispatch returns (subject to cap)",
  "bonus": "taxi",
  "rate": 0.0125
 },
 {
  "id": "regionalTaxiContracts",
  "name": "Regional Taxi Contracts",
  "category": 2,
  "tier": 5,
  "requires": [
   "airportTransferNetwork",
   "corporatePassengers",
   "dispatchTelemetry"
  ],
  "resources": {
   "passengers": 2392,
   "roads": 9394,
   "distance": 8540,
   "revenue": 230580
  },
  "products": {
   "dispatchProtocol": 4,
   "routeReport": 3
  },
  "effect": "Contributes 1.25% towards stronger taxi dispatch returns (subject to cap)",
  "bonus": "taxi",
  "rate": 0.0125
 },
 {
  "id": "portSignalTower",
  "name": "Port Signal Tower",
  "category": 2,
  "tier": 5,
  "requires": [
   "harbourConnections",
   "ferryTimetabling",
   "dispatchTelemetry"
  ],
  "resources": {
   "passengers": 2504,
   "roads": 9834,
   "distance": 8940,
   "revenue": 241380
  },
  "products": {
   "dispatchProtocol": 4,
   "routeReport": 3
  },
  "effect": "Contributes 1.25% towards stronger taxi dispatch returns (subject to cap)",
  "bonus": "taxi",
  "rate": 0.0125
 },
 {
  "id": "berthTurnoverModels",
  "name": "Berth Turnover Models",
  "category": 2,
  "tier": 6,
  "requires": [
   "portSignalTower",
   "fleetTurnaround",
   "dispatchTelemetry"
  ],
  "resources": {
   "passengers": 4318,
   "roads": 16962,
   "distance": 15420,
   "revenue": 416340
  },
  "products": {
   "dispatchProtocol": 4,
   "routeReport": 3
  },
  "effect": "Contributes 1.25% towards stronger taxi dispatch returns (subject to cap)",
  "bonus": "taxi",
  "rate": 0.0125
 },
 {
  "id": "islandDemandSignals",
  "name": "Island Demand Signals",
  "category": 2,
  "tier": 6,
  "requires": [
   "portSignalTower",
   "interIslandTickets",
   "dispatchTelemetry"
  ],
  "resources": {
   "passengers": 4503,
   "roads": 17688,
   "distance": 16080,
   "revenue": 434160
  },
  "products": {
   "dispatchProtocol": 4,
   "routeReport": 3
  },
  "effect": "Contributes 1.25% towards stronger taxi dispatch returns (subject to cap)",
  "bonus": "taxi",
  "rate": 0.0125
 },
 {
  "id": "ferryConnectionGuarantee",
  "name": "Ferry Connection Guarantee",
  "category": 2,
  "tier": 6,
  "requires": [
   "berthTurnoverModels",
   "harbourConnections",
   "dispatchTelemetry"
  ],
  "resources": {
   "passengers": 4690,
   "roads": 18425,
   "distance": 16750,
   "revenue": 452250
  },
  "products": {
   "dispatchProtocol": 4,
   "routeReport": 3
  },
  "effect": "Contributes 1.25% towards stronger taxi dispatch returns (subject to cap)",
  "bonus": "taxi",
  "rate": 0.0125
 },
 {
  "id": "portPassengerExchange",
  "name": "Port Passenger Exchange",
  "category": 2,
  "tier": 6,
  "requires": [
   "islandDemandSignals",
   "hubTransfers",
   "dispatchTelemetry"
  ],
  "resources": {
   "passengers": 4878,
   "roads": 19163,
   "distance": 17420,
   "revenue": 470341
  },
  "products": {
   "dispatchProtocol": 4,
   "routeReport": 3
  },
  "effect": "Contributes 1.25% towards stronger taxi dispatch returns (subject to cap)",
  "bonus": "taxi",
  "rate": 0.0125
 },
 {
  "id": "islandTourismPasses",
  "name": "Island Tourism Passes",
  "category": 2,
  "tier": 6,
  "requires": [
   "portPassengerExchange",
   "destinationPackages",
   "dispatchTelemetry"
  ],
  "resources": {
   "passengers": 5066,
   "roads": 19899,
   "distance": 18090,
   "revenue": 488430
  },
  "products": {
   "dispatchProtocol": 4,
   "routeReport": 3
  },
  "effect": "Contributes 1.25% towards stronger taxi dispatch returns (subject to cap)",
  "bonus": "taxi",
  "rate": 0.0125
 },
 {
  "id": "maritimeRevenueGrid",
  "name": "Maritime Revenue Grid",
  "category": 2,
  "tier": 6,
  "requires": [
   "ferryConnectionGuarantee",
   "premiumFerryServices",
   "dispatchTelemetry"
  ],
  "resources": {
   "passengers": 5250,
   "roads": 20625,
   "distance": 18750,
   "revenue": 506250
  },
  "products": {
   "dispatchProtocol": 4,
   "routeReport": 3
  },
  "effect": "Contributes 1.25% towards stronger taxi dispatch returns (subject to cap)",
  "bonus": "taxi",
  "rate": 0.0125
 },
 {
  "id": "satelliteRecon",
  "name": "Satellite Reconnaissance",
  "category": 3,
  "tier": 2,
  "requires": [
   "terrainMapping",
   "roadGraphInference"
  ],
  "resources": {
   "roads": 2100,
   "distance": 1600,
   "revenue": 33000
  },
  "products": {
   "navigationModel": 3,
   "routeReport": 1
  },
  "effect": "Contributes 0.80% towards lower explorer operating costs (subject to cap)",
  "bonus": "explorer",
  "rate": 0.008
 },
 {
  "id": "roadPriorityMatrix",
  "name": "Road Priority Matrix",
  "category": 3,
  "tier": 2,
  "requires": [
   "satelliteRecon",
   "coverageIntelligence"
  ],
  "resources": {
   "roads": 2289,
   "distance": 1745,
   "revenue": 35970
  },
  "products": {
   "cartographyAtlas": 2,
   "routeReport": 1
  },
  "effect": "Contributes 0.80% towards lower explorer operating costs (subject to cap)",
  "bonus": "explorer",
  "rate": 0.008
 },
 {
  "id": "islandTerrainAtlas",
  "name": "Island Terrain Atlas",
  "category": 3,
  "tier": 2,
  "requires": [
   "satelliteRecon",
   "islandRecon"
  ],
  "resources": {
   "roads": 2478,
   "distance": 1888,
   "revenue": 38940
  },
  "products": {
   "cartographyAtlas": 2,
   "routeReport": 1
  },
  "effect": "Contributes 0.80% towards lower explorer operating costs (subject to cap)",
  "bonus": "explorer",
  "rate": 0.008
 },
 {
  "id": "mountainExpeditions",
  "name": "Mountain Expeditions",
  "category": 3,
  "tier": 3,
  "requires": [
   "roadPriorityMatrix",
   "expeditionPlanning",
   "satelliteRecon"
  ],
  "resources": {
   "roads": 4410,
   "distance": 3360,
   "revenue": 69300
  },
  "products": {
   "cartographyAtlas": 3,
   "routeReport": 2
  },
  "effect": "Contributes 0.80% towards lower explorer operating costs (subject to cap)",
  "bonus": "explorer",
  "rate": 0.008
 },
 {
  "id": "harbourApproachMapping",
  "name": "Harbour Approach Mapping",
  "category": 3,
  "tier": 3,
  "requires": [
   "islandTerrainAtlas",
   "harbourSurvey",
   "satelliteRecon"
  ],
  "resources": {
   "roads": 4704,
   "distance": 3585,
   "revenue": 73920
  },
  "products": {
   "cartographyAtlas": 3,
   "routeReport": 2
  },
  "effect": "Contributes 0.80% towards lower explorer operating costs (subject to cap)",
  "bonus": "explorer",
  "rate": 0.008
 },
 {
  "id": "unmappedRoadInference",
  "name": "Unmapped Road Inference",
  "category": 3,
  "tier": 3,
  "requires": [
   "roadPriorityMatrix",
   "navigation",
   "satelliteRecon"
  ],
  "resources": {
   "roads": 5019,
   "distance": 3824,
   "revenue": 78870
  },
  "products": {
   "cartographyAtlas": 3,
   "routeReport": 2
  },
  "effect": "Contributes 0.80% towards lower explorer operating costs (subject to cap)",
  "bonus": "explorer",
  "rate": 0.008
 },
 {
  "id": "crossIslandFrontiers",
  "name": "Cross-Island Frontiers",
  "category": 3,
  "tier": 4,
  "requires": [
   "harbourApproachMapping",
   "islandRecon",
   "satelliteRecon"
  ],
  "resources": {
   "roads": 8799,
   "distance": 6705,
   "revenue": 138270
  },
  "products": {
   "cartographyAtlas": 3,
   "routeReport": 2
  },
  "effect": "Contributes 0.80% towards lower explorer operating costs (subject to cap)",
  "bonus": "explorer",
  "rate": 0.008
 },
 {
  "id": "longRangeSurveying",
  "name": "Long-Range Surveying",
  "category": 3,
  "tier": 4,
  "requires": [
   "mountainExpeditions",
   "unmappedRoadInference",
   "satelliteRecon"
  ],
  "resources": {
   "roads": 9324,
   "distance": 7105,
   "revenue": 146520
  },
  "products": {
   "cartographyAtlas": 3,
   "routeReport": 2
  },
  "effect": "Contributes 0.80% towards lower explorer operating costs (subject to cap)",
  "bonus": "explorer",
  "rate": 0.008
 },
 {
  "id": "explorerCoordinationDesk",
  "name": "Explorer Coordination Desk",
  "category": 3,
  "tier": 4,
  "requires": [
   "longRangeSurveying",
   "coordinatedFrontiers",
   "satelliteRecon"
  ],
  "resources": {
   "roads": 9828,
   "distance": 7488,
   "revenue": 154440
  },
  "products": {
   "cartographyAtlas": 3,
   "routeReport": 2
  },
  "effect": "Contributes 0.80% towards lower explorer operating costs (subject to cap)",
  "bonus": "explorer",
  "rate": 0.008
 },
 {
  "id": "remoteCoverageAnalytics",
  "name": "Remote Coverage Analytics",
  "category": 3,
  "tier": 5,
  "requires": [
   "crossIslandFrontiers",
   "explorerCoordinationDesk",
   "satelliteRecon"
  ],
  "resources": {
   "roads": 17073,
   "distance": 13009,
   "revenue": 268290
  },
  "products": {
   "cartographyAtlas": 4,
   "routeReport": 3
  },
  "effect": "Contributes 1.25% towards lower explorer operating costs (subject to cap)",
  "bonus": "explorer",
  "rate": 0.0125
 },
 {
  "id": "roadNetworkAtlas",
  "name": "Road Network Atlas",
  "category": 3,
  "tier": 5,
  "requires": [
   "remoteCoverageAnalytics",
   "regionalPriceZones",
   "satelliteRecon"
  ],
  "resources": {
   "roads": 17934,
   "distance": 13664,
   "revenue": 281820
  },
  "products": {
   "cartographyAtlas": 4,
   "routeReport": 3
  },
  "effect": "Contributes 1.25% towards lower explorer operating costs (subject to cap)",
  "bonus": "explorer",
  "rate": 0.0125
 },
 {
  "id": "nationalSurveyProgramme",
  "name": "National Survey Programme",
  "category": 3,
  "tier": 5,
  "requires": [
   "roadNetworkAtlas",
   "crossIslandFrontiers",
   "satelliteRecon"
  ],
  "resources": {
   "roads": 18774,
   "distance": 14304,
   "revenue": 295020
  },
  "products": {
   "cartographyAtlas": 4,
   "routeReport": 3
  },
  "effect": "Contributes 1.25% towards lower explorer operating costs (subject to cap)",
  "bonus": "explorer",
  "rate": 0.0125
 },
 {
  "id": "reservationSignals",
  "name": "Reservation Signals",
  "category": 9,
  "tier": 2,
  "requires": [
   "frontDeskAnalytics",
   "roomYield"
  ],
  "resources": {
   "hotels": 85,
   "passengers": 200,
   "revenue": 43000
  },
  "products": {
   "hospitalityModel": 3,
   "guestProfile": 1
  },
  "effect": "Contributes 0.80% towards stronger hotel returns (subject to cap)",
  "bonus": "hotel",
  "rate": 0.008
 },
 {
  "id": "lengthOfStayTrends",
  "name": "Length-of-Stay Trends",
  "category": 9,
  "tier": 2,
  "requires": [
   "reservationSignals",
   "occupancyForecast"
  ],
  "resources": {
   "hotels": 93,
   "passengers": 219,
   "revenue": 46870
  },
  "products": {
   "guestJourneyMap": 2,
   "guestProfile": 1
  },
  "effect": "Contributes 0.80% towards stronger hotel returns (subject to cap)",
  "bonus": "hotel",
  "rate": 0.008
 },
 {
  "id": "guestLoyaltyDesk",
  "name": "Guest Loyalty Desk",
  "category": 9,
  "tier": 2,
  "requires": [
   "guestExperience",
   "reservationSignals"
  ],
  "resources": {
   "hotels": 101,
   "passengers": 236,
   "revenue": 50740
  },
  "products": {
   "guestJourneyMap": 2,
   "guestProfile": 1
  },
  "effect": "Contributes 0.80% towards stronger hotel returns (subject to cap)",
  "bonus": "hotel",
  "rate": 0.008
 },
 {
  "id": "seasonalRoomMarkets",
  "name": "Seasonal Room Markets",
  "category": 9,
  "tier": 3,
  "requires": [
   "lengthOfStayTrends",
   "seasonalPricing",
   "reservationSignals"
  ],
  "resources": {
   "hotels": 179,
   "passengers": 420,
   "revenue": 90300
  },
  "products": {
   "guestJourneyMap": 3,
   "guestProfile": 2
  },
  "effect": "Contributes 0.80% towards stronger hotel returns (subject to cap)",
  "bonus": "hotel",
  "rate": 0.008
 },
 {
  "id": "conferenceHospitality",
  "name": "Conference Hospitality",
  "category": 9,
  "tier": 3,
  "requires": [
   "guestLoyaltyDesk",
   "businessTravelHub",
   "reservationSignals"
  ],
  "resources": {
   "hotels": 191,
   "passengers": 449,
   "revenue": 96321
  },
  "products": {
   "guestJourneyMap": 3,
   "guestProfile": 2
  },
  "effect": "Contributes 0.80% towards stronger hotel returns (subject to cap)",
  "bonus": "hotel",
  "rate": 0.008
 },
 {
  "id": "cityHotelNetworks",
  "name": "City Hotel Networks",
  "category": 9,
  "tier": 3,
  "requires": [
   "seasonalRoomMarkets",
   "hotelAutomation",
   "reservationSignals"
  ],
  "resources": {
   "hotels": 204,
   "passengers": 478,
   "revenue": 102770
  },
  "products": {
   "guestJourneyMap": 3,
   "guestProfile": 2
  },
  "effect": "Contributes 0.80% towards stronger hotel returns (subject to cap)",
  "bonus": "hotel",
  "rate": 0.008
 },
 {
  "id": "resortDemandForecast",
  "name": "Resort Demand Forecast",
  "category": 9,
  "tier": 4,
  "requires": [
   "conferenceHospitality",
   "resortOperations",
   "reservationSignals"
  ],
  "resources": {
   "hotels": 357,
   "passengers": 839,
   "revenue": 180171
  },
  "products": {
   "guestJourneyMap": 3,
   "guestProfile": 2
  },
  "effect": "Contributes 0.80% towards stronger hotel returns (subject to cap)",
  "bonus": "hotel",
  "rate": 0.008
 },
 {
  "id": "destinationGuestNetwork",
  "name": "Destination Guest Network",
  "category": 9,
  "tier": 4,
  "requires": [
   "cityHotelNetworks",
   "resortDemandForecast",
   "reservationSignals"
  ],
  "resources": {
   "hotels": 378,
   "passengers": 889,
   "revenue": 190921
  },
  "products": {
   "guestJourneyMap": 3,
   "guestProfile": 2
  },
  "effect": "Contributes 0.80% towards stronger hotel returns (subject to cap)",
  "bonus": "hotel",
  "rate": 0.008
 },
 {
  "id": "parkingSensorNetwork",
  "name": "Parking Sensor Network",
  "category": 5,
  "tier": 2,
  "requires": [
   "automatedAccess",
   "parkingDemandPrediction"
  ],
  "resources": {
   "parking": 210,
   "passengers": 150,
   "revenue": 28000
  },
  "products": {
   "parkingFlowModel": 3,
   "depotAudit": 1
  },
  "effect": "Contributes 0.80% towards stronger parking returns (subject to cap)",
  "bonus": "parking",
  "rate": 0.008
 },
 {
  "id": "turnoverAnalysis",
  "name": "Parking Turnover Analysis",
  "category": 5,
  "tier": 2,
  "requires": [
   "parkingSensorNetwork",
   "smartTariffs"
  ],
  "resources": {
   "parking": 229,
   "passengers": 164,
   "revenue": 30521
  },
  "products": {
   "parkingAutomationPlan": 2,
   "depotAudit": 1
  },
  "effect": "Contributes 0.80% towards stronger parking returns (subject to cap)",
  "bonus": "parking",
  "rate": 0.008
 },
 {
  "id": "stationParkingBundles",
  "name": "Station Parking Bundles",
  "category": 5,
  "tier": 2,
  "requires": [
   "turnoverAnalysis",
   "hubTransfers",
   "parkingSensorNetwork"
  ],
  "resources": {
   "parking": 248,
   "passengers": 177,
   "revenue": 33040
  },
  "products": {
   "parkingAutomationPlan": 2,
   "depotAudit": 1
  },
  "effect": "Contributes 0.80% towards stronger parking returns (subject to cap)",
  "bonus": "parking",
  "rate": 0.008
 },
 {
  "id": "eventParkingPlans",
  "name": "Event Parking Plans",
  "category": 5,
  "tier": 3,
  "requires": [
   "parkingSensorNetwork",
   "eventSurgeForecast"
  ],
  "resources": {
   "parking": 441,
   "passengers": 315,
   "revenue": 58800
  },
  "products": {
   "parkingAutomationPlan": 3,
   "depotAudit": 2
  },
  "effect": "Contributes 0.80% towards stronger parking returns (subject to cap)",
  "bonus": "parking",
  "rate": 0.008
 },
 {
  "id": "regionalParkingAtlas",
  "name": "Regional Parking Atlas",
  "category": 5,
  "tier": 3,
  "requires": [
   "stationParkingBundles",
   "roadPriorityMatrix",
   "parkingSensorNetwork"
  ],
  "resources": {
   "parking": 471,
   "passengers": 337,
   "revenue": 62721
  },
  "products": {
   "parkingAutomationPlan": 3,
   "depotAudit": 2
  },
  "effect": "Contributes 0.80% towards stronger parking returns (subject to cap)",
  "bonus": "parking",
  "rate": 0.008
 },
 {
  "id": "hotelValetContracts",
  "name": "Hotel Valet Contracts",
  "category": 5,
  "tier": 3,
  "requires": [
   "eventParkingPlans",
   "hotelParkingPackages",
   "parkingSensorNetwork"
  ],
  "resources": {
   "parking": 502,
   "passengers": 359,
   "revenue": 66920
  },
  "products": {
   "parkingAutomationPlan": 3,
   "depotAudit": 2
  },
  "effect": "Contributes 0.80% towards stronger parking returns (subject to cap)",
  "bonus": "parking",
  "rate": 0.008
 },
 {
  "id": "parkRideOperations",
  "name": "Park & Ride Operations",
  "category": 5,
  "tier": 4,
  "requires": [
   "regionalParkingAtlas",
   "smartPooling",
   "parkingSensorNetwork"
  ],
  "resources": {
   "parking": 880,
   "passengers": 629,
   "revenue": 117321
  },
  "products": {
   "parkingAutomationPlan": 3,
   "depotAudit": 2
  },
  "effect": "Contributes 0.80% towards stronger parking returns (subject to cap)",
  "bonus": "parking",
  "rate": 0.008
 },
 {
  "id": "smartParkingDistricts",
  "name": "Smart Parking Districts",
  "category": 5,
  "tier": 4,
  "requires": [
   "parkRideOperations",
   "hotelValetContracts",
   "parkingSensorNetwork"
  ],
  "resources": {
   "parking": 933,
   "passengers": 667,
   "revenue": 124321
  },
  "products": {
   "parkingAutomationPlan": 3,
   "depotAudit": 2
  },
  "effect": "Contributes 0.80% towards stronger parking returns (subject to cap)",
  "bonus": "parking",
  "rate": 0.008
 },
 {
  "id": "interbankLiquidity",
  "name": "Interbank Liquidity",
  "category": 7,
  "tier": 2,
  "requires": [
   "creditPortfolio",
   "liquiditySignals"
  ],
  "resources": {
   "passengers": 250,
   "roads": 500,
   "revenue": 85000
  },
  "products": {
   "financialForecast": 3,
   "creditMemo": 1
  },
  "effect": "Improves bank research and reduces eligible vehicle finance APR by 0.05 percentage points (subject to rate floor)",
  "bonus": "finance",
  "rate": 0.005
 },
 {
  "id": "fleetCashForecast",
  "name": "Fleet Cash Forecast",
  "category": 7,
  "tier": 2,
  "requires": [
   "interbankLiquidity",
   "financeAutomation"
  ],
  "resources": {
   "passengers": 273,
   "roads": 545,
   "revenue": 92650
  },
  "products": {
   "bankRiskGrid": 2,
   "creditMemo": 1
  },
  "effect": "Improves bank research and reduces eligible vehicle finance APR by 0.05 percentage points (subject to rate floor)",
  "bonus": "finance",
  "rate": 0.005
 },
 {
  "id": "lendingRiskHeatmap",
  "name": "Lending Risk Heatmap",
  "category": 7,
  "tier": 2,
  "requires": [
   "interbankLiquidity",
   "creditRiskModels"
  ],
  "resources": {
   "passengers": 295,
   "roads": 590,
   "revenue": 100300
  },
  "products": {
   "bankRiskGrid": 2,
   "creditMemo": 1
  },
  "effect": "Improves bank research and reduces eligible vehicle finance APR by 0.05 percentage points (subject to rate floor)",
  "bonus": "finance",
  "rate": 0.005
 },
 {
  "id": "vehicleResidualModels",
  "name": "Vehicle Residual Models",
  "category": 7,
  "tier": 3,
  "requires": [
   "lendingRiskHeatmap",
   "vehicleLifecycle",
   "interbankLiquidity"
  ],
  "resources": {
   "passengers": 525,
   "roads": 1050,
   "revenue": 178500
  },
  "products": {
   "bankRiskGrid": 3,
   "creditMemo": 2
  },
  "effect": "Improves bank research and reduces eligible vehicle finance APR by 0.05 percentage points (subject to rate floor)",
  "bonus": "finance",
  "rate": 0.005
 },
 {
  "id": "loanPortfolioDesk",
  "name": "Loan Portfolio Desk",
  "category": 7,
  "tier": 3,
  "requires": [
   "fleetCashForecast",
   "creditPortfolio",
   "interbankLiquidity"
  ],
  "resources": {
   "passengers": 560,
   "roads": 1120,
   "revenue": 190401
  },
  "products": {
   "bankRiskGrid": 3,
   "creditMemo": 2
  },
  "effect": "Improves bank research and reduces eligible vehicle finance APR by 0.05 percentage points (subject to rate floor)",
  "bonus": "finance",
  "rate": 0.005
 },
 {
  "id": "greenVehicleFinance",
  "name": "Green Vehicle Finance",
  "category": 7,
  "tier": 3,
  "requires": [
   "vehicleResidualModels",
   "hybridPowertrains",
   "interbankLiquidity"
  ],
  "resources": {
   "passengers": 598,
   "roads": 1195,
   "revenue": 203150
  },
  "products": {
   "bankRiskGrid": 3,
   "creditMemo": 2
  },
  "effect": "Improves bank research and reduces eligible vehicle finance APR by 0.05 percentage points (subject to rate floor)",
  "bonus": "finance",
  "rate": 0.005
 },
 {
  "id": "refinancingStrategy",
  "name": "Refinancing Strategy",
  "category": 7,
  "tier": 4,
  "requires": [
   "loanPortfolioDesk",
   "assetBackedFunding",
   "interbankLiquidity"
  ],
  "resources": {
   "passengers": 1048,
   "roads": 2095,
   "revenue": 356151
  },
  "products": {
   "bankRiskGrid": 3,
   "creditMemo": 2
  },
  "effect": "Improves bank research and reduces eligible vehicle finance APR by 0.05 percentage points (subject to rate floor)",
  "bonus": "finance",
  "rate": 0.005
 },
 {
  "id": "hotelAssetFinance",
  "name": "Hotel Asset Finance",
  "category": 7,
  "tier": 4,
  "requires": [
   "loanPortfolioDesk",
   "resortOperations",
   "interbankLiquidity"
  ],
  "resources": {
   "passengers": 1110,
   "roads": 2220,
   "revenue": 377401
  },
  "products": {
   "bankRiskGrid": 3,
   "creditMemo": 2
  },
  "effect": "Improves bank research and reduces eligible vehicle finance APR by 0.05 percentage points (subject to rate floor)",
  "bonus": "finance",
  "rate": 0.005
 },
 {
  "id": "portAssetFinance",
  "name": "Port Asset Finance",
  "category": 7,
  "tier": 4,
  "requires": [
   "refinancingStrategy",
   "portSignalTower",
   "interbankLiquidity"
  ],
  "resources": {
   "passengers": 1170,
   "roads": 2340,
   "revenue": 397800
  },
  "products": {
   "bankRiskGrid": 3,
   "creditMemo": 2
  },
  "effect": "Improves bank research and reduces eligible vehicle finance APR by 0.05 percentage points (subject to rate floor)",
  "bonus": "finance",
  "rate": 0.005
 },
 {
  "id": "corporateCreditLines",
  "name": "Corporate Credit Lines",
  "category": 7,
  "tier": 5,
  "requires": [
   "crossBorderTreasury",
   "refinancingStrategy",
   "interbankLiquidity"
  ],
  "resources": {
   "passengers": 2033,
   "roads": 4066,
   "revenue": 691051
  },
  "products": {
   "bankRiskGrid": 4,
   "creditMemo": 3
  },
  "effect": "Improves bank research and reduces eligible vehicle finance APR by 0.05 percentage points (subject to rate floor)",
  "bonus": "finance",
  "rate": 0.005
 },
 {
  "id": "riskWeightedFunding",
  "name": "Risk-Weighted Funding",
  "category": 7,
  "tier": 5,
  "requires": [
   "corporateCreditLines",
   "lendingRiskHeatmap",
   "interbankLiquidity"
  ],
  "resources": {
   "passengers": 2135,
   "roads": 4270,
   "revenue": 725900
  },
  "products": {
   "bankRiskGrid": 4,
   "creditMemo": 3
  },
  "effect": "Improves bank research and reduces eligible vehicle finance APR by 0.05 percentage points (subject to rate floor)",
  "bonus": "finance",
  "rate": 0.005
 },
 {
  "id": "internationalPaymentRails",
  "name": "International Payment Rails",
  "category": 7,
  "tier": 5,
  "requires": [
   "globalSettlement",
   "riskWeightedFunding",
   "interbankLiquidity"
  ],
  "resources": {
   "passengers": 2235,
   "roads": 4470,
   "revenue": 759900
  },
  "products": {
   "bankRiskGrid": 4,
   "creditMemo": 3
  },
  "effect": "Improves bank research and reduces eligible vehicle finance APR by 0.05 percentage points (subject to rate floor)",
  "bonus": "finance",
  "rate": 0.005
 },
 {
  "id": "multisectorCapitalPlan",
  "name": "Multisector Capital Plan",
  "category": 7,
  "tier": 6,
  "requires": [
   "hotelAssetFinance",
   "portAssetFinance",
   "interbankLiquidity"
  ],
  "resources": {
   "passengers": 3855,
   "roads": 7710,
   "revenue": 1310700
  },
  "products": {
   "bankRiskGrid": 4,
   "creditMemo": 3
  },
  "effect": "Improves bank research and reduces eligible vehicle finance APR by 0.05 percentage points (subject to rate floor)",
  "bonus": "finance",
  "rate": 0.005
 },
 {
  "id": "treasuryCommandCentre",
  "name": "Treasury Command Centre",
  "category": 7,
  "tier": 6,
  "requires": [
   "internationalPaymentRails",
   "multisectorCapitalPlan",
   "interbankLiquidity"
  ],
  "resources": {
   "passengers": 4020,
   "roads": 8040,
   "revenue": 1366800
  },
  "products": {
   "bankRiskGrid": 4,
   "creditMemo": 3
  },
  "effect": "Improves bank research and reduces eligible vehicle finance APR by 0.05 percentage points (subject to rate floor)",
  "bonus": "finance",
  "rate": 0.005
 },
 {
  "id": "batteryDiagnostics",
  "name": "Battery Diagnostics",
  "category": 1,
  "tier": 2,
  "requires": [
   "hybridPowertrains",
   "tyreTelemetry"
  ],
  "resources": {
   "maintenance": 12,
   "distance": 1800,
   "revenue": 53000
  },
  "products": {
   "maintenanceModel": 3,
   "vehicleStudy": 1
  },
  "effect": "Contributes 0.80% towards lower fleet maintenance costs (subject to cap)",
  "bonus": "maintenance",
  "rate": 0.008
 },
 {
  "id": "serviceLifecycleAnalytics",
  "name": "Service Lifecycle Analytics",
  "category": 1,
  "tier": 2,
  "requires": [
   "batteryDiagnostics",
   "fleetLifecycleAI"
  ],
  "resources": {
   "maintenance": 14,
   "distance": 1963,
   "revenue": 57771
  },
  "products": {
   "componentBlueprint": 2,
   "vehicleStudy": 1
  },
  "effect": "Contributes 0.80% towards lower fleet maintenance costs (subject to cap)",
  "bonus": "maintenance",
  "rate": 0.008
 },
 {
  "id": "fuelFlowOptimisation",
  "name": "Fuel Flow Optimisation",
  "category": 1,
  "tier": 2,
  "requires": [
   "fuelInjection",
   "batteryDiagnostics"
  ],
  "resources": {
   "maintenance": 15,
   "distance": 2124,
   "revenue": 62540
  },
  "products": {
   "componentBlueprint": 2,
   "vehicleStudy": 1
  },
  "effect": "Contributes 0.80% towards lower fleet maintenance costs (subject to cap)",
  "bonus": "maintenance",
  "rate": 0.008
 },
 {
  "id": "brakeConditionSignals",
  "name": "Brake Condition Signals",
  "category": 1,
  "tier": 3,
  "requires": [
   "tyreTelemetry",
   "partsStandardisation",
   "batteryDiagnostics"
  ],
  "resources": {
   "maintenance": 26,
   "distance": 3780,
   "revenue": 111300
  },
  "products": {
   "componentBlueprint": 3,
   "vehicleStudy": 2
  },
  "effect": "Contributes 0.80% towards lower fleet maintenance costs (subject to cap)",
  "bonus": "maintenance",
  "rate": 0.008
 },
 {
  "id": "predictiveWorkshop",
  "name": "Predictive Workshop",
  "category": 1,
  "tier": 3,
  "requires": [
   "serviceLifecycleAnalytics",
   "workshopResearch",
   "batteryDiagnostics"
  ],
  "resources": {
   "maintenance": 27,
   "distance": 4033,
   "revenue": 118721
  },
  "products": {
   "componentBlueprint": 3,
   "vehicleStudy": 2
  },
  "effect": "Contributes 0.80% towards lower fleet maintenance costs (subject to cap)",
  "bonus": "maintenance",
  "rate": 0.008
 },
 {
  "id": "standardFleetComponents",
  "name": "Standard Fleet Components",
  "category": 1,
  "tier": 3,
  "requires": [
   "brakeConditionSignals",
   "partsStandardisation",
   "batteryDiagnostics"
  ],
  "resources": {
   "maintenance": 29,
   "distance": 4302,
   "revenue": 126670
  },
  "products": {
   "componentBlueprint": 3,
   "vehicleStudy": 2
  },
  "effect": "Contributes 0.80% towards lower fleet maintenance costs (subject to cap)",
  "bonus": "maintenance",
  "rate": 0.008
 },
 {
  "id": "vehicleReliabilityStudy",
  "name": "Vehicle Reliability Study",
  "category": 1,
  "tier": 4,
  "requires": [
   "predictiveWorkshop",
   "standardFleetComponents",
   "batteryDiagnostics"
  ],
  "resources": {
   "maintenance": 51,
   "distance": 7543,
   "revenue": 222071
  },
  "products": {
   "componentBlueprint": 3,
   "vehicleStudy": 2
  },
  "effect": "Contributes 0.80% towards lower fleet maintenance costs (subject to cap)",
  "bonus": "maintenance",
  "rate": 0.008
 },
 {
  "id": "longHaulDurability",
  "name": "Long-Haul Durability",
  "category": 1,
  "tier": 4,
  "requires": [
   "fuelFlowOptimisation",
   "vehicleReliabilityStudy",
   "batteryDiagnostics"
  ],
  "resources": {
   "maintenance": 54,
   "distance": 7993,
   "revenue": 235321
  },
  "products": {
   "componentBlueprint": 3,
   "vehicleStudy": 2
  },
  "effect": "Contributes 0.80% towards lower fleet maintenance costs (subject to cap)",
  "bonus": "maintenance",
  "rate": 0.008
 },
 {
  "id": "componentExchangeNetwork",
  "name": "Component Exchange Network",
  "category": 1,
  "tier": 4,
  "requires": [
   "standardFleetComponents",
   "depotFleetCoordination",
   "batteryDiagnostics"
  ],
  "resources": {
   "maintenance": 57,
   "distance": 8424,
   "revenue": 248040
  },
  "products": {
   "componentBlueprint": 3,
   "vehicleStudy": 2
  },
  "effect": "Contributes 0.80% towards lower fleet maintenance costs (subject to cap)",
  "bonus": "maintenance",
  "rate": 0.008
 },
 {
  "id": "fleetEnergyCommand",
  "name": "Fleet Energy Command",
  "category": 1,
  "tier": 5,
  "requires": [
   "longHaulDurability",
   "greenVehicleFinance",
   "batteryDiagnostics"
  ],
  "resources": {
   "maintenance": 98,
   "distance": 14635,
   "revenue": 430891
  },
  "products": {
   "componentBlueprint": 4,
   "vehicleStudy": 3
  },
  "effect": "Contributes 1.25% towards lower fleet maintenance costs (subject to cap)",
  "bonus": "maintenance",
  "rate": 0.0125
 },
 {
  "id": "highMileageOverhauls",
  "name": "High-Mileage Overhauls",
  "category": 1,
  "tier": 5,
  "requires": [
   "componentExchangeNetwork",
   "vehicleReliabilityStudy",
   "batteryDiagnostics"
  ],
  "resources": {
   "maintenance": 103,
   "distance": 15372,
   "revenue": 452620
  },
  "products": {
   "componentBlueprint": 4,
   "vehicleStudy": 3
  },
  "effect": "Contributes 1.25% towards lower fleet maintenance costs (subject to cap)",
  "bonus": "maintenance",
  "rate": 0.0125
 },
 {
  "id": "fleetEngineeringMastery",
  "name": "Fleet Engineering Mastery",
  "category": 1,
  "tier": 5,
  "requires": [
   "fleetEnergyCommand",
   "highMileageOverhauls",
   "batteryDiagnostics"
  ],
  "resources": {
   "maintenance": 108,
   "distance": 16092,
   "revenue": 473820
  },
  "products": {
   "componentBlueprint": 4,
   "vehicleStudy": 3
  },
  "effect": "Contributes 1.25% towards lower fleet maintenance costs (subject to cap)",
  "bonus": "maintenance",
  "rate": 0.0125
 },
 {
  "id": "structuralBIM",
  "name": "Structural Design Models",
  "category": 10,
  "tier": 2,
  "requires": [
   "siteSurveys",
   "greenBuildings"
  ],
  "resources": {
   "construction": 7,
   "roads": 1500,
   "revenue": 80000
  },
  "products": {
   "developmentBlueprint": 3,
   "buildReport": 1
  },
  "effect": "Contributes 0.80% towards lower construction project costs (subject to cap)",
  "bonus": "construction",
  "rate": 0.008
 },
 {
  "id": "contractorScheduling",
  "name": "Contractor Scheduling",
  "category": 10,
  "tier": 2,
  "requires": [
   "structuralBIM",
   "supplyChains"
  ],
  "resources": {
   "construction": 8,
   "roads": 1636,
   "revenue": 87200
  },
  "products": {
   "siteDigitalTwin": 2,
   "buildReport": 1
  },
  "effect": "Contributes 0.80% towards lower construction project costs (subject to cap)",
  "bonus": "construction",
  "rate": 0.008
 },
 {
  "id": "lowImpactMaterials",
  "name": "Low-Impact Materials",
  "category": 10,
  "tier": 2,
  "requires": [
   "structuralBIM",
   "greenBuildings"
  ],
  "resources": {
   "construction": 9,
   "roads": 1770,
   "revenue": 94400
  },
  "products": {
   "siteDigitalTwin": 2,
   "buildReport": 1
  },
  "effect": "Contributes 0.80% towards lower construction project costs (subject to cap)",
  "bonus": "construction",
  "rate": 0.008
 },
 {
  "id": "automatedBuildingInspections",
  "name": "Automated Building Inspections",
  "category": 10,
  "tier": 3,
  "requires": [
   "contractorScheduling",
   "qualityInspection",
   "structuralBIM"
  ],
  "resources": {
   "construction": 15,
   "roads": 3150,
   "revenue": 168000
  },
  "products": {
   "siteDigitalTwin": 3,
   "buildReport": 2
  },
  "effect": "Contributes 0.80% towards lower construction project costs (subject to cap)",
  "bonus": "construction",
  "rate": 0.008
 },
 {
  "id": "hotelConstructionPlanning",
  "name": "Hotel Construction Planning",
  "category": 10,
  "tier": 3,
  "requires": [
   "lowImpactMaterials",
   "prefabHotels",
   "structuralBIM"
  ],
  "resources": {
   "construction": 16,
   "roads": 3361,
   "revenue": 179201
  },
  "products": {
   "siteDigitalTwin": 3,
   "buildReport": 2
  },
  "effect": "Contributes 0.80% towards lower construction project costs (subject to cap)",
  "bonus": "construction",
  "rate": 0.008
 },
 {
  "id": "parkingCampusDesign",
  "name": "Parking Campus Design",
  "category": 10,
  "tier": 3,
  "requires": [
   "automatedBuildingInspections",
   "parkingSensorNetwork",
   "structuralBIM"
  ],
  "resources": {
   "construction": 17,
   "roads": 3585,
   "revenue": 191200
  },
  "products": {
   "siteDigitalTwin": 3,
   "buildReport": 2
  },
  "effect": "Contributes 0.80% towards lower construction project costs (subject to cap)",
  "bonus": "construction",
  "rate": 0.008
 },
 {
  "id": "multiSiteProcurement",
  "name": "Multi-Site Procurement",
  "category": 10,
  "tier": 4,
  "requires": [
   "contractorScheduling",
   "procurement",
   "structuralBIM"
  ],
  "resources": {
   "construction": 30,
   "roads": 6286,
   "revenue": 335201
  },
  "products": {
   "siteDigitalTwin": 3,
   "buildReport": 2
  },
  "effect": "Contributes 0.80% towards lower construction project costs (subject to cap)",
  "bonus": "construction",
  "rate": 0.008
 },
 {
  "id": "resortCampusPlanning",
  "name": "Resort Campus Planning",
  "category": 10,
  "tier": 4,
  "requires": [
   "hotelConstructionPlanning",
   "resortDemandForecast",
   "structuralBIM"
  ],
  "resources": {
   "construction": 32,
   "roads": 6661,
   "revenue": 355201
  },
  "products": {
   "siteDigitalTwin": 3,
   "buildReport": 2
  },
  "effect": "Contributes 0.80% towards lower construction project costs (subject to cap)",
  "bonus": "construction",
  "rate": 0.008
 },
 {
  "id": "urbanMixedUseMasterplan",
  "name": "Urban Mixed-Use Masterplan",
  "category": 10,
  "tier": 4,
  "requires": [
   "parkingCampusDesign",
   "mixedUseProjects",
   "structuralBIM"
  ],
  "resources": {
   "construction": 33,
   "roads": 7020,
   "revenue": 374400
  },
  "products": {
   "siteDigitalTwin": 3,
   "buildReport": 2
  },
  "effect": "Contributes 0.80% towards lower construction project costs (subject to cap)",
  "bonus": "construction",
  "rate": 0.008
 },
 {
  "id": "constructionLogisticsCommand",
  "name": "Construction Logistics Command",
  "category": 10,
  "tier": 5,
  "requires": [
   "multiSiteProcurement",
   "urbanMixedUseMasterplan",
   "structuralBIM"
  ],
  "resources": {
   "construction": 57,
   "roads": 12196,
   "revenue": 650401
  },
  "products": {
   "siteDigitalTwin": 4,
   "buildReport": 3
  },
  "effect": "Contributes 1.25% towards lower construction project costs (subject to cap)",
  "bonus": "construction",
  "rate": 0.0125
 }
] as const;

export const MEGA_RESEARCH_DIVISIONS:Readonly<Record<string,readonly string[]>>={
 "revenue": [
  "fareElasticity",
  "journeyPassbook",
  "neighbourhoodDemand",
  "businessTravelHub",
  "airportPeakPlanner",
  "familyFarePlans",
  "nightTravelMarkets",
  "subscriptionEconomy",
  "regionalPriceZones",
  "fareYieldEngine",
  "loyaltyPartnerships",
  "destinationRevenue",
  "seasonalPricing",
  "premiumMarketReach"
 ],
 "taxis": [
  "dispatchTelemetry",
  "urbanRouteBalancing",
  "priorityPassengerRouting",
  "intercityDemandDesk",
  "driverAvailabilityForecast",
  "dynamicFleetCoverage",
  "depotFleetCoordination",
  "trafficIncidentForecast",
  "fleetRevenueCommand",
  "airportTransferNetwork",
  "regionalTaxiContracts",
  "portSignalTower",
  "berthTurnoverModels",
  "islandDemandSignals",
  "ferryConnectionGuarantee",
  "portPassengerExchange",
  "islandTourismPasses",
  "maritimeRevenueGrid"
 ],
 "explorers": [
  "satelliteRecon",
  "roadPriorityMatrix",
  "islandTerrainAtlas",
  "mountainExpeditions",
  "harbourApproachMapping",
  "unmappedRoadInference",
  "crossIslandFrontiers",
  "longRangeSurveying",
  "explorerCoordinationDesk",
  "remoteCoverageAnalytics",
  "roadNetworkAtlas",
  "nationalSurveyProgramme"
 ],
 "hotels": [
  "reservationSignals",
  "lengthOfStayTrends",
  "guestLoyaltyDesk",
  "seasonalRoomMarkets",
  "conferenceHospitality",
  "cityHotelNetworks",
  "resortDemandForecast",
  "destinationGuestNetwork"
 ],
 "parking": [
  "parkingSensorNetwork",
  "turnoverAnalysis",
  "stationParkingBundles",
  "eventParkingPlans",
  "regionalParkingAtlas",
  "hotelValetContracts",
  "parkRideOperations",
  "smartParkingDistricts"
 ],
 "finance": [
  "interbankLiquidity",
  "fleetCashForecast",
  "lendingRiskHeatmap",
  "vehicleResidualModels",
  "loanPortfolioDesk",
  "greenVehicleFinance",
  "refinancingStrategy",
  "hotelAssetFinance",
  "portAssetFinance",
  "corporateCreditLines",
  "riskWeightedFunding",
  "internationalPaymentRails",
  "multisectorCapitalPlan",
  "treasuryCommandCentre"
 ],
 "vehicles": [
  "batteryDiagnostics",
  "serviceLifecycleAnalytics",
  "fuelFlowOptimisation",
  "brakeConditionSignals",
  "predictiveWorkshop",
  "standardFleetComponents",
  "vehicleReliabilityStudy",
  "longHaulDurability",
  "componentExchangeNetwork",
  "fleetEnergyCommand",
  "highMileageOverhauls",
  "fleetEngineeringMastery"
 ],
 "construction": [
  "structuralBIM",
  "contractorScheduling",
  "lowImpactMaterials",
  "automatedBuildingInspections",
  "hotelConstructionPlanning",
  "parkingCampusDesign",
  "multiSiteProcurement",
  "resortCampusPlanning",
  "urbanMixedUseMasterplan",
  "constructionLogisticsCommand"
 ]
} as const;

export const MEGA_RESEARCH_ANCHORS={
 "revenue": "fareElasticity",
 "taxis": "dispatchTelemetry",
 "explorers": "satelliteRecon",
 "hotels": "reservationSignals",
 "parking": "parkingSensorNetwork",
 "finance": "interbankLiquidity",
 "vehicles": "batteryDiagnostics",
 "construction": "structuralBIM"
} as const;
export const MEGA_RESEARCH_PRODUCTS={
 "revenue": "fareMatrix",
 "taxis": "dispatchProtocol",
 "explorers": "cartographyAtlas",
 "hotels": "guestJourneyMap",
 "parking": "parkingAutomationPlan",
 "finance": "bankRiskGrid",
 "vehicles": "componentBlueprint",
 "construction": "siteDigitalTwin"
} as const;
