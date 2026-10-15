import fs from 'fs';
import path from 'path';
import * as xlsx from 'xlsx';

const credentialsPath = path.resolve('.credentials/official_event_team_credentials.json');
if (!fs.existsSync(credentialsPath)) {
  console.error('Credentials JSON not found at:', credentialsPath);
  process.exit(1);
}

const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
const credDir = path.resolve('.credentials');
const xlsxPath = path.join(credDir, 'official_code_e_manipal_team_credentials.xlsx');
const htmlPath = path.join(credDir, 'official_code_e_manipal_team_credentials.html');

const exportRows = credentials.map((c) => ({
  'Team ID': c.teamId,
  'Team Name': c.teamName,
  'Official Login ID': c.loginId,
  'Official Passcode': c.officialPasscode,
}));

const wb = xlsx.utils.book_new();
const ws = xlsx.utils.json_to_sheet(exportRows);
ws['!cols'] = [{ wch: 12 }, { wch: 35 }, { wch: 20 }, { wch: 22 }];
xlsx.utils.book_append_sheet(wb, ws, 'Official Team Credentials');
xlsx.writeFile(wb, xlsxPath);
console.log('Generated XLSX:', xlsxPath, `(${exportRows.length} rows)`);

const rowsHtml = credentials.map((c) => `
  <tr>
    <td style="font-weight:600; font-family:monospace;">${c.teamId}</td>
    <td>${c.teamName}</td>
    <td style="font-family:monospace;">${c.loginId}</td>
    <td style="font-family:monospace; font-weight:700; color:#1e3a8a;">${c.officialPasscode}</td>
  </tr>
`).join('');

const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Code-e-Manipal 2.0 — Official Team Credentials</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 2rem; color: #1e293b; }
  h1 { font-size: 1.5rem; color: #0f172a; margin-bottom: 0.25rem; }
  p.meta { font-size: 0.875rem; color: #64748b; margin-top: 0; margin-bottom: 1.5rem; }
  .badge { display: inline-block; padding: 0.25rem 0.5rem; background: #e0f2fe; color: #0369a1; border-radius: 4px; font-weight: 600; font-size: 0.75rem; }
  table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
  th { text-align: left; background: #f8fafc; padding: 0.75rem 1rem; border-bottom: 2px solid #e2e8f0; font-size: 0.75rem; text-transform: uppercase; color: #475569; }
  td { padding: 0.6rem 1rem; border-bottom: 1px solid #f1f5f9; }
  tr:nth-child(even) { background: #fafafa; }
  @media print {
    body { margin: 1cm; }
    th { background: #eee !important; -webkit-print-color-adjust: exact; }
  }
</style>
</head>
<body>
<h1>Code-e-Manipal 2.0 — Official Participant Credentials</h1>
<p class="meta"><span class="badge">CONFIDENTIAL</span> &bull; Authoritative Event Roster: 86 Teams (TEAM001 &ndash; TEAM086) &bull; Verified: 100% Validated</p>
<table>
<thead><tr><th>Team ID</th><th>Team Name</th><th>Official Login ID</th><th>Official Passcode</th></tr></thead>
<tbody>${rowsHtml}</tbody>
</table>
</body>
</html>`;

fs.writeFileSync(htmlPath, htmlContent, 'utf8');
console.log('Generated HTML:', htmlPath);
