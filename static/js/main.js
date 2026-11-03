/* ==========================================================================
   WEBGIS SEISMIK - MAIN JAVASCRIPT (NAVIGASI LENGKAP, CRUD & MEASURE CLEAN)
   ========================================================================== */

   const HSE_SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQZa0Yw0Jjcg0dVWp6yQIoqvb5OaxpMmsFH9c7hizyN9hBLLVO9VT9u_BrnJ3AQu9WsempAjxDZQ9JL/pub?gid=0&single=true&output=csv";

   // Variabel global master data
   window._masterGabungData = null;
   window._masterOffsetData = null;
   
   // Helper Referensi Peta Aktif
   function getActiveMap() {
       return window.currentMap || window.map || null;
   }
   
   // --------------------------------------------------------------------------
   // 0. PRELOAD MASTER DATA GEOJSON
   // --------------------------------------------------------------------------
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
           .catch(err => console.warn("Peringatan master file gabung:", err));
   })();
   
   // --------------------------------------------------------------------------
// 1. PEMUATAN & RENDER LAYER OFFSET & COMPEN (FIXED TOTAL LABEL)
// --------------------------------------------------------------------------
window.loadOffsetAndCompenLayer = function() {
    fetch('/static/Offset_kompen_leaflet.geojson')
        .then(res => {
            if (!res.ok) throw new Error("Gagal meload Offset_kompen_leaflet.geojson");
            return res.json();
        })
        .then(data => {
            window._masterOffsetData = data;
            const totalPoin = data.features ? data.features.length : 0;
            console.log(`Master file Offset_kompen_leaflet.geojson berhasil dimuat! Total: ${totalPoin} titik`);

            // Fungsi untuk mengganti teks dan memasang total secara presisi
            const updateLayerLabel = () => {
                const labels = document.querySelectorAll('.leaflet-control-layers-overlays label');
                labels.forEach(lbl => {
                    // Cari label yang di dalamnya ada teks Offset & Kompen atau Total Bor
                    if (lbl.textContent.includes('Offset & Kompen') || lbl.textContent.includes('Total Bor')) {
                        // Ambil elemen input checkbox yang ada di dalam label tersebut
                        const checkbox = lbl.querySelector('input[type="checkbox"]');
                        const isChecked = checkbox ? checkbox.checked : true;

                        // Kosongkan label dan susun ulang isinya dengan rapi
                        lbl.innerHTML = '';
                        
                        // Pasang kembali checkbox-nya
                        const newCheckbox = document.createElement('input');
                        newCheckbox.type = 'checkbox';
                        newCheckbox.className = 'leaflet-control-layers-selector';
                        newCheckbox.checked = isChecked;
                        
                        // Event untuk mengontrol layer peta saat dicentang/uncentang
                        newCheckbox.onchange = function() {
                            if (newCheckbox.checked) {
                                if (typeof offsetLayerGroup !== 'undefined' && offsetLayerGroup && activeMap) {
                                    offsetLayerGroup.addTo(activeMap);
                                }
                            } else {
                                if (typeof offsetLayerGroup !== 'undefined' && offsetLayerGroup && activeMap) {
                                    activeMap.removeLayer(offsetLayerGroup);
                                }
                            }
                        };

                        lbl.appendChild(newCheckbox);

                        // Buat teks dan angka totalnya
                        const spanTeks = document.createElement('span');
                        spanTeks.innerHTML = ` Total Bor <span style="color:#d32f2f; font-weight:bold;">(${totalPoin})</span>`;
                        lbl.appendChild(spanTeks);
                    }
                });
            };

            // Jalankan langsung dan beri interval singkat jika menu layer belum sempat dirender Leaflet
            updateLayerLabel();
            setTimeout(updateLayerLabel, 400);
            setTimeout(updateLayerLabel, 1000);

            const activeMap = getActiveMap();

            if (typeof offsetLayerGroup !== 'undefined' && offsetLayerGroup) {
                offsetLayerGroup.clearLayers();
            }

            if (activeMap && typeof L !== 'undefined') {
                if (typeof offsetLayerGroup !== 'undefined' && offsetLayerGroup) {
                    const geoJsonLayer = L.geoJSON(data, {
                        pointToLayer: function (feature, latlng) {
                            return L.circleMarker(latlng, {
                                radius: 4.5,
                                fillColor: "#ff0000",
                                color: "#ff0000",
                                weight: 0,
                                fillOpacity: 1.0
                            });
                        },
                        onEachFeature: function (feature, layer) {
                            const props = feature.properties || {};
                            const idTeoritik = props.id_teoritik || props.id_teoriti || props.FID || "-";
                            const offsetText = props.Offset || "Normal";
                            const jarakVal = props.Jarak_Offset || "0";
                            const compenVal = props.Compen || "0";

                            const infoJarak = (jarakVal !== "0" && jarakVal !== "") ? ` (${jarakVal} m)` : "";

                            layer.bindPopup(`
                                <div style="font-size:11px; font-family:sans-serif; line-height: 1.5;">
                                    <b>📍 Info Offset & Compen</b><br>
                                    <b>Id_teoritik :</b> <span style="color:#d32f2f; font-weight:bold;">${idTeoritik}</span><br>
                                    <b>Offset :</b> ${offsetText}${infoJarak}<br>
                                    <b>Kompen ke:</b> ${compenVal}
                                </div>
                            `);
                        }
                    });

                    offsetLayerGroup.addLayer(geoJsonLayer);
                }

                console.log(`Berhasil merender ${totalPoin} titik offset & compen ke layer utama.`);
            }
        })
        .catch(err => console.warn("Peringatan load offset layer:", err));
};
   
   // --------------------------------------------------------------------------
   // 2. LOGIKA HSE BOARD (GOOGLE SHEETS INTEGRATION)
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
   // 3. TOGGLE MODAL PANELS
   // --------------------------------------------------------------------------
   window.toggleHseBoard = function() {
       const hsePanel = document.getElementById("hse-board") || 
                        document.getElementById("hseBoardModal") || 
                        document.querySelector(".hse-board-modal");
   
       if (hsePanel) {
           const isHidden = window.getComputedStyle(hsePanel).display === "none";
           if (isHidden) {
               hsePanel.style.display = "block";
               if (typeof window.loadHseData === 'function') window.loadHseData();
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
   
   window.togglePanelPoin = function() {
       const panel = document.getElementById('panel-edit-data');
       if (panel) {
           const isHidden = panel.style.display === 'none' || panel.style.display === '';
           panel.style.display = isHidden ? 'block' : 'none';
       }
   };
   
   // --------------------------------------------------------------------------
   // 4. FUNGSI NAVIGASI & GARIS
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
                   createLine: function(router, routes) {
                       return L.Routing.line(router, routes, {
                           styles: [{ color: '#ff1493', opacity: 0.9, weight: 6 }]
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
   
   // --------------------------------------------------------------------------
   // 5. EXPORT DATA PRODUKSI DENGAN PASSWORD PROTEKSI
   // --------------------------------------------------------------------------
   window.exportDataProduksi = async function() {
       const password = prompt("🔒 Masukkan Password Keamanan untuk Export Data Produksi:");
       if (password === null) return;
   
       const PASSWORD_RAHASIA = "lamturo9721"; 
   
       if (password !== PASSWORD_RAHASIA) {
           alert("❌ Password salah! Akses export ditolak.");
           return;
       }
   
       alert("✅ Password benar! Mengambil data produksi dari database...");
       
       try {
           const { data, error } = await supabaseClient
               .from('nama_tabel_produksi')
               .select('tanggal, kru, line, tr_awal, tr_akhir')
               .order('tanggal', { ascending: false });
   
           if (error) throw error;
   
           if (!data || data.length === 0) {
               alert("⚠️ Tidak ada data produksi yang ditemukan di database.");
               return;
           }
   
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
   
   // --------------------------------------------------------------------------
   // 6. UPLOAD DATA OFFSET & COMPEN
   // --------------------------------------------------------------------------
   window.processOffsetUpload = async function() {
       const targetBlock = document.getElementById('offsetTargetBlock')?.value;
       const fileInput = document.getElementById('offsetCsvFile')?.files[0];
   
       if (!targetBlock) {
           alert("⚠️ Silakan pilih blok terlebih dahulu!");
           return;
       }
   
       if (!fileInput) {
           alert("⚠️ Silakan pilih file CSV offset terlebih dahulu!");
           return;
       }
   
       alert(`⏳ Memproses file CSV untuk ${targetBlock}...`);
       
       const reader = new FileReader();
       reader.readAsText(fileInput);
   
       reader.onload = async function(e) {
           try {
               const text = e.target.result;
               const lines = text.split(/\r\n|\n/);
               let features = [];
   
               for (let lineStr of lines) {
                   const cleanLine = lineStr.trim();
                   if (!cleanLine || cleanLine.startsWith("#") || cleanLine.toLowerCase().includes("id") || cleanLine.toLowerCase().includes("newx")) continue;
   
                   const parts = cleanLine.split(/,|\t|;/).map(item => item.replace(/^"|"$/g, '').trim());
                   if (parts.length < 4) continue; 
   
                   const rawId = parseFloat(parts[0]);
                   const newX = parseFloat(parts[1]);
                   const newY = parseFloat(parts[2]);
                   const newZ = parseFloat(parts[3]);
                   const newId = parts[4] ? parts[4] : parts[0];
                   const offsetVal = parts[5] || "Normal";
                   const jarakOffsetVal = parts[6] || "0";
                   const compenVal = parts[7] || "0";
   
                   if (isNaN(rawId) || isNaN(newX) || isNaN(newY)) continue;
   
                   features.push({
                       "type": "Feature",
                       "geometry": { "type": "Point", "coordinates": [newX, newY] },
                       "properties": {
                           "id_teoritik": rawId,
                           "new_id": String(newId),
                           "z": newZ,
                           "Offset": offsetVal,
                           "Jarak_Offset": jarakOffsetVal,
                           "Compen": compenVal,
                           "block": targetBlock
                       }
                   });
               }
   
               if (features.length === 0) {
                   alert("⚠️ Tidak ada data koordinat valid yang terbaca dari file CSV!");
                   return;
               }
   
               const geojsonObj = { "type": "FeatureCollection", "features": features };
   
               const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(geojsonObj, null, 2));
               const downloadAnchor = document.createElement('a');
               downloadAnchor.setAttribute("href", dataStr);
               downloadAnchor.setAttribute("download", `offset_leaflet_${targetBlock}.geojson`);
               document.body.appendChild(downloadAnchor);
               downloadAnchor.click();
               downloadAnchor.remove();
   
               alert(`✅ Berhasil! Memproses ${features.length} titik dan file GeoJSON telah diunduh otomatis.`);
               document.getElementById('offsetCsvFile').value = "";
   
               const activeMap = getActiveMap();
               if (typeof L !== 'undefined' && activeMap) {
                   L.geoJSON(geojsonObj, {
                       pointToLayer: function (feature, latlng) {
                           return L.circleMarker(latlng, {
                               radius: 4.5,
                               fillColor: "#ff0000",
                               color: "#ff0000",
                               weight: 0,
                               fillOpacity: 1.0
                           });
                       },
                       onEachFeature: function (feature, layer) {
                           const props = feature.properties || {};
                           const idTeoritik = props.id_teoritik || "-";
                           const offsetText = props.Offset || "Normal";
                           const jarakVal = props.Jarak_Offset || "0";
                           const compenVal = props.Compen || "0";
                           const infoJarak = (jarakVal !== "0" && jarakVal !== "") ? ` (${jarakVal} m)` : "";
   
                           layer.bindPopup(`
                               <div style="font-size:11px; font-family:sans-serif; line-height: 1.5;">
                                 <b>📍 Info Offset & Compen</b><br>
                                 <b>Id_teoritik :</b> <span style="color:#d32f2f; font-weight:bold;">${idTeoritik}</span><br>
                                 <b>Offset :</b> ${offsetText}${infoJarak}<br>
                                 <b>Kompen ke:</b> ${compenVal}
                               </div>
                           `);
                       }
                   }).addTo(activeMap);
               }
   
           } catch (err) {
               console.error("Error parsing CSV:", err);
               alert("⚠️ Terjadi kesalahan saat memproses file CSV.");
           }
       };
   };
   
   // --------------------------------------------------------------------------
   // 7. KELOLA DATA POIN SUPABASE
   // --------------------------------------------------------------------------
   window.simpanPoinData = async function() {
       const tanggal = document.getElementById('input-tanggal')?.value;
       const line = document.getElementById('input-line')?.value;
       const tr = document.getElementById('input-tr')?.value;
       const statusInput = document.getElementById('input-status')?.value;
   
       if (!line || !tr) {
           alert('⚠️ Mohon lengkapi Nomor Line dan Nomor TR!');
           return;
       }
   
       const updatePayload = { 'drilling': statusInput };
       if (tanggal) updatePayload['tanggal'] = tanggal;
   
       const { error } = await supabaseClient
           .from('progress_seismik')
           .update(updatePayload)
           .match({ line: String(line), tr: Number(tr) });
           
       if (error) {
           alert('❌ Gagal memperbarui: ' + error.message);
       } else {
           alert(`✅ Progress Line ${line} TR ${tr} berhasil diperbarui!`);
           if (typeof muatDataPeta === 'function') muatDataPeta();
           if (typeof fetchCloudProgress === 'function') await fetchCloudProgress();
       }
   };
   
   window.jalankanHapusPoin = async function() {
       const lineTarget = document.getElementById('input-line')?.value;
       const trTarget = document.getElementById('input-tr')?.value;
   
       if (!lineTarget || !trTarget) {
           alert('⚠️ Mohon isi nomor Line dan Nomor TR yang ingin dihapus!');
           return;
       }
   
       if (!confirm(`Yakin ingin menghapus data Line ${lineTarget} TR ${trTarget} dari database?`)) return;
   
       const { error } = await supabaseClient
           .from('progress_seismik')
           .delete()
           .match({ line: String(lineTarget), tr: Number(trTarget) });
   
       if (error) {
           alert('❌ Gagal menghapus: ' + error.message);
       } else {
           alert('✅ Poin berhasil dihapus dari database!');
           if (typeof muatDataPeta === 'function') muatDataPeta();
       }
   };
   
   // --------------------------------------------------------------------------
// 8. FITUR UKUR JARAK (FIX: ANTI-TEMBUS KLIK PANEL)
// --------------------------------------------------------------------------
let measureActive = false;
let measurePoints = [];
let measureLayerGroup = null;

window.mulaiUkurJarak = function(event) {
    // Mencegah klik tombol merembes ke peta di bawahnya
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }

    const activeMap = getActiveMap();
    if (!activeMap) return;

    if (!measureLayerGroup) {
        measureLayerGroup = L.layerGroup().addTo(activeMap);
    }

    measureActive = !measureActive;
    const btn = document.querySelector("button[onclick*='mulaiUkurJarak']");

    if (measureActive) {
        if (btn) {
            btn.style.backgroundColor = "#e65100";
            btn.innerHTML = "🛑 Hentikan Ukur";
        }
        
        measurePoints = [];
        measureLayerGroup.clearLayers();
        
        // Hapus dulu event lama agar bersih
        activeMap.off('click', onMapClickMeasure);
        
        // Beri jeda 100 milidetik agar klik mouse di tombol benar-benar selesai dulu
        setTimeout(() => {
            if (measureActive) {
                activeMap.on('click', onMapClickMeasure);
            }
        }, 100);

    } else {
        if (btn) {
            btn.style.backgroundColor = "#ff9800";
            btn.innerHTML = "📏 Ukur Jarak";
        }
        
        activeMap.off('click', onMapClickMeasure);
        measureLayerGroup.clearLayers();
        measurePoints = [];
    }
};

function onMapClickMeasure(e) {
    if (!measureActive) return;

    if (e.originalEvent) {
        e.originalEvent.stopPropagation();
    }
    
    measurePoints.push(e.latlng);
    measureLayerGroup.clearLayers();
    
    // Render titik-titik lingkaran hijau di setiap lokasi klik
    measurePoints.forEach((latlng) => {
        L.circleMarker(latlng, { 
            radius: 5, 
            color: '#00e676', 
            fillColor: '#00e676', 
            fillOpacity: 1 
        }).addTo(measureLayerGroup);
    });

    // Garis dan jarak HANYA muncul jika titik sudah 2 atau lebih
    if (measurePoints.length > 1) {
        const polyline = L.polyline(measurePoints, { 
            color: '#ff9800', 
            weight: 4, 
            dashArray: '5, 5' 
        }).addTo(measureLayerGroup);
        
        let totalDistance = 0;
        for (let i = 0; i < measurePoints.length - 1; i++) {
            totalDistance += measurePoints[i].distanceTo(measurePoints[i+1]);
        }
        
        let jarakStr = totalDistance >= 1000 ? 
            (totalDistance / 1000).toFixed(3) + " km" : 
            totalDistance.toFixed(1) + " meter";
        
        polyline.bindPopup(`<b>📏 Total Jarak:</b> <span style="color:#d32f2f; font-weight:bold; font-size:13px;">${jarakStr}</span>`).openPopup();
    }
}
   
   // --------------------------------------------------------------------------
   // 9. INISIALISASI DOM & EVENT LISTENERS
   // --------------------------------------------------------------------------
   document.addEventListener("DOMContentLoaded", function () {
       console.log("JavaScript main.js (Safe Nav & Cleaned Version) berhasil dimuat!");
       
       // Muat data HSE dan Layer Offset saat pertama kali buka
       window.loadHseData();
       window.loadOffsetAndCompenLayer();
   
       const btnClose = document.getElementById("btn-close-nav-panel");
       const navPanel = document.getElementById("navMenuPanel");
       const btnStartNav = document.getElementById("btn-start-nav");
   
       if (btnClose && navPanel) {
           btnClose.onclick = () => navPanel.style.display = "none";
       }
   
       if (btnStartNav) {
           btnStartNav.addEventListener("click", () => {
               const targetQuery = prompt("Masukkan Kode Tujuan Navigasi (Contoh: FieldCamp JMS, 1101860vib):");
               if (!targetQuery) return;
   
               if (!window._masterGabungData || !window._masterGabungData.features) {
                   alert("⚠️ Data peta sedang dimuat, mohon tunggu sebentar lalu coba lagi.");
                   return;
               }
   
               let destLatLng = null;
               let destName = targetQuery;
               const geojson = window._masterGabungData;
               const cleanQuery = targetQuery.toLowerCase().replace(/[^a-z0-9]/g, "");
   
               if (!cleanQuery) {
                   alert("⚠️ Masukkan kata kunci yang valid!");
                   return;
               }
   
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
                   window.drawNavigationLine(destLatLng.lat, destLatLng.lng, destName);
               } else {
                   alert(`⚠️ Kode atau objek "${targetQuery}" tidak ditemukan di master file!`);
               }
           });
       }
   });