import type {Company,Headquarters} from './company';
export type RegionFeature=GeoJSON.Feature<GeoJSON.Polygon|GeoJSON.MultiPolygon,Record<string,unknown>>;
export type RegionCollection=GeoJSON.FeatureCollection<GeoJSON.Polygon|GeoJSON.MultiPolygon,Record<string,unknown>>;
export type ClaimedRegion={id:string;name:string;countryCode:string;country:string;claimedAt:string;source:string};
type Manifest={countries:Array<{code:string;name:string}>};
const norm=(value:string)=>value.toLocaleLowerCase('en').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z]/g,'');
function countryCode(hq:Headquarters,manifest:Manifest):string {
 const raw=hq.countryCode.trim().replace(/^country\./,'').split('-')[0].toUpperCase();
 const byCode=manifest.countries.find(c=>c.code===raw);
 if(byCode)return byCode.code;
 const byName=manifest.countries.find(c=>norm(c.name)===norm(hq.country));
 if(byName)return byName.code;
 // MapTiler sometimes supplies two-letter country codes. Match via localized country display names.
 if(raw.length===2){const english=new Intl.DisplayNames(['en'],{type:'region'}).of(raw);
   const match=manifest.countries.find(c=>norm(c.name)===norm(english??''));if(match)return match.code;}
 throw Error(`Cannot match headquarters country "${hq.country}" (${raw}) to GADM. Check public/data/gadm/manifest.json.`);
}
function insideRing(point:[number,number],ring:number[][]):boolean {let inside=false;const [x,y]=point;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const [xi,yi]=ring[i],[xj,yj]=ring[j];if(((yi>y)!==(yj>y))&&(x<(xj-xi)*(y-yi)/(yj-yi)+xi))inside=!inside;}return inside;}
function insidePolygon(point:[number,number],polygon:number[][][]):boolean{return polygon.length>0&&insideRing(point,polygon[0])&&!polygon.slice(1).some(r=>insideRing(point,r));}
export function containsPoint(feature:RegionFeature,lng:number,lat:number):boolean {const point:[number,number]=[lng,lat],g=feature.geometry;if(!g)return false;return g.type==='Polygon'?insidePolygon(point,g.coordinates):g.coordinates.some(p=>insidePolygon(point,p));}
export function regionId(feature:RegionFeature,index:number,code:string):string {return String(feature.properties?.regionId??feature.properties?.GID_3??feature.properties?.GID_2??feature.properties?.GID_1??`${code}-region-${index}`);}
export function regionName(feature:RegionFeature):string {return String(feature.properties?.regionName??feature.properties?.NAME_3??feature.properties?.NAME_2??feature.properties?.NAME_1??'Unnamed region');}
export async function fetchRegions(hq:Headquarters):Promise<{code:string;regions:RegionCollection}> {
 const base=import.meta.env.BASE_URL??'/';
 const manifestResponse=await fetch(`${base}data/gadm/manifest.json`);
 if(!manifestResponse.ok)throw Error('GADM manifest missing. Run: python scripts/build_gadm.py --country GRC');
 const manifest=await manifestResponse.json() as Manifest;
 const code=countryCode(hq,manifest);
 const response=await fetch(`${base}data/gadm/${code}.geojson`);
 if(!response.ok)throw Error(`No exported administrative boundaries for ${code}. Run: python scripts/build_gadm.py --country ${code}`);
 const regions=await response.json() as RegionCollection;
 if(regions.type!=='FeatureCollection'||!Array.isArray(regions.features))throw Error(`Invalid GADM GeoJSON for ${code}`);
 return {code,regions};
}
export function locateStartingRegion(company:Company,code:string,regions:RegionCollection):ClaimedRegion|null {
 const index=regions.features.findIndex(f=>containsPoint(f,company.headquarters.lng,company.headquarters.lat));
 if(index<0)return null;
 const feature=regions.features[index];
 return {id:regionId(feature,index,code),name:regionName(feature),countryCode:code,country:company.headquarters.country,claimedAt:new Date().toISOString(),source:'gadm-410-adm3'};
}
