import type {VehicleOffer} from './dealership';

// European-market inspired 2025–26 game catalogue. Prices and availability are
// gameplay estimates, not official manufacturer quotations or verified EU trims.
export type VehicleModel={brand:string;name:string;segment:'Economy'|'Standard'|'Comfort'|'Premium'|'XL';basePrice:number;seats:number;fuel:'Petrol'|'Hybrid'|'Diesel'|'Electric';years:number[]};
type Row=[string,string,VehicleModel['segment'],number,number?,VehicleModel['fuel']?];
const rows:Row[]=[
['Toyota','Yaris','Economy',23500],['Toyota','Corolla','Standard',30500],['Toyota','Prius','Comfort',39500],['Toyota','Camry','Comfort',44500],['Toyota','RAV4','Comfort',41500],['Toyota','Proace Verso','XL',48500,8],
['Volkswagen','Polo','Economy',25500],['Volkswagen','Golf','Standard',32500],['Volkswagen','Passat','Comfort',42500],['Volkswagen','Tiguan','Comfort',40500],['Volkswagen','ID.3','Standard',37500,4,'Electric'],['Volkswagen','ID.4','Comfort',47500,4,'Electric'],['Volkswagen','Multivan','XL',62500,6],
['Škoda','Fabia','Economy',23500],['Škoda','Scala','Standard',27500],['Škoda','Octavia','Standard',32500],['Škoda','Superb','Comfort',43500],['Škoda','Kodiaq','XL',46500,6],['Škoda','Enyaq','Comfort',47500,4,'Electric'],
['BMW','1 Series','Standard',38500],['BMW','3 Series','Premium',51500],['BMW','5 Series','Premium',67500],['BMW','7 Series','Premium',112000],['BMW','i4','Premium',62500,4,'Electric'],['BMW','i5','Premium',79500,4,'Electric'],['BMW','X3','Premium',64500],
['Mercedes-Benz','A-Class','Standard',40500],['Mercedes-Benz','C-Class','Premium',55500],['Mercedes-Benz','E-Class','Premium',72500],['Mercedes-Benz','S-Class','Premium',123000],['Mercedes-Benz','EQE','Premium',81500,4,'Electric'],['Mercedes-Benz','V-Class','XL',78500,7],
['Audi','A3','Standard',38500],['Audi','A5','Premium',55500],['Audi','A6','Premium',70500],['Audi','A8','Premium',112000],['Audi','Q5','Premium',65500],['Audi','Q6 e-tron','Premium',76500,4,'Electric'],
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
export const EUROPEAN_MODELS:VehicleModel[]=rows.map(([brand,name,segment,basePrice,seats=segment==='XL'?6:4,fuel='Petrol'])=>({brand,name,segment,basePrice,seats,fuel,years:[2025,2026]}));
export const BRANDS=[...new Set(EUROPEAN_MODELS.map(m=>m.brand))].sort((a,b)=>a.localeCompare(b));
export type FactoryOption={id:string;group:'Exterior'|'Wheels'|'Interior'|'Comfort'|'Technology'|'Safety';label:string;price:number;bonus:number;minimum?:VehicleModel['segment']};
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
export function compatibleOptions(model:VehicleModel){return FACTORY_OPTIONS.filter(o=>!o.minimum||order.indexOf(model.segment)>=order.indexOf(o.minimum));}
export function configuredOffer(model:VehicleModel,year:number,optionIds:string[],trim:'Base'|'Plus'|'Luxury'):VehicleOffer{
 const options=compatibleOptions(model).filter(o=>optionIds.includes(o.id));
 const trimCost=trim==='Luxury'?Math.round(model.basePrice*.12):trim==='Plus'?Math.round(model.basePrice*.06):0;
 const trimBonus=trim==='Luxury'?10:trim==='Plus'?5:0;
 const price=model.basePrice+trimCost+options.reduce((n,o)=>n+o.price,0);
 const revenueBonus=trimBonus+options.reduce((n,o)=>n+o.bonus,0);
 return {id:model.brand+'-'+model.name+'-'+year,model:model.brand+' '+model.name,year,fuel:model.fuel,className:model.segment,price,mileage:0,condition:100,seats:model.seats,kind:'New',trim,optionIds:options.map(o=>o.id),revenueBonus};
}
