"use client";

import React, { useEffect, useRef, useState } from "react";
import { MapPin, Navigation, ZoomIn, ZoomOut, Search, ExternalLink, X, RefreshCw, Layers } from "lucide-react";
import { NeonBadge } from "@/components/ui/NeonBadge";

export interface NeshanCustomer {
  id: string;
  name: string;
  code?: string;
  latitude: number | null;
  longitude: number | null;
  healthStatus?: string;
  healthScore?: number;
  mobile?: string;
  phone?: string;
  storeName?: string;
  address?: string;
  city?: string;
  creditLimit?: number;
  balanceDue?: number;
}

interface NeshanMapProps {
  customers: NeshanCustomer[];
  selectedId?: string | null;
  onSelectCustomer?: (customer: NeshanCustomer) => void;
  height?: string;
  neshanApiKey?: string;
}

const HEALTH_COLORS: Record<string, string> = {
  healthy: "#10b981",
  green: "#10b981",
  warning: "#f59e0b",
  yellow: "#f59e0b",
  critical: "#ef4444",
  red: "#ef4444",
  active: "#06b6d4",
  inactive: "#64748b",
};

const IRAN_CITIES = [
  { name: "تهران (مرکز)", lat: 35.6892, lng: 51.3890 },
  { name: "تهران (بازار بزرگ)", lat: 35.6725, lng: 51.4208 },
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

export const NeshanMap: React.FC<NeshanMapProps> = ({
  customers,
  selectedId,
  onSelectCustomer,
  height = "560px",
  neshanApiKey,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersGroupRef = useRef<any>(null);
  const [activeCustomer, setActiveCustomer] = useState<NeshanCustomer | null>(null);
  const [activeCity, setActiveCity] = useState(IRAN_CITIES[0]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [mapLayer, setMapLayer] = useState<"standard" | "satellite">("standard");

  const validCustomers = customers.filter(
    (c) =>
      c.latitude !== null &&
      c.latitude !== undefined &&
      c.longitude !== null &&
      c.longitude !== undefined &&
      !isNaN(Number(c.latitude)) &&
      !isNaN(Number(c.longitude))
  );

  // Initialize Leaflet Map dynamically
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

      const map = L.map(containerRef.current, {
        center: [35.6892, 51.3890],
        zoom: 12,
        zoomControl: false,
        attributionControl: false,
      });

      // Standard OSM tile layer
      const standardLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        subdomains: ["a", "b", "c"],
      });

      standardLayer.addTo(map);

      mapRef.current = map;
      markersGroupRef.current = L.layerGroup().addTo(map);

      setMapLoaded(true);

      // Invalidate size on resize
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

  // Update Markers
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || !markersGroupRef.current) return;

    const updateMarkers = async () => {
      const L = await import("leaflet");
      const group = markersGroupRef.current;
      group.clearLayers();

      const bounds = L.latLngBounds([]);

      validCustomers.forEach((c) => {
        const lat = Number(c.latitude);
        const lng = Number(c.longitude);
        const isSelected = c.id === selectedId;
        const color = HEALTH_COLORS[c.healthStatus || "healthy"] || "#10b981";

        const customIcon = L.divIcon({
          className: "custom-neshan-pin",
          html: `
            <div style="
              position: relative;
              width: ${isSelected ? "32px" : "24px"};
              height: ${isSelected ? "32px" : "24px"};
              border-radius: 50%;
              background: ${color};
              border: 3px solid #ffffff;
              box-shadow: 0 4px 12px rgba(0,0,0,0.5);
              display: flex;
              align-items: center;
              justify-content: center;
              cursor: pointer;
              transition: transform 0.2s ease;
            ">
              <span style="width: 6px; height: 6px; border-radius: 50%; background: #ffffff;"></span>
              ${isSelected ? `<span style="position: absolute; inset: -4px; border-radius: 50%; border: 2px solid ${color}; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></span>` : ""}
            </div>
          `,
          iconSize: [isSelected ? 32 : 24, isSelected ? 32 : 24],
          iconAnchor: [isSelected ? 16 : 12, isSelected ? 16 : 12],
        });

        const marker = L.marker([lat, lng], { icon: customIcon });

        marker.on("click", () => {
          setActiveCustomer(c);
          onSelectCustomer?.(c);
          mapRef.current?.setView([lat, lng], 15, { animate: true });
        });

        marker.bindTooltip(`
          <div style="font-family: 'Vazirmatn', sans-serif; direction: rtl; text-align: right; padding: 2px 4px;">
            <strong>${c.storeName || c.name}</strong>
            <div style="font-size: 10px; color: #64748b;">${c.mobile || ""}</div>
          </div>
        `, { direction: "top", offset: [0, -14] });

        group.addLayer(marker);
        bounds.extend([lat, lng]);
      });

      if (selectedId) {
        const found = validCustomers.find((c) => c.id === selectedId);
        if (found && found.latitude && found.longitude) {
          setActiveCustomer(found);
          mapRef.current.setView([Number(found.latitude), Number(found.longitude)], 15, { animate: true });
          return;
        }
      }

      if (validCustomers.length > 0 && bounds.isValid()) {
        mapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
      }
    };

    updateMarkers();
  }, [validCustomers, selectedId, mapLoaded]);

  // Handle City Jump
  const handleCityJump = (city: typeof IRAN_CITIES[0]) => {
    setActiveCity(city);
    if (mapRef.current) {
      mapRef.current.setView([city.lat, city.lng], 13, { animate: true });
    }
  };

  // Search with Neshan Proxy API
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
      console.warn("Search error:", e);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Controls: City Presets & Search */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* City Presets */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
          <span className="text-xs text-slate-400 font-semibold flex items-center gap-1 shrink-0">
            <Navigation className="h-3.5 w-3.5 text-cyan-400" />
            پرش سریع:
          </span>
          {IRAN_CITIES.map((city) => (
            <button
              key={city.name}
              onClick={() => handleCityJump(city)}
              className={`text-xs px-2.5 py-1.5 rounded-xl whitespace-nowrap transition border ${
                activeCity.name === city.name
                  ? "bg-cyan-500/20 border-cyan-500 text-cyan-300 font-bold shadow-sm"
                  : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white"
              }`}
            >
              {city.name}
            </button>
          ))}
        </div>

        {/* Live Search Input with Neshan API */}
        <div className="relative min-w-[260px]">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="جستجوی خیابان یا محله در نشان..."
              className="w-full rounded-xl border border-slate-700 bg-slate-900 pr-9 pl-16 py-1.5 text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
            />
            <button
              onClick={handleSearch}
              disabled={searching}
              className="absolute left-1 top-1/2 -translate-y-1/2 rounded-lg bg-cyan-600 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-cyan-500 transition disabled:opacity-50"
            >
              {searching ? "..." : "جستجو"}
            </button>
          </div>

          {searchResults.length > 0 && (
            <div className="absolute top-full right-0 left-0 z-50 mt-1 max-h-48 overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 p-1 shadow-2xl">
              {searchResults.map((r, i) => (
                <button
                  key={i}
                  onClick={() => {
                    const lat = r.location?.y || r.lat;
                    const lng = r.location?.x || r.lng;
                    if (lat && lng && mapRef.current) {
                      mapRef.current.setView([lat, lng], 15, { animate: true });
                    }
                    setSearchResults([]);
                    setSearchQuery(r.title || r.name || "");
                  }}
                  className="w-full text-right p-2 text-xs text-slate-200 hover:bg-slate-800 rounded-lg transition border-b border-slate-800/60 last:border-none"
                >
                  <div className="font-bold text-white">{r.title || r.name}</div>
                  {r.address && <div className="text-[10px] text-slate-400 truncate">{r.address}</div>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Map Box */}
      <div className="relative rounded-3xl border border-slate-800 bg-slate-950 overflow-hidden shadow-2xl" style={{ height }}>
        <div ref={containerRef} className="w-full h-full z-0" />

        {/* Map Overlay Controls */}
        <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
          <div className="flex flex-col rounded-2xl border border-slate-700/80 bg-slate-900/90 backdrop-blur-md p-1 shadow-xl">
            <button
              onClick={() => mapRef.current?.zoomIn()}
              title="بزرگ‌نمایی"
              className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            <div className="h-px bg-slate-800 my-0.5" />
            <button
              onClick={() => mapRef.current?.zoomOut()}
              title="کوچک‌نمایی"
              className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Floating Customer Count Badge */}
        <div className="absolute top-4 left-4 z-10">
          <div className="flex items-center gap-2 rounded-2xl border border-slate-700/80 bg-slate-900/90 backdrop-blur-md px-3.5 py-2 text-xs shadow-xl">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-white font-bold">{validCustomers.length}</span>
            <span className="text-slate-400">مشتری روی نقشه</span>
          </div>
        </div>

        {/* Floating Active Customer Card */}
        {activeCustomer && (
          <div className="absolute bottom-4 left-4 right-4 z-10 rounded-2xl border border-cyan-500/50 bg-slate-900/95 backdrop-blur-md p-4 shadow-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-cyan-400 shrink-0" />
                <h4 className="font-bold text-white text-sm">
                  {activeCustomer.storeName || activeCustomer.name}
                </h4>
                {activeCustomer.code && (
                  <span className="font-mono text-[10px] text-cyan-300 bg-cyan-950/60 border border-cyan-500/30 px-2 py-0.5 rounded-md">
                    {activeCustomer.code}
                  </span>
                )}
                <NeonBadge
                  variant={
                    activeCustomer.healthStatus === "green"
                      ? "green"
                      : activeCustomer.healthStatus === "yellow"
                      ? "yellow"
                      : "red"
                  }
                >
                  سلامت {activeCustomer.healthScore || 100}
                </NeonBadge>
              </div>
              <p className="text-xs text-slate-300">
                {activeCustomer.address || activeCustomer.city || "تهران"} · شماره همراه:{" "}
                <span className="font-mono text-cyan-300 font-bold">{activeCustomer.mobile || "—"}</span>
              </p>
              <p className="text-[11px] text-slate-400 font-mono">
                مختصات: {Number(activeCustomer.latitude).toFixed(6)} , {Number(activeCustomer.longitude).toFixed(6)}
              </p>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center flex-wrap">
              <a
                href={`https://nshn.ir/?lat=${activeCustomer.latitude}&lng=${activeCustomer.longitude}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-950/40 px-3 py-2 text-xs text-emerald-300 hover:text-white hover:bg-emerald-900/60 transition font-bold"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                مسیریابی در نشان
              </a>
              <a
                href={`https://www.google.com/maps?q=${activeCustomer.latitude},${activeCustomer.longitude}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-200 hover:text-white hover:border-slate-600 transition font-medium"
              >
                گوگل‌مپ
              </a>
              <a
                href={`https://balad.ir/location?latitude=${activeCustomer.latitude}&longitude=${activeCustomer.longitude}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-200 hover:text-white hover:border-slate-600 transition font-medium"
              >
                بلد
              </a>
              <button
                onClick={() => setActiveCustomer(null)}
                className="rounded-xl border border-slate-700 p-2 text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
