import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";

const styleUrl = import.meta.env.VITE_MAP_STYLE_URL || "https://demotiles.maplibre.org/style.json";

export default function WorldMap() {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [error,setError] = useState<string | null>(null);
  useEffect(()=>{
    if (!container.current) return;
    let instance: maplibregl.Map;
    try {
      instance = new maplibregl.Map({
        container: container.current, style: styleUrl,
        center: [0, 27], zoom: 2.1, minZoom: 1.2, attributionControl: false,
      });
      map.current=instance;
      instance.addControl(new maplibregl.AttributionControl({compact:true}), "bottom-right");
      instance.on("error",(event)=>{ if(event.error) {console.error("MapLibre:",event.error);setError("Map resources could not be loaded. Check your map style and network.");} });
    } catch(e) {
      console.error(e);
      setError("Map initialization failed.");
    }
    return ()=>{instance?.remove();map.current=null;};
  },[]);
  return <div className="map-container"><div className="map-canvas" ref={container} role="application" aria-label="Interactive world map"/>{error && <div className="map-error" role="alert">{error}</div>}</div>;
}
