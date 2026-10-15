import fs from 'fs';

export function parseCSV(text) {
  // Strip UTF-8 BOM if present
  const clean = text.replace(/^\uFEFF/, '');
  const lines = clean.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const rows = [];
  for (const line of lines) {
    const row = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        row.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    row.push(current.trim());
    rows.push(row);
  }
  return rows;
}

export function normalizeRosterEmail(teamId, rawEmail) {
  const trimmed = (rawEmail || '').trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (emailRegex.test(trimmed)) {
    return { email: trimmed.toLowerCase(), normalized: false };
  }
  if (/^[a-zA-Z]+\.[0-9]+$/.test(trimmed)) {
    return {
      email: `${trimmed.toLowerCase()}@muj.manipal.edu`,
      normalized: true,
      reason: 'Appended @muj.manipal.edu domain to student registration ID',
    };
  }
  const numPart = teamId.replace(/^TEAM-?/i, '');
  return {
    email: `team-${numPart.padStart(3, '0').toLowerCase()}@auth.codeemanipal.in`,
    normalized: true,
    reason: 'Applied canonical identity mapping team-XXX@auth.codeemanipal.in',
  };
}

export function validateRoster(rows) {
  const header = rows[0];
  const expectedColumns = [
    'Team ID',
    'Team Name',
    'Login ID',
    'Temporary Passcode',
    'Primary Contact (verify team leader)',
    'Contact Email',
  ];

  const headerMatches = expectedColumns.every((col, idx) => header[idx] === col);
  if (!headerMatches) {
    throw new Error(`Unexpected CSV Header: ${JSON.stringify(header)}`);
  }

  const teams = [];
  const teamIdMap = new Map();
  const loginIdMap = new Map();
  const emailMap = new Map();
  const nameMap = new Map();

  const errors = [];
  const normalizedEmails = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const [teamId, teamName, loginId, passcode, leaderName, rawEmail] = row;

    if (!teamId || !teamName || !loginId || !passcode || !leaderName || !rawEmail) {
      errors.push(`Row ${i + 1}: Missing required fields.`);
      continue;
    }

    // Passcode validation: exactly 8 alphanumeric characters containing >= 1 letter and >= 1 digit
    const isAlphanumeric8 = /^[a-zA-Z0-9]{8}$/.test(passcode);
    const hasLetter = /[a-zA-Z]/.test(passcode);
    const hasDigit = /[0-9]/.test(passcode);

    if (!isAlphanumeric8 || !hasLetter || !hasDigit) {
      errors.push(`Row ${i + 1} (${teamId}): Passcode must be 8 alphanumeric chars with at least 1 letter and 1 digit.`);
    }

    const { email: normEmail, normalized, reason } = normalizeRosterEmail(teamId, rawEmail);
    if (normalized) {
      normalizedEmails.push({ teamId, original: rawEmail, normalizedEmail: normEmail, reason });
    }

    if (teamIdMap.has(teamId)) {
      errors.push(`Row ${i + 1}: Duplicate Team ID "${teamId}" (first seen in row ${teamIdMap.get(teamId)}).`);
    } else {
      teamIdMap.set(teamId, i + 1);
    }

    if (loginIdMap.has(loginId)) {
      errors.push(`Row ${i + 1}: Duplicate Login ID "${loginId}" (first seen in row ${loginIdMap.get(loginId)}).`);
    } else {
      loginIdMap.set(loginId, i + 1);
    }

    if (emailMap.has(normEmail)) {
      errors.push(`Row ${i + 1}: Duplicate Email "${normEmail}" (first seen in row ${emailMap.get(normEmail)}).`);
    } else {
      emailMap.set(normEmail, i + 1);
    }

    if (nameMap.has(teamName)) {
      nameMap.get(teamName).push(teamId);
    } else {
      nameMap.set(teamName, [teamId]);
    }

    teams.push({
      teamId,
      teamName,
      loginId,
      passcode,
      leaderName,
      email: normEmail,
      rawEmail,
    });
  }

  const duplicateNames = [];
  for (const [name, ids] of nameMap.entries()) {
    if (ids.length > 1) {
      duplicateNames.push({ name, ids });
    }
  }

  return {
    valid: errors.length === 0,
    totalTeams: teams.length,
    teams,
    errors,
    duplicateNames,
    normalizedEmails,
  };
}

if (process.argv[1] && process.argv[1].endsWith('validate-csv.mjs')) {
  const filePath = process.argv[2] || 'code_e_manipal_team_leader_logins_alphanumeric.csv';
  const content = fs.readFileSync(filePath, 'utf8');
  const rows = parseCSV(content);
  const result = validateRoster(rows);
  console.log('=== CSV VALIDATION REPORT ===');
  console.log(`File: ${filePath}`);
  console.log(`Total Rows (excluding header): ${result.totalTeams}`);
  console.log(`Valid: ${result.valid}`);
  console.log(`Errors: ${result.errors.length}`);
  if (result.errors.length > 0) {
    console.error('Validation Errors:');
    result.errors.forEach((e) => console.error(`  - ${e}`));
  }
  console.log(`Normalized Emails: ${result.normalizedEmails.length}`);
  if (result.normalizedEmails.length > 0) {
    console.log('Non-standard emails mapped to canonical identities:');
    result.normalizedEmails.forEach((n) =>
      console.log(`  - [${n.teamId}] "${n.original}" ➔ ${n.normalizedEmail} (${n.reason})`)
    );
  }
  console.log(`Duplicate Team Names: ${result.duplicateNames.length}`);
  if (result.duplicateNames.length > 0) {
    console.log('Duplicate Team Names found:');
    result.duplicateNames.forEach((d) => console.log(`  - "${d.name}": teams ${d.ids.join(', ')}`));
  }
  console.log('=============================');
}
