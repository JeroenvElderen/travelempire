export const categories=["Revenue & Pricing","Vehicle Technology","Fleet Management","Exploration Technology","Drivers & Personnel","Depots & Infrastructure","Marketing & Reputation","Finance & Business"] as const;
export const projects=[
 {id:'pricing',category:0,name:"Fare Optimisation",effect:"+5% passenger revenue per level",base:2000},
 {id:'peakPricing',category:0,name:"Dynamic Pricing",effect:"+3% passenger revenue per level",base:3000},
 {id:'premium',category:0,name:"Premium Passenger Service",effect:"+3% passenger revenue per level",base:3500},
 {id:'longDistance',category:0,name:"Long-Distance Transport",effect:"+2% passenger revenue per level",base:2800},
 {id:'engine',category:1,name:"Engine Efficiency",effect:"-5% petrol use per level",base:2500},
 {id:'fuelInjection',category:1,name:"Fuel Injection",effect:"-2% petrol use per level",base:3200},
 {id:'durability',category:1,name:"Engine Durability",effect:"-7% vehicle wear per level",base:2700},
 {id:'lubrication',category:1,name:"Advanced Lubrication",effect:"-4% maintenance cost per level",base:2500},
 {id:'lightweight',category:1,name:"Lightweight Components",effect:"-2% petrol use per level",base:3500},
 {id:'dispatchResearch',category:2,name:"Intelligent Dispatch",effect:"+2% passenger revenue per level",base:3000},
 {id:'routing',category:2,name:"Route Optimisation",effect:"-2% maintenance cost per level",base:3200},
 {id:'fleetAnalytics',category:2,name:"Fleet Analytics",effect:"+1% passenger revenue per level",base:2400},
 {id:'survey',category:3,name:"Efficient Surveying",effect:"-6% explorer travel charge per level",base:2500},
 {id:'navigation',category:3,name:"Advanced Navigation",effect:"-3% explorer travel charge per level",base:3000},
 {id:'patrol',category:3,name:"Extended Patrol Range",effect:"-2% explorer petrol use per level",base:3500},
 {id:'trainingResearch',category:4,name:"Driver Training",effect:"+2% passenger revenue per level",base:2800},
 {id:'ecoDriving',category:4,name:"Eco-Driving",effect:"-3% petrol use per level",base:2500},
 {id:'defensive',category:4,name:"Defensive Driving",effect:"-3% vehicle wear per level",base:2600},
 {id:'workshopResearch',category:5,name:"Workshop Automation",effect:"-4% maintenance cost per level",base:3000},
 {id:'parts',category:5,name:"Parts Procurement",effect:"-3% maintenance cost per level",base:2500},
 {id:'depotEfficiency',category:5,name:"Depot Efficiency",effect:"-4% depot facility cost per level",base:3200},
 {id:'advertising',category:6,name:"Local Advertising",effect:"+2% passenger revenue per level",base:2600},
 {id:'brand',category:6,name:"Brand Recognition",effect:"+2% passenger revenue per level",base:3200},
 {id:'loyalty',category:6,name:"Loyalty Programme",effect:"+1% passenger revenue per level",base:2800},
 {id:'procurement',category:7,name:"Fleet Procurement",effect:"-4% vehicle purchase cost per level",base:2000},
 {id:'insuranceResearch',category:7,name:"Insurance Negotiation",effect:"-5% insurance premiums per level",base:3000},
 {id:'efficiency',category:7,name:"Research Efficiency",effect:"-5% future research time per level",base:1500},
] as const;
export type ResearchId=typeof projects[number]['id'];
export type ResearchState={levels:Partial<Record<ResearchId,number>>;active?:{id:ResearchId;level:number;startedAt:number;endsAt:number}};
export const empty=():ResearchState=>({levels:{}});
const key=(id:string)=>`travelempire.research.v1.${id}`;
export function load(id:string):ResearchState{try{const v=JSON.parse(localStorage.getItem(key(id))||'null');return v&&v.levels?v:empty()}catch{return empty()}}
export function save(id:string,v:ResearchState){localStorage.setItem(key(id),JSON.stringify(v))}
export function clear(id:string){localStorage.removeItem(key(id))}
export function maxLevel(_id:ResearchId){return 5}
export function level(s:ResearchState,id:ResearchId){return Math.max(0,Math.min(maxLevel(id),s.levels[id]||0))}
export function price(id:ResearchId,l:number){const project=projects.find(p=>p.id===id);return (project?.base??2000)*3**(l-1)}
export function duration(s:ResearchState,l:number){return Math.round(([5,15,30,60,180][l-1]||180)*60000*(1-0.05*level(s,'efficiency')))}
export function settle(s:ResearchState,now=Date.now()):ResearchState{if(!s.active||s.active.endsAt>now)return s;return {levels:{...s.levels,[s.active.id]:Math.max(level(s,s.active.id),s.active.level)}}}
export function start(s:ResearchState,id:ResearchId,now=Date.now()):ResearchState{const current=settle(s,now);if(current.active)throw Error('Research already running');const l=level(current,id)+1;if(l>maxLevel(id))throw Error('Maximum level reached');return {...current,active:{id,level:l,startedAt:now,endsAt:now+duration(current,l)}}}
export function bonus(s:ResearchState, ids:readonly ResearchId[],perLevel:number,cap:number){return Math.min(cap,ids.reduce((sum,id)=>sum+level(s,id)*perLevel,0))}
