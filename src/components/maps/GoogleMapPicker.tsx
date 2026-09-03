"use client";
import React, { useEffect, useRef, useState } from "react";
import { loadGoogleMaps } from "./googleMaps";

export const GoogleMapPicker: React.FC<{
  latitude?: number;
  longitude?: number;
  onChange: (value: { latitude: number; longitude: number; address?: string }) => void;
  className?: string;
}> = ({ latitude = 35.6892, longitude = 51.389, onChange, className = "" }) => {
  const mapEl = useRef<HTMLDivElement | null>(null);
  const inputEl = useRef<HTMLInputElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [error, setError] = useState("");
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

  useEffect(() => {
    let mounted = true;
    if (!apiKey || !mapEl.current) {
      setError("کلید Google Maps تنظیم نشده است. مقدار NEXT_PUBLIC_GOOGLE_MAPS_API_KEY را در محیط پروژه قرار دهید.");
      return;
    }
    loadGoogleMaps(apiKey).then((google) => {
      if (!mounted || !mapEl.current) return;
      const center = { lat: Number(latitude) || 35.6892, lng: Number(longitude) || 51.389 };
      const map = new google.maps.Map(mapEl.current, { center, zoom: 12, streetViewControl: false, mapTypeControl: false, fullscreenControl: true });
      const marker = new google.maps.Marker({ position: center, map, draggable: true });
      marker.addListener("dragend", () => {
        const pos = marker.getPosition();
        if (pos) onChange({ latitude: pos.lat(), longitude: pos.lng() });
      });
      map.addListener("click", (event: any) => {
        if (!event.latLng) return;
        marker.setPosition(event.latLng);
        onChange({ latitude: event.latLng.lat(), longitude: event.latLng.lng() });
      });
      if (inputEl.current && google.maps.places) {
        const autocomplete = new google.maps.places.Autocomplete(inputEl.current, { fields: ["geometry", "formatted_address", "name"] });
        autocomplete.addListener("place_changed", () => {
          const place = autocomplete.getPlace();
          if (!place.geometry?.location) return;
          map.setCenter(place.geometry.location);
          map.setZoom(16);
          marker.setPosition(place.geometry.location);
          onChange({ latitude: place.geometry.location.lat(), longitude: place.geometry.location.lng(), address: place.formatted_address || place.name });
        });
      }
      mapRef.current = map;
      markerRef.current = marker;
    }).catch((e) => mounted && setError(e.message));
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !markerRef.current) return;
    const pos = { lat: Number(latitude) || 35.6892, lng: Number(longitude) || 51.389 };
    markerRef.current.setPosition(pos);
    mapRef.current.setCenter(pos);
  }, [latitude, longitude]);

  return <div className={className}>
    <input ref={inputEl} placeholder="جستجوی آدرس، فروشگاه یا مکان..." className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white mb-2" />
    {error && <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-3 text-xs text-amber-300 mb-2">{error}</div>}
    <div ref={mapEl} className="h-64 w-full rounded-2xl overflow-hidden border border-slate-800 bg-slate-900" />
    <p className="text-[10px] text-slate-500 mt-2">روی نقشه کلیک کنید یا نشانگر را جابه‌جا کنید. مختصات به‌صورت خودکار ذخیره می‌شود.</p>
  </div>;
};
