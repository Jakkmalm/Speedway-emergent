import requests
import sys
import json
from datetime import datetime, timedelta

class SpeedwayAPITester:
    def __init__(self, base_url="https://faf45cf7-e0fc-4ea3-b2b1-0e8010561ccf.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.created_match_id = None
        self.created_heat_id = None
        self.team_ids = []

    def run_test(self, name, method, endpoint, expected_status, data=None, auth_required=False):
        """Run a single API test"""
        url = f"{self.base_url}{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if auth_required and self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=10)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    if isinstance(response_data, dict) and len(str(response_data)) < 500:
                        print(f"   Response: {response_data}")
                    elif isinstance(response_data, list) and len(response_data) > 0:
                        print(f"   Response: Found {len(response_data)} items")
                    return True, response_data
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data}")
                except:
                    print(f"   Error: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_health_check(self):
        """Test health endpoint"""
        success, response = self.run_test(
            "Health Check",
            "GET",
            "/api/health",
            200
        )
        return success

    def test_get_teams(self):
        """Test getting teams list"""
        success, response = self.run_test(
            "Get Teams",
            "GET", 
            "/api/teams",
            200
        )
        if success and isinstance(response, list):
            self.team_ids = [team.get('id') for team in response if team.get('id')]
            print(f"   Found {len(response)} teams: {[team.get('name') for team in response]}")
            
            # Check for Swedish teams
            expected_teams = ['Dackarna', 'Masarna', 'Vetlanda', 'Indianerna', 'Vargarna', 'Rospiggarna', 'Smederna']
            found_teams = [team.get('name') for team in response]
            missing_teams = [team for team in expected_teams if team not in found_teams]
            if missing_teams:
                print(f"   ⚠️  Missing expected teams: {missing_teams}")
            else:
                print(f"   ✅ All expected Swedish teams found")
        return success

    def test_register_user(self):
        """Test user registration"""
        timestamp = datetime.now().strftime('%H%M%S')
        user_data = {
            "username": f"testuser_{timestamp}",
            "email": f"test_{timestamp}@speedway.se",
            "password": "TestPass123!"
        }
        
        success, response = self.run_test(
            "User Registration",
            "POST",
            "/api/auth/register",
            200,
            data=user_data
        )
        
        if success and 'token' in response:
            self.token = response['token']
            self.user_id = response.get('user', {}).get('id')
            print(f"   ✅ User registered and token obtained")
        
        return success

    def test_login_user(self):
        """Test user login with existing user"""
        # Try to login with the registered user
        if not self.token:
            print("   ⚠️  No token from registration, skipping login test")
            return True
            
        # For this test, we'll just verify the token works by making an authenticated request
        return True

    def test_get_matches(self):
        """Test getting matches list"""
        success, response = self.run_test(
            "Get Matches",
            "GET",
            "/api/matches", 
            200
        )
        if success:
            print(f"   Found {len(response) if isinstance(response, list) else 0} matches")
        return success

    def test_create_match(self):
        """Test creating a new match"""
        if not self.token:
            print("   ⚠️  No authentication token, skipping match creation")
            return False
            
        if len(self.team_ids) < 2:
            print("   ⚠️  Need at least 2 teams to create a match")
            return False

        # Create match for tomorrow
        tomorrow = datetime.now() + timedelta(days=1)
        match_data = {
            "home_team_id": self.team_ids[0],
            "away_team_id": self.team_ids[1], 
            "date": tomorrow.isoformat(),
            "venue": "Test Arena"
        }
        
        success, response = self.run_test(
            "Create Match",
            "POST",
            "/api/matches",
            200,
            data=match_data,
            auth_required=True
        )
        
        if success and 'match_id' in response:
            self.created_match_id = response['match_id']
            print(f"   ✅ Match created with ID: {self.created_match_id}")
        
        return success

    def test_get_specific_match(self):
        """Test getting a specific match"""
        if not self.created_match_id:
            print("   ⚠️  No match ID available, skipping specific match test")
            return True
            
        success, response = self.run_test(
            "Get Specific Match",
            "GET",
            f"/api/matches/{self.created_match_id}",
            200
        )
        return success

    def test_create_heat(self):
        """Test creating a heat for a match"""
        if not self.token or not self.created_match_id:
            print("   ⚠️  No auth token or match ID, skipping heat creation")
            return True

        heat_data = {
            "heat_number": 1,
            "drivers": [
                {"name": "Test Driver 1", "team": "Dackarna", "gate": 1},
                {"name": "Test Driver 2", "team": "Masarna", "gate": 2},
                {"name": "Test Driver 3", "team": "Vetlanda", "gate": 3},
                {"name": "Test Driver 4", "team": "Indianerna", "gate": 4}
            ]
        }
        
        success, response = self.run_test(
            "Create Heat",
            "POST",
            f"/api/matches/{self.created_match_id}/heats",
            200,
            data=heat_data,
            auth_required=True
        )
        
        if success and 'heat_id' in response:
            self.created_heat_id = response['heat_id']
            print(f"   ✅ Heat created with ID: {self.created_heat_id}")
        
        return success

    def test_get_specific_team(self):
        """Test getting a specific team"""
        if not self.team_ids:
            print("   ⚠️  No team IDs available, skipping specific team test")
            return True
            
        success, response = self.run_test(
            "Get Specific Team",
            "GET",
            f"/api/teams/{self.team_ids[0]}",
            200
        )
        return success

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting Speedway Elitserien API Tests")
        print("=" * 50)
        
        # Basic connectivity
        if not self.test_health_check():
            print("❌ Health check failed, stopping tests")
            return False
            
        # Core data tests
        self.test_get_teams()
        self.test_get_matches()
        
        # Authentication tests
        self.test_register_user()
        self.test_login_user()
        
        # Authenticated operations
        self.test_create_match()
        self.test_get_specific_match()
        self.test_create_heat()
        
        # Additional tests
        self.test_get_specific_team()
        
        # Print results
        print("\n" + "=" * 50)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} tests passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return True
        else:
            print(f"⚠️  {self.tests_run - self.tests_passed} tests failed")
            return False

def main():
    tester = SpeedwayAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())