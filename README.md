# Ledger — Budget Planner

A budget planner with income/expense tracking, category budgets, overspending
alerts, a savings goal tracker, and spending charts. Amounts default to
**Indian Rupees (₹)** with Indian-style number grouping (e.g. `₹1,00,000`),
and you can switch to USD, EUR, GBP, or JPY from the sidebar.

## Files

```
budget-planner/
├── login.html   → sign-in page
├── signup.html  → create-account page
├── index.html   → the budget planner itself (requires sign-in)
├── auth.js      → shared sign-up / sign-in / session logic
├── style.css    → all styling (ledger/paper visual theme, light + dark mode)
├── script.js    → app logic (transactions, budgets, goals, charts, alerts)
└── README.md    → this file
```

## Accounts

Opening `index.html` without being signed in redirects you to `login.html`.
From there:

- **New user** → go to `signup.html`, enter a name, username/email, and
  password (6+ characters) to create an account. You're signed in
  automatically afterward.
- **Returning user** → sign in on `login.html`.
- **Log out** → use the "Log out" button near the top of the sidebar
  in the app.

Each account's transactions, budgets, and goal are stored separately, so
multiple people can use the same browser without seeing each other's
numbers.

**Please read before using a real password:** there is no server here.
Accounts, password hashes, and all budget data are stored entirely in this
browser's `localStorage`. That's fine for a personal or learning project on
your own device, but it is not secure authentication — anyone with access
to the browser (e.g. via dev tools) could read the stored data, and nothing
here is verified by a trusted third party. Use a throwaway password, not one
you use elsewhere. If you want real account security with a proper backend
(server-side password verification, hashing, sessions, and a database),
that's a different build — ask and I can put one together.

## Opening in VS Code

1. Unzip this folder if it isn't already.
2. In VS Code: **File → Open Folder…** and select the `budget-planner` folder.
3. Open `index.html`.
4. To view it, either:
   - Right-click `index.html` → **Open with Live Server** (install the free
     "Live Server" extension by Ritwick Dey for auto-reload while editing), or
   - Just double-click `index.html` in your file explorer to open it directly
     in a browser — no build step or server required.

## How data is stored

There's no external database — the app saves everything (accounts,
transactions, budgets, your savings goal, currency choice, theme) to your
browser's `localStorage`, scoped to wherever you open the file from. That
means:

- Your data persists across visits on the same browser/device.
- It does **not** sync across devices or browsers.
- Opening `index.html` via `file://` and via a local server (e.g. Live
  Server's `http://127.0.0.1:...`) are treated as different origins by the
  browser, so data saved under one won't show up under the other — pick one
  way of opening it and stick with it.

If you outgrow this and want multi-device sync, that needs a real backend
(e.g. Node/Express + a database) — happy to help build that as a next step.

## Customizing

- **Categories**: edit the `EXPENSE_CATS` / `INCOME_CATS` arrays near the top
  of `script.js`.
- **Colors**: edit the CSS custom properties at the top of `style.css`
  (`--emerald`, `--gold`, `--rust`, etc.) — light theme first, dark theme
  overrides below it.
- **Default currency**: change `currency: "₹"` in the `state.settings`
  object in `script.js`, and reorder the `<option>` list in `index.html`'s
  currency `<select>` if you want a different default selected.
- **Sample data**: the app seeds a few example transactions on first run
  (see `seedSampleData()` in `script.js`) so the charts aren't empty — delete
  that call if you'd rather start blank, or use the "Reset" button in the
  sidebar to clear everything and reseed.
