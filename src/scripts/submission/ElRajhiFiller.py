import asyncio, traceback, json
from datetime import datetime, timezone

from motor.motor_asyncio import AsyncIOMotorClient

from .formSteps import form_steps, macro_form_config
from .formFiller import fill_form
from .macroFiller import fill_macro_form
from scripts.core.utils import wait_for_element, wait_for_table_rows

from scripts.core.company_context import (
    build_report_create_url,
    require_selected_company,
    set_selected_company,
)

MONGO_URI = "mongodb+srv://Aasim:userAasim123@electron.cwbi8id.mongodb.net"
client = AsyncIOMotorClient(MONGO_URI)
db = client["test"]

# Global pause state management
pause_states = {}

def get_pause_state(batch_id):
    """Get pause state for a batch"""
    return pause_states.get(batch_id, {"paused": False, "stopped": False})

def set_pause_state(batch_id, paused=None, stopped=None):
    """Set pause state for a batch"""
    if batch_id not in pause_states:
        pause_states[batch_id] = {"paused": False, "stopped": False}
    
    if paused is not None:
        pause_states[batch_id]["paused"] = paused
    if stopped is not None:
        pause_states[batch_id]["stopped"] = stopped
    
    return pause_states[batch_id]

def clear_pause_state(batch_id):
    """Clear pause state for a batch"""
    if batch_id in pause_states:
        del pause_states[batch_id]

async def check_pause_state(batch_id):
    """Check if processing should pause or stop"""
    state = get_pause_state(batch_id)
    
    if state.get("stopped"):
        return {"action": "stop"}
    
    while state.get("paused"):
        await asyncio.sleep(0.5)
        state = get_pause_state(batch_id)
        
        if state.get("stopped"):
            return {"action": "stop"}
    
    return {"action": "continue"}

def balanced_chunks(lst, n):
    """Split list into n balanced chunks"""
    k, m = divmod(len(lst), n)
    chunks = []
    start = 0
    for i in range(n):
        size = k + (1 if i < m else 0)
        chunks.append(lst[start:start+size])
        start += size
    return chunks

from datetime import datetime

def extract_asset_from_report(report_record):
    # Convert inspection_date from MongoDB Date to yyyy-mm-dd
    inspection_date = report_record.get("inspection_date")
    
    if inspection_date:
        try:
            # If it's already a datetime object (from MongoDB)
            if isinstance(inspection_date, datetime):
                formatted_date = inspection_date.strftime('%Y-%m-%d')
            # If it's a string (fallback)
            elif isinstance(inspection_date, str):
                # Handle string formats
                if 'T' in inspection_date:
                    # ISO format string
                    date_obj = datetime.fromisoformat(inspection_date.replace('Z', '+00:00'))
                    formatted_date = date_obj.strftime('%Y-%m-%d')
                else:
                    # Try parsing other string formats
                    try:
                        date_obj = datetime.strptime(inspection_date, '%Y-%m-%d')
                        formatted_date = date_obj.strftime('%Y-%m-%d')
                    except:
                        formatted_date = inspection_date[:10]  # Take first 10 chars
            else:
                formatted_date = ""
        except Exception as e:
            print(f"Warning: Could not format inspection_date: {type(inspection_date)} - {inspection_date}, error: {e}")
            formatted_date = ""
    else:
        formatted_date = ""
    
    return {
        "asset_type": "مركبه",
        "production_capacity": "0",
        "production_capacity_measuring_unit": "0",
        "product_type": "0",
        "asset_name": report_record.get("asset_name"),
        "asset_usage_id": report_record.get("asset_usage"),
        "inspection_date": formatted_date,  # Use the formatted date
        "final_value": report_record.get("final_value"),
        "market_approach": "1",
        "market_approach_value": report_record.get("final_value"),
        "owner_name": report_record.get("client_name"),
        "region": report_record.get("region"),
        "city": report_record.get("city"),
    }


async def create_report_and_collect_macro(page, report_record, create_url):
    """Create a single report and collect its macro ID without filling it"""
    try:
        # Navigate to create report page
        await page.get(create_url)
        await asyncio.sleep(1)

        # Fill form steps with report data (steps 1 and 2)
        for step_num, step_config in enumerate(form_steps, 1):
            is_last = step_num == len(form_steps)
            valuers = report_record.get("valuers")
            is_valuers_step = bool(valuers) and step_config.get("is_valuers_step", False)

            if valuers:
                result = await fill_form(
                    page, 
                    report_record, 
                    step_config["field_map"], 
                    step_config["field_types"], 
                    is_last, 
                    is_valuers=is_valuers_step,
                )
            else:
                result = await fill_form(
                    page, 
                    report_record, 
                    step_config["field_map"], 
                    step_config["field_types"], 
                    is_last
                )

            if isinstance(result, dict) and result.get("status") == "FAILED":
                return {
                    "status": "FAILED",
                    "step": step_num,
                    "error": result.get("error"),
                    "record_id": str(report_record["_id"])
                }

            if is_last:
                # Get the report ID from URL
                main_url = await page.evaluate("window.location.href")
                form_id = main_url.split("/")[-1]
                
                if not form_id:
                    return {
                        "status": "FAILED",
                        "step": "report_id",
                        "error": "Could not determine report_id",
                        "record_id": str(report_record["_id"])
                    }

                # Update the report record with the generated report_id
                await db.urgentreports.update_one(
                    {"_id": report_record["_id"]},
                    {"$set": {"report_id": form_id}}
                )

                # Get the macro ID without filling it
                await asyncio.sleep(2)
                await wait_for_table_rows(page)
                macro_link = await wait_for_element(page, "#m-table tbody tr:first-child td:nth-child(1) a")
                    
                if not macro_link:
                    return {
                        "status": "FAILED",
                        "error": "Could not find macro link in table",
                        "report_id": form_id,
                        "record_id": str(report_record["_id"])
                    }
                
                macro_id = macro_link.text.strip()

                # Get asset data (single asset per report)
                macro_data = extract_asset_from_report(report_record)

                return {
                    "status": "SUCCESS",
                    "report_id": form_id,
                    "macro_id": macro_id,
                    "macro_data": macro_data,
                    "record_id": str(report_record["_id"])
                }

    except Exception as e:
        tb = traceback.format_exc()
        return {
            "status": "FAILED",
            "error": str(e),
            "traceback": tb,
            "record_id": str(report_record["_id"])
        }
    
DUMMY_PDF_NAME = "dummy_placeholder.pdf"

def is_dummy_pdf(report_record):
    """Return True if this report is using the dummy placeholder PDF."""
    pdf_path = report_record.get("pdf_path") or ""
    return isinstance(pdf_path, str) and pdf_path.endswith(DUMMY_PDF_NAME)


async def finalize_report_submission(page, report_id):
    """Open the report page, accept policy checkbox, and send the report."""
    try:
        report_url = f"https://qima.taqeem.sa/report/{report_id}"
        await page.get(report_url)
        await asyncio.sleep(1)

        checkbox_selector = "input#agree"
        agree_checkbox = await wait_for_element(page, checkbox_selector, timeout=20)
        if not agree_checkbox:
            return {"status": "FAILED", "error": "Agree checkbox not found"}

        try:
            await page.evaluate(
                """(selector) => {
                    const el = document.querySelector(selector);
                    if (el) {
                        el.checked = true;
                        el.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                }""",
                checkbox_selector
            )
        except Exception:
            try:
                await agree_checkbox.click()
            except Exception:
                return {"status": "FAILED", "error": "Could not toggle agree checkbox"}

        send_selector = "input#send"
        send_button = await wait_for_element(page, send_selector, timeout=15)
        if not send_button:
            return {"status": "FAILED", "error": "Send button not found"}

        try:
            await page.evaluate(
                """(selector) => { 
                    const btn = document.querySelector(selector); 
                    if (btn) btn.disabled = false; 
                }""",
                send_selector
            )
        except Exception:
            pass

        await send_button.click()
        await asyncio.sleep(2)

        return {"status": "SUCCESS", "report_id": report_id}
    except Exception as e:
        return {"status": "FAILED", "error": str(e)}


async def ElRajhiFiller(browser, batch_id, tabs_num=3, pdf_only=False, company_url=None, finalize_submission=True):
    try:
        # Fetch all report records with this batch_id
        cursor = db.urgentreports.find({"batch_id": batch_id})
        raw_records = await cursor.to_list(length=None)

        # Deduplicate in case the batch contains repeated IDs
        seen_ids = set()
        report_records = []
        for rec in raw_records:
            rec_id = str(rec.get("_id"))
            if rec_id in seen_ids:
                continue
            seen_ids.add(rec_id)
            report_records.append(rec)
        
        if not report_records:
            return {"status": "FAILED", "error": f"No reports found for batch_id: {batch_id}"}
        
        if pdf_only:
            report_records = [
                report for report in report_records
                if not is_dummy_pdf(report)
            ]

        try:
            if company_url:
                if isinstance(company_url, dict):
                    set_selected_company(
                        company_url.get("url"),
                        name=company_url.get("name"),
                        office_id=company_url.get("officeId") or company_url.get("office_id"),
                        sector_id=company_url.get("sectorId") or company_url.get("sector_id"),
                    )
                else:
                    set_selected_company(company_url)
            require_selected_company()
            create_url = build_report_create_url()
        except Exception as ctx_err:
            return {"status": "FAILED", "error": str(ctx_err)}

        total_reports = len(report_records)
        
        # Update start time for all reports in batch
        await db.urgentreports.update_many(
            {"batch_id": batch_id},
            {"$set": {"startSubmitTime": datetime.now(timezone.utc)}}
        )

        # Initialize pause state
        set_pause_state(batch_id, paused=False, stopped=False)

        # Use single tab for report creation
        main_page = browser.tabs[0]
        
        # Array to collect macro IDs and their data
        macros_to_fill = []
        report_creation_results = []
        
        completed_reports = 0
        failed_reports = 0
        finalized_reports = 0
        finalization_failed = 0

        # Send initial progress
        initial_progress = {
            "type": "progress",
            "batchId": batch_id,
            "phase": "report_creation",
            "completed": 0,
            "failed": 0,
            "total": total_reports,
            "percentage": 0,
            "paused": False,
            "message": "Starting report creation phase..."
        }
        print(json.dumps(initial_progress), flush=True)

        # Phase 1: Create all reports sequentially and collect macro IDs
        for idx, report_record in enumerate(report_records):
            # Check pause/stop state
            pause_check = await check_pause_state(batch_id)
            if pause_check["action"] == "stop":
                print(f"Report creation stopped by user request")
                clear_pause_state(batch_id)
                return {
                    "status": "STOPPED",
                    "message": "Report creation stopped by user",
                    "completed": completed_reports,
                    "failed": failed_reports,
                    "total": total_reports
                }
            
            try:
                # Send progress before processing
                pause_state = get_pause_state(batch_id)
                progress_data = {
                    "type": "progress",
                    "batchId": batch_id,
                    "phase": "report_creation",
                    "currentRecordId": str(report_record["_id"]),
                    "completed": completed_reports,
                    "failed": failed_reports,
                    "total": total_reports,
                    "percentage": round((completed_reports / total_reports) * 100, 2),
                    "paused": pause_state.get("paused", False),
                    "message": f"Creating report {completed_reports + 1}/{total_reports}"
                }
                print(json.dumps(progress_data), flush=True)
                
                # Create report and collect macro ID
                result = await create_report_and_collect_macro(
                    main_page,
                    report_record,
                    create_url,
                )
                
                if result.get("status") == "SUCCESS":
                    # Store macro info for later filling
                    macros_to_fill.append({
                        "macro_id": result["macro_id"],
                        "macro_data": result["macro_data"],
                        "report_id": result["report_id"],
                        "record_id": result["record_id"]
                    })
                    completed_reports += 1
                else:
                    failed_reports += 1
                
                report_creation_results.append(result)
                
                # Send progress after processing
                pause_state = get_pause_state(batch_id)
                progress_data = {
                    "type": "progress",
                    "batchId": batch_id,
                    "phase": "report_creation",
                    "currentRecordId": str(report_record["_id"]),
                    "completed": completed_reports,
                    "failed": failed_reports,
                    "total": total_reports,
                    "percentage": round((completed_reports / total_reports) * 100, 2),
                    "paused": pause_state.get("paused", False),
                    "message": f"Created report {completed_reports}/{total_reports}",
                    "status": result.get("status"),
                    "report_id": result.get("report_id")
                }
                print(json.dumps(progress_data), flush=True)
                
            except Exception as e:
                failed_reports += 1
                error_result = {
                    "status": "FAILED",
                    "error": str(e),
                    "record_id": str(report_record["_id"])
                }
                report_creation_results.append(error_result)
                
                # Send error progress
                pause_state = get_pause_state(batch_id)
                error_data = {
                    "type": "progress",
                    "batchId": batch_id,
                    "phase": "report_creation",
                    "currentRecordId": str(report_record["_id"]),
                    "completed": completed_reports,
                    "failed": failed_reports,
                    "total": total_reports,
                    "percentage": round((completed_reports / total_reports) * 100, 2),
                    "paused": pause_state.get("paused", False),
                    "message": f"Error creating report: {str(e)}",
                    "status": "FAILED"
                }
                print(json.dumps(error_data), flush=True)

        print(f"Phase 1 complete: Created {completed_reports} reports, collected {len(macros_to_fill)} macros to fill")

        # Phase 2: Fill all macros in parallel using multiple tabs
        if macros_to_fill:
            # Create additional tabs for parallel macro filling
            tabs_num = max(1, min(int(tabs_num or 1), len(macros_to_fill)))
            pages = [main_page] + [await browser.get("", new_tab=True) for _ in range(tabs_num - 1)]
            
            # Split macros into balanced chunks
            macro_chunks = balanced_chunks(macros_to_fill, tabs_num)
            
            completed_macros = 0
            failed_macros = 0
            total_macros = len(macros_to_fill)
            completed_lock = asyncio.Lock()
            
            # Send macro filling phase start
            macro_phase_progress = {
                "type": "progress",
                "batchId": batch_id,
                "phase": "macro_filling",
                "completed": 0,
                "failed": 0,
                "total": total_macros,
                "percentage": 0,
                "paused": False,
                "message": f"Starting macro filling phase with {tabs_num} tabs..."
            }
            print(json.dumps(macro_phase_progress), flush=True)
            
            async def process_macro_chunk(macro_chunk, page, chunk_index):
                nonlocal completed_macros, failed_macros, finalized_reports, finalization_failed
                print(f"Processing macro chunk {chunk_index} with {len(macro_chunk)} macros")
                
                for macro_info in macro_chunk:
                    # Check pause/stop state
                    pause_check = await check_pause_state(batch_id)
                    if pause_check["action"] == "stop":
                        print(f"Macro chunk {chunk_index} stopped by user request")
                        return
                    
                    try:
                        # Send progress before filling
                        async with completed_lock:
                            current_completed = completed_macros
                            current_failed = failed_macros
                        
                        pause_state = get_pause_state(batch_id)
                        progress_data = {
                            "type": "progress",
                            "batchId": batch_id,
                            "phase": "macro_filling",
                            "currentMacroId": macro_info["macro_id"],
                            "completed": current_completed,
                            "failed": current_failed,
                            "total": total_macros,
                            "percentage": round((current_completed / total_macros) * 100, 2),
                            "paused": pause_state.get("paused", False),
                            "message": f"Filling macro {current_completed + 1}/{total_macros}"
                        }
                        print(json.dumps(progress_data), flush=True)
                        
                        # Fill the macro
                        macro_result = await fill_macro_form(
                            page,
                            macro_id=macro_info["macro_id"],
                            macro_data=macro_info["macro_data"],
                            field_map=macro_form_config["field_map"],
                            field_types=macro_form_config["field_types"],
                        )

                        # Immediately finalize this report in the same tab after filling its macro
                        finalization_result = None
                        if finalize_submission:
                            report_id_for_macro = macro_info.get("report_id")
                            if report_id_for_macro:
                                finalization_result = await finalize_report_submission(page, report_id_for_macro)
                                if finalization_result.get("status") == "SUCCESS":
                                    finalized_reports += 1
                                else:
                                    finalization_failed += 1
                            else:
                                finalization_failed += 1
                                finalization_result = {"status": "FAILED", "error": "Missing report_id"}
                        
                        async with completed_lock:
                            if isinstance(macro_result, dict) and macro_result.get("status") == "FAILED":
                                failed_macros += 1
                            completed_macros += 1
                            current_completed = completed_macros
                            current_failed = failed_macros
                        
                        # Send progress after filling
                        pause_state = get_pause_state(batch_id)
                        progress_data = {
                            "type": "progress",
                            "batchId": batch_id,
                            "phase": "macro_filling",
                            "currentMacroId": macro_info["macro_id"],
                            "completed": current_completed,
                            "failed": current_failed,
                            "total": total_macros,
                            "percentage": round((current_completed / total_macros) * 100, 2),
                            "paused": pause_state.get("paused", False),
                            "message": f"Filled macro {current_completed}/{total_macros}",
                            "status": macro_result.get("status") if isinstance(macro_result, dict) else "SUCCESS",
                            "finalizationStatus": finalization_result.get("status") if finalization_result else None,
                            "finalizationError": finalization_result.get("error") if finalization_result else None,
                            "report_id": macro_info.get("report_id")
                        }
                        print(json.dumps(progress_data), flush=True)
                        
                    except Exception as e:
                        async with completed_lock:
                            failed_macros += 1
                            completed_macros += 1
                            current_completed = completed_macros
                            current_failed = failed_macros
                        
                        # Send error progress
                        pause_state = get_pause_state(batch_id)
                        error_data = {
                            "type": "progress",
                            "batchId": batch_id,
                            "phase": "macro_filling",
                            "currentMacroId": macro_info["macro_id"],
                            "completed": current_completed,
                            "failed": current_failed,
                            "total": total_macros,
                            "percentage": round((current_completed / total_macros) * 100, 2),
                            "paused": pause_state.get("paused", False),
                            "message": f"Error filling macro: {str(e)}",
                            "status": "FAILED"
                        }
                        print(json.dumps(error_data), flush=True)
            
            # Create tasks for parallel macro filling
            tasks = []
            for i, (page, macro_chunk) in enumerate(zip(pages, macro_chunks)):
                if macro_chunk:
                    tasks.append(process_macro_chunk(macro_chunk, page, i))
            
            await asyncio.gather(*tasks)
            
            # Close extra tabs
            for page in pages[1:]:
                await page.close()
            
            print(f"Phase 2 complete: Filled {completed_macros} macros ({failed_macros} failed)")

        # Clear pause state after completion
        clear_pause_state(batch_id)

        return {
            "status": "SUCCESS",
            "message": f"Completed processing batch",
            "reports_created": completed_reports,
            "reports_failed": failed_reports,
            "macros_filled": completed_macros if macros_to_fill else 0,
            "macros_failed": failed_macros if macros_to_fill else 0,
            "reports_finalized": finalized_reports if finalize_submission and macros_to_fill else 0,
            "finalization_failed": finalization_failed if finalize_submission and macros_to_fill else 0,
            "total_reports": total_reports,
            "results": report_creation_results
        }

    except Exception as e:
        tb = traceback.format_exc()
        
        # Clear pause state on error
        clear_pause_state(batch_id)
        
        return {"status": "FAILED", "error": str(e), "traceback": tb}

async def pause_batch(batch_id):
    """Pause batch processing"""
    try:
        state = set_pause_state(batch_id, paused=True)
        return {
            "status": "SUCCESS",
            "message": f"Paused batch processing for {batch_id}",
            "paused": state["paused"]
        }
    except Exception as e:
        return {"status": "FAILED", "error": str(e)}

async def resume_batch(batch_id):
    """Resume batch processing"""
    try:
        state = set_pause_state(batch_id, paused=False)
        return {
            "status": "SUCCESS",
            "message": f"Resumed batch processing for {batch_id}",
            "paused": state["paused"]
        }
    except Exception as e:
        return {"status": "FAILED", "error": str(e)}

async def stop_batch(batch_id):
    """Stop batch processing"""
    try:
        state = set_pause_state(batch_id, stopped=True)
        return {
            "status": "SUCCESS",
            "message": f"Stopped batch processing for {batch_id}",
            "stopped": state["stopped"]
        }
    except Exception as e:
        return {"status": "FAILED", "error": str(e)}
