KEWA TRADE TRACKER — PHONE / Acode SETUP

FILES
- index.html
- style.css
- script.js

RUN
1. Extract this ZIP into a folder.
2. Open index.html in Acode preview or your browser.
3. Keep all three files in the same folder.
4. If you already have old data in the original deployed website, open that same website/origin and use Backup & Recovery > Scan LocalStorage. If the old data belongs to a different domain/browser profile, export it from the old site first.
5. Before replacing an existing project, copy your old files and export any available backup.

BACKUP
- Backup & Recovery > Download JSON Backup: full data backup.
- Choose Backup File: import JSON. Merge adds imported trades and removes duplicate IDs; Replace replaces current trades after confirmation.
- Download CSV: export rows.
- Print / Save PDF: allow popups if asked, then choose Save as PDF in the print dialog.

IMPORTANT
- Browser LocalStorage is local to a website origin and browser profile. A different domain cannot directly read the old domain's data.
- If browser/site data was cleared and there is no backup, the app cannot reconstruct the deleted records.
- P&L formula: (exit-entry)*size for Long, (entry-exit)*size for Short, minus brokerage. This is a simple manual journal calculation; instruments with contract multipliers, leverage, currency conversion, or other fees may need custom logic.
- Google Fonts are used when internet is available; system fonts are fallback.
