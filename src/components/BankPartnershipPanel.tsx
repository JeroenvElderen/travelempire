import {useState} from 'react';
import type {Company} from '../company';
import type {FleetState} from '../simulation/taxi';
import {PARTNERSHIP_BANKS,partnershipOffer,revenueAverage} from '../simulation/bankPartnerships';
import {securedQuote} from '../simulation/securedLoans';

type Props={company:Company;fleet:FleetState;gameEpochMs:number;
 onAccept:(bankId:string,amount:number,share:number)=>void;onBuyout:(id:string)=>void};
const eur=(value:number)=>new Intl.NumberFormat('en-IE',{style:'currency',currency:'EUR',maximumFractionDigits:2}).format(value);

export default function BankPartnershipPanel({company,fleet,gameEpochMs,onAccept,onBuyout}:Props){
 const [requested,setRequested]=useState(2000000);
 const [selected,setSelected]=useState('growth');
 const [proposedShare,setProposedShare]=useState(15);
 const valuation=securedQuote(company,fleet,gameEpochMs,1000,365);
 const history=fleet.financeHistory??[];
 const avg=revenueAverage(history);
 const contracts=fleet.bankPartnerships??[];
 const offers=PARTNERSHIP_BANKS.map(bank=>({id:bank.id,...partnershipOffer(bank.id,requested,valuation.companyValue,avg,valuation.score,contracts,proposedShare)}));
 const chosen=offers.find(o=>o.id===selected)??offers[1];
 const committed=contracts.filter(d=>d.repaid<d.repaymentCap-.005).reduce((a,d)=>a+d.revenueShare,0);
 return <section className="finance-loan loan-configurator" aria-label="Bank partnerships" style={{marginTop:24}}>
  <div className="finance-section-heading"><h2>Bank partnerships & revenue financing</h2><span>Expansion capital · €500k–€10m</span></div>
  <p>Negotiate funding in exchange for a percentage of gross passenger and owned-ferry revenue. Payments stop automatically at the agreed repayment cap. No permanent equity is transferred.</p>
   <p>Collections are deducted when each passenger fare or owned-ferry receipt settles, not once per game day. Across your active agreements, up to {Math.min(45,committed)}% of each €100 gross receipt goes to banks ({eur(Math.min(45,committed))}); fuel, wages and other expenses still have to be paid. These financing repayments reduce cash even when the operating-profit total is positive.</p>
  <div className="company-metrics">
   <article><small>EST. DAILY REVENUE</small><strong>{eur(avg)}</strong></article>
   <article><small>ACTIVE REVENUE SHARE</small><strong>{committed}%</strong></article>
   <article><small>BANK PARTNERSHIPS</small><strong>{contracts.filter(d=>d.repaid<d.repaymentCap-.005).length} / 3</strong></article>
   <article><small>TOTAL REPAID</small><strong>{eur(fleet.bankPartnershipPaid??0)}</strong></article>
  </div>
  <label htmlFor="partnership-request">Requested bank funding</label>
  <input id="partnership-request" type="number" min={500000} max={10000000} step={100000}
   value={requested} onChange={e=>setRequested(Number(e.target.value)||0)}/>
  <input aria-label="Adjust bank funding request" type="range" min={500000} max={10000000} step={100000}
   value={Math.min(10000000,Math.max(500000,requested))} onChange={e=>setRequested(Number(e.target.value))}/>
  <label htmlFor="proposed-bank-share">Proposed bank revenue share: {proposedShare}%</label>
  <input id="proposed-bank-share" type="range" min={5} max={35} step={1}
   value={proposedShare} onChange={e=>setProposedShare(Number(e.target.value))}/>
  <p>Propose a percentage and choose a lender. The bank can counter with a higher share, different total repayment cap, or less funding based on your performance and existing agreements.</p>
  <div style={{display:'grid',gap:12}}>
   {offers.map(offer=><button key={offer.id} type="button" onClick={()=>setSelected(offer.id)}
    aria-pressed={selected===offer.id}
    style={{textAlign:'left',display:'grid',gap:6,padding:14,borderRadius:12,
     background:selected===offer.id?'rgba(121,94,211,.2)':'rgba(125,138,165,.08)',
     border:selected===offer.id?'2px solid #a874fc':'1px solid rgba(140,155,190,.35)',color:'inherit'}}>
    <strong>{offer.bank}</strong>
    <span>Funding: {eur(offer.funding)} · Revenue share: {offer.revenueShare}% · Cap: {offer.repaymentMultiple.toFixed(2)}×</span>
    <small>{offer.reason}{offer.funding>0&&offer.funding<requested?' · Counteroffer instead of requested amount':''}</small>
   </button>)}
  </div>
  <div className="company-metrics">
   <article><small>OFFERED FUNDING</small><strong>{eur(chosen.funding)}</strong></article>
   <article><small>BANK SHARE</small><strong>{chosen.revenueShare}% of gross revenue</strong></article>
   <article><small>MAXIMUM REPAYMENT</small><strong>{eur(chosen.repaymentCap)}</strong></article>
   <article><small>ESTIMATED PER GAME DAY</small><strong>{eur(avg*chosen.revenueShare/100)}</strong></article>
  </div>
  <button type="button" disabled={!chosen.approved} onClick={()=>{
   if(window.confirm('Accept '+chosen.bank+' funding of '+eur(chosen.funding)+'? The bank receives '+chosen.revenueShare+'% of future gross revenue until '+eur(chosen.repaymentCap)+' has been repaid.'))onAccept(chosen.id,requested,proposedShare);
  }}>{chosen.approved?'Accept '+chosen.bank+' offer':'No eligible bank offer'}</button>
  <small>{chosen.reason}. Repayment estimates assume the same average daily gross revenue and can change with operations. Negotiating a new bank does not alter current secured loans.</small>
  {contracts.length>0&&<div style={{marginTop:18}}>
   <h3>Bank agreements</h3>
   {contracts.map(contract=>{
    const remaining=Math.max(0,contract.repaymentCap-contract.repaid);
    const complete=remaining<.005;
    return <div className="finance-loan" key={contract.id}>
     <strong>{contract.bank} · {complete?'Repaid':'Active'}</strong>
     <span>Received {eur(contract.principal)} · Share {contract.revenueShare}% · Cap {eur(contract.repaymentCap)}</span>
     <progress max={contract.repaymentCap} value={contract.repaid} style={{width:'100%'}}/>
     <small>{eur(contract.repaid)} repaid · {eur(remaining)} remaining</small>
     {!complete&&<button type="button" disabled={company.cash<remaining} onClick={()=>{
      if(window.confirm('Pay '+eur(remaining)+' to close the '+contract.bank+' agreement now?'))onBuyout(contract.id);
     }}>Buy out agreement · {eur(remaining)}</button>}
    </div>;
   })}
  </div>}
 </section>;
}
