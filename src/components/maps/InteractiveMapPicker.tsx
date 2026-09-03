"use client";

import React, { useState, useEffect } from "react";
import {
  MapPin,
  Navigation,
  Trash2,
  CheckCircle2,
  Crosshair,
  ZoomIn,
  ZoomOut,
  Search,
  ExternalLink,
  Loader2
} from "lucide-react";

export interface MapPickerProps {
  latitude?: number | null;
  longitude?: number | null;
  onChange: (coords: { latitude: number | null; longitude: number | null }) => void;
}

const IRAN_LOCATIONS = [
  { name: "تهران - بازار بزرگ و ۱۵ خرداد", lat: 35.6725, lng: 51.4208 },
  { name: "تهران - خیابان جمهوری و لاله‌زار", lat: 35.6948, lng: 51.4172 },
  { name: "تهران - میدان ولیعصر و مرکز", lat: 35.7118, lng: 51.4072 },
  { name: "تهران - صادقیه و غرب", lat: 35.7219, lng: 51.3347 },
  { name: "تهران - تجریش و شمال", lat: 35.8053, lng: 51.4312 },
  { name: "تهران - تهرانپارس و شرق", lat: 35.7320, lng: 51.5030 },
  { name: "کرج - مرکز شهر", lat: 35.8400, lng: 50.9391 },
  { name: "مشهد - حرم و بازار رضا", lat: 36.2972, lng: 59.6067 },
  { name: "اصفهان - میدان نقش جهان", lat: 32.6546, lng: 51.6680 },
  { name: "تبریز - بازار تاریخی", lat: 38.0800, lng: 46.2919 },
  { name: "شیراز - زند و بازار وکیل", lat: 29.5918, lng: 52.5837 },
  { name: "قم - آستانه و حرم", lat: 34.6401, lng: 50.8764 },
  { name: "اهواز - نادری و کیانپارس", lat: 31.3183, lng: 48.6706 },
  { name: "رشت - شهرداری و سبزه میدان", lat: 37.2809, lng: 49.5924 },
  { name: "یزد - بافت تاریخی", lat: 31.8974, lng: 54.3569 },
];

export const InteractiveMapPicker: React.FC<MapPickerProps> = ({
  latitude,
  longitude,
  onChange,
}) => {
  const hasLocation =
    latitude !== null &&
    latitude !== undefined &&
    longitude !== null &&
    longitude !== undefined &&
    !isNaN(Number(latitude)) &&
    !isNaN(Number(longitude));

  const [currentLat, setCurrentLat] = useState<number>(Number(latitude) || 35.6892);
  const [currentLng, setCurrentLng] = useState<number>(Number(longitude) || 51.3890);
  const [selectedAreaName, setSelectedAreaName] = useState<string>("موقعیت مشخص شده");
  const [zoom, setZoom] = useState<number>(14);
  const [isSettingLocation, setIsSettingLocation] = useState<boolean>(hasLocation);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searching, setSearching] = useState<boolean>(false);
  const [gpsLoading, setGpsLoading] = useState<boolean>(false);

  useEffect(() => {
    if (hasLocation) {
      setCurrentLat(Number(latitude));
      setCurrentLng(Number(longitude));
      setIsSettingLocation(true);
    }
  }, [latitude, longitude, hasLocation]);

  const selectCoords = (lat: number, lng: number, label: string) => {
    setCurrentLat(lat);
    setCurrentLng(lng);
    setSelectedAreaName(label);
    setIsSettingLocation(true);
    onChange({ latitude: lat, longitude: lng });
  };

  const handleSearchOnline = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    // Check local presets first
    const matched = IRAN_LOCATIONS.find((l) =>
      l.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
    );
    if (matched) {
      selectCoords(matched.lat, matched.lng, matched.name);
      return;
    }

    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          searchQuery + " ایران"
        )}&limit=1`
      ).then((r) => r.json());

      if (Array.isArray(res) && res.length > 0) {
        const item = res[0];
        const lat = parseFloat(item.lat);
        const lng = parseFloat(item.lon);
        selectCoords(lat, lng, item.display_name.split(",")[0] || searchQuery);
      } else {
        alert("موقعیت مورد نظر یافت نشد. لطفاً از مناطق پرکاربرد انتخاب کنید.");
      }
    } catch {
      // Fallback
    } finally {
      setSearching(false);
    }
  };

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert("مرورگر شما از دریافت موقعیت مکانی زنده پشتیبانی نمی‌کند.");
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        selectCoords(lat, lng, "موقعیت زنده GPS دستگاه شما");
        setGpsLoading(false);
      },
      (err) => {
        setGpsLoading(false);
        alert(`امکان دریافت موقعیت GPS وجود ندارد (${err.message}). لطفاً دسترسی لوکیشن را مجاز نمایید.`);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const handleClearLocation = () => {
    setIsSettingLocation(false);
    onChange({ latitude: null, longitude: null });
  };

  const filteredLocations = IRAN_LOCATIONS.filter((l) =>
    l.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  const osmEmbedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${currentLng - 0.02 * (14 / zoom)}%2C${currentLat - 0.015 * (14 / zoom)}%2C${currentLng + 0.02 * (14 / zoom)}%2C${currentLat + 0.015 * (14 / zoom)}&layer=mapnik&marker=${currentLat}%2C${currentLng}`;

  return (
    <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div>
          <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
            <MapPin className="h-4 w-4 text-cyan-400" />
            انتخاب موقعیت روی نقشه و اتصال به نشان
          </label>
          <p className="text-[11px] text-slate-400 mt-0.5">
            انتخاب بصری لوکیشن بدون نیاز به وارد کردن طول و عرض جغرافیایی
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isSettingLocation ? (
            <button
              type="button"
              onClick={handleClearLocation}
              className="flex items-center gap-1 text-xs text-rose-400 hover:text-rose-300 bg-rose-950/30 border border-rose-500/30 rounded-xl px-3 py-1.5 transition"
            >
              <Trash2 className="h-3.5 w-3.5" />
              حذف موقعیت
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setIsSettingLocation(true);
                onChange({ latitude: currentLat, longitude: currentLng });
              }}
              className="flex items-center gap-1 text-xs text-cyan-300 bg-cyan-950/40 border border-cyan-500/30 rounded-xl px-3 py-1.5 hover:bg-cyan-900/50 transition font-medium"
            >
              <Crosshair className="h-3.5 w-3.5" />
              + انتخاب موقعیت روی نقشه
            </button>
          )}
        </div>
      </div>

      {isSettingLocation ? (
        <div className="space-y-3">
          {/* Search, GPS & Neshan Link */}
          <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
            <form onSubmit={handleSearchOnline} className="relative flex-1 flex gap-1">
              <div className="relative flex-1">
                <Search className="absolute right-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="جستجوی شهر، خیابان یا بازار (لاله‌زار، بازار تهران، اصفهان...)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl bg-slate-900 border border-slate-800 py-1.5 pr-8 pl-3 text-xs text-white placeholder-slate-500 focus:border-cyan-500 outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={searching}
                className="rounded-xl bg-slate-800 border border-slate-700 px-3 py-1.5 text-xs text-white hover:bg-slate-700 shrink-0"
              >
                {searching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "جستجو"}
              </button>
            </form>

            <button
              type="button"
              onClick={handleGetCurrentLocation}
              disabled={gpsLoading}
              className="flex items-center justify-center gap-1.5 text-xs rounded-xl bg-cyan-600/20 border border-cyan-500/40 px-3 py-1.5 text-cyan-300 hover:bg-cyan-600/30 shrink-0 transition"
              title="دریافت لوکیشن زنده GPS دستگاه شما"
            >
              {gpsLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Navigation className="h-3.5 w-3.5" />}
              <span>موقعیت من (GPS)</span>
            </button>

            <a
              href={`https://nshn.ir/?lat=${currentLat}&lng=${currentLng}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-1 text-[11px] rounded-xl bg-slate-900 border border-slate-700 px-3 py-1.5 text-cyan-300 hover:text-white shrink-0 transition"
              title="مشاهده موقعیت در اپلیکیشن نشان"
            >
              <ExternalLink className="h-3 w-3" />
              <span>مسیریابی در نشان</span>
            </a>
          </div>

          {/* Quick Area Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-thin">
            <span className="text-[11px] text-slate-400 shrink-0">مناطق متداول:</span>
            {filteredLocations.slice(0, 9).map((loc) => (
              <button
                key={loc.name}
                type="button"
                onClick={() => selectCoords(loc.lat, loc.lng, loc.name)}
                className={`text-[11px] px-2.5 py-1 rounded-lg border shrink-0 transition ${
                  selectedAreaName === loc.name
                    ? "bg-cyan-500/20 border-cyan-500 text-cyan-300 font-bold"
                    : "bg-slate-900 border-slate-800 text-slate-300 hover:text-white hover:border-slate-700"
                }`}
              >
                {loc.name}
              </button>
            ))}
          </div>

          {/* Interactive Map Visual Frame */}
          <div className="relative h-60 rounded-2xl border border-slate-800 overflow-hidden bg-slate-900 shadow-inner">
            <iframe
              title="Location Picker Map"
              src={osmEmbedUrl}
              className="w-full h-full border-0 contrast-[1.05]"
              loading="lazy"
            />

            {/* Zoom Controls */}
            <div className="absolute top-2 right-2 flex flex-col gap-1 rounded-xl bg-slate-900/90 border border-slate-700/80 p-1 shadow-lg backdrop-blur-md">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(z + 1, 18))}
                className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg"
                title="بزرگ‌نمایی"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(z - 1, 8))}
                className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg"
                title="کوچک‌نمایی"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 text-[11px] text-emerald-400 bg-emerald-950/20 border border-emerald-500/20 rounded-xl p-2.5">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>موقعیت ثبت شده: {selectedAreaName}</span>
            </div>
            <a
              href={`https://nshn.ir/?lat=${currentLat}&lng=${currentLng}`}
              target="_blank"
              rel="noreferrer"
              className="text-[10px] text-cyan-400 underline hover:text-cyan-300"
            >
              باز کردن در نشان (Neshan)
            </a>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-800 bg-slate-900/30 p-3 text-center">
          <p className="text-xs text-slate-400">
            موقعیت مکانی روی نقشه ثبت نشده است (برای فعال‌سازی روی «انتخاب موقعیت روی نقشه» کلیک کنید).
          </p>
        </div>
      )}
    </div>
  );
};
