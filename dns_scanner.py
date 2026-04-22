#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
============================================================
 DNS Scanner Pro - Professional Mobile Logic
============================================================
Developer: Farbod (via AI Studio Build)
Logic: Port 53 -> E2E Recursive -> IP-Pinned Speed Test
============================================================
"""

import sys
import os
import socket
import struct
import time
import threading
import random
import http.client
import json
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime

# استایل‌های رنگی برای ترموکس
class C:
    G = "\033[92m"  # Green
    Y = "\033[93m"  # Yellow
    R = "\033[91m"  # Red
    C = "\033[96m"  # Cyan
    W = "\033[97m"  # White
    BOLD = "\033[1m"
    END = "\033[0m"

# تنظیمات تست واقعی
TEST_DOMAIN = "www.gstatic.com"
DL_PATH = "/generate_204"
MAX_THREADS = 15
TOP_N = 20

def build_dns_query(domain):
    tx_id = random.randint(0, 65535)
    header = struct.pack(">HHHHHH", tx_id, 0x0100, 1, 0, 0, 0)
    q = b""
    for part in domain.split("."):
        q += bytes([len(part)]) + part.encode()
    q += b"\x00" + struct.pack(">HH", 1, 1)
    return tx_id, header + q

def parse_dns_response(data, tx_id):
    try:
        rid, flags, qdc, anc, nsc, arc = struct.unpack(">HHHHHH", data[:12])
        if rid != tx_id: return None
        idx = 12
        while data[idx] != 0: idx += data[idx] + 1
        idx += 5
        ips = []
        for _ in range(anc):
            if data[idx] & 0xC0 == 0xC0: idx += 2
            else:
                while data[idx] != 0: idx += data[idx] + 1
                idx += 1
            rtype, _, _, rdlen = struct.unpack(">HHIH", data[idx:idx+10])
            idx += 10
            if rtype == 1: ips.append(".".join(map(str, data[idx:idx+4])))
            idx += rdlen
        return ips
    except: return None

def scan_resolver(ip):
    # چک زنده بودن و پینگ اولیه
    tx_id, query = build_dns_query("google.com")
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.settimeout(2.5)
    try:
        t0 = time.perf_counter()
        sock.sendto(query, (ip, 53))
        data, _ = sock.recvfrom(512)
        lat = (time.perf_counter() - t0) * 1000
        if not parse_dns_response(data, tx_id): return None
    except: return None
    finally: sock.close()

    # تست سرعت واقعی (IP-Pinned)
    # ابتدا گوگل را از طریق خود ریزالور پیدا می‌کنیم
    tx_id_s, q_s = build_dns_query(TEST_DOMAIN)
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.settimeout(3.0)
    res_ip = None
    try:
        sock.sendto(q_s, (ip, 53))
        d_s, _ = sock.recvfrom(512)
        ips = parse_dns_response(d_s, tx_id_s)
        if ips: res_ip = ips[0]
    except: pass
    finally: sock.close()

    if not res_ip: return None

    # وصل شدن مستقیم به آی‌پی برای تست سرعت
    try:
        t_start = time.perf_counter()
        conn = http.client.HTTPConnection(res_ip, timeout=5)
        conn.request("GET", DL_PATH, headers={"Host": TEST_DOMAIN})
        resp = conn.getresponse()
        raw_data = resp.read()
        dur = time.perf_counter() - t_start
        mbps = (len(raw_data) * 8 / dur) / (1024 * 1024) if dur > 0 else 0
        
        score = (1000 / (lat + 1)) + (mbps * 50)
        return {"ip": ip, "latency": round(lat, 1), "speed": round(mbps, 3), "score": score}
    except: return None

def main():
    os.system('clear')
    print(f"{C.C}{C.BOLD}DNS Scanner Pro - Active Network Analytics{C.END}\n")
    
    if not os.path.exists("resolvers.txt"):
        with open("resolvers.txt", "w") as f:
            f.write("8.8.8.8\n1.1.1.1\n9.9.9.9\n")
            
    with open("resolvers.txt", "r") as f:
        ips = [line.strip() for line in f if line.strip() and not line.startswith("#")]

    results = []
    print(f"{C.Y}Analyzing {len(ips)} targets...{C.END}")
    
    with ThreadPoolExecutor(max_workers=MAX_THREADS) as executor:
        futures = {executor.submit(scan_resolver, ip): ip for ip in ips}
        for future in as_completed(futures):
            res = future.result()
            if res:
                results.append(res)
                print(f"{C.G}✓ {res['ip']:<15} | {res['latency']:>5}ms | {res['speed']:>6} Mbps{C.END}")
            else:
                print(f"{C.R}✗ {futures[future]:<15} | Timeout/Failed{C.END}")

    ranked = sorted(results, key=lambda x: x['score'], reverse=True)[:TOP_N]
    
    print("\n" + "="*55)
    print(f"{'RANK':<5} {'IP ADDRESS':<18} {'PING':<10} {'SPD(Mbps)':<12}")
    print("-" * 55)
    for i, r in enumerate(ranked, 1):
        line_color = C.G if i == 1 else C.W
        print(f"{line_color}{i:<5} {r['ip']:<18} {r['latency']:<10} {r['speed']:<12}{C.END}")
    print("="*55)

if __name__ == "__main__":
    main()
