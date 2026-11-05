/* TravelEmpire offline data cache. Game saves remain in IndexedDB/localStorage. */
const VERSION='te-cache-v1';
const STATIC=VERSION+'-static', DATA=VERSION+'-data', MAP=VERSION+'-map';
const LIMITS={[DATA]:350,[MAP]:180,[STATIC]:80};
self.addEventListener('install',event=>{event.waitUntil(self.skipWaiting())});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith('te-cache-')&&!key.startsWith(VERSION))await caches.delete(key);await self.clients.claim()})())});
const isSameOrigin=url=>url.origin===self.location.origin;
function category(request,url){
 if(request.method!=='GET'||request.headers.has('range'))return null;
 if(url.pathname.includes('/data/roads/')||url.pathname.includes('/data/gadm/')||url.pathname.includes('/data/stations/')||url.pathname.includes('/data/ferries/'))return DATA;
 if(isSameOrigin(url)&&(/\.(?:js|css|svg|png|webp|woff2?|json|geojson)(?:$)/i.test(url.pathname)))return STATIC;
 if((url.hostname.endsWith('.maptiler.com')||url.hostname.endsWith('.maplibre.org'))&&(/\.(?:pbf|png|jpg|webp|glyph|json)(?:$)/i.test(url.pathname)))return MAP;
 return null;
}
async function trim(cache,name){const keys=await cache.keys();const extra=keys.length-LIMITS[name];if(extra>0)await Promise.all(keys.slice(0,extra).map(key=>cache.delete(key)))}
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.mode==='navigate')return; // HTML always checked against the network.
 const name=category(request,url);if(!name)return;
 event.respondWith((async()=>{
  const cache=await caches.open(name);
  const cached=await cache.match(request);
  if(cached)return cached;
  try{
   const response=await fetch(request);
   if(response.ok&&(response.type==='basic'||response.type==='cors')&&!/no-store|private/i.test(response.headers.get('cache-control')||'')){
    // Do not block the response or animation while writing to disk.
    event.waitUntil(cache.put(request,response.clone()).then(()=>trim(cache,name)).catch(()=>{}));
   }
   return response;
  }catch(error){if(cached)return cached;throw error}
 })());
});
self.addEventListener('message',event=>{
 if(event.data?.type==='CACHE_STATS'){
  event.waitUntil((async()=>{const counts={};for(const name of [STATIC,DATA,MAP])counts[name]= (await (await caches.open(name)).keys()).length;event.source?.postMessage({type:'CACHE_STATS',counts})})());
 }
 if(event.data?.type==='CLEAR_ASSET_CACHE'){
  event.waitUntil((async()=>{for(const name of [STATIC,DATA,MAP])await caches.delete(name);event.source?.postMessage({type:'CACHE_CLEARED'})})());
 }
});
