import type {VehicleOffer} from './dealership';
// Corolla Saloon MY26: Toyota Ireland January 2026 product guide.
// All purchase and upgrade prices are TravelEmpire game values, not Toyota quotes.
export type VehicleModel={brand:string;name:string;segment:'Economy'|'Standard'|'Comfort'|'Premium'|'XL';basePrice:number;seats:number;fuel:'Petrol'|'Hybrid'|'Diesel'|'Electric';years:number[]};
export const DEALERSHIP_BRANDS=['Toyota'] as const;
export const EUROPEAN_MODELS:VehicleModel[]=[{brand:'Toyota',name:'Corolla Saloon',segment:'Standard',basePrice:34605,seats:5,fuel:'Hybrid',years:[2026]}];
export const BRANDS=['Toyota'];
export type FactoryOption={id:string;group:'Exterior'|'Wheels'|'Interior'|'Comfort'|'Technology'|'Safety';label:string;price:number;bonus:number;minimum?:VehicleModel['segment'];trims?:string[];years?:number[];variantIds?:string[];included?:boolean;includedTrims?:string[];requires?:string[];excludes?:string[];includes?:string[]};
export type VehicleColor={id:string;name:string;hex:string;price:number;trims?:string[];years?:number[];variantIds?:string[];bonus?:number};
export type ConfiguratorChoice={id:string;name:string;price:number;trims?:string[];years?:number[];variantIds?:string[];included?:boolean;bonus?:number;hex?:string;requires?:string[];excludes?:string[]};
export type ConfiguratorGroup={id:string;label:string;selection:'single'|'multiple';required?:boolean;choices:ConfiguratorChoice[]};
export type VehicleConfiguration={brand:string;model:string;year:number;reference?:string;notes?:string;colors:VehicleColor[];options:FactoryOption[];configurator:ConfiguratorGroup[]};
export type VerifiedVariant={id:string;trim:string;engine:string;fuel:VehicleModel['fuel'];transmission:string;powerHp:number;price:number;consumptionL100?:number;source:string;market:string};
export type MarketPrice={market:string;from:number;year:number;source:string;note:string;trims?:readonly string[]};
const SOURCE="https://scene7.toyota.eu/is/content/toyotaeurope/toyota/nmsc/ireland/guides/COROLLA-SALOON-PDF-GUIDE.pdf";
export const VEHICLE_CONFIGURATIONS:Record<string,VehicleConfiguration>={
 'Toyota|Corolla Saloon|2026':{
 brand:'Toyota',model:'Corolla Saloon',year:2026,reference:SOURCE,
 notes:'January 2026 Ireland product guide. Grade equipment is standard where specified; optional upgrades and prices are game mechanics, not Toyota factory ordering claims. HEX swatches are approximate.',
 colors:[{id:'corolla-saloon-paint-0',name:"Pure White (040)",hex:'#F3F2EF',price:0},{id:'corolla-saloon-paint-1',name:"Night Sky Black (209)",hex:'#1C1D22',price:500},{id:'corolla-saloon-paint-2',name:"Midnight Teal (785)",hex:'#244C53',price:500},{id:'corolla-saloon-paint-3',name:"Storm Grey (1M2)",hex:'#70777D',price:500},{id:'corolla-saloon-paint-4',name:"Pearl Ice White (089)",hex:'#F3F0E8',price:850},{id:'corolla-saloon-paint-5',name:"Pearl Red (3U5)",hex:'#A32932',price:850},{id:'corolla-saloon-paint-6',name:"Precious Silver (1J6)",hex:'#B9B9B6',price:850},{id:'corolla-saloon-paint-7',name:"Metal Oxide (4Z3)",hex:'#9D6552',price:850}],
 options:[],configurator:[{id:'wheels',label:'Wheels',selection:'single',required:true,choices:[
 {id:'corolla-luna-16',name:'16-inch alloy wheels (5-double-spoke)',price:0,included:true,trims:['Luna']},
 {id:'corolla-luna-sport-17',name:'17-inch alloy wheels',price:0,included:true,trims:['Luna Sport']},
 {id:'corolla-sol-18',name:'18-inch bi-tone grey machined-face alloy wheels (5-double-spoke)',price:0,included:true,trims:['Sol']}
 ]}]
 }};
export const FACTORY_OPTIONS:FactoryOption[]=[];
export const COROLLA_SALOON_OPTIONS:FactoryOption[]=[{id:'corolla-saloon-extra-0',group:"Safety",label:"Toyota Safety Sense 3",price:0,bonus:0,includedTrims:["Luna","Luna Sport","Sol"]},
{id:'corolla-saloon-extra-1',group:"Safety",label:"Pre-Collision System with pedestrian and cyclist detection",price:0,bonus:0,includedTrims:["Luna","Luna Sport","Sol"]},
{id:'corolla-saloon-extra-2',group:"Safety",label:"Intelligent Adaptive Cruise Control",price:0,bonus:0,includedTrims:["Luna","Luna Sport","Sol"]},
{id:'corolla-saloon-extra-3',group:"Safety",label:"Lane Departure Alert and Lane Trace Assist",price:0,bonus:0,includedTrims:["Luna","Luna Sport","Sol"]},
{id:'corolla-saloon-extra-4',group:"Safety",label:"Road Sign Assist",price:0,bonus:0,includedTrims:["Luna","Luna Sport","Sol"]},
{id:'corolla-saloon-extra-5',group:"Safety",label:"Rear-view camera",price:0,bonus:0,includedTrims:["Luna","Luna Sport","Sol"]},
{id:'corolla-saloon-extra-6',group:"Safety",label:"Driver Monitor Camera",price:0,bonus:0,includedTrims:["Luna","Luna Sport","Sol"]},
{id:'corolla-saloon-extra-7',group:"Safety",label:"Emergency Driving Stop System",price:0,bonus:0,includedTrims:["Luna","Luna Sport","Sol"]},
{id:'corolla-saloon-extra-8',group:"Safety",label:"Vehicle Stability Control",price:0,bonus:0,includedTrims:["Luna","Luna Sport","Sol"]},
{id:'corolla-saloon-extra-9',group:"Safety",label:"Front and rear parking sensors",price:550,bonus:0,includedTrims:["Sol"]},
{id:'corolla-saloon-extra-10',group:"Safety",label:"Intelligent Parking Sensors with Automatic Braking",price:700,bonus:0,includedTrims:["Sol"]},
{id:'corolla-saloon-extra-11',group:"Comfort",label:"Dual-zone automatic air conditioning",price:0,bonus:0,includedTrims:["Luna","Luna Sport","Sol"]},
{id:'corolla-saloon-extra-12',group:"Comfort",label:"Automatically retractable door mirrors",price:0,bonus:0,includedTrims:["Luna","Luna Sport","Sol"]},
{id:'corolla-saloon-extra-13',group:"Comfort",label:"Power-adjustable heated door mirrors",price:0,bonus:0,includedTrims:["Luna","Luna Sport","Sol"]},
{id:'corolla-saloon-extra-14',group:"Comfort",label:"Push-button start",price:0,bonus:0,includedTrims:["Luna","Luna Sport","Sol"]},
{id:'corolla-saloon-extra-15',group:"Comfort",label:"Front and rear power windows",price:0,bonus:0,includedTrims:["Luna","Luna Sport","Sol"]},
{id:'corolla-saloon-extra-16',group:"Comfort",label:"Remote air conditioning",price:0,bonus:0,includedTrims:["Luna","Luna Sport","Sol"]},
{id:'corolla-saloon-extra-17',group:"Comfort",label:"Remote door lock",price:0,bonus:0,includedTrims:["Luna","Luna Sport","Sol"]},
{id:'corolla-saloon-extra-18',group:"Comfort",label:"Smart Entry and Start System",price:450,bonus:0,includedTrims:["Luna Sport","Sol"]},
{id:'corolla-saloon-extra-19',group:"Comfort",label:"Nanoe-X air purifier",price:280,bonus:0,includedTrims:["Luna Sport","Sol"]},
{id:'corolla-saloon-extra-20',group:"Comfort",label:"Wireless phone charger",price:220,bonus:0,includedTrims:["Luna Sport","Sol"]},
{id:'corolla-saloon-extra-21',group:"Comfort",label:"Heated front seats",price:390,bonus:0,includedTrims:["Luna Sport","Sol"]},
{id:'corolla-saloon-extra-22',group:"Comfort",label:"Heated rear seats",price:420,bonus:0,includedTrims:["Luna Sport","Sol"]},
{id:'corolla-saloon-extra-23',group:"Comfort",label:"Power-adjustable driver's lumbar support",price:300,bonus:0,includedTrims:["Luna Sport","Sol"]},
{id:'corolla-saloon-extra-24',group:"Comfort",label:"Rear passenger footwell heating",price:210,bonus:0,includedTrims:["Luna Sport","Sol"]},
{id:'corolla-saloon-extra-25',group:"Comfort",label:"MyToyota Digital Key",price:340,bonus:0,includedTrims:["Luna Sport","Sol"]},
{id:'corolla-saloon-extra-26',group:"Technology",label:"12.3-inch digital driver information display",price:0,bonus:0,includedTrims:["Luna","Luna Sport","Sol"]},
{id:'corolla-saloon-extra-27',group:"Technology",label:"10.5-inch Toyota Smart Connect multimedia display",price:0,bonus:0,includedTrims:["Luna","Luna Sport","Sol"]},
{id:'corolla-saloon-extra-28',group:"Technology",label:"Wireless Apple CarPlay and Android Auto",price:0,bonus:0,includedTrims:["Luna","Luna Sport","Sol"]},
{id:'corolla-saloon-extra-29',group:"Technology",label:"Cloud navigation",price:0,bonus:0,includedTrims:["Luna","Luna Sport","Sol"]},
{id:'corolla-saloon-extra-30',group:"Technology",label:"Smart Voice Assist - Hey Toyota",price:0,bonus:0,includedTrims:["Luna","Luna Sport","Sol"]},
{id:'corolla-saloon-extra-31',group:"Technology",label:"Six-speaker audio system",price:0,bonus:0,includedTrims:["Luna","Luna Sport","Sol"]},
{id:'corolla-saloon-extra-32',group:"Technology",label:"USB-C charging connectors (front and rear)",price:0,bonus:0,includedTrims:["Luna","Luna Sport","Sol"]},
{id:'corolla-saloon-extra-33',group:"Technology",label:"White ambient lighting in cup holders and open tray",price:180,bonus:0,includedTrims:["Luna Sport","Sol"]},
{id:'corolla-saloon-extra-34',group:"Technology",label:"Light blue ambient door lighting",price:180,bonus:0,includedTrims:["Luna Sport","Sol"]},
{id:'corolla-saloon-extra-35',group:"Exterior",label:"LED daytime running lights",price:0,bonus:0,includedTrims:["Luna","Luna Sport","Sol"]},
{id:'corolla-saloon-extra-36',group:"Exterior",label:"LED front fog lamps",price:0,bonus:0,includedTrims:["Luna","Luna Sport","Sol"]},
{id:'corolla-saloon-extra-37',group:"Exterior",label:"LED rear combination lamps",price:0,bonus:0,includedTrims:["Luna","Luna Sport","Sol"]},
{id:'corolla-saloon-extra-38',group:"Exterior",label:"Automatic high beam",price:0,bonus:0,includedTrims:["Luna","Luna Sport","Sol"]},
{id:'corolla-saloon-extra-39',group:"Exterior",label:"Dusk sensor",price:0,bonus:0,includedTrims:["Luna","Luna Sport","Sol"]},
{id:'corolla-saloon-extra-40',group:"Exterior",label:"Rain sensor",price:0,bonus:0,includedTrims:["Luna","Luna Sport","Sol"]},
{id:'corolla-saloon-extra-41',group:"Exterior",label:"Piano black upper front grille",price:0,bonus:0,includedTrims:["Luna","Luna Sport","Sol"]},
{id:'corolla-saloon-extra-42',group:"Exterior",label:"Chrome front bumper insert",price:220,bonus:0,includedTrims:["Luna Sport","Sol"]},
{id:'corolla-saloon-extra-43',group:"Exterior",label:"Rear privacy glass",price:240,bonus:0,includedTrims:["Luna Sport","Sol"]},
{id:'corolla-saloon-extra-44',group:"Exterior",label:"Mud guards",price:170,bonus:0,includedTrims:[]},
{id:'corolla-saloon-extra-45',group:"Exterior",label:"Boot liner",price:95,bonus:0,includedTrims:[]},
{id:'corolla-saloon-extra-46',group:"Exterior",label:"Side garnish",price:210,bonus:0,includedTrims:[]},
{id:'corolla-saloon-extra-47',group:"Exterior",label:"Aluminium scuff plates",price:220,bonus:0,includedTrims:[]},
{id:'corolla-saloon-extra-48',group:"Interior",label:"Black fabric upholstery with grey stitching",price:0,bonus:0,includedTrims:["Luna","Luna Sport","Sol"]},
{id:'corolla-saloon-extra-49',group:"Interior",label:"60:40 split-folding rear seats",price:0,bonus:0,includedTrims:["Luna","Luna Sport","Sol"]},
{id:'corolla-saloon-extra-50',group:"Interior",label:"Synthetic leather steering wheel",price:0,bonus:0,includedTrims:["Luna","Luna Sport","Sol"]},
{id:'corolla-saloon-extra-51',group:"Interior",label:"Recycled fabric upholstery",price:350,bonus:0,includedTrims:["Luna Sport","Sol"]},
{id:'corolla-saloon-extra-52',group:"Interior",label:"Light grey partial leather upholstery",price:850,bonus:0,includedTrims:["Sol"]},
{id:'corolla-saloon-extra-53',group:"Interior",label:"Soft-touch rear door trim",price:180,bonus:0,includedTrims:["Sol"]},
{id:'corolla-saloon-extra-54',group:"Interior",label:"Leather-like front door armrests",price:220,bonus:0,includedTrims:["Sol"]},
{id:'corolla-saloon-extra-55',group:"Interior",label:"Sliding central armrest",price:180,bonus:0,includedTrims:["Sol"]},
{id:'corolla-saloon-extra-56',group:"Wheels",label:"Locking wheel nuts",price:85,bonus:0,includedTrims:[]}];
const COROLLA_VARIANTS:VerifiedVariant[]=[
 {id:'corolla-saloon-luna',trim:'Luna',engine:'1.8 Hybrid 140 hp',fuel:'Hybrid',transmission:'e-CVT automatic',powerHp:140,price:34605,consumptionL100:4.4,source:SOURCE,market:'Ireland (game price)'},
 {id:'corolla-saloon-luna-sport',trim:'Luna Sport',engine:'1.8 Hybrid 140 hp',fuel:'Hybrid',transmission:'e-CVT automatic',powerHp:140,price:37205,consumptionL100:4.6,source:SOURCE,market:'Ireland (game price)'},
 {id:'corolla-saloon-sol',trim:'Sol',engine:'1.8 Hybrid 140 hp',fuel:'Hybrid',transmission:'e-CVT automatic',powerHp:140,price:40105,consumptionL100:4.7,source:SOURCE,market:'Ireland (game price)'}
];
export function vehicleConfiguration(model:VehicleModel,year:number):VehicleConfiguration|undefined{return VEHICLE_CONFIGURATIONS[model.brand+'|'+model.name+'|'+year];}
export function availableColors(model:VehicleModel,year:number,trim?:string):VehicleColor[]{return (vehicleConfiguration(model,year)?.colors??[]).filter(c=>(!c.trims||!!trim&&c.trims.includes(trim))&&(!c.years||c.years.includes(year)));}
export function availableConfiguratorGroups(model:VehicleModel,year:number,trim?:string,variantId?:string):ConfiguratorGroup[]{return (vehicleConfiguration(model,year)?.configurator??[]).map(g=>({...g,choices:g.choices.filter(c=>(!c.trims||!!trim&&c.trims.includes(trim))&&(!c.variantIds||!!variantId&&c.variantIds.includes(variantId)))})).filter(g=>g.choices.length>0);}
export function paintChoices(model:VehicleModel,year:number,trim:string):VehicleColor[]{return availableColors(model,year,trim);}
export function wheelChoices(model:VehicleModel,year:number,trim:string,variantId?:string):ConfiguratorChoice[]{return availableConfiguratorGroups(model,year,trim,variantId).find(g=>g.id==='wheels')?.choices??[];}
export function individualOptions(model:VehicleModel,year:number,trim:string):FactoryOption[]{if(model.brand!=='Toyota'||model.name!=='Corolla Saloon'||year!==2026)return [];return COROLLA_SALOON_OPTIONS.map(o=>({...o,price:o.includedTrims?.includes(trim)?0:o.price,included:o.includedTrims?.includes(trim)??false}));}
export function compatibleOptions(_model:VehicleModel):FactoryOption[]{return [];}
export function pricedOptions(model:VehicleModel,year:number):FactoryOption[]{return individualOptions(model,year,trimChoices(model,year)[0]??'');}
export function verifiedVariants(model:VehicleModel,year:number):readonly VerifiedVariant[]{return model.brand==='Toyota'&&model.name==='Corolla Saloon'&&year===2026?COROLLA_VARIANTS:[];}
export function marketPrice(_model:VehicleModel,_year:number):MarketPrice|undefined{return undefined;}
export function trimChoices(model:VehicleModel,year:number):readonly string[]{return [...new Set(verifiedVariants(model,year).map(v=>v.trim))];}
export function trimPricing(model:VehicleModel,year:number,trim:string){const variant=verifiedVariants(model,year).find(v=>v.trim===trim);return {base:variant?.price??model.basePrice,cost:0,bonus:0};}
export function configuredOffer(model:VehicleModel,year:number,optionIds:string[],trim:string,variantId?:string,paintId?:string,wheelId?:string):VehicleOffer{
 const variant=verifiedVariants(model,year).find(v=>v.id===variantId)??verifiedVariants(model,year).find(v=>v.trim===trim);
 const selectedOptions=individualOptions(model,year,trim).filter(o=>optionIds.includes(o.id)&&!o.included);
 const paint=paintChoices(model,year,trim).find(p=>p.id===paintId);
 const wheel=wheelChoices(model,year,trim,variantId).find(w=>w.id===wheelId);
 return {id:[model.brand,model.name,year,variant?.id??trim,paint?.id??'',wheel?.id??''].join('-'),model:model.brand+' '+model.name+(variant?' '+variant.engine+' '+variant.transmission:''),year,fuel:variant?.fuel??model.fuel,className:model.segment,price:(variant?.price??model.basePrice)+(paint?.price??0)+(wheel?.price??0)+selectedOptions.reduce((total,o)=>total+o.price,0),mileage:0,condition:100,seats:model.seats,kind:'New',trim,optionIds:[...selectedOptions.map(o=>o.id),...(paint?['paint:'+paint.id]:[]),...(wheel?['wheel:'+wheel.id]:[])],revenueBonus:0};
}
