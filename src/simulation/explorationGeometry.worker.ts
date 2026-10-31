import {buffer,circle,difference,featureCollection,lineString,polygon,union} from '@turf/turf';

type Point=[number,number];
type Request={headquarters:Point;segments:Array<[Point,Point]>};

self.onmessage=(event:MessageEvent<Request>)=>{
 try{
  const {headquarters,segments}=event.data;
  // Preserve TravelEmpire's existing 500 m starting area and 50 m road radius.
  const shapes:GeoJSON.Feature<GeoJSON.Polygon|GeoJSON.MultiPolygon>[]=[circle(headquarters,0.5,{steps:64,units:'kilometers'})];
  for(const [a,b] of segments){
   const corridor=buffer(lineString([a,b]),0.05,{steps:8,units:'kilometers'});
   if(corridor&&(corridor.geometry.type==='Polygon'||corridor.geometry.type==='MultiPolygon'))shapes.push(corridor as GeoJSON.Feature<GeoJSON.Polygon|GeoJSON.MultiPolygon>);
  }
  // Turf's polygon union, as in WorldFront: true geographic geometry, no raster.
  // Incremental batches keep peak intermediate geometry manageable.
  let merged:GeoJSON.Feature<GeoJSON.Polygon|GeoJSON.MultiPolygon>=shapes[0];
  for(let i=1;i<shapes.length;i+=32){
   const result=union(featureCollection([merged,...shapes.slice(i,i+32)]));
   if(result)merged=result as typeof merged;
  }
  const world=polygon([[[-179.9,-85],[179.9,-85],[179.9,85],[-179.9,85],[-179.9,-85]]]);
  const locked=difference(featureCollection([world,merged]))??world;
  self.postMessage({coverage:featureCollection([merged]),locked:featureCollection([locked])});
 }catch(error){self.postMessage({error:error instanceof Error?error.message:String(error)});}
};
