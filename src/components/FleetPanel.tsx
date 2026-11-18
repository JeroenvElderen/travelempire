import {energySpec,energyRemaining,energyPercent,energyRangeKm} from '../simulation/energy';
import {driverLevel,driverSkill} from '../simulation/taxi';
import {SPECIALIST_EXPLORERS} from '../simulation/explorerRoles';
import {useEffect,useState} from 'react';
import {CarFront,CalendarDays,Wrench,Gauge,Search,SlidersHorizontal,Fuel,MapPin,ChevronRight,ChevronDown,ChevronUp,TrendingUp,UserRound,UserPlus,Route,BarChart3} from 'lucide-react';
import type {Company} from '../company';
import type {FleetState,RoadGraph} from '../simulation/taxi';
import {DRIVER_COST} from '../simulation/taxi';
import {OFFERS,eur,type VehicleOffer} from '../dealership';
import {financeQuote,leaseQuote,FINANCE_TERMS} from '../economy';
import {depotParkingChoices} from '../simulation/depotParking';
import '../dealership.css';
import {AudiA5VehicleImage} from './AudiA5VehicleImage';
import './fleet-compact.css';
import './fleet-redesign.css';

const serviceDistance=(t:{operatingKm?:number;lastServiceKm?:number})=>Math.max(0,(t.operatingKm??0)-(t.lastServiceKm??0));
const needsService=(t:{vehicleCondition?:number;operatingKm?:number;lastServiceKm?:number;serviceThreshold?:number})=>(t.vehicleCondition??100)<=(t.serviceThreshold??40)||serviceDistance(t)>=250;
type Props={company:Company|null;fleet:FleetState;graph:RoadGraph|null;error?:string;onBuy:(driver:string,offer:VehicleOffer,mode?:'cash'|'finance'|'lease',depositPercent?:number,termDays?:number,depotId?:string)=>void;onBuyBatch:(offer:VehicleOffer,quantity:number,mode?:'cash'|'finance'|'lease',depositPercent?:number,termDays?:number,depotId?:string)=>void;onBuyRoadExplorer:(role?:import('../simulation/taxi').Taxi['explorerRole'])=>void;onAssignDriver:(id:string,name:string)=>void;onHireDriver:(name:string)=>void;onDismissDriver:(id:string)=>void;onService:(id:string)=>void;onRefill:(id:string)=>void;onSell:(id:string)=>void;onReset:(id:string)=>void;onRequestRecovery:(id:string)=>void;recoveryRequests:string[];recoveryJobs:Array<{targetId:string;phase:'pickup'|'transport'|'return'}>;onPolicy:(id:string,policy:'economy'|'balanced'|'performance')=>void;onServiceThreshold:(id:string,threshold:number)=>void;onAutoDepotService:(id:string,enabled:boolean)=>void;onLocate?:(id:string)=>void};
export default function FleetPanel({company,fleet,graph,error='',onBuyBatch,onBuyRoadExplorer,onAssignDriver,onHireDriver,onDismissDriver,onService,onRefill,onSell,onReset,onRequestRecovery,recoveryRequests,recoveryJobs,onPolicy,onServiceThreshold,onAutoDepotService}:Props){
 const [deliveryDepotId,setDeliveryDepotId]=useState('main');const [batchQuantity,setBatchQuantity]=useState(1);const [vehicleQuery,setVehicleQuery]=useState('');const [selectedVehicle,setSelectedVehicle]=useState<string|null>(null);const [vehicleFilter,setVehicleFilter]=useState<'all'|'taxi'|'explorer'|'attention'>('all');const [driverEdits,setDriverEdits]=useState<Record<string,string>>({});const [newHire,setNewHire]=useState('');const [hireFormOpen,setHireFormOpen]=useState(false);const [expandedDriverId,setExpandedDriverId]=useState<string|null>(null);const [driverFilter,setDriverFilter]=useState<'all'|'assigned'|'available'>('all');const [analyticsMetric,setAnalyticsMetric]=useState<'revenue'|'profit'>('revenue');const [showAllAnalytics,setShowAllAnalytics]=useState(false);const [fleetView,setFleetView]=useState<'overview'|'vehicles'|'drivers'|'service'|'statistics'>('overview');const [tab,setTab]=useState<'fleet'|'dealers'>('fleet');const [purchaseMode,setPurchaseMode]=useState<'cash'|'finance'|'lease'>('cash');const [depositPercent,setDepositPercent]=useState(25);const [termDays,setTermDays]=useState(90);const [filter,setFilter]=useState<'All'|'New'|'Used'>('All');const [now,setNow]=useState(Date.now());
 useEffect(()=>{const id=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(id)},[]);
 const pending=fleet.taxis.filter(t=>t.deliveryUntil&&t.deliveryUntil>now);
 const parking=company?depotParkingChoices(company,fleet):[];
 const selectedParking=parking.find(d=>d.id===deliveryDepotId);
 const parkingError=!selectedParking?'Select a delivery depot.':
  batchQuantity>selectedParking.available?
  `${selectedParking.name} has ${selectedParking.occupied}/${selectedParking.capacity} taxi spaces filled. Only ${selectedParking.available} available for this order of ${batchQuantity}. Choose another depot or expand parking.`:'';

 const visibleVehicles=fleet.taxis.filter(t=>{const query=vehicleQuery.trim().toLowerCase();const matches=!query||[t.name,t.vehicleModel,t.driver].some(value=>String(value??'').toLowerCase().includes(query));const matchesType=vehicleFilter==='all'||(vehicleFilter==='taxi'&&(!t.kind||t.kind==='taxi'))||(vehicleFilter==='explorer'&&(t.kind==='explorer'))||(vehicleFilter==='attention'&&(needsService(t)||energyPercent(t)<=10||(t.deliveryUntil??0)>now));return matches&&matchesType&&(!selectedVehicle||t.id===selectedVehicle);});
 const activeCount=fleet.taxis.filter(t=>(!t.deliveryUntil||t.deliveryUntil<=now)&&!['IDLE','SERVICING','PAUSED'].includes(t.status)).length;
 const serviceCount=fleet.taxis.filter(t=>t.status==='SERVICING'||needsService(t)).length;
 const breakCount=fleet.taxis.filter(t=>/BREAK|REST/.test(t.status)).length;
 const averageFuel=fleet.taxis.length?Math.round(fleet.taxis.reduce((sum,t)=>sum+energyPercent(t),0)/fleet.taxis.length):0;
 const averageCondition=fleet.taxis.length?Math.round(fleet.taxis.reduce((sum,t)=>sum+(t.vehicleCondition??100),0)/fleet.taxis.length):0;
 const fleetHealth=Math.round((averageFuel+averageCondition)/2);
 const totalTrips=fleet.taxis.reduce((n,t)=>n+t.completed,0);
 const onSchedule=fleet.taxis.length?Math.round(100*fleet.taxis.filter(t=>!['PAUSED','SERVICING'].includes(t.status)).length/fleet.taxis.length):0;
 const fleetOperatingProfit=fleet.taxis.reduce((n,t)=>n+(t.tripRevenue??0)-(t.fuelExpense??0)-(t.maintenanceExpense??0)-(t.driverWages??0)-(t.insuranceExpense??0),0)-(fleet.serviceExpense??0);
const analyticsRevenue=fleet.taxis.reduce((sum,t)=>sum+(t.tripRevenue??0),0);
 const analyticsDistance=fleet.taxis.reduce((sum,t)=>sum+(t.operatingKm??0),0);
 const analyticsUniqueRoads=fleet.taxis.reduce((sum,t)=>sum+(t.uniqueDiscoveredKm??0),0);
 const analyticsExplorerDistance=fleet.taxis.reduce((sum,t)=>sum+(t.discoveredKm??0),0);
 const analyticsTotalTaxis=fleet.taxis.filter(t=>!t.kind||t.kind==='taxi').length;
 const analyticsAvailableTaxis=fleet.taxis.filter(t=>(!t.kind||t.kind==='taxi')&&t.status==='IDLE'&&(!t.deliveryUntil||t.deliveryUntil<=now)).length;
 const analyticsAlerts=fleet.taxis.filter(t=>needsService(t)).length;
 const analyticsVehicleRows=fleet.taxis.map(t=>({t,profit:(t.tripRevenue??0)-(t.fuelExpense??0)-(t.maintenanceExpense??0)-(t.driverWages??0)-(t.insuranceExpense??0)})).sort((a,b)=>analyticsMetric==='revenue'?(b.t.tripRevenue??0)-(a.t.tripRevenue??0):b.profit-a.profit);
 const roster=fleet.drivers??[];const assignedNames=new Set(fleet.taxis.map(t=>t.driver.toLowerCase()));
 return <section className="company-dashboard fleet-v2"><div className="fleet-page-heading"><div><span className="eyebrow">FLEET COMMAND · V2.1.1</span><h1>Fleet</h1><p>Manage vehicles &amp; performance</p></div><div className="fleet-heading-tag">OPERATIONS / FLEET</div></div>
 {!company?<p>Create a company first.</p>:<>
 <div className="fleet-showroom">
 <div className="fleet-showroom-head"><span className="fleet-showroom-icon"><CarFront size={26}/></span><div><h2>Fleet</h2><p>Manage vehicles &amp; performance</p></div></div>
 <nav className="fleet-showroom-nav" aria-label="Fleet sections">
 {([['overview','Overview',CarFront],['vehicles','Vehicles',CarFront],['drivers','Drivers',CalendarDays],['service','Service',Wrench],['statistics','Analytics',Gauge]] as const).map(([key,label,Icon])=><button type="button" key={key} className={fleetView===key?'active':''} aria-label={label} aria-current={fleetView===key?'page':undefined} onClick={()=>{setFleetView(key);setSelectedVehicle(null);setTab('fleet')}}><Icon size={19}/><span>{fleetView===key?label:''}</span></button>)}
 </nav>
 <div className="fleet-showroom-kpis">
 <article><CarFront/><span>Vehicles</span><strong>{fleet.taxis.length}</strong></article>
 <article><CarFront/><span>Active</span><strong>{activeCount}</strong></article>
 <article><Wrench/><span>Service</span><strong>{serviceCount}</strong></article>
 <article><CalendarDays/><span>Break</span><strong>{breakCount}</strong></article>
 </div>
 <div className="fleet-showroom-health">
 <div className="fleet-showroom-ring" style={{'--fleet-health':`${fleetHealth}%`} as React.CSSProperties}><span>Fleet Health</span><strong>{fleetHealth}%</strong></div>
 <div className="fleet-showroom-health-bars">
 <div><Fuel size={18}/><span>Fuel</span><strong>{averageFuel}%</strong><progress max={100} value={averageFuel}/></div>
 <div><Wrench size={18}/><span>Condition</span><strong>{averageCondition}%</strong><progress max={100} value={averageCondition}/></div>
 <div><CalendarDays size={18}/><span>On Schedule</span><strong>{onSchedule}%</strong><progress max={100} value={onSchedule}/></div>
 </div></div>
 <div className="fleet-showroom-profit"><div><span>Fleet operating profit · lifetime</span><strong>{eur(fleetOperatingProfit)}</strong><small>{totalTrips.toLocaleString('en-IE')} completed trips · before vehicle purchases and overhead</small></div><TrendingUp size={36}/></div>
 </div>
 <div className="fleet-metrics fleet-command-metrics"><article><small>TOTAL VEHICLES</small><strong>{fleet.taxis.length}</strong></article><article><small>ON THE ROAD</small><strong>{activeCount}</strong></article><article className="fleet-metric-warning"><small>NEED ATTENTION</small><strong>{fleet.taxis.filter(t=>needsService(t)||energyPercent(t)<=20||Boolean(t.recoveryPending)).length}</strong></article><article><small>OPERATING PROFIT*</small><strong>{eur(fleetOperatingProfit)}</strong></article></div><p className="fleet-metric-note">*Cumulative, before vehicle purchases and other company costs · {pending.length} awaiting delivery · {eur(company.cash)} available capital</p>
 <div className="fleet-legacy-tabs"><div className="fleet-tabs fleet-primary-tabs" role="tablist" aria-label="Fleet workspace"><button role="tab" aria-selected={tab==='fleet'} className={tab==='fleet'?'active':''} onClick={()=>setTab('fleet')}>My Fleet</button><button className={tab==='dealers'?'active':''} role="tab" aria-selected={tab==='dealers'} onClick={()=>setTab('dealers')}>Explorers</button></div></div>
 {tab==='fleet'?<><div className="fleet-subnav fleet-command-tabs" role="tablist" aria-label="Fleet sections"><button role="tab" aria-selected={fleetView==='vehicles'} className={fleetView==='vehicles'?'active':''} onClick={()=>{setFleetView('vehicles');setSelectedVehicle(null)}}>Vehicles</button><button role="tab" aria-selected={fleetView==='drivers'} className={fleetView==='drivers'?'active':''} onClick={()=>setFleetView('drivers')}>Drivers</button><button role="tab" aria-selected={fleetView==='service'} className={fleetView==='service'?'active':''} onClick={()=>setFleetView('service')}>Service</button><button role="tab" aria-selected={fleetView==='statistics'} className={fleetView==='statistics'?'active':''} onClick={()=>setFleetView('statistics')}>Analytics</button></div>
 {fleetView==='overview'&&<div className="fleet-showroom-list"><header><h2>Vehicles ({fleet.taxis.length})</h2><div><button aria-label="Search vehicles" onClick={()=>setFleetView('vehicles')}><Search size={19}/></button><button aria-label="Filter vehicles" onClick={()=>setFleetView('vehicles')}><SlidersHorizontal size={19}/></button></div></header>{fleet.taxis.map(t=><button className="fleet-showroom-vehicle" key={t.id} onClick={()=>{setFleetView('vehicles');setSelectedVehicle(t.id)}}><span className="fleet-showroom-vehicle-icon"><img src={`${import.meta.env.BASE_URL}assets/SimplePurpleCarTopView.svg`} alt="" loading="lazy" /></span><span className="fleet-showroom-vehicle-body"><strong>{t.vehicleModel??t.name}</strong><small><i/>{t.status.replaceAll('_',' ').toLowerCase()}</small><span className="fleet-showroom-vehicle-stats"><span><MapPin size={13}/>{(t.operatingKm??0).toFixed(1)} km</span><span><Fuel size={13}/>{Math.round(energyPercent(t))}%</span><span><Wrench size={13}/>{Math.round(t.vehicleCondition??100)}%</span></span></span><span className="fleet-showroom-vehicle-revenue">{eur(t.tripRevenue??0)}</span><ChevronRight size={18}/></button>)}</div>}
 {fleetView==='vehicles'&&<>{selectedVehicle&&<button className="fleet-back-button" onClick={()=>setSelectedVehicle(null)}>← Back to all vehicles</button>}<div className="fleet-section-heading"><div><h2>{selectedVehicle?"Vehicle profile":"Vehicles"}</h2><p>Search your fleet, review status and open a vehicle to manage it.</p></div><span className="fleet-count-label">{fleet.taxis.length} total</span></div>{!selectedVehicle&&<div className="fleet-toolbar"><label className="fleet-search"><span>Search vehicles</span><input type="search" value={vehicleQuery} onChange={e=>setVehicleQuery(e.target.value)} placeholder="Vehicle, model or driver…" /></label><div className="fleet-filter-pills" role="group" aria-label="Filter vehicles">{([['all','All'],['taxi','Taxis'],['explorer','Explorers'],['attention','Needs attention']] as const).map(([key,label])=><button key={key} aria-pressed={vehicleFilter===key} className={vehicleFilter===key?'active':''} onClick={()=>setVehicleFilter(key)}>{label}</button>)}</div></div>}{pending.length>0&&!selectedVehicle&&<div className="fleet-deliveries"><h3>🚚 Incoming deliveries</h3>{pending.map(t=><div key={t.id} className="delivery-row"><img src={`${import.meta.env.BASE_URL}assets/delivery_truck.svg`} alt="Delivery truck"/><div><strong>{t.vehicleModel??t.name}</strong><span>On the way to headquarters · {Math.ceil(((t.deliveryUntil??now)-now)/1000)}s remaining</span></div></div>)}</div>}
 {!selectedVehicle&&<div className="fleet-vehicle-list" aria-label="Fleet vehicle list">{visibleVehicles.map(t=>{
  const condition=Math.max(0,Math.min(100,t.vehicleCondition??100));
  const fuel=Math.max(0,Math.min(100,energyPercent(t)));
  const state=t.deliveryUntil&&t.deliveryUntil>now?'Delivering':t.status.replaceAll('_',' ').toLowerCase();
  const attention=needsService(t)||fuel<=20||Boolean(t.recoveryPending);
  return <article className={`fleet-vehicle-mini ${attention?'fleet-vehicle-mini-warning':''}`} key={t.id}>
   <div className="fleet-vehicle-mini-top">
    <span className="fleet-vehicle-mini-art"><AudiA5VehicleImage model={t.vehicleModel}
      optionIds={t.vehicleOptionIds} paintHex={t.vehiclePaintHex}
      fallbackSrc={`${import.meta.env.BASE_URL}assets/SimplePurpleCarTopView.svg`} alt=""
      className="te-audi-fleet-icon"/></span>
    <div className="fleet-vehicle-mini-info">
     <strong>{t.vehicleModel??t.name}</strong>
     <span>{t.name}{t.driver&&t.driver!=='—'?` · ${t.driver}`:''}</span>
     <small className={`fleet-vehicle-mini-status ${attention?'is-warning':t.status==='PAUSED'?'is-paused':'is-active'}`}><i aria-hidden="true"/>{state}</small>
    </div>
    <button className="fleet-vehicle-mini-open" type="button" aria-label={`Manage ${t.name}`} onClick={()=>setSelectedVehicle(t.id)}><ChevronRight size={19}/></button>
   </div>
   <div className="fleet-vehicle-mini-stats">
    <div><Wrench size={15}/><strong>{Math.round(condition)}%</strong><small>Condition</small></div>
    <div><Fuel size={15}/><strong>{Math.round(fuel)}%</strong><small>Fuel</small></div>
    <div><MapPin size={15}/><strong>{(t.operatingKm??0).toFixed(1)} km</strong><small>Distance</small></div>
   </div>
   <div className="fleet-vehicle-mini-footer">
    <div><small>Lifetime revenue</small><strong>{eur(t.tripRevenue??0)}</strong></div>
    <button type="button" onClick={()=>setSelectedVehicle(t.id)}>Manage vehicle <ChevronRight size={15}/></button>
   </div>
  </article>;
 })}</div>}
 <div className="fleet-cards fleet-cards-compact">{(selectedVehicle?visibleVehicles:[]).map(t=>{const profit=(t.tripRevenue??0)-(t.fuelExpense??0)-(t.maintenanceExpense??0)-(t.driverWages??0)-(t.insuranceExpense??0);return <article key={t.id} className={`fleet-compact-card ${needsService(t)||energyPercent(t)<=20?"fleet-card-alert":""}`}><div className="fleet-compact-heading"><div><strong>{t.kind==='explorer'?(t.explorerRole==='completion'?'🟢':t.explorerRole==='highway'?'🔵':t.explorerRole==='urban'?'🟠':t.explorerRole==='poi'?'🩵':'🟣'):'🚕'} {t.vehicleModel??t.name}</strong><small>{t.name} · {t.driver}</small>{t.explorerRole==='poi'&&<small>⚓ Destination: {t.poiTargetName??(t.poiTargetId?'Harbour '+t.poiTargetId:'Awaiting available harbour')}</small>}</div><span className="fleet-pill">{t.deliveryUntil&&t.deliveryUntil>now?'DELIVERING':(t.status==='SERVICING'?'SERVICING · WORKSHOP':t.status.replaceAll('_',' '))}</span></div><div className="fleet-profile-actions"><button type="button" onClick={()=>setSelectedVehicle(selectedVehicle===t.id?null:t.id)}>{selectedVehicle===t.id?"Close profile":"View profile →"}</button></div><div className="fleet-health-bars"><div><span>Condition</span><strong>{Math.round(t.vehicleCondition??100)}%</strong><progress max={100} value={Math.max(0,Math.min(100,t.vehicleCondition??100))}/></div><div><span>Energy</span><strong>{Math.round(energyPercent(t))}%</strong><progress max={100} value={Math.max(0,Math.min(100,energyPercent(t)))}/></div></div><div className="fleet-compact-stats"><div><small>Condition</small><strong>{(t.vehicleCondition??100).toFixed(1)}%{needsService(t)?' · Service due':''}</strong></div><div><small>Energy</small><strong>{energyPercent(t).toFixed(0)}%{energyPercent(t)<=20?' · Low':''}</strong></div><div><small>Remaining</small><strong>{energyRemaining(t).toFixed(1)} / {energySpec(t).capacity} {energySpec(t).unit}</strong></div><div><small>Consumption</small><strong>{energySpec(t).per100km.toFixed(1)} {energySpec(t).unit}/100 km</strong></div><div><small>Range</small><strong>{energyRangeKm(t).toFixed(1)} km</strong></div><div><small>Energy management</small><strong>{t.status==='REFUELLING'?'Refuelling / charging':t.refillDestination?(t.refillAtDepot?'Returning to depot':'Driving to station'):energyPercent(t)<=20?'Seeking fuel / charger':'Automatic at 10%'}</strong></div><div><small>Trips</small><strong>{t.completed}</strong></div><div><small>Distance</small><strong>{(t.operatingKm??0).toFixed(1)} km</strong></div></div><div className="fleet-compact-finance"><div><small>Revenue</small><strong>€{(t.tripRevenue??0).toFixed(2)}</strong></div><div><small>Operating profit</small><strong>€{profit.toFixed(2)}</strong></div></div><details className="fleet-compact-details" open={selectedVehicle===t.id?true:undefined}><summary>Manage vehicle <span aria-hidden="true">⌄</span></summary><div className="fleet-compact-details-body">{t.kind==='explorer'&&<p className="fleet-driver-label">{t.explorerRole==='completion'?'Road completion first · then block-by-block exploration':t.explorerRole==='highway'?'Highway and regional connections first':t.explorerRole==='urban'?'Urban streets first':t.explorerRole==='poi'?'Shortest routes to harbour POIs · all road types discovered':'Automatic block-by-block exploration'}</p>}<div className="fleet-compact-edit" style={{display:(t.kind==='explorer'||t.kind==='surveyor')?'none':undefined}}><select aria-label={`Driver for ${t.name}`} value={driverEdits[t.id]??''} onChange={e=>setDriverEdits(old=>({...old,[t.id]:e.target.value}))}><option value="">Select employed driver</option>{roster.filter(d=>d.name===t.driver||!assignedNames.has(d.name.toLowerCase())).map(d=><option key={d.id} value={d.name}>{d.name}</option>)}</select><button disabled={!driverEdits[t.id]||t.status!=='IDLE'||Boolean(t.deliveryUntil&&t.deliveryUntil>now)} onClick={()=>{onAssignDriver(t.id,driverEdits[t.id]??'');setDriverEdits(old=>({...old,[t.id]:''}));}}>Assign driver</button></div><dl><div><dt>Vehicle</dt><dd>{t.vehicleYear??'—'} · {t.vehicleFuel??'—'} · {t.vehicleClass??'Standard'}</dd></div><div><dt>Service status</dt><dd>{needsService(t)?'Service due':'Up to date'} · {t.serviceCount??0} completed</dd></div><div><dt>Driver experience</dt><dd>{driverLevel(roster.find(d=>d.name.toLowerCase()===t.driver.toLowerCase())?.completedTrips??0)} · {roster.find(d=>d.name.toLowerCase()===t.driver.toLowerCase())?.completedTrips??0} career trips</dd></div><div><dt>Since last service</dt><dd>{serviceDistance(t).toFixed(1)} / 250 km</dd></div><div><dt>Odometer</dt><dd>{(t.vehicleMileage??0).toLocaleString('en-IE')} km</dd></div><div><dt>Fuel / battery</dt><dd>{energyRemaining(t).toFixed(1)} / {energySpec(t).capacity} {energySpec(t).unit} · {energyRangeKm(t).toFixed(0)} km range</dd></div><div><dt>Fuel used</dt><dd>{(t.fuelLitres??0).toFixed(1)} L</dd></div><div><dt>Fuel &amp; maintenance</dt><dd>€{((t.fuelExpense??0)+(t.maintenanceExpense??0)).toFixed(2)}</dd></div><div><dt>Driver wages</dt><dd>€{(t.driverWages??0).toFixed(2)}</dd></div><div><dt>Insurance</dt><dd>€{(t.insuranceExpense??0).toFixed(2)}</dd></div>{t.status!=='IDLE'&&<div><dt>Current fare</dt><dd>€{t.fare.toFixed(2)}</dd></div>}</dl><button className="fleet-compact-service" disabled={t.status!=='IDLE'||Boolean(t.deliveryUntil&&t.deliveryUntil>now)||energyPercent(t)>=99.99} onClick={()=>onRefill(t.id)}>{energySpec(t).kind==='electric'?'Charge battery':'Refuel tank'} · est. {eur((energySpec(t).capacity-energyRemaining(t))*energySpec(t).pricePerUnit*((fleet.upgrades??[]).includes('fuel')?0.95:1))}</button><div><small>Estimated km to service</small><strong>{Math.max(0,Math.min(250-serviceDistance(t),((t.vehicleCondition??100)-(t.serviceThreshold??40))/0.025)).toFixed(0)} km</strong></div><label><input type="checkbox" checked={t.autoDepotService??false} onChange={e=>onAutoDepotService(t.id,e.target.checked)}/> Automatic servicing uses the main depot (preference saved)</label><label>Driving policy <select value={t.drivingPolicy??'balanced'} onChange={e=>onPolicy(t.id,e.target.value as 'economy'|'balanced'|'performance')}><option value="economy">Economy · lower consumption</option><option value="balanced">Balanced</option><option value="performance">Performance · quicker acceleration</option></select></label><label>Automatic service at condition <select value={t.serviceThreshold??40} onChange={e=>onServiceThreshold(t.id,Number(e.target.value))}>{[40,50,60,70,80,90].map(v=><option key={v} value={v}>{v}%</option>)}</select></label><button className="fleet-compact-service" disabled={Boolean(t.deliveryUntil&&t.deliveryUntil>now)||Boolean(t.recoveryPending)||recoveryRequests.includes(t.id)||recoveryJobs.some(j=>j.targetId===t.id)} onClick={()=>onRequestRecovery(t.id)}>🚚 {recoveryJobs.find(j=>j.targetId===t.id)?.phase==='transport'?'Recovery truck · Returning to depot':recoveryJobs.some(j=>j.targetId===t.id)?'Recovery truck dispatched':t.recoveryPending||recoveryRequests.includes(t.id)?'Recovery requested':'Request recovery truck'}</button><button className="fleet-compact-service" disabled={Boolean(t.deliveryUntil&&t.deliveryUntil>now)} onClick={()=>{if(window.confirm(`Reset ${t.name}'s current operation? This cancels its current operation, fully refuels/recharges and restores condition to 100%. Fuel/energy costs plus €150 servicing will be charged. Existing earnings and mileage are preserved.`))onReset(t.id)}}>Reset + refuel + full service (€150 + energy)</button><button className="fleet-compact-service" disabled={Boolean(t.deliveryUntil&&t.deliveryUntil>now)||(t.status!=='IDLE'&&t.status!=='PAUSED')} onClick={()=>{if(window.confirm(`Sell ${t.name}? This permanently removes the vehicle and credits its estimated resale value.`))onSell(t.id)}}>Sell vehicle · estimated {eur(Math.max(1000,Math.round(15000*Math.pow(.88,Math.max(0,new Date().getFullYear()-(t.vehicleYear??new Date().getFullYear())))*Math.pow(.92,(t.vehicleMileage??0)/30000)*(t.vehicleCondition??100)/100)))}</button><button className="fleet-compact-service" disabled={t.status!=='IDLE'||Boolean(t.deliveryUntil&&t.deliveryUntil>now)||company.cash<150} onClick={()=>onService(t.id)}>Service vehicle · €150 (+20 condition, reset interval)</button></div></details></article>})}</div>{!visibleVehicles.length&&<div className="fleet-empty-state"><strong>{fleet.taxis.length?'No matching vehicles':'Your fleet is empty'}</strong><p>{fleet.taxis.length?'Try another search or filter.':'Open the Marketplace to purchase your first vehicle.'}</p></div>}</>}{fleetView==='service'&&<section className="fleet-service-center"><header><h2>Maintenance centre</h2><p>Review service alerts, energy levels and recovery requests. Actions use your existing simulation rules.</p></header><div className="fleet-service-summary"><article><small>Service due</small><strong>{fleet.taxis.filter(t=>needsService(t)).length}</strong></article><article><small>Low energy (≤20%)</small><strong>{fleet.taxis.filter(t=>energyPercent(t)<=20).length}</strong></article><article><small>Recovery pending</small><strong>{fleet.taxis.filter(t=>t.recoveryPending||recoveryRequests.includes(t.id)||recoveryJobs.some(j=>j.targetId===t.id)).length}</strong></article></div>{fleet.taxis.filter(t=>needsService(t)||energyPercent(t)<=20||t.recoveryPending||recoveryRequests.includes(t.id)).map(t=><article key={t.id} className="fleet-service-item"><div><strong>{t.vehicleModel??t.name}</strong><small>{t.name} · {t.status.replaceAll('_',' ')}</small></div><div><small>Condition</small><strong>{Math.round(t.vehicleCondition??100)}%</strong></div><div><small>Energy</small><strong>{Math.round(energyPercent(t))}%</strong></div><div className="fleet-service-buttons"><button disabled={t.status!=='IDLE'||Boolean(t.deliveryUntil&&t.deliveryUntil>now)||company.cash<150} onClick={()=>onService(t.id)}>Service · €150</button><button disabled={t.status!=='IDLE'||Boolean(t.deliveryUntil&&t.deliveryUntil>now)||energyPercent(t)>=99.99} onClick={()=>onRefill(t.id)}>{energySpec(t).kind==='electric'?'Charge':'Refuel'}</button><button disabled={Boolean(t.deliveryUntil&&t.deliveryUntil>now)||Boolean(t.recoveryPending)||recoveryRequests.includes(t.id)||recoveryJobs.some(j=>j.targetId===t.id)} onClick={()=>onRequestRecovery(t.id)}>Recovery</button></div></article>)}{!fleet.taxis.some(t=>needsService(t)||energyPercent(t)<=20||t.recoveryPending||recoveryRequests.includes(t.id))&&<p className="fleet-empty-state">No vehicles currently need attention.</p>}</section>}{fleetView==='drivers'&&<section className="fleet-driver-roster fleet-drivers-modern">
 <div className="fleet-drivers-heading">
  <div><h2>Drivers</h2><span>{roster.length} employed · {roster.filter(d=>assignedNames.has(d.name.toLowerCase())).length} assigned</span></div>
  <button type="button" className="fleet-drivers-hire-toggle" aria-expanded={hireFormOpen} onClick={()=>setHireFormOpen(v=>!v)}><UserPlus size={16}/>{hireFormOpen?'Cancel':'Hire driver'}</button>
 </div>
 {hireFormOpen&&<form className="fleet-drivers-hire-form" onSubmit={e=>{e.preventDefault();if(!newHire.trim()||company.cash<DRIVER_COST)return;onHireDriver(newHire.trim());setNewHire('');setHireFormOpen(false)}}>
  <label htmlFor="fleet-new-hire-name">New employee</label>
  <div><input id="fleet-new-hire-name" autoComplete="off" placeholder="Driver name" value={newHire} onChange={e=>setNewHire(e.target.value)}/><button type="submit" disabled={!newHire.trim()||company.cash<DRIVER_COST}>Hire · {eur(DRIVER_COST)}</button></div>
  <small>Drivers can be assigned to idle taxis from the vehicle profile.</small>
 </form>}
 <div className="fleet-drivers-filters" role="group" aria-label="Filter drivers">
  {([['all','All'],['assigned','Assigned'],['available','Available']] as const).map(([value,label])=><button key={value} type="button" aria-pressed={driverFilter===value} className={driverFilter===value?'active':''} onClick={()=>setDriverFilter(value)}>{label}</button>)}
 </div>
 <div className="fleet-drivers-grid">
 {roster.filter(d=>driverFilter==='all'||(driverFilter==='assigned')===assignedNames.has(d.name.toLowerCase())).map(d=>{
  const assigned=fleet.taxis.find(t=>t.driver.toLowerCase()===d.name.toLowerCase());
  const trips=d.completedTrips??0,skill=driverSkill(trips),progress=skill===5?100:(trips%25)/25*100;
  const expanded=expandedDriverId===d.id;
  const income=d.revenueGenerated??0,wages=d.wagesEarned??0;
  return <article className={`fleet-driver-mini ${expanded?'expanded':''}`} key={d.id}>
   <div className="fleet-driver-mini-heading">
    <span className="fleet-driver-mini-avatar"><UserRound size={23}/></span>
    <div className="fleet-driver-mini-identity"><strong>{d.name}</strong><small className={assigned?'is-assigned':'is-available'}><i aria-hidden="true"/>{assigned?`Assigned · ${assigned.name}`:'Available for assignment'}</small></div>
    <span className="fleet-driver-mini-level">Skill {skill}/5</span>
   </div>
   <div className="fleet-driver-mini-metrics">
    <div><small>Trips</small><strong>{trips.toLocaleString('en-IE')}</strong></div>
    <div><small>Distance</small><strong>{(d.distanceKm??0).toFixed(1)} km</strong></div>
    <div><small>Career revenue</small><strong>{eur(income)}</strong></div>
   </div>
   <div className="fleet-driver-mini-progression">
    <div><span>{driverLevel(trips)}</span><small>{skill===5?'Max level':`${25-trips%25} trips to next skill`}</small></div>
    <progress max={100} value={progress} aria-label={`Skill progress for ${d.name}`}/>
   </div>
   <div className="fleet-driver-mini-bottom">
    <div><small>Revenue after wages</small><strong>{eur(income-wages)}</strong></div>
    <button type="button" aria-expanded={expanded} aria-controls={`driver-detail-${d.id}`} onClick={()=>setExpandedDriverId(expanded?null:d.id)}>{expanded?'Hide details':'Driver details'}{expanded?<ChevronUp size={16}/>:<ChevronDown size={16}/>}</button>
   </div>
   {expanded&&<div id={`driver-detail-${d.id}`} className="fleet-driver-mini-details">
    <div className="fleet-driver-mini-detail-grid">
     <div><small>Revenue / km</small><strong>{eur(income/Math.max(1,d.distanceKm??0))}</strong></div>
     <div><small>Wages earned</small><strong>{eur(wages)}</strong></div>
     <div><small>Experience premium</small><strong>{Math.round(Math.min(.20,Math.floor(trips/25)*.04)*100)}%</strong></div>
     <div><small>Skill progress</small><strong>{Math.round(progress)}%</strong></div>
    </div>
    <div className="fleet-driver-mini-bonuses"><span>Fuel −{Math.min(12,Math.floor(trips/25)*3)}%</span><span>Wear −{Math.min(15,Math.floor(trips/25)*3.75).toFixed(1)}%</span><span>Fare +{Math.min(8,Math.floor(trips/25)*2)}%</span></div>
    {assigned&&<p>To reassign this driver, open the vehicle profile when the taxi is idle.</p>}
    <button className="fleet-driver-mini-dismiss" type="button" disabled={Boolean(assigned)} onClick={()=>{onDismissDriver(d.id);setExpandedDriverId(null)}}>{assigned?'Assigned drivers cannot be dismissed':'Dismiss driver'}</button>
   </div>}
  </article>;
 })}
 </div>
 {!roster.length&&<p className="fleet-drivers-empty">No drivers employed. Hire a driver to get started.</p>}
 {roster.length>0&&!roster.some(d=>driverFilter==='all'||(driverFilter==='assigned')===assignedNames.has(d.name.toLowerCase()))&&<p className="fleet-drivers-empty">No drivers match this filter.</p>}
 </section>}{fleetView==='statistics'&&<section className="fleet-analytics-modern" aria-label="Fleet analytics">
 <header className="fleet-analytics-heading"><div><h2>Fleet analytics</h2><p>Lifetime vehicle performance</p></div><span>ALL TIME</span></header>
 <div className="fleet-analytics-main-metrics">
  <article className="fleet-analytics-revenue"><div className="fleet-analytics-metric-label"><TrendingUp size={17}/><span>Passenger revenue</span></div><strong>{eur(analyticsRevenue)}</strong><small>Earned from vehicle trips</small></article>
  <article className="fleet-analytics-profit"><div className="fleet-analytics-metric-label"><BarChart3 size={17}/><span>Operating profit</span></div><strong className={fleetOperatingProfit>=0?'positive':'negative'}>{eur(fleetOperatingProfit)}</strong><small>Before purchases and company overhead</small></article>
 </div>
 <div className="fleet-analytics-kpis">
  <article><Route size={18}/><strong>{analyticsDistance.toFixed(1)} km</strong><small>Distance driven</small></article>
  <article><CarFront size={18}/><strong>{fleet.completed.toLocaleString('en-IE')}</strong><small>Completed trips</small></article>
  <article><Gauge size={18}/><strong>{(fleet.distanceKm??0)>0?eur(fleet.revenue/(fleet.distanceKm??1))+'/km':'—'}</strong><small>Revenue per km</small></article>
  <article><Wrench size={18}/><strong className={analyticsAlerts?'warning':''}>{analyticsAlerts}</strong><small>Service alerts</small></article>
 </div>
 <section className="fleet-analytics-section">
  <div className="fleet-analytics-section-heading"><h3>Exploration</h3><span>All explorers</span></div>
  <div className="fleet-analytics-exploration">
   <article><MapPin size={19}/><div><small>New roads explored</small><strong>{analyticsUniqueRoads.toFixed(2)} km</strong></div></article>
   <article><Route size={19}/><div><small>Explorer distance</small><strong>{analyticsExplorerDistance.toFixed(2)} km</strong></div></article>
  </div>
 </section>
 <section className="fleet-analytics-utilization"><div><small>Passenger taxis available</small><strong>{analyticsAvailableTaxis} <span>/ {analyticsTotalTaxis}</span></strong><progress value={analyticsAvailableTaxis} max={Math.max(1,analyticsTotalTaxis)} aria-label="Available passenger taxis"/></div><div className="fleet-analytics-utilization-note">{analyticsTotalTaxis?Math.round(100*analyticsAvailableTaxis/analyticsTotalTaxis):0}% available now</div></section>
 <section className="fleet-analytics-section">
  <div className="fleet-analytics-section-heading"><h3>Vehicle performance</h3><span>{fleet.taxis.length} vehicles</span></div>
  <div className="fleet-analytics-sort" role="group" aria-label="Rank vehicles by">
   <button type="button" className={analyticsMetric==='revenue'?'active':''} aria-pressed={analyticsMetric==='revenue'} onClick={()=>setAnalyticsMetric('revenue')}>Revenue</button>
   <button type="button" className={analyticsMetric==='profit'?'active':''} aria-pressed={analyticsMetric==='profit'} onClick={()=>setAnalyticsMetric('profit')}>Profit</button>
  </div>
  <div className="fleet-analytics-vehicle-list">
   {(showAllAnalytics?analyticsVehicleRows:analyticsVehicleRows.slice(0,5)).map(({t,profit},index)=><button type="button" className="fleet-analytics-vehicle" key={t.id} onClick={()=>{setSelectedVehicle(t.id);setFleetView('vehicles')}} aria-label={`Manage ${t.name}`}>
    <span className="fleet-analytics-rank">{index+1}</span>
    <span className="fleet-analytics-vehicle-info"><strong>{t.vehicleModel??t.name}</strong><small>{t.name} · {t.completed} trips · {(t.operatingKm??0).toFixed(1)} km</small></span>
    <span className="fleet-analytics-vehicle-money"><strong className={analyticsMetric==='profit'&&profit<0?'negative':''}>{analyticsMetric==='profit'?eur(profit):eur(t.tripRevenue??0)}</strong><small>{analyticsMetric==='profit'?'Profit':'Revenue'}</small></span><ChevronRight size={16}/>
   </button>)}
   {!analyticsVehicleRows.length&&<p className="fleet-analytics-empty">No vehicles to compare yet.</p>}
  </div>
  {analyticsVehicleRows.length>5&&<button className="fleet-analytics-show-all" type="button" onClick={()=>setShowAllAnalytics(v=>!v)} aria-expanded={showAllAnalytics}>{showAllAnalytics?'Show top five':'Show all vehicles'}{showAllAnalytics?<ChevronUp size={15}/>:<ChevronDown size={15}/>}</button>}
 </section>
 <details className="fleet-analytics-advanced"><summary>Detailed vehicle report <ChevronDown size={16}/></summary>
  <p>Figures exclude one-off servicing and vehicle purchases.</p>
  <div className="fleet-stat-table"><table><thead><tr><th>Vehicle</th><th>Driver</th><th>Trips</th><th>Revenue</th><th>Operating profit*</th><th>Condition</th><th>Mileage</th><th>Service</th></tr></thead><tbody>{[...fleet.taxis].sort((a,b)=>(b.tripRevenue??0)-(a.tripRevenue??0)).map(t=><tr key={t.id}><td>{t.name}</td><td>{t.driver}</td><td>{t.completed}</td><td>{eur(t.tripRevenue??0)}</td><td>{eur((t.tripRevenue??0)-(t.fuelExpense??0)-(t.maintenanceExpense??0)-(t.driverWages??0)-(t.insuranceExpense??0))}</td><td>{(t.vehicleCondition??100).toFixed(1)}%{needsService(t)?' · Due':''}</td><td>{(t.operatingKm??0).toFixed(0)} km</td><td>{t.serviceThreshold??40}% threshold</td></tr>)}</tbody></table></div>
 </details>
 </section>}</>:
 <><div className="fleet-dealer-heading"><div><h2>Vehicle marketplace</h2><p>Purchase a taxi and select its delivery depot.</p></div><div className="fleet-filter">{(['All','New','Used'] as const).map(f=><button key={f} className={filter===f?'active':''} onClick={()=>setFilter(f)}>{f}</button>)}</div></div>
 <label className="fleet-driver-label">Delivery depot
 <select aria-label="Fleet marketplace delivery depot" value={deliveryDepotId} onChange={e=>setDeliveryDepotId(e.target.value)}>
  {parking.map(d=><option key={d.id} value={d.id}>{d.name} · {d.occupied}/{d.capacity} occupied</option>)}
 </select></label>
 <p className="fleet-note">{selectedParking?`${selectedParking.available} free taxi parking spaces · arriving vehicles already count toward the limit.`:'Choose an existing depot.'}</p>
 {parkingError&&<p className="dealer-parking-error" role="alert">{parkingError}</p>}
 {error&&<p className="dealer-parking-error" role="alert">{error}</p>}
 <label className="fleet-driver-label">Vehicles per order <input type="number" min={1} max={50} step={1} value={batchQuantity} onChange={e=>setBatchQuantity(Math.max(1,Math.min(50,Math.floor(Number(e.target.value)||1))))}/></label><p className="fleet-note">Each taxi receives a unique automatically generated driver name. Existing drivers are unchanged.</p>
 <div className="fleet-purchase-options"><label>Purchase method <select value={purchaseMode} onChange={e=>setPurchaseMode(e.target.value as typeof purchaseMode)}><option value="cash">Buy outright</option><option value="finance">Finance to own</option><option value="lease">Lease (return at term end)</option></select></label>{purchaseMode==='finance'&&<label>Deposit <select value={depositPercent} onChange={e=>setDepositPercent(Number(e.target.value))}>{[10,20,25,30,40,50].map(n=><option key={n} value={n}>{n}%</option>)}</select></label>}{purchaseMode!=='cash'&&<label>Term <select value={termDays} onChange={e=>setTermDays(Number(e.target.value))}>{FINANCE_TERMS.map(n=><option key={n} value={n}>{n} game days</option>)}</select></label>}</div>
 <p className="fleet-note">Delivery takes 90 real-world seconds for testing. Vehicles cannot accept jobs until arrival. Prices include a {eur(DRIVER_COST)} driver onboarding fee; research procurement discounts apply at checkout.</p>
 <div className="fleet-offers">{SPECIALIST_EXPLORERS.map(spec=>{
 const owned=fleet.taxis.some(t=>t.kind==='explorer'&&t.explorerRole===spec.role);
 return <article key={spec.role} className="fleet-offer">
  <div className="fleet-offer-header"><span className="fleet-pill">{spec.name}</span><span>Autonomous · Petrol</span></div>
  <div className="fleet-car-icon"><img src={`${import.meta.env.BASE_URL}assets/SimplePurpleCarTopView.svg`} alt={spec.name} style={{width:56,height:56,objectFit:'contain',filter:spec.role==='highway'?'hue-rotate(90deg)':spec.role==='secondary'?'hue-rotate(175deg)':spec.role==='residential'?'hue-rotate(255deg)':spec.role==='poi'?'hue-rotate(140deg)':'none'}}/></div>
  <h3>{spec.name}</h3><p>{spec.description}. Starts from purple discovered roads and shares the explored network. Hotels, parking and fuel journeys also reveal roads driven.</p>
  <div className="fleet-price"><strong>{owned?'Owned':'Free'}</strong><small>One specialist per road group</small></div>
  <button disabled={!graph||owned} onClick={()=>{onBuyRoadExplorer(spec.role);setTab('fleet')}}>{owned?'Explorer active':'Activate free explorer'}</button>
 </article>;
})}{OFFERS.filter(o=>filter==='All'||o.kind===filter).map(o=><article key={o.id} className="fleet-offer"><div className="fleet-offer-header"><span className="fleet-pill">{o.kind}</span><span>{o.className} · {o.fuel}</span></div><div className="fleet-car-icon">🚕</div><h3>{o.model}</h3><p>{o.year} · {o.mileage.toLocaleString('en-IE')} km · {o.seats} passenger seats</p><div className="fleet-condition"><span>Condition</span><strong>{o.condition}%</strong></div><div className="fleet-condition-bar"><i style={{width:`${o.condition}%`}}/></div><div className="fleet-price"><strong>{eur(o.price)}</strong><small>+ {eur(DRIVER_COST)} driver</small></div>{purchaseMode!=='cash'&&<p className="fleet-note">{purchaseMode==='finance'?<>Deposit {eur(financeQuote(o.price,depositPercent,termDays).deposit)} · Daily {eur(financeQuote(o.price,depositPercent,termDays).instalment)} · Total {eur(financeQuote(o.price,depositPercent,termDays).totalCost)}</>:<>Lease upfront {eur(leaseQuote(o.price,termDays).upfront)} · Daily {eur(leaseQuote(o.price,termDays).daily)} · Total {eur(leaseQuote(o.price,termDays).totalCost)} · No ownership</>}</p>}<button disabled={!graph||!!parkingError||(purchaseMode==='finance'&&batchQuantity>2)||(company.cash<batchQuantity*(purchaseMode==='cash'?o.price+DRIVER_COST:purchaseMode==='finance'?financeQuote(o.price,depositPercent,termDays).deposit+DRIVER_COST:leaseQuote(o.price,termDays).upfront+DRIVER_COST))} onClick={()=>onBuyBatch(o,batchQuantity,purchaseMode,depositPercent,termDays,deliveryDepotId)}>{purchaseMode==='lease'?'Lease':'Order'} {batchQuantity} × {o.model} · {eur(batchQuantity*(purchaseMode==='cash'?o.price+DRIVER_COST:purchaseMode==='finance'?financeQuote(o.price,depositPercent,termDays).deposit+DRIVER_COST:leaseQuote(o.price,termDays).upfront+DRIVER_COST))}</button></article>)}</div></>}
 </>}</section>;
}
