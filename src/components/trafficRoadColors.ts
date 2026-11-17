/** Visual-only congestion classifications for already discovered map features.
 * No roads are discovered here and no vehicles or map markers are created.
 * Uses exactly the traffic model that determines taxi speed and incident delays.
 */
import {regionalTrafficFactor,type TrafficPoint} from '../simulation/trafficConditions';
import type {RoadGraph} from '../simulation/taxi';
import type {RoadFeature} from './purpleRoadDiff';

export type RoadTrafficBand='clear'|'moderate'|'heavy'|'severe';
export const ROAD_TRAFFIC_COLORS:Record<RoadTrafficBand,string>={
 clear:'#22C55E',moderate:'#F59E0B',heavy:'#EF4444',severe:'#991B1B',
};
export const ROAD_TRAFFIC_LABELS:Record<RoadTrafficBand,string>={
 clear:'Free flowing',moderate:'Moderate',heavy:'Heavy',severe:'Severe delays',
};
export function roadTrafficBand(
 speedKph:number,point:TrafficPoint,at:number,roadId:string,
):RoadTrafficBand{
 const factor=regionalTrafficFactor(speedKph,at,point,roadId);
 if(factor<0.40)return 'severe';
 if(factor<0.65)return 'heavy';
 if(factor<0.87)return 'moderate';
 return 'clear';
}
/** Road IDs and real directed OSM endpoints are authoritative, never proximity.
 * The map is passed ONLY visible discovered-road features by WorldMap.
 */
export function trafficBandForFeature(
 feature:RoadFeature,graph:RoadGraph,at:number,
):RoadTrafficBand|null{
 const properties=feature.properties;
 const roadId=typeof properties?.roadId==='string'?properties.roadId:null;
 const from=typeof properties?.fromNode==='string'?properties.fromNode:null;
 const to=typeof properties?.toNode==='string'?properties.toNode:null;
 if(!roadId||!from||!to)return null;
 const edge=graph.edges.get(from)?.find(e=>e.id===roadId&&e.to===to) ??
  graph.edges.get(to)?.find(e=>e.id===roadId&&e.to===from);
 const geometry=feature.geometry.coordinates;
 const a=geometry[0],b=geometry[geometry.length-1];
 if(!edge||!a||!b)return null;
 const point:TrafficPoint=[(a[0]+b[0])/2,(a[1]+b[1])/2];
 return roadTrafficBand(edge.speedKph,point,at,roadId);
}
