import socket
import re
import os
import subprocess
import ipaddress
import platform
import nmap
from scapy.all import ARP, Ether, srp, conf

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


def scan_network_with_nmap(broadcast_address, mask, local_ip):
    nm = nmap.PortScanner()
    if not mask:
        print("Could not determine network mask.")
        return

    network = f"{local_ip}/{mask}"

    print(f"Scanning network: {network}")
    nm.scan(hosts=network, arguments="-sn")

    print(nm.all_hosts())

    for host in nm.all_hosts():
        if "mac" in nm[host]["addresses"]:
            print(f"IP: {host}, MAC: {nm[host]['addresses']['mac']}")


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


def send_direct_arp_requests(broadcast_address):
    # Get the default network interface
    iface = conf.iface
    # Create an ARP request packet
    arp_request = ARP(pdst=str(broadcast_address))
    ether_broadcast = Ether(dst="ff:ff:ff:ff:ff:ff")
    arp_request_broadcast = ether_broadcast / arp_request
    answered_list = srp(arp_request_broadcast, timeout=1, verbose=True, iface=iface)[0]
    for sent, received in answered_list:
        print(sent)
        print(f"IP: {received.psrc}, MAC: {received.hwsrc}")


if __name__ == "__main__":
    ip = get_local_ip()
    mask = get_network_mask(ip)
    broadcastAddress = get_broadcast_address(ip, mask)
    refresh_arp_cache(broadcastAddress)
    send_direct_arp_requests(broadcastAddress)
    scan_network_with_nmap(broadcastAddress, mask, ip)
    print(os.popen("arp -a").read())
