let googlePromise: Promise<any> | null = null;

export function loadGoogleMaps(apiKey: string) {
  if (typeof window === "undefined") return Promise.reject(new Error("Google Maps فقط در مرورگر قابل بارگذاری است."));
  if ((window as any).google?.maps) return Promise.resolve((window as any).google);
  if (!apiKey) return Promise.reject(new Error("GOOGLE_MAPS_API_KEY تنظیم نشده است."));
  if (googlePromise) return googlePromise;
  googlePromise = new Promise((resolve, reject) => {
    const existing = document.getElementById("akma-google-maps-sdk") as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve((window as any).google));
      existing.addEventListener("error", () => reject(new Error("بارگذاری Google Maps ناموفق بود.")));
      return;
    }
    const script = document.createElement("script");
    script.id = "akma-google-maps-sdk";
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places`;
    script.onload = () => resolve((window as any).google);
    script.onerror = () => reject(new Error("بارگذاری Google Maps ناموفق بود."));
    document.head.appendChild(script);
  });
  return googlePromise;
}
