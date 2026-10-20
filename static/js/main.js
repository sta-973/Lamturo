/* ==========================================================================
   WEBGIS SEISMIK - MAIN JAVASCRIPT (NAVIGASI LENGKAP & SAFE)
   ========================================================================== */

   const HSE_SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQZa0Yw0Jjcg0dVWp6yQIoqvb5OaxpMmsFH9c7hizyN9hBLLVO9VT9u_BrnJ3AQu9WsempAjxDZQ9JL/pub?gid=0&single=true&output=csv";

   // Variabel global untuk menampung data master gabung_leaflet.geojson di latar belakang
   window._masterGabungData = null;
   
   // Otomatis download file gabung_leaflet.geojson sejak awal main.js dimuat
   (function preloadGabungData() {
       fetch('/static/gabung_leaflet.geojson')
           .then(res => {
               if (!res.ok) throw new Error("Gagal meload gabung_leaflet.geojson");
               return res.json();
           })
           .then(data => {
               window._masterGabungData = data;
               console.log("Master file gabung_leaflet.geojson berhasil dimuat di background!");
           })
           .catch(err => console.warn("Peringatan master file:", err));
   })();
   
   // Helper Referensi Peta Aktif dari index.html
   function getActiveMap() {
       return window.currentMap || window.map || null;
   }
   
   // --------------------------------------------------------------------------
   // 1. LOGIKA HSE BOARD (GOOGLE SHEETS INTEGRATION)
   // --------------------------------------------------------------------------
   function renderDigits(value) {
       if (value === undefined || value === null || value === "") {
           return '<span class="hse-digit-box">0</span>';
       }
       return String(value).trim().split('').map(char => {
           if (char === ' ') return '&nbsp;';
           return `<span class="hse-digit-box">${char}</span>`;
       }).join('');
   }
   
   window.loadHseData = function () {
       fetch(HSE_SHEET_CSV_URL)
           .then(response => {
               if (!response.ok) throw new Error("Gagal mengambil data dari Google Sheets");
               return response.text();
           })
           .then(csvText => {
               const lines = csvText.split('\n');
               const data = {};
   
               lines.forEach(line => {
                   const parts = line.split(',');
                   if (parts.length >= 2) {
                       const rawKey = parts[0].trim().toLowerCase();
                       const cleanKey = rawKey.replace(/[^a-z0-9]/g, '');
                       const value = parts[1].trim();
   
                       data[rawKey] = value;
                       data[cleanKey] = value;
                   }
               });
   
               const getVal = (...keys) => {
                   for (let k of keys) {
                       const normalized = k.toLowerCase().replace(/[^a-z0-9]/g, '');
                       if (data[normalized] !== undefined) return data[normalized];
                       if (data[k.toLowerCase()] !== undefined) return data[k.toLowerCase()];
                   }
                   return "0";
               };
   
               if (document.getElementById('hse-date'))     document.getElementById('hse-date').innerHTML     = renderDigits(getVal('date'));
               if (document.getElementById('hse-day'))      document.getElementById('hse-day').innerHTML      = renderDigits(getVal('day'));
               if (document.getElementById('hse-pob'))      document.getElementById('hse-pob').innerHTML      = renderDigits(getVal('pob'));
               if (document.getElementById('hse-manhours')) document.getElementById('hse-manhours').innerHTML = renderDigits(getVal('manhours'));
               if (document.getElementById('hse-fat'))      document.getElementById('hse-fat').innerHTML      = renderDigits(getVal('fat'));
               if (document.getElementById('hse-lti'))      document.getElementById('hse-lti').innerHTML      = renderDigits(getVal('lti'));
               if (document.getElementById('hse-rwc'))      document.getElementById('hse-rwc').innerHTML      = renderDigits(getVal('rwc'));
               if (document.getElementById('hse-mtc'))      document.getElementById('hse-mtc').innerHTML      = renderDigits(getVal('mtc'));
               if (document.getElementById('hse-fac'))      document.getElementById('hse-fac').innerHTML      = renderDigits(getVal('fac'));
               if (document.getElementById('hse-nm'))       document.getElementById('hse-nm').innerHTML       = renderDigits(getVal('nm'));
               if (document.getElementById('hse-uauc'))     document.getElementById('hse-uauc').innerHTML     = renderDigits(getVal('ua_uc', 'ua/uc', 'uauc', 'ua uc', 'ua_uc_total'));
           })
           .catch(err => console.warn("Peringatan HSE Board:", err));
   };
   
   // --------------------------------------------------------------------------
   // 2. TOGGLE MODAL PANELS (HSE BOARD & NAVIGASI)
   // --------------------------------------------------------------------------
   window.toggleHseBoard = function() {
       const hsePanel = document.getElementById("hse-board") || 
                        document.getElementById("hseBoardModal") || 
                        document.querySelector(".hse-board-modal");
   
       if (hsePanel) {
           const isHidden = window.getComputedStyle(hsePanel).display === "none";
           if (isHidden) {
               hsePanel.style.display = "block";
               if (typeof window.loadHseData === 'function') {
                   window.loadHseData();
               }
           } else {
               hsePanel.style.display = "none";
           }
       }
   };
   
   window.toggleNavMenu = function() {
       const navPanel = document.getElementById("navMenuPanel") || document.querySelector(".nav-menu-panel");
       if (navPanel) {
           const isHidden = window.getComputedStyle(navPanel).display === "none";
           navPanel.style.display = isHidden ? "flex" : "none";
       }
   };
   
   // --------------------------------------------------------------------------
// 3. FUNGSI NAVIGASI & GARIS
// --------------------------------------------------------------------------
window.drawNavigationLine = function (targetLat, targetLng, pointName) {
    const activeMap = getActiveMap();
    if (!activeMap) return alert("Peta belum siap!");

    const navMode = document.getElementById("navModeSelect")?.value || "straight";

    if (!window.userLatLng) {
        window.userLatLng = { lat: targetLat - 0.005, lng: targetLng - 0.005 };

        if (window.userMarker) activeMap.removeLayer(window.userMarker);
        window.userMarker = L.marker([window.userLatLng.lat, window.userLatLng.lng])
            .addTo(activeMap)
            .bindPopup("<b>📍 Posisi Acuan Awal</b>")
            .openPopup();
    }

    if (typeof window.clearAllNavigation === 'function') {
        window.clearAllNavigation();
    }

    if (navMode === "road" && typeof L.Routing !== 'undefined') {
        try {
            window.routingControl = L.Routing.control({
                waypoints: [
                    L.latLng(window.userLatLng.lat, window.userLatLng.lng),
                    L.latLng(targetLat, targetLng)
                ],
                routeWhileDragging: false,
                addWaypoints: false,
                draggableWaypoints: false,
                fitSelectedRoutes: true,
                // Menggunakan createLine agar warna pink terang langsung diterapkan sempurna
                createLine: function(router, routes) {
                    return L.Routing.line(router, routes, {
                        styles: [{ color: '#ff1493', opacity: 0.9, weight: 6 }] // Pink Terang
                    });
                },
                createMarker: function () { return null; }
            }).addTo(activeMap);
        } catch (err) {
            drawDirectLine(window.userLatLng, targetLat, targetLng, pointName);
        }
    } else {
        drawDirectLine(window.userLatLng, targetLat, targetLng, pointName);
    }
};

function drawDirectLine(startLatLng, targetLat, targetLng, pointName) {
    const activeMap = getActiveMap();
    if (!activeMap) return;

    const startPoint = L.latLng(startLatLng.lat, startLatLng.lng);
    const targetPoint = L.latLng(targetLat, targetLng);

    const distanceMeter = startPoint.distanceTo(targetPoint);
    const distanceText = distanceMeter >= 1000
        ? (distanceMeter / 1000).toFixed(3) + " km"
        : Math.round(distanceMeter) + " m";

    if (window.navigationLine) {
        activeMap.removeLayer(window.navigationLine);
    }

    window.navigationLine = L.polyline([startPoint, targetPoint], {
        color: '#ff00ff',
        weight: 4,
        opacity: 0.9,
        dashArray: '8, 8'
    }).addTo(activeMap);

    window.navigationLine.bringToFront();

    window.navigationLine.bindPopup(`
        <div style="font-size:11px; font-family:sans-serif;">
          <b>🧭 Garis Lurus Ke Target</b><br>
          <b>ID Poin:</b> ${pointName}<br>
          <b>Jarak Direct:</b> <span style="color:#ff00ff; font-weight:bold;">${distanceText}</span>
        </div>
    `).openPopup();

    const resBox = document.getElementById("navResultBox");
    const resText = document.getElementById("navResultText");
    if (resBox && resText) {
        resBox.style.display = "block";
        resText.innerHTML = `<b>Target:</b> ${pointName} | <b>Jarak:</b> ${distanceText}`;
    }

    activeMap.fitBounds(window.navigationLine.getBounds(), { padding: [80, 80] });
}
   // Inisialisasi DOM & Binding Event Panel Navigasi
   document.addEventListener("DOMContentLoaded", function () {
       console.log("JavaScript main.js (Safe Nav Version) berhasil dimuat!");
       window.loadHseData();
   
       const btnClose = document.getElementById("btn-close-nav-panel");
       const navPanel = document.getElementById("navMenuPanel");
       const btnStartNav = document.getElementById("btn-start-nav");
   
       if (btnClose && navPanel) {
           btnClose.onclick = () => navPanel.style.display = "none";
       }
   
       // Tangani tombol Mulai Navigasi ke Stasiun/Objek dari gabung_leaflet.geojson
       if (btnStartNav) {
           btnStartNav.addEventListener("click", () => {
               const targetQuery = prompt("Masukkan Kode Tujuan Navigasi (Contoh: FieldCamp JMS, 1101860vib):");
               if (!targetQuery) return;
   
               // Pastikan data master gabungan sudah siap di memori
               if (!window._masterGabungData || !window._masterGabungData.features) {
                   alert("⚠️ Data peta sedang dimuat, mohon tunggu sebentar lalu coba lagi.");
                   return;
               }
   
               let destLatLng = null;
               let destName = targetQuery;
               const geojson = window._masterGabungData;
               
               // Bersihkan query dari spasi, titik, dan simbol (hanya ambil huruf & angka)
               const cleanQuery = targetQuery.toLowerCase().replace(/[^a-z0-9]/g, "");
   
               if (!cleanQuery) {
                   alert("⚠️ Masukkan kata kunci yang valid!");
                   return;
               }
   
               // Cari di data master gabung_leaflet.geojson secara super fleksibel
               for (let f of geojson.features) {
                   const p = f.properties || {};
                   
                   const rawKode = String(p.kode || p.KODE || "");
                   const rawKet  = String(p.Keterangan || p.KETERANGAN || "");
                   
                   const cleanKode = rawKode.toLowerCase().replace(/[^a-z0-9]/g, "");
                   const cleanKet  = rawKet.toLowerCase().replace(/[^a-z0-9]/g, "");
   
                   if (cleanKode.includes(cleanQuery) || cleanKet.includes(cleanQuery)) {
                       if (f.geometry && f.geometry.coordinates) {
                           const coords = f.geometry.coordinates;
                           destLatLng = L.latLng(coords[1], coords[0]);
                           destName = rawKode || rawKet || targetQuery;
                           break;
                       }
                   }
               }
   
               if (destLatLng) {
                   proceedNavigation(destLatLng, destName);
               } else {
                   alert(`⚠️ Kode atau objek "${targetQuery}" tidak ditemukan di master file!`);
               }
           });
       }
   });

   // ==========================================================================
// 4. FUNGSI EXPORT DATA PRODUKSI DENGAN PASSWORD PROTEKSI
// ==========================================================================
window.exportDataProduksi = async function() {
    // 1. Minta password dari pengguna
    const password = prompt("🔒 Masukkan Password Keamanan untuk Export Data Produksi:");
    
    // Jika dibatalkan atau dikosongkan
    if (password === null) return;

    // Tentukan password rahasia Anda di sini (silakan diganti sesuai keinginan)
    const PASSWORD_RAHASIA = "lamturo9721"; 

    if (password !== PASSWORD_RAHASIA) {
        alert("❌ Password salah! Akses export ditolak.");
        return;
    }

    alert("✅ Password benar! Mengambil data produksi dari database...");

    try {
        // 2. Ambil data spesifik: Tanggal, Kru, Line, dari TR sampai TR dari Supabase
        const { data, error } = await supabaseClient
            .from('nama_tabel_produksi') // Sesuaikan dengan nama tabel produksi di Supabase Bapak
            .select('tanggal, kru, line, tr_awal, tr_akhir')
            .order('tanggal', { ascending: false });

        if (error) throw error;

        if (!data || data.length === 0) {
            alert("⚠️ Tidak ada data produksi yang ditemukan di database.");
            return;
        }

        // 3. Ubah data menjadi format CSV untuk didownload otomatis ke HP/Komputer
        let csvContent = "data:text/csv;charset=utf-8,Tanggal,Kru,Line,TR Awal,TR Akhir\n";
        
        data.forEach(row => {
            csvContent += `"${row.tanggal}","${row.kru}","${row.line}","${row.tr_awal}","${row.tr_akhir}"\n`;
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Laporan_Produksi_${new Date().toISOString().slice(0,10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        alert(`✅ Berhasil meng-export ${data.length} baris data produksi!`);

    } catch (err) {
        console.error("Gagal export data:", err);
        alert("⚠️ Terjadi kesalahan saat menarik data dari database.");
    }
};