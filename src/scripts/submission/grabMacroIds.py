import asyncio, sys
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient

from scripts.core.utils import wait_for_element, safe_query_selector_all, wait_for_table_rows
from scripts.core.processControl import (
    get_process_manager,
    check_and_wait,
    create_process,
    clear_process,
    update_progress,
    emit_progress
)

# MongoDB connection setup
def get_motor_client():
    MONGO_URI = "mongodb+srv://Aasim:userAasim123@electron.cwbi8id.mongodb.net"
    return AsyncIOMotorClient(MONGO_URI)

async def update_report_with_macro_ids(report_id, macro_ids_with_pages, db_name='test', collection_name='reports'):
    client = None
    try:
        client = get_motor_client()
        db = client[db_name]
        
        # Try to find the report in the specified collection first
        collection = db[collection_name]
        existing_report = await collection.find_one({'report_id': report_id})
        
        # If not found, try other possible collections
        if not existing_report:
            possible_collections = [
                'multiapproachreports',
                'submitreportsquicklies',
                'submitreportsquickly',
                'reports',
                'duplicatereports'
            ]
            
            for coll_name in possible_collections:
                if coll_name == collection_name:
                    continue  # Already checked
                test_collection = db[coll_name]
                existing_report = await test_collection.find_one({'report_id': report_id})
                if existing_report:
                    collection = test_collection
                    collection_name = coll_name
                    print(f"[MONGO_DB] Found report {report_id} in collection: {coll_name}", file=sys.stderr)
                    break
        
        if not existing_report:
            print(f"[MONGO_DB] ERROR: Report with ID {report_id} not found in any collection", file=sys.stderr)
            return False
        
        print(f"[MONGO_DB] Found existing report {report_id}", file=sys.stderr)
        
        # Get existing asset_data
        existing_assets = existing_report.get('asset_data', [])
        
        if not existing_assets:
            print(f"[MONGO_DB] ERROR: No asset_data found in report {report_id}", file=sys.stderr)
            return False
        
        print(f"[MONGO_DB] Found {len(existing_assets)} existing assets in report", file=sys.stderr)
        
        # Update each asset with macro_id and page number based on index
        # Assumes the order matches between macro_ids_with_pages and existing assets
        updated_assets = []
        for i, (asset, (macro_id, page_num)) in enumerate(zip(existing_assets, macro_ids_with_pages)):
            # Keep all existing asset data
            updated_asset = asset.copy()
            # Only update the id and pg_no fields
            updated_asset['id'] = str(macro_id)
            updated_asset['pg_no'] = str(page_num)
            updated_assets.append(updated_asset)
            print(f"[MONGO_DB] Updated asset {i}: id={macro_id}, pg_no={page_num}", file=sys.stderr)
        
        # If there are more assets in DB than macro_ids collected, keep them as is
        if len(existing_assets) > len(macro_ids_with_pages):
            remaining_assets = existing_assets[len(macro_ids_with_pages):]
            updated_assets.extend(remaining_assets)
            print(f"[MONGO_DB] Kept {len(remaining_assets)} additional assets unchanged", file=sys.stderr)
        
        # Update the report with modified asset data
        update_result = await collection.update_one(
            {'report_id': report_id},
            {
                '$set': {
                    'asset_data': updated_assets,
                    'updatedAt': datetime.now()
                }
            }
        )
        
        if update_result.modified_count > 0:
            print(f"[MONGO_DB] Successfully updated report {report_id} with {len(macro_ids_with_pages)} macro IDs and page numbers", file=sys.stderr)
            return True
        else:
            print(f"[MONGO_DB] Report {report_id} found but no modifications made (possibly same data)", file=sys.stderr)
            return True
            
    except Exception as e:
        print(f"[MONGO_DB] Error updating MongoDB: {str(e)}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        return False
    finally:
        if client:
            client.close()

def get_balanced_page_distribution(total_pages, num_tabs):
    """
    Distribute pages evenly across tabs
    
    Args:
        total_pages: Total number of pages to process
        num_tabs: Number of browser tabs available
    
    Returns:
        List of lists, where each inner list contains page numbers for that tab
    """
    if total_pages <= 0 or num_tabs <= 0:
        return [[] for _ in range(num_tabs)]
    
    base_pages_per_tab = total_pages // num_tabs
    remainder = total_pages % num_tabs
    
    distribution = []
    current_page = 1
    
    for tab_index in range(num_tabs):
        pages_this_tab = base_pages_per_tab + (1 if tab_index < remainder else 0)
        
        if pages_this_tab > 0:
            tab_pages = list(range(current_page, current_page + pages_this_tab))
            distribution.append(tab_pages)
            current_page += pages_this_tab
        else:
            distribution.append([])
    
    return distribution

async def get_macro_ids_from_page(page, base_url, page_num, tab_id, process_id=None):

    local_macro_ids = []
    print(f"[MACRO_ID-TAB-{tab_id}] Processing page {page_num}", file=sys.stderr)
    
    try:
        # Check pause/stop state
        if process_id:
            action = await check_and_wait(process_id)
            if action == "stop":
                print(f"[MACRO_ID-TAB-{tab_id}] Process stopped by user request", file=sys.stderr)
                return local_macro_ids
        
        # Navigate to the page
        page_url = f"{base_url}?page={page_num}" if page_num > 1 else base_url
        await page.get(page_url)
        await asyncio.sleep(2)
        
        # Process all sub-pages (internal pagination)
        while True:
            # Check pause/stop state
            if process_id:
                action = await check_and_wait(process_id)
                if action == "stop":
                    print(f"[MACRO_ID-TAB-{tab_id}] Process stopped by user request", file=sys.stderr)
                    return local_macro_ids
            
            await asyncio.sleep(2)
            
            table_ready = await wait_for_table_rows(page, timeout=100)
            if not table_ready:
                print(f"[MACRO_ID-TAB-{tab_id}] Table not found on page {page_num}, breaking", file=sys.stderr)
                break
            
            await asyncio.sleep(3)
            
            macro_cells = await safe_query_selector_all(page, "#m-table tbody tr td:nth-child(1) a")
            
            if not macro_cells:
                print(f"[MACRO_ID-TAB-{tab_id}] No macro cells found on page {page_num}, breaking", file=sys.stderr)
                break
            
            processed_count = 0
            for i, macro_cell in enumerate(macro_cells):
                # Check pause/stop state periodically
                if process_id and i % 5 == 0:
                    action = await check_and_wait(process_id)
                    if action == "stop":
                        print(f"[MACRO_ID-TAB-{tab_id}] Process stopped by user request", file=sys.stderr)
                        return local_macro_ids
                
                try:
                    macro_id_text = macro_cell.text if macro_cell else None
                    if not macro_id_text or not macro_id_text.strip():
                        continue
                    
                    macro_id = int(macro_id_text.strip())
                    local_macro_ids.append((macro_id, page_num))
                    processed_count += 1
                    
                except (ValueError, TypeError) as e:
                    print(f"[MACRO_ID-TAB-{tab_id}] WARNING Invalid macro ID on row {i}: {e}", file=sys.stderr)
                    continue
                except Exception as e:
                    print(f"[MACRO_ID-TAB-{tab_id}] ERROR processing row {i}: {e}", file=sys.stderr)
                    continue
            
            print(f"[MACRO_ID-TAB-{tab_id}] Page {page_num}: Found {processed_count} macro IDs", file=sys.stderr)
            
            # Check for next button (internal pagination)
            next_btn = await wait_for_element(page, "#m-table_next", timeout=5)
            if next_btn:
                attributes = next_btn.attrs
                classes = attributes.get("class_")
                if classes and "disabled" not in classes:
                    print(f"[MACRO_ID-TAB-{tab_id}] Clicking next sub-page button on page {page_num}", file=sys.stderr)
                    await next_btn.click()
                    await asyncio.sleep(3)
                    continue
            
            print(f"[MACRO_ID-TAB-{tab_id}] No more sub-pages on page {page_num}", file=sys.stderr)
            break
            
    except Exception as e:
        print(f"[MACRO_ID-TAB-{tab_id}] Error processing page {page_num}: {str(e)}", file=sys.stderr)
    
    return local_macro_ids

async def update_report_pg_count(report_id, pg_count, db_name='test', collection_name='reports'):
    """
    Update the report document's pg_count field to the given number.
    Checks multiple collections if the report is not found in the specified collection.
    Returns True on success, False on error.
    """
    client = None
    try:
        client = get_motor_client()
        db = client[db_name]
        
        # Try to find the report in the specified collection first
        collection = db[collection_name]
        existing_report = await collection.find_one({'report_id': report_id})
        
        # If not found, try other possible collections
        if not existing_report:
            possible_collections = [
                'multiapproachreports',
                'submitreportsquicklies',
                'submitreportsquickly',
                'reports',
                'duplicatereports'
            ]
            
            for coll_name in possible_collections:
                if coll_name == collection_name:
                    continue  # Already checked
                test_collection = db[coll_name]
                existing_report = await test_collection.find_one({'report_id': report_id})
                if existing_report:
                    collection = test_collection
                    print(f"[MONGO_DB] Found report {report_id} in collection: {coll_name} for pg_count update", file=sys.stderr)
                    break

        result = await collection.update_one(
            {'report_id': report_id},
            {'$set': {'pg_count': int(pg_count), 'updatedAt': datetime.now()}}
        )

        if result.modified_count > 0:
            print(f"[MONGO_DB] Successfully set pg_count={pg_count} for report {report_id}", file=sys.stderr)
        else:
            # Document may exist but field already equal to value; treat as success
            print(f"[MONGO_DB] pg_count update for report {report_id} completed (modified_count={result.modified_count})", file=sys.stderr)
        return True

    except Exception as e:
        print(f"[MONGO_DB] Error updating pg_count for report {report_id}: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        return False
    finally:
        if client:
            client.close()

async def get_all_macro_ids_parallel(browser, report_id, tabs_num=3):
    try:
        if not report_id:
            print("[MACRO_ID] No report_id provided", file=sys.stderr)
            return []
        
        # Create process state for pause/resume/stop
        process_id = f"grab-macro-ids-{report_id}"
        process_manager = get_process_manager()
        process_state = create_process(
            process_id=process_id,
            process_type="grab-macro-ids",
            total=100,  # We'll update this once we know total pages
            report_id=report_id,
            tabs_num=tabs_num
        )
        
        base_url = f"https://qima.taqeem.sa/report/{report_id}"
        main_page = browser.tabs[0]
        await main_page.get(base_url)
        await asyncio.sleep(2)
        
        await wait_for_element(main_page, "li", timeout=30)
        
        # Get total number of pages from pagination
        pagination_links = await main_page.query_selector_all('ul.pagination li a')
        page_numbers = []
        for link in pagination_links:
            text = link.text
            if text and text.strip().isdigit():
                page_numbers.append(int(text.strip()))
        
        total_pages = max(page_numbers) if page_numbers else 1
        print(f"[MACRO_ID] Found {total_pages} pages to scan", file=sys.stderr)
        
        # Update total in process state
        await update_progress(
            process_id, 
            completed=0,
            failed=0,
            total=total_pages,
            emit=True
        )
        
        await update_report_pg_count(report_id, total_pages)
        
        # Create pages for parallel processing
        pages = [main_page] + [
            await browser.get("about:blank", new_tab=True) 
            for _ in range(min(tabs_num - 1, total_pages - 1))
        ]
        
        # Distribute pages across tabs
        page_chunks = get_balanced_page_distribution(total_pages, len(pages))
        print(f"[MACRO_ID] Page distribution: {[len(chunk) for chunk in page_chunks]} pages per tab", file=sys.stderr)
        
        all_macro_ids_with_pages = []
        macro_ids_lock = asyncio.Lock()
        
        async def process_pages_chunk(page, page_numbers_chunk, tab_id):
            """Process a chunk of pages in a single tab"""
            local_macro_ids_with_pages = []
            print(f"[MACRO_ID-TAB-{tab_id}] Processing pages: {page_numbers_chunk}", file=sys.stderr)
            
            for page_num in page_numbers_chunk:
                # Check pause/stop state before processing each page
                action = await check_and_wait(process_id)
                if action == "stop":
                    print(f"[MACRO_ID-TAB-{tab_id}] Process stopped by user request", file=sys.stderr)
                    break
                
                page_macro_ids = await get_macro_ids_from_page(page, base_url, page_num, tab_id, process_id)
                local_macro_ids_with_pages.extend(page_macro_ids)
                
                # Update progress after each page
                async with macro_ids_lock:
                    current_total = len(all_macro_ids_with_pages) + len(local_macro_ids_with_pages)
                
                await update_progress(
                    process_id,
                    completed=len(page_numbers_chunk[:page_numbers_chunk.index(page_num) + 1]),
                    emit=True
                )
                emit_progress(process_id, current_item=f"Page {page_num}", message=f"Processed page {page_num}")
            
            async with macro_ids_lock:
                all_macro_ids_with_pages.extend(local_macro_ids_with_pages)
            
            print(f"[MACRO_ID-TAB-{tab_id}] Completed processing, found {len(local_macro_ids_with_pages)} macro IDs", file=sys.stderr)
        
        # Process pages in parallel
        tasks = []
        for i, (page, chunk) in enumerate(zip(pages, page_chunks)):
            if chunk:
                tasks.append(process_pages_chunk(page, chunk, i))
        
        await asyncio.gather(*tasks)
        
        # Close extra tabs
        for p in pages[1:]:
            await p.close()
        
        print(f"[MACRO_ID] ID collection complete. Found {len(all_macro_ids_with_pages)} macro IDs", file=sys.stderr)
        
        # Update MongoDB with the collected data
        if all_macro_ids_with_pages:
            success = await update_report_with_macro_ids(report_id, all_macro_ids_with_pages)
            if success:
                print(f"[MACRO_ID] Successfully updated report in MongoDB", file=sys.stderr)
            else:
                print(f"[MACRO_ID] Failed to update report in MongoDB", file=sys.stderr)
        
        clear_process(process_id)
        
        return {"status": "SUCCESS", "macro_ids_with_pages": all_macro_ids_with_pages}
        
    except Exception as e:
        print(f"[MACRO_ID] Error in get_all_macro_ids_parallel: {str(e)}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        
        # Clear process on error
        process_id = f"grab-macro-ids-{report_id}"
        clear_process(process_id)
        
        return {"status": "FAILED", "error": str(e)}


async def retry_get_missing_macro_ids(browser, report_id, tabs_num=3, db_name='test', collection_name='reports'):
    """
    Retry version: only process pages for which assets in the report are missing pg_no / id.
    """
    client = None
    try:
        # Create process state for pause/resume/stop
        process_id = f"retry-macro-ids-{report_id}"
        process_manager = get_process_manager()
        process_state = create_process(
            process_id=process_id,
            process_type="retry-macro-ids",
            total=100,  # We'll update this once we know missing pages
            report_id=report_id,
            tabs_num=tabs_num
        )
        
        client = get_motor_client()
        db = client[db_name]
        collection = db[collection_name]

        # Load the report document
        report = await collection.find_one({'report_id': report_id})
        if not report:
            print(f"[MONGO_DB] ERROR: Report with ID {report_id} not found", file=sys.stderr)
            clear_process(process_id)
            return {"status": "FAILED", "error": f"Report with ID {report_id} not found"}

        existing_assets = report.get('asset_data', [])
        if not existing_assets:
            print(f"[MONGO_DB] ERROR: No asset_data found in report {report_id}", file=sys.stderr)
            clear_process(process_id)
            return {"status": "FAILED", "error": f"No asset_data found in report {report_id}"}

        # Determine total pages from live site (like existing logic)
        base_url = f"https://qima.taqeem.sa/report/{report_id}"
        main_page = browser.tabs[0]
        await main_page.get(base_url)
        await asyncio.sleep(2)
        await wait_for_element(main_page, "li", timeout=30)
        pagination_links = await main_page.query_selector_all('ul.pagination li a')
        page_numbers = []
        for link in pagination_links:
            text = link.text
            if text and text.strip().isdigit():
                page_numbers.append(int(text.strip()))
        total_pages = max(page_numbers) if page_numbers else 1
        print(f"[RETRY] Found {total_pages} total pages", file=sys.stderr)
        await update_report_pg_count(report_id, total_pages, db_name=db_name, collection_name=collection_name)

        # Find which pg_no are already present in existing_assets
        present_pg_nos = set()
        for asset in existing_assets:
            pg = asset.get('pg_no')
            if pg is not None:
                try:
                    present_pg_nos.add(int(pg))
                except ValueError:
                    pass

        # Calculate missing page numbers
        all_pg_nos = set(range(1, total_pages + 1))
        missing_pg_nos = sorted(all_pg_nos - present_pg_nos)
        
        if not missing_pg_nos:
            print(f"[RETRY] No missing pages to retry for report {report_id}", file=sys.stderr)
            clear_process(process_id)
            return {"status": "NO_MISSING_PAGES", "macro_ids_with_pages": []}

        print(f"[RETRY] Missing page numbers to process: {missing_pg_nos}", file=sys.stderr)
        
        # Update total in process state
        await update_progress(
            process_id, 
            completed=0,
            failed=0,
            total=len(missing_pg_nos),
            emit=True
        )

        # Prepare tabs (reuse existing logic)
        pages = [main_page] + [
            await browser.get("about:blank", new_tab=True)
            for _ in range(min(tabs_num - 1, len(missing_pg_nos)))
        ]
        page_chunks = get_balanced_page_distribution(len(missing_pg_nos), len(pages))
        # But we want page_chunks to contain actual page numbers, not counts
        # So map sequentially
        pg_iter = iter(missing_pg_nos)
        page_chunks = [
            [next(pg_iter) for _ in chunk] for chunk in page_chunks
        ]

        all_macro_ids_with_pages = []
        macro_ids_lock = asyncio.Lock()

        async def process_pages_chunk(page, page_numbers_chunk, tab_id):
            local = []
            for idx, pg in enumerate(page_numbers_chunk):
                # Check pause/stop state before processing each page
                action = await check_and_wait(process_id)
                if action == "stop":
                    print(f"[RETRY-TAB-{tab_id}] Process stopped by user request", file=sys.stderr)
                    break
                
                ids = await get_macro_ids_from_page(page, base_url, pg, tab_id, process_id)
                local.extend(ids)
                
                # Update progress
                async with macro_ids_lock:
                    current_total = len(all_macro_ids_with_pages) + len(local)
                
                await update_progress(
                    process_id,
                    completed=len(page_numbers_chunk[:idx + 1]),
                    emit=True
                )
                emit_progress(process_id, current_item=f"Page {pg}", message=f"Processed page {pg}")
            
            async with macro_ids_lock:
                all_macro_ids_with_pages.extend(local)
            print(f"[RETRY-TAB-{tab_id}] Completed pages {page_numbers_chunk}, found {len(local)} macro IDs", file=sys.stderr)

        tasks = []
        for i, (page, chunk) in enumerate(zip(pages, page_chunks)):
            if chunk:
                tasks.append(process_pages_chunk(page, chunk, i))
        await asyncio.gather(*tasks)

        for p in pages[1:]:
            await p.close()

        if all_macro_ids_with_pages:
            # Now update only those assets missing pg_no — we need to merge carefully
            # First, build a map page_no -> list of macro_ids
            by_page = {}
            for macro_id, pg in all_macro_ids_with_pages:
                by_page.setdefault(pg, []).append(macro_id)

            # Update existing asset_data list
            updated_assets = []
            idx = 0
            # We'll iterate old assets; for each asset lacking pg_no/id, we assign from by_page in order
            for asset in existing_assets:
                if asset.get('pg_no') in (None, '', 0):
                    # find next available macro_id for missing page
                    # get corresponding page — this is ambiguous if multiple assets per page
                    # For simplicity, assign first unused macro_id from first missing page, then remove it
                    # (you may need a more robust mapping depending on your data)
                    for pg, id_list in by_page.items():
                        if id_list:
                            new_id = id_list.pop(0)
                            asset = asset.copy()
                            asset['id'] = str(new_id)
                            asset['pg_no'] = str(pg)
                            break
                    updated_assets.append(asset)
                else:
                    updated_assets.append(asset)

            # Update DB
            result = await collection.update_one(
                {'report_id': report_id},
                {'$set': {'asset_data': updated_assets, 'updatedAt': datetime.now()}}
            )
            print(f"[MONGO_DB] Retry update for report {report_id}, modified_count={result.modified_count}", file=sys.stderr)
            
            clear_process(process_id)
            return {"status": "RETRY_SUCCESS", "macro_ids_with_pages": all_macro_ids_with_pages}
        else:
            print(f"[RETRY] No new macro IDs found during retry for report {report_id}", file=sys.stderr)
            clear_process(process_id)
            return {"status": "RETRY_NO_IDS_FOUND", "macro_ids_with_pages": []}

    except Exception as e:
        print(f"[RETRY] Error in retry_get_missing_macro_ids: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        
        # Clear process on error
        process_id = f"retry-macro-ids-{report_id}"
        clear_process(process_id)
        
        return {"status": "FAILED", "error": str(e)}
    finally:
        if client:
            client.close()


# ==============================
# Pause/Resume/Stop handlers for grab-macro-ids
# ==============================

async def pause_grab_macro_ids(report_id):
    """Pause macro ID grabbing process"""
    try:
        process_manager = get_process_manager()
        state = process_manager.pause_process(f"grab-macro-ids-{report_id}")
        
        if not state:
            return {
                "status": "FAILED",
                "error": f"No active macro ID grabbing process found for report {report_id}"
            }
        
        return {
            "status": "SUCCESS",
            "message": f"Paused macro ID grabbing for report {report_id}",
            "paused": state.paused
        }
    except Exception as e:
        return {"status": "FAILED", "error": str(e)}


async def resume_grab_macro_ids(report_id):
    """Resume macro ID grabbing process"""
    try:
        process_manager = get_process_manager()
        state = process_manager.resume_process(f"grab-macro-ids-{report_id}")
        
        if not state:
            return {
                "status": "FAILED",
                "error": f"No active macro ID grabbing process found for report {report_id}"
            }
        
        return {
            "status": "SUCCESS",
            "message": f"Resumed macro ID grabbing for report {report_id}",
            "paused": state.paused
        }
    except Exception as e:
        return {"status": "FAILED", "error": str(e)}


async def stop_grab_macro_ids(report_id):
    """Stop macro ID grabbing process"""
    try:
        process_manager = get_process_manager()
        state = process_manager.stop_process(f"grab-macro-ids-{report_id}")
        
        if not state:
            return {
                "status": "FAILED",
                "error": f"No active macro ID grabbing process found for report {report_id}"
            }
        
        return {
            "status": "SUCCESS",
            "message": f"Stopped macro ID grabbing for report {report_id}",
            "stopped": state.stopped
        }
    except Exception as e:
        return {"status": "FAILED", "error": str(e)}


# ==============================
# Pause/Resume/Stop handlers for retry-macro-ids
# ==============================

async def pause_retry_macro_ids(report_id):
    """Pause retry macro ID process"""
    try:
        process_manager = get_process_manager()
        state = process_manager.pause_process(f"retry-macro-ids-{report_id}")
        
        if not state:
            return {
                "status": "FAILED",
                "error": f"No active retry macro ID process found for report {report_id}"
            }
        
        return {
            "status": "SUCCESS",
            "message": f"Paused retry macro ID process for report {report_id}",
            "paused": state.paused
        }
    except Exception as e:
        return {"status": "FAILED", "error": str(e)}


async def resume_retry_macro_ids(report_id):
    """Resume retry macro ID process"""
    try:
        process_manager = get_process_manager()
        state = process_manager.resume_process(f"retry-macro-ids-{report_id}")
        
        if not state:
            return {
                "status": "FAILED",
                "error": f"No active retry macro ID process found for report {report_id}"
            }
        
        return {
            "status": "SUCCESS",
            "message": f"Resumed retry macro ID process for report {report_id}",
            "paused": state.paused
        }
    except Exception as e:
        return {"status": "FAILED", "error": str(e)}


async def stop_retry_macro_ids(report_id):
    """Stop retry macro ID process"""
    try:
        process_manager = get_process_manager()
        state = process_manager.stop_process(f"retry-macro-ids-{report_id}")
        
        if not state:
            return {
                "status": "FAILED",
                "error": f"No active retry macro ID process found for report {report_id}"
            }
        
        return {
            "status": "SUCCESS",
            "message": f"Stopped retry macro ID process for report {report_id}",
            "stopped": state.stopped
        }
    except Exception as e:
        return {"status": "FAILED", "error": str(e)}