import {useMemo,useState} from 'react';
import {Activity,Compass,Route,Settings2,TrendingUp,Users,Wallet} from 'lucide-react';
import {demandAt} from '../simulation/demand';
import type {FleetState,RoadGraph} from '../simulation/taxi';
import './operations.css';

type Tab='overview'|'exploration'|'diagnostics';
type Props={fleet:FleetState;graph:RoadGraph|null;missionCount:number;roadPackages:number;diagnostics:{queued:number;edges:number;workerEdges:number};error:string;onExplorationMode:(id:string,mode:'local'|'frontier')=>void};
const money=(n:number)=>new Intl.NumberFormat('en-IE',{style:'currency',currency:'EUR'}).format(n);
const number=(n:number)=>new Intl.NumberFormat('en-IE').format(n);
function Stat({label,value,note}:{label:string;value:string|number;note?:string}){return <article className="ops-stat"><span>{label}</span><strong>{value}</strong>{note&&<small>{note}</small>}</article>}
export default function OperationsPanel({fleet,graph,missionCount,roadPackages,diagnostics,error,onExplorationMode}:Props){
 const [tab,setTab]=useState<Tab>('overview');
 const explorers=fleet.taxis.filter(t=>t.kind==='explorer'||t.kind==='surveyor');
 const taxis=fleet.taxis.filter(t=>!t.kind||t.kind==='taxi');
 const activeTaxis=taxis.filter(t=>t.status!=='IDLE'&&t.status!=='PAUSED').length;
 const demand=demandAt(Date.now(),taxis.length);
 const coverage=useMemo(()=>{
  if(!graph)return null;
  const roads=new Set<string>();for(const links of graph.edges.values())for(const edge of links)roads.add(edge.id);
  if(!roads.size)return 0;
  const discovered=new Set(fleet.exploredEdgeIds??[]);let count=0;for(const id of roads)if(discovered.has(id))count++;
  return 100*count/roads.size;
 },[graph,fleet.exploredEdgeIds]);
 const uniqueKm=explorers.reduce((sum,t)=>sum+(t.uniqueDiscoveredKm??0),0);
 const travelledKm=explorers.reduce((sum,t)=>sum+(t.discoveredKm??0),0);
 return <section className="company-dashboard ops-page">
  <div className="ops-heading"><div><span className="eyebrow">OPERATIONS CENTER · V2.1.2</span><h1>Operations</h1><p>Monitor dispatch, exploration and road-network health in one place.</p></div><span className="ops-live"><span className="ops-live-dot"/> SIMULATION ACTIVE WHILE OPEN</span></div>
  <div className="ops-tabs" role="tablist" aria-label="Operations sections">{([['overview','Overview',Activity],['exploration','Exploration',Compass],['diagnostics','Diagnostics',Settings2]] as const).map(([id,label,Icon])=><button key={id} role="tab" aria-selected={tab===id} className={tab===id?'active':''} onClick={()=>setTab(id)}><Icon size={16}/>{label}</button>)}</div>
  {error&&<div className="ops-alert" role="alert">{error}</div>}
  {tab==='overview'&&<div className="ops-content"><div className="ops-section-title"><div><TrendingUp size={19}/><h2>Dispatch overview</h2></div><span>Live operational totals</span></div>
   <div className="ops-stats"><Stat label="ACTIVE TAXIS" value={activeTaxis} note={`${taxis.length} passenger taxis owned`}/><Stat label="WAITING REQUESTS" value={missionCount} note="Requests expire after 2 minutes"/><Stat label="COMPLETED TRIPS" value={number(fleet.completed)} note="Lifetime total"/><Stat label="TRIP REVENUE" value={money(fleet.revenue)} note="Lifetime gross fares"/></div>
   <div className="ops-two-col"><article className="ops-panel"><div className="ops-panel-title"><Users size={19}/><h3>Passenger demand</h3></div><div className="ops-demand"><strong>{demand.level}</strong><span>{demand.weekend?'Weekend':'Weekday'} · Greece local time</span></div><div className="ops-detail"><span>Current fare multiplier</span><strong>{demand.fareMultiplier.toFixed(2)}×</strong></div><p>Passenger requests are prioritised by waiting time. Available taxis are assigned by estimated driving time on discovered roads.</p></article>
   <article className="ops-panel"><div className="ops-panel-title"><Route size={19}/><h3>Network reach</h3></div><div className="ops-demand"><strong>{coverage===null?'Loading':`${coverage.toFixed(1)}%`}</strong><span>Discovered roads in the currently loaded graph</span></div><div className="ops-progress"><div style={{width:`${coverage??0}%`}}/></div><div className="ops-detail"><span>Discovered road IDs</span><strong>{number((fleet.exploredEdgeIds??[]).length)}</strong></div><p>Coverage changes as new road tiles load; it is not a percentage of the entire country.</p></article></div>
   <div className="ops-note"><Activity size={18}/><span>Automatic dispatch runs while the game is open. Only discovered roads can receive passenger requests.</span></div>
  </div>}
  {tab==='exploration'&&<div className="ops-content"><div className="ops-section-title"><div><Compass size={19}/><h2>Exploration control</h2></div><span>Dedicated explorer vehicles</span></div>
   <div className="ops-stats"><Stat label="EXPLORERS OWNED" value={explorers.length}/><Stat label="CURRENTLY EXPLORING" value={explorers.filter(t=>t.status==='EXPLORING').length}/><Stat label="NEW ROAD DISTANCE" value={`${uniqueKm.toFixed(2)} km`} note="Recorded since v2.0.9"/><Stat label="EXPLORATION SPEND" value={money(fleet.explorationExpense??0)}/></div>
   <div className="ops-section-title"><div><Route size={19}/><h2>Explorer priorities</h2></div><span>{travelledKm.toFixed(1)} km exploration driving</span></div>
   {explorers.length?<div className="ops-explorer-grid">{explorers.map(t=><article className="ops-explorer" key={t.id}><div className="ops-explorer-top"><div className={t.kind==='surveyor'?'ops-vehicle-icon black':'ops-vehicle-icon purple'}>{t.kind==='surveyor'?'●':'◆'}</div><div><h3>{t.name}</h3><small>{t.kind==='surveyor'?'Territory surveyor · 150 m corridors':'Road discovery explorer'}</small></div><span className="ops-status">{t.status.replaceAll('_',' ')}</span></div><div className="ops-explorer-stats"><div><small>New roads</small><strong>{(t.uniqueDiscoveredKm??0).toFixed(2)} km</strong></div><div><small>Distance driven</small><strong>{(t.discoveredKm??0).toFixed(1)} km</strong></div><div><small>Operating spend</small><strong>{money(t.explorationExpense??0)}</strong></div></div><label className="ops-mode-label">Exploration priority<select value={t.explorationMode??'local'} onChange={e=>onExplorationMode(t.id,e.target.value as 'local'|'frontier')}><option value="local">Nearby roads</option><option value="frontier">Expand frontier</option></select></label></article>)}</div>:<div className="ops-empty">No explorer vehicles yet. Purchase an Explorer from Fleet → Marketplace to start discovering roads.</div>}
   <div className="ops-note"><Compass size={18}/><span>Black Explorers reveal territory corridors. Purple Explorers discover roads inside surveyed territory. Taxis do not explore.</span></div>
  </div>}
  {tab==='diagnostics'&&<div className="ops-content"><div className="ops-section-title"><div><Settings2 size={19}/><h2>Network diagnostics</h2></div><span>Technical information</span></div>
   <div className="ops-stats"><Stat label="LOADED ROAD TILES" value={number(roadPackages)}/><Stat label="QUEUED TILE LOADS" value={number(diagnostics.queued)}/><Stat label="ROUTING EDGES" value={number(diagnostics.edges)}/><Stat label="WORKER EDGES" value={number(diagnostics.workerEdges)}/></div>
   <div className="ops-two-col"><article className="ops-panel"><div className="ops-panel-title"><Route size={19}/><h3>Loaded road graph</h3></div><div className="ops-detail"><span>Graph nodes</span><strong>{graph?number(graph.nodeKeys.length):'Loading'}</strong></div><div className="ops-detail"><span>Discovered road IDs</span><strong>{number((fleet.exploredEdgeIds??[]).length)}</strong></div><div className="ops-detail"><span>Coverage of loaded roads</span><strong>{coverage===null?'Loading':`${coverage.toFixed(1)}%`}</strong></div></article><article className="ops-panel"><div className="ops-panel-title"><Wallet size={19}/><h3>Simulation status</h3></div><div className="ops-detail"><span>Dispatch</span><strong>Automatic</strong></div><div className="ops-detail"><span>Exploration spend</span><strong>{money(fleet.explorationExpense??0)}</strong></div><div className="ops-detail"><span>Loaded tile packages</span><strong>{number(roadPackages)}</strong></div></article></div>
   <div className="ops-note"><Activity size={18}/><span>These figures describe currently loaded data and may change as vehicles travel and additional road tiles stream in.</span></div>
  </div>}
 </section>;
}
