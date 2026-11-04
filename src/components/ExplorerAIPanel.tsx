import type {FleetState} from '../simulation/taxi';

const fmt=(n:number)=>n.toLocaleString('en-IE',{maximumFractionDigits:1});
export default function ExplorerAIPanel({fleet}:{fleet:FleetState}){
 const explorers=fleet.taxis.filter(t=>t.kind==='explorer');
 const stats=explorers.map(t=>{
  const newKm=Math.max(0,t.uniqueDiscoveredKm??0);
  const travelled=Math.max(0,t.discoveredKm??0);
  const revisitedKm=Math.max(0,travelled-newKm);
  return {taxi:t,newKm,revisitedKm,score:Math.round(newKm*50-revisitedKm*10),efficiency:travelled>0?Math.min(100,100*newKm/travelled):0};
 });
 const total=stats.reduce((a,s)=>a+s.score,0);
 return <section className="company-dashboard" style={{padding:24,maxWidth:1150,margin:'0 auto'}}>
  <header style={{marginBottom:24}}><span className="eyebrow">MANAGEMENT · ADAPTIVE EXPLORATION</span><h1>Explorer AI</h1><p>Reward new roads, penalise repeat travel and monitor the efficiency of Purple Road Explorers. Black Surveyors are excluded.</p></header>
  <div style={{display:'flex',flexWrap:'wrap',gap:12,marginBottom:24}}>
   {([['Purple explorers',String(explorers.length)],['Fleet AI score',(total>0?'+':'')+fmt(total)],['New roads',fmt(stats.reduce((a,s)=>a+s.newKm,0))+' km'],['Repeat travel',fmt(stats.reduce((a,s)=>a+s.revisitedKm,0))+' km']] as const).map(([label,value])=><article key={label} style={{flex:'1 1 150px',border:'1px solid #64748b55',borderRadius:12,padding:16}}><div style={{fontSize:12,opacity:.7}}>{label}</div><strong style={{fontSize:22}}>{value}</strong></article>)}
  </div>
  <h2 style={{fontSize:20}}>AI reward rules</h2>
  <p style={{opacity:.8}}>Explorers prefer routes with more undiscovered road and less transit over known roads. Necessary detours remain possible. These are performance points, not spendable research currency.</p>
  <div style={{display:'flex',gap:12,flexWrap:'wrap',margin:'14px 0 24px'}}><span style={{padding:12,border:'1px solid #64748b55',borderRadius:10}}>New road: <strong style={{color:'#22c55e'}}>+50 points/km</strong></span><span style={{padding:12,border:'1px solid #64748b55',borderRadius:10}}>Previously travelled: <strong style={{color:'#f59e0b'}}>−10 points/km</strong></span></div>
  <h2 style={{fontSize:20}}>Explorer performance</h2>
  <div style={{display:'grid',gap:12,marginTop:16}}>
   {stats.map(({taxi,newKm,revisitedKm,score,efficiency})=><article key={taxi.id} style={{border:'1px solid #64748b55',borderRadius:12,padding:18}}>
    <div style={{display:'flex',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}><strong>{taxi.name}</strong><strong style={{color:score>=0?'#22c55e':'#f59e0b'}}>{score>0?'+':''}{fmt(score)} points</strong></div>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))',gap:12,marginTop:16,fontSize:13}}>
     <span>New roads: <strong>{fmt(newKm)} km</strong></span><span>Repeat travel: <strong>{fmt(revisitedKm)} km</strong></span><span>Efficiency: <strong>{fmt(efficiency)}%</strong></span><span>Status: <strong>{taxi.status}</strong></span>
    </div>
    <div style={{height:9,background:'#64748b',borderRadius:6,overflow:'hidden',marginTop:14}}><div style={{height:'100%',width:`${efficiency}%`,background:'#16a34a'}}/></div>
   </article>)}
   {!explorers.length&&<p>No Purple Road Explorers yet. Purchase one in Fleet to start collecting exploration intelligence.</p>}
  </div>
  <p style={{opacity:.65,fontSize:12,marginTop:20}}>Historical statistics are derived from saved exploration distances. Route scoring is automatic; adaptive model training and an editable reward policy are not yet implemented.</p>
 </section>;
}
