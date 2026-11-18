/** Startup errors are deliberately independent of saved company and map data.
 * Module/chunk load failures can happen during a rolling Cloudflare deploy or
 * when Safari still has an old HTML shell referencing a removed JS asset.
 */
export function startupErrorMessage(error:unknown):string{
 if(error instanceof Error){
  const message=(error.message||'').trim();
  if(/fetch dynamically imported module|failed to fetch|importing a module script|chunkloaderror|loading chunk|networkerror|mime type|404|failed to load/i.test(message))
   return 'A game file could not be loaded. This may be a temporary deployment or Safari cache mismatch. Reload the latest version to try again.';
  return message.slice(0,250)||'The game could not finish starting.';
 }
 if(typeof error==='string'&&error.trim())return error.trim().slice(0,250);
 return 'The game could not finish starting.';
}
/** A query parameter refreshes the HTML shell without clearing Safari data,
 * localStorage, IndexedDB or the company's exploration progress.
 */
export function freshStartupUrl(raw:string,timestamp:number):string{
 const target=new URL(raw);
 target.searchParams.set('te_refresh',String(timestamp));
 return target.toString();
}
export function retryTravelEmpire():void{
 window.location.replace(freshStartupUrl(window.location.href,Date.now()));
}
