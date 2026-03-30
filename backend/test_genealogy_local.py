import urllib.request
import urllib.parse
import json

API_BASE = "http://127.0.0.1:8000/api/v1"

def request(method, path, data=None, headers=None):
    url = f"{API_BASE}{path}"
    req_headers = headers or {}
    req_data = None
    if data is not None:
        if isinstance(data, str):
            req_data = data.encode('utf-8')
            req_headers['Content-Type'] = 'application/x-www-form-urlencoded'
        else:
            req_data = json.dumps(data).encode('utf-8')
            req_headers['Content-Type'] = 'application/json'
    
    req = urllib.request.Request(url, data=req_data, headers=req_headers, method=method)
    try:
        with urllib.request.urlopen(req) as response:
            resp_data = response.read().decode()
            return response.status, json.loads(resp_data) if resp_data else None
    except urllib.error.HTTPError as e:
        resp_data = e.read().decode()
        try:
            return e.code, json.loads(resp_data)
        except:
            return e.code, resp_data

print("1. Logging in...")
status, resp = request('POST', '/auth/access-token', "username=test_user@example.com&password=password123")
if status != 200:
    request('POST', '/auth/register', {"email":"test_user@example.com","name":"Test","password":"password123"})
    status, resp = request('POST', '/auth/access-token', "username=test_user@example.com&password=password123")

token = resp["access_token"]
headers = {"Authorization": f"Bearer {token}"}

print("2. Checking farm...")
status, farm_resp = request('GET', '/farms/me', headers=headers)
if status == 404:
    request('POST', '/farms/', {"name":"Test Farm"}, headers=headers)

print("3. Creating animals...")
status, mother = request('POST', '/animals/', {"registration_id":"MOM123","gender":"F","status":"Active"}, headers=headers)
if status >= 400:
    s, animals = request('GET', '/animals/', headers=headers)
    mother = next((a for a in animals if a["registration_id"]=="MOM123"), None)

status, father = request('POST', '/animals/', {"registration_id":"DAD123","gender":"M","status":"Active"}, headers=headers)
if status >= 400:
    s, animals = request('GET', '/animals/', headers=headers)
    father = next((a for a in animals if a["registration_id"]=="DAD123"), None)

status, child = request('POST', '/animals/', {"registration_id":"CHILD123","gender":"F","status":"Active","mother_id":mother["id"],"father_id":father["id"]}, headers=headers)
if status >= 400:
    s, animals = request('GET', '/animals/', headers=headers)
    child = next((a for a in animals if a["registration_id"]=="CHILD123"), None)

print("Child:", child["id"])
print("\n--- Testing Genealogy for Child ---")
s, gen_c = request('GET', f"/animals/{child['id']}/genealogy", headers=headers)
print("Child Genealogy:")
print(json.dumps(gen_c, indent=2))

print("\n--- Testing Genealogy for Mother ---")
s, gen_m = request('GET', f"/animals/{mother['id']}/genealogy", headers=headers)
print("Mother Genealogy:")
print(json.dumps(gen_m, indent=2))
