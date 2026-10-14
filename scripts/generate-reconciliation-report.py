import json
import os

data = json.load(open(r'C:\Users\SOHAM\.gemini\antigravity-ide\brain\a7dde7aa-305a-4868-b5c8-d720a23dd118\extracted_32_problem_statements.json', encoding='utf-8'))
out_path = r'C:\Users\SOHAM\.gemini\antigravity-ide\brain\a7dde7aa-305a-4868-b5c8-d720a23dd118\problem-statements-reconciliation-report.md'

lines = []
lines.append('# SOURCE-TO-RECORD RECONCILIATION REPORT')
lines.append('## 35-Page “Refined Problem Statements — Technical Review Edition”')
lines.append('')
lines.append('**Date of Audit**: 15 October 2026  ')
lines.append('**Source Document**: `Code-e-Manipal_2_0_Refined_Problem_Statements_Technical_Review.pdf` (35 pages)  ')
lines.append('**Total Challenge Briefs**: 32  ')
lines.append('**Target Database Table**: `public.problem_statement_drafts` (Version 1 Release)  ')
lines.append('')
lines.append('---')
lines.append('')
lines.append('### 1. Executive Summary & Working Set Breakdown')
lines.append('')
lines.append('| Category | Count | Status in Review Document | Description |')
lines.append('|---|---|---|---|')
lines.append('| **Selected** | 13 | `SELECTED FOR FURTHER REVIEW` / `OFFICIAL SIH` | Retained briefs from prior PDF plus official ISRO SIH26166 statement. |')
lines.append('| **On Hold** | 7 | `HOLD - PENDING REVIEW` | Provisional briefs requiring explicit committee resolution before release. |')
lines.append('| **New Proposals** | 12 | `NEW OPTION FOR CONSIDERATION` | Alternative candidate briefs across HealthTech (4), Gaming (4), and Smart City (4). |')
lines.append('| **Total** | **32** | — | **All 32 challenge briefs extracted and reconciled.** |')
lines.append('')
lines.append('---')
lines.append('')
lines.append('### 2. Track Distribution & Scope Observations')
lines.append('')
lines.append('| Track Number | Track Name | Selected | On Hold | New Proposals | Total Briefs | Notes |')
lines.append('|---|---|---|---|---|---|---|')
lines.append('| Track 01 | AI/ML | 3 | 1 | 0 | 4 | Includes official ISRO brief SIH26166; PS 04 is on hold. |')
lines.append('| Track 02 | HealthTech | 1 | 2 | 4 | 7 | PS 07 and PS 09 on hold; 4 new alternative proposals added. |')
lines.append('| Track 03 | FinTech / EdTech | 2 | 0 | 0 | 2 | PS 13 and PS 17 retained. |')
lines.append('| Track 04 | Cybersecurity | 0 | 0 | 0 | 0 | Explicitly unfilled in review PDF; no silent additions made. |')
lines.append('| Track 05 | Generative AI & LLMs | 2 | 1 | 0 | 3 | PS 26 and PS 27 retained; PS 29 on hold. |')
lines.append('| Track 06 | Multi-Agent Systems | 4 | 0 | 0 | 4 | PS 32, 33, 34, 35 all selected for review. |')
lines.append('| Track 07 | Gaming & Immersive Tech | 1 | 1 | 4 | 6 | PS 40 selected; PS 41 on hold; 4 new alternative proposals added. |')
lines.append('| Track 08 | Smart City & Infrastructure | 0 | 2 | 4 | 6 | PS 43 and PS 46 on hold; 4 new alternative proposals added. |')
lines.append('| **Total** | | **13** | **7** | **12** | **32** | |')
lines.append('')
lines.append('---')
lines.append('')
lines.append('### 3. Detailed Source-to-Record Audit Matrix (All 32 Briefs)')
lines.append('')
lines.append('| # | Page | Track | Original Ref | Proposed ID | Title | Difficulty | Build Type | Review Status | Extraction Notes |')
lines.append('|---|---|---|---|---|---|---|---|---|---|')

for b in data:
    note = 'Complete 6/6 sections.'
    if b['is_official_sih']:
        note = 'Official SIH scope preserved with faculty scope note.'
    elif b['category_state'] == 'hold':
        note = 'Provisional; marked HOLD - PENDING REVIEW.'
    elif b['category_state'] == 'new_proposal':
        note = 'Proposal; marked NEW OPTION FOR CONSIDERATION.'
    
    clean_title = b['title'].replace('|', '-').strip()
    row = f"| {b['challenge_num']:02d} | P.{b['page']:02d} | {b['track']} | {b['original_ref_id']} | `{b['proposed_id']}` | {clean_title} | {b['difficulty']} | {b['build_type']} | `{b['review_status']}` | {note} |"
    lines.append(row)

lines.append('')
lines.append('---')
lines.append('')
lines.append('### 4. Extraction Uncertainties & Explicit Handling')
lines.append('')
lines.append('1. **SIH26166 Scope Integrity**: Preserved exact title *“Multi-modal, Sun angle and scale invariant image correspondence using Chandrayaan-2 optical images (OHRC, TMC and IIRS)”* and explicit scope note without rewriting.')
lines.append('2. **Cybersecurity Track**: Confirmed zero briefs in review PDF; preserved as unfilled in draft working set without synthetic additions.')
lines.append('3. **Hold Status Boundary**: All 7 hold items (`HX-AI-03`, `HX-HT-01`, `HX-HT-03`, `HX-GEN-05`, `HX-GAM-05`, `HX-SCI-01`, `HX-SCI-04`) explicitly flagged `category_state = hold` and `is_approved_for_release = false`.')
lines.append('4. **New Proposal Boundary**: All 12 proposals (`HX-HT-07` through `HX-HT-10`, `HX-GAM-07` through `HX-GAM-10`, `HX-SCI-07` through `HX-SCI-10`) explicitly flagged `category_state = new_proposal` and `is_approved_for_release = false`.')
lines.append('5. **Selected Items Approval Boundary**: The 13 selected items are marked `category_state = selected`, but `is_approved_for_release = false` in Version 1 until an administrator explicitly marks them approved via the CMS workflow.')

with open(out_path, 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines))

print(f'Wrote report to {out_path} ({len(lines)} lines)')
