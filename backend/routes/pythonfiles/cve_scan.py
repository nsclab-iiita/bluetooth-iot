import os
import requests
import zipfile
import shutil
import datetime
import sys

def should_update():
    """ Determine whether the CVE database needs an update based on the last update date. """
    if not os.path.exists("db_temp"):
        print("No database folder found. Needs update.")
        return True

    try:
        with open("last_updated_date.txt", "r") as file:
            last_updated_date = datetime.datetime.strptime(file.read().strip(), "%Y-%m-%d").date()
        return datetime.date.today() >= last_updated_date + datetime.timedelta(days=30)
    except (ValueError, FileNotFoundError):
        print("No update date found or invalid date format. Needs update.")
        return True

def update():
    """ Download and extract the latest CVE list from GitHub. """
    url = "https://github.com/CVEProject/cvelistV5/archive/refs/heads/main.zip"
    try:
        if os.path.exists("update.zip"):
            os.remove("update.zip")
            print("Old update file removed.")

        response = requests.get(url)
        response.raise_for_status()
        
        with open("update.zip", "wb") as file:
            file.write(response.content)
        print("Update downloaded successfully.")

        folder_name = "db_temp"
        if os.path.exists(folder_name):
            shutil.rmtree(folder_name)
            print("Old database folder removed.")
        
        os.makedirs(folder_name, exist_ok=True)
        with zipfile.ZipFile("update.zip", "r") as zip_ref:
            zip_ref.extractall(folder_name)
        print("Database extracted successfully.")

        os.remove("update.zip")
        return True
    except (requests.RequestException, zipfile.BadZipFile, OSError) as e:
        print(f"Update failed: {e}")
        return False

def find_cve(input_keyword):
    """ Scan the CVE database for entries matching the input keyword and return the top 5 recent entries. """
    if should_update():
        if not update():
            return "Failed to update CVE database. Please check your network connection and permissions."

    key_map = {}
    local_repo_path = "db_temp"
    
    for root, dirs, files in os.walk(local_repo_path):
        for file in files:
            if file.endswith('.json'):
                file_path = os.path.join(root, file)
                with open(file_path, 'r') as f:
                    file_content = f.read()
                    if input_keyword in file_content:
                        try:
                            date_str = file.split("-")[1]
                            file_date = datetime.datetime.strptime(date_str, "%Y%m%d")
                            key_map[file] = file_date
                            print(f"File {file} with date {date_str} added.")
                        except ValueError:
                            print(f"Date format error in file {file}. Skipping.")
    
    sorted_files = sorted(key_map.items(), key=lambda x: x[1], reverse=True)[:5]
    output = "\n".join(f"{fname} (Date: {date.date()})" for fname, date in sorted_files)
    return output if output else "No relevant CVE entries found."

def main():
    if len(sys.argv) < 2:
        print("Usage: python cve_scan.py <keyword>")
        sys.exit(1)

    input_keyword = ' '.join(sys.argv[1:])
    print(f"Searching for CVEs related to: {input_keyword}")
    output = find_cve(input_keyword)

    with open("output.txt", "w") as output_file:
        output_file.write(output)
        print("Output written to file.")
        
if __name__ == "__main__":
    main()

