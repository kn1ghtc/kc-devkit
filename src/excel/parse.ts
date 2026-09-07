/**
 * Excel / CSV parse dispatcher.
 *
 * xlsx/xlsm: ExcelJS (MIT) for fills, wrap, freeze, column widths, cached formulas.
 * xls: SheetJS Community 0.18.5 (Apache-2.0) for BIFF.
 * csv: RFC4180-ish UTF-8/UTF-16LE parser (no extra deps).
 */

import type { ExcelWorkbookModel } from './protocol';
import { parseCsvBuffer } from './parse-csv';
import { parseXlsWithSheetJs } from './parse-xls';
import { parseXlsxWithExcelJs } from './parse-xlsx';

const MAX_BYTES = 40 * 1024 * 1024;

export function extensionOf(fileName: string): string {
    const base = fileName.includes('/') ? fileName.slice(fileName.lastIndexOf('/') + 1) : fileName;
    const cut = base.includes('\\') ? base.slice(base.lastIndexOf('\\') + 1) : base;
    const dot = cut.lastIndexOf('.');
    return dot >= 0 ? cut.slice(dot).toLowerCase() : '';
}

export async function parseSpreadsheet(fileName: string, buffer: Buffer): Promise<ExcelWorkbookModel> {
    if (buffer.length > MAX_BYTES) {
        throw new Error(`Spreadsheet is larger than ${MAX_BYTES / (1024 * 1024)} MB.`);
    }
    const ext = extensionOf(fileName);
    if (ext === '.csv') {
        return parseCsvBuffer(fileName, buffer);
    }
    if (ext === '.xls') {
        return parseXlsWithSheetJs(fileName, buffer);
    }
    if (ext === '.xlsx' || ext === '.xlsm') {
        return parseXlsxWithExcelJs(fileName, buffer);
    }
    throw new Error(`Unsupported spreadsheet type: ${ext || '(none)'}`);
}
