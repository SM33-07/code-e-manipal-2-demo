import fs from 'fs';
import path from 'path';
import pg from 'pg';
const { Pool } = pg;

const REPLACEMENT_DATA = {
  5: {
    challenge_num: 5,
    proposed_id: "PS 05",
    original_ref_id: "PS 05",
    slug: "ps-05-floodmask-flood-extent-from-radar-with-honest-uncertainty",
    title: "FloodMask: Flood Extent from Radar, With Honest Uncertainty",
    track_num: "Track 01",
    track: "AI/ML & Earth Observation",
    build_type: "Software / Geospatial",
    difficulty: "Advanced",
    review_status: "FINAL SHORTLIST",
    category_state: "selected",
    is_approved_for_release: true,
    is_official_sih: false,
    scope_note: "Software / Geospatial challenge in AI/ML & Earth Observation. Hold out whole flood events, not random chips. Distinguish flood water from permanent water and radar shadow.",
    problem_statement: "Clouds often hide floods from optical satellites, so radar is used instead. Radar water maps can still confuse flood water with permanent water, radar shadow and urban areas. Build a mapper that outputs flood extent alongside a per-pixel \"unsure\" layer, rather than forcing a confident label everywhere.",
    description_implementation: "• Data: Use Sen1Floods11, which includes Sentinel-1 imagery and 446 hand-labelled chips drawn from 11 flood events. Organizers must publish the permitted training data and reserve a genuinely organizer-controlled event/case set with labels withheld for final scoring; a publicly downloadable label set alone is not a hidden test.\n\n• Implementation: Predict flood water, permanent water and not-water. Compare against the dataset Otsu-threshold radar baseline; weakly labelled data may be used if its noise is documented.\n\n• Evaluation: Hold out whole flood events, not random chips. Report flood-class F1 and IoU versus Otsu, calibration, error-versus-coverage when the model abstains, and failures in urban areas, radar shadow and permanent water.\n\n• Stretch: Mask aligned Sentinel-2 chips to simulate cloud and show where radar adds information. Explain mismatches and alignment limitations rather than treating every difference as a model error.",
    description_bullets: [
      "Data: Use Sen1Floods11, which includes Sentinel-1 imagery and 446 hand-labelled chips drawn from 11 flood events. Organizers must publish the permitted training data and reserve a genuinely organizer-controlled event/case set with labels withheld for final scoring; a publicly downloadable label set alone is not a hidden test.",
      "Implementation: Predict flood water, permanent water and not-water. Compare against the dataset Otsu-threshold radar baseline; weakly labelled data may be used if its noise is documented.",
      "Evaluation: Hold out whole flood events, not random chips. Report flood-class F1 and IoU versus Otsu, calibration, error-versus-coverage when the model abstains, and failures in urban areas, radar shadow and permanent water.",
      "Stretch: Mask aligned Sentinel-2 chips to simulate cloud and show where radar adds information. Explain mismatches and alignment limitations rather than treating every difference as a model error."
    ],
    deliverables: "• Minimum prototype: A map viewer with radar chip, flood prediction, per-pixel uncertainty layer, difference from the Otsu baseline and a per-event score table.\n\n• A repeatable pipeline and report containing hidden-event scores, calibration and error-versus-coverage results.\n\n• A short limitations note explaining the small hand-labelled set, event-level holdout and weak-label noise.",
    deliverables_bullets: [
      "Minimum prototype: A map viewer with radar chip, flood prediction, per-pixel uncertainty layer, difference from the Otsu baseline and a per-event score table.",
      "A repeatable pipeline and report containing hidden-event scores, calibration and error-versus-coverage results.",
      "A short limitations note explaining the small hand-labelled set, event-level holdout and weak-label noise."
    ],
    implementation_challenge: "Predict flood water, permanent water and not-water. Compare against the dataset Otsu-threshold radar baseline; weakly labelled data may be used if its noise is documented.",
    minimum_acceptable_prototype: "A map viewer with radar chip, flood prediction, per-pixel uncertainty layer, difference from the Otsu baseline and a per-event score table.",
    evaluation_tests: "Hold out whole flood events, not random chips. Report flood-class F1 and IoU versus Otsu, calibration, error-versus-coverage when the model abstains, and failures in urban areas, radar shadow and permanent water.",
    stretch_differentiator: "Mask aligned Sentinel-2 chips to simulate cloud and show where radar adds information. Explain mismatches and alignment limitations rather than treating every difference as a model error.",
    suggested_public_sector_relevance: "Disaster management authorities, flood relief monitoring, and remote sensing agencies.",
    additional_guidance: {},
    display_order: 5
  },
  10: {
    challenge_num: 10,
    proposed_id: "PS 10",
    original_ref_id: "PS 10",
    slug: "ps-10-openforce-measuring-the-effort-to-open-everyday-packaging",
    title: "OpenForce: Measuring the Effort to Open Everyday Packaging",
    track_num: "Track 02",
    track: "HealthTech",
    build_type: "Hardware + Software",
    difficulty: "Advanced",
    review_status: "FINAL SHORTLIST",
    category_state: "selected",
    is_approved_for_release: true,
    is_official_sih: false,
    scope_note: "Hardware + Software challenge in HealthTech. Empty packaging only; make no clinical claims. Human-subject trials are optional and require informed consent.",
    problem_statement: "\"Hard to open\" is a feeling until someone measures it. Build an instrumented rig that measures the peak force or torque and effort profile needed to open packaging, so opening aids can be compared with repeatable measurements rather than impressions.",
    description_implementation: "• Implementation: Build a rig with a load cell or torque sensor, amplifier and microcontroller. Calibrate it against known masses or known torque, and log timestamped effort curves.\n\n• Test at least three types of empty packaging with and without an opening aid, keeping the mounting and test procedure consistent. The no-aid result is the baseline.\n\n• Evaluation: Report calibration error, repeatability across repeated trials, drift over time and measurement uncertainty. Conduct a blind comparison of two aid designs using organizer-selected samples or test conditions; disclose the test protocol after scoring.\n\n• Stretch: Add a second measurement axis, such as grip force versus twist torque. Use empty packaging only; make no clinical claims. Human-subject trials are optional and require informed consent.",
    description_bullets: [
      "Implementation: Build a rig with a load cell or torque sensor, amplifier and microcontroller. Calibrate it against known masses or known torque, and log timestamped effort curves.",
      "Test at least three types of empty packaging with and without an opening aid, keeping the mounting and test procedure consistent. The no-aid result is the baseline.",
      "Evaluation: Report calibration error, repeatability across repeated trials, drift over time and measurement uncertainty. Conduct a blind comparison of two aid designs using organizer-selected samples or test conditions; disclose the test protocol after scoring.",
      "Stretch: Add a second measurement axis, such as grip force versus twist torque. Use empty packaging only; make no clinical claims. Human-subject trials are optional and require informed consent."
    ],
    deliverables: "• Minimum prototype: A working rig with live readout, sensor calibration record and timestamped force/torque curves.\n\n• A results table comparing at least three packaging types with and without an aid, including repeated-trial error bars and a blind aid comparison.\n\n• A short test protocol and limitations note describing measurement range, uncertainty and sources of drift.",
    deliverables_bullets: [
      "Minimum prototype: A working rig with live readout, sensor calibration record and timestamped force/torque curves.",
      "A results table comparing at least three packaging types with and without an aid, including repeated-trial error bars and a blind aid comparison.",
      "A short test protocol and limitations note describing measurement range, uncertainty and sources of drift."
    ],
    implementation_challenge: "Build a rig with a load cell or torque sensor, amplifier and microcontroller. Calibrate it against known masses or known torque, and log timestamped effort curves.",
    minimum_acceptable_prototype: "A working rig with live readout, sensor calibration record and timestamped force/torque curves.",
    evaluation_tests: "Report calibration error, repeatability across repeated trials, drift over time and measurement uncertainty. Conduct a blind comparison of two aid designs using organizer-selected samples or test conditions; disclose the test protocol after scoring.",
    stretch_differentiator: "Add a second measurement axis, such as grip force versus twist torque. Use empty packaging only; make no clinical claims. Human-subject trials are optional and require informed consent.",
    suggested_public_sector_relevance: "Universal design compliance, elder-care accessibility, and assistive biomechanics.",
    additional_guidance: {},
    display_order: 10
  },
  12: {
    challenge_num: 12,
    proposed_id: "PS 12",
    original_ref_id: "PS 12",
    slug: "ps-12-breathgate-breathing-rate-estimation-that-abstains-when-the-signal-is-bad",
    title: "BreathGate: Breathing-Rate Estimation That Abstains When the Signal Is Bad",
    track_num: "Track 02",
    track: "HealthTech",
    build_type: "Software / Optional Hardware",
    difficulty: "Advanced",
    review_status: "FINAL SHORTLIST",
    category_state: "selected",
    is_approved_for_release: true,
    is_official_sih: false,
    scope_note: "Software / Optional Hardware challenge in HealthTech. Signal-processing prototype, not a medical device. Must not diagnose or recommend treatment.",
    problem_statement: "Breathing rate can be estimated from a pulse-sensor signal, but noise and motion can make estimates unreliable. Build an estimator that reports a rate only when it has enough signal evidence and otherwise says \"unreliable\". It must not diagnose or recommend treatment.",
    description_implementation: "• Data: Use the BIDMC dataset of 53 eight-minute recordings containing photoplethysmography (PPG), impedance respiration and ECG signals with reference respiratory rates. The two manual breath annotations differ slightly; report their spread as part of the reference uncertainty.\n\n• Implementation: Add signal-quality gating and a breathing-rate estimator; compare it with a simple spectral-peak baseline. Organizers must use a subject-level split and withhold evaluation references in a locked scoring set; publicly downloadable labels alone cannot be described as hidden test labels.\n\n• Evaluation: Split by subject, not by windows. Report error in breaths per minute against coverage, errors on accepted and rejected windows, and results after injecting motion noise and signal dropouts.\n\n• Stretch: Run on a microcontroller-class device and report latency and memory use. Clearly label the result as a signal-processing prototype, not a medical device.",
    description_bullets: [
      "Data: Use the BIDMC dataset of 53 eight-minute recordings containing photoplethysmography (PPG), impedance respiration and ECG signals with reference respiratory rates. The two manual breath annotations differ slightly; report their spread as part of the reference uncertainty.",
      "Implementation: Add signal-quality gating and a breathing-rate estimator; compare it with a simple spectral-peak baseline. Organizers must use a subject-level split and withhold evaluation references in a locked scoring set; publicly downloadable labels alone cannot be described as hidden test labels.",
      "Evaluation: Split by subject, not by windows. Report error in breaths per minute against coverage, errors on accepted and rejected windows, and results after injecting motion noise and signal dropouts.",
      "Stretch: Run on a microcontroller-class device and report latency and memory use. Clearly label the result as a signal-processing prototype, not a medical device."
    ],
    deliverables: "• Minimum prototype: A signal viewer showing the waveform, estimated rate, confidence or quality indicator, and an explicit abstain flag.\n\n• An error-versus-coverage curve and a report comparing the spectral-peak baseline with the proposed estimator on held-out subjects.\n\n• A failure-case summary for motion noise, dropouts and disagreement between reference annotations.",
    deliverables_bullets: [
      "Minimum prototype: A signal viewer showing the waveform, estimated rate, confidence or quality indicator, and an explicit abstain flag.",
      "An error-versus-coverage curve and a report comparing the spectral-peak baseline with the proposed estimator on held-out subjects.",
      "A failure-case summary for motion noise, dropouts and disagreement between reference annotations."
    ],
    implementation_challenge: "Add signal-quality gating and a breathing-rate estimator; compare it with a simple spectral-peak baseline.",
    minimum_acceptable_prototype: "A signal viewer showing the waveform, estimated rate, confidence or quality indicator, and an explicit abstain flag.",
    evaluation_tests: "Split by subject, not by windows. Report error in breaths per minute against coverage, errors on accepted and rejected windows, and results after injecting motion noise and signal dropouts.",
    stretch_differentiator: "Run on a microcontroller-class device and report latency and memory use. Clearly label the result as a signal-processing prototype, not a medical device.",
    suggested_public_sector_relevance: "Non-invasive triage, telemedicine, and wearable health monitoring.",
    additional_guidance: {},
    display_order: 12
  },
  20: {
    challenge_num: 20,
    proposed_id: "PS 20",
    original_ref_id: "PS 20",
    slug: "ps-20-traceback-reconstructing-an-intrusion-timeline-from-raw-logs",
    title: "TraceBack: Reconstructing an Intrusion Timeline from Raw Logs",
    track_num: "Track 04",
    track: "Cybersecurity",
    build_type: "Software",
    difficulty: "Advanced",
    review_status: "FINAL SHORTLIST",
    category_state: "selected",
    is_approved_for_release: true,
    is_official_sih: false,
    scope_note: "Software challenge in Cybersecurity. The tool works on logs only and must not include exploit code or live network access.",
    problem_statement: "After an incident, analysts face thousands of unlabelled events from many machines. Build a tool that proposes a timeline of attacker steps, links each step to the log evidence behind it, and marks weak links as \"uncertain\". The tool works on logs only and must not include exploit code.",
    description_implementation: "• Data: Start with OTRF Security Datasets (formerly Mordor), which contain recorded events from simulated adversary techniques alongside benign activity. Because public traces may be too small for multi-host evaluation, organizers must also prepare a reproducible multi-host scenario with benign noise and keep its ground-truth attack-step list hidden until scoring.\n\n• Implementation: Correlate events across hosts and users into candidate attack steps. Every proposed step must link to supporting log evidence, and weak causal links must be explicitly marked uncertain.\n\n• Evaluation: Compare with the baseline that sorts events by time and groups them by host. Score recall of true attack steps, precision of causal links, false links caused by benign bursts, and robustness to clock skew and late-arriving logs.\n\n• Stretch: Add a counterfactual panel showing which events would change a proposed link and what benign explanation could fit the same pattern.",
    description_bullets: [
      "Data: Start with OTRF Security Datasets (formerly Mordor), which contain recorded events from simulated adversary techniques alongside benign activity. Because public traces may be too small for multi-host evaluation, organizers must also prepare a reproducible multi-host scenario with benign noise and keep its ground-truth attack-step list hidden until scoring.",
      "Implementation: Correlate events across hosts and users into candidate attack steps. Every proposed step must link to supporting log evidence, and weak causal links must be explicitly marked uncertain.",
      "Evaluation: Compare with the baseline that sorts events by time and groups them by host. Score recall of true attack steps, precision of causal links, false links caused by benign bursts, and robustness to clock skew and late-arriving logs.",
      "Stretch: Add a counterfactual panel showing which events would change a proposed link and what benign explanation could fit the same pattern."
    ],
    deliverables: "• Minimum prototype: A timeline view, evidence drill-down, uncertain-link flags and a score report against the organizer-held scenario.\n\n• A repeatable log parser/correlation pipeline and a baseline comparison with attack-step recall, causal-link precision and false-link counts.\n\n• A failure-case summary covering clock skew, delayed events and benign activity; no live network access or exploit code.",
    deliverables_bullets: [
      "Minimum prototype: A timeline view, evidence drill-down, uncertain-link flags and a score report against the organizer-held scenario.",
      "A repeatable log parser/correlation pipeline and a baseline comparison with attack-step recall, causal-link precision and false-link counts.",
      "A failure-case summary covering clock skew, delayed events and benign activity; no live network access or exploit code."
    ],
    implementation_challenge: "Correlate events across hosts and users into candidate attack steps. Every proposed step must link to supporting log evidence, and weak causal links must be explicitly marked uncertain.",
    minimum_acceptable_prototype: "A timeline view, evidence drill-down, uncertain-link flags and a score report against the organizer-held scenario.",
    evaluation_tests: "Compare with the baseline that sorts events by time and groups them by host. Score recall of true attack steps, precision of causal links, false links caused by benign bursts, and robustness to clock skew and late-arriving logs.",
    stretch_differentiator: "Add a counterfactual panel showing which events would change a proposed link and what benign explanation could fit the same pattern.",
    suggested_public_sector_relevance: "SOC triage, CERT forensic response, and public cyber defence coordination.",
    additional_guidance: {},
    display_order: 20
  },
  33: {
    challenge_num: 33,
    proposed_id: "PS 33",
    original_ref_id: "PS 33",
    slug: "ps-33-ventrate-estimating-room-ventilation-rate-from-co2-with-uncertainty",
    title: "VentRate: Estimating Room Ventilation Rate from CO2, With Uncertainty",
    track_num: "Track 08",
    track: "Smart City & Infrastructure",
    build_type: "Hardware + Software",
    difficulty: "Advanced",
    review_status: "FINAL SHORTLIST",
    category_state: "selected",
    is_approved_for_release: true,
    is_official_sih: false,
    scope_note: "Hardware + Software challenge in Smart City & Infrastructure. Decay testing requires an unoccupied space and approximately constant ventilation during the test. Do not present a ppm threshold alone as an air-change measurement.",
    problem_statement: "A CO2 reading is not a ventilation rate. Build a sensor node that estimates how quickly a room’s air is being replaced, reports an uncertainty range, and indicates when the estimate should not be trusted.",
    description_implementation: "• Implementation: Build a CO2 sensor node with a microcontroller. State whether the sensor measures CO2 directly or infers it, and estimate air-change rate from a decay curve. Decay testing requires an unoccupied space and approximately constant ventilation during the test.\n\n• Evaluation: Test at least three ventilation conditions against a documented reference, such as a fan with measured flow or defined door/window states. Compare the estimate against a plain ppm-threshold baseline.\n\n• Evaluate sensitivity to sensor placement and non-uniform mixing; report reference-versus-estimate error and an uncertainty range. Organizers should reserve one condition or placement for a blind final test and keep its reference values out of the development materials.\n\n• Stretch: Add a second sensor to quantify how non-uniform mixing changes the estimate. Do not present a ppm threshold alone as an air-change measurement.",
    description_bullets: [
      "Implementation: Build a CO2 sensor node with a microcontroller. State whether the sensor measures CO2 directly or infers it, and estimate air-change rate from a decay curve. Decay testing requires an unoccupied space and approximately constant ventilation during the test.",
      "Evaluation: Test at least three ventilation conditions against a documented reference, such as a fan with measured flow or defined door/window states. Compare the estimate against a plain ppm-threshold baseline.",
      "Evaluate sensitivity to sensor placement and non-uniform mixing; report reference-versus-estimate error and an uncertainty range. Organizers should reserve one condition or placement for a blind final test and keep its reference values out of the development materials.",
      "Stretch: Add a second sensor to quantify how non-uniform mixing changes the estimate. Do not present a ppm threshold alone as an air-change measurement."
    ],
    deliverables: "• Minimum prototype: A working sensor node with live CO2 readings and a ventilation-rate estimate plus an explicit uncertainty or unreliable state.\n\n• A reference-versus-estimate table across at least three conditions, including the blind condition, and a comparison with the ppm-threshold baseline.\n\n• A documented limits page covering sensor type, sensor placement, well-mixed-air assumptions and situations in which no reliable estimate should be shown.",
    deliverables_bullets: [
      "Minimum prototype: A working sensor node with live CO2 readings and a ventilation-rate estimate plus an explicit uncertainty or unreliable state.",
      "A reference-versus-estimate table across at least three conditions, including the blind condition, and a comparison with the ppm-threshold baseline.",
      "A documented limits page covering sensor type, sensor placement, well-mixed-air assumptions and situations in which no reliable estimate should be shown."
    ],
    implementation_challenge: "Build a CO2 sensor node with a microcontroller. State whether the sensor measures CO2 directly or infers it, and estimate air-change rate from a decay curve.",
    minimum_acceptable_prototype: "A working sensor node with live CO2 readings and a ventilation-rate estimate plus an explicit uncertainty or unreliable state.",
    evaluation_tests: "Test at least three ventilation conditions against a documented reference, such as a fan with measured flow or defined door/window states. Compare the estimate against a plain ppm-threshold baseline. Evaluate sensitivity to sensor placement and non-uniform mixing.",
    stretch_differentiator: "Add a second sensor to quantify how non-uniform mixing changes the estimate. Do not present a ppm threshold alone as an air-change measurement.",
    suggested_public_sector_relevance: "Public health surveillance, school/classroom ventilation standards, and smart building HVAC optimization.",
    additional_guidance: {},
    display_order: 33
  }
};

async function main() {
  console.log('--- Targeted Content Replacement for 5 Problem Statements ---');

  // Step 1: Update data/final_35_problem_statements.json
  const manifestPath = path.join(process.cwd(), 'data', 'final_35_problem_statements.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  let manifestUpdatedCount = 0;
  let manifestUnchangedCount = 0;

  const newManifest = manifest.map((item) => {
    if (REPLACEMENT_DATA[item.challenge_num]) {
      manifestUpdatedCount++;
      const rep = REPLACEMENT_DATA[item.challenge_num];
      console.log(`Manifest: replacing Challenge #${item.challenge_num} (${item.title} -> ${rep.title})`);
      return {
        ...item,
        ...rep,
      };
    } else {
      manifestUnchangedCount++;
      return item;
    }
  });

  // Verification checks on new manifest
  if (newManifest.length !== 35) {
    throw new Error(`Manifest item count mismatch: expected 35, got ${newManifest.length}`);
  }
  const uniqueIds = new Set(newManifest.map((s) => s.proposed_id));
  if (uniqueIds.size !== 35) {
    throw new Error(`Duplicate IDs detected in manifest: ${uniqueIds.size}`);
  }
  const uniqueTracks = new Set(newManifest.map((s) => s.track));
  if (uniqueTracks.size !== 9) {
    throw new Error(`Track count mismatch: expected 9, got ${uniqueTracks.size}`);
  }

  fs.writeFileSync(manifestPath, JSON.stringify(newManifest, null, 2), 'utf8');
  console.log(`Manifest updated: ${manifestUpdatedCount} updated, ${manifestUnchangedCount} unchanged.`);

  // Step 2: Update database records in public.problem_statement_drafts for active release
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is missing.');
  }

  const pool = new Pool({ connectionString });
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Identify active release from event_config
    const { rows: configRows } = await client.query(`
      SELECT problem_statements_published, active_problem_release_id 
      FROM public.event_config 
      WHERE id = 1;
    `);

    const activeReleaseId = configRows[0]?.active_problem_release_id;
    if (!activeReleaseId) {
      throw new Error('No active_problem_release_id found in event_config.');
    }

    console.log(`Targeting active release: ${activeReleaseId}`);

    let dbUpdatedCount = 0;
    let dbFailedCount = 0;

    for (const [challengeNum, rep] of Object.entries(REPLACEMENT_DATA)) {
      const res = await client.query(`
        UPDATE public.problem_statement_drafts
        SET
          title = $1,
          slug = $2,
          build_type = $3,
          problem_statement = $4,
          description_implementation = $5,
          deliverables = $6,
          description_bullets = $7,
          deliverables_bullets = $8,
          implementation_challenge = $9,
          minimum_acceptable_prototype = $10,
          evaluation_tests = $11,
          stretch_differentiator = $12,
          scope_note = $13,
          suggested_public_sector_relevance = $14,
          updated_at = NOW()
        WHERE release_id = $15 AND challenge_num = $16
        RETURNING id, title;
      `, [
        rep.title,
        rep.slug,
        rep.build_type,
        rep.problem_statement,
        rep.description_implementation,
        rep.deliverables,
        JSON.stringify(rep.description_bullets),
        JSON.stringify(rep.deliverables_bullets),
        rep.implementation_challenge,
        rep.minimum_acceptable_prototype,
        rep.evaluation_tests,
        rep.stretch_differentiator,
        rep.scope_note,
        rep.suggested_public_sector_relevance,
        activeReleaseId,
        parseInt(challengeNum, 10),
      ]);

      if (res.rowCount === 1) {
        dbUpdatedCount++;
        console.log(`Database: updated Challenge #${challengeNum} (ID: ${res.rows[0].id}) -> ${res.rows[0].title}`);
      } else {
        dbFailedCount++;
        console.error(`Database: FAILED to update Challenge #${challengeNum} in release ${activeReleaseId}`);
      }
    }

    // Insert audit log
    await client.query(`
      INSERT INTO public.problem_statement_audit_logs (
        release_id,
        action,
        actor_id,
        actor_email,
        metadata
      ) VALUES (
        $1,
        'REPLACE_WEAK_STATEMENTS',
        NULL,
        'system@codeemanipal.in',
        $2
      );
    `, [
      activeReleaseId,
      JSON.stringify({
        source_file: "Codee_Manipal_Final_Problem_Statements_35_Weak_Replacements.pdf",
        replaced_ids: ["PS 05", "PS 10", "PS 12", "PS 20", "PS 33"],
        replaced_titles: {
          "PS 05": "FloodMask: Flood Extent from Radar, With Honest Uncertainty",
          "PS 10": "OpenForce: Measuring the Effort to Open Everyday Packaging",
          "PS 12": "BreathGate: Breathing-Rate Estimation That Abstains When the Signal Is Bad",
          "PS 20": "TraceBack: Reconstructing an Intrusion Timeline from Raw Logs",
          "PS 33": "VentRate: Estimating Room Ventilation Rate from CO2, With Uncertainty"
        },
        timestamp: new Date().toISOString()
      })
    ]);

    await client.query('COMMIT');
    console.log(`Transaction committed. ${dbUpdatedCount} database records updated, ${dbFailedCount} failed.`);

    // Verification queries
    const { rows: verifyRows } = await client.query(`
      SELECT challenge_num, proposed_id, title, build_type, slug
      FROM public.problem_statement_drafts
      WHERE release_id = $1
      ORDER BY challenge_num ASC;
    `, [activeReleaseId]);

    console.log(`\nActive Release Statement Count: ${verifyRows.length}`);
    const replaced = verifyRows.filter((r) => [5, 10, 12, 20, 33].includes(r.challenge_num));
    console.log('\nVerified Replaced Records in Database:');
    replaced.forEach((r) => {
      console.log(`- ${r.proposed_id}: ${r.title} (${r.build_type}) [slug: ${r.slug}]`);
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Transaction rolled back due to error:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
