import {useMemo,useState} from 'react';
import {BarChart3,CarFront,ChevronDown,ChevronUp,Clock3,
 Gauge,MapPin,Route,Wallet} from 'lucide-react';
import type {FleetState} from '../simulation/taxi';
import PassengerTrafficInsightsPanel from './PassengerTrafficInsightsPanel';
import {TAXI_ANALYTICS_RANGES,taxiOperationsReport,
 type TaxiAnalyticsRange,type TaxiOperationsRow} from '../simulation/taxiAnalytics';

type Props={fleet:FleetState;gameNow:number};
const eur=(n:number)=>new Intl.NumberFormat('en-IE',{
 style:'currency',currency:'EUR',maximumFractionDigits:2,
}).format(Number.isFinite(n)?n:0);
const km=(n:number)=>n.toLocaleString('en-IE',{
 minimumFractionDigits:1,maximumFractionDigits:1,
})+' km';
const percent=(n:number|null)=>n===null?'—':n+'%';
const status=(row:TaxiOperationsRow)=>
 row.status==='TO_PICKUP'?'Collecting passenger':
 row.status==='TO_DROPOFF'?'With passenger':
 row.status==='REPOSITIONING'?'Repositioning':
 row.status==='IDLE'?'Available':
 row.status==='PAUSED'?'Off duty / resting':
 row.status.replaceAll('_',' ').toLowerCase();

export default function TaxiAnalyticsPanel({fleet,gameNow}:Props){
 const [range,setRange]=useState<TaxiAnalyticsRange>('7d');
 const [depotId,setDepotId]=useState('all');
 const [sortBy,setSortBy]=useState<'profit'|'revenue'|'distance'>('profit');
 const [expandedTaxi,setExpandedTaxi]=useState<string|null>(null);
 const day=new Date(Number.isFinite(gameNow)?gameNow:Date.now()).toISOString().slice(0,10);
 const report=useMemo(()=>taxiOperationsReport(fleet,gameNow,range),
  // Work with bounded existing game history; never examine the road graph.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [fleet.vehicleFinanceHistory,fleet.depotFinanceHistory,fleet.taxis,range,day]);
 const filtered=report.rows.filter(r=>depotId==='all'||r.depotId===depotId)
  .sort((a,b)=>sortBy==='profit'?b.net-a.net:
   sortBy==='revenue'?b.revenue-a.revenue:b.km-a.km);
 const maxDaily=Math.max(1,...report.daily.map(d=>Math.max(d.revenue,d.expenses)));
 const categories=[
  {name:'Fuel & charging',value:report.totalFuel},
  {name:'Vehicle maintenance',value:report.totalMaintenance},
  {name:'Driver wages',value:report.totalWages},
  {name:'Insurance',value:report.totalInsurance},
  {name:'Other / older records',value:report.totalOther},
 ];
 const periodLabel=range==='today'?'Today':range==='7d'?'Last 7 days':'Last 30 days';
 return <div className="ops-content ops-taxi-analytics" role="tabpanel"
  aria-label="Taxi financial and fleet analytics">
  <div className="ops-section-heading">
   <h2>Taxi performance</h2><small>Actual game ledger</small>
  </div>
  <div className="ops-taxi-period" role="group" aria-label="Taxi analytics reporting period">
   {TAXI_ANALYTICS_RANGES.map(option=><button type="button" key={option}
    aria-pressed={range===option} className={range===option?'active':''}
    onClick={()=>setRange(option)}>{
     option==='today'?'Today':option==='7d'?'7 days':'30 days'
    }</button>)}
  </div>
  <div className="ops-taxi-pulse">
   <article><small>Passenger revenue</small><strong>{eur(report.totalRevenue)}</strong>
    <span>{report.totalTrips.toLocaleString('en-IE')} completed trips</span></article>
   <article><small>Vehicle contribution</small>
    <strong className={report.totalNet<0?'negative':'positive'}>{eur(report.totalNet)}</strong>
    <span>After recorded vehicle costs</span></article>
   <article><small>Job utilisation</small><strong>{percent(report.utilisation)}</strong>
    <span>Service time / on-duty time</span></article>
   <article><small>Empty kilometres</small><strong>{
    report.hasDistanceMetrics?km(report.totalEmptyKm):'—'
   }</strong><span>{report.paidKmShare===null?'Not yet tracked':
    percent(report.paidKmShare)+' paid km share'}</span></article>
  </div>
  <p className="ops-taxi-data-note">
   {periodLabel} · {report.fromDay} – {report.toDay}. Vehicle contribution is
   passenger revenue minus actual recorded vehicle costs. It excludes depot
   overhead, finance, taxes and corporate expenses. Distance and utilisation
   tracking starts with Phase 4; older records are not estimated.
  </p>
  <PassengerTrafficInsightsPanel fleet={fleet} gameNow={gameNow} range={range}/>
  <article className="ops-card ops-taxi-trend">
   <div className="ops-card-head"><div className="ops-card-label"><BarChart3 size={17}/>
    <strong>Income vs. expenses</strong></div><small>{periodLabel}</small></div>
   <div className="ops-taxi-chart-legend">
    <span><i className="revenue"/>Revenue</span>
    <span><i className="expenses"/>Expenses</span></div>
   <div className="ops-taxi-chart" role="img" aria-label={
    'Daily passenger revenue and recorded taxi expenses over '+periodLabel.toLowerCase()}>
    {report.daily.map(d=><div className="ops-taxi-chart-column" key={d.day}
      title={d.day+': revenue '+eur(d.revenue)+', expenses '+eur(d.expenses)}>
      <div className="ops-taxi-chart-bars">
       <span className="revenue" style={{height:(d.revenue/maxDaily*100)+'%'}}/>
       <span className="expenses" style={{height:(d.expenses/maxDaily*100)+'%'}}/>
      </div>
      <small>{d.day.slice(5)}</small>
     </div>)}
   </div>
  </article>
  <article className="ops-card ops-taxi-costs">
   <div className="ops-card-head"><div className="ops-card-label"><Wallet size={17}/>
    <strong>Vehicle operating costs</strong></div><strong>{eur(report.totalExpenses)}</strong></div>
   {categories.map(c=><div className="ops-taxi-cost-row" key={c.name}>
    <div><span>{c.name}</span><strong>{eur(c.value)}</strong></div>
    <div className="ops-taxi-cost-meter"><span style={{width:
     (report.totalExpenses>0?Math.min(100,c.value/report.totalExpenses*100):0)+'%'}}/></div>
   </div>)}
   {!report.hasCostDetails&&<small className="ops-taxi-muted">
    Cost breakdown begins with Phase 4. Previous expenses appear under Other / older records.
   </small>}
  </article>
  <div className="ops-section-heading"><h2>Depot performance</h2>
   <small>{report.depots.length} depots</small></div>
  <div className="ops-taxi-depots">
   {report.depots.map(d=><article key={d.id} className="ops-taxi-depot">
    <div className="ops-taxi-depot-head"><span><MapPin size={15}/>{d.name}</span>
     <small>{d.taxiCount} taxis</small></div>
    <strong className={d.depotNet<0?'negative':'positive'}>{eur(d.depotNet)}</strong>
    <span>Depot operating net · all assigned vehicles</span>
    <div className="ops-taxi-depot-details">
     <div><small>Taxi contribution</small><strong>{eur(d.taxiContribution)}</strong></div>
     <div><small>Taxi revenue</small><strong>{eur(d.taxiRevenue)}</strong></div>
     <div><small>Facility + overhead</small><strong>{eur(d.facilityCost+d.allocatedOverhead)}</strong></div>
    </div>
   </article>)}
  </div>
  <p className="ops-taxi-data-note">Depot operating net includes explorers and
   other assigned vehicles, plus facility and allocated office overhead.
   Taxi contribution is reported separately.</p>
  <div className="ops-section-heading"><h2>Individual taxis</h2>
   <small>{filtered.length} vehicles</small></div>
  <div className="ops-taxi-controls">
   <label>Depot
    <select aria-label="Filter taxi analytics by depot" value={depotId}
     onChange={e=>setDepotId(e.target.value)}>
     <option value="all">All depots</option>
     {report.depots.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
    </select>
   </label>
   <label>Sort
    <select aria-label="Sort taxi analytics" value={sortBy}
     onChange={e=>setSortBy(e.target.value as typeof sortBy)}>
     <option value="profit">Highest contribution</option>
     <option value="revenue">Highest revenue</option>
     <option value="distance">Most kilometres</option>
    </select>
   </label>
  </div>
  <div className="ops-taxi-vehicles">
   {filtered.map(t=><article className="ops-taxi-vehicle" key={t.id}>
    <div className="ops-taxi-vehicle-head">
     <div><strong><CarFront size={15}/>{t.name}</strong>
      <small>{t.driver} · {status(t)}</small></div>
     <span className={t.net<0?'negative':'positive'}>{eur(t.net)}</span>
    </div>
    <div className="ops-taxi-vehicle-metrics">
     <div><small>Revenue</small><strong>{eur(t.revenue)}</strong></div>
     <div><small>Costs</small><strong>{eur(t.expenses)}</strong></div>
     <div><small>Trips</small><strong>{t.trips.toLocaleString('en-IE')}</strong></div>
     <div><small>Total distance</small><strong>{km(t.km)}</strong></div>
    </div>
    <button type="button" className="ops-taxi-expand"
     aria-expanded={expandedTaxi===t.id}
     onClick={()=>setExpandedTaxi(expandedTaxi===t.id?null:t.id)}>
     {expandedTaxi===t.id?'Hide details':'Distance & utilisation'}
     {expandedTaxi===t.id?<ChevronUp size={15}/>:<ChevronDown size={15}/>}
    </button>
    {expandedTaxi===t.id&&<div className="ops-taxi-vehicle-inspector">
     <div><span><Route size={13}/> Paid distance</span>
      <strong>{t.hasDistanceMetrics?km(t.passengerKm):'—'}</strong></div>
     <div><span>Empty distance</span>
      <strong>{t.hasDistanceMetrics?km(t.emptyKm):'—'}</strong></div>
     <div><span>Pickup distance</span>
      <strong>{t.hasDistanceMetrics?km(t.pickupKm):'—'}</strong></div>
     <div><span>Repositioning distance</span>
      <strong>{t.hasDistanceMetrics?km(t.repositionKm):'—'}</strong></div>
     <div><span><Gauge size={13}/> Job utilisation</span>
      <strong>{percent(t.utilisation)}</strong></div>
     <div><span>Passenger occupied time</span>
      <strong>{percent(t.occupiedShare)}</strong></div>
     <div><span><Clock3 size={13}/> On-duty time</span>
      <strong>{t.hasTimeMetrics?(t.onDutyGameSeconds/3600).toFixed(1)+' h':'—'}</strong></div>
     <div><span>Paid-km share</span><strong>{percent(t.paidKmShare)}</strong></div>
    </div>}
   </article>)}
   {!filtered.length&&<div className="ops-empty">
    No passenger taxis match this depot. Change the filter to view your fleet.
   </div>}
  </div>
  <p className="ops-taxi-data-note">Analytics use actual completed fares,
   posted costs and measured driving—not estimated booking prices. The game
   must be running for new driving activity to accrue.</p>
 </div>;
}
