import {nearest,type RoadGraph,type Point} from './taxi';

/** Infer compact, directed roundabout loops from OSM road geometry.
 * The existing road-tile format does not include junction=roundabout.
 * Only a short circular loop that connects TWO already-purple road
 * entrances can be used as red transit. It never becomes discovered.
 */
export type RoundaboutBridge={to:string;nodes:string[];ids:string[];meters:number};

export function roundaboutBridges(
 graph:RoadGraph,start:string,purple:ReadonlySet<string>,
 reserved:ReadonlySet<string>=new Set()
):RoundaboutBridge[]{
 const junction=graph.edges.get(start)??[];
 if(!junction.some(e=>purple.has(e.id)))return [];
 const found:RoundaboutBridge[]=[];
 const maxEdges=14,maxMeters=450;
 const mapPoint=(node:string)=>graph.nodes.get(node);
 const isPurpleJunction=(node:string)=>(graph.edges.get(node)??[]).some(e=>purple.has(e.id));
 const approvedShape=(nodes:readonly string[],length:number)=>{
  const raw=nodes.map(mapPoint);
  if(raw.some(p=>!p))return false;
  const coords=raw as Point[];
  const lat=coords[0][1]*Math.PI/180;
  const xy=coords.map(p=>[p[0]*111320*Math.cos(lat),p[1]*111320] as const);
  let twiceArea=0;
  for(let i=0;i<xy.length-1;i++)twiceArea+=xy[i][0]*xy[i+1][1]-xy[i+1][0]*xy[i][1];
  const compactness=Math.abs(twiceArea)/2/(length*length);
  // A nearly straight out-and-back path is NOT a roundabout.
  if(compactness<0.025)return false;
  const xs=xy.map(p=>p[0]),ys=xy.map(p=>p[1]);
  const dx=Math.max(...xs)-Math.min(...xs),dy=Math.max(...ys)-Math.min(...ys);
  if(dx<8||dy<8||Math.min(dx,dy)/Math.max(dx,dy)<0.28)return false;
  return true;
 };
 const traverse=(node:string,nodes:string[],ids:string[],distance:number,seen:Set<string>)=>{
  if(ids.length>=maxEdges)return;
  for(const e of graph.edges.get(node)??[]){
   if(e.meters<=0||purple.has(e.id)||reserved.has(e.id)||distance+e.meters>maxMeters)continue;
   const nextDist=distance+e.meters;
   if(e.to===start){
    if(ids.length<2||!approvedShape([...nodes,start],nextDist))continue;
    // A validated directed ring permits reaching ANY of its other purple
    // entrances by traversing only the ring's red directed segments.
    for(let k=1;k<nodes.length;k++){
     const end=nodes[k];
     if(!isPurpleJunction(end))continue;
     found.push({to:end,nodes:nodes.slice(0,k+1),
      ids:ids.slice(0,k),meters:ids.slice(0,k).reduce((sum,id,i)=>{
       const from=nodes[i],to=nodes[i+1];
       return sum+((graph.edges.get(from)??[]).find(edge=>edge.to===to&&edge.id===id)?.meters??0);
      },0)});
    }
    continue;
   }
   if(seen.has(e.to))continue;
   seen.add(e.to);
   traverse(e.to,[...nodes,e.to],[...ids,e.id],nextDist,seen);
   seen.delete(e.to);
  }
 };
 traverse(start,[start],[],0,new Set([start]));
 const unique=new Map<string,RoundaboutBridge>();
 for(const b of found){
  if(!b.ids.length)continue;
  const old=unique.get(b.to);
  if(!old||b.meters<old.meters)unique.set(b.to,b);
 }
 return [...unique.values()];
}

/** Validate BEFORE any explorer can be assigned a red roundabout transfer.
 * A red prefix is valid only if it matches a complete verified loop arc
 * ending at an already purple junction. No red residential shortcuts.
 */
export function hasInvalidRedApproach(
 graph:RoadGraph,path:readonly Point[],ids:readonly string[],
 purple:ReadonlySet<string>,discovery:ReadonlySet<string>
):boolean{
 const first=ids.findIndex(id=>discovery.has(id));
 if(first<0||path.length!==ids.length+1)return true;
 let index=0;
 while(index<first){
  if(purple.has(ids[index])){index++;continue;}
  const start=nearest(graph,path[index]);
  if(!start)return true;
  const bridges=roundaboutBridges(graph,start,purple);
  const match=bridges.find(b=>b.ids.every((id,i)=>ids[index+i]===id)&&
   index+b.ids.length<=first&&
   b.nodes.every((node,i)=>nearest(graph,path[index+i])===node));
  if(!match)return true;
  index+=match.ids.length;
 }
 return false;
}
