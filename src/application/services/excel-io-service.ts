// Phase 4.1 — one shared export mechanism (Facade pattern) instead of ad-hoc
// export buttons scattered per page. CSV rather than a binary .xlsx format:
// opens natively in Excel/Sheets, needs zero new dependencies, and every
// report this app has is tabular — there's nothing a real .xlsx would buy
// here that CSV doesn't already cover. Import is intentionally out of scope
// for this pass (see SHIELD_PRO_REFACTOR_MASTER_PLAN.md Phase 4.1 — parsing
// and validating externally-sourced data, e.g. supplier price lists or bank
// statements, is a materially bigger and riskier piece of work than export,
// and deserves its own reviewed slice rather than being rushed in here).
export class ExcelIOService {
  static exportToCsv(filename: string, rows: Record<string, unknown>[]): void {
    if (rows.length === 0) return;
    const headers = Object.keys(rows[0]);
    const escape = (val: unknown) => {
      const s = val === null || val === undefined ? '' : String(val);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [
      headers.join(','),
      ...rows.map((row) => headers.map((h) => escape(row[h])).join(','))
    ].join('\n');

    // BOM so Excel opens Arabic/UTF-8 content correctly instead of mangling it.
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
