import requests

url = "http://127.0.0.1:8000/api/v1/auth/register"
data = {
    "email": "test_user@example.com",
    "name": "Test User",
    "password": "password123"
}

try:
    response = requests.post(url, json=data)
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text}")
except Exception as e:
    print(f"Error: {e}")
