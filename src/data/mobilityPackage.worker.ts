import type {MobilitySegment} from './mobilityTiles';
type Task={id:number;url:string};
self.onmessage=async(event:MessageEvent<Task>)=>{
 const {id,url}=event.data;
 try{
  const response=await fetch(url);
  if(!response.ok)throw Error('Mobility tile HTTP '+response.status);
  if(!response.body)throw Error('Mobility response stream missing');
  const expanded=response.body.pipeThrough(new DecompressionStream('gzip'));
  const text=await new Response(expanded).text();
  const roads:MobilitySegment[]=[];
  for(const row of text.split('\n')){
   if(!row.trim())continue;
   const road=JSON.parse(row) as MobilitySegment;
   if(!road.id||!Array.isArray(road.coordinates)||road.coordinates.length!==2||
      !Number.isFinite(road.length)||road.length<=0||!(road.walk||road.cycle))
     throw Error('Invalid mobility edge in '+url);
   roads.push(road);
  }
  self.postMessage({id,roads});
 }catch(error){
  self.postMessage({id,error:error instanceof Error?error.message:String(error)});
 }
};
