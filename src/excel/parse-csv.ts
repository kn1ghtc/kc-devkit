/**
 * UTF-8 / UTF-16LE CSV parser (RFC 4180-ish). MIT-style original for kc-devkit.
 */

import type { ExcelCellModel, ExcelSheetModel, ExcelWorkbookModel } from './protocol';

const DEFAULT_COL_PX = 120;
const DEFAULT_ROW_PX = 24;
const HEADER_ROW_PX = 28;

function decodeCsv(buffer: Buffer): string {
    if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
        return buffer.subarray(2).toString('utf16le');
    }
    if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
        return buffer.subarray(3).toString('utf8');
    }
    return buffer.toString('utf8');
}

export function parseCsvText(text: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let field = '';
    let i = 0;
    let inQuotes = false;
    const src = text.replace(/^\uFEFF/, '');
    while (i < src.length) {
        const ch = src[i];
        if (inQuotes) {
            if (ch === '"') {
                if (src[i + 1] === '"') {
                    field += '"';
                    i += 2;
                    continue;
                }
                inQuotes = false;
                i += 1;
                continue;
            }
            field += ch;
            i += 1;
            continue;
        }
        if (ch === '"') {
            inQuotes = true;
            i += 1;
            continue;
        }
        if (ch === ',') {
            row.push(field);
            field = '';
            i += 1;
            continue;
        }
        if (ch === '\n' || ch === '\r') {
            if (ch === '\r' && src[i + 1] === '\n') {
                i += 1;
            }
            row.push(field);
            field = '';
            rows.push(row);
            row = [];
            i += 1;
            continue;
        }
        field += ch;
        i += 1;
    }
    if (field.length > 0 || row.length > 0) {
        row.push(field);
        rows.push(row);
    }
    return rows.filter((r) => r.some((c) => c.length > 0));
}

export function parseCsvBuffer(fileName: string, buffer: Buffer): ExcelWorkbookModel {
    const table = parseCsvText(decodeCsv(buffer));
    const colCount = table.reduce((max, r) => Math.max(max, r.length), 0);
    const rows: ExcelCellModel[][] = table.map((line, idx) => {
        const cells: ExcelCellModel[] = [];
        for (let c = 0; c < colCount; c += 1) {
            const t = line[c] ?? '';
            cells.push(idx === 0 ? { t, b: true, w: true } : { t, w: true });
        }
        return cells;
    });
    const sheet: ExcelSheetModel = {
        name: 'Sheet1',
        rows,
        colWidths: Array.from({ length: colCount }, () => DEFAULT_COL_PX),
        rowHeights: rows.map((_, i) => (i === 0 ? HEADER_ROW_PX : DEFAULT_ROW_PX)),
        freezeRows: rows.length > 0 ? 1 : 0,
        freezeCols: 0,
        merges: [],
    };
    return { fileName, sheets: [sheet] };
}
