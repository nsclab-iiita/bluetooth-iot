import subprocess
import sys
import re
import os # Import the 'os' module

def measure_rtt(device_address):
    try:
        # --- THIS IS THE FIX ---
        # Get the absolute path of the directory where this script is located
        script_dir = os.path.dirname(os.path.abspath(__file__))
        # Combine the directory path with the executable's name
        executable_path = os.path.join(script_dir, 'my_l2ping')

        # Use the absolute path in the command
        cmd = ['sudo', executable_path, '-i', 'hci0', '-c', '10', device_address]
        
        result = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )

        times = []
        for line in result.stdout.splitlines():
            # The regex from our last fix (with a space before "ms")
            match = re.search(r'time (\d+\.\d+) ms', line)
            if match:
                times.append(float(match.group(1)))

        if times:
            avg_rtt = sum(times) / len(times)
            return f"Round-trip times: {times}\nAverage RTT: {avg_rtt:.2f} ms"
        else:
            error_output = result.stderr.strip()
            if error_output:
                return f"Error: No RTT values found. Stderr: '{error_output}'"
            else:
                return "Error: No RTT values found in the output."

    except Exception as e:
        return f"An unexpected error occurred: {str(e)}"

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(f"Usage: python3 {sys.argv[0]} <DEVICE_ADDRESS>")
        sys.exit(1)

    device_address = sys.argv[1]
    print(measure_rtt(device_address))