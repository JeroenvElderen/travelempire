// Optional, in-memory diagnostics. Never included in game saves.
export type PerformanceSnapshot={fps:number;frameSpikes:number;maxFrameMs:number;simulationMs:number;simulationAvgMs:number;simulationMaxMs:number;simulationMovementMs:number;simulationAccountingMs:number;vehicles:number;exploredRoads:number;explorationDelta:number;sourceMs:number;sourceUpdates:number;visibleExplored:number};
const metrics:PerformanceSnapshot={fps:0,frameSpikes:0,maxFrameMs:0,simulationMs:0,simulationAvgMs:0,simulationMaxMs:0,simulationMovementMs:0,simulationAccountingMs:0,vehicles:0,exploredRoads:0,explorationDelta:0,sourceMs:0,sourceUpdates:0,visibleExplored:0};
let enabled=false;
export function enablePerformanceMonitor(value:boolean){enabled=value;if(!value){metrics.frameSpikes=0;metrics.maxFrameMs=0;metrics.sourceUpdates=0;metrics.explorationDelta=0;tickCount=0;tickTotal=0;tickMaximum=0;}}
export function performanceMonitorEnabled(){return enabled;}
export function recordPerformance(values:Partial<PerformanceSnapshot>){if(enabled)Object.assign(metrics,values);}
export function incrementPerformance(key:'frameSpikes'|'sourceUpdates'|'explorationDelta',by=1){if(enabled)metrics[key]+=by;}
export function readPerformance():PerformanceSnapshot{return {...metrics};}
export function recordFrameGap(ms:number){if(!enabled)return;if(ms>50)metrics.frameSpikes++;if(ms>metrics.maxFrameMs)metrics.maxFrameMs=ms;}

let tickCount=0,tickTotal=0,tickMaximum=0;
export function recordSimulationTick(durationMs:number,movementMs:number,accountingMs:number,vehicles:number,exploredRoads:number){
 if(!enabled)return;
 tickCount++;tickTotal+=durationMs;tickMaximum=Math.max(tickMaximum,durationMs);
 metrics.simulationMs=durationMs;metrics.simulationAvgMs=tickTotal/tickCount;metrics.simulationMaxMs=tickMaximum;
 metrics.simulationMovementMs=movementMs;metrics.simulationAccountingMs=accountingMs;
 metrics.vehicles=vehicles;metrics.exploredRoads=exploredRoads;
}
