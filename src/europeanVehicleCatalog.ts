import type {VehicleOffer} from './dealership';
// Clean-slate catalogue: only vehicles supported by user-provided manufacturer brochures.
// Specifications and grade compatibility are from Toyota Ireland Aygo X product guide (November 2025).
// All monetary amounts below are TravelEmpire gameplay prices, NOT Toyota quotations.
export type VehicleModel={brand:string;name:string;segment:'Economy'|'Standard'|'Comfort'|'Premium'|'XL';basePrice:number;seats:number;fuel:'Petrol'|'Hybrid'|'Diesel'|'Electric';years:number[]};
export const DEALERSHIP_BRANDS=['Toyota'] as const;
export const EUROPEAN_MODELS:VehicleModel[]=[{brand:'Toyota',name:'Aygo X',segment:'Economy',basePrice:24835,seats:4,fuel:'Hybrid',years:[2026]}];
export const BRANDS=['Toyota'];
export type FactoryOption={id:string;group:'Exterior'|'Wheels'|'Interior'|'Comfort'|'Technology'|'Safety';label:string;price:number;bonus:number;minimum?:VehicleModel['segment'];trims?:string[];years?:number[];variantIds?:string[];included?:boolean;requires?:string[];excludes?:string[];includes?:string[]};
export type VehicleColor={id:string;name:string;hex:string;price:number;trims?:string[];years?:number[];variantIds?:string[];bonus?:number};
export type ConfiguratorChoice={id:string;name:string;price:number;trims?:string[];years?:number[];variantIds?:string[];included?:boolean;bonus?:number;hex?:string;requires?:string[];excludes?:string[]};
export type ConfiguratorGroup={id:string;label:string;selection:'single'|'multiple';required?:boolean;choices:ConfiguratorChoice[]};
export type VehicleConfiguration={brand:string;model:string;year:number;reference?:string;notes?:string;colors:VehicleColor[];options:FactoryOption[];configurator:ConfiguratorGroup[]};
export type VerifiedVariant={id:string;trim:string;engine:string;fuel:VehicleModel['fuel'];transmission:string;powerHp:number;price:number;consumptionL100?:number;source:string;market:string};
export type MarketPrice={market:string;from:number;year:number;source:string;note:string;trims?:readonly string[]};
const SOURCE='https://scene7.toyota.eu/is/content/toyotaeurope/toyota/nmsc/ireland/guides/AYGOX-PDF-GUIDE.pdf';
export const VEHICLE_CONFIGURATIONS:Record<string,VehicleConfiguration>={
 'Toyota|Aygo X|2026':{
  brand:'Toyota',model:'Aygo X',year:2026,reference:SOURCE,
  notes:'November 2025 Toyota Ireland product guide. All prices are TravelEmpire game balance prices. Colours are grade-restricted as shown in brochure; HEX swatches approximate.',
  colors:[
   {id:'pure-white-040',name:'Pure White (040)',hex:'#F3F2EF',price:0,trims:['Pulse']},
   {id:'night-sky-black-209',name:'Night Sky Black (209)',hex:'#191B20',price:500,trims:['Pulse']},
   {id:'persian-salt-1k3',name:'Persian Salt (1K3)',hex:'#C5BFB3',price:500,trims:['Pulse']},
   {id:'cinnamon-4t4',name:'Cinnamon (4T4)',hex:'#AE6C4C',price:500,trims:['Design']},
   {id:'storm-grey-1m2',name:'Storm Grey (1M2)',hex:'#62676C',price:500,trims:['Design']},
   {id:'jasmine-silver-9ae',name:'Jasmine Silver (9AE)',hex:'#B8BDC0',price:500,trims:['Design']},
   {id:'pearl-white-089',name:'Pearl White (089)',hex:'#F2F0E8',price:850,trims:['Design']},
   {id:'lavender-939',name:'Lavender (939)',hex:'#A29AB5',price:500,trims:['Design']},
   {id:'tokyo-gold-5c5',name:'Tokyo Gold (5C5)',hex:'#B79B58',price:1100,trims:['GR SPORT']},
   {id:'tarragon-green-2vn',name:'Tarragon Green Bi-tone (2VN)',hex:'#68765D',price:1100,trims:['GR SPORT']}
  ],
  options:[],
  configurator:[{id:'wheels',label:'Wheels',selection:'single',required:true,choices:[
   {id:'pulse-17',name:'17-inch bi-tone dark grey machined-face alloy (5-spoke)',price:0,included:true,trims:['Pulse']},
   {id:'design-17',name:'17-inch bi-tone black machined-face alloy (5-spoke)',price:0,included:true,trims:['Design']},
   {id:'gr-sport-18',name:'18-inch GR Sport bi-tone black machined-face alloy (5-double-spoke)',price:0,included:true,trims:['GR SPORT']}
  ]}]
 }
};
const AYGO_VARIANTS:VerifiedVariant[]=[
 {id:'aygo-pulse',trim:'Pulse',engine:'1.5 HEV 116 hp',fuel:'Hybrid',transmission:'Automatic',powerHp:116,price:24835,consumptionL100:3.8,source:SOURCE,market:'Ireland (game price)'},
 {id:'aygo-design',trim:'Design',engine:'1.5 HEV 116 hp',fuel:'Hybrid',transmission:'Automatic',powerHp:116,price:27185,consumptionL100:3.8,source:SOURCE,market:'Ireland (game price)'},
 {id:'aygo-gr-sport',trim:'GR SPORT',engine:'1.5 HEV 116 hp',fuel:'Hybrid',transmission:'Automatic',powerHp:116,price:31185,consumptionL100:3.8,source:SOURCE,market:'Ireland (game price)'}
];
export const FACTORY_OPTIONS:FactoryOption[]=[];
export function vehicleConfiguration(model:VehicleModel,year:number):VehicleConfiguration|undefined{return VEHICLE_CONFIGURATIONS[model.brand+'|'+model.name+'|'+year];}
export function availableColors(model:VehicleModel,year:number,trim?:string):VehicleColor[]{return (vehicleConfiguration(model,year)?.colors??[]).filter(c=>(!c.trims||!!trim&&c.trims.includes(trim))&&(!c.years||c.years.includes(year)));}
export function availableConfiguratorGroups(model:VehicleModel,year:number,trim?:string,variantId?:string):ConfiguratorGroup[]{return (vehicleConfiguration(model,year)?.configurator??[]).map(g=>({...g,choices:g.choices.filter(c=>(!c.trims||!!trim&&c.trims.includes(trim))&&(!c.variantIds||!!variantId&&c.variantIds.includes(variantId)))})).filter(g=>g.choices.length>0);}
export function paintChoices(model:VehicleModel,year:number,trim:string):VehicleColor[]{return availableColors(model,year,trim);}
export function wheelChoices(model:VehicleModel,year:number,trim:string,variantId?:string):ConfiguratorChoice[]{return availableConfiguratorGroups(model,year,trim,variantId).find(g=>g.id==='wheels')?.choices??[];}
export function compatibleOptions(_model:VehicleModel):FactoryOption[]{return [];}
export function pricedOptions(_model:VehicleModel,_year:number):FactoryOption[]{return [];}
export function verifiedVariants(model:VehicleModel,year:number):readonly VerifiedVariant[]{return model.brand==='Toyota'&&model.name==='Aygo X'&&year===2026?AYGO_VARIANTS:[];}
export function marketPrice(_model:VehicleModel,_year:number):MarketPrice|undefined{return undefined;}
export function trimChoices(model:VehicleModel,year:number):readonly string[]{const variants=verifiedVariants(model,year);return [...new Set(variants.map(v=>v.trim))];}
export function trimPricing(model:VehicleModel,year:number,trim:string){const variant=verifiedVariants(model,year).find(v=>v.trim===trim);return {base:variant?.price??model.basePrice,cost:0,bonus:0};}
export function configuredOffer(model:VehicleModel,year:number,_optionIds:string[],trim:string,variantId?:string,paintId?:string,wheelId?:string):VehicleOffer{
 const variant=verifiedVariants(model,year).find(v=>v.id===variantId)??verifiedVariants(model,year).find(v=>v.trim===trim);
 const paint=paintChoices(model,year,trim).find(p=>p.id===paintId);
 const wheel=wheelChoices(model,year,trim,variantId).find(w=>w.id===wheelId);
 return {id:[model.brand,model.name,year,variant?.id??trim,paint?.id??'',wheel?.id??''].join('-'),model:model.brand+' '+model.name+(variant?' '+variant.engine+' '+variant.transmission:''),year,fuel:variant?.fuel??model.fuel,className:model.segment,price:(variant?.price??model.basePrice)+(paint?.price??0)+(wheel?.price??0),mileage:0,condition:100,seats:model.seats,kind:'New',trim,optionIds:[...(paint?['paint:'+paint.id]:[]),...(wheel?['wheel:'+wheel.id]:[])],revenueBonus:0};
}
