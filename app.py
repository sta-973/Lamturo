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

app = Flask(__name__, static_folder="static", template_folder="templates")

# Password utama proyek
PROJECT_PASSWORD = os.getenv("ADMIN_PASSWORD", "BGPBISA3X")

# Jalur penyimpanan file survey lokal
PICK_FILE = os.path.join("static", "survey_picks.geojson")

# Transformer Koordinat: WGS84 (EPSG:4326) <-> UTM Zone 49S (EPSG:32749)
transformer_to_utm = Transformer.from_crs("EPSG:4326", "EPSG:32749", always_xy=True)
transformer_to_wgs = Transformer.from_crs("EPSG:32749", "EPSG:4326", always_xy=True)


@app.route("/")
def index():
  return render_template("index.html")


@app.route("/api/verify-phone", methods=["POST"])
def verify_phone():
  """Verifikasi password akses kru / admin"""
  data = request.get_json() or {}
  input_pass = data.get("password") or data.get("phone") or ""
  input_pass = str(input_pass).strip()

  if input_pass == PROJECT_PASSWORD:
    return jsonify({"status": "success", "message": "Akses diterima"}), 200
  return jsonify({
      "status": "error",
      "message": "Password salah atau akses ditolak",
  }), 401


@app.route("/api/convert-coords", methods=["POST"])
def convert_coords():
  """Endpoint pendukung konversi UTM 49S (Easting, Northing) ke WGS84 (Lat, Lng)"""
  data = request.get_json() or {}
  easting = data.get("easting")
  northing = data.get("northing")

  if easting is None or northing is None:
    return jsonify(
        {"status": "error", "message": "Easting dan Northing wajib diisi"}
    ), 400

  try:
    lng, lat = transformer_to_wgs.transform(float(easting), float(northing))
    return jsonify({
        "status": "success",
        "zone": "UTM 49S",
        "easting": float(easting),
        "northing": float(northing),
        "longitude": round(lng, 7),
        "latitude": round(lat, 7),
    }), 200
  except Exception as e:
    return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/api/pick-point", methods=["POST"])
def save_pick_point():
  """Merekam titik Pick Point (Lat/Lng WGS84 -> UTM 49S) ke survey_picks.geojson"""
  data = request.get_json() or {}

  point_name = str(data.get("name", "UNNAMED")).strip()
  lat = data.get("lat")
  lng = data.get("lng")
  alt = data.get("alt", 0)

  if lat is None or lng is None:
    return jsonify(
        {"status": "error", "message": "Koordinat GPS tidak valid"}
    ), 400

  try:
    # 1. Konversi WGS84 ke UTM Zone 49S
    easting, northing = transformer_to_utm.transform(float(lng), float(lat))

    easting_fmt = round(easting, 3)
    northing_fmt = round(northing, 3)
    lat_fmt = round(float(lat), 7)
    lng_fmt = round(float(lng), 7)
    alt_fmt = round(float(alt), 3)

    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # 2. Struktur Feature GeoJSON
    new_feature = {
        "type": "Feature",
        "properties": {
            "Point_Name": point_name,
            "Date_Time": timestamp,
            "Elevation": alt_fmt,
            "Latitude": lat_fmt,
            "Longitude": lng_fmt,
            "Easting_UTM49S": easting_fmt,
            "Northing_UTM49S": northing_fmt,
            "Zone": "UTM 49S",
        },
        "geometry": {
            "type": "Point",
            "coordinates": [lng_fmt, lat_fmt, alt_fmt],
        },
    }

    # 3. Baca dan update file survey_picks.geojson
    geojson_data = {"type": "FeatureCollection", "features": []}
    if os.path.exists(PICK_FILE):
      try:
        with open(PICK_FILE, "r", encoding="utf-8") as f:
          geojson_data = json.load(f)
      except Exception:
        geojson_data = {"type": "FeatureCollection", "features": []}

    geojson_data["features"].append(new_feature)

    with open(PICK_FILE, "w", encoding="utf-8") as f:
      json.dump(geojson_data, f, indent=2)

    return jsonify({
        "status": "success",
        "message": f"Point '{point_name}' tersimpan di UTM Zone 49S!",
        "feature": new_feature,
    }), 200

  except Exception as e:
    return jsonify({
        "status": "error",
        "message": f"Gagal memproses data: {str(e)}",
    }), 500


@app.route("/api/get-picks", methods=["GET"])
def get_picks():
  """Melihat seluruh data Pick Point yang tersimpan"""
  if os.path.exists(PICK_FILE):
    try:
      with open(PICK_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)
      return jsonify(data), 200
    except Exception as e:
      return jsonify({"status": "error", "message": str(e)}), 500
  return jsonify({"type": "FeatureCollection", "features": []}), 200


@app.route("/static/<path:filename>")
def serve_static(filename):
  """Penyediaan file statis & raster tile dengan CORS enabled"""
  response = make_response(send_from_directory(app.static_folder, filename))
  response.headers["Access-Control-Allow-Origin"] = "*"
  response.headers["Access-Control-Allow-Headers"] = "*"
  response.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
  response.headers["Accept-Ranges"] = "bytes"
  return response


if __name__ == "__main__":
  app.run(host="0.0.0.0", port=5000, debug=True)