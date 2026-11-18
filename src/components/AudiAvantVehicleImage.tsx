import {useEffect,useState,type CSSProperties} from 'react';
import {AUDI_A5_PAINT_SPRITES,audiA5PaintForVehicle,audiA5SpriteUrl} from '../audiA5Sprites';
import {AUDI_A6_PAINT_SPRITES,AUDI_A6_ATLAS_COLUMNS,audiA6AtlasUrl,
 audiA6PaintForVehicle,audiA6SpriteUrl} from '../audiA6Sprites';
import {AudiA5PaintThumb} from './AudiA5VehicleImage';
import {
 SKODA_OCTAVIA_ATLAS_COLUMNS,SKODA_OCTAVIA_PAINT_SPRITES,
 skodaOctaviaAtlasUrl,skodaOctaviaPaintForVehicle,skodaOctaviaSpriteUrl,
 type SkodaOctaviaPaintSprite,
} from '../skodaOctaviaSprites';
import type {AudiPaintSprite} from '../audiA5Sprites';
import './audi-a5-sprites.css';
type Props={
 model?:string;optionIds?:readonly string[];paintHex?:string;paintId?:string;
 alt?:string;className?:string;style?:CSSProperties;fallbackSrc:string;
};
/** Reuses the established Audi image pipeline for the Octavia Combi as well. */
export function VehiclePaintImage({
 model,optionIds,paintHex,paintId,alt='',className,style,fallbackSrc,
}:Props){
 const a6=paintId?AUDI_A6_PAINT_SPRITES.find(p=>p.id===paintId)??null:
  audiA6PaintForVehicle(model,optionIds,paintHex);
 const a5=paintId?AUDI_A5_PAINT_SPRITES.find(p=>p.id===paintId)??null:
  audiA5PaintForVehicle(model,optionIds,paintHex);
 const skoda=paintId?SKODA_OCTAVIA_PAINT_SPRITES.find(p=>
   p.id===paintId||paintId==='oct27-paint-phoenix-custom'&&p.id==='phoenix')??null:
   skodaOctaviaPaintForVehicle(model,optionIds,paintHex);
 const [url,setUrl]=useState<string|null>(null);
 const [failed,setFailed]=useState(false);
 useEffect(()=>{
  let active=true;
  setUrl(null);setFailed(false);
  const promise=skoda?skodaOctaviaSpriteUrl(skoda.id):a6?audiA6SpriteUrl(a6.id):a5?audiA5SpriteUrl(a5.id):null;
  if(promise)void promise.then(src=>{if(active)setUrl(src);});
  return()=>{active=false;};
 },[a6?.id,a5?.id,skoda?.id]);
 return <img src={url&&!failed?url:fallbackSrc}
  onError={()=>{if(url&&!failed)setFailed(true);}}
  className={skoda||a6||a5?className:undefined} style={style}
  alt={alt} loading="lazy" draggable={false}/>;
}
export function AudiA6PaintThumb({paint}:{paint:AudiPaintSprite}){
 const style:CSSProperties={
  backgroundImage:`url("${audiA6AtlasUrl()}")`,
  backgroundSize:`${AUDI_A6_ATLAS_COLUMNS*100}% 100%`,
  backgroundPosition:`${paint.index/(AUDI_A6_ATLAS_COLUMNS-1)*100}% center`,
 };
 return <span className="te-audi-paint-thumb" style={style}
  role="img" aria-label={paint.name}/>;
}
/** Keep the original component name for existing fleet and Audi callers. */
export {VehiclePaintImage as AudiAvantVehicleImage};
export function SkodaOctaviaPaintThumb({paint}:{paint:SkodaOctaviaPaintSprite}){
 const style:CSSProperties={
  backgroundImage:`url("${skodaOctaviaAtlasUrl()}")`,
  backgroundSize:`${SKODA_OCTAVIA_ATLAS_COLUMNS*100}% 100%`,
  backgroundPosition:`${paint.index/(SKODA_OCTAVIA_ATLAS_COLUMNS-1)*100}% center`,
 };
 return <span className="te-audi-paint-thumb" style={style}
  role="img" aria-label={paint.name}/>;
}
export {AudiA5PaintThumb};
