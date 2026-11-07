import {useMemo,useState} from 'react';
import {EUROPEAN_MODELS,BRANDS,type VehicleModel} from '../europeanVehicleCatalog';
import {eur,type VehicleOffer} from '../dealership';
import {DRIVER_COST} from '../simulation/taxi';
import EuropeanDealership from './EuropeanDealership';
import './DealershipPage.css';

type Props={cash:number;ready:boolean;onOrder:(offer:VehicleOffer,quantity:number,mode:'cash'|'finance'|'lease',depositPercent:number,termDays:number)=>void};
const photoFiles:Record<string,string>={
 'Volvo|XC90':'2025 Volvo XC90 (facelift), front 4.11.25.jpg',
 'Volvo|XC60':'Volvo XC60 II 2025 facelift 001.jpg',
 'Volvo|V60':'2020 Volvo V60 R-Design in Bursting Blue Metallic, front right, 2024-10-03.jpg',
 'Volvo|XC40':'2024 Volvo XC40 B4 facelift front.jpg',
 'Toyota|Corolla':'2025 Toyota Corolla - 2025 Toyota Corolla.jpg',
 'Škoda|Octavia':'Skoda Octavia IV facelift.jpg'
};
// Wikimedia Commons photos are model references, not representations of the configured paint or grade.
// All photos use the same 16:9 crop; only verified model-specific images are displayed.
function VehiclePhoto({model}:{model:VehicleModel}){
 const file=photoFiles[model.brand+'|'+model.name];
 const [failed,setFailed]=useState(false);
 return <div className="dealer-photo">
  {file&&!failed?<img loading="lazy" src={'https://commons.wikimedia.org/wiki/Special:FilePath/'+encodeURIComponent(file)+'?width=900'} alt={model.brand+' '+model.name+' exterior'} onError={()=>setFailed(true)}/>:<div className="dealer-photo-fallback"><span aria-hidden="true">🚘</span><small>Model photo not yet available</small></div>}
 </div>;
}
export default function DealershipPage({cash,ready,onOrder}:Props){
 const [selected,setSelected]=useState<VehicleModel|null>(null);
 const [search,setSearch]=useState('');
 const [brand,setBrand]=useState('All');
 const [sort,setSort]=useState('price');
 const [quantity,setQuantity]=useState(1);
 const [mode,setMode]=useState<'cash'|'finance'|'lease'>('cash');
 const [deposit,setDeposit]=useState(25);
 const [term,setTerm]=useState(90);
 const models=useMemo(()=>EUROPEAN_MODELS.filter(m=>(brand==='All'||m.brand===brand)&&(m.brand+' '+m.name).toLowerCase().includes(search.trim().toLowerCase())).sort((a,b)=>sort==='price'?a.basePrice-b.basePrice:sort==='price-desc'?b.basePrice-a.basePrice:a.brand.localeCompare(b.brand)||a.name.localeCompare(b.name)),[brand,search,sort]);
 if(selected)return <div className="dealer-page">
  <div className="dealer-toolbar"><label>Quantity<input type="number" min={1} max={20} value={quantity} onChange={e=>setQuantity(Math.max(1,Math.min(20,Number(e.target.value)||1)))}/></label><label>Payment<select value={mode} onChange={e=>setMode(e.target.value as typeof mode)}><option value="cash">Cash</option><option value="finance">Finance</option><option value="lease">Lease</option></select></label>{mode==='finance'&&<label>Deposit %<input type="number" min={10} max={90} value={deposit} onChange={e=>setDeposit(Math.max(10,Math.min(90,Number(e.target.value)||25)))}/></label>}{mode!=='cash'&&<label>Term<select value={term} onChange={e=>setTerm(Number(e.target.value))}><option value={30}>30 days</option><option value={60}>60 days</option><option value={90}>90 days</option><option value={180}>180 days</option></select></label>}</div>
  <EuropeanDealership key={selected.brand+'|'+selected.name} initialBrand={selected.brand} initialModel={selected.brand+' '+selected.name} onBack={()=>setSelected(null)} cash={cash} ready={ready} quantity={quantity} mode={mode} depositPercent={deposit} termDays={term} onOrder={(offer,count,payment,depositPct,days)=>{onOrder(offer,count,payment,depositPct,days);}}/>
 </div>;
 return <section className="dealer-page"><header className="dealer-page-header"><div><span>TRAVELEMPIRE MOTORS</span><h1>Vehicle Dealership</h1><p>Explore the catalogue, customise your next vehicle and order for your fleet.</p></div><div className="dealer-balance"><small>Available capital</small><strong>{eur(cash)}</strong></div></header>
 <div className="dealer-searchbar"><input type="search" aria-label="Search vehicles" placeholder="Search manufacturer or model…" value={search} onChange={e=>setSearch(e.target.value)}/><select aria-label="Sort vehicles" value={sort} onChange={e=>setSort(e.target.value)}><option value="price">Price: low to high</option><option value="price-desc">Price: high to low</option><option value="name">Manufacturer</option></select></div>
 <div className="dealer-brand-tabs" aria-label="Manufacturers">{['All',...BRANDS].map(b=><button key={b} type="button" className={brand===b?'active':''} onClick={()=>setBrand(b)}>{b}</button>)}</div>
 <p className="dealer-results">{models.length} available models · Prices shown are starting prices; final price depends on configuration.</p>
 <div className="dealer-model-grid">{models.map(m=><article key={m.brand+'|'+m.name} className="dealer-model-card"><VehiclePhoto model={m}/><div className="dealer-card-body"><div className="dealer-card-title"><div><small>{m.brand}</small><h2>{m.name}</h2></div><div className="dealer-card-price"><small>From</small><strong>{eur(m.basePrice)}</strong></div></div><p>{m.fuel} · {m.seats} seats · {m.years.join(' / ')}</p><button type="button" onClick={()=>setSelected(m)}>Configure vehicle →</button></div></article>)}</div>
 {!models.length&&<p>No matching vehicles. Try another manufacturer or search term.</p>}
 <p className="dealer-footnote">Vehicle photography is a reference to the real model, not a live render of the selected paint or options. Photos appear only where a model-specific source is available; other models use a neutral placeholder. Driver onboarding costs {eur(DRIVER_COST)} per vehicle.</p>
 </section>;
}
