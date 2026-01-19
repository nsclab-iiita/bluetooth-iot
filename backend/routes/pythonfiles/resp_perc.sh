#!/bin/bash

# Check if MAC address is provided
if [ -z "$1" ]; then
    echo "Usage: sudo bash response_percentage.sh <MAC>"
    exit 1
fi

# Define the device address and output file for ping responses
device_address="$1"
output_file_ping="Response_Time.txt"

# Clear the output file
echo "" > "$output_file_ping"

# Initialize counter
counter=1

echo "Pinging the device and recording responses..."

# Run l2ping to send 3000 packets and capture response times
sudo l2ping -c 3000 -s 640 "$device_address" -f | while read -r line; do
    if [[ "$line" =~ time\ ([0-9]+\.[0-9]+)ms ]]; then
        time_ms="${BASH_REMATCH[1]}"
        echo "$counter $time_ms" >> "$output_file_ping"
        ((counter++))
    fi
done

# Calculate the number of responses and response percentage
No_of_responses=$(wc -l < "$output_file_ping")
response_perc=$(echo "scale=2; ($No_of_responses / 3000) * 100" | bc)

echo ""
echo "Total Responses: $No_of_responses"
echo "Response Percentage: $response_perc%"
