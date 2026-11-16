/** Geographically fair passenger demand for a company with distant depots.
 * A regional demand origin only contains real Explorer-discovered road stops.
 * No artificial road links or cross-island passenger trips are generated.
 */
import {meters,type PassengerRequest,type Point} from './taxi';

export type PassengerDepotRegion={id:string;position:Point;available:number};
export type PassengerRegionStatus={
 id:string;position:Point;available:number;waiting:number;maxWaiting:number;
};

/** This index contains only legal passenger-stop nodes, added as OSM road
 * packages and discovery IDs arrive. It does not duplicate the road graph. */
export class PassengerStopSpatialIndex{
 private readonly cells=new Map<string,Set<string>>();
 private readonly seen=new Set<string>();
 private readonly cellSize=0.02;
 // Only a tiny reservoir per ~20 km region is retained, never a second
 // full nationwide list of passenger stops on mobile Safari.
 private readonly longCells=new Map<string,{samples:string[];seen:number}>();
 private readonly longCellSize=0.18;
 get size(){return this.seen.size;}
 clear(){this.cells.clear();this.seen.clear();this.longCells.clear();}
 add(node:string,point:Point){
  if(this.seen.has(node))return;
  this.seen.add(node);
  const farKey=Math.floor(point[0]/this.longCellSize)+':'+
   Math.floor(point[1]/this.longCellSize);
  let far=this.longCells.get(farKey);
  if(!far){far={samples:[],seen:0};this.longCells.set(farKey,far);}
  far.seen++;
  if(far.samples.length<20)far.samples.push(node);
  else{
   // Reservoir sampling ensures newly discovered distant roads may
   // replace earlier HQ-centric roads without growing with node count.
   const index=Math.floor(Math.random()*far.seen);
   if(index<far.samples.length)far.samples[index]=node;
  }
  const key=this.cell(point[0],point[1]);
  let bucket=this.cells.get(key);
  if(!bucket){bucket=new Set();this.cells.set(key,bucket);}
  bucket.add(node);
 }
 private cell(lon:number,lat:number){return Math.floor(lon/this.cellSize)+':'+Math.floor(lat/this.cellSize);}
 /** Bound both the search and the output for iPhone Safari; sample the
  * eligible graph nodes rather than taking only the first-added HQ roads. */
 near(center:Point,lookup:(node:string)=>Point|undefined,
  radiusMeters=4800,maxStops=1800):string[]{
  const dy=radiusMeters/111320;
  const dx=dy/Math.max(0.1,Math.cos(center[1]*Math.PI/180));
  const cy=Math.floor(center[1]/this.cellSize),cx=Math.floor(center[0]/this.cellSize);
  const rx=Math.ceil(dx/this.cellSize),ry=Math.ceil(dy/this.cellSize);
  const found:string[]=[];
  let seen=0;
  for(let x=cx-rx;x<=cx+rx;x++)for(let y=cy-ry;y<=cy+ry;y++)
   for(const node of this.cells.get(x+':'+y)??[]){
    const point=lookup(node);
    if(!point||meters(point,center)>radiusMeters)continue;
    seen++;
    if(found.length<maxStops)found.push(node);
    else{
     // Reservoir sampling prevents old HQ-centric insertion order from
     // starving newer depot tiles without retaining the entire local pool.
     const index=Math.floor(Math.random()*seen);
     if(index<maxStops)found[index]=node;
    }
   }
  return found;
 }
 /** Count discovered passenger stops near a hotspot without creating
  * another array of thousands of node IDs on mobile Safari.
  */
 countNear(center:Point,lookup:(node:string)=>Point|undefined,
  radiusMeters=2000,cap=120):number{
  const dy=radiusMeters/111320;
  const dx=dy/Math.max(.1,Math.cos(center[1]*Math.PI/180));
  const cx=Math.floor(center[0]/this.cellSize),cy=Math.floor(center[1]/this.cellSize);
  const rx=Math.ceil(dx/this.cellSize),ry=Math.ceil(dy/this.cellSize);
  let count=0;
  for(let x=cx-rx;x<=cx+rx;x++)for(let y=cy-ry;y<=cy+ry;y++)
   for(const node of this.cells.get(x+':'+y)??[]){
    const point=lookup(node);
    if(point&&meters(point,center)<=radiusMeters){
     count++;
     if(count>=cap)return count;
    }
   }
  return count;
 }
 /** Sample widely separated discovered passenger stops without visiting
  * millions of stops or allocating a second road graph. Call infrequently:
  * regional/intercity generation only, never each frame.
  */
 distant(center:Point,lookup:(node:string)=>Point|undefined,
  minMeters:number,maxMeters:number,limit=12):string[]{
  const samples:string[]=[];
  let considered=0;
  const latStep=this.longCellSize*111320;
  for(const [key,cell] of this.longCells){
   const [rawX,rawY]=key.split(':');
   const x=Number(rawX),y=Number(rawY);
   const centroid:Point=[(x+0.5)*this.longCellSize,
    (y+0.5)*this.longCellSize];
   const margin=latStep*1.8;
   const approx=meters(center,centroid);
   if(approx<minMeters-margin||approx>maxMeters+margin)continue;
   for(const node of cell.samples){
    const point=lookup(node);
    if(!point)continue;
    const actual=meters(center,point);
    if(actual<minMeters||actual>maxMeters)continue;
    considered++;
    if(samples.length<limit)samples.push(node);
    else{
     const index=Math.floor(Math.random()*considered);
     if(index<limit)samples[index]=node;
    }
   }
  }
  // Shuffle candidates to prevent a fixed bad island/one-way pair from
  // consuming every bounded route attempt.
  for(let i=samples.length-1;i>0;i--){
   const j=Math.floor(Math.random()*(i+1));
   [samples[i],samples[j]]=[samples[j],samples[i]];
  }
  return samples;
 }
}

/** Attribute old untagged jobs geographically; new jobs carry their own
 * regionId for reliable per-depot queue accounting. */
export function passengerQueueByDepot(
 requests:readonly PassengerRequest[],
 depots:readonly PassengerDepotRegion[],
):Map<string,number>{
 const counts=new Map(depots.map(d=>[d.id,0]));
 for(const request of requests){
  const explicit=request.originDepotId;
  const known=explicit&&counts.has(explicit)?explicit:null;
  const nearest=known??depots.reduce<{id:string;distance:number}|null>((best,d)=>{
   const distance=meters(request.pickup,d.position);
   return !best||distance<best.distance?{id:d.id,distance}:best;
  },null)?.id;
  if(nearest)counts.set(nearest,(counts.get(nearest)??0)+1);
 }
 return counts;
}

/** Pick the most underserved depot with at least one on-duty idle taxi.
 * A successful request increments its region backlog; the next dispatch
 * naturally rotates to the other depot rather than filling one global queue.
 */
export function regionalPassengerDemand(
 regions:readonly PassengerDepotRegion[],
 pending:readonly PassengerRequest[],
 lastSelectedId:string|null=null,
):PassengerRegionStatus[]{
 const counts=passengerQueueByDepot(pending,regions);
 return regions.filter(r=>r.available>0).map(region=>{
  const waiting=counts.get(region.id)??0;
  return {...region,waiting,maxWaiting:Math.min(4,Math.max(2,region.available*2))};
 }).sort((a,b)=>{
  const aPressure=a.waiting/a.available;
  const bPressure=b.waiting/b.available;
  if(aPressure!==bPressure)return aPressure-bPressure;
  if(a.id===lastSelectedId)return 1;
  if(b.id===lastSelectedId)return -1;
  return a.id.localeCompare(b.id);
 });
}
