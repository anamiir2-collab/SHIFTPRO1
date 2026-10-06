/* ShiftPro - Settings Module
   Handles: general settings sheet, shift manager, leave balance,
   stats, backup/restore, about, theme switching, font size.
   Exposes: window.SPSettings
*/
(function (global) {
  'use strict';

  const {
    $, el, fmtDate, parseDate, fmtNum, fmtCurrency, toast,
    confirmDialog, onClickOnce, haptic
  } = SPUtils;

  const storage = SPStorage;

  // =========================================================
  // Theme & font size
  // =========================================================

  function applyTheme() {
    const s = storage.getSettings();

    document.documentElement.dataset.theme = s.theme || 'auto';
    document.documentElement.dataset.fontsize = s.fontSize || 'medium';

    const meta = $('#metaTheme');

    if (meta) {
      const isDark =
        s.theme === 'dark' ||
        (
          s.theme === 'auto' &&
          window.matchMedia &&
          window.matchMedia('(prefers-color-scheme: dark)').matches
        );

      meta.content = isDark ? '#071426' : '#2563eb';
    }

    const icon = $('#themeIcon');

    if (icon) {
      if (s.theme === 'light') {
        icon.innerHTML =
          '<circle cx="12" cy="12" r="4"></circle>' +
          '<path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4' +
          'M17.7 17.7l1.4 1.4M2 12h2M20 12h2' +
          'M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"></path>';
      } else {
        icon.innerHTML =
          '<path d="M21 12.8A9 9 0 1 1 11.2 3' +
          ' 7 7 0 0 0 21 12.8z"></path>';
      }
    }
  }

  function cycleTheme() {
    const s = storage.getSettings();

    const order = ['auto', 'dark', 'light'];
    const i = order.indexOf(s.theme || 'auto');
    const next = order[(i + 1) % order.length];

    if (window.SPUndoRedo) SPUndoRedo.pushUndo("save settings");


    storage.saveSettings({
      theme: next
    });

    applyTheme();
    haptic(10);

    toast(
      'الوضع: ' +
      (
        next === 'auto'
          ? 'تلقائي'
          : next === 'dark'
            ? 'داكن'
            : 'نهاري'
      ),
      'info'
    );
  }

  // =========================================================
  // General settings sheet
  // =========================================================

  function openSettingsSheet() {
    const s = storage.getSettings();

    $('#inpName').value = s.name || '';
    $('#inpJob').value = s.job || '';
    $('#inpEmployeeId').value = s.employeeId || '';
    $('#inpCompany').value = s.company || '';

    $('#inpSalaryMethod').value =
      s.salaryMethod || 'monthly';

    $('#inpSalary').value =
      s.salary || '';

    $('#inpMonthlyHours').value =
      s.monthlyHours || '';

    $('#inpShiftHours').value =
      s.shiftHours || '';

    $('#inpHourlyRate').value =
      s.hourlyRate || '';

    $('#inpOvertimeEnabled').checked =
      !!s.overtimeEnabled;

    $('#inpOvertimeRate').value =
      s.overtimeRate || 1.5;

    $('#inpOvertimeAfterHours').value =
      s.overtimeAfterHours || '';

    $('#inpDeductAbsence').checked =
      !!s.deductAbsence;

    $('#inpDeductLate').checked =
      !!s.deductLate;

    $('#inpLateGrace').value =
      s.lateGraceMinutes || 0;

    $('#inpCycleDay').value =
      s.cycleDay || 26;

    $('#inpTheme').value =
      s.theme || 'auto';

    $('#inpFontSize').value =
      s.fontSize || 'medium';

    $('#inpNotifyCheckIn').checked =
      !!s.notifyCheckIn;

    $('#inpNotifyCheckInTime').value =
      s.notifyCheckInTime || '07:00';

    $('#inpNotifyCheckOut').checked =
      !!s.notifyCheckOut;

    $('#inpNotifyCheckOutTime').value =
      s.notifyCheckOutTime || '19:00';

    $('#inpNotifyShiftEnd').checked =
      !!s.notifyShiftEnd;

    $('#settingsOverlay').classList.add('show');
    $('#settingsSheet').classList.add('show');
  }

  function closeSettingsSheet() {
    $('#settingsOverlay').classList.remove('show');
    $('#settingsSheet').classList.remove('show');
  }

  function saveSettings() {
    let cycleDay =
      Number($('#inpCycleDay').value) || 26;

    if (cycleDay < 1) cycleDay = 1;
    if (cycleDay > 28) cycleDay = 28;

    const s = {
      name:
        $('#inpName').value.trim() || 'موظف',

      job:
        $('#inpJob').value.trim(),

      employeeId:
        $('#inpEmployeeId').value.trim(),

      company:
        $('#inpCompany').value.trim(),

      salaryMethod:
        $('#inpSalaryMethod').value,

      salary:
        Number($('#inpSalary').value) || 0,

      monthlyHours:
        Number($('#inpMonthlyHours').value) || 208,

      shiftHours:
        Number($('#inpShiftHours').value) || 12,

      hourlyRate:
        Number($('#inpHourlyRate').value) || 0,

      overtimeEnabled:
        $('#inpOvertimeEnabled').checked,

      overtimeRate:
        Number($('#inpOvertimeRate').value) || 1.5,

      overtimeAfterHours:
        Number($('#inpOvertimeAfterHours').value) || 0,

      deductAbsence:
        $('#inpDeductAbsence').checked,

      deductLate:
        $('#inpDeductLate').checked,

      lateGraceMinutes:
        Number($('#inpLateGrace').value) || 0,

      cycleDay,

      theme:
        $('#inpTheme').value,

      fontSize:
        $('#inpFontSize').value,

      notifyCheckIn:
        $('#inpNotifyCheckIn').checked,

      notifyCheckInTime:
        $('#inpNotifyCheckInTime').value || '07:00',

      notifyCheckOut:
        $('#inpNotifyCheckOut').checked,

      notifyCheckOutTime:
        $('#inpNotifyCheckOutTime').value || '19:00',

      notifyShiftEnd:
        $('#inpNotifyShiftEnd').checked
    };

    if (window.SPUndoRedo) SPUndoRedo.pushUndo("save settings");


    storage.saveSettings(s);

    applyTheme();
    closeSettingsSheet();

    toast('تم حفظ الإعدادات', 'success');

    SPApp.onDataChange();
  }

  // =========================================================
  // Shift Manager
  // =========================================================

  function openShiftsSheet() {
    renderShiftsList();
    renderTemplatesList();
    populateRepeatShiftSelect();

    $('#shiftsOverlay').classList.add('show');
    $('#shiftsSheet').classList.add('show');
  }

  // ====== قوالب الورديات السريعة ======
  function renderTemplatesList() {
    const list = $('#templatesList');
    if (!list) return;
    list.innerHTML = '';
    const tpls = (window.SPTemplates) ? SPTemplates.getTemplates() : [];
    if (tpls.length === 0) {
      list.appendChild(el('p', { class: 'muted fs-sm ta-c', style: 'padding:10px;' }, ['لا قوالب']));
      return;
    }
    tpls.forEach((tpl) => {
      const card = el('button', {
        class: 'template-card',
        style: 'background:' + (tpl.color || '#3b82f6') + '15; border:1px solid ' + (tpl.color || '#3b82f6') + ';',
        'data-tpl-id': tpl.id,
        title: SPTemplates.getTemplateName(tpl)
      }, [
        el('div', { class: 'tpl-color', style: 'background:' + (tpl.color || '#3b82f6') }, []),
        el('span', { class: 'tpl-name' }, [SPTemplates.getTemplateName(tpl)]),
        el('span', { class: 'tpl-code' }, [tpl.shiftCode || ''])
      ]);
      card.addEventListener('click', onClickOnce(() => {
        const start = $('#patternStart').value;
        if (!start) {
          toast('حدد يوم بداية النمط أولًا', 'warning');
          return;
        }
        const count = SPTemplates.applyTemplate(tpl.id, start, 30);
        toast('تم تطبيق ' + count + ' يوم', 'success');
        closeShiftsSheet();
        SPApp.onDataChange();
      }));
      list.appendChild(card);
    });
  }

  function populateRepeatShiftSelect() {
    const sel = $('#repeatShift');
    if (!sel) return;
    sel.innerHTML = '';
    storage.getShifts().forEach((s) => {
      sel.appendChild(el('option', { value: s.code }, [s.name + ' (' + s.code + ')']));
    });
  }

  function applyRepeatRule() {
    if (!window.SPTemplates) return;
    const shiftCode = $('#repeatShift').value;
    const from = $('#repeatFrom').value;
    const to = $('#repeatTo').value;
    const type = $('#repeatType').value;
    if (!shiftCode || !from || !to) {
      toast('املأ كل الحقول', 'warning');
      return;
    }
    if (to < from) {
      toast('تاريخ النهاية قبل البداية', 'warning');
      return;
    }
    let customDays = null;
    if (type === 'custom') {
      customDays = Array.from(document.querySelectorAll('#weekdayChips .chip.active'))
        .map((b) => Number(b.dataset.day));
      if (customDays.length === 0) {
        toast('اختر يومًا واحدًا على الأقل', 'warning');
        return;
      }
    }
    const count = SPTemplates.applyRepeatRule({
      shiftCode, startDate: from, endDate: to, type, customDays
    });
    toast('تم تطبيق ' + count + ' يوم', 'success');
    closeShiftsSheet();
    SPApp.onDataChange();
  }

  function closeShiftsSheet() {
    $('#shiftsOverlay').classList.remove('show');
    $('#shiftsSheet').classList.remove('show');
  }

  function renderShiftsList() {
    const list = $('#shiftsList');

    list.innerHTML = '';

    const shifts = storage.getShifts();

    shifts.forEach((s) => {
      const row = el('div', {
        class:
          'setting-row',
        style:
          'border:1px solid var(--line);' +
          'border-radius:var(--r-md);' +
          'padding:10px 12px;' +
          'margin-bottom:8px;'
      });

      const meta = el('div', {
        class: 'meta'
      });

      meta.appendChild(
        el('div', {
          class: 'row gap-2'
        }, [
          el('span', {
            class: 'tag-dot',
            style: `background:${s.color}`
          }),

          el('div', {
            class: 't1'
          }, [
            s.name + ' (' + s.code + ')'
          ])
        ])
      );

      meta.appendChild(
        el('div', {
          class: 't2'
        }, [
          s.startTime
            ? `${s.startTime} - ${s.endTime} (${s.hours} س)`
            : 'وردية إجازة',

          ' • ',

          s.isWorkDay
            ? 'يوم عمل'
            : 'إجازة'
        ])
      );

      row.appendChild(meta);

      // Edit
      const editBtn = el('button', {
        class: 'icon-btn',
        style: 'width:36px;height:36px;',
        'aria-label': 'تعديل'
      });

      editBtn.innerHTML =
        '<svg viewBox="0 0 24 24" style="width:16px;height:16px;">' +
        '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"></path>' +
        '</svg>';

      editBtn.addEventListener(
        'click',
        () => openShiftEditor(s)
      );

      row.appendChild(editBtn);

      // Delete
      if (!s.isBuiltIn) {
        const delBtn = el('button', {
          class:
            'icon-btn',
          style:
            'width:36px;height:36px;color:var(--danger);',
          'aria-label':
            'حذف'
        }, ['×']);

        delBtn.addEventListener(
          'click',
          async () => {
            const ok = await confirmDialog(
              `حذف وردية "${s.name}"؟`,
              {
                okText: 'حذف',
                danger: true
              }
            );

            if (!ok) return;

            storage.deleteShift(s.id);

            renderShiftsList();

            SPApp.onDataChange();

            toast(
              'تم حذف الوردية',
              'success'
            );
          }
        );

        row.appendChild(delBtn);
      }

      list.appendChild(row);
    });
  }

  // =========================================================
  // Shift Editor
  // =========================================================

  function openShiftEditor(shift) {
    const isNew = !shift;

    $('#shiftEditTitle').textContent =
      isNew
        ? 'وردية جديدة'
        : 'تعديل الوردية';

    $('#shiftName').value =
      shift ? shift.name : '';

    $('#shiftCode').value =
      shift ? shift.code : '';

    $('#shiftStart').value =
      shift ? shift.startTime : '';

    $('#shiftEnd').value =
      shift ? shift.endTime : '';

    $('#shiftHours').value =
      shift ? shift.hours : 0;

    $('#shiftColor').value =
      shift ? shift.color : '#3b82f6';

    $('#shiftIsWorkDay').checked =
      shift
        ? shift.isWorkDay
        : true;

    $('#shiftEditSheet').dataset.editId =
      shift
        ? shift.id
        : '';

    $('#shiftEditOverlay').classList.add('show');
    $('#shiftEditSheet').classList.add('show');
  }

  function closeShiftEditor() {
    $('#shiftEditOverlay').classList.remove('show');
    $('#shiftEditSheet').classList.remove('show');
  }

  function saveShift() {
    const name =
      $('#shiftName').value.trim();

    const code =
      $('#shiftCode').value.trim().toUpperCase();

    if (!name) {
      toast(
        'أدخل اسم الوردية',
        'warning'
      );
      return;
    }

    if (!code) {
      toast(
        'أدخل رمز الوردية',
        'warning'
      );
      return;
    }

    const start =
      $('#shiftStart').value;

    const end =
      $('#shiftEnd').value;

    let hours =
      Number($('#shiftHours').value) || 0;

    if (!hours && start && end) {
      hours =
        SPUtils.computeRangeHours(
          start,
          end
        );
    }

    const id =
      $('#shiftEditSheet').dataset.editId ||
      ('s-' + Date.now().toString(36));

    const existing =
      storage.getShiftById(id);

    const shift = {
      id,
      name,
      code,
      startTime: start,
      endTime: end,
      hours,

      color:
        $('#shiftColor').value,

      isWorkDay:
        $('#shiftIsWorkDay').checked,

      isBuiltIn:
        existing
          ? existing.isBuiltIn
          : false
    };

    storage.upsertShift(shift);

    closeShiftEditor();

    renderShiftsList();

    SPApp.onDataChange();

    toast(
      'تم حفظ الوردية',
      'success'
    );
  }

  // =========================================================
  // Pattern application
  // =========================================================

  function applyPattern() {
    const startDate =
      $('#patternStart').value;

    const seqStr =
      $('#patternSeq').value
        .trim()
        .toUpperCase();

    if (!startDate) {
      toast(
        'حدد يوم البداية',
        'warning'
      );
      return;
    }

    const codes =
      seqStr
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

    if (codes.length === 0) {
      toast(
        'أدخل تسلسل الورديات (مثال: D,N,O)',
        'warning'
      );
      return;
    }

    const allCodes =
      storage.getShifts()
        .map((s) => s.code);

    const invalid =
      codes.find(
        (c) => !allCodes.includes(c)
      );

    if (invalid) {
      toast(
        `رمز غير معروف: ${invalid}`,
        'error'
      );
      return;
    }

    const start =
      parseDate(startDate);

    const entries = {};

    for (let i = 0; i < 30; i++) {
      const d =
        new Date(start);

      d.setDate(
        d.getDate() + i
      );

      entries[fmtDate(d)] =
        codes[i % codes.length];
    }

    storage.setScheduleMany(entries);

    toast(
      'تم تطبيق النمط على 30 يوم',
      'success'
    );

    closeShiftsSheet();

    SPApp.onDataChange();
  }

  function clearPattern() {
    $('#patternStart').value = '';
    $('#patternSeq').value = '';

    toast(
      'تم مسح النمط (لإزالة التطبيق حدد الأيام يدويًا)',
      'info'
    );
  }

  // =========================================================
  // Leave Balance
  // =========================================================

  // دالة i18n مساعدة
  function L(key, vars) {
    return window.SPi18n ? SPi18n.t(key, vars) : key;
  }

  function openNewLeaveSheet() {
    // املأ قائمة الأنواع
    const sel = $('#leaveTypeSelect');
    if (sel) {
      sel.innerHTML = '';
      (window.SPLeaves ? SPLeaves.LEAVE_TYPES : []).forEach((type) => {
        const opt = el('option', { value: type.id }, [SPLeaves.getTypeName(type.id)]);
        sel.appendChild(opt);
      });
    }
    // القيم الافتراضية
    const today = new Date();
    const todayISO = SPUtils.fmtDate(today);
    if ($('#leaveFromInput')) $('#leaveFromInput').value = todayISO;
    if ($('#leaveToInput')) $('#leaveToInput').value = todayISO;
    if ($('#leaveHalfDayCheck')) $('#leaveHalfDayCheck').checked = false;
    if ($('#leaveHoursCheck')) $('#leaveHoursCheck').checked = false;
    if ($('#leaveHoursInput')) $('#leaveHoursInput').value = '';
    if ($('#leaveReasonInput')) $('#leaveReasonInput').value = '';
    if ($('#leaveNoteInput')) $('#leaveNoteInput').value = '';
    if ($('#leaveStatusSelect')) $('#leaveStatusSelect').value = 'pending';

    $('#newLeaveOverlay').classList.add('show');
    $('#newLeaveSheet').classList.add('show');
    setTimeout(() => { if ($('#leaveFromInput')) $('#leaveFromInput').focus(); }, 200);
  }

  function closeNewLeaveSheet() {
    $('#newLeaveOverlay').classList.remove('show');
    $('#newLeaveSheet').classList.remove('show');
  }

  function saveNewLeaveRequest() {
    if (!window.SPLeaves) {
      toast('موديول الإجازات غير متاح', 'error');
      return;
    }
    const type = $('#leaveTypeSelect').value;
    const from = $('#leaveFromInput').value;
    const to = $('#leaveToInput').value || from;
    const halfDay = $('#leaveHalfDayCheck').checked;
    const halfPeriod = $('#leaveHalfPeriod').value;
    const hours = $('#leaveHoursCheck').checked ? Number($('#leaveHoursInput').value) : 0;
    const reason = $('#leaveReasonInput').value.trim();
    const note = $('#leaveNoteInput').value.trim();
    const status = $('#leaveStatusSelect').value;

    if (!type || !from) {
      toast(L('common.required'), 'warning');
      return;
    }
    if (to < from) {
      toast(L('leave.to_label') + ' < ' + L('leave.from_label'), 'warning');
      return;
    }

    // تحقق من الرصيد لو الحالة مقبولة
    if (status === 'approved') {
      const bal = SPLeaves.calculateBalances(new Date(from).getFullYear());
      const current = bal[type];
      if (current && current.remaining < SPLeaves.countLeaveDays({
        fromDate: from, toDate: to, halfDay, hours
      })) {
        toast(L('msg.leave_balance_low', { remaining: current.remaining }), 'warning');
        // ما ترجعش - خلّي المستخدم يكمّل لو حابب
      }
    }

    const req = SPLeaves.addRequest({
      type, fromDate: from, toDate: to,
      halfDay, halfPeriod, hours, reason, note, status
    });
    toast(L('msg.added'), 'success');
    closeNewLeaveSheet();
    // إعادة رسم
    renderLeaveBalance();
    renderLeaveRecords();
    if (window.SPApp && SPApp.onDataChange) SPApp.onDataChange();
  }

  function openLeaveSheet() {
    renderLeaveBalance();
    renderLeaveRecords();

    $('#leaveOverlay').classList.add('show');
    $('#leaveSheet').classList.add('show');
  }

  function closeLeaveSheet() {
    $('#leaveOverlay').classList.remove('show');
    $('#leaveSheet').classList.remove('show');
  }

  // ---------------------------------------------------------
  // Normalize leave hours
  // ---------------------------------------------------------

  function getLeaveHours(entry) {
    if (!entry) return 0;

    let hours =
      Number(entry.leaveHours);

    if (!Number.isFinite(hours)) {
      hours = 8;
    }

    if (hours < 0) hours = 0;
    if (hours > 24) hours = 24;

    return hours;
  }

  // ---------------------------------------------------------
  // Convert leave hours to days
  // 8 hours = 1 day
  // ---------------------------------------------------------

  function leaveHoursToDays(hours) {
    const h =
      Number(hours) || 0;

    return h / 8;
  }

  // ---------------------------------------------------------
  // Normalize leave type
  // ---------------------------------------------------------

  function normalizeLeaveType(type) {
    const value =
      String(type || 'annual')
        .trim()
        .toLowerCase();

    const aliases = {
      annual: 'annual',
      سنوية: 'annual',

      casual: 'casual',
      عارضة: 'casual',

      sick: 'sick',
      مرضية: 'sick',

      unpaid: 'unpaid',
      بدون_راتب: 'unpaid',
      'بدون راتب': 'unpaid',

      periodic: 'periodic',
      دورية: 'periodic',

      other: 'other',
      أخرى: 'other',
      اخرى: 'other'
    };

    return aliases[value] || 'annual';
  }

  // ---------------------------------------------------------
  // Calculate used leave from attendance
  //
  // IMPORTANT:
  // Attendance records are the single source of truth.
  //
  // Example:
  // 8h  = 1 day
  // 4h  = 0.5 day
  // 6h  = 0.75 day
  // ---------------------------------------------------------

  function calculateUsedLeave() {
    const used = {
      annual: 0,
      casual: 0,
      sick: 0,
      unpaid: 0,
      periodic: 0,
      other: 0
    };

    const attendance =
      storage.getAttendance() || {};

    Object.values(attendance).forEach((entry) => {
      if (!entry || entry.status !== 'L') {
        return;
      }

      const type =
        normalizeLeaveType(
          entry.leaveType
        );

      const hours =
        getLeaveHours(entry);

      const days =
        leaveHoursToDays(hours);

      if (!Object.prototype.hasOwnProperty.call(used, type)) {
        used.other += days;
        return;
      }

      used[type] += days;
    });

    return used;
  }

  // ---------------------------------------------------------
  // Format leave days
  // ---------------------------------------------------------

  function formatLeaveDays(value) {
    const n =
      Math.round(
        (Number(value) || 0) * 100
      ) / 100;

    if (Number.isInteger(n)) {
      return String(n);
    }

    return n.toFixed(2)
      .replace(/\.00$/, '')
      .replace(/(\.\d)0$/, '$1');
  }

  // ---------------------------------------------------------
  // Render Leave Balance
  // (بتستخدم SPLeaves لو متاح - للأنواع الـ 8 وحساب المتبقي الصحيح)
  // ---------------------------------------------------------

  function renderLeaveBalance() {
    const list = $('#leaveBalanceList');
    if (!list) return;

    list.innerHTML = '';

    // استخدم SPLeaves لو متاح - وإلا fallback للنمط القديم
    const useLeavesModule = !!window.SPLeaves;
    const bal = useLeavesModule
      ? SPLeaves.calculateBalances(new Date().getFullYear())
      : (() => {
          const stored = storage.getLeaveBalance() || {};
          const used = calculateUsedLeave();
          return Object.keys(stored).reduce((acc, k) => {
            const v = stored[k] || { total: 0 };
            const u = used[k] || 0;
            acc[k] = { total: Number(v.total) || 0, used: u, remaining: (Number(v.total) || 0) - u };
            return acc;
          }, {});
        })();

    // قائمة الأنواع: الـ 8 الجديدة لو المتاح، وإلا الـ 5 القديمة
    const types = useLeavesModule
      ? SPLeaves.LEAVE_TYPES.map((t) => ({ key: t.id, label: SPLeaves.getTypeName(t.id), color: t.color }))
      : [
        { key: 'annual', label: 'إجازة سنوية', color: '#3b82f6' },
        { key: 'casual', label: 'إجازة عارضة', color: '#06b6d4' },
        { key: 'sick', label: 'إجازة مرضية', color: '#ef4444' },
        { key: 'unpaid', label: 'إجازة بدون راتب', color: '#6b7280' },
        { key: 'periodic', label: 'إجازة دورية', color: '#0ea5e9' }
      ];

    types.forEach((t) => {
      const v = bal[t.key] || { total: 0, used: 0, remaining: 0 };
      const total = Number(v.total) || 0;
      const usedDays = Number(v.used) || 0;
      const remaining = Number(v.remaining != null ? v.remaining : (total - usedDays));
      const carryover = Number(v.carryover) || 0;

      const row = el('div', { class: 'card compact mb-2' });

      // Header — اسم النوع مع dot ملوّن
      const headerLeft = el('div', {
        style: 'display:flex;align-items:center;gap:8px;'
      }, [
        el('i', { class: 'dot', style: 'background:' + t.color + ';width:10px;height:10px;border-radius:50%;display:inline-block;' }),
        el('strong', { class: 'fs-md' }, [t.label])
      ]);

      row.appendChild(
        el('div', { class: 'row between mb-2' }, [
          headerLeft,
          el('span', { class: 'chip' }, [
            formatLeaveDays(usedDays) + ' / ' + formatLeaveDays(total)
          ])
        ])
      );

      // Inputs
      const inputs = el('div', { class: 'field-row' });

      const totalField = el('div', { class: 'field' });
      totalField.appendChild(el('label', {}, [L('leave.balance') + ' ' + L('common.all')]));
      const totalInput = el('input', {
        type: 'number', min: '0', step: '0.5', value: total,
        'data-leave-key': t.key, 'data-leave-field': 'total'
      });
      totalField.appendChild(totalInput);
      inputs.appendChild(totalField);

      // Carryover field (لو متاح)
      if (useLeavesModule) {
        const carryField = el('div', { class: 'field' });
        carryField.appendChild(el('label', {}, [
          el('label', { style: 'display:flex;align-items:center;gap:6px;' }, [
            el('input', {
              type: 'checkbox',
              checked: !!v.carryoverEnabled,
              'data-leave-key': t.key,
              'data-leave-field': 'carryoverEnabled'
            }),
            'ترحيل'
          ])
        ]));
        const carryInput = el('input', {
          type: 'number', min: '0', step: '0.5', value: carryover,
          'data-leave-key': t.key, 'data-leave-field': 'carryover',
          placeholder: '0'
        });
        carryField.appendChild(carryInput);
        inputs.appendChild(carryField);
      }

      const usedField = el('div', { class: 'field' });
      usedField.appendChild(el('label', {}, [L('leave.used')]));
      const usedInput = el('input', {
        type: 'number', value: usedDays, readonly: true, disabled: true,
        style: 'opacity:.75;cursor:not-allowed;',
        'data-leave-key': t.key, 'data-leave-field': 'used'
      });
      usedField.appendChild(usedInput);
      inputs.appendChild(usedField);

      row.appendChild(inputs);

      // Remaining
      row.appendChild(
        el('div', { class: 'row between mt-2' }, [
          el('span', { class: 'fs-sm muted' }, [L('leave.remaining')]),
          el('strong', {
            class: remaining >= 0 ? 'success' : 'danger'
          }, [
            formatLeaveDays(remaining) + ' ' + (L('app.name') === 'ShiftPro' && window.SPi18n && SPi18n.getLocale() === 'ar' ? 'يوم' : 'days')
          ])
        ])
      );

      // Hours info
      row.appendChild(
        el('div', { class: 'fs-xs muted mt-1' }, [
          (window.SPi18n && SPi18n.getLocale() === 'ar')
            ? 'المستخدم محسوب من طلبات الإجازات المقبولة + سجلات الحضور (8 ساعات = يوم)'
            : 'Used calculated from approved leave requests + attendance (8 hours = 1 day)'
        ])
      );

      list.appendChild(row);
    });

    // Save totals only
    const saveBtn =
      el('button', {
        class:
          'btn primary block sm mt-2'
      }, [
        'حفظ الأرصدة'
      ]);

    saveBtn.addEventListener(
      'click',
      saveLeaveBalance
    );

    list.appendChild(saveBtn);
  }

  // ---------------------------------------------------------
  // Save leave balances
  //
  // يحفظ totals + carryover + carryoverEnabled لكل نوع.
  // Used values بيتحسب من attendance + approved requests.
  // ---------------------------------------------------------

  function saveLeaveBalance() {
    const oldBalance = storage.getLeaveBalance() || {};

    // ابدأ من النمط الموسّع (الأنواع الـ 8)
    const useLeavesModule = !!window.SPLeaves;
    const defaultBal = useLeavesModule
      ? SPLeaves.getDefaultBalances()
      : {
        annual: { total: 0, used: 0 }, casual: { total: 0, used: 0 },
        sick: { total: 0, used: 0 }, unpaid: { total: 0, used: 0 },
        periodic: { total: 0, used: 0 }
      };

    // ادمج القيم القديمة
    const bal = {};
    Object.keys(defaultBal).forEach((key) => {
      const old = oldBalance[key] || {};
      bal[key] = Object.assign({}, defaultBal[key], {
        total: Number(old.total) || 0,
        carryover: Number(old.carryover) || 0,
        carryoverEnabled: !!old.carryoverEnabled,
        used: 0
      });
    });

    // اقرأ قيم الـ inputs
    document.querySelectorAll('[data-leave-key][data-leave-field="total"]').forEach((inp) => {
      const key = inp.dataset.leaveKey;
      const val = Number(inp.value);
      if (Object.prototype.hasOwnProperty.call(bal, key)) {
        bal[key].total = Number.isFinite(val) && val >= 0 ? val : 0;
      }
    });
    document.querySelectorAll('[data-leave-key][data-leave-field="carryover"]').forEach((inp) => {
      const key = inp.dataset.leaveKey;
      const val = Number(inp.value);
      if (Object.prototype.hasOwnProperty.call(bal, key)) {
        bal[key].carryover = Number.isFinite(val) && val >= 0 ? val : 0;
      }
    });
    document.querySelectorAll('[data-leave-key][data-leave-field="carryoverEnabled"]').forEach((inp) => {
      const key = inp.dataset.leaveKey;
      if (Object.prototype.hasOwnProperty.call(bal, key)) {
        bal[key].carryoverEnabled = !!inp.checked;
      }
    });

    // احسب المستهلك
    const used = calculateUsedLeave();
    Object.keys(bal).forEach((key) => {
      bal[key].used = used[key] || 0;
    });

    if (window.SPUndoRedo) SPUndoRedo.pushUndo("save leave balance");


    storage.saveLeaveBalance(bal);

    toast(
      (window.SPi18n ? SPi18n.t('msg.saved') : 'تم الحفظ بنجاح'),
      'success'
    );

    renderLeaveBalance();
    renderLeaveRecords();

    SPApp.onDataChange();
  }

  // ---------------------------------------------------------
  // Leave records
  // ---------------------------------------------------------

  function renderLeaveRecords() {
    const list =
      $('#leaveRecordsList');

    if (!list) return;

    list.innerHTML = '';

    const attendance =
      storage.getAttendance() || {};

    const records =
      Object.entries(attendance)
        .filter(
          ([_, e]) =>
            e &&
            e.status === 'L'
        )
        .sort(
          (a, b) =>
            b[0].localeCompare(a[0])
        );

    if (records.length === 0) {
      list.appendChild(
        el('div', {
          class:
            'muted fs-sm ta-c',
          style:
            'padding:16px;'
        }, [
          'لا توجد إجازات مسجلة'
        ])
      );

      return;
    }

    const typeNames = {
      annual: 'سنوية',
      casual: 'عارضة',
      sick: 'مرضية',
      unpaid: 'بدون راتب',
      periodic: 'دورية',
      other: 'أخرى'
    };

    records.forEach(
      ([dstr, entry]) => {
        const type =
          normalizeLeaveType(
            entry.leaveType
          );

        const typeName =
          typeNames[type] ||
          'إجازة';

        const hours =
          getLeaveHours(entry);

        const days =
          leaveHoursToDays(hours);

        const note =
          entry.note ||
          '';

        const row =
          el('div', {
            class:
              'row between',
            style:
              'padding:10px 0;' +
              'border-bottom:1px solid var(--line-soft);' +
              'gap:10px;'
          });

        const info =
          el('div', {
            style:
              'min-width:0;flex:1;'
          });

        info.appendChild(
          el('div', {
            class: 'fw-600'
          }, [
            `${dstr} — ${typeName}`
          ])
        );

        info.appendChild(
          el('div', {
            class:
              'muted fs-xs mt-1'
          }, [
            `${formatLeaveDays(days)} يوم • ${fmtNum(hours, 1)} ساعة`
          ])
        );

        if (note) {
          info.appendChild(
            el('div', {
              class:
                'muted fs-xs mt-1'
            }, [
              note
            ])
          );
        }

        row.appendChild(info);

        row.appendChild(
          el('span', {
            class: 'chip'
          }, [
            `${fmtNum(hours, 1)} س`
          ])
        );

        list.appendChild(row);
      }
    );
  }

  // =========================================================
  // Stats
  // =========================================================

  function openStatsSheet() {
    const today =
      new Date();

    const start =
      new Date(
        today.getFullYear(),
        today.getMonth(),
        1
      );

    $('#statsFrom').value =
      fmtDate(start);

    $('#statsTo').value =
      fmtDate(today);

    renderStats(
      start,
      today
    );

    $('#statsOverlay').classList.add('show');
    $('#statsSheet').classList.add('show');
  }

  function closeStatsSheet() {
    $('#statsOverlay').classList.remove('show');
    $('#statsSheet').classList.remove('show');
  }

  function renderStats(start, end) {
    const content =
      $('#statsContent');

    const result =
      SPSalary.computeSalary(
        start,
        end
      );

    const totalDays =
      Math.max(
        1,
        Math.round(
          (end - start) /
          86400000
        ) + 1
      );

    const avgHours =
      result.totalHours /
      totalDays;

    const compliancePct =
      (
        result.counts.A +
        result.counts.X
      ) > 0
        ? Math.round(
            (
              (
                result.counts.A +
                result.counts.X
              ) /
              Math.max(
                1,
                result.counts.A +
                result.counts.X +
                result.counts.B
              )
            ) * 100
          )
        : 0;

    content.innerHTML = '';

    const grid =
      el('div', {
        class: 'stat-grid',
        style:
          'grid-template-columns:repeat(2,1fr);'
      });

    grid.appendChild(
      makeStatCard(
        'إجمالي ساعات',
        fmtNum(
          result.totalHours,
          1
        ) + ' س',
        'accent'
      )
    );

    grid.appendChild(
      makeStatCard(
        'متوسط ساعات/يوم',
        fmtNum(
          avgHours,
          1
        ) + ' س',
        'accent'
      )
    );

    grid.appendChild(
      makeStatCard(
        'أيام حضور',
        String(result.counts.A),
        'success'
      )
    );

    grid.appendChild(
      makeStatCard(
        'أيام مطبق',
        String(result.counts.X),
        'accent'
      )
    );

    grid.appendChild(
      makeStatCard(
        'أيام إجازة',
        String(result.counts.L),
        'warning'
      )
    );

    grid.appendChild(
      makeStatCard(
        'أيام غياب',
        String(result.counts.B),
        'danger'
      )
    );

    grid.appendChild(
      makeStatCard(
        'ساعات إضافي',
        fmtNum(
          result.overtimeHours,
          1
        ) + ' س',
        'success'
      )
    );

    grid.appendChild(
      makeStatCard(
        'نسبة الحضور',
        compliancePct + '%',
        compliancePct >= 80
          ? 'success'
          : 'warning'
      )
    );

    grid.appendChild(
      makeStatCard(
        'إجمالي الراتب',
        fmtCurrency(
          result.grossSalary
        ),
        'accent'
      )
    );

    grid.appendChild(
      makeStatCard(
        'صافي المستحق',
        fmtCurrency(
          result.netSalary
        ),
        'success'
      )
    );

    content.appendChild(grid);
  }

  function makeStatCard(
    label,
    value,
    cls
  ) {
    const card =
      el('div', {
        class:
          'stat-card ' + cls
      });

    card.appendChild(
      el('p', {
        class: 'label'
      }, [
        label
      ])
    );

    card.appendChild(
      el('p', {
        class: 'value'
      }, [
        value
      ])
    );

    card.appendChild(
      el('div', {
        class: 'ico-bg'
      })
    );

    return card;
  }

  // =========================================================
  // Backup & Restore
  // =========================================================

  function openBackupSheet() {
    $('#backupOverlay').classList.add('show');
    $('#backupSheet').classList.add('show');
  }

  function closeBackupSheet() {
    $('#backupOverlay').classList.remove('show');
    $('#backupSheet').classList.remove('show');
  }

  function exportBackup() {
    const data =
      storage.exportAll();

    const blob =
      new Blob(
        [
          JSON.stringify(
            data,
            null,
            2
          )
        ],
        {
          type:
            'application/json'
        }
      );

    SPUtils.downloadBlob(
      `ShiftPro-Backup-${SPUtils.todayStr()}.json`,
      blob
    );

    toast(
      'تم تصدير النسخة الاحتياطية',
      'success'
    );
  }

  function importBackup(file) {
    const reader =
      new FileReader();

    reader.onload =
      async () => {
        try {
          const json =
            JSON.parse(
              reader.result
            );

          const ok =
            await confirmDialog(
              'سيتم استبدال جميع البيانات الحالية بالبيانات من الملف. متابعة؟',
              {
                okText:
                  'استبدال',
                danger:
                  true,
                title:
                  'استيراد نسخة احتياطية'
              }
            );

          if (!ok) return;

          storage.importAll(json);

          toast(
            'تم استيراد النسخة بنجاح',
            'success'
          );

          closeBackupSheet();

          applyTheme();

          SPApp.onDataChange();

        } catch (e) {
          toast(
            'الملف غير صالح: ' +
            e.message,
            'error'
          );
        }
      };

    reader.readAsText(file);
  }

  async function resetSettings() {
    const ok =
      await confirmDialog(
        'سيتم إعادة الإعدادات إلى الوضع الافتراضي مع الاحتفاظ ببيانات الحضور. متابعة؟',
        {
          okText:
            'استعادة',
          danger:
            true,
          title:
            'استعادة الإعدادات الافتراضية'
        }
      );

    if (!ok) return;

    if (window.SPUndoRedo) SPUndoRedo.pushUndo("save settings");


    storage.saveSettings(
      Object.assign(
        {},
        storage.DEFAULT_SETTINGS
      )
    );

    applyTheme();

    toast(
      'تمت استعادة الإعدادات الافتراضية',
      'success'
    );

    SPApp.onDataChange();
  }

  async function deleteAll() {
    const ok =
      await confirmDialog(
        '⚠️ سيتم حذف جميع البيانات نهائيًا (الحضور، الورديات، الإعدادات، النسخ الاحتياطية المحلية). لا يمكن التراجع! متابعة؟',
        {
          okText:
            'حذف الكل',
          danger:
            true,
          title:
            'حذف جميع البيانات'
        }
      );

    if (!ok) return;

    const ok2 =
      await confirmDialog(
        'تأكيد أخير — اكتب "نعم" في رأسك واضغط تأكيد. كل البيانات ستُفقد.',
        {
          okText:
            'أؤكد الحذف',
          danger:
            true
        }
      );

    if (!ok2) return;

    storage.clearAll();

    toast(
      'تم حذف جميع البيانات',
      'success'
    );

    setTimeout(
      () => location.reload(),
      600
    );
  }

  // =========================================================
  // About
  // =========================================================

  function openAboutSheet() {
    $('#aboutOverlay').classList.add('show');
    $('#aboutSheet').classList.add('show');
  }

  function closeAboutSheet() {
    $('#aboutOverlay').classList.remove('show');
    $('#aboutSheet').classList.remove('show');
  }

  // =========================================================
  // Generic sheet openers
  // =========================================================

  function openSheetByName(name) {
    switch (name) {
      case 'settings':
        openSettingsSheet();
        break;

      case 'shifts':
        openShiftsSheet();
        break;

      case 'leave':
        openLeaveSheet();
        break;

      case 'stats':
        openStatsSheet();
        break;

      case 'backup':
        openBackupSheet();
        break;

      case 'about':
        openAboutSheet();
        break;
    }
  }

  // =========================================================
  // Init
  // =========================================================

  function init() {
    applyTheme();

    // Theme
    $('#themeBtn')
      .addEventListener(
        'click',
        onClickOnce(cycleTheme)
      );

    // Settings
    $('#saveSettingsBtn')
      .addEventListener(
        'click',
        onClickOnce(saveSettings)
      );

    $('#closeSettingsBtn')
      .addEventListener(
        'click',
        closeSettingsSheet
      );

    $('#settingsOverlay')
      .addEventListener(
        'click',
        closeSettingsSheet
      );

    // Shifts
    $('#addShiftBtn')
      .addEventListener(
        'click',
        onClickOnce(
          () => openShiftEditor(null)
        )
      );

    $('#saveShiftBtn')
      .addEventListener(
        'click',
        onClickOnce(saveShift)
      );

    $('#cancelShiftBtn')
      .addEventListener(
        'click',
        closeShiftEditor
      );

    $('#shiftEditOverlay')
      .addEventListener(
        'click',
        closeShiftEditor
      );

    $('#closeShiftsBtn')
      .addEventListener(
        'click',
        closeShiftsSheet
      );

    $('#shiftsOverlay')
      .addEventListener(
        'click',
        closeShiftsSheet
      );

    $('#applyPatternBtn')
      .addEventListener(
        'click',
        onClickOnce(applyPattern)
      );

    $('#clearPatternBtn')
      .addEventListener(
        'click',
        clearPattern
      );

    // ====== قوالب وتكرار ذكي ======
    const applyRepeatBtn = $('#applyRepeatBtn');
    if (applyRepeatBtn) {
      applyRepeatBtn.addEventListener('click', onClickOnce(applyRepeatRule));
    }
    const repeatTypeSel = $('#repeatType');
    if (repeatTypeSel) {
      repeatTypeSel.addEventListener('change', (e) => {
        $('#customDaysField').hidden = (e.target.value !== 'custom');
      });
    }
    // weekday chips
    document.querySelectorAll('#weekdayChips .chip').forEach((chip) => {
      chip.addEventListener('click', (e) => {
        e.preventDefault();
        chip.classList.toggle('active');
      });
    });

    // Leave
    $('#closeLeaveBtn')
      .addEventListener(
        'click',
        closeLeaveSheet
      );

    $('#leaveOverlay')
      .addEventListener(
        'click',
        closeLeaveSheet
      );

    // ====== New Leave Request (i18n-aware) ======
    const newLeaveBtn = $('#newLeaveBtn');
    if (newLeaveBtn) {
      newLeaveBtn.addEventListener('click', openNewLeaveSheet);
    }
    const cancelLeaveBtn = $('#cancelLeaveBtn');
    if (cancelLeaveBtn) {
      cancelLeaveBtn.addEventListener('click', closeNewLeaveSheet);
    }
    const newLeaveOverlay = $('#newLeaveOverlay');
    if (newLeaveOverlay) {
      newLeaveOverlay.addEventListener('click', closeNewLeaveSheet);
    }
    const saveLeaveBtn = $('#saveLeaveBtn');
    if (saveLeaveBtn) {
      saveLeaveBtn.addEventListener('click', onClickOnce(saveNewLeaveRequest));
    }
    const halfDayCheck = $('#leaveHalfDayCheck');
    if (halfDayCheck) {
      halfDayCheck.addEventListener('change', (e) => {
        $('#leaveHalfPeriod').disabled = !e.target.checked;
        if (e.target.checked) {
          $('#leaveHoursCheck').checked = false;
          $('#leaveHoursInput').disabled = true;
        }
      });
    }
    const hoursCheck = $('#leaveHoursCheck');
    if (hoursCheck) {
      hoursCheck.addEventListener('change', (e) => {
        $('#leaveHoursInput').disabled = !e.target.checked;
        if (e.target.checked) {
          $('#leaveHalfDayCheck').checked = false;
          $('#leaveHalfPeriod').disabled = true;
        }
      });
    }
    // تاريخ "إلى" افتراضي يساوي "من"
    const leaveFromInput = $('#leaveFromInput');
    if (leaveFromInput) {
      leaveFromInput.addEventListener('change', (e) => {
        const toInput = $('#leaveToInput');
        if (!toInput.value || toInput.value < e.target.value) {
          toInput.value = e.target.value;
        }
      });
    }

    // Stats
    $('#closeStatsBtn')
      .addEventListener(
        'click',
        closeStatsSheet
      );

    $('#statsOverlay')
      .addEventListener(
        'click',
        closeStatsSheet
      );

    $('#applyStatsRange')
      .addEventListener(
        'click',
        onClickOnce(
          () => {
            const from =
              $('#statsFrom').value;

            const to =
              $('#statsTo').value;

            if (!from || !to) {
              toast(
                'حدد التاريخ',
                'warning'
              );
              return;
            }

            renderStats(
              parseDate(from),
              parseDate(to)
            );

            toast(
              'تم تحديث الإحصائيات',
              'success'
            );
          }
        )
      );

    // Backup
    $('#exportBackupBtn')
      .addEventListener(
        'click',
        onClickOnce(exportBackup)
      );

    $('#importBackupBtn')
      .addEventListener(
        'click',
        () =>
          $('#importBackupInput').click()
      );

    $('#importBackupInput')
      .addEventListener(
        'change',
        (e) => {
          const file =
            e.target.files[0];

          if (file) {
            importBackup(file);
          }

          e.target.value = '';
        }
      );

    $('#resetSettingsBtn')
      .addEventListener(
        'click',
        onClickOnce(resetSettings)
      );

    $('#deleteAllBtn')
      .addEventListener(
        'click',
        onClickOnce(deleteAll)
      );

    $('#closeBackupBtn')
      .addEventListener(
        'click',
        closeBackupSheet
      );

    $('#backupOverlay')
      .addEventListener(
        'click',
        closeBackupSheet
      );

    // About
    $('#closeAboutBtn')
      .addEventListener(
        'click',
        closeAboutSheet
      );

    $('#aboutOverlay')
      .addEventListener(
        'click',
        closeAboutSheet
      );

    // More page
    document
      .querySelectorAll('[data-sheet]')
      .forEach((btn) => {
        btn.addEventListener(
          'click',
          () =>
            openSheetByName(
              btn.dataset.sheet
            )
        );
      });

    // System theme
    if (
      window.matchMedia
    ) {
      const media =
        window.matchMedia(
          '(prefers-color-scheme: dark)'
        );

      if (media.addEventListener) {
        media.addEventListener(
          'change',
          applyTheme
        );
      } else if (media.addListener) {
        media.addListener(
          applyTheme
        );
      }
    }
  }

  // =========================================================
  // Public API
  // =========================================================

  global.SPSettings = {
    init,
    applyTheme,
    openSettingsSheet,
    closeSettingsSheet,
    openSheetByName,

    // Expose these for other modules if needed
    calculateUsedLeave,
    getLeaveHours,
    leaveHoursToDays,
    renderLeaveBalance,
    renderLeaveRecords
  };

})(window);