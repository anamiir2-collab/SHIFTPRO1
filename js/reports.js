/* ShiftPro - Reports Module
   Renders report table, summary stats, donut + bar charts.
   Exports CSV, JSON, and Print/PDF.
   Exposes: window.SPReports
*/
(function (global) {
  'use strict';

  const { $, el, fmtDate, parseDate, addDays, fmtNum, fmtCurrency, fmtHours,
    monthNamesAr, weekdayShortAr, fmtTime12, toast, onClickOnce, downloadBlob } = SPUtils;
  const storage = SPStorage;

  let currentRange = 'cycle'; // daily | weekly | cycle | custom
  let customStart = null;
  let customEnd = null;

  function getReportRange() {
    const periodRef = SPCalendar.getPeriodRef();
    if (currentRange === 'cycle') {
      return SPCalendar.getPayPeriod(periodRef);
    }
    if (currentRange === 'daily') {
      const today = new Date();
      return { start: today, end: today };
    }
    if (currentRange === 'weekly') {
      const today = new Date();
      const start = addDays(today, -6);
      return { start, end: today };
    }
    if (currentRange === 'custom' && customStart && customEnd) {
      return { start: customStart, end: customEnd };
    }
    return SPCalendar.getPayPeriod(periodRef);
  }

  function render() {
    const { start, end } = getReportRange();
    $('#reportPeriodLabel').textContent =
      `${start.getDate()} ${monthNamesAr[start.getMonth()]} — ${end.getDate()} ${monthNamesAr[end.getMonth()]} ${end.getFullYear()}`;

    // Use salary computation for accurate numbers
    const result = SPSalary.computeSalary(start, end);

    // Summary cards
    $('#rWorkDays').textContent = result.counts.A + result.counts.X;
    $('#rPresent').textContent = result.counts.A;
    $('#rAbsent').textContent = result.counts.B;
    $('#rLeave').textContent = result.counts.L;
    $('#rDouble').textContent = result.counts.X;
    $('#rTotalHours').textContent = fmtNum(result.totalHours, 1);

    // Donut chart
    renderDonut(result.counts);

    // Bar chart — hours per day
    renderBarChart(result.dailyDetails);

    // Table
    renderTable(result.dailyDetails);

    // Print header
    $('#printPeriod').textContent =
      `الفترة: ${fmtDate(start)} إلى ${fmtDate(end)}`;
    $('#printWorker').textContent =
      `الموظف: ${storage.getSettings().name}`;

    // Interactive charts (Chart.js) — only refresh when its accordion is open
    if (window.SPCharts && document.querySelector('.report-disclosure.open[data-report-panel="months"], .report-disclosure.open[data-report-panel="overtime"]')) {
      try { renderInteractiveCharts(); } catch (e) { console.error('[Reports] charts error', e); }
    }
  }

  // رسم الـ charts التفاعلية
  async function renderInteractiveCharts() {
    const isAr = (window.SPi18n && SPi18n.getLocale() === 'ar');
    const monthly = SPCharts.getMonthlyData(6);
    if (monthly.length === 0) return;

    // بطاقات نسبة التغيّر (آخر شهر مقابل اللي قبله)
    const cardRow = $('#changeCardRow');
    if (cardRow) {
      cardRow.innerHTML = '';
      const last = monthly[monthly.length - 1];
      const prev = monthly[monthly.length - 2] || last;
      cardRow.appendChild(SPCharts.buildChangeCard(prev.hours, last.hours, isAr ? 'ساعات' : 'Hours'));
      cardRow.appendChild(SPCharts.buildChangeCard(prev.overtime, last.overtime, isAr ? 'إضافي' : 'Overtime'));
      cardRow.appendChild(SPCharts.buildChangeCard(prev.salary, last.salary, isAr ? 'الراتب' : 'Salary'));
    }

    // رسم مقارنة الأشهر
    await SPCharts.renderMonthComparison('monthComparisonChart', monthly);

    // رسم اتجاه الإضافي
    await SPCharts.renderOvertimeTrend(
      'overtimeTrendChart',
      monthly.map((m) => m.label),
      monthly.map((m) => m.overtime)
    );
  }

  function renderDonut(counts) {
    const segments = $('#donutSegments');
    segments.innerHTML = '';
    const total = counts.A + counts.X + counts.L + counts.B;
    $('#donutCenterVal').textContent = total;
    if (total === 0) {
      $('#donutLegend').innerHTML = '<div class="muted fs-sm">لا توجد بيانات في هذه الفترة</div>';
      return;
    }
    const items = [
      { label: 'حضور', value: counts.A, color: '#22c55e' },
      { label: 'مطبق', value: counts.X, color: '#a855f7' },
      { label: 'إجازة', value: counts.L, color: '#f59e0b' },
      { label: 'غياب', value: counts.B, color: '#ef4444' }
    ];
    const r = 48, cx = 60, cy = 60;
    const circumference = 2 * Math.PI * r;
    let offset = 0;
    items.forEach((it) => {
      if (it.value === 0) return;
      const len = (it.value / total) * circumference;
      const circle = el('circle', {
        cx, cy, r,
        fill: 'none',
        stroke: it.color,
        'stroke-width': 14,
        'stroke-dasharray': `${len} ${circumference - len}`,
        'stroke-dashoffset': -offset,
        transform: `rotate(-90 ${cx} ${cy})`
      });
      segments.appendChild(circle);
      offset += len;
    });
    // Legend
    const legend = $('#donutLegend');
    legend.innerHTML = '';
    items.forEach((it) => {
      const row = el('div', { class: 'item' });
      row.appendChild(el('span', { class: 'dot', style: `background:${it.color}` }));
      row.appendChild(el('span', {}, [it.label]));
      row.appendChild(el('span', { class: 'v' }, [String(it.value)]));
      legend.appendChild(row);
    });
  }

  function renderBarChart(dailyDetails) {
    const chart = $('#hoursBarChart');
    chart.innerHTML = '';
    if (!dailyDetails || dailyDetails.length === 0) {
      chart.appendChild(el('div', { class: 'muted fs-sm', style: 'margin:auto;text-align:center;' }, ['لا توجد بيانات في هذه الفترة']));
      return;
    }
    // Limit to last 14 days for readability
    const items = dailyDetails.slice(-14);
    const maxHours = Math.max(1, ...items.map((d) => d.actual));
    // If all zeros, show empty state
    const totalActual = items.reduce((s, d) => s + d.actual, 0);
    if (totalActual === 0) {
      chart.appendChild(el('div', { class: 'muted fs-sm', style: 'margin:auto;text-align:center;' }, ['لا توجد ساعات مسجلة بعد']));
      return;
    }
    items.forEach((d) => {
      const pct = (d.actual / maxHours) * 100;
      let cls = '';
      if (d.actual === 0 && d.entry && d.entry.status === 'B') cls = 'danger';
      else if (d.actual > (Number(storage.getSettings().shiftHours) || 12)) cls = 'success';
      const col = el('div', { class: 'bar-col' });
      col.appendChild(el('div', { class: 'bar-value' }, [d.actual > 0 ? fmtNum(d.actual, 1) : '']));
      col.appendChild(el('div', { class: 'bar ' + cls, style: `height:${Math.max(2, pct)}%` }));
      col.appendChild(el('div', { class: 'bar-label' }, [weekdayShortAr[d.date.getDay()]]));
      chart.appendChild(col);
    });
  }

  function renderTable(dailyDetails) {
    const tbody = $('#reportTableBody');
    tbody.innerHTML = '';
    let totalHours = 0, totalValue = 0;
    dailyDetails.forEach((d) => {
      const tr = el('tr');
      const dayName = weekdayShortAr[d.date.getDay()];
      const dateDisplay = `${String(d.date.getDate()).padStart(2, '0')}/${String(d.date.getMonth() + 1).padStart(2, '0')}/${d.date.getFullYear()}`;
      const scheduledCode = storage.getScheduledCode(fmtDate(d.date));
      const shift = scheduledCode ? storage.getShiftByCode(scheduledCode) : null;
      const scheduledLabel = shift ? shift.name : 'غير محدد';
      const statusLabel = d.entry ? SPAttendance.statusLabels[d.entry.status] || 'غير مسجل' : 'غير مسجل';
      const timeRange = (d.entry && d.entry.from && d.entry.to)
        ? `${fmtTime12(d.entry.from)} — ${fmtTime12(d.entry.to)}`
        : '-';
      tr.innerHTML = `<td>${dayName}</td><td>${dateDisplay}</td><td>${scheduledLabel}</td><td>${statusLabel}</td><td>${timeRange}</td><td>${fmtNum(d.actual, 1)}</td><td>${fmtCurrency(d.value)}</td>`;
      tbody.appendChild(tr);
      totalHours += d.actual;
      totalValue += d.value;
    });
    $('#reportTotalHours').textContent = fmtNum(totalHours, 1);
    $('#reportTotalValue').textContent = fmtCurrency(totalValue);
  }

  function getReportRows(result) {
    return (result.dailyDetails || []).map((d) => {
      const dayName = weekdayShortAr[d.date.getDay()];
      const dateDisplay = `${String(d.date.getDate()).padStart(2, '0')}/${String(d.date.getMonth() + 1).padStart(2, '0')}/${d.date.getFullYear()}`;
      const scheduledCode = storage.getScheduledCode(fmtDate(d.date));
      const shift = scheduledCode ? storage.getShiftByCode(scheduledCode) : null;
      const scheduledLabel = shift ? shift.name : 'غير محدد';
      const statusLabel = d.entry ? SPAttendance.statusLabels[d.entry.status] || 'غير مسجل' : 'غير مسجل';
      return {
        day: dayName,
        date: dateDisplay,
        scheduled: scheduledLabel,
        status: statusLabel,
        from: d.entry && d.entry.from ? d.entry.from : '',
        to: d.entry && d.entry.to ? d.entry.to : '',
        hours: Number(d.actual || 0),
        overtime: Number(d.ot || 0),
        late: Number(d.late || 0),
        early: Number(d.early || 0),
        value: Number(d.value || 0),
        note: d.entry && d.entry.note ? d.entry.note : ''
      };
    });
  }

  function reportSummary(result, start, end) {
    return {
      employee: (storage.getSettings() || {}).name || 'موظف',
      from: fmtDate(start),
      to: fmtDate(end),
      workDays: (result.counts.A || 0) + (result.counts.X || 0),
      present: result.counts.A || 0,
      double: result.counts.X || 0,
      leave: result.counts.L || 0,
      absent: result.counts.B || 0,
      baseHours: Number(result.baseHours || 0),
      overtimeHours: Number(result.overtimeHours || 0),
      totalHours: Number(result.totalHours || 0),
      baseSalary: Number(result.baseSalary || 0),
      overtimeValue: Number(result.overtimeValue || 0),
      bonus: Number(result.bonus || 0),
      allowance: Number(result.allowance || 0),
      deduction: Number(result.deduction || 0),
      advance: Number(result.advance || 0),
      netSalary: Number(result.netSalary || 0)
    };
  }

  function exportReportJSON() {
    const { start, end } = getReportRange();
    const result = SPSalary.computeSalary(start, end);
    const data = { app: 'ShiftPro', type: 'report', summary: reportSummary(result, start, end), table: getReportRows(result) };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
    downloadBlob(`ShiftPro-Report-${fmtDate(start)}-to-${fmtDate(end)}.json`, blob);
    toast('تم تحميل التقرير بصيغة JSON', 'success');
  }

  async function exportReportXLSX() {
    const { start, end } = getReportRange();
    const result = SPSalary.computeSalary(start, end);
    let XLSX = global.XLSX;
    if (!XLSX) {
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = './vendor/xlsx.full.min.js';
        s.onload = () => global.XLSX ? resolve() : reject(new Error('XLSX not loaded'));
        s.onerror = () => {
          const s2 = document.createElement('script');
          s2.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
          s2.onload = () => global.XLSX ? resolve() : reject(new Error('XLSX not loaded'));
          s2.onerror = () => reject(new Error('Failed to load XLSX'));
          document.head.appendChild(s2);
        };
        document.head.appendChild(s);
      });
      XLSX = global.XLSX;
    }
    const rows = getReportRows(result);
    const summary = reportSummary(result, start, end);
    const table = [['اليوم','التاريخ','المجدول','الحالة','الحضور','الانصراف','الساعات','الإضافي','التأخير','الانصراف المبكر','قيمة اليوم','ملاحظة']];
    rows.forEach(r => table.push([r.day,r.date,r.scheduled,r.status,r.from,r.to,r.hours,r.overtime,r.late,r.early,r.value,r.note]));
    const summaryRows = [
      ['ملخص التقرير'],['الموظف',summary.employee],['من',summary.from],['إلى',summary.to],
      ['أيام العمل',summary.workDays],['حضور',summary.present],['مطبق',summary.double],['إجازة',summary.leave],['غياب',summary.absent],
      ['الساعات الأساسية',summary.baseHours],['الساعات الإضافية',summary.overtimeHours],['إجمالي الساعات',summary.totalHours],
      ['الراتب الأساسي',summary.baseSalary],['قيمة الإضافي',summary.overtimeValue],['المكافآت',summary.bonus],['البدلات',summary.allowance],
      ['الخصومات',summary.deduction],['السلف',summary.advance],['صافي المستحق',summary.netSalary]
    ];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(table);
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
    ws['!cols'] = [{wch:12},{wch:14},{wch:22},{wch:14},{wch:12},{wch:12},{wch:10},{wch:10},{wch:10},{wch:16},{wch:14},{wch:28}];
    wsSummary['!cols'] = [{wch:24},{wch:24}];
    XLSX.utils.book_append_sheet(wb, ws, 'الجدول');
    XLSX.utils.book_append_sheet(wb, wsSummary, 'الملخص');
    const filename = `ShiftPro-Report-${fmtDate(start)}-to-${fmtDate(end)}.xlsx`;
    XLSX.writeFile(wb, filename);
    toast('تم تحميل Excel بالجدول والملخص', 'success');
  }

  async function exportSelectedReport() {
    const format = $('#reportExportFormat') ? $('#reportExportFormat').value : 'xlsx';
    const { start, end } = getReportRange();
    try {
      if (format === 'xlsx') return await exportReportXLSX();
      if (format === 'csv') return exportCSV();
      if (format === 'json') return exportReportJSON();
      if (format === 'pdf') {
        if (!global.SPPDF || !SPPDF.exportReportRange) throw new Error('موديول PDF غير متاح');
        toast('جاري تجهيز PDF...', 'info');
        const r = await SPPDF.exportReportRange(start, end);
        if (r && r.ok) toast('تم تحميل PDF بالجدول والملخص', 'success');
        return r;
      }
      if (format === 'ics') {
        if (!global.SPiCal) throw new Error('موديول iCal غير متاح');
        return SPiCal.exportICS();
      }
      if (format === 'print') return printReport();
    } catch (e) {
      console.error('[Reports] export error', e);
      toast('تعذر تحميل التقرير: ' + e.message, 'error');
    }
  }

  // ---------- Export functions ----------
  function exportCSV() {
    const { start, end } = getReportRange();
    const result = SPSalary.computeSalary(start, end);
    const headers = ['اليوم', 'التاريخ', 'الوردية المجدولة', 'الحالة', 'من الساعة', 'إلى الساعة', 'الساعات', 'الإضافي', 'التأخير (د)', 'الانصراف المبكر (د)', 'قيمة اليوم', 'ملاحظة'];
    let csv = '\uFEFF' + headers.join(',') + '\n';
    result.dailyDetails.forEach((d) => {
      const dayName = weekdayShortAr[d.date.getDay()];
      const dateDisplay = `${String(d.date.getDate()).padStart(2, '0')}/${String(d.date.getMonth() + 1).padStart(2, '0')}/${d.date.getFullYear()}`;
      const scheduledCode = storage.getScheduledCode(fmtDate(d.date));
      const shift = scheduledCode ? storage.getShiftByCode(scheduledCode) : null;
      const scheduledLabel = shift ? shift.name : 'غير محدد';
      const statusLabel = d.entry ? SPAttendance.statusLabels[d.entry.status] || 'غير مسجل' : 'غير مسجل';
      const from = (d.entry && d.entry.from) ? d.entry.from : '';
      const to = (d.entry && d.entry.to) ? d.entry.to : '';
      const note = (d.entry && d.entry.note) ? d.entry.note : '';
      const row = [dayName, dateDisplay, scheduledLabel, statusLabel, from, to, fmtNum(d.actual, 2), fmtNum(d.ot, 2), d.late, d.early, Math.round(d.value), note];
      csv += row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',') + '\n';
    });
    // Summary footer
    csv += '\n\nالملخص,,,\n';
    csv += `"إجمالي الساعات الأساسية","","","","","","${fmtNum(result.baseHours, 2)}"\n`;
    csv += `"إجمالي الساعات الإضافية","","","","","","${fmtNum(result.overtimeHours, 2)}"\n`;
    csv += `"إجمالي الساعات","","","","","","${fmtNum(result.totalHours, 2)}"\n`;
    csv += `"الراتب الأساسي","","","","","","${result.baseSalary}"\n`;
    csv += `"+ الإضافي","","","","","","${result.overtimeValue}"\n`;
    csv += `"+ المكافآت","","","","","","${result.bonus}"\n`;
    csv += `"+ البدلات","","","","","","${result.allowance}"\n`;
    csv += `"− الخصومات","","","","","","${result.deduction + result.absenceDeduction + result.lateDeduction}"\n`;
    csv += `"− السلف","","","","","","${result.advance}"\n`;
    csv += `"صافي المستحق","","","","","","${result.netSalary}"\n`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(`ShiftPro-${fmtDate(start)}-to-${fmtDate(end)}.csv`, blob);
    toast('تم تصدير CSV بنجاح', 'success');
  }

  function exportJSON() {
    const data = storage.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    downloadBlob(`ShiftPro-Backup-${SPUtils.todayStr()}.json`, blob);
    toast('تم تصدير نسخة احتياطية', 'success');
  }

  function printReport() {
    // Make sure the report page is visible before printing
    const wasActive = $('#page-reports').classList.contains('active');
    if (!wasActive) {
      // temporarily show reports page for printing
      document.querySelectorAll('.page').forEach((p) => p.style.display = 'none');
      $('#page-reports').style.display = 'block';
    }
    setTimeout(() => {
      window.print();
      if (!wasActive) {
        document.querySelectorAll('.page').forEach((p) => p.style.removeProperty('display'));
      }
    }, 100);
  }

  // ---------- Init ----------
  function init() {
    $('#prevReportBtn').addEventListener('click', onClickOnce(() => SPCalendar.shiftPeriod(-1)));
    $('#nextReportBtn').addEventListener('click', onClickOnce(() => SPCalendar.shiftPeriod(1)));
    // Legacy export buttons are optional after the new unified export menu.
    const legacyCsvBtn = $('#exportCsvBtn');
    if (legacyCsvBtn) legacyCsvBtn.addEventListener('click', onClickOnce(exportCSV));
    const legacyJsonBtn = $('#exportJsonBtn');
    if (legacyJsonBtn) legacyJsonBtn.addEventListener('click', onClickOnce(exportJSON));
    const legacyPrintBtn = $('#printBtn');
    if (legacyPrintBtn) legacyPrintBtn.addEventListener('click', onClickOnce(printReport));
    // XLSX عبر SheetJS
    const exportXlsxBtn = $('#exportXlsxBtn');
    if (exportXlsxBtn) {
      exportXlsxBtn.addEventListener('click', onClickOnce(async () => {
        if (!window.SPBackup) { toast('موديول النسخ غير متاح', 'error'); return; }
        toast('جاري توليد XLSX...', 'info');
        try {
          const r = await SPBackup.exportXLSX();
          if (r) toast('تم تصدير ' + r.filename, 'success');
        } catch (e) {
          toast('خطأ XLSX: ' + e.message, 'error');
        }
      }));
    }
    // iCal (.ics) - يفتح في Google/Apple Calendar
    const exportIcsBtn = $('#exportIcsBtn');
    if (exportIcsBtn) {
      exportIcsBtn.addEventListener('click', onClickOnce(() => {
        if (!window.SPiCal) { toast('موديول iCal غير متاح', 'error'); return; }
        try {
          const r = SPiCal.exportICS();
          // toast بيحصل جوّه
        } catch (e) {
          toast('خطأ iCal: ' + e.message, 'error');
        }
      }));
    }
    // تصدير PDF احترافي
    const exportPdfBtn = $('#exportPdfBtn');
    if (exportPdfBtn) {
      exportPdfBtn.addEventListener('click', onClickOnce(async () => {
        if (!window.SPPDF) { toast('موديول PDF غير متاح', 'error'); return; }
        const today = new Date();
        toast('جاري توليد PDF...', 'info');
        try {
          const result = await SPPDF.exportMonthlyReport(today.getFullYear(), today.getMonth());
          if (result.ok) toast('تم تصدير ' + result.filename, 'success');
          else toast('فشل التصدير', 'error');
        } catch (e) {
          toast('خطأ: ' + e.message, 'error');
        }
      }));
    }

    // Report accordions
    document.querySelectorAll('[data-report-panel]').forEach((trigger) => {
      trigger.addEventListener('click', () => {
        const panel = trigger.dataset.reportPanel;
        const section = trigger.closest('.report-disclosure');
        const content = $('#reportPanel-' + panel);
        const willOpen = !!content && content.hidden;
        document.querySelectorAll('.report-disclosure').forEach((s) => s.classList.remove('open'));
        document.querySelectorAll('.report-disclosure-content').forEach((el) => { el.hidden = true; });
        document.querySelectorAll('[data-report-panel]').forEach((t) => t.setAttribute('aria-expanded', 'false'));
        if (willOpen && content) {
          content.hidden = false;
          section.classList.add('open');
          trigger.setAttribute('aria-expanded', 'true');
          if (panel === 'months' || panel === 'overtime') {
            setTimeout(() => { renderInteractiveCharts().catch(() => {}); }, 40);
          }
        }
      });
    });

    const reportExportBtn = $('#reportExportBtn');
    if (reportExportBtn) reportExportBtn.addEventListener('click', onClickOnce(exportSelectedReport));

    // Range tabs
    document.querySelectorAll('[data-report-range]').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-report-range]').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        currentRange = btn.dataset.reportRange;
        $('#customRangeCard').hidden = currentRange !== 'custom';
        render();
      });
    });

    $('#applyCustomRange').addEventListener('click', () => {
      const from = $('#customFrom').value;
      const to = $('#customTo').value;
      if (!from || !to) { toast('حدد التاريخ من وإلى', 'warning'); return; }
      customStart = parseDate(from);
      customEnd = parseDate(to);
      if (customStart > customEnd) {
        toast('تاريخ البداية يجب أن يكون قبل النهاية', 'warning');
        return;
      }
      render();
      toast('تم تطبيق الفترة المخصصة', 'success');
    });
  }

  global.SPReports = {
    init, render, exportCSV, exportJSON, exportReportXLSX, exportReportJSON, exportSelectedReport
  };
})(window);
