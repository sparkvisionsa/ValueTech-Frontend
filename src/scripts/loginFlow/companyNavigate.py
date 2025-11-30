import json, asyncio, traceback

async def navigate_to_company(browser, url):
    try:
        if not browser:
            print(json.dumps({"type": "ERROR", "message": "No browser instance"}), flush=True)
            return {"status": "FAILED", "error": "No browser instance"}
        
        if not url:
            print(json.dumps({"type": "ERROR", "message": "No company URL provided"}), flush=True)
            return {"status": "FAILED", "error": "No company URL provided"}
        
        await browser.get(url)
        await asyncio.sleep(3)  # Wait for page to load

        result = {
            "status": "SUCCESS",
            "message": "Navigated to company page",
            "url": url
        }

        return result
    
    except Exception as e:
        tb = traceback.format_exc()
        print(json.dumps({"type": "ERROR", "message": f"Error navigating to company: {e}\n{tb}"}), flush=True)
        return {"status": "FAILED", "error": str(e)}
        