const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

const MAIN_FOLDERS = [
    '1.ملفات العميل',
    '2.صور المعاينة',
    '3.اعداد مسودة التقرير و حسابات القيمة',
    '4.التقرير بالتوقيع',
    '5.ملفات التسليم النهائية'
];

const LOCATION_FOLDER_INDEX = 1; // second folder
const CALC_SOURCE_PATH = '/home/mostafa-hosny/Desktop/Electron/Future_Electron/excelfile_calc/calc.xlsx';
const CALC_TARGET_NAME = 'calc.xlsx';

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

function setDataRefs(sheet, dataRowIndex) {
    const setRef = (addr, col) => {
        sheet.getCell(addr).value = { formula: `data!${col}${dataRowIndex}` };
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

    // Inline calculations on the same sheet
    sheet.getCell('L6').value = { formula: 'K6+I6+G6' };
    sheet.getCell('L7').value = { formula: 'K7+I7+G7' };
    sheet.getCell('L8').value = { formula: 'K8+I8+G8' };

    sheet.getCell('M6').value = { formula: 'E6+(E6*L6)' };
    sheet.getCell('M7').value = { formula: 'E7+(E7*L7)' };
    sheet.getCell('M8').value = { formula: 'E8+(E8*L8)' };
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
        const base = sanitizeName(raw) || `Sheet_${fallbackIndex}`;
        let name = base;
        let i = 1;
        while (usedNames.has(name)) {
            name = `${base}_${i}`;
            i += 1;
        }
        usedNames.add(name);
        return name;
    };

    const lastRow = dataMaxRow || dataSheet.lastRow?.number || dataSheet.rowCount;
    for (let r = 2; r <= lastRow; r++) {
        const dataRow = dataSheet.getRow(r);
        const nameCell = dataRow.getCell('B').value;
        if (!nameCell) continue; // skip empty
        const sheetName = makeName(nameCell, r);

        const newSheet = calcWorkbook.addWorksheet(sheetName);
        cloneSheet(templateSheet, newSheet);
        setDataRefs(newSheet, r);
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
    }
};

module.exports = valuationHandlers;
