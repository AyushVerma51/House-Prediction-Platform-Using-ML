import requests
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()


def verify_password(email, password):
    api_key = os.getenv("FIREBASE_API_KEY")
    url = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={api_key}"
    payload = {"email": email, "password": password, "returnSecureToken": True}
    response = requests.post(url, json=payload)
    if response.status_code == 200:
        return response.json()["idToken"]
    else:
        print("Error verifying password:", response.json())
        return None
