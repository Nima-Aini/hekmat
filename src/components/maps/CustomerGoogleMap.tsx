"use client";
import React, { useEffect, useRef, useState } from "react";
import { loadGoogleMaps } from "./googleMaps";
import { NeonBadge } from "@/components/ui/NeonBadge";

export const CustomerGoogleMap: React.FC<{ customers: any[]; selectedId?: string | null; onSelect: (c: any) => void }> = ({ customers, selectedId, onSelect }) => {
  const el = useRef<HTMLDivElement | null>(null);
  const map = useRef<any>(null);
  const markers = useRef<any[]>([]);
  const info = useRef<any>(null);
  const [error, setError] = useState("");
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
  useEffect(() => {
    if (!apiKey || !el.current) { setError("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY تنظیم نشده است."); return; }
    loadGoogleMaps(apiKey).then((google) => {
      if (!el.current) return;
      map.current = new google.maps.Map(el.current, { center: {lat:35.6892,lng:51.389}, zoom: 6, streetViewControl:false, mapTypeControl:false });
      info.current = new google.maps.InfoWindow();
      renderMarkers(google);
    }).catch((e)=>setError(e.message));
  }, []);
  useEffect(() => { if ((window as any).google?.maps && map.current) renderMarkers((window as any).google); }, [customers, selectedId]);
  const renderMarkers = (google: any) => {
    markers.current.forEach((m) => m.setMap(null)); markers.current = [];
    const valid = customers.filter(c => Number.isFinite(Number(c.latitude)) && Number.isFinite(Number(c.longitude)));
    valid.forEach((c) => {
      const selected = c.id === selectedId;
      const marker = new google.maps.Marker({ map: map.current, position: {lat:Number(c.latitude),lng:Number(c.longitude)}, title:c.storeName||c.name, icon:{ path: google.maps.SymbolPath.CIRCLE, scale:selected?9:4, fillColor:selected?'#38bdf8':c.healthStatus==='red'?'#fb7185':c.healthStatus==='yellow'?'#fbbf24':'#34d399', fillOpacity:1, strokeColor:'#0f172a', strokeWeight:2 } });
      marker.addListener('click',()=>{ onSelect(c); info.current.setContent(`<div style="direction:rtl;padding:8px;min-width:180px"><b>${(c.storeName||c.name).replace(/</g,'&lt;')}</b><div style="margin-top:6px">${String(c.mobile||'')}</div></div>`); info.current.open({map:map.current,anchor:marker}); });
      markers.current.push(marker);
    });
    if (valid.length) map.current.setCenter({lat:Number(valid[0].latitude),lng:Number(valid[0].longitude)});
    if (valid.length>1) { const bounds = new google.maps.LatLngBounds(); valid.forEach(c=>bounds.extend({lat:Number(c.latitude),lng:Number(c.longitude)})); map.current.fitBounds(bounds, 80); }
  };
  if (error) return <div className="rounded-2xl border border-amber-500/30 bg-amber-950/20 p-4 text-xs text-amber-300">{error}</div>;
  return <div className="space-y-3"><div ref={el} className="w-full h-[620px] rounded-3xl overflow-hidden border border-slate-800" /> <div className="text-[10px] text-slate-500">نشانگرهای عادی کوچک هستند؛ با انتخاب مشتری، نشانگر همان مشتری بزرگ می‌شود.</div></div>;
};
