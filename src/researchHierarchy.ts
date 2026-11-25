import {MEGA_RESEARCH_DIVISIONS} from './researchMegaCatalog';
import {maximum,technologyParents} from './researchProgress';
import {PARENT_LEVEL_REQUIREMENTS,STARTER_STAGES,researchNodeId} from './researchAutomatic';

export const RESEARCH_TILE_SIZE=46;
export type DivisionKey='revenue'|'taxis'|'explorers'|'hotels'|'parking'|'finance'|'vehicles'|'construction'|'collectors';
export type HierarchyNode={
 id:string;projectId:string;level:number;category:number;rank:number;x:number;y:number;
 kind:'starter'|'division'|'research';division?:DivisionKey;
};
export type HierarchyEdge={
 from:string;to:string;path:string;
 kind:'starter'|'division'|'prerequisite'|'level'|'visual';
 visible:boolean;
};
export type HierarchyJunction={id:string;x:number;y:number;inputs:number};
export type ResearchHierarchy={
 width:number;height:number;nodes:HierarchyNode[];edges:HierarchyEdge[];
 junctions:HierarchyJunction[];byId:Map<string,HierarchyNode>;initialId:string;
};

/** The exact eight first-row divisions from the approved design. These
 * definitions are an intentionally authored hierarchy, NOT a generated grid.
 * The underlying technologies are still the real, individually researched
 * levels: no placeholder unlocks, no extra vehicles and no final trophy.
 */
export const DIVISIONS:readonly {
 key:DivisionKey;name:string;category:number;root:string;
 projects:readonly string[];lanes:number;
}[]=[
 {key:'revenue',name:'Revenue',category:0,root:'pricing',lanes:4,projects:[
  'pricing','peakPricing','fareBundles','commuterPasses','premium','vipTransfers',
  'longDistance','demandIntelligence','eventSurgeForecast','airportMarkets',
  'corporatePassengers','advertising','brand','loyalty','regionalReputation',
  'tourismPartnerships','customerRetention','destinationPackages',
  ...MEGA_RESEARCH_DIVISIONS.revenue]},
 {key:'taxis',name:'Taxis & Ferries',category:2,root:'fleetAnalytics',lanes:5,projects:[
  'fleetAnalytics','dispatchResearch','routing','smartPooling','regionalReposition',
  'multiDepotDispatch','hubTransfers','profitAwareFleet','trainingResearch','ecoDriving',
  'defensive','driverSpecialisation','advancedScheduling','fleetShiftHandover',
  'safetyCertification','portAnalytics','harbourConnections','ferryTimetabling',
  'interIslandTickets','fleetTurnaround','premiumFerryServices',
  ...MEGA_RESEARCH_DIVISIONS.taxis]},
 {key:'explorers',name:'Explorers',category:3,root:'survey',lanes:4,projects:[
  'survey','navigation','terrainMapping','patrol','explorerExpansion','coordinatedFrontiers',
  'expeditionPlanning','coverageIntelligence','roadGraphInference','harbourSurvey','islandRecon',
  ...MEGA_RESEARCH_DIVISIONS.explorers]},
 {key:'hotels',name:'Hotels',category:9,root:'occupancyForecast',lanes:3,projects:[
  'occupancyForecast','frontDeskAnalytics','roomYield','guestExperience',
  'conciergeNetwork','hotelAutomation','resortOperations',
  ...MEGA_RESEARCH_DIVISIONS.hotels]},
 {key:'parking',name:'Parking',category:5,root:'depotEfficiency',lanes:3,projects:[
  'depotEfficiency','parkingYield','parkingDemandPrediction','smartTariffs',
  'automatedAccess','hotelParkingPackages','networkLogistics',
  ...MEGA_RESEARCH_DIVISIONS.parking]},
 {key:'finance',name:'Banking & Finance',category:7,root:'procurement',lanes:4,projects:[
  'procurement','liquiditySignals','insuranceResearch','efficiency','creditRiskModels',
  'creditPortfolio','financeAutomation','financeNegotiation','treasuryForecast',
  'assetBackedFunding','corporateDueDiligence','subsidiaryIntegration',
  'crossBorderTreasury','globalSettlement',
  ...MEGA_RESEARCH_DIVISIONS.finance]},
 {key:'vehicles',name:'Fleet & Vehicles',category:1,root:'engine',lanes:4,projects:[
  'engine','fuelInjection','durability','conditionPrediction','tyreTelemetry','lubrication',
  'lightweight','powertrainAdaptation','hybridPowertrains','vehicleLifecycle',
  'fleetLifecycleAI','workshopResearch','parts','partsStandardisation','preventiveCalendar',
  ...MEGA_RESEARCH_DIVISIONS.vehicles]},
 {key:'construction',name:'Construction',category:10,root:'modularBuilding',lanes:3,projects:[
  'modularBuilding','siteSurveys','materialLogistics','greenBuildings','supplyChains',
  'qualityInspection','prefabHotels','mixedUseProjects',
  ...MEGA_RESEARCH_DIVISIONS.construction]},
 {key:'collectors',name:'Resource Collectors',category:2,root:'collectorBasics',lanes:4,projects:["collectorBasics","collectorMedium","collectorHeavy","collectorUtility","collectorCargo","collectorLoading","collectorPriority","collectorRouting","collectorDispatch","collectorRegional","collectorIndustrial","collectorNational"]}
] as const;
const COL=70,ROW=72,START_Y=78,DIVISION_Y=START_Y+STARTER_STAGES.length*ROW+88;
const TECH_Y=DIVISION_Y+108,SPACE=48;

/** Side branches are ordered by function, not by project category or ID. */
const FORK_ORDER:Readonly<Record<string,readonly string[]>>={
 pricing:['peakPricing','demandIntelligence','advertising'],
 peakPricing:['premium','fareBundles'],
 fareBundles:['commuterPasses','destinationPackages'],
 demandIntelligence:['airportMarkets','eventSurgeForecast'],
 airportMarkets:['corporatePassengers','vipTransfers','destinationPackages'],
 advertising:['brand','regionalReputation','loyalty'],
 brand:['loyalty'],regionalReputation:['tourismPartnerships','customerRetention'],
 tourismPartnerships:['destinationPackages','conciergeNetwork'],
 fleetAnalytics:['dispatchResearch','trainingResearch','portAnalytics'],
 dispatchResearch:['routing','smartPooling'],
 routing:['regionalReposition','smartPooling','harbourConnections'],
 trainingResearch:['ecoDriving','defensive','driverSpecialisation'],
 driverSpecialisation:['advancedScheduling','fleetShiftHandover','safetyCertification'],
 advancedScheduling:['fleetShiftHandover','safetyCertification'],
 multiDepotDispatch:['hubTransfers','profitAwareFleet'],
 portAnalytics:['harbourConnections','ferryTimetabling'],
 harbourConnections:['interIslandTickets'],
 ferryTimetabling:['fleetTurnaround','interIslandTickets'],
 interIslandTickets:['premiumFerryServices'],
 survey:['navigation','terrainMapping','patrol','explorerExpansion'],
 navigation:['terrainMapping','patrol','explorerExpansion','coordinatedFrontiers'],
 terrainMapping:['expeditionPlanning','roadGraphInference'],
 coordinatedFrontiers:['coverageIntelligence','expeditionPlanning'],
 coverageIntelligence:['roadGraphInference','harbourSurvey'],
 harbourSurvey:['islandRecon'],
 occupancyForecast:['frontDeskAnalytics','guestExperience'],
 frontDeskAnalytics:['roomYield','resortOperations'],
 guestExperience:['conciergeNetwork','hotelAutomation'],
 depotEfficiency:['parkingYield','networkLogistics'],
 parkingYield:['parkingDemandPrediction','automatedAccess'],
 parkingDemandPrediction:['smartTariffs'],
 smartTariffs:['hotelParkingPackages'],
 procurement:['liquiditySignals','insuranceResearch','efficiency','creditRiskModels','corporateDueDiligence'],
 liquiditySignals:['creditPortfolio','financeAutomation'],
 creditRiskModels:['creditPortfolio','financeNegotiation','treasuryForecast'],
 creditPortfolio:['assetBackedFunding'],
 assetBackedFunding:['globalSettlement'],
 engine:['fuelInjection','durability','lightweight','powertrainAdaptation','workshopResearch'],
 durability:['conditionPrediction','tyreTelemetry','lubrication','vehicleLifecycle'],
 conditionPrediction:['tyreTelemetry','vehicleLifecycle'],
 powertrainAdaptation:['hybridPowertrains','vehicleLifecycle'],
 workshopResearch:['parts','preventiveCalendar'],
 parts:['partsStandardisation'],
 vehicleLifecycle:['fleetLifecycleAI'],
 modularBuilding:['siteSurveys','materialLogistics'],
 siteSurveys:['greenBuildings','supplyChains'],
 qualityInspection:['prefabHotels'],
 prefabHotels:['mixedUseProjects']
};
const VISIBLE_PARENT:Readonly<Record<string,string>>={
 fareBundles:'peakPricing',commuterPasses:'fareBundles',
 eventSurgeForecast:'demandIntelligence',vipTransfers:'airportMarkets',
 destinationPackages:'tourismPartnerships',
 smartPooling:'dispatchResearch',fleetShiftHandover:'advancedScheduling',
 harbourConnections:'portAnalytics',interIslandTickets:'harbourConnections',
 hubTransfers:'multiDepotDispatch',premiumFerryServices:'interIslandTickets',
 terrainMapping:'navigation',expeditionPlanning:'coordinatedFrontiers',
 roadGraphInference:'coverageIntelligence',islandRecon:'harbourSurvey',
 frontDeskAnalytics:'occupancyForecast',roomYield:'frontDeskAnalytics',
 conciergeNetwork:'guestExperience',resortOperations:'hotelAutomation',
 parkingDemandPrediction:'parkingYield',smartTariffs:'parkingDemandPrediction',
 automatedAccess:'parkingYield',hotelParkingPackages:'smartTariffs',
 liquiditySignals:'procurement',creditPortfolio:'creditRiskModels',
 financeAutomation:'liquiditySignals',assetBackedFunding:'creditPortfolio',
 globalSettlement:'assetBackedFunding',
 tyreTelemetry:'conditionPrediction',hybridPowertrains:'powertrainAdaptation',
 partsStandardisation:'parts',fleetLifecycleAI:'vehicleLifecycle',
 siteSurveys:'modularBuilding',greenBuildings:'siteSurveys',
 supplyChains:'materialLogistics',prefabHotels:'qualityInspection',
 mixedUseProjects:'prefabHotels',
 peakPricing:'pricing',demandIntelligence:'pricing',advertising:'pricing',
 airportMarkets:'demandIntelligence',corporatePassengers:'airportMarkets',
 loyalty:'brand',customerRetention:'regionalReputation',tourismPartnerships:'regionalReputation',
 regionalReposition:'routing',profitAwareFleet:'multiDepotDispatch',
 safetyCertification:'advancedScheduling',advancedScheduling:'driverSpecialisation',
 multiDepotDispatch:'regionalReposition',ferryTimetabling:'portAnalytics',
 fleetTurnaround:'ferryTimetabling',explorerExpansion:'navigation',
 coordinatedFrontiers:'navigation',coverageIntelligence:'coordinatedFrontiers',
 harbourSurvey:'coverageIntelligence',parkingYield:'depotEfficiency',
 networkLogistics:'depotEfficiency',treasuryForecast:'creditRiskModels',
 financeNegotiation:'creditRiskModels',crossBorderTreasury:'subsidiaryIntegration',
 vehicleLifecycle:'conditionPrediction',powertrainAdaptation:'engine'
};
const BRANCH_LEVEL:Readonly<Record<string,number>>={
 pricing:3,peakPricing:2,advertising:3,brand:2,
 fleetAnalytics:3,trainingResearch:2,dispatchResearch:2,
 survey:2,navigation:2,procurement:2,engine:2,
 depotEfficiency:2
};
export function visualParentLevel(parent:string,child:string):number{
 if(child==='regionalReposition'&&parent==='routing')return 2;
 return BRANCH_LEVEL[parent]??1;
}
const orderFor=(parent:string,child:string,index:number)=>{
 const list=FORK_ORDER[parent]??[];
 const n=list.indexOf(child);
 return n<0?100+index:n;
};
function connectPath(from:HierarchyNode,to:HierarchyNode):string{
 const sx=from.x+RESEARCH_TILE_SIZE/2,sy=from.y+RESEARCH_TILE_SIZE;
 const ex=to.x+RESEARCH_TILE_SIZE/2,ey=to.y;
 if(sx===ex)return `M ${sx} ${sy} V ${ey}`;
 const bus=Math.min(ey-11,sy+18);
 return `M ${sx} ${sy} V ${bus} H ${ex} V ${ey}`;
}

/** Place projects separately INSIDE their divisions, so one branch can have
 * 40+ nodes while its neighbour has 3. Each technology's level nodes form
 * a contiguous trail; children fork near their visually relevant ancestor.
 */
export function buildResearchHierarchy(ids:readonly string[]):ResearchHierarchy{
 const available=new Set(ids);
 const assigned=new Set<string>();
 const divisions=DIVISIONS.map(group=>{
  const included=group.projects.filter(id=>available.has(id));
  included.forEach(id=>{
   if(assigned.has(id))throw Error('Duplicate project in tree: '+id);
   assigned.add(id);
  });
  return {...group,included};
 });
 const missing=ids.filter(id=>!assigned.has(id));
 if(missing.length)throw Error('Unassigned technology: '+missing.join(', '));
 const widthByDivision=divisions.map(group=>Math.max(215,2*group.lanes*COL+RESEARCH_TILE_SIZE+SPACE));
 const centers:number[]=[];
 let cursor=120;
 for(let i=0;i<divisions.length;i++){
  const group=divisions[i];
  const radius=group.lanes*COL+RESEARCH_TILE_SIZE/2;
  centers.push(cursor+radius);
  cursor+=widthByDivision[i];
 }
 const width=cursor+120;
 const center=width/2-RESEARCH_TILE_SIZE/2;
 const nodes:HierarchyNode[]=[],edges:HierarchyEdge[]=[],junctions:HierarchyJunction[]=[];
 const byId=new Map<string,HierarchyNode>();
 const add=(node:HierarchyNode)=>{nodes.push(node);byId.set(node.id,node);};
 const link=(source:string,target:string,kind:HierarchyEdge['kind'],visible=true)=>{
  const from=byId.get(source),to=byId.get(target);
  if(!from||!to)throw Error('Unknown research connection: '+source+' → '+target);
  edges.push({from:source,to:target,kind,visible,path:connectPath(from,to)});
 };
 for(const stage of STARTER_STAGES){
  add({id:'starter:'+stage.level,projectId:'starter',level:stage.level,
   category:-1,kind:'starter',rank:stage.level-1,x:center,
   y:START_Y+(stage.level-1)*ROW});
  if(stage.level>1)link('starter:'+(stage.level-1),'starter:'+stage.level,'starter');
 }
 let lowest=DIVISION_Y+ROW;
 for(let g=0;g<divisions.length;g++){
  const group=divisions[g],baseX=centers[g]-RESEARCH_TILE_SIZE/2;
  const divisionId='division:'+group.key;
  add({id:divisionId,projectId:group.root,level:0,kind:'division',
   category:group.category,division:group.key,rank:STARTER_STAGES.length,
   x:baseX,y:DIVISION_Y});
  link('starter:'+STARTER_STAGES.length,divisionId,'division');
  if(!group.included.length)continue;
  const localSet=new Set(group.included);
  const parents=new Map<string,string|undefined>();
  for(const id of group.included){
   if(id===group.root){parents.set(id,undefined);continue;}
   const actual=technologyParents(id).filter(parent=>localSet.has(parent));
   const preferred=VISIBLE_PARENT[id];
   parents.set(id,preferred&&actual.includes(preferred)?preferred:
    actual[0]??group.root);
  }
  const children=new Map<string,string[]>();
  for(const [id,parent] of parents){
   if(!parent)continue;
   const groupChildren=children.get(parent)??[];
   groupChildren.push(id);children.set(parent,groupChildren);
  }
  for(const [parent,groupChildren] of children){
   groupChildren.sort((a,b)=>orderFor(parent,a,group.included.indexOf(a))-
    orderFor(parent,b,group.included.indexOf(b)));
  }
  const depthMemo=new Map<string,number>(),seen=new Set<string>();
  const depth=(id:string):number=>{
   if(depthMemo.has(id))return depthMemo.get(id)!;
   if(seen.has(id))throw Error('Cycle in visual division '+group.key+': '+id);
   seen.add(id);
   const parent=parents.get(id);
   const d=parent?depth(parent)+1:0;
   seen.delete(id);depthMemo.set(id,d);return d;
  };
  const sorted=[...group.included].sort((a,b)=>depth(a)-depth(b)||
   group.included.indexOf(a)-group.included.indexOf(b));
  type Placed={col:number;rank:number};
  const placed=new Map<string,Placed>();
  const occupied=new Set<string>();
  for(const id of sorted){
   const parent=parents.get(id);
   const cap=maximum(id);
   const siblings=parent?children.get(parent)??[]:[];
   const index=siblings.indexOf(id);
   const offset=index-(siblings.length-1)/2;
   const upstream=parent?placed.get(parent):undefined;
   if(parent&&!upstream)throw Error('Missing division parent '+parent);
   const preferred=upstream?upstream.col+Math.round(offset*1.65):0;
   const row=upstream?upstream.rank+Math.min(maximum(parent!),visualParentLevel(parent!,id))+1:0;
   let choice:{col:number;rank:number;score:number}|undefined;
   for(let delay=0;delay<=260;delay++){
    for(let radius=0;radius<=group.lanes*2;radius++){
     const candidates=radius===0?[preferred]:[preferred-radius,preferred+radius];
     for(const col of candidates){
      if(col< -group.lanes||col>group.lanes)continue;
      const rank=row+delay;
      let clear=true;
      for(let l=0;l<cap;l++){
       if(occupied.has(col+':'+(rank+l))){clear=false;break;}
      }
      if(!clear)continue;
      const score=delay*4+Math.abs(col-preferred)*9;
      if(!choice||score<choice.score)choice={col,rank,score};
     }
    }
    if(choice&&delay>4)break;
   }
   if(!choice)throw Error('Cannot place technology '+id);
   placed.set(id,choice);
   for(let l=0;l<cap;l++){
    occupied.add(choice.col+':'+(choice.rank+l));
    const level=l+1,y=TECH_Y+(choice.rank+l)*ROW;
    add({id:researchNodeId(id,level),projectId:id,level,
     kind:'research',division:group.key,category:group.category,
     rank:STARTER_STAGES.length+2+choice.rank+l,
     x:baseX+choice.col*COL,y});
    lowest=Math.max(lowest,y+RESEARCH_TILE_SIZE);
   }
  }
  // Author each branch, while retaining every extra actual dependency as
  // metadata-only connectors (displayed in the node's requirements drawer).
  for(const id of sorted){
   const parent=parents.get(id);
   const target=researchNodeId(id,1);
   const source=parent?researchNodeId(parent,Math.min(maximum(parent),visualParentLevel(parent,id))):divisionId;
   if(!parent)link(divisionId,target,'division');
   const real=technologyParents(id);
   let visibleMatches=false;
   for(const realParent of real){
    const realSource=researchNodeId(realParent,PARENT_LEVEL_REQUIREMENTS[id]?.[realParent]??1);
    if(!byId.has(realSource))continue;
    const visible=realSource===source;
    link(realSource,target,'prerequisite',visible);
    if(visible)visibleMatches=true;
   }
   if(parent&&!visibleMatches)link(source,target,'visual');
   for(let level=2;level<=maximum(id);level++)
    link(researchNodeId(id,level-1),researchNodeId(id,level),'level');
   if(real.length>=2){
    const to=byId.get(target)!;
    junctions.push({id:target,x:to.x+RESEARCH_TILE_SIZE/2,y:to.y-12,inputs:real.length});
   }
  }
 }
 // Cross-division prerequisite edges are intentionally invisible, but
 // retained in the graph for full requirement inspection and verification.
 for(const id of ids)for(const parent of technologyParents(id)){
  const from=researchNodeId(parent,PARENT_LEVEL_REQUIREMENTS[id]?.[parent]??1);
  const to=researchNodeId(id,1);
  if(byId.has(from)&&byId.has(to)&&!edges.some(edge=>edge.from===from&&edge.to===to))
   link(from,to,'prerequisite',false);
 }
 const height=lowest+175;
 return {width,height,nodes,edges,junctions,byId,initialId:'starter:1'};
}
