import {diagnostic} from '../frontendDiagnostics';
import {loadRoadTile,releaseRoadTile,roadTileManifest,tileId,type RoadSegment} from './roadTiles';
import type {Point,RoadGraph} from '../simulation/taxi';
import type {FerryNetwork} from '../maritime/ferries';
import {connectFerryTerminals,type FerryConnectionResult} from '../maritime/roadConnections';
const PREFETCH_METERS=6000;
const BACKGROUND_TILE_DELAY_MS=350;
// Safari needs an actual rendering frame between expensive graph batches.
const MERGE_BUDGET_MS=3;
const yieldToRenderer=()=>new Promise<void>(resolve=>{
 if(typeof document!=='undefined'&&document.visibilityState==='visible')requestAnimationFrame(()=>setTimeout(resolve,0));
 else setTimeout(resolve,0);
});
// One background tile at a time avoids concurrent structured-clone and graph updates on iPhone.
const MAX_CONCURRENT=1;
// Publishing a graph snapshot invalidates expensive map and simulation consumers.
// Keep the first usable graph immediate; coalesce later tile updates on mobile.
const GRAPH_PUBLISH_INTERVAL_MS=15000;
type GraphEdge={to:string;meters:number;id:string;speedKph:number;highway?:string};
type GraphDelta={id:number;nodes:[string,Point][];edges:[string,GraphEdge[]][];count:number};
const MAX_PENDING_TILES=32; // Bound speculative prefetch work for large fleets.
export class RoadNetworkManager {
 private loaded=new Set<string>();private queued=new Set<string>();private queue:string[]=[];
 private priority=new Map<string,number>();private backgroundTimer:ReturnType<typeof setTimeout>|null=null;
 private failedUntil=new Map<string,number>();
 private graphWorker:Worker|null=null;private workerSequence=0;
 private workerRequests=new Map<number,{resolve:(delta:GraphDelta)=>void;reject:(error:Error)=>void}>();
 private inFlight=0;private disposed=false;private tileSize=0.1;private available=new Set<string>();
 private publishTimer:ReturnType<typeof setTimeout>|null=null;private lastPublishedAt=0;private publishedOnce=false;
 private publishGraph(){if(this.disposed)return;const started=performance.now();diagnostic('roads:publish',`nodes=${this.graph.nodeKeys.length} edges=${this.edgeTotal} tiles=${this.loaded.size}`);// Keep the graph identity stable: nodes, edges and nodeKeys are already updated in place.
 this.onGraph(this.graph,this.loaded.size);const elapsed=performance.now()-started;diagnostic('roads:publish-complete',`callbackMs=${Math.round(elapsed)} nodes=${this.graph.nodeKeys.length}`);this.lastPublishedAt=performance.now();this.publishedOnce=true;}
 private scheduleGraphPublish(){if(this.disposed)return;const elapsed=performance.now()-this.lastPublishedAt;if(!this.publishedOnce||elapsed>=GRAPH_PUBLISH_INTERVAL_MS){if(this.publishTimer!==null){clearTimeout(this.publishTimer);this.publishTimer=null;}this.publishGraph();return;}if(this.publishTimer!==null)return;this.publishTimer=setTimeout(()=>{this.publishTimer=null;this.publishGraph();},Math.max(0,GRAPH_PUBLISH_INTERVAL_MS-elapsed));}
 private edgeTotal=0;
 private graph:RoadGraph={nodes:new Map(),edges:new Map(),nodeKeys:[]};
 private prepareInWorker(roads:RoadSegment[]):Promise<GraphDelta>{
  if(!this.graphWorker){
   const worker=new Worker(new URL('./roadGraph.worker.ts',import.meta.url),{type:'module'});
   worker.onmessage=(event:MessageEvent<GraphDelta>)=>{diagnostic('roads:worker',`delta nodes=${event.data.nodes.length} edges=${event.data.count} pending=${this.workerRequests.size}`);const request=this.workerRequests.get(event.data.id);if(!request)return;this.workerRequests.delete(event.data.id);request.resolve(event.data);};
   worker.onerror=event=>{for(const request of this.workerRequests.values())request.reject(new Error(event.message));this.workerRequests.clear();worker.terminate();if(this.graphWorker===worker)this.graphWorker=null;};
   this.graphWorker=worker;
  }
  const id=++this.workerSequence;
  return new Promise((resolve,reject)=>{this.workerRequests.set(id,{resolve,reject});this.graphWorker!.postMessage({id,roads});});
 }
 constructor(private onGraph:(graph:RoadGraph,count:number)=>void,private onError:(message:string)=>void,private onRoads?:(roads:RoadSegment[])=>void|Promise<void>){}
 /** Request road tiles around ferry boarding points without crossing water. */
 considerFerryTerminals(network:FerryNetwork){this.consider(network.ports.map(p=>p.roadAccess??p.position));}
 /** Resolve currently loaded ferry terminals to real road nodes; repeat after tile loads. */
 ferryConnections(network:FerryNetwork,maxDistanceMeters=250):FerryConnectionResult{return connectFerryTerminals(network,this.graph,maxDistanceMeters);}
 get loadedCount(){return this.loaded.size;}
 get queuedCount(){return this.queue.length+this.inFlight;}
 get nodeCount(){return this.graph.nodeKeys.length;}
 get edgeCount(){return this.edgeTotal;}
 async initialize(point:Point):Promise<RoadGraph>{
  const manifest=await roadTileManifest();this.tileSize=manifest.tileSize;this.available=new Set(Object.keys(manifest.tiles));
  const id=tileId(point[0],point[1],this.tileSize);
  // Load tiles around HQ before dispatch; an empty centre tile is allowed.
  const nearby=this.idsNear(point,1500).filter(k=>this.available.has(k));
  nearby.sort((a,b)=>this.tileDistance(a,point)-this.tileDistance(b,point));
  // Establish a usable local graph before starting broad background prefetch.
  for(const key of nearby){if(this.disposed)break;await this.load(key);if(this.graph.nodeKeys.length)break;}
  if(!this.graph.nodeKeys.length)throw Error(`No road tiles near headquarters (${id}). Upload geographic tiles first.`);
  this.consider([point]);return this.graph;
 }
 private tileDistance(id:string,p:Point):number{const [x,y]=id.split('_').map(Number);return Math.hypot((x+.5)*this.tileSize-p[0],((y+.5)*this.tileSize-p[1])*Math.cos(p[1]*Math.PI/180));}
 private idsNear(p:Point,radius:number):string[]{
  const dy=radius/111320,dx=radius/(111320*Math.max(.15,Math.cos(p[1]*Math.PI/180)));
  const ids:string[]=[];const s=this.tileSize;
  for(let x=Math.floor((p[0]-dx)/s);x<=Math.floor((p[0]+dx)/s);x++)
   for(let y=Math.floor((p[1]-dy)/s);y<=Math.floor((p[1]+dy)/s);y++)ids.push(`${x}_${y}`);
  return ids;
 }
 // Display-only demand: load available map tiles in the visible viewport,
 // even if no vehicle is nearby. Bound each request so a large zoom-out
 // cannot flood Safari with hundreds of road tile downloads.
 considerViewport(west:number,east:number,south:number,north:number){
  if(this.disposed||!this.available.size)return;
  if(![west,east,south,north].every(Number.isFinite))return;
  const width=Math.min(360,Math.max(0,east-west));
  if(!width||north<=south)return;
  const minX=Math.floor(west/this.tileSize),maxX=Math.floor(east/this.tileSize);
  const minY=Math.floor(south/this.tileSize),maxY=Math.floor(north/this.tileSize);
  const center:Point=[(west+east)/2,(south+north)/2];
  const choices:{id:string;distance:number}[]=[];
  // Limit very broad views to a bounded central region, instead of
  // iterating millions of cells after a zoom-out.
  const x0=Math.max(minX,Math.floor(center[0]/this.tileSize)-16);
  const x1=Math.min(maxX,Math.floor(center[0]/this.tileSize)+16);
  const y0=Math.max(minY,Math.floor(center[1]/this.tileSize)-16);
  const y1=Math.min(maxY,Math.floor(center[1]/this.tileSize)+16);
  for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++){
   const id=x+'_'+y;
   if(this.available.has(id)&&!this.loaded.has(id)&&!this.queued.has(id)&&
    (this.failedUntil.get(id)??0)<=Date.now())choices.push({id,distance:this.tileDistance(id,center)});
  }
  choices.sort((a,b)=>a.distance-b.distance);
  const capacity=Math.max(0,MAX_PENDING_TILES-this.queue.length);
  const selected=choices.slice(0,Math.min(8,capacity));
  for(const {id,distance} of selected){this.queued.add(id);this.queue.push(id);
   // Viewer geometry is requested on demand, without displacing routes
   // needed by actively moving vehicles.
   this.priority.set(id,10+distance);
  }
  if(selected.length){diagnostic('roads:viewport',`requested=${selected.length} candidates=${choices.length}`);
   this.queue.sort((a,b)=>(this.priority.get(a)??Infinity)-(this.priority.get(b)??Infinity));this.pump();}
 }
 /** Load only the exact harbour-access tile, not a large speculative region.
  * This lets POI explorers find nearby ferry terminals without undoing the
  * bounded road-loader backpressure needed by iPhone Safari.
  */
 considerHarbour(p:Point){
  if(this.disposed||!this.available.size||this.queue.length>=MAX_PENDING_TILES)return;
  const id=tileId(p[0],p[1],this.tileSize);
  if(!this.available.has(id)||this.loaded.has(id)||this.queued.has(id)||(this.failedUntil.get(id)??0)>Date.now())return;
  this.queued.add(id);this.queue.push(id);this.priority.set(id,5);
  this.queue.sort((a,b)=>(this.priority.get(a)??Infinity)-(this.priority.get(b)??Infinity));
  this.pump();
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
    this.priority.set(id,this.tileDistance(id,p));
   }
  }
  // Vehicle positions and HQ are processed first; distant ferry/prefetch tiles remain queued.
  this.queue.sort((a,b)=>(this.priority.get(a)??Infinity)-(this.priority.get(b)??Infinity));
  this.pump();
 }
 private pump(){if(this.backgroundTimer!==null)return;while(!this.disposed&&this.inFlight<MAX_CONCURRENT&&this.queue.length){const id=this.queue.shift()!;this.priority.delete(id);this.inFlight++;
  void this.load(id).catch(e=>{this.failedUntil.set(id,Date.now()+60000);this.onError(`Road tile ${id}: ${String(e)}`)}).finally(()=>{this.queued.delete(id);this.inFlight--;if(this.disposed)return;
   // Give Safari a rendering opportunity between completed background tiles.
   if(this.backgroundTimer===null)this.backgroundTimer=setTimeout(()=>{this.backgroundTimer=null;this.pump();},BACKGROUND_TILE_DELAY_MS)});}}
 private async load(id:string){if(this.loaded.has(id)||this.disposed)return;
  const fetchStarted=performance.now();const roads=await loadRoadTile(id);diagnostic('roads:tile',`loaded segments=${roads.length} parseMs=${Math.round(performance.now()-fetchStarted)} queued=${this.queue.length}`);if(this.disposed)return;
  // Build and deduplicate edges off the main thread. Only the compact graph
  // delta is applied to the live graph; rendering is yielded between batches.
  const workerStarted=performance.now();const delta=await this.prepareInWorker(roads);diagnostic('roads:worker',`processingMs=${Math.round(performance.now()-workerStarted)} nodes=${delta.nodes.length} edges=${delta.count}`);
  if(this.disposed)return;
  const applyStarted=performance.now();let applyCpuMs=0,applyYields=0;let nodeIndex=0,edgeIndex=0;
  while(nodeIndex<delta.nodes.length||edgeIndex<delta.edges.length){
   const sliceStarted=performance.now();const deadline=sliceStarted+MERGE_BUDGET_MS;
   while(nodeIndex<delta.nodes.length&&performance.now()<deadline){
    const [key,point]=delta.nodes[nodeIndex++];
    if(!this.graph.nodes.has(key)){this.graph.nodes.set(key,point);this.graph.nodeKeys.push(key);}
   }
   while(edgeIndex<delta.edges.length&&performance.now()<deadline){
    const [key,links]=delta.edges[edgeIndex++];
    const existing=this.graph.edges.get(key);
    if(existing)existing.push(...links);else this.graph.edges.set(key,links);
   }
   applyCpuMs+=performance.now()-sliceStarted;
   if(nodeIndex<delta.nodes.length||edgeIndex<delta.edges.length){applyYields++;await yieldToRenderer();}
   if(this.disposed)return;
  }
  diagnostic('roads:apply',`elapsedMs=${Math.round(performance.now()-applyStarted)} cpuMs=${Math.round(applyCpuMs)} yields=${applyYields} nodes=${delta.nodes.length} edgeGroups=${delta.edges.length}`);this.edgeTotal+=delta.count;
  this.loaded.add(id);this.scheduleGraphPublish();
   // Backpressure: do not start another tile while the dispatch worker is
   // processing this tile. Unbounded postMessage cloning exhausted iOS memory.
   const syncStarted=performance.now();
   await this.onRoads?.(roads);
   if(this.disposed)return;
   diagnostic('roads:dispatch-sync',`ackMs=${Math.round(performance.now()-syncStarted)} segments=${roads.length}`);
  // The routing graph and dispatch worker now own the data; discard the duplicate parsed array.
  releaseRoadTile(id);
 }
 dispose(){this.disposed=true;if(this.backgroundTimer!==null){clearTimeout(this.backgroundTimer);this.backgroundTimer=null;}this.priority.clear();this.graphWorker?.terminate();this.graphWorker=null;for(const request of this.workerRequests.values())request.reject(new Error('Road network disposed'));this.workerRequests.clear();if(this.publishTimer!==null){clearTimeout(this.publishTimer);this.publishTimer=null;}this.queue.length=0;this.queued.clear();this.failedUntil.clear();}
}
