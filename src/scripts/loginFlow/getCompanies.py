import asyncio, sys
from scripts.core.browser import navigate

async def get_companies():
    try:
        from bs4 import BeautifulSoup

        # Navigate to the taqeem homepage
        page = await navigate("https://qima.taqeem.sa/")
        await asyncio.sleep(3)  # Wait for page to load

        # Get the HTML content of the page
        html_content = await page.get_content()
        soup = BeautifulSoup(html_content, 'html.parser')

        companies = []

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
                text = link.get_text(strip=True)

                if not href or not text:
                    continue

                # Check for the "تقاريري" (My Reports) marker
                if "membership/reports/sector/4" in href:
                    reports_link_found = True
                    print("[INFO] Found reports link marker", file=sys.stderr)
                    continue

                # Check for the "انضمام كشريك لمنشأة" (Join as Partner) marker
                if "organization/joinPartner/sector/4" in href:
                    join_partner_found = True
                    print("[INFO] Found join partner link marker", file=sys.stderr)
                    break  # Stop processing after this marker

                # If we're between the markers, check if it's a company link
                if reports_link_found and not join_partner_found:
                    if "organization/show/" in href and text:
                        companies.append({
                            "name": text,
                            "url": href
                        })
                        print(f"[INFO] Found company: {text}", file=sys.stderr)

        print(f"[INFO] Total companies found: {len(companies)}", file=sys.stderr)
        return {"status": "SUCCESS", "data": companies}
    except Exception as e:
        print(f"[ERROR] Error getting companies: {e}", file=sys.stderr)
        return {"status": "FAILED", "error": str(e)}