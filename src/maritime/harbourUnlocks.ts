import type {RoadGraph} from '../simulation/taxi';
import type {FerryNetwork} from './ferries';

// Each harbour follows its nearest road node, regardless of terminal-to-road distance.
// Index road nodes once rather than scanning every road for every harbour each tick.
export function harbourRoadEdges(network:FerryNetwork,graph:RoadGraph):Map<string,string[]>{
 const cell=0.01;
 const bins=new Map<string,string[]>();
 const bin=(x:number,y:number)=>Math.floor(x/cell)+','+Math.floor(y/cell);
 for(const [id,point] of graph.nodes){
  const key=bin(point[0],point[1]);const list=bins.get(key);
  if(list)list.push(id);else bins.set(key,[id]);
 }
 const result=new Map<string,string[]>();
 for(const port of network.ports){
  const point=port.roadAccess??port.position;
  const x=Math.floor(point[0]/cell),y=Math.floor(point[1]/cell);
  let closest:string|undefined,best=Infinity;
  const cos=Math.cos(point[1]*Math.PI/180);
  // Search expanding squares, then fall back to the full loaded network for remote ports.
  for(let radius=0;radius<=16;radius++){
   for(let dx=-radius;dx<=radius;dx++)for(let dy=-radius;dy<=radius;dy++){
    if(radius&&Math.max(Math.abs(dx),Math.abs(dy))!==radius)continue;
    for(const id of bins.get((x+dx)+','+(y+dy))??[]){
     const node=graph.nodes.get(id)!;
     const d=Math.hypot((node[0]-point[0])*cos,node[1]-point[1]);
     if(d<best){best=d;closest=id;}
    }
   }
   if(closest&&radius*cell>best*2+cell)break;
  }
  if(!closest)for(const [id,node] of graph.nodes){
   const d=Math.hypot((node[0]-point[0])*cos,node[1]-point[1]);
   if(d<best){best=d;closest=id;}
  }
  if(!closest)continue;
  const edges=graph.edges.get(closest)??[];
  const incoming:string[]=[];
  if(!edges.length)for(const links of graph.edges.values())for(const edge of links)if(edge.to===closest)incoming.push(edge.id);
  const ids=[...new Set([...edges.map(e=>e.id),...incoming])];
  if(ids.length)result.set(port.id,ids);
 }
 return result;
}
export function harbourStorageKey(companyId:string){return 'travelempire.harbourUnlocks.'+companyId;}
