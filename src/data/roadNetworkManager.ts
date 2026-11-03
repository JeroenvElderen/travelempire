import {loadRoadTile,releaseRoadTile,roadTileManifest,tileId,type RoadSegment} from './roadTiles';
import type {Point,RoadGraph} from '../simulation/taxi';
import type {FerryNetwork} from '../maritime/ferries';
import {connectFerryTerminals,type FerryConnectionResult} from '../maritime/roadConnections';
const PREFETCH_METERS=10000;
const MAX_CONCURRENT=2;
const MAX_PENDING_TILES=96; // Bound speculative prefetch work for large fleets.
export class RoadNetworkManager {
 private loaded=new Set<string>();private queued=new Set<string>();private queue:string[]=[];
 private failedUntil=new Map<string,number>();private seenEdges=new Set<string>();
 private inFlight=0;private disposed=false;private tileSize=0.1;private available=new Set<string>();
 private graph:RoadGraph={nodes:new Map(),edges:new Map(),nodeKeys:[]};
 constructor(private onGraph:(graph:RoadGraph,count:number)=>void,private onError:(message:string)=>void,private onRoads?:(roads:RoadSegment[])=>void){}
 /** Request road tiles around ferry boarding points without crossing water. */
 considerFerryTerminals(network:FerryNetwork){this.consider(network.ports.map(p=>p.roadAccess??p.position));}
 /** Resolve currently loaded ferry terminals to real road nodes; repeat after tile loads. */
 ferryConnections(network:FerryNetwork,maxDistanceMeters=250):FerryConnectionResult{return connectFerryTerminals(network,this.graph,maxDistanceMeters);}
 get loadedCount(){return this.loaded.size;}
 get queuedCount(){return this.queue.length+this.inFlight;}
 get nodeCount(){return this.graph.nodeKeys.length;}
 get edgeCount(){return this.seenEdges.size;}
 async initialize(point:Point):Promise<RoadGraph>{
  const manifest=await roadTileManifest();this.tileSize=manifest.tileSize;this.available=new Set(Object.keys(manifest.tiles));
  const id=tileId(point[0],point[1],this.tileSize);
  // Load tiles around HQ before dispatch; an empty centre tile is allowed.
  const nearby=this.idsNear(point,1500);
  // Limit startup work; nationwide tiles can contain far more road segments.
  const initial=nearby.filter(k=>this.available.has(k)&&!k.startsWith('national:'));
  const nationwide=nearby.filter(k=>this.available.has(k)&&k.startsWith('national:'));
  // A single unavailable tile must never prevent the rest of the graph loading.
  const attempts=await Promise.allSettled(initial.map(k=>this.load(k)));
  for(let i=0;i<attempts.length;i++)if(attempts[i].status==='rejected')this.onError(`Initial road tile ${initial[i]}: ${String((attempts[i] as PromiseRejectedResult).reason)}`);
  if(!this.graph.nodeKeys.length){
   for(const id of nationwide){
    try{await this.load(id);if(this.graph.nodeKeys.length)break;}
    catch(error){this.onError(`Nationwide startup tile ${id}: ${String(error)}`);}
   }
  }
  if(!this.graph.nodeKeys.length)throw Error(`No road tiles near headquarters (${id}). Upload geographic tiles first.`);
  this.consider([point]);return this.graph;
 }
 private idsNear(p:Point,radius:number):string[]{
  const dy=radius/111320,dx=radius/(111320*Math.max(.15,Math.cos(p[1]*Math.PI/180)));
  const ids:string[]=[];const s=this.tileSize;
  for(let x=Math.floor((p[0]-dx)/s);x<=Math.floor((p[0]+dx)/s);x++)
   for(let y=Math.floor((p[1]-dy)/s);y<=Math.floor((p[1]+dy)/s);y++)ids.push(`${x}_${y}`);
  // Nationwide Supabase cache is indexed at 0.2 degrees; request its
  // overlapping tiles separately, without fetching the entire country.
  for(let x=Math.floor((p[0]-dx)/0.2);x<=Math.floor((p[0]+dx)/0.2);x++)
   for(let y=Math.floor((p[1]-dy)/0.2);y<=Math.floor((p[1]+dy)/0.2);y++)ids.push(`national:${x}_${y}`);
  return ids;
 }
 considerPoint(p:Point){this.consider([p]);}
 considerRoute(path:Point[]){if(!path.length)return;const points:Point[]=[path[0]];
  for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i];const dx=(b[0]-a[0])*111320*Math.cos((a[1]+b[1])*Math.PI/360),dy=(b[1]-a[1])*111320;
   const steps=Math.min(100,Math.max(1,Math.ceil(Math.hypot(dx,dy)/3000)));
   for(let j=1;j<=steps;j++)points.push([a[0]+(b[0]-a[0])*j/steps,a[1]+(b[1]-a[1])*j/steps]);}
  this.consider(points);
 }
 consider(points:Point[]){if(this.disposed)return;const now=Date.now();
  for(const p of points){if(this.queue.length>=MAX_PENDING_TILES)break;
   if(!Number.isFinite(p[0])||!Number.isFinite(p[1]))continue;
   for(const id of this.idsNear(p,PREFETCH_METERS)){
    if(this.queue.length>=MAX_PENDING_TILES)break;
    if(!this.available.has(id)||this.loaded.has(id)||this.queued.has(id)||(this.failedUntil.get(id)??0)>now)continue;
    this.queued.add(id);this.queue.push(id);
   }
  }this.pump();
 }
 private pump(){while(!this.disposed&&this.inFlight<MAX_CONCURRENT&&this.queue.length){const id=this.queue.shift()!;this.inFlight++;
  void this.load(id).catch(e=>{this.failedUntil.set(id,Date.now()+60000);this.onError(`Road tile ${id}: ${String(e)}`)}).finally(()=>{this.queued.delete(id);this.inFlight--;this.pump()});}}
 private async load(id:string){if(this.loaded.has(id)||this.disposed)return;
  const roads=await loadRoadTile(id);if(this.disposed)return;
  for(let i=0;i<roads.length;i+=1500){this.merge(roads.slice(i,i+1500));if(i+1500<roads.length)await new Promise<void>(resolve=>setTimeout(resolve,0));if(this.disposed)return;}
  this.loaded.add(id);this.graph={...this.graph};this.onRoads?.(roads);this.onGraph(this.graph,this.loaded.size);
  // The routing graph and dispatch worker now own the data; discard the duplicate parsed array.
  releaseRoadTile(id);
 }
 private merge(roads:RoadSegment[]){for(const road of roads){if(this.seenEdges.has(road.id)||road.coordinates?.length!==2||!Number.isFinite(road.length)||road.length<=0)continue;
  this.seenEdges.add(road.id);const a=String(road.a),b=String(road.b);
  if(!this.graph.nodes.has(a)){this.graph.nodes.set(a,road.coordinates[0]);this.graph.nodeKeys.push(a)}
  if(!this.graph.nodes.has(b)){this.graph.nodes.set(b,road.coordinates[1]);this.graph.nodeKeys.push(b)}
  const add=(from:string,to:string)=>{let links=this.graph.edges.get(from);if(!links){links=[];this.graph.edges.set(from,links)}links.push({to,meters:road.length,id:road.id,speedKph:road.speed})};
  if(road.oneway!==-1)add(a,b);if(road.oneway!==1)add(b,a);
 }}
 dispose(){this.disposed=true;this.queue.length=0;this.queued.clear();this.failedUntil.clear();}
}
