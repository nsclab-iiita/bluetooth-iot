import os
import sys
import json
import re
from pathlib import Path

def find_android_cves(android_version, db_path="db_temp", max_results=5):

    print("--------------------------"+ android_version+"----------------------")

    """
    Fast CVE lookup using existing database without downloading
    """
    print(f"Searching for CVEs related to: {android_version}")
    
    # Check if database exists
    if not os.path.exists(db_path):
        print("CVE database not found in db_temp")
        return []
    
    cve_matches = []
    
    # Extract version number for better matching
    version_match = re.search(r'(\d+)', android_version)
    version_num = version_match.group(1) if version_match else ""
    
    # Search keywords - more specific to avoid false positives
    search_terms = [
        f"android {version_num}",
        f"android {android_version.lower()}",
        "android bluetooth",
        "android system"
    ]
    
    print(f"Using search terms: {search_terms}")
    print(f"Scanning database in: {db_path}")
    
    files_scanned = 0
    
    # Walk through the database directory
    for root, dirs, files in os.walk(db_path):
        for file in files:
            if not file.endswith('.json') or file == 'metadata.json':
                continue
                
            files_scanned += 1
            if files_scanned % 1000 == 0:
                print(f"Scanned {files_scanned} files...")
            
            file_path = os.path.join(root, file)
            
            try:
                # Read and parse JSON
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read().lower()
                    
                    # Quick text search before JSON parsing for speed
                    if any(term in content for term in search_terms):
                        # Parse JSON to get proper CVE ID
                        try:
                            f.seek(0)
                            data = json.load(f)
                            
                            # Extract CVE ID
                            cve_id = None
                            if 'cveMetadata' in data and 'cveId' in data['cveMetadata']:
                                cve_id = data['cveMetadata']['cveId']
                            elif 'CVE_data_meta' in data and 'ID' in data['CVE_data_meta']:
                                cve_id = data['CVE_data_meta']['ID']
                            elif file.startswith('CVE-'):
                                cve_id = file.replace('.json', '')
                            
                            if cve_id and cve_id not in [match['id'] for match in cve_matches]:
                                cve_matches.append({
                                    'id': cve_id,
                                    'file': file,
                                    'relevance': sum(1 for term in search_terms if term in content)
                                })
                                
                                # Stop if we have enough matches
                                if len(cve_matches) >= max_results * 2:  # Get extra to sort by relevance
                                    break
                                    
                        except (json.JSONDecodeError, KeyError):
                            # If JSON parsing fails, try to extract from filename
                            if file.startswith('CVE-'):
                                cve_id = file.replace('.json', '')
                                if cve_id not in [match['id'] for match in cve_matches]:
                                    cve_matches.append({
                                        'id': cve_id,
                                        'file': file,
                                        'relevance': 1
                                    })
                            
            except Exception as e:
                continue
        
        # Break outer loop if we have enough
        if len(cve_matches) >= max_results * 2:
            break
    
    print(f"Total files scanned: {files_scanned}")
    print(f"Found {len(cve_matches)} potential CVE matches")
    
    # Sort by relevance and return top results
    cve_matches.sort(key=lambda x: x['relevance'], reverse=True)
    top_cves = cve_matches[:max_results]
    
    result = []
    for cve in top_cves:
        result.append(cve['id'])
        print(f"Found: {cve['id']} (relevance: {cve['relevance']})")
    
    return result

def main():
    if len(sys.argv) < 2:
        print("Usage: python fast_cve_lookup.py <android_version>")
        sys.exit(1)
    
    android_version = ' '.join(sys.argv[1:])
    
    # Change to the script directory to find db_temp
    script_dir = os.path.dirname(os.path.abspath(__file__))
    db_path = os.path.join(script_dir, 'db_temp')
    
    cves = find_android_cves(android_version, db_path)
    
    if cves:
        for cve_id in cves:
            print(f"{cve_id}.json")
    else:
        print("No relevant CVE entries found.")

if __name__ == "__main__":
    main()
