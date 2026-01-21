// File: src/minibtmon.c
// Build: gcc -O2 -Wall -Wextra -pedantic -std=c11 minibtmon.c -o minibtmon
// Usage: sudo ./minibtmon -w output.pcapng   (writes btsnoop format; Wireshark/TShark/PyShark can read it)
// Note: This is a minimal btmon-like capturer. It opens RAW HCI sockets on all up adapters,
// captures HCI H4 frames (CMD/ACL/SCO/EVT), and writes a btsnoop log stream until terminated.
// Why: Keep it small and robust; rely on kernel timestamp/dir CMSG where available; fall back otherwise.

#define _GNU_SOURCE
#include <errno.h>
#include <fcntl.h>
#include <getopt.h>
#include <signal.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/select.h>
#include <sys/socket.h>
#include <sys/time.h>
#include <sys/types.h>
#include <time.h>
#include <unistd.h>
#include <sys/ioctl.h> 

#include <bluetooth/bluetooth.h>
#include <bluetooth/hci.h>
#include <bluetooth/hci_lib.h>

// --- btsnoop constants ---
// datalink: HCI H4 = 1002 (per btsnoop spec)
#define BTSNOOP_DLT_HCI_H4 1002
// timestamp offset: microseconds between 0000-01-01 and 1970-01-01
#define BTSNOOP_EPOCH_DELTA_US 62135596800ULL * 1000000ULL
#define MAX_HCI_PKT_SIZE 262144

static volatile sig_atomic_t g_stop = 0;

static void on_signal(int sig) {
    (void)sig;
    g_stop = 1; // graceful stop
}

static void install_signal_handlers(void) {
    struct sigaction sa;
    memset(&sa, 0, sizeof(sa));
    sa.sa_handler = on_signal;
    sigaction(SIGINT, &sa, NULL);
    sigaction(SIGTERM, &sa, NULL);
}

// Write big-endian helpers
static void be32_write(uint8_t *dst, uint32_t v) {
    dst[0] = (uint8_t)((v >> 24) & 0xFF);
    dst[1] = (uint8_t)((v >> 16) & 0xFF);
    dst[2] = (uint8_t)((v >> 8) & 0xFF);
    dst[3] = (uint8_t)(v & 0xFF);
}

static void be64_write(uint8_t *dst, uint64_t v) {
    dst[0] = (uint8_t)((v >> 56) & 0xFF);
    dst[1] = (uint8_t)((v >> 48) & 0xFF);
    dst[2] = (uint8_t)((v >> 40) & 0xFF);
    dst[3] = (uint8_t)((v >> 32) & 0xFF);
    dst[4] = (uint8_t)((v >> 24) & 0xFF);
    dst[5] = (uint8_t)((v >> 16) & 0xFF);
    dst[6] = (uint8_t)((v >> 8) & 0xFF);
    dst[7] = (uint8_t)(v & 0xFF);
}

// btsnoop file header: "btsnoop\0" (8) + version (4) + datalink (4)
static int write_btsnoop_header(int fd) {
    uint8_t hdr[16];
    memset(hdr, 0, sizeof(hdr));
    memcpy(hdr, "btsnoop\0", 8);
    be32_write(hdr + 8, 1); // version
    be32_write(hdr + 12, BTSNOOP_DLT_HCI_H4);
    return (write(fd, hdr, sizeof(hdr)) == (ssize_t)sizeof(hdr)) ? 0 : -1;
}

// Write a single btsnoop record given payload already in H4 framing (type + bytes)
static int write_btsnoop_record(int fd, const uint8_t *h4, uint32_t len, uint32_t flags, uint64_t ts_us) {
    // Record header: orig_len(4) inc_len(4) flags(4) drops(4) ts(8)
    uint8_t rec[24];
    be32_write(rec + 0, len);
    be32_write(rec + 4, len);
    be32_write(rec + 8, flags); // 0 = sent, 1 = received
    be32_write(rec + 12, 0);    // drops
    be64_write(rec + 16, ts_us + BTSNOOP_EPOCH_DELTA_US);

    if (write(fd, rec, sizeof(rec)) != (ssize_t)sizeof(rec)) return -1;
    if (write(fd, h4, len) != (ssize_t)len) return -1;
    return 0;
}

// Enable control messages for direction and timestamp where supported
static int setup_socket_options(int fd) {
    int enable = 1;
    struct hci_filter flt;
    hci_filter_clear(&flt);
    hci_filter_set_ptype(HCI_COMMAND_PKT, &flt);
    hci_filter_set_ptype(HCI_ACLDATA_PKT, &flt);
    hci_filter_set_ptype(HCI_SCODATA_PKT, &flt);
    hci_filter_set_ptype(HCI_EVENT_PKT, &flt);
    hci_filter_all_events(&flt);

    if (setsockopt(fd, SOL_HCI, HCI_FILTER, &flt, sizeof(flt)) < 0) return -1;

    setsockopt(fd, SOL_HCI, HCI_DATA_DIR, &enable, sizeof(enable));
    setsockopt(fd, SOL_HCI, HCI_TIME_STAMP, &enable, sizeof(enable));

    int flags = fcntl(fd, F_GETFL, 0);
    if (flags >= 0) fcntl(fd, F_SETFL, flags | O_NONBLOCK);
    return 0;
}

// Open RAW HCI socket on a given device id
static int open_hci_raw(int dev_id) {
    struct sockaddr_hci addr;
    memset(&addr, 0, sizeof(addr));
    addr.hci_family = AF_BLUETOOTH;
    addr.hci_dev = (uint16_t)dev_id;
    addr.hci_channel = HCI_CHANNEL_RAW;

    int fd = socket(AF_BLUETOOTH, SOCK_RAW, BTPROTO_HCI);
    if (fd < 0) return -1;
    if (bind(fd, (struct sockaddr *)&addr, sizeof(addr)) < 0) {
        close(fd);
        return -1;
    }
    if (setup_socket_options(fd) < 0) {
        close(fd);
        return -1;
    }
    return fd;
}

// Discover all UP devices and open a socket on each; return count
static int open_all_hci_sockets(int *fds, int maxfds) {
    struct hci_dev_list_req *dl;
    struct hci_dev_req *dr;
    int i, n = 0;

    dl = malloc(HCI_MAX_DEV * sizeof(*dr) + sizeof(*dl));
    if (!dl) return -1;
    dl->dev_num = HCI_MAX_DEV;
    dr = dl->dev_req;

    int sock = socket(AF_BLUETOOTH, SOCK_RAW, BTPROTO_HCI);
    if (sock < 0) { free(dl); return -1; }

    if (ioctl(sock, HCIGETDEVLIST, (void *)dl) < 0) {
        close(sock); free(dl); return -1;
    }

    for (i = 0; i < dl->dev_num && n < maxfds; i++) {
        int dev_id = dr[i].dev_id;
        struct hci_dev_info di;
        memset(&di, 0, sizeof(di));
        di.dev_id = dev_id;
        if (ioctl(sock, HCIGETDEVINFO, (void *)&di) < 0) continue;
        if (!(di.flags & (1 << HCI_UP))) continue; // only UP
        int fd = open_hci_raw(dev_id);
        if (fd >= 0) fds[n++] = fd;
    }

    close(sock);
    free(dl);
    return n;
}

static uint64_t now_us(void) {
    struct timespec ts;
    clock_gettime(CLOCK_REALTIME, &ts);
    return (uint64_t)ts.tv_sec * 1000000ULL + (uint64_t)(ts.tv_nsec / 1000ULL);
}

int main(int argc, char **argv) {
    const char *out_path = NULL;

    static struct option long_opts[] = {
        {"write", required_argument, 0, 'w'},
        {"help", no_argument, 0, 'h'},
        {0, 0, 0, 0}
    };

    int c;
    while ((c = getopt_long(argc, argv, "w:h", long_opts, NULL)) != -1) {
        switch (c) {
            case 'w': out_path = optarg; break;
            case 'h':
            default:
                fprintf(stderr, "Usage: %s -w <output_file>\n", argv[0]);
                return (c=='h') ? 0 : 2;
        }
    }

    if (!out_path) {
        fprintf(stderr, "error: output file required (-w)\n");
        return 2;
    }

    // Open output
    int ofd = open(out_path, O_CREAT | O_TRUNC | O_WRONLY, 0644);
    if (ofd < 0) {
        perror("open output");
        return 1;
    }

    if (write_btsnoop_header(ofd) < 0) {
        fprintf(stderr, "error: failed to write btsnoop header\n");
        close(ofd);
        return 1;
    }

    install_signal_handlers();

    // Open sockets
    const int MAXFDS = 16;
    int fds[MAXFDS];
    int nfds = open_all_hci_sockets(fds, MAXFDS);
    if (nfds <= 0) {
        fprintf(stderr, "error: no UP HCI adapters found or cannot open raw sockets (need sudo)\n");
        close(ofd);
        return 1;
    }

    // Main loop
    while (!g_stop) {
        fd_set rfds;
        FD_ZERO(&rfds);
        int maxfd = -1;
        for (int i = 0; i < nfds; i++) {
            FD_SET(fds[i], &rfds);
            if (fds[i] > maxfd) maxfd = fds[i];
        }

        struct timeval tv = { .tv_sec = 1, .tv_usec = 0 };
        int sel = select(maxfd + 1, &rfds, NULL, NULL, &tv);
        if (sel < 0) {
            if (errno == EINTR) continue;
            perror("select");
            break;
        }
        if (sel == 0) continue;

        for (int i = 0; i < nfds; i++) {
            if (!FD_ISSET(fds[i], &rfds)) continue;

            // Receive with ancillary data for dir & timestamp
            uint8_t buf[MAX_HCI_PKT_SIZE];
            struct iovec iov = { .iov_base = buf, .iov_len = sizeof(buf) };
            uint8_t ctrl[256];
            struct msghdr msg;
            memset(&msg, 0, sizeof(msg));
            msg.msg_iov = &iov;
            msg.msg_iovlen = 1;
            msg.msg_control = ctrl;
            msg.msg_controllen = sizeof(ctrl);

            ssize_t n = recvmsg(fds[i], &msg, 0);
            if (n <= 0) continue;
            if (n > MAX_HCI_PKT_SIZE) n = MAX_HCI_PKT_SIZE; // clamp

            // Defaults
            uint32_t flags = 1; // assume received
            uint64_t ts_us = now_us();

            for (struct cmsghdr *cmsg = CMSG_FIRSTHDR(&msg); cmsg; cmsg = CMSG_NXTHDR(&msg, cmsg)) {
                if (cmsg->cmsg_level == SOL_HCI) {
                    if (cmsg->cmsg_type == HCI_CMSG_DIR && cmsg->cmsg_len >= CMSG_LEN(sizeof(uint8_t))) {
                        uint8_t dir = *(uint8_t *)CMSG_DATA(cmsg);
                        // kernel: 0 = incoming, 1 = outgoing
                        flags = (dir == 0) ? 1 : 0;
                    } else if (cmsg->cmsg_type == HCI_CMSG_TSTAMP && cmsg->cmsg_len >= CMSG_LEN(sizeof(struct timeval))) {
                        struct timeval *tvp = (struct timeval *)CMSG_DATA(cmsg);
                        ts_us = (uint64_t)tvp->tv_sec * 1000000ULL + (uint64_t)tvp->tv_usec;
                    }
                }
            }

            // buf[0] should be H4 packet type on RAW channel when filter accepts all
            if (n <= 0) continue;
            uint32_t plen = (uint32_t)n;
            if (write_btsnoop_record(ofd, buf, plen, flags, ts_us) < 0) {
                perror("write btsnoop record");
                g_stop = 1;
                break;
            }
        }
    }

    for (int i = 0; i < nfds; i++) close(fds[i]);
    close(ofd);
    return 0;
}

