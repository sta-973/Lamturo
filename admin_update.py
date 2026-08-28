import json
import os
import subprocess


def update_progress_batch(file_name, stage, list_range):
  """file_name : 'S_East.geojson', 'R_East.geojson', dll.

  stage     : 'rintis', 'topo', 'bridging', 'drilling', 'recording' list_range:
  daftar tuple [("start_id", "end_id"), ...]
  """
  filepath = os.path.join('static', file_name)

  if not os.path.exists(filepath):
    print(f"❌ File {file_name} tidak ditemukan!")
    return

  with open(filepath, 'r', encoding='utf-8') as f:
    geojson_data = json.load(f)

  total_updated = 0

  # Iterasi semua titik di GeoJSON
  for feature in geojson_data.get('features', []):
    props = feature.setdefault('properties', {})
    id2 = str(props.get('ID2', props.get('ID', ''))).strip()

    # Cek apakah ID2 masuk dalam salah satu range yang di-input
    for start_id, end_id in list_range:
      if str(start_id).strip() <= id2 <= str(end_id).strip():
        props[stage] = '1'  # Tandai selesai
        total_updated += 1
        break

  # Simpan perubahan kembali ke file GeoJSON
  with open(filepath, 'w', encoding='utf-8') as f:
    json.dump(geojson_data, f, ensure_ascii=False, indent=2)

  print(
      f"✅ Berhasil update {total_updated} titik untuk stage '{stage}' pada file"
      f" {file_name}."
  )


# ==============================================================================
# TEMPAT INPUT LAPORAN HARIAN (TINGGAL EDIT DI SINI):
# ==============================================================================

# Contoh: Mau update laporan Kru TOPO (bisa banyak range sekaligus)
target_file = 'S_East.geojson'  # Pilih file yang mau di-update
stage_target = 'topo'  # rintis / topo / bridging / drilling / recording

# Masukkan daftar range sesuai laporan kru harian
daftar_produksi_kru = [
    ('001-1001', '001-1200'),  # Kru Topo 1
    ('092-1001', '092-1500'),  # Kru Topo 2
    ('093-1001', '093-1300'),  # Kru Topo 3
    # Tambahkan range kru lain di bawah sini jika ada...
]

# Eksekusi Update
update_progress_batch(target_file, stage_target, daftar_produksi_kru)

# Opsional: Otomatis Push ke GitHub & Deploy Vercel
pilihan = input('\nLangsung Upload/Push ke Vercel? (y/n): ')
if pilihan.lower() == 'y':
  subprocess.run(['git', 'add', '.'])
  subprocess.run([
      'git',
      'commit',
      '-m',
      f'Update progress {stage_target} pada {target_file}',
  ])
  subprocess.run(['git', 'push'])
  print('\n🚀 Berhasil push! Tunggu ~30 detik, Vercel akan otomatis update.')