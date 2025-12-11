import asyncio, sys, traceback, json
from datetime import datetime

from .formFiller import bulk_inject_inputs
from scripts.core.utils import wait_for_element


async def save_macros(page, macro_data, field_map, field_types):
    try:
        await bulk_inject_inputs(page, macro_data, field_map, field_types)

        save_btn = await wait_for_element(page, "input[type='submit']", timeout=10)
        if save_btn:
            await asyncio.sleep(0.5)
            await save_btn.click()
            await asyncio.sleep(2)
            return {"status": "SAVED"}
        else:
            return {"status": "FAILED", "error": "Save button not found"}

    except Exception as e:
        return {"status": "FAILED", "error": str(e)}


def calculate_tab_batches(total_macros, max_tabs, batch_size=10):
    if total_macros <= batch_size:
        return [total_macros]

    required_tabs = (total_macros + batch_size - 1) // batch_size
    tabs_to_use = min(required_tabs, max_tabs)

    base, extra = divmod(total_macros, tabs_to_use)
    result = []
    for i in range(tabs_to_use):
        size = base + (1 if i < extra else 0)
        result.append(size)
    return result


async def create_macros_multi_tab(browser, report_id, macro_count, macro_data_template,
                                  field_map, field_types, max_tabs=3, batch_size=10):

    try:
        print(json.dumps({
            "event": "start",
            "msg": f"Starting macro creation: {macro_count} macros for report {report_id}"
        }), file=sys.stderr)

        asset_url = f"https://qima.taqeem.sa/report/asset/create/{report_id}"

        main_page = await browser.get(asset_url)
        await asyncio.sleep(2)

        current_url = await main_page.evaluate("window.location.href")
        if str(report_id) not in current_url:
            print(json.dumps({
                "event": "navigation_failed",
                "msg": f"Failed to navigate to asset creation page for report {report_id}",
                "url": current_url
            }), file=sys.stderr)
            return {
                "status": "FAILED",
                "error": f"Failed to navigate to asset creation page for report {report_id}"
            }

        print(json.dumps({
            "event": "navigated",
            "msg": "Successfully navigated",
            "url": current_url
        }), file=sys.stderr)

        distribution = calculate_tab_batches(macro_count, max_tabs, batch_size)
        print(json.dumps({
            "event": "distribution",
            "msg": f"Tab distribution: {distribution} macros per tab"
        }), file=sys.stderr)

        pages = [main_page]
        for _ in range(len(distribution) - 1):
            new_tab = await browser.get(asset_url, new_tab=True)
            pages.append(new_tab)
            await asyncio.sleep(1)

        for page in pages:
            for _ in range(20):
                ready_state = await page.evaluate("document.readyState")
                key_el = await wait_for_element(page, "#macros", timeout=0.5)
                if ready_state == "complete" and key_el:
                    break
                await asyncio.sleep(0.5)

        completed = 0
        total_created = 0

        async def process_macros_in_tab(page, start_index, count):
            nonlocal completed, total_created

            for batch_start in range(0, count, batch_size):
                batch_count = min(batch_size, count - batch_start)

                print(json.dumps({
                    "event": "processing_batch",
                    "msg": f"Processing batch: {start_index + batch_start} to {start_index + batch_start + batch_count - 1}"
                }), file=sys.stderr)

                # Prepare macro data for this batch
                batch_data = {
                    "number_of_macros": str(batch_count),
                    "asset_data": []
                }

                # If macro_data_template is a list, use it; otherwise replicate the template
                if isinstance(macro_data_template, list):
                    # Use provided macro data
                    for i in range(batch_count):
                        idx = start_index + batch_start + i
                        if idx < len(macro_data_template):
                            batch_data["asset_data"].append(macro_data_template[idx])
                        else:
                            batch_data["asset_data"].append(macro_data_template[-1])
                else:
                    batch_data["asset_data"] = [macro_data_template] * batch_count

                form_data = {**batch_data, **macro_data_template} if isinstance(macro_data_template, dict) else batch_data

                result = await save_macros(page, form_data, field_map, field_types)

                if result.get("status") == "FAILED":
                    print(json.dumps({
                        "event": "save_failed",
                        "msg": f"Failed to save batch: {result.get('error')}"
                    }), file=sys.stderr)
                    return result

                completed += batch_count
                total_created += batch_count

                print(json.dumps({
                    "event": "progress",
                    "msg": f"Progress: {completed}/{macro_count} macros created ({round((completed/macro_count)*100, 2)}%)"
                }), file=sys.stderr)

                if batch_start + batch_size < count:
                    await page.get(asset_url)
                    await asyncio.sleep(1)

            return {"status": "SUCCESS"}

        tasks = []
        idx = 0
        for page, count in zip(pages, distribution):
            tasks.append(process_macros_in_tab(page, idx, count))
            idx += count

        # Execute all tasks in parallel
        results = await asyncio.gather(*tasks)

        # Check for failures
        for result in results:
            if isinstance(result, dict) and result.get("status") == "FAILED":
                print(json.dumps({
                    "event": "task_failure",
                    "msg": f"One of the tasks failed: {result.get('error', 'unknown')}"
                }), file=sys.stderr)
                return result

        # Close extra tabs
        for p in pages[1:]:
            await p.close()

        print(json.dumps({
            "event": "success",
            "msg": f"Successfully created {total_created} macros for report {report_id}"
        }), file=sys.stderr)

        return {
            "status": "SUCCESS",
            "report_id": report_id,
            "total_created": total_created,
            "completion_time": datetime.now().isoformat()
        }

    except Exception as e:
        tb = traceback.format_exc()
        print(json.dumps({
            "event": "exception",
            "msg": str(e),
            "traceback": tb
        }), file=sys.stderr)
        return {
            "status": "FAILED",
            "error": str(e),
            "traceback": tb
        }


async def run_create_assets(browser, report_id, macro_count, tabs_num=3, batch_size=10, macro_data=None):
    if not browser:
        return {
            "status": "FAILED",
            "error": "No active browser session. Please login first.",
        }

    if not report_id:
        return {
            "status": "FAILED",
            "error": "Missing required parameter: reportId",
        }

    try:
        macro_count = int(macro_count)
    except Exception:
        return {
            "status": "FAILED",
            "error": "Missing or invalid required parameter: macroCount",
        }

    if macro_count <= 0:
        return {
            "status": "FAILED",
            "error": "macroCount must be a positive integer",
        }

    # Defaults
    tabs_num = int(tabs_num) if tabs_num else 3
    batch_size = int(batch_size) if batch_size else 10
    macro_data_template = macro_data if macro_data is not None else {}

    # Import the pieces we need (importing here keeps the top-level import cheaper)
    try:
        from scripts.submission.formSteps import form_steps
    except Exception as e:
        tb = traceback.format_exc()
        return {
            "status": "FAILED",
            "error": f"Failed to import required modules: {e}",
            "traceback": tb,
        }

    try:
        step_one = form_steps[1] if len(form_steps) > 1 else form_steps[0]
        field_map = step_one.get("field_map", {}) if isinstance(step_one, dict) else {}
        field_types = step_one.get("field_types", {}) if isinstance(step_one, dict) else {}
    except Exception:
        field_map = {}
        field_types = {}

    try:
        result = await create_macros_multi_tab(
            browser=browser,
            report_id=report_id,
            macro_count=macro_count,
            macro_data_template=macro_data_template,
            field_map=field_map,
            field_types=field_types,
            max_tabs=tabs_num,
            batch_size=batch_size,
        )
    except Exception as e:
        tb = traceback.format_exc()
        return {
            "status": "FAILED",
            "error": str(e),
            "traceback": tb,
            "reportId": report_id,
            "time": datetime.now().isoformat(),
        }

    # return the actual result from create_macros_multi_tab (success or failure payload)
    return result

async def run_create_assets_by_count(browser, num_macros, macro_data_template=None, tabs_num=3, batch_size=10):
    """
    Create and fill assets distributed across multiple tabs without requiring a report_id.
    
    Args:
        browser: Browser instance
        num_macros: Total number of macros/assets to create
        macro_data_template: Template data for macros (dict or list)
        tabs_num: Number of tabs to use for parallel processing (default: 3)
        batch_size: Number of assets to process per batch (default: 10)
    
    Returns:
        dict: Result with status and details
    """
    try:
        print(f"[CREATE_ASSETS_BY_COUNT] Starting to create {num_macros} assets using {tabs_num} tabs", file=sys.stderr)
        
        if num_macros <= 0:
            return {"status": "FAILED", "error": "num_macros must be greater than 0"}
        
        # Get field_map and field_types from form_steps
        try:
            from scripts.submission.formSteps import form_steps
            step_one = form_steps[1] if len(form_steps) > 1 else form_steps[0]
            field_map = step_one.get("field_map", {}) if isinstance(step_one, dict) else {}
            field_types = step_one.get("field_types", {}) if isinstance(step_one, dict) else {}
        except Exception:
            field_map = {}
            field_types = {}
        
        # Default macro data template
        if macro_data_template is None:
            macro_data_template = {}
        
        # Get main page (should already be on asset creation page)
        main_page = browser.tabs[0]
        current_url = await main_page.evaluate("window.location.href")
        
        if "asset/create" not in current_url:
            return {"status": "FAILED", "error": "Not on asset creation page"}
        
        # Calculate distribution using the existing function
        tab_distributions = calculate_tab_batches(num_macros, tabs_num, batch_size)
        
        print(f"[CREATE_ASSETS_BY_COUNT] Distribution: {tab_distributions} assets per tab", file=sys.stderr)
        
        # Open additional tabs if needed
        pages = [main_page]
        for _ in range(len(tab_distributions) - 1):
            new_page = await browser.get(current_url, new_tab=True)
            pages.append(new_page)
            await asyncio.sleep(1)
        
        # Wait for all pages to be ready
        for page in pages:
            for _ in range(20):
                ready_state = await page.evaluate("document.readyState")
                key_el = await wait_for_element(page, "#macros", timeout=0.5)
                if ready_state == "complete" and key_el:
                    break
                await asyncio.sleep(0.5)
        
        # Track results
        completed = 0
        total_created = 0
        results_lock = asyncio.Lock()
        
        async def process_tab_assets(page, start_index, asset_count, tab_id):
            """Process assets for a single tab"""
            nonlocal completed, total_created
            
            print(f"[CREATE_ASSETS_BY_COUNT-TAB-{tab_id}] Processing {asset_count} assets", file=sys.stderr)
            
            # Process assets in batches
            for batch_start in range(0, asset_count, batch_size):
                batch_count = min(batch_size, asset_count - batch_start)
                
                print(f"[CREATE_ASSETS_BY_COUNT-TAB-{tab_id}] Processing batch: {start_index + batch_start} to {start_index + batch_start + batch_count - 1}", file=sys.stderr)
                
                # Prepare macro data for this batch
                batch_data = {
                    "number_of_macros": str(batch_count),
                    "asset_data": []
                }
                
                # If macro_data_template is a list, use it; otherwise replicate the template
                if isinstance(macro_data_template, list):
                    for i in range(batch_count):
                        idx = start_index + batch_start + i
                        if idx < len(macro_data_template):
                            batch_data["asset_data"].append(macro_data_template[idx])
                        else:
                            batch_data["asset_data"].append(macro_data_template[-1])
                else:
                    batch_data["asset_data"] = [macro_data_template] * batch_count
                
                form_data = {**batch_data, **macro_data_template} if isinstance(macro_data_template, dict) else batch_data
                
                # Use the existing save_macros function
                result = await save_macros(page, form_data, field_map, field_types)
                
                if result.get("status") == "FAILED":
                    print(f"[CREATE_ASSETS_BY_COUNT-TAB-{tab_id}] Failed to save batch: {result.get('error')}", file=sys.stderr)
                    return result
                
                async with results_lock:
                    completed += batch_count
                    total_created += batch_count
                
                print(f"[CREATE_ASSETS_BY_COUNT-TAB-{tab_id}] Progress: {completed}/{num_macros} macros created ({round((completed/num_macros)*100, 2)}%)", file=sys.stderr)
                
                # Navigate back to asset creation page for next batch
                if batch_start + batch_size < asset_count:
                    await page.get(current_url)
                    await asyncio.sleep(1)
            
            return {"status": "SUCCESS"}
        
        # Process all tabs in parallel
        tasks = []
        idx = 0
        for i, (page, count) in enumerate(zip(pages, tab_distributions)):
            if count > 0:
                tasks.append(process_tab_assets(page, idx, count, i))
                idx += count
        
        results = await asyncio.gather(*tasks)
        
        # Check for failures
        for result in results:
            if isinstance(result, dict) and result.get("status") == "FAILED":
                print(f"[CREATE_ASSETS_BY_COUNT] Task failed: {result.get('error', 'unknown')}", file=sys.stderr)
                return result
        
        # Close extra tabs
        for page in pages[1:]:
            await page.close()
        
        print(f"[CREATE_ASSETS_BY_COUNT] Completed: {total_created} successful", file=sys.stderr)
        
        return {
            "status": "SUCCESS",
            "total_assets": num_macros,
            "successful": total_created,
            "failed": 0,
            "completion_time": datetime.now().isoformat()
        }
        
    except Exception as e:
        print(f"[CREATE_ASSETS_BY_COUNT] Error: {str(e)}", file=sys.stderr)
        traceback.print_exc()
        return {
            "status": "FAILED",
            "error": str(e),
            "traceback": traceback.format_exc()
        }