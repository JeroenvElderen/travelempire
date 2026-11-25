import {useMemo,useState} from 'react';
import {CarFront,Search,Wallet,Warehouse,ChevronRight,SlidersHorizontal,PackageCheck} from 'lucide-react';
import {EUROPEAN_MODELS,BRANDS,type VehicleModel} from '../europeanVehicleCatalog';
import {eur,type VehicleOffer} from '../dealership';
import {DRIVER_COST,type FleetState} from '../simulation/taxi';
import type {Company} from '../company';
import EuropeanDealership from './EuropeanDealership';
import type {DepotParking} from '../simulation/depotParking';
import {dealershipModelAvailable,FULL_DEALERSHIP_LEVEL} from '../researchUnlocks';
import './DealershipPage.css';
import './dealership-floating.css';
import './dealership-fleet-match.css';

type Props={cash:number;company:Company;fleet:FleetState;gameNow:number;researchLevels?:Partial<Record<string,number>>;starterLevel?:number;ready:boolean;depots:DepotParking[];error?:string;onDepotChange?:()=>void;onOrder:(offer:VehicleOffer,quantity:number,mode:'cash'|'finance'|'lease',depositPercent:number,termDays:number,depotId:string)=>void};
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
export default function DealershipPage({cash,company,fleet,gameNow,researchLevels,starterLevel,ready,depots,error='',onDepotChange,onOrder}:Props){
 const [selected,setSelected]=useState<VehicleModel|null>(null);
 const [stage,setStage]=useState<'browse'|'build'|'review'>('browse');
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
  `${selectedDepot.available} of ${quantity} parking spaces free at ${selectedDepot.name}. Choose another depot or expand parking.`:'';
 const depotSelector=<label className="dealer-depot-selector">Delivery depot
  <select aria-label="Deliver vehicles to depot" value={depotId} onChange={e=>{setDepotId(e.target.value);onDepotChange?.()}}>
   {depots.map(d=><option key={d.id} value={d.id}>{d.name} · {d.occupied}/{d.capacity} occupied</option>)}
  </select>
  <small>{selectedDepot?`${selectedDepot.available} taxi spaces available · ${selectedDepot.occupied} reserved or assigned`:'Choose a depot'}</small>
 </label>;
 const unlockedModels=useMemo(()=>EUROPEAN_MODELS.filter(m=>dealershipModelAvailable(m,starterLevel)),[starterLevel]);
 const unlockedBrands=BRANDS.filter(b=>unlockedModels.some(m=>m.brand===b));
 const models=useMemo(()=>unlockedModels.filter(m=>(brand==='All'||m.brand===brand)&&(m.brand+' '+m.name).toLowerCase().includes(search.trim().toLowerCase())).sort((a,b)=>sort==='price'?a.basePrice-b.basePrice:sort==='price-desc'?b.basePrice-a.basePrice:a.brand.localeCompare(b.brand)||a.name.localeCompare(b.name)),[unlockedModels,brand,search,sort]);

 const openModel=(m:VehicleModel)=>{setSelected(m);setStage('build');};
 const switchStage=(next:'browse'|'build'|'review')=>{
  if(next==='browse'){setStage('browse');return;}
  if(selected)setStage(next);
 };
 const remainingSlots=depots.reduce((total,depot)=>total+depot.available,0);
 return <section className="dealer-page dealer-fleet-page">
  <header className="dealer-fleet-header">
   <span className="dealer-fleet-header-icon"><CarFront size={25}/></span>
   <div><h1>Dealership</h1><p>Manage vehicle purchases &amp; configuration</p></div>
  </header>
  <nav className="dealer-stage-nav" aria-label="Dealership sections">
   {([['browse','Models',CarFront],['build','Configure',SlidersHorizontal],['review','Checkout',PackageCheck]] as const).map(([name,label,Icon])=><button type="button" key={name} className={stage===name?'active':''} aria-current={stage===name?'step':undefined} aria-label={label} disabled={name!=='browse'&&!selected} onClick={()=>switchStage(name)}><Icon size={19}/><span>{stage===name?label:''}</span></button>)}
  </nav>
  {stage==='browse'&&<div className="dealer-fleet-kpis">
   <article><Wallet size={19}/><span>Balance</span><strong>{eur(cash)}</strong></article>
   <article><Warehouse size={19}/><span>Parking</span><strong>{remainingSlots}</strong></article>
   <article><CarFront size={19}/><span>Models</span><strong>{unlockedModels.length}</strong></article>
   <article><SlidersHorizontal size={19}/><span>Brands</span><strong>{unlockedBrands.length}</strong></article>
  </div>}
  {stage==='browse'||!selected?
   <div className="dealer-fleet-catalogue">
    {starterLevel!==undefined&&starterLevel<FULL_DEALERSHIP_LEVEL&&<p className="dealer-footnote">Starter dealership · Two entry-level models unlocked. Complete Starter Level 5 for the full catalogue.</p>}
    <div className="dealer-fleet-section-heading"><h2>Available vehicles</h2><small>{models.length} models</small></div>
    <div className="dealer-searchbar"><label className="dealer-search-field"><Search size={18} aria-hidden="true"/><input type="search" aria-label="Search vehicles" placeholder="Search manufacturer or model…" value={search} onChange={e=>setSearch(e.target.value)}/></label><label className="dealer-sort-field"><SlidersHorizontal size={17} aria-hidden="true"/><select aria-label="Sort vehicles" value={sort} onChange={e=>setSort(e.target.value)}><option value="price">Price: low to high</option><option value="price-desc">Price: high to low</option><option value="name">Manufacturer</option></select></label></div>
    <div className="dealer-brand-tabs" aria-label="Manufacturers">{['All',...unlockedBrands].map(b=><button key={b} type="button" className={brand===b?'active':''} aria-pressed={brand===b} onClick={()=>setBrand(b)}>{b}</button>)}</div>
    <div className="dealer-fleet-model-list">
     {models.map(m=><button type="button" key={m.brand+'|'+m.name} className="dealer-fleet-model-row" onClick={()=>openModel(m)}>
      <span className="dealer-fleet-model-image"><VehiclePhoto model={m}/></span>
      <span className="dealer-fleet-model-details"><small>{m.brand} · {m.years.join(' / ')}</small><strong>{m.name}</strong><small>{m.fuel} · {m.seats} seats</small></span>
      <span className="dealer-fleet-model-price"><small>From</small><strong>{eur(m.basePrice)}</strong></span>
      <ChevronRight size={17} aria-hidden="true"/>
     </button>)}
     {!models.length&&<p className="dealer-fleet-empty">No matching vehicles. Try another brand or search.</p>}
    </div>
    <p className="dealer-footnote">Starting prices exclude configuration options. Driver hire costs {eur(DRIVER_COST)} per vehicle.</p>
   </div>:
   <div className="dealer-fleet-configure">
    <details key={stage} className="dealer-order-settings" open={stage==='review'?true:undefined}>
     <summary><span>Delivery &amp; payment</span><small>{selectedDepot?selectedDepot.available+' parking spaces free':'Choose depot'} · {mode}</small><span className="dealer-order-settings-chevron" aria-hidden="true">⌄</span></summary>
     <div className="dealer-toolbar">{depotSelector}<label>Quantity<input type="number" min={1} max={20} value={quantity} onChange={e=>setQuantity(Math.max(1,Math.min(20,Number(e.target.value)||1)))}/></label><label>Payment<select value={mode} onChange={e=>setMode(e.target.value as typeof mode)}><option value="cash">Cash</option><option value="finance">Finance</option><option value="lease">Lease</option></select></label>{mode==='finance'&&<label>Deposit %<input type="number" min={10} max={90} value={deposit} onChange={e=>setDeposit(Math.max(10,Math.min(90,Math.round(Number(e.target.value)||25))))}/></label>}{mode!=='cash'&&<label>Term<select value={term} onChange={e=>setTerm(Number(e.target.value))}><option value={30}>30 days</option><option value={60}>60 days</option><option value={90}>90 days</option><option value={180}>180 days</option><option value={365}>1 game year</option><option value={730}>2 game years</option></select></label>}</div>
    </details>
    {error&&<p className="dealer-parking-error" role="alert">{error}</p>}
    <EuropeanDealership key={selected.brand+'|'+selected.name} reviewing={stage==='review'} onReviewChange={reviewing=>setStage(reviewing?'review':'build')} initialBrand={selected.brand} initialModel={selected.brand+' '+selected.name} onBack={()=>setStage('browse')} cash={cash} company={company} fleet={fleet} gameNow={gameNow} researchLevels={researchLevels} starterLevel={starterLevel} ready={ready} quantity={quantity} mode={mode} depositPercent={deposit} termDays={term} depotName={selectedDepot?.name??'No depot selected'} parkingError={capacityError} onOrder={(offer,count,payment,depositPct,days)=>{onOrder(offer,count,payment,depositPct,days,depotId);}}/>
   </div>}
 </section>;
}
