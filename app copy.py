from flask import Flask, render_template, send_from_directory, request, jsonify, make_response
import os

app = Flask(__name__, static_folder='static', template_folder='templates')

# Daftar nomor HP terdaftar (bisa ditambahkan atau dikoneksikan ke database)
ALLOWED_PHONE_NUMBERS = [
    "08126955534",
    "+628126955534",
    # Tambahkan nomor HP lain yang diizinkan di sini
]

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/verify-phone', methods=['POST'])
def verify_phone():
    data = request.json or {}
    phone = data.get('phone', '').strip().replace(" ", "").replace("-", "")
    
    if phone in ALLOWED_PHONE_NUMBERS:
        return jsonify({'status': 'success', 'message': 'Akses diterima'})
    else:
        return jsonify({'status': 'error', 'message': 'Nomor HP tidak terdaftar atau akses ditolak'}), 403

@app.route('/static/<path:filename>')
def serve_static(filename):
    response = make_response(send_from_directory('static', filename))
    # Header khusus agar file .pmtiles bisa dibaca peta Leaflet/MapLibre
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Headers'] = '*'
    response.headers['Accept-Ranges'] = 'bytes'
    return response

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)