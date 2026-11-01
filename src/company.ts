export type Headquarters = { lng:number; lat:number; label:string; region:string; country:string; countryCode:string };
import type {ClaimedRegion} from './territories';
export type Company = { id:string; name:string; createdAt:string; headquarters:Headquarters; startingCapital:number; cash:number; currency:string; regionClaimStatus:'pending'|'claimed'; claimedRegion?:ClaimedRegion; depotStatus:'not_placed' };
const STORAGE_KEY='travelempire.company.v0.4';
export function loadCompany():Company|null {try {const raw=localStorage.getItem(STORAGE_KEY);if(!raw)return null;const data:unknown=JSON.parse(raw);if(typeof data==='object'&&data!==null&&'name'in data&&'headquarters'in data&&'id'in data)return data as Company;}catch{ /* corrupt local data must not crash the app */ }return null;}
export function saveCompany(company:Company){localStorage.setItem(STORAGE_KEY,JSON.stringify(company));}
export function clearCompany(){localStorage.removeItem(STORAGE_KEY);}
export const STARTING_CAPITAL=100000;
