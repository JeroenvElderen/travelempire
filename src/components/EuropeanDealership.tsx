import {useMemo,useState} from 'react';
import {BRANDS,EUROPEAN_MODELS,compatibleOptions,configuredOffer,type VehicleModel} from '../europeanVehicleCatalog';
import {eur,type VehicleOffer} from '../dealership';
import {DRIVER_COST} from '../simulation/taxi';
import {financeQuote,leaseQuote} from '../economy';
import './EuropeanDealership.css';

type Props={cash:number;ready:boolean;quantity:number;mode:'cash'|'finance'|'lease';depositPercent:number;termDays:number;onOrder:(offer:VehicleOffer,quantity:number,mode:'cash'|'finance'|'lease',depositPercent:number,termDays:number)=>void};
const groups=['Exterior','Wheels','Interior','Comfort','Technology','Safety'] as const;
export default function EuropeanDealership({cash,ready,quantity,mode,depositPercent,termDays,onOrder}:Props){
 const [brand,setBrand]=useState('Toyota');
 const models=useMemo(()=>EUROPEAN_MODELS.filter(m=>m.brand===brand),[brand]);
 const [selected,setSelected]=useState('Toyota Corolla');
 const model:VehicleModel=models.find(m=>m.brand+' '+m.name===selected)??models[0];
 const [year,setYear]=useState(2026);
 const [trim,setTrim]=useState<'Base'|'Plus'|'Luxury'>('Base');
 const [chosen,setChosen]=useState<string[]>([]);
 const [search,setSearch]=useState('');
 const filteredBrands=BRANDS.filter(b=>b.toLowerCase().includes(search.toLowerCase()));
 const options=compatibleOptions(model);
 const optionIds=chosen.filter(id=>options.some(o=>o.id===id));
 const offer=configuredOffer(model,year,optionIds,trim);
 const upfront=mode==='cash'?offer.price+DRIVER_COST:mode==='finance'?financeQuote(offer.price,depositPercent,termDays).deposit+DRIVER_COST:leaseQuote(offer.price,termDays).upfront+DRIVER_COST;
 const bonus=offer.revenueBonus??0;
 return <section className="eu-dealership">
  <header className="eu-dealer-hero"><span>TRAVELEMPIRE MOTORS · EUROPE</span><h2>Build your next vehicle</h2><p>{BRANDS.length} manufacturers · {EUROPEAN_MODELS.length} models · 2025–2026 · factory-style configuration</p></header>
  <div className="eu-dealer-grid">
   <div className="eu-dealer-controls">
    <label>Find manufacturer<input type="search" placeholder="Search brands…" value={search} onChange={e=>setSearch(e.target.value)}/></label>
    <div className="eu-brand-grid">{filteredBrands.map(b=><button key={b} type="button" className={brand===b?'selected':''} onClick={()=>{setBrand(b);setSelected('');setChosen([]);setTrim('Base')}}>{b}</button>)}</div>
    <div className="eu-two"><label>Model<select value={model.name} onChange={e=>{setSelected(brand+' '+e.target.value);setChosen([]);setTrim('Base')}}>{models.map(m=><option key={m.name} value={m.name}>{m.name}</option>)}</select></label><label>Model year<select value={year} onChange={e=>setYear(Number(e.target.value))}><option value={2025}>2025</option><option value={2026}>2026</option></select></label></div>
    <label>Equipment grade<select value={trim} onChange={e=>setTrim(e.target.value as typeof trim)}><option value="Base">Base · Included</option><option value="Plus">Plus · +6% price · +5% revenue</option><option value="Luxury">Luxury · +12% price · +10% revenue</option></select></label>
    {groups.map(group=><fieldset key={group}><legend>{group}</legend><div className="eu-options">{options.filter(o=>o.group===group).map(o=><label key={o.id} className="eu-option"><input type="checkbox" checked={optionIds.includes(o.id)} onChange={e=>setChosen(old=>e.target.checked?[...old.filter(x=>x!==o.id),o.id]:old.filter(x=>x!==o.id))}/><span><strong>{o.label}</strong><small>+{eur(o.price)} · +{o.bonus}% fare revenue</small></span></label>)}</div></fieldset>)}
   </div>
   <aside className="eu-config-summary">
    <div className="eu-vehicle-stage"><div className="eu-car-symbol" aria-hidden="true">🚘</div><small>{model.segment} · {model.fuel} · {model.seats} passenger seats</small></div>
    <h3>{year} {model.brand} {model.name}</h3><p>{trim} grade · {optionIds.length} factory extras</p>
    <div className="eu-price-line"><span>Base vehicle</span><strong>{eur(model.basePrice)}</strong></div>
    <div className="eu-price-line"><span>Trim</span><strong>{eur(offer.price-model.basePrice-options.filter(o=>optionIds.includes(o.id)).reduce((n,o)=>n+o.price,0))}</strong></div>
    <div className="eu-price-line"><span>Options</span><strong>{eur(options.filter(o=>optionIds.includes(o.id)).reduce((n,o)=>n+o.price,0))}</strong></div>
    <div className="eu-price-total"><span>Configured price</span><strong>{eur(offer.price)}</strong></div>
    <div className="eu-revenue"><strong>+{bonus}% fare revenue</strong><span>Example €25 fare → €{(25*(1+bonus/100)).toFixed(2)}</span><small>Applied to completed passenger fares. Game balance values, not real-world pricing.</small></div>
    <div className="eu-price-line"><span>Order quantity</span><strong>{quantity}</strong></div>
    <div className="eu-price-total"><span>Due at checkout incl. drivers</span><strong>{eur(upfront*quantity)}</strong></div>
    <button className="eu-order" disabled={!ready||upfront*quantity>cash||(mode==='finance'&&quantity>2)} onClick={()=>onOrder(offer,quantity,mode,depositPercent,termDays)}>Order {quantity} configured {quantity===1?'vehicle':'vehicles'}</button>
    <small className="eu-disclaimer">Curated European-market-inspired game catalogue. All listed models are selectable for both years for gameplay; exact EU availability, trims, engines, compatibility and prices are not manufacturer-verified. Electric and hybrid powertrains currently use the game's petrol-only energy simulation until drivetrain support is expanded.</small>
   </aside>
  </div>
 </section>;
}
