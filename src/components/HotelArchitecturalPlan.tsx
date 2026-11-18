import type {HotelFloor,HotelSite,ObjectPlacement} from '../internalConstruction';
import {furnitureSize,roomSections,roomBoundaryEdges} from '../internalConstruction';
import {ISO_COLORS,roomShortLabel,wallSegment} from '../hotelVisualisation';
import {accessDoorPair} from '../hotelAccess';
import {furnitureFinishColor} from '../furnitureCatalog';

/** Architectural blueprint: light-weight, fully SVG, non-interactive layers.
 * Coordinates use exactly the same 1 m grid as the editable hit targets.
 * Purely visual; pointerEvents none lets old tap/drag/pinch editing work.
 */
export function ArchitecturalRooms({floor}:{floor:HotelFloor}){
 return <g className="ib-architecture-rooms" pointerEvents="none">
  {floor.rooms.map(room=>{
   const x=room.x,y=room.y,w=room.width,h=room.height;
   const parts=roomSections(room),multi=parts.length>1;
   const outline=multi?roomBoundaryEdges(room).map(edge=>
    edge.orientation==='h'?
     `M ${edge.x} ${edge.y} h 1`:`M ${edge.x} ${edge.y} v 1`).join(' '):'';
   const isShaft=room.type==='stairwell'||room.type==='elevator';
   return <g key={room.id}>
    {parts.map((part,i)=><rect key={i} x={multi?part.x:part.x+.04}
     y={multi?part.y:part.y+.04}
     width={multi?part.width:part.width-.08}
     height={multi?part.height:part.height-.08}
     rx={multi?undefined:'.05'}
     fill={ISO_COLORS[room.type]} fillOpacity=".43"
     stroke={multi?'none':'#e9f5ff'} strokeWidth=".14"/>)}
    {multi?<path d={outline} fill="none" stroke="#e9f5ff" strokeWidth=".14"/>:
     <rect x={x+.17} y={y+.17} width={w-.34} height={h-.34}
      fill="none" stroke="#c7d9e6" strokeWidth=".035" strokeOpacity=".48"/>}
    {room.type==='stairwell'&&Array.from({length:Math.max(1,Math.floor(h/.46))},(_,i)=>{
     const offset=(i+1)*h/(Math.floor(h/.46)+1);
     return <line key={i} x1={x+.45} x2={x+w-.45}
      y1={y+offset} y2={y+offset} stroke="#d8fff5" strokeWidth=".065" strokeOpacity=".85"/>;
    })}
    {room.type==='elevator'&&<g stroke="#d1f3ff" strokeWidth=".07" fill="none">
     <rect x={x+.4} y={y+.4} width={w-.8} height={h-.8} rx=".1"/>
     <path d={`M ${x+.5} ${y+.5} L ${x+w-.5} ${y+h-.5} M ${x+w-.5} ${y+.5} L ${x+.5} ${y+h-.5}`}/>
    </g>}
    {room.type==='bathroom'&&<path d={`M ${x+.32} ${y+.32} L ${x+w-.32} ${y+h-.32}`}
      stroke="#c4edf0" strokeWidth=".035" strokeOpacity=".5"/>}
    {room.type==='corridor'&&parts.map((part,i)=><path key={i}
      d={part.height>=part.width?
       `M ${part.x+part.width/2} ${part.y+.15} V ${part.y+part.height-.15}`:
       `M ${part.x+.15} ${part.y+part.height/2} H ${part.x+part.width-.15}`}
      stroke="#e0e9fc" strokeWidth=".045" strokeDasharray=".32 .19" opacity=".48"/> )}
    <text x={x+w/2} y={y+Math.min(.59,h*.23)} fontSize=".37" fontWeight="650"
     letterSpacing=".01" textAnchor="middle" fill="#f5faff">
     {roomShortLabel(room)}
    </text>
    {!isShaft&&!multi&&w>=3&&h>=3&&<text x={x+w/2} y={y+h-.29} fontSize=".29"
     textAnchor="middle" fill="#e0eaf7" opacity=".93">{w} × {h} m</text>}
   </g>;
  })}
 </g>;
}
function Furnishing({item,selected}:{item:ObjectPlacement;selected:boolean}){
 const {width:w,height:h}=furnitureSize(item);
 const code=item.code,finish=furnitureFinishColor(item.finish);
 const isBed=code==='bed'||code==='single-bed';
 const isSeat=code==='chair'||code==='office-chair'||code==='armchair'||code==='reading-chair'||code==='bar-stool'||code==='bench';
 const isTable=code==='table'||code==='conference-table'||code==='prep'||code==='coffee-table'||code==='kitchen-island'||code==='booth';
 const isScreen=code==='television'||code==='computer'||code==='tv-stand';
 const isWhite=code==='toilet'||code==='shower'||code==='sink'||code==='bathtub'||code==='mirror'||code==='towel-rack';
 const isStorage=code==='wardrobe'||code==='shelves'||code==='fridge'||code==='freezer'||code==='minibar'||code==='safe'||code==='nightstand'||code==='headboard'||code==='luggage-rack'||code==='water-cooler';
 const isKitchen=code==='oven'||code==='coffee'||code==='dishwasher'||code==='microwave';
 const isDesk=code==='desk'||code==='reception'||code==='bar-counter'||code==='vanity';
 // Scale the symbol to its actual occupied footprint; rotated furniture
 // comes from furnitureSize and never changes location or save geometry.
 return <g transform={`translate(${item.x} ${item.y}) scale(${w} ${h})`}
  pointerEvents="none" opacity=".96">
  <rect x=".06" y=".06" width=".88" height=".88" rx=".07"
   fill={selected?'#f3d39e':item.finish?finish:isWhite?'#e3f2f3':isBed?'#ebc8a9':
    isSeat?'#b5d6c5':isStorage?'#b4bac8':isKitchen?'#c7d4d9':'#d6c6b5'}
   stroke={selected?'#fff3c7':'#334960'} strokeWidth=".043"/>
  {isBed&&<>
   <rect x=".14" y=".13" width=".72" height=".74" rx=".07" fill="#f7e8da"
    stroke="#ae8d80" strokeWidth=".023"/>
   {item.rotated?<><rect x=".14" y=".18" width=".19" height=".25" rx=".06" fill="#fffdf4"/><rect x=".14" y=".57" width=".19" height=".25" rx=".06" fill="#fffdf4"/><line x1=".48" y1=".14" x2=".48" y2=".86" stroke="#cda796" strokeWidth=".027"/></>:
    <><rect x=".19" y=".17" width=".24" height=".19" rx=".06" fill="#fffdf4"/><rect x=".57" y=".17" width=".24" height=".19" rx=".06" fill="#fffdf4"/><line x1=".14" y1=".47" x2=".86" y2=".47" stroke="#cda796" strokeWidth=".027"/></>}
  </>}
  {isSeat&&<><circle cx=".5" cy=".5" r=".24" fill="#739fa1" stroke="#e9ffff" strokeWidth=".03"/><path d="M .25 .26 H .75" stroke="#365766" strokeWidth=".075"/></>}
  {isTable&&<><rect x=".15" y=".15" width=".70" height=".70" rx=".09" fill={item.finish?finish:'#b38969'} stroke="#f8e6d4" strokeWidth=".025"/><path d="M .23 .27 H .77 M .23 .73 H .77" stroke="#e8cbae" strokeWidth=".02" opacity=".65"/></>}
  {isScreen&&<><rect x=".13" y=".14" width=".74" height=".57" rx=".06" fill="#234456" stroke="#edf8ff" strokeWidth=".035"/><path d="M .38 .79 H .62 M .5 .72 V .79" stroke="#324d61" strokeWidth=".05"/><path d="M .24 .27 H .69" stroke="#6dbec9" strokeWidth=".025"/></>}
  {(code==='sofa'||code==='sofa-bed')&&<><rect x=".14" y=".17" width=".72" height=".68" rx=".12" fill={item.finish?finish:'#658993'}/><rect x=".21" y=".38" width=".58" height=".37" rx=".08" fill="#9ac2c7"/><path d="M .5 .39 V .76" stroke="#e2f4f2" strokeWidth=".024"/></>}
  {code==='toilet'&&<><rect x=".24" y=".15" width=".52" height=".18" rx=".05" fill="#fafdfd" stroke="#8daebc" strokeWidth=".035"/><ellipse cx=".5" cy=".59" rx=".27" ry=".28" fill="#fff" stroke="#8aaeb9" strokeWidth=".04"/><ellipse cx=".5" cy=".6" rx=".15" ry=".15" fill="#a9d6df"/></>}
  {code==='shower'&&<><rect x=".13" y=".13" width=".74" height=".74" rx=".05" fill="#cceff0" stroke="#70a7b9" strokeWidth=".03"/><path d="M .15 .85 L .85 .15 M .23 .20 H .48" stroke="#79bdca" strokeWidth=".025"/><circle cx=".68" cy=".69" r=".07" fill="#6c9faf"/></>}
  {code==='sink'&&<><ellipse cx=".5" cy=".53" rx=".30" ry=".23" fill="#fcffff" stroke="#8aafba" strokeWidth=".04"/><ellipse cx=".5" cy=".54" rx=".16" ry=".13" fill="#b3dce4"/><circle cx=".5" cy=".25" r=".048" fill="#6d94a6"/></>}
  {isStorage&&<><path d="M .20 .16 V .84 M .80 .16 V .84 M .20 .50 H .80" stroke="#53657c" strokeWidth=".05"/><circle cx=".45" cy=".47" r=".022" fill="#f1f5fa"/><circle cx=".55" cy=".47" r=".022" fill="#f1f5fa"/></>}
  {isKitchen&&<>{[.34,.66].map(cx=>[.33,.67].map(cy=><circle key={cx+'-'+cy} cx={cx} cy={cy} r=".1" fill="#667b87" stroke="#f4f8fa" strokeWidth=".022"/>))}</>}
  {isDesk&&<><rect x=".12" y=".13" width=".76" height=".55" rx=".045" fill={item.finish?finish:'#b5926f'} stroke="#f5ddc4" strokeWidth=".025"/><path d="M .15 .76 H .85 M .3 .79 V .88 M .7 .79 V .88" stroke="#796250" strokeWidth=".035"/></>}
  {code==='lamp'&&<><circle cx=".5" cy=".47" r=".24" fill="#fff0ad" stroke="#bd8e52" strokeWidth=".045"/><circle cx=".5" cy=".47" r=".10" fill="#fffdf0"/></>}
  {code==='plant'&&<><circle cx=".52" cy=".42" r=".31" fill="#729c7f"/><circle cx=".34" cy=".39" r=".18" fill="#86b38c"/><circle cx=".64" cy=".60" r=".15" fill="#4d8568"/><circle cx=".5" cy=".53" r=".14" fill={item.finish?finish:'#a17656'}/></>}
  {code==='rug'&&<><rect x=".15" y=".14" width=".70" height=".72" rx=".12" fill={finish} stroke="#fff3e5" strokeWidth=".04"/><path d="M .2 .34 H .8 M .2 .65 H .8" stroke="#f3e9d8" strokeWidth=".025" strokeDasharray=".07 .04"/></>}
  {code==='sculpture'&&<><rect x=".24" y=".66" width=".52" height=".21" fill={finish}/><path d="M .5 .17 C .8 .28 .3 .38 .56 .59" fill="none" stroke="#dce7e7" strokeWidth=".13"/></>}
  {code==='bathtub'&&<><rect x=".13" y=".16" width=".74" height=".68" rx=".22" fill="#f4fdff" stroke="#88b0bd" strokeWidth=".042"/><rect x=".24" y=".26" width=".52" height=".47" rx=".19" fill="#c5e8f2"/></>}
  {code==='mirror'&&<><rect x=".16" y=".13" width=".68" height=".74" rx=".06" fill="#d2e9f3" stroke={finish} strokeWidth=".065"/><path d="M .23 .72 L .73 .23" stroke="#ffffff" strokeWidth=".04"/></>}
  {code==='printer'&&<><rect x=".2" y=".23" width=".6" height=".51" rx=".06" fill="#667d8a"/><rect x=".3" y=".16" width=".4" height=".24" fill="#f6fcff"/><path d="M .32 .61 H .68" stroke="#f1f9ff" strokeWidth=".04"/></>}
  {!isBed&&!isSeat&&!isTable&&!isScreen&&!isWhite&&!isStorage&&!isKitchen&&!isDesk&&
   code!=='sofa'&&code!=='sofa-bed'&&code!=='lamp'&&code!=='printer'&&
   code!=='plant'&&code!=='rug'&&code!=='sculpture'&&
   <path d="M .24 .28 H .76 M .24 .5 H .76 M .24 .72 H .76" stroke="#6d8498" strokeWidth=".045"/>}
 </g>;
}
export function ArchitecturalDetails({site,floor,selectedFurnitureId,furniturePreview}:{
 site:HotelSite;floor:HotelFloor;selectedFurnitureId:string|null;
 furniturePreview:{id:string;x:number;y:number}|null;
}){
 return <g className="ib-architecture-details" pointerEvents="none">
  {floor.walls.map(w=>{
   const p=wallSegment(w);
   if(w.type==='door'){
    const pair=accessDoorPair(floor,site,w);
    const direction=w.orientation==='h'?(pair.first?-1:1):(pair.first?-1:1);
    const x=w.x,y=w.y;
    const path=w.orientation==='h'?
     `M ${x} ${y} A 1 1 0 0 ${direction===1?1:0} ${x+1} ${y+direction}`:
     `M ${x} ${y} A 1 1 0 0 ${direction===1?0:1} ${x+direction} ${y+1}`;
    return <g key={w.id}>
     <line x1={p.start.x} y1={p.start.y} x2={p.end.x} y2={p.end.y}
      stroke="#20374b" strokeWidth=".20"/>
     <path d={path} fill="none" stroke="#d2f9da" strokeWidth=".045"
      strokeDasharray=".12 .06"/>
     <line x1={x} y1={y} x2={w.orientation==='h'?x:x+direction}
      y2={w.orientation==='h'?y+direction:y+1} stroke="#e8fff4" strokeWidth=".067"/>
     <circle cx={x} cy={y} r=".105" fill="#9ff0c7"/>
    </g>;
   }
   if(w.type==='window'||w.type==='panoramic-window'){
    const bright=w.type==='panoramic-window';
    return <g key={w.id}>
     <line x1={p.start.x} y1={p.start.y} x2={p.end.x} y2={p.end.y}
      stroke="#123d59" strokeWidth=".23"/>
     <line x1={p.start.x} y1={p.start.y} x2={p.end.x} y2={p.end.y}
      stroke={bright?'#a9f1ff':'#7bd2ff'} strokeWidth={bright?'.15':'.095'}/>
     <line x1={p.start.x+(w.orientation==='v'?.09:0)} y1={p.start.y+(w.orientation==='h'?.09:0)}
      x2={p.end.x+(w.orientation==='v'?.09:0)} y2={p.end.y+(w.orientation==='h'?.09:0)}
      stroke="#e5fdff" strokeWidth=".04"/>
    </g>;
   }
   return <line key={w.id} x1={p.start.x} y1={p.start.y} x2={p.end.x} y2={p.end.y}
    stroke="#f8ffff" strokeWidth=".16" strokeLinecap="square"/>;
  })}
  {floor.objects.map(item=>{
   const preview=furniturePreview?.id===item.id?{...item,...furniturePreview}:item;
   return <Furnishing key={item.id} item={preview} selected={selectedFurnitureId===item.id}/>;
  })}
 </g>;
}
