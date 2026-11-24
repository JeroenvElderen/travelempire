import {useState} from 'react';
import {Package,ArrowDownToLine,ArrowUpFromLine,TrendingUp,History} from 'lucide-react';
import {COLLECTOR_PARTS,COLLECTOR_NAMES,type CollectorState,type CollectorPart} from '../resourceCollectors';
import {marketQuote,marketUnitPrices,marketForDay,type MarketSide} from '../resourceMarket';
import {SUPPLIER_COLORS} from '../generatedSuppliers';
export type MarketControls={state:CollectorState;levels:Partial<Record<string,number>>;cash:number;gameNow:number;onTrade:(part:CollectorPart,side:MarketSide,quantity:number,expectedTotalCents:number)=>string|null};
const eur=(cents:number)=>new Intl.NumberFormat('en-IE',{style:'currency',currency:'EUR'}).format(cents/100);
export default function ResourceMarketPanel({state,levels,cash,gameNow,onTrade}:MarketControls){
 const [part,setPart]=useState<CollectorPart>('mechanical'),[side,setSide]=useState<MarketSide>('buy'),[qty,setQty]=useState('1'),[notice,setNotice]=useState(''),[error,setError]=useState(false);
 const market=marketForDay(state,gameNow),quantity=Number(qty);
 const valid=Number.isSafeInteger(quantity)&&quantity>0&&quantity<=100000;
 const quote=valid?marketQuote(state,levels,cash,gameNow,part,side,quantity):null;
 const max=marketQuote(state,levels,cash,gameNow,part,side,1).maxQuantity;
 const submit=()=>{if(!quote||quote.reason)return;const result=onTrade(part,side,quantity,quote.totalCents);setError(!!result);setNotice(result??(side==='buy'?'Purchased ':'Sold ')+quantity+' '+COLLECTOR_NAMES[part]);};
 return <div className="collector-detail resource-market" aria-label="Resource marketplace">
  <h3>Resource marketplace</h3><p>Trade directly with external suppliers. Daily quotas and price spreads keep collection valuable. Purchases enter shared warehouse stock immediately.</p>
  <div className="collector-overview"><div><small>Operating cash</small><strong>{eur(Math.round(cash*100))}</strong></div><div><small>Lifetime market balance</small><strong>{eur(market.soldCents-market.boughtCents)}</strong></div><small>Purchases {eur(market.boughtCents)} · Sales {eur(market.soldCents)}</small></div>
  <div className="market-list">{COLLECTOR_PARTS.map(p=>{
   const prices=marketUnitPrices(state,p,gameNow);
   return <button type="button" key={p} className={'market-resource'+(p===part?' selected':'')} onClick={()=>{setPart(p);setQty('1');setNotice('')}} aria-pressed={p===part}>
    <span className="market-dot" style={{background:SUPPLIER_COLORS[p]}}><Package size={16}/></span><span><strong>{COLLECTOR_NAMES[p]}</strong><small>{state.stock[p]??0} stored · {prices.buyAvailable} buy / {prices.sellAvailable} sell today</small></span><span className="market-prices"><small>Buy {eur(prices.buyCents)}</small><small>Sell {eur(prices.sellCents)}</small></span>
   </button>;
  })}</div>
  <div className="market-order">
   <h3>{COLLECTOR_NAMES[part]}</h3>
   <div className="collector-tabs"><button type="button" aria-pressed={side==='buy'} onClick={()=>{setSide('buy');setNotice('')}}><ArrowDownToLine size={16}/>Buy</button><button type="button" aria-pressed={side==='sell'} onClick={()=>{setSide('sell');setNotice('')}}><ArrowUpFromLine size={16}/>Sell</button></div>
   <label>Units<div className="market-quantity"><input type="number" min="1" step="1" value={qty} onChange={e=>{setQty(e.target.value);setNotice('')}}/><button type="button" disabled={!max} onClick={()=>setQty(String(max))}>Max {max}</button></div></label>
   <div className="collector-overview"><div><small>Unit price</small><strong>{quote?eur(quote.unitCents):'—'}</strong></div><div><small>{side==='buy'?'Total cost':'Total proceeds'}</small><strong>{quote?eur(quote.totalCents):'—'}</strong></div></div>
   <button type="button" className="market-submit" disabled={!quote||!!quote.reason} onClick={submit}>{quote?.reason??(!quote?'Enter whole units':side==='buy'?'Confirm purchase':'Confirm sale')}</button>
   {notice&&<p role={error?'alert':'status'} className={error?'collector-error':'market-success'}>{notice}</p>}
   <small><TrendingUp size={13}/> Prices respond to discovered supply, daily market fluctuations and completed trades. Quotas reset each simulated day.</small>
  </div>
  <h3><History size={17}/> Recent transactions</h3>
  {market.history.slice(0,10).map(t=><div className="market-history" key={t.id}><span><strong>{t.side==='buy'?'Bought':'Sold'} {t.quantity} units</strong><small>{COLLECTOR_NAMES[t.part]}</small></span><b>{t.side==='buy'?'-':'+'}{eur(t.totalCents)}</b></div>)}
  {!market.history.length&&<p>No market transactions yet.</p>}
 </div>;
}
