from playwright.sync_api import sync_playwright
from datetime import datetime

LISTING_URL = "https://www.svemo.se/vara-sportgrenar/start-speedway/resultat-speedway/resultat-bauhausligan-speedway"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
}


def debug_svemo_page():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)  # Öppnar webbläsaren
        context = browser.new_context(user_agent=HEADERS["User-Agent"])
        page = context.new_page()

        print(f"[INFO] Går till startsida: {LISTING_URL}")
        page.goto(LISTING_URL, timeout=60000)

        # Ge sidan mer tid att ladda dynamic content
        page.wait_for_timeout(10000)

        # 📸 Screenshot
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        screenshot_path = f"svemo_debug_{timestamp}.png"
        page.screenshot(path=screenshot_path, full_page=True)
        print(f"[DEBUG] Screenshot sparad: {screenshot_path}")

        # 💾 HTML-dump
        html = page.evaluate("() => document.documentElement.outerHTML")
        with open(f"svemo_debug_{timestamp}.html", "w", encoding="utf-8") as f:
            f.write(html)
        print(f"[DEBUG] HTML dumpad: svemo_debug_{timestamp}.html")

        input("[DEBUG] Tryck enter för att stänga...")
        browser.close()


if __name__ == "__main__":
    debug_svemo_page()
