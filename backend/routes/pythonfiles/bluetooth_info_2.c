// bluetooth_info_2.c
// Compile: gcc bluetooth_info_2.c `pkg-config --cflags --libs glib-2.0 gio-2.0` -lbluetooth -o btinfo2
/* Limitations:
	1. Hard-coded mapping of UUIDs and icons
	2. Batteryinforamtion and OUIComapany not implemented yet
	3. RSSI not working properly in some test cases
	4. sdptool still used for protocol extraction
*/

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <sys/ioctl.h>
#include <bluetooth/bluetooth.h>
#include <bluetooth/hci.h>
#include <bluetooth/hci_lib.h>
#include <gio/gio.h>

void print_kv(const char *key, const char *value) {
    printf("%s=%s\n", key, value);
}

const char* uuid_profile_name(const char* uuid) {
    if (strcmp(uuid, "00001105-0000-1000-8000-00805f9b34fb") == 0) return "OBEX Object Push";
    if (strcmp(uuid, "0000110a-0000-1000-8000-00805f9b34fb") == 0) return "Audio Source";
    if (strcmp(uuid, "0000110c-0000-1000-8000-00805f9b34fb") == 0) return "A/V Remote Control Target";
    if (strcmp(uuid, "0000110d-0000-1000-8000-00805f9b34fb") == 0) return "Advanced Audio";
    if (strcmp(uuid, "0000110e-0000-1000-8000-00805f9b34fb") == 0) return "AV Remote";
    if (strcmp(uuid, "00001112-0000-1000-8000-00805f9b34fb") == 0) return "Headset AG";
    if (strcmp(uuid, "00001115-0000-1000-8000-00805f9b34fb") == 0) return "PANU";
    if (strcmp(uuid, "00001116-0000-1000-8000-00805f9b34fb") == 0) return "NAP";
    if (strcmp(uuid, "0000111f-0000-1000-8000-00805f9b34fb") == 0) return "Handsfree Audio Gateway";
    if (strcmp(uuid, "0000112d-0000-1000-8000-00805f9b34fb") == 0) return "SIM Access";
    if (strcmp(uuid, "0000112f-0000-1000-8000-00805f9b34fb") == 0) return "Phonebook Access Server";
    if (strcmp(uuid, "00001132-0000-1000-8000-00805f9b34fb") == 0) return "Message Access Server";
    if (strcmp(uuid, "00001200-0000-1000-8000-00805f9b34fb") == 0) return "PnP Information";
    if (strcmp(uuid, "00001800-0000-1000-8000-00805f9b34fb") == 0) return "Generic Access Profile";
    if (strcmp(uuid, "00001801-0000-1000-8000-00805f9b34fb") == 0) return "Generic Attribute Profile";
    return "Unknown";
}

const char* icon_from_class(uint32_t class) {
    uint8_t major = (class >> 8) & 0x1F;
    switch (major) {
        case 0x01: return "computer";
        case 0x02: return "phone";
        case 0x03: return "LAN";
        case 0x04: return "audio";
        case 0x05: return "peripheral";
        case 0x06: return "imaging";
        case 0x07: return "wearable";
        case 0x08: return "toy";
        case 0x09: return "health";
        default: return "unknown";
    }
}

void get_device_name(const char *addr) {
    char name[248] = {0};
    bdaddr_t bdaddr;
    str2ba(addr, &bdaddr);
    int dev_id = hci_get_route(NULL);
    int sock = hci_open_dev(dev_id);
    if (sock < 0) return;
    if (hci_read_remote_name(sock, &bdaddr, sizeof(name), name, 0) < 0)
        strcpy(name, "[unknown]");
    print_kv("Devicename", name);
    close(sock);
}

void get_basic_info(const char *addr_str) {
    bdaddr_t bdaddr;
    str2ba(addr_str, &bdaddr);
    int dev_id = hci_get_route(NULL);
    int sock = hci_open_dev(dev_id);
    if (sock < 0) return;
    struct hci_conn_info_req *req = malloc(sizeof(*req) + sizeof(struct hci_conn_info));
    bacpy(&req->bdaddr, &bdaddr);
    req->type = ACL_LINK;
    if (ioctl(sock, HCIGETCONNINFO, (unsigned long)req) < 0) {
        free(req); close(sock); return;
    }
    uint16_t handle = req->conn_info->handle;
    struct hci_version ver;
    if (hci_read_remote_version(sock, handle, &ver, 1000) == 0) {
        char lmp[64], manuf[64];
        snprintf(lmp, sizeof(lmp), "(0x%x) LMP Subversion: 0x%x", ver.lmp_ver, ver.lmp_subver);
        snprintf(manuf, sizeof(manuf), "%s (%d)", bt_compidtostr(ver.manufacturer), ver.manufacturer);
        print_kv("LMPversion", lmp);
        print_kv("Manufacturer", manuf);
    }
    free(req);
    close(sock);
}

void get_dbus_properties(const char *addr_str) {
    char object_path[128];
    char formatted_addr[18];
    strncpy(formatted_addr, addr_str, sizeof(formatted_addr));
    for (int i = 0; i < strlen(formatted_addr); i++) {
        if (formatted_addr[i] == ':') formatted_addr[i] = '_';
    }
    snprintf(object_path, sizeof(object_path), "/org/bluez/hci0/dev_%s", formatted_addr);

    GError *error = NULL;
    GDBusConnection *conn = g_bus_get_sync(G_BUS_TYPE_SYSTEM, NULL, &error);
    if (!conn) return;

    GVariant *result = g_dbus_connection_call_sync(
        conn, "org.bluez", object_path,
        "org.freedesktop.DBus.Properties", "GetAll",
        g_variant_new("(s)", "org.bluez.Device1"),
        NULL, G_DBUS_CALL_FLAGS_NONE, -1, NULL, &error);

    if (!result) return;

    GVariantIter *iter;
    gchar *key;
    GVariant *value;

    g_variant_get(result, "(a{sv})", &iter);
    while (g_variant_iter_loop(iter, "{sv}", &key, &value)) {
        if (g_strcmp0(key, "Paired") == 0)
            print_kv("Paired", g_variant_get_boolean(value) ? "yes" : "no");
        else if (g_strcmp0(key, "Trusted") == 0)
            print_kv("Trusted", g_variant_get_boolean(value) ? "yes" : "no");
        else if (g_strcmp0(key, "Connected") == 0)
            print_kv("Connected", g_variant_get_boolean(value) ? "yes" : "no");
        else if (g_strcmp0(key, "LegacyPairing") == 0)
            print_kv("LegacyPairing", g_variant_get_boolean(value) ? "yes" : "no");
        else if (g_strcmp0(key, "Blocked") == 0)
            print_kv("Blocked", g_variant_get_boolean(value) ? "yes" : "no");
        else if (g_strcmp0(key, "Modalias") == 0)
            print_kv("Modalias", g_variant_get_string(value, NULL));
        else if (g_strcmp0(key, "Class") == 0) {
            uint32_t class = g_variant_get_uint32(value);
            char buf[32];
            snprintf(buf, sizeof(buf), "0x%08x", class);
            print_kv("Class", buf);
            print_kv("Icon", icon_from_class(class));
        }
        else if (g_strcmp0(key, "RSSI") == 0) {
            char buf[32];
            snprintf(buf, sizeof(buf), "%d", g_variant_get_int16(value));
            print_kv("RSSI", buf);
        }
        else if (g_strcmp0(key, "UUIDs") == 0 && g_variant_is_of_type(value, G_VARIANT_TYPE("as"))) {
            GVariantIter *uuid_iter;
            gchar *uuid;
            g_variant_get(value, "as", &uuid_iter);
            while (g_variant_iter_loop(uuid_iter, "s", &uuid)) {
                const char *name = uuid_profile_name(uuid);
                char full[128];
                if (name != "Unknown") {
                	snprintf(full, sizeof(full), "%-30s (%s)", name, uuid);
                	print_kv("UUID", full);
                }
            }
            g_variant_iter_free(uuid_iter);
        }
    }

    g_variant_iter_free(iter);
    g_variant_unref(result);
    g_object_unref(conn);
}

int main(int argc, char *argv[]) {
    if (argc != 2) {
        fprintf(stderr, "Usage: %s <Bluetooth MAC address>\n", argv[0]);
        return 1;
    }

    const char *bt_address = argv[1];

    print_kv("BDAddress", bt_address);
    print_kv("OUIcompany", "Not available");
    get_device_name(bt_address);
    print_kv("BatteryPercentage", "Not available");
    get_basic_info(bt_address);
    get_dbus_properties(bt_address);
    return 0;
}

