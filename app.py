from flask import Flask, request, jsonify, render_template, redirect, url_for, session
import joblib
import pandas as pd
import os
import firebase_admin
from firebase_admin import credentials, auth
from firebase_auth import verify_password
from flask_sqlalchemy import SQLAlchemy
from db_config import db, login_manager, User
import pickle
from dotenv import load_dotenv
from functools import wraps

# Load environment variables
load_dotenv()


# Authentication decorator
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if "user" not in session:
            return jsonify({"error": "Unauthorized"}), 401
        return f(*args, **kwargs)

    return decorated_function


app = Flask(
    __name__,
    template_folder=os.path.join(os.path.dirname(__file__), "./templates"),
    static_folder=os.path.join(os.path.dirname(__file__), "./static"),
)

# Use environment variables for all configuration
app.secret_key = os.getenv("FLASK_SECRET_KEY")
app.config["SECRET_KEY"] = os.getenv("FLASK_SECRET_KEY")
app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv("DATABASE_URL")
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

# Initialize Firebase Admin SDK
cred = credentials.Certificate(
    os.path.join(os.path.dirname(__file__), os.getenv("FIREBASE_ADMIN_SDK_PATH"))
)
firebase_admin.initialize_app(cred)

# Initialize database
db.init_app(app)
login_manager.init_app(app)

# Load the model at startup
try:
    print("\n=== Loading Machine Learning Model ===")
    model_path = os.path.join(os.path.dirname(__file__), "model/house_price_model.pkl")
    model = joblib.load(model_path)
    print("Model loaded successfully")
    print("Model features:", model.feature_names_in_)

    # Verify model attributes
    if not hasattr(model, "feature_names_in_"):
        raise ValueError("Model is missing 'feature_names_in_' attribute")

    required_features = [
        "POSTED_BY",
        "UNDER_CONSTRUCTION",
        "RERA",
        "BHK_NO.",
        "BHK_OR_RK",
        "SQUARE_FT",
        "READY_TO_MOVE",
        "RESALE",
        "LONGITUDE",
        "LATITUDE",
    ]

    missing_features = [
        f for f in required_features if f not in model.feature_names_in_
    ]
    if missing_features:
        raise ValueError(f"Model is missing required features: {missing_features}")

    print("Model verification successful")
except Exception as e:
    print("Error loading model:", str(e))
    model = None


def create_tables():
    db.create_all()


@app.route("/", methods=["GET"])
def index():
    return redirect(url_for("login"))


@app.route("/signup", methods=["GET", "POST"])
def signup():
    if request.method == "POST":
        email = request.form["username"]
        password = request.form["password"]

        # Register user with Firebase
        try:
            user = auth.create_user(email=email, password=password)
            print("User created successfully:", user.uid)

            id_token = verify_password(email, password)
            if id_token:
                decoded_token = auth.verify_id_token(id_token)
                session["user"] = decoded_token["uid"]
                print(
                    "User logged in successfully after signup:", decoded_token["uid"]
                )  # Debugging step
                return redirect(url_for("home"))
            else:
                return render_template(
                    "signup.html", error="Failed to log in after signup"
                )
        except Exception as e:
            print("Error creating user:", str(e))
            return render_template("signup.html", error=str(e))

    return render_template("signup.html")


@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        id_token = request.form["idToken"]
        print("Received ID token:", id_token)

        # Verify the ID token with Firebase
        try:
            if not id_token:
                raise ValueError("ID token is empty")
            decoded_token = auth.verify_id_token(id_token)
            session["user"] = decoded_token["uid"]
            print("User logged in successfully:", decoded_token["uid"])
            return redirect(url_for("home"))
        except Exception as e:
            print("Error verifying ID token:", str(e))
            return render_template("login.html", error="Invalid credentials")

    return render_template("login.html")


@app.route("/logout")
def logout():
    session.pop("user", None)
    return redirect(url_for("login"))


@app.route("/home")
def home():
    if "user" in session:
        print("User session found:", session["user"])
        return render_template("web.html")
    else:
        print("No user session found")
        return redirect(url_for("login"))


@app.route("/predict-address", methods=["POST"])
@login_required
def predict_address():
    try:
        # Get the address from the request body
        data = request.get_json()
        input_address = data.get("address", "")

        # Read the CSV file with addresses, latitude, and longitude
        test_data = pd.read_csv(
            os.path.join(os.path.dirname(__file__), "model/test.csv")
        )

        # Check if the 'ADDRESS', 'LATITUDE', and 'LONGITUDE' columns exist in the DataFrame
        if (
            "ADDRESS" not in test_data.columns
            or "LATITUDE" not in test_data.columns
            or "LONGITUDE" not in test_data.columns
        ):
            return (
                jsonify(
                    {
                        "error": "'ADDRESS', 'LATITUDE', or 'LONGITUDE' column not found in CSV"
                    }
                ),
                400,
            )

        # Filter addresses that contain the input_address (case insensitive)
        related_addresses = test_data[
            test_data["ADDRESS"].str.contains(input_address, case=False, na=False)
        ]

        # Remove duplicates and select only relevant columns (address, latitude, longitude)
        related_addresses_unique = related_addresses.drop_duplicates(subset=["ADDRESS"])

        # Prepare the response list with address, latitude, and longitude
        result = []
        for _, row in related_addresses_unique.iterrows():
            result.append(
                {
                    "address": row["ADDRESS"],
                    "latitude": row["LATITUDE"],
                    "longitude": row["LONGITUDE"],
                }
            )

        if not result:
            return jsonify({"message": "No matching addresses found."}), 200

        # Return the result with unique addresses, latitude, and longitude
        return jsonify({"related_addresses": result}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 400


@app.route("/predict", methods=["POST"])
@login_required
def predict():
    if model is None:
        return jsonify({"error": "Model not loaded"}), 500

    try:
        # Get JSON data from request
        data = request.get_json()
        print("\n=== Prediction Request ===")
        print("Received data:", data)

        # Define field mappings (frontend to model format)
        field_mappings = {
            "under_construction": "UNDER_CONSTRUCTION",
            "rera_approved": "RERA",
            "resale": "RESALE",
            "ready_to_move": "READY_TO_MOVE",
        }

        # Validate required fields
        required_fields = [
            "BHK NO.",
            "SQUARE FT",
            "LONGITUDE",
            "LATITUDE",
            "POSTED_BY",
            "BHK_OR_RK",
            "under_construction",
            "rera_approved",
            "resale",
            "ready_to_move",
            "address",
        ]
        for field in required_fields:
            if field not in data:
                return jsonify({"error": f"Missing required field: {field}"}), 400

        # Prepare input dictionary
        input_dict = {
            "SQUARE_FT": data["SQUARE FT"],
            "BHK_NO.": data["BHK NO."],
            "LONGITUDE": data["LONGITUDE"],
            "LATITUDE": data["LATITUDE"],
            "POSTED_BY": int(data["POSTED_BY"]),
            "BHK_OR_RK": 1 if data["BHK_OR_RK"] == "BHK" else 0,
        }

        # Map the additional fields using the mappings
        for frontend_field, model_field in field_mappings.items():
            input_dict[model_field] = int(data[frontend_field])

        print("\n=== Model Input ===")
        print("Mapped input data:", input_dict)

        # Create DataFrame in the correct column order
        input_data = pd.DataFrame([input_dict])[model.feature_names_in_]
        print("Input DataFrame for prediction:", input_data)

        # Make prediction
        prediction = model.predict(input_data)[0]
        print("\n=== Prediction Result ===")
        print("Predicted price:", prediction)

        return jsonify({"predicted_price": float(prediction)})

    except Exception as e:
        print("\n=== Prediction Error ===")
        print("Error:", str(e))
        import traceback

        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/map")
def map_view():
    return render_template("map.html")


@app.route("/house-data", methods=["GET"])
@login_required
def house_data():
    try:
        # Read the CSV file with addresses, latitude, and longitude
        test_data = pd.read_csv(
            os.path.join(os.path.dirname(__file__), "model/test.csv")
        )

        # Check if the 'ADDRESS', 'LATITUDE', and 'LONGITUDE' columns exist in the DataFrame
        if (
            "ADDRESS" not in test_data.columns
            or "LATITUDE" not in test_data.columns
            or "LONGITUDE" not in test_data.columns
        ):
            return (
                jsonify(
                    {
                        "error": "'ADDRESS', 'LATITUDE', or 'LONGITUDE' column not found in CSV"
                    }
                ),
                400,
            )

        # Prepare the response list with address, latitude, and longitude
        result = []
        for _, row in test_data.iterrows():
            result.append(
                {
                    "address": row["ADDRESS"],
                    "latitude": row["LATITUDE"],
                    "longitude": row["LONGITUDE"],
                }
            )

        return jsonify({"houses": result}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 400


@app.route("/api/cities", methods=["GET"])
@login_required
def get_cities():
    """API endpoint to get list of cities with their average prices for the filter autocomplete"""
    try:
        # Read the CSV file with property data
        test_data = pd.read_csv(
            os.path.join(os.path.dirname(__file__), "model/test.csv")
        )

        # Extract cities from addresses
        test_data["CITY"] = test_data["ADDRESS"].str.split(",").str[-2].str.strip()

        # Group by city and calculate metrics
        city_metrics = (
            test_data.groupby("CITY")
            .agg(
                {
                    "ADDRESS": "count",  # Count of properties
                    "SQUARE_FT": "mean",  # Average square footage
                    "BHK_NO.": "mean",  # Average BHK
                }
            )
            .reset_index()
        )

        # Prepare the response
        cities = []
        for _, row in city_metrics.iterrows():
            if pd.notna(row["CITY"]):  # Only include if city is not NaN
                cities.append(
                    {
                        "name": row["CITY"],
                        "properties": int(row["ADDRESS"]),
                        "avgSqFt": (
                            round(float(row["SQUARE_FT"]), 2)
                            if pd.notna(row["SQUARE_FT"])
                            else None
                        ),
                        "avgBHK": (
                            round(float(row["BHK_NO."]), 1)
                            if pd.notna(row["BHK_NO."])
                            else None
                        ),
                        "popularity": int(
                            row["ADDRESS"]
                        ),  # Using property count as popularity score
                    }
                )

        # Sort cities by number of properties (popularity) in descending order
        cities.sort(key=lambda x: x["properties"], reverse=True)

        return jsonify({"cities": cities}), 200

    except Exception as e:
        print("Error getting cities:", str(e))
        return jsonify({"error": str(e)}), 400


@app.route("/env-config")
def env_config():
    return jsonify(
        {
            "FIREBASE_API_KEY": os.getenv("FIREBASE_API_KEY"),
            "FIREBASE_AUTH_DOMAIN": os.getenv("FIREBASE_AUTH_DOMAIN"),
            "FIREBASE_PROJECT_ID": os.getenv("FIREBASE_PROJECT_ID"),
            "FIREBASE_STORAGE_BUCKET": os.getenv("FIREBASE_STORAGE_BUCKET"),
            "FIREBASE_MESSAGING_SENDER_ID": os.getenv("FIREBASE_MESSAGING_SENDER_ID"),
            "FIREBASE_APP_ID": os.getenv("FIREBASE_APP_ID"),
        }
    )


if __name__ == "__main__":
    app.run(debug=True)
