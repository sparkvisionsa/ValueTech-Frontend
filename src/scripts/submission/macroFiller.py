import asyncio, traceback, sys, json
from datetime import datetime, timezone

from motor.motor_asyncio import AsyncIOMotorClient

from .formSteps import macro_form_config
from .formFiller import fill_form
from scripts.core.utils import wait_for_element

MONGO_URI = "mongodb+srv://Aasim:userAasim123@electron.cwbi8id.mongodb.net"
client = AsyncIOMotorClient(MONGO_URI)
db = client["test"]

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
    """Fill and submit a single macro edit form"""
    await page.get(f"https://qima.taqeem.sa/report/macro/{macro_id}/edit")
    
    await wait_for_element(page, "#value_base_id", timeout=30)

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
    Edit macros in parallel using multiple tabs
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
            macro_id = asset.get("id")
            
            if macro_id is None:
                print(f"ERROR: macro_id is None for asset index {asset_index} in chunk {chunk_index}")
                async with completed_lock:
                    failed += 1
                continue
            
            try:
                print(f"Editing macro {macro_id} (chunk {chunk_index}, asset {asset_index})")
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
                
                percentage = round((current_completed / total_assets) * 100, 2)
                print(json.dumps("percentage", percentage))
                            
            except Exception as e:
                async with completed_lock:
                    failed += 1

    # Create tasks for parallel processing
    tasks = []
    for i, (page, asset_chunk) in enumerate(zip(pages, asset_chunks)):
        if asset_chunk:
            tasks.append(process_chunk(asset_chunk, page, i))
    
    await asyncio.gather(*tasks)
    
    # Close extra tabs
    for page in pages[1:]:
        await page.close()
    
    return {
        "status": "SUCCESS",
        "message": f"Completed editing {completed} macros",
        "failed": failed
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
        
        return {"status": "FAILED", "error": str(e), "traceback": tb}