import geopandas as gpd
import os

# --- 1. Tentukan file input/output ---
input_file = "Receiver_p.json"  # ganti sesuai file asli
output_file = os.path.splitext(input_file)[0] + "_leaflet.geojson"

# --- 2. Baca file ---
try:
    gdf = gpd.read_file(input_file)
except Exception as e:
    raise RuntimeError(f"❌ Gagal membaca file {input_file}: {e}")

print("CRS awal:", gdf.crs)

# --- 3. Set CRS jika tidak terbaca ---
if gdf.crs is None:
    print("⚠ CRS tidak terbaca, otomatis set ke EPSG:32748 (UTM Zone 48S WGS84)")
    gdf.set_crs("EPSG:32748", inplace=True)
else:
    print(f"✅ CRS terbaca: {gdf.crs}")

# --- 4. Periksa geometri valid ---
invalid_count = (~gdf.is_valid).sum()
if invalid_count > 0:
    print(f"⚠ Ada {invalid_count} geometri tidak valid, akan diabaikan")
    gdf = gdf[gdf.is_valid]

# --- 5. Reproject ke WGS84 untuk Leaflet ---
gdf_wgs84 = gdf.to_crs("EPSG:4326")
print("CRS setelah reproject:", gdf_wgs84.crs)

# --- 6. Simpan file GeoJSON siap Leaflet ---
try:
    gdf_wgs84.to_file(output_file, driver="GeoJSON", encoding="utf-8")
    print(f"✅ File siap untuk Leaflet: {output_file}")
except Exception as e:
    raise RuntimeError(f"❌ Gagal menyimpan file: {e}")
