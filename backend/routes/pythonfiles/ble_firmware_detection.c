#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include <string.h>
#include <errno.h>
#include <ctype.h>
#include <sys/socket.h>
#include <bluetooth/bluetooth.h>
#include <bluetooth/l2cap.h>
#include <bluetooth/hci.h>
#include <bluetooth/hci_lib.h>
#include <regex.h>

#define ATT_CID 0x0004
#define CLIENT_MTU 256

// ATT Opcodes
#define ATT_OP_ERROR_RSP                0x01
#define ATT_OP_EXCHANGE_MTU_REQ         0x02
#define ATT_OP_EXCHANGE_MTU_RESP        0x03
#define ATT_OP_READ_BY_TYPE_REQ         0x08
#define ATT_OP_READ_BY_TYPE_RSP         0x09
#define ATT_OP_READ_REQ                 0x0A
#define ATT_OP_READ_RSP                 0x0B
#define ATT_OP_READ_BY_GROUP_TYPE_REQ   0x10
#define ATT_OP_READ_BY_GROUP_TYPE_RSP   0x11

// UUIDs
#define PRIMARY_SERVICE_UUID            0x2800
#define CHARACTERISTIC_UUID             0x2803
#define DEVICE_INFORMATION_SERVICE_UUID 0x180A
#define FIRMWARE_REVISION_STRING_UUID   0x2A26

// Global buffer to hold the detected firmware version:
char detected_fw[64] = "Unknown";

// Forward declarations
int do_gatt_firmware(int sock);
void    do_fallback(const char *mac);
int     try_connect_all(int sock, struct sockaddr_l2 *addr);
int     read_handle(int sock, uint16_t handle);

// Low-level ATT request/response
int l2cap_le_att_req(int sock, unsigned char *req, int req_len,
                     unsigned char *resp, int resp_max_len)
{
    if (write(sock, req, req_len) < 0) {
        perror("write ATT request");
        return -1;
    }
    int len = read(sock, resp, resp_max_len);
    if (len < 0) {
        perror("read ATT response");
        return -1;
    }
    if (len > 0 && resp[0] == ATT_OP_ERROR_RSP) {
        fprintf(stderr,
                "ATT Error: opcode=0x%02x handle=0x%04x code=0x%02x\n",
                resp[1],
                resp[2] | (resp[3] << 8),
                resp[4]);
        return -1;
    }
    return len;
}

// MTU exchange
int exchange_mtu(int sock) {
    unsigned char req[3] = {
        ATT_OP_EXCHANGE_MTU_REQ,
        CLIENT_MTU & 0xff,
        CLIENT_MTU >> 8
    };
    unsigned char resp[512];
    int len = l2cap_le_att_req(sock, req, sizeof(req), resp, sizeof(resp));
    if (len < 0) {
        fprintf(stderr, "MTU exchange failed\n");
        return -1;
    }
    if (resp[0] != ATT_OP_EXCHANGE_MTU_RESP) {
        fprintf(stderr,
                "Bad MTU response opcode: 0x%02x (expected 0x%02x)\n",
                resp[0], ATT_OP_EXCHANGE_MTU_RESP);
        return -1;
    }
    int server_mtu = resp[1] | (resp[2] << 8);
    int effective = server_mtu < CLIENT_MTU ? server_mtu : CLIENT_MTU;
    printf("MTU OK: server=%d effective=%d\n", server_mtu, effective);
    return effective;
}

// GATT-based firmware reader
int do_gatt_firmware(int sock) {
    unsigned char resp[512];
    int len;

    printf("⏳ Performing MTU exchange…\n");
    sleep(1);
    if (exchange_mtu(sock) < 0) return -1;

    // 1) Discover Device Information Service
    printf("🔍 Discovering Primary Services…\n");
    uint16_t sh=1, eh=0xFFFF, svc_start=0, svc_end=0;
    while (sh <= eh) {
        unsigned char req[7] = {
            ATT_OP_READ_BY_GROUP_TYPE_REQ,
            sh & 0xFF, (sh>>8)&0xFF,
            eh & 0xFF, (eh>>8)&0xFF,
            PRIMARY_SERVICE_UUID & 0xFF,
            (PRIMARY_SERVICE_UUID>>8)&0xFF
        };
        len = l2cap_le_att_req(sock, req, sizeof(req), resp, sizeof(resp));
        if (len < 0) break;
        if (resp[0] != ATT_OP_READ_BY_GROUP_TYPE_RSP) {
            fprintf(stderr, "Svc discover bad opcode 0x%02x\n", resp[0]);
            break;
        }
        int dl = resp[1];
        if (dl < 6) break;
        for (int i=2; i+dl<=len; i+=dl) {
            uint16_t us   = resp[i] | (resp[i+1]<<8);
            uint16_t ue   = resp[i+2] | (resp[i+3]<<8);
            uint16_t uuid = resp[i+4] | (resp[i+5]<<8);
            if (uuid == DEVICE_INFORMATION_SERVICE_UUID) {
                svc_start = us; svc_end = ue;
                printf("⚙️  Found Device Info svc: 0x%04x–0x%04x\n", us, ue);
                goto found_svc;
            }
            sh = ue + 1;
        }
    }
    return -1;

found_svc:
    // 2) Discover Firmware Revision Characteristic
    printf("🔍 Discovering Characteristics…\n");
    uint16_t ch = svc_start, firmware_handle = 0;
    while (ch <= svc_end) {
        unsigned char req[7] = {
            ATT_OP_READ_BY_TYPE_REQ,
            ch & 0xFF, (ch>>8)&0xFF,
            svc_end & 0xFF, (svc_end>>8)&0xFF,
            CHARACTERISTIC_UUID & 0xFF,
            (CHARACTERISTIC_UUID>>8)&0xFF
        };
        len = l2cap_le_att_req(sock, req, sizeof(req), resp, sizeof(resp));
        if (len < 0) break;
        if (resp[0] != ATT_OP_READ_BY_TYPE_RSP) {
            fprintf(stderr, "Char discover bad opcode 0x%02x\n", resp[0]);
            break;
        }
        int dl = resp[1];
        if (dl < 7) break;
        for (int i=2; i+dl<=len; i+=dl) {
            uint16_t decl = resp[i] | (resp[i+1]<<8);
            uint16_t valh = resp[i+3] | (resp[i+4]<<8);
            uint16_t uuid = resp[i+5] | (resp[i+6]<<8);
            if (uuid == FIRMWARE_REVISION_STRING_UUID) {
                firmware_handle = valh;
                printf("🔑 Found firmware char @ handle 0x%04x\n", valh);
                goto read_fw;
            }
            ch = decl + 1;
        }
    }
    return -1;

read_fw:
    // 3) Read the characteristic
    printf("📖 Reading firmware @ 0x%04x…\n", firmware_handle);
    unsigned char req[3] = {
        ATT_OP_READ_REQ,
        firmware_handle & 0xFF,
        (firmware_handle>>8)&0xFF
    };
    len = l2cap_le_att_req(sock, req, sizeof(req), resp, sizeof(resp));
    if (len < 0 || resp[0] != ATT_OP_READ_RSP) {
        fprintf(stderr, "Failed to read firmware char (opcode=0x%02x)\n", resp[0]);
        return -1;
    }

    // Copy into global buffer
    int datalen = len - 1;
    if (datalen > 0 && datalen < (int)sizeof(detected_fw)) {
        memcpy(detected_fw, resp + 1, datalen);
        detected_fw[datalen] = '\0';
    }

    return 0;
}

// Brute-force fallback
void do_fallback(const char *mac) {
    printf("⚠️  Falling back to brute-force handle read…\n");

    int sock = socket(AF_BLUETOOTH, SOCK_SEQPACKET, BTPROTO_L2CAP);
    if (sock < 0) { perror("socket"); return; }

    struct sockaddr_l2 loc = {
        .l2_family = AF_BLUETOOTH,
        .l2_bdaddr = *BDADDR_ANY,
        .l2_cid    = htobs(ATT_CID)
    }, rem = {
        .l2_family = AF_BLUETOOTH,
        .l2_cid    = htobs(ATT_CID)
    };
    str2ba(mac, &rem.l2_bdaddr);

    if (bind(sock, (struct sockaddr*)&loc, sizeof(loc)) < 0) {
        perror("bind"); close(sock); return;
    }

    if (try_connect_all(sock, &rem) < 0) {
        fprintf(stderr, "❌ Fallback: connect failed on both types\n");
        close(sock);
        return;
    }

    for (uint16_t h = 0x0001; h <= 0x0030; h++) {
        if (read_handle(sock, h)) {
            close(sock);
            return;
        }
        usleep(200000);
    }

    fprintf(stderr, "❌ Fallback: no firmware found\n");
    close(sock);
}

int try_connect_all(int sock, struct sockaddr_l2 *addr) {
    const char *names[2] = { "PUBLIC", "RANDOM" };
    int types[2]      = { BDADDR_LE_PUBLIC, BDADDR_LE_RANDOM };
    for (int i=0; i<2; i++) {
        addr->l2_bdaddr_type = types[i];
        printf("🔌 Trying %s address…\n", names[i]);
        if (connect(sock, (struct sockaddr*)addr, sizeof(*addr)) == 0) {
            printf("✅ Connected [%s]\n", names[i]);
            return 0;
        }
        perror("connect");
        sleep(1);
    }
    return -1;
}

int is_printable(const unsigned char *d, int len) {
    for (int i=0; i<len; i++)
        if (d[i]<32 || d[i]>126) return 0;
    return 1;
}

int is_version_format(const char *s) {
    regex_t re;
    if (regcomp(&re, "^[0-9]+(\\.[0-9]+)+$", REG_EXTENDED)) return 0;
    int ok = (regexec(&re, s, 0, NULL, 0)==0);
    regfree(&re);
    return ok;
}

// Modified read_handle that writes into detected_fw on success
int read_handle(int sock, uint16_t handle) {
    unsigned char req[3], resp[512];
    req[0] = ATT_OP_READ_REQ;
    req[1] = handle & 0xFF;
    req[2] = handle >> 8;
    if (write(sock, req, 3) < 0) { perror("write"); return 0; }
    int len = read(sock, resp, sizeof(resp));
    if (len < 0) { perror("read"); return 0; }
    if (resp[0] == ATT_OP_ERROR_RSP) {
        printf("📦 Handle 0x%04x: error 0x%02x\n",
               handle, resp[4]);
        return 0;
    }
    if (resp[0] != ATT_OP_READ_RSP) {
        printf("📦 Handle 0x%04x: opcode=0x%02x\n",
               handle, resp[0]);
        return 0;
    }
    int dl = len - 1;
    if (dl <= 0 || !is_printable(resp+1, dl)) {
        printf("📦 Handle 0x%04x: nonprintable\n", handle);
        return 0;
    }
    char buf[64];
    int copylen = dl < (int)sizeof(buf)-1 ? dl : (int)sizeof(buf)-1;
    memcpy(buf, resp+1, copylen);
    buf[copylen] = '\0';
    if (!is_version_format(buf)) {
        printf("📦 Handle 0x%04x: \"%s\" not a version\n",
               handle, buf);
        return 0;
    }
    // Success → store in global
    snprintf(detected_fw, sizeof(detected_fw), "%s", buf);
    printf("✅ Firmware @handle 0x%04x: %s\n", handle, buf);
    return 1;
}

// Entry point
int main(int argc, char **argv) {
    if (argc < 2) {
        fprintf(stderr, "Usage: %s <BLE_MAC>\n", argv[0]);
        return 1;
    }
    const char *mac = argv[1];

    int sock = socket(AF_BLUETOOTH, SOCK_SEQPACKET, BTPROTO_L2CAP);
    if (sock < 0) { perror("socket"); return 1; }

    struct sockaddr_l2 loc = {
        .l2_family = AF_BLUETOOTH,
        .l2_bdaddr = *BDADDR_ANY,
        .l2_cid    = htobs(ATT_CID)
    }, rem = {
        .l2_family = AF_BLUETOOTH,
        .l2_cid    = htobs(ATT_CID)
    };
    str2ba(mac, &rem.l2_bdaddr);

    if (bind(sock, (struct sockaddr*)&loc, sizeof(loc)) < 0) {
        perror("bind");
        close(sock);
        return 1;
    }

    printf("🔗 Connecting to %s (GATT)…\n", mac);
    rem.l2_bdaddr_type = BDADDR_LE_PUBLIC;
    if (connect(sock, (struct sockaddr*)&rem, sizeof(rem)) < 0) {
        perror("connect");
        close(sock);
        do_fallback(mac);
    } else {
        if (do_gatt_firmware(sock) < 0) {
            close(sock);
            do_fallback(mac);
        } else {
            close(sock);
        }
    }

    // Final required output:
    printf("[*] Detected Firmware Version: %s\n", detected_fw);
    return 0;
}
