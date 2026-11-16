import {useMemo,useState} from 'react';
import {Activity,Compass,Route,Settings2,TrendingUp,Users,CarFront,Layers3,ChevronDown,ChevronUp,MapPin,Clock3,AlertTriangle} from 'lucide-react';
import {demandAt} from '../simulation/demand';
import {TAXI_DISPATCH_MODES,type TaxiDispatchMode} from '../simulation/taxiDispatchStrategy';
import type {FleetState,RoadGraph} from '../simulation/taxi';
import {explorerEfficiency,explorerRoleName,explorerSituation,reasonForExplorer,
 type ExplorerOperationsSnapshot,type ExplorerRecoveryEvent} from '../simulation/explorerOperations';
import './operations.css';
import './operations-floating.css';

type Tab='overview'|'exploration'|'diagnostics';
type Props={fleet:FleetState;graph:RoadGraph|null;missionCount:number;roadPackages:number;diagnostics:{queued:number;edges:number;workerEdges:number};error:string;gameNow?:number;explorerTelemetry?:ExplorerOperationsSnapshot|null;recoveryHistory?:ExplorerRecoveryEvent[];onLocateExplorer?:(id:string)=>void;taxiDispatchMode?:TaxiDispatchMode;onTaxiDispatchModeChange?:(mode:TaxiDispatchMode)=>void};
const money=(n:number)=>new Intl.NumberFormat('en-IE',{style:'currency',currency:'EUR'}).format(n);
const number=(n:number)=>new Intl.NumberFormat('en-IE').format(n);

export default function OperationsPanel({fleet,graph,missionCount,roadPackages,diagnostics,error,gameNow,explorerTelemetry=null,recoveryHistory=[],onLocateExplorer,taxiDispatchMode='balanced',onTaxiDispatchModeChange}:Props){
 const [tab,setTab]=useState<Tab>('overview');
 const [expandedExplorer,setExpandedExplorer]=useState<string|null>(null);
 const [explorerFilter,setExplorerFilter]=useState<'all'|'active'|'attention'>('all');
 const [showDispatchRules,setShowDispatchRules]=useState(false);
 const explorers=fleet.taxis.filter(t=>t.kind==='explorer');
 const taxis=fleet.taxis.filter(t=>!t.kind||t.kind==='taxi');
 const activeTaxis=taxis.filter(t=>t.status!=='IDLE'&&t.status!=='PAUSED').length;
 const demand=demandAt(gameNow??Date.now(),taxis.length);
 const coverage=useMemo(()=>{
  if(!graph)return null;
  const roads=new Set<string>();
  for(const links of graph.edges.values())for(const edge of links)roads.add(edge.id);
  if(!roads.size)return 0;
  const discovered=new Set(fleet.exploredEdgeIds??[]);
  let count=0;
  for(const id of roads)if(discovered.has(id))count++;
  return 100*count/roads.size;
 },[graph,fleet.exploredEdgeIds]);
 const uniqueKm=explorers.reduce((sum,t)=>sum+(t.uniqueDiscoveredKm??0),0);
 const travelledKm=explorers.reduce((sum,t)=>sum+(t.discoveredKm??0),0);
 const exploring=explorers.filter(t=>t.status==='EXPLORING').length;
 const efficiency=explorerEfficiency(uniqueKm,travelledKm);
 const liveById=new Map((explorerTelemetry?.vehicles??[]).map(item=>[item.id,item]));
 const vehicleRows=explorers.map(t=>{
  const live=liveById.get(t.id);
  return {t,live,situation:explorerSituation(t,live)};
 });
 const attentionCount=vehicleRows.filter(row=>
  row.situation.tone==='attention'||row.situation.label==='Loading roads').length;
 const visibleExplorers=vehicleRows.filter(row=>
  explorerFilter==='all'||explorerFilter==='active'&&
  (row.t.status==='EXPLORING'||row.t.status==='RETURNING'||!!row.t.ferryTrip)||
  explorerFilter==='attention'&&
  (row.situation.tone==='attention'||row.situation.label==='Loading roads'))
  .sort((a,b)=>
    Number(b.situation.tone==='attention')-Number(a.situation.tone==='attention')||
    Number(b.t.status==='EXPLORING')-Number(a.t.status==='EXPLORING')||
    a.t.name.localeCompare(b.t.name));
 const recentEvents=recoveryHistory.filter(event=>explorers.some(t=>t.id===event.vehicleId)).slice(0,5);
 return <section className="ops-page ops-v2" aria-label="Operations center">
  <header className="ops-head">
   <span className="ops-head-icon"><Activity size={23}/></span>
   <div><h1>Operations</h1><p>Live dispatch &amp; network</p></div>
  </header>
  <nav className="ops-tabs" role="tablist" aria-label="Operations sections">
   {([['overview','Overview',Activity],['exploration','Exploration',Compass],['diagnostics','Diagnostics',Settings2]] as const).map(([key,label,Icon])=>
    <button key={key} type="button" role="tab" aria-selected={tab===key} aria-label={label} className={tab===key?'active':''} onClick={()=>setTab(key)}><Icon size={19}/><span>{tab===key?label:''}</span></button>)}
  </nav>
  {error&&<div className="ops-alert" role="alert">{error}</div>}
  {tab==='overview'&&<div className="ops-content" role="tabpanel">
   <div className="ops-quick-stats" aria-label="Dispatch summary">
    <span><CarFront size={15}/><strong>{activeTaxis}</strong> active</span>
    <span><Users size={15}/><strong>{missionCount}</strong> requests</span>
    <span><strong>{number(fleet.completed)}</strong> trips</span>
   </div>
   <div className="ops-section-heading"><h2>Live operations</h2><small>{taxis.length} passenger taxis</small></div>
   <div className="ops-panel-grid">
    <article className="ops-card">
     <div className="ops-card-head"><div className="ops-card-label"><TrendingUp size={17}/><strong>Revenue</strong></div></div>
     <strong className="ops-card-emphasis">{money(fleet.revenue)}</strong>
     <span className="ops-card-note">Lifetime passenger fares</span>
    </article>
    <article className="ops-card">
     <div className="ops-card-head"><div className="ops-card-label"><Users size={17}/><strong>Demand</strong></div></div>
     <strong className="ops-card-emphasis">{demand.level}</strong>
     <span className="ops-card-note">{demand.fareMultiplier.toFixed(2)}× fare · {demand.weekend?'Weekend':'Weekday'}</span>
    </article>
   </div>
   <article className="ops-card">
    <div className="ops-card-head">
     <div className="ops-card-label"><Route size={17}/><strong>Discovered network</strong></div>
     <strong className="ops-card-emphasis">{coverage===null?'Loading':coverage.toFixed(1)+'%'}</strong>
    </div>
    <div className="ops-progress" role="progressbar" aria-label="Coverage of currently loaded roads" aria-valuenow={coverage??0} aria-valuemin={0} aria-valuemax={100}><div style={{width:`${Math.max(0,Math.min(100,coverage??0))}%`}}/></div>
    <div className="ops-card-row"><span>Discovered road IDs</span><strong>{number((fleet.exploredEdgeIds??[]).length)}</strong></div>
    <span className="ops-card-note">Coverage of loaded road data, not all roads in Greece.</span>
   </article>
   <article className="ops-card">
    <div className="ops-card-head">
     <div className="ops-card-label"><CarFront size={17}/><strong>Taxi Autopilot</strong></div>
     <span className="ops-card-note">Phase 1</span>
    </div>
    <div className="ops-dispatch-mode-switch" aria-label="Taxi dispatch strategy">
     {TAXI_DISPATCH_MODES.map(mode=><button key={mode} type="button"
      aria-pressed={taxiDispatchMode===mode} disabled={!onTaxiDispatchModeChange}
      className={taxiDispatchMode===mode?'active':''}
      onClick={()=>onTaxiDispatchModeChange?.(mode)}>{
       mode==='max-jobs'?'Maximum jobs':mode==='max-profit'?'Maximum profit':'Balanced'
      }</button>)}
    </div>
    <span className="ops-card-note">{
     taxiDispatchMode==='max-jobs'?'Prioritises the fastest legal pickup and accepts every feasible booking.':
     taxiDispatchMode==='max-profit'?'Prefers higher estimated contribution and declines low-margin requests.':
     'Balances passenger pickup times with estimated operating profit.'
    } Local, regional and intercity taxis use exactly the same road-speed rules.</span>
   </article>
   <button type="button" className="ops-detail-toggle" aria-expanded={showDispatchRules} onClick={()=>setShowDispatchRules(v=>!v)}>
    {showDispatchRules?'Hide dispatch details':'How dispatch works'}{showDispatchRules?<ChevronUp size={15}/>:<ChevronDown size={15}/>}
   </button>
   {showDispatchRules&&<div className="ops-card-note">Automatic dispatch runs while the game is open. Only discovered roads receive passenger requests. Waiting jobs are prioritised; the selected dispatch mode considers actual pickup time and estimated fuel, maintenance, wages and insurance. Requests expire after two minutes.</div>}
  </div>}
  {tab==='exploration'&&<div className="ops-content ops-explorer-workspace" role="tabpanel">
   <div className="ops-explorer-pulse" aria-label="Explorer fleet performance">
    <article><span>On missions</span><strong>{exploring}<small> / {explorers.length}</small></strong></article>
    <article><span>New roads</span><strong>{uniqueKm.toFixed(1)} <small>km</small></strong></article>
    <article><span>Efficiency</span><strong>{efficiency===null?'—':efficiency+'%'}</strong></article>
   </div>
   <div className="ops-explorer-overview-note">
    <span><Compass size={14}/> <strong>Autopilot 2.0</strong> · {explorerTelemetry?explorerTelemetry.poolWorkers>0?explorerTelemetry.poolWorkers+' planner workers':'Low-memory dispatch':'Connecting to dispatcher'}</span>
    <small>{attentionCount>0?attentionCount+' explorer'+(attentionCount===1?' needs':'s need')+' attention':'Live explorer operations'}</small>
   </div>
   <div className="ops-section-heading">
    <h2>Explorer fleet</h2>
    <small>{travelledKm.toFixed(1)} km total travel</small>
   </div>
   <div className="ops-explorer-filters" aria-label="Filter explorers">
    {(['all','active','attention'] as const).map(value=>
     <button key={value} type="button" aria-pressed={explorerFilter===value}
      className={explorerFilter===value?'active':''} onClick={()=>setExplorerFilter(value)}>
      {value==='all'?'All '+explorers.length:value==='active'?'Active':<><AlertTriangle size={13}/> Attention {attentionCount}</>}
     </button>)}
   </div>
   <div className="ops-explorer-list">
    {visibleExplorers.map(({t,live,situation})=>{
     const isExpanded=expandedExplorer===t.id;
     const vehicleEfficiency=explorerEfficiency(t.uniqueDiscoveredKm??0,t.discoveredKm??0);
     const events=recoveryHistory.filter(e=>e.vehicleId===t.id).slice(0,5);
     const left=Math.max(0,live?.remainingEdges??t.edgeIds.length-t.leg);
     return <article key={t.id} className="ops-explorer-mini ops-explorer-command">
      <div className="ops-explorer-head">
       <span className="ops-explorer-icon"><Compass size={19}/></span>
       <div className="ops-explorer-name">
        <strong>{t.name}</strong>
        <small>{explorerRoleName(t.explorerRole)}</small>
       </div>
       <span className={'ops-explorer-status ops-explorer-state-'+situation.tone}>{situation.label}</span>
      </div>
      <p className="ops-explorer-reason">{situation.detail}</p>
      <div className="ops-explorer-measures">
       <div><small>New roads</small><strong>{(t.uniqueDiscoveredKm??0).toFixed(2)} km</strong></div>
       <div><small>Driven</small><strong>{(t.discoveredKm??0).toFixed(1)} km</strong></div>
       <div><small>Efficiency</small><strong>{vehicleEfficiency===null?'—':vehicleEfficiency+'%'}</strong></div>
      </div>
      {t.status==='EXPLORING'&&<div className="ops-explorer-route-summary">
       <Route size={14}/><span>{t.poiTargetName?'Target: '+t.poiTargetName:'Active discovery mission'}</span>
       <strong>{left} segments left</strong>
      </div>}
      {isExpanded&&<div className="ops-explorer-inspector">
       <div className="ops-explorer-inspector-row"><span>Mission</span><strong>{live?.missionId!=null?'#'+live.missionId:t.status==='EXPLORING'?'In progress':'No active mission'}</strong></div>
       <div className="ops-explorer-inspector-row"><span>Route health</span><strong>{live?.savedRouteHealth==='valid'?'Connected and valid':live?.savedRouteHealth==='waiting-for-tiles'?'Waiting for loaded roads':live?.savedRouteHealth==='invalid'?'Needs recovery':explorerTelemetry?'No active route check':'Awaiting telemetry'}</strong></div>
       <div className="ops-explorer-inspector-row"><span>Next retry</span><strong>{live?.retryInMs?Math.ceil(live.retryInMs/1000)+'s':'—'}</strong></div>
       <div className="ops-explorer-inspector-row"><span>Search attempts</span><strong>{live?.planningAttempts??'—'}</strong></div>
       <div className="ops-explorer-inspector-row"><span>Operating spend</span><strong>{money(t.explorationExpense??0)}</strong></div>
       {live?.exhaustionProven&&<p className="ops-explorer-info">Connected road search completed · eligible for ferry consideration.</p>}
       {(live?.recoveryReason||live?.planningSkipReason)&&<p className="ops-explorer-info"><Clock3 size={13}/> {reasonForExplorer(live?.recoveryReason||live?.planningSkipReason)}</p>}
       <div className="ops-explorer-history">
        <strong>Recent recovery activity</strong>
        {events.length?events.map(event=><div key={event.id} className="ops-explorer-history-event">
         <time dateTime={new Date(event.at).toISOString()}>{new Date(event.at).toLocaleTimeString('en-IE',{hour:'2-digit',minute:'2-digit'})}</time>
         <span>{event.description}</span>
        </div>):<small>No recovery events recorded yet.</small>}
       </div>
      </div>}
      <div className="ops-explorer-actions">
       <button type="button" className="ops-detail-toggle" onClick={()=>setExpandedExplorer(isExpanded?null:t.id)}
        aria-expanded={isExpanded}>{isExpanded?'Less details':'Details'}{isExpanded?<ChevronUp size={15}/>:<ChevronDown size={15}/>}</button>
       {onLocateExplorer&&<button type="button" className="ops-detail-toggle ops-explorer-locate" onClick={()=>onLocateExplorer(t.id)}><MapPin size={15}/> Locate on map</button>}
      </div>
     </article>;
    })}
    {!explorers.length&&<p className="ops-empty">No explorers yet. Activate a specialist from Fleet to start discovering roads.</p>}
    {explorers.length>0&&visibleExplorers.length===0&&<p className="ops-empty">No explorers match this filter.</p>}
   </div>
   <details className="ops-card ops-advanced">
    <summary>Recovery history <span>{recentEvents.length?'Recent events':'No events yet'}</span><ChevronDown size={15}/></summary>
    <div className="ops-extra ops-explorer-history">
     {recentEvents.length?recentEvents.map(event=>{
      const vehicle=explorers.find(t=>t.id===event.vehicleId);
      return <div key={event.id} className="ops-explorer-history-event">
       <time dateTime={new Date(event.at).toISOString()}>{new Date(event.at).toLocaleTimeString('en-IE',{hour:'2-digit',minute:'2-digit'})}</time>
       <span><strong>{vehicle?.name??'Explorer'}</strong> · {event.description}</span>
      </div>;
     }):<small>Genuine recoveries and ferry-readiness events will appear here as they occur.</small>}
    </div>
   </details>
   <div className="ops-card-note">Efficiency = newly discovered kilometres ÷ explorer driving kilometres. Counts are from your fleet save; recovery events are stored per company. Live route details update as the dispatcher responds.</div>
  </div>}
  {tab==='diagnostics'&&<div className="ops-content" role="tabpanel">
   <div className="ops-section-heading"><h2>Network health</h2><small>Currently loaded data</small></div>
   <div className="ops-stats-mini">
    <article className="ops-stat-mini"><span>Road tiles</span><strong>{number(roadPackages)}</strong></article>
    <article className="ops-stat-mini"><span>Queued loads</span><strong>{number(diagnostics.queued)}</strong></article>
    <article className="ops-stat-mini"><span>Routing edges</span><strong>{number(diagnostics.edges)}</strong></article>
    <article className="ops-stat-mini"><span>Worker edges</span><strong>{number(diagnostics.workerEdges)}</strong></article>
   </div>
   <div className="ops-section-heading"><h2>Loaded graph</h2><Layers3 size={17}/></div>
   <div className="ops-diagnostic-list">
    <div className="ops-diagnostic-row"><span>Graph nodes</span><strong>{graph?number(graph.nodeKeys.length):'Loading'}</strong></div>
    <div className="ops-diagnostic-row"><span>Discovered road IDs</span><strong>{number((fleet.exploredEdgeIds??[]).length)}</strong></div>
    <div className="ops-diagnostic-row"><span>Loaded network coverage</span><strong>{coverage===null?'Loading':coverage.toFixed(1)+'%'}</strong></div>
    <div className="ops-diagnostic-row"><span>Dispatch</span><strong>Automatic</strong></div>
   </div>
   <details className="ops-card ops-advanced"><summary>Additional information <ChevronDown size={15}/></summary>
    <div className="ops-extra">
     <div className="ops-card-row"><span>Exploration spend</span><strong>{money(fleet.explorationExpense??0)}</strong></div>
     <div className="ops-card-row"><span>Loaded tile packages</span><strong>{number(roadPackages)}</strong></div>
     <span className="ops-card-note">Network figures change as vehicles travel and new road tiles load.</span>
    </div>
   </details>
  </div>}
 </section>;
}
