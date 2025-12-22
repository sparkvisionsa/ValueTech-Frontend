const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');
const xmljs = require('xml-js');
const { loadImage } = require('@napi-rs/canvas');

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.bmp', '.gif']);
const XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const XML_TREE_OPTS = { compact: false, ignoreComment: true, ignoreDeclaration: true, alwaysChildren: true };
const XML_COMPACT_OPTS = { compact: true, ignoreComment: true, ignoreDeclaration: true };

const sanitizeFileName = (name) => {
    if (!name && name !== 0) return '';
    return String(name).trim().replace(/[<>:"/\\|?*\x00-\x1F]/g, '-').replace(/-+/g, '-');
};

const toArray = (val) => {
    if (!val) return [];
    return Array.isArray(val) ? val : [val];
};

const parseXmlTree = (xmlText) => xmljs.xml2js(xmlText, XML_TREE_OPTS);
const parseXmlCompact = (xmlText) => xmljs.xml2js(xmlText, XML_COMPACT_OPTS);
const buildXmlTree = (obj, withDecl = true) => {
    const xml = xmljs.js2xml(obj, { compact: false, spaces: 2, fullTagEmptyElement: true });
    return withDecl ? `${XML_DECLARATION}\n${xml}` : xml;
};
const buildXmlCompact = (obj, withDecl = true) => {
    const xml = xmljs.js2xml(obj, { compact: true, spaces: 2 });
    return withDecl ? `${XML_DECLARATION}\n${xml}` : xml;
};

function normalizeRelationships(relObj = {}) {
    if (!relObj.Relationships) {
        relObj.Relationships = { _attributes: { xmlns: 'http://schemas.openxmlformats.org/package/2006/relationships' }, Relationship: [] };
    }
    if (!relObj.Relationships._attributes) {
        relObj.Relationships._attributes = { xmlns: 'http://schemas.openxmlformats.org/package/2006/relationships' };
    }
    relObj.Relationships.Relationship = toArray(relObj.Relationships.Relationship);
    return relObj;
}

function ensureImageContentTypes(zip) {
    const contentFile = zip.file('[Content_Types].xml');
    if (!contentFile) throw new Error('Missing [Content_Types].xml in DOCX.');
    const obj = parseXmlCompact(contentFile.asText());
    const defaults = toArray(obj.Types?.Default);
    const ensure = (ext, type) => {
        if (!defaults.some((d) => d?._attributes?.Extension === ext)) {
            defaults.push({ _attributes: { Extension: ext, ContentType: type } });
        }
    };
    ensure('png', 'image/png');
    ensure('jpg', 'image/jpeg');
    ensure('jpeg', 'image/jpeg');
    ensure('bmp', 'image/bmp');
    ensure('gif', 'image/gif');
    obj.Types.Default = defaults;
    zip.file('[Content_Types].xml', buildXmlCompact(obj));
}

function getDocumentAndBody(zip) {
    const docFile = zip.file('word/document.xml');
    if (!docFile) throw new Error('document.xml is missing inside DOCX.');
    const docTree = parseXmlTree(docFile.asText());
    const docEl = toArray(docTree.elements).find((el) => el.name === 'w:document');
    const body = toArray(docEl?.elements).find((el) => el.name === 'w:body');
    if (!docEl || !body) throw new Error('Could not find w:body inside document.xml.');
    return { docTree, docEl, body };
}

function writeDocumentTree(zip, docTree) {
    zip.file('word/document.xml', buildXmlTree(docTree));
}

function validateDocxBuffer(buffer) {
    try {
        const checkZip = new PizZip(buffer);
        const docFile = checkZip.file('word/document.xml');
        if (!docFile) throw new Error('document.xml not found while validating.');
        parseXmlTree(docFile.asText());
    } catch (err) {
        throw new Error(`DOCX validation failed: ${err?.message || err}`);
    }
}

function loadDocumentRelationships(zip) {
    const relsFile = zip.file('word/_rels/document.xml.rels');
    return normalizeRelationships(relsFile ? parseXmlCompact(relsFile.asText()) : {});
}

function maxDocPrId(node) {
    let max = 0;
    const visit = (el) => {
        if (!el) return;
        if (el.name === 'wp:docPr' && el.attributes?.id) {
            const n = Number(el.attributes.id);
            if (Number.isFinite(n)) max = Math.max(max, n);
        }
        toArray(el.elements).forEach(visit);
    };
    visit(node);
    return max;
}

function toParagraphElements(xmlSnippet) {
    const tree = parseXmlTree(xmlSnippet);
    return toArray(tree.elements).filter((el) => el.name === 'w:p');
}

function bodyContentEndIndex(body) {
    if (!body?.elements) return 0;
    const sectIdx = body.elements.findIndex((el) => el.name === 'w:sectPr');
    return sectIdx === -1 ? body.elements.length : sectIdx;
}

function computeContainSize(imgWidth, imgHeight, maxWidth, maxHeight) {
    if (!imgWidth || !imgHeight || !maxWidth || !maxHeight) {
        return { width: maxWidth, height: maxHeight };
    }
    const scale = Math.min(maxWidth / imgWidth, maxHeight / imgHeight);
    return {
        width: Math.max(1, Math.round(imgWidth * scale)),
        height: Math.max(1, Math.round(imgHeight * scale))
    };
}

function isImageFile(filePath) {
    const ext = (path.extname(filePath) || '').toLowerCase();
    return IMAGE_EXTENSIONS.has(ext);
}

async function appendImagesToDocx(docxPath, imagePaths, opts = {}) {
    const {
        imagesPerRow = 2,
        maxImageWidthPx = 520,
        maxImageHeightPx = 360,
        indentTwips = 1200,
        rightIndentTwips = 120,
        spacingBeforeTwips = 200,
        spacingAfterTwips = 200,
        insertPageBreak = true
    } = opts;

    const usableImages = Array.isArray(imagePaths)
        ? imagePaths.filter((p) => typeof p === 'string' && p.trim() && isImageFile(p) && fs.existsSync(p))
        : [];

    if (!usableImages.length) return { appended: 0 };

    const zip = new PizZip(fs.readFileSync(docxPath));
    ensureImageContentTypes(zip);
    const { docTree, body } = getDocumentAndBody(zip);
    body.elements = body.elements || [];
    const relObj = loadDocumentRelationships(zip);
    const rels = relObj.Relationships.Relationship;

    let nextRelNum = rels.reduce((acc, rel) => {
        const num = Number(String(rel?._attributes?.Id || '').replace(/[^\d]/g, ''));
        return Number.isFinite(num) ? Math.max(acc, num) : acc;
    }, 0) + 1;
    let nextDocPr = maxDocPrId(docTree) + 1;
    const pxToEmu = (px) => Math.round(px * 9525);

    const runs = [];
    for (let i = 0; i < usableImages.length; i += 1) {
        const imgPath = usableImages[i];
        const buffer = await fs.promises.readFile(imgPath);
        const ext = (path.extname(imgPath) || '.png').toLowerCase();
        const safeExt = IMAGE_EXTENSIONS.has(ext) ? ext : '.png';
        const imageName = `copy_image_${Date.now()}_${i}${safeExt}`;
        const relId = `rId${nextRelNum++}`;

        zip.file(`word/media/${imageName}`, buffer);
        rels.push({
            _attributes: {
                Id: relId,
                Type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image',
                Target: `media/${imageName}`
            }
        });

        let imgW = null;
        let imgH = null;
        try {
            const img = await loadImage(buffer);
            imgW = img?.width;
            imgH = img?.height;
        } catch (_) {
            // Fallback to the max sizes below if dimensions are unavailable.
        }
        const { width, height } = computeContainSize(imgW, imgH, maxImageWidthPx, maxImageHeightPx);
        runs.push({ relId, imageName, cx: pxToEmu(width), cy: pxToEmu(height), docPrId: nextDocPr++ });
    }

    if (!runs.length) return { appended: 0 };

    const makeInlineDrawingRun = (img) => `
      <w:r>
        <w:drawing>
          <wp:inline distT="0" distB="0" distL="0" distR="0" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">
            <wp:extent cx="${img.cx}" cy="${img.cy}"/>
            <wp:docPr id="${img.docPrId}" name="CopyImage"/>
            <a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
              <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
                <pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
                  <pic:nvPicPr>
                    <pic:cNvPr id="0" name="${img.imageName}"/>
                    <pic:cNvPicPr/>
                  </pic:nvPicPr>
                  <pic:blipFill>
                    <a:blip r:embed="${img.relId}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/>
                    <a:stretch><a:fillRect/></a:stretch>
                  </pic:blipFill>
                  <pic:spPr>
                    <a:xfrm>
                      <a:off x="0" y="0"/>
                      <a:ext cx="${img.cx}" cy="${img.cy}"/>
                    </a:xfrm>
                    <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
                  </pic:spPr>
                </pic:pic>
              </a:graphicData>
            </a:graphic>
          </wp:inline>
        </w:drawing>
      </w:r>
    `;

    const paragraphsToInsert = [];
    if (insertPageBreak) {
        paragraphsToInsert.push(...toParagraphElements('<w:p><w:r><w:br w:type="page"/></w:r></w:p>'));
    }

    for (let i = 0; i < runs.length; i += imagesPerRow) {
        const chunk = runs.slice(i, i + imagesPerRow);
        const runXml = chunk.map((img) => makeInlineDrawingRun(img)).join('');
        const paraXml = `
          <w:p>
            <w:pPr>
              <w:ind w:left="${indentTwips}" w:right="${rightIndentTwips}"/>
              <w:jc w:val="right"/>
              <w:spacing w:before="${spacingBeforeTwips}" w:after="${spacingAfterTwips}" w:line="240" w:lineRule="auto"/>
            </w:pPr>
            ${runXml}
          </w:p>
        `;
        paragraphsToInsert.push(...toParagraphElements(paraXml));
    }

    const insertIndex = bodyContentEndIndex(body);
    body.elements.splice(insertIndex, 0, ...paragraphsToInsert);

    writeDocumentTree(zip, docTree);
    zip.file('word/_rels/document.xml.rels', buildXmlCompact(relObj));
    const updated = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
    validateDocxBuffer(updated);
    fs.writeFileSync(docxPath, updated);
    return { appended: runs.length };
}

const wordHandlers = {
    async handleCopyWordFile(event, payload = {}) {
        try {
            const { sourcePath, targetDir, copies, baseName, imagePaths, pageBreakBeforeImages = true } = payload;
            if (!sourcePath || !targetDir) {
                throw new Error('sourcePath and targetDir are required.');
            }

            if (!fs.existsSync(sourcePath)) {
                throw new Error(`Source Word file not found: ${sourcePath}`);
            }

            const ext = (path.extname(sourcePath) || '.docx').toLowerCase();
            const allowedExts = new Set(['.docx', '.doc', '.dotx', '.dot']);
            if (!allowedExts.has(ext)) {
                throw new Error('Please choose a valid Word document (.docx or .doc).');
            }

            const wantsImages = Array.isArray(imagePaths) && imagePaths.length > 0;
            const isOpenXmlDoc = ['.docx', '.dotx'].includes(ext);
            if (wantsImages && !isOpenXmlDoc) {
                throw new Error('Appending images is only supported for DOCX files. Please pick a .docx template.');
            }

            const count = Number(copies);
            if (!Number.isInteger(count) || count <= 0) {
                throw new Error('Copies must be a positive integer.');
            }

            await fs.promises.mkdir(targetDir, { recursive: true });

            const safeBase = sanitizeFileName(baseName || path.basename(sourcePath, ext)) || 'Document';
            const createdFiles = [];
            let appendedImages = 0;
            let appendedFiles = 0;

            for (let i = 1; i <= count; i += 1) {
                let suffix = i;
                let destPath = path.join(targetDir, `${safeBase}-${suffix}${ext}`);
                while (fs.existsSync(destPath)) {
                    suffix += 1;
                    destPath = path.join(targetDir, `${safeBase}-${suffix}${ext}`);
                }
                await fs.promises.copyFile(sourcePath, destPath);
                createdFiles.push(destPath);

                if (wantsImages) {
                    try {
                        const appendResult = await appendImagesToDocx(destPath, imagePaths, { insertPageBreak: pageBreakBeforeImages !== false });
                        if (appendResult?.appended) {
                            appendedImages += appendResult.appended;
                            appendedFiles += 1;
                        }
                    } catch (appendErr) {
                        throw new Error(`Copied files but failed to append images to ${path.basename(destPath)}: ${appendErr.message}`);
                    }
                }
            }

            return {
                ok: true,
                createdCount: createdFiles.length,
                targetDir,
                files: createdFiles,
                appendedImages,
                appendedFiles
            };
        } catch (error) {
            console.error('[MAIN] Copy Word file failed:', error);
            return { ok: false, error: error.message || 'Failed to copy Word file.' };
        }
    }
};

module.exports = wordHandlers;
