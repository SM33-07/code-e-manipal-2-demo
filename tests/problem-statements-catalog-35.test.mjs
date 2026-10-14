import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3000';

function decodeHtml(html) {
  return html
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<!-- -->/g, '');
}

describe('Problem Statements 35 Catalogue & Detail View Integration Tests', () => {
  const jsonPath = path.join(process.cwd(), 'data', 'final_35_problem_statements.json');
  const sourceStatements = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

  it('Manifest contains exactly 35 problem statements across 9 tracks', () => {
    assert.equal(sourceStatements.length, 35, 'Must contain exactly 35 statements');
    const tracks = new Set(sourceStatements.map((s) => s.track));
    assert.equal(tracks.size, 9, 'Must contain exactly 9 tracks');

    // Verify IDs are PS 01 through PS 35
    for (let i = 1; i <= 35; i++) {
      const expectedId = `PS ${String(i).padStart(2, '0')}`;
      const found = sourceStatements.find((s) => s.proposed_id === expectedId || s.id === expectedId);
      assert.ok(found, `Statement with ID ${expectedId} must exist`);
    }
  });

  it('Manifest contains the 5 newly replaced problem statements accurately', () => {
    const ps05 = sourceStatements.find((s) => s.challenge_num === 5);
    assert.equal(ps05.title, 'FloodMask: Flood Extent from Radar, With Honest Uncertainty');
    assert.equal(ps05.build_type, 'Software / Geospatial');
    assert.ok(ps05.description_implementation.includes('Sen1Floods11'));

    const ps10 = sourceStatements.find((s) => s.challenge_num === 10);
    assert.equal(ps10.title, 'OpenForce: Measuring the Effort to Open Everyday Packaging');
    assert.equal(ps10.build_type, 'Hardware + Software');
    assert.ok(ps10.description_implementation.includes('torque sensor'));

    const ps12 = sourceStatements.find((s) => s.challenge_num === 12);
    assert.equal(ps12.title, 'BreathGate: Breathing-Rate Estimation That Abstains When the Signal Is Bad');
    assert.equal(ps12.build_type, 'Software / Optional Hardware');
    assert.ok(ps12.description_implementation.includes('BIDMC'));

    const ps20 = sourceStatements.find((s) => s.challenge_num === 20);
    assert.equal(ps20.title, 'TraceBack: Reconstructing an Intrusion Timeline from Raw Logs');
    assert.equal(ps20.build_type, 'Software');
    assert.ok(ps20.description_implementation.includes('Mordor'));

    const ps33 = sourceStatements.find((s) => s.challenge_num === 33);
    assert.equal(ps33.title, 'VentRate: Estimating Room Ventilation Rate from CO2, With Uncertainty');
    assert.equal(ps33.build_type, 'Hardware + Software');
    assert.ok(ps33.description_implementation.includes('decay curve'));
  });

  it('GET /api/problem-statements returns published catalogue with all 35 items including replacements', async () => {
    const res = await fetch(`${BASE_URL}/api/problem-statements`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.published, true);
    assert.equal(body.data.statements.length, 35);
    assert.equal(body.data.tracks.length, 9);

    const s05 = body.data.statements.find((s) => s.challenge_num === 5);
    assert.equal(s05.title, 'FloodMask: Flood Extent from Radar, With Honest Uncertainty');

    const s10 = body.data.statements.find((s) => s.challenge_num === 10);
    assert.equal(s10.title, 'OpenForce: Measuring the Effort to Open Everyday Packaging');

    const s12 = body.data.statements.find((s) => s.challenge_num === 12);
    assert.equal(s12.title, 'BreathGate: Breathing-Rate Estimation That Abstains When the Signal Is Bad');

    const s20 = body.data.statements.find((s) => s.challenge_num === 20);
    assert.equal(s20.title, 'TraceBack: Reconstructing an Intrusion Timeline from Raw Logs');

    const s33 = body.data.statements.find((s) => s.challenge_num === 33);
    assert.equal(s33.title, 'VentRate: Estimating Room Ventilation Rate from CO2, With Uncertainty');
  });

  it('GET /problem-statements HTML renders all 35 challenge cards with revised titles', async () => {
    const res = await fetch(`${BASE_URL}/problem-statements`);
    assert.equal(res.status, 200);
    const rawHtml = await res.text();
    const cleanHtml = decodeHtml(rawHtml);

    assert.ok(cleanHtml.includes('Problem Statements'), 'Header must be present');
    assert.ok(cleanHtml.includes('35 Challenges'), '35 Challenges count must be present');
    assert.ok(cleanHtml.includes('9 Official Tracks'), '9 Official Tracks must be present');

    // Verify revised titles appear on catalogue
    assert.ok(cleanHtml.includes('FloodMask: Flood Extent from Radar, With Honest Uncertainty'));
    assert.ok(cleanHtml.includes('OpenForce: Measuring the Effort to Open Everyday Packaging'));
    assert.ok(cleanHtml.includes('BreathGate: Breathing-Rate Estimation That Abstains When the Signal Is Bad'));
    assert.ok(cleanHtml.includes('TraceBack: Reconstructing an Intrusion Timeline from Raw Logs'));
    assert.ok(cleanHtml.includes('VentRate: Estimating Room Ventilation Rate from CO2, With Uncertainty'));

    // Verify other titles preserved
    assert.ok(cleanHtml.includes('ArcSense: Early Warning for Unstable Weld Signatures'));
    assert.ok(cleanHtml.includes('Open Innovation in Hardware: Build a Physical Solution to a Validated Need'));
  });

  it('Resolves all 35 problem statements by canonical slug', async () => {
    for (const statement of sourceStatements) {
      const res = await fetch(`${BASE_URL}/problem-statements/${statement.slug}`);
      assert.equal(res.status, 200, `Slug ${statement.slug} must resolve with 200`);
      const rawHtml = await res.text();
      const cleanHtml = decodeHtml(rawHtml);

      assert.ok(cleanHtml.includes(statement.proposed_id || statement.id), `HTML must contain ID ${statement.proposed_id}`);
      assert.ok(cleanHtml.includes(statement.title), `HTML must contain title for ${statement.slug}`);
      assert.ok(cleanHtml.includes(statement.track), `HTML must contain track ${statement.track}`);
      assert.ok(cleanHtml.includes(statement.build_type), `HTML must contain build type ${statement.build_type}`);
    }
  });

  it('Resolves problem statements by short ID alias (e.g. PS-01, ps-01, ps01)', async () => {
    const testAliases = [
      { alias: 'PS-01', expectedTitle: 'ArcSense' },
      { alias: 'ps-01', expectedTitle: 'ArcSense' },
      { alias: 'ps01', expectedTitle: 'ArcSense' },
      { alias: 'PS-05', expectedTitle: 'FloodMask' },
      { alias: 'ps-10', expectedTitle: 'OpenForce' },
      { alias: 'PS-12', expectedTitle: 'BreathGate' },
      { alias: 'PS-15', expectedTitle: 'CaseBundle' },
      { alias: 'PS-20', expectedTitle: 'TraceBack' },
      { alias: 'ps-28', expectedTitle: 'ClueMesh' },
      { alias: 'ps-33', expectedTitle: 'VentRate' },
      { alias: 'PS-35', expectedTitle: 'Open Innovation in Hardware' },
    ];
    for (const { alias, expectedTitle } of testAliases) {
      const res = await fetch(`${BASE_URL}/problem-statements/${alias}`);
      assert.equal(res.status, 200, `Alias ${alias} must resolve with 200`);
      const rawHtml = await res.text();
      const cleanHtml = decodeHtml(rawHtml);
      assert.ok(cleanHtml.includes(expectedTitle), `Alias ${alias} must resolve to page with title containing ${expectedTitle}`);
    }
  });

  it('Resolves previous legacy slugs seamlessly without 404', async () => {
    const legacySlugs = [
      { slug: 'ps-05-croppulse-multi-stage-crop-mapping-and-water-stress-advisory-from-satellite-signals', expectedTitle: 'FloodMask' },
      { slug: 'ps-10-gripease-one-handed-pack-access-with-haptic-confirmation', expectedTitle: 'OpenForce' },
      { slug: 'ps-12-hushband-wearable-haptic-guidance-for-indoor-wayfinding', expectedTitle: 'BreathGate' },
      { slug: 'ps-20-benchkey-offline-trust-gate-for-removable-media-in-shared-labs', expectedTitle: 'TraceBack' },
      { slug: 'ps-33-airtrace-classroom-ventilation-quality-monitor', expectedTitle: 'VentRate' },
    ];
    for (const { slug, expectedTitle } of legacySlugs) {
      const res = await fetch(`${BASE_URL}/problem-statements/${slug}`);
      assert.equal(res.status, 200, `Legacy slug ${slug} must resolve with 200`);
      const rawHtml = await res.text();
      const cleanHtml = decodeHtml(rawHtml);
      assert.ok(cleanHtml.includes(expectedTitle), `Legacy slug ${slug} must resolve to page containing ${expectedTitle}`);
    }
  });

  it('Returns not-found view for non-existent challenge ID', async () => {
    const res = await fetch(`${BASE_URL}/problem-statements/ps-999-invalid-brief`);
    const rawHtml = await res.text();
    const cleanHtml = decodeHtml(rawHtml);
    assert.ok(cleanHtml.includes('Problem Statement Not Found'), 'Must render not found page');
  });
});
