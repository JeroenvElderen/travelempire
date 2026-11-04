/** Persistent 24x game clock: 60 real minutes = one game day. */
export const GAME_TIME_SCALE = 24;
const KEY_PREFIX = 'travelempire.clock.';
export type GameClock = { epochMs:number; lastRealMs:number };
export function loadGameClock(companyId:string, now=Date.now()):GameClock {
  try {
    const saved=JSON.parse(localStorage.getItem(KEY_PREFIX+companyId)??'null') as GameClock|null;
    if(saved && Number.isFinite(saved.epochMs) && Number.isFinite(saved.lastRealMs)) {
      const elapsed=Math.max(0,now-saved.lastRealMs);
      return {epochMs:saved.epochMs+elapsed*GAME_TIME_SCALE,lastRealMs:now};
    }
  } catch { /* New clock */ }
  const initial=new Date(now); initial.setHours(8,0,0,0);
  return {epochMs:initial.getTime(),lastRealMs:now};
}
export function advanceGameClock(clock:GameClock,now=Date.now()):GameClock {
  return {epochMs:clock.epochMs+Math.max(0,now-clock.lastRealMs)*GAME_TIME_SCALE,lastRealMs:now};
}
export function saveGameClock(companyId:string,clock:GameClock):void {
  try {localStorage.setItem(KEY_PREFIX+companyId,JSON.stringify(clock));}catch { /* Storage unavailable */ }
}
export function gameHour(clock:GameClock):number {
  const date=new Date(clock.epochMs);
  return date.getHours()+date.getMinutes()/60+date.getSeconds()/3600;
}
export function isShiftActive(clock:GameClock,startHour=8,lengthHours=8):boolean {
  const elapsed=(gameHour(clock)-startHour+24)%24;
  return elapsed<lengthHours;
}
export function formatGameClock(clock:GameClock):string {
  return new Intl.DateTimeFormat('en-GB',{weekday:'short',hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'UTC'}).format(new Date(clock.epochMs));
}
