import asyncio, json, traceback
from datetime import datetime, timezone

from motor.motor_asyncio import AsyncIOMotorClient

from scripts.core.utils import wait_for_element, wait_for_table_rows
from scripts.submission.ElRajhiFiller import (
    extract_asset_from_report,
    finalize_report_submission,
)
from .formSteps import macro_form_config
from .macroFiller import fill_macro_form

MONGO_URI = "mongodb+srv://Aasim:userAasim123@electron.cwbi8id.mongodb.net"
client = AsyncIOMotorClient(MONGO_URI)
db = client["test"]


def chunk_items(items, n):
    """Split items into n reasonably balanced chunks."""
    n = max(1, n)
    k, m = divmod(len(items), n)
    chunks = []
    start = 0
    for i in range(n):
        size = k + (1 if i < m else 0)
        chunks.append(items[start:start + size])
        start += size
    return chunks


async def _mark_submit_state(report_doc, submit_state):
    await db.urgentreports.update_one(
        {"_id": report_doc["_id"]},
        {
            "$set": {
                "submit_state": submit_state,
                "last_checked_at": datetime.now(timezone.utc),
            }
        },
    )


async def _check_single_report(page, report_doc):
    report_id = report_doc.get("report_id")
    if not report_id:
        await _mark_submit_state(report_doc, 0)
        return {
            "batchId": report_doc.get("batch_id"),
            "reportId": None,
            "status": "INCOMPLETE",
            "reason": "missing_report_id",
            "client_name": report_doc.get("client_name"),
            "asset_name": report_doc.get("asset_name"),
            "macroId": None,
        }

    try:
        url = f"https://qima.taqeem.sa/report/{report_id}"
        await page.get(url)
        await asyncio.sleep(1)

        delete_btn = await wait_for_element(page, "#delete_report", timeout=8)
        submit_state = 1 if delete_btn else 0
        macro_id = None

        if not delete_btn:
            try:
                table_ready = await wait_for_table_rows(page, timeout=5)
                if table_ready:
                    macro_link = await wait_for_element(
                        page, "#m-table tbody tr:first-child td:nth-child(1) a", timeout=5
                    )
                    if macro_link and macro_link.text:
                        macro_id = macro_link.text.strip()
            except Exception:
                macro_id = None

        await _mark_submit_state(report_doc, submit_state)

        return {
            "batchId": report_doc.get("batch_id"),
            "reportId": report_id,
            "status": "COMPLETE" if submit_state else "INCOMPLETE",
            "client_name": report_doc.get("client_name"),
            "asset_name": report_doc.get("asset_name"),
            "macroId": macro_id,
            "checkedAt": datetime.now(timezone.utc).isoformat(),
        }
    except Exception as e:
        await _mark_submit_state(report_doc, 0)
        return {
            "batchId": report_doc.get("batch_id"),
            "reportId": report_id,
            "status": "FAILED",
            "error": str(e),
            "client_name": report_doc.get("client_name"),
            "asset_name": report_doc.get("asset_name"),
        }


async def check_elrajhi_batches(browser, batch_id=None, tabs_num=3):
    """Check completion status for all reports in a batch (or all batches)."""
    query = {"batch_id": batch_id} if batch_id else {}
    reports = await db.urgentreports.find(query).sort("createdAt", -1).to_list(None)

    if not reports:
        return {
            "status": "FAILED",
            "error": "No reports found for provided batch" if batch_id else "No reports found",
        }

    tabs = max(1, min(tabs_num or 1, 5))
    pages = []
    try:
        pages = [await browser.get("about:blank", new_tab=True) for _ in range(tabs)]
    except Exception:
        pages = []

    if not pages:
        main_page = await browser.get("about:blank")
        pages = [main_page]

    chunks = chunk_items(reports, len(pages))
    results = []

    async def process_chunk(page, chunk):
        for rep in chunk:
            res = await _check_single_report(page, rep)
            print(json.dumps({"event": "elrajhi-check", **res}), flush=True)
            results.append(res)

    await asyncio.gather(*(process_chunk(p, c) for p, c in zip(pages, chunks)))

    grouped = {}
    for item in results:
        key = item.get("batchId") or batch_id or "unknown"
        grouped.setdefault(key, {"batchId": key, "reports": []})
        grouped[key]["reports"].append(item)

    for group in grouped.values():
        complete = sum(1 for r in group["reports"] if r.get("status") == "COMPLETE")
        group["complete"] = complete
        group["total"] = len(group["reports"])
        group["incomplete"] = group["total"] - complete

    return {"status": "SUCCESS", "batches": list(grouped.values())}


async def reupload_elrajhi_report(browser, report_id):
    """Refill macro data for a specific ElRajhi report and finalize it."""
    if not report_id:
        return {"status": "FAILED", "error": "reportId is required"}

    report_doc = await db.urgentreports.find_one({"report_id": report_id})
    if not report_doc:
        return {"status": "FAILED", "error": f"Report {report_id} not found in database"}

    try:
        page = await browser.get(f"https://qima.taqeem.sa/report/{report_id}")
        await asyncio.sleep(1)

        macro_link = await wait_for_element(
            page, "#m-table tbody tr:first-child td:nth-child(1) a", timeout=12
        )
        if not macro_link or not macro_link.text:
            return {"status": "FAILED", "error": "Could not locate macro id for report"}

        macro_id = macro_link.text.strip()
        macro_data = extract_asset_from_report(report_doc)

        macro_result = await fill_macro_form(
            page,
            macro_id=macro_id,
            macro_data=macro_data,
            field_map=macro_form_config["field_map"],
            field_types=macro_form_config["field_types"],
        )

        finalize_result = await finalize_report_submission(page, report_id)
        submit_state = 1 if finalize_result.get("status") == "SUCCESS" else 0

        await _mark_submit_state(report_doc, submit_state)

        return {
            "status": "SUCCESS" if submit_state else "FAILED",
            "reportId": report_id,
            "macroId": macro_id,
            "submitState": submit_state,
            "macroResult": macro_result,
            "finalize": finalize_result,
        }
    except Exception as e:
        tb = traceback.format_exc()
        await _mark_submit_state(report_doc, 0)
        return {"status": "FAILED", "error": str(e), "traceback": tb}
