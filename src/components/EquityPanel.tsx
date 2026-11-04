import {useMemo,useState} from 'react';
import type {Company} from '../company';
import type {FleetState,EquityEvent} from '../simulation/taxi';
import {bankOf} from '../banking';
import {equityOf,FOUNDER_ID,ownership,votingPercent,valueCompany,investorOffers,distributableProfit,shareTotal} from '../equity';
import './equity-panel.css';
const eur=(n:number)=>new Intl.NumberFormat('en-IE',{style:'currency',currency:'EUR',maximumFractionDigits:2}).format(n);
type Props={company:Company|null;fleet:FleetState;gameEpochMs:number;onInvest:(investorId:string)=>void;onIssue:(investorId:string,amount:number)=>void;onDividend:(amount:number)=>void;onBuyback:(investorId:string,shares:number)=>void;error:string};
export default function EquityPanel({company,fleet,gameEpochMs,onInvest,onIssue,onDividend,onBuyback,error}:Props){
 const [investor,setInvestor]=useState('investor-0');
 const [issueAmount,setIssueAmount]=useState('10000');
 const [dividend,setDividend]=useState('1000');
 const [buybackHolder,setBuybackHolder]=useState('');
 const [buybackQuantity,setBuybackQuantity]=useState('1');
 const [detail,setDetail]=useState<'offers'|'ownership'|'history'>('offers');
 const equity=useMemo(()=>equityOf(fleet.equity),[fleet.equity]);
 const valuation=useMemo(()=>company?valueCompany(company,fleet,gameEpochMs):null,[company,fleet,gameEpochMs]);
 if(!company||!valuation)return <p>Create a company to manage investors and shareholders.</p>;
 const offers=investorOffers(valuation,equity);
 const selected=offers.find(o=>o.id===investor);
 const outsiders=equity.holders.filter(h=>h.id!==FOUNDER_ID);
 const holder=outsiders.find(h=>h.id===buybackHolder);
 const reserve=bankOf(fleet.bank).minimumOperatingCash;
 const profit=distributableProfit(fleet,equity);
 const dividendAmount=Number(dividend);
 const buybackShares=Number(buybackQuantity);
 const buybackCost=holder&&Number.isSafeInteger(buybackShares)&&buybackShares>0?Math.round(valuation.value*buybackShares/shareTotal(equity)*100)/100:0;
 const shareIssuePercent=Number(issueAmount)>0?100*Number(issueAmount)/(valuation.value+Number(issueAmount)):0;
 const points=equity.valuationHistory;
 const graphPoints=points.length>1?points:[{gameDay:new Date(gameEpochMs).toISOString().slice(0,10),value:valuation.value,confidence:valuation.investorConfidence,founderPercent:ownership(equity,FOUNDER_ID),equity:valuation.assetValue}];
 const min=Math.min(...graphPoints.map(p=>p.value),0),max=Math.max(...graphPoints.map(p=>p.value),1);
 const chart=graphPoints.map((p,i)=>`${graphPoints.length===1?0:i/(graphPoints.length-1)*640},${155-140*(p.value-min)/(max-min||1)}`).join(' ');
 const download=()=>{
  const header='Game day,Valuation,Investor confidence,Founder ownership,Net asset equity';
  const rows=points.map(p=>[p.gameDay,p.value,p.confidence,p.founderPercent,p.equity].join(','));
  const events=['Event,Game time,Holder,Amount,Shares,Valuation,Notes',...equity.events.map(e=>[e.type,new Date(e.gameTime).toISOString(),JSON.stringify(e.holderName),e.amount,e.shares,e.valuation,JSON.stringify(e.note)].join(','))];
  const csv=[header,...rows,'',...events].join('\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='travelempire-shareholders.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 };
 return <section className="equity-panel">
  <header className="equity-header"><div><h2>Company valuation & shareholders</h2><p>Raise equity capital, manage ownership and distribute profits.</p></div><button onClick={download}>Export shareholder history</button></header>
  <div className="equity-metrics"><article><small>ESTIMATED COMPANY VALUE</small><strong>{eur(valuation.value)}</strong></article><article><small>FOUNDER OWNERSHIP</small><strong>{ownership(equity,FOUNDER_ID).toFixed(2)}%</strong></article><article><small>INVESTOR CONFIDENCE</small><strong>{valuation.investorConfidence}/100</strong></article><article><small>DISTRIBUTABLE PROFIT</small><strong>{eur(profit)}</strong></article></div>
  <div className="equity-grid"><article><h3>Valuation model</h3><div><span>Net assets, depots and subsidiaries</span><strong>{eur(valuation.assetValue)}</strong></div><div><span>Profitability contribution</span><strong>{eur(valuation.earningsValue)}</strong></div><div><span>Growth adjustment</span><strong>{eur(valuation.growthValue)}</strong></div><div><span>Estimated enterprise equity value</span><strong>{eur(valuation.value)}</strong></div><p>Indicative gameplay valuation, not a market quotation. Cash, owned vehicle book values, depot investment, liabilities and recorded profit are considered. No historical earnings are invented.</p></article>
  <article><h3>Ownership distribution</h3><div className="equity-ownership-bar">{equity.holders.map((h,i)=><div key={h.id} style={{width:`${ownership(equity,h.id)}%`,background:['#45b6a2','#e2ac58','#8b9ff2','#cb83a7'][i%4]}} title={`${h.name}: ${ownership(equity,h.id).toFixed(2)}%`}/>)}</div>{equity.holders.map(h=><div key={h.id}><span>{h.name} · {h.shares.toLocaleString()} shares</span><strong>{ownership(equity,h.id).toFixed(2)}% · {votingPercent(equity,h.id).toFixed(2)}% votes</strong></div>)}<p>All shares carry one vote. New issues dilute existing owners; buybacks retire purchased shares.</p></article></div>
  <div className="equity-nav"><button className={detail==='offers'?'active':''} onClick={()=>setDetail('offers')}>Investment & capital</button><button className={detail==='ownership'?'active':''} onClick={()=>setDetail('ownership')}>Dividends & buybacks</button><button className={detail==='history'?'active':''} onClick={()=>setDetail('history')}>History</button></div>
  {detail==='offers'&&<div className="equity-grid"><article><h3>Investor offers</h3><p>Offers are generated deterministically from the current valuation and investor confidence. Accepting an offer issues new shares and credits operating cash.</p>{offers.length?offers.map(o=><div className="equity-offer" key={o.id}><div><strong>{o.name}</strong><small>{eur(o.amount)} for approximately {o.equityPercent}% post-money equity</small></div><button onClick={()=>onInvest(o.id)}>Accept offer</button></div>):<p>Investor confidence is too low for external offers. Improve profitability and cash reserves.</p>}</article><article><h3>Custom share issuance</h3><label>Investor<select value={investor} onChange={e=>setInvestor(e.target.value)}>{['investor-0','investor-1','investor-2'].map((id,i)=><option key={id} value={id}>{['Hellenic Mobility Partners','Aegean Growth Capital','Urban Transit Ventures'][i]}</option>)}</select></label><label>New investment (€)<input type="number" min={1} step=".01" value={issueAmount} onChange={e=>setIssueAmount(e.target.value)}/></label><div><span>Estimated new investor share</span><strong>{Number.isFinite(shareIssuePercent)?shareIssuePercent.toFixed(2):'0'}%</strong></div><div><span>Post-money company value</span><strong>{eur(valuation.value+(Number(issueAmount)||0))}</strong></div><button disabled={!selected||!Number.isFinite(Number(issueAmount))||Number(issueAmount)<=0} onClick={()=>onIssue(investor,Number(issueAmount))}>Issue new shares</button><p>Share issuance is financing, not passenger revenue. It increases cash and share count without creating accounting profit.</p></article></div>}
  {detail==='ownership'&&<div className="equity-grid"><article><h3>Pay shareholder dividends</h3><div><span>Available undistributed profit</span><strong>{eur(profit)}</strong></div><div><span>Operating cash</span><strong>{eur(company.cash)}</strong></div><div><span>Minimum operating reserve</span><strong>{eur(reserve)}</strong></div><label>Dividend amount (€)<input type="number" min=".01" step=".01" value={dividend} onChange={e=>setDividend(e.target.value)}/></label><button disabled={!Number.isFinite(dividendAmount)||dividendAmount<=0||dividendAmount>profit||dividendAmount>company.cash-reserve} onClick={()=>onDividend(dividendAmount)}>Distribute dividends</button><p>Paid pro rata to all shareholders. Dividends reduce cash and retained profits but are not operating expenses.</p></article>
  <article><h3>Buy back investor shares</h3><label>Shareholder<select value={buybackHolder} onChange={e=>setBuybackHolder(e.target.value)}><option value="">Choose shareholder</option>{outsiders.map(h=><option key={h.id} value={h.id}>{h.name} · {h.shares} shares</option>)}</select></label><label>Shares to repurchase<input type="number" min={1} max={holder?.shares??1} step={1} value={buybackQuantity} onChange={e=>setBuybackQuantity(e.target.value)}/></label><div><span>Estimated cost</span><strong>{eur(buybackCost)}</strong></div><button disabled={!holder||!Number.isSafeInteger(buybackShares)||buybackShares<1||buybackShares>holder.shares||buybackCost>company.cash-reserve} onClick={()=>onBuyback(buybackHolder,buybackShares)}>Buy back and retire shares</button><p>Repurchased shares are retired, increasing remaining owners' percentages. Buybacks use cash without reducing operating profit.</p></article></div>}
  {detail==='history'&&<><article className="equity-history"><h3>Valuation history</h3><svg viewBox="0 0 640 170" preserveAspectRatio="none" role="img" aria-label="Historical company valuation"><polyline points={chart} fill="none" stroke="#45b6a2" strokeWidth="3" vectorEffect="non-scaling-stroke"/></svg><div><span>{graphPoints[0].gameDay}</span><span>{graphPoints[graphPoints.length-1].gameDay}</span></div><p>Valuation snapshots are recorded once per simulated day while the game is running.</p></article><article className="equity-history"><h3>Investment and shareholder events</h3>{equity.events.map((e:EquityEvent)=><div key={e.id}><span>{new Date(e.gameTime).toLocaleDateString()} · {e.type} · {e.holderName}</span><strong>{eur(e.amount)} · {e.shares} shares</strong></div>)}{!equity.events.length&&<p>No equity transactions yet.</p>}</article></>}
  {valuation.reasons.length>0&&<div className="equity-alerts"><h3>Investor confidence factors</h3>{valuation.reasons.map((reason,i)=><p key={i}>{reason}</p>)}</div>}
  {error&&<p role="alert">{error}</p>}
  <p className="equity-note">Investments, buybacks and dividends update persistent fleet equity records and bank transaction history. The founder initially owns 10,000 shares. Issuance adds shares, buybacks retire them, and dividends require recorded distributable profit and an operating cash buffer. All prices and investor names are fictional gameplay mechanics.</p>
 </section>;
}
