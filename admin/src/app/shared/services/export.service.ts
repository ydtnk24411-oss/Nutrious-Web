import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';

@Injectable({ providedIn: 'root' })
export class ExportService {
  /**
   * Xuất danh sách dữ liệu ra file Excel (.xlsx) hoặc CSV (.csv)
   * @param headers Danh sách tiêu đề cột
   * @param rows Dữ liệu từng dòng
   * @param baseFileName Tên tệp (không kèm đuôi mở rộng)
   * @param format 'xlsx' | 'csv'
   */
  exportTable(
    headers: string[],
    rows: (string | number)[][],
    baseFileName: string,
    format: 'xlsx' | 'csv' = 'xlsx'
  ): void {
    const data = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(data);

    // Tự động căn chỉnh độ rộng cột
    const colWidths = headers.map((h, i) => {
      let maxLen = h.length;
      rows.forEach((r) => {
        const val = String(r[i] ?? '');
        if (val.length > maxLen) maxLen = Math.min(val.length, 50);
      });
      return { wch: Math.max(maxLen + 3, 12) };
    });
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Báo cáo');

    const dateStr = new Date().toISOString().slice(0, 10);
    const fileName = `${baseFileName}-${dateStr}.${format}`;

    if (format === 'xlsx') {
      XLSX.writeFile(wb, fileName, { bookType: 'xlsx' });
    } else {
      const csvContent = '\uFEFF' + XLSX.utils.sheet_to_csv(ws);
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    }
  }
}
