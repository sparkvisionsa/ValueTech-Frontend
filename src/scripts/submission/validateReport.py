import asyncio, sys, traceback, json

from scripts.core.browser import check_browser_status, new_window
from scripts.core.utils import wait_for_table_rows


async def validate_report(cmd):
    report_id = cmd.get("reportId")
    if not report_id:
        return {
            "status": "FAILED",
            "error": "Missing reportId in command"
        }

    browser_status = await check_browser_status()
    print(json.dumps({
        "event": "browser_status",
        "browserStatus": browser_status
    }), file=sys.stderr)

    if not browser_status.get("browserOpen", False):
        return {
            "status": "FAILED",
            "error": "Browser is not open",
            "reportId": report_id
        }

    if browser_status.get("status") != "SUCCESS":
        return {
            "status": "FAILED",
            "error": "User not logged in",
            "reportId": report_id
        }

    url = f"https://qima.taqeem.sa/report/{report_id}"

    print(json.dumps({
        "event": "checking_report",
        "reportId": report_id,
        "url": url
    }), file=sys.stderr)

    page = None

    try:
        page = await new_window(url)
        await asyncio.sleep(3)

        html = await page.get_content()

        error_text_1 = "ليس لديك صلاحية للتواجد هنا !"
        error_text_2 = "هذه الصفحة غير موجودة!"

        if error_text_1 in html or error_text_2 in html:
            return {
                "status": "NOT_FOUND",
                "message": "Report not accessible or does not exist",
                "reportId": report_id,
                "exists": False,
                "url": url
            }

        # Report exists – check macros table
        macros_table = await wait_for_table_rows(page, timeout=5)
        print(json.dumps({
            "event": "macros_table_check",
            "tableFound": bool(macros_table)
        }), file=sys.stderr)

        if macros_table:
            total_micros = None
            assets_exact = None
            last_page_num = None
            last_page_ids = []

            try:
                last_page_num = await page.evaluate("""
                    (() => {
                        const isDisabled = (li) => {
                            if (!li) return true;
                            if (li.classList.contains('disabled')) return true;
                            if (li.getAttribute('aria-disabled') === 'true') return true;
                            const a = li.querySelector('a,button');
                            if (a && (a.getAttribute('aria-disabled') === 'true' || a.classList.contains('disabled'))) return true;
                            return false;
                        };

                        const selectors = ['nav ul', '.dataTables_paginate ul', 'ul.pagination'];
                        let ul = null;
                        for (const sel of selectors) {
                            const el = document.querySelector(sel);
                            if (el && el.querySelectorAll('li').length > 0) { ul = el; break; }
                        }
                        if (!ul) return null;

                        const lis = Array.from(ul.querySelectorAll('li'));
                        const numericLis = lis.filter(li => {
                            const txt = li.textContent.trim();
                            return /^\\d+$/.test(txt) && !isDisabled(li);
                        });
                        if (numericLis.length === 0) return null;

                        const lastLi = numericLis[numericLis.length - 1];
                        const pageNum = parseInt(lastLi.textContent.trim(), 10);

                        const clickable = lastLi.querySelector('a,button') || lastLi;
                        try { clickable.click(); } catch (_) {}

                        return pageNum;
                    })()
                """)

                if isinstance(last_page_num, (int, float)) and last_page_num >= 1:
                    await asyncio.sleep(1)

                    try:
                        await wait_for_table_rows(page, timeout=3)
                    except Exception:
                        pass

                    last_page_ids = await page.evaluate("""
                        (() => {
                            const rows = Array.from(document.querySelectorAll('#m-table tbody tr'));
                            const ids = [];
                            for (const tr of rows) {
                                const a = tr.querySelector('td:nth-child(1) a[href*="/report/macro/"]');
                                if (!a) continue;
                                const href = a.getAttribute('href') || '';
                                const m = href.match(/\\/macro\\/(\\d+)\\//);
                                if (m) ids.push(parseInt(m[1], 10));
                                else {
                                    const txt = (a.textContent || '').trim();
                                    if (/^\\d+$/.test(txt)) ids.append(parseInt(txt, 10));
                                }
                            }
                            return ids;
                        })()
                    """)

                    try:
                        next_state = await page.evaluate("""
                            (() => {
                                const next = document.querySelector('#m-table_next, a.paginate_button.next[aria-controls="m-table"]');
                                if (!next) return { exists: false, disabled: null };
                                const disabled = next.classList.contains('disabled') || next.getAttribute('aria-disabled') === 'true';
                                if (!disabled) { try { next.click(); } catch(_) {} }
                                return { exists: true, disabled };
                            })()
                        """)
                        print(json.dumps({
                            "event": "next_button_status",
                            "state": next_state
                        }), file=sys.stderr)
                    except Exception:
                        pass

                    count_on_last = len(last_page_ids) if isinstance(last_page_ids, list) else 0

                    assets_exact = int((int(last_page_num) - 1) * 15 + count_on_last)
                    total_micros = int(last_page_num) * 15

                    print(json.dumps({
                        "event": "assets_computed",
                        "page": int(last_page_num),
                        "countLastPage": count_on_last,
                        "assetsExact": assets_exact
                    }), file=sys.stderr)

                else:
                    print(json.dumps({
                        "event": "last_page_not_found",
                        "value": last_page_num
                    }), file=sys.stderr)

            except Exception as e:
                print(json.dumps({
                    "event": "compute_error",
                    "error": str(e)
                }), file=sys.stderr)

            return {
                "status": "MACROS_EXIST",
                "message": (
                    "Only works with empty reports — "
                    f"last page #{int(last_page_num) if last_page_num else 'unknown'}, "
                    f"ids on last page: {len(last_page_ids) if isinstance(last_page_ids, list) else 'unknown'}, "
                    f"exact assets: {assets_exact if assets_exact is not None else 'unknown'}"
                ),
                "reportId": report_id,
                "exists": True,
                "url": url,
                "hasMacros": True,
                "microsCount": total_micros,
                "assetsExact": assets_exact,
                "lastPageMicroIds": last_page_ids
            }

        # No macros table → report is valid and empty
        print(json.dumps({
            "event": "report_empty_macros"
        }), file=sys.stderr)

        return {
            "status": "SUCCESS",
            "message": "Report appears to exist and is accessible",
            "reportId": report_id,
            "exists": True,
            "url": url,
            "hasMacros": False
        }

    except Exception as e:
        tb = traceback.format_exc()

        print(json.dumps({
            "event": "exception",
            "error": str(e),
            "traceback": tb
        }), file=sys.stderr)

        return {
            "status": "FAILED",
            "reportId": report_id,
            "error": str(e),
            "traceback": tb
        }

    finally:
        if page:
            await page.close()




async def check_report_existence(page, report_id=None):
    ERROR_TEXT_NOT_ALLOWED = "ليس لديك صلاحية للتواجد هنا !"
    ERROR_TEXT_NOT_FOUND   = "هذه الصفحة غير موجودة!"

    if report_id:
        url = f"https://qima.taqeem.sa/report/{report_id}"

        print(json.dumps({
            "event": "navigating_to_report",
            "reportId": report_id,
            "url": url
        }), file=sys.stderr)

        await page.get(url)
        await asyncio.sleep(3)
    else:
        url = await page.evaluate("window.location.href")

    html = await page.get_content()

    if ERROR_TEXT_NOT_ALLOWED in html or ERROR_TEXT_NOT_FOUND in html:
        return {
            "status": "NOT_FOUND",
            "exists": False,
            "reportId": report_id,
            "url": url
        }

    return {
        "status": "EXISTS",
        "exists": True,
        "reportId": report_id,
        "url": url
    }
