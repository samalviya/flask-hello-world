from flask import Flask, render_template, request, jsonify, send_file, session
import csv
import io
import pandas as pd
import uuid
from datetime import timedelta
from flask_session import Session

app = Flask(__name__)
app.config['SESSION_TYPE'] = 'filesystem'  # Store session data on disk
app.config['SESSION_PERMANENT'] = True
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=1)
app.secret_key = 'your_secret_key'  # Change this to a secure key

Session(app)  # Initialize Flask-Session

# Store user data in memory (Per session)
user_data = {}

def get_user_points():
    """Retrieve user-specific points data."""
    session_id = session.get('session_id')
    if not session_id:
        return []
    return user_data.setdefault(session_id, [])

def read_csv(file):
    """Read CSV and store points per user session."""
    session_id = session.get('session_id')
    if not session_id:
        return

    df = pd.read_csv(file)
    points = []
    
    for _, row in df.iterrows():
        try:
            lat, lng = map(float, row["GPS Location"].split(","))
            points.append({
                "id": row["FormId"],
                "coordinates": [lat, lng],
                "name": f"Point {row['FormId']}",
                "color": "blue"
            })
        except Exception as e:
            print(f"Skipping row due to error: {e}")

    # Store data for this session
    user_data[session_id] = points

@app.route('/')
def home():
    return render_template('home.html')

@app.route('/map')
def index():
    """Home route - Assigns session ID."""
    if 'session_id' not in session:
        session['session_id'] = str(uuid.uuid4())  # Assign new session
    return render_template('index.html', session_id=session['session_id'])

@app.route('/get_points', methods=['GET'])
def get_points():
    """Return points data specific to the user session."""
    return jsonify(get_user_points())

@app.route('/update_points', methods=['POST'])
def update_points():
    """Update points data (rename or change color)."""
    session_id = session.get('session_id')
    if not session_id:
        return jsonify({"error": "Session not found"}), 400

    updated_points = request.json.get('points', [])
    points = get_user_points()

    for updated in updated_points:
        for point in points:
            if point['id'] == updated['id']:
                point['name'] = updated['name']
                point['color'] = updated['color']

    return jsonify({"status": "success"})

@app.route('/export_csv', methods=['GET'])
def export_csv():
    """Export user-specific points data to CSV."""
    session_id = session.get('session_id')
    if not session_id or session_id not in user_data:
        return jsonify({"error": "No data available"}), 400

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "Latitude", "Longitude", "Name", "Color"])

    for point in user_data[session_id]:
        writer.writerow([point["id"], point["coordinates"][0], point["coordinates"][1], point["name"], point["color"]])

    output.seek(0)
    return send_file(
        io.BytesIO(output.getvalue().encode()),
        mimetype="text/csv",
        as_attachment=True,
        download_name="updated_points.csv",
    )

@app.route('/upload_csv', methods=['POST'])
def upload_csv():
    """Upload CSV and store data per user session."""
    if 'file' not in request.files:
        return jsonify({"error": "No file part"})

    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"})

    try:
        read_csv(file)
        return jsonify({"status": "success", "points": get_user_points()})
    except Exception as e:
        return jsonify({"error": str(e)}), 400

if __name__ == '__main__':
    app.run(debug=True)
