import asyncio, sys
from scripts.core.browser import navigate
from scripts.core.company_context import parse_company_url

def repair_mojibake(value: str) -> str:
    if not value or not isinstance(value, str):
        return value
    if any(ch in value for ch in ("\u00d8", "\u00d9", "\u00c3", "\u00c2")):
        try:
            return value.encode("latin1").decode("utf-8")
        except Exception:
            return value
    return value

async def get_companies():
    try:
        # Navigate to the taqeem homepage
        page = await navigate("https://qima.taqeem.sa/")
        await asyncio.sleep(3)  # Wait for page to load

        companies = []
        companies_data = None

        try:
            companies_data = await page.evaluate(
                """
                () => {
                    const section = document.querySelector('ul#sidebarItem_5');
                    if (!section) return [];
                    const links = Array.from(section.querySelectorAll('a[href]'));
                    let started = false;
                    const out = [];

                    for (const link of links) {
                        const href = link.getAttribute('href') || '';
                        const text = (link.textContent || '').trim();
                        if (!href || !text) continue;
                        if (href.includes('membership/reports/sector/4')) {
                            started = true;
                            continue;
                        }
                        if (href.includes('organization/joinPartner/sector/4')) {
                            break;
                        }
                        if (!started) continue;
                        if (href.includes('organization/show/')) {
                            out.push({ name: text, href });
                        }
                    }
                    return out;
                }
                """
            )
        except Exception:
            companies_data = None

        if isinstance(companies_data, list):
            for item in companies_data:
                href = (item or {}).get("href")
                text = repair_mojibake((item or {}).get("name") or "")
                if not href or not text:
                    continue
                parsed = parse_company_url(href)
                companies.append({
                    "name": text,
                    "url": parsed.get("url") or href,
                    "officeId": parsed.get("office_id"),
                    "sectorId": parsed.get("sector_id")
                })
            print(f"[INFO] Total companies found: {len(companies)}", file=sys.stderr)
            return {"status": "SUCCESS", "data": companies}

        from bs4 import BeautifulSoup

        # Get the HTML content of the page
        html_content = await page.get_content()
        soup = BeautifulSoup(html_content, 'html.parser')

        # Find the machinery/equipment section (sidebarItem_5)
        machinery_section = soup.find('ul', {'id': 'sidebarItem_5'})
        if machinery_section:
            # Find all links in this section
            links = machinery_section.find_all('a', href=True)

            # Find the markers
            reports_link_found = False
            join_partner_found = False

            for link in links:
                href = link.get('href')
                text = repair_mojibake(link.get_text(strip=True))

                if not href or not text:
                    continue

                # Check for the "O¦U,OOñUSOñUS" (My Reports) marker
                if "membership/reports/sector/4" in href:
                    reports_link_found = True
                    print("[INFO] Found reports link marker", file=sys.stderr)
                    continue

                # Check for the "OU+OU.OU. UŸO'OñUSUŸ U,U.U+O'OœOc" (Join as Partner) marker
                if "organization/joinPartner/sector/4" in href:
                    join_partner_found = True
                    print("[INFO] Found join partner link marker", file=sys.stderr)
                    break  # Stop processing after this marker

                # If we're between the markers, check if it's a company link
                if reports_link_found and not join_partner_found:
                    if "organization/show/" in href and text:
                        parsed = parse_company_url(href)
                        companies.append({
                            "name": text,
                            "url": parsed.get("url") or href,
                            "officeId": parsed.get("office_id"),
                            "sectorId": parsed.get("sector_id")
                        })
                        office_log = parsed.get("office_id") or "unknown"
                        print(f"[INFO] Found company: {text} (office={office_log})", file=sys.stderr)

        print(f"[INFO] Total companies found: {len(companies)}", file=sys.stderr)
        return {"status": "SUCCESS", "data": companies}
    except Exception as e:
        print(f"[ERROR] Error getting companies: {e}", file=sys.stderr)
        return {"status": "FAILED", "error": str(e)}
