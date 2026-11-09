import type {Taxi} from './taxi';

export type SpecialistExplorerRole='highway'|'primary'|'secondary'|'residential'|'poi';
export const SPECIALIST_EXPLORERS:ReadonlyArray<{
 role:SpecialistExplorerRole;name:string;description:string;
}>=[
 {role:'highway',name:'Highway Explorer',description:'Motorways, trunk roads and their links'},
 {role:'primary',name:'Primary Explorer',description:'Primary roads and primary links'},
 {role:'secondary',name:'Secondary Explorer',description:'Secondary and tertiary roads'},
 {role:'residential',name:'Local Street Explorer',description:'Residential, service roads and local lanes'},
 {role:'poi',name:'POI Explorer',description:'Airport, harbour and facility access roads'},
];

export const explorerClassEligible=(role:Taxi['explorerRole'],highway?:string):boolean=>{
 const h=highway??'';
 switch(role){
 case 'highway':return ['motorway','motorway_link','trunk','trunk_link'].includes(h);
 case 'primary':return ['primary','primary_link'].includes(h);
 case 'secondary':return ['secondary','secondary_link','tertiary','tertiary_link'].includes(h);
 case 'residential':return ['residential','living_street','service','unclassified','road','track'].includes(h);
 case 'poi':return true; // POI targets are filtered against indexed access roads.
 default:return true;
 }
};
export const specialistLabel=(role:Taxi['explorerRole'])=>
 SPECIALIST_EXPLORERS.find(v=>v.role===role)?.name??'Explorer';
