import os
from flask import (
    Flask,
    jsonify,
    make_response,
    render_template,
    request,
    send_from_directory,
)

app = Flask(__name__, static_folder='static', template_folder='templates')

# Password proyek utama untuk verifikasi akses kru
PROJECT_PASSWORD = "BGPBISA3X"


@app.route("/")
def index():
  return render_template("index.html")


@app.route("/api/verify-phone", methods=["POST"])
def verify_phone():
  data = request.json or {}

  # Mengambil input password dari request (bisa dari field 'password' atau 'phone')
  input_pass = data.get("password") or data.get("phone") or ""
  input_pass = input_pass.strip()

  if input_pass == PROJECT_PASSWORD:
    return jsonify({"status": "success", "message": "Akses diterima"})
  else:
    return jsonify({
        "status": "error",
        "message": "Password salah atau akses ditolak",
    }), 403


@app.route("/static/<path:filename>")
def serve_static(filename):
  response = make_response(send_from_directory("static", filename))
  response.headers["Access-Control-Allow-Origin"] = "*"
  response.headers["Access-Control-Allow-Headers"] = "*"
  response.headers["Accept-Ranges"] = "bytes"
  return response


if __name__ == "__main__":
  app.run(host="0.0.0.0", port=5000, debug=True)