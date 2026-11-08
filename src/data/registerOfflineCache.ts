/** Temporarily retire the offline service worker while investigating iOS reloads.
 * This only removes the worker and cached frontend assets. IndexedDB, local
 * storage and saved exploration data are not modified.
 */
export function registerOfflineCache():void {
 if(!('serviceWorker' in navigator))return;
 const retire=async()=>{
  try{
   const registrations=await navigator.serviceWorker.getRegistrations();
   for(const registration of registrations){
    const scope=new URL(registration.scope);
    if(scope.origin===location.origin)await registration.unregister();
   }
   if('caches' in window){
    const names=await caches.keys();
    await Promise.all(names.filter(name=>name.startsWith('te-cache-')&&name.endsWith('-static')).map(name=>caches.delete(name)));
   }
  }catch(error){
   console.warn('[TravelEmpire] Could not retire offline app cache',error);
  }
 };
 // Do not wait for load: stale service workers should be retired as soon as
 // the JavaScript bundle runs. Never reload from this cleanup.
 void retire();
}
