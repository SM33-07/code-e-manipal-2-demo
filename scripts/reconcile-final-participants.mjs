import xlsx from 'xlsx';
import fs from 'fs';
import path from 'path';

const officialTeamsPath = path.resolve('.credentials/Code_e_Manipal_Official_Team_Login_Details(2).xlsx');
const participantsPath = path.resolve('.credentials/Code-e-Manipal_2.0_Round_2_Final_Perfectly_Mapped.xlsx');

const wbTeams = xlsx.readFile(officialTeamsPath);
const sheetTeams = wbTeams.Sheets[wbTeams.SheetNames[0]];
const officialTeams = xlsx.utils.sheet_to_json(sheetTeams);

const wbParticipants = xlsx.readFile(participantsPath);
const sheetParticipants = wbParticipants.Sheets[wbParticipants.SheetNames[0]];
const participants = xlsx.utils.sheet_to_json(sheetParticipants);

console.log(`Loaded ${officialTeams.length} official teams and ${participants.length} participant registrations.\n`);

// 1. Build canonical team maps
function normalizeName(name) {
  if (!name) return '';
  return String(name).trim().toLowerCase().replace(/\s+/g, ' ');
}

const teamsByNormalizedName = new Map();
const teamsById = new Map();
const teamsByLeaderEmail = new Map();

for (const t of officialTeams) {
  const teamId = String(t['Team ID']).trim();
  const rawName = String(t['Team Name (official file)']).trim();
  const normName = normalizeName(rawName);
  const contactEmail = normalizeName(t['Contact Email']);

  const teamRecord = {
    teamId,
    canonicalIdentifier: t['Canonical Identifier'],
    name: rawName,
    normName,
    contactName: String(t['Contact Name'] || '').trim(),
    contactEmail: String(t['Contact Email'] || '').trim(),
    authEmail: String(t['Auth Email'] || '').trim(),
    loginId: String(t['Login ID'] || '').trim(),
  };

  teamsById.set(teamId, teamRecord);
  teamsByNormalizedName.set(normName, teamRecord);
  if (contactEmail) {
    teamsByLeaderEmail.set(contactEmail, teamRecord);
  }
}

// 2. Analyze duplicate emails in participants
const emailOccurrences = new Map();
for (let i = 0; i < participants.length; i++) {
  const p = participants[i];
  const email = normalizeName(p['Email Id:']);
  if (!emailOccurrences.has(email)) {
    emailOccurrences.set(email, []);
  }
  emailOccurrences.get(email).push({ index: i, row: p });
}

console.log('--- Duplicate Email Analysis ---');
const duplicateEmailGroups = [];
for (const [email, list] of emailOccurrences.entries()) {
  if (list.length > 1) {
    console.log(`Duplicate Email [${email}]: ${list.length} rows`);
    list.forEach(item => {
      console.log(`  Row ${item.index + 2}: Name="${item.row['Full Name:']}", Team="${item.row['Team Name:']}", Phone="${item.row['Phone Number']}", Time="${item.row['Timestamp']}", TxID="${item.row['Please paste your transaction/CTR Id here:']}"`);
    });
    duplicateEmailGroups.push({ email, list });
  }
}
console.log(`Unique email count: ${emailOccurrences.size} across ${participants.length} rows.\n`);

// 3. Match participants to official teams
const matchedParticipants = [];
const unmatchedParticipants = [];
const teamRosters = new Map(); // teamId -> array of participants

for (const t of officialTeams) {
  teamRosters.set(String(t['Team ID']).trim(), []);
}

// Track processed unique participants
const deduplicatedParticipants = [];
const skippedDuplicates = [];

for (const [email, list] of emailOccurrences.entries()) {
  if (list.length === 1) {
    deduplicatedParticipants.push(list[0].row);
  } else {
    // Check if the duplicate rows are identical participant submissions
    const first = list[0].row;
    const second = list[1].row;
    const sameName = normalizeName(first['Full Name:']) === normalizeName(second['Full Name:']);
    const sameTeam = normalizeName(first['Team Name:']) === normalizeName(second['Team Name:']);
    const samePhone = String(first['Phone Number']).trim() === String(second['Phone Number']).trim();

    if (sameName && sameTeam) {
      console.log(`Resolved Duplicate: Identical participant "${first['Full Name:']}" in team "${first['Team Name:']}". Keeping row ${list[1].index + 2} (latest/re-submission), skipping row ${list[0].index + 2}.`);
      skippedDuplicates.push({
        skippedRow: list[0],
        keptRow: list[1],
        reason: 'Identical re-submission by same participant',
      });
      deduplicatedParticipants.push(list[1].row);
    } else {
      console.log(`WARNING: Conflicting duplicate email ${email}: rows differ!`);
      // Keep first or both?
      deduplicatedParticipants.push(list[0].row);
      deduplicatedParticipants.push(list[1].row);
    }
  }
}

console.log(`\nValidated unique participants count: ${deduplicatedParticipants.length} (Skipped ${skippedDuplicates.length} true duplicate rows)\n`);

// Match every deduplicated participant
for (let i = 0; i < deduplicatedParticipants.length; i++) {
  const p = deduplicatedParticipants[i];
  const rawTeamName = String(p['Team Name:'] || '').trim();
  const normTeamName = normalizeName(rawTeamName);
  const pEmail = normalizeName(p['Email Id:']);
  const pName = String(p['Full Name:'] || '').trim();

  // Try matching:
  // Strategy A: Exact normalized name match against official team name
  let matchedTeam = teamsByNormalizedName.get(normTeamName);

  // Strategy B: If no direct name match, check leader email
  if (!matchedTeam) {
    matchedTeam = teamsByLeaderEmail.get(pEmail);
    if (matchedTeam) {
      console.log(`Matched via Leader Email: Participant "${pName}" (email ${pEmail}, team "${rawTeamName}") -> Official Team "${matchedTeam.name}" (${matchedTeam.teamId})`);
    }
  }

  // Strategy C: Check fuzzy / minor character variations
  if (!matchedTeam) {
    for (const [tNorm, tRecord] of teamsByNormalizedName.entries()) {
      // Remove all non-alphanumeric
      const cleanP = normTeamName.replace(/[^a-z0-9]/g, '');
      const cleanT = tNorm.replace(/[^a-z0-9]/g, '');
      if (cleanP && cleanP === cleanT) {
        matchedTeam = tRecord;
        console.log(`Matched via Alphanumeric normalization: "${rawTeamName}" -> "${tRecord.name}" (${tRecord.teamId})`);
        break;
      }
    }
  }

  if (matchedTeam) {
    const isLeader = (
      normalizeName(matchedTeam.contactEmail) === pEmail ||
      normalizeName(matchedTeam.contactName) === normalizeName(pName)
    );

    const participantObj = {
      fullName: pName,
      email: String(p['Email Id:'] || '').trim(),
      phone: String(p['Phone Number'] || '').trim(),
      college: String(p['College Name:'] || '').trim(),
      studyYear: String(p['Study Year:'] || '').trim(),
      submittedTeamName: rawTeamName,
      matchedTeamId: matchedTeam.teamId,
      matchedTeamName: matchedTeam.name,
      isLeader,
      timestamp: p['Timestamp'],
      transactionId: p['Please paste your transaction/CTR Id here:'],
    };

    matchedParticipants.push(participantObj);
    teamRosters.get(matchedTeam.teamId).push(participantObj);
  } else {
    unmatchedParticipants.push({
      fullName: pName,
      email: String(p['Email Id:'] || '').trim(),
      phone: String(p['Phone Number'] || '').trim(),
      teamName: rawTeamName,
      row: p,
    });
  }
}

console.log('--- Matching Results ---');
console.log(`Total Matched: ${matchedParticipants.length}`);
console.log(`Total Unmatched: ${unmatchedParticipants.length}`);

if (unmatchedParticipants.length > 0) {
  console.log('\nUnmatched Participants:');
  unmatchedParticipants.forEach((u, idx) => {
    console.log(`  ${idx + 1}. Name: "${u.fullName}", Email: "${u.email}", Team: "${u.teamName}"`);
  });
}

// Check team roster sizes
console.log('\n--- Team Roster Size Distribution ---');
let zeroMemberTeams = 0;
const teamSizeDistribution = {};
for (const [tId, roster] of teamRosters.entries()) {
  const size = roster.length;
  teamSizeDistribution[size] = (teamSizeDistribution[size] || 0) + 1;
  if (size === 0) {
    zeroMemberTeams++;
  }
}
console.log('Roster size distribution (members per team):', teamSizeDistribution);
console.log(`Teams with 0 members in participant workbook: ${zeroMemberTeams}`);

// Check which teams have 0 members
if (zeroMemberTeams > 0) {
  console.log('\nTeams with 0 members matched:');
  for (const [tId, roster] of teamRosters.entries()) {
    if (roster.length === 0) {
      const t = teamsById.get(tId);
      console.log(`  ${tId}: "${t.name}" (Leader: "${t.contactName}", Email: "${t.contactEmail}")`);
    }
  }
}
