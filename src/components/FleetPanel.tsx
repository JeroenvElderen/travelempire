import {useEffect,useState} from 'react';
import type {Company} from '../company';
import type {FleetState,RoadGraph} from '../simulation/taxi';
import {DRIVER_COST} from '../simulation/taxi';
import {OFFERS,eur,type VehicleOffer} from '../dealership';
import '../dealership.css';

type Props={company:Company|null;fleet:FleetState;graph:RoadGraph|null;onBuy:(driver:string,offer:VehicleOffer)=>void;onLocate?:(id:string)=>void};
export default function FleetPanel({company,fleet,graph,onBuy}:Props){
 const [tab,setTab]=useState<'fleet'|'dealers'>('fleet');const [driver,setDriver]=useState('');const [filter,setFilter]=useState<'All'|'New'|'Used'>('All');const [now,setNow]=useState(Date.now());
 useEffect(()=>{const id=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(id)},[]);
 const pending=fleet.taxis.filter(t=>t.deliveryUntil&&t.deliveryUntil>now);
 const ready=fleet.taxis.filter(t=>!t.deliveryUntil||t.deliveryUntil<=now);
 return <section className="company-dashboard fleet-v2"><span className="eyebrow">FLEET MANAGEMENT · DEALERSHIPS</span><h1>Fleet & Dealerships</h1>
 {!company?<p>Create a company first.</p>:<>
 <div className="fleet-metrics"><article><small>AVAILABLE CAPITAL</small><strong>{eur(company.cash)}</strong></article><article><small>OWNED TAXIS</small><strong>{fleet.taxis.length}</strong></article><article><small>ON DELIVERY</small><strong>{pending.length}</strong></article><article><small>ON DUTY</small><strong>{ready.filter(t=>t.status!=='IDLE').length}</strong></article></div>
 <div className="fleet-tabs"><button className={tab==='fleet'?'active':''} onClick={()=>setTab('fleet')}>My Fleet</button><button className={tab==='dealers'?'active':''} onClick={()=>setTab('dealers')}>Dealerships</button></div>
 {tab==='fleet'?<><h2>Company vehicles</h2>{pending.length>0&&<div className="fleet-deliveries"><h3>🚚 Incoming deliveries</h3>{pending.map(t=><div key={t.id} className="delivery-row"><img src={`${import.meta.env.BASE_URL}assets/delivery_truck.svg`} alt="Delivery truck"/><div><strong>{t.vehicleModel??t.name}</strong><span>On the way to headquarters · {Math.ceil(((t.deliveryUntil??now)-now)/1000)}s remaining</span></div></div>)}</div>}
 <div className="fleet-cards">{fleet.taxis.map(t=><article key={t.id}><div className="fleet-card-top"><strong>🚕 {t.vehicleModel??t.name}</strong><span className="fleet-pill">{t.deliveryUntil&&t.deliveryUntil>now?'DELIVERING':t.status.replaceAll('_',' ')}</span></div><span>{t.name} · Driver: {t.driver}</span><span>{t.vehicleYear??'—'} · {t.vehicleFuel??'—'} · {t.vehicleClass??'Standard'}</span><span>Condition: {t.vehicleCondition??100}% · Mileage: {(t.vehicleMileage??0).toLocaleString('en-IE')} km</span><span>Trips completed: {t.completed}</span>{t.status!=='IDLE'&&<span>Current fare: €{t.fare.toFixed(2)}</span>}</article>)}</div>{!fleet.taxis.length&&<p>No taxis yet. Open Dealerships to purchase your first vehicle.</p>}</>:
 <><div className="fleet-dealer-heading"><div><h2>Vehicle marketplace</h2><p>Purchase a taxi and arrange delivery to your headquarters.</p></div><div className="fleet-filter">{(['All','New','Used'] as const).map(f=><button key={f} className={filter===f?'active':''} onClick={()=>setFilter(f)}>{f}</button>)}</div></div>
 <label className="fleet-driver-label">Driver for the next purchase <input value={driver} onChange={e=>setDriver(e.target.value)} placeholder="Enter driver name"/></label>
 <p className="fleet-note">Delivery takes 90 real-world seconds for testing. Vehicles cannot accept jobs until arrival. Prices include a {eur(DRIVER_COST)} driver onboarding fee; research procurement discounts apply at checkout.</p>
 <div className="fleet-offers">{OFFERS.filter(o=>filter==='All'||o.kind===filter).map(o=><article key={o.id} className="fleet-offer"><div className="fleet-offer-header"><span className="fleet-pill">{o.kind}</span><span>{o.className} · {o.fuel}</span></div><div className="fleet-car-icon">🚕</div><h3>{o.model}</h3><p>{o.year} · {o.mileage.toLocaleString('en-IE')} km · {o.seats} passenger seats</p><div className="fleet-condition"><span>Condition</span><strong>{o.condition}%</strong></div><div className="fleet-condition-bar"><i style={{width:`${o.condition}%`}}/></div><div className="fleet-price"><strong>{eur(o.price)}</strong><small>+ {eur(DRIVER_COST)} driver</small></div><button disabled={!graph||!driver.trim()||company.cash<o.price+DRIVER_COST} onClick={()=>{onBuy(driver,o);setDriver('');setTab('fleet')}}>Purchase & arrange delivery</button></article>)}</div></>}
 </>}</section>;
}
