import {describe,expect,it} from "vitest";
import {canTransition} from "./jobState";
describe("job state contracts",()=>{
  it("requires real pickup and dropoff stages",()=>{
    expect(canTransition("REQUESTED","COMPLETED")).toBe(false);
    expect(canTransition("REQUESTED","ASSIGNED")).toBe(true);
    expect(canTransition("DROPOFF","COMPLETED")).toBe(true);
  });
  it("does not allow a completed trip to pay or complete again",()=>{
    expect(canTransition("COMPLETED","COMPLETED")).toBe(false);
    expect(canTransition("COMPLETED","ASSIGNED")).toBe(false);
  });
});
