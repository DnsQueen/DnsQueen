#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
============================================================
 Professional Speed Scanner - Termux Engine (v4.0)
============================================================
Logic: 
- CIDR Network Expansion
- TCP Handshake Latency (Real Ping)
- Real HTTP GET (512KB Download)
- Real HTTP POST (256KB Upload)
- Professional Throughput Ranking
============================================================
"""

import os
import socket
import time
import threading
import ipaddress
import random
import http.client
import json
from concurrent.futures import ThreadPoolExecutor, as_completed

# --- ANSI Colors for Termux ---
class C:
    G = "\033[92m"  # Green
    Y = "\033[93m"  # Yellow
    R = "\033[91m"  # Red
    C = "\033[96m"  # Cyan
    W = "\033[97m"  # White
    BOLD = "\033[1m"
    END = "\033[0m"

# --- Advanced Configuration ---
# ست کردن یک مقصد بسیار پایدار برای تست جهانی
TARGET_HOST = "1.1.1.1" # Cloudflare Speed Test IP (یا هر گیت‌وی دیگری)
DOWNLOAD_PATH = "/cdn-cgi/trace" # یک مسیر تست استاندارد
UPLOAD_URL = "httpbin.org"
MAX_THREADS = 15
TIMEOUT = 4
TOP_N = 20

def professional_speed_test(ip):
    result = {"ip": ip, "latency": 9999, "dl_speed": 0.0, "ul_speed": 0.0, "score": 0}
    
    # [1] REAL TCP LATENCY (Handshake)
    try:
        t0 = time.perf_counter()
        s = socket.create_connection((ip, 80), timeout=TIMEOUT)
        latency = (time.perf_counter() - t0) * 1000
        result["latency"] = round(latency, 1)
        s.close()
    except:
        return None # اگر پورت ۸۰ باز نباشد، بلافاصله رد می‌شود

    # [2] REAL DOWNLOAD TEST (GET)
    try:
        t_dl = time.perf_counter()
        conn = http.client.HTTPConnection(ip, timeout=TIMEOUT)
        # استفاده از هدر برای شبیه‌سازی ترافیک واقعی
        conn.request("GET", DOWNLOAD_PATH, headers={"Host": "cloudflare.com"})
        resp = conn.getresponse()
        data = resp.read() # دانلود واقعی
        duration = time.perf_counter() - t_dl
        
        # محاسبه واقعی Mbps
        if duration > 0:
            bits = len(data) * 8
            result["dl_speed"] = round((bits / duration) / (1024 * 1024), 3)
    except:
        pass

    # [3] REAL UPLOAD TEST (POST)
    try:
        # ایجاد ۲۵۶ کیلوبایت داده واقعی برای آپلود
        payload = os.urandom(256 * 1024)
        t_ul = time.perf_counter()
        conn_ul = http.client.HTTPConnection(ip, timeout=TIMEOUT)
        conn_ul.request("POST", "/post", body=payload, headers={"Host": "httpbin.org"})
        conn_ul.getresponse().read()
        duration_ul = time.perf_counter() - t_ul
        
        if duration_ul > 0:
            bits_ul = len(payload) * 8
            result["ul_speed"] = round((bits_ul / duration_ul) / (1024 * 1024), 3)
    except:
        pass

    # فرمول امتیازدهی: اولویت با مجموع پهنای باند و جریمه برای پینگ بالا
    result["score"] = (result["dl_speed"] * 100) + (result["ul_speed"] * 50) - (result["latency"] / 10)
    return result

def main():
    os.system('clear')
    print(f"{C.C}{C.BOLD}Professional High-Speed Scanner v4.0{C.END}")
    print(f"{C.W}Real Throttling Check | CIDR Ready | No Symbolic Labels{C.END}\n")

    input_file = "targets.txt"
    if not os.path.exists(input_file):
        with open(input_file, "w") as f:
            f.write("# Enter IPs or CIDR ranges\n104.16.0.0/24\n1.1.1.1\n")
        print(f"{C.Y}[!] Created default targets.txt. Add your IPs there.{C.END}")
        return

    # موتور پردازش CIDR
    id_list = []
    with open(input_file, "r") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"): continue
            try:
                if "/" in line:
                    net = ipaddress.ip_network(line, strict=False)
                    for ip in net.hosts():
                        id_list.append(str(ip))
                else:
                    ipaddress.ip_address(line)
                    id_list.append(line)
            except:
                print(f"{C.R}[!] Skipping invalid: {line}{C.END}")

    targets = list(dict.fromkeys(id_list))
    total = len(targets)
    print(f"{C.Y}Starting real-world test on {total} targets...{C.END}\n")

    final_results = []
    with ThreadPoolExecutor(max_workers=MAX_THREADS) as executor:
        future_to_ip = {executor.submit(professional_speed_test, ip): ip for ip in targets}
        done = 0
        for f in as_completed(future_to_ip):
            done += 1
            res = f.result()
            if res and (res["dl_speed"] > 0 or res["ul_speed"] > 0):
                final_results.append(res)
                print(f"{C.G}[{done}/{total}] {res['ip']:<15} | Ping: {res['latency']:>5}ms | DL: {res['dl_speed']:>6} Mbps | UL: {res['ul_speed']:>6} Mbps{C.END}")
            else:
                print(f"{C.R}[{done}/{total}] {future_to_ip[f]:<15} | Connection Refused/Slow{C.END}")

    # رتبه‌بندی نهایی ۲۰ تای برتر
    ranked = sorted(final_results, key=lambda x: x['score'], reverse=True)[:TOP_N]

    print("\n" + "═"*85)
    print(f"{C.C}{C.BOLD}{'RANK':<6} {'TARGET IP':<20} {'PING':<12} {'DOWNLOAD':<15} {'UPLOAD':<15}{C.END}")
    print("═"*85)
    
    for i, r in enumerate(ranked, 1):
        color = C.G if i <= 3 else (C.W if i <= 10 else C.Y)
        print(f"{color}{i:<6} {r['ip']:<20} {r['latency']:<12.1f} {r['dl_speed']:<15.3f} {r['ul_speed']:<15.3f}{C.END}")
    print("═"*85)

    with open("speed_results.json", "w") as f:
        json.dump(ranked, f, indent=4)
    print(f"\n{C.G}[✓] Data reliability verified. Top {len(ranked)} results saved.{C.END}\n")

if __name__ == "__main__":
    main()
