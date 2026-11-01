#!/usr/bin/env python3
"""Run from TravelEmpire repository root: python3 install_fleet.py"""
from pathlib import Path
import shutil
root=Path.cwd()
assert (root/'src/App.tsx').exists(), 'Run from the TravelEmpire project root'
source=Path(__file__).resolve().parent
for rel in ['src/dealership.ts','src/dealership.css','src/components/FleetPanel.tsx','public/assets/delivery_truck.svg']:
 target=root/rel;target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(source/rel,target)

def change(path,old,new):
 p=root/path;s=p.read_text();assert old in s,f'Cannot find expected text in {path}: {old[:90]}';p.write_text(s.replace(old,new,1))
change('src/simulation/taxi.ts',"speedKph?:number};", "speedKph?:number;vehicleModel?:string;vehicleYear?:number;vehicleFuel?:string;vehicleClass?:string;vehicleCondition?:number;vehicleMileage?:number;deliveryStartedAt?:number;deliveryUntil?:number;deliveryPath?:Point[]};")
change('src/App.tsx', 'import "./taxi.css";', 'import "./taxi.css";\nimport {OFFERS,DELIVERY_MS,deliveryRoute,type VehicleOffer} from "./dealership";')
change('src/App.tsx', "const active=t.status==='IDLE'?dispatch(t,graph,new Set(old.exploredEdgeIds??[]),[company.headquarters.lng,company.headquarters.lat]):t;", "const arrived=!!t.deliveryUntil&&Date.now()>=t.deliveryUntil;const ready=arrived?{...t,deliveryUntil:undefined,deliveryStartedAt:undefined,deliveryPath:undefined}:t;const active=ready.deliveryUntil?ready:ready.status==='IDLE'?dispatch(ready,graph,new Set(old.exploredEdgeIds??[]),[company.headquarters.lng,company.headquarters.lat]):ready;")
old="const buyTaxi=(driver:string)=>{if(!company||!graph)return;try{const result=purchaseTaxi(company,fleet,graph,driver);const discount=Research.level(research,'procurement')*0.04;\n const adjusted={...result.company,cash:Math.round((result.company.cash+TAXI_COST*discount)*100)/100};\n saveCompany(adjusted);setCompany(adjusted);setFleet(result.fleet);setSimError('')}catch(e){setSimError(String(e))}};"
new="""const buyTaxi=(driver:string,offer:VehicleOffer)=>{if(!company||!graph)return;try{
 const discount=Research.level(research,'procurement')*0.04;
 const price=Math.round(offer.price*(1-discount)*100)/100;
 if(company.cash<price+1200)throw Error('Insufficient funds for this vehicle and driver.');
 // The existing purchase function creates the compatible taxi object; reconcile its base price.
 const result=purchaseTaxi({...company,cash:company.cash+Math.max(0,TAXI_COST-price)},fleet,graph,driver);
 const started=Date.now();const path=deliveryRoute(graph,[company.headquarters.lng,company.headquarters.lat]);
 const taxis=result.fleet.taxis.map((t,i)=>i===result.fleet.taxis.length-1?{...t,vehicleModel:offer.model,vehicleYear:offer.year,vehicleFuel:offer.fuel,vehicleClass:offer.className,vehicleCondition:offer.condition,vehicleMileage:offer.mileage,deliveryStartedAt:started,deliveryUntil:started+DELIVERY_MS,deliveryPath:path}:t);
 const adjusted={...company,cash:Math.round((company.cash-price-1200)*100)/100};
 saveCompany(adjusted);setCompany(adjusted);setFleet({...result.fleet,taxis});setSimError('');
 }catch(e){setSimError(String(e));window.alert(String(e))}};"""
change('src/App.tsx',old,new)
change('src/App.tsx',"{page==='Fleet'&&<FleetPanel company={company} fleet={fleet} graph={graph} onBuy={buyTaxi}/>} ","{page==='Fleet'&&<FleetPanel company={company} fleet={fleet} graph={graph} onBuy={buyTaxi}/>} ") if False else None
change('src/components/WorldMap.tsx',"import {advanceTaxi,type Taxi,type RoadGraph} from '../simulation/taxi';", "import {advanceTaxi,type Taxi,type RoadGraph} from '../simulation/taxi';\nimport {deliveryPosition} from '../dealership';")
change('src/components/WorldMap.tsx',"const taxiMarkers=useRef(new Map<string,maplibregl.Marker>());", "const taxiMarkers=useRef(new Map<string,maplibregl.Marker>());\n const deliveryMarkers=useRef(new Map<string,maplibregl.Marker>());")
change('src/components/WorldMap.tsx',"taxiMarkers.current.forEach(m=>m.remove());taxiMarkers.current.clear();", "taxiMarkers.current.forEach(m=>m.remove());taxiMarkers.current.clear();deliveryMarkers.current.forEach(m=>m.remove());deliveryMarkers.current.clear();")
change('src/components/WorldMap.tsx',"const ids=new Set(taxis.map(t=>t.id));for(const [id,m] of taxiMarkers.current)", "const ids=new Set(taxis.filter(t=>!t.deliveryUntil||t.deliveryUntil<=Date.now()).map(t=>t.id));for(const [id,m] of taxiMarkers.current)")
change('src/components/WorldMap.tsx',"for(const taxi of taxis){taxiSnapshots.current.set(taxi.id", "for(const taxi of taxis){if(taxi.deliveryUntil&&taxi.deliveryUntil>Date.now())continue;taxiSnapshots.current.set(taxi.id")
change('src/components/WorldMap.tsx',"const now=performance.now();\n   for(const [id,snapshot]", "const now=performance.now();\n   for(const [id,snapshot]")
# Store current deliveries in a ref; animation uses timestamps even if browser is temporarily suspended.
change('src/components/WorldMap.tsx',"const taxiSnapshots=useRef(new Map<string,{taxi:Taxi;at:number}>());", "const taxiSnapshots=useRef(new Map<string,{taxi:Taxi;at:number}>());\n const deliveryTaxis=useRef<Taxi[]>([]);deliveryTaxis.current=taxis.filter(t=>t.deliveryUntil&&t.deliveryUntil>Date.now());")
change('src/components/WorldMap.tsx',"   frame=requestAnimationFrame(animate);", """   const activeIds=new Set<string>();
   for(const taxi of deliveryTaxis.current){
    const position=deliveryPosition(taxi);if(!position||!map.current)continue;activeIds.add(taxi.id);
    let marker=deliveryMarkers.current.get(taxi.id);
    if(!marker){const el=document.createElement('img');el.src=`${import.meta.env.BASE_URL}assets/delivery_truck.svg`;el.alt='Vehicle delivery';el.style.width='58px';el.style.height='32px';el.style.objectFit='contain';marker=new maplibregl.Marker({element:el,anchor:'center'}).setLngLat(position).addTo(map.current);deliveryMarkers.current.set(taxi.id,marker);}
    marker.setLngLat(position);marker.getElement().title=`Delivering ${taxi.vehicleModel??taxi.name}`;
   }
   for(const [id,m] of deliveryMarkers.current){if(!activeIds.has(id)){m.remove();deliveryMarkers.current.delete(id);}}
   frame=requestAnimationFrame(animate);""")
print('Fleet upgrade installed. Run: npm run build')
