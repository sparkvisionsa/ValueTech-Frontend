
import os, json, asyncio
import nodriver as uc
from urllib.parse import urlparse
from dotenv import load_dotenv
from .utils import log

load_dotenv()

browser = None
page = None
refresh_task = None

async def spawn_new_browser(
    old_browser,
    user_data_dir=None,
    headless=False,
):

    await old_browser.cookies.save()

    new_browser = await uc.start(
        user_data_dir=user_data_dir,
        headless=headless,
    )

    await new_browser.cookies.load()
    return new_browser    


async def switch_to_headless():
    global browser

    if not browser:
        return {"status": "FAILED", "error": "No active browser"}

    old_browser = browser

    try:
        await old_browser.cookies.save()
        profile_path = os.getenv("USER_DATA_DIR", None)

        user_agent = (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36"
        )
        
        headless_browser = await uc.start(
            headless=True,
            user_data_dir=profile_path,
            browser_args=[
                f"--user-agent={user_agent}",
                "--disable-dev-shm-usage",
                "--disable-gpu",
                "--no_sandbox=True",
                "--disable-popup-blocking",
                "--disable-features=VizDisplayCompositor",
                "--lang=en-US",
                "--no-first-run",
                "--no-default-browser-check",
            ],
        )
        await headless_browser.cookies.load()
        browser = headless_browser
        old_browser.stop()

        global refresh_task
        if refresh_task is None or refresh_task.done():
            refresh_task = asyncio.create_task(_periodic_refresh(interval_minutes=20))


        return {"status": "SUCCESS"}

    except Exception as e:
        return {"status": "FAILED", "error": str(e)}



async def get_browser(force_new=False, headless_override=None):
    global browser

    if force_new and browser:
        await closeBrowser()

    if browser is None:
        # Default behavior from environment
        env_headless = os.getenv("HEADLESS", "false").lower() in ("true", "1", "yes")

        # Allow callers to explicitly override
        headless = headless_override if headless_override is not None else env_headless

        print(json.dumps({
            "type": "DEBUG",
            "message": f"Headless mode: {headless}"
        }), flush=True)

        user_agent = (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36"
        )

        profile_path = os.getenv("USER_DATA_DIR", None)

        browser = await uc.start(
            headless=headless,
            user_data_dir=profile_path,
            browser_args=[
                f"--user-agent={user_agent}",
                "--disable-dev-shm-usage",
                "--disable-gpu",
                "--no_sandbox=True",
                "--disable-popup-blocking",
                "--disable-features=VizDisplayCompositor",
                "--lang=en-US",
                "--no-first-run",
                "--no-default-browser-check",
            ],
            window_size=(1920, 1080),
        )

    return browser


async def get_main_tab():
    b = await get_browser()
    if b.main_tab is None and len(b.tabs) > 0:
        return b.tabs[0]
    return b.main_tab or await b.get("about:blank")

async def check_browser_status():
    global browser
    if browser is None:
        return {"status": "FAILED", "error": "No browser instance", "browserOpen": False}
    
    try:
        page = browser.main_tab
        url = await page.evaluate("window.location.href")
        current_url = url.lower()
        
        # URLs that definitively indicate NOT logged in
        non_logged_in_urls = [
            "sso.taqeem.gov.sa/realms/rel_taqeem/login-actions/authenticate",
            "sso.taqeem.gov.sa/realms/rel_taqeem/protocol/openid-connect/auth",
            "/login-actions/authenticate",
            "/protocol/openid-connect/auth",
        ]
        
        # If we're on any authentication URL, we're definitely not logged in
        if any(auth_url in current_url for auth_url in non_logged_in_urls):
            return {"status": "NOT_LOGGED_IN", "error": "User not logged in", "browserOpen": True}
            
        # If browser is responsive and we're NOT on auth URLs, assume logged in
        return {"status": "SUCCESS", "message": "User is logged in", "browserOpen": True}
        
    except Exception as e:
        # Browser instance exists but is not actually running
        _browser = None
        return {"status": "FAILED", "error": str(e), "browserOpen": False}

async def new_tab(url):
    global browser
    if browser:
        try:
            new_tab = await browser.get(url, new_tab=True)
            return new_tab
        except Exception as e:
            return {"status": "FAILED", "error": str(e)}

async def new_window(url):
    global browser
    if browser:
        try:
            new_window = await browser.get(url, new_window=True)
            return new_window
        except Exception as e:
            return {"status": "FAILED", "error": str(e)}    

async def closeBrowser():
    global browser, page, refresh_task

    if refresh_task:
        refresh_task.cancel()
        refresh_task = None

    if browser:
        try:
            await browser.stop()
        except Exception:
            pass
    browser, page = None, None

def set_page(new_page):
    global page
    page = new_page

def get_page():
    global page
    return page

async def navigate(url: str):
    def _sanitize(u: str) -> str:
        return (u or "").strip().strip('"\\' + "'")

    url = _sanitize(url)
    browser = await get_browser()

    if not _is_valid_http_url(url):
        log(f"Invalid URL -> '{url}'", "ERR")
        page = await browser.new_page()
        return page

    # Try once, then restart browser and retry once more if transport fails
    for attempt in range(2):
        try:
            return await browser.get(url)
        except Exception as e:
            log(f"browser.get() failed (try {attempt+1}/2): {e}", "WARN")
            try:
                page = await browser.new_page()
                await page.evaluate("url => { window.location.href = url; }", url)
                return page
            except Exception as e2:
                log(f"fallback window.location failed: {e2}", "WARN")
                if attempt == 0:
                    # restart browser and retry
                    try:
                        await closeBrowser()
                    except Exception:
                        pass
                    # get_browser() will recreate
                    browser = await get_browser()
                else:
                    # give up with a blank page
                    try:
                        return await browser.new_page()
                    except Exception:
                        raise


def _is_valid_http_url(url: str) -> bool:
    try:
        parts = urlparse(url)
        return parts.scheme in ("http", "https") and bool(parts.netloc)
    except Exception:
        return False
    
    
async def _periodic_refresh(interval_minutes=1):
    global browser

    interval_seconds = interval_minutes * 60

    while True:
        try:
            await asyncio.sleep(interval_seconds)

            if not browser:
                continue

            page = browser.main_tab
            if not page:
                continue

            current_url = await page.evaluate("window.location.href")
            if not current_url:
                continue

            await page.get(current_url)

            print(json.dumps({
                "type": "DEBUG",
                "message": f"Headless session refreshed: {current_url}"
            }), flush=True)

        except asyncio.CancelledError:
            break
        except Exception as e:
            print(json.dumps({
                "type": "WARN",
                "message": f"Periodic refresh failed: {e}"
            }), flush=True)
