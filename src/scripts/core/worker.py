import asyncio, sys, json, traceback, platform

from .browser import closeBrowser, get_browser, check_browser_status

from scripts.loginFlow.login import startLogin, submitOtp

from scripts.submission.validateReport import validate_report
from scripts.submission.createMacros import run_create_assets
from scripts.submission.grabMacroIds import get_all_macro_ids_parallel
from scripts.submission.macroFiller import run_macro_edit

from scripts.submission.checkMacroStatus import RunCheckMacroStatus, RunHalfCheckMacroStatus

if platform.system().lower() == "windows":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

async def command_handler():
    """Main command handler for the worker"""
    loop = asyncio.get_running_loop()
    
    while True:
        line = await loop.run_in_executor(None, sys.stdin.readline)
        if not line:
            break
        
        try:
            cmd = json.loads(line.strip())
            action = cmd.get("action")
            
            print(f"[PY] Received action: {action}", file=sys.stderr)
            
            if action == "login":
                browser = await get_browser(force_new=True)
                page = await browser.get(
                    "https://sso.taqeem.gov.sa/realms/REL_TAQEEM/protocol/openid-connect/auth"
                    "?client_id=cli-qima-valuers&redirect_uri=https%3A%2F%2Fqima.taqeem.sa%2Fkeycloak%2Flogin%2Fcallback"
                    "&scope=openid&response_type=code"
                )
                result = await startLogin(
                    page, 
                    cmd.get("email", ""), cmd.get("password", ""), 
                    cmd.get("method", ""))
                
                result["commandId"] = cmd.get("commandId")
                print(json.dumps(result), flush=True)
                
            elif action == "otp":
                browser = await get_browser()
                if not browser or not browser.main_tab:
                    result = {
                        "status": "FAILED", 
                        "error": "No active browser session. Please login first.",
                        "commandId": cmd.get("commandId")
                    }
                    print(json.dumps(result), flush=True)
                    continue
                page = browser.main_tab
                result = await submitOtp(page, cmd.get("otp", ""), cmd.get("recordId"))
                result["commandId"] = cmd.get("commandId")
                print(json.dumps(result), flush=True)

            elif action == "check-status":
                result = await check_browser_status()
                result["commandId"] = cmd.get("commandId")
                
                print(json.dumps(result), flush=True)

            elif action == "validate-report":
                result = await validate_report(cmd)
                result["commandId"] = cmd.get("commandId")

                print(json.dumps(result), flush=True)

            elif action == "create-macros":
                browser = await get_browser()
                
                report_id = cmd.get("reportId")
                macro_count = cmd.get("macroCount")
                tabs_num = cmd.get("tabsNum")
                batch_size = cmd.get("batchSize")

                result = await run_create_assets(browser, report_id, macro_count, tabs_num, batch_size)
                result["commandId"] = cmd.get("commandId")

                print(json.dumps(result), flush=True)

            elif action == "grab-macro-ids":
                browser = await get_browser()

                report_id = cmd.get("reportId")
                tabs_num = cmd.get("tabsNum")

                result = await get_all_macro_ids_parallel(browser, report_id, tabs_num)
                result["commandId"] = cmd.get("commandId")

                print(json.dumps(result), flush=True)

            elif action == "macro-edit":
                browser = await get_browser()

                report_id = cmd.get("reportId")
                tabs_num = int(cmd.get("tabsNum", 3))

                result = await run_macro_edit(browser, report_id, tabs_num)
                result["commandId"] = cmd.get("commandId")

                print(json.dumps(result), flush=True)

            elif action == "full-check":
                browser = await get_browser()

                report_id = cmd.get("reportId")
                tabs_num = int(cmd.get("tabsNum", 3))

                result = await RunCheckMacroStatus(browser, report_id, tabs_num)
                result["commandId"] = cmd.get("commandId")

                print(json.dumps(result), flush=True)

            elif action == "half-check":
                browser = await get_browser()

                report_id = cmd.get("reportId")
                tabs_num = int(cmd.get("tabsNum", 3))

                result = await RunHalfCheckMacroStatus(browser, report_id, tabs_num)
                result["commandId"] = cmd.get("commandId")

                print(json.dumps(result), flush=True)
                
            elif action == "close":
                await closeBrowser()
                result = {
                    "status": "SUCCESS",
                    "message": "Browser closed successfully",
                    "commandId": cmd.get("commandId")
                }
                print(json.dumps(result), flush=True)
                break
                
            elif action == "ping":
                result = {
                    "status": "SUCCESS",
                    "message": "pong",
                    "commandId": cmd.get("commandId")
                }
                print(json.dumps(result), flush=True)
                
            else:
                result = {
                    "status": "FAILED", 
                    "error": f"Unknown action: {action}",
                    "supported_actions": ["login", "otp", "close", "ping"],
                    "commandId": cmd.get("commandId")
                }
                print(json.dumps(result), flush=True)
                
        except json.JSONDecodeError as e:
            error_response = {
                "status": "FAILED",
                "error": f"Invalid JSON: {str(e)}",
                "received": line.strip()
            }
            print(json.dumps(error_response), flush=True)
        except Exception as e:
            tb = traceback.format_exc()
            error_response = {
                "status": "FAILED",
                "error": f"Command handler error: {str(e)}",
                "traceback": tb
            }
            print(json.dumps(error_response), flush=True)

async def main():
    try:
        await command_handler()
    except Exception as e:
        print(json.dumps({"status": "FATAL", "error": str(e)}), flush=True)
    finally:
        await closeBrowser()

if __name__ == "__main__":
    asyncio.run(main())