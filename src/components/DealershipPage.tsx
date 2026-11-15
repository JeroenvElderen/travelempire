import {useMemo,useState} from 'react';
import {CarFront,Search,Wallet,Warehouse,ChevronRight,SlidersHorizontal} from 'lucide-react';
import {EUROPEAN_MODELS,BRANDS,type VehicleModel} from '../europeanVehicleCatalog';
import {eur,type VehicleOffer} from '../dealership';
import {DRIVER_COST} from '../simulation/taxi';
import EuropeanDealership from './EuropeanDealership';
import type {DepotParking} from '../simulation/depotParking';
import './DealershipPage.css';

type Props={cash:number;ready:boolean;depots:DepotParking[];error?:string;onDepotChange?:()=>void;onOrder:(offer:VehicleOffer,quantity:number,mode:'cash'|'finance'|'lease',depositPercent:number,termDays:number,depotId:string)=>void};
const photoFiles:Record<string,string>={
 'Volvo|XC90':'2025 Volvo XC90 (facelift), front 4.11.25.jpg',
 'Volvo|XC60':'Volvo XC60 II 2025 facelift 001.jpg',
 'Volvo|V60':'2020 Volvo V60 R-Design in Bursting Blue Metallic, front right, 2024-10-03.jpg',
 'Volvo|XC40':'2024 Volvo XC40 B4 facelift front.jpg'
};
// Wikimedia Commons photos are model references, not representations of the configured paint or grade.
// All photos use the same 16:9 crop; only verified model-specific images are displayed.
function VehiclePhoto({model}:{model:VehicleModel}){
 const file=photoFiles[model.brand+'|'+model.name];
 const [failed,setFailed]=useState(false);
 return <div className="dealer-photo">
  {file&&!failed?<img loading="lazy" src={'https://commons.wikimedia.org/wiki/Special:FilePath/'+encodeURIComponent(file)+'?width=900'} alt={model.brand+' '+model.name+' exterior'} onError={()=>setFailed(true)}/>:<div className="dealer-photo-fallback"><CarFront size={32} aria-hidden="true"/><small>Photo unavailable</small></div>}
 </div>;
}
export default function DealershipPage({cash,ready,depots,error='',onDepotChange,onOrder}:Props){
 const [selected,setSelected]=useState<VehicleModel|null>(null);
 const [search,setSearch]=useState('');
 const [brand,setBrand]=useState('All');
 const [sort,setSort]=useState('price');
 const [quantity,setQuantity]=useState(1);
 const [mode,setMode]=useState<'cash'|'finance'|'lease'>('cash');
 const [deposit,setDeposit]=useState(25);
 const [term,setTerm]=useState(90);
 const [depotId,setDepotId]=useState('main');
 const selectedDepot=depots.find(d=>d.id===depotId);
 const capacityError=!selectedDepot?'Select an existing delivery depot.':
  selectedDepot.available<quantity?
  `${selectedDepot.name} has only ${selectedDepot.available} of ${quantity} required free taxi spaces (${selectedDepot.occupied}/${selectedDepot.capacity} occupied). Choose another depot or expand parking.`:'';
 const depotSelector=<label className="dealer-depot-selector">Delivery depot
  <select aria-label="Deliver vehicles to depot" value={depotId} onChange={e=>{setDepotId(e.target.value);onDepotChange?.()}}>
   {depots.map(d=><option key={d.id} value={d.id}>{d.name} · {d.occupied}/{d.capacity} occupied</option>)}
  </select>
  <small>{selectedDepot?`${selectedDepot.available} taxi spaces available · ${selectedDepot.occupied} reserved or assigned`:'Choose a depot'}</small>
 </label>;
 const models=useMemo(()=>EUROPEAN_MODELS.filter(m=>(brand==='All'||m.brand===brand)&&(m.brand+' '+m.name).toLowerCase().includes(search.trim().toLowerCase())).sort((a,b)=>sort==='price'?a.basePrice-b.basePrice:sort==='price-desc'?b.basePrice-a.basePrice:a.brand.localeCompare(b.brand)||a.name.localeCompare(b.name)),[brand,search,sort]);
 if(selected)return <div className="dealer-page dealer-page-config">
  <header className="dealer-config-heading"><span className="dealer-config-heading-icon"><CarFront size={22}/></span><div><small>TRAVELEMPIRE MOTORS</small><h1>Configure your {selected.brand} {selected.name}</h1></div></header>
  <div className="dealer-toolbar">{depotSelector}<label>Quantity<input type="number" min={1} max={20} value={quantity} onChange={e=>setQuantity(Math.max(1,Math.min(20,Number(e.target.value)||1)))}/></label><label>Payment<select value={mode} onChange={e=>setMode(e.target.value as typeof mode)}><option value="cash">Cash</option><option value="finance">Finance</option><option value="lease">Lease</option></select></label>{mode==='finance'&&<label>Deposit %<input type="number" min={10} max={90} value={deposit} onChange={e=>setDeposit(Math.max(10,Math.min(90,Number(e.target.value)||25)))}/></label>}{mode!=='cash'&&<label>Term<select value={term} onChange={e=>setTerm(Number(e.target.value))}><option value={30}>30 days</option><option value={60}>60 days</option><option value={90}>90 days</option><option value={180}>180 days</option></select></label>}</div>{capacityError&&<p className="dealer-parking-error" role="alert">{capacityError}</p>}{error&&<p className="dealer-parking-error" role="alert">{error}</p>}
  <EuropeanDealership key={selected.brand+'|'+selected.name} initialBrand={selected.brand} initialModel={selected.brand+' '+selected.name} onBack={()=>setSelected(null)} cash={cash} ready={ready} quantity={quantity} mode={mode} depositPercent={deposit} termDays={term} depotName={selectedDepot?.name??'No depot selected'} parkingError={capacityError} onOrder={(offer,count,payment,depositPct,days)=>{onOrder(offer,count,payment,depositPct,days,depotId);}}/>
 </div>;
 return <section className="dealer-page dealer-page-catalogue"><header className="dealer-page-header"><span className="dealer-page-header-icon"><CarFront size={25}/></span><div className="dealer-page-header-copy"><span>TRAVELEMPIRE MOTORS</span><h1>Dealership</h1><p>Browse and configure real European vehicle models</p></div></header>
 <div className="dealer-overview-metrics"><div className="dealer-overview-metric"><Wallet size={18}/><span>Available funds</span><strong>{eur(cash)}</strong></div><div className="dealer-overview-metric"><Warehouse size={18}/><span>Free parking</span><strong>{depots.reduce((sum,d)=>sum+d.available,0)} spaces</strong></div></div>
 <div className="dealer-toolbar">{depotSelector}</div>
 <div className="dealer-searchbar"><label className="dealer-search-field"><Search size={18} aria-hidden="true"/><input type="search" aria-label="Search vehicles" placeholder="Search manufacturer or model…" value={search} onChange={e=>setSearch(e.target.value)}/></label><label className="dealer-sort-field"><SlidersHorizontal size={17} aria-hidden="true"/><select aria-label="Sort vehicles" value={sort} onChange={e=>setSort(e.target.value)}><option value="price">Price: low to high</option><option value="price-desc">Price: high to low</option><option value="name">Manufacturer</option></select></label></div>
 <div className="dealer-brand-tabs" aria-label="Manufacturers">{['All',...BRANDS].map(b=><button key={b} type="button" className={brand===b?'active':''} onClick={()=>setBrand(b)}>{b}</button>)}</div>
 <p className="dealer-results"><strong>{models.length} models</strong><span>Starting prices · Final price in configurator</span></p>
 <div className="dealer-model-grid">{models.map(m=><article key={m.brand+'|'+m.name} className="dealer-model-card"><VehiclePhoto model={m}/><div className="dealer-card-body"><div className="dealer-card-title"><div><small>{m.brand}</small><h2>{m.name}</h2></div><div className="dealer-card-price"><small>From</small><strong>{eur(m.basePrice)}</strong></div></div><p>{m.fuel} · {m.seats} seats · {m.years.join(' / ')}</p><button type="button" onClick={()=>setSelected(m)}>Configure <ChevronRight size={16} aria-hidden="true"/></button></div></article>)}</div>
 {!models.length&&<p>No matching vehicles. Try another manufacturer or search term.</p>}
 <p className="dealer-footnote">Vehicle photography is a reference to the real model, not a live render of the selected paint or options. Photos appear only where a model-specific source is available; other models use a neutral placeholder. Driver onboarding costs {eur(DRIVER_COST)} per vehicle.</p>
 </section>;
}
