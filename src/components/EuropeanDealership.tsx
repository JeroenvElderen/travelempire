import {useMemo,useState} from 'react';
import {BRANDS,EUROPEAN_MODELS,configuredOffer,marketPrice,trimChoices,trimPricing,verifiedVariants,paintChoices,wheelChoices,type VehicleModel} from '../europeanVehicleCatalog';
import {eur,type VehicleOffer} from '../dealership';
import {DRIVER_COST} from '../simulation/taxi';
import {financeQuote,leaseQuote} from '../economy';
import './EuropeanDealership.css';

type Props={cash:number;ready:boolean;quantity:number;mode:'cash'|'finance'|'lease';depositPercent:number;termDays:number;onOrder:(offer:VehicleOffer,quantity:number,mode:'cash'|'finance'|'lease',depositPercent:number,termDays:number)=>void};
export default function EuropeanDealership({cash,ready,quantity,mode,depositPercent,termDays,onOrder}:Props){
 const [brand,setBrand]=useState('Toyota');
 const models=useMemo(()=>EUROPEAN_MODELS.filter(m=>m.brand===brand),[brand]);
 const [selected,setSelected]=useState('Toyota Corolla');
 const model:VehicleModel=models.find(m=>m.brand+' '+m.name===selected)??models[0];
 const [year,setYear]=useState(2026);
 const [trim,setTrim]=useState<string>('Base');
 const [paintId,setPaintId]=useState('');
 const [wheelId,setWheelId]=useState('');
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
 const market=marketPrice(model,year);
 const priceBreakdown=trimPricing(model,year,currentTrim);
 const offer=configuredOffer(model,year,[],currentTrim,activeVariant?.id,paint?.id,wheel?.id);
 const upfront=mode==='cash'?offer.price+DRIVER_COST:mode==='finance'?financeQuote(offer.price,depositPercent,termDays).deposit+DRIVER_COST:leaseQuote(offer.price,termDays).upfront+DRIVER_COST;
 const bonus=offer.revenueBonus??0;
 return <section className="eu-dealership">
  <header className="eu-dealer-hero"><span>TRAVELEMPIRE MOTORS · EUROPE</span><h2>Build your next vehicle</h2><p>{BRANDS.length} manufacturers · {EUROPEAN_MODELS.length} models · 2025–2026 · factory-style configuration</p></header>
  <div className="eu-dealer-grid">
   <div className="eu-dealer-controls">
    <label>Find manufacturer<input type="search" placeholder="Search brands…" value={search} onChange={e=>setSearch(e.target.value)}/></label>
    <div className="eu-brand-grid">{filteredBrands.map(b=><button key={b} type="button" className={brand===b?'selected':''} onClick={()=>{setBrand(b);setSelected('');setPaintId('');setWheelId('');setTrim('Base');setVariantId('')}}>{b}</button>)}</div>
    <div className="eu-two"><label>Model<select value={model.name} onChange={e=>{setSelected(brand+' '+e.target.value);setPaintId('');setWheelId('');setTrim('Base');setVariantId('')}}>{models.map(m=><option key={m.name} value={m.name}>{m.name}</option>)}</select></label><label>Model year<select value={year} onChange={e=>{setYear(Number(e.target.value));setTrim('Base');setPaintId('');setWheelId('');setVariantId('')}}><option value={2025}>2025</option><option value={2026}>2026</option></select></label></div>
    <label>Equipment grade<select value={currentTrim} onChange={e=>{setTrim(e.target.value);setVariantId('')}}>{choices.map((choice,index)=><option key={choice} value={choice}>{choice} · {variants.length?'Published variant · upgrades estimated':index===0?'Included':index===1?'+6% estimated price · +5% revenue':'+12% estimated price · +10% revenue'}</option>)}</select></label>
    {availableVariants.length>0&&<label>Verified engine and transmission<select value={activeVariant?.id??''} onChange={e=>setVariantId(e.target.value)}>{availableVariants.map(v=><option key={v.id} value={v.id}>{v.engine} · {v.powerHp?v.powerHp+' hp · ':''}{v.transmission} · {eur(v.price)}</option>)}</select></label>}
    <label>Exterior colour<select value={paint?.id??''} onChange={e=>setPaintId(e.target.value)}>{paints.map(p=><option key={p.id} value={p.id}>{p.name} · {p.price?'+':' '}{eur(p.price)}</option>)}</select></label>
    <label>Wheels<select value={wheel?.id??''} onChange={e=>setWheelId(e.target.value)}>{wheels.map(w=><option key={w.id} value={w.id}>{w.name} · {w.price?'+':' '}{eur(w.price)}</option>)}</select></label>
    <p className="eu-source-note">Colour and wheel upgrade prices are game estimates unless confirmed in a manufacturer price guide. Grade equipment and packages are included in the selected variant.</p>
   </div>
   <aside className="eu-config-summary">
    <div className="eu-vehicle-stage"><div className="eu-car-symbol" aria-hidden="true">🚘</div><small>{model.segment} · {activeVariant?.fuel??model.fuel} · {model.seats} passenger seats</small></div>
    <h3>{year} {model.brand} {model.name}</h3><p>{currentTrim} grade · {paint?.name??'Standard paint'} · {wheel?.name??'Standard wheels'}</p>
    <div className="eu-price-line"><span>Base vehicle</span><strong>{eur(activeVariant?.price??priceBreakdown.base)}</strong></div>
    <div className="eu-price-line"><span>Trim</span><strong>{eur(activeVariant?0:priceBreakdown.cost)}</strong></div>
    <div className="eu-price-line"><span>Colour</span><strong>{eur(paint?.price??0)}</strong></div>
    <div className="eu-price-line"><span>Wheels</span><strong>{eur(wheel?.price??0)}</strong></div>
    {!activeVariant&&market?<p className="eu-source-note">Published {market.market} starting price ({market.year}): <a href={market.source} target="_blank" rel="noopener noreferrer">{eur(market.from)} · manufacturer source</a>. {market.note}. Higher trim and option prices are game estimates.</p>:!activeVariant?<p className="eu-source-note">Starting price and options are in-game estimates; no manufacturer quote has been verified for this model and year.</p>:null}
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
