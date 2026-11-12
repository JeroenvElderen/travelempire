import http from 'node:http';
import {gunzipSync} from 'node:zlib';

const port=Number(process.env.PORT||3000);
const base=(process.env.ROAD_ASSET_BASE_URL||'').replace(/\/+$/,'');
const supabase=(process.env.SUPABASE_URL||'').replace(/\/+$/,'');
const maxTiles=Math.max(1,Math.min(16,Number(process.env.MAX_ROUTE_TILES||6)));
const maxCachedRoads=Math.max(10000,Math.min(600000,Number(process.env.MAX_CACHED_ROADS||160000)));
const maxBody=8192;
const maxPackageBytes=12*1024*1024;
const allowOrigin=process.env.CORS_ORIGIN||'';
const cache=new Map();
let cachedRoads=0,manifestPromise;
const counters={queries:0,hits:0,misses:0,evictions:0,routeFallbacks:0};

function json(res,status,data,origin){
 res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store',
  ...(origin?{'Access-Control-Allow-Origin':origin,'Vary':'Origin'}:{})});
 res.end(JSON.stringify(data));
}
function originFor(req){
 const origin=req.headers.origin;
 if(!origin)return '';
 if(!allowOrigin)return '';
 return allowOrigin.split(',').map(s=>s.trim()).includes(origin)?origin:'';
}
async function fetchBytes(url){
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),12000);
 try{
  const response=await fetch(url,{signal:controller.signal});
  if(!response.ok)throw Error('road asset HTTP '+response.status);
  const size=Number(response.headers.get('content-length')||0);
  if(size>maxPackageBytes)throw Error('road tile exceeds compressed size limit');
  const array=new Uint8Array(await response.arrayBuffer());
  if(array.byteLength>maxPackageBytes)throw Error('road tile exceeds compressed size limit');
  return array;
 }finally{clearTimeout(timeout);}
}
async function manifest(){
 if(!base)throw Error('ROAD_ASSET_BASE_URL is not configured');
 manifestPromise??=(async()=>{
  const response=await fetch(base+'/tiles-manifest.json');
  if(!response.ok)throw Error('manifest unavailable: HTTP '+response.status);
  const bundled=await response.json();
  if(!supabase)return bundled;
  try{
   const extra=await fetch(supabase+'/storage/v1/object/public/travelempire-road-tiles/supplemental-manifest.json');
   if(!extra.ok)return bundled;
   const supplemental=await extra.json();
   if(supplemental.tileSize!==bundled.tileSize||!supplemental.tiles)return bundled;
   return {...bundled,tiles:{...bundled.tiles,...supplemental.tiles}};
  }catch{return bundled;}
 })().catch(e=>{manifestPromise=undefined;throw e});
 return manifestPromise;
}
function keyOf(p,size){return Math.floor(p[0]/size)+'_'+Math.floor(p[1]/size);}
function tileKeys(from,to,size){
 const west=Math.min(from[0],to[0]),east=Math.max(from[0],to[0]);
 const south=Math.min(from[1],to[1]),north=Math.max(from[1],to[1]);
 // One cell of overlap is needed because an edge can cross tile boundaries.
 const x0=Math.floor(west/size)-1,x1=Math.floor(east/size)+1;
 const y0=Math.floor(south/size)-1,y1=Math.floor(north/size)+1;
 const count=(x1-x0+1)*(y1-y0+1);
 if(count>maxTiles)return null;
 const keys=[];
 for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++)keys.push(x+'_'+y);
 return keys;
}
async function loadTile(key,m){
 if(cache.has(key)){
  counters.hits++;const roads=cache.get(key);cache.delete(key);cache.set(key,roads);return roads;
 }
 counters.misses++;
 const entry=m.tiles[key];if(!entry)return [];
 const assetUrl=supabase
  ?supabase+'/storage/v1/object/public/travelempire-road-tiles/'+encodeURIComponent(entry.file)
  :base+'/tiles/'+encodeURIComponent(entry.file);
 const bytes=await fetchBytes(assetUrl);
 const decoded=gunzipSync(bytes,{maxOutputLength:48*1024*1024}).toString('utf8');
 const roads=decoded.split('\n').filter(Boolean).map(line=>JSON.parse(line));
 if(roads.length>maxCachedRoads)return roads; // too large to cache
 while(cache.size&&cachedRoads+roads.length>maxCachedRoads){
  const oldest=cache.keys().next().value;
  const removed=cache.get(oldest);cache.delete(oldest);cachedRoads-=removed.length;counters.evictions++;
 }
 cache.set(key,roads);cachedRoads+=roads.length;
 return roads;
}
function distance(a,b){
 const scale=Math.cos((a[1]+b[1])*Math.PI/360);
 return Math.hypot((a[0]-b[0])*111320*scale,(a[1]-b[1])*111320);
}
function addEdge(graph,from,to,r){
 let list=graph.edges.get(from);if(!list){list=[];graph.edges.set(from,list);}
 list.push({to,id:r.id,meters:r.length});
}
function graphFromTiles(tiles){
 const graph={nodes:new Map(),edges:new Map()};
 const seen=new Set();
 for(const roads of tiles)for(const r of roads){
  if(seen.has(r.id)||!r.coordinates||r.coordinates.length!==2||
   !Number.isFinite(r.length)||r.length<=0)continue;
  seen.add(r.id);
  const a=String(r.a),b=String(r.b);
  graph.nodes.set(a,r.coordinates[0]);graph.nodes.set(b,r.coordinates[1]);
  if(r.oneway!==-1)addEdge(graph,a,b,r);
  if(r.oneway!==1)addEdge(graph,b,a,r);
 }
 return graph;
}
function closestNode(nodes,point){
 let best=null,meters=Infinity;
 for(const [key,position] of nodes){
  const d=distance(point,position);
  if(d<meters){best=key;meters=d;}
 }
 return meters<=200?best:null;
}
function route(graph,from,to){
 const a=closestNode(graph.nodes,from),b=closestNode(graph.nodes,to);
 if(!a||!b)return null;
 if(a===b)return{path:[graph.nodes.get(a)],edgeIds:[],length:0};
 // Binary min-heap. The state tracks the previous node to avoid a legal
 // alternative road being replaced by an impossible immediate U-turn.
 const states=[{node:a,previous:'',cost:0,parent:-1,edge:''}];
 const best=new Map([[a+'|',0]]),heap=[0];
 const push=id=>{let i=heap.length;heap.push(id);while(i){const p=(i-1)>>1;
  if(states[heap[p]].cost<=states[id].cost)break;heap[i]=heap[p];i=p;}
  heap[i]=id;};
 const pop=()=>{
  const first=heap[0],last=heap.pop();if(!heap.length)return first;
  let i=0;while(2*i+1<heap.length){let child=2*i+1;
   if(child+1<heap.length&&states[heap[child+1]].cost<states[heap[child]].cost)child++;
   if(states[heap[child]].cost>=states[last].cost)break;heap[i]=heap[child];i=child;}
  heap[i]=last;return first;
 };
 let final=-1,visits=0;
 while(heap.length&&visits++<80000){
  const idx=pop(),s=states[idx];
  if(s.cost!==(best.get(s.node+'|'+s.previous)??Infinity))continue;
  if(s.node===b){final=idx;break;}
  const links=graph.edges.get(s.node)||[];
  for(const edge of links){
   if(edge.to===s.previous&&links.some(x=>x.to!==s.previous))continue;
   const cost=s.cost+edge.meters,signature=edge.to+'|'+s.node;
   if(cost>=(best.get(signature)??Infinity))continue;
   best.set(signature,cost);
   const id=states.length;states.push({node:edge.to,previous:s.node,cost,parent:idx,edge:edge.id});push(id);
  }
 }
 if(final<0)return null;
 const path=[],edgeIds=[];
 for(let i=final;i>=0;i=states[i].parent){
  path.push(graph.nodes.get(states[i].node));
  if(states[i].parent>=0)edgeIds.push(states[i].edge);
 }
 path.reverse();edgeIds.reverse();
 return{path,edgeIds,length:states[final].cost};
}
async function serveRoute(req,res,origin){
 let body='';
 for await(const chunk of req){
  body+=chunk;
  if(body.length>maxBody){json(res,413,{error:'request too large'},origin);return;}
 }
 let input;try{input=JSON.parse(body);}catch{json(res,400,{error:'invalid JSON'},origin);return;}
 const valid=p=>Array.isArray(p)&&p.length===2&&Number.isFinite(p[0])&&
  Number.isFinite(p[1])&&Math.abs(p[0])<=180&&Math.abs(p[1])<=90;
 if(!valid(input?.from)||!valid(input?.to)){json(res,400,{error:'from/to coordinates required'},origin);return;}
 if(input?.discoveredOnly){json(res,422,{error:'discovered-only routing remains local'},origin);return;}
 const m=await manifest(),keys=tileKeys(input.from,input.to,m.tileSize||0.1);
 if(!keys){counters.routeFallbacks++;json(res,422,{error:'route exceeds regional tile budget',fallback:true});return;}
 const tiles=await Promise.all(keys.map(key=>loadTile(key,m)));
 const graph=graphFromTiles(tiles);
 const result=route(graph,input.from,input.to);
 counters.queries++;
 if(!result){counters.routeFallbacks++;json(res,422,{error:'no complete regional route',fallback:true},origin);return;}
 json(res,200,{...result,regionTiles:keys.length,graphNodes:graph.nodes.size},origin);
}
const server=http.createServer(async(req,res)=>{
 const origin=originFor(req);
 if(req.method==='OPTIONS'){
  res.writeHead(origin?204:403,origin?{'Access-Control-Allow-Origin':origin,
   'Access-Control-Allow-Methods':'GET,POST,OPTIONS',
   'Access-Control-Allow-Headers':'Content-Type','Vary':'Origin'}:{});res.end();return;
 }
 try{
  if(req.method==='GET'&&req.url==='/health'){
   json(res,200,{ok:true,service:'travelempire-routing',configured:Boolean(base),
    cachedTiles:cache.size,cachedRoads,limits:{maxTiles,maxCachedRoads},...counters},origin);return;
  }
  if(req.method==='POST'&&req.url==='/v1/route'){
   if(!base){json(res,503,{error:'road asset URL not configured'},origin);return;}
   await serveRoute(req,res,origin);return;
  }
  json(res,404,{error:'not found'},origin);
 }catch(error){
  console.error('routing request failed:',error);
  json(res,503,{error:'routing backend unavailable',fallback:true},origin);
 }
});
server.listen(port,'0.0.0.0',()=>console.log('TravelEmpire routing listening on '+port));
