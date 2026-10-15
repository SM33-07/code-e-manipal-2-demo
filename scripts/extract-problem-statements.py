import pypdf
import re
import json
import os

pdf_path = r'C:\Users\SOHAM\.gemini\antigravity-ide\brain\a7dde7aa-305a-4868-b5c8-d720a23dd118\Code-e-Manipal_2_0_Refined_Problem_Statements_Technical_Review.pdf'
reader = pypdf.PdfReader(pdf_path)

briefs = []

for page_idx in range(2, 34):
    page_num = page_idx + 1
    raw_text = reader.pages[page_idx].extract_text()
    lines = [l.strip() for l in raw_text.split('\n') if l.strip()]

    # Find challenge header
    header_line = ''
    for l in lines:
        if 'CHALLENGE' in l and 'OF 32' in l:
            header_line = l
            break

    track_match = re.search(r'TRACK\s+(\d+)\s*/\s*([^\x7f]+)[\s\x7f]+CHALLENGE\s+(\d+)\s+OF\s+32', header_line)
    track_num = track_match.group(1) if track_match else ''
    track_name = track_match.group(2).strip() if track_match else ''
    challenge_num = int(track_match.group(3)) if track_match else (page_idx - 1)

    # Reference line (PS XX / ... or NEW OPTION / ...)
    ref_line = ''
    ref_idx = -1
    for idx, l in enumerate(lines[:12]):
        if l.startswith('PS ') or l.startswith('NEW OPTION'):
            ref_line = l
            ref_idx = idx
            break

    # Original ref ID & proposed/official ID
    orig_ref = ''
    proposed_id = ''
    if ref_line.startswith('PS '):
        parts = ref_line.split('/')
        orig_ref = parts[0].strip() # e.g. "PS 01"
        proposed_id = parts[1].strip() if len(parts) > 1 else '' # e.g. "SIH26166" or "HX-AI-01"
    elif ref_line.startswith('NEW OPTION'):
        parts = ref_line.split('/')
        orig_ref = parts[0].strip() # "NEW OPTION"
        proposed_id = parts[1].strip() if len(parts) > 1 else '' # e.g. "HX-HT-07"

    # Find LEVEL line
    level_line = ''
    level_idx = -1
    for idx in range(ref_idx + 1, len(lines)):
        if lines[idx].startswith('LEVEL'):
            level_line = lines[idx]
            level_idx = idx
            break

    # Title is between ref_idx and level_idx
    title_lines = lines[ref_idx + 1:level_idx]
    title = ' '.join(title_lines).strip()

    # Parse LEVEL, BUILD, and REVIEW STATUS from level_line
    # Format: LEVEL <diff> [sep] BUILD <build> [sep] <status>
    # Note: separator can be multiple spaces or \x7f
    tokens = [t.strip() for t in re.split(r'[\x7f\s]{2,}', level_line) if t.strip()]
    difficulty = 'Advanced'
    build_type = 'Software'
    review_status = 'SELECTED FOR FURTHER REVIEW'

    for tok in tokens:
        if tok.startswith('LEVEL'):
            difficulty = tok.replace('LEVEL', '').strip()
        elif tok.startswith('BUILD'):
            build_type = tok.replace('BUILD', '').strip()
        elif any(k in tok for k in ['OFFICIAL', 'SELECTED', 'HOLD', 'NEW OPTION']):
            review_status = tok.strip()

    # Standardize category / review category:
    # 1. 'selected': SELECTED FOR FURTHER REVIEW or OFFICIAL SIH / FACULTY REQUESTED
    # 2. 'hold': HOLD - PENDING REVIEW
    # 3. 'new_proposal': NEW OPTION FOR CONSIDERATION
    is_hold = 'HOLD' in review_status
    is_new = 'NEW OPTION' in ref_line or 'NEW OPTION' in review_status
    is_official = 'OFFICIAL' in review_status
    
    category_state = 'hold' if is_hold else ('new_proposal' if is_new else 'selected')

    # Parse sections from the remainder of text
    # Sections in order:
    # Scope note (optional)
    # PROBLEM STATEMENT
    # IMPLEMENTATION CHALLENGE
    # MINIMUM ACCEPTABLE PROTOTYPE
    # EVALUATION / FAILURE TESTS
    # STRETCH / DIFFERENTIATOR
    # SUGGESTED PUBLIC-SECTOR RELEVANCE
    # BUILD THE PROOF / TEST FAILURE CASES / SHOW YOUR EVIDENCE (footer)

    body_text = '\n'.join(lines[level_idx + 1:])
    # Strip footer
    body_text = re.sub(r'BUILD THE PROOF\s*/\s*TEST FAILURE CASES\s*/\s*SHOW YOUR EVIDENCE', '', body_text, flags=re.IGNORECASE).strip()

    section_headers = [
        ('scope_note', r'Scope note\s*[-–—]'),
        ('problem_statement', r'PROBLEM STATEMENT'),
        ('implementation_challenge', r'IMPLEMENTATION CHALLENGE'),
        ('minimum_prototype', r'MINIMUM ACCEPTABLE PROTOTYPE'),
        ('evaluation_tests', r'EVALUATION\s*/\s*FAILURE TESTS'),
        ('stretch_differentiator', r'STRETCH\s*/\s*DIFFERENTIATOR'),
        ('public_sector_relevance', r'SUGGESTED PUBLIC-SECTOR RELEVANCE'),
    ]

    # Find positions of each header
    positions = []
    for key, pattern in section_headers:
        m = re.search(pattern, body_text)
        if m:
            positions.append((m.start(), m.end(), key))

    positions.sort(key=lambda x: x[0])

    sections = {
        'scope_note': '',
        'problem_statement': '',
        'implementation_challenge': '',
        'minimum_prototype': '',
        'evaluation_tests': '',
        'stretch_differentiator': '',
        'public_sector_relevance': '',
    }

    # Extract text between sections
    for i in range(len(positions)):
        start_content = positions[i][1]
        end_content = positions[i + 1][0] if i + 1 < len(positions) else len(body_text)
        key = positions[i][2]
        content = body_text[start_content:end_content].strip()
        # Clean newlines inside paragraphs into single spaces while preserving real paragraphs
        cleaned = re.sub(r'(?<!\n)\n(?!\n)', ' ', content).strip()
        sections[key] = cleaned

    brief = {
        'challenge_num': challenge_num,
        'page': page_num,
        'track_num': track_num,
        'track': track_name,
        'original_ref_id': orig_ref,
        'proposed_id': proposed_id,
        'title': title,
        'difficulty': difficulty,
        'build_type': build_type,
        'review_status': review_status,
        'category_state': category_state,
        'is_official_sih': is_official,
        'scope_note': sections['scope_note'],
        'problem_statement': sections['problem_statement'],
        'implementation_challenge': sections['implementation_challenge'],
        'minimum_acceptable_prototype': sections['minimum_prototype'],
        'evaluation_tests': sections['evaluation_tests'],
        'stretch_differentiator': sections['stretch_differentiator'],
        'suggested_public_sector_relevance': sections['public_sector_relevance'],
    }
    briefs.append(brief)

# Output summary
print(f'Total briefs parsed: {len(briefs)}')
categories = {}
tracks = {}
for b in briefs:
    categories[b['category_state']] = categories.get(b['category_state'], 0) + 1
    tracks[b['track']] = tracks.get(b['track'], 0) + 1

print('\nCategory State Breakdown:')
for k, v in categories.items():
    print(f'  {k}: {v}')

print('\nTrack Breakdown:')
for k, v in tracks.items():
    print(f'  {k}: {v}')

out_json = r'C:\Users\SOHAM\.gemini\antigravity-ide\brain\a7dde7aa-305a-4868-b5c8-d720a23dd118\extracted_32_problem_statements.json'
with open(out_json, 'w', encoding='utf-8') as f:
    json.dump(briefs, f, indent=2, ensure_ascii=False)

print(f'\nWrote JSON to {out_json}')
