import {useEffect,useMemo,useRef,useState} from 'react';
import {CarFront,ChevronDown,ChevronRight} from 'lucide-react';
import {EUROPEAN_MODELS,configuredOffer,trimChoices,trimPricing,verifiedVariants,paintChoices,wheelChoices,individualOptions,type VehicleModel} from '../europeanVehicleCatalog';
import {eur,type VehicleOffer} from '../dealership';
import {DRIVER_COST} from '../simulation/taxi';
import {AUDI_A5_PAINT_SPRITES,audiA5PaintForConfigurator} from '../audiA5Sprites';
import {AUDI_A6_PAINT_SPRITES,audiA6PaintForConfigurator} from '../audiA6Sprites';
import {VehiclePaintImage,AudiA5PaintThumb,AudiA6PaintThumb,SkodaOctaviaPaintThumb,ToyotaCorollaPaintThumb,EstateSuvPaintThumb} from './AudiAvantVehicleImage';
import {ESTATE_SUV_PAINTS,estateSuvPaintForConfigurator,estateSuvModelForVehicle} from '../estateSuvSprites';
import {SKODA_OCTAVIA_PAINT_SPRITES,skodaOctaviaPaintForConfigurator} from '../skodaOctaviaSprites';
import {TOYOTA_COROLLA_PAINT_SPRITES,toyotaCorollaPaintForConfigurator} from '../toyotaCorollaSprites';
import {financeQuote,leaseQuote} from '../economy';
import {vehicleFinanceQuote} from '../simulation/vehicleFinancing';
import type {Company} from '../company';
import type {FleetState} from '../simulation/taxi';
import {dealershipModelAvailable,vehicleResearchLock} from '../researchUnlocks';
import './EuropeanDealership.css';

type Props={reviewing:boolean;onReviewChange:(reviewing:boolean)=>void;cash:number;company:Company;fleet:FleetState;gameNow:number;researchLevels?:Partial<Record<string,number>>;starterLevel?:number;ready:boolean;quantity:number;mode:'cash'|'finance'|'lease';depositPercent:number;termDays:number;depotName:string;parkingError:string;initialBrand?:string;initialModel?:string;onBack?:()=>void;onOrder:(offer:VehicleOffer,quantity:number,mode:'cash'|'finance'|'lease',depositPercent:number,termDays:number)=>void};
export default function EuropeanDealership({reviewing,onReviewChange,cash,company,fleet,gameNow,researchLevels,starterLevel,ready,quantity,mode,depositPercent,termDays,depotName,parkingError,onOrder,initialBrand='Toyota',initialModel,onBack}:Props){
 const brand=initialBrand;
 const models=useMemo(()=>EUROPEAN_MODELS.filter(m=>m.brand===brand&&dealershipModelAvailable(m,starterLevel)),[brand,starterLevel]);
 const [selected,setSelected]=useState(initialModel??(models[0]?models[0].brand+' '+models[0].name:'Toyota Corolla Touring Sports'));
 const model:VehicleModel=models.find(m=>m.brand+' '+m.name===selected)??models[0];
 const [selectedYear,setYear]=useState(2026);
 const year=model.years.includes(selectedYear)?selectedYear:model.years[0];
 const [trim,setTrim]=useState<string>('Base');
 const [paintId,setPaintId]=useState('');
 const [wheelId,setWheelId]=useState('');
 const [selectedExtras,setSelectedExtras]=useState<string[]>([]);
 const [variantId,setVariantId]=useState('');
 const summaryRef=useRef<HTMLElement>(null);
 useEffect(()=>{if(reviewing)summaryRef.current?.scrollIntoView({behavior:'smooth',block:'start'});},[reviewing]);
 const choices=trimChoices(model,year);
 const currentTrim=choices.includes(trim)?trim:choices[0];
 const variants=verifiedVariants(model,year);
 const availableVariants=variants.filter(v=>v.trim===currentTrim);
 const activeVariant=availableVariants.find(v=>v.id===variantId)??availableVariants[0];
 const paints=paintChoices(model,year,currentTrim);
 const wheels=wheelChoices(model,year,currentTrim,activeVariant?.id);
 const paint=paints.find(p=>p.id===paintId)??paints[0];
 const vehicleSprite=audiA5PaintForConfigurator(model.brand,model.name,paint?.id)??
  audiA6PaintForConfigurator(model.brand,model.name,paint?.id)??
  skodaOctaviaPaintForConfigurator(model.brand,model.name,paint?.id)??
  toyotaCorollaPaintForConfigurator(model.brand,model.name,paint?.id)??
  estateSuvPaintForConfigurator(model.brand,model.name,paint?.id);
 const skodaCombi=model.brand==='Skoda'&&model.name==='Octavia Combi';
 const corollaTouring=model.brand==='Toyota'&&model.name==='Corolla Touring Sports';
 const audiA6=model.brand==='Audi'&&model.name==='A6 Avant e-hybrid';
 const estateSuv=estateSuvModelForVehicle(model.brand+' '+model.name);
 const wheel=wheels.find(w=>w.id===wheelId)??wheels[0];
 const extras=useMemo(()=>{
  const options=individualOptions(model,year,currentTrim);
  // Manufacturer data sometimes repeats the same equipment under different IDs.
  // Show it once and charge only once.
  const unique=new Map<string,(typeof options)[number]>();
  for(const option of options){
   const key=option.label.trim().toLocaleLowerCase().replace(/\\s+/g,' ');
   const previous=unique.get(key);
   if(!previous||(!option.included&&previous.included))unique.set(key,option);
  }
  return [...unique.values()];
 },[model,year,currentTrim]);
 const extraIds=selectedExtras.filter(id=>extras.some(o=>o.id===id&&!o.included));
 const selectableExtras=extras.filter(o=>!o.included);
 const allExtrasSelected=selectableExtras.length>0&&selectableExtras.every(o=>extraIds.includes(o.id));
 const extraTotal=extras.filter(o=>extraIds.includes(o.id)).reduce((n,o)=>n+o.price,0);
 const priceBreakdown=trimPricing(model,year,currentTrim);
 const offer=configuredOffer(model,year,extraIds,currentTrim,activeVariant?.id,paint?.id,wheel?.id);
 const financing=mode==='finance'?vehicleFinanceQuote(company,fleet,gameNow,offer.price,quantity,depositPercent,termDays,researchLevels):null;
 const upfront=mode==='cash'?offer.price+DRIVER_COST:mode==='finance'?financeQuote(offer.price,depositPercent,termDays).deposit+DRIVER_COST:leaseQuote(offer.price,termDays).upfront+DRIVER_COST;
 const dueNow=financing?.upfront??Math.round(upfront*quantity*100)/100;
 const checkoutBlocker=!ready?'Road network is still loading. Open the map near your depot and try again.':
  vehicleResearchLock({levels:researchLevels??{},starterLevel},offer,starterLevel!==undefined)||parkingError||financing?.reason||(dueNow>cash+.001?'Not enough operating cash for the upfront payment and driver costs.':'');
 const bonus=offer.revenueBonus??0;
 return <section className="eu-dealership">
  {onBack&&<button type="button" className="eu-back" onClick={onBack}>← Back to models</button>}
  <header className="eu-dealer-hero"><div><span>VEHICLE CONFIGURATOR</span><h2>{model.brand} {model.name}</h2><p>{year} · {activeVariant?.fuel??model.fuel} · {model.seats} seats</p></div><div className="eu-hero-price"><small>Configured price</small><strong>{eur(offer.price)}</strong></div></header>
  <div className={'eu-dealer-grid'+(reviewing?' eu-reviewing':'')}>
   {!reviewing&&<div className="eu-dealer-controls">
    <section className="eu-config-group">
      <div className="eu-config-group-heading"><span className="eu-step-number">01</span><h3>Vehicle</h3></div>
      <div className="eu-two"><label>Model<select value={model.name} onChange={e=>{setSelected(brand+' '+e.target.value);setYear(models.find(m=>m.name===e.target.value)?.years[0]??2026);setSelectedExtras([]);setPaintId('');setWheelId('');setTrim('Base');setVariantId('')}}>{models.map(m=><option key={m.name} value={m.name}>{m.name}</option>)}</select></label><label>Year<select value={year} onChange={e=>{setYear(Number(e.target.value));setTrim('Base');setPaintId('');setWheelId('');setSelectedExtras([]);setVariantId('')}}>{model.years.map(y=><option key={y} value={y}>{y}</option>)}</select></label></div>
      <label>Trim<select value={currentTrim} onChange={e=>{setTrim(e.target.value);setVariantId('');setSelectedExtras([])}}>{choices.map(choice=><option key={choice} value={choice}>{choice}</option>)}</select></label>
      {availableVariants.length>0&&<label>Engine &amp; transmission<select value={activeVariant?.id??''} onChange={e=>setVariantId(e.target.value)}>{availableVariants.map(v=><option key={v.id} value={v.id}>{v.engine} · {v.transmission}</option>)}</select></label>}
    </section>
    <section className="eu-config-group">
      <div className="eu-config-group-heading"><span className="eu-step-number">02</span><h3>Appearance</h3></div>
      <div className="eu-two"><label>Paint<select value={paint?.id??''} onChange={e=>setPaintId(e.target.value)}>{paints.map(p=><option key={p.id} value={p.id}>{p.name}{p.price?' · +'+eur(p.price):''}</option>)}</select></label><label>Wheels<select value={wheel?.id??''} onChange={e=>setWheelId(e.target.value)}>{wheels.map(w=><option key={w.id} value={w.id}>{w.name}{w.price?' · +'+eur(w.price):''}</option>)}</select></label></div>
      {model.brand==='Audi'&&(model.name==='A5 Avant e-hybrid'||audiA6)&&<div className="eu-audi-paint-section">
       <div className="eu-audi-paint-choices" role="group" aria-label={model.name+' paint preview choices'}>
        {(audiA6?AUDI_A6_PAINT_SPRITES:AUDI_A5_PAINT_SPRITES).filter(sprite=>paints.some(p=>p.id===sprite.id)).map(sprite=><button type="button" key={sprite.id}
         aria-pressed={paint?.id===sprite.id} title={sprite.name} onClick={()=>setPaintId(sprite.id)}>
         {audiA6?<AudiA6PaintThumb paint={sprite}/>:<AudiA5PaintThumb paint={sprite}/>}
         <span>{sprite.name}</span>
        </button>)}
       </div>
       <small className="eu-audi-paint-choices-note">Nine top-down paint previews. A6 additional colour choices are TravelEmpire custom finishes, not verified factory options. Unpictured paints retain the standard car icon.</small>
      </div>}
      {estateSuv&&<div className="eu-audi-paint-section">
       <div className="eu-audi-paint-choices" role="group" aria-label={model.name+' paint image choices'}>
        {ESTATE_SUV_PAINTS.filter(sprite=>sprite.model===estateSuv&&paints.some(p=>
           estateSuvPaintForConfigurator(model.brand,model.name,p.id)?.id===sprite.id))
         .map(sprite=>{
          const available=paints.find(p=>estateSuvPaintForConfigurator(model.brand,model.name,p.id)?.id===sprite.id);
          return <button type="button" key={sprite.id} title={sprite.name}
           aria-pressed={paint?.id===available?.id} onClick={()=>available&&setPaintId(available.id)}>
           <EstateSuvPaintThumb paint={sprite}/><span>{sprite.name}</span>
          </button>;
         })}
       </div>
       <small className="eu-audi-paint-choices-note">Top-down Q7, Q9 and Volvo paint previews. Factory trim restrictions and prices remain unchanged. Unspecified exclusive finishes retain the standard icon.</small>
      </div>}
      {corollaTouring&&<div className="eu-audi-paint-section">
       <div className="eu-audi-paint-choices" role="group" aria-label="Toyota Corolla Touring Sports paint previews">
        {TOYOTA_COROLLA_PAINT_SPRITES.filter(sprite=>paints.some(p=>p.id===sprite.id))
          .map(sprite=><button type="button" key={sprite.id}
           aria-pressed={paint?.id===sprite.id} title={sprite.name}
           onClick={()=>setPaintId(sprite.id)}>
           <ToyotaCorollaPaintThumb paint={sprite}/><span>{sprite.name}</span>
          </button>)}
       </div>
       <small className="eu-audi-paint-choices-note">Six standard paints and four GR SPORT bi-tone finishes with black roofs. Colours and prices follow the selected trim.</small>
      </div>}
      {skodaCombi&&<div className="eu-audi-paint-section">
       <div className="eu-audi-paint-choices" role="group" aria-label="Škoda Octavia Combi paint previews">
        {SKODA_OCTAVIA_PAINT_SPRITES.filter(sprite=>paints.some(p=>
         skodaOctaviaPaintForConfigurator('Skoda','Octavia Combi',p.id)?.id===sprite.id))
         .map(sprite=>{
          const choice=paints.find(p=>skodaOctaviaPaintForConfigurator(
           'Skoda','Octavia Combi',p.id)?.id===sprite.id);
          return <button type="button" key={sprite.id}
           aria-pressed={paint?.id===choice?.id}
           onClick={()=>choice&&setPaintId(choice.id)} title={sprite.name}>
           <SkodaOctaviaPaintThumb paint={sprite}/><span>{sprite.name}</span>
          </button>;
         })}
       </div>
       <small className="eu-audi-paint-choices-note">Factory paint pricing and grade availability are preserved. Phoenix Orange is a TravelEmpire-only custom colour.</small>
      </div>}
    </section>
    <details className="eu-extras-panel eu-config-group">
     <summary><span className="eu-extras-title"><span className="eu-step-number">03</span><strong>Optional equipment</strong></span><span className="eu-extras-count">{extraIds.length} selected <ChevronDown size={16}/></span></summary>
     <div className="eu-extras-content">
      <div className="eu-extras-toolbar"><small>{selectableExtras.length} available options</small><div><button type="button" disabled={!selectableExtras.length||allExtrasSelected} onClick={()=>setSelectedExtras(selectableExtras.map(o=>o.id))}>Select all</button><button type="button" disabled={!extraIds.length} onClick={()=>setSelectedExtras([])}>Clear</button></div></div>
      {(['Safety','Comfort','Technology','Exterior','Interior','Wheels'] as const).map(group=>{
       const categoryExtras=extras.filter(o=>o.group===group&&!o.included);
       const selectedCount=categoryExtras.filter(o=>extraIds.includes(o.id)).length;
       if(!categoryExtras.length)return null;
       return <details key={group} className="eu-equipment-category">
        <summary>{group}<span>{selectedCount}/{categoryExtras.length} <ChevronDown size={14}/></span></summary>
        <div className="eu-options">{categoryExtras.map(o=>{
         const checked=extraIds.includes(o.id);
         return <button key={o.id} type="button" className={checked?'eu-option-selected':''} aria-pressed={checked} onClick={()=>setSelectedExtras(old=>old.includes(o.id)?old.filter(id=>id!==o.id):[...old,o.id])}>
          <span className="eu-option-copy"><strong>{o.label}</strong><small>+{eur(o.price)}</small></span><span className="eu-option-indicator">{checked?'✓':'+'}</span>
         </button>;
        })}</div>
       </details>;
      })}
     </div>
    </details>
   </div>}
   <aside className="eu-config-summary" ref={summaryRef}>
    <div className="eu-vehicle-stage">
     {vehicleSprite?<VehiclePaintImage model={model.brand+' '+model.name} paintId={paint?.id}
       className="eu-audi-preview" fallbackSrc={`${import.meta.env.BASE_URL}assets/car_topview.svg`}
       alt={vehicleSprite.name+' '+model.brand+' '+model.name+' top-down view'}/>:<CarFront size={29} aria-hidden="true"/>}
     <small>{year} · {model.segment} · {activeVariant?.fuel??model.fuel}</small>
    </div>
    <h3>{year} {model.brand} {model.name}</h3><p>{currentTrim} grade · {paint?.name??'Standard paint'} · {wheel?.name??'Standard wheels'}</p>
    <details className="eu-price-breakdown"><summary>Price breakdown <span>View details <ChevronDown size={15}/></span></summary><div>
      <div className="eu-price-line"><span>Base vehicle</span><strong>{eur(activeVariant?.price??priceBreakdown.base)}</strong></div>
      <div className="eu-price-line"><span>Trim</span><strong>{eur(activeVariant?0:priceBreakdown.cost)}</strong></div>
      <div className="eu-price-line"><span>Paint</span><strong>{eur(paint?.price??0)}</strong></div>
      <div className="eu-price-line"><span>Wheels</span><strong>{eur(wheel?.price??0)}</strong></div>
      <div className="eu-price-line"><span>Options</span><strong>{eur(extraTotal)}</strong></div>
     </div></details>
    <div className="eu-price-total"><span>Configured price</span><strong>{eur(offer.price)}</strong></div>
    <div className="eu-revenue"><span>Fare bonus</span><strong>+{bonus}%</strong><small>Example €25 fare → €{(25*(1+bonus/100)).toFixed(2)}</small></div>
    <div className="eu-price-line"><span>Estimated energy cost / 100 km</span><strong>{eur((activeVariant?.fuel??model.fuel)==='Electric'?18*.32:(activeVariant?.fuel??model.fuel)==='Hybrid'?4.6*1.85:(activeVariant?.fuel??model.fuel)==='Diesel'?5.8*1.75:8*1.85)}</strong></div>
    <div className="eu-price-line"><span>Quantity</span><strong>{quantity}</strong></div>
    <div className="eu-price-line"><span>Delivery</span><strong>{depotName}</strong></div>
    {parkingError&&<p className="dealer-parking-error" role="alert">{parkingError}</p>}
    {financing&&<div className="eu-finance-summary" aria-label="Vehicle finance offer">
     <div className="eu-price-line"><span>Credit score</span><strong>{financing.score} / 850</strong></div>
     <div className="eu-price-line"><span>Company credit available</span><strong>{eur(financing.businessAvailable)}</strong></div>
     <div className="eu-price-line"><span>New vehicle collateral credit</span><strong>{eur(financing.assetCredit)}</strong></div>
     <div className="eu-price-line"><span>Max finance for this order</span><strong>{eur(financing.available)}</strong></div>
     <div className="eu-price-line"><span>Financed principal</span><strong>{eur(financing.principal)}</strong></div>
     <div className="eu-price-line"><span>Annual interest</span><strong>{(financing.rate*100).toFixed(2)}%</strong></div>
     <div className="eu-price-line"><span>Daily instalments (total)</span><strong>{eur(financing.dailyPayment)}</strong></div>
     <div className="eu-price-line"><span>Total interest</span><strong>{eur(financing.totalInterest)}</strong></div>
     <div className="eu-price-line"><span>Cash kept in reserve</span><strong>{eur(financing.minimumOperatingCash)}</strong></div>
    </div>}
    <div className="eu-price-total eu-checkout-due"><span>Due now incl. drivers</span><strong>{eur(dueNow)}</strong></div>
    {!reviewing?<button className="eu-order" type="button" onClick={()=>onReviewChange(true)}>Review order →</button>:<><p className="eu-review-message">{quantity} vehicle(s) · {mode} · {eur(Math.max(0,cash-dueNow))} remaining cash</p><button className="eu-order" disabled={!!checkoutBlocker} onClick={()=>onOrder(offer,quantity,mode,depositPercent,termDays)}>Confirm order · {eur(dueNow)}</button>{checkoutBlocker&&<p className="dealer-parking-error" role="alert">{checkoutBlocker}</p>}<button type="button" className="eu-back" onClick={()=>onReviewChange(false)}>← Edit configuration</button></>}
    <small className="eu-brief-note">Vehicle prices and equipment may include gameplay estimates.</small>
   </aside>
  </div>
  {!reviewing&&<div className="eu-mobile-quick-order"><span><small>Configured price</small><strong>{eur(offer.price)}</strong></span><button type="button" onClick={()=>onReviewChange(true)}>Review order <ChevronRight size={16}/></button></div>}
 </section>;
}
