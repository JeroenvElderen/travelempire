/** Display helpers for the persistent in-game UTC clock.
 * Construction stores absolute hours since the Unix epoch; these values
 * must never appear raw in player-facing delivery and building screens.
 */
import {HOUR_MS} from './internalConstruction';

const scheduleFormatter=new Intl.DateTimeFormat('en-IE',{
 timeZone:'UTC',weekday:'short',day:'numeric',month:'short',year:'numeric',
 hour:'2-digit',minute:'2-digit',hourCycle:'h23',
});

/** Converts a saved absolute game hour to an in-game calendar date. */
export function formatConstructionDate(gameHour:number):string{
 if(!Number.isFinite(gameHour))return 'Time unavailable';
 const ms=gameHour*HOUR_MS;
 if(!Number.isFinite(ms)||Math.abs(ms)>8.64e15)return 'Time unavailable';
 return scheduleFormatter.format(new Date(ms));
}

/** Counts down in in-game minutes, updated whenever the game clock ticks.
 * E.g. 1.5 game hours -> "In 1h 30m". This is NOT wall-clock time.
 */
export function formatGameCountdown(targetHour:number,currentGameHour:number):string{
 if(!Number.isFinite(targetHour)||!Number.isFinite(currentGameHour))return 'Time unavailable';
 const minutes=Math.max(0,Math.ceil((targetHour-currentGameHour)*60-1e-7));
 if(minutes===0)return 'Due now';
 const days=Math.floor(minutes/1440);
 const hours=Math.floor(minutes%1440/60);
 const remainder=minutes%60;
 if(days)return 'In '+days+'d'+(hours?' '+hours+'h':'')+' (game time)';
 if(hours)return 'In '+hours+'h'+(remainder?' '+remainder+'m':'')+' (game time)';
 return 'In '+remainder+'m (game time)';
}

export function milestoneCountdown(
 targetHour:number,currentGameHour:number,completedLabel:string,
):string{
 return currentGameHour>=targetHour?completedLabel:
  formatGameCountdown(targetHour,currentGameHour);
}
