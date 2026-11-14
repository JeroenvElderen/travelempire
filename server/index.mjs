import http from 'node:http';
import {randomUUID} from 'node:crypto';

// Infrastructure service only: do not invent taxi revenue or road discovery.
// Game simulation still runs in the browser until the authoritative state
// and road planner have been migrated to the backend.
const port=Number(process.env.PORT||3000);
const intervalMs=Math.max(1000,Number(process.env.TICK_INTERVAL_MS||10000));
const startedAt=Date.now();
let lastTickAt=Date.now(),ticks=0;
const instanceId=randomUUID();
const url=process.env.SUPABASE_URL?.replace(/\/$/,'');
const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
const heartbeatEnabled=Boolean(url&&key);
let lastHeartbeatError=null;
let busy=false;

async function heartbeat(){
 if(!heartbeatEnabled||busy)return;
 busy=true;
 try{
  const response=await fetch(url+'/rest/v1/server_heartbeat?on_conflict=service_name',{
   method:'POST',
   headers:{apikey:key,Authorization:'Bearer '+key,
    'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=minimal'},
   body:JSON.stringify({service_name:'travelempire-simulation',
    instance_id:instanceId,last_seen_at:new Date().toISOString(),tick_count:ticks})
  });
  if(!response.ok)throw new Error('Supabase heartbeat HTTP '+response.status+': '+(await response.text()).slice(0,300));
  lastHeartbeatError=null;
 }catch(error){lastHeartbeatError=String(error);console.error('[heartbeat]',lastHeartbeatError)}
 finally{busy=false}
}
setInterval(()=>{lastTickAt=Date.now();ticks++;void heartbeat()},intervalMs);
void heartbeat();
const server=http.createServer((req,res)=>{
 const pathname=new URL(req.url||'/', 'http://localhost').pathname;
 if(req.method!=='GET'||!['/','/health','/status'].includes(pathname)){
  res.writeHead(404,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'not-found'}));return;
 }
 const payload={service:'travelempire-simulation',status:'running',
  mode:'infrastructure-only',simulationActive:false,
  reason:'Authoritative company state and vehicle planner have not been migrated to the server',
  uptimeSeconds:Math.floor((Date.now()-startedAt)/1000),
  ticks,lastTickAt:new Date(lastTickAt).toISOString(),
  persistenceConfigured:heartbeatEnabled,heartbeatError:lastHeartbeatError};
 res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});
 res.end(JSON.stringify(payload));
});
server.listen(port,'0.0.0.0',()=>console.log('[TravelEmpire] Railway service listening on '+port));
process.on('SIGTERM',()=>server.close(()=>process.exit(0)));
