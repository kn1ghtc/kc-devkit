/**
 * Spreadsheet grid renderer (Excel-like freeze panes, wrap, column letters).
 */

import type { ExcelCellModel, ExcelMergeModel, ExcelSheetModel } from '../protocol';

function colLetter(index: number): string {
    let n = index + 1;
    let s = '';
    while (n > 0) {
        const rem = (n - 1) % 26;
        s = String.fromCharCode(65 + rem) + s;
        n = Math.floor((n - 1) / 26);
    }
    return s;
}

function mergeKey(r: number, c: number): string {
    return `${r}:${c}`;
}

function mergeMap(merges: ExcelMergeModel[]): Map<string, ExcelMergeModel> {
    const map = new Map<string, ExcelMergeModel>();
    for (const m of merges) {
        for (let r = m.r; r < m.r + m.rs; r += 1) {
            for (let c = m.c; c < m.c + m.cs; c += 1) {
                map.set(mergeKey(r, c), m);
            }
        }
    }
    return map;
}

function cssColor(value: string | undefined): string | undefined {
    if (!value) {
        return undefined;
    }
    return /^#[0-9A-Fa-f]{6}$/.test(value) ? value : undefined;
}

function cellStyle(cell: ExcelCellModel, width: number, height: number): string {
    const parts = [`width:${width}px`, `min-width:${width}px`, `height:${height}px`];
    const bg = cssColor(cell.bg);
    if (bg) {
        parts.push(`background:${bg}`);
    }
    const fg = cssColor(cell.fg);
    if (fg) {
        parts.push(`color:${fg}`);
    }
    if (cell.b) {
        parts.push('font-weight:700');
    }
    if (cell.w) {
        parts.push('white-space:pre-wrap');
        parts.push('overflow-wrap:anywhere');
    }
    if (cell.ah) {
        parts.push(`text-align:${cell.ah}`);
    }
    if (cell.av === 'top') {
        parts.push('vertical-align:top');
    } else if (cell.av === 'bottom') {
        parts.push('vertical-align:bottom');
    } else {
        parts.push('vertical-align:middle');
    }
    return parts.join(';');
}

function escapeText(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

const LETTER_ROW_PX = 24;
const ROWHEAD_PX = 48;

function prefixSum(values: number[], fallback: number): number[] {
    const out: number[] = [];
    let acc = 0;
    for (let i = 0; i < values.length; i += 1) {
        out.push(acc);
        acc += values[i] ?? fallback;
    }
    return out;
}

export function renderSheetTable(sheet: ExcelSheetModel): HTMLTableElement {
    const table = document.createElement('table');
    table.className = 'kc-excel-table';
    table.setAttribute('data-sheet', sheet.name);

    const colCount = Math.max(
        sheet.colWidths.length,
        ...sheet.rows.map((row) => row.length),
        1,
    );
    const merges = mergeMap(sheet.merges);
    const skip = new Set<string>();
    const leftOf = prefixSum(sheet.colWidths, 100);
    const topOf = prefixSum(sheet.rowHeights, 22);

    const colgroup = document.createElement('colgroup');
    const cornerCol = document.createElement('col');
    cornerCol.style.width = `${ROWHEAD_PX}px`;
    colgroup.appendChild(cornerCol);
    for (let c = 0; c < colCount; c += 1) {
        const col = document.createElement('col');
        col.style.width = `${sheet.colWidths[c] ?? 100}px`;
        colgroup.appendChild(col);
    }
    table.appendChild(colgroup);

    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    const corner = document.createElement('th');
    corner.className = 'kc-excel-corner kc-excel-sticky-row kc-excel-sticky-col';
    corner.style.top = '0';
    corner.style.left = '0';
    headRow.appendChild(corner);
    for (let c = 0; c < colCount; c += 1) {
        const th = document.createElement('th');
        th.className = 'kc-excel-colhead kc-excel-sticky-row';
        th.style.top = '0';
        if (c < sheet.freezeCols) {
            th.classList.add('kc-excel-sticky-col');
            th.style.left = `${ROWHEAD_PX + (leftOf[c] ?? 0)}px`;
        }
        th.textContent = colLetter(c);
        th.style.minWidth = `${sheet.colWidths[c] ?? 100}px`;
        headRow.appendChild(th);
    }
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    for (let r = 0; r < sheet.rows.length; r += 1) {
        const tr = document.createElement('tr');
        const height = sheet.rowHeights[r] ?? 22;
        tr.style.height = `${height}px`;
        const rh = document.createElement('th');
        rh.className = 'kc-excel-rowhead kc-excel-sticky-col';
        rh.style.left = '0';
        if (r < sheet.freezeRows) {
            rh.classList.add('kc-excel-sticky-row');
            rh.style.top = `${LETTER_ROW_PX + (topOf[r] ?? 0)}px`;
        }
        rh.textContent = String(r + 1);
        tr.appendChild(rh);

        const line = sheet.rows[r] ?? [];
        for (let c = 0; c < colCount; c += 1) {
            const key = mergeKey(r, c);
            if (skip.has(key)) {
                continue;
            }
            const td = document.createElement('td');
            const cell: ExcelCellModel = line[c] ?? { t: '' };
            const width = sheet.colWidths[c] ?? 100;
            td.className = 'kc-excel-cell';
            if (r < sheet.freezeRows) {
                td.classList.add('kc-excel-sticky-row');
                td.style.top = `${LETTER_ROW_PX + (topOf[r] ?? 0)}px`;
            }
            if (c < sheet.freezeCols) {
                td.classList.add('kc-excel-sticky-col');
                td.style.left = `${ROWHEAD_PX + (leftOf[c] ?? 0)}px`;
            }
            const merge = merges.get(key);
            if (merge && merge.r === r && merge.c === c) {
                if (merge.rs > 1) {
                    td.rowSpan = merge.rs;
                }
                if (merge.cs > 1) {
                    td.colSpan = merge.cs;
                }
                for (let mr = merge.r; mr < merge.r + merge.rs; mr += 1) {
                    for (let mc = merge.c; mc < merge.c + merge.cs; mc += 1) {
                        if (mr === r && mc === c) {
                            continue;
                        }
                        skip.add(mergeKey(mr, mc));
                    }
                }
            }
            td.setAttribute('style', cellStyle(cell, width, height));
            td.innerHTML = escapeText(cell.t).replace(/\n/g, '<br />');
            if (cell.f) {
                td.title = cell.f;
                td.classList.add('kc-excel-formula');
            }
            tr.appendChild(td);
        }
        tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    return table;
}

export function applyRowFilter(table: HTMLTableElement, query: string): number {
    const q = query.trim().toLowerCase();
    let visible = 0;
    const rows = table.tBodies[0]?.rows ?? [];
    for (let i = 0; i < rows.length; i += 1) {
        const tr = rows[i];
        const show = q.length === 0 || (tr.textContent ?? '').toLowerCase().includes(q);
        tr.hidden = !show;
        if (show) {
            visible += 1;
        }
    }
    return visible;
}
