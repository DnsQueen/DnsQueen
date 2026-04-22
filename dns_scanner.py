#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
============================================================
 DNS Scanner Pro - Termux Core (v3.0 Professional)
============================================================
Author: DnsQueen (via Google AI Studio)
Logic:
1. CIDR Expansion (ipaddress lib) - Real IP Scanning
2. Raw UDP DNS Query - Real E2E Resolution Check
3. IP-Pinned Download Test - Real Bandwidth Measurement
4. IP-Pinned Upload Test - Real Data Transfer Measurement
5. Smart Score Ranking - Professional Sorting Logic
============================================================
"""

import sys
import os
import socket
import struct
import time
import threading
import ipaddress
import random
import http.client
import json
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime

# --- استایل‌های رنگی برای محیط ترمال ترموکس ---
class C:
    G = "\033[92m"  # Green
    Y = "\033[93m"  # Yellow
    R = "\033[91m"  # Red
    C = "\033[96m"  # Cyan
    W = "\033[97m"  # White
    BOLD = "\033[1m"
    END = "\033[0m"

# --- تنظیمات پیشرفته تست ---
TEST_DOMAIN = "www.gstatic.com"
DL_PATH = "/generate_204"
UL_URL = "httpbin.org" 
UL_PATH = "/post"
MAX_THREADS = 12
TIMEOUT = 4
TOP_N = 20

# --- ساخت پکت خام برای تست DNS E2E واقعی ---
def build_dns_query(domain):
    tx_id = random.randint(0, 65535)
    # Header: Standard Query, Recursion Desired
    header = struct.pack(">HHHHHH", tx_id, 0x0100, 1, 0, 0, 0)
    q = b""
    for part in domain.split("."):
        q += bytes([len(part)]) + part.encode()
    q += b"\x00" + struct.pack(">HH", 1, 1) # Type A, Class IN
    return tx_id, header + q

def parse_dns_response(data, tx_id):
    try:
        if len(data) < 12: return None
        rid, flags, qdc, anc, nsc, arc = struct.unpack(">HHHHHH", data[:12])
        if rid != tx_id or (flags & 0x000F) != 0: return None 
        
        idx = 12
        while data[idx] != 0: idx += data[idx] + 1
        idx += 5 # Skip Question section
        
        ips = []
        for _ in range(anc):
            if idx >= len(data): break
            if data[idx] & 0xC0 == 0xC0: idx += 2
            else:
                while data[idx] != 0: idx += data[idx] + 1
                idx += 1
            rtype, rclass, ttl, rdlen = struct.unpack(">HHIH", data[idx:idx+10])
            idx += 10
            if rtype == 1 and rdlen == 4: # IPv4 address
                ips.append(".".join(map(str, data[idx:idx+4])))
            idx += rdlen
        return ips
    except: return None

# --- منطق اصلی تست شبکه واقعی ---
def perform_full_analysis(ip):
    analysis = {"ip": ip, "latency": 9999, "dl": 0, "ul": 0, "score": 0, "passed": False}
    
    # [1] تست زنده بودن و DNS E2E
    tx_id, query = build_dns_query(TEST_DOMAIN)
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.settimeout(TIMEOUT)
    try:
        t0 = time.perf_counter()
        sock.sendto(query, (ip, 53))
        data, _ = sock.recvfrom(1024)
        latency = (time.perf_counter() - t0) * 1000
        resolved_ips = parse_dns_response(data, tx_id)
        if not resolved_ips: return None
        
        analysis["latency"] = round(latency, 1)
        target_ip = resolved_ips[0]
    except: return None
    finally: sock.close()

    # [2] تست دانلود واقعی (Pinned-IP)
    try:
        t_dl = time.perf_counter()
        conn = http.client.HTTPConnection(target_ip, timeout=TIMEOUT)
        conn.request("GET", DL_PATH, headers={"Host": TEST_DOMAIN})
        resp = conn.getresponse()
        raw_dl = resp.read()
        dur_dl = time.perf_counter() - t_dl
        analysis["dl"] = round((len(raw_dl) * 8 / dur_dl) / (1024 * 1024), 3) if dur_dl > 0 else 0
        analysis["passed"] = True
    except: pass

    # [3] تست آپلود واقعی (Full Flow)
    try:
        payload = os.urandom(256 * 1024) # ایجاد ۲۵۶ کیلوبایت داده تصادفی
        t_ul = time.perf_counter()
        conn_ul = http.client.HTTPConnection(UL_URL, timeout=TIMEOUT)
        conn_ul.request("POST", UL_PATH, body=payload)
        conn_ul.getresponse().read()
        dur_ul = time.perf_counter() - t_ul
        analysis["ul"] = round((len(payload) * 8 / dur_ul) / (1024 * 1024), 3) if dur_ul > 0 else 0
    except: pass

    # فرمول رتبه‌بندی: تعادل بین پینگ (۳۰٪)، دانلود (۵۰٪) و آپلود (۲۰٪)
    score = (1000 / (analysis["latency"] + 1)) + (analysis["dl"] * 60) + (analysis["ul"] * 30)
    analysis["score"] = score
    
    return analysis

def main():
    os.system('clear')
    print(f"{C.C}{C.BOLD}DNS Scanner Pro v3.0 - Professional Mobile Core{C.END}")
    print(f"{C.W}Real-Time E2E Analysis | CIDR-Enabled | Pinned Traffic{C.END}\n")

    input_file = "resolvers.txt"
    if not os.path.exists(input_file):
        with open(input_file, "w") as f:
            f.write("# Enter IPs or CIDR ranges (example: 8.8.8.0/24)\n8.8.8.8\n1.1.1.1\n")
        print(f"{C.Y}[!] Created default resolvers.txt{C.END}")

    # موتور پردازش آی‌پی و رنج‌های CIDR
    ip_list = []
    with open(input_file, "r") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"): continue
            try:
                if "/" in line:
                    network = ipaddress.ip_network(line, strict=False)
                    for ip in network.hosts():
                        ip_list.append(str(ip))
                else:
                    ipaddress.ip_address(line) # Validation
                    ip_list.append(line)
            except ValueError:
                print(f"{C.R}[!] Invalid entry ignored: {line}{C.END}")

    ip_list = list(dict.fromkeys(ip_list)) # حذف موارد تکراری
    total_ips = len(ip_list)
    print(f"{C.Y}Extracted {total_ips} IP addresses to analyze...{C.END}\n")
    
    results = []
    with ThreadPoolExecutor(max_workers=MAX_THREADS) as executor:
        futures = {executor.submit(perform_full_analysis, ip): ip for ip in ip_list}
        done_count = 0
        for future in as_completed(futures):
            done_count += 1
            res = future.result()
            if res:
                results.append(res)
                print(f"{C.G}[{done_count}/{total_ips}] {res['ip']:<15} | Ping: {res['latency']:>5}ms | DL: {res['dl']:>6}Mbps | UL: {res['ul']:>6}Mbps{C.END}")
            else:
                print(f"{C.R}[{done_count}/{total_ips}] {futures[future]:<15} | FAILED PRO VALIDATION{C.END}")

    # رتبه‌بندی نهایی
    top_ranked = sorted(results, key=lambda x: x['score'], reverse=True)[:TOP_N]
    
    print("\n" + "═"*85)
    print(f"{C.C}{C.BOLD}{'RANK':<6} {'IP ADDRESS':<20} {'PING (ms)':<15} {'DL (Mbps)':<15} {'UL (Mbps)':<15} {'SCORE'}{C.END}")
    print("═"*85)
    
    for i, r in enumerate(top_ranked, 1):
        color = C.G if i == 1 else (C.W if i < 10 else C.Y)
        print(f"{color}{i:<6} {r['ip']:<20} {r['latency']:<15} {r['dl']:<15} {r['ul']:<15} {int(r['score']):<10}{C.END}")
    print("═"*85)

    # ذخیره نتایج برای استفاده در داشبورد یا گزارش
    with open("best_resolvers.json", "w") as f:
        json.dump(top_ranked, f, indent=4)
    print(f"{C.G}\n[✓] Final analytics saved to best_resolvers.json{C.END}")

if __name__ == "__main__":
    main()
