import {describe,it,expect} from 'vitest';
import {dispatchAllowed,graphMemoryLimitReached,isIOSWebKit,
 IOS_MAX_ROAD_EDGES,IOS_MAX_ROAD_NODES,IOS_ESSENTIAL_ROAD_EDGE_LIMIT,IOS_ESSENTIAL_ROAD_NODE_LIMIT,
 roadTileBudgetAvailable,IOS_DISPATCH_INTERVAL_MS,
 IOS_BACKGROUND_TILE_DELAY_MS} from './roadMemoryPolicy';

describe('mobile Safari stability budget',()=>{
 it('recognizes Safari and installed iOS browsers regardless of displayed Safari version',()=>{
  expect(isIOSWebKit('Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) Version/26.6 Mobile Safari')).toBe(true);
  expect(isIOSWebKit('Mozilla/5.0 (iPad; CPU OS 18_7 like Mac OS X) AppleWebKit')).toBe(true);
  expect(isIOSWebKit('Mozilla/5.0 (Macintosh; Intel Mac OS X 13) Chrome/123')).toBe(false);
 });
 it('stops speculative graph growth on iOS before the logged 675k edges',()=>{
  expect(graphMemoryLimitReached(true,675142,615106)).toBe(true);
  expect(graphMemoryLimitReached(true,IOS_MAX_ROAD_EDGES-1,IOS_MAX_ROAD_NODES-1)).toBe(false);
  expect(graphMemoryLimitReached(true,IOS_MAX_ROAD_EDGES,0)).toBe(true);
  expect(graphMemoryLimitReached(true,0,IOS_MAX_ROAD_NODES)).toBe(true);
  expect(graphMemoryLimitReached(false,900000,900000)).toBe(false);
 });
 it('allows essential depot tiles after speculative expansion has paused',()=>{
  expect(roadTileBudgetAvailable(true,IOS_MAX_ROAD_EDGES,IOS_MAX_ROAD_NODES)).toBe(false);
  expect(roadTileBudgetAvailable(true,IOS_MAX_ROAD_EDGES,IOS_MAX_ROAD_NODES,true)).toBe(true);
  expect(roadTileBudgetAvailable(true,IOS_ESSENTIAL_ROAD_EDGE_LIMIT-1,
   IOS_ESSENTIAL_ROAD_NODE_LIMIT-1,true)).toBe(true);
  expect(roadTileBudgetAvailable(true,IOS_ESSENTIAL_ROAD_EDGE_LIMIT,0,true)).toBe(false);
  expect(roadTileBudgetAvailable(true,0,IOS_ESSENTIAL_ROAD_NODE_LIMIT,true)).toBe(false);
  expect(roadTileBudgetAvailable(false,2_000_000,2_000_000,true)).toBe(true);
  expect(IOS_ESSENTIAL_ROAD_EDGE_LIMIT).toBeLessThan(500_000);
 });
 it('backs off background work while retaining separate realtime movement',()=>{
  expect(IOS_DISPATCH_INTERVAL_MS).toBeGreaterThanOrEqual(2000);
  expect(IOS_BACKGROUND_TILE_DELAY_MS).toBeGreaterThanOrEqual(3000);
  expect(dispatchAllowed(true,true,false)).toBe(true);
  expect(dispatchAllowed(false,true,false)).toBe(false);
  expect(dispatchAllowed(true,true,true)).toBe(false);
  expect(dispatchAllowed(true,false,false)).toBe(false);
 });
});
