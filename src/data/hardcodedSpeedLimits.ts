/** Fixed gameplay limits in km/h. OSM maxspeed and cached tile speeds are ignored. */
export const HARD_CODED_SPEED_LIMITS:Readonly<Record<string,number>>={
 motorway:130,motorway_link:60,
 trunk:110,trunk_link:60,
 primary:90,primary_link:50,
 secondary:80,secondary_link:45,
 tertiary:70,tertiary_link:40,
 residential:50,living_street:20,
 unclassified:70,service:30,
 parking:10,access:10,
 road:50,pedestrian:10,track:30,path:10,footway:10,cycleway:15,
};
export function hardcodedRoadSpeedKph(highway:unknown):number{
 const type=String(highway??'residential').toLowerCase();
 return HARD_CODED_SPEED_LIMITS[type]??50;
}
