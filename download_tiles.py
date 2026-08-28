import os, math, requests, time

# === PARAMETER ===
LAT, LON = -2.41122, 104.09367   # Koordinat tengah
RADIUS_KM = 2                    # Radius area
ZOOM_MIN, ZOOM_MAX = 14, 17      # Level zoom
TILE_SERVER = "https://tile.openstreetmap.org/{z}/{x}/{y}.png"

# === FUNGSI KONVERSI ===
def deg2num(lat_deg, lon_deg, zoom):
    lat_rad = math.radians(lat_deg)
    n = 2.0 ** zoom
    xtile = int((lon_deg + 180.0) / 360.0 * n)
    ytile = int((1.0 - math.log(math.tan(lat_rad) + (1 / math.cos(lat_rad))) / math.pi) / 2.0 * n)
    return xtile, ytile

def num2deg(xtile, ytile, zoom):
    n = 2.0 ** zoom
    lon_deg = xtile / n * 360.0 - 180.0
    lat_rad = math.atan(math.sinh(math.pi * (1 - 2 * ytile / n)))
    lat_deg = math.degrees(lat_rad)
    return lat_deg, lon_deg

# === HITUNG TILE YANG PERLU DIUNDUH ===
def tiles_in_radius(lat, lon, radius_km, zoom):
    R = 6371.0
    lat_min = lat - (radius_km / R) * (180 / math.pi)
    lat_max = lat + (radius_km / R) * (180 / math.pi)
    lon_min = lon - (radius_km / R) * (180 / math.pi) / math.cos(math.radians(lat))
    lon_max = lon + (radius_km / R) * (180 / math.pi) / math.cos(math.radians(lat))

    x_min, y_max = deg2num(lat_min, lon_min, zoom)
    x_max, y_min = deg2num(lat_max, lon_max, zoom)
    return x_min, x_max, y_min, y_max

# === UNDUH TILE ===
for zoom in range(ZOOM_MIN, ZOOM_MAX + 1):
    x_min, x_max, y_min, y_max = tiles_in_radius(LAT, LON, RADIUS_KM, zoom)
    total = (x_max - x_min + 1) * (y_max - y_min + 1)
    print(f"\n[Zoom {zoom}] Mengunduh {total} tile...")
    count = 0

    for x in range(x_min, x_max + 1):
        for y in range(y_min, y_max + 1):
            url = TILE_SERVER.format(z=zoom, x=x, y=y)
            folder = f"tiles/{zoom}/{x}"
            os.makedirs(folder, exist_ok=True)
            filepath = f"{folder}/{y}.png"
            if os.path.exists(filepath): 
                continue
            try:
                r = requests.get(url, timeout=10)
                if r.status_code == 200:
                    with open(filepath, "wb") as f:
                        f.write(r.content)
                    count += 1
                else:
                    print(f"⚠️ Gagal ({r.status_code}): {url}")
            except Exception as e:
                print("❌ Error:", e)
            time.sleep(0.2)  # hindari terlalu cepat
    print(f"Selesai zoom {zoom}: {count} tile diunduh ✅")

print("\n✅ Semua tile selesai diunduh. Simpan di folder 'tiles/'")
