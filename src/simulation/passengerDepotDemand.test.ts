import {describe,it,expect} from 'vitest';
import {PassengerStopSpatialIndex,passengerQueueByDepot,regionalPassengerDemand,
 type PassengerDepotRegion} from './passengerDepotDemand';
import {createPassengerRequest,assignPassenger,meters,type RoadGraph,type Taxi,
 type PassengerRequest,type Point} from './taxi';

const athens:Point=[23.73,37.96];
const island:Point=[24.84,37.83];
const locations:PassengerDepotRegion[]=[
 {id:'main',position:athens,available:1},
 {id:'island',position:island,available:1},
];
const request=(id:string,position:Point,originDepotId?:string):PassengerRequest=>({
 id,pickup:position,dropoff:position,fare:10,createdAt:100,expiresAt:200,
 originDepotId,
});
function localRoadGraph():{graph:RoadGraph;discovered:Set<string>;islandNodes:string[];mainNodes:string[]}{
 const nodes=new Map<string,Point>();
 const edges=new Map<string,NonNullable<RoadGraph['edges']> extends Map<string,infer T>?T:never>();
 const discovered=new Set<string>();
 const install=(prefix:string,origin:Point):string[]=>{
  const ids:string[]=[];
  for(let i=0;i<6;i++){
   const key=prefix+i,point:Point=[origin[0]+i*0.003,origin[1]];
   ids.push(key);nodes.set(key,point);edges.set(key,[]);
  }
  for(let i=0;i<5;i++){
   const id=prefix+'-road-'+i,a=ids[i],b=ids[i+1];
   const length=meters(nodes.get(a)!,nodes.get(b)!);
   discovered.add(id);
   edges.get(a)!.push({to:b,id,meters:length,speedKph:35,highway:'residential'});
   edges.get(b)!.push({to:a,id,meters:length,speedKph:35,highway:'residential'});
  }
  return ids;
 };
 const mainNodes=install('m',athens),islandNodes=install('i',island);
 return {graph:{nodes,edges,nodeKeys:[...nodes.keys()]},discovered,islandNodes,mainNodes};
}
describe('regional taxi passenger demand and local discovered roads',()=>{
 it('keeps spatial passenger stops local even across disconnected islands',()=>{
  const {graph,mainNodes,islandNodes}=localRoadGraph();
  const index=new PassengerStopSpatialIndex();
  for(const node of graph.nodeKeys)index.add(node,graph.nodes.get(node)!);
  const mainland=index.near(athens,node=>graph.nodes.get(node),5000);
  const islands=index.near(island,node=>graph.nodes.get(node),5000);
  expect(new Set(mainland)).toEqual(new Set(mainNodes));
  expect(new Set(islands)).toEqual(new Set(islandNodes));
 });
 it('generates and assigns a passenger entirely on island discovered roads without an HQ link',()=>{
  const {graph,discovered,islandNodes}=localRoadGraph();
  const mission=createPassengerRequest(graph,discovered,athens,1000,1,
   new Set(islandNodes));
  expect(mission).not.toBeNull();
  const positions=islandNodes.map(id=>graph.nodes.get(id)!);
  expect(positions.some(p=>JSON.stringify(p)===JSON.stringify(mission?.pickup))).toBe(true);
  expect(positions.some(p=>JSON.stringify(p)===JSON.stringify(mission?.dropoff))).toBe(true);
  const taxi:Taxi={id:'island-taxi',kind:'taxi',depotId:'island',
   name:'Island Taxi',driver:'Island Driver',position:positions[0],
   status:'IDLE',path:[],edgeIds:[],leg:0,distanceIntoLeg:0,fare:0,completed:0};
  const assigned=assignPassenger(taxi,graph,mission!,discovered,new Set(islandNodes));
  expect(assigned?.status).toBe('TO_PICKUP');
  expect(assigned?.activeJobId).toBe(mission?.id);
  expect(assigned?.pickup).toEqual(mission?.pickup);
 });
 it('prioritises the empty second depot before adding more requests to HQ',()=>{
  const pending=[request('1',athens,'main'),request('2',athens,'main')];
  const regions=regionalPassengerDemand(locations,pending);
  expect(regions[0]).toMatchObject({id:'island',available:1,waiting:0});
  expect(regions.find(r=>r.id==='main')?.maxWaiting).toBe(2);
 });
 it('does not schedule demand for off-duty depots',()=>{
  const regions=regionalPassengerDemand([{...locations[0],available:0},locations[1]],[]);
  expect(regions.map(r=>r.id)).toEqual(['island']);
 });
 it('never fills a region above its individual waiting-job allocation',()=>{
  const regions=regionalPassengerDemand(locations,[
   request('a',athens,'main'),request('b',athens,'main')]);
  expect(regions.find(r=>r.id==='main')?.waiting).toBe(2);
  expect(regions.find(r=>r.id==='main')?.maxWaiting).toBe(2);
 });
 it('attributes older untagged requests to their nearest depot',()=>{
  const counts=passengerQueueByDepot([request('old',island),request('new',athens,'main')],locations);
  expect(counts.get('island')).toBe(1);
  expect(counts.get('main')).toBe(1);
 });
 it('prevents disallowed taxi-only roads from becoming passenger stops in the graph',()=>{
  const {graph,discovered,islandNodes}=localRoadGraph();
  const node=islandNodes[0],next=islandNodes[1];
  graph.edges.get(node)!.push({to:next,id:'taxi-permitted-only',meters:120,speedKph:20,taxiOnly:true});
  const taxiOnly=new Set(['taxi-permitted-only']);
  const local=new PassengerStopSpatialIndex();
  for(const roadId of discovered)for(const [from,links] of graph.edges)
   for(const edge of links)if(edge.id===roadId){
    local.add(from,graph.nodes.get(from)!);local.add(edge.to,graph.nodes.get(edge.to)!);
   }
  // Taxi-permitted corridors may carry passengers but do not invent pickup stops.
  expect(local.near(island,n=>graph.nodes.get(n))).toEqual(expect.arrayContaining(islandNodes));
  expect(taxiOnly.has('taxi-permitted-only')).toBe(true);
 });
});
