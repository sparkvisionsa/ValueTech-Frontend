import asyncio
import json
import traceback
from datetime import datetime, timezone

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient

from scripts.core.browser import get_browser
from scripts.core.utils import wait_for_element, wait_for_table_rows, log
from scripts.core.company_context import build_report_create_url, require_selected_company, set_selected_company
from .formSteps import form_steps, macro_form_config
from .formFiller import fill_form
from .macroFiller import fill_macro_form

MONGO_URI = "mongodb+srv://Aasim:userAasim123@electron.cwbi8id.mongodb.net"
client = AsyncIOMotorClient(MONGO_URI)
db = client["test"]

HOME_URL = "https://qima.taqeem.sa/report"


def normalize_report(record):
    """Prepare report payload for form filling."""
    valuers = []
    for v in record.get("valuers", []):
        name = v.get("valuer_name") or v.get("valuerName")
        pct = v.get("contribution_percentage") or v.get("percentage")
        if name:
            valuers.append({"valuerName": name, "percentage": pct or 0})

    report_users = record.get("report_users") or []
    assets = record.get("asset_data") or []

    return {
        "report_id": record.get("report_id") or "",
        "title": record.get("title") or "",
        "purpose_id": str(record.get("purpose_id") or "1"),
        "value_premise_id": str(record.get("value_premise_id") or "1"),
        "value_base": "1",
        "report_type": record.get("report_type") or "تقرير مفصل",
        "valued_at": (record.get("valued_at") or "")[:10],
        "submitted_at": (record.get("submitted_at") or "")[:10],
        "assumptions": record.get("assumptions") or "",
        "special_assumptions": record.get("special_assumptions") or "",
        "final_value": record.get("value") or "",
        "valuation_currency": str(record.get("valuation_currency") or "1"),
        "pdf_path": record.get("pdf_path") or "",
        "client_name": record.get("client_name") or "",
        "telephone": record.get("telephone") or record.get("user_phone") or "",
        "email": record.get("email") or "",
        "has_other_users": bool(record.get("has_other_users")),
        "report_users": report_users,
        "valuers": valuers,
        "number_of_macros": len(assets),
        "assets": assets,
    }


async def fetch_report(record_id=None):
    """Fetch a duplicate report record from MongoDB."""
    if record_id:
        rec = await db.duplicatereports.find_one({"_id": ObjectId(record_id)})
    else:
        rec = await db.duplicatereports.find_one(sort=[("createdAt", -1)])

    if not rec:
        raise ValueError("No duplicate report found to process")

    return rec


async def fill_report_form(page, payload):
    """Run through form steps to create report."""
    for idx, step in enumerate(form_steps, 1):
        is_last = idx == len(form_steps)
        step_payload = payload.copy()
        if idx == 2:
            step_payload["number_of_macros"] = payload.get("number_of_macros") or len(payload.get("assets") or [])

        result = await fill_form(
            page,
            step_payload,
            step["field_map"],
            step["field_types"],
            is_last=is_last,
            is_valuers=step.get("is_valuers_step", False) and bool(payload.get("valuers")),
        )
        if isinstance(result, dict) and result.get("status") == "FAILED":
            return result
    return {"status": "SUCCESS"}


async def collect_macro_ids(page, expected_count):
    """Grab macro IDs from the macros table."""
    await wait_for_table_rows(page)
    macro_links = await page.query_selector_all("#m-table tbody tr td:nth-child(1) a")
    ids = []
    for link in macro_links:
        text = (link.text or "").strip()
        if text.isdigit():
            ids.append(text)
    if expected_count and len(ids) < expected_count:
        log(f"Expected {expected_count} macros but found {len(ids)}", "WARN")
    return ids


def normalize_asset(asset, defaults):
    """Prepare asset payload for macro fill."""
    val = asset.get("final_value") or ""
    is_market = (asset.get("value_base") == 1) or (asset.get("market_approach") == 1)
    is_cost = (asset.get("cost_approach") == 1)
    return {
        "asset_type": asset.get("asset_type", "0"),
        "asset_name": asset.get("asset_name"),
        "asset_usage_id": asset.get("asset_usage_id"),
        "value_base": 1,
        "inspection_date": (asset.get("inspection_date") or defaults.get("inspection_date") or "")[:10],
        "final_value": val,
        "production_capacity": asset.get("production_capacity", "0"),
        "production_capacity_measuring_unit": asset.get("production_capacity_measuring_unit", "0"),
        "owner_name": defaults.get("client_name") or asset.get("owner_name"),
        "product_type": asset.get("product_type", "0"),
        "market_approach": 1 if is_market else None,
        "market_approach_value": asset.get("market_approach_value") or val,
        "cost_approach": 1 if is_cost else None,
        "cost_approach_value": asset.get("cost_approach_value") or val,
        "country": asset.get("country") or "المملكة العربية السعودية",
        "region": asset.get("region"),
        "city": asset.get("city"),
    }


async def fill_macros_for_report(page, macro_ids, assets, defaults):
    """Fill each macro with asset data."""
    if not macro_ids:
        return {"status": "FAILED", "error": "No macro IDs found"}

    results = []
    for macro_id, asset in zip(macro_ids, assets):
        macro_data = normalize_asset(asset, defaults)
        result = await fill_macro_form(
            page,
            macro_id=macro_id,
            macro_data=macro_data,
            field_map=macro_form_config["field_map"],
            field_types=macro_form_config["field_types"],
        )
        results.append({"macro_id": macro_id, "result": result})
    return {"status": "SUCCESS", "results": results}


async def run_duplicate_report(record_id=None, company_url=None):
    """
    Create and fill a duplicate report:
      - Navigate to create page
      - Fill report info
      - Set macros count from asset_data length
      - Collect macro IDs
      - Fill each macro with asset data
      - Return to home
    """
    try:
        company_hint = company_url if isinstance(company_url, dict) else {}
        if company_url:
            url_to_set = company_url.get("url") if isinstance(company_url, dict) else company_url
            set_selected_company(
                url_to_set,
                name=company_hint.get("name") if isinstance(company_hint, dict) else None,
                office_id=(company_hint.get("officeId") or company_hint.get("office_id")) if isinstance(company_hint, dict) else None,
                sector_id=(company_hint.get("sectorId") or company_hint.get("sector_id")) if isinstance(company_hint, dict) else None,
            )
        require_selected_company()
        create_url = build_report_create_url()
    except Exception as ctx_err:
        return {"status": "FAILED", "error": str(ctx_err)}

    browser = await get_browser()
    page = await browser.get(create_url)

    try:
        record = await fetch_report(record_id)
        payload = normalize_report(record)

        log("Filling report form", "STEP")
        form_result = await fill_report_form(page, payload)
        if isinstance(form_result, dict) and form_result.get("status") == "FAILED":
            return form_result

        # After submit, capture report_id from URL
        current_url = await page.evaluate("window.location.href")
        report_id = current_url.strip("/").split("/")[-1]
        await db.duplicatereports.update_one(
            {"_id": record["_id"]},
            {"$set": {"report_id": report_id, "number_of_macros": payload["number_of_macros"]}},
        )

        log("Collecting macro IDs", "STEP")
        macro_ids = await collect_macro_ids(page, payload["number_of_macros"])

        # Persist macro IDs back to DB
        updated_assets = []
        for asset, macro_id in zip(payload["assets"], macro_ids):
            asset_copy = asset.copy()
            asset_copy["id"] = str(macro_id)
            updated_assets.append(asset_copy)
        if updated_assets:
            await db.duplicatereports.update_one(
                {"_id": record["_id"]},
                {"$set": {"asset_data": updated_assets}},
            )

        log(f"Filling {len(macro_ids)} macros", "STEP")
        macros_result = await fill_macros_for_report(
            page, macro_ids, updated_assets or payload["assets"], defaults={"client_name": payload["client_name"], "inspection_date": payload.get("inspection_date")}
        )
        if macros_result.get("status") == "FAILED":
            return macros_result

        await page.get(HOME_URL)
        await db.duplicatereports.update_one(
            {"_id": record["_id"]},
            {"$set": {"endSubmitTime": datetime.now(timezone.utc)}},
        )

        return {
            "status": "SUCCESS",
            "report_id": report_id,
            "macro_ids": macro_ids,
            "macros": macros_result.get("results", []),
        }
    except Exception as e:
        return {"status": "FAILED", "error": str(e), "traceback": traceback.format_exc()}
