/** Phase 2: bounded mission efficiency and fair successor scheduling.
 * Pure functions shared by the desktop planning pool and iPhone dispatcher.
 */
import type {RoadGraph,Taxi} from './taxi';

export function scoreExplorerFrontier(transitMeters:number,estimatedNewMeters:number):number{
 // Prefer a productive local corridor over a nearby OSM micro-segment while
 // avoiding multi-kilometre detours simply to gain a little more discovery.
 const gain=Math.max(1,Math.min(2200,estimatedNewMeters));
 return Math.max(0,transitMeters)+800/(0.45+gain/1000);
}

/** Short, bounded lookahead along the same road class. No speculative road
 * becomes discovered, reserved or traversed. Actual route admission still
 * requires the real directed graph and purple-start validator.
 */
export function estimateExplorerFrontierGain(
 graph:RoadGraph,from:string,to:string,id:string,
 eligible:ReadonlySet<string>,discovered:ReadonlySet<string>,
 reserved:ReadonlySet<string>,reservedNodes:ReadonlySet<string>,
 maxEdges=12,
):number{
 const first=(graph.edges.get(from)??[]).find(e=>e.id===id&&e.to===to&&e.meters>0);
 if(!first||!eligible.has(id)||discovered.has(id)||reserved.has(id)||reservedNodes.has(to))return 0;
 let total=first.meters,previous=from,current=to;
 const used=new Set([id]);
 for(let i=1;i<maxEdges&&total<1800;i++){
  const p=graph.nodes.get(previous),q=graph.nodes.get(current);
  if(!p||!q)break;
  const cos=Math.max(0.1,Math.cos(q[1]*Math.PI/180));
  const ax=(q[0]-p[0])*cos,ay=q[1]-p[1];
  let best:{id:string;to:string;meters:number;dot:number}|null=null;
  for(const next of graph.edges.get(current)??[]){
   if(next.meters<=0||next.to===previous||used.has(next.id)||
    !eligible.has(next.id)||discovered.has(next.id)||
    reserved.has(next.id)||reservedNodes.has(next.to))continue;
   const end=graph.nodes.get(next.to);
   if(!end)continue;
   const bx=(end[0]-q[0])*cos,by=end[1]-q[1];
   const dot=(ax*bx+ay*by)/Math.max(1e-12,Math.hypot(ax,ay)*Math.hypot(bx,by));
   if(dot<0.72)continue;
   // Exclude a blind one-way micro-edge from predicted gain. An extended
   // escape is checked by the actual route planner, not this fast heuristic.
   const exit=(graph.edges.get(next.to)??[]).some(e=>e.meters>0&&
    (discovered.has(e.id)||e.id===next.id&&e.to===current));
   if(!exit)continue;
   if(!best||dot>best.dot)best={id:next.id,to:next.to,meters:next.meters,dot};
  }
  if(!best)break;
  total+=best.meters;used.add(best.id);previous=current;current=best.to;
 }
 return total;
}

export function explorerRemainingEdges(vehicle:Pick<Taxi,'edgeIds'|'leg'>):number{
 return Math.max(0,vehicle.edgeIds.length-Math.max(0,vehicle.leg));
}
export function explorerSuccessorDue(vehicle:Pick<Taxi,'status'|'edgeIds'|'leg'>,threshold=48):boolean{
 return vehicle.status==='EXPLORING'&&explorerRemainingEdges(vehicle)>0&&
  explorerRemainingEdges(vehicle)<=threshold;
}
export function explorerSuccessorUrgent(vehicle:Pick<Taxi,'status'|'edgeIds'|'leg'>):boolean{
 return explorerSuccessorDue(vehicle,24);
}
/** A low-memory device still uses a single dispatcher. On desktop reserve
 * one spare planning slot for imminent successors without starving idle taxis.
 */
export function explorerPlannerIdleQuota(availableSlots:number,urgentSuccessor:boolean):number{
 return Math.max(0,availableSlots-(urgentSuccessor?1:0));
}
/** Reserve red discovery AND escape roads until they are driven or the
 * mission ends. Escape roads are not credited as discoveries by this helper.
 * A shared purple transit edge is never locked. */
export function pendingExplorerRoads(
 mission:Pick<Taxi,'discoveryEdgeIds'|'escapeTransitEdgeIds'>&Partial<Pick<Taxi,'edgeIds'|'leg'>>,
 discovered:ReadonlySet<string>,
):Set<string>{
 const remaining=mission.edgeIds&&mission.leg!==undefined?
  new Set(mission.edgeIds.slice(Math.max(0,mission.leg))):undefined;
 const pending=new Set<string>();
 for(const id of [...(mission.discoveryEdgeIds??[]),...(mission.escapeTransitEdgeIds??[])]){
  if(!discovered.has(id)&&(!remaining||remaining.has(id)))pending.add(id);
 }
 return pending;
}

/** Duplicate routes may reuse already-purple streets but must never claim
 * the same as-yet-undiscovered edge or another explorer's reserved endpoint.
 */
export function reserveExplorerDiscoveries(
 vehicles:ReadonlyArray<Pick<Taxi,'kind'|'status'|'discoveryEdgeIds'|'escapeTransitEdgeIds'|'path'>&Partial<Pick<Taxi,'edgeIds'|'leg'>>>,
 discovered:ReadonlySet<string>,getNode:(position:[number,number])=>string,
):{edges:Set<string>;targets:Set<string>}{
 const edges=new Set<string>(),targets=new Set<string>();
 for(const vehicle of vehicles){
  if(vehicle.kind!=='explorer'||vehicle.status!=='EXPLORING')continue;
  for(const id of pendingExplorerRoads(vehicle,discovered))edges.add(id);
  const end=vehicle.path.at(-1);
  if(end){const node=getNode(end);if(node)targets.add(node);}
 }
 return {edges,targets};
}
export function explorerPlannerResultCurrent(
 current:Pick<Taxi,'explorerRole'|'scoutingRuns'|'status'|'edgeIds'>,
 request:{role?:Taxi['explorerRole'];scoutingRuns?:number;mode:'idle'|'successor';baseEdgeIds?:readonly string[]},
):boolean{
 if(current.explorerRole!==request.role||
  (current.scoutingRuns??0)!==(request.scoutingRuns??0))return false;
 if(request.mode==='idle')return current.status==='IDLE';
 return current.status==='EXPLORING'&&
  !!request.baseEdgeIds&&request.baseEdgeIds.length===current.edgeIds.length&&
  request.baseEdgeIds.every((id,i)=>current.edgeIds[i]===id);
}
