
import json
import os

files_130_142 = [
    "20260102_132421_Page130.jpg", "20260102_132426_Page131.jpg", "20260102_132435_Page132.jpg",
    "20260102_132452_Page133.jpg", "20260102_132503_Page134.jpg", "20260102_132527_Page135.jpg",
    "20260102_132559_Page136.jpg", "20260102_132615_Page137.jpg", "20260102_132643_Page138.jpg",
    "20260102_132656_Page139.jpg", "20260102_132736_Page140.jpg", "20260102_132745_Page141.jpg",
    "20260102_132756_Page142.jpg"
]

files_143_162 = [
    "20260102_132810_Page143.jpg", "20260102_132819_Page144.jpg", "20260102_132820_Page145.jpg",
    "20260102_132831_Page146.jpg", "20260102_132839_Page147.jpg", "20260102_132848_Page148.jpg",
    "20260102_132856_Page149.jpg", "20260102_132911_Page150.jpg", "20260102_132923_Page151.jpg",
    "20260102_132931_Page152.jpg", "20260102_132950_Page153.jpg", "20260102_133001_Page154.jpg",
    "20260102_133009_Page155.jpg", "20260102_133018_Page156.jpg", "20260102_133029_Page157.jpg",
    "20260102_133037_Page158.jpg", "20260102_133044_Page159.jpg", "20260102_133050_Page160.jpg",
    "20260102_133057_Page161.jpg", "20260102_133104_Page162.jpg"
]

def create_entries(file_list, group_name):
    entries = []
    for f in file_list:
        entry = {
            "file_name": f,
            "book_page_number": "TBD",
            "taxonomic_group": group_name,
            "visual_census": {
                "total_entities": 0,
                "distinct_species": 0,
                "notes": "TODO: Visual Census Required"
            },
            "biological_entities": []
        }
        entries.append(entry)
    return entries

recovery_data = create_entries(files_130_142, "Diptera & Arthropods (Recovery)")
completion_data = create_entries(files_143_162, "Pending Scope (New Ingest)")

base_path = r"g:\その他のパソコン\マイ ノートパソコン\antigravity\ikimon\ikimon.life\upload_package\data\legacy_ingest"

with open(os.path.join(base_path, "temp_batch_130_142_recovery.json"), "w", encoding="utf-8") as f:
    json.dump(recovery_data, f, indent=4, ensure_ascii=False)

with open(os.path.join(base_path, "temp_batch_143_162_completion.json"), "w", encoding="utf-8") as f:
    json.dump(completion_data, f, indent=4, ensure_ascii=False)

print("Files generated successfully.")
