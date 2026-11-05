// Optional, in-memory diagnostics. Never included in game saves.
export type PerformanceSnapshot={fps:number;frameSpikes:number;maxFrameMs:number;simulationMs:number;vehicles:number;exploredRoads:number;explorationDelta:number;sourceMs:number;sourceUpdates:number;visibleExplored:number};
const metrics:PerformanceSnapshot={fps:0,frameSpikes:0,maxFrameMs:0,simulationMs:0,vehicles:0,exploredRoads:0,explorationDelta:0,sourceMs:0,sourceUpdates:0,visibleExplored:0};
let enabled=false;
export function enablePerformanceMonitor(value:boolean){enabled=value;if(!value){metrics.frameSpikes=0;metrics.maxFrameMs=0;metrics.sourceUpdates=0;metrics.explorationDelta=0;}}
export function performanceMonitorEnabled(){return enabled;}
export function recordPerformance(values:Partial<PerformanceSnapshot>){if(enabled)Object.assign(metrics,values);}
export function incrementPerformance(key:'frameSpikes'|'sourceUpdates'|'explorationDelta',by=1){if(enabled)metrics[key]+=by;}
export function readPerformance():PerformanceSnapshot{return {...metrics};}
export function recordFrameGap(ms:number){if(!enabled)return;if(ms>50)metrics.frameSpikes++;if(ms>metrics.maxFrameMs)metrics.maxFrameMs=ms;}
