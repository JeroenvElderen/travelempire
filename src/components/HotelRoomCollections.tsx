import {useMemo,useState} from 'react';
import {BedDouble,Check,CheckCircle2,Info,Layers3,Paintbrush,ShieldAlert,ShoppingCart} from 'lucide-react';
import type {HotelFloor,HotelSite,Room} from '../internalConstruction';
import {euros,furnitureSize} from '../internalConstruction';
import {
 COLLECTION_STYLES,ROOM_COLLECTIONS,curatedCollectionPieces,
 planRoomFurnitureCollection,furnitureCollectionFor,
 type CollectionMode,type CollectionPlan,
} from '../hotelFurnitureCollections';
import {furnitureFinishColor,FURNITURE_STYLES} from '../furnitureCatalog';
import type {FurnitureStyle} from '../furnitureCatalog';
import './hotel-room-collections.css';

type Props={
 site:HotelSite;floor:HotelFloor;roomId:string|null;disabled:boolean;
 onRoomSelect:(roomId:string)=>void;
 onApply:(roomId:string,style:FurnitureStyle,mode:CollectionMode)=>void;
};
const THEME_DESCRIPTION:Record<FurnitureStyle,string>={
 modern:'Clean lines and understated surfaces',
 mediterranean:'Warm oak and relaxed coastal details',
 scandinavian:'Soft ivory, minimal and functional',
 luxury:'Marble finishes with premium furnishings',
 industrial:'Walnut, bold and urban interiors',
 classic:'Timeless warm furniture and finishes',
};
function floorItemInside(room:Room,x:number,y:number,width:number,height:number){
 return x>=room.x&&y>=room.y&&x+width<=room.x+room.width&&y+height<=room.y+room.height;
}
export default function HotelRoomCollections({
 site,floor,roomId,disabled,onRoomSelect,onApply,
}:Props){
 const [style,setStyle]=useState<FurnitureStyle>('mediterranean');
 const [mode,setMode]=useState<CollectionMode>('fill');
 const [replaceConfirmed,setReplaceConfirmed]=useState(false);
 const [showItems,setShowItems]=useState(true);
 const rooms=floor.rooms.filter(r=>furnitureCollectionFor(r.type));
 const room=rooms.find(r=>r.id===roomId)??rooms[0]??null;
 const recipe=room?furnitureCollectionFor(room.type):null;
 const result=useMemo(()=>{
  if(!room)return {plan:null as CollectionPlan|null,error:'Draw or select a guest room, bathroom, lobby, office, restaurant or kitchen first.'};
  try{
   return {plan:planRoomFurnitureCollection(floor,site,room.id,style,mode),error:''};
  }catch(err){
   return {plan:null as CollectionPlan|null,error:err instanceof Error?err.message:'Unable to fit the collection.'};
  }
 },[floor,site,room,style,mode]);
 const planned=result.plan;
 const pieces=useMemo(()=>room?curatedCollectionPieces(room.type,style):[],
  [room,style]);
 const oldPieces=room?floor.objects.filter(obj=>{
  const size=furnitureSize(obj);
  return floorItemInside(room,obj.x,obj.y,size.width,size.height);
 }):[];
 const allShown=planned&&room?planned.floor.objects.filter(obj=>{
  const size=furnitureSize(obj);
  return floorItemInside(room,obj.x,obj.y,size.width,size.height);
 }):[];
 const roomsLabel=room?room.name:'No room selected';
 const totalNew=planned?.added.length??0;
 const canApply=!disabled&&!!planned&&(totalNew>0||planned!.removed.length>0)&&
  (mode!=='replace'||oldPieces.length===0||replaceConfirmed);
 return <section className="ib-room-collections" aria-label="Complete furniture collections">
  <div className="ib-collection-header">
   <div><strong><Layers3 size={17}/> Complete room collections</strong>
    <small>One-tap furnishing sets · 6 interior themes · 6 room types</small></div>
   <span className="ib-collection-kicker">New</span>
  </div>
  <div className="ib-collection-choose">
   <label>Choose room<select aria-label="Room to furnish" value={room?.id??''}
    disabled={disabled||!rooms.length}
    onChange={e=>{onRoomSelect(e.target.value);setReplaceConfirmed(false);}}>
    {!rooms.length&&<option value="">Draw a room first</option>}
    {rooms.map(item=><option key={item.id} value={item.id}>{item.name} · {item.width}×{item.height} m</option>)}
   </select></label>
   <div className="ib-collection-room-label"><BedDouble size={16}/>
    {recipe?<span><b>{recipe.name}</b><small>{recipe.description}</small></span>:
     <small>Collections are available for six furnished room types.</small>}</div>
  </div>
  <div className="ib-collection-choose-style"><strong>Interior style</strong>
   <div className="ib-collection-themes" role="group" aria-label="Collection interior style">
    {COLLECTION_STYLES.map(name=>{
     const colour=furnitureFinishColor(name==='luxury'?'marble':
      name==='scandinavian'?'ivory':name==='modern'?'charcoal':
      name==='industrial'||name==='classic'?'walnut':'oak');
     return <button type="button" key={name} className={style===name?'selected':''}
      aria-pressed={style===name} disabled={disabled||!room}
      onClick={()=>{setStyle(name);setReplaceConfirmed(false);}}>
      <span className="ib-collection-theme-dot" style={{background:colour}}/>
      {FURNITURE_STYLES.find(v=>v.id===name)?.label??name}
      {style===name&&<Check size={13}/>}
     </button>;
    })}
   </div>
   <small>{THEME_DESCRIPTION[style]}</small>
  </div>
  <div className="ib-collection-actions-mode">
   <label><input type="radio" name="collection-fill-mode" value="fill" checked={mode==='fill'}
    disabled={disabled} onChange={()=>{setMode('fill');setReplaceConfirmed(false);}}/>
    <span><strong>Fill missing pieces</strong><small>Keep all existing furniture</small></span></label>
   <label><input type="radio" name="collection-fill-mode" value="replace" checked={mode==='replace'}
    disabled={disabled} onChange={()=>{setMode('replace');setReplaceConfirmed(false);}}/>
    <span><strong>Replace room furniture</strong><small>Only this room; no refund for removed pieces</small></span></label>
  </div>
  {room&&<div className="ib-collection-preview">
   <div className="ib-collection-preview-head">
    <strong>Room layout preview</strong><small>{room.width}×{room.height} m · 1 m grid</small>
   </div>
   <svg role="img" aria-label={'Suggested furniture layout for '+roomsLabel}
    viewBox={`${room.x-0.25} ${room.y-0.25} ${room.width+0.5} ${room.height+0.5}`}
    preserveAspectRatio="xMidYMid meet">
    <rect x={room.x} y={room.y} width={room.width} height={room.height}
     fill="#253b53" stroke="#b2c4d9" strokeWidth=".09"/>
    {Array.from({length:room.width-1},(_,i)=><line key={'v'+i} x1={room.x+i+1}
     x2={room.x+i+1} y1={room.y} y2={room.y+room.height}
     stroke="#6e8298" strokeWidth=".018" opacity=".5"/>)}
    {Array.from({length:room.height-1},(_,i)=><line key={'h'+i}
     x1={room.x} x2={room.x+room.width} y1={room.y+i+1} y2={room.y+i+1}
     stroke="#6e8298" strokeWidth=".018" opacity=".5"/>)}
    {allShown.map(obj=>{
     const legacy=oldPieces.some(o=>o.id===obj.id);
     const {width:w,height:h}=furnitureSize(obj);
     return <g key={obj.id}>
      <rect x={obj.x+.04} y={obj.y+.04} width={w-.08} height={h-.08}
       rx=".08" fill={obj.finish?furnitureFinishColor(obj.finish):'#b3bdc8'}
       stroke={legacy?'#c3cbdb':'#dff6ff'}
       strokeWidth=".065" strokeDasharray={legacy?'.18 .07':undefined}/>
      <text x={obj.x+w/2} y={obj.y+h/2+.13} fontSize=".32" textAnchor="middle"
       fontWeight="700" fill="#172b3c">{obj.code.slice(0,8)}</text>
     </g>;
    })}
    {result.error&&<text x={room.x+room.width/2} y={room.y+room.height/2}
     fontSize=".46" textAnchor="middle" fill="#ffcfb1">No valid layout</text>}
   </svg>
   <div className="ib-collection-preview-key"><span><i className="new"/>New items</span>
    <span><i className="kept"/>Kept furniture</span></div>
  </div>}
  <div className="ib-collection-items">
   <button type="button" className="ib-collection-expand" onClick={()=>setShowItems(v=>!v)}
    aria-expanded={showItems}>
    <strong>Included furniture ({pieces.length})</strong><span>{showItems?'Hide':'Show'} details</span>
   </button>
   {showItems&&<div className="ib-collection-items-grid">
    {pieces.map((piece,i)=><div key={piece.code+i} className="ib-collection-item">
     <CheckCircle2 size={14}/><span><b>{piece.model.name}</b>
      <small>{piece.model.width}×{piece.model.height} m · {euros(piece.model.priceCents)}</small></span>
     </div>)}
   </div>}
  </div>
  <div className="ib-collection-total">
   <div><small>Estimated new furniture</small><strong>{planned?euros(planned.furnitureCents):'—'}</strong>
    <span>{planned?`${totalNew} new pieces · ${planned.keptExisting} existing retained`:
     'Room does not fit the whole collection'}</span></div>
   <ShoppingCart size={22}/>
  </div>
  {mode==='replace'&&oldPieces.length>0&&<label className="ib-collection-confirm">
   <input type="checkbox" checked={replaceConfirmed} disabled={disabled}
    onChange={e=>setReplaceConfirmed(e.target.checked)}/>
   <span>I understand that {oldPieces.length} existing furnishings in this room will be removed from the draft without a refund.</span>
  </label>}
  {result.error&&<p className="ib-collection-error"><ShieldAlert size={16}/>{result.error}</p>}
  {planned&&planned.added.length===0&&planned.removed.length===0&&
   <p className="ib-collection-info"><Info size={15}/> This room already contains every furniture category in the selected collection.</p>}
  <button type="button" className="ib-collection-apply" disabled={!canApply}
   onClick={()=>room&&onApply(room.id,style,mode)}>
   <Paintbrush size={17}/> {mode==='replace'?'Replace with complete collection':'Furnish this room'}
  </button>
  <small className="ib-collection-footer">This only changes the draft of the selected room. It is fully undoable; final contractor costs, materials and timing are calculated when construction is approved.</small>
 </section>;
}
