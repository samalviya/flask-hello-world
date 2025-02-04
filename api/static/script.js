function ensureUniqueSession() {
    const urlParams = new URLSearchParams(window.location.search);
    if (!urlParams.has('session_id')) {
        const newSessionId = crypto.randomUUID();
        urlParams.set('session_id', newSessionId);
        window.location.search = urlParams.toString();
    }
}

ensureUniqueSession();

// Store assigned colors to prevent duplicates
let usedColors = new Set();

// Function to generate a unique random color
function getUniqueRandomColor() {
    let color;
    do {
        color = `#${Math.floor(Math.random() * 16777215).toString(16)}`; // Generate random HEX color
    } while (usedColors.has(color)); // Ensure uniqueness

    usedColors.add(color); // Store assigned color
    return color;
}

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

let selectedPolygon = null;
map.on(L.Draw.Event.CREATED, function (event) {
    const layer = event.layer;
    drawnItems.addLayer(layer);

    // Right-click to rename polygon (No extra menu, just a prompt)
    layer.on('contextmenu', function () {
        selectedPolygon = layer;
        const newName = prompt("Enter new name for the polygon:");

        if (newName) {
            const newColor = getUniqueRandomColor(); // Assign a unique random color
            layer.setStyle({ color: newColor });

            const polygonCoordinates = layer.getLatLngs()[0];
            const pointsInside = points.filter(point => isPointInPolygon(point.coordinates, polygonCoordinates));

            pointsInside.forEach(point => {
                point.name = newName;
                point.color = newColor;
            });

            fetch('/update_points', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ points: pointsInside })
            });

            pointsInside.forEach(point => {
                L.circleMarker(point.coordinates, {
                    radius: 6,
                    color: point.color,
                })
                .bindPopup(`<b>${point.name}</b>`)
                .addTo(map);
            });
        }
    });

    const polygonCoordinates = layer.getLatLngs()[0];
    const pointsInside = points.filter(point => isPointInPolygon(point.coordinates, polygonCoordinates));
    document.getElementById('count').textContent = pointsInside.length;
});

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

// Export CSV
document.getElementById('export').addEventListener('click', () => {
    window.location.href = '/export_csv';
});

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
            drawnItems.clearLayers();

            points = data.points;
            points.forEach(point => {
                L.circleMarker(point.coordinates, {
                    radius: 6,
                    color: point.color || 'blue',
                })
                .bindPopup(`<b>${point.name}</b>`)
                .addTo(map);
            });

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

