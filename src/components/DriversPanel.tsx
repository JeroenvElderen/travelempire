import {useState} from 'react';
import {CalendarDays,UsersRound,BarChart3,UserRound,CarFront,Clock3,Search,ChevronDown,ChevronUp,Route,Wallet,SlidersHorizontal} from 'lucide-react';
import type {FleetState,Taxi,DriverRecord} from '../simulation/taxi';
import type {DriverShiftPatch} from '../simulation/driverSchedule';
import type {GameClock} from '../simulation/gameClock';
import {driverLevel} from '../simulation/taxi';
import {driverSchedule,clockLabel} from '../simulation/driverSchedule';
import './drivers-floating.css';

type Props={fleet:FleetState;gameClock:GameClock|null;
 depots?:{id:string;name:string}[];
 onScheduleChange?:(driverId:string,patch:DriverShiftPatch)=>void;
 onHomeDepotChange?:(driverId:string,depotId:string)=>void;
 onAutoAssignmentChange?:(enabled:boolean)=>void;};
type Schedule=ReturnType<typeof driverSchedule>;
type ShiftPhase='duty'|'break'|'off';
type ShiftSegment={from:number;to:number;kind:'duty'|'break'};
const money=(n:number)=>new Intl.NumberFormat('en-IE',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(n);
const time=clockLabel;
function segmentsForDay(start:number,duration:number,breakStart:number):ShiftSegment[]{
 const source:ShiftSegment[]=[
  {from:start,to:start+breakStart,kind:'duty'},
  {from:start+breakStart,to:start+breakStart+.5,kind:'break'},
  {from:start+breakStart+.5,to:start+duration,kind:'duty'}
 ];
 return source.flatMap(segment=>{
  if(segment.from>=24)return [{...segment,from:segment.from-24,to:segment.to-24}];
  if(segment.to>24)return [
   {...segment,to:24},
   {...segment,from:0,to:segment.to-24}
  ];
  return [segment];
 });
}
function statusOf(t:Taxi,s:Schedule):{label:string;phase:ShiftPhase}{
 if(t.status==='TO_PICKUP'||t.status==='TO_DROPOFF')return {label:'With passenger',phase:s.onBreak?'break':s.onDuty?'duty':'off'};
 if(t.scheduledShiftParked&&t.status==='PAUSED')return {label:s.onBreak?'On break':'Off duty · parked',phase:s.onBreak?'break':'off'};
 if(t.status==='RETURNING'&&t.shiftParked)return {label:'Returning to rest',phase:s.onBreak?'break':'off'};
 if(t.status==='PAUSED'&&t.shiftParked)return {label:'Parked',phase:'off'};
 if(s.onBreak)return {label:'Scheduled break',phase:'break'};
 if(t.status==='REPOSITIONING')return {label:'Repositioning',phase:s.onDuty?'duty':'off'};
 if(!s.onDuty)return {label:'Off duty',phase:'off'};
 if(t.status==='REFUELLING')return {label:'Refuelling',phase:'duty'};
 if(t.status==='SERVICING')return {label:'Servicing',phase:'duty'};
 return {label:'On duty',phase:'duty'};
}
function Timeline({schedule,driverName}:{schedule:Schedule;driverName:string}){
 return <div className="drivers-timeline">
  <div className="drivers-timeline-track" role="img" aria-label={`${driverName}: shift ${time(schedule.start)}–${time(schedule.start+schedule.duration)}, break ${time(schedule.start+schedule.breakStart)}–${time(schedule.start+schedule.breakEnd)}. Current game time ${time(schedule.current)}`}>
   {segmentsForDay(schedule.start,schedule.duration,schedule.breakStart).map((segment,index)=><span key={index} className={`drivers-timeline-segment ${segment.kind}`} style={{left:`${segment.from/24*100}%`,width:`${(segment.to-segment.from)/24*100}%`}}/>)}
   <span className="drivers-timeline-now" style={{left:`${schedule.current/24*100}%`}}/>
  </div>
  <div className="drivers-timeline-hours"><span>00:00</span><span>12:00</span><span>24:00</span></div>
 </div>;
}
function DriverSettings({driver,depots,onScheduleChange,onHomeDepotChange}:{
 driver:DriverRecord;
 depots:{id:string;name:string}[];
 onScheduleChange?:Props['onScheduleChange'];
 onHomeDepotChange?:Props['onHomeDepotChange'];
}){
 const duration=driver.shiftDurationHours??12;
 const breakOptions=[2,3,4,5,5.75,6,7,8,9,10].filter(h=>h+.5<=duration);
 return <div className="drivers-roster-editor" aria-label={'Roster settings for '+driver.name}>
  <label>Shift starts
   <select aria-label={'Shift start for '+driver.name}
    value={driver.shiftStartHour??'auto'}
    onChange={e=>onScheduleChange?.(driver.id,{
     shiftStartHour:e.target.value==='auto'?undefined:Number(e.target.value),
    })} disabled={!onScheduleChange}>
    <option value="auto">Automatic</option>
    {Array.from({length:24},(_,i)=><option key={i} value={i}>{clockLabel(i)}</option>)}
   </select>
  </label>
  <label>Shift length
   <select aria-label={'Shift length for '+driver.name}
    value={duration} disabled={!onScheduleChange}
    onChange={e=>onScheduleChange?.(driver.id,{
     shiftDurationHours:Number(e.target.value),
    })}>
    {[6,7,8,9,10,11,12].map(hours=>
     <option key={hours} value={hours}>{hours} hours</option>)}
   </select>
  </label>
  <label>Break begins
   <select aria-label={'Break starts for '+driver.name}
    value={driver.shiftBreakAtHour??'auto'} disabled={!onScheduleChange}
    onChange={e=>onScheduleChange?.(driver.id,{
     shiftBreakAtHour:e.target.value==='auto'?undefined:Number(e.target.value),
    })}>
    <option value="auto">Automatic · 30 min</option>
    {breakOptions.map(h=><option key={h} value={h}>{h}h into shift</option>)}
   </select>
  </label>
  <label>Home depot
   <select aria-label={'Home depot for '+driver.name}
    value={driver.homeDepotId??'main'} disabled={!onHomeDepotChange}
    onChange={e=>onHomeDepotChange?.(driver.id,e.target.value)}>
    {depots.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
   </select>
  </label>
 </div>;
}
export default function DriversPanel({fleet,gameClock,depots=[],onScheduleChange,onHomeDepotChange,onAutoAssignmentChange}:Props){
 const [view,setView]=useState<'schedules'|'team'|'performance'>('schedules');
 const [filter,setFilter]=useState<'all'|'duty'|'break'|'off'>('all');
 const [query,setQuery]=useState('');
 const [filtersOpen,setFiltersOpen]=useState(false);
 const [expanded,setExpanded]=useState<string|null>(null);
 const [teamExpanded,setTeamExpanded]=useState<string|null>(null);
 const taxis=fleet.taxis.filter(t=>!t.kind||t.kind==='taxi');
 const roster=fleet.drivers??[];
 const current=gameClock?.epochMs??Date.now();
 const entries=taxis.map(t=>{
  const schedule=driverSchedule(t,roster,current);
  const driver=roster.find(d=>d.name.toLowerCase()===t.driver.toLowerCase());
  return {taxi:t,schedule,driver,status:statusOf(t,schedule)};
 });
 const active=entries.filter(e=>e.schedule.onDuty&&!e.schedule.onBreak&&!e.taxi.shiftParked).length;
 const breaks=entries.filter(e=>e.schedule.onBreak).length;
 const automated=roster.length>0&&fleet.autoDriverAssignment===true;
 const assignedNames=new Set(taxis.map(t=>t.driver.toLowerCase()));
 const unassigned=roster.filter(d=>!assignedNames.has(d.name.toLowerCase()));
 const visible=entries.filter(e=>(filter==='all'||e.status.phase===filter)&&
  (!query.trim()||[e.taxi.name,e.taxi.driver,e.driver?.name].some(v=>String(v??'').toLowerCase().includes(query.trim().toLowerCase()))));
 const tripCount=roster.reduce((n,d)=>n+(d.completedTrips??0),0);
 const distance=roster.reduce((n,d)=>n+(d.distanceKm??0),0);
 const revenue=roster.reduce((n,d)=>n+(d.revenueGenerated??0),0);
 return <section className="drivers-v2" aria-label="Driver schedules and performance">
  <header className="drivers-head"><span className="drivers-head-icon"><CalendarDays size={23}/></span><div><h1>Drivers</h1><p>Shifts &amp; team</p></div></header>
  <nav className="drivers-nav" aria-label="Drivers sections">
   {([['schedules','Schedules',CalendarDays],['team','Team',UsersRound],['performance','Analytics',BarChart3]] as const).map(([key,label,Icon])=>
    <button type="button" key={key} className={view===key?'active':''} aria-label={label} aria-current={view===key?'page':undefined} onClick={()=>setView(key)}><Icon size={19}/><span>{view===key?label:''}</span></button>)}
  </nav>
  {view==='schedules'&&<>
   <div className="drivers-automation-card">
    <div><strong>Automatic depot staffing</strong><p>When a taxi is idle at its home depot and its driver is off duty, an available on-duty driver from the same depot can take over. No mid-trip or remote swaps.</p></div>
    <button type="button" role="switch" aria-label="Automatic driver staffing"
     aria-checked={automated} className={automated?'active':''}
     onClick={()=>onAutoAssignmentChange?.(!automated)}
     disabled={!onAutoAssignmentChange||!roster.length}>{automated?'On':'Off'}</button>
   </div>
   <div className="drivers-quick-status" aria-label="Driver shift summary">
    <span><UsersRound size={15}/><strong>{roster.length}</strong> drivers</span>
    <span><CarFront size={15}/><strong>{taxis.length}</strong> taxis</span>
    <span><strong>{active}</strong> on shift</span>
   </div>
   <section className="drivers-section">
    <div className="drivers-section-header drivers-section-compact">
     <div><h2>Schedules</h2><small>{time(((current/3600000)%24+24)%24)} game time · 12h default</small></div>
     <button type="button" className={filtersOpen||filter!=='all'?'drivers-tools-toggle active':'drivers-tools-toggle'} aria-expanded={filtersOpen} aria-label="Search and filter schedules" onClick={()=>setFiltersOpen(v=>!v)}><SlidersHorizontal size={17}/>{filter==='all'?(query.trim()?'Search active':'Filter'):filter==='duty'?'On duty':filter==='break'?'Breaks':'Off duty'}</button>
    </div>
    {filtersOpen&&<div className="drivers-tools">
     <label className="drivers-search"><Search size={17}/><input type="search" value={query} onChange={e=>setQuery(e.target.value)} aria-label="Search drivers or taxis" placeholder="Find driver or taxi…"/></label>
     <div className="drivers-filters" role="group" aria-label="Filter schedules">
      {([['all','All'],['duty','On duty'],['break',`Breaks (${breaks})`],['off','Off duty']] as const).map(([key,label])=><button key={key} type="button" className={filter===key?'active':''} aria-pressed={filter===key} onClick={()=>setFilter(key)}>{label}</button>)}
     </div>
    </div>}
    <div className="drivers-list">
     {visible.map(({taxi,driver,schedule,status})=>{
      const isExpanded=expanded===taxi.id;
      return <article className="drivers-schedule-card" key={taxi.id}>
       <div className="drivers-card-head">
        <span className="drivers-card-avatar"><UserRound size={22}/></span>
        <div className="drivers-card-info"><strong>{taxi.driver}</strong><small>{taxi.name}</small></div>
        <span className={`drivers-status drivers-status-${status.phase}`}>{status.label}</span>
       </div>
       <div className="drivers-shift-meta"><span>{schedule.preference} shift</span><strong>{time(schedule.start)}–{time(schedule.start+schedule.duration)}</strong></div>
       <Timeline schedule={schedule} driverName={taxi.driver}/>
       <div className="drivers-schedule-actions">
        <span>Break {time(schedule.start+schedule.breakStart)}–{time(schedule.start+schedule.breakEnd)}</span>
        <button type="button" aria-expanded={isExpanded} onClick={()=>setExpanded(isExpanded?null:taxi.id)}>{isExpanded?'Less':'Details'}{isExpanded?<ChevronUp size={15}/>:<ChevronDown size={15}/>}</button>
       </div>
       {isExpanded&&<div className="drivers-card-expanded">
        <div><small>Rest</small><strong>{time(schedule.start+schedule.duration)}–{time(schedule.start+24)}</strong></div>
        <div><small>Level</small><strong>{driverLevel(driver?.completedTrips??0)}</strong></div>
        <div><small>Trips</small><strong>{driver?.completedTrips??0}</strong></div>
        <div><small>Distance</small><strong>{(driver?.distanceKm??0).toFixed(1)} km</strong></div>
        <div><small>Revenue</small><strong>{money(driver?.revenueGenerated??0)}</strong></div>
        {driver&&<DriverSettings driver={driver} depots={depots}
          onScheduleChange={onScheduleChange} onHomeDepotChange={onHomeDepotChange}/>}
       </div>}
      </article>;
     })}
     {!visible.length&&<p className="drivers-empty">{!taxis.length?'No passenger taxis yet. Purchase a taxi and assign a driver to see its automatic schedule.':'No schedules match the selected filter.'}</p>}
    </div>
   </section>
  </>}
  {view==='team'&&<section className="drivers-section">
   <div className="drivers-section-header"><h2>Driver roster</h2><span>{roster.length} employed</span></div>
   <p className="drivers-schedule-hint">Assign drivers to idle taxis in Fleet → Vehicles.</p>
   <div className="drivers-list">{roster.map(driver=>{
    const assigned=entries.find(e=>e.taxi.driver.toLowerCase()===driver.name.toLowerCase());
    return <article className="drivers-team-card" key={driver.id}>
     <span className="drivers-card-avatar"><UserRound size={22}/></span>
     <div className="drivers-team-card-body"><strong>{driver.name}</strong><small>{assigned?`Assigned to ${assigned.taxi.name}`:'Not assigned'} · {driverLevel(driver.completedTrips??0)}</small><small>{(driver.distanceKm??0).toFixed(1)} km · {driver.completedTrips??0} trips</small></div>
     <div className="drivers-team-controls">
      <span>{assigned?assigned.schedule.preference:'Available'}</span>
      <button type="button" aria-expanded={teamExpanded===driver.id}
       onClick={()=>setTeamExpanded(teamExpanded===driver.id?null:driver.id)}>
       {teamExpanded===driver.id?'Close':'Edit roster'}
      </button>
     </div>
     {teamExpanded===driver.id&&<DriverSettings driver={driver} depots={depots}
      onScheduleChange={onScheduleChange} onHomeDepotChange={onHomeDepotChange}/>}
    </article>;
   })}
   {!roster.length&&<p className="drivers-empty">No drivers employed yet. Hire drivers in Fleet → Drivers.</p>}
   </div>
   {unassigned.length>0&&<p className="drivers-schedule-hint">{unassigned.length} unassigned driver{unassigned.length===1?'':'s'} available for taxi assignment.</p>}
  </section>}
  {view==='performance'&&<section className="drivers-section">
   <div className="drivers-section-header"><h2>Driver performance</h2><span>Career totals</span></div>
   <div className="drivers-performance-grid">
    <article className="drivers-performance-card"><small>Completed trips</small><strong>{tripCount.toLocaleString('en-IE')}</strong><span>All employed drivers</span></article>
    <article className="drivers-performance-card"><small>Distance driven</small><strong>{distance.toFixed(1)} km</strong><span>Recorded driver kilometres</span></article>
    <article className="drivers-performance-card"><small>Passenger revenue</small><strong>{money(revenue)}</strong><span>Generated by drivers</span></article>
    <article className="drivers-performance-card"><small>Revenue per km</small><strong>{distance>0?money(revenue/distance):'—'}</strong><span>Career average</span></article>
   </div>
   <div className="drivers-section-header"><h2>Driver results</h2><span>{roster.length} drivers</span></div>
   <div className="drivers-list">{[...roster].sort((a,b)=>(b.revenueGenerated??0)-(a.revenueGenerated??0)).map(driver=><article className="drivers-stats-card" key={driver.id}>
    <strong>{driver.name}</strong>
    <div><span><Route size={13}/> Trips</span><strong>{driver.completedTrips??0}</strong></div>
    <div><span><Clock3 size={13}/> Distance</span><strong>{(driver.distanceKm??0).toFixed(1)} km</strong></div>
    <div><span><Wallet size={13}/> Revenue</span><strong>{money(driver.revenueGenerated??0)}</strong></div>
   </article>)}
   {!roster.length&&<p className="drivers-empty">No driver performance data yet.</p>}
   </div>
  </section>}
 </section>;
}
