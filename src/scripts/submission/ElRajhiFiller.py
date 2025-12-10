import asyncio
import time
import traceback
import json
import sys
from datetime import datetime, timezone

from bson import ObjectId
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
        "asset_type": "0",
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

async def finalize_elrajhi_submission(page, report_id):
    """Navigate to report page, agree to policy, and submit the report."""
    report_url = f"https://qima.taqeem.sa/report/{report_id}"
    await page.get(report_url)
    await asyncio.sleep(1)

    checkbox = await wait_for_element(page, "#agree", timeout=20)
    if not checkbox:
        return {
            "status": "FAILED",
            "error": "Policy checkbox not found",
            "report_id": report_id
        }

    try:
        await checkbox.click()
    except Exception:
        # Ensure checkbox is checked even if click fails
        await page.evaluate("""
            () => {
                const cb = document.querySelector('#agree');
                if (cb && !cb.checked) {
                    cb.checked = true;
                    cb.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }
        """)

    # Make sure the send button is enabled before clicking
    await page.evaluate("""
        () => {
            const sendBtn = document.querySelector('#send');
            if (sendBtn) sendBtn.disabled = false;
        }
    """)

    send_btn = await wait_for_element(page, "#send", timeout=10)
    if not send_btn:
        return {
            "status": "FAILED",
            "error": "Send button not found",
            "report_id": report_id
        }

    try:
        await send_btn.click()
        await asyncio.sleep(1)
    except Exception as e:
        return {
            "status": "FAILED",
            "error": f"Could not click send button: {e}",
            "report_id": report_id
        }

    return {"status": "SUCCESS", "report_id": report_id}


async def fill_single_report(page, report_record, create_url, batch_id=None, finalize_submission=True):
    """Fill a single report with its asset data"""
    try:
        # Navigate to create report page
        await page.get(create_url)
        await asyncio.sleep(1)

        # Fill form steps with report data
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

                # Fill the single macro with asset data
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

                # Fill macro with asset data
                macro_result = await fill_macro_form(
                    page, 
                    macro_id=macro_id, 
                    macro_data=macro_data, 
                    field_map=macro_form_config["field_map"], 
                    field_types=macro_form_config["field_types"], 
                )
                
                if isinstance(macro_result, dict) and macro_result.get("status") == "FAILED":
                    return {
                        "status": "FAILED",
                        "step": "macro_fill",
                        "error": macro_result.get("error"),
                        "report_id": form_id,
                        "record_id": str(report_record["_id"])
                    }

                if finalize_submission:
                    finalize_result = await finalize_elrajhi_submission(page, form_id)
                    if finalize_result.get("status") == "FAILED":
                        return {
                            "status": "FAILED",
                            "step": "finalize_submission",
                            "error": finalize_result.get("error"),
                            "report_id": form_id,
                            "record_id": str(report_record["_id"])
                        }

                return {
                    "status": "SUCCESS",
                    "report_id": form_id,
                    "record_id": str(report_record["_id"]),
                    "message": "Report and macro filled successfully" if finalize_submission else "Report and macro filled (submission skipped)"
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

        # Cap tabs to the number of reports (no need to open extra tabs)
        tabs_num = max(1, min(int(tabs_num or 1), len(report_records)))

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

        # Create pages for parallel processing
        main_page = browser.tabs[0]
        pages = [main_page] + [await browser.get("", new_tab=True) for _ in range(tabs_num - 1)]

        # Split reports in round-robin order so tabs process alternating reports
        report_chunks = [[] for _ in range(tabs_num)]
        for idx, report in enumerate(report_records):
            report_chunks[idx % tabs_num].append(report)

        completed = 0
        failed = 0
        completed_lock = asyncio.Lock()
        results = []

        # Send initial progress
        initial_progress = {
            "type": "progress",
            "batchId": batch_id,
            "completed": 0,
            "failed": 0,
            "total": total_reports,
            "percentage": 0,
            "paused": False,
            "message": "Starting batch processing..."
        }
        print(json.dumps(initial_progress), flush=True)

        async def process_chunk(report_chunk, page, chunk_index):
            nonlocal completed, failed
            print(f"Processing chunk {chunk_index} with {len(report_chunk)} reports")
            
            for report_index, report_record in enumerate(report_chunk):
                # Check pause/stop state before processing each report
                pause_check = await check_pause_state(batch_id)
                if pause_check["action"] == "stop":
                    print(f"Chunk {chunk_index} stopped by user request")
                    return
                
                try:
                    # Send progress update BEFORE processing
                    async with completed_lock:
                        current_completed = completed
                        current_failed = failed
                        percentage = round((current_completed / total_reports) * 100, 2)
                    
                    pause_state = get_pause_state(batch_id)
                    
                    progress_data = {
                        "type": "progress",
                        "batchId": batch_id,
                        "currentRecordId": str(report_record["_id"]),
                        "completed": current_completed,
                        "failed": current_failed,
                        "total": total_reports,
                        "percentage": percentage,
                        "paused": pause_state.get("paused", False),
                        "message": f"Processing report {current_completed + 1}/{total_reports}"
                    }
                    print(json.dumps(progress_data), flush=True)
                    
                    # Fill the report
                    result = await fill_single_report(
                        page,
                        report_record,
                        create_url,
                        batch_id=batch_id,
                        finalize_submission=finalize_submission
                    )
                    
                    async with completed_lock:
                        if result.get("status") == "FAILED":
                            failed += 1
                        completed += 1
                        current_completed = completed
                        current_failed = failed
                        results.append(result)
                    
                    # Update report record with completion time
                    await db.urgentreports.update_one(
                        {"_id": report_record["_id"]},
                        {"$set": {"endSubmitTime": datetime.now(timezone.utc)}}
                    )
                    
                    # Send progress update AFTER processing
                    percentage = round((current_completed / total_reports) * 100, 2)
                    pause_state = get_pause_state(batch_id)
                    
                    progress_data = {
                        "type": "progress",
                        "batchId": batch_id,
                        "currentRecordId": str(report_record["_id"]),
                        "completed": current_completed,
                        "failed": current_failed,
                        "total": total_reports,
                        "percentage": percentage,
                        "paused": pause_state.get("paused", False),
                        "message": f"Completed report {current_completed}/{total_reports}",
                        "status": result.get("status"),
                        "report_id": result.get("report_id")
                    }
                    print(json.dumps(progress_data), flush=True)
                                
                except Exception as e:
                    async with completed_lock:
                        failed += 1
                        current_completed = completed
                        current_failed = failed
                        results.append({
                            "status": "FAILED",
                            "error": str(e),
                            "record_id": str(report_record["_id"])
                        })
                    
                    # Update report record with completion time even on failure
                    try:
                        await db.urgentreports.update_one(
                            {"_id": report_record["_id"]},
                            {"$set": {"endSubmitTime": datetime.now(timezone.utc)}}
                        )
                    except:
                        pass
                    
                    # Send error progress
                    percentage = round((current_completed / total_reports) * 100, 2)
                    pause_state = get_pause_state(batch_id)
                    
                    error_data = {
                        "type": "progress",
                        "batchId": batch_id,
                        "currentRecordId": str(report_record["_id"]),
                        "completed": current_completed,
                        "failed": current_failed,
                        "total": total_reports,
                        "percentage": percentage,
                        "paused": pause_state.get("paused", False),
                        "message": f"Error processing report: {str(e)}",
                        "status": "FAILED"
                    }
                    print(json.dumps(error_data), flush=True)

        # Create tasks for parallel processing
        tasks = []
        for i, (page, report_chunk) in enumerate(zip(pages, report_chunks)):
            if report_chunk:
                tasks.append(process_chunk(report_chunk, page, i))
        
        await asyncio.gather(*tasks)
        
        # Close extra tabs
        for page in pages[1:]:
            await page.close()
        
        # Clear pause state after completion
        clear_pause_state(batch_id)

        return {
            "status": "SUCCESS",
            "message": f"Completed processing {completed} reports",
            "completed": completed,
            "failed": failed,
            "total": total_reports,
            "results": results
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
