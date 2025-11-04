(() => {
  const STORAGE_KEY = 'club-dues-v1';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const yen = new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', maximumFractionDigits: 0 });

  const today = () => {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
  };

  const genId = () => Math.random().toString(36).slice(2, 10);

  const load = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { members: [], periods: [], payments: {}, expenses: [] };
      const data = JSON.parse(raw);
      if (!data || !Array.isArray(data.members) || !Array.isArray(data.periods) || typeof data.payments !== 'object') {
        return { members: [], periods: [], payments: {}, expenses: [] };
      }
      if (!Array.isArray(data.expenses)) data.expenses = [];
      return data;
    } catch (_) {
      return { members: [], periods: [], payments: {}, expenses: [] };
    }
  };

  const save = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

  const state = load();

  // Elements
  const tabButtons = $$('.tabs button');
  const tabPanels = $$('.tab-panel');

  // Members
  const formMember = $('#form-member');
  const memberId = $('#member-id');
  const memberName = $('#member-name');
  const memberContact = $('#member-contact');
  const membersTbody = $('#members-tbody');

  // Periods
  const formPeriod = $('#form-period');
  const periodId = $('#period-id');
  const periodName = $('#period-name');
  const periodFee = $('#period-fee');
  const periodsTbody = $('#periods-tbody');

  // Payments
  const paymentsPeriodSelect = $('#payments-period-select');
  const paymentsTbody = $('#payments-tbody');
  const paymentsSummary = $('#payments-summary');
  const btnAllPaid = $('#btn-mark-all-paid');
  const btnAllUnpaid = $('#btn-mark-all-unpaid');

  // Expenses
  const formExpense = $('#form-expense');
  const expenseId = $('#expense-id');
  const expenseDate = $('#expense-date');
  const expenseAmount = $('#expense-amount');
  const expenseCategory = $('#expense-category');
  const expenseNote = $('#expense-note');
  const expensePayer = $('#expense-payer');
  const expensesTbody = $('#expenses-tbody');

  // Summary
  const summaryPeriods = $('#summary-periods');
  const summaryMembers = $('#summary-members');
  const summaryTotals = $('#summary-totals');
  const summaryMonthly = $('#summary-monthly');
  const summaryCategories = $('#summary-categories');
  const summaryPayers = $('#summary-payers');

  // Header import/export
  const btnExport = $('#btn-export');
  const fileImport = $('#file-import');

  // Tabs
  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      tabButtons.forEach((b) => b.classList.toggle('active', b === btn));
      tabPanels.forEach((p) => p.classList.toggle('active', p.id === `tab-${tab}`));
      if (tab === 'payments') renderPaymentsPanel();
      if (tab === 'expenses') renderExpenses();
      if (tab === 'summary') renderSummary();
    });
  });

  // Members CRUD
  formMember?.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = memberId.value.trim();
    const name = memberName.value.trim();
    const contact = memberContact.value.trim();
    if (!name) return;
    if (id) {
      const m = state.members.find((x) => x.id === id);
      if (m) {
        m.name = name;
        m.contact = contact;
      }
    } else {
      state.members.push({ id: genId(), name, contact });
    }
    save();
    formMember.reset();
    renderMembers();
    refreshPaymentsSelect();
    refreshExpensePayerOptions();
    renderSummary();
  });

  $('#member-cancel')?.addEventListener('click', () => {
    memberId.value = '';
  });

  const renderMembers = () => {
    if (!state.members.length) {
      membersTbody.innerHTML = `<tr><td colspan="4" class="muted">メンバーがいません。追加してください。</td></tr>`;
      return;
    }
    membersTbody.innerHTML = state.members
      .map((m, i) => {
        const contact = m.contact ? m.contact.replace(/&/g, '&amp;').replace(/</g, '&lt;') : '';
        const name = m.name.replace(/&/g, '&amp;').replace(/</g, '&lt;');
        return `<tr>
          <td>${i + 1}</td>
          <td>${name}</td>
          <td>${contact}</td>
          <td>
            <button data-action="edit" data-id="${m.id}" class="secondary">編集</button>
            <button data-action="delete" data-id="${m.id}" class="danger">削除</button>
          </td>
        </tr>`;
      })
      .join('');
  };

  membersTbody?.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const id = btn.dataset.id;
    const action = btn.dataset.action;
    const m = state.members.find((x) => x.id === id);
    if (!m) return;
    if (action === 'edit') {
      memberId.value = m.id;
      memberName.value = m.name;
      memberContact.value = m.contact || '';
      memberName.focus();
    } else if (action === 'delete') {
      if (!confirm(`「${m.name}」を削除しますか？`)) return;
      state.members = state.members.filter((x) => x.id !== id);
      // Also remove payments entries for this member
      Object.values(state.payments).forEach((byMember) => { if (byMember) delete byMember[id]; });
      // Detach from expenses payer
      state.expenses.forEach((ex) => { if (ex.payerId === id) ex.payerId = ''; });
      save();
      renderMembers();
      renderPaymentsPanel();
      renderExpenses();
      renderSummary();
    }
  });

  // Periods CRUD
  formPeriod?.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = periodId.value.trim();
    const name = periodName.value.trim();
    const fee = Math.max(0, Number(periodFee.value || 0));
    if (!name) return;
    if (id) {
      const p = state.periods.find((x) => x.id === id);
      if (p) {
        p.name = name;
        p.fee = fee;
      }
    } else {
      state.periods.push({ id: genId(), name, fee });
    }
    save();
    formPeriod.reset();
    renderPeriods();
    refreshPaymentsSelect();
    renderPaymentsPanel();
    renderSummary();
  });

  $('#period-cancel')?.addEventListener('click', () => {
    periodId.value = '';
  });

  const renderPeriods = () => {
    if (!state.periods.length) {
      periodsTbody.innerHTML = `<tr><td colspan="4" class="muted">期間がありません。追加してください。</td></tr>`;
      return;
    }
    periodsTbody.innerHTML = state.periods
      .map((p, i) => {
        const name = p.name.replace(/&/g, '&amp;').replace(/</g, '&lt;');
        return `<tr>
          <td>${i + 1}</td>
          <td>${name}</td>
          <td>${p.fee.toLocaleString('ja-JP')}</td>
          <td>
            <button data-action="edit" data-id="${p.id}" class="secondary">編集</button>
            <button data-action="delete" data-id="${p.id}" class="danger">削除</button>
          </td>
        </tr>`;
      })
      .join('');
  };

  periodsTbody?.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const id = btn.dataset.id;
    const action = btn.dataset.action;
    const p = state.periods.find((x) => x.id === id);
    if (!p) return;
    if (action === 'edit') {
      periodId.value = p.id;
      periodName.value = p.name;
      periodFee.value = p.fee;
      periodName.focus();
    } else if (action === 'delete') {
      if (!confirm(`「${p.name}」を削除しますか？\n関連する支払い記録も削除されます。`)) return;
      state.periods = state.periods.filter((x) => x.id !== id);
      delete state.payments[id];
      save();
      renderPeriods();
      refreshPaymentsSelect();
      renderPaymentsPanel();
      renderSummary();
    }
  });

  const refreshPaymentsSelect = () => {
    if (!state.periods.length) {
      paymentsPeriodSelect.innerHTML = '<option value="">期間なし</option>';
      paymentsPeriodSelect.disabled = true;
      return;
    }
    paymentsPeriodSelect.disabled = false;
    const options = state.periods.map((p) => `<option value="${p.id}">${p.name.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</option>`).join('');
    const prev = paymentsPeriodSelect.value;
    paymentsPeriodSelect.innerHTML = options;
    const exists = state.periods.some((p) => p.id === prev);
    paymentsPeriodSelect.value = exists ? prev : state.periods[0]?.id || '';
  };

  const getPeriodById = (id) => state.periods.find((p) => p.id === id);

  const getPayment = (periodId, memberId, create = false) => {
    if (!state.payments[periodId]) {
      if (!create) return undefined;
      state.payments[periodId] = {};
    }
    const byMember = state.payments[periodId];
    if (!byMember[memberId] && create) {
      byMember[memberId] = { paid: false, amount: 0, date: '', note: '' };
    }
    return byMember[memberId];
  };

  const renderPaymentsPanel = () => {
    refreshPaymentsSelect();
    const pid = paymentsPeriodSelect.value;
    const period = getPeriodById(pid);
    if (!pid || !period) {
      paymentsTbody.innerHTML = `<tr><td colspan="6" class="muted">期間を追加し、選択してください。</td></tr>`;
      paymentsSummary.textContent = '';
      return;
    }
    if (!state.members.length) {
      paymentsTbody.innerHTML = `<tr><td colspan="6" class="muted">メンバーを追加してください。</td></tr>`;
      paymentsSummary.textContent = '';
      return;
    }

    const rows = state.members.map((m, i) => {
      const pay = getPayment(pid, m.id, true);
      const amount = pay.amount || (pay.paid ? period.fee : 0);
      return `<tr data-member-id="${m.id}">
        <td>${i + 1}</td>
        <td>${m.name.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</td>
        <td>
          <select data-field="paid">
            <option value="false" ${!pay.paid ? 'selected' : ''}>未払い</option>
            <option value="true" ${pay.paid ? 'selected' : ''}>支払い済み</option>
          </select>
        </td>
        <td><input type="number" data-field="amount" min="0" step="100" value="${amount}"></td>
        <td><input type="date" data-field="date" value="${pay.date || ''}"></td>
        <td><input type="text" data-field="note" placeholder="任意メモ" value="${(pay.note || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"></td>
      </tr>`;
    });
    paymentsTbody.innerHTML = rows.join('');
    updatePaymentsSummary();
  };

  const updatePaymentsSummary = () => {
    const pid = paymentsPeriodSelect.value;
    const period = getPeriodById(pid);
    if (!pid || !period || !state.members.length) {
      paymentsSummary.textContent = '';
      return;
    }
    let paidCount = 0;
    let totalPaid = 0;
    const totalDue = state.members.length * (period.fee || 0);
    state.members.forEach((m) => {
      const pay = getPayment(pid, m.id, false);
      if (pay?.paid) {
        paidCount += 1;
        totalPaid += Number(pay.amount || 0);
      }
    });
    const uncollected = Math.max(0, totalDue - totalPaid);
    paymentsSummary.textContent = `支払い済み ${paidCount}/${state.members.length} ｜ 受領額 ${yen.format(totalPaid)} / 請求額 ${yen.format(totalDue)} ｜ 未回収 ${yen.format(uncollected)}`;
  };

  paymentsTbody?.addEventListener('change', (e) => {
    const tr = e.target.closest('tr[data-member-id]');
    if (!tr) return;
    const memberId = tr.dataset.memberId;
    const pid = paymentsPeriodSelect.value;
    const period = getPeriodById(pid);
    if (!pid || !period) return;
    const field = e.target.dataset.field;
    const pay = getPayment(pid, memberId, true);
    if (!pay) return;

    if (field === 'paid') {
      pay.paid = String(e.target.value) === 'true';
      if (pay.paid) {
        if (!pay.amount || pay.amount === 0) pay.amount = period.fee || 0;
        if (!pay.date) pay.date = today();
      }
    } else if (field === 'amount') {
      const v = Math.max(0, Number(e.target.value || 0));
      pay.amount = v;
    } else if (field === 'date') {
      pay.date = e.target.value || '';
    } else if (field === 'note') {
      pay.note = e.target.value || '';
    }
    save();
    updatePaymentsSummary();
  });

  paymentsPeriodSelect?.addEventListener('change', () => {
    renderPaymentsPanel();
  });

  btnAllPaid?.addEventListener('click', () => {
    const pid = paymentsPeriodSelect.value;
    const period = getPeriodById(pid);
    if (!pid || !period) return;
    state.members.forEach((m) => {
      const pay = getPayment(pid, m.id, true);
      pay.paid = true;
      pay.amount = period.fee || 0;
      pay.date = pay.date || today();
    });
    save();
    renderPaymentsPanel();
  });

  btnAllUnpaid?.addEventListener('click', () => {
    const pid = paymentsPeriodSelect.value;
    const period = getPeriodById(pid);
    if (!pid || !period) return;
    state.members.forEach((m) => {
      const pay = getPayment(pid, m.id, true);
      pay.paid = false;
    });
    save();
    renderPaymentsPanel();
  });

  // Expenses CRUD
  const refreshExpensePayerOptions = () => {
    if (!expensePayer) return;
    const options = ['<option value="">未指定</option>']
      .concat(state.members.map((m) => `<option value="${m.id}">${m.name.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</option>`));
    const prev = expensePayer.value;
    expensePayer.innerHTML = options.join('');
    const exists = state.members.some((m) => m.id === prev);
    expensePayer.value = exists ? prev : '';
  };

  const renderExpenses = () => {
    refreshExpensePayerOptions();
    if (!state.expenses.length) {
      expensesTbody.innerHTML = '<tr><td colspan="7" class="muted">支出がありません。追加してください。</td></tr>';
      return;
    }
    const rows = state.expenses.map((ex, i) => {
      const payerName = state.members.find((m) => m.id === ex.payerId)?.name || '—';
      const cat = (ex.category || '').trim() || '未分類';
      return `<tr>
        <td>${i + 1}</td>
        <td>${ex.date || ''}</td>
        <td>${Number(ex.amount || 0).toLocaleString('ja-JP')}</td>
        <td><span class="badge">${cat.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</span></td>
        <td>${(ex.note || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')}</td>
        <td>${payerName.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</td>
        <td>
          <button class="secondary" data-expense-action="edit" data-id="${ex.id}">編集</button>
          <button class="danger" data-expense-action="delete" data-id="${ex.id}">削除</button>
        </td>
      </tr>`;
    });
    expensesTbody.innerHTML = rows.join('');
  };

  formExpense?.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = expenseId.value.trim();
    const ex = {
      date: expenseDate.value || '',
      amount: Math.max(0, Number(expenseAmount.value || 0)),
      category: (expenseCategory.value || '').trim(),
      note: (expenseNote.value || '').trim(),
      payerId: expensePayer.value || '',
    };
    if (!ex.date) ex.date = today();
    if (id) {
      const cur = state.expenses.find((x) => x.id === id);
      if (cur) Object.assign(cur, ex);
    } else {
      state.expenses.push({ id: genId(), ...ex });
    }
    save();
    formExpense.reset();
    expenseId.value = '';
    renderExpenses();
    renderSummary();
  });

  $('#expense-cancel')?.addEventListener('click', () => { expenseId.value = ''; });

  expensesTbody?.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-expense-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    const action = btn.dataset.expenseAction;
    const ex = state.expenses.find((x) => x.id === id);
    if (!ex) return;
    if (action === 'edit') {
      expenseId.value = ex.id;
      expenseDate.value = ex.date || '';
      expenseAmount.value = ex.amount || 0;
      expenseCategory.value = ex.category || '';
      expenseNote.value = ex.note || '';
      refreshExpensePayerOptions();
      expensePayer.value = ex.payerId || '';
      expenseDate.focus();
    } else if (action === 'delete') {
      if (!confirm('この支出を削除しますか？')) return;
      state.expenses = state.expenses.filter((x) => x.id !== id);
      save();
      renderExpenses();
      renderSummary();
    }
  });

  // Summary rendering
  const computePeriodStats = (period) => {
    const pid = period.id;
    let paidCount = 0;
    let totalPaid = 0;
    const totalDue = state.members.length * (period.fee || 0);
    state.members.forEach((m) => {
      const pay = getPayment(pid, m.id, false);
      if (pay?.paid) {
        paidCount += 1;
        totalPaid += Number(pay.amount || 0);
      }
    });
    return { paidCount, totalPaid, totalDue, uncollected: Math.max(0, totalDue - totalPaid) };
  };

  const computeGlobalTotals = () => {
    let income = 0;
    Object.values(state.payments).forEach((byMember) => {
      if (!byMember) return;
      Object.values(byMember).forEach((pay) => {
        if (pay && pay.paid) income += Number(pay.amount || 0);
      });
    });
    const expense = state.expenses.reduce((sum, ex) => sum + Number(ex.amount || 0), 0);
    return { income, expense, balance: income - expense };
  };

  const computeMonthlySummary = () => {
    const map = new Map(); // month -> { income, expense }
    // payments
    Object.values(state.payments).forEach((byMember) => {
      if (!byMember) return;
      Object.values(byMember).forEach((pay) => {
        if (pay && pay.paid && pay.date) {
          const month = String(pay.date).slice(0, 7);
          if (!map.has(month)) map.set(month, { income: 0, expense: 0 });
          map.get(month).income += Number(pay.amount || 0);
        }
      });
    });
    // expenses
    state.expenses.forEach((ex) => {
      if (!ex.date) return;
      const month = String(ex.date).slice(0, 7);
      if (!map.has(month)) map.set(month, { income: 0, expense: 0 });
      map.get(month).expense += Number(ex.amount || 0);
    });
    const arr = Array.from(map.entries()).map(([month, v]) => ({ month, income: v.income, expense: v.expense }));
    arr.sort((a, b) => (a.month < b.month ? -1 : a.month > b.month ? 1 : 0));
    return arr;
  };

  const computePayerSummary = () => {
    const byId = new Map();
    state.expenses.forEach((ex) => {
      const id = ex.payerId || '';
      byId.set(id, (byId.get(id) || 0) + Number(ex.amount || 0));
    });
    const rows = Array.from(byId.entries()).map(([id, amount]) => ({
      name: state.members.find((m) => m.id === id)?.name || (id ? '(不明)' : '—'),
      amount,
    }));
    rows.sort((a, b) => b.amount - a.amount);
    return rows;
  };

  const computeCategorySummary = () => {
    const byCat = new Map(); // name -> { count, sum }
    state.expenses.forEach((ex) => {
      const name = ((ex.category || '').trim() || '未分類');
      const entry = byCat.get(name) || { count: 0, sum: 0 };
      entry.count += 1;
      entry.sum += Number(ex.amount || 0);
      byCat.set(name, entry);
    });
    const rows = Array.from(byCat.entries()).map(([name, v]) => ({ name, count: v.count, sum: v.sum }));
    rows.sort((a, b) => b.sum - a.sum);
    return rows;
  };

  const renderSummary = () => {
    // Totals cards
    const totals = computeGlobalTotals();
    summaryTotals.innerHTML = `
      <div class="card"><div class="muted">総収入</div><div style="margin-top:6px; font-size:18px;">${yen.format(totals.income)}</div></div>
      <div class="card"><div class="muted">総支出</div><div style="margin-top:6px; font-size:18px;">${yen.format(totals.expense)}</div></div>
      <div class="card"><div class="muted">現在残高</div><div style="margin-top:6px; font-size:18px;">${yen.format(totals.balance)}</div></div>
    `;

    // Period cards
    if (!state.periods.length) {
      summaryPeriods.innerHTML = '<div class="muted">期間がありません。</div>';
    } else {
      summaryPeriods.innerHTML = state.periods
        .map((p) => {
          const s = computePeriodStats(p);
          return `<div class="card">
            <div class="muted">${p.name.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</div>
            <div style="margin-top:6px;">
              <div>支払い済み: ${s.paidCount}/${state.members.length}</div>
              <div>受領額: ${yen.format(s.totalPaid)}</div>
              <div>請求額: ${yen.format(s.totalDue)}</div>
              <div>未回収: ${yen.format(s.uncollected)}</div>
            </div>
          </div>`;
        })
        .join('');
    }

    // Monthly summary
    const monthly = computeMonthlySummary();
    if (monthly.length === 0) {
      summaryMonthly.innerHTML = '<tr><td colspan="4" class="muted">データがありません。</td></tr>';
    } else {
      summaryMonthly.innerHTML = monthly
        .map((m) => `<tr><td>${m.month}</td><td>${m.income.toLocaleString('ja-JP')}</td><td>${m.expense.toLocaleString('ja-JP')}</td><td>${(m.income - m.expense).toLocaleString('ja-JP')}</td></tr>`)
        .join('');
    }

    // Categories summary
    const cats = computeCategorySummary();
    if (cats.length === 0) {
      summaryCategories.innerHTML = '<tr><td colspan="3" class="muted">データがありません。</td></tr>';
    } else {
      summaryCategories.innerHTML = cats
        .map((c) => `<tr><td>${c.name.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</td><td>${c.count}</td><td>${c.sum.toLocaleString('ja-JP')}</td></tr>`)
        .join('');
    }

    // Payers summary
    const payers = computePayerSummary();
    if (payers.length === 0) {
      summaryPayers.innerHTML = '<tr><td colspan="3" class="muted">データがありません。</td></tr>';
    } else {
      summaryPayers.innerHTML = payers
        .map((p, i) => `<tr><td>${i + 1}</td><td>${p.name.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</td><td>${p.amount.toLocaleString('ja-JP')}</td></tr>`)
        .join('');
    }

    // Members table
    if (!state.members.length) {
      summaryMembers.innerHTML = '<tr><td colspan="5" class="muted">メンバーがいません。</td></tr>';
      return;
    }
    const rows = state.members.map((m, i) => {
      let paidCount = 0;
      let totalPaid = 0;
      let totalUnpaid = 0;
      state.periods.forEach((p) => {
        const pay = getPayment(p.id, m.id, false);
        if (pay?.paid) {
          paidCount += 1;
          totalPaid += Number(pay.amount || 0);
        } else {
          totalUnpaid += (p.fee || 0);
        }
      });
      return `<tr>
        <td>${i + 1}</td>
        <td>${m.name.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</td>
        <td>${paidCount}/${state.periods.length}</td>
        <td>${totalPaid.toLocaleString('ja-JP')}</td>
        <td>${totalUnpaid.toLocaleString('ja-JP')}</td>
      </tr>`;
    });
    summaryMembers.innerHTML = rows.join('');
  };

  // Export / Import
  btnExport?.addEventListener('click', () => {
    const data = JSON.stringify(state, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const a = document.createElement('a');
    const ts = new Date();
    const name = `club-dues-${ts.getFullYear()}${String(ts.getMonth()+1).padStart(2,'0')}${String(ts.getDate()).padStart(2,'0')}-${String(ts.getHours()).padStart(2,'0')}${String(ts.getMinutes()).padStart(2,'0')}.json`;
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(a.href);
    a.remove();
  });

  fileImport?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data || !Array.isArray(data.members) || !Array.isArray(data.periods) || typeof data.payments !== 'object') {
        alert('インポート失敗: フォーマットが不正です。');
        return;
      }
      if (!confirm('現在のデータを置き換えます。よろしいですか？')) return;
      state.members = data.members;
      state.periods = data.periods;
      state.payments = data.payments || {};
      state.expenses = Array.isArray(data.expenses) ? data.expenses : [];
      save();
      // rerender all
      renderMembers();
      renderPeriods();
      refreshPaymentsSelect();
      renderPaymentsPanel();
      renderExpenses();
      renderSummary();
      fileImport.value = '';
    } catch (err) {
      console.error(err);
      alert('インポート中にエラーが発生しました。');
    }
  });

  // Initial render
  if (expenseDate) expenseDate.value = today();
  renderMembers();
  renderPeriods();
  refreshPaymentsSelect();
  renderPaymentsPanel();
  renderExpenses();
  renderSummary();
})();
