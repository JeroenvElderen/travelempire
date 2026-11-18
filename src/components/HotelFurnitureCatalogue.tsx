import {useMemo,useState} from 'react';
import {Archive,Bath,BedDouble,BriefcaseBusiness,Check,ChevronDown,Flower2,
 Heart,Lamp,Search,SlidersHorizontal,Sofa,UtensilsCrossed,ChefHat,RotateCw,
 Star,Package,ArrowUpDown} from 'lucide-react';
import type {FurnitureProduct,FurnitureCategory,FurnitureStyle,FurnitureFinish} from '../furnitureCatalog';
import {FURNITURE_CATEGORIES,FURNITURE_FINISHES,FURNITURE_STYLES,
 furnitureFinishColor,furnitureIsCompatible} from '../furnitureCatalog';
import type {RoomType} from '../internalConstruction';
import {euros} from '../internalConstruction';

const ICONS={
 bedroom:BedDouble,bathroom:Bath,lounge:Sofa,kitchen:ChefHat,
 dining:UtensilsCrossed,office:BriefcaseBusiness,lighting:Lamp,
 decor:Flower2,storage:Archive,
} as const;
type FilterCategory=FurnitureCategory|'all'|'favourites'|'recent';
type SortOrder='featured'|'price-low'|'price-high'|'name';
const PAGE_SIZE=24;
/** Compact geometric SKU preview; the SVG plan and cutaway use the same finish
 * colour, and existing save data stores only model ID and colour finish.
 */
export function FurnitureTilePreview({product,finish}:{product:FurnitureProduct;finish:string}){
 const Icon=ICONS[product.category],tone=furnitureFinishColor(finish);
 return <div className="ib-furn-tile-preview">
  <svg viewBox="0 0 88 63" aria-hidden="true" focusable="false">
   <rect x="12" y="7" width="64" height="50" rx="8" fill="#263d54" stroke="#7991a3" strokeWidth="1.4"/>
   <rect x="20" y="13" width="48" height="39" rx="6" fill={tone} stroke="#e8e7de" strokeWidth="1.4"/>
   {product.category==='bedroom'&&<><rect x="26" y="17" width="36" height="31" rx="5" fill="#eee2ce" stroke="#fff7e7"/><rect x="28" y="19" width="14" height="9" rx="3" fill="#fff"/><rect x="46" y="19" width="14" height="9" rx="3" fill="#fff"/><path d="M27 33H61" stroke={tone} strokeWidth="2"/></>}
   {product.category==='bathroom'&&<><rect x="25" y="19" width="38" height="26" rx="10" fill="#e2f5fa" stroke="#819fac"/><ellipse cx="44" cy="31" rx="14" ry="8" fill="#fff"/></>}
   {product.category==='lounge'&&<><rect x="25" y="18" width="38" height="30" rx="7" fill={tone} stroke="#dee9ec"/><rect x="29" y="29" width="30" height="15" rx="5" fill="#9ab7ba"/><path d="M44 29V44" stroke="#607c87"/></>}
   {product.category==='dining'&&<><rect x="27" y="19" width="34" height="23" rx="4" fill="#c0a181" stroke="#fce8cf"/><circle cx="24" cy="30" r="4" fill="#d9e5ee"/><circle cx="64" cy="30" r="4" fill="#d9e5ee"/></>}
   {product.category==='office'&&<><rect x="25" y="21" width="38" height="16" rx="3" fill="#b48f6a" stroke="#fce8cf"/><path d="M29 38V46M59 38V46" stroke="#e2d2ba" strokeWidth="3"/></>}
   {product.category==='lighting'&&<><circle cx="44" cy="28" r="15" fill="#ffe0a5" stroke="#fff8dd" strokeWidth="3"/><circle cx="44" cy="28" r="7" fill="#fff9de"/></>}
   {product.category==='decor'&&<><circle cx="44" cy="25" r="11" fill="#91b69a"/><circle cx="34" cy="32" r="8" fill="#78a38c"/><circle cx="53" cy="34" r="8" fill="#7da587"/><rect x="37" y="39" width="14" height="11" rx="2" fill="#a8755b"/></>}
   {(product.category==='storage'||product.category==='kitchen')&&<><rect x="27" y="17" width="34" height="31" rx="3" fill={tone} stroke="#eef2f5"/><path d="M44 18V47M29 33H59" stroke="#e9e6dc" strokeWidth="1.6"/></>}
  </svg>
  <Icon size={14} aria-hidden="true"/>
 </div>;
}
type Props={
 products:readonly FurnitureProduct[];selectedId:string;finish:FurnitureFinish;
 onSelect:(product:FurnitureProduct)=>void;onFinish:(finish:FurnitureFinish)=>void;
 selectedRoomType:RoomType|null;disabled:boolean;
};
/** Stays mounted while a room is being furnished; mobile scrolling, filters,
 * favourites and recents never modify hotel or game storage.
 */
export default function HotelFurnitureCatalogue({products,selectedId,finish,onSelect,onFinish,
 selectedRoomType,disabled}:Props){
 const [category,setCategory]=useState<FilterCategory>('all');
 const [query,setQuery]=useState('');
 const [style,setStyle]=useState<FurnitureStyle|'all'>('all');
 const [sort,setSort]=useState<SortOrder>('featured');
 const [compatibleOnly,setCompatibleOnly]=useState(true);
 const [maxPrice,setMaxPrice]=useState('all');
 const [expanded,setExpanded]=useState(false);
 const [favourites,setFavourites]=useState<string[]>([]);
 const [recent,setRecent]=useState<string[]>([]);
 const filtered=useMemo(()=>{
  const term=query.trim().toLowerCase(),fav=new Set(favourites);
  const recents=new Set(recent);
  const results=products.filter(item=>{
   if(category==='favourites'&&!fav.has(item.id))return false;
   if(category==='recent'&&!recents.has(item.id))return false;
   if(category!=='all'&&category!=='favourites'&&category!=='recent'&&item.category!==category)return false;
   if(style!=='all'&&item.style!==style)return false;
   if(compatibleOnly&&selectedRoomType&&!furnitureIsCompatible(item,selectedRoomType))return false;
   if(maxPrice!=='all'&&item.priceCents>Number(maxPrice))return false;
   if(term&&!([item.name,item.modelLabel,item.code,item.style,item.tier]
    .join(' ').toLowerCase().includes(term)))return false;
   return true;
  });
  if(sort==='price-low')results.sort((a,b)=>a.priceCents-b.priceCents);
  if(sort==='price-high')results.sort((a,b)=>b.priceCents-a.priceCents);
  if(sort==='name')results.sort((a,b)=>a.name.localeCompare(b.name));
  if(category==='recent'&&sort==='featured')results.sort((a,b)=>recents.has(a.id)&&recents.has(b.id)?
   recent.indexOf(a.id)-recent.indexOf(b.id):0);
  return results;
 },[products,category,query,style,sort,compatibleOnly,selectedRoomType,maxPrice,favourites,recent]);
 const selected=products.find(p=>p.id===selectedId)??products[0];
 const changeCategory=(value:FilterCategory)=>{setCategory(value);setExpanded(false);};
 return <section className="ib-furn-catalog" aria-label="Hotel furniture catalogue">
  <div className="ib-furn-catalog-head">
   <div><strong><Sofa size={17}/> Furniture &amp; interiors</strong>
    <small>{products.length} model choices · {new Set(products.map(p=>p.code)).size} furniture families · 6 styles</small></div>
   {selectedRoomType&&<span className="ib-furn-room-filter">{selectedRoomType.replaceAll('-',' ')} room</span>}
  </div>
  <div className="ib-furn-search"><Search size={17}/>
   <input type="search" aria-label="Search furniture" placeholder="Search beds, baths, sofas, décor…"
    value={query} onChange={e=>{setQuery(e.target.value);setExpanded(false);}}/>
   {query&&<button type="button" aria-label="Clear furniture search" onClick={()=>setQuery('')}>×</button>}
  </div>
  <div className="ib-furn-categories" role="group" aria-label="Furniture categories">
   <button type="button" className={category==='all'?'selected':''} onClick={()=>changeCategory('all')}><Package size={15}/> All</button>
   {FURNITURE_CATEGORIES.map(item=>{
    const Icon=ICONS[item.id];
    return <button type="button" key={item.id} className={category===item.id?'selected':''}
     onClick={()=>changeCategory(item.id)}><Icon size={15}/>{item.label}</button>;
   })}
   <button type="button" className={category==='favourites'?'selected':''}
    onClick={()=>changeCategory('favourites')}><Heart size={15}/> Saved ({favourites.length})</button>
   <button type="button" className={category==='recent'?'selected':''}
    onClick={()=>changeCategory('recent')}><Star size={15}/> Recent</button>
  </div>
  <div className="ib-furn-filters">
   <label><span>Design style</span><select aria-label="Filter furniture style" value={style}
    onChange={e=>{setStyle(e.target.value as FurnitureStyle|'all');setExpanded(false);}}>
    <option value="all">All styles</option>
    {FURNITURE_STYLES.map(item=><option value={item.id} key={item.id}>{item.label}</option>)}
   </select></label>
   <label><span>Budget</span><select aria-label="Furniture price ceiling" value={maxPrice}
    onChange={e=>{setMaxPrice(e.target.value);setExpanded(false);}}>
    <option value="all">Any price</option>
    <option value="50000">Up to €500</option>
    <option value="150000">Up to €1,500</option>
    <option value="300000">Up to €3,000</option>
   </select></label>
   <label><span>Order by</span><select aria-label="Sort furniture" value={sort}
    onChange={e=>setSort(e.target.value as SortOrder)}>
    <option value="featured">Recommended</option>
    <option value="price-low">Lowest price</option>
    <option value="price-high">Highest price</option>
    <option value="name">A–Z</option>
   </select></label>
  </div>
  <div className="ib-furn-filter-bottom">
   <label><input type="checkbox" checked={compatibleOnly} onChange={e=>setCompatibleOnly(e.target.checked)}/>
    Match selected room</label>
   <span><SlidersHorizontal size={13}/>{filtered.length} matching designs</span>
  </div>
  {selected&&<div className="ib-furn-current"><div>
   <strong>Selected: {selected.name}</strong><small>{selected.width} × {selected.height} m · {euros(selected.priceCents)} · {selected.style}</small>
   </div><span><Check size={14}/> Ready to place</span></div>}
  <div className="ib-furn-product-grid">
   {filtered.slice(0,expanded?filtered.length:PAGE_SIZE).map(item=>{
    const picked=selectedId===item.id;
    const compatible=!selectedRoomType||furnitureIsCompatible(item,selectedRoomType);
    const favorite=favourites.includes(item.id);
    return <article className={picked?'ib-furn-product selected':'ib-furn-product'} key={item.id}>
     <button type="button" className="ib-furn-favorite" aria-label={(favorite?'Remove favourite ':'Save favourite ')+item.name}
      aria-pressed={favorite} onClick={()=>setFavourites(old=>favorite?old.filter(v=>v!==item.id):[...old,item.id])}>
      <Heart size={15} fill={favorite?'currentColor':'none'}/></button>
     <button type="button" className="ib-furn-pick" disabled={disabled||!compatible}
      aria-pressed={picked} onClick={()=>{onSelect(item);setRecent(old=>[item.id,...old.filter(v=>v!==item.id)].slice(0,14));}}>
      <FurnitureTilePreview product={item} finish={finish}/>
      <div className="ib-furn-product-title"><strong>{item.name}</strong><small>{item.style} · {item.tier}</small></div>
      <div className="ib-furn-product-meta"><span>{item.width} × {item.height} m</span><strong>{euros(item.priceCents)}</strong></div>
      {picked&&<span className="ib-furn-pick-badge"><Check size={13}/> Selected</span>}
      {!compatible&&<span className="ib-furn-incompatible">Not for this room</span>}
     </button>
    </article>;
   })}
  </div>
  {filtered.length===0&&<div className="ib-furn-no-results"><Search size={24}/><strong>No matching furniture</strong><small>Try a different category, style or price range.</small><button type="button" className="ib-secondary" onClick={()=>{setCategory('all');setStyle('all');setMaxPrice('all');setQuery('');setCompatibleOnly(false);}}>Reset filters</button></div>}
  {!expanded&&filtered.length>PAGE_SIZE&&<button type="button" className="ib-furn-more" onClick={()=>setExpanded(true)}>
   Show all {filtered.length} designs <ChevronDown size={16}/></button>}
  <div className="ib-furn-finish-panel"><div><strong>Finish &amp; material</strong><small>Applied to the furniture you place next</small></div>
   <div role="group" aria-label="Furniture finish">
    {FURNITURE_FINISHES.map(item=><button type="button" key={item.id}
     className={finish===item.id?'selected':''} title={item.label}
     aria-label={'Choose '+item.label} aria-pressed={finish===item.id}
     onClick={()=>onFinish(item.id)}><span style={{background:item.color}}/>{item.label}</button>)}
   </div>
  </div>
  <p className="ib-furn-catalog-footnote"><RotateCw size={13}/> Choose a design, then tap the 2D floor plan to place it. Existing furniture can be moved, rotated or restyled in Inspect mode. Purchases are charged when construction is approved.</p>
 </section>;
}
