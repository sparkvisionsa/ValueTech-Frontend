import asyncio, traceback, sys, json
from datetime import datetime, timezone

from motor.motor_asyncio import AsyncIOMotorClient

from .formSteps import macro_form_config
from .formFiller import fill_form
from scripts.core.utils import wait_for_element

MONGO_URI = "mongodb+srv://Aasim:userAasim123@electron.cwbi8id.mongodb.net"
client = AsyncIOMotorClient(MONGO_URI)
db = client["test"]

# Global pause state management
pause_states = {}

def get_pause_state(report_id):
    """Get pause state for a report"""
    return pause_states.get(report_id, {"paused": False, "stopped": False})

def set_pause_state(report_id, paused=None, stopped=None):
    """Set pause state for a report"""
    if report_id not in pause_states:
        pause_states[report_id] = {"paused": False, "stopped": False}
    
    if paused is not None:
        pause_states[report_id]["paused"] = paused
    if stopped is not None:
        pause_states[report_id]["stopped"] = stopped
    
    return pause_states[report_id]

def clear_pause_state(report_id):
    """Clear pause state for a report"""
    if report_id in pause_states:
        del pause_states[report_id]

async def check_pause_state(report_id):
    """Check if processing should pause or stop"""
    state = get_pause_state(report_id)
    
    # Check if stopped
    if state.get("stopped"):
        return {"action": "stop"}
    
    # Wait while paused
    while state.get("paused"):
        await asyncio.sleep(0.5)
        state = get_pause_state(report_id)
        
        # Check for stop while paused
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

async def fill_macro_form(page, macro_id, macro_data, field_map, field_types, report_id=None):
    await page.get(f"https://qima.taqeem.sa/report/macro/{macro_id}/edit")
    await wait_for_element(page, "#asset_usage_id", timeout=30)
    await asyncio.sleep(0.5)

    try:
        result = await fill_form(
            page, 
            macro_data, 
            field_map, 
            field_types, 
            is_last_step=True, 
            skip_special_fields=True, 
            report_id=report_id
        )
        return result
    except Exception as e:
        print(f"Filling macro {macro_id} failed: {e}", file=sys.stderr)
        return {"status": "FAILED", "error": str(e)}

async def handle_macro_edits(browser, record, tabs_num=3, record_id=None):
    """
    Edit macros in parallel using multiple tabs with pause/resume support
    Expects asset_data to already have 'id' field populated for each asset
    """    
    asset_data = record.get("asset_data", [])
    if not asset_data: 
        return {"status": "SUCCESS", "message": "No assets to edit"}

    total_assets = len(asset_data)
    
    # Verify all assets have IDs
    missing_ids = [i for i, asset in enumerate(asset_data) if not asset.get("id")]
    if missing_ids:
        error_msg = f"Missing macro IDs for assets at indices: {missing_ids}"
        return {"status": "FAILED", "error": error_msg}
    
    print(f"Asset data with IDs: {[(i, asset.get('id')) for i, asset in enumerate(asset_data)]}")

    # Initialize pause state
    set_pause_state(record_id, paused=False, stopped=False)

    # Create pages for parallel processing
    main_page = browser.tabs[0]
    pages = [main_page] + [await browser.get("", new_tab=True) for _ in range(tabs_num - 1)]

    # Split assets into balanced chunks
    asset_chunks = balanced_chunks(asset_data, tabs_num)

    completed = 0
    failed = 0
    completed_lock = asyncio.Lock()

    async def process_chunk(asset_chunk, page, chunk_index):
        nonlocal completed, failed
        print(f"Processing chunk {chunk_index} with {len(asset_chunk)} assets")
        
        for asset_index, asset in enumerate(asset_chunk):
            # Check pause/stop state before processing each asset
            pause_check = await check_pause_state(record_id)
            if pause_check["action"] == "stop":
                print(f"Chunk {chunk_index} stopped by user request")
                return
            
            macro_id = asset.get("id")
            
            if macro_id is None:
                print(f"ERROR: macro_id is None for asset index {asset_index} in chunk {chunk_index}")
                async with completed_lock:
                    failed += 1
                continue
            
            try:
                print(f"Editing macro {macro_id} (chunk {chunk_index}, asset {asset_index})")
                
                # Send progress update BEFORE processing
                async with completed_lock:
                    current_completed = completed
                    current_failed = failed
                    percentage = round((current_completed / total_assets) * 100, 2)
                
                # Get current pause state
                pause_state = get_pause_state(record_id)
                
                # Send progress with current macro being processed
                progress_data = {
                    "type": "progress",
                    "reportId": record_id,
                    "currentMacroId": macro_id,
                    "completed": current_completed,
                    "failed": current_failed,
                    "total": total_assets,
                    "percentage": percentage,
                    "paused": pause_state.get("paused", False),
                    "message": f"Processing macro {macro_id} ({current_completed}/{total_assets})"
                }
                print(json.dumps(progress_data), flush=True)
                
                result = await fill_macro_form(
                    page,
                    macro_id,
                    asset,
                    macro_form_config["field_map"],
                    macro_form_config["field_types"],
                    record_id
                )
                
                async with completed_lock:
                    if result.get("status") == "FAILED":
                        failed += 1
                    completed += 1
                    current_completed = completed
                    current_failed = failed
                
                # Send progress update AFTER processing
                percentage = round((current_completed / total_assets) * 100, 2)
                pause_state = get_pause_state(record_id)
                
                progress_data = {
                    "type": "progress",
                    "reportId": record_id,
                    "currentMacroId": macro_id,
                    "completed": current_completed,
                    "failed": current_failed,
                    "total": total_assets,
                    "percentage": percentage,
                    "paused": pause_state.get("paused", False),
                    "message": f"Completed macro {macro_id} ({current_completed}/{total_assets})",
                    "status": result.get("status")
                }
                print(json.dumps(progress_data), flush=True)
                            
            except Exception as e:
                async with completed_lock:
                    failed += 1
                    current_completed = completed
                    current_failed = failed
                
                # Send error progress
                percentage = round((current_completed / total_assets) * 100, 2)
                pause_state = get_pause_state(record_id)
                
                error_data = {
                    "type": "progress",
                    "reportId": record_id,
                    "currentMacroId": macro_id,
                    "completed": current_completed,
                    "failed": current_failed,
                    "total": total_assets,
                    "percentage": percentage,
                    "paused": pause_state.get("paused", False),
                    "message": f"Error processing macro {macro_id}: {str(e)}",
                    "status": "FAILED"
                }
                print(json.dumps(error_data), flush=True)

    # Create tasks for parallel processing
    tasks = []
    for i, (page, asset_chunk) in enumerate(zip(pages, asset_chunks)):
        if asset_chunk:
            tasks.append(process_chunk(asset_chunk, page, i))
    
    await asyncio.gather(*tasks)
    
    # Close extra tabs
    for page in pages[1:]:
        await page.close()
    
    # Clear pause state after completion
    clear_pause_state(record_id)
    
    return {
        "status": "SUCCESS",
        "message": f"Completed editing {completed} macros",
        "completed": completed,
        "failed": failed,
        "total": total_assets
    }

async def run_macro_edit(browser, report_id, tabs_num=3):
    
    try:
        record = await db.reports.find_one({"report_id": report_id})
        if not record: 
            return {"status": "FAILED", "error": "Record not found"}
        
        asset_data = record.get("asset_data", [])
        if not asset_data:
            return {"status": "SUCCESS", "message": "No assets to edit"}
        
        # Verify assets have macro IDs
        assets_without_ids = [i for i, asset in enumerate(asset_data) if not asset.get("id")]
        if assets_without_ids:
            error_msg = f"Assets missing macro IDs at indices: {assets_without_ids}"
        
        # Update start time
        await db.reports.update_one(
            {"_id": record["_id"]},
            {"$set": {"editStartTime": datetime.now(timezone.utc)}}
        )

        # Send initial progress
        initial_progress = {
            "type": "progress",
            "reportId": report_id,
            "completed": 0,
            "failed": 0,
            "total": len(asset_data),
            "percentage": 0,
            "paused": False,
            "message": "Starting macro fill process..."
        }
        print(json.dumps(initial_progress), flush=True)

        # Process macro edits
        edit_result = await handle_macro_edits(
            browser, 
            record, 
            tabs_num=tabs_num, 
            record_id=report_id
        )
        
        # Update end time
        await db.reports.update_one(
            {"_id": record["_id"]},
            {"$set": {"editEndTime": datetime.now(timezone.utc)}}
        )
        
        if edit_result.get("status") == "FAILED":
            return edit_result

        return {"status": "SUCCESS", "recordId": str(report_id), "result": edit_result}

    except Exception as e:
        tb = traceback.format_exc()
        
        try:
            await db.reports.update_one(
                {"report_id": report_id},
                {"$set": {"editEndTime": datetime.now(timezone.utc)}}
            )
        except:
            pass
        
        # Clear pause state on error
        clear_pause_state(report_id)
        
        return {"status": "FAILED", "error": str(e), "traceback": tb}

async def pause_macro_edit(report_id):
    """Pause macro editing for a report"""
    try:
        state = set_pause_state(report_id, paused=True)
        return {
            "status": "SUCCESS",
            "message": f"Paused macro editing for report {report_id}",
            "paused": state["paused"]
        }
    except Exception as e:
        return {"status": "FAILED", "error": str(e)}

async def resume_macro_edit(report_id):
    """Resume macro editing for a report"""
    try:
        state = set_pause_state(report_id, paused=False)
        return {
            "status": "SUCCESS",
            "message": f"Resumed macro editing for report {report_id}",
            "paused": state["paused"]
        }
    except Exception as e:
        return {"status": "FAILED", "error": str(e)}

async def stop_macro_edit(report_id):
    """Stop macro editing for a report"""
    try:
        state = set_pause_state(report_id, stopped=True)
        return {
            "status": "SUCCESS",
            "message": f"Stopped macro editing for report {report_id}",
            "stopped": state["stopped"]
        }
    except Exception as e:
        return {"status": "FAILED", "error": str(e)}