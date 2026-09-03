"use client";

import React, { useEffect, useRef, useState } from "react";
import { MapPin, Crosshair, Search, Check, Navigation, Loader2 } from "lucide-react";

interface NeshanMapPickerProps {
  latitude: number | null;
  longitude: number | null;
  onChange: (coords: { latitude: number; longitude: number; address?: string; city?: string }) => void;
  height?: string;
  neshanApiKey?: string;
}

const IRAN_CITIES = [
  { name: "تهران", lat: 35.6892, lng: 51.3890 },
  { name: "کرج", lat: 35.8400, lng: 50.9391 },
  { name: "مشهد", lat: 36.2972, lng: 59.6067 },
  { name: "اصفهان", lat: 32.6546, lng: 51.6680 },
  { name: "شیراز", lat: 29.5918, lng: 52.5837 },
  { name: "تبریز", lat: 38.0800, lng: 46.2919 },
  { name: "اهواز", lat: 31.3183, lng: 48.6706 },
  { name: "قم", lat: 34.6401, lng: 50.8764 },
  { name: "رشت", lat: 37.2809, lng: 49.5924 },
  { name: "یزد", lat: 31.8974, lng: 54.3569 },
];

export const NeshanMapPicker: React.FC<NeshanMapPickerProps> = ({
  latitude,
  longitude,
  onChange,
  height = "340px",
  neshanApiKey,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [reverseLoading, setReverseLoading] = useState(false);
  const [detectedAddress, setDetectedAddress] = useState<string>("");
  const [mapLoaded, setMapLoaded] = useState(false);

  // Initialize Leaflet Map
  useEffect(() => {
    let isMounted = true;

    const initMap = async () => {
      if (typeof window === "undefined" || !containerRef.current || mapRef.current) return;

      const L = await import("leaflet");

      // Load Leaflet CSS if not already present
      if (!document.getElementById("leaflet-css")) {
        const link = document.createElement("link");
        link.id = "leaflet-css";
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }

      if (!isMounted || !containerRef.current) return;

      const initialLat = latitude && !isNaN(Number(latitude)) ? Number(latitude) : 35.6892;
      const initialLng = longitude && !isNaN(Number(longitude)) ? Number(longitude) : 51.3890;
      const initialZoom = latitude && longitude ? 15 : 12;

      const map = L.map(containerRef.current, {
        center: [initialLat, initialLng],
        zoom: initialZoom,
        zoomControl: true,
        attributionControl: false,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        subdomains: ["a", "b", "c"],
      }).addTo(map);

      mapRef.current = map;

      // Custom Draggable Pin Icon
      const customPinIcon = L.divIcon({
        className: "custom-picker-pin",
        html: `
          <div style="
            position: relative;
            width: 34px;
            height: 34px;
            border-radius: 50%;
            background: #ef4444;
            border: 3px solid #ffffff;
            box-shadow: 0 4px 14px rgba(0,0,0,0.6);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: grab;
            animation: bounce 1s ease;
          ">
            <span style="width: 10px; height: 10px; border-radius: 50%; background: #ffffff;"></span>
          </div>
        `,
        iconSize: [34, 34],
        iconAnchor: [17, 34],
      });

      if (latitude && longitude) {
        const marker = L.marker([initialLat, initialLng], {
          icon: customPinIcon,
          draggable: true,
        }).addTo(map);

        marker.on("dragend", (e: any) => {
          const pos = e.target.getLatLng();
          handleLocationSelected(pos.lat, pos.lng);
        });

        markerRef.current = marker;
      }

      // Map Click to place / move marker
      map.on("click", (e: any) => {
        const lat = e.latlng.lat;
        const lng = e.latlng.lng;

        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lng]);
        } else {
          const marker = L.marker([lat, lng], {
            icon: customPinIcon,
            draggable: true,
          }).addTo(map);

          marker.on("dragend", (evt: any) => {
            const pos = evt.target.getLatLng();
            handleLocationSelected(pos.lat, pos.lng);
          });

          markerRef.current = marker;
        }

        handleLocationSelected(lat, lng);
      });

      setMapLoaded(true);

      setTimeout(() => {
        map.invalidateSize();
      }, 200);
    };

    initMap();

    return () => {
      isMounted = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Sync external coordinates
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || !latitude || !longitude) return;

    const lat = Number(latitude);
    const lng = Number(longitude);

    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
    }
  }, [latitude, longitude, mapLoaded]);

  // Handle location pick + auto reverse geocoding via Neshan API
  const handleLocationSelected = async (lat: number, lng: number) => {
    const fixedLat = Number(lat.toFixed(6));
    const fixedLng = Number(lng.toFixed(6));

    onChange({ latitude: fixedLat, longitude: fixedLng });

    // Reverse Geocoding with Neshan API proxy
    setReverseLoading(true);
    try {
      const keyParam = neshanApiKey ? `&apiKey=${encodeURIComponent(neshanApiKey)}` : "";
      const res = await fetch(`/api/maps/neshan?action=reverse&lat=${fixedLat}&lng=${fixedLng}${keyParam}`);
      const data = await res.json();

      if (data.success && data.data?.formatted_address) {
        setDetectedAddress(data.data.formatted_address);
        onChange({
          latitude: fixedLat,
          longitude: fixedLng,
          address: data.data.formatted_address,
          city: data.data.city || data.data.state || undefined,
        });
      }
    } catch (err) {
      console.warn("Reverse geocode failed:", err);
    } finally {
      setReverseLoading(false);
    }
  };

  // Search places via Neshan API
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const center = mapRef.current?.getCenter() || { lat: 35.6892, lng: 51.3890 };
      const keyParam = neshanApiKey ? `&apiKey=${encodeURIComponent(neshanApiKey)}` : "";
      const res = await fetch(`/api/maps/neshan?action=search&term=${encodeURIComponent(searchQuery)}&lat=${center.lat}&lng=${center.lng}${keyParam}`);
      const data = await res.json();

      if (data.success && data.items && data.items.length > 0) {
        setSearchResults(data.items);
      } else {
        const matchingCities = IRAN_CITIES.filter((c) => c.name.includes(searchQuery));
        setSearchResults(matchingCities.map((c) => ({ title: c.name, location: { x: c.lng, y: c.lat } })));
      }
    } catch (e) {
      console.warn("Picker search error:", e);
    } finally {
      setSearching(false);
    }
  };

  const handleSelectSearchResult = (r: any) => {
    const lat = r.location?.y || r.lat;
    const lng = r.location?.x || r.lng;
    if (lat && lng && mapRef.current) {
      mapRef.current.setView([lat, lng], 15, { animate: true });
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
      }
      handleLocationSelected(lat, lng);
      setSearchResults([]);
      setSearchQuery(r.title || r.name || "");
    }
  };

  const handleCityJump = (city: typeof IRAN_CITIES[0]) => {
    if (mapRef.current) {
      mapRef.current.setView([city.lat, city.lng], 13, { animate: true });
    }
    handleLocationSelected(city.lat, city.lng);
  };

  const handleGpsLocate = () => {
    if (!navigator.geolocation) {
      alert("مرورگر شما از موقعیت‌یاب GPS پشتیبانی نمی‌کند.");
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        if (mapRef.current) {
          mapRef.current.setView([lat, lng], 16, { animate: true });
          if (markerRef.current) {
            markerRef.current.setLatLng([lat, lng]);
          }
        }
        handleLocationSelected(lat, lng);
        setGpsLoading(false);
      },
      (err) => {
        console.warn("GPS error:", err);
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="space-y-2.5 rounded-2xl border border-slate-800 bg-slate-900/60 p-3 text-xs">
      <div className="flex items-center justify-between">
        <label className="text-slate-300 font-bold flex items-center gap-1.5">
          <MapPin className="h-4 w-4 text-emerald-400" />
          تعیین موقعیت مکانی روی نقشه نشان و مسیریاب:
        </label>
        <span className="text-[10px] text-slate-400">
          (برای تعیین دقیق، روی نقشه کلیک کنید یا پین را بکشید)
        </span>
      </div>

      {/* Search and GPS controls */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="جستجوی خیابان یا محله در نشان (مثلاً خیابان ولیعصر)..."
            className="w-full rounded-xl border border-slate-700 bg-slate-950 pr-9 pl-16 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={handleSearch}
            disabled={searching}
            className="absolute left-1 top-1/2 -translate-y-1/2 rounded-lg bg-emerald-600 px-3 py-1 text-[10px] font-bold text-white hover:bg-emerald-500 transition disabled:opacity-50"
          >
            {searching ? "..." : "جستجو"}
          </button>
        </div>

        <button
          type="button"
          onClick={handleGpsLocate}
          disabled={gpsLoading}
          className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-slate-700 hover:text-white transition cursor-pointer"
          title="موقعیت فعلی من"
        >
          <Crosshair className={`h-4 w-4 text-cyan-400 ${gpsLoading ? "animate-spin" : ""}`} />
          GPS من
        </button>
      </div>

      {/* Search results dropdown */}
      {searchResults.length > 0 && (
        <div className="max-h-40 overflow-y-auto rounded-xl border border-slate-700 bg-slate-950 p-1 shadow-2xl space-y-1">
          {searchResults.map((r, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleSelectSearchResult(r)}
              className="w-full text-right p-2 text-xs text-slate-200 hover:bg-slate-800 rounded-lg transition border-b border-slate-800/60 last:border-none"
            >
              <div className="font-bold text-emerald-300">{r.title || r.name}</div>
              {r.address && <div className="text-[10px] text-slate-400 truncate">{r.address}</div>}
            </button>
          ))}
        </div>
      )}

      {/* Quick Iranian City Buttons */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-thin">
        <span className="text-[10px] text-slate-500 shrink-0">شهر:</span>
        {IRAN_CITIES.map((c) => (
          <button
            key={c.name}
            type="button"
            onClick={() => handleCityJump(c)}
            className="rounded-lg border border-slate-800 bg-slate-950 px-2 py-0.5 text-[10px] text-slate-300 hover:border-emerald-500/50 hover:text-emerald-300 shrink-0 transition"
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* Map Container */}
      <div className="relative rounded-2xl border border-slate-800 overflow-hidden shadow-inner" style={{ height }}>
        <div ref={containerRef} className="w-full h-full z-0" />
      </div>

      {/* Selected Coordinates & Address Feedback */}
      {latitude && longitude ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-2.5 space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-emerald-300 font-bold flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-emerald-400" />
              موقعیت مکانی با موفقیت ثبت شد
            </span>
            <span className="font-mono text-emerald-400 font-bold text-xs">
              {Number(latitude).toFixed(6)} , {Number(longitude).toFixed(6)}
            </span>
          </div>

          {reverseLoading ? (
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 pt-0.5">
              <Loader2 className="h-3 w-3 animate-spin text-emerald-400" />
              در حال دریافت خودکار آدرس پستی از نشان...
            </div>
          ) : detectedAddress ? (
            <p className="text-[11px] text-slate-300 pt-0.5">
              <span className="text-slate-400">نشانی شناسایی‌شده: </span>
              <span className="font-medium text-white">{detectedAddress}</span>
            </p>
          ) : null}
        </div>
      ) : (
        <div className="text-[11px] text-slate-500 text-center py-1">
          موقعیت مکانی اختیاری است؛ اما برای مسیریابی ویزیتورها روی نقشه نشان بسیار کاربردی است.
        </div>
      )}
    </div>
  );
};
