/** Cache large static road and map responses between sessions without blocking startup. */
export function registerOfflineCache():void {
 if(!('serviceWorker' in navigator)||!import.meta.env.PROD)return;
 window.addEventListener('load',()=>{
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`,{scope:import.meta.env.BASE_URL})
   .catch(error=>console.warn('[TravelEmpire] Asset cache unavailable',error));
 },{once:true});
}
