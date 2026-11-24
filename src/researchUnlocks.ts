import type {ResearchState} from './research';

/** All saves must earn technology; legacy saves retain starter graduation. */
export const BUSINESS_UNLOCKS={
 Dealership:{name:'Vehicle Dealership',starter:5},
 Drivers:{name:'Driver Management',id:'trainingResearch',level:1},
 Operations:{name:'Operations Centre',id:'fleetAnalytics',level:1},
 Ferries:{name:'Ferry Operations',id:'portAnalytics',level:1},
 Investments:{name:'Property Investments & Parking',id:'depotEfficiency',level:2},
 Hotels:{name:'Hotels & Construction',id:'advertising',level:2},
 Company:{name:'Company Management',id:'depotEfficiency',level:1},
 Finance:{name:'Finance & Banking',id:'procurement',level:1},
 Energy:{name:'Energy Management',id:'engine',level:2},
 'Stock Market':{name:'Stock Market',id:'procurement',level:2},
 Infrastructure:{name:'Infrastructure',id:'modularBuilding',level:1},
 Tourism:{name:'Tourism',id:'tourismPartnerships',level:1},
 Contracts:{name:'Contracts',id:'corporatePassengers',level:1},
 Workforce:{name:'Workforce',id:'advancedScheduling',level:1},
 'Explorer AI':{name:'Explorer Automation',id:'coordinatedFrontiers',level:1}
} as const;
export type LockedFeature=keyof typeof BUSINESS_UNLOCKS;
export const BASE_GAME_FEATURES=['World','Research','Fleet'] as const;
export function lockedFeature(feature:string,companyIsNew:boolean,state:ResearchState):string|null{
 if((BASE_GAME_FEATURES as readonly string[]).includes(feature))return null;
 const rule=BUSINESS_UNLOCKS[feature as LockedFeature];
 if(!rule)return 'Continue research to unlock '+feature;
 if('starter' in rule)return (!companyIsNew||(state.starterLevel??0)>=rule.starter)?null:
  rule.name+' requires Starter Level '+rule.starter+' (50 completed taxi jobs and 2,000 discovered roads)';
 return (state.levels[rule.id]??0)>=rule.level?null:
  rule.name+' requires '+rule.id+' Level '+rule.level;
}

export function vehicleResearchLock(state:ResearchState,offer:{className:string;fuel:string}):string|null{
 if((offer.className==='Premium'||offer.className==='XL')&&(state.levels.premium??0)<1)return 'Premium and XL vehicles require Premium Passenger Service Level 1';
 if((offer.fuel==='Electric'||offer.fuel==='Hybrid')&&(state.levels.engine??0)<2)return 'Electric and hybrid vehicles require Engine Efficiency Level 2';
 return null;
}
const UPGRADE_TECH={fuel:'engine',workshop:'workshopResearch',dispatch:'dispatchResearch',training:'trainingResearch'} as const;
export function upgradeResearchLock(state:ResearchState,id:keyof typeof UPGRADE_TECH):string|null{
 const tech=UPGRADE_TECH[id];return (state.levels[tech]??0)>=1?null:id+' upgrade requires '+tech+' Level 1';
}
