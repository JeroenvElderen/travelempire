/** Hotel Architecture Phase 3 — windows, natural light and artificial lighting.
 * All geometry is constrained to the existing local 1 m building grid.
 * These are game design metrics (not real daylight or building-code assessments).
 * Legacy hotels keep their previous demand until atmosphereRulesVersion=1.
 */
import {
 toggleWall,furnitureSize,type HotelFloor,type HotelSite,type Room,type Wall,
 type LightingFixture,type LightingKind,
} from './internalConstruction';
import {containsRoomCell,containsRoomRect,roomArea,roomBoundaryEdges} from './hotelRoomGeometry';

export type WindowKind='window'|'panoramic-window';
export const WINDOW_COST_CENTS:Readonly<Record<WindowKind,number>>={
 window:25000,'panoramic-window':60000,
};
export const LIGHT_COST_CENTS:Readonly<Record<LightingKind,number>>={
 ceiling:22000,ambient:12000,
};

const roomAt=(floor:HotelFloor,x:number,y:number):Room|null=>
 floor.rooms.find(r=>containsRoomCell(r,x,y))??null;
const onPlot=(site:HotelSite,x:number,y:number)=>
 x>=0&&y>=0&&x<site.width&&y<site.height;

/** The cells immediately inside and outside one metre of glazing.
 * One side must face a real room, and the other must NOT be another room.
 * Unbuilt space within the purchased plot counts as outside the building.
 */
export function windowAdjacentRoom(
 floor:HotelFloor,site:HotelSite,
 wall:Pick<Wall,'x'|'y'|'orientation'>,
):Room|null{
 const {x,y,orientation}=wall;
 if(!Number.isInteger(x)||!Number.isInteger(y))return null;
 if(orientation==='h'?(x<0||x>=site.width||y<0||y>site.height):
  (x<0||x>site.width||y<0||y>=site.height))return null;
 const x1=orientation==='h'?x:x-1;
 const y1=orientation==='h'?y-1:y;
 const x2=x,y2=y;
 const a=onPlot(site,x1,y1)?roomAt(floor,x1,y1):null;
 const b=onPlot(site,x2,y2)?roomAt(floor,x2,y2):null;
 return (!!a)!=(!!b)?(a??b):null;
}
export function windowAllowed(
 floor:HotelFloor,site:HotelSite,wall:Pick<Wall,'x'|'y'|'orientation'>,
):boolean{
 return windowAdjacentRoom(floor,site,wall)!==null;
}
/** Windows are placed/replaced at existing wall positions; doors must be
 * explicitly removed first so a window never disconnects guests by accident.
 */
export function toggleHotelWindow(
 floor:HotelFloor,site:HotelSite,window:Wall,
):HotelFloor{
 if(window.type!=='window'&&window.type!=='panoramic-window')
  throw Error('Select a window type.');
 const original=floor.walls.find(w=>w.x===window.x&&w.y===window.y&&
  w.orientation===window.orientation);
 if(original?.type===window.type)return toggleWall(floor,window,site);
 if(original?.type==='door')throw Error('Remove the existing doorway before installing a window.');
 if(!windowAllowed(floor,site,window))
  throw Error('Windows must face outdoors from a real room wall, not another room or an empty plot.');
 return toggleWall(floor,window,site);
}
/** Ceiling and ambient lights are overlays and never occupy furniture cells.
 * Tapping a fixture again removes it; changing its kind replaces it.
 */
export function toggleHotelLighting(
 floor:HotelFloor,site:HotelSite,light:LightingFixture,
):HotelFloor{
 if(light.kind!=='ceiling'&&light.kind!=='ambient')throw Error('Invalid lighting fixture.');
 if(!Number.isInteger(light.x)||!Number.isInteger(light.y)||
  !onPlot(site,light.x,light.y))throw Error('Lighting must use a valid room grid cell.');
 const room=roomAt(floor,light.x,light.y);
 if(!room||room.type==='stairwell'||room.type==='elevator')
  throw Error('Install lighting inside a usable room, not an empty plot or lift shaft.');
 const existing=(floor.lights??[]).find(l=>l.x===light.x&&l.y===light.y);
 if(existing?.kind===light.kind)
  return {...floor,lights:(floor.lights??[]).filter(l=>l.id!==existing.id)};
 if(existing)return {...floor,lights:(floor.lights??[]).map(l=>
  l.id===existing.id?{...existing,kind:light.kind}:l)};
 return {...floor,lights:[...(floor.lights??[]),light]};
}
/** Mobile-first suggestions: a room needs no pinch-accurate 1 m tap
 * to add a window or ceiling lamp. Suggestions do not alter any blueprint.
 */
export function suggestRoomWindow(
 floor:HotelFloor,site:HotelSite,roomId:string,
):Pick<Wall,'x'|'y'|'orientation'>|null{
 const room=floor.rooms.find(r=>r.id===roomId);
 if(!room)return null;
 const edges=roomBoundaryEdges(room);
 return edges.find(edge=>windowAdjacentRoom(floor,site,edge)?.id===room.id&&
  !floor.walls.some(w=>w.x===edge.x&&w.y===edge.y&&
   w.orientation===edge.orientation))??null;
}
export function suggestRoomLighting(
 floor:HotelFloor,roomId:string,
):{x:number;y:number}|null{
 const room=floor.rooms.find(r=>r.id===roomId);
 if(!room||room.type==='stairwell'||room.type==='elevator')return null;
 const centerX=room.x+(room.width-1)/2,centerY=room.y+(room.height-1)/2;
 const cells:Array<{x:number;y:number;dist:number}>=[];
 for(let y=room.y;y<room.y+room.height;y++)for(let x=room.x;x<room.x+room.width;x++)
  if(containsRoomCell(room,x,y))cells.push({x,y,dist:Math.abs(x-centerX)+Math.abs(y-centerY)});
 cells.sort((a,b)=>a.dist-b.dist);
 const free=cells.find(c=>!(floor.lights??[]).some(l=>l.x===c.x&&l.y===c.y));
 return free?{x:free.x,y:free.y}:null;
}

/** Light does not leave a room; no cross-room lighting, sunlight passing
 * through solid walls or 3D rendering is invented.
 */
export type RoomAtmosphere={
 windowCount:number;panoramicCount:number;
 naturalLight:number;artificialLight:number;score:number;
 grade:'Dark'|'Dim'|'Comfortable'|'Bright'|'Sunlit';
 advice:string[];
};
export function analyzeRoomAtmosphere(
 floor:HotelFloor,room:Room,site:HotelSite,
):RoomAtmosphere{
 const validWindows=floor.walls.filter(w=>
  (w.type==='window'||w.type==='panoramic-window')&&
  windowAdjacentRoom(floor,site,w)?.id===room.id);
 const windowCount=validWindows.filter(w=>w.type==='window').length;
 const panoramicCount=validWindows.filter(w=>w.type==='panoramic-window').length;
 const area=Math.max(1,roomArea(room));
 // A metre of larger glazing admits more light. Larger rooms require more.
 const naturalLight=Math.min(100,Math.round(
  ((windowCount+panoramicCount*1.75)*600)/Math.max(12,area)));
 const lights=(floor.lights??[]).filter(light=>
  containsRoomCell(room,light.x,light.y));
 const floorLamps=floor.objects.filter(o=>o.code==='lamp'&&
  containsRoomRect(room,{x:o.x,y:o.y,...furnitureSize(o)})).length;
 const lightPower=lights.reduce((n,l)=>n+(l.kind==='ceiling'?65:40),0)+floorLamps*22;
 const artificialLight=Math.min(100,Math.round(lightPower*18/Math.max(12,area)));
 const score=Math.round(naturalLight*.60+artificialLight*.40);
 const grade:RoomAtmosphere['grade']=score<20?'Dark':score<40?'Dim':
  score<60?'Comfortable':score<80?'Bright':'Sunlit';
 const advice:string[]=[];
 if(!validWindows.length)advice.push('Add an exterior window for daylight');
 else if(naturalLight<45)advice.push('Add another window or panoramic glazing');
 if(artificialLight<40)advice.push('Install a ceiling light or ambient fixture');
 if(artificialLight>=90&&naturalLight>=70)advice.push('Well-lit room with natural daylight');
 return {windowCount,panoramicCount,naturalLight,artificialLight,score,grade,advice};
}
export function hotelAtmosphereDemandModifier(score:number):number{
 if(!Number.isFinite(score))return 0;
 return Math.max(-.05,Math.min(.06,(score-50)*.0014));
}
