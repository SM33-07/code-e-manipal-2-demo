import re
import json
import pypdf

PDF_PATH = 'data/Codee_Manipal_Revised_Problem_Statements_35.pdf'
OUTPUT_JSON = 'data/final_35_problem_statements.json'

def slugify(text):
    text = text.lower()
    text = re.sub(r'[^a-z0-9]+', '-', text)
    return text.strip('-')

def clean_bullets(text):
    # Splits on bullet markers: '\n- ' or '\n-\n' or '\n-\s*'
    parts = re.split(r'\n+-\s*\n+|\n+-\s+', '\n' + text.strip())
    bullets = []
    for p in parts:
        cleaned = ' '.join(p.split()).strip()
        if cleaned and cleaned != '-':
            if cleaned.startswith('- '):
                cleaned = cleaned[2:].strip()
            bullets.append(cleaned)
    return bullets

def format_track_name(raw_track):
    raw = raw_track.strip().upper()
    track_map = {
        'AI/ML & EARTH OBSERVATION': 'AI/ML & Earth Observation',
        'HEALTHTECH': 'HealthTech',
        'FINTECH / EDTECH / LEGALTECH': 'FinTech / EdTech / LegalTech',
        'CYBERSECURITY': 'Cybersecurity',
        'GENERATIVE AI & LLM SYSTEMS': 'Generative AI & LLM Systems',
        'MULTI-AGENT SYSTEMS / LOGISTICS': 'Multi-Agent Systems / Logistics',
        'GAMING & IMMERSIVE TECH': 'Gaming & Immersive Tech',
        'SMART CITY & INFRASTRUCTURE': 'Smart City & Infrastructure',
        'OPEN INNOVATION IN HARDWARE': 'Open Innovation in Hardware',
    }
    return track_map.get(raw, raw.title())

def format_build_type(raw_bt):
    raw = raw_bt.strip().upper()
    bt_map = {
        'SOFTWARE': 'Software',
        'HARDWARE + SOFTWARE': 'Hardware + Software',
        'SOFTWARE / GEOSPATIAL': 'Software / Geospatial',
        'SOFTWARE / SIMULATION': 'Software / Simulation',
        'SOFTWARE + OPTIONAL DRONE HARDWARE': 'Software + Optional Drone Hardware',
        'SOFTWARE + OPTIONAL EDGE HARDWARE': 'Software + Optional Edge Hardware',
        'SOFTWARE ANALYTICS WORKBENCH': 'Software Analytics Workbench',
        'SOFTWARE + OPTIONAL LOCAL HARDWARE AGENT': 'Software + Optional Local Hardware Agent',
        'SOFTWARE / LOCAL UTILITY': 'Software / Local Utility',
        'SOFTWARE + OPTIONAL IOT SENSOR': 'Software + Optional IoT Sensor',
        'SOFTWARE SIMULATION + OPTIONAL MAP UI': 'Software Simulation + Optional Map UI',
        'HARDWARE + SOFTWARE OPTIONAL': 'Hardware + Software Optional',
    }
    return bt_map.get(raw, raw.title())

def main():
    reader = pypdf.PdfReader(PDF_PATH)
    total_pages = len(reader.pages)
    print(f'Opened {PDF_PATH} with {total_pages} pages.')

    records = []

    for page_idx in range(1, 36):
        page_text = reader.pages[page_idx].extract_text()

        # Track
        track_m = re.search(r'TRACK\s+(\d+)\s*\|\s*([^\n\r]+)', page_text, re.IGNORECASE)
        track_num = int(track_m.group(1)) if track_m else 0
        raw_track_name = track_m.group(2).strip() if track_m else 'Open Innovation'
        track_name = format_track_name(raw_track_name)
        track_label = f'Track {track_num:02d}'

        # PS ID
        ps_m = re.search(r'PS\s*(\d+)\s*/\s*35', page_text, re.IGNORECASE)
        ps_num = int(ps_m.group(1)) if ps_m else page_idx
        ps_id = f'PS {ps_num:02d}'

        # Build Type
        bt_m = re.search(r'BUILD TYPE\s*\|\s*([^\n\r]+)', page_text, re.IGNORECASE)
        raw_bt = bt_m.group(1).strip() if bt_m else 'Software'
        build_type = format_build_type(raw_bt)

        # Title
        title_m = re.search(r'BUILD TYPE\s*\|[^\n\r]+\n+(.*?)\n+PROBLEM STATEMENT', page_text, re.DOTALL | re.IGNORECASE)
        raw_title = title_m.group(1).strip() if title_m else ''
        title = ' '.join(raw_title.split())

        # Slug
        slug = f"ps-{ps_num:02d}-{slugify(title)}"

        # Problem Statement
        ps_text_m = re.search(r'PROBLEM STATEMENT\n+(.*?)\n+DESCRIPTION\s*/\s*IMPLEMENTATION', page_text, re.DOTALL | re.IGNORECASE)
        problem_statement = ' '.join(ps_text_m.group(1).split()) if ps_text_m else ''

        # Description / Implementation
        desc_m = re.search(r'DESCRIPTION\s*/\s*IMPLEMENTATION\n+(.*?)\n+DELIVERABLES', page_text, re.DOTALL | re.IGNORECASE)
        desc_raw = desc_m.group(1).strip() if desc_m else ''
        desc_bullets = clean_bullets(desc_raw)
        description_implementation = '\n\n'.join(f'• {b}' for b in desc_bullets)

        # Deliverables
        deliv_m = re.search(r'DELIVERABLES\n+(.*?)(?:\n+\d+\s*/\s*35|\Z)', page_text, re.DOTALL | re.IGNORECASE)
        deliv_raw = deliv_m.group(1).strip() if deliv_m else ''
        deliv_bullets = clean_bullets(deliv_raw)
        deliverables = '\n\n'.join(f'• {b}' for b in deliv_bullets)

        # Additional Guidance extraction for tagged statements
        additional_guidance = {}
        implementation_challenge = description_implementation
        minimum_acceptable_prototype = deliverables
        evaluation_tests = ''
        stretch_differentiator = ''
        suggested_public_sector_relevance = None

        for b in desc_bullets:
            b_lower = b.lower()
            if b_lower.startswith('implementation challenge:'):
                val = b.split(':', 1)[1].strip()
                implementation_challenge = val
                additional_guidance['implementation_challenge'] = val
            elif b_lower.startswith('evaluation / failure tests:') or b_lower.startswith('evaluation / failure test:'):
                val = b.split(':', 1)[1].strip()
                evaluation_tests = val
                additional_guidance['evaluation_tests'] = val
            elif b_lower.startswith('stretch / differentiator:') or b_lower.startswith('stretch / differentiators:'):
                val = b.split(':', 1)[1].strip()
                stretch_differentiator = val
                additional_guidance['stretch_differentiator'] = val
            elif b_lower.startswith('suggested public-sector relevance:') or b_lower.startswith('suggested public sector relevance:'):
                val = b.split(':', 1)[1].strip()
                suggested_public_sector_relevance = val
                additional_guidance['suggested_public_sector_relevance'] = val

        for b in deliv_bullets:
            b_lower = b.lower()
            if b_lower.startswith('minimum acceptable prototype:'):
                val = b.split(':', 1)[1].strip()
                minimum_acceptable_prototype = val
                additional_guidance['minimum_acceptable_prototype'] = val

        # Ensure fallback for required database NOT NULL columns
        if not evaluation_tests:
            # Check if any bullet mentions test / evaluation
            test_bullets = [b for b in desc_bullets if 'test' in b.lower() or 'evaluat' in b.lower()]
            evaluation_tests = test_bullets[0] if test_bullets else desc_bullets[-1] if desc_bullets else 'Adhere to technical review and baseline evaluation protocols.'
        if not stretch_differentiator:
            stretch_bullets = [b for b in desc_bullets if 'stretch' in b.lower() or 'unseen' in b.lower() or 'noise' in b.lower()]
            stretch_differentiator = stretch_bullets[0] if stretch_bullets else 'Demonstrate edge-case resilience beyond standard baseline parameters.'

        record = {
            'challenge_num': ps_num,
            'proposed_id': ps_id,
            'original_ref_id': ps_id,
            'slug': slug,
            'title': title,
            'track_num': track_label,
            'track': track_name,
            'build_type': build_type,
            'difficulty': 'Advanced',
            'review_status': 'FINAL SHORTLIST',
            'category_state': 'selected',
            'is_approved_for_release': True,
            'is_official_sih': False,
            'scope_note': f"{build_type} challenge in {track_name}.",
            'problem_statement': problem_statement,
            'description_implementation': description_implementation,
            'description_bullets': desc_bullets,
            'deliverables': deliverables,
            'deliverables_bullets': deliv_bullets,
            'implementation_challenge': implementation_challenge,
            'minimum_acceptable_prototype': minimum_acceptable_prototype,
            'evaluation_tests': evaluation_tests,
            'stretch_differentiator': stretch_differentiator,
            'suggested_public_sector_relevance': suggested_public_sector_relevance,
            'additional_guidance': additional_guidance,
            'display_order': ps_num,
        }
        records.append(record)

    assert len(records) == 35, f'Expected 35 records, got {len(records)}'

    # Validate all 35 IDs PS 01..PS 35 are present
    expected_ids = [f'PS {i:02d}' for i in range(1, 36)]
    actual_ids = [r['proposed_id'] for r in records]
    assert actual_ids == expected_ids, f'Mismatch in IDs: {set(expected_ids) - set(actual_ids)}'

    # Validate tracks
    unique_tracks = set(r['track'] for r in records)
    print(f'Validated 35 problem statements across {len(unique_tracks)} tracks:')
    for t in sorted(unique_tracks):
        cnt = sum(1 for r in records if r['track'] == t)
        print(f'  - {t}: {cnt} statements')

    with open(OUTPUT_JSON, 'w', encoding='utf-8') as f:
        json.dump(records, f, indent=2, ensure_ascii=False)
    print(f'Saved extracted data to {OUTPUT_JSON}.')

if __name__ == '__main__':
    main()
