import fs from 'fs';
import path from 'path';
import * as xlsx from 'xlsx';

const xlsxPath = 'C:\\Users\\SOHAM\\Downloads\\code_e_manipal_team_credentials_alphanumeric.xlsx';
const csvPath = 'C:\\Users\\SOHAM\\Downloads\\code_e_manipal_team_leader_logins_alphanumeric.csv';

console.log('--- Validating Official Roster ---');

if (!fs.existsSync(xlsxPath)) {
  console.error('XLSX not found at:', xlsxPath);
  process.exit(1);
}

const buf = fs.readFileSync(xlsxPath);
const wb = xlsx.read(buf, { type: 'buffer' });
const rows = xlsx.utils.sheet_to_json(wb.Sheets['Team Credentials']);

console.log(`Loaded ${rows.length} rows from XLSX.`);

if (rows.length !== 86) {
  console.error(`ERROR: Expected 86 rows, found ${rows.length}`);
  process.exit(1);
}

const teamIds = [];
const loginIds = [];
const teamNames = [];
const contactEmails = [];
const emailIssues = [];

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

for (let i = 0; i < rows.length; i++) {
  const r = rows[i];
  const expectedNum = String(i + 1).padStart(3, '0');
  const expectedTeamId = `TEAM${expectedNum}`;
  
  const teamId = String(r['Team ID'] || '').trim();
  const loginId = String(r['Login ID'] || '').trim();
  const teamName = String(r['Team Name'] || '').trim();
  const contactName = String(r['Primary Contact (verify team leader)'] || '').trim();
  const email = String(r['Contact Email'] || '').trim();

  if (teamId !== expectedTeamId) {
    console.error(`Row ${i + 1}: Team ID mismatch! Expected ${expectedTeamId}, got ${teamId}`);
  }
  if (loginId !== expectedTeamId) {
    console.error(`Row ${i + 1}: Login ID mismatch! Expected ${expectedTeamId}, got ${loginId}`);
  }
  if (!teamName) {
    console.error(`Row ${i + 1}: Missing team name!`);
  }
  if (!contactName) {
    console.error(`Row ${i + 1}: Missing contact name!`);
  }
  if (!email || !emailRegex.test(email)) {
    emailIssues.push({ index: i + 1, teamId, teamName, email });
  }

  teamIds.push(teamId);
  loginIds.push(loginId);
  teamNames.push(teamName);
  contactEmails.push(email.toLowerCase());
}

const uniqueTeamIds = new Set(teamIds);
const uniqueLoginIds = new Set(loginIds);
const uniqueEmails = new Set(contactEmails);

console.log(`Validation Results:`);
console.log(`- Total Teams: ${rows.length}`);
console.log(`- Unique Team IDs: ${uniqueTeamIds.size} / 86`);
console.log(`- Unique Login IDs: ${uniqueLoginIds.size} / 86`);
console.log(`- Unique Contact Emails: ${uniqueEmails.size} / 86`);
console.log(`- Sequence: TEAM001 through TEAM086 contiguous: ${teamIds[0] === 'TEAM001' && teamIds[85] === 'TEAM086'}`);

if (emailIssues.length > 0) {
  console.log(`- Malformed/Missing Emails (${emailIssues.length}):`, emailIssues);
} else {
  console.log(`- Malformed/Missing Emails: 0`);
}

// Check duplicate emails
const emailCounts = {};
for (const e of contactEmails) {
  emailCounts[e] = (emailCounts[e] || 0) + 1;
}
const duplicateEmails = Object.entries(emailCounts).filter(([_, c]) => c > 1);
if (duplicateEmails.length > 0) {
  console.log(`- Duplicate Contact Emails (${duplicateEmails.length}):`);
  for (const [e, count] of duplicateEmails) {
    const matchingTeams = rows.filter(r => String(r['Contact Email'] || '').trim().toLowerCase() === e).map(r => r['Team ID']);
    console.log(`  - ${e} used by ${count} teams: ${matchingTeams.join(', ')}`);
  }
} else {
  console.log(`- Duplicate Contact Emails: 0 (all unique)`);
}

// Compare with CSV if exists
if (fs.existsSync(csvPath)) {
  const csvContent = fs.readFileSync(csvPath, 'utf8');
  const lines = csvContent.split('\n').map(l => l.trim()).filter(Boolean);
  console.log(`CSV lines: ${lines.length} (including header)`);
}
