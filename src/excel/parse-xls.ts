/**
 * .xls (BIFF) via SheetJS Community Edition 0.18.5 (Apache-2.0).
 * Styles are limited; display text + freeze-first-row for a spreadsheet look.
 */

import * as XLSX from 'xlsx';

import type { ExcelCellModel, ExcelSheetModel, ExcelWorkbookModel } from './protocol';

const DEFAULT_COL_PX = 110;
const DEFAULT_ROW_PX = 22;
const HEADER_ROW_PX = 28;
const MAX_ROWS = 8000;
const MAX_COLS = 256;

function cellText(sheet: XLSX.WorkSheet, addr: string): { t: string; f?: string } {
    const cell = sheet[addr] as XLSX.CellObject | undefined;
    if (!cell) {
        return { t: '' };
    }
    const formula = typeof cell.f === 'string' && cell.f ? `=${cell.f}` : undefined;
    if (cell.w != null && String(cell.w).length > 0) {
        return { t: String(cell.w), f: formula };
    }
    if (cell.v == null) {
        return { t: formula ?? '', f: formula };
    }
    if (cell.v instanceof Date) {
        return { t: cell.v.toISOString(), f: formula };
    }
    return { t: String(cell.v), f: formula };
}

export function parseXlsWithSheetJs(fileName: string, buffer: Buffer): ExcelWorkbookModel {
    const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true, raw: false });
    const sheets: ExcelSheetModel[] = [];
    for (const name of wb.SheetNames) {
        const ws = wb.Sheets[name];
        if (!ws) {
            continue;
        }
        const ref = ws['!ref'] ? XLSX.utils.decode_range(ws['!ref']) : undefined;
        const rowCount = ref ? Math.min(ref.e.r - ref.s.r + 1, MAX_ROWS) : 0;
        const colCount = ref ? Math.min(ref.e.c - ref.s.c + 1, MAX_COLS) : 0;
        const startR = ref?.s.r ?? 0;
        const startC = ref?.s.c ?? 0;
        const rows: ExcelCellModel[][] = [];
        for (let r = 0; r < rowCount; r += 1) {
            const line: ExcelCellModel[] = [];
            for (let c = 0; c < colCount; c += 1) {
                const addr = XLSX.utils.encode_cell({ r: startR + r, c: startC + c });
                const parsed = cellText(ws, addr);
                line.push({
                    t: parsed.t,
                    f: parsed.f,
                    b: r === 0,
                    w: true,
                });
            }
            rows.push(line);
        }
        const cols = ws['!cols'] ?? [];
        const colWidths = Array.from({ length: colCount }, (_, i) => {
            const wch = cols[startC + i]?.wch;
            if (typeof wch === 'number' && wch > 0) {
                return Math.round(wch * 8 + 5);
            }
            return DEFAULT_COL_PX;
        });
        sheets.push({
            name,
            rows,
            colWidths,
            rowHeights: rows.map((_, i) => (i === 0 ? HEADER_ROW_PX : DEFAULT_ROW_PX)),
            freezeRows: rows.length > 0 ? 1 : 0,
            freezeCols: 0,
            merges: [],
        });
    }
    if (sheets.length === 0) {
        throw new Error('Workbook contains no sheets.');
    }
    return { fileName, sheets };
}
