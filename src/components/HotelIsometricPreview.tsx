import {useMemo,useState} from 'react';
import {Layers3,RotateCw,Eye,Boxes,Info} from 'lucide-react';
import type {HotelFloor,HotelSite,Room,ObjectPlacement,Wall} from '../internalConstruction';
import {furnitureSize} from '../internalConstruction';
import {furnitureFinishColor} from '../furnitureCatalog';
import {
 buildIsoScene,isoCorners,isoProject,pointString,roomShortLabel,
 ISO_COLORS,type IsoAngle,type IsoPoint,type IsoScope,
} from '../hotelVisualisation';
import './hotel-isometric.css';

const pnts=(points:IsoPoint[])=>pointString(points);
function RoomCutaway({room,site,z,angle,selected}:{
 room:Room;site:HotelSite;z:number;angle:IsoAngle;selected:boolean;
}){
 const c=isoCorners(room.x,room.y,room.width,room.height,z,
  site.width,site.height,angle);
 const slab=isoCorners(room.x,room.y,room.width,room.height,z-3,
  site.width,site.height,angle);
 const cx=isoProject(room.x+room.width/2,room.y+room.height/2,
  z+.15,site.width,site.height,angle);
 const label=roomShortLabel(room);
 const color=ISO_COLORS[room.type];
 return <g>
  <polygon points={pnts([c[1],c[2],slab[2],slab[1]])}
   fill="#152e43" stroke="#6e91a5" strokeWidth=".7"/>
  <polygon points={pnts([c[2],c[3],slab[3],slab[2]])}
   fill="#1c344a" stroke="#6e91a5" strokeWidth=".7"/>
  <polygon points={pnts(c)} fill={color} fillOpacity=".90"
   stroke={selected?'#fff3af':'#d6e9f0'} strokeWidth={selected?2.4:1.1}/>
  {room.type==='stairwell'&&Array.from({length:Math.min(10,Math.max(2,room.height))},(_,i)=>{
   const y=room.y+(i+.5)*room.height/Math.min(10,Math.max(2,room.height));
   const a=isoProject(room.x+.2,y,z+.25,site.width,site.height,angle);
   const b=isoProject(room.x+room.width-.2,y,z+.25,site.width,site.height,angle);
   return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
    stroke="#2c766d" strokeWidth="1.6" opacity=".8"/>;
  })}
  {room.type==='elevator'&&<g>
   {[[room.x+.3,room.y+.3],[room.x+room.width-.3,room.y+room.height-.3]].map(([x,y],i)=>{
    const a=isoProject(x,y,z+.45,site.width,site.height,angle);
    return <circle key={i} cx={a.x} cy={a.y} r="2" fill="#fff" stroke="#31759a" strokeWidth=".9"/>;
   })}
  </g>}
  {room.width>=3&&room.height>=3&&<text x={cx.x} y={cx.y-2} textAnchor="middle"
   fill="#172f45" stroke="#edf8ff" strokeWidth=".3" paintOrder="stroke"
   fontSize={room.width<=4?6.2:8.2} fontWeight="700">
   {label.slice(0,room.width<=4?9:19)}
  </text>}
 </g>;
}
function FurnitureBox({item,site,z,angle}:{
 item:ObjectPlacement;site:HotelSite;z:number;angle:IsoAngle;
}){
 const size=furnitureSize(item);
 const height=['wardrobe','fridge','freezer','headboard','mirror','sculpture','shelves'].includes(item.code)?5:2.1;
 const face=isoCorners(item.x+.12,item.y+.12,size.width-.24,size.height-.24,z+height,
  site.width,site.height,angle);
 const lower=isoCorners(item.x+.12,item.y+.12,size.width-.24,size.height-.24,z,
  site.width,site.height,angle);
 const isBed=item.code==='bed'||item.code==='single-bed';
 const color=item.finish?furnitureFinishColor(item.finish):isBed?'#f3e5d6':
  ['shower','toilet','sink','bathtub','mirror'].includes(item.code)?'#eaf7fc':
  item.code==='lamp'?'#ffdb91':item.code==='plant'?'#74a184':'#b9a28c';
 return <g>
  <polygon points={pnts([face[1],face[2],lower[2],lower[1]])}
   fill="#65748b" stroke="#526d80" strokeWidth=".5"/>
  <polygon points={pnts([face[2],face[3],lower[3],lower[2]])}
   fill="#75839a" stroke="#526d80" strokeWidth=".5"/>
  <polygon points={pnts(face)} fill={color} stroke="#526d80" strokeWidth=".65"/>
  {isBed&&<line x1={face[0].x*.7+face[1].x*.3}
   y1={face[0].y*.7+face[1].y*.3}
   x2={face[3].x*.7+face[2].x*.3} y2={face[3].y*.7+face[2].y*.3}
   stroke="#c6a990" strokeWidth="1.3"/>}
 </g>;
}
function WallMark({wall,site,z,angle}:{
 wall:Wall;site:HotelSite;z:number;angle:IsoAngle;
}){
 const pt1=isoProject(wall.x,wall.y,z+.8,site.width,site.height,angle);
 const pt2=isoProject(wall.x+(wall.orientation==='h'?1:0),
  wall.y+(wall.orientation==='v'?1:0),z+.8,site.width,site.height,angle);
 const color=wall.type==='door'?'#8bf1c8':
  wall.type==='panoramic-window'?'#93ecff':
  wall.type==='window'?'#62bbf5':'#e8eff2';
 return <line x1={pt1.x} y1={pt1.y} x2={pt2.x} y2={pt2.y}
  stroke={color} strokeWidth={wall.type==='panoramic-window'?3.4:wall.type==='wall'?3:2.7}
  strokeLinecap="round"/>;
}
function FloorGroup({floor,index,z,site,angle,selected,detailed}:{
 floor:HotelFloor;index:number;z:number;site:HotelSite;angle:IsoAngle;
 selected:boolean;detailed:boolean;
}){
 const corners=isoCorners(0,0,site.width,site.height,z-4,site.width,site.height,angle);
 return <g aria-label={floor.label} opacity={selected?1:.87}>
  <polygon points={pnts(corners)} fill="#273c53" fillOpacity=".50"
   stroke="#536a7e" strokeWidth="1" strokeDasharray="4 4"/>
  {floor.rooms.map(room=><RoomCutaway key={room.id} room={room}
   site={site} z={z} angle={angle} selected={selected}/>)}
  {detailed&&floor.objects.map(item=><FurnitureBox key={item.id} item={item}
   site={site} z={z+1} angle={angle}/>)}
  {detailed&&floor.walls.map(wall=><WallMark key={wall.id} wall={wall}
   site={site} z={z} angle={angle}/>)}
  {detailed&&(floor.lights??[]).map(light=>{
   const point=isoProject(light.x+.5,light.y+.5,z+1.8,
    site.width,site.height,angle);
   return <circle key={light.id} cx={point.x} cy={point.y} r="2.8"
    stroke="#fff3d3" strokeWidth=".8" fill="#ffdfa4"/>;
  })}
  {detailed&&(floor.safetyFixtures??[]).map(fixture=>{
   const point=isoProject(fixture.x+.5,fixture.y+.5,z+1.8,
    site.width,site.height,angle);
   return <rect key={fixture.id} x={point.x-2.6} y={point.y-2.6}
    width="5.2" height="5.2" rx="1.1"
    fill={fixture.kind==='smoke-alarm'?'#9fd2ff':fixture.kind==='exit-sign'?'#93e1ba':'#ffb4a7'}/>;
  })}
  <text x={isoProject(0,0,z,site.width,site.height,angle).x-4}
   y={isoProject(0,0,z,site.width,site.height,angle).y-9}
   fill="#d9e9f2" fontSize="10" fontWeight="700">{index===0?'G':index}</text>
 </g>;
}
export default function HotelIsometricPreview({site,floorIndex,onExit}:{
 site:HotelSite;floorIndex:number;onExit:()=>void;
}){
 const [angle,setAngle]=useState<IsoAngle>(0);
 const [scope,setScope]=useState<IsoScope>('building');
 const scene=useMemo(()=>buildIsoScene(site,scope,floorIndex,angle),
  [site,scope,floorIndex,angle]);
 const count=scene.levels.reduce((n,level)=>n+level.floor.rooms.length,0);
 return <section className="ib-isometric" aria-label="Read-only hotel isometric architectural preview">
  <div className="ib-iso-head">
   <div><strong><Boxes size={16}/> Isometric building cutaway</strong>
    <small>Lightweight SVG preview of your current blueprint · read-only</small></div>
   <button type="button" className="ib-secondary" onClick={onExit}>
    <Eye size={15}/> Return to 2D editor
   </button>
  </div>
  <div className="ib-iso-controls">
   <div role="group" aria-label="Isometric floors">
    <button type="button" className={scope==='building'?'selected':''}
     onClick={()=>setScope('building')}><Layers3 size={15}/> All floors</button>
    <button type="button" className={scope==='floor'?'selected':''}
     onClick={()=>setScope('floor')}>Selected floor</button>
   </div>
   <div role="group" aria-label="Rotate isometric view">
    <button type="button" onClick={()=>setAngle(v=>((v+3)%4) as IsoAngle)}
     aria-label="Rotate building left"><RotateCw size={15} style={{transform:'scaleX(-1)'}}/></button>
    <span>{['North-east','South-east','South-west','North-west'][angle]}</span>
    <button type="button" onClick={()=>setAngle(v=>((v+1)%4) as IsoAngle)}
     aria-label="Rotate building right"><RotateCw size={15}/></button>
   </div>
  </div>
  <div className="ib-iso-viewport">
   <svg viewBox={scene.viewBox} preserveAspectRatio="xMidYMid meet"
    role="img" aria-label={`Isometric cutaway, ${scene.levels.length} floors, ${count} rooms`}>
    <defs><linearGradient id="ib-iso-floor-shade" x1="0" y1="0" x2="0" y2="1">
     <stop offset="0%" stopColor="#263f5c"/>
     <stop offset="100%" stopColor="#111e35"/>
    </linearGradient></defs>
    <rect x="-5000" y="-5000" width="10000" height="10000"
     fill="url(#ib-iso-floor-shade)"/>
    {scene.levels.map(level=><FloorGroup key={level.floor.id+':'+level.index}
     floor={level.floor} index={level.index} z={level.z} site={site}
     angle={angle} selected={scope==='floor'||level.index===floorIndex}
     detailed={scene.detailed}/>)}
   </svg>
  </div>
  <div className="ib-iso-legend">
   <span><i className="room"/> Room slabs</span>
   <span><i className="door"/> Doors</span>
   <span><i className="window"/> Windows</span>
   <span><i className="furnish"/> Furniture</span>
  </div>
  {!scene.detailed&&<p className="ib-iso-warning"><Info size={15}/>
   Large blueprint ({scene.primitiveCount} estimated details): showing room geometry only
   to keep mobile rendering responsive. The editable 2D plan still contains all details.
   {scene.truncated?' Only the first 350 rooms across the preview are shown.':''}
  </p>}
  <p className="ib-iso-caption">Stylised architectural cutaway, not a physically accurate 3D model.
   All visible objects come from your saved draft blueprint; nothing is changed or charged.
   Use the 2D editor to make changes.</p>
 </section>;
}
