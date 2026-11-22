/** Original low-resolution, game-native research pictograms.
 * Used instead of platform emoji so every node has consistent artwork on
 * iOS, Android and desktop, including at pinch-zoom levels.
 */
type Shape=readonly [number,number,number,number,0|1|2|3];
const tiles:Readonly<Record<number,readonly Shape[]>>={
 // Revenue: coin
 0:[[4,1,8,2,0],[2,3,12,9,0],[4,12,8,2,0],[4,3,8,9,1],[5,4,5,2,2],[7,6,2,5,3]],
 // Engineering: block motor and cylinders
 1:[[3,4,11,8,0],[1,6,3,4,0],[5,2,2,3,0],[10,2,2,3,0],[5,5,7,5,1],[6,6,5,2,2],[8,9,2,3,3]],
 // Fleet: car with a roof and two tyres
 2:[[1,7,14,5,0],[4,4,8,4,0],[5,5,6,2,2],[2,8,12,3,1],[3,11,3,3,0],[10,11,3,3,0],[2,9,2,1,3]],
 // Surveying: folded map and road
 3:[[2,2,4,12,0],[6,1,4,13,0],[10,2,4,12,0],[3,3,3,9,1],[7,3,2,9,2],[11,3,2,9,1],[6,6,4,2,3],[8,8,2,3,3]],
 // Driver: head/shoulders
 4:[[6,2,5,5,0],[7,3,3,3,2],[3,10,11,4,0],[5,8,7,5,1],[7,10,3,3,2]],
 // Depots: warehouse with garage door
 5:[[2,3,12,3,0],[4,1,8,2,0],[3,6,10,8,0],[4,6,8,7,1],[5,9,6,4,3],[6,10,4,3,2]],
 // Marketing: megaphone and sound
 6:[[2,7,4,4,0],[5,5,6,7,0],[10,3,3,11,0],[4,8,2,2,2],[7,7,4,4,1],[4,11,2,3,3],[13,5,2,2,2]],
 // Finance: bank façade
 7:[[2,5,12,2,0],[7,1,2,3,0],[4,3,8,2,1],[3,7,2,6,0],[7,7,2,6,0],[11,7,2,6,0],[1,13,14,2,0],[4,7,1,5,2],[8,7,1,5,2],[12,7,1,5,2]],
 // Maritime: ship with deck and hull
 8:[[4,4,8,2,0],[6,1,3,3,0],[3,6,10,3,0],[1,9,14,3,0],[3,10,10,3,1],[5,7,6,1,2],[7,2,1,3,2]],
 // Hospitality: hotel windows
 9:[[3,1,10,13,0],[4,2,8,11,1],[5,4,2,2,2],[9,4,2,2,2],[5,7,2,2,2],[9,7,2,2,2],[7,11,2,3,0],[6,2,4,1,3]],
 // Construction: lifting crane
 10:[[3,1,2,13,0],[2,2,12,2,0],[8,3,1,8,0],[7,10,3,2,0],[6,12,5,2,0],[5,4,4,1,1],[11,5,3,2,2],[1,13,6,2,0]],
 // Corporate: tall offices
 11:[[1,5,5,10,0],[7,2,8,13,0],[2,6,3,8,1],[8,3,6,11,1],[3,7,1,2,2],[3,10,1,2,2],[9,5,2,2,2],[12,5,1,2,2],[9,9,2,2,2],[12,9,1,2,2]]
};
const fills:Readonly<Record<number,readonly [string,string,string,string]>>={
 0:['#795122','#e2ad41','#fff0b2','#ffe08b'],
 1:['#5a4530','#b88c66','#f2d7ad','#edb862'],
 2:['#223d53','#65afd1','#bcebf5','#355c79'],
 3:['#34583d','#72b884','#c8edb2','#d8e8b3'],
 4:['#4b413b','#9b826f','#eec7a9','#dacabb'],
 5:['#554139','#ac7952','#f2bc8e','#725745'],
 6:['#60433a','#db8b54','#f9ca9b','#eece61'],
 7:['#4d415e','#9888c2','#d9cbe9','#e3c775'],
 8:['#244c54','#61b2ba','#bcecef','#e5e7d1'],
 9:['#54473b','#bf996d','#f8dab5','#e6bb72'],
 10:['#57452e','#d3ad55','#fce1a2','#f6c878'],
 11:['#40536a','#779aba','#d4e6f7','#b6cadd']
};
// Compact accent silhouettes distinguish technologies within the same
// division. They are generated from stable project identifiers, not emoji,
// so icons remain consistent across reloads and mobile platforms.
const mini:readonly (readonly [number,number,number,number])[][]=[
 [[2,0,1,6],[0,2,5,1]],                           // cross
 [[0,0,5,1],[2,1,1,5]],                           // pick
 [[2,0,1,5],[0,2,5,1]],                           // compass
 [[0,0,5,2],[1,2,3,2],[2,4,1,2]],                 // marker
 [[0,4,5,1],[0,2,2,2],[3,0,2,4]],                 // rising graph
 [[0,1,2,4],[3,1,2,4],[2,0,1,6]],                 // rails
 [[0,1,5,1],[0,3,5,1],[0,5,5,1]],                 // three levels
 [[0,0,5,1],[0,5,5,1],[0,1,1,4],[4,1,1,4]],      // blueprint
 [[0,0,5,5],[1,1,3,3]],                           // case
 [[1,0,3,1],[0,1,5,3],[1,4,3,1]],                 // disc
 [[0,0,2,2],[3,0,2,2],[0,3,2,2],[3,3,2,2]],      // tiles
 [[0,0,5,2],[1,2,3,3]],                           // structure
 [[1,0,3,1],[0,1,5,3],[1,4,3,2]],                 // engine
 [[2,0,1,2],[0,2,5,1],[1,3,3,3]],                 // pin
 [[0,0,5,2],[2,2,1,4]],                           // T
 [[0,0,1,6],[0,5,5,1],[4,1,1,4]]                 // right angle
];
function projectMark(projectId:string):number{
 let hash=17;
 for(let i=0;i<projectId.length;i++)
  hash=((hash*33)^projectId.charCodeAt(i))>>>0;
 return hash%mini.length;
}
export default function ResearchPixelIcon({category,size=32,projectId,level=1}:{
 category:number;size?:number;projectId?:string;level?:number
}){
 const shapes=tiles[category]??tiles[0];
 const palette=fills[category]??fills[0];
 const variant=projectId?projectMark(projectId):null;
 return <svg viewBox="0 0 16 16" width={size} height={size}
  aria-hidden="true" focusable="false" shapeRendering="crispEdges">
  {shapes.map(([x,y,w,h,ink],index)=><rect key={index} x={x} y={y}
   width={w} height={h} fill={palette[ink]}/>)}
  {variant!==null&&<g>
   <rect x={8} y={8} width={8} height={8} fill="#282b2c" opacity={.88}/>
   <rect x={9} y={9} width={6} height={6} fill="#4d6154"/>
   {mini[variant].map(([x,y,w,h],i)=>
    <rect key={i} x={9+x} y={9+y} width={w} height={h}
     fill={i%3===0?'#f3df9d':'#b3e8c1'}/>)}
  </g>}
  {projectId&&<g>
   <rect x={1} y={14} width={Math.max(2,Math.min(5,level))} height={1}
    fill={['#e0c392','#c8deab','#a3dfb7','#9ac6f2','#f0e2a9'][Math.max(0,Math.min(4,level-1))]}/>
  </g>}
 </svg>;
}
