import network

### Need to install npcap (for windows) and nmap for this script to work 


def get_network_mask():
    wlan = network.WLAN(network.STA_IF)
    if wlan.isconnected():
        netmask = wlan.ifconfig()[1]
        return netmask
    else:
        return None



def ip_to_int(ip):
    parts = [int(part) for part in ip.split('.')]
    return (parts[0] << 24) + (parts[1] << 16) + (parts[2] << 8) + parts[3]

def int_to_ip(ip_int):
    return f"{(ip_int >> 24) & 0xFF}.{(ip_int >> 16) & 0xFF}.{(ip_int >> 8) & 0xFF}.{ip_int & 0xFF}"

def get_broadcast_address(ip, mask):
    ip_int = ip_to_int(ip)
    mask_int = ip_to_int(mask)
    broadcast_int = ip_int | ~mask_int & 0xFFFFFFFF
    broadcast_ip = int_to_ip(broadcast_int)
    return broadcast_ip
