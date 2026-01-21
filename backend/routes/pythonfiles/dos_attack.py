import subprocess
import sys
import os

def l2cap_practice(target_addr):
    packet_size = 150   # Bluetooth ear devices have much shorter message length space than bigger devices like phone or laptop
    count = 1000         # Number of pings to send

    script_dir = os.path.dirname(os.path.realpath(__file__))
    mini_l2ping_path = os.path.join(script_dir, "mini_l2ping")

    cmd = ["sudo", mini_l2ping_path, target_addr, str(packet_size), str(count)]

    print(f"[*] Running: {' '.join(cmd)}")
    try:
        subprocess.run(cmd, check=True)
        print("[+] mini_l2ping completed successfully.")
    except subprocess.CalledProcessError as e:
        print(f"[-] Error running mini_l2ping: {e}")
    except FileNotFoundError:
        print("[-] Error: mini_l2ping executable not found.")

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(f"Usage: {sys.argv[0]} <target_mac_address>")
        sys.exit(1)
    target_mac = sys.argv[1].strip()
    l2cap_practice(target_mac)
