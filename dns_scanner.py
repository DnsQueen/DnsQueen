#!/usr/bin/env python3
# ============================================================
#  DNS Scanner Pro - Termux Edition
#  Author  : DNS Scanner Pro
#  Version : 2.0.0
#  License : MIT
# ============================================================
#
#  USAGE:
#    python dns_scanner.py [OPTIONS]
#
#  OPTIONS:
#    -i, --input      FILE    Input file with IPs/CIDRs     [default: resolvers.txt]
#    -o, --output     FILE    Output file for results       [default: results.txt]
#    -t, --threads    NUM     Parallel threads              [default: 10]
#    -T, --timeout    SEC     Timeout per test (seconds)    [default: 5]
#    -d, --domain     DOMAIN  Domain for E2E test           [default: google.com]
#    -u, --url        URL     URL for download test         [default: http://www.gstatic.com/generate_204]
#    --upload-url     URL     URL for upload test           [default: https://httpbin.org/post]
#    --ssh-host       HOST    SSH host for SSH test
#    --ssh-key        FILE    SSH private key file
#    --ssh-user       USER    SSH username                  [default: root]
#    --no-upload              Skip upload test
#    --no-ssh                 Skip SSH test
#    --top            NUM     Show top N results            [default: all]
#    --min-download   MBPS    Minimum download speed        [default: 0]
#    --min-upload     MBPS    Minimum upload speed          [default: 0]
#    -v, --verbose            Verbose output
#    -h, --help               Show this help
#
# ============================================================

import sys
import os
import socket
import struct
import time
import threading
import ipaddress
import subprocess
import argparse
import json
import random
import string
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed

# ──────────────────────────────────────────────
#  رنگ‌های ترمینال (ANSI)
# ──────────────────────────────────────────────
class Colors:
    RESET   = "\033[0m"
    BOLD    = "\033[1m"
    RED     = "\033[91m"
    GREEN   = "\033[92m"
    YELLOW  = "\033[93m"
    BLUE    = "\033[94m"
    MAGENTA = "\033[95m"
    CYAN    = "\033[96m"
    WHITE   = "\033[97m"
    DIM     = "\033[2m"
    BG_DARK = "\033[40m"

C = Colors()

def cprint(msg, color=C.WHITE, bold=False, end="\n"):
    prefix = C.BOLD if bold else ""
    print(f"{prefix}{color}{msg}{C.RESET}", end=end)

# ──────────────────────────────────────────────
#  بنر
# ──────────────────────────────────────────────
BANNER = f"""
{C.CYAN}{C.BOLD}
╔══════════════════════════════════════════════════════════╗
║           DNS Scanner Pro  ·  Termux Edition             ║
║        Port 53 → E2E → Download → Upload → Rank          ║
╚══════════════════════════════════════════════════════════╝
{C.RESET}"""

# ──────────────────────────────────────────────
#  پارس کردن IP/CIDR از فایل
# ──────────────────────────────────────────────
def load_targets(filepath: str) -> list[str]:
    targets = []
    try:
        with open(filepath, "r") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                try:
                    net = ipaddress.ip_network(line, strict=False)
                    for ip in net.hosts():
                        targets.append(str(ip))
                except ValueError:
                    # single IP or hostname
                    targets.append(line)
    except FileNotFoundError:
        cprint(f"[ERROR] فایل ورودی '{filepath}' پیدا نشد!", C.RED, bold=True)
        sys.exit(1)
    return list(dict.fromkeys(targets))  # remove duplicates

# ──────────────────────────────────────────────
#  ساخت DNS Query دستی (UDP)
# ──────────────────────────────────────────────
def build_dns_query(domain: str, qtype: int = 1) -> bytes:
    tx_id = random.randint(0, 65535)
    flags = 0x0100  # standard query, recursion desired
    qdcount = 1
    header = struct.pack(">HHHHHH", tx_id, flags, qdcount, 0, 0, 0)
    question = b""
    for part in domain.split("."):
        encoded = part.encode()
        question += bytes([len(encoded)]) + encoded
    question += b"\x00"
    question += struct.pack(">HH", qtype, 1)  # QTYPE=A, QCLASS=IN
    return header + question

def parse_dns_response(data: bytes) -> list[str]:
    """استخراج IP آدرس‌ها از پاسخ DNS"""
    ips = []
    try:
        ancount = struct.unpack(">H", data[6:8])[0]
        if ancount == 0:
            return ips
        # skip header (12 bytes) + question section
        idx = 12
        # skip question
        while data[idx] != 0:
            idx += data[idx] + 1
        idx += 5  # null byte + QTYPE + QCLASS
        # parse answers
        for _ in range(ancount):
            if idx >= len(data):
                break
            # name (may be pointer)
            if data[idx] & 0xC0 == 0xC0:
                idx += 2
            else:
                while data[idx] != 0:
                    idx += data[idx] + 1
                idx += 1
            rtype, _, _, rdlength = struct.unpack(">HHIH", data[idx:idx+10])
            idx += 10
            if rtype == 1 and rdlength == 4:
                ip = ".".join(map(str, data[idx:idx+4]))
                ips.append(ip)
            idx += rdlength
    except Exception:
        pass
    return ips

# ──────────────────────────────────────────────
#  مرحله ۱: تست Port 53 (Alive Check)
# ──────────────────────────────────────────────
def check_port53(ip: str, timeout: float = 3) -> tuple[bool, float]:
    """
    بررسی زنده بودن DNS روی پورت ۵۳ (هم UDP هم TCP)
    برمیگردونه: (alive, latency_ms)
    """
    # UDP check
    try:
        query = build_dns_query("example.com")
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.settimeout(timeout)
        t0 = time.perf_counter()
        sock.sendto(query, (ip, 53))
        data, _ = sock.recvfrom(512)
        latency = (time.perf_counter() - t0) * 1000
        sock.close()
        if len(data) >= 12:
            return True, round(latency, 2)
    except Exception:
        pass
    finally:
        try:
            sock.close()
        except Exception:
            pass

    # TCP fallback
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(timeout)
        t0 = time.perf_counter()
        sock.connect((ip, 53))
        latency = (time.perf_counter() - t0) * 1000
        sock.close()
        return True, round(latency, 2)
    except Exception:
        return False, 0.0
    finally:
        try:
            sock.close()
        except Exception:
            pass

# ──────────────────────────────────────────────
#  مرحله ۲: تست E2E (DNS Resolution)
# ──────────────────────────────────────────────
def test_e2e(ip: str, domain: str, timeout: float = 5) -> dict:
    """
    تست End-to-End: resolve دامنه با DNS مشخص
    برمیگردونه: {passed, latency_ms, resolved_ips, error}
    """
    result = {"passed": False, "latency_ms": 0.0, "resolved_ips": [], "error": ""}
    try:
        query = build_dns_query(domain)
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.settimeout(timeout)
        t0 = time.perf_counter()
        sock.sendto(query, (ip, 53))
        data, _ = sock.recvfrom(1024)
        latency = (time.perf_counter() - t0) * 1000
        sock.close()

        ips = parse_dns_response(data)
        if ips:
            result["passed"] = True
            result["latency_ms"] = round(latency, 2)
            result["resolved_ips"] = ips
        else:
            result["error"] = "No A records in response"
    except socket.timeout:
        result["error"] = "Timeout"
    except Exception as e:
        result["error"] = str(e)
    finally:
        try:
            sock.close()
        except Exception:
            pass
    return result

# ──────────────────────────────────────────────
#  مرحله ۳: تست HTTP
# ──────────────────────────────────────────────
def test_http(ip: str, url: str, timeout: float = 5) -> dict:
    """
    تست HTTP: بررسی دسترسی به URL از طریق IP مشخص
    """
    result = {"passed": False, "latency_ms": 0.0, "status_code": 0, "error": ""}
    try:
        import urllib.request
        import urllib.error

        # ساخت request با timeout
        t0 = time.perf_counter()
        req = urllib.request.Request(url, headers={"User-Agent": "DNSScannerPro/2.0"})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            latency = (time.perf_counter() - t0) * 1000
            result["passed"] = resp.status < 400
            result["latency_ms"] = round(latency, 2)
            result["status_code"] = resp.status
    except urllib.error.HTTPError as e:
        result["status_code"] = e.code
        result["error"] = f"HTTP {e.code}"
        result["passed"] = e.code < 400
    except Exception as e:
        result["error"] = str(e)
    return result

# ──────────────────────────────────────────────
#  مرحله ۴: تست Download
# ──────────────────────────────────────────────
def test_download(download_url: str, timeout: float = 15) -> dict:
    """
    تست سرعت دانلود
    برمیگردونه: {speed_mbps, bytes_downloaded, duration_s, error}
    """
    result = {"speed_mbps": 0.0, "bytes_downloaded": 0, "duration_s": 0.0, "error": ""}
    try:
        import urllib.request

        # اضافه کردن cache-buster
        url = download_url
        if "?" not in url:
            url += f"?cb={random.randint(100000, 999999)}"
        else:
            url += f"&cb={random.randint(100000, 999999)}"

        req = urllib.request.Request(url, headers={
            "User-Agent": "DNSScannerPro/2.0",
            "Cache-Control": "no-cache"
        })

        t0 = time.perf_counter()
        total_bytes = 0
        chunk_size = 8192

        with urllib.request.urlopen(req, timeout=timeout) as resp:
            while True:
                chunk = resp.read(chunk_size)
                if not chunk:
                    break
                total_bytes += len(chunk)
                # حداکثر ۵ مگابایت دانلود
                if total_bytes >= 5 * 1024 * 1024:
                    break

        duration = time.perf_counter() - t0
        if duration > 0 and total_bytes > 0:
            speed_bps = total_bytes / duration
            speed_mbps = (speed_bps * 8) / (1024 * 1024)
            result["speed_mbps"] = round(speed_mbps, 3)
            result["bytes_downloaded"] = total_bytes
            result["duration_s"] = round(duration, 3)
        else:
            result["error"] = "No data received"
    except Exception as e:
        result["error"] = str(e)
    return result

# ──────────────────────────────────────────────
#  مرحله ۵: تست Upload
# ──────────────────────────────────────────────
def test_upload(upload_url: str, size_kb: int = 512, timeout: float = 15) -> dict:
    """
    تست سرعت آپلود
    """
    result = {"speed_mbps": 0.0, "bytes_uploaded": 0, "duration_s": 0.0, "error": ""}
    try:
        import urllib.request

        # ساخت داده‌ی تصادفی
        data = os.urandom(size_kb * 1024)

        req = urllib.request.Request(
            upload_url,
            data=data,
            method="POST",
            headers={
                "User-Agent": "DNSScannerPro/2.0",
                "Content-Type": "application/octet-stream",
                "Content-Length": str(len(data))
            }
        )

        t0 = time.perf_counter()
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            resp.read()
        duration = time.perf_counter() - t0

        if duration > 0:
            speed_bps = len(data) / duration
            speed_mbps = (speed_bps * 8) / (1024 * 1024)
            result["speed_mbps"] = round(speed_mbps, 3)
            result["bytes_uploaded"] = len(data)
            result["duration_s"] = round(duration, 3)
    except Exception as e:
        result["error"] = str(e)
    return result

# ──────────────────────────────────────────────
#  مرحله ۶: تست SSH (اختیاری)
# ──────────────────────────────────────────────
def test_ssh(ssh_host: str, ssh_key: str, ssh_user: str = "root", timeout: float = 10) -> dict:
    """
    تست اتصال SSH
    نیاز به: ssh_host, ssh_key (path to private key)
    """
    result = {"passed": False, "latency_ms": 0.0, "error": ""}
    try:
        t0 = time.perf_counter()
        proc = subprocess.run(
            [
                "ssh",
                "-i", ssh_key,
                "-o", "StrictHostKeyChecking=no",
                "-o", "ConnectTimeout=10",
                "-o", "BatchMode=yes",
                "-o", "PasswordAuthentication=no",
                f"{ssh_user}@{ssh_host}",
                "echo OK"
            ],
            capture_output=True,
            text=True,
            timeout=timeout + 2
        )
        latency = (time.perf_counter() - t0) * 1000
        if proc.returncode == 0 and "OK" in proc.stdout:
            result["passed"] = True
            result["latency_ms"] = round(latency, 2)
        else:
            result["error"] = proc.stderr.strip()[:100]
    except subprocess.TimeoutExpired:
        result["error"] = "SSH Timeout"
    except FileNotFoundError:
        result["error"] = "ssh not found (install openssh)"
    except Exception as e:
        result["error"] = str(e)
    return result

# ──────────────────────────────────────────────
#  پردازش کامل یک IP
# ──────────────────────────────────────────────
def process_ip(ip: str, cfg: dict, verbose: bool = False) -> dict:
    """
    تمام مراحل تست رو برای یک IP اجرا میکنه
    """
    result = {
        "ip": ip,
        "alive": False,
        "port53_latency_ms": 0.0,
        "e2e": {"passed": False, "latency_ms": 0.0, "resolved_ips": [], "error": ""},
        "http": {"passed": False, "latency_ms": 0.0, "status_code": 0, "error": ""},
        "download": {"speed_mbps": 0.0, "bytes_downloaded": 0, "duration_s": 0.0, "error": ""},
        "upload": {"speed_mbps": 0.0, "bytes_uploaded": 0, "duration_s": 0.0, "error": ""},
        "ssh": {"passed": False, "latency_ms": 0.0, "error": "skipped"},
        "score": 0.0,
        "rank": 0
    }

    if verbose:
        cprint(f"  [→] {ip} : Port 53 check...", C.DIM)

    # ── مرحله ۱: Port 53
    alive, p53_latency = check_port53(ip, timeout=cfg["timeout"])
    result["alive"] = alive
    result["port53_latency_ms"] = p53_latency

    if not alive:
        if verbose:
            cprint(f"  [✗] {ip} : Dead (Port 53 closed)", C.RED)
        return result

    if verbose:
        cprint(f"  [✓] {ip} : Alive ({p53_latency:.1f}ms) → E2E...", C.GREEN)

    # ── مرحله ۲: E2E
    e2e = test_e2e(ip, cfg["domain"], timeout=cfg["timeout"])
    result["e2e"] = e2e

    if not e2e["passed"]:
        if verbose:
            cprint(f"  [✗] {ip} : E2E Failed ({e2e['error']})", C.YELLOW)
        return result

    if verbose:
        cprint(f"  [✓] {ip} : E2E OK ({e2e['latency_ms']:.1f}ms) → HTTP...", C.GREEN)

    # ── مرحله ۳: HTTP
    http_result = test_http(ip, cfg["http_url"], timeout=cfg["timeout"])
    result["http"] = http_result

    if verbose:
        status = "OK" if http_result["passed"] else f"FAIL ({http_result['error']})"
        color = C.GREEN if http_result["passed"] else C.YELLOW
        cprint(f"  [{'✓' if http_result['passed'] else '✗'}] {ip} : HTTP {status} ({http_result['latency_ms']:.1f}ms) → Download...", color)

    # ── مرحله ۴: Download
    dl = test_download(cfg["download_url"], timeout=cfg["timeout"] * 3)
    result["download"] = dl

    if verbose:
        if dl["error"]:
            cprint(f"  [✗] {ip} : Download FAIL ({dl['error']})", C.YELLOW)
        else:
            cprint(f"  [↓] {ip} : Download {dl['speed_mbps']:.2f} Mbps → Upload...", C.CYAN)

    # ── مرحله ۵: Upload (اختیاری)
    if not cfg.get("no_upload", False):
        ul = test_upload(cfg["upload_url"], size_kb=cfg.get("upload_size_kb", 512), timeout=cfg["timeout"] * 3)
        result["upload"] = ul
        if verbose:
            if ul["error"]:
                cprint(f"  [✗] {ip} : Upload FAIL ({ul['error']})", C.YELLOW)
            else:
                cprint(f"  [↑] {ip} : Upload {ul['speed_mbps']:.2f} Mbps", C.CYAN)

    # ── مرحله ۶: SSH (اختیاری)
    if cfg.get("ssh_host") and cfg.get("ssh_key") and not cfg.get("no_ssh", False):
        ssh_result = test_ssh(cfg["ssh_host"], cfg["ssh_key"], cfg.get("ssh_user", "root"), timeout=cfg["timeout"] * 2)
        result["ssh"] = ssh_result
        if verbose:
            status = "OK" if ssh_result["passed"] else f"FAIL ({ssh_result['error']})"
            cprint(f"  [{'✓' if ssh_result['passed'] else '✗'}] {ip} : SSH {status}", C.GREEN if ssh_result["passed"] else C.YELLOW)

    # ── محاسبه امتیاز نهایی
    # وزن‌دهی: E2E latency (پایین‌تر بهتر) + Download + Upload
    e2e_score = max(0, 1000 - e2e["latency_ms"]) / 1000 * 30   # 30%
    dl_score  = min(dl["speed_mbps"], 100) / 100 * 50           # 50%
    ul_score  = min(result["upload"]["speed_mbps"], 50) / 50 * 20 if not cfg.get("no_upload") else 0  # 20%
    result["score"] = round(e2e_score + dl_score + ul_score, 4)

    return result

# ──────────────────────────────────────────────
#  نمایش پیشرفت
# ──────────────────────────────────────────────
_lock = threading.Lock()
_counter = {"done": 0, "total": 0, "alive": 0, "passed": 0}

def update_progress(result: dict):
    with _lock:
        _counter["done"] += 1
        if result["alive"]:
            _counter["alive"] += 1
        if result["e2e"]["passed"]:
            _counter["passed"] += 1
        done  = _counter["done"]
        total = _counter["total"]
        pct   = done / total * 100
        bar_w = 30
        filled = int(bar_w * done / total)
        bar = "█" * filled + "░" * (bar_w - filled)
        print(
            f"\r{C.CYAN}[{bar}]{C.RESET} {pct:.1f}% "
            f"| Done:{done}/{total} "
            f"| Alive:{C.GREEN}{_counter['alive']}{C.RESET} "
            f"| Passed:{C.YELLOW}{_counter['passed']}{C.RESET}   ",
            end="", flush=True
        )

# ──────────────────────────────────────────────
#  نمایش جدول نتایج
# ──────────────────────────────────────────────
def print_results_table(ranked: list[dict]):
    cprint("\n\n" + "═" * 100, C.CYAN)
    cprint(f"{'#':<4} {'IP':<18} {'P53(ms)':<10} {'E2E(ms)':<10} {'HTTP':<8} {'DL(Mbps)':<12} {'UL(Mbps)':<12} {'SSH':<8} {'Score':<8}", C.BOLD + C.WHITE)
    cprint("═" * 100, C.CYAN)

    for i, r in enumerate(ranked, 1):
        e2e_lat = f"{r['e2e']['latency_ms']:.1f}" if r['e2e']['passed'] else "FAIL"
        http_ok = "✓" if r['http']['passed'] else "✗"
        dl_spd  = f"{r['download']['speed_mbps']:.2f}" if not r['download']['error'] else "ERR"
        ul_spd  = f"{r['upload']['speed_mbps']:.2f}" if not r['upload']['error'] else "ERR"
        ssh_ok  = "✓" if r['ssh']['passed'] else ("skip" if r['ssh']['error'] == "skipped" else "✗")
        score   = f"{r['score']:.3f}"

        color = C.GREEN if i <= 3 else (C.YELLOW if i <= 10 else C.WHITE)
        cprint(
            f"{i:<4} {r['ip']:<18} {r['port53_latency_ms']:<10.1f} {e2e_lat:<10} {http_ok:<8} {dl_spd:<12} {ul_spd:<12} {ssh_ok:<8} {score:<8}",
            color
        )
    cprint("═" * 100, C.CYAN)

# ──────────────────────────────────────────────
#  ذخیره خروجی
# ──────────────────────────────────────────────
def save_results(ranked: list[dict], output_file: str, cfg: dict):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # ── فایل TXT ساده (فقط IP‌های عمودی)
    plain_file = output_file.replace(".txt", "_ips.txt")
    with open(plain_file, "w") as f:
        f.write(f"# DNS Scanner Pro - Results\n")
        f.write(f"# Generated : {timestamp}\n")
        f.write(f"# Total     : {len(ranked)} resolvers\n\n")
        for r in ranked:
            f.write(f"{r['ip']}\n")
    cprint(f"  [✓] IP list saved → {plain_file}", C.GREEN)

    # ── فایل TXT با جزئیات کامل
    with open(output_file, "w", encoding="utf-8") as f:
        f.write("=" * 80 + "\n")
        f.write(" DNS Scanner Pro — Detailed Results\n")
        f.write(f" Generated : {timestamp}\n")
        f.write(f" Domain    : {cfg['domain']}\n")
        f.write(f" DL URL    : {cfg['download_url']}\n")
        f.write(f" UL URL    : {cfg['upload_url']}\n")
        f.write("=" * 80 + "\n\n")

        f.write(f"{'RANK':<5} {'IP':<18} {'P53ms':<8} {'E2Ems':<8} {'HTTP':<6} {'DL_Mbps':<10} {'UL_Mbps':<10} {'SSH':<6} {'SCORE':<8}\n")
        f.write("-" * 80 + "\n")
        for i, r in enumerate(ranked, 1):
            e2e_lat = f"{r['e2e']['latency_ms']:.1f}" if r['e2e']['passed'] else "FAIL"
            http_ok = "OK" if r['http']['passed'] else "NO"
            dl_spd  = f"{r['download']['speed_mbps']:.3f}" if not r['download']['error'] else "ERR"
            ul_spd  = f"{r['upload']['speed_mbps']:.3f}" if not r['upload']['error'] else "ERR"
            ssh_ok  = "OK" if r['ssh']['passed'] else ("skip" if r['ssh']['error'] == "skipped" else "NO")
            f.write(f"{i:<5} {r['ip']:<18} {r['port53_latency_ms']:<8.1f} {e2e_lat:<8} {http_ok:<6} {dl_spd:<10} {ul_spd:<10} {ssh_ok:<6} {r['score']:.4f}\n")

        f.write("\n" + "=" * 80 + "\n")
        f.write(" DETAILED JSON PER IP\n")
        f.write("=" * 80 + "\n\n")
        for r in ranked:
            f.write(json.dumps(r, ensure_ascii=False, indent=2) + "\n\n")

    cprint(f"  [✓] Detailed report saved → {output_file}", C.GREEN)

    # ── فایل JSON
    json_file = output_file.replace(".txt", ".json")
    with open(json_file, "w", encoding="utf-8") as f:
        json.dump({
            "meta": {
                "generated": timestamp,
                "domain": cfg["domain"],
                "download_url": cfg["download_url"],
                "upload_url": cfg["upload_url"],
                "total_results": len(ranked)
            },
            "results": ranked
        }, f, ensure_ascii=False, indent=2)
    cprint(f"  [✓] JSON data saved    → {json_file}", C.GREEN)

# ──────────────────────────────────────────────
#  Main
# ──────────────────────────────────────────────
def parse_args():
    parser = argparse.ArgumentParser(
        description="DNS Scanner Pro - Termux Edition",
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("-i", "--input",       default="resolvers.txt",                           help="Input file (IPs/CIDRs)")
    parser.add_argument("-o", "--output",      default="results.txt",                             help="Output file")
    parser.add_argument("-t", "--threads",     type=int, default=10,                              help="Parallel threads (default: 10)")
    parser.add_argument("-T", "--timeout",     type=float, default=5,                             help="Timeout in seconds (default: 5)")
    parser.add_argument("-d", "--domain",      default="google.com",                              help="Domain for E2E test")
    parser.add_argument("-u", "--url",         default="http://www.gstatic.com/generate_204",     help="Download test URL")
    parser.add_argument("--upload-url",        default="https://httpbin.org/post",                help="Upload test URL")
    parser.add_argument("--http-url",          default="http://www.gstatic.com/generate_204",     help="HTTP reachability test URL")
    parser.add_argument("--upload-size",       type=int, default=512,                             help="Upload size in KB (default: 512)")
    parser.add_argument("--ssh-host",          default="",                                        help="SSH host for SSH test")
    parser.add_argument("--ssh-key",           default="",                                        help="SSH private key file")
    parser.add_argument("--ssh-user",          default="root",                                    help="SSH username")
    parser.add_argument("--no-upload",         action="store_true",                               help="Skip upload test")
    parser.add_argument("--no-ssh",            action="store_true",                               help="Skip SSH test")
    parser.add_argument("--top",               type=int, default=0,                               help="Show top N results (0=all)")
    parser.add_argument("--min-download",      type=float, default=0,                             help="Minimum download speed (Mbps)")
    parser.add_argument("--min-upload",        type=float, default=0,                             help="Minimum upload speed (Mbps)")
    parser.add_argument("-v", "--verbose",     action="store_true",                               help="Verbose output per IP")
    return parser.parse_args()


def main():
    print(BANNER)
    args = parse_args()

    cfg = {
        "timeout":        args.timeout,
        "domain":         args.domain,
        "download_url":   args.url,
        "upload_url":     args.upload_url,
        "http_url":       args.http_url,
        "upload_size_kb": args.upload_size,
        "ssh_host":       args.ssh_host,
        "ssh_key":        args.ssh_key,
        "ssh_user":       args.ssh_user,
        "no_upload":      args.no_upload,
        "no_ssh":         args.no_ssh,
    }

    # بارگذاری هدف‌ها
    targets = load_targets(args.input)
    total = len(targets)

    cprint(f"  [i] Loaded {total} targets from '{args.input}'", C.CYAN, bold=True)
    cprint(f"  [i] Threads : {args.threads} | Timeout : {args.timeout}s", C.CYAN)
    cprint(f"  [i] Domain  : {cfg['domain']}", C.CYAN)
    cprint(f"  [i] DL URL  : {cfg['download_url']}", C.CYAN)
    if not args.no_upload:
        cprint(f"  [i] UL URL  : {cfg['upload_url']}", C.CYAN)
    if cfg["ssh_host"]:
        cprint(f"  [i] SSH     : {cfg['ssh_user']}@{cfg['ssh_host']} (key: {cfg['ssh_key']})", C.CYAN)
    cprint(f"\n  Starting scan at {datetime.now().strftime('%H:%M:%S')}\n", C.WHITE)

    _counter["total"] = total
    all_results = []

    with ThreadPoolExecutor(max_workers=args.threads) as executor:
        futures = {executor.submit(process_ip, ip, cfg, args.verbose): ip for ip in targets}
        for future in as_completed(futures):
            try:
                res = future.result()
            except Exception as e:
                ip = futures[future]
                res = {"ip": ip, "alive": False, "e2e": {"passed": False}, "score": 0.0}
            all_results.append(res)
            if not args.verbose:
                update_progress(res)

    print()  # newline after progress bar

    # فیلتر: فقط E2E passed
    passed = [r for r in all_results if r["e2e"]["passed"]]

    # فیلتر سرعت حداقل
    if args.min_download > 0:
        passed = [r for r in passed if r["download"]["speed_mbps"] >= args.min_download]
    if args.min_upload > 0 and not args.no_upload:
        passed = [r for r in passed if r["upload"]["speed_mbps"] >= args.min_upload]

    # رده‌بندی بر اساس score
    ranked = sorted(passed, key=lambda x: x["score"], reverse=True)
    for i, r in enumerate(ranked, 1):
        r["rank"] = i

    # محدود کردن به top N
    if args.top > 0:
        ranked = ranked[:args.top]

    # آمار کلی
    alive_count  = sum(1 for r in all_results if r["alive"])
    passed_count = len([r for r in all_results if r["e2e"]["passed"]])

    cprint("\n\n" + "─" * 50, C.CYAN)
    cprint("  📊 SUMMARY", C.BOLD + C.WHITE)
    cprint("─" * 50, C.CYAN)
    cprint(f"  Total Scanned : {total}", C.WHITE)
    cprint(f"  Port 53 Alive : {alive_count}  ({alive_count/total*100:.1f}%)", C.GREEN)
    cprint(f"  E2E Passed    : {passed_count}  ({passed_count/total*100:.1f}%)", C.YELLOW)
    cprint(f"  Final Ranked  : {len(ranked)}", C.CYAN)
    cprint("─" * 50, C.CYAN)

    if not ranked:
        cprint("\n  [!] No resolvers passed all tests.", C.RED, bold=True)
        sys.exit(0)

    # نمایش جدول
    print_results_table(ranked)

    # ذخیره نتایج
    cprint("\n  💾 Saving results...", C.CYAN, bold=True)
    save_results(ranked, args.output, cfg)

    cprint(f"\n  ✅ Done! Top resolver: {C.GREEN}{ranked[0]['ip']}{C.RESET} (Score: {ranked[0]['score']:.3f})", C.WHITE, bold=True)
    cprint(f"  Finished at {datetime.now().strftime('%H:%M:%S')}\n", C.DIM)


if __name__ == "__main__":
    main()
