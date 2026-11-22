import {technologyParents} from './researchProgress';

/** Curated compact research diagram: real prerequisite connectors, not
 * arbitrary "cards in category columns". Coordinates are CSS pixels in the
 * unscaled scroll/zoom canvas; all 64 real technologies have one node.
 */
export const RESEARCH_NODE_SIZE=54;
export const RESEARCH_CANVAS_WIDTH=760;
export const RESEARCH_LANES:readonly (readonly string[])[]=[
 ['pricing','peakPricing','premium','longDistance','demandIntelligence','airportMarkets','corporatePassengers'],
 ['engine','fuelInjection','durability','lubrication','lightweight','conditionPrediction','powertrainAdaptation','vehicleLifecycle'],
 ['fleetAnalytics','dispatchResearch','routing','regionalReposition','multiDepotDispatch','profitAwareFleet'],
 ['survey','navigation','patrol','explorerExpansion','coordinatedFrontiers','coverageIntelligence','harbourSurvey'],
 ['trainingResearch','ecoDriving','defensive','driverSpecialisation','advancedScheduling','safetyCertification'],
 ['depotEfficiency','workshopResearch','parts','preventiveCalendar','parkingYield','networkLogistics'],
 ['advertising','brand','loyalty','regionalReputation','tourismPartnerships','customerRetention'],
 ['procurement','insuranceResearch','efficiency','creditRiskModels','financeNegotiation','treasuryForecast'],
 ['portAnalytics','ferryTimetabling','fleetTurnaround'],
 ['occupancyForecast','guestExperience','hotelAutomation'],
 ['modularBuilding','materialLogistics','qualityInspection'],
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
 return {width:RESEARCH_CANVAS_WIDTH,height:1400,nodes,edges};
}
