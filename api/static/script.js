function ensureUniqueSession() {
    const urlParams = new URLSearchParams(window.location.search);
    if (!urlParams.has('session_id')) {
        const newSessionId = crypto.randomUUID();
        urlParams.set('session_id', newSessionId);
        window.location.search = urlParams.toString();
    }
}

ensureUniqueSession();

// Initialize Map
const map = L.map('map').setView([20.5937, 78.9629], 5);
L.tileLayer('http://mt0.google.com/vt/lyrs=y&hl=en&x={x}&y={y}&z={z}&s=Ga').addTo(map);


const drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);

const drawControl = new L.Control.Draw({
    edit: { featureGroup: drawnItems },
    draw: { polyline: false, marker: false, rectangle: false, circle: false, circlemarker: false }
});
map.addControl(drawControl);

let points = [];
fetch('/get_points')
    .then(response => response.json())
    .then(data => {
        points = data;
        points.forEach(point => {
            L.circleMarker(point.coordinates, {
                radius: 6,
                color: point.color,
            })
                .bindPopup(`<b>${point.name}</b>`)
                .addTo(map);
        });

        // Zoom to the bounding box of the points
        if (points.length > 0) {
            const latitudes = points.map(p => p.coordinates[0]);
            const longitudes = points.map(p => p.coordinates[1]);
            const bounds = [
                [Math.min(...latitudes), Math.min(...longitudes)],
                [Math.max(...latitudes), Math.max(...longitudes)]
            ];
            map.fitBounds(bounds);
        }
    });

// Handle drawing new polygons
let selectedPolygon = null;
map.on(L.Draw.Event.CREATED, function (event) {
    const layer = event.layer;
    drawnItems.addLayer(layer);

    // Right-click to edit polygon
    layer.on('contextmenu', function (e) {
        selectedPolygon = layer;
        const coords = e.latlng;

        const menu = document.getElementById('context-menu');
        menu.style.top = `${e.originalEvent.clientY}px`;  // Position the menu based on mouse position
        menu.style.left = `${e.originalEvent.clientX}px`;
        menu.style.display = 'block';

        document.getElementById('edit-name').onclick = function () {
            const newName = prompt("Enter new name for the polygon:");
            if (newName) {
                layer.options.name = newName;

                // Update all points inside this polygon
                const polygonCoordinates = layer.getLatLngs()[0];
                const pointsInside = points.filter(point => isPointInPolygon(point.coordinates, polygonCoordinates));

                pointsInside.forEach(point => {
                    point.name = newName;
                    point.color = layer.options.color || 'blue'; // Change color if needed
                });

                // Update backend
                fetch('/update_points', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ points: pointsInside })
                });

                // Update the map
                pointsInside.forEach(point => {
                    L.circleMarker(point.coordinates, {
                        radius: 6,
                        color: point.color,
                    })
                        .bindPopup(`<b>${point.name}</b>`)
                        .addTo(map);
                });
            }
            menu.style.display = 'none'; // Close menu
        };

        document.getElementById('edit-color').onclick = function () {
            const newColor = prompt("Enter new color for the polygon:");
            if (newColor) {
                layer.setStyle({ color: newColor });

                // Update all points inside this polygon
                const polygonCoordinates = layer.getLatLngs()[0];
                const pointsInside = points.filter(point => isPointInPolygon(point.coordinates, polygonCoordinates));

                pointsInside.forEach(point => {
                    point.color = newColor;
                });

                // Update backend
                fetch('/update_points', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ points: pointsInside })
                });

                // Update the map
                pointsInside.forEach(point => {
                    L.circleMarker(point.coordinates, {
                        radius: 6,
                        color: point.color,
                    })
                        .bindPopup(`<b>${point.name}</b>`)
                        .addTo(map);
                });
            }
            menu.style.display = 'none'; // Close menu
        };
    });

    // Count the number of points inside the polygon
    const polygonCoordinates = layer.getLatLngs()[0];
    const pointsInside = points.filter(point => isPointInPolygon(point.coordinates, polygonCoordinates));
    document.getElementById('count').textContent = pointsInside.length;
});

// Check if a point is inside a polygon
function isPointInPolygon(point, polygon) {
    let x = point[1], y = point[0];
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        let xi = polygon[i].lng, yi = polygon[i].lat;
        let xj = polygon[j].lng, yj = polygon[j].lat;
        let intersect = ((yi > y) != (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

// Hide the context menu when clicking anywhere else
map.on('click', function () {
    const menu = document.getElementById('context-menu');
    menu.style.display = 'none';
});




// Export CSV
document.getElementById('export').addEventListener('click', () => {
    window.location.href = '/export_csv';
});

        // Handle CSV file upload
        document.getElementById('csv-upload').addEventListener('change', (event) => {
            const file = event.target.files[0];
            const formData = new FormData();
            formData.append('file', file);
        
            fetch('/upload_csv', {
                method: 'POST',
                body: formData,
            })
            .then(response => response.json())
            .then(data => {
                if (data.status === "success") {
                    alert("CSV file uploaded and processed!");
        
                    // Clear existing points from the map before adding new ones
                    drawnItems.clearLayers();
        
                    // Add the points from the CSV to the map
                    points = data.points;
                    points.forEach(point => {
                        L.circleMarker(point.coordinates, {
                            radius: 6,
                            color: point.color || 'blue',
                        })
                        .bindPopup(`<b>${point.name}</b>`)
                        .addTo(map);
                    });
        
                    // Zoom to the bounding box of the newly added coordinates
                    if (points.length > 0) {
                        const latitudes = points.map(p => p.coordinates[0]);
                        const longitudes = points.map(p => p.coordinates[1]);
                        const bounds = [
                            [Math.min(...latitudes), Math.min(...longitudes)],
                            [Math.max(...latitudes), Math.max(...longitudes)]
                        ];
                        map.fitBounds(bounds);
                    }
                } else {
                    alert("Failed to upload CSV. Please try again.");
                }
            })
            .catch(error => {
                alert("An error occurred during file upload. Please try again.");
            });
        });