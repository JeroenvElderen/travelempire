import { loadOwnedRegionRoads, type RegionalRoad } from './regionalRoads';
import { containsPoint, regionId, type RegionCollection } from '../territories';
import type { Point, RoadGraph } from '../simulation/taxi';

/** v1.2: Invisible ADM3 packages are used only as a storage index. */
const PREFETCH_METERS = 10000;
const MAX_CONCURRENT = 2;
type Bounds = {minX:number;maxX:number;minY:number;maxY:number};
function boundsOf(coords: number[][], b:Bounds) {
  for (const p of coords) { b.minX=Math.min(b.minX,p[0]);b.maxX=Math.max(b.maxX,p[0]);b.minY=Math.min(b.minY,p[1]);b.maxY=Math.max(b.maxY,p[1]); }
}
function polygonRings(g:RegionCollection['features'][number]['geometry']):number[][][] {
  return g.type==='Polygon' ? g.coordinates : g.coordinates.flat();
}
function boundsOfFeature(g:RegionCollection['features'][number]['geometry']):Bounds {
  const b={minX:Infinity,maxX:-Infinity,minY:Infinity,maxY:-Infinity};
  for(const ring of polygonRings(g)) boundsOf(ring,b);
  return b;
}
function nearBoundary(point:Point, rings:number[][][], radiusMeters:number):boolean {
  const scaleX=111320*Math.cos(point[1]*Math.PI/180),scaleY=111320;
  const r2=radiusMeters*radiusMeters;
  for(const ring of rings) for(let i=1;i<ring.length;i++) {
    const a=ring[i-1],b=ring[i];
    const ax=(a[0]-point[0])*scaleX,ay=(a[1]-point[1])*scaleY;
    const dx=(b[0]-a[0])*scaleX,dy=(b[1]-a[1])*scaleY;
    const t=Math.max(0,Math.min(1,-(ax*dx+ay*dy)/(dx*dx+dy*dy||1)));
    const x=ax+t*dx,y=ay+t*dy;
    if(x*x+y*y<=r2)return true;
  }
  return false;
}
export class RoadNetworkManager {
  private readonly regions: {id:string;bounds:Bounds;rings:number[][][];feature:RegionCollection['features'][number]}[];
  private readonly loaded=new Set<string>();
  private readonly queued=new Set<string>();
  private readonly queue:string[]=[];
  private readonly seenEdges=new Set<string>();
  private readonly failedUntil=new Map<string,number>();
  private readonly pendingLoads=new Map<string,Promise<void>>();
  private inFlight=0;
  private disposed=false;
  private graph:RoadGraph={nodes:new Map(),edges:new Map(),nodeKeys:[]};
  private readonly onGraph:(graph:RoadGraph,loadedCount:number)=>void;
  private readonly onError:(message:string)=>void;
  private readonly onRoads?: (roads:RegionalRoad[])=>void;
  constructor(regions:RegionCollection,code:string,onGraph:(graph:RoadGraph,loadedCount:number)=>void,onError:(message:string)=>void,onRoads?: (roads:RegionalRoad[])=>void) {
    this.regions=regions.features.map((feature,index)=>({id:regionId(feature,index,code),bounds:boundsOfFeature(feature.geometry),rings:polygonRings(feature.geometry),feature}));
    this.onGraph=onGraph;this.onError=onError;this.onRoads=onRoads;
  }
  get loadedCount(){return this.loaded.size;}
  get queuedCount(){return this.queue.length+this.inFlight;}
  /** Preload packages intersecting a route corridor, not just its endpoints.
   * Region boundaries remain an invisible storage index, never a movement gate.
   */
  considerRoute(path:Point[]):void {
    if(this.disposed||path.length===0)return;
    const samples:Point[]=[path[0]];
    for(let i=1;i<path.length;i++){
      const a=path[i-1],b=path[i];
      const latMeters=(b[1]-a[1])*111320;
      const lonMeters=(b[0]-a[0])*111320*Math.cos((a[1]+b[1])*Math.PI/360);
      const steps=Math.min(100,Math.max(1,Math.ceil(Math.hypot(latMeters,lonMeters)/3000)));
      for(let j=1;j<=steps;j++)samples.push([a[0]+(b[0]-a[0])*j/steps,a[1]+(b[1]-a[1])*j/steps]);
    }
    this.consider(samples);
  }
  /** Loads every region containing a coordinate, or lying within the prefetch radius. */
  considerPoint(point:Point):void {this.consider([point]);}
  /** Load the starting region before enabling dispatch. */
  async initialize(position:Point):Promise<RoadGraph> {
    const entry=this.regions.find(r=>containsPoint(r.feature,position[0],position[1]));
    if(!entry)throw Error('Starting point is outside available Greek road coverage.');
    await this.addRegion(entry.id);
    if(!this.graph.nodeKeys.length)throw Error('Starting road package has no routable roads.');
    this.consider([position]);
    return this.graph;
  }
  /** Check taxis, HQ, and route endpoints; schedule packages close to their positions. */
  consider(points:Point[]):void {
    if(this.disposed)return;
    for(const p of points) {
      if(!Number.isFinite(p[0])||!Number.isFinite(p[1]))continue;
      const latMargin=PREFETCH_METERS/111320;
      const lonMargin=PREFETCH_METERS/(111320*Math.max(.15,Math.cos(p[1]*Math.PI/180)));
      for(const r of this.regions) {
        if(this.loaded.has(r.id)||this.queued.has(r.id)||(this.failedUntil.get(r.id)??0)>Date.now())continue;
        if(p[0]<r.bounds.minX-lonMargin||p[0]>r.bounds.maxX+lonMargin||p[1]<r.bounds.minY-latMargin||p[1]>r.bounds.maxY+latMargin)continue;
        if(containsPoint(r.feature,p[0],p[1])||nearBoundary(p,r.rings,PREFETCH_METERS)) {
          this.queued.add(r.id);this.queue.push(r.id);
        }
      }
    }
    this.pump();
  }
  private pump():void {
    while(!this.disposed&&this.inFlight<MAX_CONCURRENT&&this.queue.length) {
      const id=this.queue.shift()!;this.inFlight++;
      void this.addRegion(id).catch(error=>{
        this.failedUntil.set(id,Date.now()+60_000);
        this.onError(`Road package ${id}: ${String(error)}`);
      }).finally(()=>{
        this.queued.delete(id);this.inFlight--;this.pump();
      });
    }
  }
  private addRegion(id:string):Promise<void> {
    if(this.loaded.has(id))return Promise.resolve();
    const pending=this.pendingLoads.get(id);
    if(pending)return pending;
    const task=(async()=>{
      const roads=await loadOwnedRegionRoads(id);
      if(this.disposed||this.loaded.has(id))return;
      const before=this.graph.nodeKeys.length;
      await this.mergeInBatches(roads);
      this.loaded.add(id);
      // The graph's maps are append-only. Previously dispatched routes remain valid.
      this.graph={...this.graph};
      this.onRoads?.(roads);
      this.onGraph(this.graph,this.loaded.size);
      console.info(`[TravelEmpire v1.4] Loaded ${id}; ${this.loaded.size} packages, ${this.graph.nodeKeys.length.toLocaleString()} nodes (+${(this.graph.nodeKeys.length-before).toLocaleString()})`);
    })().finally(()=>this.pendingLoads.delete(id));
    this.pendingLoads.set(id,task);
    return task;
  }
  /** Yield between bounded merge batches so map animation gets a rendering opportunity. */
  private async mergeInBatches(roads:RegionalRoad[]):Promise<void>{
    const batchSize=1500;
    for(let i=0;i<roads.length;i+=batchSize){
      if(this.disposed)return;
      this.merge(roads.slice(i,i+batchSize));
      if(i+batchSize<roads.length)await new Promise<void>(resolve=>setTimeout(resolve,0));
    }
  }
  private merge(roads:RegionalRoad[]):void {
    for(const road of roads) {
      if(this.seenEdges.has(road.id)||road.coordinates?.length!==2||!Number.isFinite(road.length)||road.length<=0)continue;
      this.seenEdges.add(road.id);
      const a=String(road.a),b=String(road.b);
      if(!this.graph.nodes.has(a)){this.graph.nodes.set(a,road.coordinates[0]);this.graph.nodeKeys.push(a);}
      if(!this.graph.nodes.has(b)){this.graph.nodes.set(b,road.coordinates[1]);this.graph.nodeKeys.push(b);}
      const add=(from:string,to:string)=>{
        let list=this.graph.edges.get(from);
        if(!list){list=[];this.graph.edges.set(from,list);}
        list.push({to,meters:road.length,id:road.id,speedKph:road.speed});
      };
      if(road.oneway!==-1)add(a,b);
      if(road.oneway!==1)add(b,a);
    }
  }
  dispose():void {this.disposed=true;this.queue.length=0;}
}
