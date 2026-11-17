import {useMemo} from 'react';
import {Activity,AlertCircle,Clock3,MapPin,Route,Users} from 'lucide-react';
import type {FleetState} from '../simulation/taxi';
import {transportAnalyticsReport} from '../simulation/transportAnalytics';
import type {TaxiAnalyticsRange} from '../simulation/taxiAnalytics';
import './transport-insights.css';

const money=(n:number)=>new Intl.NumberFormat('en-IE',{
 style:'currency',currency:'EUR',maximumFractionDigits:2,
}).format(n);
const numeral=(n:number)=>new Intl.NumberFormat('en-IE').format(n);
const duration=(seconds:number)=>seconds<60?
 Math.round(seconds)+' sec':seconds<3600?
 Math.round(seconds/60)+' min':(seconds/3600).toFixed(1)+' hrs';
type Props={fleet:FleetState;gameNow:number;range:TaxiAnalyticsRange};

/** Inside Operations -> Taxis, sharing the existing reporting-period controls.
 * The canonical finance/vehicle P&L remains in TaxiAnalyticsPanel.
 */
export default function PassengerTrafficInsightsPanel({fleet,gameNow,range}:Props){
 const day=Number.isFinite(gameNow)?new Date(gameNow).toISOString().slice(0,10):'';
 const report=useMemo(()=>transportAnalyticsReport(fleet.transportAnalytics,gameNow,range),
  // Recompute only on ledger changes or the selected simulated reporting day.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [fleet.transportAnalytics,range,day]);
 const maxCategoryRevenue=Math.max(1,...report.categories.map(row=>row.revenue));
 const completeCostQuotes=report.trips>0&&report.costQuotedTrips===report.trips;
 return <section className="te-transport-insights" aria-label="Passenger and traffic analytics">
  <div className="ops-section-heading">
   <h2>Passenger &amp; traffic insights</h2>
   <small>Completed journeys · {range==='today'?'Today':range==='7d'?'7 days':'30 days'}</small>
  </div>
  <div className="te-transport-metrics">
   <article><span><Users size={14}/> Completed fares</span>
    <strong>{numeral(report.trips)}</strong>
    <small>{money(report.revenue)} actually earned</small></article>
   <article><span><Activity size={14}/> Pickup satisfaction</span>
    <strong>{report.averageSatisfaction===null?'—':report.averageSatisfaction+'/100'}</strong>
    <small>{report.averageSatisfaction===null?'No rated pickups yet':'Measured at passenger boarding'}</small></article>
   <article><span><AlertCircle size={14}/> Missed bookings</span>
    <strong>{numeral(report.missed)}</strong>
    <small>Queued requests that expired</small></article>
   <article><span><Clock3 size={14}/> Estimated traffic delay</span>
    <strong>{report.trafficDelayTrips?duration(report.estimatedTrafficDelaySeconds):'—'}</strong>
    <small>{numeral(report.trafficDelayTrips)} completed routes assessed</small></article>
  </div>
  <div className="te-transport-traffic">
   <span><Route size={15}/> <strong>{numeral(report.reroutes)}</strong> successful traffic detours</span>
   <span><strong>{report.reroutes?duration(report.estimatedSecondsSaved):'—'}</strong> estimated journey time saved</span>
  </div>
  <article className="ops-card te-transport-panel">
   <div className="ops-card-head"><div className="ops-card-label"><Users size={16}/>
    <strong>Passenger categories</strong></div>
    <small>{numeral(report.trips)} paid journeys</small>
   </div>
   {!report.categories.length&&<div className="te-transport-empty">
    No classified journeys have completed in this period yet.
   </div>}
   {report.categories.map(category=><div key={category.id} className="te-transport-category">
    <div className="te-transport-category-top"><strong>{category.name}</strong>
     <span>{money(category.revenue)}</span></div>
    <div className="te-transport-meter" aria-label={category.name+' share of passenger revenue'}>
     <span style={{width:Math.round(category.revenue/maxCategoryRevenue*100)+'%'}}/></div>
    <div className="te-transport-breakdown">
     <span>{numeral(category.trips)} trips</span>
     <span>{numeral(category.missed)} missed</span>
     <span>{category.averageSatisfaction===null?'No ratings':category.averageSatisfaction+'/100 satisfaction'}</span>
     <span>{category.estimatedDirectContribution===null?'Cost estimate unavailable':
      money(category.estimatedDirectContribution)+' est. direct contribution'}</span>
    </div>
   </div>)}
  </article>
  <article className="ops-card te-transport-panel">
   <div className="ops-card-head"><div className="ops-card-label"><MapPin size={16}/>
    <strong>Pickup-region performance</strong></div>
    <small>Discovered-road markets</small></div>
   {!report.areas.length&&<div className="te-transport-empty">
    Completed passenger trips will reveal profitable regions here.
   </div>}
   <div className="te-transport-areas">
    {report.areas.map(area=><div className="te-transport-area" key={area.id}>
     <div><strong>{area.name}</strong>
      <small>{numeral(area.trips)} paid trips · {area.id==='other'?'Other areas':area.id}</small></div>
     <div><strong>{money(area.revenue)}</strong>
      <small>{area.estimatedDirectContribution===null?'No complete cost estimate':
       money(area.estimatedDirectContribution)+' est. direct contribution'}</small></div>
    </div>)}
   </div>
  </article>
  <p className="ops-taxi-data-note te-transport-disclaimer">
   Data collection begins with this update; older journeys are not reconstructed.
   Revenue is recorded only after payment at drop-off. Estimated direct
   contribution {completeCostQuotes?'uses paid fares minus dispatch-quoted operating costs':
   'appears only for journeys with complete cost estimates'} and is not the
   authoritative profit figure. Use the existing Taxi performance and Finance
   views for posted expenses and net profit. Traffic delay compares the
   discovered route at boarding with free-flow speed; it is a modelled
   estimate, not measured historic congestion. Missed bookings count
   actual queued expirations, not unavailable passenger demand.
  </p>
 </section>;
}
