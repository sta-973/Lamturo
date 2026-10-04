/* ==========================================================================
   WEBGIS SEISMIK - MAIN JAVASCRIPT (NAVIGASI LENGKAP & SAFE)
   ========================================================================== */

   const HSE_SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQZa0Yw0Jjcg0dVWp6yQIoqvb5OaxpMmsFH9c7hizyN9hBLLVO9VT9u_BrnJ3AQu9WsempAjxDZQ9JL/pub?gid=0&single=true&output=csv";

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
                   lineOptions: {
                       styles: [{ color: '#e67e22', opacity: 0.9, weight: 6 }]
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
           color: '#ff6b00',
           weight: 4,
           opacity: 0.9,
           dashArray: '8, 8'
       }).addTo(activeMap);
   
       window.navigationLine.bringToFront();
   
       window.navigationLine.bindPopup(`
           <div style="font-size:11px; font-family:sans-serif;">
             <b>🧭 Garis Lurus Ke Target</b><br>
             <b>ID Poin:</b> ${pointName}<br>
             <b>Jarak Direct:</b> <span style="color:#ff6b00; font-weight:bold;">${distanceText}</span>
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
   
       if (btnClose && navPanel) {
           btnClose.onclick = () => navPanel.style.display = "none";
       }
   });