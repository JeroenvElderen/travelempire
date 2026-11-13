import {meters,nearest,type FleetState,type RoadGraph} from './taxi';
import type {Company} from '../company';

/** Verify the real outgoing OSM edge at a depot which has resident
 * explorers. This fixes old depot grants whose purple access road did not
 * survive a streaming/save migration. Never connect disconnected islands,
 * and never unlock unrelated roads or taxi-only service corridors.
 */
export function missingDepotAccessSeeds(
 company:Pick<Company,'headquarters'|'depots'>,
 fleet:Pick<FleetState,'taxis'>,
 graph:RoadGraph,
 discovered:ReadonlySet<string>,
 maxDistanceMeters=35,
):{depotId:string;edgeId:string}[]{
 const candidates=[
  {id:'main',position:[company.headquarters.lng,company.headquarters.lat] as [number,number]},
  ...(company.depots??[]).map(d=>({id:d.id,position:[d.lng,d.lat] as [number,number]})),
 ];
 const additions:{depotId:string;edgeId:string}[]=[];
 for(const depot of candidates){
  if(!fleet.taxis.some(t=>t.kind==='explorer'&&(t.depotId??'main')===depot.id))continue;
  const node=nearest(graph,depot.position);
  const position=node?graph.nodes.get(node):undefined;
  if(!node||!position||meters(position,depot.position)>maxDistanceMeters)continue;
  const links=(graph.edges.get(node)??[]).filter(e=>e.meters>0&&!e.taxiOnly);
  if(!links.length||links.some(e=>discovered.has(e.id)))continue;
  // The anchor is exactly a legal outgoing edge at the built depot; it is
  // not a remotely-nearest city road or a fabricated straight-line link.
  const preferred=links.find(e=>(graph.edges.get(e.to)??[])
   .some(other=>other.to===node&&other.id===e.id))??links[0];
  additions.push({depotId:depot.id,edgeId:preferred.id});
 }
 return additions;
}
