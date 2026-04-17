
import requests
import os

API_URL = "http://localhost:8000"

def test_regular_visitor_registration():
    print("--- Testing Regular Visitor Registration (Guard Flow) ---")
    
    # 1. Login as guard (Assuming standard dev credentials)
    # We'll use a hardcoded token if we had one, but let's try to find one or just test the endpoint parsing
    print("Note: This script tests if the backend handles empty phone numbers correctly.")
    
    # We will simulate the request manually to see if it reaches the parsing stage
    # Create a dummy image
    with open("test_visitor.jpg", "wb") as f:
        f.write(b"fake image data")
    
    try:
        # We'll try to hit the endpoint. It might fail with 401 but we care about whether it 
        # fails with 422 (validation) or 500 (crash) or Network Error (malformed).
        
        files = {
            'photo': ('test_visitor.jpg', open('test_visitor.jpg', 'rb'), 'image/jpeg')
        }
        
        data = {
            'name': 'Test Visitor',
            'phone': '', # EMPTY PHONE
            'category': 'other',
            'assigned_owner_id': '65f1a2b3c4d5e6f7a8b9c0d1', # Dummy ID
            'default_purpose': 'Delivery'
        }
        
        print(f"Sending request to {API_URL}/visitors/regular/guard...")
        response = requests.post(
            f"{API_URL}/visitors/regular/guard",
            data=data,
            files=files
        )
        
        print(f"Status Code: {response.status_code}")
        print(f"Response Body: {response.text}")
        
        if response.status_code == 422:
            print("FAILED: Backend still has validation issues with empty phone.")
        elif response.status_code == 401:
            print("SUCCESS: Backend reached the auth check (parsing passed!)")
        elif response.status_code == 201:
            print("SUCCESS: Visitor created!")
        else:
            print(f"UNEXPECTED: {response.status_code}")

    except Exception as e:
        print(f"CONNECTION ERROR: {str(e)}")
    finally:
        if os.path.exists("test_visitor.jpg"):
            os.remove("test_visitor.jpg")

if __name__ == "__main__":
    test_regular_visitor_registration()
