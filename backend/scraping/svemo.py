# from bs4 import BeautifulSoup
# from urllib.parse import urljoin
# from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout
# import re, uuid, time, requests
# from datetime import datetime

# BASE_URL = "https://www.svemo.se"
# LISTING_URL = "https://www.svemo.se/vara-sportgrenar/start-speedway/resultat-speedway/resultat-bauhausligan-speedway"
# HEADERS = {
#     "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
# }


# def fetch_all_svemo_heats():
#     all_matches = []

#     with sync_playwright() as p:
#         browser = p.chromium.launch(headless=False)
#         context = browser.new_context(user_agent=HEADERS["User-Agent"])
#         page = context.new_page()

#         print(f"[INFO] Går till startsida: {LISTING_URL}")
#         page.goto(LISTING_URL, timeout=60000, wait_until="load")
#         page.wait_for_timeout(3000)

#         frames = page.frames
#         print(f"[DEBUG] Antal iframes: {len(frames)}")

#         target_frame = None
#         for i, frame in enumerate(frames):
#             try:
#                 content = frame.content()
#                 if "rgMasterTable" in content:
#                     print(f"[✅] Tabellen hittades i iframe index {i}")
#                     target_frame = frame
#                     break
#             except Exception as e:
#                 print(f"[WARN] Kunde inte läsa frame {i}: {e}")

#         if not target_frame:
#             print("[ERROR] ❌ Ingen iframe innehöll tabellen.")
#             return []

#         try:
#             target_frame.wait_for_selector("table.rgMasterTable > tbody > tr", timeout=15000)
#         except PWTimeout:
#             print("[ERROR] ❌ Timeout: kunde inte hitta rader i iframens tabell.")
#             with open("debug_svemo.html", "w", encoding="utf-8") as f:
#                 f.write(target_frame.content())
#             return []

#         rows = target_frame.locator("table.rgMasterTable > tbody > tr")
#         row_count = rows.count()
#         print(f"[INFO] Rader hittade i iframe-tabell: {row_count}")

#         for i in range(row_count):
#             row = rows.nth(i)
#             link = row.locator("td >> nth=3 >> a")  # Fjärde kolumnen = Heatresultat
#             if link.count() == 0:
#                 continue

#             heat_url = link.get_attribute("href")
#             if not heat_url:
#                 continue

#             full_url = urljoin(BASE_URL, heat_url)
#             print(f"[INFO] Skrapar: {full_url}")
#             match_data = scrape_svemo_heat_page(full_url)
#             if match_data:
#                 all_matches.append(match_data)

#         browser.close()

#     print(f"[DONE] Totalt antal heatmatcher: {len(all_matches)}")
#     return all_matches



# def scrape_svemo_heat_page(url):
#     print(f"[INFO] 🧪 Skrapar heatresultat: {url}")
#     heats = []

#     with sync_playwright() as p:
#         browser = p.chromium.launch(headless=True)
#         context = browser.new_context(user_agent=HEADERS["User-Agent"])
#         page = context.new_page()

#         try:
#             page.goto(url, timeout=30000, wait_until="load")
#             page.wait_for_timeout(3000)
#             page.wait_for_selector("table.rgMasterTable > tbody > tr", timeout=10000)
#         except PWTimeout:
#             print(f"[WARN] ❌ Timeout eller tabell saknas: {url}")
#             with open("debug_heat_playwright.html", "w", encoding="utf-8") as f:
#                 f.write(page.content())
#             return None

#         html = page.content()
#         soup = BeautifulSoup(html, "html.parser")
#         heat_rows = soup.select("table.rgMasterTable > tbody > tr")

#         heat_number = None

#         for row in heat_rows:
#             cells = row.find_all("td")
#             if not cells or len(cells) < 8:
#                 continue

#             if cells[0].find("h2"):
#                 try:
#                     heat_number = int(cells[0].get_text(strip=True))
#                 except ValueError:
#                     continue

#             if heat_number is None:
#                 continue

#             rider = cells[3].get_text(strip=True)
#             team = cells[4].get_text(strip=True)
#             color = cells[1].get_text(strip=True)
#             gate = cells[2].get_text(strip=True)
#             points = cells[7].get_text(strip=True)

#             heat_entry = {
#                 "heat_number": heat_number,
#                 "rider": rider,
#                 "team": team,
#                 "helmet_color": color,
#                 "gate": int(gate) if gate.isdigit() else None,
#                 "points": int(points) if points.isdigit() else 0
#             }

#             existing_heat = next((h for h in heats if h["heat_number"] == heat_number), None)
#             if existing_heat:
#                 existing_heat["riders"].append(heat_entry)
#             else:
#                 heats.append({
#                     "heat_number": heat_number,
#                     "riders": [heat_entry]
#                 })

#         browser.close()

#     # CompetitionId
#     comp_id_match = re.search(r"CompetitionId=(\d+)", url)
#     competition_id = int(comp_id_match.group(1)) if comp_id_match else None

#     if not heats:
#         print(f"[WARN] ⚠️ Inga heats kunde extraheras från: {url}")

#     return {
#         "id": str(uuid.uuid4()),
#         "competition_id": competition_id,
#         "source_url": url,
#         "scraped_at": datetime.utcnow(),
#         "heats": heats
#     }
import re
from uuid import uuid4
from typing import Optional, Dict, List
from bs4 import BeautifulSoup
from urllib.parse import urljoin
from datetime import datetime
from playwright.async_api import async_playwright, TimeoutError as PWTimeout

BASE_URL = "https://ta.svemo.se"
LISTING_URL = "https://www.svemo.se/vara-sportgrenar/start-speedway/resultat-speedway/resultat-bauhausligan-speedway"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
}


async def fetch_all_svemo_heats() -> List[Dict]:

    all_matches = []
    seen_ids = set()

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(user_agent=HEADERS["User-Agent"])
        page = await context.new_page()

        print(f"[INFO] Går till startsida: {LISTING_URL}")
        await page.goto(LISTING_URL, timeout=60000)
        await page.wait_for_load_state("networkidle")
        await page.wait_for_timeout(3000)

        frames = page.frames
        print(f"[DEBUG] Antal iframes: {len(frames)}")

        target_frame = None
        for i, frame in enumerate(frames):
            try:
                content = await frame.content()
                if "rgMasterTable" in content:
                    print(f"[✅] Tabellen hittades i iframe index {i}")
                    target_frame = frame
                    break
            except Exception as e:
                print(f"[WARN] Kunde inte läsa frame {i}: {e}")

        if not target_frame:
            print("[ERROR] ❌ Ingen iframe innehöll tabellen.")
            return []

        # Hämta total antal sidor
        page_info_text = await target_frame.locator("div.rgWrap.rgInfoPart").inner_text()
        match = re.search(r"(\d+)\s+pages", page_info_text)
        max_pages = int(match.group(1)) if match else 1
        print(f"[INFO] Totalt antal sidor: {max_pages}")

        current_page = 1
        while True:
            try:
                await target_frame.wait_for_selector("table.rgMasterTable > tbody > tr", timeout=15000)
            except PWTimeout:
                print("[ERROR] ❌ Timeout vid tabellrader.")
                break

            rows = target_frame.locator("table.rgMasterTable > tbody > tr")
            row_count = await rows.count()
            print(f"[INFO] Rader hittade i iframe-tabell: {row_count}")

            new_ids_found = False
            for i in range(row_count):
                row = rows.nth(i)
                link = row.locator("td >> nth=3 >> a")
                if await link.count() == 0:
                    continue

                heat_url = await link.get_attribute("href")
                if not heat_url:
                    continue

                full_url = urljoin(BASE_URL, heat_url)
                comp_id_match = re.search(r"CompetitionId=(\d+)", full_url)
                if not comp_id_match:
                    continue

                competition_id = int(comp_id_match.group(1))
                if competition_id in seen_ids:
                    continue

                seen_ids.add(competition_id)
                new_ids_found = True

                print(f"[INFO] Skrapar: {full_url}")
                heat_data = await scrape_svemo_heat_page_playwright(context, full_url, competition_id)
                if heat_data:
                    all_matches.append(heat_data)

            # Stoppvillkor: inga nya ID:n eller nått sista sidan
            if not new_ids_found:
                print("[INFO] 🚫 Inga nya tävlingar hittades – avbryter.")
                break
            if current_page >= max_pages:
                print(f"[INFO] ✅ Alla {max_pages} sidor besökta – klart.")
                break

            # Klicka på "Nästa sida"-knappen
            try:
                next_button = target_frame.locator("input.rgPageNext")
                if await next_button.is_disabled():
                    print("[INFO] 🛑 Nästa-knapp är inaktiverad – slut på sidor.")
                    break

                print("[INFO] ⏭️ Går till nästa sida...")
                await next_button.click()
                await target_frame.wait_for_load_state("networkidle")
                await page.wait_for_timeout(3000)
                current_page += 1

            except Exception as e:
                print(f"[ERROR] ❌ Kunde inte klicka vidare: {e}")
                break

        await browser.close()

    print(f"[DONE] Totalt antal heatmatcher: {len(all_matches)}")
    return all_matches









import re
from uuid import uuid4
from typing import Optional, Dict, List
from bs4 import BeautifulSoup
from urllib.parse import urljoin
from datetime import datetime
from playwright.async_api import async_playwright, TimeoutError as PWTimeout

BASE_URL = "https://ta.svemo.se"
LISTING_URL = "https://www.svemo.se/vara-sportgrenar/start-speedway/resultat-speedway/resultat-bauhausligan-speedway"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
}


async def fetch_all_svemo_heats() -> List[Dict]:
    
    all_matches = []
    seen_ids = set()

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(user_agent=HEADERS["User-Agent"])
        page = await context.new_page()

        print(f"[INFO] Går till startsida: {LISTING_URL}")
        await page.goto(LISTING_URL, timeout=60000)
        await page.wait_for_load_state("networkidle")
        await page.wait_for_timeout(3000)

        frames = page.frames
        print(f"[DEBUG] Antal iframes: {len(frames)}")

        target_frame = None
        for i, frame in enumerate(frames):
            try:
                content = await frame.content()
                if "rgMasterTable" in content:
                    print(f"[✅] Tabellen hittades i iframe index {i}")
                    target_frame = frame
                    break
            except Exception as e:
                print(f"[WARN] Kunde inte läsa frame {i}: {e}")

        if not target_frame:
            print("[ERROR] ❌ Ingen iframe innehöll tabellen.")
            return []

        # Hämta total antal sidor
        page_info_text = await target_frame.locator("div.rgWrap.rgInfoPart").inner_text()
        match = re.search(r"(\d+)\s+pages", page_info_text)
        max_pages = int(match.group(1)) if match else 1
        print(f"[INFO] Totalt antal sidor: {max_pages}")

        current_page = 1
        while True:
            try:
                await target_frame.wait_for_selector("table.rgMasterTable > tbody > tr", timeout=15000)
            except PWTimeout:
                print("[ERROR] ❌ Timeout vid tabellrader.")
                break

            rows = target_frame.locator("table.rgMasterTable > tbody > tr")
            row_count = await rows.count()
            print(f"[INFO] Rader hittade i iframe-tabell: {row_count}")

            new_ids_found = False
            for i in range(row_count):
                row = rows.nth(i)
                link = row.locator("td >> nth=3 >> a")
                if await link.count() == 0:
                    continue

                heat_url = await link.get_attribute("href")
                if not heat_url:
                    continue

                full_url = urljoin(BASE_URL, heat_url)
                comp_id_match = re.search(r"CompetitionId=(\d+)", full_url)
                if not comp_id_match:
                    continue

                competition_id = int(comp_id_match.group(1))
                if competition_id in seen_ids:
                    continue

                seen_ids.add(competition_id)
                new_ids_found = True

                print(f"[INFO] Skrapar: {full_url}")
                heat_data = await scrape_svemo_heat_page_playwright(context, full_url, competition_id)
                if heat_data:
                    all_matches.append(heat_data)

            # Stoppvillkor: inga nya ID:n eller nått sista sidan
            if not new_ids_found:
                print("[INFO] 🚫 Inga nya tävlingar hittades – avbryter.")
                break
            if current_page >= max_pages:
                print(f"[INFO] ✅ Alla {max_pages} sidor besökta – klart.")
                break

            # Klicka på "Nästa sida"-knappen
            try:
                next_button = target_frame.locator("input.rgPageNext")
                if await next_button.is_disabled():
                    print("[INFO] 🛑 Nästa-knapp är inaktiverad – slut på sidor.")
                    break

                print("[INFO] ⏭️ Går till nästa sida...")
                await next_button.click()
                await target_frame.wait_for_load_state("networkidle")
                await page.wait_for_timeout(3000)
                current_page += 1

            except Exception as e:
                print(f"[ERROR] ❌ Kunde inte klicka vidare: {e}")
                break

        await browser.close()

    print(f"[DONE] Totalt antal heatmatcher: {len(all_matches)}")
    return all_matches






async def scrape_svemo_heat_page_playwright(context, url: str, competition_id: int) -> Optional[dict]:

    print(f"[INFO] 🧪 Skrapar heatresultat (via Playwright): {url}")
    page = await context.new_page()

    try:
        await page.goto(url, timeout=60000)
        await page.wait_for_selector("div[id*=ucDrivingScheduleHeatResult] table.rgMasterTable", timeout=15000)
    except Exception as e:
        print(f"[WARN] ❌ Timeout eller fel på sidan: {url} – {e}")
        try:
            with open("debug_heat_error.html", "w", encoding="utf-8") as f:
                f.write(await page.content())
        except Exception:
            pass
        await page.close()
        return None

    html = await page.content()
    await page.close()
    soup = BeautifulSoup(html, "html.parser")

    # En tabell per heat
    heat_tables = soup.select("div[id*=ucDrivingScheduleHeatResult] table.rgMasterTable")
    all_heats: List[Dict] = []
    seen_heat_numbers: set[int] = set()

    for table in heat_tables:
        rows = table.select("tbody > tr")
        if not rows:
            continue

        # 1) Hitta heat-numret på säkrast möjliga sätt:
        heat_number = None
        first_row_cells = rows[0].find_all("td")
        if first_row_cells:
            h2 = first_row_cells[0].find("h2")
            if h2:
                try:
                    heat_number = int(h2.get_text(strip=True))
                except Exception:
                    heat_number = None

        if heat_number is None:
            # fallback: leta första h2 i första raden
            h2_any = rows[0].find("h2")
            if h2_any:
                try:
                    heat_number = int(h2_any.get_text(strip=True))
                except Exception:
                    pass

        if heat_number is None:
            # om vi inte kan läsa heatnumret säkert – logga & hoppa
            print("[WARN] Kunde inte läsa heatnumret i en tabell, hoppar den tabellen.")
            continue

        if heat_number in seen_heat_numbers:
            # skydda mot udda dubbletter
            continue

        riders: List[Dict] = []

        # 2) Läs exakt de fyra förarraderna i heat-tabellen
        #    (RadGrid lägger alltid 4 rader per heat – med tomma celler vid behov)
        for idx, row in enumerate(rows[:4]):
            cells = row.find_all("td")
            if not cells:
                continue

            # Om första cellen är heatnumret, kasta bort den så vi börjar på Huvafältet
            if idx == 0 and cells[0].find("h2"):
                cells = cells[1:]

            # Vi behöver 7 celler: Huvafärg, Spår, Förare, Lag, Status, Ersättare, Poäng
            if len(cells) < 7:
                # försök hämta minst de första sju – annars hoppar vi förar-raden
                continue

            # Läs strikt de första 7 cellerna – ignorera HEAT/TOTAL längre till höger
            c = [cells[i].get_text(strip=True) for i in range(7)]

            helmet_color = c[0]
            gate_text = c[1]
            rider_text = c[2]
            team = c[3]
            status = c[4]
            substitute = c[5]
            points_text = c[6]

            # Städa "1. Namn" -> "Namn"
            rider = re.sub(r"^\s*\d+\.\s*", "", rider_text)

            gate = int(gate_text) if gate_text.isdigit() else None
            points = int(points_text) if points_text.isdigit() else 0

            # Raden kan vara helt tom (om förare saknas) – i så fall hoppa
            if not any([helmet_color, gate_text, rider, team, status, substitute, points_text]):
                continue

            riders.append({
                "rider": rider,
                "team": team,
                "helmet_color": helmet_color,
                "gate": gate,
                "status": status,
                "substitute": substitute,
                "points": points
            })

        # Spara heatet även om det råkade ha färre än 4 förare (tomma rader ignoreras)
        if riders:
            all_heats.append({
                "heat_number": heat_number,
                "riders": riders
            })
            seen_heat_numbers.add(heat_number)

    # Sortera heaten för säkerhets skull
    all_heats.sort(key=lambda h: h["heat_number"])

    print(f"[DEBUG] Unika heatnummer: {[h['heat_number'] for h in all_heats]}")

    if not all_heats:
        print(f"[WARN] ⚠️ Inga heatdata extraherades från: {url}")
        return None

    return {
        "id": str(uuid4()),
        "competition_id": competition_id,
        "source_url": url,
        "scraped_at": datetime.utcnow(),
        "heats": all_heats
    }







# async def scrape_svemo_heat_page_playwright(context, url: str, competition_id: int) -> Optional[dict]:
#     print(f"[INFO] 🧪 Skrapar heatresultat (via Playwright): {url}")
#     page = await context.new_page()

#     try:
#         await page.goto(url, timeout=60000)
#         await page.wait_for_selector("table.rgMasterTable > tbody > tr", timeout=15000)
#     except Exception as e:
#         print(f"[WARN] ❌ Timeout eller fel på sidan: {url} – {e}")
#         with open("debug_heat_error.html", "w", encoding="utf-8") as f:
#             f.write(await page.content())
#         await page.close()
#         return None

#     html = await page.content()
#     await page.close()
#     soup = BeautifulSoup(html, "html.parser")

#     heat_tables = soup.select("div[id*=ucDrivingScheduleHeatResult] table.rgMasterTable")
#     all_heats = []
#     seen_heat_numbers = set()

#     for table in heat_tables:
#         rows = table.select("tbody > tr")

#         current_heat_number = None
#         current_heat_riders = []

#         for row in rows:
#             cells = row.find_all("td")
#             if not cells or len(cells) < 7:
#                 continue

#             # Rubrikrader – hoppa över
#             if any(x in row.get_text() for x in ["Huva", "Spår", "Förare", "Lag", "Status", "Ersättare", "Poäng", "Total", "Heat"]):
#                 continue

#             # NYTT HEAT: Endast om <td><h2> OCH rowspan=4
#             if cells[0].find("h2") and cells[0].get("rowspan") == "4":
#                 if current_heat_number is not None and current_heat_riders:
#                     if current_heat_number not in seen_heat_numbers:
#                         all_heats.append({
#                             "heat_number": current_heat_number,
#                             "riders": current_heat_riders
#                         })
#                         seen_heat_numbers.add(current_heat_number)

#                 try:
#                     current_heat_number = int(cells[0].get_text(strip=True))
#                 except:
#                     current_heat_number = None

#                 current_heat_riders = []
#                 cells = cells[1:]  # Skippa heatnumret

#             if current_heat_number is None or len(cells) < 6:
#                 continue

#             try:
#                 helmet_color = cells[0].get_text(strip=True)
#                 gate_text = cells[1].get_text(strip=True)
#                 gate = int(gate_text) if gate_text.isdigit() else None
#                 rider = cells[2].get_text(strip=True)
#                 team = cells[3].get_text(strip=True)
#                 status = cells[4].get_text(strip=True)
#                 substitute = cells[5].get_text(strip=True)
#                 points_text = cells[6].get_text(strip=True)
#                 points = int(points_text) if points_text.isdigit() else 0

#                 current_heat_riders.append({
#                     "rider": rider,
#                     "team": team,
#                     "helmet_color": helmet_color,
#                     "gate": gate,
#                     "status": status,
#                     "substitute": substitute,
#                     "points": points
#                 })

#             except Exception as e:
#                 print(f"[WARN] Kunde inte tolka rad i heat {current_heat_number}: {e}")
#                 continue

#         # Spara sista heatet
#         if current_heat_number and current_heat_riders and current_heat_number not in seen_heat_numbers:
#             all_heats.append({
#                 "heat_number": current_heat_number,
#                 "riders": current_heat_riders
#             })
#             seen_heat_numbers.add(current_heat_number)

#     print(f"[DEBUG] Unika heatnummer: {[h['heat_number'] for h in all_heats]}")

#     if not all_heats:
#         print(f"[WARN] ⚠️ Inga heatdata extraherades från: {url}")
#         return None

#     return {
#         "id": str(uuid4()),
#         "competition_id": competition_id,
#         "source_url": url,
#         "scraped_at": datetime.utcnow(),
#         "heats": all_heats
#     }


# async def scrape_svemo_heat_page_playwright(context, url: str, competition_id: int) -> Optional[dict]:
#     print(f"[INFO] 🧪 Skrapar heatresultat (via Playwright): {url}")
#     page = await context.new_page()

#     try:
#         await page.goto(url, timeout=60000)
#         await page.wait_for_selector("table.rgMasterTable > tbody > tr", timeout=15000)
#     except Exception as e:
#         print(f"[WARN] ❌ Timeout eller fel på sidan: {url} – {e}")
#         with open("debug_heat_error.html", "w", encoding="utf-8") as f:
#             f.write(await page.content())
#         await page.close()
#         return None

#     html = await page.content()
#     await page.close()
#     soup = BeautifulSoup(html, "html.parser")

#     heat_tables = soup.select("div[id*=ucDrivingScheduleHeatResult] table.rgMasterTable")
#     all_heats = []
#     seen_heat_numbers = set()

#     for table in heat_tables:
#         rows = table.select("tbody > tr")

#         current_heat_number = None
#         current_heat_riders = []

#         for row in rows:
#             cells = row.find_all("td")
#             if not cells or len(cells) < 7:
#                 continue

#             # Rubrikrader – hoppa över
#             if any(x in row.get_text() for x in ["Huva", "Spår", "Förare", "Lag", "Status", "Ersättare", "Poäng", "Total", "Heat"]):
#                 continue

#             # NYTT HEAT: Endast om <td><h2> OCH rowspan=4
#             if cells[0].find("h2") and cells[0].get("rowspan") == "4":
#                 if current_heat_number is not None and current_heat_riders:
#                     if current_heat_number not in seen_heat_numbers:
#                         all_heats.append({
#                             "heat_number": current_heat_number,
#                             "riders": current_heat_riders
#                         })
#                         seen_heat_numbers.add(current_heat_number)

#                 try:
#                     current_heat_number = int(cells[0].get_text(strip=True))
#                 except:
#                     current_heat_number = None

#                 current_heat_riders = []
#                 cells = cells[1:]  # Skippa heatnumret

#             if current_heat_number is None or len(cells) < 6:
#                 continue

#             try:
#                 helmet_color = cells[0].get_text(strip=True)
#                 gate_text = cells[1].get_text(strip=True)
#                 gate = int(gate_text) if gate_text.isdigit() else None
#                 rider = cells[2].get_text(strip=True)
#                 team = cells[3].get_text(strip=True)
#                 status = cells[4].get_text(strip=True)
#                 substitute = cells[5].get_text(strip=True)
#                 points_text = cells[6].get_text(strip=True)
#                 points = int(points_text) if points_text.isdigit() else 0

#                 current_heat_riders.append({
#                     "rider": rider,
#                     "team": team,
#                     "helmet_color": helmet_color,
#                     "gate": gate,
#                     "status": status,
#                     "substitute": substitute,
#                     "points": points
#                 })

#             except Exception as e:
#                 print(f"[WARN] Kunde inte tolka rad i heat {current_heat_number}: {e}")
#                 continue

#         # Spara sista heatet
#         if current_heat_number and current_heat_riders and current_heat_number not in seen_heat_numbers:
#             all_heats.append({
#                 "heat_number": current_heat_number,
#                 "riders": current_heat_riders
#             })
#             seen_heat_numbers.add(current_heat_number)

#     print(f"[DEBUG] Unika heatnummer: {[h['heat_number'] for h in all_heats]}")

#     if not all_heats:
#         print(f"[WARN] ⚠️ Inga heatdata extraherades från: {url}")
#         return None

#     return {
#         "id": str(uuid4()),
#         "competition_id": competition_id,
#         "source_url": url,
#         "scraped_at": datetime.utcnow(),
#         "heats": all_heats
#     }





