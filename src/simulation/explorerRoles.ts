import type {Taxi} from './taxi';

export type SpecialistExplorerRole='highway'|'primary'|'secondary'|'residential'|'poi';
export const SPECIALIST_EXPLORERS:ReadonlyArray<{
 role:SpecialistExplorerRole;name:string;description:string;
}>=[
 {role:'highway',name:'Highway Explorer',description:'Prioritises motorways and trunk roads; can discover all drivable roads'},
 {role:'primary',name:'Primary Explorer',description:'Prioritises primary roads; can discover all drivable roads'},
 {role:'secondary',name:'Secondary Explorer',description:'Prioritises secondary and tertiary roads; can discover all drivable roads'},
 {role:'residential',name:'Local Street Explorer',description:'Prioritises local streets; can discover all drivable roads'},
 {role:'poi',name:'Service Explorer',description:'Prioritises service and harbour access; can discover all drivable roads'},
];

export const explorerClassEligible=(role:Taxi['explorerRole'],highway?:string):boolean=>{
 const h=highway??'';
 switch(role){
 case 'highway':return ['motorway','motorway_link','trunk','trunk_link'].includes(h);
 case 'primary':return ['primary','primary_link'].includes(h);
 case 'secondary':return ['secondary','secondary_link','tertiary','tertiary_link'].includes(h);
 case 'residential':return ['residential','living_street','unclassified','road','track'].includes(h);
 case 'poi':return h==='service'; // Preserve saved role ID; specialize in service roads.
 default:return true;
 }
};
export const specialistLabel=(role:Taxi['explorerRole'])=>
 SPECIALIST_EXPLORERS.find(v=>v.role===role)?.name??'Explorer';

/** Road class is a *priority*, not a discovery restriction.
 * A specialist first searches its preferred class; when it cannot find
 * a useful connected mission it may fall back to any other drivable road.
 * 'balanced' is the all-class search tier, not a new vehicle role.
 */
export const specialistFallbackRoles=(role:Taxi['explorerRole']):Taxi['explorerRole'][]=>{
 switch(role){
 case 'highway':case 'primary':case 'secondary':case 'residential':case 'poi':
  return [role,'balanced'];
 default:return [];
 }
};
