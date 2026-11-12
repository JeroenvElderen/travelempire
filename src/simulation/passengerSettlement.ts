/** Book a passenger fare exactly once per stable request ID.
 * This does NOT generate income until the vehicle simulator confirms drop-off.
 * The caller owns the bounded, persisted set of already paid job IDs.
 */
export function settlePassengerFare(
 jobId:string|undefined,finished:boolean,baseFare:number,
 multiplier:number,paid: Set<string>
):{earned:number;duplicate:boolean}{
 if(!finished||baseFare<=0||!Number.isFinite(baseFare))
  return {earned:0,duplicate:false};
 if(jobId&&paid.has(jobId))return {earned:0,duplicate:true};
 if(jobId)paid.add(jobId);
 return {earned:Math.round(baseFare*Math.max(1,Math.min(1.6,multiplier))*100)/100,
  duplicate:false};
}
