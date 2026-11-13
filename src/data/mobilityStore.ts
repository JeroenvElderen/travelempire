import type {MobilityMode} from './mobilityTiles';
import type {MobilityPoint} from './mobilityTiles';

const DB='travelempire-mobility-discovery-v1';
const STORE='companies';
export type MobilitySave={mode:MobilityMode;discovered:string[];portId?:string;node?:string;position?:MobilityPoint};
function open():Promise<IDBDatabase>{
 return new Promise((resolve,reject)=>{
  const request=indexedDB.open(DB,1);
  request.onupgradeneeded=()=>{
   if(!request.result.objectStoreNames.contains(STORE))request.result.createObjectStore(STORE);
  };
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error);
 });
}
export async function readMobilityProgress(company:string,mode:MobilityMode):Promise<MobilitySave|null>{
 const db=await open();
 try{
  return await new Promise((resolve,reject)=>{
   const request=db.transaction(STORE,'readonly').objectStore(STORE).get(company+':'+mode);
   request.onsuccess=()=>resolve(request.result??null);
   request.onerror=()=>reject(request.error);
  });
 }finally{db.close()}
}
export async function writeMobilityProgress(company:string,data:MobilitySave):Promise<void>{
 const db=await open();
 try{
  await new Promise<void>((resolve,reject)=>{
   const tx=db.transaction(STORE,'readwrite');
   tx.objectStore(STORE).put(data,company+':'+data.mode);
   tx.oncomplete=()=>resolve();
   tx.onerror=()=>reject(tx.error);
   tx.onabort=()=>reject(tx.error);
  });
 }finally{db.close()}
}
