/**
 * Node smoke test for Excel preview parsing of the anti-fraud case workbook.
 *
 * Usage:
 *   node scripts/smoke-excel.mjs [xlsxPath]
 *
 * Exit 0 if required sheets, CJK, freeze, wrap, empty 实际结果, and formulas exist.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const DEFAULT_XLSX = path.normalize(
    'd:\\pyproject\\llm\\mcp\\researchPaper\\weekly_topics\\2026-w37-telecom-antifraud-risk-report\\电信反诈测评用例集.xlsx',
);

const REQUIRED_SHEETS = ['用例总表', '使用说明', '参数字典', '风险-措施对照', '统计'];
const CJK = /[\u4E00-\u9FFF]/;
const EVIDENCE_HTML = path.join(ROOT, 'docs', 'evidence', 'excel-preview.html');

function fail(message) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
}

function parseArg(argv) {
    const args = argv.slice(2).filter((a) => a !== '--');
    return args[0] || DEFAULT_XLSX;
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function cellText(cell) {
    const value = cell.value;
    if (value == null) {
        return '';
    }
    if (typeof value === 'object' && value.formula) {
        const result = value.result == null ? '' : String(value.result);
        return result || `=${value.formula}`;
    }
    if (typeof value === 'object' && value.richText) {
        return value.richText.map((p) => p.text || '').join('');
    }
    return String(cell.text || value);
}

function writeEvidence(wb) {
    const sections = wb.worksheets.map((ws) => {
        const rows = [];
        ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
            if (rowNumber > 12) {
                return;
            }
            const tds = [];
            row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                if (colNumber > 8) {
                    return;
                }
                tds.push(`<td>${escapeHtml(cellText(cell)).replace(/\n/g, '<br/>')}</td>`);
            });
            rows.push(`<tr>${tds.join('')}</tr>`);
        });
        return `<h2>${escapeHtml(ws.name)}</h2><table border="1" cellspacing="0" cellpadding="4">${rows.join('')}</table>`;
    });
    const html = `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="UTF-8"/><title>kc-devkit excel smoke</title>
<style>
body{font-family:"Microsoft YaHei","PingFang SC",sans-serif;padding:16px;}
table{border-collapse:collapse;margin-bottom:24px;font-size:12px;}
td{white-space:pre-wrap;max-width:240px;vertical-align:top;}
h1{font-size:18px;}
</style></head>
<body>
<h1>KC DevKit Excel preview smoke</h1>
<p>Sheets: ${wb.worksheets.map((w) => escapeHtml(w.name)).join(' / ')}</p>
${sections.join('\n')}
</body></html>`;
    fs.mkdirSync(path.dirname(EVIDENCE_HTML), { recursive: true });
    fs.writeFileSync(EVIDENCE_HTML, html, 'utf8');
}

async function main() {
    const xlsxPath = parseArg(process.argv);
    if (!fs.existsSync(xlsxPath)) {
        fail(`file not found: ${xlsxPath}`);
    }
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(xlsxPath);
    const names = wb.worksheets.map((w) => w.name);
    console.log(`sheets: ${names.join(' | ')}`);
    for (const required of REQUIRED_SHEETS) {
        if (!names.includes(required)) {
            fail(`missing sheet: ${required} (have: ${names.join(', ')})`);
        }
    }

    const cases = wb.getWorksheet('用例总表');
    if (!cases) {
        fail('用例总表 missing after lookup');
    }
    const header = cellText(cases.getRow(1).getCell(1));
    if (!CJK.test(header)) {
        fail(`用例总表 header is not CJK: ${header}`);
    }
    const freeze = cases.views?.[0];
    const frozen = freeze && freeze.state === 'frozen';
    if (!frozen) {
        fail('用例总表 freeze panes not frozen');
    }
    const wrapSample = cases.getRow(2).getCell(10);
    if (!wrapSample.alignment?.wrapText) {
        fail('用例总表 wrap_text missing on 测试步骤');
    }
    const actualRaw = cases.getRow(2).getCell(14).value;
    const actual = actualRaw == null ? '' : String(actualRaw).trim();
    if (actual.length > 0) {
        fail(`实际结果 should stay empty, got: ${actual}`);
    }

    const stats = wb.getWorksheet('统计');
    if (!stats) {
        fail('统计 missing after lookup');
    }
    const formula = stats.getRow(2).getCell(2).value;
    const formulaText = typeof formula === 'object' && formula && 'formula' in formula ? String(formula.formula) : '';
    if (!formulaText.includes('COUNTIF')) {
        fail(`统计 B2 should be COUNTIF, got: ${JSON.stringify(formula)}`);
    }
    const sumCell = stats.getRow(12).getCell(2).value;
    const sumText = typeof sumCell === 'object' && sumCell && 'formula' in sumCell ? String(sumCell.formula) : '';
    if (!sumText.includes('SUM')) {
        fail(`统计 B12 should be SUM, got: ${JSON.stringify(sumCell)}`);
    }

    writeEvidence(wb);
    console.log(`OK sheets=${names.length} casesHeader=${header} evidence=${EVIDENCE_HTML}`);
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err)));
