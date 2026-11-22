import {resourceKeys,type ResourceBag,type ResourceCosts} from './researchProgress';
import {PRODUCT_KEYS,recipeById,recipeAvailable,recipeIngredients,
 type ProductBag,type ProductKey} from './researchProducts';

/** Persistent audit ledger for automatically synthesized research products.
 * Each recipe unit is one atomic transaction: either all ingredients exist
 * and are consumed once, or no resources are removed.
 */
export type ProductionLedger={
 productInventory?:Record<string,number>;
 productProduced?:Record<string,number>;
 productConsumed?:Record<string,number>;
 productContributions?:Record<string,Record<string,number>>;
 productRawSpent?:ResourceBag;
 productCursor?:number;
};
export type ProductionTarget={key:string;goal:ProductBag};
type RecipeStock={
 raw:ResourceBag;stock:Record<string,number>;produced:Record<string,number>;
 consumed:Record<string,number>;spent:ResourceBag;
};
const count=(o:Record<string,number>,key:string)=>Math.max(0,o[key]??0);
const copy=(s:RecipeStock):RecipeStock=>({
 raw:{...s.raw},stock:{...s.stock},produced:{...s.produced},
 consumed:{...s.consumed},spent:{...s.spent}
});
/** Applies one recipe unit using already-produced stock where possible, then
 * recursively produces missing ingredients. `trail` guards cycles.
 */
function takeProduct(stock:RecipeStock,key:ProductKey,levels:Partial<Record<string,number>>,
 amount:number,trail:Set<string>,budget:{left:number}):boolean{
 if(trail.has(key))return false;
 const available=count(stock.stock,key);
 if(available<amount){
  const recipe=recipeById.get(key);
  if(!recipe||!recipeAvailable(key,levels))return false;
  const needed=amount-available;
  trail.add(key);
  for(let i=0;i<needed;i++){
   if(budget.left<=0){trail.delete(key);return false;}
   // Use atomic preflight at the top-level to roll back partial intermediates.
   for(const ingredient of recipeIngredients(key)){
    if(ingredient.kind==='product'){
     if(!takeProduct(stock,ingredient.key,levels,ingredient.count,trail,budget)){
      trail.delete(key);return false;
     }
    }else{
     if(stock.raw[ingredient.key]<ingredient.count){
      trail.delete(key);return false;
     }
     stock.raw[ingredient.key]-=ingredient.count;
     stock.spent[ingredient.key]+=ingredient.count;
    }
   }
   stock.stock[key]=count(stock.stock,key)+1;
   stock.produced[key]=count(stock.produced,key)+1;
   budget.left--;
  }
  trail.delete(key);
 }
 stock.stock[key]=count(stock.stock,key)-amount;
 stock.consumed[key]=count(stock.consumed,key)+amount;
 return true;
}

export function allocateResearchProducts(
 targets:readonly ProductionTarget[],levels:Partial<Record<string,number>>,
 raw:ResourceBag,ledger:ProductionLedger,maxRecipes=2500
):{resources:ResourceBag;ledger:ProductionLedger;changed:boolean}{
 const inventory={...(ledger.productInventory??{})};
 const created={...(ledger.productProduced??{})};
 const consumed={...(ledger.productConsumed??{})};
 const spent={...Object.fromEntries(resourceKeys.map(k=>[k,ledger.productRawSpent?.[k]??0]))} as ResourceBag;
 const contributions:Record<string,Record<string,number>>={...ledger.productContributions};
 const candidates=targets.filter(t=>PRODUCT_KEYS.some(k=>(t.goal[k]??0)>0));
 if(!candidates.length)return {resources:raw,ledger,changed:false};
 const budget={left:Math.max(0,Math.floor(maxRecipes))};
 const stock:RecipeStock={raw:{...raw},stock:inventory,produced:created,consumed,spent};
 let changed=false;
 const initialCursor=Math.max(0,ledger.productCursor??0);
 const ordered=candidates.slice(initialCursor%candidates.length).concat(candidates.slice(0,initialCursor%candidates.length));
 // Rotate one product requirement per candidate per round, so a single large
 // project cannot take every rare ferry, hotel or construction report.
 const remaining=ordered.reduce((sum,t)=>sum+PRODUCT_KEYS.reduce((n,k)=>
  n+Math.max(0,(t.goal[k]??0)-(contributions[t.key]?.[k]??0)),0),0);
 for(let round=0;round<remaining&&budget.left>0;round++){
  let any=false;
  for(const target of ordered){
   const previous={...(contributions[target.key]??{})};
   let fulfilled=false;
   for(const product of PRODUCT_KEYS){
    if((previous[product]??0)>=(target.goal[product]??0))continue;
    // Complete one atomic product request; unsuccessful ingredient requests
    // never consume raw data or intermediate product stock.
    const staged=copy(stock),attempt={left:budget.left};
    if(!takeProduct(staged,product,levels,1,new Set(),attempt))continue;
    stock.raw=staged.raw;stock.stock=staged.stock;stock.produced=staged.produced;
    stock.consumed=staged.consumed;stock.spent=staged.spent;budget.left=attempt.left;
    previous[product]=(previous[product]??0)+1;
    contributions[target.key]=previous;
    changed=true;any=true;fulfilled=true;
    break;
   }
   if(fulfilled&&budget.left<=0)break;
  }
  if(!any)break;
 }
 if(!changed)return {resources:raw,ledger,changed:false};
 return {resources:stock.raw,changed:true,ledger:{
  productInventory:stock.stock,productProduced:stock.produced,productConsumed:stock.consumed,
  productContributions:contributions,productRawSpent:stock.spent,
  productCursor:(initialCursor+1)%candidates.length
 }};
}
