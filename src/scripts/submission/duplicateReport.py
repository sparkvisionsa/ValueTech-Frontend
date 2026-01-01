import asyncio, json
import sys
import traceback
from datetime import datetime, timezone

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient

from scripts.core.browser import get_browser, spawn_new_browser
from scripts.core.company_context import (
    build_report_create_url,
    require_selected_company,
    set_selected_company,
)
from scripts.core.utils import wait_for_element
from .formSteps import form_steps
from .formFiller import fill_form
from .macroFiller import handle_macro_edits
from .createMacros import run_create_assets_by_count
from .grabMacroIds import (
    update_report_pg_count,
    get_balanced_page_distribution,
    get_macro_ids_from_page,
    update_report_with_macro_ids,
)

MONGO_URI = "mongodb+srv://Aasim:userAasim123@electron.cwbi8id.mongodb.net"
client = AsyncIOMotorClient(MONGO_URI)
db = client["test"]

HOME_URL = "https://qima.taqeem.sa/report"


def build_form_payload(record):
    assets = record.get("asset_data") or []
    valuers = []
    for v in record.get("valuers", []):
        name = v.get("valuer_name") or v.get("valuerName")
        pct = v.get("contribution_percentage") or v.get("percentage")
        if name:
            valuers.append({"valuerName": name, "percentage": pct or 0})

    return {
        "title": record.get("title") or "",
        "purpose_id": str(record.get("purpose_id") or "1"),
        "value_premise_id": str(record.get("value_premise_id") or "1"),
        "value_base": str(record.get("value_base") or "1"),
        "report_type": record.get("report_type") or "O¦U,OñUSOñ U.U?OæU,",
        "valued_at": (record.get("valued_at") or "")[:10],
        "submitted_at": (record.get("submitted_at") or "")[:10],
        "assumptions": record.get("assumptions") or "",
        "special_assumptions": record.get("special_assumptions") or "",
        "final_value": record.get("final_value") or record.get("value") or "",
        "valuation_currency": str(record.get("valuation_currency") or "1"),
        "pdf_path": record.get("pdf_path") or "",
        "client_name": record.get("client_name") or "",
        "telephone": record.get("telephone") or record.get("user_phone") or "",
        "email": record.get("email") or "",
        "has_other_users": bool(record.get("has_other_users")),
        "report_users": record.get("report_users") or [],
        "valuers": valuers,
        "number_of_macros": str(len(assets)),
    }, assets


async def fetch_report(record_id=None):
    """Fetch a duplicate report record from MongoDB."""
    if record_id:
        if not ObjectId.is_valid(record_id):
            raise ValueError("Invalid record id")
        rec = await db.duplicatereports.find_one({"_id": ObjectId(record_id)})
    else:
        rec = await db.duplicatereports.find_one(sort=[("createdAt", -1)])

    if not rec:
        raise ValueError("No duplicate report found to process")

    return rec


async def get_all_macro_ids_parallel(browser, report_id, tabs_num=3, collection_name="duplicatereports"):
    try:
        if not report_id:
            print("[MACRO_ID] No report_id provided", file=sys.stderr)
            return {"status": "FAILED", "error": "Missing report_id"}

        base_url = f"https://qima.taqeem.sa/report/{report_id}"
        main_page = browser.tabs[0]
        await main_page.get(base_url)
        await asyncio.sleep(2)

        await wait_for_element(main_page, "li", timeout=30)

        pagination_links = await main_page.query_selector_all("ul.pagination li a")
        page_numbers = []
        for link in pagination_links:
            text = link.text
            if text and text.strip().isdigit():
                page_numbers.append(int(text.strip()))

        total_pages = max(page_numbers) if page_numbers else 1
        print(f"[MACRO_ID] Found {total_pages} pages to scan", file=sys.stderr)
        await update_report_pg_count(report_id, total_pages, collection_name=collection_name)

        pages = [main_page] + [
            await browser.get("about:blank", new_tab=True)
            for _ in range(min(tabs_num - 1, total_pages - 1))
        ]

        page_chunks = get_balanced_page_distribution(total_pages, len(pages))
        print(
            f"[MACRO_ID] Page distribution: {[len(chunk) for chunk in page_chunks]} pages per tab",
            file=sys.stderr,
        )

        all_macro_ids_with_pages = []
        macro_ids_lock = asyncio.Lock()

        async def process_pages_chunk(page, page_numbers_chunk, tab_id):
            local_macro_ids_with_pages = []
            print(f"[MACRO_ID-TAB-{tab_id}] Processing pages: {page_numbers_chunk}", file=sys.stderr)

            for page_num in page_numbers_chunk:
                page_macro_ids = await get_macro_ids_from_page(page, base_url, page_num, tab_id)
                local_macro_ids_with_pages.extend(page_macro_ids)

            async with macro_ids_lock:
                all_macro_ids_with_pages.extend(local_macro_ids_with_pages)

            print(
                f"[MACRO_ID-TAB-{tab_id}] Completed processing, found {len(local_macro_ids_with_pages)} macro IDs",
                file=sys.stderr,
            )

        tasks = []
        for i, (page, chunk) in enumerate(zip(pages, page_chunks)):
            if chunk:
                tasks.append(process_pages_chunk(page, chunk, i))

        await asyncio.gather(*tasks)

        for p in pages[1:]:
            await p.close()

        print(
            f"[MACRO_ID] ID collection complete. Found {len(all_macro_ids_with_pages)} macro IDs",
            file=sys.stderr,
        )

        if all_macro_ids_with_pages:
            success = await update_report_with_macro_ids(
                report_id, all_macro_ids_with_pages, collection_name=collection_name
            )
            if success:
                print("[MACRO_ID] Successfully updated report in MongoDB", file=sys.stderr)
            else:
                print("[MACRO_ID] Failed to update report in MongoDB", file=sys.stderr)

        return {"status": "SUCCESS", "macro_ids_with_pages": all_macro_ids_with_pages}

    except Exception as e:
        print(f"[MACRO_ID] Error in get_all_macro_ids_parallel: {str(e)}", file=sys.stderr)
        traceback.print_exc()
        return {"status": "FAILED", "error": str(e)}


async def create_report_for_record(browser, record, tabs_num=3):
    try:
        if not record or "_id" not in record:
            return {"status": "FAILED", "error": "Invalid record object (missing _id)"}

        try:
            require_selected_company()
            create_url = build_report_create_url()
        except Exception as ctx_err:
            return {"status": "FAILED", "error": str(ctx_err)}

        await db.duplicatereports.update_one(
            {"_id": record["_id"]},
            {"$set": {"startSubmitTime": datetime.now(timezone.utc)}},
        )

        payload, assets = build_form_payload(record)
        asset_count = len(assets)
        payload["number_of_macros"] = str(asset_count)

        results = []
        form_id = None

        main_page = await browser.get(create_url)
        await asyncio.sleep(1)

        for step_num, step_config in enumerate(form_steps, 1):
            is_last = step_num == len(form_steps)

            results.append(
                {"status": "STEP_STARTED", "step": step_num, "recordId": str(record["_id"])}
            )

            if step_num == 2 and asset_count > 10:
                result = await run_create_assets_by_count(
                    browser,
                    asset_count,
                    tabs_num=tabs_num,
                    batch_size=10,
                )
            else:
                if step_num == 2:
                    payload["number_of_macros"] = str(asset_count)
                result = await fill_form(
                    main_page,
                    payload,
                    step_config["field_map"],
                    step_config["field_types"],
                    is_last,
                    is_valuers=step_config.get("is_valuers_step", False)
                    and bool(payload.get("valuers")),
                )

            if isinstance(result, dict) and result.get("status") == "FAILED":
                results.append(
                    {
                        "status": "FAILED",
                        "step": step_num,
                        "recordId": str(record["_id"]),
                        "error": result.get("error"),
                    }
                )
                await db.duplicatereports.update_one(
                    {"_id": record["_id"]},
                    {"$set": {"endSubmitTime": datetime.now(timezone.utc)}},
                )
                return {"status": "FAILED", "results": results}

            if is_last:
                main_url = await main_page.evaluate("window.location.href")
                form_id = main_url.split("/")[-1]
                if not form_id:
                    results.append(
                        {
                            "status": "FAILED",
                            "step": "report_id",
                            "recordId": str(record["_id"]),
                            "error": "Could not determine report_id",
                        }
                    )
                    await db.duplicatereports.update_one(
                        {"_id": record["_id"]},
                        {"$set": {"endSubmitTime": datetime.now(timezone.utc)}},
                    )
                    return {"status": "FAILED", "results": results}

                await db.duplicatereports.update_one(
                    {"_id": record["_id"]},
                    {"$set": {"report_id": form_id, "number_of_macros": asset_count}},
                )

                macro_ids_result = await get_all_macro_ids_parallel(
                    browser, form_id, tabs_num=tabs_num, collection_name="duplicatereports"
                )
                if isinstance(macro_ids_result, dict) and macro_ids_result.get("status") == "FAILED":
                    results.append(
                        {
                            "status": "FAILED",
                            "step": "macro_ids",
                            "recordId": str(record["_id"]),
                            "error": macro_ids_result.get("error"),
                        }
                    )
                    await db.duplicatereports.update_one(
                        {"_id": record["_id"]},
                        {"$set": {"endSubmitTime": datetime.now(timezone.utc)}},
                    )
                    return {"status": "FAILED", "results": results}

                record = await db.duplicatereports.find_one({"report_id": form_id}) or record

                macro_result = await handle_macro_edits(
                    browser, record, tabs_num=tabs_num, record_id=str(record["_id"])
                )
                if isinstance(macro_result, dict) and macro_result.get("status") == "FAILED":
                    results.append(
                        {
                            "status": "FAILED",
                            "step": "macro_edit",
                            "recordId": str(record["_id"]),
                            "error": macro_result.get("error"),
                        }
                    )
                    await db.duplicatereports.update_one(
                        {"_id": record["_id"]},
                        {"$set": {"endSubmitTime": datetime.now(timezone.utc)}},
                    )
                    return {"status": "FAILED", "results": results}

                results.append(
                    {
                        "status": "MACRO_EDIT_SUCCESS",
                        "message": "All macros filled",
                        "recordId": str(record["_id"]),
                    }
                )

        await db.duplicatereports.update_one(
            {"_id": record["_id"]},
            {"$set": {"endSubmitTime": datetime.now(timezone.utc)}},
        )

        await main_page.get(HOME_URL)

        return {"status": "SUCCESS", "report_id": form_id, "results": results}

    except Exception as e:
        await db.duplicatereports.update_one(
            {"_id": record["_id"]},
            {"$set": {"endSubmitTime": datetime.now(timezone.utc)}},
        )
        return {"status": "FAILED", "error": str(e), "traceback": traceback.format_exc()}


async def run_duplicate_report(record_id=None, company_url=None, tabs_num=3):
    new_browser = None
    try:
        company_hint = company_url if isinstance(company_url, dict) else {}
        if company_url:
            url_to_set = company_url.get("url") if isinstance(company_url, dict) else company_url
            set_selected_company(
                url_to_set,
                name=company_hint.get("name") if isinstance(company_hint, dict) else None,
                office_id=(company_hint.get("officeId") or company_hint.get("office_id"))
                if isinstance(company_hint, dict)
                else None,
                sector_id=(company_hint.get("sectorId") or company_hint.get("sector_id"))
                if isinstance(company_hint, dict)
                else None,
            )

        browser = await get_browser()
        new_browser = await spawn_new_browser(browser)

        record = await fetch_report(record_id)
        try:
            tabs_num = int(tabs_num or 1)
        except Exception:
            tabs_num = 1
        tabs_num = max(1, tabs_num)

        result = await create_report_for_record(new_browser, record, tabs_num=tabs_num)
        return result

    except Exception as e:
        return {"status": "FAILED", "error": str(e), "traceback": traceback.format_exc()}

    finally:
        if new_browser:
            new_browser.stop()
