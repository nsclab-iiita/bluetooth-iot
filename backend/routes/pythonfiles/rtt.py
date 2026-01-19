import subprocess
import sys
import re

def measure_rtt(device_address):
    try:
        # Run l2ping to measure round-trip time
        cmd = ['sudo', 'l2ping', '-i', 'hci0', '-c', '10', device_address]
        result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        
        # Initialize variables
        times = []
        
        # Process the output
        for line in result.stdout.splitlines():
            match = re.search(r'time (\d+\.\d+)ms', line)
            if match:
                times.append(float(match.group(1)))

        if times:
            avg_rtt = sum(times) / len(times)
            return f"Round-trip times: {times}\nAverage RTT: {avg_rtt:.2f} ms"
        else:
            return "Error: No RTT values found in the output."

    except Exception as e:
        return f"Exception: {str(e)}"

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python3 rtt.py <DEVICE_ADDRESS>")
        sys.exit(1)

    device_address = sys.argv[1]
    print(measure_rtt(device_address))
