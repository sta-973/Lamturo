/* ==========================================================================
   WEBGIS SEISMIK - MAIN JAVASCRIPT (FIXED & INTEGRATED)
   ========================================================================== */

// DEKLARASI VARIABEL GLOBAL
let allFeaturesData = []; 
let userLatLng = null;          
let routingControl = null;      
let navigationLine = null;      
let userMarker = null;  

document.addEventListener("DOMContentLoaded", function () {
    console.log("JavaScript main.js berhasil dimuat!");

    const searchInput = document.getElementById("searchBox");
    const selectBlock = document.getElementById("mainSelectBlock");
    const btnCurrent = document.getElementById("btn-current");

    // ----------------------------------------------------------------------
    // 1. INISIALISASI PETA LEAFLET & BASEMAPS
    // ----------------------------------------------------------------------
    const mapElement = document.getElementById("map");
    if (!mapElement) {
        console.error("Elemen <div id='map'> tidak ditemukan di HTML!");
        return;
    }

    if (typeof map === "undefined" || !map) {
        window.map = L.map("map", {
            center: [-2.5, 117.0], 
            zoom: 5,
            zoomControl: false 
        });
    }

    L.control.zoom({ position: "bottomright" }).addTo(map);

    const googleHybrid = L.tileLayer("https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}", {
        maxZoom: 20,
        subdomains: ["mt0", "mt1", "mt2", "mt3"],
        attribution: "&copy; Google Maps"
    });

    const osmMap = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors"
    });

    googleHybrid.addTo(map);

    const baseMaps = {
        "Google Satellite + Label": googleHybrid,
        "Peta Jalan (OSM)": osmMap
    };

    // OVERLAY LAYERS
    const layerSource = L.layerGroup().addTo(map);
    const layerReceiver = L.layerGroup().addTo(map);
    const layerLabelPoin = L.layerGroup().addTo(map);
    const layerAksesJalan = L.layerGroup().addTo(map);
    const layerBMGPS = L.layerGroup().addTo(map);
    const layerLabelLintasan = L.layerGroup().addTo(map);
    const layerKeterangan = L.layerGroup().addTo(map);
    const layerCampSeismik = L.layerGroup().addTo(map);
    const layerHazardMap = L.layerGroup().addTo(map);

    const overlayMaps = {
        "Source (S)": layerSource,
        "Receiver (R)": layerReceiver,
        "Label Poin": layerLabelPoin,
        "Akses Jalan": layerAksesJalan,
        "BM GPS": layerBMGPS,
        "Label Lintasan": layerLabelLintasan,
        "Keterangan": layerKeterangan,
        "Camp Seismik": layerCampSeismik,
        "⚠️ Hazard Map": layerHazardMap
    };

    L.control.layers(baseMaps, overlayMaps, { position: "topright" }).addTo(map);

    // ----------------------------------------------------------------------
    // 2. LOGIKA GPS / LOKASI PENGGUNA (btn-current)
    // ----------------------------------------------------------------------
    if (btnCurrent) {
        btnCurrent.onclick = () => {
            if (!navigator.geolocation) {
                return alert("Geolocation tidak didukung oleh browser Anda.");
            }

            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const { latitude, longitude } = pos.coords;
                    
                    // Update variabel global lokasi pengguna
                    userLatLng = { lat: latitude, lng: longitude };

                    // Render / update marker lokasi pengguna
                    if (!userMarker) {
                        userMarker = L.marker([latitude, longitude], {
                            icon: L.icon({
                                iconUrl: "https://cdn-icons-png.flaticon.com/512/684/684908.png",
                                iconSize: [32, 32],
                                iconAnchor: [16, 32]
                            })
                        }).addTo(map).bindPopup("<b>📍 Posisi Anda Saat Ini</b>").openPopup();
                    } else {
                        userMarker.setLatLng([latitude, longitude]);
                    }

                    map.flyTo([latitude, longitude], 16);
                    console.log("GPS Terdeteksi:", userLatLng);
                },
                (err) => {
                    alert("Gagal mengambil GPS: " + err.message + "\nPastikan izin lokasi diaktifkan.");
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
            );
        };
    }

    // ----------------------------------------------------------------------
    // 3. PEMBACAAN DATA SURVEI DARI BACKEND FLASK (/api/get-picks)
    // ----------------------------------------------------------------------
    function loadSurveyPicks() {
        fetch("/api/get-picks")
            .then(response => response.json())
            .then(data => {
                if (data && data.features) {
                    allFeaturesData = data.features;
                    renderMapFeatures(allFeaturesData);
                }
            })
            .catch(err => console.error("Gagal memuat data survey picks:", err));
    }

    function renderMapFeatures(features, filterQuery = "") {
        layerSource.clearLayers();
        layerReceiver.clearLayers();

        const selectedBlock = selectBlock?.value || "ALL";
        const bounds = L.latLngBounds();
        let hasValidPoints = false;

        features.forEach(feature => {
            const props = feature.properties || {};
            const coords = feature.geometry?.coordinates; 

            if (!coords || coords.length < 2) return;

            const pointName = (props.Point_Name || props.ID || props.id || props.name || "Poin").toString();
            const blockName = props.Block || "East_Block";
            const pointType = props.Type || props.Point_Type || "S"; 
            const lat = coords[1];
            const lng = coords[0];

            if (selectedBlock !== "ALL" && blockName !== selectedBlock) return;
            if (filterQuery !== "" && !pointName.toLowerCase().includes(filterQuery)) return;

            const marker = L.circleMarker([lat, lng], {
                radius: 7,
                fillColor: pointType === "S" ? "#e74c3c" : getBlockColor(blockName),
                color: "#ffffff",
                weight: 1.5,
                opacity: 1,
                fillOpacity: 0.85
            });

            // Popup Poin Stasiun Seismik
            const popupContent = `
                <div style="font-family: Arial, sans-serif; font-size: 12px; line-height: 1.5;">
                    <b style="color: #007bff; font-size: 13px;">📍 ID: ${pointName}</b> (${props.Desc_ || pointType})<br>
                    <hr style="margin: 4px 0; border: 0; border-top: 1px solid #ccc;">
                    <b>Blok:</b> ${blockName}<br>
                    <b>Easting:</b> ${props.Easting_UTM49S || '-'}<br>
                    <b>Northing:</b> ${props.Northing_UTM49S || '-'}<br>
                    <b>Elevasi:</b> ${props.Elevation || 0} m<br>
                    <b>Lat/Lng:</b> ${lat.toFixed(6)}, ${lng.toFixed(6)}<br>
                    <div style="margin-top:6px; text-align:center;">
                        <button onclick="window.drawNavigationLine(${lat}, ${lng}, '${pointName}')" 
                                style="background:#e67e22; color:white; border:none; padding:6px 10px; border-radius:4px; font-size:11px; cursor:pointer; font-weight:bold; width:100%;">
                          🧭 Tampilkan Garis Navigasi
                        </button>
                    </div>
                </div>
            `;
            
            marker.bindPopup(popupContent);
            marker.pointName = pointName; 
            
            if (pointType === "R") {
                layerReceiver.addLayer(marker);
            } else {
                layerSource.addLayer(marker);
            }

            bounds.extend([lat, lng]);
            hasValidPoints = true;
        });

        if (hasValidPoints && (selectedBlock !== "ALL" || filterQuery !== "")) {
            map.fitBounds(bounds, { padding: [50, 50], maxZoom: 17 });
        }
    }

    function getBlockColor(block) {
        switch (block) {
            case "East_Block": return "#e74c3c";    
            case "Central_Block": return "#3498db"; 
            case "West_Block": return "#2ecc71";    
            default: return "#f39c12";              
        }
    }

    loadSurveyPicks();

    // ----------------------------------------------------------------------
    // 4. FUNGSI GARIS NAVIGASI DIRECT-LINE (GLOBAL ACCESSIBLE)
    // ----------------------------------------------------------------------
    window.drawNavigationLine = function(targetLat, targetLng, pointName) {
        // Jika GPS real belum aktif, buat titik simulasi sementara
        if (!userLatLng) {
            userLatLng = { lat: targetLat - 0.005, lng: targetLng - 0.005 };
            
            if (userMarker) map.removeLayer(userMarker);
            userMarker = L.marker([userLatLng.lat, userLatLng.lng])
                .addTo(map)
                .bindPopup("<b>📍 Posisi Acuan Awal (Simulasi)</b>")
                .openPopup();
        }

        // Hapus routing control lama jika ada
        if (routingControl) {
            try { map.removeControl(routingControl); } catch(e){}
            routingControl = null;
        }

        drawDirectLine(userLatLng, targetLat, targetLng, pointName);

        // Fallback Leaflet Routing Machine (opsional jika library dimuat)
        if (typeof L.Routing !== 'undefined') {
            try {
                routingControl = L.Routing.control({
                    waypoints: [
                        L.latLng(userLatLng.lat, userLatLng.lng),
                        L.latLng(targetLat, targetLng)
                    ],
                    routeWhileDragging: false,
                    addWaypoints: false,
                    draggableWaypoints: false,
                    fitSelectedRoutes: true,
                    lineOptions: {
                        styles: [{ color: '#e67e22', opacity: 0.9, weight: 6 }]
                    },
                    createMarker: function() { return null; }
                }).addTo(map);
            } catch (err) {
                console.warn("L.Routing error, menggunakan garis lurus direct.", err);
            }
        }
    };

    function drawDirectLine(startLatLng, targetLat, targetLng, pointName) {
        if (navigationLine) {
            try { map.removeLayer(navigationLine); } catch(e){}
        }

        const startPoint = L.latLng(startLatLng.lat, startLatLng.lng);
        const targetPoint = L.latLng(targetLat, targetLng);

        // Hitung Jarak Geodesik
        const distanceMeter = startPoint.distanceTo(targetPoint);
        const distanceText = distanceMeter >= 1000 
            ? (distanceMeter / 1000).toFixed(3) + " km" 
            : Math.round(distanceMeter) + " m";

        // Garis Oranye Putus-Putus
        navigationLine = L.polyline([startPoint, targetPoint], {
            color: '#ff6b00',
            weight: 4,
            opacity: 0.9,
            dashArray: '8, 8'
        }).addTo(map);

        navigationLine.bringToFront();

        // Popup Jarak
        navigationLine.bindPopup(`
            <div style="font-size:11px; font-family:sans-serif;">
              <b>🧭 Garis Lurus Ke Target</b><br>
              <b>ID Titik:</b> ${pointName}<br>
              <b>Jarak Direct:</b> <span style="color:#ff6b00; font-weight:bold;">${distanceText}</span>
            </div>
        `).openPopup();

        map.fitBounds(navigationLine.getBounds(), { padding: [80, 80] });
    }

    // ----------------------------------------------------------------------
    // 5. FITUR PENCARIAN & FILTER BLOK
    // ----------------------------------------------------------------------
    if (searchInput) {
        searchInput.addEventListener("input", function () {
            const query = this.value.trim().toLowerCase();
            renderMapFeatures(allFeaturesData, query);

            if (query !== "") {
                let foundMarker = false;

                [layerSource, layerReceiver].forEach(layerGroup => {
                    layerGroup.eachLayer(layer => {
                        if (!foundMarker && layer.pointName && layer.pointName.toLowerCase() === query) {
                            foundMarker = true;
                            const targetLatLng = layer.getLatLng();
                            
                            map.flyTo(targetLatLng, 17, { duration: 1 });
                            
                            setTimeout(() => {
                                layer.openPopup();
                                window.drawNavigationLine(targetLatLng.lat, targetLatLng.lng, layer.pointName);
                            }, 600);
                        }
                    });
                });
            } else {
                if (routingControl) {
                    try { map.removeControl(routingControl); } catch(e){}
                    routingControl = null;
                }
                if (navigationLine) {
                    try { map.removeLayer(navigationLine); } catch(e){}
                    navigationLine = null;
                }
            }
        });
    }

    if (selectBlock) {
        selectBlock.addEventListener("change", function () {
            const query = searchInput ? searchInput.value.trim().toLowerCase() : "";
            renderMapFeatures(allFeaturesData, query);
        });
    }
});