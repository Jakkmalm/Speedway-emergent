# test_scraping.py
from backend.scraping.flashscore import fetch_official_speedway_matches
matches = fetch_official_speedway_matches()
print(f"Hittade {len(matches)} matcher:")
for m in matches:
    print(m)
