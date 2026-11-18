import React from "react";
import { createRoot } from "react-dom/client";
import "maplibre-gl/dist/maplibre-gl.css";
import "./styles.css";
import "./territory-rendering.css";
import { registerOfflineCache } from "./data/registerOfflineCache";
import {retryTravelEmpire,startupErrorMessage} from "./startupRecovery";

type StartupErrorBoundaryState={error:unknown|null};
const center:React.CSSProperties={
 minHeight:'100dvh',boxSizing:'border-box',padding:'28px',
 display:'flex',alignItems:'center',justifyContent:'center',
 background:'#10191b',color:'#e8f5f6',fontFamily:'system-ui,-apple-system,sans-serif',
};
const card:React.CSSProperties={
 width:'min(100%,440px)',boxSizing:'border-box',padding:'25px',
 border:'1px solid #375365',borderRadius:18,background:'#17252d',
};
const buttonStyle:React.CSSProperties={
 padding:'12px 17px',border:0,borderRadius:10,background:'#65dcc0',
 color:'#071e1c',fontWeight:750,fontSize:15,cursor:'pointer',
};
function StartupLoading(){
 return <main style={center} aria-live="polite">
  <section style={card}>
   <h1 style={{margin:'0 0 12px',fontSize:22}}>TravelEmpire</h1>
   <p style={{color:'#c4d3db',lineHeight:1.5}}>Loading your game…</p>
   <p style={{color:'#91aab4',fontSize:12,lineHeight:1.5}}>
    Your saved company and discoveries will remain available.
   </p>
  </section>
 </main>;
}
function StartupFailure({error}:{error:unknown}){
 return <main style={center} role="alert">
  <section style={card}>
   <h1 style={{margin:'0 0 13px',fontSize:21}}>TravelEmpire could not start</h1>
   <p style={{color:'#c4d3db',lineHeight:1.55}}>
    {startupErrorMessage(error)}
   </p>
   <p style={{color:'#c4d3db',lineHeight:1.55}}>
    Your company, fleet and discoveries have not been reset.
   </p>
   <button type="button" style={buttonStyle} onClick={retryTravelEmpire}>
    Reload latest game
   </button>
   <p style={{fontSize:11,color:'#92a6b6',margin:'13px 0 0'}}>
    Reloading does not clear your browser’s saved data.
   </p>
  </section>
 </main>;
}
class StartupErrorBoundary extends React.Component<
 {children:React.ReactNode},StartupErrorBoundaryState
>{
 state:StartupErrorBoundaryState={error:null};
 static getDerivedStateFromError(error:unknown):StartupErrorBoundaryState{
  return {error};
 }
 componentDidCatch(error:unknown){
  console.error('[TravelEmpire] React startup/render failure',error);
 }
 render(){
  if(this.state.error!==null)return <StartupFailure error={this.state.error}/>;
  return this.props.children;
 }
}
const element=document.getElementById('root');
if(!element)throw Error('Missing TravelEmpire root element');
const root=createRoot(element);
// Render something small immediately, before evaluating the large game,
// map and hotel modules. Mobile Safari must not see a blank page during
// a slow download or large JS evaluation after a deployment.
root.render(<StartupLoading/>);
const startTimeout=window.setTimeout(()=>{
 console.warn('[TravelEmpire] Startup still pending after 45 seconds');
 root.render(<StartupFailure error={new Error(
  'Game files are taking too long to load. Check your connection, then reload the latest game.',
 )}/>);
},45000);
// Do not import App statically: a missing rolling-deployment chunk should
// show an actionable error rather than leave the HTML timeout on screen.
void import("./App").then(({default:App})=>{
 window.clearTimeout(startTimeout);
 registerOfflineCache();
 root.render(<React.StrictMode>
  <StartupErrorBoundary><App/></StartupErrorBoundary>
 </React.StrictMode>);
}).catch(error=>{
 window.clearTimeout(startTimeout);
 console.error('[TravelEmpire] Failed to load application',error);
 root.render(<StartupFailure error={error}/>);
});
