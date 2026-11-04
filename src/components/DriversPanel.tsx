import type {FleetState} from '../simulation/taxi';
import type {GameClock} from '../simulation/gameClock';
import {driverLevel} from '../simulation/taxi';

type Props={fleet:FleetState;gameClock:GameClock|null};
const time=(hour:number)=>{const h=((hour%24)+24)%24;return String(Math.floor(h)).padStart(2,'0')+':'+String(Math.round((h%1)*60)%60).padStart(2,'0');};
function schedule(id:string,epochMs:number){
 let hash=0;for(const ch of id)hash=(Math.imul(hash,31)+ch.charCodeAt(0))|0;
 const start=(hash>>>0)%24;
 const current=((epochMs/3600000)%24+24)%24;
 const elapsed=(current-start+24)%24;
 return {start,elapsed,onDuty:elapsed<12,onBreak:elapsed>=5.75&&elapsed<6.25};
}
const money=(n:number)=>new Intl.NumberFormat('en-IE',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(n);
export default function DriversPanel({fleet,gameClock}:Props){
 const taxis=fleet.taxis.filter(t=>!t.kind||t.kind==='taxi');
 const roster=fleet.drivers??[];
 const current=gameClock?.epochMs??Date.now();
 const active=taxis.filter(t=>{const s=schedule(t.id,current);return s.onDuty&&!s.onBreak&&!t.shiftParked;}).length;
 return <section className="company-dashboard" style={{padding:'24px',maxWidth:1150,margin:'0 auto'}}>
  <div style={{marginBottom:24}}><span className="eyebrow">FLEET MANAGEMENT · AUTOMATIC SCHEDULING</span><h1>Drivers</h1><p>Daily shifts, rest periods, breaks and driver performance. Times are in game time.</p></div>
  <div style={{display:'flex',flexWrap:'wrap',gap:12,marginBottom:24}}>
   {[[ 'Employed drivers',roster.length],['Passenger taxis',taxis.length],['Scheduled available',active],['Daily duty','12h'],['Daily break','30m']].map(([label,value])=><div key={label} style={{padding:16,border:'1px solid #64748b55',borderRadius:12,minWidth:135,flex:'1 1 135px'}}><div style={{fontSize:12,opacity:.7}}>{label}</div><strong style={{fontSize:23}}>{value}</strong></div>)}
  </div>
  <h2 style={{fontSize:20}}>24-hour driver schedules</h2>
  <p style={{opacity:.75}}>Shifts are automatically staggered. Breaks start 5h 45m into each duty period; active passenger trips finish first.</p>
  <div style={{display:'grid',gap:12,marginTop:16}}>
   {taxis.map(t=>{
    const s=schedule(t.id,current);
    const driver=roster.find(d=>d.name.toLowerCase()===t.driver.toLowerCase());
    const state=t.status==='TO_PICKUP'||t.status==='TO_DROPOFF'?'With passenger':t.status==='RETURNING'&&t.shiftParked?'Travelling to break/rest':t.status==='PAUSED'&&t.shiftParked?'Parked':s.onBreak?'Break due':!s.onDuty?'Off duty':t.status==='REFUELLING'?'Refuelling':t.status==='SERVICING'?'Servicing':'On duty';
    return <article key={t.id} style={{border:'1px solid #64748b55',borderRadius:12,padding:18}}>
     <div style={{display:'flex',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}><div><strong>{t.driver}</strong><div style={{fontSize:13,opacity:.7}}>{t.name} · {driverLevel(driver?.completedTrips??0)}</div></div><strong>{state}</strong></div>
     <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:12,marginTop:15,fontSize:13}}>
      <div>Shift: <strong>{time(s.start)}–{time(s.start+12)}</strong></div>
      <div>Break: <strong>{time(s.start+5.75)}–{time(s.start+6.25)}</strong></div>
      <div>Rest: <strong>{time(s.start+12)}–{time(s.start+24)}</strong></div>
      <div>Trips: <strong>{driver?.completedTrips??0}</strong></div>
      <div>Distance: <strong>{(driver?.distanceKm??0).toFixed(1)} km</strong></div>
      <div>Revenue: <strong>{money(driver?.revenueGenerated??0)}</strong></div>
     </div>
     <div aria-label="24-hour schedule" style={{display:'flex',height:12,borderRadius:8,overflow:'hidden',marginTop:18}}>
      <div style={{width:'23.9583%',background:'#16a34a'}}/><div style={{width:'2.0834%',background:'#eab308'}}/><div style={{width:'23.9583%',background:'#16a34a'}}/><div style={{width:'50%',background:'#64748b'}}/>
     </div><div style={{display:'flex',justifyContent:'space-between',fontSize:11,opacity:.7,marginTop:5}}><span>Shift starts {time(s.start)}</span><span>Break</span><span>Rest starts {time(s.start+12)}</span></div>
    </article>;
   })}
   {!taxis.length&&<p>No passenger taxis yet. Purchase a taxi and assign a driver to see its automatic schedule.</p>}
  </div>
  {roster.some(d=>!taxis.some(t=>t.driver.toLowerCase()===d.name.toLowerCase()))&&<section style={{marginTop:24}}><h2 style={{fontSize:20}}>Unassigned drivers</h2><p>{roster.filter(d=>!taxis.some(t=>t.driver.toLowerCase()===d.name.toLowerCase())).map(d=>d.name).join(', ')}</p></section>}
 </section>;
}
