import {useMemo,useState} from 'react';
import {BRANDS,EUROPEAN_MODELS,configuredOffer,marketPrice,trimChoices,trimPricing,verifiedVariants,paintChoices,wheelChoices,individualOptions,type VehicleModel} from '../europeanVehicleCatalog';
import {eur,type VehicleOffer} from '../dealership';
import {DRIVER_COST} from '../simulation/taxi';
import {financeQuote,leaseQuote} from '../economy';
import './EuropeanDealership.css';

type Props={cash:number;ready:boolean;quantity:number;mode:'cash'|'finance'|'lease';depositPercent:number;termDays:number;onOrder:(offer:VehicleOffer,quantity:number,mode:'cash'|'finance'|'lease',depositPercent:number,termDays:number)=>void};
export default function EuropeanDealership({cash,ready,quantity,mode,depositPercent,termDays,onOrder}:Props){
 const [brand,setBrand]=useState('Toyota');
 const models=useMemo(()=>EUROPEAN_MODELS.filter(m=>m.brand===brand),[brand]);
 const [selected,setSelected]=useState('Toyota Corolla Saloon');
 const model:VehicleModel=models.find(m=>m.brand+' '+m.name===selected)??models[0];
 const [selectedYear,setYear]=useState(2026);
 const year=model.years.includes(selectedYear)?selectedYear:model.years[0];
 const [trim,setTrim]=useState<string>('Base');
 const [paintId,setPaintId]=useState('');
 const [wheelId,setWheelId]=useState('');
 const [selectedExtras,setSelectedExtras]=useState<string[]>([]);
 const [variantId,setVariantId]=useState('');
 const [search,setSearch]=useState('');
 const filteredBrands=BRANDS.filter(b=>b.toLowerCase().includes(search.toLowerCase()));
 const choices=trimChoices(model,year);
 const currentTrim=choices.includes(trim)?trim:choices[0];
 const variants=verifiedVariants(model,year);
 const availableVariants=variants.filter(v=>v.trim===currentTrim);
 const activeVariant=availableVariants.find(v=>v.id===variantId)??availableVariants[0];
 const paints=paintChoices(model,year,currentTrim);
 const wheels=wheelChoices(model,year,currentTrim,activeVariant?.id);
 const paint=paints.find(p=>p.id===paintId)??paints[0];
 const wheel=wheels.find(w=>w.id===wheelId)??wheels[0];
 const extras=individualOptions(model,year,currentTrim);
 const extraIds=selectedExtras.filter(id=>extras.some(o=>o.id===id&&!o.included));
 const extraTotal=extras.filter(o=>extraIds.includes(o.id)).reduce((n,o)=>n+o.price,0);
 const market=marketPrice(model,year);
 const priceBreakdown=trimPricing(model,year,currentTrim);
 const offer=configuredOffer(model,year,extraIds,currentTrim,activeVariant?.id,paint?.id,wheel?.id);
 const upfront=mode==='cash'?offer.price+DRIVER_COST:mode==='finance'?financeQuote(offer.price,depositPercent,termDays).deposit+DRIVER_COST:leaseQuote(offer.price,termDays).upfront+DRIVER_COST;
 const bonus=offer.revenueBonus??0;
 return <section className="eu-dealership">
  <header className="eu-dealer-hero"><span>TRAVELEMPIRE MOTORS · EUROPE</span><h2>Build your next vehicle</h2><p>{BRANDS.length} manufacturers · {EUROPEAN_MODELS.length} models · brochure-based · factory-style configuration</p></header>
  <div className="eu-dealer-grid">
   <div className="eu-dealer-controls">
    <label>Find manufacturer<input type="search" placeholder="Search brands…" value={search} onChange={e=>setSearch(e.target.value)}/></label>
    <div className="eu-brand-grid">{filteredBrands.map(b=><button key={b} type="button" className={brand===b?'selected':''} onClick={()=>{setBrand(b);setSelected('');setYear(EUROPEAN_MODELS.find(m=>m.brand===b)?.years[0]??2026);setPaintId('');setWheelId('');setSelectedExtras([]);setTrim('Base');setVariantId('')}}>{b}</button>)}</div>
    <div className="eu-two"><label>Model<select value={model.name} onChange={e=>{setSelected(brand+' '+e.target.value);setYear(models.find(m=>m.name===e.target.value)?.years[0]??2026);setSelectedExtras([]);setPaintId('');setWheelId('');setTrim('Base');setVariantId('')}}>{models.map(m=><option key={m.name} value={m.name}>{m.name}</option>)}</select></label><label>Model year<select value={year} onChange={e=>{setYear(Number(e.target.value));setTrim('Base');setPaintId('');setWheelId('');setSelectedExtras([]);setVariantId('')}}>{model.years.map(y=><option key={y} value={y}>{y}</option>)}</select></label></div>
    <label>Equipment grade<select value={currentTrim} onChange={e=>{setTrim(e.target.value);setVariantId('');setSelectedExtras([])}}>{choices.map((choice,index)=><option key={choice} value={choice}>{choice} · {variants.length?'Published variant · upgrades estimated':index===0?'Included':index===1?'+6% estimated price · +5% revenue':'+12% estimated price · +10% revenue'}</option>)}</select></label>
    {availableVariants.length>0&&<label>Verified engine and transmission<select value={activeVariant?.id??''} onChange={e=>setVariantId(e.target.value)}>{availableVariants.map(v=><option key={v.id} value={v.id}>{v.engine} · {v.powerHp?v.powerHp+' hp · ':''}{v.transmission} · {eur(v.price)}</option>)}</select></label>}
    <label>Exterior colour<select value={paint?.id??''} onChange={e=>setPaintId(e.target.value)}>{paints.map(p=><option key={p.id} value={p.id}>{p.name} · {p.price?'+':' '}{eur(p.price)}</option>)}</select></label>
    <label>Wheels<select value={wheel?.id??''} onChange={e=>setWheelId(e.target.value)}>{wheels.map(w=><option key={w.id} value={w.id}>{w.name} · {w.price?'+':' '}{eur(w.price)}</option>)}</select></label>
    <fieldset><legend>Individual equipment</legend>
      <p className="eu-source-note">Only optional equipment is shown. Features already included in the selected grade are hidden. Prices are TravelEmpire estimates; real-world retrofit availability is not guaranteed.</p>
      {(['Safety','Comfort','Technology','Exterior','Interior','Wheels'] as const).map(group=>{
       const categoryExtras=extras.filter(o=>o.group===group&&!o.included);
       const selectedCount=categoryExtras.filter(o=>extraIds.includes(o.id)).length;
       if(categoryExtras.length===0)return null;
       return <details key={group} className="eu-equipment-category" style={{marginTop:'10px',border:'1px solid var(--border, #d5dbe3)',borderRadius:'8px',padding:'10px 12px'}}>
        <summary style={{cursor:'pointer',fontWeight:600}}>{group} · {selectedCount} selected · {categoryExtras.length} options</summary>
        <div className="eu-options" style={{marginTop:'10px'}}>{categoryExtras.map(o=>{
         const selected=o.included||extraIds.includes(o.id);
         return <button key={o.id} type="button" aria-pressed={selected} disabled={o.included}
          onClick={()=>setSelectedExtras(old=>old.includes(o.id)?old.filter(id=>id!==o.id):[...old,o.id])}
          style={{display:'flex',width:'100%',alignItems:'center',justifyContent:'space-between',gap:'12px',textAlign:'left',padding:'12px',marginBottom:'8px',borderRadius:'10px',border:selected?'2px solid #22a35a':'1px solid var(--border, #cbd5e1)',background:selected?'rgba(34,163,90,0.08)':'transparent',color:'inherit',cursor:o.included?'default':'pointer',opacity:1}}>
          <span style={{display:'flex',flexDirection:'column',gap:'3px'}}><strong>{o.label}</strong><small>{o.included?'Included in '+currentTrim:'+'+eur(o.price)}</small></span>
          {selected&&<span aria-hidden="true" style={{color:'#22a35a',fontWeight:700,fontSize:'12px'}}>{o.included?'Included':'Selected'}</span>}
         </button>;
        })}</div>
       </details>;
      })}
    </fieldset>

   </div>
   <aside className="eu-config-summary">
    <div className="eu-vehicle-stage"><div className="eu-car-symbol" aria-hidden="true">🚘</div><small>{model.segment} · {activeVariant?.fuel??model.fuel} · {model.seats} passenger seats</small></div>
    <h3>{year} {model.brand} {model.name}</h3><p>{currentTrim} grade · {paint?.name??'Standard paint'} · {wheel?.name??'Standard wheels'}</p>
    <div className="eu-price-line"><span>Base vehicle</span><strong>{eur(activeVariant?.price??priceBreakdown.base)}</strong></div>
    <div className="eu-price-line"><span>Trim</span><strong>{eur(activeVariant?0:priceBreakdown.cost)}</strong></div>
    <div className="eu-price-line"><span>Colour</span><strong>{eur(paint?.price??0)}</strong></div>
    <div className="eu-price-line"><span>Wheels</span><strong>{eur(wheel?.price??0)}</strong></div>
    {!activeVariant&&market?<p className="eu-source-note">Published {market.market} starting price ({market.year}): <a href={market.source} target="_blank" rel="noopener noreferrer">{eur(market.from)} · manufacturer source</a>. {market.note}. Higher trim and option prices are game estimates.</p>:!activeVariant?<p className="eu-source-note">Starting price and options are in-game estimates; no manufacturer quote has been verified for this model and year.</p>:null}
    <div className="eu-price-line"><span>Individual equipment</span><strong>{eur(extraTotal)}</strong></div>
    <div className="eu-price-total"><span>Configured price</span><strong>{eur(offer.price)}</strong></div>
    <div className="eu-revenue"><strong>+{bonus}% fare revenue</strong><span>Example €25 fare → €{(25*(1+bonus/100)).toFixed(2)}</span><small>Applied to completed passenger fares. Game balance values, not real-world pricing.</small></div>
    <div className="eu-price-line"><span>Estimated energy cost / 100 km</span><strong>{eur((activeVariant?.fuel??model.fuel)==='Electric'?18*.32:(activeVariant?.fuel??model.fuel)==='Hybrid'?4.6*1.85:(activeVariant?.fuel??model.fuel)==='Diesel'?5.8*1.75:8*1.85)}</strong></div>
    <div className="eu-price-line"><span>Order quantity</span><strong>{quantity}</strong></div>
    <div className="eu-price-total"><span>Due at checkout incl. drivers</span><strong>{eur(upfront*quantity)}</strong></div>
    <button className="eu-order" disabled={!ready||upfront*quantity>cash||(mode==='finance'&&quantity>2)} onClick={()=>onOrder(offer,quantity,mode,depositPercent,termDays)}>Order {quantity} configured {quantity===1?'vehicle':'vehicles'}</button>
    <small className="eu-disclaimer">Curated European-market-inspired game catalogue. Selected 2026 models have published manufacturer variant prices; other 2026 references may be undated live starting prices. All remaining prices and factory upgrades are gameplay estimates. Model-year availability and equipment compatibility are not fully manufacturer-verified. Petrol, diesel, hybrid and electric vehicles now use separate simplified energy-consumption and operating-cost profiles; model-specific WLTP data and charging infrastructure are not yet implemented.</small>
   </aside>
  </div>
 </section>;
}
