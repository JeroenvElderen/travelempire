import {advanceTaxi,meters,type Point,type RoadGraph,type Taxi} from './taxi';
import {worldTaxiSpeedFactor} from './livingWorld';
import type {RoadFeature} from '../components/purpleRoadDiff';

/** Small, independent ambient fleet. NPCs use the same physical road integrator as taxis. */
export type AmbientCar={
 id:string;
 taxi:Taxi;
 fromNode:string;
 toNode:string;
 turns:number;
 bearing:number;
 color:number;
};
const NON_DRIVING=new Set(['footway','path','steps','cycleway','pedestrian','bridleway','platform','corridor','construction','proposed']);
function hash(value:string):number{
 let h=2166136261;
 for(let i=0;i<value.length;i++)h=Math.imul(h^value.charCodeAt(i),16777619);
 return h>>>0;
}
function validEdge(edge:NonNullable<ReturnType<RoadGraph['edges']['get']>>[number], discovered:ReadonlySet<string>,graph:RoadGraph):boolean{
 return discovered.has(edge.id)&&!edge.taxiOnly&&!NON_DRIVING.has(String(edge.highway??''))&&graph.nodes.has(edge.to);
}
function bearing(a:Point,b:Point):number{
 const east=(b[0]-a[0])*Math.cos((a[1]+b[1])*Math.PI/360);
 return Math.atan2(east,b[1]-a[1])*180/Math.PI;
}
function segmentNodes(road:RoadFeature):[string,string]|null{
 const from=road.properties?.fromNode,to=road.properties?.toNode;
 return typeof from==='string'&&typeof to==='string'&&from&&to?[from,to]:null;
}
export function spawnAmbientCar(road:RoadFeature,graph:RoadGraph,discovered:ReadonlySet<string>):AmbientCar|null{
 const nodes=segmentNodes(road);
 if(!nodes)return null;
 const id=String(road.properties?.roadId??road.id??'');
 if(!id||!discovered.has(id))return null;
 const [a,b]=nodes;
 const forward=(graph.edges.get(a)??[]).find(e=>e.to===b&&e.id===id&&validEdge(e,discovered,graph));
 const reverse=(graph.edges.get(b)??[]).find(e=>e.to===a&&e.id===id&&validEdge(e,discovered,graph));
 if(!forward&&!reverse)return null;
 const backwards=!!reverse&&(!forward||hash(id+':direction')%2===0);
 const fromNode=backwards?b:a,toNode=backwards?a:b;
 const from=graph.nodes.get(fromNode),to=graph.nodes.get(toNode);
 if(!from||!to)return null;
 const distance=meters(from,to);
 if(distance<14||distance>1500)return null;
 const start=0.10+((hash(id+':start')%55)/100);
 const position:Point=[from[0]+(to[0]-from[0])*start,from[1]+(to[1]-from[1])*start];
 const taxi:Taxi={
  id:'npc:'+id,kind:'taxi',name:'NPC civilian',driver:'AI',
  status:'RETURNING',position,path:[from,to],edgeIds:[id],
  leg:0,distanceIntoLeg:distance*start,completed:0,fare:0,
 };
 return {id:'npc:'+id,taxi,fromNode,toNode,turns:0,bearing:bearing(from,to),color:hash(id+':paint')%7};
}
function nextEdge(agent:AmbientCar,graph:RoadGraph,discovered:ReadonlySet<string>){
 const at=agent.toNode,previous=agent.fromNode;
 const here=graph.nodes.get(at),before=graph.nodes.get(previous);
 if(!here||!before)return null;
 const all=(graph.edges.get(at)??[]).filter(e=>validEdge(e,discovered,graph));
 if(!all.length)return null;
 // Prefer a forward road and prohibit an ordinary U-turn when another legal exit exists.
 const scale=Math.cos(here[1]*Math.PI/180);
 const incomingX=(here[0]-before[0])*scale,incomingY=here[1]-before[1];
 const exits=all.filter(e=>{
  if(e.to===previous)return false;
  const p=graph.nodes.get(e.to)!;
  const dx=(p[0]-here[0])*scale,dy=p[1]-here[1];
  const divisor=Math.hypot(incomingX,incomingY)*Math.hypot(dx,dy);
  return divisor===0||(incomingX*dx+incomingY*dy)/divisor > -0.94;
 });
 const choices=exits.length?exits:all.filter(e=>e.to===previous);
 if(!choices.length)return null;
 // Stable per-agent turn choices: no random re-planning at each frame.
 return choices[hash(agent.id+':turn:'+agent.turns)%choices.length];
}
/** Advance along directed OSM edges, respecting true road speed and the same congestion factor as taxis.
 * Returning null retires a car at a road end, never teleports it onto another road.
 */
export function advanceAmbientCar(agent:AmbientCar,graph:RoadGraph,discovered:ReadonlySet<string>,
 realSeconds:number,gameNow:number):AmbientCar|null{
 if(realSeconds<=0)return agent;
 if(!discovered.has(agent.taxi.edgeIds[agent.taxi.leg]??''))return null;
 const elapsed=Math.min(0.25,realSeconds)*worldTaxiSpeedFactor(agent.taxi.position,gameNow);
 const moving=advanceTaxi(agent.taxi,graph,elapsed);
 const taxi=moving.taxi;
 if(taxi.leg<taxi.path.length-1)return {...agent,taxi};
 const edge=nextEdge(agent,graph,discovered);
 if(!edge)return null;
 const from=graph.nodes.get(agent.toNode),to=graph.nodes.get(edge.to);
 if(!from||!to||meters(from,to)<1)return null;
 const updated:Taxi={...taxi,status:'RETURNING',position:from,
  path:[from,to],edgeIds:[edge.id],leg:0,distanceIntoLeg:0};
 return {...agent,taxi:updated,fromNode:agent.toNode,toNode:edge.to,
  bearing:bearing(from,to),turns:agent.turns+1};
}
export function ambientVehicleBudget(zoom:number,traffic:number,mobile:boolean,roads:number):number{
 if(zoom<13.5||roads<1)return 0;
 const cap=mobile?24:38;
 return Math.max(1,Math.min(cap,Math.ceil((traffic/100)*cap),Math.floor(roads/2)+1));
}
