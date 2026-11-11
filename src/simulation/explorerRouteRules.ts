/** Discovery missions must approach their first assigned red edge exclusively
 * over already-purple roads. A specialist cannot bypass the class hierarchy
 * by silently transiting red roads belonging to another explorer.
 *
 * After the first discovery, an explicitly verified one-way escape can still
 * cross another class without turning that road purple.
 */
export function hasPrematureRedTransit(
 routeIds:readonly string[],
 purple:ReadonlySet<string>,
 discoveryIds:ReadonlySet<string>
):boolean{
 const first=routeIds.findIndex(id=>discoveryIds.has(id));
 if(first<0)return true; // An explorer mission needs actual discovery work.
 for(let i=0;i<first;i++)if(!purple.has(routeIds[i]))return true;
 return false;
}
