/** Network fetch, gzip decompression and JSONL parsing off the UI thread. */
import type { RegionalRoad } from './regionalRoads';
type Request={id:number;regionId:string;url:string};
self.onmessage=async(event:MessageEvent<Request>)=>{
 const {id,regionId,url}=event.data;
 try{
  const response=await fetch(url);
  if(!response.ok||!response.body)throw Error(`Road package ${regionId}: HTTP ${response.status}`);
  const stream=response.body.pipeThrough(new DecompressionStream('gzip'));
  const content=await new Response(stream).text();
  const roads:RegionalRoad[]=[];
  for(const line of content.split('\n'))if(line.trim())roads.push(JSON.parse(line) as RegionalRoad);
  self.postMessage({id,roads});
 }catch(error){self.postMessage({id,error:String(error)});}
};
