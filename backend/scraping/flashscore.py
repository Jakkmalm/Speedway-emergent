# scraping/flashscore.py
from bs4 import BeautifulSoup
from datetime import datetime
import uuid, re, time

def _parse_date(raw: str) -> datetime | None:
    # Plocka ut "DD.MM. HH:MM" även om ES/annan text sitter efter
    m = re.search(r"\b(\d{2}\.\d{2}\.\s\d{2}:\d{2})\b", raw.replace("\xa0", " "))
    if not m:
        return None
    dt = datetime.strptime(m.group(1), "%d.%m. %H:%M")
    return dt.replace(year=datetime.now().year)

def fetch_official_speedway_matches():
    # Importera här så servern kan starta även utan playwright installerat
    from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout

    matches = []
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=[
                "--disable-gpu",
                "--no-sandbox",
                "--disable-dev-shm-usage",
            ],
        )
        context = browser.new_context(user_agent=(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0 Safari/537.36"
        ))
        page = context.new_page()

        # 1) Navigera
        page.goto("https://www.flashscore.se/motorcykel-racing/speedway/", timeout=90000, wait_until="domcontentloaded")

        # 2) Försök hantera cookie/consent (olika varianter)
        try:
            # Vanlig OneTrust
            btn = page.locator("#onetrust-accept-btn-handler")
            if btn.count() and btn.is_visible():
                btn.click(timeout=3000)
            else:
                # fallback: knappar med svensk text
                page.get_by_role("button", name=re.compile("Godkänn|Jag accepterar", re.I)).first.click(timeout=2000)
        except Exception:
            pass  # om inget hittas kör vi vidare

        # 3) Vänta in nätverk och element
        try:
            page.wait_for_load_state("networkidle", timeout=60000)
        except PWTimeout:
            # Kör vidare ändå – ibland triggas inte networkidle på sajten
            pass

        # 4) Scrolla för att trigga lazy-load (några steg)
        try:
            last_height = 0
            for _ in range(5):
                page.mouse.wheel(0, 4000)
                page.wait_for_timeout(1200)
                # liten extra scroll via JS
                page.evaluate("window.scrollBy(0, 4000);")
                page.wait_for_timeout(800)
        except Exception:
            pass

        # 5) Säkerställ att det finns matchrader
        page.wait_for_selector(".event__match", timeout=60000)

        html = page.content()
        context.close()
        browser.close()

    # 6) Parsning
    soup = BeautifulSoup(html, "html.parser")
    # Begränsa till schemalagda rader
    match_blocks = soup.select(".event__match.event__match--scheduled")

    for block in match_blocks:
        try:
            home_el = block.select_one(".event__participant--home")
            away_el = block.select_one(".event__participant--away")
            time_el = block.select_one(".event__time")
            if not (home_el and away_el and time_el):
                continue

            home_team = home_el.get_text(strip=True)
            away_team = away_el.get_text(strip=True)
            date_str = time_el.get_text(separator=" ", strip=True)

            match_dt = _parse_date(date_str)
            if not match_dt:
                continue

            # Länken ligger normalt i samma block
            link_tag = block.find("a", class_="eventRowLink")
            match_url = link_tag["href"] if link_tag and link_tag.has_attr("href") else None
            if match_url and match_url.startswith("/"):
                match_url = f"https://www.flashscore.se{match_url}"

            matches.append({
                "id": str(uuid.uuid4()),
                "home_team": home_team,
                "away_team": away_team,
                "date": match_dt.isoformat(),
                "used": False,
                "source_url": match_url,
            })
        except Exception as e:
            # Fortsätt på nästa rad om något block bråkar
            print("Fel vid scraping:", e)

    # 7) Deduplicera på (home, away, date)
    seen = set()
    unique = []
    for m in matches:
        key = (m["home_team"], m["away_team"], m["date"])
        if key in seen:
            continue
        seen.add(key)
        unique.append(m)

    return unique
