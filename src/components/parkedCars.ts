/** Decorative parked cars inferred conservatively from parallel OSM service aisles.
 * This is display-only: it does not create jobs, simulate traffic or mutate roads.
 * Exact individual parking bays are not encoded in the game's road tiles.
 */
export type ParkingRoad={id:string;a:[number,number];b:[number,number];highway?:string};
export type ParkedCar={position:[number,number];bearing:number;sprite:string;id:string};
const RAD=Math.PI/180;
const GRID=0.0015;
const COLORS=['parked-white','parked-silver','parked-dark','parked-blue','parked-red'];
function hash(value:string):number{
 let h=2166136261;
 for(let i=0;i<value.length;i++){h=Math.imul(h^value.charCodeAt(i),16777619);}
 return h>>>0;
}
const cell=(x:number,y:number)=>x+':'+y;
type Lane={road:ParkingRoad;cx:number;cy:number;ax:number;ay:number;dx:number;dy:number;length:number;ux:number;uy:number};
export function buildParkedCars(roads:ParkingRoad[],maxCars=320):ParkedCar[]{
 const limit=Math.max(0,Math.floor(maxCars));
 if(limit===0||roads.length<3)return [];
 const originLat=roads[0].a[1];
 const metresPerLon=111320*Math.cos(originLat*RAD),metresPerLat=111320;
 if(metresPerLon<=0)return [];
 const lanes:Lane[]=[];
 const buckets=new Map<string,number[]>();
 for(const road of roads){
  if(road.highway!=='service')continue;
  const ax=road.a[0]*metresPerLon,ay=road.a[1]*metresPerLat;
  const bx=road.b[0]*metresPerLon,by=road.b[1]*metresPerLat;
  const dx=bx-ax,dy=by-ay,length=Math.hypot(dx,dy);
  // Include the short arms of U-shaped parking rows as well as long aisles.
  if(length<7||length>220)continue;
  const cx=(ax+bx)/2,cy=(ay+by)/2,ux=dx/length,uy=dy/length;
  const lane:Lane={road,cx,cy,ax,ay,dx,dy,length,ux,uy};
  const i=lanes.push(lane)-1;
  const gx=Math.floor(cx/120),gy=Math.floor(cy/120);
  const k=cell(gx,gy),bucket=buckets.get(k);
  if(bucket)bucket.push(i);else buckets.set(k,[i]);
 }
 if(lanes.length<3)return [];
 const result:ParkedCar[]=[];
 const occupied=new Set<string>();
 const paired=new Set<number>();
 const emittedPairs=new Set<string>();
 const toGeographic=(x:number,y:number):[number,number]=>[x/metresPerLon,y/metresPerLat];
 const place=(x:number,y:number,bearing:number,id:string)=>{
  if(result.length>=limit)return;
  const seed=hash(id);
  // Deterministic occupancy: no reshuffling during pan/zoom.
  if(seed%100>=62)return;
  const key=Math.round(x/2.5)+':'+Math.round(y/2.5);
  if(occupied.has(key))return;
  occupied.add(key);
  result.push({id,position:toGeographic(x,y),bearing,
   sprite:COLORS[(seed>>>9)%COLORS.length]});
 };
 // For a U-shaped parking bay the two long, near-parallel sides define a
 // strip. Put cars BETWEEN its sides, never on the purple road outlines.
 for(let i=0;i<lanes.length&&result.length<limit;i++){
  const a=lanes[i];
  const gx=Math.floor(a.cx/120),gy=Math.floor(a.cy/120);
  let closeParallel=0;
  const possible:{index:number;distance:number;overlapStart:number;overlapEnd:number}[]=[];
  for(let x=gx-1;x<=gx+1;x++)for(let y=gy-1;y<=gy+1;y++){
   for(const j of buckets.get(cell(x,y))??[]){
    if(i===j)continue;
    const b=lanes[j];
    if(Math.abs(a.ux*b.ux+a.uy*b.uy)<0.94)continue;
    const lateral=Math.abs((b.cx-a.cx)*(-a.uy)+(b.cy-a.cy)*a.ux);
    if(lateral<3.5||lateral>65)continue;
    const b0=(b.ax-a.ax)*a.ux+(b.ay-a.ay)*a.uy;
    const b1=b0+b.dx*a.ux+b.dy*a.uy;
    const lo=Math.max(0,Math.min(b0,b1)),hi=Math.min(a.length,Math.max(b0,b1));
    if(hi-lo<7)continue;
    closeParallel++;
    if(lateral<=21)possible.push({index:j,distance:lateral,overlapStart:lo,overlapEnd:hi});
   }
  }
  // Density check removes isolated road shoulders and narrow parallel streets.
  if(closeParallel<2)continue;
  possible.sort((a,b)=>a.distance-b.distance);
  for(const match of possible.slice(0,2)){
   const b=lanes[match.index];
   const pairId=[a.road.id,b.road.id].sort().join('|');
   if(emittedPairs.has(pairId))continue;
   emittedPairs.add(pairId);
   paired.add(i);paired.add(match.index);
   const mx=(a.cx+b.cx)/2,my=(a.cy+b.cy)/2;
   const perp=(-a.uy),side=(a.ux);
   const dx=b.cx-a.cx,dy=b.cy-a.cy;
   const lateral=dx*perp+dy*side;
   // Car centre is halfway from the source line to the other line.
   const alongShift=(dx*a.ux+dy*a.uy)/2;
   const offset=lateral/2;
   const count=Math.min(50,Math.floor((match.overlapEnd-match.overlapStart-3)/5.7));
   for(let n=0;n<count&&result.length<limit;n++){
    const along=match.overlapStart+2.4+(n+0.5)*5.7;
    if(along>=match.overlapEnd-1)break;
    const x=a.ax+a.ux*(along+alongShift)+perp*offset;
    const y=a.ay+a.uy*(along+alongShift)+side*offset;
    const bearing=Math.atan2(a.ux,a.uy)*180/Math.PI;
    place(x,y,bearing,pairId+':'+n);
   }
  }
 }
 // Wider parking lots use parallel access aisles instead of paired U arms.
 // These cars sit beside the road, not on top of the red/purple line.
 if(result.length<limit)for(let i=0;i<lanes.length&&result.length<limit;i++){
  if(paired.has(i))continue;
  const a=lanes[i],gx=Math.floor(a.cx/120),gy=Math.floor(a.cy/120);
  const offsets:number[]=[];
  for(let x=gx-1;x<=gx+1;x++)for(let y=gy-1;y<=gy+1;y++){
   for(const j of buckets.get(cell(x,y))??[]){
    const b=lanes[j];
    if(i===j||Math.abs(a.ux*b.ux+a.uy*b.uy)<0.94)continue;
    const lateral=(b.cx-a.cx)*(-a.uy)+(b.cy-a.cy)*a.ux;
    if(Math.abs(lateral)<12||Math.abs(lateral)>65)continue;
    const longitudinal=Math.abs((b.cx-a.cx)*a.ux+(b.cy-a.cy)*a.uy);
    if(longitudinal>(a.length+b.length)/2+12)continue;
    if(offsets.every(v=>Math.abs(v-lateral)>6))offsets.push(lateral);
   }
  }
  if(offsets.length<2)continue;
  const slots=Math.floor((a.length-5)/5.7);
  for(let n=0;n<slots&&result.length<limit;n++){
   const along=3+(n+0.5)*5.7;
   if(along>a.length-2)break;
   for(const side of [-1,1]){
    const x=a.ax+a.ux*along-a.uy*side*5;
    const y=a.ay+a.uy*along+a.ux*side*5;
    place(x,y,Math.atan2(a.ux,a.uy)*180/Math.PI,a.road.id+':wide:'+n+':'+side);
   }
  }
 }
 return result;
}

/** Tiny top-down sprites; GPU symbol rendering instead of DOM markers. */
export function parkedCarSprites():Array<{name:string;width:number;height:number;data:Uint8Array}>{
 const palette:Array<[string,[number,number,number]]>=[
  ['parked-white',[226,232,238]],['parked-silver',[146,162,176]],
  ['parked-dark',[48,58,74]],['parked-blue',[45,105,170]],
  ['parked-red',[176,66,65]]
 ];
 const width=16,height=30;
 return palette.map(([name,color])=>{
  const data=new Uint8Array(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
   const i=(y*width+x)*4;
   const body=x>=2&&x<=13&&y>=2&&y<=27;
   const outline=x>=1&&x<=14&&y>=4&&y<=25;
   if(!outline)continue;
   const glass=x>=3&&x<=12&&((y>=7&&y<=11)||(y>=19&&y<=23));
   const tint=glass?[44,67,86]:body?color:[24,27,33];
   const edge=(x===2||x===13||y===2||y===27);
   data[i]=Math.max(0,tint[0]-(edge?23:0));
   data[i+1]=Math.max(0,tint[1]-(edge?23:0));
   data[i+2]=Math.max(0,tint[2]-(edge?23:0));
   data[i+3]=255;
  }
  return {name,width,height,data};
 });
}
