from datetime import datetime
import json
import os
from flask import (
    Flask,
    jsonify,
    make_response,
    render_template,
    request,
    send_from_directory,
)
from pyproj import Transformer

app = Flask(__name__, static_folder='static', template_folder='templates')

# Password proyek utama untuk verifikasi akses kru
PROJECT_PASSWORD = "BGPBISA3X"

# File tunggal penyimpanan hasil Pick Point
PICK_FILE = os.path.join("static", "survey_picks.geojson")

# Inisialisasi Transformer koordinat: WGS84 (EPSG:4326) -> UTM Zone 49S (EPSG:32749)
transformer = Transformer.from_crs(
    "EPSG:4326", "EPSG:32749", always_xy=True
)


@app.route("/")
def index():
  return render_template("index.html")


@app.route("/api/verify-phone", methods=["POST"])
def verify_phone():
  """Route verifikasi password untuk kru WebGIS"""
  data = request.json or {}

  # Membaca input password dari request
  input_pass = data.get("password") or data.get("phone") or ""
  input_pass = input_pass.strip()

  if input_pass == PROJECT_PASSWORD:
    return jsonify({"status": "success", "message": "Akses diterima"})
  else:
    return jsonify({
        "status": "error",
        "message": "Password salah atau akses ditolak",
    }), 403


@app.route("/api/pick-point", methods=["POST"])
def save_pick_point():
  """Route untuk merekam Pick Point ke 1 file GeoJSON tunggal (UTM 49S)"""
  data = request.json or {}

  point_name = data.get("name", "UNNAMED").strip()
  lat = data.get("lat")
  lng = data.get("lng")
  alt = data.get("alt", 0)

  if lat is None or lng is None:
    return jsonify(
        {"status": "error", "message": "Koordinat GPS tidak valid"}
    ), 400

  try:
    # 1. Konversi Koordinat WGS84 ke UTM Zone 49S (Easting, Northing)
    easting, northing = transformer.transform(lng, lat)

    easting_formatted = round(easting, 3)
    northing_formatted = round(northing, 3)
    lat_formatted = round(lat, 7)
    lng_formatted = round(lng, 7)
    alt_formatted = round(alt, 3)

    # 2. Tanggal & Waktu Otomatis
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # 3. Buat Feature GeoJSON
    new_feature = {
        "type": "Feature",
        "properties": {
            "Point_Name": point_name,
            "Date_Time": timestamp,
            "Elevation": alt_formatted,
            "Latitude": lat_formatted,
            "Longitude": lng_formatted,
            "Easting_UTM49S": easting_formatted,
            "Northing_UTM49S": northing_formatted,
            "Zone": "UTM 49S",
        },
        "geometry": {
            "type": "Point",
            "coordinates": [lng_formatted, lat_formatted, alt_formatted],
        },
    }

    # 4. Baca atau inisialisasi file GeoJSON tunggal
    if os.path.exists(PICK_FILE):
      try:
        with open(PICK_FILE, "r", encoding="utf-8") as f:
          geojson_data = json.load(f)
      except Exception:
        geojson_data = {"type": "FeatureCollection", "features": []}
    else:
      geojson_data = {"type": "FeatureCollection", "features": []}

    # 5. Tambahkan (Append) titik baru ke array features
    geojson_data["features"].append(new_feature)

    # 6. Simpan kembali ke file survey_picks.geojson
    with open(PICK_FILE, "w", encoding="utf-8") as f:
      json.dump(geojson_data, f, indent=2)

    return jsonify({
        "status": "success",
        "message": f"Point '{point_name}' tersimpan di UTM Zone 49S!",
        "feature": new_feature,
    })

  except Exception as e:
    return jsonify({
        "status": "error",
        "message": f"Gagal memproses data: {str(e)}",
    }), 500


@app.route("/static/<path:filename>")
def serve_static(filename):
  """Melayani penyediaan file static/tiles dengan header CORS"""
  response = make_response(send_from_directory("static", filename))
  response.headers["Access-Control-Allow-Origin"] = "*"
  response.headers["Access-Control-Allow-Headers"] = "*"
  response.headers["Accept-Ranges"] = "bytes"
  return response


if __name__ == "__main__":
  app.run(host="0.0.0.0", port=5000, debug=True)