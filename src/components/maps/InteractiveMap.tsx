"use client";

import React, { useState, useEffect, useRef } from "react";
import { MapPin, Navigation, ZoomIn, ZoomOut, Search, Eye, ExternalLink, X, Check } from "lucide-react";
import { NeonBadge } from "@/components/ui/NeonBadge";

export interface MapCustomer {
  id: string;
  name: string;
  storeName?: string;
  mobile?: string;
  phone?: string;
  address?: string;
  city?: string;
  latitude?: number | null;
  longitude?: number | null;
  healthStatus?: string;
  healthScore?: number;
  [key: string]: any;
}

const IRAN_CITIES = [
  { name: "تهران (مرکز)", lat: 35.6892, lng: 51.3890 },
  { name: "تهران (بازار بزرگ)", lat: 35.6725, lng: 51.4208 },
  { name: "تهران (غرب)", lat: 35.7219, lng: 51.3347 },
  { name: "تهران (شرق)", lat: 35.7320, lng: 51.5030 },
  { name: "کرج", lat: 35.8400, lng: 50.9391 },
  { name: "مشهد", lat: 36.2972, lng: 59.6067 },
  { name: "اصفهان", lat: 32.6546, lng: 51.6680 },
  { name: "تبریز", lat: 38.0800, lng: 46.2919 },
  { name: "شیراز", lat: 29.5918, lng: 52.5837 },
  { name: "قم", lat: 34.6401, lng: 50.8764 },
  { name: "اهواز", lat: 31.3183, lng: 48.6706 },
  { name: "رشت", lat: 37.2809, lng: 49.5924 },
  { name: "ساری", lat: 36.5659, lng: 53.0586 },
  { name: "یزد", lat: 31.8974, lng: 54.3569 },
];

export const InteractiveMap: React.FC<{
  customers: MapCustomer[];
  selectedId?: string | null;
  onSelectCustomer?: (customer: MapCustomer) => void;
  height?: string;
}> = ({ customers, selectedId, onSelectCustomer, height = "600px" }) => {
  const validCustomers = customers.filter(
    (c) => c.latitude !== null && c.latitude !== undefined && c.longitude !== null && c.longitude !== undefined && !isNaN(Number(c.latitude)) && !isNaN(Number(c.longitude))
  );

  const [activePin, setActivePin] = useState<MapCustomer | null>(null);
  const [centerCity, setCenterCity] = useState(IRAN_CITIES[0]);
  const [zoomLevel, setZoomLevel] = useState(13);
  const [currentCenter, setCurrentCenter] = useState({ lat: 35.6892, lng: 51.3890 });

  useEffect(() => {
    if (selectedId) {
      const found = validCustomers.find((c) => c.id === selectedId);
      if (found && found.latitude && found.longitude) {
        setActivePin(found);
        setCurrentCenter({ lat: Number(found.latitude), lng: Number(found.longitude) });
        setZoomLevel(15);
      }
    }
  }, [selectedId, validCustomers]);

  const handleCityJump = (city: typeof IRAN_CITIES[0]) => {
    setCenterCity(city);
    setCurrentCenter({ lat: city.lat, lng: city.lng });
    setZoomLevel(13);
  };

  const osmUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${currentCenter.lng - 0.08 * (14 / zoomLevel)}%2C${currentCenter.lat - 0.05 * (14 / zoomLevel)}%2C${currentCenter.lng + 0.08 * (14 / zoomLevel)}%2C${currentCenter.lat + 0.05 * (14 / zoomLevel)}&layer=mapnik&marker=${currentCenter.lat}%2C${currentCenter.lng}`;

  return (
    <div className="space-y-4">
      {/* Quick City Presets */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
        <span className="text-xs text-slate-400 font-semibold flex items-center gap-1 shrink-0">
          <Navigation className="h-3.5 w-3.5 text-cyan-400" />
          پرش به شهر:
        </span>
        {IRAN_CITIES.map((city) => (
          <button
            key={city.name}
            onClick={() => handleCityJump(city)}
            className={`text-xs px-3 py-1.5 rounded-xl whitespace-nowrap transition-all border ${
              centerCity.name === city.name
                ? "bg-cyan-500/20 border-cyan-500 text-cyan-300 font-bold shadow-sm"
                : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white"
            }`}
          >
            {city.name}
          </button>
        ))}
      </div>

      <div className="relative rounded-3xl border border-slate-800 bg-slate-950 overflow-hidden shadow-2xl" style={{ height }}>
        {/* OpenStreetMap Live Interactive Tile Layer */}
        <iframe
          title="OpenStreetMap Interactive"
          src={osmUrl}
          className="w-full h-full border-0 opacity-90 contrast-[1.05] filter"
          loading="lazy"
        />

        {/* Map Overlay Controls */}
        <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
          <div className="flex flex-col rounded-2xl border border-slate-700/80 bg-slate-900/90 backdrop-blur-md p-1 shadow-xl">
            <button
              onClick={() => setZoomLevel((z) => Math.min(z + 1, 18))}
              title="بزرگ‌نمایی"
              className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            <div className="h-px bg-slate-800 my-0.5" />
            <button
              onClick={() => setZoomLevel((z) => Math.max(z - 1, 8))}
              title="کوچک‌نمایی"
              className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Floating Customer Markers Counter / Info */}
        <div className="absolute top-4 left-4 z-10">
          <div className="flex items-center gap-2 rounded-2xl border border-slate-700/80 bg-slate-900/90 backdrop-blur-md px-3.5 py-2 text-xs shadow-xl">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-white font-bold">{validCustomers.length}</span>
            <span className="text-slate-400">مشتری دارای لوکیشن</span>
          </div>
        </div>

        {/* Floating Customer List Drawer on Map */}
        <div className="absolute bottom-4 left-4 right-4 z-10 flex flex-col sm:flex-row gap-3">
          {activePin ? (
            <div className="flex-1 rounded-2xl border border-cyan-500/50 bg-slate-900/95 backdrop-blur-md p-4 shadow-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-3 duration-200">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-cyan-400 shrink-0" />
                  <h4 className="font-bold text-white text-sm">{activePin.storeName || activePin.name}</h4>
                  <NeonBadge
                    variant={
                      activePin.healthStatus === "green"
                        ? "green"
                        : activePin.healthStatus === "yellow"
                        ? "yellow"
                        : "red"
                    }
                  >
                    سلامت {activePin.healthScore || 100}
                  </NeonBadge>
                </div>
                <p className="text-xs text-slate-300">
                  {activePin.address || activePin.city || "تهران"} · شماره: <span className="font-mono text-cyan-300">{activePin.mobile || "—"}</span>
                </p>
                <p className="text-[11px] text-slate-400 font-mono">
                  مختصات: {Number(activePin.latitude).toFixed(6)} , {Number(activePin.longitude).toFixed(6)}
                </p>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center">
                <a
                  href={`https://nshn.ir/?lat=${activePin.latitude}&lng=${activePin.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 rounded-xl border border-cyan-500/30 bg-cyan-950/40 px-3 py-2 text-xs text-cyan-300 hover:text-white hover:bg-cyan-900/50 transition font-medium"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  مسیریابی با نشان
                </a>
                <a
                  href={`https://www.google.com/maps?q=${activePin.latitude},${activePin.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-200 hover:text-white hover:border-slate-600 transition"
                >
                  گوگل‌مپ
                </a>
                <button
                  onClick={() => setActivePin(null)}
                  className="rounded-xl border border-slate-700 p-2 text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 rounded-2xl border border-slate-800/80 bg-slate-900/90 backdrop-blur-md p-3 shadow-xl overflow-x-auto">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 shrink-0 font-medium">مشتریان ثبت‌شده:</span>
                {validCustomers.slice(0, 8).map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setActivePin(c);
                      if (c.latitude && c.longitude) {
                        setCurrentCenter({ lat: Number(c.latitude), lng: Number(c.longitude) });
                        setZoomLevel(15);
                      }
                      onSelectCustomer?.(c);
                    }}
                    className="flex items-center gap-1.5 text-xs bg-slate-950 border border-slate-800 hover:border-cyan-500/50 rounded-xl px-3 py-1.5 text-slate-300 hover:text-white shrink-0 transition"
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${
                        c.healthStatus === "green"
                          ? "bg-emerald-400"
                          : c.healthStatus === "yellow"
                          ? "bg-amber-400"
                          : "bg-rose-400"
                      }`}
                    />
                    <span>{c.storeName || c.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
