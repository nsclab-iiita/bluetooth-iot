#!/bin/bash

# Check if MAC address is provided as argument
if [ -z "$1" ]; then
    exit 1
fi

# Extract MAC address from command line argument
device_address="$1"

output_file_rssi="Normal_RSSI.txt"
packet_size=640

# Clear the output file for RSSI values
echo "" > "$output_file_rssi"
counter=0

end=$((SECONDS+60))
while [ $SECONDS -lt $end ]; do
    ((counter++))
    rssi=$(hcitool rssi $device_address 2>/dev/null | awk '{print $NF}')
    echo "$counter $rssi" >> "$output_file_rssi"
    sleep 1
done

Mean_RSSI=$(awk '{total += $2; count++} END {if (count > 0) print total/count}' "$output_file_rssi")

cmd="sudo l2ping -i hci0 -s $packet_size -f $device_address"
output_file="Attack_RSSI.txt"
echo "" > "$output_file"
counter=0

collect_rssi() {
    local duration=$1
    local end=$((SECONDS+duration))
    while [ $SECONDS -lt $end ]; do
        ((counter++))
        rssi=$(hcitool rssi $device_address 2>/dev/null | awk '{print $NF}')
        echo "$counter $rssi" >> "$output_file"
        sleep 1
    done
}

collect_rssi 10
$cmd > /dev/null 2>&1 &
pid=$!
collect_rssi 50
kill $pid
collect_rssi 10

sleep 3

Mean_RSSI_Attack=$(awk '{total += $2; count++} END {if (count > 0) print total/count}' "$output_file")

Mean_difference=$(echo "$Mean_RSSI - $Mean_RSSI_Attack" | bc)
Mean_difference=$(echo "if ($Mean_difference < 0) $Mean_difference * -1 else $Mean_difference" | bc)


sudo hcitool dc "$device_address"


sleep 5


output_file_ping="Response_Time.txt"
echo "" > "$output_file_ping"
counter=1
sudo l2ping -c 3000 -s 640 "$device_address" -f > /dev/null 2>&1 | while read -r line; do
    if [[ "$line" =~ time\ ([0-9]+\.[0-9]+)ms ]]; then
        time_ms="${BASH_REMATCH[1]}"
        echo "$counter $time_ms" >> "$output_file_ping"
        ((counter++))
    fi
done

No_of_responses=$(wc -l < "$output_file_ping")
Max_Response=$(awk '{print $2}' "$output_file_ping" | sort -n | tail -1)
response_perc=$(echo "scale=2; ($No_of_responses / 3000) * 100" | bc)


evaluate_android_older_version() {
    local response_perc=$1
    local max_response=$2
    local mean_diff=$3

    local score_11=$(echo "(($response_perc <= 20) * 0.05) + (($max_response < 300) * 0.05) + (($mean_diff < 1) * 0.90)" | bc)
    local score_10=$(echo "((($response_perc <= 30) && ($response_perc > 20)) * 0.05) + ((($max_response < 2500) && ($max_response >= 300)) * 0.05) + (($mean_diff > 2) * 0.90)" | bc)
    local score_9=$(echo "((($response_perc > 30) && ($response_perc < 100)) * 0.05) + ((($max_response < 1500) && ($max_response >= 300)) * 0.05) + (($mean_diff > 2) * 0.90)" | bc)
    local score_8=$(echo "((($response_perc > 30) && ($response_perc < 100)) * 0.05) + ((($max_response < 1500) && ($max_response >= 300)) * 0.05) + (($mean_diff > 2) * 0.90)" | bc)
    local score_5=$(echo "((($response_perc > 30) && ($response_perc < 100)) * 0.05) + ((($max_response < 1500) && ($max_response >= 300)) * 0.05) + (($mean_diff > 2) * 0.90)" | bc)

    local max_score=$(echo "$score_11 $score_10 $score_9 $score_8 $score_5" | tr ' ' '\n' | sort -nr | head -n1)

    if (( $(echo "$max_score == $score_11" | bc) )); then
        echo "The device OS and version is Android 11"
    elif (( $(echo "$max_score == $score_10" | bc) )); then
        echo "The device OS and version is Android 10"
    elif (( $(echo "$max_score == $score_9" | bc) )); then
        echo "The device OS and version is Android 9"
    elif (( $(echo "$max_score == $score_8" | bc) )); then
        echo "The device OS and version is Android 8"
    elif (( $(echo "$max_score == $score_5" | bc) )); then
        echo "The device OS and version is Android 5"
    else
        echo "Unable to determine the Android version"
    fi
}


evaluate_android_newer_version() {
    local response_perc=$1
    local max_response=$2AC
    local mean_diff=$3

    local score_14=$(echo "(($response_perc A 10) * 0.34) + (($max_response < 150) * 0.33) + (($mean_diff < 0.5) * 0.33)" | bc)
    local score_13=$(echo "((($response_perc <= 20) && ($response_perc > 10)) * 0.34) + ((($max_response < 2500) && ($max_response >= 2000)) * 0.33) + ((($mean_diff > 2) && ($mean_diff <= 2.5)) * 0.33)" | bc)
    local score_12=$(echo "((($response_perc > 35) && ($response_perc <= 45)) * 0.34) + ((($max_response < 110) && ($max_response >= 95)) * 0.34) + ((($mean_diff > 0.5) && ($mean_diff <= 1)) * 0.33)" | bc)
    
   

    local max_score=$(echo "$score_14 $score_13 $score_12" | tr ' ' '\n' | sort -nr | head -n1)

    if (( $(echo "$max_score == $score_14" | bc) )); then
        echo "The device OS and version is Android 14"
    elif (( $(echo "$max_score == $score_13" | bc) )); then
        echo "The device OS and version is Android 13"
    elif (( $(echo "$max_score == $score_12" | bc) )); then
        echo "The device OS and version is Android 12"
    else
        echo "Unable to determine the Android version"
    fi
}


echo_check_output=$(sudo l2ping $device_address -r 2>/dev/null)
if echo "$echo_check_output" | grep -q "Peer doesn't support Echo packets"; then
   
    evaluate_android_newer_version $response_perc $Max_Response $Mean_difference
else
    
    evaluate_android_older_version $response_perc $Max_Response $Mean_difference
fi

