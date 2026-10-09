(function () {
  "use strict";

  /* ---------------- constants ---------------- */
  var EXPENSE_CATS = ["Housing","Food","Transportation","Utilities","Healthcare","Entertainment","Shopping","Debt","Other"];
  var INCOME_CATS = ["Salary","Freelance","Investments","Gifts","Other"];
  var PALETTE = ["#2F5D3A","#A8763B","#A0432D","#3B6E8F","#7A5C3E","#6B4C7A","#4C7A6B","#8F6A3B","#5C5C5C","#3F6B4C"];
  var MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

  /* ---------------- account (per-user storage) ---------------- */
  var currentUser = null;
  var STORAGE_KEY = "ledgerBudgetPlanner_v1_guest";

  function initUser() {
    currentUser = (window.Auth && Auth.getCurrentUser()) || null;
    if (!currentUser) {
      // Safety net — index.html's head script should already have redirected.
      window.location.replace("login.html");
      return false;
    }
    STORAGE_KEY = "ledgerBudgetPlanner_v1_" + currentUser.username;
    document.getElementById("accountName").textContent = currentUser.displayName;
    return true;
  }

  /* ---------------- state ---------------- */
  var state = {
    transactions: [],
    budgets: {},
    goal: { amount: 0, date: "" },
    settings: { currency: "₹", theme: "auto" }
  };
  var selectedMonth = monthKeyOf(new Date());
  var currentType = "expense";
  var activeView = "overview";

  /* ---------------- storage ---------------- */
  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        state.transactions = Array.isArray(parsed.transactions) ? parsed.transactions : [];
        state.budgets = parsed.budgets || {};
        state.goal = parsed.goal || { amount: 0, date: "" };
        state.settings = Object.assign({ currency: "$", theme: "auto" }, parsed.settings || {});
      } else {
        seedSampleData();
      }
    } catch (e) {
      console.error("Storage load failed", e);
      seedSampleData();
    }
  }
  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error("Storage save failed", e);
    }
  }
  function seedSampleData() {
    var now = new Date();
    var y = now.getFullYear(), m = now.getMonth();
    function d(day) { var mm = String(m + 1).padStart(2, "0"); var dd = String(day).padStart(2, "0"); return y + "-" + mm + "-" + dd; }
    state.transactions = [
      { id: uid(), type: "income", category: "Salary", amount: 45000, date: d(1), note: "Monthly pay" },
      { id: uid(), type: "expense", category: "Housing", amount: 15000, date: d(2), note: "Rent" },
      { id: uid(), type: "expense", category: "Food", amount: 6000, date: d(5), note: "Groceries" },
      { id: uid(), type: "expense", category: "Transportation", amount: 2200, date: d(6), note: "Fuel & metro" },
      { id: uid(), type: "expense", category: "Entertainment", amount: 1500, date: d(10), note: "Movies" },
      { id: uid(), type: "expense", category: "Utilities", amount: 3200, date: d(12), note: "Electricity & wifi" },
      { id: uid(), type: "expense", category: "Shopping", amount: 2800, date: d(15), note: "Clothes" }
    ];
    state.budgets = { Housing: 16000, Food: 7000, Transportation: 3000, Utilities: 3500, Entertainment: 2000, Healthcare: 2000, Shopping: 3000, Debt: 0, Other: 2000 };
    state.goal = { amount: 10000, date: d(28) };
  }

  function uid() { return "t" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  /* ---------------- helpers ---------------- */
  function monthKeyOf(dateObj) { return dateObj.getFullYear() + "-" + String(dateObj.getMonth() + 1).padStart(2, "0"); }
  function monthKeyOfStr(dateStr) { return dateStr.slice(0, 7); }
  function fmt(n) {
    var sym = state.settings.currency || "₹";
    var rounded = Math.round((n + Number.EPSILON) * 100) / 100;
    var parts = Math.abs(rounded).toFixed(2).split(".");
    parts[0] = sym === "₹" ? groupIndian(parts[0]) : groupWestern(parts[0]);
    return (rounded < 0 ? "-" : "") + sym + parts[0] + "." + parts[1];
  }
  // Indian numbering: last 3 digits together, then groups of 2 (e.g. 12,34,567)
  function groupIndian(s) {
    if (s.length <= 3) return s;
    var last3 = s.slice(-3);
    var rest = s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
    return rest + "," + last3;
  }
  // Western numbering: groups of 3 (e.g. 1,234,567)
  function groupWestern(s) { return s.replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function shiftMonth(key, delta) {
    var parts = key.split("-"); var y = parseInt(parts[0], 10); var m = parseInt(parts[1], 10) - 1;
    var d = new Date(y, m + delta, 1);
    return monthKeyOf(d);
  }
  function monthLabelOf(key) {
    var parts = key.split("-"); var y = parseInt(parts[0], 10); var m = parseInt(parts[1], 10) - 1;
    return MONTH_NAMES[m] + " " + y;
  }
  function txForMonth(key) { return state.transactions.filter(function (t) { return monthKeyOfStr(t.date) === key; }); }
  function totals(key) {
    var list = txForMonth(key);
    var income = 0, expense = 0;
    list.forEach(function (t) { if (t.type === "income") income += t.amount; else expense += t.amount; });
    return { income: income, expense: expense, net: income - expense };
  }
  function categoryTotals(key, type) {
    var list = txForMonth(key).filter(function (t) { return t.type === type; });
    var map = {};
    list.forEach(function (t) { map[t.category] = (map[t.category] || 0) + t.amount; });
    return map;
  }
  function colorFor(cat, list) {
    var idx = list.indexOf(cat);
    return PALETTE[idx % PALETTE.length];
  }

  /* ---------------- rendering: shell ---------------- */
  function setView(view) {
    activeView = view;
    document.querySelectorAll("section.view").forEach(function (s) { s.classList.remove("active"); });
    document.getElementById("view-" + view).classList.add("active");
    document.querySelectorAll("#navTabs button, #navTabsMobile button").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-view") === view);
    });
    var titles = {
      overview: ["Overview", "Where your money went, at a glance."],
      transactions: ["Transactions", "Log income and expenses as they happen."],
      budgets: ["Categories & budgets", "Set caps to catch overspending before it happens."],
      goals: ["Savings goal", "Track progress toward what you're setting aside."],
      reports: ["Reports", "A written summary and full category breakdown."]
    };
    document.getElementById("viewTitle").textContent = titles[view][0];
    document.getElementById("viewSub").textContent = titles[view][1];
    renderAll();
  }

  function renderMonthLabel() {
    document.getElementById("monthLabel").textContent = monthLabelOf(selectedMonth);
  }

  /* ---------------- alerts ---------------- */
  function renderAlerts() {
    var banner = document.getElementById("alertBanner");
    banner.innerHTML = "";
    var spent = categoryTotals(selectedMonth, "expense");
    var over = [];
    Object.keys(state.budgets).forEach(function (cat) {
      var cap = state.budgets[cat];
      if (cap && spent[cat] && spent[cat] > cap) {
        over.push({ cat: cat, over: spent[cat] - cap, spent: spent[cat], cap: cap });
      }
    });
    var t = totals(selectedMonth);
    if (t.expense > t.income && t.income > 0) {
      var div = document.createElement("div");
      div.className = "alert";
      div.innerHTML = '<span class="dot"></span><span>Spending has passed income in <b>' + monthLabelOf(selectedMonth) + '</b> by ' + fmt(t.expense - t.income) + '.</span>';
      banner.appendChild(div);
    }
    over.sort(function (a, b) { return b.over - a.over; });
    over.forEach(function (o) {
      var div = document.createElement("div");
      div.className = "alert";
      div.innerHTML = '<span class="dot"></span><span><strong>' + o.cat + '</strong> is over budget: ' + fmt(o.spent) + ' spent against a ' + fmt(o.cap) + ' cap (' + fmt(o.over) + ' over).</span>';
      banner.appendChild(div);
    });
  }

  /* ---------------- overview ---------------- */
  function renderOverview() {
    var t = totals(selectedMonth);
    document.getElementById("statIncome").textContent = fmt(t.income);
    document.getElementById("statExpense").textContent = fmt(t.expense);
    var netEl = document.getElementById("statNet");
    netEl.textContent = fmt(t.net);
    netEl.className = "value mono " + (t.net >= 0 ? "emerald" : "rust");
    var pct = t.income > 0 ? Math.round((t.net / t.income) * 100) : 0;
    document.getElementById("statNetPct").textContent = t.income > 0 ? pct + "% of income" : "no income logged";

    var goal = state.goal.amount || 0;
    var goalPct = goal > 0 ? Math.min(100, Math.round((Math.max(0, t.net) / goal) * 100)) : 0;
    document.getElementById("statGoal").textContent = goal > 0 ? goalPct + "%" : "—";
    document.getElementById("statGoalNote").textContent = goal > 0 ? fmt(Math.max(0, t.net)) + " of " + fmt(goal) : "no goal set";

    renderDonut();
    renderRecentLedger();
    renderTrendChart();
  }

  function renderDonut() {
    var svg = document.getElementById("donutChart");
    var legend = document.getElementById("donutLegend");
    var data = categoryTotals(selectedMonth, "expense");
    var cats = Object.keys(data);
    var total = cats.reduce(function (s, c) { return s + data[c]; }, 0);
    svg.innerHTML = "";
    legend.innerHTML = "";

    var cx = 90, cy = 90, r = 70, ir = 44;
    if (total <= 0) {
      var bg = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      bg.setAttribute("cx", cx); bg.setAttribute("cy", cy); bg.setAttribute("r", (r + ir) / 2);
      bg.setAttribute("fill", "none"); bg.setAttribute("stroke", "var(--line)");
      bg.setAttribute("stroke-width", r - ir);
      svg.appendChild(bg);
      legend.innerHTML = '<div class="empty-note">No expenses logged this month yet.</div>';
      return;
    }
    var sortedCats = cats.sort(function (a, b) { return data[b] - data[a]; });
    var start = -Math.PI / 2;
    sortedCats.forEach(function (cat) {
      var frac = data[cat] / total;
      var end = start + frac * Math.PI * 2;
      var path = describeDonutSlice(cx, cy, r, ir, start, end);
      var el = document.createElementNS("http://www.w3.org/2000/svg", "path");
      el.setAttribute("d", path);
      el.setAttribute("fill", colorFor(cat, sortedCats));
      svg.appendChild(el);
      start = end;

      var row = document.createElement("div");
      row.className = "legend-row";
      row.innerHTML = '<span class="sw" style="background:' + colorFor(cat, sortedCats) + '"></span><span>' + cat + '</span><span class="amt">' + fmt(data[cat]) + '</span>';
      legend.appendChild(row);
    });
    var label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("x", cx); label.setAttribute("y", cy - 3);
    label.setAttribute("text-anchor", "middle");
    label.setAttribute("font-family", "IBM Plex Mono, monospace");
    label.setAttribute("font-size", "13");
    label.setAttribute("fill", "var(--ink)");
    label.textContent = fmt(total);
    svg.appendChild(label);
    var label2 = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label2.setAttribute("x", cx); label2.setAttribute("y", cy + 13);
    label2.setAttribute("text-anchor", "middle");
    label2.setAttribute("font-family", "Inter, sans-serif");
    label2.setAttribute("font-size", "9.5");
    label2.setAttribute("fill", "var(--ink-soft)");
    label2.textContent = "total spent";
    svg.appendChild(label2);
  }

  function polar(cx, cy, r, angle) { return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)]; }
  function describeDonutSlice(cx, cy, r, ir, start, end) {
    var largeArc = end - start > Math.PI ? 1 : 0;
    var p1 = polar(cx, cy, r, start), p2 = polar(cx, cy, r, end);
    var p3 = polar(cx, cy, ir, end), p4 = polar(cx, cy, ir, start);
    return ["M", p1[0], p1[1], "A", r, r, 0, largeArc, 1, p2[0], p2[1], "L", p3[0], p3[1], "A", ir, ir, 0, largeArc, 0, p4[0], p4[1], "Z"].join(" ");
  }

  function renderRecentLedger() {
    var el = document.getElementById("recentLedger");
    var list = txForMonth(selectedMonth).slice().sort(function (a, b) { return b.date.localeCompare(a.date); }).slice(0, 6);
    el.innerHTML = "";
    if (!list.length) { el.innerHTML = '<div class="empty-note">Nothing logged for ' + monthLabelOf(selectedMonth) + ' yet.</div>'; return; }
    list.forEach(function (t) { el.appendChild(ledgerRow(t, false)); });
  }

  function ledgerRow(t, withDelete) {
    var row = document.createElement("div");
    row.className = "ledger-row";
    var cats = t.type === "income" ? INCOME_CATS : EXPENSE_CATS;
    var color = colorFor(t.category, cats);
    row.innerHTML =
      '<span class="swatch" style="background:' + color + '"></span>' +
      '<span class="desc">' + (t.note ? escapeHtml(t.note) : t.category) + ' <span class="cat">· ' + t.category + ' · ' + t.date + '</span></span>' +
      '<span class="leader"></span>' +
      '<span class="amt ' + t.type + '">' + (t.type === "income" ? "+" : "−") + fmt(t.amount) + '</span>';
    if (withDelete) {
      var del = document.createElement("button");
      del.className = "del"; del.type = "button"; del.textContent = "remove";
      del.addEventListener("click", function () {
        state.transactions = state.transactions.filter(function (x) { return x.id !== t.id; });
        save(); renderAll();
      });
      row.appendChild(del);
    }
    return row;
  }
  function escapeHtml(s) { var d = document.createElement("div"); d.textContent = s; return d.innerHTML; }

  function renderTrendChart() {
    var el = document.getElementById("trendChart");
    el.innerHTML = "";
    var months = [];
    for (var i = 5; i >= 0; i--) months.push(shiftMonth(selectedMonth, -i));
    var maxVal = 1;
    months.forEach(function (m) { var t = totals(m); maxVal = Math.max(maxVal, t.income, t.expense); });
    months.forEach(function (m) {
      var t = totals(m);
      var row = document.createElement("div");
      row.className = "bar-row";
      var incPct = (t.income / maxVal) * 100;
      var expPct = (t.expense / maxVal) * 100;
      row.innerHTML =
        '<span class="m-label">' + m.slice(5) + '/' + m.slice(2, 4) + '</span>' +
        '<div class="bar-track">' +
          '<div class="bg"><div class="fill" style="width:' + incPct + '%; background:var(--emerald);"></div></div>' +
          '<div class="bg"><div class="fill" style="width:' + expPct + '%; background:var(--rust);"></div></div>' +
        '</div>' +
        '<span style="font-family:\'IBM Plex Mono\',monospace; font-size:11px; color:var(--ink-soft); width:150px; text-align:right;">' + fmt(t.income) + ' / ' + fmt(t.expense) + '</span>';
      el.appendChild(row);
    });
  }

  /* ---------------- transactions view ---------------- */
  function populateCategorySelect() {
    var sel = document.getElementById("txCategory");
    var list = currentType === "income" ? INCOME_CATS : EXPENSE_CATS;
    sel.innerHTML = list.map(function (c) { return '<option value="' + c + '">' + c + '</option>'; }).join("");
  }

  function renderFullLedger() {
    var el = document.getElementById("fullLedger");
    var filter = document.getElementById("txFilter").value;
    var list = txForMonth(selectedMonth).slice().sort(function (a, b) { return b.date.localeCompare(a.date); });
    if (filter !== "all") list = list.filter(function (t) { return t.type === filter; });
    el.innerHTML = "";
    if (!list.length) { el.innerHTML = '<div class="empty-note">No matching entries for ' + monthLabelOf(selectedMonth) + '.</div>'; return; }
    list.forEach(function (t) { el.appendChild(ledgerRow(t, true)); });
  }

  /* ---------------- budgets view ---------------- */
  function renderBudgets() {
    var el = document.getElementById("budgetList");
    el.innerHTML = "";
    var spent = categoryTotals(selectedMonth, "expense");
    EXPENSE_CATS.forEach(function (cat) {
      var cap = state.budgets[cat] || 0;
      var used = spent[cat] || 0;
      var pct = cap > 0 ? Math.min(100, Math.round((used / cap) * 100)) : 0;
      var over = cap > 0 && used > cap;
      var row = document.createElement("div");
      row.className = "budget-row";
      row.innerHTML =
        '<div class="budget-top">' +
          '<span class="name"><span class="swatch" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + colorFor(cat, EXPENSE_CATS) + '"></span> ' + cat + '</span>' +
          '<span class="figures">' + fmt(used) + ' of <input class="cap" type="number" min="0" step="1" value="' + (cap || "") + '" placeholder="no cap" data-cat="' + cat + '"></span>' +
        '</div>' +
        '<div class="prog-track"><div class="prog-fill" style="width:' + pct + '%; background:' + (over ? "var(--rust)" : "var(--emerald)") + '"></div></div>';
      el.appendChild(row);
    });
    el.querySelectorAll("input.cap").forEach(function (input) {
      input.addEventListener("change", function () {
        var cat = input.getAttribute("data-cat");
        var val = parseFloat(input.value);
        state.budgets[cat] = isNaN(val) ? 0 : val;
        save(); renderAlerts(); renderBudgets();
      });
    });
  }

  /* ---------------- goals view ---------------- */
  function renderGoal() {
    var svg = document.getElementById("goalRing");
    svg.innerHTML = "";
    var t = totals(selectedMonth);
    var saved = Math.max(0, t.net);
    var goal = state.goal.amount || 0;
    var pct = goal > 0 ? Math.min(1, saved / goal) : 0;
    var cx = 75, cy = 75, r = 62;
    var bg = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    bg.setAttribute("cx", cx); bg.setAttribute("cy", cy); bg.setAttribute("r", r);
    bg.setAttribute("fill", "none"); bg.setAttribute("stroke", "var(--line)"); bg.setAttribute("stroke-width", "14");
    svg.appendChild(bg);
    if (pct > 0) {
      var circ = 2 * Math.PI * r;
      var fg = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      fg.setAttribute("cx", cx); fg.setAttribute("cy", cy); fg.setAttribute("r", r);
      fg.setAttribute("fill", "none");
      fg.setAttribute("stroke", pct >= 1 ? "var(--emerald)" : "var(--gold)");
      fg.setAttribute("stroke-width", "14");
      fg.setAttribute("stroke-linecap", "round");
      fg.setAttribute("stroke-dasharray", circ);
      fg.setAttribute("stroke-dashoffset", circ * (1 - pct));
      fg.setAttribute("transform", "rotate(-90 " + cx + " " + cy + ")");
      svg.appendChild(fg);
    }
    var txt = document.createElementNS("http://www.w3.org/2000/svg", "text");
    txt.setAttribute("x", cx); txt.setAttribute("y", cy + 6);
    txt.setAttribute("text-anchor", "middle");
    txt.setAttribute("font-family", "IBM Plex Mono, monospace");
    txt.setAttribute("font-size", "18");
    txt.setAttribute("fill", "var(--ink)");
    txt.textContent = goal > 0 ? Math.round(pct * 100) + "%" : "—";
    svg.appendChild(txt);

    document.getElementById("goalStatus").textContent = goal > 0 ? fmt(saved) + " saved of " + fmt(goal) : "No goal set yet";
    var detail = document.getElementById("goalDetail");
    if (goal > 0) {
      var remaining = Math.max(0, goal - saved);
      var dateNote = state.goal.date ? " by " + state.goal.date : "";
      detail.textContent = remaining > 0
        ? fmt(remaining) + " left to reach your goal" + dateNote + ", based on " + monthLabelOf(selectedMonth) + "'s net savings."
        : "Goal reached for " + monthLabelOf(selectedMonth) + " — nice work.";
    } else {
      detail.textContent = "Set a target below to start tracking progress against what you save each month.";
    }
    document.getElementById("goalAmount").value = state.goal.amount || "";
    document.getElementById("goalDate").value = state.goal.date || "";
  }

  /* ---------------- reports view ---------------- */
  function renderReports() {
    var t = totals(selectedMonth);
    var spent = categoryTotals(selectedMonth, "expense");
    var cats = Object.keys(spent);
    var topCat = cats.sort(function (a, b) { return spent[b] - spent[a]; })[0];
    var prevKey = shiftMonth(selectedMonth, -1);
    var prev = totals(prevKey);
    var deltaExpense = prev.expense > 0 ? Math.round(((t.expense - prev.expense) / prev.expense) * 100) : null;
    var txCount = txForMonth(selectedMonth).length;
    var savedPct = t.income > 0 ? Math.round((t.net / t.income) * 100) : null;

    var s = "In <b>" + monthLabelOf(selectedMonth) + "</b>, you logged <b>" + txCount + "</b> transaction" + (txCount === 1 ? "" : "s") + ", earning <b>" + fmt(t.income) + "</b> and spending <b>" + fmt(t.expense) + "</b>. ";
    if (topCat) {
      var topPct = t.expense > 0 ? Math.round((spent[topCat] / t.expense) * 100) : 0;
      s += "Your largest expense category was <b>" + topCat + "</b> at " + fmt(spent[topCat]) + " (" + topPct + "% of spending). ";
    }
    if (deltaExpense !== null) {
      s += "Spending was " + (deltaExpense >= 0 ? "up " + deltaExpense + "%" : "down " + Math.abs(deltaExpense) + "%") + " compared to " + monthLabelOf(prevKey) + ". ";
    }
    if (savedPct !== null) {
      s += "You " + (t.net >= 0 ? "saved " + fmt(t.net) + ", or " + savedPct + "% of income" : "spent " + fmt(Math.abs(t.net)) + " more than you earned") + ". ";
    }
    var goal = state.goal.amount || 0;
    if (goal > 0) {
      var pct = Math.min(100, Math.round((Math.max(0, t.net) / goal) * 100));
      s += "That puts you at " + pct + "% of your " + fmt(goal) + " savings goal.";
    }
    document.getElementById("summaryText").innerHTML = s;

    var tbody = document.querySelector("#reportTable tbody");
    tbody.innerHTML = "";
    var allCats = EXPENSE_CATS.slice().sort(function (a, b) { return (spent[b] || 0) - (spent[a] || 0); });
    allCats.forEach(function (cat) {
      var used = spent[cat] || 0;
      if (!used && !state.budgets[cat]) return;
      var cap = state.budgets[cat] || 0;
      var share = t.expense > 0 ? Math.round((used / t.expense) * 100) : 0;
      var tr = document.createElement("tr");
      tr.innerHTML = "<td>" + cat + "</td><td class='num'>" + fmt(used) + "</td><td class='num'>" + (cap ? fmt(cap) : "—") + "</td><td class='num'>" + share + "%</td>";
      tbody.appendChild(tr);
    });
    if (!tbody.children.length) {
      tbody.innerHTML = "<tr><td colspan='4' style='color:var(--ink-soft); padding:12px 8px;'>No spending recorded yet.</td></tr>";
    }
  }

  /* ---------------- full render ---------------- */
  function renderAll() {
    renderMonthLabel();
    renderAlerts();
    if (activeView === "overview") renderOverview();
    if (activeView === "transactions") { populateCategorySelect(); renderFullLedger(); }
    if (activeView === "budgets") renderBudgets();
    if (activeView === "goals") renderGoal();
    if (activeView === "reports") renderReports();
  }

  /* ---------------- events ---------------- */
  document.getElementById("navTabs").addEventListener("click", function (e) {
    var btn = e.target.closest("button"); if (!btn) return; setView(btn.getAttribute("data-view"));
  });
  document.getElementById("navTabsMobile").addEventListener("click", function (e) {
    var btn = e.target.closest("button"); if (!btn) return; setView(btn.getAttribute("data-view"));
  });
  document.getElementById("prevMonth").addEventListener("click", function () { selectedMonth = shiftMonth(selectedMonth, -1); renderAll(); });
  document.getElementById("nextMonth").addEventListener("click", function () { selectedMonth = shiftMonth(selectedMonth, 1); renderAll(); });

  document.getElementById("typeSwitch").addEventListener("click", function (e) {
    var btn = e.target.closest("button"); if (!btn) return;
    currentType = btn.getAttribute("data-type");
    document.querySelectorAll("#typeSwitch button").forEach(function (b) { b.classList.remove("active"); });
    btn.classList.add("active");
    populateCategorySelect();
  });

  document.getElementById("txForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var amount = parseFloat(document.getElementById("txAmount").value);
    if (isNaN(amount) || amount <= 0) return;
    var t = {
      id: uid(),
      type: currentType,
      category: document.getElementById("txCategory").value,
      amount: amount,
      date: document.getElementById("txDate").value || new Date().toISOString().slice(0, 10),
      note: document.getElementById("txNote").value.trim()
    };
    state.transactions.push(t);
    save();
    selectedMonth = monthKeyOfStr(t.date);
    document.getElementById("txForm").reset();
    document.getElementById("txDate").value = "";
    populateCategorySelect();
    renderAll();
  });

  document.getElementById("txFilter").addEventListener("change", renderFullLedger);

  document.getElementById("saveGoal").addEventListener("click", function () {
    var amount = parseFloat(document.getElementById("goalAmount").value);
    state.goal.amount = isNaN(amount) ? 0 : amount;
    state.goal.date = document.getElementById("goalDate").value || "";
    save(); renderAll();
  });

  document.getElementById("currencySelect").addEventListener("change", function (e) {
    state.settings.currency = e.target.value; save(); renderAll();
  });

  var THEME_STATES = ["auto", "light", "dark"];
  document.getElementById("themeToggle").addEventListener("click", function () {
    var idx = THEME_STATES.indexOf(state.settings.theme || "auto");
    var next = THEME_STATES[(idx + 1) % THEME_STATES.length];
    state.settings.theme = next;
    applyTheme();
    save();
  });
  function applyTheme() {
    var mode = state.settings.theme || "auto";
    if (mode === "auto") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", mode);
    document.getElementById("themeToggle").textContent = mode.charAt(0).toUpperCase() + mode.slice(1);
  }

  document.getElementById("resetData").addEventListener("click", function () {
    if (!confirm("Clear all budget planner data stored in this browser? This cannot be undone.")) return;
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
    state = { transactions: [], budgets: {}, goal: { amount: 0, date: "" }, settings: state.settings };
    seedSampleData();
    save();
    renderAll();
  });

  document.getElementById("logoutBtn").addEventListener("click", function () {
    if (window.Auth) Auth.logout();
    window.location.href = "login.html";
  });

  /* ---------------- init ---------------- */
  if (initUser()) {
    load();
    applyTheme();
    document.getElementById("currencySelect").value = state.settings.currency || "₹";
    document.getElementById("txDate").valueAsDate = new Date();
    populateCategorySelect();
    setView("overview");
  }
})();
