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
 const lanes:Lane[]=[];
 const buckets=new Map<string,number[]>();
 const lat=roads[0]?.a[1]??0;
 const metresPerLon=111320*Math.cos(lat*RAD);
 const metresPerLat=111320;
 for(const road of roads){
  if(road.highway!=='service')continue;
  const ax=road.a[0]*metresPerLon,ay=road.a[1]*metresPerLat;
  const bx=road.b[0]*metresPerLon,by=road.b[1]*metresPerLat;
  const dx=bx-ax,dy=by-ay,length=Math.hypot(dx,dy);
  // Very short fragments and large through roads are not reliable parking aisles.
  if(length<12||length>240)continue;
  const cx=(ax+bx)/2,cy=(ay+by)/2,ux=dx/length,uy=dy/length;
  const lane:Lane={road,cx,cy,ax,ay,dx,dy,length,ux,uy};
  const index=lanes.push(lane)-1;
  const gx=Math.floor(((road.a[0]+road.b[0])/2)/GRID);
  const gy=Math.floor(((road.a[1]+road.b[1])/2)/GRID);
  const k=cell(gx,gy),list=buckets.get(k);
  if(list)list.push(index);else buckets.set(k,[index]);
 }
 if(lanes.length<4)return [];
 const results:ParkedCar[]=[];
 const seen=new Set<string>();
 const threshold=maxCars>0?maxCars:0;
 for(const lane of lanes){
  if(results.length>=threshold)break;
  const mx=(lane.road.a[0]+lane.road.b[0])/2;
  const my=(lane.road.a[1]+lane.road.b[1])/2;
  const gx=Math.floor(mx/GRID),gy=Math.floor(my/GRID);
  const offsets:number[]=[0];
  let neighbors=0;
  for(let x=gx-1;x<=gx+1;x++)for(let y=gy-1;y<=gy+1;y++){
   for(const i of buckets.get(cell(x,y))??[]){
    const other=lanes[i];
    if(other===lane||Math.abs(lane.ux*other.ux+lane.uy*other.uy)<0.95)continue;
    const longitudinal=Math.abs((other.cx-lane.cx)*lane.ux+(other.cy-lane.cy)*lane.uy);
    if(longitudinal>(lane.length+other.length)/2+25)continue;
    const sideways=(other.cx-lane.cx)*(-lane.uy)+(other.cy-lane.cy)*lane.ux;
    if(Math.abs(sideways)<7||Math.abs(sideways)>65)continue;
    // Distinct lateral lanes, rather than many OSM fragments of the same street.
    if(offsets.some(v=>Math.abs(v-sideways)<6))continue;
    offsets.push(sideways);neighbors++;
    if(neighbors>=3)break;
   }
   if(neighbors>=3)break;
  }
  // Require three roughly parallel aisles in proximity to avoid decorating
  // isolated service roads, parking access roads and normal residential streets.
  if(neighbors<2)continue;
  const slots=Math.floor((lane.length-6)/3);
  for(let n=0;n<slots&&results.length<threshold;n++){
   const along=3+(n+0.5)*3;
   if(along>=lane.length-2)break;
   for(const side of [-1,1]){
    const id=lane.road.id+':'+n+':'+side;
    const seed=hash(id);
    // Stable 62% occupancy across pans, zooms and reloads.
    if(seed%100>=62)continue;
    const baseX=lane.ax+lane.ux*along+(-lane.uy)*side*4.6;
    const baseY=lane.ay+lane.uy*along+lane.ux*side*4.6;
    const lon=baseX/metresPerLon,lat=baseY/metresPerLat;
    const posKey=Math.round(baseX/2)+':'+Math.round(baseY/2);
    if(seen.has(posKey))continue;
    seen.add(posKey);
    const direction=Math.atan2(lane.ux,lane.uy)*180/Math.PI+(side===1?90:-90);
    results.push({id,position:[lon,lat],bearing:direction,
     sprite:COLORS[(seed>>>9)%COLORS.length]});
    if(results.length>=threshold)break;
   }
  }
 }
 return results;
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
