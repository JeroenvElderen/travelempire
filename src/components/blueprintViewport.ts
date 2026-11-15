/** Pure viewport geometry for the 2D hotel floor-plan editor.
 * Scrolling and zooming must not modify saved room positions or furniture.
 */
export const MIN_PLAN_ZOOM=0.25;
export const MAX_PLAN_ZOOM=2.5;

export type PlanScroll={left:number;top:number};
export function planZoom(value:number):number{
 if(!Number.isFinite(value))return 1;
 return Math.min(MAX_PLAN_ZOOM,Math.max(MIN_PLAN_ZOOM,Math.round(value*100)/100));
}

/** Keep the same plan coordinate directly under the focus point when zooming. */
export function zoomScrollAt(
 scroll:PlanScroll,fromZoom:number,toZoom:number,
 focus:{x:number;y:number},
):PlanScroll{
 const ratio=toZoom/Math.max(0.001,fromZoom);
 return {
  left:(scroll.left+focus.x)*ratio-focus.x,
  top:(scroll.top+focus.y)*ratio-focus.y,
 };
}

export type PinchOrigin={
 zoom:number;distance:number;
 scroll:PlanScroll;center:{x:number;y:number};
};
/** Two-finger drag pans; changing finger separation zooms around the original plan point. */
export function pinchViewport(origin:PinchOrigin,now:{distance:number;center:{x:number;y:number}}):
 {zoom:number;scroll:PlanScroll}{
 const zoom=planZoom(origin.zoom*now.distance/Math.max(1,origin.distance));
 const ratio=zoom/Math.max(0.001,origin.zoom);
 return {zoom,scroll:{
  left:(origin.scroll.left+origin.center.x)*ratio-now.center.x,
  top:(origin.scroll.top+origin.center.y)*ratio-now.center.y,
 }};
}
