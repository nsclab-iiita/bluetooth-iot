import os
import subprocess
import json
import re
import sys
import zipfile
from datetime import datetime, date, timedelta
import requests
import shutil

script_dir = os.path.dirname(os.path.abspath(__file__))
VERSION_FINDER_EXEC = os.path.join(script_dir, "version_finder")
CVE_UNZIP_DIR = "cvelistV5-main"
LAST_UPDATED_FILE = "last_updated.txt"

def should_update():
    if not os.path.exists(CVE_UNZIP_DIR) or not os.path.exists(LAST_UPDATED_FILE):
        print("[*] CVE database or update record not found. An update is required.")
        return True

    try:
        with open(LAST_UPDATED_FILE, "r") as file:
            last_updated_str = file.read().strip()
            last_updated_date = datetime.strptime(last_updated_str, "%Y-%m-%d").date()

        if date.today() >= last_updated_date + timedelta(days=30):
            print(f"[*] Database is older than 30 days (last updated: {last_updated_date}). An update is required.")
            return True
        else:
            print(f"[*] CVE database is up-to-date (last updated: {last_updated_date}).")
            return False
    except (ValueError, FileNotFoundError):
        print("[!] Invalid date format or file not found. An update is required.")
        return True

def update_database():
    url = "https://github.com/CVEProject/cvelistV5/archive/refs/heads/main.zip"
    temp_zip_file = "cve_update.zip"
    temp_extract_dir = "cve_temp_extract"

    print("[*] Starting CVE database update...")
    try:
        print(f"  → Downloading from {url}...")
        response = requests.get(url, stream=True)
        response.raise_for_status()
        with open(temp_zip_file, "wb") as file:
            for chunk in response.iter_content(chunk_size=8192):
                file.write(chunk)
        print("[+] Download complete.")

        if os.path.exists(CVE_UNZIP_DIR):
            shutil.rmtree(CVE_UNZIP_DIR)
        if os.path.exists(temp_extract_dir):
            shutil.rmtree(temp_extract_dir)

        print(f"  → Extracting '{temp_zip_file}'...")
        with zipfile.ZipFile(temp_zip_file, "r") as zip_ref:
            zip_ref.extractall(temp_extract_dir)
        print("[+] Extraction complete.")

        extracted_folder_name = os.listdir(temp_extract_dir)[0]
        source_path = os.path.join(temp_extract_dir, extracted_folder_name)
        shutil.move(source_path, CVE_UNZIP_DIR)
        print(f"[+] Database moved to '{CVE_UNZIP_DIR}'.")

        with open(LAST_UPDATED_FILE, "w") as file:
            file.write(date.today().strftime("%Y-%m-%d"))
        print("[+] Update successful. Timestamp recorded.")
        return True
    except (requests.RequestException, zipfile.BadZipFile, OSError, IndexError) as e:
        print(f"[!] FATAL: Database update failed: {e}")
        return False
    finally:
        if os.path.exists(temp_zip_file):
            os.remove(temp_zip_file)
        if os.path.exists(temp_extract_dir):
            shutil.rmtree(temp_extract_dir)

def get_android_version(mac_address: str) -> str | None:
    if not os.path.exists(VERSION_FINDER_EXEC):
        print(f"[!] Error: The C executable '{VERSION_FINDER_EXEC}' was not found.")
        return None

    print(f"[*] Running Bluetooth scan on {mac_address}...")
    try:
        result = subprocess.run(
            [VERSION_FINDER_EXEC, mac_address],
            capture_output=True, text=True, check=True, timeout=45
        )
        output = result.stdout
        print("--- Bluetooth Tool Output ---")
        print(output.strip())
        print("-----------------------------")

        match = re.search(r"Estimated Android Version: (.*?)\n", output)
        if match:
            full_version_string = match.group(1).strip()
            keyword = " ".join(full_version_string.split()[:2])
            print(f"[+] Found keyword for CVE search: '{keyword}'")
            return keyword
        else:
            print("[-] Could not determine Android version from the tool's output.")
            return None
    except Exception as e:
        print(f"[!] The Bluetooth tool failed: {e}")
        return None

def find_top_cves(input_keyword: str):
    found_cves = []
    local_cve_path = os.path.join(CVE_UNZIP_DIR, "cves")

    print(f"[*] Starting year-by-year scan for keyword: '{input_keyword}'...")

    try:
        year_dirs = [d for d in os.listdir(local_cve_path) if os.path.isdir(os.path.join(local_cve_path, d))]
        year_dirs.sort(reverse=True)
    except FileNotFoundError:
        print(f"[!] CVE path not found: {local_cve_path}")
        return "CVE database path not found."

    for year in year_dirs:
        print(f"  → Searching in year {year}...")
        year_path = os.path.join(local_cve_path, year)
        for root, _, files in os.walk(year_path):
            for file in files:
                if file.endswith('.json'):
                    file_path = os.path.join(root, file)
                    try:
                        with open(file_path, 'r', encoding='utf-8') as f:
                            content = f.read()
                            if input_keyword in content:
                                data = json.loads(content)
                                cve_id = data.get('cveMetadata', {}).get('cveId')
                                date_str = data.get('cveMetadata', {}).get('datePublished')
                                if cve_id and date_str:
                                    cve_date = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
                                    found_cves.append((cve_id, cve_date))
                    except Exception:
                        continue

        if len(found_cves) >= 3:
            print(f"[+] Found {len(found_cves)} total matches. Stopping search.")
            break

    if not found_cves:
        return "No relevant CVE entries found."

    sorted_cves = sorted(found_cves, key=lambda x: x[1], reverse=True)[:3]

    output_lines = [f"{cve_id} (Published: {cve_date.strftime('%Y-%m-%d')})" for cve_id, cve_date in sorted_cves]
    return "\n".join(output_lines)

def main():
    if len(sys.argv) != 2:
        print(f"Usage: python3 {sys.argv[0]} <Bluetooth_MAC_Address>")
        sys.exit(1)

    if should_update():
        if not update_database():
            print("[!] Could not update the CVE database. Please check your internet connection and permissions.")
            if not os.path.exists(CVE_UNZIP_DIR):
                sys.exit(1)

    mac_address = sys.argv[1]
    keyword = get_android_version(mac_address)

    if keyword:
        output = find_top_cves(keyword)
        print("\n--- CVE Scan Results ---")
        print(output)
        print("------------------------")

        with open("output.txt", "w") as output_file:
            output_file.write(output)
            print("\n[+] Results have been written to output.txt.")
    else:
        print("\n[!] Halting process as no Android version could be determined.")

if __name__ == "__main__":
    main()