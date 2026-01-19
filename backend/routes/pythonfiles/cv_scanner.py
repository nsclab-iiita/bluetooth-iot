import re
import os
import requests
import zipfile
import shutil
import datetime
import sys


def should_update():
    current_date = datetime.date.today()
    last_updated_date = None
    if not os.path.exists("db_temp"):
        return True
    if os.path.exists("last_updated_date.txt"):
        try:
            with open("last_updated_date.txt", "r") as file:
                last_updated_date = datetime.datetime.strptime(file.read().strip(), "%Y-%m-%d").date()
        except (ValueError, FileNotFoundError):
            last_updated_date = None
    if last_updated_date is None or current_date >= last_updated_date + datetime.timedelta(days=30):
        return True

    return False


def update():
    url = "https://github.com/CVEProject/cvelistV5/archive/refs/heads/main.zip"
    try:
        # Remove the existing update.zip if it exists
        if os.path.exists("update.zip"):
            os.remove("update.zip")
        # Download the zip file
        response = requests.get(url)
        response.raise_for_status()

        # Save the zip file
        with open("update.zip", "wb") as file:
            file.write(response.content)

        # Remove the old extracted folder if it exists
        folder_name = "db_temp"
        folder_path = os.path.join(os.getcwd(), folder_name)

        # Check if the folder exists
        if os.path.exists(folder_path):
            # Remove the folder
            shutil.rmtree(folder_path)

        if not os.path.exists(folder_name):
            os.makedirs(folder_name)

        # Extract the contents of update.zip into the db_temp folder
        with zipfile.ZipFile("update.zip", "r") as zip_ref:
            zip_ref.extractall(folder_name)

        os.remove("update.zip")

        return True

    except (requests.RequestException, zipfile.BadZipFile, OSError) as e:
        return False

def find_cve(input):
    try:
        # Update CVE database
        if should_update():
            updated = update()
            if updated:
                with open("last_updated_date.txt", "w") as file:
                    file.write(datetime.date.today().strftime("%Y-%m-%d"))

        keywords = [input]
        key_map = {}

        local_repo_path = "db_temp"

        for key in keywords:
            key_map[key] = []

        for root, dirs, files in os.walk(local_repo_path):
            for file in files:
                if file.endswith('.json'):
                    file_path = os.path.join(root, file)
                    file_name = os.path.basename(file)
                    with open(file_path, 'r') as f:
                        if file_name != "metadata.json":
                            file_content = f.read()
                            # Iterate over keywords
                            for keyss in key_map:
                                if keyss in file_content:
                                    key_map[keyss].append(file_name)

        # Collect results
        results = []
        for keyword, file_paths in key_map.items():
            for file_path in file_paths:
                results.append(file_path)
                
        # Format results for output
        out = ""
        for file_path in results:
            out += "  " + file_path + "\n"

        return out
    except Exception as e:
        return "An error occurred: " + str(e)


if len(sys.argv) < 2:
    sys.exit(1)

args = sys.argv
input = ' '.join(args[1:])
output = find_cve(input)

with open("output.txt", "w") as output_file:
    output_file.write(output)

print(output)
