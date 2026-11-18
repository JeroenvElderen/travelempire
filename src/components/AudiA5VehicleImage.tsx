import {useEffect,useState,type CSSProperties} from 'react';
import {
 AUDI_A5_ATLAS_COLUMNS,AUDI_A5_PAINT_SPRITES,
 audiA5PaintForVehicle,audiA5SpriteUrl,
 type AudiPaintSprite,
} from '../audiA5Sprites';
import './audi-a5-sprites.css';
type VehicleImageProps={
 model?:string;optionIds?:readonly string[];paintHex?:string;
 paintId?:string;quality?:'map'|'preview';alt?:string;className?:string;style?:CSSProperties;
 fallbackSrc:string;
};
/** Reuses the PNG atlas instead of changing the colour of glass/lights.
 * The default fallback is still the existing vehicle icon.
 */
export function AudiA5VehicleImage({
 model,optionIds,paintHex,paintId,quality='map',alt='',className,style,fallbackSrc,
}:VehicleImageProps){
 const match=paintId?AUDI_A5_PAINT_SPRITES.find(p=>p.id===paintId)??null:
  audiA5PaintForVehicle(model,optionIds,paintHex);
 const [url,setUrl]=useState<string|null>(null);
 const [failed,setFailed]=useState(false);
 useEffect(()=>{
  let active=true;
  setUrl(null);setFailed(false);
  if(match)void audiA5SpriteUrl(match.id,quality).then(src=>{if(active)setUrl(src);});
  return()=>{active=false;};
 },[match?.id,quality]);
 return <img src={url&&!failed?url:fallbackSrc}
  onError={()=>{if(url&&!failed)setFailed(true);}}
  className={match?className:undefined} style={style}
  alt={alt} loading="lazy" draggable={false}/>;
}
/** Fast paint strip thumbnails: one image request, not nine thumbnails.
 * The grid is a one-row 9 × 80 px PNG atlas with the car facing up.
 */
export function AudiA5PaintThumb({paint}:{
 paint:AudiPaintSprite;
}){
 const style:CSSProperties={
  backgroundImage:`url("${import.meta.env.BASE_URL??'/'}assets/vehicles/audi-a5-avant/paint-atlas.png")`,
  backgroundSize:`${AUDI_A5_ATLAS_COLUMNS*100}% 100%`,
  backgroundPosition:`${paint.index/(AUDI_A5_ATLAS_COLUMNS-1)*100}% center`,
 };
 return <span className="te-audi-paint-thumb" style={style} role="img" aria-label={paint.name}/>;
}
