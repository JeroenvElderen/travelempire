import type {VehicleOffer} from './dealership';

// European-market inspired 2025–26 game catalogue. Prices and availability are
// gameplay estimates, not official manufacturer quotations or verified EU trims.
export type VehicleModel={brand:string;name:string;segment:'Economy'|'Standard'|'Comfort'|'Premium'|'XL';basePrice:number;seats:number;fuel:'Petrol'|'Hybrid'|'Diesel'|'Electric';years:number[]};
type Row=[string,string,VehicleModel['segment'],number,number?,VehicleModel['fuel']?];
const rows:Row[]=[
['Toyota','Aygo X','Economy',24520,4,'Hybrid'],['Toyota','Yaris','Economy',23500],['Toyota','Corolla','Standard',30500],['Toyota','Prius','Comfort',39500],['Toyota','Camry','Comfort',44500],['Toyota','RAV4','Comfort',41500],['Toyota','Proace Verso','XL',48500,8],
['Volkswagen','Polo','Economy',25500],['Volkswagen','Golf','Standard',32500],['Volkswagen','Passat','Comfort',42500],['Volkswagen','Tiguan','Comfort',40500],['Volkswagen','ID.3','Standard',37500,4,'Electric'],['Volkswagen','ID.4','Comfort',47500,4,'Electric'],['Volkswagen','Multivan','XL',62500,6],
['Škoda','Fabia','Economy',23500],['Škoda','Scala','Standard',27500],['Škoda','Octavia','Standard',32500],['Škoda','Superb','Comfort',43500],['Škoda','Kodiaq','XL',46500,6],['Škoda','Enyaq','Comfort',47500,4,'Electric'],
['BMW','1 Series','Standard',38500],['BMW','3 Series','Premium',51500],['BMW','5 Series','Premium',67500],['BMW','7 Series','Premium',112000],['BMW','i4','Premium',62500,4,'Electric'],['BMW','i5','Premium',79500,4,'Electric'],['BMW','X3','Premium',64500],
['Mercedes-Benz','A-Class','Standard',40500],['Mercedes-Benz','C-Class','Premium',55500],['Mercedes-Benz','E-Class','Premium',72500],['Mercedes-Benz','S-Class','Premium',123000],['Mercedes-Benz','EQE','Premium',81500,4,'Electric'],['Mercedes-Benz','V-Class','XL',78500,7],
['Audi',"A1 Sportback",'Economy',32460],['Audi',"A3",'Standard',38500],['Audi',"A3 Sportback",'Standard',38500],['Audi',"A3 Saloon",'Standard',38500],['Audi',"S3 Sportback",'Premium',65000],['Audi',"S3 Saloon",'Premium',67000],['Audi',"RS 3 Sportback",'Premium',85000],['Audi',"RS 3 Saloon",'Premium',87000],['Audi',"A5",'Premium',55500],['Audi',"A5 Saloon",'Premium',55700],['Audi',"A5 Avant",'Premium',59600],['Audi',"S5 Saloon",'Premium',98900],['Audi',"RS 5 Saloon",'Premium',115000],['Audi',"RS 5 Avant",'Premium',118900],['Audi',"A6",'Premium',70500],['Audi',"A6 Saloon",'Premium',70500],['Audi',"A6 Avant",'Premium',74000],['Audi',"A6 e-tron Sportback",'Premium',75800,4, 'Electric'],['Audi',"A6 e-tron Avant",'Premium',79000,4, 'Electric'],['Audi',"S6 e-tron Sportback",'Premium',100000,4, 'Electric'],['Audi',"S6 e-tron Avant",'Premium',103000,4, 'Electric'],['Audi',"A8",'Premium',112000],['Audi',"Q2",'Standard',37925],['Audi',"Q3",'Comfort',48515],['Audi',"Q3 Sportback",'Comfort',52770],['Audi',"Q5",'Premium',65500],['Audi',"Q5 SUV",'Premium',65500],['Audi',"Q5 Sportback",'Premium',70000],['Audi',"SQ5 SUV",'Premium',105000],['Audi',"SQ5 Sportback",'Premium',109000],['Audi',"Q7",'XL',109000,6],['Audi',"Q7 TFSI e",'XL',88070,6, 'Hybrid'],['Audi',"SQ7",'XL',152865,6],['Audi',"Q8",'Premium',125715],['Audi',"Q8 TFSI e",'Premium',102475,4, 'Hybrid'],['Audi',"SQ8",'Premium',170485],['Audi',"RS Q8",'Premium',223140],['Audi',"Q4 e-tron",'Comfort',51980,4, 'Electric'],['Audi',"Q4 Sportback e-tron",'Comfort',66335,4, 'Electric'],['Audi',"Q6 e-tron",'Premium',76500,4, 'Electric'],['Audi',"Q6 Sportback e-tron",'Premium',80000,4, 'Electric'],['Audi',"SQ6 e-tron",'Premium',99000,4, 'Electric'],['Audi',"e-tron GT",'Premium',120900,4, 'Electric'],['Audi',"S e-tron GT",'Premium',139635,4, 'Electric'],['Audi',"RS e-tron GT",'Premium',163395,4, 'Electric'],['Audi',"RS e-tron GT performance",'Premium',177650,4, 'Electric'],
['Hyundai','i20','Economy',24500],['Hyundai','i30','Standard',30500],['Hyundai','Tucson','Comfort',38500],['Hyundai','Kona','Standard',33500],['Hyundai','IONIQ 5','Comfort',49500,4,'Electric'],['Hyundai','IONIQ 6','Premium',54500,4,'Electric'],
['Kia','Picanto','Economy',20500],['Kia','Ceed','Standard',29500],['Kia','Sportage','Comfort',38500],['Kia','Sorento','XL',58500,6],['Kia','EV3','Standard',38500,4,'Electric'],['Kia','EV6','Premium',53500,4,'Electric'],['Kia','EV9','XL',76500,6,'Electric'],
['Peugeot','208','Economy',25500],['Peugeot','308','Standard',32500],['Peugeot','408','Comfort',40500],['Peugeot','3008','Comfort',41500],['Peugeot','5008','XL',45500,6],
['Renault','Clio','Economy',24500],['Renault','Captur','Standard',30500],['Renault','Austral','Comfort',40500],['Renault','Scenic E-Tech','Comfort',45500,4,'Electric'],['Renault','Rafale','Premium',48500],
['Ford','Puma','Standard',29500],['Ford','Focus','Standard',32500],['Ford','Kuga','Comfort',40500],['Ford','Explorer EV','Comfort',45500,4,'Electric'],['Ford','Tourneo Custom','XL',58500,7],
['Volvo','EX30','Standard',38500,4,'Electric'],['Volvo','XC40','Comfort',46500],['Volvo','XC60','Premium',62500],['Volvo','XC90','XL',87500,6],['Volvo','EX90','XL',105000,6,'Electric'],
['Tesla','Model 3','Comfort',42500,4,'Electric'],['Tesla','Model Y','Comfort',47500,4,'Electric'],['Tesla','Model S','Premium',98500,4,'Electric'],['Tesla','Model X','XL',109000,6,'Electric'],
['Nissan','Juke','Standard',28500],['Nissan','Qashqai','Comfort',38500],['Nissan','X-Trail','XL',46500,6],['Nissan','Leaf','Standard',36500,4,'Electric'],['Nissan','Ariya','Comfort',49500,4,'Electric'],
['Honda','Jazz','Economy',28500],['Honda','Civic','Standard',38500],['Honda','HR-V','Comfort',36500],['Honda','CR-V','Premium',54500],
['Mazda','Mazda2','Economy',24500],['Mazda','Mazda3','Standard',33500],['Mazda','CX-30','Comfort',36500],['Mazda','CX-5','Comfort',42500],['Mazda','CX-60','Premium',57500],
['Dacia','Sandero','Economy',18500],['Dacia','Jogger','XL',25500,6],['Dacia','Duster','Standard',27500],['Dacia','Bigster','Comfort',32500],
['SEAT','Ibiza','Economy',24500],['SEAT','Leon','Standard',30500],['SEAT','Arona','Standard',28500],['SEAT','Ateca','Comfort',37500],
['Cupra','Leon','Standard',37500],['Cupra','Formentor','Comfort',42500],['Cupra','Born','Comfort',42500,4,'Electric'],['Cupra','Tavascan','Premium',55500,4,'Electric'],
['Opel','Corsa','Economy',24500],['Opel','Astra','Standard',32500],['Opel','Grandland','Comfort',40500],['Opel','Mokka','Standard',30500],['Opel','Zafira','XL',52500,7],
['Citroën','C3','Economy',22500],['Citroën','C4','Standard',29500],['Citroën','C5 Aircross','Comfort',38500],['Citroën','Berlingo','XL',34500,6],
['Fiat','500','Economy',24500],['Fiat','Panda','Economy',20500],['Fiat','600','Standard',29500],['Fiat','Tipo','Standard',26500],
['Alfa Romeo','Junior','Standard',34500],['Alfa Romeo','Tonale','Comfort',43500],['Alfa Romeo','Giulia','Premium',55500],['Alfa Romeo','Stelvio','Premium',61500],
['Lexus','LBX','Standard',36500],['Lexus','UX','Comfort',42500],['Lexus','NX','Premium',62500],['Lexus','RX','Premium',82500],['Lexus','ES','Premium',67500],
['Porsche','Macan','Premium',82500],['Porsche','Cayenne','Premium',112000],['Porsche','Panamera','Premium',125000],['Porsche','Taycan','Premium',105000,4,'Electric'],
['Land Rover','Defender','Premium',82500],['Land Rover','Discovery Sport','Premium',62500],['Land Rover','Range Rover Evoque','Premium',65500],['Land Rover','Range Rover','Premium',145000],
['Jaguar','F-Pace','Premium',79500],['Jaguar','I-Pace','Premium',76500,4,'Electric'],
['MINI','Cooper','Economy',31500],['MINI','Countryman','Comfort',42500],['MINI','Aceman','Standard',39500,4,'Electric'],
['BYD','Dolphin','Standard',32500,4,'Electric'],['BYD','Atto 3','Comfort',38500,4,'Electric'],['BYD','Seal','Premium',46500,4,'Electric'],['BYD','Seal U','Comfort',42500],
['MG','MG3','Economy',22500],['MG','MG4','Standard',32500,4,'Electric'],['MG','ZS','Standard',27500],['MG','HS','Comfort',34500],
['Polestar','Polestar 2','Premium',53500,4,'Electric'],['Polestar','Polestar 3','Premium',82500,4,'Electric'],['Polestar','Polestar 4','Premium',69500,4,'Electric'],
['Suzuki','Swift','Economy',22500],['Suzuki','Vitara','Standard',30500],['Suzuki','S-Cross','Comfort',34500],
['Mitsubishi','Colt','Economy',24500],['Mitsubishi','ASX','Standard',30500],['Mitsubishi','Outlander','Comfort',47500],
['Subaru','Crosstrek','Comfort',38500],['Subaru','Forester','Comfort',45500],['Subaru','Solterra','Premium',52500,4,'Electric'],
['Jeep','Avenger','Standard',32500],['Jeep','Compass','Comfort',42500],['Jeep','Wrangler','Premium',76500],
['Smart','smart #1','Standard',39500,4,'Electric'],['Smart','smart #3','Comfort',45500,4,'Electric'],
['Genesis','G70','Premium',55500],['Genesis','G80','Premium',76500],['Genesis','GV70','Premium',68500],
['Bentley','Flying Spur','Premium',245000],['Bentley','Bentayga','Premium',235000],
['Rolls-Royce','Ghost','Premium',375000],['Rolls-Royce','Cullinan','Premium',425000],
['Ferrari','Roma','Premium',255000],['Ferrari','Purosangue','Premium',425000],
['Lamborghini','Urus','Premium',285000],['Lamborghini','Revuelto','Premium',575000],
['Maserati','Grecale','Premium',79500],['Maserati','Ghibli','Premium',95500],['Maserati','Quattroporte','Premium',145000],
['DS','DS 3','Standard',36500],['DS','DS 4','Comfort',42500],['DS','DS 7','Premium',55500],
['Lancia','Ypsilon','Economy',29500],
['Abarth','500e','Standard',38500,4,'Electric']
];
// Only the nine manufacturers selected for the TravelEmpire dealership.
// Filtering at the catalogue source also prevents excluded makes from entering orders.
export const DEALERSHIP_BRANDS=['Peugeot','Renault','BMW','Mercedes-Benz','Audi','Volkswagen','Toyota','Škoda','Volvo'] as const;
const dealershipBrandSet=new Set<string>(DEALERSHIP_BRANDS);
export const EUROPEAN_MODELS:VehicleModel[]=rows.filter(([brand])=>dealershipBrandSet.has(brand)).map(([brand,name,segment,basePrice,seats=segment==='XL'?6:4,fuel='Petrol'])=>({brand,name,segment,basePrice,seats,fuel:brand==='Renault'&&name==='Clio'?'Hybrid':brand==='Renault'&&name==='Austral'?'Hybrid':brand==='Renault'&&name==='Captur'?'Hybrid':fuel,years:[2025,2026]}));
export const BRANDS=[...new Set(EUROPEAN_MODELS.map(m=>m.brand))].sort((a,b)=>a.localeCompare(b));
export type FactoryOption={id:string;group:'Exterior'|'Wheels'|'Interior'|'Comfort'|'Technology'|'Safety';label:string;price:number;bonus:number;minimum?:VehicleModel['segment'];trims?:string[];years?:number[];variantIds?:string[];included?:boolean;requires?:string[];excludes?:string[];includes?:string[]};
export type VehicleColor={id:string;name:string;hex:string;price:number;trims?:string[];years?:number[];variantIds?:string[];bonus?:number};
export type ConfiguratorChoice={id:string;name:string;price:number;trims?:string[];years?:number[];variantIds?:string[];included?:boolean;bonus?:number;hex?:string;requires?:string[];excludes?:string[]};
export type ConfiguratorGroup={id:string;label:string;selection:'single'|'multiple';required?:boolean;choices:ConfiguratorChoice[]};
export type VehicleConfiguration={brand:string;model:string;year:number;reference?:string;notes?:string;colors:VehicleColor[];options:FactoryOption[];configurator:ConfiguratorGroup[]};
export const VEHICLE_CONFIGURATIONS:Record<string,VehicleConfiguration>={
 'Audi|Q7|2026':{
  brand:'Audi',model:'Q7',year:2026,
  reference:'https://media.audi.com/is/content/audi/country/ie/assets/downloads/product-guides/my26/Q7_MY26.pdf',
  notes:'Audi Ireland MY26 Q7: variant prices are verified from official retail price lists. Paint swatches are approximate; paint, wheel, upholstery and optional-equipment prices remain unverified and are NOT asserted to be free.',
  colors:[
   {id:'q7-carrara-white',name:'Carrara White',hex:'#EDEDE9',price:0},
   {id:'q7-mythos-black',name:'Mythos Black metallic',hex:'#191B20',price:0},
   {id:'q7-glacier-white',name:'Glacier White metallic',hex:'#E5E8E8',price:0},
   {id:'q7-daytona-grey',name:'Daytona Grey pearl effect',hex:'#595D62',price:0,trims:['S line']},
   {id:'q7-waitomo-blue',name:'Waitomo Blue metallic',hex:'#31475C',price:0}
  ],
  options:[],
  configurator:[
   {id:'wheels',label:'Wheels',selection:'single',required:true,choices:[
    {id:'q7-standard-wheels',name:'Standard alloy wheels (size depends on grade)',price:0,included:true},
    {id:'q7-21-wheels',name:'21-inch alloy wheels (availability/price to verify)',price:0}
   ]},
   {id:'upholstery',label:'Upholstery',selection:'single',required:true,choices:[
    {id:'q7-standard-interior',name:'Standard upholstery (trim-dependent)',price:0,included:true},
    {id:'q7-leather-interior',name:'Leather upholstery (price to verify)',price:0}
   ]},
   {id:'packages',label:'Equipment packages',selection:'multiple',choices:[
    {id:'q7-comfort-pack',name:'Comfort package (availability/price to verify)',price:0},
    {id:'q7-tech-pack',name:'Technology package (availability/price to verify)',price:0}
   ]}
  ]
 },
 'Audi|A3|2026':{
  brand:'Audi',model:'A3',year:2026,
  reference:'https://media.audi.com/is/content/audi/country/ie/assets/downloads/product-guides/my26/A3_MY26.pdf',
  notes:'Audi A3 Sportback MY26 Irish prices in VERIFIED_EXPANSION. Actual Audi equipment names are sourced from Audi Ireland A3 pages. Paint/option surcharge amounts and exact trim compatibility are not fully published in accessible configurator pages; €0 is a placeholder, NOT a claim of free equipment. Swatch HEX values are approximations. Audi exclusive choices may require dealer consultation.',
  colors:[
   {id:'a3-arkona-white',name:'Arkona White (solid)',hex:'#F1F0EC',price:0},
   {id:'a3-brilliant-black',name:'Brilliant Black (solid)',hex:'#161719',price:0},
   {id:'a3-glacier-white',name:'Glacier White metallic',hex:'#E6E8E7',price:0},
   {id:'a3-mythos-black',name:'Mythos Black metallic',hex:'#1D1E22',price:0},
   {id:'a3-navarra-blue',name:'Navarra Blue metallic',hex:'#253C60',price:0},
   {id:'a3-daytona-grey',name:'Daytona Grey pearl effect',hex:'#575B61',price:0},
   {id:'a3-vegas-yellow-exclusive',name:'Vegas Yellow (Audi exclusive; dealer confirmation)',hex:'#E6B522',price:0}
  ],
  options:[
   {id:'a3-ambient-pro',group:'Interior',label:'Ambient lighting package pro (30 colours)',price:0,bonus:0},
   {id:'a3-phone-charge',group:'Technology',label:'Inductive smartphone charging (25 W)',price:0,bonus:0},
   {id:'a3-matrix-led',group:'Safety',label:'Matrix LED headlights',price:0,bonus:0},
   {id:'a3-panoramic-roof',group:'Comfort',label:'Panoramic glass roof (availability to verify)',price:0,bonus:0}
  ],
  configurator:[
   {id:'wheels',label:'Wheels',selection:'single',required:true,choices:[
    {id:'a3-wheels-standard',name:'Standard wheels (exact size depends on SE/S line specification)',price:0,included:true},
    {id:'a3-wheels-18-twin',name:'18-inch 5-twin-spoke graphite grey, gloss turned',price:0}
   ]},
   {id:'upholstery',label:'Upholstery and interior',selection:'single',required:true,choices:[
    {id:'a3-interior-standard',name:'Standard upholstery (trim-dependent)',price:0,included:true},
    {id:'a3-interior-sline',name:'S line sports interior (availability to confirm)',price:0,trims:['S line']}
   ]},
   {id:'technology-packages',label:'Technology packages',selection:'single',choices:[
    {id:'a3-tech',name:'Tech — adaptive cruise control and reversing camera',price:0},
    {id:'a3-tech-plus',name:'Tech plus — adds park assist plus, side assist and rear cross-traffic assist',price:0},
    {id:'a3-tech-pro',name:'Tech pro — surround-view cameras and matrix LED headlights',price:0}
   ]},
   {id:'individualisation',label:'Audi exclusive',selection:'multiple',choices:[
    {id:'a3-audi-exclusive-inlays',name:'Audi exclusive interior inlays (dealer confirmation)',price:0},
    {id:'a3-audi-exclusive-stitching',name:'Audi exclusive contrasting stitching (dealer confirmation)',price:0}
   ]}
  ]
 },
 'Toyota|Aygo X|2026':{
  brand:'Toyota',model:'Aygo X',year:2026,
  reference:'https://www.toyota.ie/models/aygo-x.html',
  notes:'Irish model grades and published starting prices. Paint surcharges have not been verified; €0 denotes unverified price, not a confirmed free option. HEX swatches are approximate.',
  colors:[
   {id:'aygo-pure-white',name:'Pure White (040)',hex:'#F4F4F0',price:0,trims:['Pulse']},
   {id:'aygo-night-sky-black',name:'Night Sky Black (209)',hex:'#17191B',price:0,trims:['Pulse']},
   {id:'aygo-persian-salt',name:'Persian Salt (1K3)',hex:'#C7C3B8',price:0,trims:['Pulse']},
   {id:'aygo-tarragon',name:'Tarragon Green Bi-tone (2VN)',hex:'#69765A',price:0,trims:['Design']},
   {id:'aygo-cinnamon',name:'Cinnamon Bi-tone (M49)',hex:'#B66A4E',price:0,trims:['Design']},
   {id:'aygo-lavender',name:'Lavender Bi-tone (M51)',hex:'#9A8EAB',price:0,trims:['Design']},
   {id:'aygo-pearl-white',name:'Pearl Ice White Bi-tone (2PS)',hex:'#F0F0EA',price:0,trims:['GR SPORT']},
   {id:'aygo-tokyo-gold',name:'Tokyo Gold Bi-tone (M50)',hex:'#B29A59',price:0,trims:['GR SPORT']},
   {id:'aygo-storm-grey',name:'Storm Grey Bi-tone (M52)',hex:'#656B70',price:0,trims:['GR SPORT']}
  ],
  options:[],
  configurator:[
   {id:'wheels',label:'Wheels',selection:'single',required:true,choices:[
    {id:'aygo-17',name:'17-inch alloy wheels',price:0,included:true,trims:['Pulse','Design']},
    {id:'aygo-18',name:'18-inch alloy wheels',price:0,included:true,trims:['GR SPORT']}
   ]},
   {id:'infotainment',label:'Standard infotainment',selection:'single',required:true,choices:[
    {id:'aygo-9',name:'9-inch multimedia display',price:0,included:true,trims:['Pulse','Design']},
    {id:'aygo-10',name:'10.5-inch multimedia display with Toyota Smart Connect',price:0,included:true,trims:['GR SPORT']}
   ]}
  ]
 }
};
export function vehicleConfiguration(model:VehicleModel,year:number):VehicleConfiguration|undefined{return VEHICLE_CONFIGURATIONS[model.brand+'|'+model.name+'|'+year];}
export function availableColors(model:VehicleModel,year:number,trim?:string):VehicleColor[]{return (vehicleConfiguration(model,year)?.colors??[]).filter(c=>(!c.years||c.years.includes(year))&&(!c.trims||(trim!==undefined&&c.trims.includes(trim))));}
export function availableConfiguratorGroups(model:VehicleModel,year:number,trim?:string,variantId?:string):ConfiguratorGroup[]{return (vehicleConfiguration(model,year)?.configurator??[]).map(g=>({...g,choices:g.choices.filter(c=>(!c.years||c.years.includes(year))&&(!c.trims||(trim!==undefined&&c.trims.includes(trim)))&&(!c.variantIds||(variantId!==undefined&&c.variantIds.includes(variantId))))})).filter(g=>g.choices.length>0);}

export const FACTORY_OPTIONS:FactoryOption[]=[
{id:'metallic',group:'Exterior',label:'Metallic paint',price:900,bonus:1},
{id:'special-paint',group:'Exterior',label:'Special paint finish',price:2400,bonus:3},
{id:'wheels19',group:'Wheels',label:'19-inch alloy wheels',price:1500,bonus:2},
{id:'wheels20',group:'Wheels',label:'20-inch premium wheels',price:2600,bonus:3},
{id:'leather',group:'Interior',label:'Leather upholstery',price:2500,bonus:5},
{id:'luxury-interior',group:'Interior',label:'Luxury interior package',price:6000,bonus:12,minimum:'Premium'},
{id:'heated',group:'Comfort',label:'Heated and ventilated seats',price:1800,bonus:4},
{id:'roof',group:'Comfort',label:'Panoramic roof',price:1400,bonus:3},
{id:'climate',group:'Comfort',label:'Advanced climate control',price:1000,bonus:3},
{id:'audio',group:'Technology',label:'Premium audio system',price:1200,bonus:3},
{id:'entertainment',group:'Technology',label:'Rear passenger entertainment',price:2800,bonus:6},
{id:'executive',group:'Comfort',label:'Executive comfort package',price:4500,bonus:10,minimum:'Premium'},
{id:'assist',group:'Safety',label:'Advanced driver assistance',price:1600,bonus:2},
{id:'cameras',group:'Safety',label:'360-degree parking cameras',price:900,bonus:1}
];
const order=['Economy','Standard','Comfort','Premium','XL'];
// Gameplay compatibility rules, not official manufacturer build sheets.
export function compatibleOptions(model:VehicleModel){
 return (vehicleConfiguration(model,2026)?.options ?? FACTORY_OPTIONS).filter(o=>{
  if(o.minimum&&order.indexOf(model.segment)<order.indexOf(o.minimum))return false;
  if(model.segment==='Economy'&&['wheels20','entertainment','executive','luxury-interior'].includes(o.id))return false;
  if(model.segment==='XL'&&o.id==='wheels20')return false;
  if(model.brand==='Dacia'&&['luxury-interior','executive','entertainment'].includes(o.id))return false;
  if(model.brand==='Rolls-Royce'&&o.id==='wheels19')return false;
  return true;
 });
}
export function configuredOffer(model:VehicleModel,year:number,optionIds:string[],trim:string,variantId?:string):VehicleOffer{
 const options=pricedOptions(model,year).filter(o=>optionIds.includes(o.id));
 const variant=verifiedVariants(model,year).find(v=>v.id===variantId);
 const pricing=trimPricing(model,year,trim);
 const price=(variant?variant.price:pricing.base+pricing.cost)+options.reduce((n,o)=>n+o.price,0);
 const revenueBonus=(variant?(['Sportline','RS','R-Line'].includes(variant.trim)?10:variant.trim==='Selection +'?5:0):pricing.bonus)+options.reduce((n,o)=>n+o.bonus,0);
 return {id:model.brand+'-'+model.name+'-'+year+(variant?'-'+variant.id:''),model:model.brand+' '+model.name+(variant?' '+variant.engine+' '+variant.transmission:''),year,fuel:variant?.fuel??model.fuel,className:model.segment,price,mileage:0,condition:100,seats:model.seats,kind:'New',trim,optionIds:options.map(o=>o.id),revenueBonus};
}

/** Published European-market reference prices, not live transaction quotes.
 * Manufacturer sources: Toyota Ireland models, VW Germany Golf, BMW Ireland configurator.
 * Market VAT and registration tax vary; do not compare these as equivalent on-road quotes.
 */
export type MarketPrice={market:string;from:number;year:number;source:string;note:string;trims?:readonly string[]};
const MARKET_PRICES:Record<string,MarketPrice>={
 'Toyota|Corolla':{market:'Ireland',from:34605,year:2026,source:'https://www.toyota.ie/models',note:'Corolla Saloon advertised from price; other Corolla body styles differ',trims:['Luna','Sol']},
 'Toyota|Yaris':{market:'Ireland',from:28400,year:2026,source:'https://www.toyota.ie/models',note:'Advertised Yaris from price',trims:['Luna','Sol']},
 'Toyota|RAV4':{market:'Ireland',from:47790,year:2026,source:'https://www.toyota.ie/models',note:'Advertised RAV4 from price',trims:['Sol','Sport']},
 'Toyota|Proace Verso':{market:'Ireland',from:72545,year:2026,source:'https://www.toyota.ie/models',note:'Advertised Proace Verso from price'},
 'Volkswagen|Golf':{market:'Germany',from:29835,year:2026,source:'https://www.volkswagen.de/de/modelle/golf.html',note:'German Golf starting price; German VAT and local delivery/registration rules apply',trims:['Life','Style','R-Line']},
 'BMW|3 Series':{market:'Ireland',from:59015,year:2026,source:'https://www.bmw.ie/en/configurator.html',note:'BMW Ireland 3 Series hybrid starting price; petrol variants differ',trims:['Sport','M Sport','M Sport Pro']}
};
// Manufacturer-published 2026 configurations. No extrapolation to other years.
export type VerifiedVariant={id:string;trim:string;engine:string;fuel:VehicleModel['fuel'];transmission:string;powerHp:number;price:number;consumptionL100?:number;source:string;market:string};
const OCTAVIA_SOURCE='https://www.skoda.ie/_doc/84f89261-ee2b-4e9d-8e34-519ef6ed35ea';
const GOLF_SOURCE='https://www.volkswagen.de/de/konfigurator.html/__app/der-neue-golf-2025/standardmodelle/r-line.app?modelYear-app=2026&trimName-app=R-Line';
const VERIFIED_VARIANTS:Record<string,VerifiedVariant[]>={
 'Toyota|Aygo X|2026':[
  {id:'aygo-pulse',trim:'Pulse',engine:'1.5 TNGA HEV',fuel:'Hybrid',transmission:'Multidrive 7',powerHp:0,price:24520,consumptionL100:3.8,source:'https://www.toyota.ie/models/aygo-x.html',market:'Ireland'},
  {id:'aygo-design',trim:'Design',engine:'1.5 TNGA HEV',fuel:'Hybrid',transmission:'Multidrive 7',powerHp:0,price:26870,consumptionL100:3.8,source:'https://www.toyota.ie/models/aygo-x.html',market:'Ireland'},
  {id:'aygo-gr-sport',trim:'GR SPORT',engine:'1.5 TNGA HEV',fuel:'Hybrid',transmission:'Multidrive 7',powerHp:0,price:30870,consumptionL100:3.8,source:'https://www.toyota.ie/models/aygo-x.html',market:'Ireland'}
 ],
 'Škoda|Octavia|2026':[
  {id:'oct-115-man-sel',trim:'Selection',engine:'1.5 TSI',fuel:'Petrol',transmission:'6-speed manual',powerHp:115,price:33070,consumptionL100:5.6,source:OCTAVIA_SOURCE,market:'Ireland'},
  {id:'oct-115-mhev-sel',trim:'Selection',engine:'1.5 TSI mHEV',fuel:'Hybrid',transmission:'7-speed DSG',powerHp:115,price:35915,consumptionL100:5.3,source:OCTAVIA_SOURCE,market:'Ireland'},
  {id:'oct-150-man-plus',trim:'Selection +',engine:'1.5 TSI',fuel:'Petrol',transmission:'6-speed manual',powerHp:150,price:37505,consumptionL100:5.7,source:OCTAVIA_SOURCE,market:'Ireland'},
  {id:'oct-150-mhev-plus',trim:'Selection +',engine:'1.5 TSI mHEV',fuel:'Hybrid',transmission:'7-speed DSG',powerHp:150,price:40145,consumptionL100:5.3,source:OCTAVIA_SOURCE,market:'Ireland'},
  {id:'oct-150-mhev-sport',trim:'Sportline',engine:'1.5 TSI mHEV',fuel:'Hybrid',transmission:'7-speed DSG',powerHp:150,price:45790,consumptionL100:5.3,source:OCTAVIA_SOURCE,market:'Ireland'},
  {id:'oct-115-tdi-sel',trim:'Selection',engine:'2.0 TDI',fuel:'Diesel',transmission:'6-speed manual',powerHp:115,price:36310,consumptionL100:4.6,source:OCTAVIA_SOURCE,market:'Ireland'},
  {id:'oct-150-tdi-sport',trim:'Sportline',engine:'2.0 TDI',fuel:'Diesel',transmission:'7-speed DSG',powerHp:150,price:48050,consumptionL100:4.8,source:OCTAVIA_SOURCE,market:'Ireland'},
  {id:'oct-265-rs',trim:'RS',engine:'2.0 TSI',fuel:'Petrol',transmission:'7-speed DSG',powerHp:265,price:56790,consumptionL100:7,source:OCTAVIA_SOURCE,market:'Ireland'}
 ],
 'Volkswagen|Golf|2026':[
  {id:'golf-rline-150-tsi',trim:'R-Line',engine:'1.5 TSI',fuel:'Petrol',transmission:'6-speed manual',powerHp:150,price:36855,consumptionL100:5.4,source:GOLF_SOURCE,market:'Germany'},
  {id:'golf-rline-204-tsi',trim:'R-Line',engine:'2.0 TSI 4MOTION',fuel:'Petrol',transmission:'7-speed DSG',powerHp:204,price:44530,consumptionL100:7.3,source:GOLF_SOURCE,market:'Germany'},
  {id:'golf-rline-150-tdi',trim:'R-Line',engine:'2.0 TDI',fuel:'Diesel',transmission:'7-speed DSG',powerHp:150,price:42555,source:GOLF_SOURCE,market:'Germany'}
 ]
};
export function verifiedVariants(model:VehicleModel,year:number):readonly VerifiedVariant[]{
 return VERIFIED_VARIANTS[model.brand+'|'+model.name+'|'+year]??VW_MY26[model.brand+'|'+model.name+'|'+year]??VERIFIED_EXPANSION[model.brand+'|'+model.name+'|'+year]??[];
}

const TOYOTA_IE='https://www.toyota.ie/';
const MERCEDES_IE='https://www.mercedes-benz.ie/models/';
const VW_IE='https://www.volkswagen.ie/idhub/content/dam/onehub_pkw/importers/ie/models/product-guides/my27/VW%20Ireland%20Price%20List%20260506.pdf';
// Published model starting prices. The manufacturer's live pages are snapshots,
// not certified 2025/2026 factory build sheets; model-year specificity is explicit.
const LIVE_MARKET_PRICES:Record<string,{from:number;source:string;market:string;note:string}>={
 'Toyota|Yaris':{from:28400,source:TOYOTA_IE,market:'Ireland',note:'Yaris Hybrid advertised starting price'},
 'Toyota|Corolla':{from:34605,source:TOYOTA_IE,market:'Ireland',note:'Corolla Saloon Hybrid advertised starting price'},
 'Toyota|RAV4':{from:47790,source:TOYOTA_IE,market:'Ireland',note:'RAV4 Plug-in Hybrid advertised starting price'},
 'Toyota|Prius':{from:47100,source:TOYOTA_IE,market:'Ireland',note:'Prius Plug-in Hybrid advertised starting price'},
 'Toyota|Proace Verso':{from:72545,source:TOYOTA_IE,market:'Ireland',note:'Proace Verso advertised starting price'},
 'Mercedes-Benz|A-Class':{from:43082,source:MERCEDES_IE,market:'Ireland',note:'A-Class Hatchback advertised starting price'},
 'Mercedes-Benz|C-Class':{from:57625,source:MERCEDES_IE,market:'Ireland',note:'C-Class Saloon advertised starting price'},
 'Mercedes-Benz|E-Class':{from:81315,source:MERCEDES_IE,market:'Ireland',note:'E-Class Saloon advertised starting price'},
 'Mercedes-Benz|EQE':{from:73690,source:MERCEDES_IE,market:'Ireland',note:'EQE Saloon advertised starting price'},
 'Mercedes-Benz|V-Class':{from:132460,source:MERCEDES_IE,market:'Ireland',note:'V-Class advertised starting price'},
 'Volkswagen|Passat':{from:47995,source:VW_IE,market:'Ireland',note:'MY26 Passat Business 1.5 eHybrid DSG 204hp recommended retail price'},
 'Volkswagen|ID.3':{from:37705,source:VW_IE,market:'Ireland',note:'MY26 ID.3 Pure 52kWh recommended retail price'},
 'Volkswagen|ID.4':{from:40990,source:VW_IE,market:'Ireland',note:'MY26 ID.4 Pure 52kWh 170hp recommended retail price'}
};
const PEUGEOT_IE='https://www.peugeot.ie/content/dam/peugeot/ireland/price-lists/peugeot-passenger-cars-retail-price-list.pdf';
const AUDI_IE='https://media.audi.com/is/content/audi/country/ie/assets/downloads/my26/AudiIrelandPricelistFeb2026.pdf';
const VERIFIED_EXPANSION:Record<string,VerifiedVariant[]>={
 'Audi|Q7|2026':[
  {id:'q7-45tdi-se',trim:'SE',engine:'45 TDI quattro',fuel:'Diesel',transmission:'tiptronic',powerHp:231,price:109000,source:'https://media.audi.com/is/content/audi/country/ie/assets/downloads/my26/AudiIrelandPricelistMY26010526.pdf',market:'Ireland'},
  {id:'q7-50tdi-se',trim:'SE',engine:'50 TDI quattro',fuel:'Diesel',transmission:'tiptronic',powerHp:286,price:114405,source:'https://media.audi.com/is/content/audi/country/ie/assets/downloads/my26/AudiIrelandPricelistMY26010526.pdf',market:'Ireland'},
  {id:'q7-45tdi-sline',trim:'S line',engine:'45 TDI quattro',fuel:'Diesel',transmission:'tiptronic',powerHp:231,price:116040,source:'https://media.audi.com/is/content/audi/country/ie/assets/downloads/product-guides/my26/Q7_MY26.pdf',market:'Ireland'},
  {id:'q7-50tdi-sline',trim:'S line',engine:'50 TDI quattro',fuel:'Diesel',transmission:'tiptronic',powerHp:286,price:121445,source:'https://media.audi.com/is/content/audi/country/ie/assets/downloads/product-guides/my26/Q7_MY26.pdf',market:'Ireland'}
 ],
 'Audi|Q7 TFSI e|2026':[
  {id:'q7-55tfsie-se',trim:'SE',engine:'55 TFSI e quattro',fuel:'Hybrid',transmission:'tiptronic',powerHp:394,price:88070,source:'https://media.audi.com/is/content/audi/country/ie/assets/downloads/my26/AudiIrelandPricelistMY26010526.pdf',market:'Ireland'},
  {id:'q7-55tfsie-sline',trim:'S line',engine:'55 TFSI e quattro',fuel:'Hybrid',transmission:'tiptronic',powerHp:394,price:94930,source:'https://media.audi.com/is/content/audi/country/ie/assets/downloads/my26/AudiIrelandPricelistMY26010526.pdf',market:'Ireland'},
  {id:'q7-60tfsie-comp',trim:'Competition',engine:'60 TFSI e quattro',fuel:'Hybrid',transmission:'tiptronic',powerHp:490,price:99010,source:'https://media.audi.com/is/content/audi/country/ie/assets/downloads/my26/AudiIrelandPricelistMY26010526.pdf',market:'Ireland'}
 ],
 'Audi|SQ7|2026':[
  {id:'sq7-tfsi',trim:'SQ7',engine:'TFSI quattro',fuel:'Petrol',transmission:'tiptronic',powerHp:507,price:152865,source:'https://media.audi.com/is/content/audi/country/ie/assets/downloads/my26/AudiIrelandPricelistMY26010526.pdf',market:'Ireland'}
 ],

 'Peugeot|208|2026':[
  {id:'p208-allure-h110',trim:'Allure',engine:'Hybrid 110 e-DCS6',fuel:'Hybrid',transmission:'6-speed automatic',powerHp:110,price:28995,source:PEUGEOT_IE,market:'Ireland'},
  {id:'p208-gt-h110',trim:'GT',engine:'Hybrid 110 e-DCS6',fuel:'Hybrid',transmission:'6-speed automatic',powerHp:110,price:33995,source:PEUGEOT_IE,market:'Ireland'},
  {id:'p208-gt-h145',trim:'GT',engine:'Hybrid 145 e-DCS6',fuel:'Hybrid',transmission:'6-speed automatic',powerHp:145,price:35495,source:PEUGEOT_IE,market:'Ireland'},
  {id:'p208-allure-ev',trim:'Allure',engine:'Electric 54 kWh',fuel:'Electric',transmission:'Single-speed',powerHp:156,price:37995,source:PEUGEOT_IE,market:'Ireland'},
  {id:'p208-gt-ev',trim:'GT',engine:'Electric 54 kWh',fuel:'Electric',transmission:'Single-speed',powerHp:156,price:38995,source:PEUGEOT_IE,market:'Ireland'}
 ],
 'Peugeot|308|2026':[
  {id:'p308-allure-h',trim:'Allure',engine:'Hybrid 145 e-DCS6',fuel:'Hybrid',transmission:'6-speed automatic',powerHp:145,price:33995,source:PEUGEOT_IE,market:'Ireland'},
  {id:'p308-gt-h',trim:'GT',engine:'Hybrid 145 e-DCS6',fuel:'Hybrid',transmission:'6-speed automatic',powerHp:145,price:38495,source:PEUGEOT_IE,market:'Ireland'},
  {id:'p308-allure-ev',trim:'Allure',engine:'Electric 58 kWh',fuel:'Electric',transmission:'Single-speed',powerHp:156,price:42695,source:PEUGEOT_IE,market:'Ireland'},
  {id:'p308-gt-ev',trim:'GT',engine:'Electric 58 kWh',fuel:'Electric',transmission:'Single-speed',powerHp:156,price:45695,source:PEUGEOT_IE,market:'Ireland'}
 ],
 'Peugeot|408|2026':[
  {id:'p408-allure-h',trim:'Allure',engine:'Hybrid 145 e-DCS6',fuel:'Hybrid',transmission:'6-speed automatic',powerHp:145,price:37995,source:PEUGEOT_IE,market:'Ireland'},
  {id:'p408-gt-h',trim:'GT',engine:'Hybrid 145 e-DCS6',fuel:'Hybrid',transmission:'6-speed automatic',powerHp:145,price:41995,source:PEUGEOT_IE,market:'Ireland'},
  {id:'p408-allure-ev',trim:'Allure',engine:'Electric 58 kWh',fuel:'Electric',transmission:'Single-speed',powerHp:210,price:45490,source:PEUGEOT_IE,market:'Ireland'},
  {id:'p408-gt-ev',trim:'GT',engine:'Electric 58 kWh',fuel:'Electric',transmission:'Single-speed',powerHp:210,price:49490,source:PEUGEOT_IE,market:'Ireland'}
 ],
 'Peugeot|3008|2026':[
  {id:'p3008-allure-h',trim:'Allure',engine:'Hybrid 145 e-DCS6',fuel:'Hybrid',transmission:'6-speed automatic',powerHp:145,price:45495,source:PEUGEOT_IE,market:'Ireland'},
  {id:'p3008-gt-h',trim:'GT',engine:'Hybrid 145 e-DCS6',fuel:'Hybrid',transmission:'6-speed automatic',powerHp:145,price:48495,source:PEUGEOT_IE,market:'Ireland'},
  {id:'p3008-allure-ev',trim:'Allure',engine:'Electric 73 kWh',fuel:'Electric',transmission:'Single-speed',powerHp:210,price:50295,source:PEUGEOT_IE,market:'Ireland'},
  {id:'p3008-gt-ev',trim:'GT',engine:'Electric 73 kWh',fuel:'Electric',transmission:'Single-speed',powerHp:210,price:53295,source:PEUGEOT_IE,market:'Ireland'},
  {id:'p3008-gte-awd',trim:'GT Exclusive',engine:'Electric AWD 73 kWh',fuel:'Electric',transmission:'Single-speed',powerHp:325,price:59995,source:PEUGEOT_IE,market:'Ireland'}
 ],
 'Audi|A3|2026':[
  {id:'a3-30tfsi-se-2026',trim:'SE',engine:'30 TFSI',fuel:'Petrol',transmission:'Manual',powerHp:115,price:37140,source:AUDI_IE,market:'Ireland'},
  {id:'a3-30tdi-se-2026',trim:'SE',engine:'30 TDI',fuel:'Diesel',transmission:'Manual',powerHp:115,price:38985,source:AUDI_IE,market:'Ireland'},
  {id:'a3-30tfsi-sline-2026',trim:'S line',engine:'30 TFSI',fuel:'Petrol',transmission:'Manual',powerHp:115,price:41740,source:AUDI_IE,market:'Ireland'},
  {id:'a3-30tdi-sline-2026',trim:'S line',engine:'30 TDI',fuel:'Diesel',transmission:'Manual',powerHp:115,price:43465,source:AUDI_IE,market:'Ireland'},
  {id:'a3-35tdi-se-2026',trim:'SE',engine:'35 TDI',fuel:'Diesel',transmission:'S tronic',powerHp:150,price:44035,source:AUDI_IE,market:'Ireland'},
  {id:'a3-35tfsi-se-2026',trim:'SE',engine:'35 TFSI',fuel:'Petrol',transmission:'S tronic',powerHp:150,price:41795,source:AUDI_IE,market:'Ireland'},
  {id:'a3-35tfsi-sline-2026',trim:'S line',engine:'35 TFSI',fuel:'Petrol',transmission:'S tronic',powerHp:150,price:45930,source:AUDI_IE,market:'Ireland'},
  {id:'a3-35tdi-sline-2026',trim:'S line',engine:'35 TDI',fuel:'Diesel',transmission:'S tronic',powerHp:150,price:48640,source:AUDI_IE,market:'Ireland'},

  {id:'a3-30tdi-se',trim:'SE',engine:'30 TDI',fuel:'Diesel',transmission:'Manual',powerHp:115,price:38985,source:AUDI_IE,market:'Ireland'},
  {id:'a3-30tfsi-se',trim:'SE',engine:'30 TFSI',fuel:'Petrol',transmission:'Manual',powerHp:115,price:37140,source:AUDI_IE,market:'Ireland'},
  {id:'a3-30tdi-sline',trim:'S line',engine:'30 TDI',fuel:'Diesel',transmission:'Manual',powerHp:115,price:43465,source:AUDI_IE,market:'Ireland'},
  {id:'a3-30tfsi-sline',trim:'S line',engine:'30 TFSI',fuel:'Petrol',transmission:'Manual',powerHp:115,price:41740,source:AUDI_IE,market:'Ireland'},
  {id:'a3-35tfsi-se',trim:'SE',engine:'35 TFSI',fuel:'Petrol',transmission:'S tronic',powerHp:150,price:41795,source:AUDI_IE,market:'Ireland'},
  {id:'a3-35tdi-sline',trim:'S line',engine:'35 TDI',fuel:'Diesel',transmission:'S tronic',powerHp:150,price:48640,source:AUDI_IE,market:'Ireland'},
  {id:'a3-40tfsie-se',trim:'SE',engine:'40 TFSI e',fuel:'Hybrid',transmission:'S tronic',powerHp:204,price:51645,source:AUDI_IE,market:'Ireland'},
  {id:'a3-40tfsie-sline',trim:'S line',engine:'40 TFSI e',fuel:'Hybrid',transmission:'S tronic',powerHp:204,price:55695,source:AUDI_IE,market:'Ireland'}
 ]
};
const RENAULT_IE='https://www.renault.ie/';
const RENAULT_CURRENT:Record<string,{from:number;fuel:VehicleModel['fuel'];note:string}>={
 'Clio':{from:29495,fuel:'Hybrid',note:'Current Clio full hybrid advertised starting price'},
 'Captur':{from:30890,fuel:'Hybrid',note:'Current Captur advertised starting price (powertrain depends on grade)'},
 'Austral':{from:41995,fuel:'Hybrid',note:'Current Austral full hybrid advertised starting price'},
 'Scenic E-Tech':{from:39995,fuel:'Electric',note:'Current Scenic electric advertised starting price'}
};
const VW_MY26:Record<string,VerifiedVariant[]>={
 'Volkswagen|Passat|2026':[
  {id:'vw-passat-business-ehybrid-204',trim:'Business',engine:'1.5 eHybrid plug-in',fuel:'Hybrid',transmission:'DSG',powerHp:204,price:47995,source:VW_IE,market:'Ireland'},
  {id:'vw-passat-business-tdi-150',trim:'Business',engine:'2.0 TDI',fuel:'Diesel',transmission:'DSG',powerHp:150,price:50995,source:VW_IE,market:'Ireland'},
  {id:'vw-passat-rline-ehybrid-204',trim:'R-Line',engine:'1.5 eHybrid plug-in',fuel:'Hybrid',transmission:'DSG',powerHp:204,price:53995,source:VW_IE,market:'Ireland'},
  {id:'vw-passat-rline-tdi-150',trim:'R-Line',engine:'2.0 TDI',fuel:'Diesel',transmission:'DSG',powerHp:150,price:55995,source:VW_IE,market:'Ireland'}
 ],
 'Volkswagen|ID.3|2026':[
  {id:'vw-id3-pure-52',trim:'Pure',engine:'52 kWh battery',fuel:'Electric',transmission:'Single-speed',powerHp:0,price:37705,source:VW_IE,market:'Ireland'},
  {id:'vw-id3-pure-plus-52',trim:'Pure Plus',engine:'52 kWh battery',fuel:'Electric',transmission:'Single-speed',powerHp:0,price:39205,source:VW_IE,market:'Ireland'},
  {id:'vw-id3-pro-58',trim:'Pro',engine:'58 kWh battery',fuel:'Electric',transmission:'Single-speed',powerHp:0,price:41965,source:VW_IE,market:'Ireland'},
  {id:'vw-id3-pro-plus-58',trim:'Pro Plus',engine:'58 kWh battery',fuel:'Electric',transmission:'Single-speed',powerHp:0,price:42965,source:VW_IE,market:'Ireland'},
  {id:'vw-id3-pro-s-77',trim:'Pro S',engine:'77 kWh battery',fuel:'Electric',transmission:'Single-speed',powerHp:0,price:47660,source:VW_IE,market:'Ireland'},
  {id:'vw-id3-gtx-79',trim:'GTX',engine:'79 kWh battery',fuel:'Electric',transmission:'Single-speed',powerHp:0,price:43585,source:VW_IE,market:'Ireland'}
 ],
 'Volkswagen|ID.4|2026':[
  {id:'vw-id4-pure-52',trim:'Pure',engine:'52 kWh battery',fuel:'Electric',transmission:'Single-speed',powerHp:170,price:40990,source:VW_IE,market:'Ireland'},
  {id:'vw-id4-pure-plus-52',trim:'Pure Plus',engine:'52 kWh battery',fuel:'Electric',transmission:'Single-speed',powerHp:170,price:41990,source:VW_IE,market:'Ireland'},
  {id:'vw-id4-pro-77',trim:'Pro',engine:'77 kWh battery',fuel:'Electric',transmission:'Single-speed',powerHp:286,price:45990,source:VW_IE,market:'Ireland'},
  {id:'vw-id4-pro-plus-77',trim:'Pro Plus',engine:'77 kWh battery',fuel:'Electric',transmission:'Single-speed',powerHp:286,price:48990,source:VW_IE,market:'Ireland'},
  {id:'vw-id4-gtx-79',trim:'GTX',engine:'79 kWh battery 4MOTION',fuel:'Electric',transmission:'Single-speed',powerHp:340,price:54990,source:VW_IE,market:'Ireland'}
 ]
};
export function marketPrice(model:VehicleModel,year:number):MarketPrice|undefined{
 const key=model.brand+'|'+model.name;
 const result=MARKET_PRICES[key];
 if(result?.year===year)return result;
 const renault=model.brand==='Renault'?RENAULT_CURRENT[model.name]:undefined;
 if(renault&&year===2026)return {year,market:'Ireland',from:renault.from,source:RENAULT_IE,note:renault.note+'; current website listing, not verified as MY26 pricing'};
 const live=LIVE_MARKET_PRICES[key];
 // Do not attribute undated/live manufacturer site prices to an earlier model year.
 if(live&&year===2026)return {year:2026,market:live.market,from:live.from,source:live.source,note:live.note+'; manufacturer website reference, not confirmed MY26 build price'};
 return undefined;
}
export function trimChoices(model:VehicleModel,year:number):readonly string[]{
 const variants=verifiedVariants(model,year);
 return variants.length?[...new Set(variants.map(v=>v.trim))]:marketPrice(model,year)?.trims??['Base','Plus','Luxury'];
}
export function trimPricing(model:VehicleModel,year:number,trim:string){
 const choices=trimChoices(model,year);
 const index=Math.max(0,choices.indexOf(trim));
 const variants=verifiedVariants(model,year).filter(v=>v.trim===trim);
 if(variants.length)return {base:Math.min(...variants.map(v=>v.price)),cost:0,bonus:['Sportline','RS','R-Line'].includes(trim)?10:trim==='Selection +'?5:0};
 const priceBase=marketPrice(model,year)?.from??model.basePrice;
 // Higher-grade premiums are game estimates until verified option-by-option.
 return {base:priceBase,cost:index===0?0:Math.round(priceBase*(index===1?.06:.12)),bonus:index===0?0:index===1?5:10};
}
export function pricedOptions(model:VehicleModel,year:number):FactoryOption[]{
 const profile=marketPrice(model,year);
 if(vehicleConfiguration(model,year))return compatibleOptions(model);
 const brandFactor=model.brand==='BMW'?1.5:model.brand==='Mercedes-Benz'?1.45:model.brand==='Porsche'?1.7:model.brand==='Volkswagen'?1.1:model.brand==='Toyota'?.9:1;
 return compatibleOptions(model).map(option=>({
  ...option,
  // Manufacturer-specific pricing here is a transparent game estimate.
  price:Math.round(option.price*brandFactor/50)*50,
  label:profile&&option.id==='metallic'? 'Metallic exterior paint':option.label
 }));
}
