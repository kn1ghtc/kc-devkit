/**
 * .xlsx / .xlsm via ExcelJS (MIT): fills, fonts, wrap, freeze, widths, cached formulas.
 */

import ExcelJS from 'exceljs';

import type { ExcelCellModel, ExcelMergeModel, ExcelSheetModel, ExcelWorkbookModel } from './protocol';
import { parseXlsWithSheetJs } from './parse-xls';

const MAX_ROWS = 8000;
const MAX_COLS = 256;
const DEFAULT_COL_PX = 100;
const DEFAULT_ROW_PX = 22;

function argbToCss(argb: string | undefined): string | undefined {
    if (!argb) {
        return undefined;
    }
    const hex = argb.replace(/^#/, '').toUpperCase();
    if (hex.length === 8) {
        const rgb = hex.slice(2);
        if (rgb === '000000' || rgb === 'FFFFFF') {
            return `#${rgb}`;
        }
        return `#${rgb}`;
    }
    if (hex.length === 6) {
        return `#${hex}`;
    }
    return undefined;
}

function colorOf(color: Partial<ExcelJS.Color> | undefined): string | undefined {
    if (!color) {
        return undefined;
    }
    if (typeof color.argb === 'string') {
        return argbToCss(color.argb);
    }
    return undefined;
}

function formatPrimitive(value: unknown): string {
    if (value == null) {
        return '';
    }
    if (value instanceof Date) {
        return value.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '');
    }
    if (typeof value === 'boolean') {
        return value ? 'TRUE' : 'FALSE';
    }
    if (typeof value === 'number') {
        return Number.isFinite(value) ? String(value) : '';
    }
    return String(value);
}

function richTextOf(value: ExcelJS.CellRichTextValue): string {
    return value.richText.map((p) => p.text ?? '').join('');
}

function cellDisplay(cell: ExcelJS.Cell): { t: string; f?: string } {
    const value = cell.value;
    if (value == null) {
        return { t: '' };
    }
    if (typeof value === 'object' && 'richText' in value) {
        return { t: richTextOf(value as ExcelJS.CellRichTextValue) };
    }
    if (typeof value === 'object' && 'hyperlink' in value) {
        const h = value as ExcelJS.CellHyperlinkValue;
        return { t: h.text || h.hyperlink || '' };
    }
    if (typeof value === 'object' && 'formula' in value) {
        const f = value as ExcelJS.CellFormulaValue;
        const formula = f.formula ? `=${f.formula}` : undefined;
        const result = formatPrimitive(f.result);
        return { t: result || formula || '', f: formula };
    }
    if (typeof value === 'object' && 'sharedFormula' in value) {
        const f = value as ExcelJS.CellSharedFormulaValue;
        const formula = f.sharedFormula ? `=${f.sharedFormula}` : undefined;
        const result = formatPrimitive(f.result);
        return { t: result || formula || '', f: formula };
    }
    if (typeof value === 'object' && 'error' in value) {
        return { t: String((value as ExcelJS.CellErrorValue).error) };
    }
    const text = cell.text != null && String(cell.text).length > 0 ? String(cell.text) : formatPrimitive(value);
    return { t: text };
}

function alignH(value: ExcelJS.Alignment['horizontal'] | undefined): ExcelCellModel['ah'] {
    if (value === 'center' || value === 'centerContinuous' || value === 'distributed') {
        return 'center';
    }
    if (value === 'right') {
        return 'right';
    }
    if (value === 'left') {
        return 'left';
    }
    return undefined;
}

function alignV(value: ExcelJS.Alignment['vertical'] | undefined): ExcelCellModel['av'] {
    if (value === 'middle') {
        return 'middle';
    }
    if (value === 'top') {
        return 'top';
    }
    if (value === 'bottom') {
        return 'bottom';
    }
    return undefined;
}

function fillColor(cell: ExcelJS.Cell): string | undefined {
    const fill = cell.fill;
    if (!fill || fill.type !== 'pattern') {
        return undefined;
    }
    const pattern = fill as ExcelJS.FillPattern;
    return colorOf(pattern.fgColor) ?? colorOf(pattern.bgColor);
}

function toCellModel(cell: ExcelJS.Cell): ExcelCellModel {
    const { t, f } = cellDisplay(cell);
    const model: ExcelCellModel = { t };
    if (f) {
        model.f = f;
    }
    const bg = fillColor(cell);
    if (bg) {
        model.bg = bg;
    }
    const fg = colorOf(cell.font?.color);
    if (fg) {
        model.fg = fg;
    }
    if (cell.font?.bold) {
        model.b = true;
    }
    if (cell.alignment?.wrapText) {
        model.w = true;
    }
    const ah = alignH(cell.alignment?.horizontal);
    if (ah) {
        model.ah = ah;
    }
    const av = alignV(cell.alignment?.vertical);
    if (av) {
        model.av = av;
    }
    return model;
}

function colWidthPx(width: number | undefined): number {
    if (typeof width !== 'number' || width <= 0) {
        return DEFAULT_COL_PX;
    }
    return Math.max(32, Math.round(width * 8 + 5));
}

function rowHeightPx(height: number | undefined): number {
    if (typeof height !== 'number' || height <= 0) {
        return DEFAULT_ROW_PX;
    }
    return Math.max(16, Math.round((height * 96) / 72));
}

function freezeOf(ws: ExcelJS.Worksheet): { rows: number; cols: number } {
    const views = ws.views ?? [];
    for (const view of views) {
        if (view.state === 'frozen') {
            const frozen = view as ExcelJS.WorksheetViewFrozen;
            return {
                rows: frozen.ySplit ?? 0,
                cols: frozen.xSplit ?? 0,
            };
        }
    }
    return { rows: 0, cols: 0 };
}

function a1ToRowCol(addr: string): { r: number; c: number } {
    const m = addr.match(/^([A-Z]+)(\d+)$/i);
    if (!m) {
        return { r: 1, c: 1 };
    }
    const letters = m[1].toUpperCase();
    let c = 0;
    for (let i = 0; i < letters.length; i += 1) {
        c = c * 26 + (letters.charCodeAt(i) - 64);
    }
    return { r: Number(m[2]), c };
}

function mergesOf(ws: ExcelJS.Worksheet): ExcelMergeModel[] {
    const raw = (ws.model as { merges?: string[] } | undefined)?.merges ?? [];
    const out: ExcelMergeModel[] = [];
    for (const range of raw) {
        const [a, b] = range.split(':');
        if (!a || !b) {
            continue;
        }
        const start = a1ToRowCol(a);
        const end = a1ToRowCol(b);
        out.push({
            r: start.r - 1,
            c: start.c - 1,
            rs: end.r - start.r + 1,
            cs: end.c - start.c + 1,
        });
    }
    return out;
}

function sheetToModel(ws: ExcelJS.Worksheet): ExcelSheetModel {
    const rowCount = Math.min(Math.max(ws.rowCount, 1), MAX_ROWS);
    const colCount = Math.min(Math.max(ws.columnCount, 1), MAX_COLS);
    const rows: ExcelCellModel[][] = [];
    const rowHeights: number[] = [];
    for (let r = 1; r <= rowCount; r += 1) {
        const excelRow = ws.getRow(r);
        const line: ExcelCellModel[] = [];
        for (let c = 1; c <= colCount; c += 1) {
            line.push(toCellModel(excelRow.getCell(c)));
        }
        rows.push(line);
        rowHeights.push(rowHeightPx(excelRow.height));
    }
    const colWidths: number[] = [];
    for (let c = 1; c <= colCount; c += 1) {
        colWidths.push(colWidthPx(ws.getColumn(c).width));
    }
    const freeze = freezeOf(ws);
    return {
        name: ws.name,
        rows,
        colWidths,
        rowHeights,
        freezeRows: freeze.rows,
        freezeCols: freeze.cols,
        merges: mergesOf(ws),
    };
}

export async function parseXlsxWithExcelJs(fileName: string, buffer: Buffer): Promise<ExcelWorkbookModel> {
    try {
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
        const sheets = wb.worksheets.map((ws) => sheetToModel(ws));
        if (sheets.length === 0) {
            throw new Error('Workbook contains no sheets.');
        }
        return { fileName, sheets };
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (/comments|Cannot read properties/i.test(message) || err instanceof TypeError) {
            return parseXlsWithSheetJs(fileName, buffer);
        }
        throw err instanceof Error ? err : new Error(message);
    }
}
