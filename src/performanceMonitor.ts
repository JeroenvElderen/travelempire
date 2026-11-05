// Optional, in-memory diagnostics. Never included in game saves.
export type PerformanceSnapshot={fps:number;frameSpikes:number;maxFrameMs:number;simulationMs:number;simulationAvgMs:number;simulationMaxMs:number;simulationMovementMs:number;simulationAccountingMs:number;slowestVehicleMs:number;slowestVehicle:string;routingMs:number;integratorMs:number;discoveryMs:number;otherVehicleMs:number;vehicles:number;exploredRoads:number;explorationDelta:number;sourceMs:number;sourceUpdates:number;visibleExplored:number;mapRenderMs:number;mapRenderCount:number;saveMs:number;saveKind:string;longTasks:number;longestTaskMs:number;lastSpikeCause:string};
const metrics:PerformanceSnapshot={fps:0,frameSpikes:0,maxFrameMs:0,simulationMs:0,simulationAvgMs:0,simulationMaxMs:0,simulationMovementMs:0,simulationAccountingMs:0,slowestVehicleMs:0,slowestVehicle:'—',routingMs:0,integratorMs:0,discoveryMs:0,otherVehicleMs:0,vehicles:0,exploredRoads:0,explorationDelta:0,sourceMs:0,sourceUpdates:0,visibleExplored:0,mapRenderMs:0,mapRenderCount:0,saveMs:0,saveKind:'—',longTasks:0,longestTaskMs:0,lastSpikeCause:'—'};
let enabled=false;
export function enablePerformanceMonitor(value:boolean){enabled=value;if(!value){metrics.frameSpikes=0;metrics.maxFrameMs=0;metrics.sourceUpdates=0;metrics.explorationDelta=0;tickCount=0;tickTotal=0;tickMaximum=0;resetActivityCounters();}}
export function performanceMonitorEnabled(){return enabled;}
export function recordPerformance(values:Partial<PerformanceSnapshot>){if(enabled)Object.assign(metrics,values);}
export function incrementPerformance(key:'frameSpikes'|'sourceUpdates'|'explorationDelta',by=1){if(enabled)metrics[key]+=by;}
export function readPerformance():PerformanceSnapshot{return {...metrics};}
export function recordFrameGap(ms:number){if(!enabled)return;if(ms>50)metrics.frameSpikes++;if(ms>metrics.maxFrameMs)metrics.maxFrameMs=ms;}

let tickCount=0,tickTotal=0,tickMaximum=0;
export function recordSimulationTick(durationMs:number,movementMs:number,accountingMs:number,vehicles:number,exploredRoads:number,slowestVehicle:string,slowestVehicleMs:number,routingMs:number,integratorMs:number,discoveryMs:number){
 if(!enabled)return;
 tickCount++;tickTotal+=durationMs;tickMaximum=Math.max(tickMaximum,durationMs);
 metrics.simulationMs=durationMs;metrics.simulationAvgMs=tickTotal/tickCount;metrics.simulationMaxMs=tickMaximum;
 metrics.simulationMovementMs=movementMs;metrics.simulationAccountingMs=accountingMs;
 metrics.vehicles=vehicles;metrics.exploredRoads=exploredRoads;metrics.slowestVehicle=slowestVehicle;metrics.slowestVehicleMs=slowestVehicleMs;metrics.routingMs=routingMs;metrics.integratorMs=integratorMs;metrics.discoveryMs=discoveryMs;metrics.otherVehicleMs=Math.max(0,movementMs-integratorMs-discoveryMs-routingMs);
}

type Activity={kind:string;at:number;duration:number};
const recentActivities:Activity[]=[];
export function recordActivity(kind:string,duration:number){
 if(!enabled)return;
 const at=performance.now();
 recentActivities.push({kind,at,duration});
 while(recentActivities.length>24)recentActivities.shift();
 if(kind.startsWith('save:')){metrics.saveMs=duration;metrics.saveKind=kind.slice(5);}
 if(kind==='map:render'){metrics.mapRenderMs=duration;metrics.mapRenderCount++;}
}
export function recordLongTask(duration:number){
 if(!enabled)return;
 metrics.longTasks++;metrics.longestTaskMs=Math.max(metrics.longestTaskMs,duration);
 recordActivity('long task',duration);
}
export function recordFrameGapWithContext(gap:number,now:number){
 if(!enabled)return;
 recordFrameGap(gap);
 if(gap<=50)return;
 const begin=now-gap;
 const candidates=recentActivities.filter(a=>a.at>=begin-20&&a.at<=now+20);
 const matched=candidates.sort((a,b)=>b.duration-a.duration)[0];
 metrics.lastSpikeCause=matched?matched.kind+' ('+matched.duration.toFixed(0)+' ms)':'unknown / browser';
}
export function resetActivityCounters(){
 metrics.mapRenderCount=0;metrics.longTasks=0;metrics.longestTaskMs=0;metrics.lastSpikeCause='—';
 recentActivities.length=0;
}
