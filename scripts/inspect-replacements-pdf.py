from pypdf import PdfReader
import json

reader = PdfReader("data/Codee_Manipal_Final_Problem_Statements_35_Weak_Replacements.pdf")
print("Total pages in PDF:", len(reader.pages))

target_pages = [5, 10, 12, 20, 33] # 0-indexed for pages 6, 11, 13, 21, 34
results = {}

for p in target_pages:
    text = reader.pages[p].extract_text()
    results[p + 1] = text
    print(f"\n================ PAGE {p + 1} ================")
    print(text[:400])
    print("...")
    print(text[-300:])

with open("data/extracted_5_replacement_raw.json", "w", encoding="utf-8") as f:
    json.dump(results, f, indent=2, ensure_ascii=False)
