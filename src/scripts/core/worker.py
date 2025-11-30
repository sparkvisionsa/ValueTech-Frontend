import asyncio, sys, json, traceback, platform

from .browser import closeBrowser, get_browser, check_browser_status

from scripts.loginFlow.login import startLogin, submitOtp

from scripts.submission.validateReport import validate_report
from scripts.submission.createMacros import run_create_assets
from scripts.submission.grabMacroIds import get_all_macro_ids_parallel
from scripts.submission.macroFiller import (
    run_macro_edit, 
    pause_macro_edit, 
    resume_macro_edit, 
    stop_macro_edit
)

from scripts.submission.checkMacroStatus import RunCheckMacroStatus, RunHalfCheckMacroStatus

from scripts.delete.reportDelete import delete_report_flow
from scripts.delete.deleteIncompleteAssets import delete_incomplete_assets_flow
from scripts.delete.cancelledReportHandler import handle_cancelled_report

from scripts.loginFlow.getCompanies import get_companies
from scripts.loginFlow.companyNavigate import navigate_to_company

if platform.system().lower() == "windows":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

# Track running macro-edit tasks
running_tasks = {}

async def handle_command(cmd):
    """Handle a single command"""
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
            return
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

        # Run macro-edit as a background task so we can handle pause/resume
        # while it's running
        task = asyncio.create_task(run_macro_edit(browser, report_id, tabs_num))
        running_tasks[report_id] = task
        
        try:
            result = await task
        except asyncio.CancelledError:
            result = {
                "status": "CANCELLED",
                "message": "Macro edit was cancelled"
            }
        finally:
            # Clean up task reference
            if report_id in running_tasks:
                del running_tasks[report_id]
        
        result["commandId"] = cmd.get("commandId")
        print(json.dumps(result), flush=True)

    elif action == "pause-macro-edit":
        report_id = cmd.get("reportId")
        # Pause command can be processed immediately
        result = await pause_macro_edit(report_id)
        result["commandId"] = cmd.get("commandId")
        print(json.dumps(result), flush=True)

    elif action == "resume-macro-edit":
        report_id = cmd.get("reportId")
        # Resume command can be processed immediately
        result = await resume_macro_edit(report_id)
        result["commandId"] = cmd.get("commandId")
        print(json.dumps(result), flush=True)

    elif action == "stop-macro-edit":
        report_id = cmd.get("reportId")
        # Stop command can be processed immediately
        result = await stop_macro_edit(report_id)
        result["commandId"] = cmd.get("commandId")
        print(json.dumps(result), flush=True)
        
        # If there's a running task, we could optionally cancel it
        # (though the stop flag in pause_states will make it exit naturally)
        # if report_id in running_tasks:
        #     running_tasks[report_id].cancel()

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

    elif action == "delete-report":
        browser = await get_browser()

        report_id = cmd.get("reportId")
        max_rounds = int(cmd.get("maxRounds", 10))

        result = await delete_report_flow(report_id=report_id, max_rounds=max_rounds)
        result["commandId"] = cmd.get("commandId")

        print(json.dumps(result), flush=True)

    elif action == "delete-incomplete-assets":
        browser = await get_browser()

        report_id = cmd.get("reportId")
        max_rounds = int(cmd.get("maxRounds", 10))

        result = await delete_incomplete_assets_flow(report_id=report_id, max_rounds=max_rounds)
        result["commandId"] = cmd.get("commandId")

        print(json.dumps(result), flush=True)

    elif action == "handle-cancelled-report":
        browser = await get_browser()

        report_id = cmd.get("reportId")

        result = await handle_cancelled_report(report_id=report_id)
        result["commandId"] = cmd.get("commandId")

        print(json.dumps(result), flush=True)

    elif action == "get-companies":
        result = await get_companies()
        result["commandId"] = cmd.get("commandId")

        print(json.dumps(result), flush=True)

    elif action == "navigate-to-company":
        browser = await get_browser()

        url = cmd.get("url")

        result = await navigate_to_company(browser, url)
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
        return "close"  # Signal to exit
        
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
            "supported_actions": [
                "login", "otp", "check-status", "validate-report",
                "create-macros", "grab-macro-ids", "macro-edit",
                "pause-macro-edit", "resume-macro-edit", "stop-macro-edit",
                "full-check", "half-check", "close", "ping"
            ],
            "commandId": cmd.get("commandId")
        }
        print(json.dumps(result), flush=True)

async def read_stdin_lines():
    """Generator that yields lines from stdin"""
    loop = asyncio.get_running_loop()
    while True:
        line = await loop.run_in_executor(None, sys.stdin.readline)
        if not line:
            break
        yield line.strip()

async def command_handler():
    """Main command handler that can process commands concurrently"""
    
    async for line in read_stdin_lines():
        if not line:
            continue
            
        try:
            cmd = json.loads(line)
            
            # Create a task for this command so it doesn't block other commands
            # This allows pause/resume commands to be processed while macro-edit is running
            asyncio.create_task(handle_command(cmd))
            
        except json.JSONDecodeError as e:
            error_response = {
                "status": "FAILED",
                "error": f"Invalid JSON: {str(e)}",
                "received": line
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
        # Cancel any running tasks
        for task in running_tasks.values():
            if not task.done():
                task.cancel()
        
        # Wait for tasks to finish
        if running_tasks:
            await asyncio.gather(*running_tasks.values(), return_exceptions=True)
        
        await closeBrowser()

if __name__ == "__main__":
    asyncio.run(main())