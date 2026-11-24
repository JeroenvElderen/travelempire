import {useState} from 'react';
import {Truck,Package,Warehouse,MapPin,Fuel,Wrench,Route,ChevronRight,Search,Pause,Play,ArrowLeft,Plus} from 'lucide-react';
import type {Company} from '../company';
import {COLLECTOR_MODELS,COLLECTOR_PARTS,COLLECTOR_NAMES,collectorVehicles,collectorCapacity,collectorLimit,collectorPurchaseLock,collectorWarehouses,collectorStorageCapacity,collectorStorageUsage,collectorFuelRate,collectorExpenseTotal,emptyCollectorExpenses,COLLECTOR_SERVICE_KM,REGIONAL_WAREHOUSE_PRICE,type CollectorState,type CollectorVehicle,type CollectorModel,type CollectorPart} from '../resourceCollectors';
import './collector-fleet.css';

export type CollectorFleetControls={state?:CollectorState;levels:Partial<Record<string,number>>;cash:number;gameNow:number;onBuy:(model:CollectorModel)=>string|null;onConfigure:(id:string,change:{priority?:CollectorPart|null;paused?:boolean;warehouseId?:string})=>void;onBuyWarehouse:(id:string)=>string|null;onLocate:(id:string)=>void;onResearch:()=>void};
const money=(value:number)=>new Intl.NumberFormat('en-IE',{style:'currency',currency:'EUR',maximumFractionDigits:2}).format(value);
const count=(value:number)=>value.toLocaleString('en-IE',{maximumFractionDigits:1});
export function collectorStatus(vehicle:CollectorVehicle,now:number){
 if(vehicle.trip)return vehicle.paused?'Returning before pause':'Collecting';
 if((vehicle.serviceUntil??0)>now)return 'Servicing';
 if(vehicle.paused)return 'Paused at depot';
 return vehicle.waitingReason??'Awaiting dispatch';
}
export default function CollectorFleetPanel({company,controls}:{company:Company;controls:CollectorFleetControls}){
 const {state,levels,cash,gameNow,onBuy,onConfigure,onBuyWarehouse,onLocate,onResearch}=controls;
 const [view,setView]=useState<'vehicles'|'dealership'|'warehouses'>('vehicles');
 const [selected,setSelected]=useState<string|null>(null);
 const [search,setSearch]=useState('');
 const [filter,setFilter]=useState<'all'|'active'|'idle'|'service'>('all');
 const [error,setError]=useState('');
 if(!state)return <div className="collector-fleet"><p>Initialising your collector fleet…</p></div>;
 const vehicles=collectorVehicles(state);
 const active=vehicles.filter(v=>v.trip).length;
 const serving=vehicles.filter(v=>(v.serviceUntil??0)>gameNow).length;
 const expenses=state.expenses??emptyCollectorExpenses();
 const warehouses=collectorWarehouses(state,company.depots??[],[company.headquarters.lng,company.headquarters.lat]);
 const storage=collectorStorageUsage(state),capacity=collectorStorageCapacity(state,levels);
 const vehicle=vehicles.find(v=>v.id===selected);
 const warehouseName=(v:CollectorVehicle)=>warehouses.find(w=>w.id===(v.warehouseId??'main'))?.name??'Headquarters warehouse';
 const visible=vehicles.filter(v=>{
  const status=collectorStatus(v,gameNow);
  return (filter==='all'||filter==='active'&&!!v.trip||filter==='service'&&(status==='Servicing'||v.distanceKm-(v.lastServiceKm??0)>=COLLECTOR_SERVICE_KM)||filter==='idle'&&!v.trip&&status!=='Servicing')&&
   [COLLECTOR_MODELS[v.model].name,warehouseName(v),status,v.id,v.priority?COLLECTOR_NAMES[v.priority]:'',v.trip?.supplierName].some(s=>String(s??'').toLowerCase().includes(search.toLowerCase().trim()));
 });
 const open=(next:typeof view)=>{setView(next);setSelected(null);setError('');};
 return <section className="collector-fleet" aria-label="Resource collector fleet">
  <header className="collector-heading"><span className="collector-icon"><Truck size={24}/></span><div><h2>Resource collectors</h2><p>Supplier logistics · independent fleet</p></div><span className="collector-count">{vehicles.length}/{collectorLimit(levels)}</span></header>
  <div className="collector-kpis">
   <article><Truck size={17}/><small>On route</small><b>{active}</b></article>
   <article><Package size={17}/><small>Deliveries</small><b>{count(state.trips)}</b></article>
   <article><Wrench size={17}/><small>Servicing</small><b>{serving}</b></article>
   <article><Route size={17}/><small>Distance</small><b>{count(vehicles.reduce((n,v)=>n+v.distanceKm,0))} km</b></article>
  </div>
  <div className="collector-overview"><div><small>Lifetime operating costs</small><strong>{money(collectorExpenseTotal(expenses)/100)}</strong></div><div><small>Warehouse usage</small><strong>{count(storage.stored+storage.reserved)} / {count(capacity)}</strong></div><progress aria-label="Storage including inbound cargo" max={capacity} value={Math.min(capacity,storage.stored+storage.reserved)}/></div>
  <nav className="collector-tabs" aria-label="Collector sections">{([['vehicles','Vehicles',Truck],['dealership','Buy',Plus],['warehouses','Warehouses',Warehouse]] as const).map(([key,label,Icon])=><button key={key} type="button" aria-pressed={view===key} onClick={()=>open(key)}><Icon size={17}/>{label}</button>)}</nav>
  {error&&<p className="collector-error" role="alert">{error}</p>}
  {view==='vehicles'&&!vehicle&&<>
   <div className="collector-search"><Search size={17}/><input aria-label="Search collectors" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search vehicles, warehouses…"/></div>
   <div className="collector-filters">{(['all','active','idle','service'] as const).map(f=><button key={f} type="button" aria-pressed={filter===f} onClick={()=>setFilter(f)}>{f==='all'?'All':f==='active'?'On route':f==='idle'?'Waiting':'Service'}</button>)}</div>
   {visible.map(v=><button className="collector-vehicle" key={v.id} type="button" onClick={()=>setSelected(v.id)}><span className="collector-icon"><Truck size={25}/></span><span className="collector-vehicle-body"><strong>{COLLECTOR_MODELS[v.model].name} #{vehicles.indexOf(v)+1}</strong><small className={v.trip?'collector-active':''}>{collectorStatus(v,gameNow)}</small><small>{warehouseName(v)} · {collectorCapacity(v.model,levels)} units</small><small>{count(v.distanceKm)} km · {v.trips} deliveries</small></span><ChevronRight size={17}/></button>)}
   {!visible.length&&<p>No collectors match your search.</p>}
  </>}
  {view==='vehicles'&&vehicle&&(()=>{
   const v=vehicle,model=COLLECTOR_MODELS[v.model],cost=v.expenses??emptyCollectorExpenses(),trip=v.trip;
   const progress=trip?Math.max(0,Math.min(1,(gameNow-trip.startedAt)/Math.max(1,trip.endsAt-trip.startedAt))):0;
   return <div className="collector-detail">
    <button className="collector-back" type="button" onClick={()=>setSelected(null)}><ArrowLeft size={16}/> All collectors</button>
    <h3>{model.name} #{vehicles.indexOf(v)+1}</h3><p>{collectorStatus(v,gameNow)} · {warehouseName(v)}</p>
    {trip&&<div className="collector-trip"><strong>{trip.supplierName??'Supplier'}</strong><small>{trip.quantity} × {COLLECTOR_NAMES[trip.part]} · {count(trip.distance/1000)} km round trip</small><progress aria-label="Collection trip progress" value={progress} max={1}/><small>{Math.round(progress*100)}% · {Math.max(0,Math.ceil((trip.endsAt-gameNow)/60000))} game minutes remaining</small></div>}
    <div className="collector-detail-grid">
     <div><Package size={16}/><small>Cargo capacity</small><b>{collectorCapacity(v.model,levels)} units</b></div>
     <div><Route size={16}/><small>Distance</small><b>{count(v.distanceKm)} km</b></div>
     <div><Fuel size={16}/><small>Fuel rate</small><b>{collectorFuelRate(v.model,levels).toFixed(1)} L/100 km</b></div>
     <div><Fuel size={16}/><small>Fuel purchased</small><b>{count(v.fuelLitres??0)} L</b></div>
     <div><Wrench size={16}/><small>Service due in</small><b>{count(Math.max(0,COLLECTOR_SERVICE_KM-v.distanceKm+(v.lastServiceKm??0)))} km</b></div>
     <div><Package size={16}/><small>Deliveries</small><b>{v.trips}</b></div>
    </div>
    <div className="collector-overview"><div><small>Lifetime expenses</small><strong>{money(collectorExpenseTotal(cost)/100)}</strong></div><small>Fuel {money(cost.fuelCents/100)} · Wear {money(cost.maintenanceCents/100)} · Service {money(cost.serviceCents/100)}</small></div>
    <label>Resource priority<select disabled={!levels.collectorPriority} value={v.priority??''} onChange={e=>onConfigure(v.id,{priority:(e.target.value||null) as CollectorPart|null})}><option value="">{levels.collectorPriority?'Automatic rotation':'Research required'}</option>{COLLECTOR_PARTS.map(p=><option key={p} value={p}>{COLLECTOR_NAMES[p]}</option>)}</select></label>
    <label>Assigned warehouse<select disabled={!levels.collectorRegional||!!trip||!v.paused} value={v.warehouseId??'main'} onChange={e=>onConfigure(v.id,{warehouseId:e.target.value})}>{warehouses.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
    <small>Pause and wait for return before changing warehouse.</small>
    <div className="collector-actions"><button type="button" onClick={()=>onConfigure(v.id,{paused:!v.paused})}>{v.paused?<Play size={17}/>:<Pause size={17}/>} {v.paused?'Resume':'Pause at depot'}</button><button type="button" onClick={()=>onLocate(v.id)}><MapPin size={17}/> Locate</button></div>
   </div>;
  })()}
  {view==='dealership'&&<div className="collector-detail"><h3>Collector dealership</h3><p>{money(cash)} available · {collectorLimit(levels)-vehicles.length} fleet slots</p>{(Object.keys(COLLECTOR_MODELS) as CollectorModel[]).map(key=>{
   const model=COLLECTOR_MODELS[key],lock=collectorPurchaseLock(state,key,levels)??(cash<model.price?'Insufficient company cash':null);
   return <article key={key} className="collector-offer"><span className="collector-icon"><Truck size={26}/></span><div><strong>{model.name}</strong><small>{collectorCapacity(key,levels)} units · {collectorFuelRate(key,levels).toFixed(1)} L/100 km</small><b>{money(model.price)}</b><button type="button" disabled={!!lock} onClick={()=>setError(onBuy(key)??'')}>{lock??'Purchase vehicle'}</button></div></article>;
  })}<button className="collector-back" type="button" onClick={onResearch}>View collector research</button></div>}
  {view==='warehouses'&&<div className="collector-detail"><h3>Warehouse network</h3><p>Shared research storage · {count(storage.stored)} stored · {count(storage.reserved)} incoming.</p>{warehouses.map(w=><article className="collector-offer" key={w.id}><span className="collector-icon"><Warehouse size={25}/></span><div><strong>{w.name}</strong><small>{vehicles.filter(v=>(v.warehouseId??'main')===w.id).length} assigned · {w.trips} deliveries</small><small>{count(Object.values(w.delivered).reduce((n,q)=>n+(q??0),0))} lifetime units</small></div></article>)}{(company.depots??[]).filter(d=>!warehouses.some(w=>w.id===d.id)).map(d=><article className="collector-offer" key={d.id}><span className="collector-icon"><Warehouse size={25}/></span><div><strong>{d.name}</strong><small>{money(REGIONAL_WAREHOUSE_PRICE)} conversion</small><button disabled={!levels.collectorRegional||cash<REGIONAL_WAREHOUSE_PRICE} type="button" onClick={()=>setError(onBuyWarehouse(d.id)??'')}>{!levels.collectorRegional?'Regional research required':cash<REGIONAL_WAREHOUSE_PRICE?'Insufficient cash':'Open warehouse'}</button></div></article>)}{!(company.depots??[]).length&&<p>Add a regional company depot to expand your warehouse network.</p>}</div>}
 </section>;
}
