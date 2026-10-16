import fs from 'fs';
import path from 'path';
import * as xlsx from 'xlsx';

const handoffPath = path.resolve('.credentials/judge_credentials_handoff.json');
if (!fs.existsSync(handoffPath)) {
  console.error('Judge credentials handoff JSON not found at:', handoffPath);
  process.exit(1);
}

const handoffData = JSON.parse(fs.readFileSync(handoffPath, 'utf8'));
const judges = handoffData.judges;

const credDir = path.resolve('.credentials');
const xlsxPath = path.join(credDir, 'official_code_e_manipal_judge_credentials.xlsx');
const htmlPath = path.join(credDir, 'official_code_e_manipal_judge_credentials.html');

// Artifact directory
const artifactDir = 'C:\\Users\\SOHAM\\.gemini\\antigravity-ide\\brain\\a7dde7aa-305a-4868-b5c8-d720a23dd118';
const artifactXlsx = path.join(artifactDir, 'official_code_e_manipal_judge_credentials.xlsx');
const artifactHtml = path.join(artifactDir, 'official_code_e_manipal_judge_credentials.html');

const exportRows = judges.map(j => ({
  'Slot': j.slot,
  'Judge Name': j.displayName,
  'Login ID': j.loginId,
  'Designation': j.designation || (j.slot <= 2 ? 'PRIMARY' : 'BACKUP'),
  'Passcode (8-Digit)': j.initialPassword,
  'Badge / Canonical ID': j.canonicalIdentifier,
  'System Email': j.authEmail,
  'Role': j.role,
  'Account Status': j.accountStatus,
  'Assigned Rounds': Array.isArray(j.assignedRounds) ? j.assignedRounds.join(', ') : 'All Rounds',
}));

// Build Excel
const wb = xlsx.utils.book_new();
const ws = xlsx.utils.json_to_sheet(exportRows);
ws['!cols'] = [
  { wch: 8 },  // Slot
  { wch: 18 }, // Judge Name
  { wch: 14 }, // Login ID
  { wch: 14 }, // Designation
  { wch: 22 }, // Passcode
  { wch: 22 }, // Badge ID
  { wch: 34 }, // Email
  { wch: 10 }, // Role
  { wch: 22 }, // Status
  { wch: 26 }, // Rounds
];

xlsx.utils.book_append_sheet(wb, ws, 'Official Judge Credentials');
xlsx.writeFile(wb, xlsxPath);
console.log('Generated XLSX:', xlsxPath);

if (fs.existsSync(artifactDir)) {
  xlsx.writeFile(wb, artifactXlsx);
  console.log('Saved to Artifacts:', artifactXlsx);
}

// Build HTML preview
const rowsHtml = judges.map(j => {
  const isPrimary = (j.designation || (j.slot <= 2 ? 'PRIMARY' : 'BACKUP')) === 'PRIMARY';
  const desigBadge = isPrimary
    ? `<span style="display:inline-block; padding:0.25rem 0.6rem; background:#dbeafe; color:#1d4ed8; border-radius:4px; font-weight:700; font-size:0.75rem;">PRIMARY</span>`
    : `<span style="display:inline-block; padding:0.25rem 0.6rem; background:#fef3c7; color:#b45309; border-radius:4px; font-weight:700; font-size:0.75rem;">BACKUP</span>`;

  return `
  <tr>
    <td style="font-weight:700; text-align:center;">${j.slot}</td>
    <td style="font-weight:600;">${j.displayName}</td>
    <td style="font-family:monospace; font-weight:700; color:#0369a1;">${j.loginId}</td>
    <td style="text-align:center;">${desigBadge}</td>
    <td style="font-family:monospace; font-weight:700; color:#b45309; background:#fffbeb; letter-spacing:0.05em; padding: 0.4rem 0.8rem; border-radius: 4px; display:inline-block; margin: 0.2rem 0; border: 1px solid #fef08a;">${j.initialPassword}</td>
    <td style="font-family:monospace;">${j.canonicalIdentifier}</td>
    <td style="color:#475569;">${j.authEmail}</td>
    <td><span style="display:inline-block; padding:0.2rem 0.5rem; background:#ede9fe; color:#6d28d9; border-radius:4px; font-weight:600; font-size:0.75rem;">JUDGE</span></td>
    <td><span style="display:inline-block; padding:0.2rem 0.5rem; background:#dcfce7; color:#15803d; border-radius:4px; font-weight:600; font-size:0.75rem;">ACTIVE</span></td>
    <td>${Array.isArray(j.assignedRounds) ? j.assignedRounds.join(', ') : 'All Rounds'}</td>
  </tr>
  `;
}).join('');

const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Code-e-Manipal 2.0 — Official Judge Credentials (2 Primary + 3 Backup)</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 2rem; color: #1e293b; background: #fff; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #e2e8f0; padding-bottom: 1rem; margin-bottom: 1.5rem; }
  h1 { font-size: 1.5rem; color: #0f172a; margin: 0 0 0.25rem 0; }
  p.meta { font-size: 0.875rem; color: #64748b; margin: 0; }
  .badge { display: inline-block; padding: 0.35rem 0.75rem; background: #f1f5f9; color: #334155; border-radius: 6px; font-weight: 600; font-size: 0.8rem; border: 1px solid #cbd5e1; }
  .instructions { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1rem 1.25rem; margin-bottom: 1.5rem; font-size: 0.875rem; }
  .instructions h2 { font-size: 0.95rem; margin-top: 0; margin-bottom: 0.5rem; color: #0f172a; }
  .instructions ol { margin: 0; padding-left: 1.25rem; color: #334155; }
  .instructions li { margin-bottom: 0.25rem; }
  table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
  th { text-align: left; background: #f8fafc; padding: 0.75rem 1rem; border-bottom: 2px solid #cbd5e1; font-size: 0.75rem; text-transform: uppercase; color: #475569; letter-spacing: 0.05em; }
  td { padding: 0.6rem 1rem; border-bottom: 1px solid #e2e8f0; vertical-align: middle; }
  tr:hover { background: #f8fafc; }
  @media print {
    body { margin: 1cm; }
    .instructions { break-inside: avoid; }
    th { background: #eee !important; -webkit-print-color-adjust: exact; }
  }
</style>
</head>
<body>
<div class="header">
  <div>
    <h1>Code-e-Manipal 2.0 — Official Judge Credentials</h1>
    <p class="meta">Target: Production (ihnclawnbtkwvbfqwxfe / postgres) &bull; Total Operational Judges: 5 (2 Primary + 3 Backup) &bull; Updated: ${new Date().toISOString()}</p>
  </div>
  <div class="badge">RESTRICTED &bull; EVENT ORGANIZER USE ONLY</div>
</div>

<div class="instructions">
  <h2>Judge Login Instructions</h2>
  <ol>
    <li>Navigate to the official portal login: <a href="https://code-e-manipal-portal.vercel.app/login" style="color:#0284c7; font-weight:600;">https://code-e-manipal-portal.vercel.app/login</a>.</li>
    <li>In <strong>User ID / Email</strong>, enter the assigned <strong>Login ID</strong> (e.g. <code>judge1</code>, <code>judge2</code> ... <code>judge5</code>) or canonical badge ID (<code>JUDGE-02</code> ... <code>JUDGE-06</code>).</li>
    <li>In <strong>Password</strong>, enter the official 8-digit alphanumeric passcode.</li>
    <li>Upon logging in, the judge will be directed to the <code>/judge</code> evaluation workspace.</li>
    <li>Backup accounts should be used only when required. Keep all credentials strictly confidential.</li>
  </ol>
</div>

<table>
  <thead>
    <tr>
      <th style="text-align:center;">Slot</th>
      <th>Judge Name</th>
      <th>Login ID</th>
      <th style="text-align:center;">Designation</th>
      <th>8-Digit Passcode</th>
      <th>Badge ID</th>
      <th>System Email</th>
      <th>Role</th>
      <th>Status</th>
      <th>Assigned Rounds</th>
    </tr>
  </thead>
  <tbody>
    ${rowsHtml}
  </tbody>
</table>
</body>
</html>`;

fs.writeFileSync(htmlPath, htmlContent, 'utf8');
console.log('Generated HTML:', htmlPath);

if (fs.existsSync(artifactDir)) {
  fs.writeFileSync(artifactHtml, htmlContent, 'utf8');
  console.log('Saved to Artifacts:', artifactHtml);
}
