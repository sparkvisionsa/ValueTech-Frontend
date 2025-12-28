import json, asyncio, traceback
from scripts.core.company_context import set_selected_company

def repair_mojibake(value: str) -> str:
    if not value or not isinstance(value, str):
        return value
    if any(ch in value for ch in ("\u00d8", "\u00d9", "\u00c3", "\u00c2")):
        try:
            return value.encode("latin1").decode("utf-8")
        except Exception:
            return value
    return value

async def navigate_to_company(browser, company):
    try:
        if not browser:
            print(json.dumps({"type": "ERROR", "message": "No browser instance"}), flush=True)
            return {"status": "FAILED", "error": "No browser instance"}
        
        if not company:
            print(json.dumps({"type": "ERROR", "message": "No company URL provided"}), flush=True)
            return {"status": "FAILED", "error": "No company URL provided"}

        if isinstance(company, dict):
            url = company.get("url")
            name = repair_mojibake(company.get("name"))
            office_id = company.get("officeId") or company.get("office_id")
            sector_id = company.get("sectorId") or company.get("sector_id")
        else:
            url = company
            name = None
            office_id = None
            sector_id = None

        selected = set_selected_company(url, name=name, office_id=office_id, sector_id=sector_id)
        if not selected.get("office_id"):
            msg = "Could not determine office id from company URL"
            print(json.dumps({"type": "ERROR", "message": msg}), flush=True)
            return {"status": "FAILED", "error": msg}

        target_url = selected.get("url") or url
        await browser.get(target_url)
        await asyncio.sleep(3)  # Wait for page to load

        result = {
            "status": "SUCCESS",
            "message": "Navigated to company page",
            "url": target_url,
            "selectedCompany": selected
        }

        return result
    
    except Exception as e:
        tb = traceback.format_exc()
        print(json.dumps({"type": "ERROR", "message": f"Error navigating to company: {e}\n{tb}"}), flush=True)
        return {"status": "FAILED", "error": str(e)}
        
