import type {VehicleOffer} from './dealership';
// Clean-slate catalogue: only vehicles supported by user-provided manufacturer brochures.
// Specifications and grade compatibility are from Toyota Ireland Aygo X product guide (November 2025).
// All monetary amounts below are TravelEmpire gameplay prices, NOT Toyota quotations.
export type VehicleModel={brand:string;name:string;segment:'Economy'|'Standard'|'Comfort'|'Premium'|'XL';basePrice:number;seats:number;fuel:'Petrol'|'Hybrid'|'Diesel'|'Electric';years:number[]};
export const DEALERSHIP_BRANDS=['Toyota'] as const;
export const EUROPEAN_MODELS:VehicleModel[]=[{brand:'Toyota',name:'Aygo X',segment:'Economy',basePrice:24835,seats:4,fuel:'Hybrid',years:[2026]},{brand:'Toyota',name:'Yaris',segment:'Economy',basePrice:28400,seats:5,fuel:'Hybrid',years:[2026]}];
export const BRANDS=['Toyota'];
export type FactoryOption={id:string;group:'Exterior'|'Wheels'|'Interior'|'Comfort'|'Technology'|'Safety';label:string;price:number;bonus:number;minimum?:VehicleModel['segment'];trims?:string[];years?:number[];variantIds?:string[];included?:boolean;includedTrims?:string[];requires?:string[];excludes?:string[];includes?:string[]};
export type VehicleColor={id:string;name:string;hex:string;price:number;trims?:string[];years?:number[];variantIds?:string[];bonus?:number};
export type ConfiguratorChoice={id:string;name:string;price:number;trims?:string[];years?:number[];variantIds?:string[];included?:boolean;bonus?:number;hex?:string;requires?:string[];excludes?:string[]};
export type ConfiguratorGroup={id:string;label:string;selection:'single'|'multiple';required?:boolean;choices:ConfiguratorChoice[]};
export type VehicleConfiguration={brand:string;model:string;year:number;reference?:string;notes?:string;colors:VehicleColor[];options:FactoryOption[];configurator:ConfiguratorGroup[]};
export type VerifiedVariant={id:string;trim:string;engine:string;fuel:VehicleModel['fuel'];transmission:string;powerHp:number;price:number;consumptionL100?:number;source:string;market:string};
export type MarketPrice={market:string;from:number;year:number;source:string;note:string;trims?:readonly string[]};
const SOURCE='https://scene7.toyota.eu/is/content/toyotaeurope/toyota/nmsc/ireland/guides/AYGOX-PDF-GUIDE.pdf';
export const VEHICLE_CONFIGURATIONS:Record<string,VehicleConfiguration>={
 'Toyota|Yaris|2026':{brand:'Toyota',model:'Yaris',year:2026,reference:'https://scene7.toyota.eu/is/content/toyotaeurope/toyota/nmsc/ireland/guides/YARIS-PDF-GUIDE.pdf',notes:'Toyota Ireland March 2026 product guide; prices are TravelEmpire gameplay estimates. Colour HEX approximate.',colors:[{id:'yaris-paint-0',name:"Pure White (040)",hex:'#F3F2EF',price:0,trims:["Luna","Luna Sport","Platinum"]},
{id:'yaris-paint-1',name:"Storm Grey (1M2)",hex:'#62676C',price:500,trims:["Luna","Luna Sport","Platinum"]},
{id:'yaris-paint-2',name:"Celestite Grey (1K3)",hex:'#8E9294',price:500,trims:["Luna","Luna Sport","Platinum"]},
{id:'yaris-paint-3',name:"Night Sky Black (209)",hex:'#191B20',price:500,trims:["Luna","Luna Sport","Platinum"]},
{id:'yaris-paint-4',name:"Juniper Blue (8Y8)",hex:'#3C627B',price:500,trims:["Luna","Luna Sport","Platinum"]},
{id:'yaris-paint-5',name:"Forest Green (6X7)",hex:'#3F6051',price:500,trims:["Luna","Luna Sport","Platinum"]},
{id:'yaris-paint-6',name:"Pearl Ice White (089)",hex:'#F2F0E8',price:850,trims:["Luna","Luna Sport","Platinum"]},
{id:'yaris-paint-7',name:"Pearl Red (3U5)",hex:'#9B2833',price:850,trims:["Luna","Luna Sport","Platinum"]},
{id:'yaris-paint-8',name:"Pearl Ice White Bi-tone (2PU)",hex:'#F2F0E8',price:1100,trims:["GR SPORT"]},
{id:'yaris-paint-9',name:"Pearl Red Bi-tone (2SZ)",hex:'#9B2833',price:1100,trims:["GR SPORT"]},
{id:'yaris-paint-10',name:"Juniper Blue Bi-tone (M20)",hex:'#3C627B',price:1100,trims:["GR SPORT"]},
{id:'yaris-paint-11',name:"Celestite Grey Bi-tone (2TH)",hex:'#8E9294',price:1100,trims:["GR SPORT"]},
{id:'yaris-paint-12',name:"Storm Grey Bi-tone (M29)",hex:'#62676C',price:1100,trims:["GR SPORT"]}],options:[],configurator:[{id:'wheels',label:'Wheels',selection:'single',required:true,choices:[{id:'yaris-wheel-0',name:"15-inch silver alloy wheels (5-double-spoke)",price:0,included:true,trims:['Luna']},{id:'yaris-wheel-1',name:"17-inch black machined-face alloy wheels (10-double-spoke)",price:0,included:true,trims:['Luna Sport']},{id:'yaris-wheel-2',name:"17-inch black machined-face alloy wheels (5-spoke)",price:0,included:true,trims:['Platinum']},{id:'yaris-wheel-3',name:"17-inch black machined-face alloy wheels (5-spoke)",price:0,included:true,trims:['GR SPORT']}]}]},
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
// Toyota brochure features are individual choices, not bundled packs.
// 'included' means the feature is standard on the listed grades; it cannot be charged again.
// Prices for non-standard selections are TravelEmpire game estimates, not factory availability claims.
export const YARIS_INDIVIDUAL_OPTIONS:FactoryOption[]=[
{id:'yaris-safety-0',group:'Safety',label:"Toyota Safety Sense 3",price:250,bonus:0,includedTrims:["Luna","Luna Sport","Platinum","GR SPORT"]},
{id:'yaris-safety-1',group:'Safety',label:"Pre-Collision System with Pedestrian and Cyclist Detection",price:250,bonus:0,includedTrims:["Luna","Luna Sport","Platinum","GR SPORT"]},
{id:'yaris-safety-2',group:'Safety',label:"Full-range Adaptive Cruise Control",price:250,bonus:0,includedTrims:["Luna","Luna Sport","Platinum","GR SPORT"]},
{id:'yaris-safety-3',group:'Safety',label:"Lane Trace Assist",price:250,bonus:0,includedTrims:["Luna","Luna Sport","Platinum","GR SPORT"]},
{id:'yaris-safety-4',group:'Safety',label:"Road Sign Assist",price:250,bonus:0,includedTrims:["Luna","Luna Sport","Platinum","GR SPORT"]},
{id:'yaris-safety-5',group:'Safety',label:"Rear-view camera",price:250,bonus:0,includedTrims:["Luna","Luna Sport","Platinum","GR SPORT"]},
{id:'yaris-safety-6',group:'Safety',label:"Emergency Driving Stop System",price:250,bonus:0,includedTrims:["Luna","Luna Sport","Platinum","GR SPORT"]},
{id:'yaris-safety-7',group:'Safety',label:"Driver Monitor Camera",price:250,bonus:0,includedTrims:["Luna","Luna Sport","Platinum","GR SPORT"]},
{id:'yaris-safety-8',group:'Safety',label:"Tyre Pressure Warning System",price:250,bonus:0,includedTrims:["Luna","Luna Sport","Platinum","GR SPORT"]},
{id:'yaris-comfort-0',group:'Comfort',label:"Automatic air conditioning",price:250,bonus:0,includedTrims:["Luna","Luna Sport","Platinum","GR SPORT"]},
{id:'yaris-comfort-1',group:'Comfort',label:"Smart Entry and Start System",price:250,bonus:0,includedTrims:["Luna","Luna Sport","Platinum","GR SPORT"]},
{id:'yaris-comfort-2',group:'Comfort',label:"Rain sensor",price:250,bonus:0,includedTrims:["Luna","Luna Sport","Platinum","GR SPORT"]},
{id:'yaris-comfort-3',group:'Comfort',label:"Electronic parking brake",price:250,bonus:0,includedTrims:["Luna","Luna Sport","Platinum","GR SPORT"]},
{id:'yaris-comfort-4',group:'Comfort',label:"Wireless charger",price:220,bonus:0,includedTrims:["Luna Sport","Platinum","GR SPORT"]},
{id:'yaris-comfort-5',group:'Comfort',label:"Remote air conditioning system",price:200,bonus:0,includedTrims:["Luna Sport","Platinum","GR SPORT"]},
{id:'yaris-comfort-6',group:'Comfort',label:"Remote door lock",price:160,bonus:0,includedTrims:["Luna Sport","Platinum","GR SPORT"]},
{id:'yaris-comfort-7',group:'Comfort',label:"Dual-zone automatic air conditioning",price:450,bonus:0,includedTrims:["Platinum","GR SPORT"]},
{id:'yaris-comfort-8',group:'Comfort',label:"Nanoe-X air purifier",price:280,bonus:0,includedTrims:["Platinum","GR SPORT"]},
{id:'yaris-comfort-9',group:'Comfort',label:"Panoramic roof with manual sunshade",price:900,bonus:0,includedTrims:["Platinum","GR SPORT"]},
{id:'yaris-comfort-10',group:'Comfort',label:"Electrochromatic rear-view mirror",price:200,bonus:0,includedTrims:["Platinum","GR SPORT"]},
{id:'yaris-comfort-11',group:'Comfort',label:"Power-adjustable driver lumbar support",price:300,bonus:0,includedTrims:["Platinum","GR SPORT"]},
{id:'yaris-comfort-12',group:'Comfort',label:"MyToyota Digital Key",price:340,bonus:0,includedTrims:["Platinum","GR SPORT"]},
{id:'yaris-technology-0',group:'Technology',label:"9-inch Touch multimedia display with Apple CarPlay and Android Auto",price:250,bonus:0,includedTrims:["Luna","Luna Sport","Platinum","GR SPORT"]},
{id:'yaris-technology-1',group:'Technology',label:"6-speaker audio system",price:250,bonus:0,includedTrims:["Luna","Luna Sport","Platinum","GR SPORT"]},
{id:'yaris-technology-2',group:'Technology',label:"USB-C connector",price:250,bonus:0,includedTrims:["Luna","Luna Sport","Platinum","GR SPORT"]},
{id:'yaris-technology-3',group:'Technology',label:"7-inch TFT information display",price:300,bonus:0,includedTrims:["Luna Sport","Platinum","GR SPORT"]},
{id:'yaris-technology-4',group:'Technology',label:"White ambient interior lighting",price:180,bonus:0,includedTrims:["Luna Sport","Platinum","GR SPORT"]},
{id:'yaris-technology-5',group:'Technology',label:"10.5-inch Touch multimedia display",price:490,bonus:0,includedTrims:["Platinum","GR SPORT"]},
{id:'yaris-technology-6',group:'Technology',label:"12.3-inch driver information display",price:600,bonus:0,includedTrims:["Platinum","GR SPORT"]},
{id:'yaris-exterior-0',group:'Exterior',label:"LED daytime running lights",price:250,bonus:0,includedTrims:["Luna","Luna Sport","Platinum","GR SPORT"]},
{id:'yaris-exterior-1',group:'Exterior',label:"Automatic High Beam",price:250,bonus:0,includedTrims:["Luna","Luna Sport","Platinum","GR SPORT"]},
{id:'yaris-exterior-2',group:'Exterior',label:"Front fog lamps (halogen)",price:250,bonus:0,includedTrims:["Luna","Luna Sport","Platinum","GR SPORT"]},
{id:'yaris-exterior-3',group:'Exterior',label:"Projector halogen headlamps",price:250,bonus:0,includedTrims:["Luna","Luna Sport","Platinum","GR SPORT"]},
{id:'yaris-exterior-4',group:'Exterior',label:"LED headlamps",price:480,bonus:0,includedTrims:["Luna Sport","Platinum","GR SPORT"]},
{id:'yaris-exterior-5',group:'Exterior',label:"LED front fog lamps",price:180,bonus:0,includedTrims:["Luna Sport","Platinum","GR SPORT"]},
{id:'yaris-exterior-6',group:'Exterior',label:"LED rear combination lamps",price:160,bonus:0,includedTrims:["Luna Sport","Platinum","GR SPORT"]},
{id:'yaris-exterior-7',group:'Exterior',label:"Privacy glass on rear windows",price:240,bonus:0,includedTrims:["Luna Sport","Platinum","GR SPORT"]},
{id:'yaris-exterior-8',group:'Exterior',label:"Piano black upper front grille",price:180,bonus:0,includedTrims:["Luna Sport","Platinum","GR SPORT"]},
{id:'yaris-exterior-9',group:'Exterior',label:"Piano black lower front grille",price:160,bonus:0,includedTrims:["Platinum","GR SPORT"]},
{id:'yaris-exterior-10',group:'Exterior',label:"Dark chrome lower front grille surround",price:180,bonus:0,includedTrims:["Platinum","GR SPORT"]},
{id:'yaris-exterior-11',group:'Exterior',label:"GR SPORT meshed grille",price:320,bonus:0,includedTrims:["GR SPORT"]},
{id:'yaris-exterior-12',group:'Exterior',label:"Full bi-tone exterior styling",price:750,bonus:0,includedTrims:["GR SPORT"]},
{id:'yaris-exterior-13',group:'Exterior',label:"GR SPORT suspension tuning",price:650,bonus:0,includedTrims:["GR SPORT"]},
{id:'yaris-exterior-14',group:'Exterior',label:"Boot liner",price:95,bonus:0,includedTrims:[]},
{id:'yaris-exterior-15',group:'Exterior',label:"Valet kit",price:65,bonus:0,includedTrims:[]},
{id:'yaris-exterior-16',group:'Exterior',label:"Side garnish",price:210,bonus:0,includedTrims:[]},
{id:'yaris-exterior-17',group:'Exterior',label:"Mud guards",price:170,bonus:0,includedTrims:[]},
{id:'yaris-exterior-18',group:'Exterior',label:"Aluminium scuff plates",price:220,bonus:0,includedTrims:[]},
{id:'yaris-interior-0',group:'Interior',label:"Black fabric upholstery",price:250,bonus:0,includedTrims:["Luna","Luna Sport","Platinum","GR SPORT"]},
{id:'yaris-interior-1',group:'Interior',label:"Leather steering wheel",price:250,bonus:0,includedTrims:["Luna","Luna Sport","Platinum","GR SPORT"]},
{id:'yaris-interior-2',group:'Interior',label:"60:40 split-folding rear seats",price:250,bonus:0,includedTrims:["Luna","Luna Sport","Platinum","GR SPORT"]},
{id:'yaris-interior-3',group:'Interior',label:"Black embossed fabric upholstery",price:260,bonus:0,includedTrims:["Luna Sport","Platinum","GR SPORT"]},
{id:'yaris-interior-4',group:'Interior',label:"Black partial synthetic leather upholstery",price:700,bonus:0,includedTrims:["Platinum","GR SPORT"]},
{id:'yaris-interior-5',group:'Interior',label:"Black perforated Ultrasuede upholstery",price:950,bonus:0,includedTrims:["GR SPORT"]},
{id:'yaris-interior-6',group:'Interior',label:"GR SPORT leather steering wheel with red stitching",price:260,bonus:0,includedTrims:["GR SPORT"]},
{id:'yaris-interior-7',group:'Interior',label:"GR SPORT door scuff plates",price:200,bonus:0,includedTrims:["GR SPORT"]},
{id:'yaris-interior-8',group:'Interior',label:"Black roof lining",price:220,bonus:0,includedTrims:["GR SPORT"]},
{id:'yaris-wheels-0',group:'Wheels',label:"Locking wheel nuts",price:85,bonus:0,includedTrims:[]}
];
export const AYGO_INDIVIDUAL_OPTIONS:FactoryOption[]=[
 {id:'aygo-toyota-safety-sense-3',group:'Safety',label:"Toyota Safety Sense 3",price:250,bonus:0,includedTrims:["Pulse","Design","GR SPORT"],},
 {id:'aygo-pre-collision-system-with-pedestrian-and-cyclist-detection',group:'Safety',label:"Pre-Collision System with pedestrian and cyclist detection",price:250,bonus:0,includedTrims:["Pulse","Design","GR SPORT"],},
 {id:'aygo-intelligent-adaptive-cruise-control',group:'Safety',label:"Intelligent Adaptive Cruise Control",price:250,bonus:0,includedTrims:["Pulse","Design","GR SPORT"],},
 {id:'aygo-lane-departure-assist-and-lane-trace-assist',group:'Safety',label:"Lane Departure Assist and Lane Trace Assist",price:250,bonus:0,includedTrims:["Pulse","Design","GR SPORT"],},
 {id:'aygo-road-sign-assist',group:'Safety',label:"Road Sign Assist",price:250,bonus:0,includedTrims:["Pulse","Design","GR SPORT"],},
 {id:'aygo-rear-view-camera',group:'Safety',label:"Rear-view camera",price:250,bonus:0,includedTrims:["Pulse","Design","GR SPORT"],},
 {id:'aygo-driver-attention-alert',group:'Safety',label:"Driver Attention Alert",price:250,bonus:0,includedTrims:["Pulse","Design","GR SPORT"],},
 {id:'aygo-emergency-driving-stop-system',group:'Safety',label:"Emergency Driving Stop System",price:250,bonus:0,includedTrims:["Pulse","Design","GR SPORT"],},
 {id:'aygo-hill-start-assist-control',group:'Safety',label:"Hill Start Assist Control",price:250,bonus:0,includedTrims:["Pulse","Design","GR SPORT"],},
 {id:'aygo-intelligent-front-and-rear-parking-sensors-with-automatic-braking',group:'Safety',label:"Intelligent front and rear parking sensors with automatic braking",price:550,bonus:0,includedTrims:["GR SPORT"],},
 {id:'aygo-automatic-air-conditioning',group:'Comfort',label:"Automatic air conditioning",price:250,bonus:0,includedTrims:["Pulse","Design","GR SPORT"],},
 {id:'aygo-dual-zone-automatic-air-conditioning',group:'Comfort',label:"Dual-zone automatic air conditioning",price:450,bonus:0,includedTrims:["GR SPORT"],},
 {id:'aygo-nanoe-x-air-purifier',group:'Comfort',label:"Nanoe-X air purifier",price:280,bonus:0,includedTrims:["GR SPORT"],},
 {id:'aygo-heated-front-seats',group:'Comfort',label:"Heated front seats",price:390,bonus:0,includedTrims:["GR SPORT"],},
 {id:'aygo-wireless-phone-charger',group:'Comfort',label:"Wireless phone charger",price:220,bonus:0,includedTrims:["Design","GR SPORT"],},
 {id:'aygo-push-button-start',group:'Comfort',label:"Push-button start",price:320,bonus:0,includedTrims:["Design","GR SPORT"],},
 {id:'aygo-smart-entry-and-start-system',group:'Comfort',label:"Smart Entry and Start System",price:580,bonus:0,includedTrims:["GR SPORT"],},
 {id:'aygo-power-retractable-door-mirrors',group:'Comfort',label:"Power-retractable door mirrors",price:180,bonus:0,includedTrims:["Design","GR SPORT"],},
 {id:'aygo-rain-sensor',group:'Comfort',label:"Rain sensor",price:150,bonus:0,includedTrims:["Design","GR SPORT"],},
 {id:'aygo-privacy-glass',group:'Comfort',label:"Privacy glass",price:240,bonus:0,includedTrims:["Design","GR SPORT"],},
 {id:'aygo-front-power-windows',group:'Comfort',label:"Front power windows",price:250,bonus:0,includedTrims:["Pulse","Design","GR SPORT"],},
 {id:'aygo-heated-power-adjustable-door-mirrors',group:'Comfort',label:"Heated power-adjustable door mirrors",price:250,bonus:0,includedTrims:["Pulse","Design","GR SPORT"],},
 {id:'aygo-electronic-parking-brake-with-hold-function',group:'Comfort',label:"Electronic parking brake with hold function",price:250,bonus:0,includedTrims:["Pulse","Design","GR SPORT"],},
 {id:'aygo-9-inch-toyota-touch-3-multimedia-display',group:'Technology',label:"9-inch Toyota Touch 3 multimedia display",price:250,bonus:0,includedTrims:["Pulse","Design"],},
 {id:'aygo-10-5-inch-multimedia-display',group:'Technology',label:"10.5-inch multimedia display",price:490,bonus:0,includedTrims:["GR SPORT"],},
 {id:'aygo-wireless-apple-carplay-and-wired-android-auto',group:'Technology',label:"Wireless Apple CarPlay and wired Android Auto",price:250,bonus:0,includedTrims:["Pulse","Design","GR SPORT"],},
 {id:'aygo-7-inch-tft-driver-information-display',group:'Technology',label:"7-inch TFT driver information display",price:250,bonus:0,includedTrims:["Pulse","Design","GR SPORT"],},
 {id:'aygo-bluetooth-hands-free-and-dab-radio',group:'Technology',label:"Bluetooth hands-free and DAB radio",price:250,bonus:0,includedTrims:["Pulse","Design","GR SPORT"],},
 {id:'aygo-four-speaker-audio-system',group:'Technology',label:"Four-speaker audio system",price:250,bonus:0,includedTrims:["Pulse","Design","GR SPORT"],},
 {id:'aygo-front-usb-c-device-charger',group:'Technology',label:"Front USB-C device charger",price:250,bonus:0,includedTrims:["Pulse","Design","GR SPORT"],},
 {id:'aygo-ambient-interior-lighting-single-colour',group:'Technology',label:"Ambient interior lighting (single colour)",price:180,bonus:0,includedTrims:["Design","GR SPORT"],},
 {id:'aygo-mytoyota-digital-key',group:'Technology',label:"MyToyota Digital Key",price:340,bonus:0,includedTrims:["GR SPORT"],},
 {id:'aygo-projector-led-headlamps',group:'Exterior',label:"Projector LED headlamps",price:480,bonus:0,includedTrims:["Design","GR SPORT"],},
 {id:'aygo-led-front-fog-lamps',group:'Exterior',label:"LED front fog lamps",price:180,bonus:0,includedTrims:["Design","GR SPORT"],},
 {id:'aygo-led-rear-combination-lamps',group:'Exterior',label:"LED rear combination lamps",price:160,bonus:0,includedTrims:["Design","GR SPORT"],},
 {id:'aygo-piano-black-upper-front-grille',group:'Exterior',label:"Piano black upper front grille",price:180,bonus:0,includedTrims:["Design"],},
 {id:'aygo-gr-sport-mesh-upper-front-grille',group:'Exterior',label:"GR Sport mesh upper front grille",price:320,bonus:0,includedTrims:["GR SPORT"],},
 {id:'aygo-bi-tone-exterior-styling',group:'Exterior',label:"Bi-tone+ exterior styling",price:750,bonus:0,includedTrims:["GR SPORT"],},
 {id:'aygo-automatic-high-beam',group:'Exterior',label:"Automatic high beam",price:250,bonus:0,includedTrims:["Pulse","Design","GR SPORT"],},
 {id:'aygo-led-daytime-running-lights',group:'Exterior',label:"LED daytime running lights",price:250,bonus:0,includedTrims:["Pulse","Design","GR SPORT"],},
 {id:'aygo-dusk-sensor',group:'Exterior',label:"Dusk sensor",price:250,bonus:0,includedTrims:["Pulse","Design","GR SPORT"],},
 {id:'aygo-synthetic-leather-steering-wheel',group:'Interior',label:"Synthetic leather steering wheel",price:250,bonus:0,includedTrims:["Pulse","Design"],},
 {id:'aygo-gr-sport-partially-perforated-steering-wheel',group:'Interior',label:"GR Sport partially perforated steering wheel",price:260,bonus:0,includedTrims:["GR SPORT"],},
 {id:'aygo-black-fabric-upholstery',group:'Interior',label:"Black fabric upholstery",price:250,bonus:0,includedTrims:["Pulse"],},
 {id:'aygo-black-fabric-upholstery-with-embroidery',group:'Interior',label:"Black fabric upholstery with embroidery",price:260,bonus:0,includedTrims:["Design"],},
 {id:'aygo-gr-sport-partial-dinamica-and-sakura-touch-upholstery',group:'Interior',label:"GR Sport partial Dinamica and Sakura Touch upholstery",price:790,bonus:0,includedTrims:["GR SPORT"],},
 {id:'aygo-50-50-split-folding-rear-seats',group:'Interior',label:"50:50 split-folding rear seats",price:250,bonus:0,includedTrims:["Pulse","Design","GR SPORT"],},
 {id:'aygo-gr-sport-tuned-macpherson-front-suspension',group:'Comfort',label:"GR Sport-tuned MacPherson front suspension",price:650,bonus:0,includedTrims:["GR SPORT"],},
 {id:'aygo-boot-liner-toyota-accessory',group:'Exterior',label:"Boot liner (Toyota accessory)",price:95,bonus:0,},
 {id:'aygo-front-and-rear-mud-guards-toyota-accessory',group:'Exterior',label:"Front and rear mud guards (Toyota accessory)",price:170,bonus:0,},
 {id:'aygo-locking-wheel-nuts-toyota-accessory',group:'Wheels',label:"Locking wheel nuts (Toyota accessory)",price:85,bonus:0,},
 {id:'aygo-rear-garnish-toyota-accessory',group:'Exterior',label:"Rear garnish (Toyota accessory)",price:175,bonus:0,},
 {id:'aygo-side-garnish-toyota-accessory',group:'Exterior',label:"Side garnish (Toyota accessory)",price:210,bonus:0,},
];
export function individualOptions(model:VehicleModel,year:number,trim:string):FactoryOption[]{
 const list=model.brand==='Toyota'&&year===2026?(model.name==='Aygo X'?AYGO_INDIVIDUAL_OPTIONS:model.name==='Yaris'?YARIS_INDIVIDUAL_OPTIONS:[]):[];
 return list.map(o=>({...o,price:o.includedTrims?.includes(trim)?0:o.price,included:o.includedTrims?.includes(trim)??false}));
}

const YARIS_VARIANTS:VerifiedVariant[]=[{id:'yaris-0',trim:'Luna',engine:'1.5 Hybrid 116 hp',fuel:'Hybrid',transmission:'e-CVT automatic',powerHp:116,price:28400,consumptionL100:3.8,source:'https://scene7.toyota.eu/is/content/toyotaeurope/toyota/nmsc/ireland/guides/YARIS-PDF-GUIDE.pdf',market:'Ireland (game price)'},{id:'yaris-1',trim:'Luna Sport',engine:'1.5 Hybrid 116 hp',fuel:'Hybrid',transmission:'e-CVT automatic',powerHp:116,price:30400,consumptionL100:4.3,source:'https://scene7.toyota.eu/is/content/toyotaeurope/toyota/nmsc/ireland/guides/YARIS-PDF-GUIDE.pdf',market:'Ireland (game price)'},{id:'yaris-2',trim:'Platinum',engine:'1.5 Hybrid 116 hp',fuel:'Hybrid',transmission:'e-CVT automatic',powerHp:116,price:33400,consumptionL100:4.3,source:'https://scene7.toyota.eu/is/content/toyotaeurope/toyota/nmsc/ireland/guides/YARIS-PDF-GUIDE.pdf',market:'Ireland (game price)'},{id:'yaris-3',trim:'GR SPORT',engine:'1.5 Hybrid 130 hp',fuel:'Hybrid',transmission:'e-CVT automatic',powerHp:130,price:36900,consumptionL100:4.4,source:'https://scene7.toyota.eu/is/content/toyotaeurope/toyota/nmsc/ireland/guides/YARIS-PDF-GUIDE.pdf',market:'Ireland (game price)'}];
export const FACTORY_OPTIONS:FactoryOption[]=[];
export function vehicleConfiguration(model:VehicleModel,year:number):VehicleConfiguration|undefined{return VEHICLE_CONFIGURATIONS[model.brand+'|'+model.name+'|'+year];}
export function availableColors(model:VehicleModel,year:number,trim?:string):VehicleColor[]{return (vehicleConfiguration(model,year)?.colors??[]).filter(c=>(!c.trims||!!trim&&c.trims.includes(trim))&&(!c.years||c.years.includes(year)));}
export function availableConfiguratorGroups(model:VehicleModel,year:number,trim?:string,variantId?:string):ConfiguratorGroup[]{return (vehicleConfiguration(model,year)?.configurator??[]).map(g=>({...g,choices:g.choices.filter(c=>(!c.trims||!!trim&&c.trims.includes(trim))&&(!c.variantIds||!!variantId&&c.variantIds.includes(variantId)))})).filter(g=>g.choices.length>0);}
export function paintChoices(model:VehicleModel,year:number,trim:string):VehicleColor[]{return availableColors(model,year,trim);}
export function wheelChoices(model:VehicleModel,year:number,trim:string,variantId?:string):ConfiguratorChoice[]{return availableConfiguratorGroups(model,year,trim,variantId).find(g=>g.id==='wheels')?.choices??[];}
export function compatibleOptions(_model:VehicleModel):FactoryOption[]{return [];}
export function pricedOptions(model:VehicleModel,year:number):FactoryOption[]{return individualOptions(model,year,trimChoices(model,year)[0]??'');}
export function verifiedVariants(model:VehicleModel,year:number):readonly VerifiedVariant[]{return model.brand==='Toyota'&&year===2026?(model.name==='Aygo X'?AYGO_VARIANTS:model.name==='Yaris'?YARIS_VARIANTS:[]):[];}
export function marketPrice(_model:VehicleModel,_year:number):MarketPrice|undefined{return undefined;}
export function trimChoices(model:VehicleModel,year:number):readonly string[]{const variants=verifiedVariants(model,year);return [...new Set(variants.map(v=>v.trim))];}
export function trimPricing(model:VehicleModel,year:number,trim:string){const variant=verifiedVariants(model,year).find(v=>v.trim===trim);return {base:variant?.price??model.basePrice,cost:0,bonus:0};}
export function configuredOffer(model:VehicleModel,year:number,optionIds:string[],trim:string,variantId?:string,paintId?:string,wheelId?:string):VehicleOffer{
 const variant=verifiedVariants(model,year).find(v=>v.id===variantId)??verifiedVariants(model,year).find(v=>v.trim===trim);
 const selectedOptions=individualOptions(model,year,trim).filter(o=>optionIds.includes(o.id)&&!o.included);
 const paint=paintChoices(model,year,trim).find(p=>p.id===paintId);
 const wheel=wheelChoices(model,year,trim,variantId).find(w=>w.id===wheelId);
 return {id:[model.brand,model.name,year,variant?.id??trim,paint?.id??'',wheel?.id??''].join('-'),model:model.brand+' '+model.name+(variant?' '+variant.engine+' '+variant.transmission:''),year,fuel:variant?.fuel??model.fuel,className:model.segment,price:(variant?.price??model.basePrice)+(paint?.price??0)+(wheel?.price??0)+selectedOptions.reduce((total,o)=>total+o.price,0),mileage:0,condition:100,seats:model.seats,kind:'New',trim,optionIds:[...selectedOptions.map(o=>o.id),...(paint?['paint:'+paint.id]:[]),...(wheel?['wheel:'+wheel.id]:[])],revenueBonus:0};
}
