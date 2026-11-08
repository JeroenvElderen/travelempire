/** Cache large static road and map responses, never an obsolete frontend. */
export function registerOfflineCache():void {
 if(!('serviceWorker' in navigator)||!import.meta.env.PROD)return;
 window.addEventListener('load',()=>{
  void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`,{
   scope:import.meta.env.BASE_URL,
   // Safari must check the actual deployed worker, not an HTTP-cached script.
   updateViaCache:'none'
  }).then(registration=>{
   // Existing Safari tabs can remain open across multiple Cloudflare deploys.
   // Revalidate when the user returns without interrupting an active game.
   const checkForUpdate=()=>{
    if(document.visibilityState==='visible')void registration.update().catch(()=>{});
   };
   document.addEventListener('visibilitychange',checkForUpdate);
   window.addEventListener('pageshow',checkForUpdate);
   checkForUpdate();
  }).catch(error=>console.warn('[TravelEmpire] Asset cache unavailable',error));
 },{once:true});
}
