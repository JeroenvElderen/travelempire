export type ResearchId='pricing'|'procurement'|'efficiency';
export type ResearchState={levels:Partial<Record<ResearchId,number>>;active?:{id:ResearchId;level:number;startedAt:number;endsAt:number}};
export const projects=[{id:'pricing',name:'Dynamic Pricing',effect:'+5% passenger revenue per level'},{id:'procurement',name:'Fleet Procurement',effect:'-4% taxi purchase cost per level'},{id:'efficiency',name:'Research Efficiency',effect:'-5% future research time per level'}] as const;
export const empty=():ResearchState=>({levels:{}});
const key=(id:string)=>`travelempire.research.v1.${id}`;
export function load(id:string):ResearchState{try{const v=JSON.parse(localStorage.getItem(key(id))||'null');return v&&v.levels?v:empty()}catch{return empty()}}
export function save(id:string,v:ResearchState){localStorage.setItem(key(id),JSON.stringify(v))}
export function clear(id:string){localStorage.removeItem(key(id))}
export function level(s:ResearchState,id:ResearchId){return Math.max(0,Math.min(5,s.levels[id]||0))}
export function price(id:ResearchId,l:number){return (id==='efficiency'?1500:2000)*3**(l-1)}
export function duration(s:ResearchState,l:number){return Math.round(([5,15,30,60,180][l-1]||180)*60000*(1-0.05*level(s,'efficiency')))}
export function settle(s:ResearchState,now=Date.now()):ResearchState{if(!s.active||s.active.endsAt>now)return s;return {levels:{...s.levels,[s.active.id]:Math.max(level(s,s.active.id),s.active.level)}}}
export function start(s:ResearchState,id:ResearchId,now=Date.now()):ResearchState{const current=settle(s,now);if(current.active)throw Error('Research already running');const l=level(current,id)+1;if(l>5)throw Error('Maximum level reached');return {...current,active:{id,level:l,startedAt:now,endsAt:now+duration(current,l)}}}
