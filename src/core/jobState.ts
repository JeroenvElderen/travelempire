export const jobStates = ["REQUESTED","ASSIGNED","EN_ROUTE_TO_PICKUP","PASSENGER_ONBOARD","DROPOFF","COMPLETED","CANCELLED","FAILED"] as const;
export type JobState = (typeof jobStates)[number];
const transitions: Record<JobState,readonly JobState[]> = {
  REQUESTED:["ASSIGNED","CANCELLED"],
  ASSIGNED:["EN_ROUTE_TO_PICKUP","CANCELLED","FAILED"],
  EN_ROUTE_TO_PICKUP:["PASSENGER_ONBOARD","CANCELLED","FAILED"],
  PASSENGER_ONBOARD:["DROPOFF","FAILED"],
  DROPOFF:["COMPLETED","FAILED"],
  COMPLETED:[],CANCELLED:[],FAILED:[]
};
export function canTransition(from:JobState,to:JobState):boolean {
  return transitions[from].includes(to);
}
