import {loadMobilityTile,mobilityTileId,type MobilityManifest,
 type MobilityMode,type MobilityPoint,type MobilitySegment} from '../data/mobilityTiles';
import {readMobilityProgress,writeMobilityProgress} from '../data/mobilityStore';
import {advanceMobilitySession,appendMobilityRoads,emptyMobilityGraph,
 newMobilitySession,planMobilityRoute,type MobilityGraph,type MobilitySession,
 mobilityMetres} from './mobilityExploration';

export type MobilitySnapshot={
 sessions:Partial<Record<MobilityMode,MobilitySession>>;
 discovered:Record<MobilityMode,ReadonlySet<string>>;
 segments:MobilitySegment[];
 loadedTiles:number;loading:boolean;error:string|null;
};
const MODES:MobilityMode[]=['walk','cycle'];
const MAX_ACTIVE_TILES=9;

export class MobilityController{
 readonly discovered:Record<MobilityMode,Set<string>>={walk:new Set(),cycle:new Set()};
 readonly sessions:Partial<Record<MobilityMode,MobilitySession>>={};
 private graphs:Record<MobilityMode,MobilityGraph>={walk:emptyMobilityGraph(),cycle:emptyMobilityGraph()};
 private loaded=new Map<string,MobilitySegment[]>();
 private pending=new Set<string>();
 private updating=false;
 private dirty=false;
 private lastSave=0;
 error:string|null=null;
 constructor(readonly companyId:string,readonly manifest:MobilityManifest,private notify:()=>void){}

 get snapshot():MobilitySnapshot{
  return{sessions:{...this.sessions},discovered:this.discovered,
   segments:[...this.loaded.values()].flat(),loadedTiles:this.loaded.size,
   loading:this.pending.size>0,error:this.error};
 }
 private changed(){this.notify()}
 async restore(){
  for(const mode of MODES){
   try{
    const saved=await readMobilityProgress(this.companyId,mode);
    if(!saved)continue;
    this.discovered[mode]=new Set(saved.discovered??[]);
    if(saved.portId&&saved.node&&saved.position){
     this.sessions[mode]={mode,portId:saved.portId,node:saved.node,
      position:saved.position,path:[],leg:0,distanceIntoLeg:0,status:'waiting'};
    }
   }catch(error){
    this.error='Progress storage unavailable: '+String(error);
   }
  }
  this.changed();
 }

 private rebuild(){
  this.graphs={walk:emptyMobilityGraph(),cycle:emptyMobilityGraph()};
  for(const roads of this.loaded.values())
   for(const mode of MODES)appendMobilityRoads(this.graphs[mode],roads,mode);
 }

 /** Only download tiles along an active scout's current location.
  * Nearby adjacent tiles are prefetched when within ~1.5 km of a border.
  * The taxi graph is never cloned or modified.
  */
 async loadNear(point:MobilityPoint,includeAdjacent=false):Promise<number>{
  const [x,y]=[Math.floor(point[0]/this.manifest.tileSize),Math.floor(point[1]/this.manifest.tileSize)];
  const fractionX=point[0]/this.manifest.tileSize-x;
  const fractionY=point[1]/this.manifest.tileSize-y;
  const dx:number[]=includeAdjacent?[-1,0,1]:[0];
  const dy:number[]=includeAdjacent?[-1,0,1]:[0];
  if(!includeAdjacent){
   if(fractionX<0.13)dx.unshift(-1);
   if(fractionX>0.87)dx.push(1);
   if(fractionY<0.13)dy.unshift(-1);
   if(fractionY>0.87)dy.push(1);
  }
  const ids=[...new Set(dx.flatMap(a=>dy.map(b=>`${x+a}_${y+b}`)))].sort(
   (a,b)=>a===mobilityTileId(point)?-1:b===mobilityTileId(point)?1:0);
  let added=0;
  for(const id of ids){
   if(!this.manifest.tiles[id]||this.loaded.has(id)||this.pending.has(id))continue;
   this.pending.add(id);this.changed();
   try{
    const roads=await loadMobilityTile(id);
    this.loaded.set(id,roads);added++;
    while(this.loaded.size>MAX_ACTIVE_TILES){
     const oldest=this.loaded.keys().next().value;
     if(!oldest)break;
     this.loaded.delete(oldest);
    }
    this.rebuild();
   }catch(error){
    this.error='Could not load mobility tile '+id+': '+String(error);
   }finally{
    this.pending.delete(id);this.changed();
   }
  }
  return added;
 }

 async deploy(mode:MobilityMode,portId:string,point:MobilityPoint):Promise<boolean>{
  this.error=null;
  await this.loadNear(point,true);
  let session=newMobilitySession(this.graphs[mode],mode,portId,point);
  if(!session){
   // A harbour with no mapped walking/cycle path within the access radius
   // must never be connected by an invented straight-line "bridge".
   this.error=mode==='walk'
    ?'No connected pedestrian OSM node within 250 m of this harbour.'
    :'No cycling-permitted OSM node within 250 m of this harbour.';
   this.changed();return false;
  }
  session={...session,status:'waiting'};
  this.sessions[mode]=session;
  this.dirty=true;
  this.changed();
  void this.persist();
  return true;
 }

 async tick(elapsedSeconds:number){
  if(this.updating)return;
  this.updating=true;
  try{
   let changed=false;
   for(const mode of MODES){
    let session=this.sessions[mode];
    if(!session||session.status==='complete')continue;
    if(session.leg>=session.path.length){
     let route=planMobilityRoute(this.graphs[mode],session.node,this.discovered[mode]);
     if(!route){
      const loaded=await this.loadNear(session.position,true);
      route=planMobilityRoute(this.graphs[mode],session.node,this.discovered[mode]);
      if(!route&&loaded===0){
       this.sessions[mode]={...session,status:'complete'};
       changed=true;
       continue;
      }
     }
     if(!route)continue;
     session={...session,path:route,leg:0,distanceIntoLeg:0,status:'exploring'};
    }
    // Sixfold acceleration keeps island discovery in step with the game clock.
    const speedKph=mode==='walk'?30:84; // Real-world equivalent 5 / 14 km/h.
    const advanced=advanceMobilitySession(session,elapsedSeconds,speedKph);
    this.sessions[mode]=advanced.session;
    for(const id of advanced.crossed)this.discovered[mode].add(id);
    if(advanced.crossed.length)this.dirty=true;
    changed=true;
    // A path may become available just across a tile boundary.
    if(this.manifest.tiles[mobilityTileId(advanced.session.position)]){
     void this.loadNear(advanced.session.position);
    }
   }
   if(changed)this.changed();
   if(this.dirty&&Date.now()-this.lastSave>=10000)void this.persist();
  }finally{this.updating=false}
 }
 async persist(){
  if(!this.dirty)return;
  this.dirty=false;this.lastSave=Date.now();
  try{
   await Promise.all(MODES.map(mode=>{
    const session=this.sessions[mode];
    return writeMobilityProgress(this.companyId,{
     mode,discovered:[...this.discovered[mode]],portId:session?.portId,
     node:session?.node,position:session?.position,
    });
   }));
  }catch(error){this.dirty=true;this.error='Could not save mobility discovery: '+String(error);this.changed()}
 }
 get hasAccess(){return Object.keys(this.manifest.tiles).length>0}
 get loadedGraph(){return this.graphs}
 nearestPortDistance(position:MobilityPoint,point:MobilityPoint){return mobilityMetres(position,point)}
}
