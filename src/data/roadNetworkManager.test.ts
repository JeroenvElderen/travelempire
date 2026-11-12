import {describe,expect,it} from 'vitest';
import {RoadNetworkManager} from './roadNetworkManager';

type LoaderHarness={
 loaded:Set<string>;available:Set<string>;queued:Set<string>;queue:string[];
 tileSize:number;pump:()=>void;
};
function harness(){
 const manager=new RoadNetworkManager(()=>{},()=>{});
 const state=manager as unknown as LoaderHarness;
 state.tileSize=0.1;
 state.pump=()=>{}; // Inspect scheduling without opening network requests or web workers.
 return{manager,state};
}
describe('automatic explorer expansion across road tile boundaries',()=>{
 it('requests adjacent tiles when the explorer is idle inside an already loaded tile',()=>{
  const {manager,state}=harness();
  state.loaded.add('240_380');
  state.available=new Set(['240_380','241_380','239_380','245_380']);
  const requested=manager.considerExplorerExpansion([[24.05,38.05]]);
  expect(requested).toBe(2);
  expect(state.queue).toContain('241_380');
  expect(state.queue).toContain('239_380');
  expect(state.queue).not.toContain('245_380');
  manager.dispose();
 });
 it('never synthesizes nonexistent tiles or jumps to a disconnected island',()=>{
  const {manager,state}=harness();
  state.loaded.add('240_380');
  state.available=new Set(['240_380','245_380','240_382']);
  expect(manager.considerExplorerExpansion([[24.05,38.05]])).toBe(0);
  expect(state.queue).toHaveLength(0);
  manager.dispose();
 });
 it('continues into the next ring once the first adjacent tile is loaded',()=>{
  const {manager,state}=harness();
  state.loaded.add('240_380');
  state.loaded.add('241_380');
  state.available=new Set(['240_380','241_380','242_380']);
  expect(manager.considerExplorerExpansion([[24.05,38.05]])).toBe(1);
  expect(state.queue).toEqual(['242_380']);
  expect(manager.considerExplorerExpansion([[24.05,38.05]])).toBe(0);
  manager.dispose();
 });
});
