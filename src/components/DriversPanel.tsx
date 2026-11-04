import type {FleetState} from '../simulation/taxi';
import type {GameClock} from '../simulation/gameClock';
import {driverLevel} from '../simulation/taxi';
import {driverSchedule,clockLabel} from '../simulation/driverSchedule';

type Props={fleet:FleetState;gameClock:GameClock|null};
const time=clockLabel;
const money=(n:number)=>new Intl.NumberFormat('en-IE',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(n);
export default function DriversPanel({fleet,gameClock}:Props){
 const taxis=fleet.taxis.filter(t=>!t.kind||t.kind==='taxi');
 const roster=fleet.drivers??[];
 const current=gameClock?.epochMs??Date.now();
 const active=taxis.filter(t=>{const s=driverSchedule(t,roster,current);return s.onDuty&&!s.onBreak&&!t.shiftParked;}).length;
 return <section className="company-dashboard" style={{padding:'24px',maxWidth:1150,margin:'0 auto'}}>
  <div style={{marginBottom:24}}><span className="eyebrow">FLEET MANAGEMENT · AUTOMATIC SCHEDULING</span><h1>Drivers</h1><p>Daily shifts, rest periods, breaks and driver performance. Times are in game time.</p></div>
  <div style={{display:'flex',flexWrap:'wrap',gap:12,marginBottom:24}}>
   {[[ 'Employed drivers',roster.length],['Passenger taxis',taxis.length],['Scheduled available',active],['Daily duty','12h'],['Daily break','30m']].map(([label,value])=><div key={label} style={{padding:16,border:'1px solid #64748b55',borderRadius:12,minWidth:135,flex:'1 1 135px'}}><div style={{fontSize:12,opacity:.7}}>{label}</div><strong style={{fontSize:23}}>{value}</strong></div>)}
  </div>
  <h2 style={{fontSize:20}}>24-hour driver schedules</h2>
  <p style={{opacity:.75}}>Preferences are assigned automatically and shifts are staggered. The yellow marker shows current game time. Breaks start 5h 45m into each duty period; active passenger trips finish first.</p>
  <div style={{display:'grid',gap:12,marginTop:16}}>
   {taxis.map(t=>{
    const s=schedule(t.id,current);
    const driver=roster.find(d=>d.name.toLowerCase()===t.driver.toLowerCase());
    const state=t.status==='TO_PICKUP'||t.status==='TO_DROPOFF'?'With passenger':t.status==='RETURNING'&&t.shiftParked?'Travelling to break/rest':t.status==='PAUSED'&&t.shiftParked?'Parked':s.onBreak?'Break due':!s.onDuty?'Off duty':t.status==='REFUELLING'?'Refuelling':t.status==='SERVICING'?'Servicing':'On duty';
    return <article key={t.id} style={{border:'1px solid #64748b55',borderRadius:12,padding:18}}>
     <div style={{display:'flex',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}><div><strong>{t.driver}</strong><div style={{fontSize:13,opacity:.7}}>{t.name} · {driverLevel(driver?.completedTrips??0)}</div></div><strong>{state}</strong></div>
     <div style={{fontSize:12,opacity:.75,marginTop:8}}>Automatic preference: <strong>{s.preference}</strong> · Game time: <strong>{time(s.current)}</strong></div>
     <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:12,marginTop:15,fontSize:13}}>
      <div>Shift: <strong>{time(s.start)}–{time(s.start+12)}</strong></div>
      <div>Break: <strong>{time(s.start+5.75)}–{time(s.start+6.25)}</strong></div>
      <div>Rest: <strong>{time(s.start+12)}–{time(s.start+24)}</strong></div>
      <div>Trips: <strong>{driver?.completedTrips??0}</strong></div>
      <div>Distance: <strong>{(driver?.distanceKm??0).toFixed(1)} km</strong></div>
      <div>Revenue: <strong>{money(driver?.revenueGenerated??0)}</strong></div>
     </div>
     <div aria-label="24-hour schedule with live game-time indicator" style={{position:'relative',height:16,borderRadius:8,marginTop:22,background:'#64748b'}}>
      {[[0,5.75,'#16a34a'],[5.75,6.25,'#eab308'],[6.25,12,'#16a34a']] .map(([from,to,color],i)=><div key={i} style={{position:'absolute',left:`${((Number(from)+s.start)%24)/24*100}%`,width:`${Math.min(Number(to)-Number(from),24-((Number(from)+s.start)%24))/24*100}%`,height:'100%',background:String(color),borderRadius:3}}/>)}
      {[[0,5.75,'#16a34a'],[5.75,6.25,'#eab308'],[6.25,12,'#16a34a']].map(([from,to,color],i)=>{const end=(Number(to)+s.start);return end>24?<div key={'wrap'+i} style={{position:'absolute',left:0,width:`${(end-24)/24*100}%`,height:'100%',background:String(color),borderRadius:3}}/>:null})}
      <div style={{position:'absolute',left:`${s.current/24*100}%`,top:-6,bottom:-6,width:3,background:'#facc15',border:'1px solid #fff',borderRadius:3,transform:'translateX(-50%)',boxShadow:'0 0 6px #facc15'}}/>
     </div><div style={{display:'flex',justifyContent:'space-between',fontSize:11,opacity:.7,marginTop:8}}><span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>24:00</span></div>
    </article>;
   })}
   {!taxis.length&&<p>No passenger taxis yet. Purchase a taxi and assign a driver to see its automatic schedule.</p>}
  </div>
  {roster.some(d=>!taxis.some(t=>t.driver.toLowerCase()===d.name.toLowerCase()))&&<section style={{marginTop:24}}><h2 style={{fontSize:20}}>Unassigned drivers</h2><p>{roster.filter(d=>!taxis.some(t=>t.driver.toLowerCase()===d.name.toLowerCase())).map(d=>d.name).join(', ')}</p></section>}
 </section>;
}
