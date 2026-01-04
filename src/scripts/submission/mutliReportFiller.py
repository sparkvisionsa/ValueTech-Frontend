import asyncio, traceback, sys

from datetime import datetime, timezone
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient
from scripts.core.company_context import build_report_create_url, require_selected_company
from scripts.core.utils import wait_for_element
from scripts.core.browser import spawn_new_browser
from .formSteps import form_steps
from .formFiller import fill_form
from .macroFiller import handle_macro_edits
from .createMacros import run_create_assets_by_count
from .grabMacroIds import update_report_pg_count, get_balanced_page_distribution, get_macro_ids_from_page, update_report_with_macro_ids

MONGO_URI = "mongodb+srv://Aasim:userAasim123@electron.cwbi8id.mongodb.net"
client = AsyncIOMotorClient(MONGO_URI)
db = client["test"]


async def navigate_to_existing_report_assets(browser, report_id):
    asset_creation_url = f"https://qima.taqeem.sa/report/asset/create/{report_id}"

    main_page = await browser.get(asset_creation_url)
    await asyncio.sleep(2)

    current_url = await main_page.evaluate("window.location.href")
    if str(report_id) not in current_url:
        return None

    return main_page

async def get_all_macro_ids_parallel(browser, report_id, tabs_num=3, collection_name=None):
    try:
        if not report_id:
            print("[MACRO_ID] No report_id provided", file=sys.stderr)
            return []
        
        # Use provided collection_name or default
        if collection_name is None:
            collection_name = 'multiapproachreports'
        
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
        await update_report_pg_count(report_id, total_pages, collection_name=collection_name)
        
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
                page_macro_ids = await get_macro_ids_from_page(page, base_url, page_num, tab_id)
                local_macro_ids_with_pages.extend(page_macro_ids)
            
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
        
        if all_macro_ids_with_pages:
            # Use provided collection_name or try to detect it
            if collection_name is None:
                collection_name = 'multiapproachreports'  # Default fallback
            
            success = await update_report_with_macro_ids(report_id, all_macro_ids_with_pages, collection_name=collection_name)
            if success:
                print(f"[MACRO_ID] Successfully updated report in MongoDB", file=sys.stderr)
            else:
                print(f"[MACRO_ID] Failed to update report in MongoDB", file=sys.stderr)
        
        return {"status": "SUCCESS", "macro_ids_with_pages": all_macro_ids_with_pages}
        
    except Exception as e:
        print(f"[MACRO_ID] Error in get_all_macro_ids_parallel: {str(e)}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        return []

async def find_record_in_collections(record_id_obj, collection_names):
    """Try to find a record in multiple collections, return (record, collection) or (None, None)"""
    for coll_name in collection_names:
        collection = db[coll_name]
        record = await collection.find_one({"_id": record_id_obj})
        if record:
            return record, collection
    return None, None

async def create_report_for_record(browser, record, tabs_num=3, collection=None):
    try:
        if not record or "_id" not in record:
            return {"status": "FAILED", "error": "Invalid record object (missing _id)"}

        # Determine which collection this record belongs to if not provided
        if collection is None:
            collection_names = [
                "multiapproachreports",
                "submitreportsquicklies",
                "submitreportsquickly"
            ]
            _, collection = await find_record_in_collections(record["_id"], collection_names)
            if collection is None:
                collection = db.multiapproachreports  # Default fallback

        try:
            require_selected_company()
            create_url = build_report_create_url()
        except Exception as ctx_err:
            return {"status": "FAILED", "error": str(ctx_err)}

        # Mark start time
        await collection.update_one(
            {"_id": record["_id"]},
            {"$set": {"startSubmitTime": datetime.now(timezone.utc)}}
        )

        results = []
        record["number_of_macros"] = str(len(record.get("asset_data", [])))

        # Normalize valuers to shape expected by fill_valuers (valuerName/percentage)
        valuers = []
        for v in record.get("valuers", []):
            name = v.get("valuer_name") or v.get("valuerName")
            pct = v.get("contribution_percentage") or v.get("percentage")
            if name:
                valuers.append({"valuerName": name, "percentage": pct or 0})
        record["valuers"] = valuers

        # Open the initial create-report page
        main_page = await browser.get(create_url)
        await asyncio.sleep(1)

        for step_num, step_config in enumerate(form_steps, 1):
            is_last = step_num == len(form_steps)

            results.append({
                "status": "STEP_STARTED",
                "step": step_num,
                "recordId": str(record["_id"])
            })

            if step_num == 2 and len(record.get("asset_data", [])) > 10:
                result = await run_create_assets_by_count(
                    browser,
                    len(record.get("asset_data")),
                    tabs_num=tabs_num,
                    batch_size=10
                )
            else:
                result = await fill_form(
                    main_page,
                    record,
                    step_config["field_map"],
                    step_config["field_types"],
                    is_last,
                )

            if isinstance(result, dict) and result.get("status") == "FAILED":
                results.append({
                    "status": "FAILED",
                    "step": step_num,
                    "recordId": str(record["_id"]),
                    "error": result.get("error")
                })

                # Mark end time even on failure
                await collection.update_one(
                    {"_id": record["_id"]},
                    {"$set": {"endSubmitTime": datetime.now(timezone.utc)}}
                )
                return {"status": "FAILED", "results": results}

            if is_last:
                main_url = await main_page.evaluate("window.location.href")
                form_id = main_url.split("/")[-1]
                if not form_id:
                    results.append({
                        "status": "FAILED",
                        "step": "report_id",
                        "recordId": str(record["_id"]),
                        "error": "Could not determine report_id"
                    })

                    await collection.update_one(
                        {"_id": record["_id"]},
                        {"$set": {"endSubmitTime": datetime.now(timezone.utc)}}
                    )
                    return {"status": "FAILED", "results": results}

                # Save report_id on document
                await collection.update_one(
                    {"_id": record["_id"]},
                    {"$set": {"report_id": form_id}}
                )
                record["report_id"] = form_id

                # Determine collection name for macro ID update
                collection_name_map = {
                    db.multiapproachreports: 'multiapproachreports',
                    db.submitreportsquicklies: 'submitreportsquicklies',
                    db.submitreportsquickly: 'submitreportsquickly'
                }
                coll_name = collection_name_map.get(collection, 'multiapproachreports')

                # Get macro IDs
                macro_ids_result = await get_all_macro_ids_parallel(browser, form_id, tabs_num=tabs_num, collection_name=coll_name)
                if isinstance(macro_ids_result, dict) and macro_ids_result.get("status") == "FAILED":
                    results.append({
                        "status": "FAILED",
                        "step": "macro_ids",
                        "recordId": str(record["_id"]),
                        "error": macro_ids_result.get("error")
                    })

                    await collection.update_one(
                        {"_id": record["_id"]},
                        {"$set": {"endSubmitTime": datetime.now(timezone.utc)}}
                    )
                    return {"status": "FAILED", "results": results}
                
                # Reload record from database to get updated macro IDs
                # Save the original record ID before reloading
                original_record_id = record.get("_id") if record else None
                record = await collection.find_one({"report_id": form_id})
                if not record:
                    results.append({
                        "status": "FAILED",
                        "step": "macro_ids",
                        "recordId": str(original_record_id) if original_record_id else form_id,
                        "error": "Could not reload record after macro ID update"
                    })
                    # Try to update using form_id if we have it
                    await collection.update_one(
                        {"report_id": form_id},
                        {"$set": {"endSubmitTime": datetime.now(timezone.utc)}}
                    )
                    return {"status": "FAILED", "results": results}

                # Handle macro edits
                macro_result = await handle_macro_edits(browser, record, tabs_num=tabs_num)
                if isinstance(macro_result, dict) and macro_result.get("status") == "FAILED":
                    results.append({
                        "status": "FAILED",
                        "step": "macro_edit",
                        "recordId": str(record["_id"]),
                        "error": macro_result.get("error")
                    })

                    await collection.update_one(
                        {"_id": record["_id"]},
                        {"$set": {"endSubmitTime": datetime.now(timezone.utc)}}
                    )
                    return {"status": "FAILED", "results": results}

                results.append({
                    "status": "MACRO_EDIT_SUCCESS",
                    "message": "All macros filled",
                    "recordId": str(record["_id"])
                })

        # Mark successful end time
        await collection.update_one(
            {"_id": record["_id"]},
            {"$set": {"endSubmitTime": datetime.now(timezone.utc)}}
        )

        return {"status": "SUCCESS", "results": results}

    except Exception as e:
        tb = traceback.format_exc()
        # Mark end time even on unexpected exception
        # Determine collection for error handling if not already set
        if record and "_id" in record:
            if collection is None:
                collection_names = [
                    "multiapproachreports",
                    "submitreportsquicklies",
                    "submitreportsquickly"
                ]
                _, collection = await find_record_in_collections(record["_id"], collection_names)
                if collection is None:
                    collection = db.multiapproachreports  # Default fallback
            await collection.update_one(
                {"_id": record["_id"]},
                {"$set": {"endSubmitTime": datetime.now(timezone.utc)}}
            )
        return {"status": "FAILED", "error": str(e), "traceback": tb}

async def create_new_report(browser, record_id, tabs_num=3):
    try:
        # Convert record_id to string if needed
        record_id_str = str(record_id).strip()
        
        if not ObjectId.is_valid(record_id_str):
            return {"status": "FAILED", "error": f"Invalid record_id format: {record_id_str}"}

        record_id_obj = ObjectId(record_id_str)
        
        # Try to find record in all possible collections
        # Order: multiapproachreports, submitreportsquicklies (plural - Mongoose default), submitreportsquickly (singular)
        collection_names = [
            "multiapproachreports",
            "submitreportsquicklies",  # Mongoose pluralizes: SubmitReportsQuickly -> submitreportsquicklies
            "submitreportsquickly"     # Fallback in case custom collection name is used
        ]
        
        record, collection = await find_record_in_collections(record_id_obj, collection_names)
        
        if not record:
            # List available collections for debugging
            try:
                all_collections = await db.list_collection_names()
                submit_collections = [c for c in all_collections if 'submit' in c.lower() and 'quick' in c.lower()]
                error_msg = f"Record not found with id: {record_id_str}. "
                if submit_collections:
                    error_msg += f"Available submit collections: {', '.join(submit_collections)}. "
                error_msg += f"Checked collections: {', '.join(collection_names)}"
            except:
                error_msg = f"Record not found with id: {record_id_str}"
            return {"status": "FAILED", "error": error_msg}

        return await create_report_for_record(browser, record, tabs_num=tabs_num, collection=collection)

    except Exception as e:
        return {
            "status": "FAILED",
            "error": f"Error finding record: {str(e)}",
            "traceback": traceback.format_exc()
        }

async def create_reports_by_batch(browser, batch_id, tabs_num=3):
    new_browser = None  
    try:
        if not batch_id:
            return {"status": "FAILED", "error": "Missing batch_id"}

        cursor = db.multiapproachreports.find({"batchId": batch_id})
        records = await cursor.to_list(length=None)

        if not records:
            return {
                "status": "FAILED",
                "error": f"No records found for batch_id: {batch_id}"
            }

        batch_results = {
            "batch_id": batch_id,
            "totalRecords": len(records),
            "successCount": 0,
            "failureCount": 0,
            "records": []
        }

        new_browser = await spawn_new_browser(browser) 

        for record in records:
            record_id_str = str(record["_id"])
            try:
                result = await create_report_for_record(
                    browser=new_browser,
                    record=record,
                    tabs_num=tabs_num
                )

                if result.get("status") == "SUCCESS":
                    batch_results["successCount"] += 1
                else:
                    batch_results["failureCount"] += 1

                batch_results["records"].append({
                    "recordId": record_id_str,
                    "result": result
                })

            except Exception as record_err:
                batch_results["failureCount"] += 1
                batch_results["records"].append({
                    "recordId": record_id_str,
                    "status": "FAILED",
                    "error": str(record_err),
                    "traceback": traceback.format_exc()
                })

        batch_results["status"] = (
            "SUCCESS"
            if batch_results["failureCount"] == 0
            else "PARTIAL_SUCCESS"
        )

        return batch_results

    except Exception as e:
        return {
            "status": "FAILED",
            "batch_id": batch_id,
            "error": str(e),
            "traceback": traceback.format_exc()
        }

    finally:
        if new_browser:
            new_browser.stop()
