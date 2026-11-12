/** Incremental map-source updates; never stores or modifies simulation state.
 * GeoJSON ids are the stable OSM road segment IDs from the discovery store.
 * MapLibre's updateData requires every existing source feature to have one.
 */
export type RoadFeature=GeoJSON.Feature<GeoJSON.LineString>;
export type RoadDiff={add:RoadFeature[];remove:string[]};

export function withRoadFeatureId(feature:GeoJSON.Feature):RoadFeature{
 const id=String(feature.properties?.roadId??feature.id??'');
 if(!id)throw new Error('Discovered road feature is missing its road ID');
 return {...feature,id} as RoadFeature;
}

/** Compare the current displayed viewport against its next desired state.
 * Stable, unchanged features are excluded; replaced geometry is sent as an
 * add with the same id (MapLibre updateData replaces that feature).
 */
export function diffVisibleRoads(
 previouslySent:ReadonlyMap<string,RoadFeature>,
 next:ReadonlyMap<string,RoadFeature>,
):RoadDiff{
 const remove:string[]=[],add:RoadFeature[]=[];
 for(const id of previouslySent.keys())if(!next.has(id))remove.push(id);
 for(const [id,feature] of next){
  const prior=previouslySent.get(id);
  if(!prior||!sameRoadFeature(prior,feature))add.push(feature);
 }
 return {add,remove};
}

function sameRoadFeature(a:RoadFeature,b:RoadFeature):boolean{
 if(a===b)return true;
 const x=a.geometry.coordinates,y=b.geometry.coordinates;
 if(x.length!==y.length)return false;
 for(let i=0;i<x.length;i++)
  if(x[i][0]!==y[i][0]||x[i][1]!==y[i][1])return false;
 const ap=a.properties,bp=b.properties;
 return ap?.tunnel===bp?.tunnel&&ap?.bridge===bp?.bridge&&
  ap?.layer===bp?.layer&&ap?.level===bp?.level;
}
