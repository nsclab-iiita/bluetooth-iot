#include <stdio.h>
#include <stdlib.h>
#include <unistd.h> // For getopt
#include <string.h>
#include <sys/socket.h>
#include <bluetooth/bluetooth.h>
#include <bluetooth/l2cap.h>
#include <time.h>

#define PSM 0x0001
#define PING_DATA "BT_PING"

void usage(const char *prog_name) {
    fprintf(stderr, "Usage: %s [-i <interface>] [-c <count>] <MAC-ADDRESS>\n", prog_name);
}

int main(int argc, char **argv) {
    int opt;
    int count = 10; // Default count
    char *device_address = NULL;
    // We parse the interface argument but don't use it, to maintain compatibility.
    // A full implementation would require binding the socket to the specified interface.
    char *interface = "hci0";

    // --- 1. Argument Parsing ---
    while ((opt = getopt(argc, argv, "i:c:")) != -1) {
        switch (opt) {
            case 'i':
                interface = optarg;
                break;
            case 'c':
                count = atoi(optarg);
                if (count <= 0) {
                    fprintf(stderr, "Error: count must be a positive integer.\n");
                    return 1;
                }
                break;
            default:
                usage(argv[0]);
                return 1;
        }
    }

    // The remaining argument should be the MAC address
    if (optind >= argc) {
        fprintf(stderr, "Error: MAC address is missing.\n");
        usage(argv[0]);
        return 1;
    }
    device_address = argv[optind];

    int sock;
    struct sockaddr_l2 addr = {0};
    char buf[1024];
    struct timespec start, end;

    // Create L2CAP socket
    sock = socket(AF_BLUETOOTH, SOCK_SEQPACKET, BTPROTO_L2CAP);
    if (sock < 0) {
        perror("Socket creation failed");
        return 1;
    }

    // Setup address
    addr.l2_family = AF_BLUETOOTH;
    str2ba(device_address, &addr.l2_bdaddr);
    addr.l2_psm = htobs(PSM);

    // Connect
    if (connect(sock, (struct sockaddr *)&addr, sizeof(addr)) < 0) {
        fprintf(stderr, "Can't connect to %s: ", device_address);
        perror("");
        close(sock);
        return 1;
    }

    for (int i = 0; i < count; i++) {
        clock_gettime(CLOCK_MONOTONIC, &start);

        if (send(sock, PING_DATA, strlen(PING_DATA), 0) < 0) {
            perror("Send failed");
            break;
        }

        int bytes = recv(sock, buf, sizeof(buf), 0);
        clock_gettime(CLOCK_MONOTONIC, &end);

        if (bytes > 0) {
            double rtt = (end.tv_sec - start.tv_sec) * 1000.0;
            rtt += (end.tv_nsec - start.tv_nsec) / 1000000.0;
            // --- 2. Modified Output Format ---
            printf("%d bytes from %s seq %d time %.2f ms\n", bytes, device_address, i, rtt);
        } else {
            perror("Recv failed");
        }

        if (i < count - 1) {
            usleep(500000); // wait 0.5s between pings
        }
    }

    close(sock);
    return 0;
}