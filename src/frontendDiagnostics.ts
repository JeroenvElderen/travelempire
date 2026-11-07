// In-memory frontend performance diagnostics. No coordinates, identifiers or save data.
export type DiagnosticEntry={ms:number;category:string;message:string};
type Entry=DiagnosticEntry;
const entries:Entry[]=[];
export function diagnosticEntries():DiagnosticEntry[]{return entries.slice()}
export function clearDiagnostics(){entries.length=0}
const started=performance.now();
let lastFrame=performance.now();
let frameCount=0,frameTotal=0,frameWorst=0,frameDrops=0;
let lastSample=performance.now();
export function diagnostic(category:string,message:string){
 entries.push({ms:Math.round(performance.now()),category,message});
 if(entries.length>1500)entries.shift();
}
function frame(now:number){
 const gap=now-lastFrame;lastFrame=now;
 if(gap>0&&gap<5000){frameCount++;frameTotal+=gap;frameWorst=Math.max(frameWorst,gap);if(gap>50)frameDrops++;}
 if(now-lastSample>=2000){
  diagnostic('frames',`fps=${Math.round(frameCount*1000/(now-lastSample))} avg=${Math.round(frameTotal/Math.max(1,frameCount))}ms worst=${Math.round(frameWorst)}ms gaps>50ms=${frameDrops} visibility=${document.visibilityState}`);
  frameCount=0;frameTotal=0;frameWorst=0;frameDrops=0;lastSample=now;
 }
 requestAnimationFrame(frame);
}
if(typeof window!=='undefined'){
 diagnostic('session','diagnostics enabled');
 requestAnimationFrame(frame);
 window.addEventListener('error',e=>diagnostic('error',String(e.message).slice(0,400)));
 const nativeWarn=console.warn.bind(console),nativeError=console.error.bind(console);
 const describe=(values:unknown[])=>values.map(v=>{try{return typeof v==='string'?v:v instanceof Error?v.message:JSON.stringify(v)}catch{return String(v)}}).join(' ').slice(0,450);
 console.warn=(...values:unknown[])=>{diagnostic('console:warn',describe(values));nativeWarn(...values)};
 console.error=(...values:unknown[])=>{diagnostic('console:error',describe(values));nativeError(...values)};
 window.addEventListener('unhandledrejection',e=>diagnostic('promise',String(e.reason).slice(0,250)));
 document.addEventListener('visibilitychange',()=>diagnostic('visibility',document.visibilityState));
 try{
  const observer=new PerformanceObserver(list=>{for(const e of list.getEntries())diagnostic('longtask',`duration=${Math.round(e.duration)}ms`);});
  observer.observe({entryTypes:['longtask']});
 }catch{/* Safari may not expose longtask entries. */}
}
export function diagnosticReport(){
 const nav=performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming|undefined;
 return ['TravelEmpire full frontend diagnostics',`Elapsed: ${Math.round(performance.now()-started)}ms`,`Navigation: ${nav?JSON.stringify({domInteractive:Math.round(nav.domInteractive),loadEventEnd:Math.round(nav.loadEventEnd)}):'unavailable'}`,`User agent: ${navigator.userAgent}`,`Entries: ${entries.length} (latest 1500)`,...entries.map(e=>`${e.ms}ms | ${e.category} | ${e.message}`)].join('\n');
}
