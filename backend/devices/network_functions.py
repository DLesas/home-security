import socket
import re
import os
import subprocess
import ipaddress
import platform

### Need to install npcap (for windows) and nmap for this script to work 

def get_local_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    s.settimeout(0)
    try:
        # doesn't even have to be reachable
        s.connect(("10.254.254.254", 1))
        IP = s.getsockname()[0]
    except Exception:
        IP = "127.0.0.1"
    finally:
        s.close()
    return IP


def find_ip_by_mac(mac):
    mac = mac.lower()
    cmd_out = os.popen("arp -a").read()
    ip_pattern = re.compile(r"\d+\.\d+\.\d+\.\d+")
    for line in cmd_out.split("\n"):
        if mac in line.lower():
            ip_match = ip_pattern.search(line)
            if ip_match:
                return ip_match.group()
    return None


def get_network_mask(ip):
    proc = subprocess.Popen("ipconfig", stdout=subprocess.PIPE)
    while True:
        line = proc.stdout.readline()
        if ip.encode() in line:
            break
    mask = proc.stdout.readline().rstrip().split(b":")[-1].replace(b" ", b"").decode()
    return mask



def get_broadcast_address(ip, mask):
    host = ipaddress.IPv4Address(ip)
    net = ipaddress.IPv4Network(ip + "/" + mask, False)
    print("IP:", ip)
    print("Mask:", mask)
    print("Subnet:", ipaddress.IPv4Address(int(host) & int(net.netmask)))
    print("Host:", ipaddress.IPv4Address(int(host) & int(net.hostmask)))
    print("Broadcast:", net.broadcast_address)
    return net.broadcast_address


def refresh_arp_cache(broadcast_address):
    os_type = platform.system()
    if os_type == "Linux" or os_type == "Darwin":  # Darwin is macOS
        os.system(f"ping -b {broadcast_address} -c 1")
    elif os_type == "Windows":
        os.system(f"ping {broadcast_address}")




if __name__ == "__main__":
    ip = get_local_ip()
    mask = get_network_mask(ip)
    broadcastAddress = get_broadcast_address(ip, mask)
    refresh_arp_cache(broadcastAddress)
    print(os.popen("arp -a").read())
