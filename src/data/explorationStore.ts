// IndexedDB stores exploration independently of the limited localStorage fleet save.
export type Segment=[[number,number],[number,number]];
const DB='travelempire-exploration-v1';
const STORE='companies';
export type ExplorationRecord={ids:string[];segments:Record<string,Segment[]>};
function openDB():Promise<IDBDatabase>{return new Promise((resolve,reject)=>{const request=indexedDB.open(DB,1);request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(STORE))request.result.createObjectStore(STORE)};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
export async function readExploration(id:string):Promise<ExplorationRecord|null>{const db=await openDB();try{return await new Promise((resolve,reject)=>{const request=db.transaction(STORE,'readonly').objectStore(STORE).get(id);request.onsuccess=()=>resolve(request.result??null);request.onerror=()=>reject(request.error);});}finally{db.close();}}
export async function writeExploration(id:string,record:ExplorationRecord):Promise<void>{const db=await openDB();try{await new Promise<void>((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');const store=tx.objectStore(STORE);const get=store.get(id);get.onsuccess=()=>{const old=get.result as ExplorationRecord|undefined;store.put({ids:[...new Set([...(old?.ids??[]),...record.ids])],segments:{...(old?.segments??{}),...record.segments}},id);};tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}finally{db.close();}}
export async function clearExploration(id:string):Promise<void>{const db=await openDB();try{await new Promise<void>((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).delete(id);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});}finally{db.close();}}

/**
 * Optional Supabase cloud backup. Uses Supabase anonymous Auth + RLS; never
 * expose a service_role key in Vite. Anonymous identities are browser-bound.
 * Cloud is additive: IndexedDB remains the immediate source for rendering.
 */
const CLOUD_URL=(import.meta.env.VITE_SUPABASE_URL as string|undefined)?.replace(/\/$/,'');
const CLOUD_KEY=import.meta.env.VITE_SUPABASE_ANON_KEY as string|undefined;
const TOKEN_KEY='travelempire.exploration.auth.v1';
type Session={access_token:string;refresh_token:string;expires_at:number};
let sessionTask:Promise<Session|null>|null=null;
function savedSession():Session|null{try{return JSON.parse(localStorage.getItem(TOKEN_KEY)??'null') as Session|null;}catch{return null;}}
function storeSession(payload:{access_token:string;refresh_token:string;expires_in:number}):Session{
 const session={access_token:payload.access_token,refresh_token:payload.refresh_token,expires_at:Date.now()+payload.expires_in*1000};
 localStorage.setItem(TOKEN_KEY,JSON.stringify(session));return session;
}
async function cloudSession():Promise<Session|null>{
 if(!CLOUD_URL||!CLOUD_KEY)return null;
 if(sessionTask)return sessionTask;
 sessionTask=(async()=>{
  const saved=savedSession();
  if(saved&&saved.expires_at>Date.now()+60000)return saved;
  const refresh=Boolean(saved?.refresh_token);
  const endpoint=refresh?'/auth/v1/token?grant_type=refresh_token':'/auth/v1/signup';
  const response=await fetch(CLOUD_URL+endpoint,{method:'POST',headers:{apikey:CLOUD_KEY,'Content-Type':'application/json'},body:JSON.stringify(refresh?{refresh_token:saved!.refresh_token}:{data:{source:'travelempire'}})});
  if(!response.ok)throw Error('Supabase authentication failed ('+response.status+'). Enable anonymous sign-ins in Supabase Auth.');
  return storeSession(await response.json() as {access_token:string;refresh_token:string;expires_in:number});
 })().finally(()=>{sessionTask=null;});
 return sessionTask;
}
type CloudRow={road_id:string;segments:Segment[]};
async function cloudRequest(session:Session,path:string,options:RequestInit={}):Promise<Response>{
 const response=await fetch(CLOUD_URL+'/rest/v1/'+path,{...options,headers:{apikey:CLOUD_KEY!,Authorization:'Bearer '+session.access_token,...options.headers}});
 if(!response.ok)throw Error('Supabase exploration request failed: '+response.status+' '+(await response.text()).slice(0,180));
 return response;
}
const syncTasks=new Map<string,Promise<ExplorationRecord|null>>();
/** Merge local discoveries with remote data; never delete either side. */
export async function syncExploration(id:string):Promise<ExplorationRecord|null>{
 if(!CLOUD_URL||!CLOUD_KEY)return readExploration(id);
 const existing=syncTasks.get(id);if(existing)return existing;
 const task=(async()=>{
  const session=await cloudSession();if(!session)return readExploration(id);
  const local=await readExploration(id);
  // Pull all pages; PostgREST's default response limit is often 1000.
  const remote:Record<string,Segment[]>={};
  let offset=0;const pageSize=500;
  while(true){
   const params='company_id=eq.'+encodeURIComponent(id)+'&select=road_id,segments&order=road_id&limit='+pageSize+'&offset='+offset;
   const response=await cloudRequest(session,'exploration_segments?'+params);
   const rows=await response.json() as CloudRow[];
   for(const row of rows)remote[row.road_id]=row.segments??[];
   if(rows.length<pageSize)break;
   offset+=rows.length;
  }
  // Preserve all locally discovered IDs, including ones whose geometry
  // has not yet been loaded. Those get an empty geometry until resolved.
  const ids=new Set([...(local?.ids??[]),...Object.keys(remote)]);
  const combined={...remote,...(local?.segments??{})};
  for(const roadId of ids)if(!combined[roadId])combined[roadId]=[];
  const upload=Object.entries(combined).filter(([roadId,segments])=>!remote[roadId]||(segments.length>0&&remote[roadId].length===0));
  for(let i=0;i<upload.length;i+=200){
   const rows=upload.slice(i,i+200).map(([road_id,segments])=>({company_id:id,road_id,segments}));
   await cloudRequest(session,'exploration_segments?on_conflict=user_id,company_id,road_id',{
    method:'POST',headers:{'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(rows)});
  }
  const result={ids:[...ids],segments:combined};
  await writeExploration(id,result);
  return result;
 })().finally(()=>{syncTasks.delete(id);});
 syncTasks.set(id,task);return task;
}
export function cloudExplorationEnabled():boolean{return Boolean(CLOUD_URL&&CLOUD_KEY);}
