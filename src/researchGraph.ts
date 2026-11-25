import {MEGA_RESEARCH_DIVISIONS} from './researchMegaCatalog';
import {technologyParents,maximum} from './researchProgress';
import {PARENT_LEVEL_REQUIREMENTS,STARTER_STAGES,researchNodeId} from './researchAutomatic';

/** Curated compact research diagram: real prerequisite connectors, not
 * arbitrary "cards in category columns". Coordinates are CSS pixels in the
 * unscaled scroll/zoom canvas; all real technologies have one node.
 */
export const RESEARCH_NODE_SIZE=54;
export const RESEARCH_CANVAS_WIDTH=760;
export const RESEARCH_LANES:readonly (readonly string[])[]=[
 ['pricing','peakPricing','premium','longDistance','demandIntelligence','airportMarkets','corporatePassengers','fareBundles','commuterPasses','eventSurgeForecast','vipTransfers','destinationPackages',...MEGA_RESEARCH_DIVISIONS.revenue],
 ['engine','fuelInjection','durability','lubrication','lightweight','conditionPrediction','powertrainAdaptation','vehicleLifecycle','tyreTelemetry','hybridPowertrains','partsStandardisation','fleetLifecycleAI',...MEGA_RESEARCH_DIVISIONS.vehicles],
 ['fleetAnalytics','dispatchResearch','routing','regionalReposition','multiDepotDispatch','profitAwareFleet','smartPooling','hubTransfers',...MEGA_RESEARCH_DIVISIONS.taxis,'collectorBasics','collectorMedium','collectorHeavy','collectorUtility','collectorCargo','collectorLoading','collectorPriority','collectorRouting','collectorDispatch','collectorRegional','collectorIndustrial','collectorNational'],
 ['survey','navigation','patrol','explorerExpansion','coordinatedFrontiers','coverageIntelligence','harbourSurvey','terrainMapping','expeditionPlanning','roadGraphInference','islandRecon',...MEGA_RESEARCH_DIVISIONS.explorers],
 ['trainingResearch','ecoDriving','defensive','driverSpecialisation','advancedScheduling','safetyCertification','fleetShiftHandover'],
 ['depotEfficiency','workshopResearch','parts','preventiveCalendar','parkingYield','networkLogistics','parkingDemandPrediction','smartTariffs','automatedAccess','hotelParkingPackages',...MEGA_RESEARCH_DIVISIONS.parking],
 ['advertising','brand','loyalty','regionalReputation','tourismPartnerships','customerRetention'],
 ['procurement','insuranceResearch','efficiency','creditRiskModels','financeNegotiation','treasuryForecast','liquiditySignals','creditPortfolio','financeAutomation','assetBackedFunding','globalSettlement',...MEGA_RESEARCH_DIVISIONS.finance],
 ['portAnalytics','ferryTimetabling','fleetTurnaround','harbourConnections','interIslandTickets','premiumFerryServices'],
 ['occupancyForecast','guestExperience','hotelAutomation','frontDeskAnalytics','roomYield','conciergeNetwork','resortOperations',...MEGA_RESEARCH_DIVISIONS.hotels],
 ['modularBuilding','materialLogistics','qualityInspection','siteSurveys','greenBuildings','supplyChains','prefabHotels','mixedUseProjects',...MEGA_RESEARCH_DIVISIONS.construction],
 ['corporateDueDiligence','subsidiaryIntegration','crossBorderTreasury']
];
export type ResearchDiagramNode={id:string;x:number;y:number;lane:number;order:number};
export type ResearchDiagramEdge={from:string;to:string;path:string};
export type ResearchDiagram={width:number;height:number;nodes:ResearchDiagramNode[];edges:ResearchDiagramEdge[]};
export const RESEARCH_GLYPHS:Readonly<Record<string,string>>={
 pricing:'💶',peakPricing:'📈',premium:'⭐',longDistance:'🛣️',demandIntelligence:'📊',airportMarkets:'✈️',corporatePassengers:'💼',
 engine:'🔧',fuelInjection:'⛽',durability:'🛡️',lubrication:'🛢️',lightweight:'⚙️',conditionPrediction:'🔍',powertrainAdaptation:'🔋',vehicleLifecycle:'🚙',
 fleetAnalytics:'📉',dispatchResearch:'🚕',routing:'🧭',regionalReposition:'📍',multiDepotDispatch:'🏢',profitAwareFleet:'🌐',
 survey:'🗺️',navigation:'🛰️',patrol:'🚗',explorerExpansion:'🚙',coordinatedFrontiers:'🧩',coverageIntelligence:'🛤️',harbourSurvey:'⚓',
 trainingResearch:'🎓',ecoDriving:'🌱',defensive:'🦺',driverSpecialisation:'🧑‍✈️',advancedScheduling:'🗓️',safetyCertification:'🏅',
 depotEfficiency:'🏠',workshopResearch:'🛠️',parts:'🔩',preventiveCalendar:'📅',parkingYield:'🅿️',networkLogistics:'📦',
 advertising:'📣',brand:'🏷️',loyalty:'🤝',regionalReputation:'🌟',tourismPartnerships:'🌴',customerRetention:'💚',
 procurement:'🛒',insuranceResearch:'📋',efficiency:'🔬',creditRiskModels:'🏦',financeNegotiation:'💳',treasuryForecast:'💰',
 portAnalytics:'🛳️',ferryTimetabling:'⏱️',fleetTurnaround:'⛴️',
 occupancyForecast:'🛏️',guestExperience:'🛎️',hotelAutomation:'🏨',
 modularBuilding:'🧱',materialLogistics:'🚚',qualityInspection:'🏗️',
 corporateDueDiligence:'🔎',subsidiaryIntegration:'🏙️',crossBorderTreasury:'🌍'
};
export const RESEARCH_RESOURCE_GLYPHS:Record<string,string>={
 roads:'🛣️',passengers:'🚕',revenue:'💶',parking:'🅿️',hotels:'🏨',ferries:'⛴️',
 distance:'🧭',maintenance:'🔧',construction:'🏗️',corporate:'🏢'
};
export function buildResearchDiagram(allIds:readonly string[]):ResearchDiagram{
 const allowed=new Set(allIds);
 const nodes:ResearchDiagramNode[]=[];
 for(let lane=0;lane<RESEARCH_LANES.length;lane++){
  const group=RESEARCH_LANES[lane];
  for(let order=0;order<group.length;order++){
   const id=group[order];
   if(!allowed.has(id))continue;
   const firstStage=lane<8;
   const column=firstStage?lane:lane-7;
   const baseX=firstStage?38+column*90:128+column*105;
   const offset=(order%3===1?8:order%3===2?-6:0);
   const baseY=(firstStage?145:930)+order*94+(lane%2===1?20:0);
   nodes.push({id,x:baseX+offset,y:baseY,lane,order});
  }
 }
 const byId=new Map(nodes.map(n=>[n.id,n]));
 const edges:ResearchDiagramEdge[]=[];
 for(const to of nodes){
  for(const parent of technologyParents(to.id)){
   const from=byId.get(parent);
   if(!from)continue;
   const sx=from.x+RESEARCH_NODE_SIZE/2,sy=from.y+RESEARCH_NODE_SIZE;
   const ex=to.x+RESEARCH_NODE_SIZE/2,ey=to.y;
   const mid=sy+Math.max(15,(ey-sy)*.50);
   edges.push({from:parent,to:to.id,path:`M ${sx} ${sy} V ${mid} H ${ex} V ${ey}`});
  }
 }
 return {width:RESEARCH_CANVAS_WIDTH,height:Math.max(1400,...nodes.map(n=>n.y+RESEARCH_NODE_SIZE+80)),nodes,edges};
}

/** Each research level is a distinct tile with its own prerequisites.
 * Layout stays narrow enough for a readable iPhone overview, then scrolls
 * down through all divisions rather than creating a 12-column spreadsheet.
 */
export type LevelDiagramNode={
 id:string;projectId:string;level:number;x:number;y:number;lane:number;type:'starter'|'technology';
};
export type LevelDiagramEdge={from:string;to:string;path:string;kind:'level'|'dependency'|'starter'};
export type LevelDiagram={
 width:number;height:number;nodes:LevelDiagramNode[];edges:LevelDiagramEdge[];
 divisions:{category:number;x:number;y:number}[];
};
export function buildLevelResearchDiagram(allIds:readonly string[]):LevelDiagram{
 const available=new Set(allIds);
 const nodes:LevelDiagramNode[]=[];
 const byId=new Map<string,LevelDiagramNode>();
 const add=(node:LevelDiagramNode)=>{nodes.push(node);byId.set(node.id,node)};
 const width=760;
 const center=width/2-RESEARCH_NODE_SIZE/2;
 for(const stage of STARTER_STAGES){
  add({id:'starter:'+stage.level,projectId:'starter',level:stage.level,
   x:center,y:54+(stage.level-1)*84,lane:-1,type:'starter'});
 }
 const divisions:{category:number;x:number;y:number}[]=[];
 for(let lane=0;lane<RESEARCH_LANES.length;lane++){
  const group=RESEARCH_LANES[lane];
  const x=lane<8?31+lane*95:112+(lane-8)*170;
  let y=lane<8?536:3330;
  divisions.push({category:lane,x,y:y-45});
  for(const id of group){
   if(!available.has(id))continue;
   const cap=maximum(id);
   for(let level=1;level<=cap;level++){
    add({id:researchNodeId(id,level),projectId:id,level,x,y,lane,type:'technology'});
    y+=75;
   }
   y+=24;
  }
 }
 const edges:LevelDiagramEdge[]=[];
 const connect=(from:LevelDiagramNode|undefined,to:LevelDiagramNode|undefined,kind:LevelDiagramEdge['kind'])=>{
  if(!from||!to)return;
  const sx=from.x+RESEARCH_NODE_SIZE/2,sy=from.y+RESEARCH_NODE_SIZE;
  const ex=to.x+RESEARCH_NODE_SIZE/2,ey=to.y;
  if(sx===ex&&ey>=sy){
   edges.push({from:from.id,to:to.id,kind,path:`M ${sx} ${sy} V ${ey}`});
  }else{
   const mid=sy+(ey>=sy?Math.max(16,(ey-sy)*.48):38);
   edges.push({from:from.id,to:to.id,kind,
    path:`M ${sx} ${sy} V ${mid} H ${ex} V ${ey}`});
  }
 };
 for(let level=2;level<=STARTER_STAGES.length;level++)
  connect(byId.get('starter:'+(level-1)),byId.get('starter:'+level),'starter');
 const gate=byId.get('starter:'+STARTER_STAGES.length);
 for(const lane of RESEARCH_LANES){
  const first=lane.find(id=>available.has(id));
  if(first){
   const starter=byId.get(researchNodeId(first,1));
   // Those roots open after graduation. The prerequisite graph may still
   // provide additional cross-branch requirements for later technologies.
   connect(gate,starter,'starter');
  }
 }
 for(const node of nodes){
  if(node.type==='starter')continue;
  if(node.level>1){
   connect(byId.get(researchNodeId(node.projectId,node.level-1)),node,'level');
  }else{
   for(const parent of technologyParents(node.projectId)){
    connect(byId.get(researchNodeId(parent,PARENT_LEVEL_REQUIREMENTS[node.projectId]?.[parent]??1)),node,'dependency');
   }
  }
 }
 return {width,height:Math.max(3720,...nodes.map(n=>n.y+RESEARCH_NODE_SIZE+80)),nodes,edges,divisions};
}
