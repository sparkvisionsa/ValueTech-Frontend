const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const puppeteer = require('puppeteer');
const PizZip = require('pizzip');
const { Document, Packer, Paragraph, ImageRun, PageBreak, AlignmentType, Table, TableRow, TableCell, WidthType, VerticalAlign, BorderStyle, PageOrientation, SectionType, convertInchesToTwip } = require('docx');

const MAIN_FOLDERS = [
    '1.ملفات العميل',
    '2.صور المعاينة',
    '3.اعداد مسودة التقرير و حسابات القيمة',
    '4.التقرير بالتوقيع',
    '5.ملفات التسليم النهائية'
];

const LOCATION_FOLDER_INDEX = 1; // second folder (index 1)
const CALC_FOLDER_INDEX = 2; // third folder (index 2)
const REPORT_FOLDER_INDEX = 3; // fourth folder (index 3)
const CALC_SOURCE_PATH = path.join(__dirname, '..', '..', '..', 'public', 'calc.xlsx');
const NAME_JSON_PATH = path.join(__dirname, '..', '..', '..', 'public', 'name.json');
const REPORT_TEMPLATE_PATH = path.join(__dirname, '..', '..', '..', 'public', 'report.docx');
const CALC_TARGET_NAME = 'calc.xlsx';
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
const PDF_EXTENSIONS = ['.pdf'];

const sanitizeName = (name) => {
    if (!name && name !== 0) return '';
    const raw = typeof name === 'object' && name.text ? name.text : String(name);
    return raw.trim().replace(/[<>:"/\\|?*]/g, '-');
};

async function ensureDir(dirPath) {
    await fs.promises.mkdir(dirPath, { recursive: true });
}

async function copyCalcFile(targetDir) {
    const sourceExists = fs.existsSync(CALC_SOURCE_PATH);
    if (!sourceExists) {
        throw new Error(`calc.xlsx not found at ${CALC_SOURCE_PATH}`);
    }
    const targetPath = path.join(targetDir, CALC_TARGET_NAME);
    await fs.promises.copyFile(CALC_SOURCE_PATH, targetPath);
    return targetPath;
}

async function readLocationsAndPlates(dataExcelPath) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(dataExcelPath);
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new Error('Data sheet is empty.');

    const locations = [];
    const locationIndex = new Map(); // location name -> index in locations array

    sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // assume header
        const locationRaw = sanitizeName(row.getCell('G').value);
        const plateRaw = sanitizeName(row.getCell('B').value);
        const plateNumberRaw = sanitizeName(row.getCell('A').value);
        if (!locationRaw) return;

        if (!locationIndex.has(locationRaw)) {
            locationIndex.set(locationRaw, locations.length);
            locations.push({ name: locationRaw, plates: [] });
        }

        if (plateRaw) {
            const loc = locations[locationIndex.get(locationRaw)];
            const exists = loc.plates.find((p) => p.name === plateRaw && p.number === plateNumberRaw);
            if (!exists) loc.plates.push({ name: plateRaw, number: plateNumberRaw });
        }
    });

    return locations;
}

function getSheetBounds(sheet) {
    let maxRow = 0;
    let maxCol = 0;
    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (!row.hasValues) return;
        maxRow = Math.max(maxRow, rowNumber);
        row.eachCell({ includeEmpty: false }, (_cell, colNumber) => {
            maxCol = Math.max(maxCol, colNumber);
        });
    });
    return { maxRow, maxCol };
}

async function copyDataSheet(dataExcelPath, calcPath) {
    const dataWorkbook = new ExcelJS.Workbook();
    await dataWorkbook.xlsx.readFile(dataExcelPath);
    const sourceSheet = dataWorkbook.getWorksheet('data') || dataWorkbook.worksheets[0];
    if (!sourceSheet) throw new Error('لم يتم العثور على شيت data في ملف Data.xlsx');

    const calcWorkbook = new ExcelJS.Workbook();
    await calcWorkbook.xlsx.readFile(calcPath);
    let targetSheet = calcWorkbook.getWorksheet('data');
    if (!targetSheet) {
        targetSheet = calcWorkbook.addWorksheet('data');
    }

    // Clear old rows
    if (targetSheet.rowCount > 0) {
        targetSheet.spliceRows(1, targetSheet.rowCount);
    }

    const { maxRow, maxCol } = getSheetBounds(sourceSheet);

    for (let r = 1; r <= maxRow; r++) {
        const sourceRow = sourceSheet.getRow(r);
        const targetRow = targetSheet.getRow(r);
        for (let c = 1; c <= maxCol; c++) {
            targetRow.getCell(c).value = sourceRow.getCell(c).value;
        }
        targetRow.commit();
    }

    await calcWorkbook.xlsx.writeFile(calcPath);
}

function cloneSheet(templateSheet, targetSheet) {
    const { maxRow, maxCol } = getSheetBounds(templateSheet);

    // Copy column properties
    templateSheet.columns.forEach((col, idx) => {
        const tCol = targetSheet.getColumn(idx + 1);
        tCol.width = col.width;
        tCol.hidden = col.hidden;
        tCol.outlineLevel = col.outlineLevel;
    });

    // Copy rows/cells (values + styles) within used bounds
    for (let r = 1; r <= maxRow; r++) {
        const row = templateSheet.getRow(r);
        const targetRow = targetSheet.getRow(r);
        targetRow.height = row.height;
        for (let c = 1; c <= maxCol; c++) {
            const cell = row.getCell(c);
            const tCell = targetRow.getCell(c);
            tCell.value = cell.value;
            // Shallow clone style props to preserve design
            if (cell.style) tCell.style = JSON.parse(JSON.stringify(cell.style));
            if (cell.numFmt) tCell.numFmt = cell.numFmt;
            if (cell.alignment) tCell.alignment = JSON.parse(JSON.stringify(cell.alignment));
            if (cell.font) tCell.font = JSON.parse(JSON.stringify(cell.font));
            if (cell.border) tCell.border = JSON.parse(JSON.stringify(cell.border));
            if (cell.fill) tCell.fill = JSON.parse(JSON.stringify(cell.fill));
        }
        targetRow.commit();
    }

    // Copy merged cells
    const merges = templateSheet.model?.merges || templateSheet._merges;
    if (merges) {
        const mergeList = Array.isArray(merges)
            ? merges
            : (typeof merges === 'object' ? Object.keys(merges) : []);
        mergeList.forEach((merge) => {
            try {
                targetSheet.mergeCells(merge);
            } catch (err) {
                console.warn('[MAIN] Failed to merge cells', merge, err?.message);
            }
        });
    }
}

/**
 * Get cell value from data sheet - handles various value types
 * Always returns a primitive value (string, number, or null)
 */
function getDataCellValue(dataSheet, col, rowIndex) {
    if (!dataSheet) return '';
    const cell = dataSheet.getCell(`${col}${rowIndex}`);
    if (!cell || cell.value === null || cell.value === undefined) return '';
    
    let val = cell.value;
    
    if (typeof val === 'object') {
        if (val.text !== undefined) {
            val = val.text;
        } else if (val.richText && Array.isArray(val.richText)) {
            val = val.richText.map(rt => rt.text || '').join('');
        } else if (val.result !== undefined && val.result !== null) {
            val = val.result;
        } else if (val.formula) {
            return ''; // Can't resolve nested formulas
        } else {
            // Try to convert to string, but avoid [object Object]
            try {
                const str = String(val);
                if (str === '[object Object]') return '';
                val = str;
            } catch {
                return '';
            }
        }
    }
    
    // Ensure we return a primitive
    if (typeof val === 'object') return '';
    return val;
}

function setDataRefs(sheet, dataRowIndex, dataSheet) {
    // Store both formula and calculated result
    const setRef = (addr, col) => {
        const actualValue = getDataCellValue(dataSheet, col, dataRowIndex);
        const cell = sheet.getCell(addr);
        
        // Only include result if we have a valid value
        if (actualValue !== '' && actualValue !== null && actualValue !== undefined) {
            cell.value = { 
                formula: `data!${col}${dataRowIndex}`,
                result: actualValue
            };
        } else {
            // Just set formula without result
            cell.value = { formula: `data!${col}${dataRowIndex}` };
        }
    };

    // Top row mappings
    setRef('C3', 'B');
    setRef('D3', 'C');
    setRef('E3', 'D');
    setRef('F3', 'E');
    setRef('G3', 'F');
    setRef('H3', 'M');
    setRef('I3', 'G');
    setRef('J3', 'L');
    setRef('K3', 'N');
    
    // Set currency format for K3 (Saudi Riyal - right to left)
    sheet.getCell('K3').numFmt = '"ر.س."#,##0';

    // Rows 6-8 mappings
    ['C6', 'C7', 'C8'].forEach((addr) => setRef(addr, 'C'));
    ['D6', 'D7', 'D8'].forEach((addr) => setRef(addr, 'D'));

    setRef('E6', 'O');
    setRef('E7', 'V');
    setRef('E8', 'AC');

    setRef('F6', 'P');
    setRef('F7', 'W');
    setRef('F8', 'AD');

    setRef('G6', 'Q');
    setRef('G7', 'X');
    setRef('G8', 'AE');

    setRef('H6', 'T');
    setRef('H7', 'AA');
    setRef('H8', 'AH');

    setRef('I6', 'U');
    setRef('I7', 'AB');
    setRef('I8', 'AI');

    setRef('J6', 'R');
    setRef('J7', 'Y');
    setRef('J8', 'AF');

    setRef('K6', 'S');
    setRef('K7', 'Z');
    setRef('K8', 'AG');

    // Helper to safely convert to number
    const toNum = (val) => {
        if (val === '' || val === null || val === undefined) return 0;
        const n = Number(val);
        return isNaN(n) ? 0 : n;
    };

    // Calculate L6, L7, L8 (K + I + G) - percentage sum
    const calcSum = (row) => {
        const k = toNum(getDataCellValue(dataSheet, row === 6 ? 'S' : row === 7 ? 'Z' : 'AG', dataRowIndex));
        const i = toNum(getDataCellValue(dataSheet, row === 6 ? 'U' : row === 7 ? 'AB' : 'AI', dataRowIndex));
        const g = toNum(getDataCellValue(dataSheet, row === 6 ? 'Q' : row === 7 ? 'X' : 'AE', dataRowIndex));
        return k + i + g;
    };

    const L6val = calcSum(6);
    const L7val = calcSum(7);
    const L8val = calcSum(8);

    // Set L6-L8 with percentage format (only formula, no result to avoid type issues)
    sheet.getCell('L6').value = { formula: 'K6+I6+G6' };
    sheet.getCell('L6').numFmt = '0%';
    sheet.getCell('L7').value = { formula: 'K7+I7+G7' };
    sheet.getCell('L7').numFmt = '0%';
    sheet.getCell('L8').value = { formula: 'K8+I8+G8' };
    sheet.getCell('L8').numFmt = '0%';

    // Calculate M6, M7, M8 (E + E*L) - final value
    const calcFinal = (row, Lval) => {
        const e = toNum(getDataCellValue(dataSheet, row === 6 ? 'O' : row === 7 ? 'V' : 'AC', dataRowIndex));
        return e + (e * Lval);
    };

    // Set M6-M8 (only formula, no result to avoid type issues)
    // Saudi Riyal format - right to left
    sheet.getCell('M6').value = { formula: 'E6+(E6*L6)' };
    sheet.getCell('M6').numFmt = '"ر.س."#,##0.00';
    sheet.getCell('M7').value = { formula: 'E7+(E7*L7)' };
    sheet.getCell('M7').numFmt = '"ر.س."#,##0.00';
    sheet.getCell('M8').value = { formula: 'E8+(E8*L8)' };
    sheet.getCell('M8').numFmt = '"ر.س."#,##0.00';

    // Set percentage format for G, I, K columns (rows 6-8)
    ['G6', 'G7', 'G8', 'I6', 'I7', 'I8', 'K6', 'K7', 'K8'].forEach(addr => {
        const cell = sheet.getCell(addr);
        if (cell.numFmt === undefined || cell.numFmt === 'General') {
            cell.numFmt = '0%';
        }
    });

    // Set number format for E column (price/value)
    ['E6', 'E7', 'E8'].forEach(addr => {
        const cell = sheet.getCell(addr);
        if (cell.numFmt === undefined || cell.numFmt === 'General') {
            cell.numFmt = '#,##0.00';
        }
    });
}

async function createCalcSheets(dataExcelPath, calcPath) {
    const dataWorkbook = new ExcelJS.Workbook();
    await dataWorkbook.xlsx.readFile(dataExcelPath);
    const dataSheet = dataWorkbook.getWorksheet('data') || dataWorkbook.worksheets[0];
    if (!dataSheet) throw new Error('لم يتم العثور على شيت data في ملف Data.xlsx');
    const { maxRow: dataMaxRow } = getSheetBounds(dataSheet);

    const calcWorkbook = new ExcelJS.Workbook();
    await calcWorkbook.xlsx.readFile(calcPath);

    const templateSheet = calcWorkbook.getWorksheet('calc') || calcWorkbook.worksheets[0];
    if (!templateSheet) throw new Error('لم يتم العثور على شيت calc في calc.xlsx');

    // Clear previously generated sheets, keep template and data
    const keepNames = new Set(['calc', 'data']);
    calcWorkbook.worksheets
        .filter((ws) => !keepNames.has(ws.name))
        .forEach((ws) => calcWorkbook.removeWorksheet(ws.id));

    const usedNames = new Set(calcWorkbook.worksheets.map((ws) => ws.name));
    const makeName = (raw, fallbackIndex) => {
        // Only sanitize characters that are invalid for Excel sheet names
        const base = raw ? String(raw).trim().replace(/[*?:/\\[\]]/g, '_').substring(0, 31) : `Sheet_${fallbackIndex}`;
        let name = base;
        let i = 1;
        while (usedNames.has(name)) {
            name = `${base.substring(0, 28)}_${i}`;
            i += 1;
        }
        usedNames.add(name);
        return name;
    };

    const lastRow = dataMaxRow || dataSheet.lastRow?.number || dataSheet.rowCount;
    for (let r = 2; r <= lastRow; r++) {
        const dataRow = dataSheet.getRow(r);
        const colA = dataRow.getCell('A').value; // Number/prefix
        const colB = dataRow.getCell('B').value; // Name
        if (!colB) continue; // skip empty
        
        // Get raw values
        const prefix = colA !== null && colA !== undefined ? 
            (typeof colA === 'object' && colA.text ? colA.text : String(colA)) : '';
        const name = typeof colB === 'object' && colB.text ? colB.text : String(colB);
        
        // Create sheet name in same format as folder name: "prefix- name"
        const fullName = prefix ? `${prefix}- ${name}` : name;
        const sheetName = makeName(fullName, r);

        const newSheet = calcWorkbook.addWorksheet(sheetName);
        cloneSheet(templateSheet, newSheet);
        setDataRefs(newSheet, r, dataSheet);  // Pass dataSheet for value calculation
    }

    await calcWorkbook.xlsx.writeFile(calcPath);
}

async function createFoldersOnly(basePath, folderName, dataExcelPath) {
    if (!basePath || !folderName || !dataExcelPath) {
        throw new Error('basePath, folderName, and dataExcelPath are required.');
    }

    const root = path.join(basePath, folderName);
    await ensureDir(root);

    const subFolders = [];
    for (const name of MAIN_FOLDERS) {
        const dir = path.join(root, name);
        await ensureDir(dir);
        subFolders.push(dir);
    }

    const locationRoot = subFolders[LOCATION_FOLDER_INDEX] || subFolders[0];
    const locations = await readLocationsAndPlates(dataExcelPath);

    let locationsCreated = 0;
    let platesCreated = 0;

    for (let locIdx = 0; locIdx < locations.length; locIdx++) {
        const loc = locations[locIdx];
        const locationDirName = `${locIdx + 1}- ${loc.name}`;
        const locationDir = path.join(locationRoot, locationDirName);
        await ensureDir(locationDir);
        locationsCreated += 1;

        for (let plateIdx = 0; plateIdx < loc.plates.length; plateIdx++) {
            const plate = loc.plates[plateIdx];
            const prefix = plate.number || `${plateIdx + 1}`;
            const plateDirName = `${prefix}- ${plate.name}`;
            const plateDir = path.join(locationDir, plateDirName);
            await ensureDir(plateDir);
            platesCreated += 1;
        }
    }

    return { root, subFolders, locationsCreated, platesCreated };
}

async function updateCalcOnly(basePath, folderName, dataExcelPath) {
    if (!basePath || !folderName || !dataExcelPath) {
        throw new Error('basePath, folderName, and dataExcelPath are required.');
    }

    const root = path.join(basePath, folderName);
    const calcTargetDir = path.join(root, MAIN_FOLDERS[2]);
    await ensureDir(calcTargetDir);
    const calcPath = await copyCalcFile(calcTargetDir);
    await copyDataSheet(dataExcelPath, calcPath);
    await createCalcSheets(dataExcelPath, calcPath);
    return { root, calcPath };
}

// ==================== NEW FUNCTIONS FOR IMAGES AND DOCS ====================

// Image capture range: A1:N8 (rows 1-8, columns A-N which is 1-14)
const IMAGE_ROW_START = 1;
const IMAGE_ROW_END = 8;
const IMAGE_COL_START = 1; // A
const IMAGE_COL_END = 14;  // N

/**
 * Convert ExcelJS color to CSS color
 */
function excelColorToCss(color) {
    if (!color) return null;
    
    // Handle ARGB format (e.g., "FF00FF00" or "FFFFFF00")
    if (color.argb) {
        const argb = color.argb;
        // Skip alpha, take RGB
        const rgb = argb.length === 8 ? argb.substring(2) : argb;
        return `#${rgb}`;
    }
    
    // Handle theme colors with tint
    if (color.theme !== undefined) {
        // Common theme colors mapping
        const themeColors = {
            0: '#FFFFFF', // Background 1
            1: '#000000', // Text 1
            2: '#E7E6E6', // Background 2
            3: '#44546A', // Text 2
            4: '#4472C4', // Accent 1
            5: '#ED7D31', // Accent 2
            6: '#A5A5A5', // Accent 3
            7: '#FFC000', // Accent 4
            8: '#5B9BD5', // Accent 5
            9: '#70AD47', // Accent 6
        };
        return themeColors[color.theme] || '#FFFFFF';
    }
    
    // Handle indexed colors
    if (color.indexed !== undefined) {
        const indexedColors = {
            64: '#000000', 65: '#FFFFFF', 0: '#000000', 1: '#FFFFFF',
            2: '#FF0000', 3: '#00FF00', 4: '#0000FF', 5: '#FFFF00',
            6: '#FF00FF', 7: '#00FFFF', 8: '#800000', 9: '#008000',
            10: '#000080', 11: '#808000', 12: '#800080', 13: '#008080',
            14: '#C0C0C0', 15: '#808080', 16: '#9999FF', 17: '#993366',
            18: '#FFFFCC', 19: '#CCFFFF', 20: '#660066', 21: '#FF8080',
            22: '#0066CC', 23: '#CCCCFF', 24: '#000080', 25: '#FF00FF',
            26: '#FFFF00', 27: '#00FFFF', 28: '#800080', 29: '#800000',
            30: '#008080', 31: '#0000FF', 32: '#00CCFF', 33: '#CCFFFF',
            34: '#CCFFCC', 35: '#FFFF99', 36: '#99CCFF', 37: '#FF99CC',
            38: '#CC99FF', 39: '#FFCC99', 40: '#3366FF', 41: '#33CCCC',
            42: '#99CC00', 43: '#FFCC00', 44: '#FF9900', 45: '#FF6600',
            46: '#666699', 47: '#969696', 48: '#003366', 49: '#339966',
            50: '#003300', 51: '#333300', 52: '#993300', 53: '#993366',
            54: '#333399', 55: '#333333'
        };
        return indexedColors[color.indexed] || '#FFFFFF';
    }
    
    return null;
}

/**
 * Get cell background color
 */
function getCellBgColor(cell) {
    if (!cell.fill) return '#FFFFFF';
    
    if (cell.fill.type === 'pattern') {
        if (cell.fill.fgColor) {
            return excelColorToCss(cell.fill.fgColor) || '#FFFFFF';
        }
        if (cell.fill.bgColor) {
            return excelColorToCss(cell.fill.bgColor) || '#FFFFFF';
        }
    }
    
    return '#FFFFFF';
}

/**
 * Get cell font color
 */
function getCellFontColor(cell) {
    if (cell.font && cell.font.color) {
        return excelColorToCss(cell.font.color) || '#000000';
    }
    return '#000000';
}

/**
 * Get cell border style
 */
function getCellBorderCss(cell) {
    const defaultBorder = '1px solid #000000';
    if (!cell.border) return defaultBorder;
    
    const getBorderSide = (side) => {
        if (!side) return '1px solid #d0d0d0';
        const color = side.color ? (excelColorToCss(side.color) || '#000000') : '#000000';
        const styles = {
            thin: '1px solid',
            medium: '2px solid',
            thick: '3px solid',
            dotted: '1px dotted',
            dashed: '1px dashed',
            double: '3px double'
        };
        return `${styles[side.style] || '1px solid'} ${color}`;
    };
    
    return {
        top: getBorderSide(cell.border.top),
        right: getBorderSide(cell.border.right),
        bottom: getBorderSide(cell.border.bottom),
        left: getBorderSide(cell.border.left)
    };
}

/**
 * Get a cell's actual value (handles formula results)
 */
function getCellActualValue(cell) {
    if (!cell || cell.value === null || cell.value === undefined) return 0;
    
    if (typeof cell.value === 'object') {
        if (cell.value.result !== undefined && cell.value.result !== null) {
            return cell.value.result;
        }
        if (cell.value.text !== undefined) return cell.value.text;
        if (cell.value.richText) return cell.value.richText.map(rt => rt.text).join('');
        return 0;
    }
    return cell.value;
}

/**
 * Parse formula reference like "data!B2" and get value from data sheet
 * Also handles internal sheet formulas like "K6+I6+G6"
 */
function resolveFormulaValue(formula, dataSheet, currentSheet = null) {
    if (!formula) return '';
    
    // Match patterns like "data!B2" or "data!$B$2"
    const dataMatch = formula.match(/data!\$?([A-Z]+)\$?(\d+)/i);
    if (dataMatch && dataSheet) {
        const col = dataMatch[1];
        const rowNum = parseInt(dataMatch[2], 10);
        const cell = dataSheet.getCell(`${col}${rowNum}`);
        if (cell && cell.value !== null && cell.value !== undefined) {
            if (typeof cell.value === 'object') {
                if (cell.value.text) return cell.value.text;
                if (cell.value.richText) return cell.value.richText.map(rt => rt.text).join('');
                if (cell.value.result !== undefined) return cell.value.result;
                return '';
            }
            return cell.value;
        }
    }
    
    // Handle simple internal formulas like "K6+I6+G6" or "E6+(E6*L6)"
    if (currentSheet) {
        // Try to evaluate simple arithmetic formulas with cell references
        try {
            // Match cell references like K6, I6, G6
            const cellRefs = formula.match(/[A-Z]+\d+/gi);
            if (cellRefs) {
                let evalFormula = formula;
                for (const ref of cellRefs) {
                    const cell = currentSheet.getCell(ref);
                    const val = getCellActualValue(cell);
                    const numVal = typeof val === 'number' ? val : (parseFloat(val) || 0);
                    evalFormula = evalFormula.replace(new RegExp(ref, 'gi'), numVal.toString());
                }
                // Safely evaluate the formula (only allow numbers and basic operators)
                if (/^[\d\s+\-*/.()]+$/.test(evalFormula)) {
                    const result = Function('"use strict"; return (' + evalFormula + ')')();
                    return isNaN(result) ? 0 : result;
                }
            }
        } catch (e) {
            console.warn('[MAIN] Could not evaluate formula:', formula, e.message);
        }
    }
    
    return '';
}

/**
 * Convert an Excel sheet to HTML table - Only A1:N8 with exact styling
 * Uses dataSheet to resolve formula references
 */
function sheetToHtml(sheet, dataSheet) {
    let html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { 
                font-family: 'Calibri', 'Arial', sans-serif;
                background: white;
                padding: 10px;
            }
            table { 
                border-collapse: collapse;
                direction: rtl;
            }
            td {
                padding: 6px 10px;
                white-space: nowrap;
                vertical-align: middle;
            }
        </style>
    </head>
    <body>
        <table>
    `;

    for (let r = IMAGE_ROW_START; r <= IMAGE_ROW_END; r++) {
        const row = sheet.getRow(r);
        const rowHeight = row.height || 20;
        html += `<tr style="height: ${rowHeight}px;">`;
        
        for (let c = IMAGE_COL_START; c <= IMAGE_COL_END; c++) {
            const cell = row.getCell(c);
            const colWidth = sheet.getColumn(c).width || 10;
            
            // Get cell value - resolve formula references from data sheet
            let value = '';
            let rawValue = null;
            if (cell.value !== null && cell.value !== undefined) {
                if (typeof cell.value === 'object') {
                    if (cell.value.formula) {
                        // Try to get cached result first
                        if (cell.value.result !== undefined && cell.value.result !== null) {
                            rawValue = cell.value.result;
                            value = cell.value.result;
                        } else {
                            // Resolve from data sheet or calculate internal formula
                            value = resolveFormulaValue(cell.value.formula, dataSheet, sheet);
                            rawValue = value;
                        }
                    } else if (cell.value.text !== undefined) {
                        value = cell.value.text;
                    } else if (cell.value.richText) {
                        value = cell.value.richText.map(rt => rt.text).join('');
                    } else if (cell.value.error) {
                        value = cell.value.error;
                    } else if (cell.value.sharedFormula) {
                        // Handle shared formula result
                        if (cell.value.result !== undefined) {
                            rawValue = cell.value.result;
                            value = cell.value.result;
                        }
                    } else {
                        // Try to extract any meaningful value from object
                        try {
                            const keys = Object.keys(cell.value);
                            if (keys.length > 0) {
                                // Look for common value properties
                                for (const key of ['result', 'value', 'text', 'v']) {
                                    if (cell.value[key] !== undefined) {
                                        value = cell.value[key];
                                        rawValue = value;
                                        break;
                                    }
                                }
                                if (value === '') {
                                    value = ''; // Don't show [object Object]
                                }
                            }
                        } catch (e) {
                            value = '';
                        }
                    }
                } else {
                    value = cell.value;
                    rawValue = cell.value;
                }
            }
            
            // Apply number formatting (percentages, decimals, currency, etc.)
            if (rawValue !== null && typeof rawValue === 'number') {
                const numFmt = cell.numFmt || '';
                if (numFmt.includes('ر.س.')) {
                    // Saudi Riyal currency format - handle negative values correctly
                    const absValue = Math.abs(rawValue);
                    let formattedNum;
                    if (numFmt.includes('0.00')) {
                        formattedNum = absValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                    } else {
                        formattedNum = absValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
                    }
                    if (rawValue < 0) {
                        value = '-ر.س.' + formattedNum;  // Minus before currency symbol
                    } else {
                        value = 'ر.س.' + formattedNum;
                    }
                } else if (numFmt.includes('%')) {
                    // Percentage format - handle negative values correctly for Arabic
                    const percentValue = rawValue * 100;
                    const absValue = Math.abs(percentValue).toFixed(0);
                    if (percentValue < 0) {
                        // Negative: show as -X% (minus before number)
                        value = '-' + absValue + '%';
                    } else {
                        value = absValue + '%';
                    }
                } else if (numFmt.includes('0.00') || numFmt.includes('#,##0.00')) {
                    // Decimal format
                    value = rawValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                } else if (numFmt.includes('#,##0') || numFmt.includes('0,0')) {
                    // Number with thousands separator
                    value = rawValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
                } else if (typeof value === 'number') {
                    // Default number formatting
                    if (Number.isInteger(value)) {
                        value = value.toLocaleString('en-US');
                    } else {
                        value = value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                    }
                }
            }
            
            // Get styling
            const bgColor = getCellBgColor(cell);
            const fontColor = getCellFontColor(cell);
            const borders = getCellBorderCss(cell);
            
            // Font properties
            const fontSize = cell.font?.size || 11;
            const fontWeight = cell.font?.bold ? 'bold' : 'normal';
            const fontStyle = cell.font?.italic ? 'italic' : 'normal';
            const textDecoration = cell.font?.underline ? 'underline' : 'none';
            
            // Alignment
            let textAlign = 'center';
            if (cell.alignment?.horizontal) {
                textAlign = cell.alignment.horizontal;
            }
            
            const style = `
                background-color: ${bgColor};
                color: ${fontColor};
                font-size: ${fontSize}pt;
                font-weight: ${fontWeight};
                font-style: ${fontStyle};
                text-decoration: ${textDecoration};
                text-align: ${textAlign};
                border-top: ${borders.top || '1px solid #000'};
                border-right: ${borders.right || '1px solid #000'};
                border-bottom: ${borders.bottom || '1px solid #000'};
                border-left: ${borders.left || '1px solid #000'};
                min-width: ${colWidth * 7}px;
            `.replace(/\s+/g, ' ').trim();
            
            html += `<td style="${style}">${value}</td>`;
        }
        html += '</tr>';
    }

    html += '</table></body></html>';
    return html;
}

/**
 * Generate images from Excel sheets using Puppeteer
 * Resolves formula references from the data sheet
 */
async function generateSheetImages(calcPath, outputDir) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(calcPath);
    
    // Get the data sheet for formula resolution
    const dataSheet = workbook.getWorksheet('data') || workbook.worksheets.find(s => s.name.toLowerCase() === 'data');
    
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const generatedImages = [];
    const skipSheets = new Set(['calc', 'data']);

    try {
        for (const sheet of workbook.worksheets) {
            if (skipSheets.has(sheet.name.toLowerCase())) continue;
            
            // Pass dataSheet for formula resolution
            const html = sheetToHtml(sheet, dataSheet);
            const page = await browser.newPage();
            await page.setContent(html, { waitUntil: 'networkidle0' });
            
            // Set viewport and get content size
            await page.setViewport({ width: 1200, height: 800 });
            
            // Use exact sheet name for image filename (only sanitize unsafe path characters)
            const safeImageName = sheet.name.replace(/[<>:"/\\|?*]/g, '_');
            const imageName = `${safeImageName}.png`;
            const imagePath = path.join(outputDir, imageName);
            
            await page.screenshot({
                path: imagePath,
                fullPage: true,
                type: 'png'
            });
            
            await page.close();
            generatedImages.push({ sheetName: sheet.name, imagePath, imageName, safeImageName });
        }
    } finally {
        await browser.close();
    }

    return generatedImages;
}

/**
 * Get all image files from a directory
 */
async function getImagesFromFolder(folderPath) {
    try {
        const files = await fs.promises.readdir(folderPath);
        const images = files.filter(file => {
            const ext = path.extname(file).toLowerCase();
            return IMAGE_EXTENSIONS.includes(ext);
        });
        return images.map(img => path.join(folderPath, img));
    } catch (err) {
        return [];
    }
}

/**
 * Get all PDF files from a directory
 */
async function getPdfsFromFolder(folderPath) {
    try {
        const files = await fs.promises.readdir(folderPath);
        const pdfs = files.filter(file => {
            const ext = path.extname(file).toLowerCase();
            return PDF_EXTENSIONS.includes(ext);
        });
        return pdfs.map(pdf => ({
            name: path.basename(pdf, '.pdf'),
            path: path.join(folderPath, pdf)
        }));
    } catch (err) {
        return [];
    }
}

/**
 * Read name.json and get names grouped by ID
 */
function readNamesJson() {
    try {
        if (!fs.existsSync(NAME_JSON_PATH)) {
            return new Map();
        }
        const content = fs.readFileSync(NAME_JSON_PATH, 'utf8');
        const data = JSON.parse(content);
        
        // Group precedence values by ID
        const namesMap = new Map();
        if (data.names && Array.isArray(data.names)) {
            for (const entry of data.names) {
                if (entry.id && entry.precedence) {
                    if (!namesMap.has(entry.id)) {
                        namesMap.set(entry.id, []);
                    }
                    namesMap.get(entry.id).push(entry.precedence);
                }
            }
        }
        return namesMap;
    } catch (err) {
        console.error('[MAIN] Error reading name.json:', err);
        return new Map();
    }
}

/**
 * Convert PDF to image using Puppeteer with PDF.js
 */
async function convertPdfToImage(pdfPath, outputDir) {
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--allow-file-access-from-files']
    });
    
    try {
        const page = await browser.newPage();
        
        // Load PDF file as base64
        const pdfBuffer = await fs.promises.readFile(pdfPath);
        const pdfBase64 = pdfBuffer.toString('base64');
        
        // Create HTML with PDF.js to render the PDF
        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
            <style>
                * { margin: 0; padding: 0; }
                body { background: white; display: flex; flex-direction: column; align-items: center; }
                canvas { margin: 10px 0; box-shadow: 0 2px 5px rgba(0,0,0,0.2); }
            </style>
        </head>
        <body>
            <div id="container"></div>
            <script>
                pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                
                const pdfData = atob('${pdfBase64}');
                const pdfArray = new Uint8Array(pdfData.length);
                for (let i = 0; i < pdfData.length; i++) {
                    pdfArray[i] = pdfData.charCodeAt(i);
                }
                
                async function renderPDF() {
                    const pdf = await pdfjsLib.getDocument({ data: pdfArray }).promise;
                    const container = document.getElementById('container');
                    
                    // Render all pages
                    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                        const page = await pdf.getPage(pageNum);
                        const scale = 1.5;
                        const viewport = page.getViewport({ scale });
                        
                        const canvas = document.createElement('canvas');
                        const context = canvas.getContext('2d');
                        canvas.height = viewport.height;
                        canvas.width = viewport.width;
                        
                        await page.render({
                            canvasContext: context,
                            viewport: viewport
                        }).promise;
                        
                        container.appendChild(canvas);
                    }
                    
                    window.pdfRendered = true;
                }
                
                renderPDF();
            </script>
        </body>
        </html>
        `;
        
        await page.setContent(html, { waitUntil: 'networkidle0' });
        await page.setViewport({ width: 900, height: 1200 });
        
        // Wait for PDF to render
        await page.waitForFunction('window.pdfRendered === true', { timeout: 30000 });
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const pdfName = path.basename(pdfPath, '.pdf');
        const safePdfName = pdfName.replace(/[<>:"/\\|?*]/g, '_');
        const imagePath = path.join(outputDir, `${safePdfName}_pdf.png`);
        
        await page.screenshot({
            path: imagePath,
            fullPage: true,
            type: 'png'
        });
        
        await page.close();
        return imagePath;
    } catch (err) {
        console.error('[MAIN] Error converting PDF to image:', err);
        return null;
    } finally {
        await browser.close();
    }
}

/**
 * Ensure we have exactly 9 images (duplicate if needed)
 */
function ensureNineImages(images) {
    if (images.length === 0) return [];
    if (images.length >= 9) return images.slice(0, 9);
    
    const result = [...images];
    let idx = 0;
    while (result.length < 9) {
        result.push(images[idx % images.length]);
        idx++;
    }
    return result;
}

/**
 * Create a 3x3 grid table of images
 */
async function createImageGrid(images) {
    const nineImages = ensureNineImages(images);
    const rows = [];
    
    // Create 3 rows with 3 images each
    for (let rowIdx = 0; rowIdx < 3; rowIdx++) {
        const cells = [];
        
        for (let colIdx = 0; colIdx < 3; colIdx++) {
            const imgIdx = rowIdx * 3 + colIdx;
            const imgPath = nineImages[imgIdx];
            
            let cellContent;
            if (imgPath && fs.existsSync(imgPath)) {
                const imgBuffer = await fs.promises.readFile(imgPath);
                cellContent = new Paragraph({
                    children: [
                        new ImageRun({
                            data: imgBuffer,
                            transformation: {
                                width: 150,
                                height: 120
                            }
                        })
                    ],
                    alignment: AlignmentType.CENTER
                });
            } else {
                cellContent = new Paragraph({
                    text: '',
                    alignment: AlignmentType.CENTER
                });
            }
            
            cells.push(
                new TableCell({
                    children: [cellContent],
                    width: { size: 33, type: WidthType.PERCENTAGE },
                    verticalAlign: VerticalAlign.CENTER,
                    borders: {
                        top: { style: BorderStyle.NONE },
                        bottom: { style: BorderStyle.NONE },
                        left: { style: BorderStyle.NONE },
                        right: { style: BorderStyle.NONE }
                    }
                })
            );
        }
        
        rows.push(new TableRow({ children: cells }));
    }
    
    return new Table({
        rows: rows,
        width: { size: 100, type: WidthType.PERCENTAGE }
    });
}

/**
 * Create Word document using the provided template without altering existing content.
 * Inserts images at pages 11 (Excel), 12 (inspection grid), 13 (PDF) by injecting XML.
 */
async function createWordDocument(
    sheetImagePath,
    inspectionImages,
    outputPath,
    plateName,
    names = [],
    pdfImagePath = null
) {
    const templatePath = REPORT_TEMPLATE_PATH;
    if (!fs.existsSync(templatePath)) {
        throw new Error(`Template report.docx not found at ${templatePath}`);
    }

    // Load template as zip
    const templateContent = fs.readFileSync(templatePath);
    const zip = new PizZip(templateContent);

    let documentXml = zip.file('word/document.xml').asText();
    let relsContent = zip.file('word/_rels/document.xml.rels').asText();
    let contentTypesXml = zip.file('[Content_Types].xml').asText();

    // Ensure content types include png/jpg/jpeg
    const ensureContentType = (ext, type) => {
        if (!contentTypesXml.includes(`Extension="${ext}"`)) {
            const endTag = '</Types>';
            const pos = contentTypesXml.lastIndexOf(endTag);
            if (pos !== -1) {
                contentTypesXml =
                    contentTypesXml.slice(0, pos) +
                    `<Default Extension="${ext}" ContentType="${type}"/>` +
                    contentTypesXml.slice(pos);
            }
        }
    };
    ensureContentType('png', 'image/png');
    ensureContentType('jpg', 'image/jpeg');
    ensureContentType('jpeg', 'image/jpeg');

    // Find max existing rId to avoid collisions
    const rIdMatches = relsContent.match(/Id="rId(\d+)"/g) || [];
    let maxRId = 0;
    for (const m of rIdMatches) {
        const num = parseInt(m.match(/\d+/)[0], 10);
        if (num > maxRId) maxRId = num;
    }
    let imageCounter = maxRId + 1;
    let docPrIdCounter = 1000;
    const newImages = [];

    // Add image to zip and return rId
    const addImageToZip = (buffer, ext = 'png') => {
        const current = imageCounter++;
        const rId = `rId${current}`;
        const imgName = `image${current}.${ext}`;
        zip.file(`word/media/${imgName}`, buffer, { binary: true });
        newImages.push({ rId, target: `media/${imgName}` });
        return rId;
    };

    // Build inline image XML (EMU units)
    const createImageXml = (rId, widthEmu, heightEmu, docPrId) => {
        return (
            '<w:r>' +
            '<w:drawing>' +
            '<wp:inline distT="0" distB="0" distL="0" distR="0">' +
            `<wp:extent cx="${widthEmu}" cy="${heightEmu}"/>` +
            '<wp:effectExtent l="0" t="0" r="0" b="0"/>' +
            `<wp:docPr id="${docPrId}" name="Picture ${docPrId}"/>` +
            '<wp:cNvGraphicFramePr>' +
            '<a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/>' +
            '</wp:cNvGraphicFramePr>' +
            '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">' +
            '<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
            '<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
            '<pic:nvPicPr>' +
            `<pic:cNvPr id="${docPrId}" name="Picture ${docPrId}"/>` +
            '<pic:cNvPicPr/>' +
            '</pic:nvPicPr>' +
            '<pic:blipFill>' +
            `<a:blip r:embed="${rId}"/>` +
            '<a:stretch><a:fillRect/></a:stretch>' +
            '</pic:blipFill>' +
            '<pic:spPr>' +
            '<a:xfrm>' +
            '<a:off x="0" y="0"/>' +
            `<a:ext cx="${widthEmu}" cy="${heightEmu}"/>` +
            '</a:xfrm>' +
            '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>' +
            '</pic:spPr>' +
            '</pic:pic>' +
            '</a:graphicData>' +
            '</a:graphic>' +
            '</wp:inline>' +
            '</w:drawing>' +
            '</w:r>'
        );
    };

    // Collect explicit page breaks / section boundaries to locate existing pages
    const breaks = [];
    const pageBreakRegex = /<w:br[^>]*w:type\s*=\s*["']page["'][^>]*\/?>/gi;
    let match;
    while ((match = pageBreakRegex.exec(documentXml)) !== null) {
        breaks.push({ index: match.index });
    }
    const sectRegex = /<w:sectPr[^>]*>/gi;
    while ((match = sectRegex.exec(documentXml)) !== null) {
        breaks.push({ index: match.index });
    }
    breaks.sort((a, b) => a.index - b.index);

    // Require the template to already have enough breaks to reach page 13
    if (breaks.length < 14) {
        throw new Error('Template does not contain enough pages (expected at least 13).');
    }

    const getInsertPositionAfterPage = (pageNum) => {
        const breakIdx = pageNum - 1;
        if (breakIdx > 0 && breakIdx <= breaks.length) {
            const pos = breaks[breakIdx - 1].index;
            const pEnd = documentXml.indexOf('</w:p>', pos);
            if (pEnd !== -1) return pEnd + 6;
        }
        throw new Error(`Cannot locate page ${pageNum} in template; no insertion performed.`);
    };

    // Build page-specific XML blocks (descending order)
    const pageContent = [];

    // Page 13: PDF image (centered)
    if (pdfImagePath && fs.existsSync(pdfImagePath)) {
        const buf = fs.readFileSync(pdfImagePath);
        const rId = addImageToZip(buf, 'png');
        const widthEmu = 500 * 9525;
        const heightEmu = 700 * 9525;
        const xml = `<w:p><w:pPr><w:jc w:val="center"/></w:pPr>${createImageXml(rId, widthEmu, heightEmu, docPrIdCounter++)}</w:p>`;
        pageContent.push({ page: 13, xml });
    }

    // Page 12: inspection images (unique, max 9) 3 per row, centered
    if (inspectionImages && inspectionImages.length > 0) {
        const unique = [...new Set(inspectionImages)].filter((p) => fs.existsSync(p)).slice(0, 9);
        if (unique.length > 0) {
            let xml = '';
            let count = 0;
            for (let i = 0; i < unique.length; i++) {
                if (count % 3 === 0) {
                    if (count > 0) xml += '</w:p>';
                    xml += '<w:p><w:pPr><w:jc w:val="center"/></w:pPr>';
                }
                const buf = fs.readFileSync(unique[i]);
                const rId = addImageToZip(buf, 'png');
                const widthEmu = 180 * 9525;
                const heightEmu = 140 * 9525;
                xml += createImageXml(rId, widthEmu, heightEmu, docPrIdCounter++);
                count++;
            }
            if (count > 0) xml += '</w:p>';
            pageContent.push({ page: 12, xml });
        }
    }

    // Page 11: Excel image (centered, landscape page in template)
    if (sheetImagePath && fs.existsSync(sheetImagePath)) {
        const buf = fs.readFileSync(sheetImagePath);
        const rId = addImageToZip(buf, 'png');
        const widthEmu = 700 * 9525;
        const heightEmu = 450 * 9525;
        const xml = `<w:p><w:pPr><w:jc w:val="center"/></w:pPr>${createImageXml(rId, widthEmu, heightEmu, docPrIdCounter++)}</w:p>`;
        pageContent.push({ page: 11, xml });
    }

    // Insert blocks from back to front to keep indices valid
    pageContent.sort((a, b) => b.page - a.page);
    for (const block of pageContent) {
        const insertPos = getInsertPositionAfterPage(block.page);
        documentXml = documentXml.slice(0, insertPos) + block.xml + documentXml.slice(insertPos);
        // adjust break indices that follow the insertion
        for (const b of breaks) {
            if (b.index >= insertPos) b.index += block.xml.length;
        }
    }

    // Ensure required namespaces on root (without duplicating)
    if (!documentXml.includes('xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"')) {
        documentXml = documentXml.replace(
            '<w:document ',
            '<w:document xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" '
        );
    }
    if (!documentXml.includes('xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"')) {
        documentXml = documentXml.replace(
            '<w:document ',
            '<w:document xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" '
        );
    }

    // Add new relationships
    if (newImages.length > 0) {
        const endTag = '</Relationships>';
        const pos = relsContent.lastIndexOf(endTag);
        if (pos !== -1) {
            let rels = '';
            for (const img of newImages) {
                rels += `<Relationship Id="${img.rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${img.target}"/>`;
            }
            relsContent = relsContent.slice(0, pos) + rels + relsContent.slice(pos);
        }
    }

    // Write back updated parts
    zip.file('word/document.xml', documentXml);
    zip.file('word/_rels/document.xml.rels', relsContent);
    zip.file('[Content_Types].xml', contentTypesXml);

    const output = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
    await fs.promises.writeFile(outputPath, output);
    return outputPath;
}

/**
 * Generate images from calc.xlsx sheets
 */
async function createSheetImagesOnly(basePath, folderName) {
    if (!basePath || !folderName) {
        throw new Error('basePath and folderName are required.');
    }

    const root = path.join(basePath, folderName);
    const calcDir = path.join(root, MAIN_FOLDERS[CALC_FOLDER_INDEX]);
    const calcPath = path.join(calcDir, CALC_TARGET_NAME);

    if (!fs.existsSync(calcPath)) {
        throw new Error(`calc.xlsx not found at ${calcPath}. Please run "Update calc.xlsx" first.`);
    }

    // Create images subfolder in folder 3
    const imagesDir = path.join(calcDir, 'sheet_images');
    await ensureDir(imagesDir);

    const images = await generateSheetImages(calcPath, imagesDir);
    
    return { 
        root, 
        imagesDir, 
        imagesCount: images.length,
        images: images.map(img => img.imageName)
    };
}

/**
 * Create Word documents for each plate - saved directly in folder 3 (اعداد مسودة التقرير و حسابات القيمة)
 * Includes names from name.json and PDF images from PDFs folder
 */
async function createWordDocsOnly(basePath, folderName) {
    if (!basePath || !folderName) {
        throw new Error('basePath and folderName are required.');
    }

    const root = path.join(basePath, folderName);
    const calcDir = path.join(root, MAIN_FOLDERS[CALC_FOLDER_INDEX]);  // Folder 3
    const locationRoot = path.join(root, MAIN_FOLDERS[LOCATION_FOLDER_INDEX]);  // Folder 2
    const imagesDir = path.join(calcDir, 'sheet_images');
    const pdfImagesDir = path.join(calcDir, 'pdf_images');  // Temp folder for PDF images

    if (!fs.existsSync(imagesDir)) {
        throw new Error('Sheet images not found. Please run "Create Images" first.');
    }

    // Create temp folder for PDF images
    await ensureDir(pdfImagesDir);

    // Read name.json to get names by ID
    const namesMap = readNamesJson();

    // Get all sheet images - map by exact name (without sanitization)
    const sheetImages = await getImagesFromFolder(imagesDir);
    const sheetImageMap = new Map();
    for (const imgPath of sheetImages) {
        const name = path.basename(imgPath, '.png');
        const safeName = name.replace(/[<>:"/\\|?*]/g, '_');
        sheetImageMap.set(name, imgPath);
        sheetImageMap.set(safeName, imgPath);
    }

    // Get all PDFs from PDFs folder in folder 3 - map by exact name
    const pdfsFolderPath = path.join(calcDir, 'PDFs');
    const pdfMap = new Map();
    if (fs.existsSync(pdfsFolderPath)) {
        const pdfs = await getPdfsFromFolder(pdfsFolderPath);
        for (const pdf of pdfs) {
            // Map by PDF name (without extension)
            pdfMap.set(pdf.name, pdf.path);
            // Also map by sanitized name
            const safeName = pdf.name.replace(/[<>:"/\\|?*]/g, '_');
            pdfMap.set(safeName, pdf.path);
        }
    }

    // Traverse location folders and plate folders
    const locationFolders = await fs.promises.readdir(locationRoot);
    let docsCreated = 0;
    const createdDocs = [];

    for (const locFolder of locationFolders) {
        const locPath = path.join(locationRoot, locFolder);
        const locStat = await fs.promises.stat(locPath);
        if (!locStat.isDirectory()) continue;

        const plateFolders = await fs.promises.readdir(locPath);
        
        for (const plateFolder of plateFolders) {
            const platePath = path.join(locPath, plateFolder);
            const plateStat = await fs.promises.stat(platePath);
            if (!plateStat.isDirectory()) continue;

            // Use exact plate folder name (e.g., "1-ا ص ل 3807")
            const plateName = plateFolder;
            // Safe filename for doc (only sanitize unsafe path characters)
            const safeDocName = plateFolder.replace(/[<>:"/\\|?*]/g, '_');

            // Find corresponding sheet image by exact/sanitized folder name
            const sheetImagePath = sheetImageMap.get(plateName) ||
                                   sheetImageMap.get(safeDocName) ||
                                   sheetImages[0]; // fallback to first image

            // Get inspection images from plate folder (folder 2)
            const inspectionImages = await getImagesFromFolder(platePath);

            // Get names from name.json for this plate
            const plateNames = namesMap.get(plateName) || namesMap.get(safeDocName) || [];

            // Look for matching PDF in pdfMap (from PDFs folder in folder 3)
            let pdfImagePath = null;
            const matchingPdf = pdfMap.get(plateName) || pdfMap.get(safeDocName);
            if (matchingPdf) {
                // Convert PDF to image
                pdfImagePath = await convertPdfToImage(matchingPdf, pdfImagesDir);
            }

            // Create Word document DIRECTLY in folder 3 (no subfolder)
            const docFileName = `${safeDocName}.docx`;
            const docPath = path.join(calcDir, docFileName);

            await createWordDocument(sheetImagePath, inspectionImages, docPath, plateName, plateNames, pdfImagePath);
            docsCreated++;
            createdDocs.push(docFileName);
        }
    }

    return {
        root,
        calcDir,
        docsCreated,
        createdDocs
    };
}

const valuationHandlers = {
    async handleCreateFolders(event, payload = {}) {
        try {
            const { basePath, folderName, dataExcelPath } = payload;
            const result = await createFoldersOnly(basePath, folderName, dataExcelPath);
            return {
                ok: true,
                root: result.root,
                created: {
                    mainFolders: result.subFolders,
                    locations: result.locationsCreated,
                    plates: result.platesCreated
                }
            };
        } catch (error) {
            console.error('[MAIN] valuation create folders failed:', error);
            return { ok: false, error: error.message || 'Failed to create valuation folders.' };
        }
    },

    async handleUpdateCalc(event, payload = {}) {
        try {
            const { basePath, folderName, dataExcelPath } = payload;
            const result = await updateCalcOnly(basePath, folderName, dataExcelPath);
            return {
                ok: true,
                root: result.root,
                calcPath: result.calcPath
            };
        } catch (error) {
            console.error('[MAIN] valuation update calc failed:', error);
            return { ok: false, error: error.message || 'Failed to update calc.xlsx.' };
        }
    },

    async handleCreateImages(event, payload = {}) {
        try {
            const { basePath, folderName } = payload;
            const result = await createSheetImagesOnly(basePath, folderName);
            return {
                ok: true,
                root: result.root,
                imagesDir: result.imagesDir,
                imagesCount: result.imagesCount,
                images: result.images
            };
        } catch (error) {
            console.error('[MAIN] valuation create images failed:', error);
            return { ok: false, error: error.message || 'Failed to create sheet images.' };
        }
    },

    async handleCreateDocs(event, payload = {}) {
        try {
            const { basePath, folderName } = payload;
            const result = await createWordDocsOnly(basePath, folderName);
            return {
                ok: true,
                root: result.root,
                calcDir: result.calcDir,
                docsCreated: result.docsCreated,
                createdDocs: result.createdDocs
            };
        } catch (error) {
            console.error('[MAIN] valuation create docs failed:', error);
            return { ok: false, error: error.message || 'Failed to create Word documents.' };
        }
    }
};

module.exports = valuationHandlers;
