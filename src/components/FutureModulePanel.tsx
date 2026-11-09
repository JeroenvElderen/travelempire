import {useState} from 'react';
import {ArrowRight,CheckCircle2,ChevronDown,ChevronUp,LockKeyhole,Target} from 'lucide-react';
import {futureModules,type FutureModuleId} from '../futureModules';
import './FutureModulePanel.css';

type Props={moduleId:FutureModuleId};
export default function FutureModulePanel({moduleId}:Props){
 const module=futureModules[moduleId];
 const [expanded,setExpanded]=useState<number|null>(null);
 return <section className="future-module-page">
  <div className="future-module-hero">
   <div className="future-module-kicker"><LockKeyhole size={14}/> FUTURE EXPANSION · DESIGN BRIEF</div>
   <h1>{module.title}</h1>
   <p>{module.subtitle}</p>
   <span className="future-module-status">Planning phase — no active simulation</span>
  </div>
  <div className="future-module-grid">
   <article className="future-module-card future-module-goal">
    <h2><Target size={19}/> What we want to achieve</h2>
    <p>{module.goal}</p>
   </article>
   <article className="future-module-card">
    <h2>Core gameplay</h2>
    <ul>{module.experience.map((item,i)=><li key={i}><CheckCircle2 size={16}/><span>{item}</span></li>)}</ul>
   </article>
   <article className="future-module-card">
    <h2>Connect to existing TravelEmpire systems</h2>
    <ul>{module.integrations.map((item,i)=><li key={i}><ArrowRight size={16}/><span>{item}</span></li>)}</ul>
   </article>
   <article className="future-module-card">
    <h2>KPIs we should track</h2>
    <div className="future-module-kpis">{module.metrics.map(metric=><span key={metric}>{metric}</span>)}</div>
   </article>
  </div>
  <div className="future-module-card future-module-roadmap">
   <div className="future-module-roadmap-head"><div><span className="future-module-label">IMPLEMENTATION PLAN</span><h2>Development roadmap</h2></div><span>4 milestones</span></div>
   {module.phases.map(([name,description],i)=><div className="future-module-phase" key={name}>
    <button type="button" aria-expanded={expanded===i} onClick={()=>setExpanded(expanded===i?null:i)}>
     <span className="future-module-phase-index">{String(i+1).padStart(2,'0')}</span>
     <span className="future-module-phase-title"><strong>{name}</strong><small>{description}</small></span>
     {expanded===i?<ChevronUp size={18}/>:<ChevronDown size={18}/>}
    </button>
    {expanded===i&&<div className="future-module-phase-details">
     <p><strong>Build objective:</strong> {description}</p>
     <p><strong>Completion criteria:</strong> Working navigation, persistent state where applicable, economic integrity, tests and mobile performance checks before this phase is marked delivered.</p>
    </div>}
   </div>)}
  </div>
  <article className="future-module-card future-module-standards">
   <h2>Technical and gameplay requirements</h2>
   <ul>{module.rules.map((rule,i)=><li key={i}><CheckCircle2 size={16}/><span>{rule}</span></li>)}</ul>
  </article>
  <p className="future-module-footnote">This is the module specification, not a claim that the gameplay exists. Future implementation should reuse TravelEmpire’s current saves, game clock, company cash, and map data wherever possible.</p>
 </section>;
}
