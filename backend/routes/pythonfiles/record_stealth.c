#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <signal.h>
#include <sys/wait.h>

pid_t record_pid = 0;
int null_sink_module = -1;
int loopback_module = -1;

void cleanup() {
    fprintf(stderr, "\n[*] Cleaning up...\n");
    if (record_pid > 0) {
        kill(record_pid, SIGTERM);
        waitpid(record_pid, NULL, 0);
    }
    if (loopback_module > 0) {
        char cmd[256];
        snprintf(cmd, sizeof(cmd), "pactl unload-module %d 2>/dev/null", loopback_module);
        system(cmd);
    }
    if (null_sink_module > 0) {
        char cmd[256];
        snprintf(cmd, sizeof(cmd), "pactl unload-module %d 2>/dev/null", null_sink_module);
        system(cmd);
    }
    fprintf(stderr, "[*] Done.\n");
    exit(0);
}

void handle_sigint(int sig) {
    (void)sig;
    cleanup();
}

void mac_to_sink(const char *mac, char *out, size_t size) {
    snprintf(out, size, "bluez_output.");
    size_t used = strlen(out);
    for (size_t i = 0; i < strlen(mac) && used + 2 < size; ++i) {
        if (mac[i] == ':') out[used++] = '_';
        else out[used++] = mac[i];
        out[used] = '\0';
    }
    strncat(out, ".1", size - used - 1);
}

static int run_popen_parse_int(const char *cmd) {
    FILE *fp = popen(cmd, "r");
    if (!fp) return -1;
    int val = -1;
    if (fscanf(fp, "%d", &val) != 1) val = -1;
    pclose(fp);
    return val;
}

/* Find the actual Bluetooth sink name */
static int find_bt_sink(const char *mac_pattern, char *sink_out, size_t size) {
    char cmd[512];
    snprintf(cmd, sizeof(cmd), "pactl list short sinks | grep -i '%s'", mac_pattern);
    
    FILE *fp = popen(cmd, "r");
    if (!fp) return 0;
    
    char line[512];
    if (fgets(line, sizeof(line), fp)) {
        /* Format: "INDEX\tNAME\tMODULE\tFORMAT\tSTATE" */
        /* We need to extract the NAME (second column) */
        char *first_tab = strchr(line, '\t');
        if (!first_tab) {
            pclose(fp);
            return 0;
        }
        
        /* Skip the index, move to name */
        char *name_start = first_tab + 1;
        char *second_tab = strchr(name_start, '\t');
        if (!second_tab) {
            pclose(fp);
            return 0;
        }
        
        /* Extract the name */
        size_t name_len = second_tab - name_start;
        if (name_len >= size) name_len = size - 1;
        strncpy(sink_out, name_start, name_len);
        sink_out[name_len] = '\0';
        
        pclose(fp);
        return 1;
    }
    pclose(fp);
    return 0;
}

/* Check if a source exists */
static int source_exists(const char *source_name) {
    char cmd[512];
    snprintf(cmd, sizeof(cmd), "pactl list short sources | grep -q '%s'", source_name);
    return system(cmd) == 0;
}

int main(int argc, char *argv[]) {
    if (argc != 3) {
        fprintf(stderr, "Usage: %s <PHONE_MAC> <EARBUDS_MAC>\n", argv[0]);
        fprintf(stderr, "Example: %s 7C:F0:E5:89:66:7A BB:C9:6C:47:57:EB\n", argv[0]);
        return 1;
    }

    const char *phone_mac = argv[1];
    const char *buds_mac = argv[2];

    fprintf(stderr, "[*] Phone MAC: %s\n", phone_mac);
    fprintf(stderr, "[*] Earbuds MAC: %s\n", buds_mac);
    
    /* Convert MAC to search pattern */
    char mac_pattern[64];
    snprintf(mac_pattern, sizeof(mac_pattern), "%s", buds_mac);
    for (int i = 0; mac_pattern[i]; i++) {
        if (mac_pattern[i] == ':') mac_pattern[i] = '_';
    }
    
    fprintf(stderr, "[*] Searching for Bluetooth sink with pattern: %s\n", mac_pattern);
    
    /* Find actual sink name */
    char actual_sink[256] = {0};
    if (!find_bt_sink(mac_pattern, actual_sink, sizeof(actual_sink))) {
        fprintf(stderr, "[-] ERROR: Could not find Bluetooth sink for MAC %s\n", buds_mac);
        fprintf(stderr, "[-] Make sure the device is connected and playing audio.\n");
        fprintf(stderr, "\n[*] Available sinks:\n");
        system("pactl list short sinks");
        fprintf(stderr, "\n[*] Bluetooth device status:\n");
        char bt_cmd[256];
        snprintf(bt_cmd, sizeof(bt_cmd), "bluetoothctl info %s 2>/dev/null || echo 'Device not found'", buds_mac);
        system(bt_cmd);
        return 1;
    }
    
    fprintf(stderr, "[+] Found Bluetooth sink: %s\n", actual_sink);
    
    /* Check for monitor source */
    char monitor_name[300];
    snprintf(monitor_name, sizeof(monitor_name), "%s.monitor", actual_sink);
    
    if (!source_exists(monitor_name)) {
        fprintf(stderr, "[-] ERROR: Monitor source not found: %s\n", monitor_name);
        fprintf(stderr, "\n[*] Available sources:\n");
        system("pactl list short sources");
        return 1;
    }
    
    fprintf(stderr, "[+] Found monitor source: %s\n", monitor_name);

    const char *record_file = "captured_audio.wav";
    signal(SIGINT, handle_sigint);

    /* Load null sink for recording */
    fprintf(stderr, "[*] Creating null sink for recording...\n");
    null_sink_module = run_popen_parse_int(
        "pactl load-module module-null-sink sink_name=record_sink sink_properties=device.description='Recording_Sink' 2>/dev/null");
    
    if (null_sink_module <= 0) {
        fprintf(stderr, "[-] Failed to load null sink (module-null-sink)\n");
        fprintf(stderr, "[-] Make sure PulseAudio is running: pulseaudio --check\n");
        return 1;
    }
    fprintf(stderr, "[+] Null sink loaded (module id=%d)\n", null_sink_module);

    /* Create loopback from Bluetooth monitor to our null sink */
    fprintf(stderr, "[*] Creating loopback from Bluetooth to recording sink...\n");
    char loopback_cmd[512];
    snprintf(loopback_cmd, sizeof(loopback_cmd),
             "pactl load-module module-loopback source='%s' sink=record_sink latency_msec=1 2>&1",
             monitor_name);
    
    loopback_module = run_popen_parse_int(loopback_cmd);
    
    if (loopback_module <= 0) {
        fprintf(stderr, "[-] Failed to create loopback module\n");
        fprintf(stderr, "[-] Command was: %s\n", loopback_cmd);
        cleanup();
        return 1;
    }
    fprintf(stderr, "[+] Loopback loaded (module id=%d)\n", loopback_module);

    /* Start recording */
    fprintf(stderr, "[*] Starting recording to %s...\n", record_file);
    record_pid = fork();
    if (record_pid == 0) {
        execlp("parec", "parec",
               "--device=record_sink.monitor",
               "--file-format=wav",
               record_file,
               (char *)NULL);
        perror("Failed to start parec");
        exit(1);
    }

    fprintf(stderr, "\n");
    fprintf(stderr, "========================================\n");
    fprintf(stderr, "[+] Recording started successfully!\n");
    fprintf(stderr, "[*] Play audio on your phone now.\n");
    fprintf(stderr, "[*] Audio will be recorded to: %s\n", record_file);
    fprintf(stderr, "[*] Press Ctrl+C to stop recording.\n");
    fprintf(stderr, "========================================\n");
    
    while (1) pause();

    return 0;
}