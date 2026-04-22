export const DNS_SCANNER_SCRIPT = `#!/usr/bin/env python3
# ============================================================
#  DNS Scanner Pro - Termux Edition
#  Version : 2.0.0  |  License : MIT
#  GitHub  : github.com/yourusername/dns-scanner-pro
# ============================================================
#
#  INSTALL (Termux):
#    pkg update && pkg upgrade -y
#    pkg install python openssh -y
#    pip install requests  # optional, fallback only
#
#  USAGE:
#    python dns_scanner.py [OPTIONS]
#
#  QUICK START:
#    python dns_scanner.py -i resolvers.txt -o results.txt -t 10
#
#  OPTIONS:
#    -i  --input       FILE    Input file (IPs/CIDRs)      [resolvers.txt]
#    -o  --output      FILE    Output file                  [results.txt]
#    -t  --threads     NUM     Parallel threads             [10]
#    -T  --timeout     SEC     Timeout per test             [5]
#    -d  --domain      DOMAIN  Domain for E2E test          [google.com]
#    -u  --url         URL     Download test URL            [gstatic]
#        --upload-url  URL     Upload test URL              [httpbin]
#        --http-url    URL     HTTP reachability URL        [gstatic]
#        --upload-size KB      Upload data size KB          [512]
#        --ssh-host    HOST    SSH host (optional)
#        --ssh-key     FILE    SSH private key file
#        --ssh-user    USER    SSH username                 [root]
#        --no-upload          Skip upload test
#        --no-ssh             Skip SSH test
#        --top         NUM    Show top N results            [all]
#        --min-download MBPS  Minimum download speed
#        --min-upload   MBPS  Minimum upload speed
#    -v  --verbose            Verbose output per IP
#
# ============================================================

import sys, os, socket, struct, time, threading, ipaddress
import subprocess, argparse, json, random
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed


class Colors:
    RESET   = "\\033[0m";  BOLD  = "\\033[1m";  DIM   = "\\033[2m"
    RED     = "\\033[91m"; GREEN = "\\033[92m"; YELLOW= "\\033[93m"
    BLUE    = "\\033[94m"; CYAN  = "\\033[96m"; WHITE = "\\033[97m"
C = Colors()

BANNER = f"""
{C.CYAN}{C.BOLD}
╔══════════════════════════════════════════════════════════╗
║           DNS Scanner Pro  ·  Termux Edition  v2.0       ║
║        Port 53 → E2E → HTTP → Download → Upload → Rank   ║
╚══════════════════════════════════════════════════════════╝
{C.RESET}"""

def cprint(msg, color=C.WHITE, bold=False, end="\\n"):
    prefix = C.BOLD if bold else ""
    print(f"{prefix}{color}{msg}{C.RESET}", end=end)


# ── پارس IP/CIDR از فایل
def load_targets(filepath):
    targets = []
    try:
        with open(filepath) as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                try:
                    net = ipaddress.ip_network(line, strict=False)
                    targets.extend(str(ip) for ip in net.hosts())
                except ValueError:
                    targets.append(line)
    except FileNotFoundError:
        cprint(f"[ERROR] فایل '{filepath}' پیدا نشد!", C.RED, bold=True)
        sys.exit(1)
    return list(dict.fromkeys(targets))


# ── ساخت DNS Query دستی
def build_dns_query(domain, qtype=1):
    tx_id = random.randint(0, 65535)
    header = struct.pack(">HHHHHH", tx_id, 0x0100, 1, 0, 0, 0)
    question = b""
    for part in domain.split("."):
        enc = part.encode()
        question += bytes([len(enc)]) + enc
    question += b"\\x00" + struct.pack(">HH", qtype, 1)
    return header + question

def parse_dns_response(data):
    ips = []
    try:
        ancount = struct.unpack(">H", data[6:8])[0]
        if ancount == 0: return ips
        idx = 12
        while data[idx] != 0: idx += data[idx] + 1
        idx += 5
        for _ in range(ancount):
            if idx >= len(data): break
            if data[idx] & 0xC0 == 0xC0: idx += 2
            else:
                while data[idx] != 0: idx += data[idx] + 1
                idx += 1
            rtype, _, _, rdlength = struct.unpack(">HHIH", data[idx:idx+10])
            idx += 10
            if rtype == 1 and rdlength == 4:
                ips.append(".".join(map(str, data[idx:idx+4])))
            idx += rdlength
    except: pass
    return ips


# ── مرحله ۱: Port 53 Check
def check_port53(ip, timeout=3):
    try:
        query = build_dns_query("example.com")
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.settimeout(timeout)
        t0 = time.perf_counter()
        sock.sendto(query, (ip, 53))
        data, _ = sock.recvfrom(512)
        lat = (time.perf_counter() - t0) * 1000
        sock.close()
        if len(data) >= 12: return True, round(lat, 2)
    except: pass
    finally:
        try: sock.close()
        except: pass
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(timeout)
        t0 = time.perf_counter()
        sock.connect((ip, 53))
        lat = (time.perf_counter() - t0) * 1000
        sock.close()
        return True, round(lat, 2)
    except: return False, 0.0
    finally:
        try: sock.close()
        except: pass


# ── مرحله ۲: E2E Test
def test_e2e(ip, domain, timeout=5):
    r = {"passed": False, "latency_ms": 0.0, "resolved_ips": [], "error": ""}
    try:
        query = build_dns_query(domain)
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.settimeout(timeout)
        t0 = time.perf_counter()
        sock.sendto(query, (ip, 53))
        data, _ = sock.recvfrom(1024)
        lat = (time.perf_counter() - t0) * 1000
        sock.close()
        ips = parse_dns_response(data)
        if ips:
            r.update({"passed": True, "latency_ms": round(lat, 2), "resolved_ips": ips})
        else:
            r["error"] = "No A records"
    except socket.timeout: r["error"] = "Timeout"
    except Exception as e: r["error"] = str(e)
    finally:
        try: sock.close()
        except: pass
    return r


# ── مرحله ۳: HTTP Test
def test_http(ip, url, timeout=5):
    import urllib.request, urllib.error
    r = {"passed": False, "latency_ms": 0.0, "status_code": 0, "error": ""}
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "DNSScannerPro/2.0"})
        t0 = time.perf_counter()
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            lat = (time.perf_counter() - t0) * 1000
            r.update({"passed": resp.status < 400, "latency_ms": round(lat, 2), "status_code": resp.status})
    except urllib.error.HTTPError as e:
        r.update({"status_code": e.code, "error": f"HTTP {e.code}", "passed": e.code < 400})
    except Exception as e: r["error"] = str(e)
    return r


# ── مرحله ۴: Download Test
def test_download(url, timeout=15):
    import urllib.request
    r = {"speed_mbps": 0.0, "bytes_downloaded": 0, "duration_s": 0.0, "error": ""}
    try:
        sep = "&" if "?" in url else "?"
        req = urllib.request.Request(f"{url}{sep}cb={random.randint(100000,999999)}",
              headers={"User-Agent": "DNSScannerPro/2.0", "Cache-Control": "no-cache"})
        t0 = time.perf_counter(); total = 0
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            while True:
                chunk = resp.read(8192)
                if not chunk: break
                total += len(chunk)
                if total >= 5 * 1024 * 1024: break
        dur = time.perf_counter() - t0
        if dur > 0 and total > 0:
            r.update({"speed_mbps": round((total/dur*8)/(1024*1024), 3),
                      "bytes_downloaded": total, "duration_s": round(dur, 3)})
        else: r["error"] = "No data"
    except Exception as e: r["error"] = str(e)
    return r


# ── مرحله ۵: Upload Test
def test_upload(url, size_kb=512, timeout=15):
    import urllib.request
    r = {"speed_mbps": 0.0, "bytes_uploaded": 0, "duration_s": 0.0, "error": ""}
    try:
        data = os.urandom(size_kb * 1024)
        req = urllib.request.Request(url, data=data, method="POST",
              headers={"User-Agent":"DNSScannerPro/2.0","Content-Type":"application/octet-stream"})
        t0 = time.perf_counter()
        with urllib.request.urlopen(req, timeout=timeout) as resp: resp.read()
        dur = time.perf_counter() - t0
        if dur > 0:
            r.update({"speed_mbps": round((len(data)/dur*8)/(1024*1024), 3),
                      "bytes_uploaded": len(data), "duration_s": round(dur, 3)})
    except Exception as e: r["error"] = str(e)
    return r


# ── مرحله ۶: SSH Test (اختیاری)
def test_ssh(host, key, user="root", timeout=10):
    r = {"passed": False, "latency_ms": 0.0, "error": ""}
    try:
        t0 = time.perf_counter()
        proc = subprocess.run(
            ["ssh","-i",key,"-o","StrictHostKeyChecking=no",
             "-o",f"ConnectTimeout={timeout}","-o","BatchMode=yes",
             "-o","PasswordAuthentication=no",f"{user}@{host}","echo OK"],
            capture_output=True, text=True, timeout=timeout+2)
        lat = (time.perf_counter() - t0) * 1000
        if proc.returncode == 0 and "OK" in proc.stdout:
            r.update({"passed": True, "latency_ms": round(lat, 2)})
        else: r["error"] = proc.stderr.strip()[:100]
    except subprocess.TimeoutExpired: r["error"] = "SSH Timeout"
    except FileNotFoundError: r["error"] = "ssh not found"
    except Exception as e: r["error"] = str(e)
    return r


# ── پردازش کامل یک IP
def process_ip(ip, cfg, verbose=False):
    res = {
        "ip": ip, "alive": False, "port53_latency_ms": 0.0,
        "e2e":      {"passed":False,"latency_ms":0.0,"resolved_ips":[],"error":""},
        "http":     {"passed":False,"latency_ms":0.0,"status_code":0,"error":""},
        "download": {"speed_mbps":0.0,"bytes_downloaded":0,"duration_s":0.0,"error":""},
        "upload":   {"speed_mbps":0.0,"bytes_uploaded":0,"duration_s":0.0,"error":""},
        "ssh":      {"passed":False,"latency_ms":0.0,"error":"skipped"},
        "score": 0.0, "rank": 0
    }

    # Step 1: Port 53
    alive, lat = check_port53(ip, cfg["timeout"])
    res["alive"] = alive; res["port53_latency_ms"] = lat
    if not alive:
        if verbose: cprint(f"  [✗] {ip} DEAD", C.RED)
        return res

    # Step 2: E2E
    e2e = test_e2e(ip, cfg["domain"], cfg["timeout"])
    res["e2e"] = e2e
    if not e2e["passed"]:
        if verbose: cprint(f"  [✗] {ip} E2E FAIL ({e2e['error']})", C.YELLOW)
        return res

    # Step 3: HTTP
    res["http"] = test_http(ip, cfg["http_url"], cfg["timeout"])

    # Step 4: Download
    res["download"] = test_download(cfg["download_url"], cfg["timeout"]*3)

    # Step 5: Upload
    if not cfg.get("no_upload"):
        res["upload"] = test_upload(cfg["upload_url"], cfg.get("upload_size_kb",512), cfg["timeout"]*3)

    # Step 6: SSH
    if cfg.get("ssh_host") and cfg.get("ssh_key") and not cfg.get("no_ssh"):
        res["ssh"] = test_ssh(cfg["ssh_host"],cfg["ssh_key"],cfg.get("ssh_user","root"),cfg["timeout"]*2)

    # Score: E2E(30%) + Download(50%) + Upload(20%)
    e2e_s = max(0, 1000 - e2e["latency_ms"]) / 1000 * 30
    dl_s  = min(res["download"]["speed_mbps"], 100) / 100 * 50
    ul_s  = (min(res["upload"]["speed_mbps"],50)/50*20) if not cfg.get("no_upload") else 0
    res["score"] = round(e2e_s + dl_s + ul_s, 4)
    return res


# ── Progress Bar
_lock = threading.Lock()
_ctr  = {"done":0,"total":0,"alive":0,"passed":0}

def update_progress(r):
    with _lock:
        _ctr["done"] += 1
        if r["alive"]: _ctr["alive"] += 1
        if r["e2e"]["passed"]: _ctr["passed"] += 1
        d,t = _ctr["done"], _ctr["total"]
        bar = "█"*int(30*d/t) + "░"*(30-int(30*d/t))
        print(f"\\r{C.CYAN}[{bar}]{C.RESET} {d/t*100:.1f}% "
              f"| Done:{d}/{t} | Alive:{C.GREEN}{_ctr['alive']}{C.RESET} "
              f"| Passed:{C.YELLOW}{_ctr['passed']}{C.RESET}   ",end="",flush=True)


# ── جدول نتایج
def print_table(ranked):
    cprint("\\n\\n" + "═"*100, C.CYAN)
    cprint(f"{'#':<4}{'IP':<18}{'P53(ms)':<10}{'E2E(ms)':<10}{'HTTP':<8}{'DL Mbps':<12}{'UL Mbps':<12}{'SSH':<8}{'Score':<8}", C.BOLD+C.WHITE)
    cprint("═"*100, C.CYAN)
    for i,r in enumerate(ranked,1):
        e  = f"{r['e2e']['latency_ms']:.1f}" if r['e2e']['passed'] else "FAIL"
        h  = "✓" if r['http']['passed'] else "✗"
        dl = f"{r['download']['speed_mbps']:.2f}" if not r['download']['error'] else "ERR"
        ul = f"{r['upload']['speed_mbps']:.2f}"   if not r['upload']['error']   else "ERR"
        sh = "✓" if r['ssh']['passed'] else ("skip" if r['ssh']['error']=="skipped" else "✗")
        clr = C.GREEN if i<=3 else (C.YELLOW if i<=10 else C.WHITE)
        cprint(f"{i:<4}{r['ip']:<18}{r['port53_latency_ms']:<10.1f}{e:<10}{h:<8}{dl:<12}{ul:<12}{sh:<8}{r['score']:.3f}", clr)
    cprint("═"*100, C.CYAN)


# ── ذخیره نتایج
def save_results(ranked, outfile, cfg):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    # فایل IP خالص
    with open(outfile.replace(".txt","_ips.txt"),"w") as f:
        f.write(f"# DNS Scanner Pro | {ts}\\n# Total: {len(ranked)}\\n\\n")
        for r in ranked: f.write(f"{r['ip']}\\n")
    # فایل جزئیات
    with open(outfile,"w",encoding="utf-8") as f:
        f.write("="*80+"\\n DNS Scanner Pro — Detailed Results\\n")
        f.write(f" Generated : {ts}\\n Domain : {cfg['domain']}\\n")
        f.write("="*80+"\\n\\n")
        f.write(f"{'RANK':<5}{'IP':<18}{'P53ms':<8}{'E2Ems':<8}{'HTTP':<6}{'DL_Mbps':<10}{'UL_Mbps':<10}{'SSH':<6}{'SCORE':<8}\\n")
        f.write("-"*80+"\\n")
        for i,r in enumerate(ranked,1):
            e  = f"{r['e2e']['latency_ms']:.1f}" if r['e2e']['passed'] else "FAIL"
            h  = "OK" if r['http']['passed'] else "NO"
            dl = f"{r['download']['speed_mbps']:.3f}" if not r['download']['error'] else "ERR"
            ul = f"{r['upload']['speed_mbps']:.3f}" if not r['upload']['error'] else "ERR"
            sh = "OK" if r['ssh']['passed'] else ("skip" if r['ssh']['error']=="skipped" else "NO")
            f.write(f"{i:<5}{r['ip']:<18}{r['port53_latency_ms']:<8.1f}{e:<8}{h:<6}{dl:<10}{ul:<10}{sh:<6}{r['score']:.4f}\\n")
        f.write("\\n"+"="*80+"\\n DETAILED JSON\\n"+"="*80+"\\n\\n")
        for r in ranked: f.write(json.dumps(r,ensure_ascii=False,indent=2)+"\\n\\n")
    # JSON
    with open(outfile.replace(".txt",".json"),"w",encoding="utf-8") as f:
        json.dump({"meta":{"generated":ts,"domain":cfg["domain"],"total":len(ranked)},"results":ranked},f,ensure_ascii=False,indent=2)
    cprint(f"  [✓] Saved: {outfile} | {outfile.replace('.txt','_ips.txt')} | {outfile.replace('.txt','.json')}", C.GREEN)


def main():
    print(BANNER)
    p = argparse.ArgumentParser(description="DNS Scanner Pro - Termux Edition")
    p.add_argument("-i","--input",    default="resolvers.txt")
    p.add_argument("-o","--output",   default="results.txt")
    p.add_argument("-t","--threads",  type=int,   default=10)
    p.add_argument("-T","--timeout",  type=float, default=5)
    p.add_argument("-d","--domain",   default="google.com")
    p.add_argument("-u","--url",      default="http://www.gstatic.com/generate_204")
    p.add_argument("--upload-url",    default="https://httpbin.org/post")
    p.add_argument("--http-url",      default="http://www.gstatic.com/generate_204")
    p.add_argument("--upload-size",   type=int,   default=512)
    p.add_argument("--ssh-host",      default="")
    p.add_argument("--ssh-key",       default="")
    p.add_argument("--ssh-user",      default="root")
    p.add_argument("--no-upload",     action="store_true")
    p.add_argument("--no-ssh",        action="store_true")
    p.add_argument("--top",           type=int,   default=0)
    p.add_argument("--min-download",  type=float, default=0)
    p.add_argument("--min-upload",    type=float, default=0)
    p.add_argument("-v","--verbose",  action="store_true")
    args = p.parse_args()

    cfg = {k:v for k,v in vars(args).items()}
    cfg["download_url"] = args.url
    cfg["http_url"]     = args.http_url
    cfg["upload_url"]   = args.upload_url
    cfg["ssh_host"]     = args.ssh_host
    cfg["ssh_key"]      = args.ssh_key
    cfg["ssh_user"]     = args.ssh_user
    cfg["upload_size_kb"] = args.upload_size

    targets = load_targets(args.input)
    total   = len(targets)
    cprint(f"  [i] {total} targets | Threads:{args.threads} | Timeout:{args.timeout}s | Domain:{args.domain}", C.CYAN, bold=True)
    cprint(f"  [i] DL:{cfg['download_url']}", C.CYAN)
    if not args.no_upload: cprint(f"  [i] UL:{cfg['upload_url']}", C.CYAN)
    if cfg["ssh_host"]:    cprint(f"  [i] SSH:{cfg['ssh_user']}@{cfg['ssh_host']}", C.CYAN)
    cprint(f"\\n  Scan started at {datetime.now().strftime('%H:%M:%S')}\\n", C.WHITE)

    _ctr["total"] = total
    all_results = []

    with ThreadPoolExecutor(max_workers=args.threads) as ex:
        futures = {ex.submit(process_ip, ip, cfg, args.verbose): ip for ip in targets}
        for future in as_completed(futures):
            try:    res = future.result()
            except: res = {"ip": futures[future], "alive":False, "e2e":{"passed":False}, "score":0.0}
            all_results.append(res)
            if not args.verbose: update_progress(res)

    print()
    passed = [r for r in all_results if r["e2e"]["passed"]]
    if args.min_download > 0: passed = [r for r in passed if r["download"]["speed_mbps"] >= args.min_download]
    if args.min_upload > 0 and not args.no_upload: passed = [r for r in passed if r["upload"]["speed_mbps"] >= args.min_upload]

    ranked = sorted(passed, key=lambda x: x["score"], reverse=True)
    for i,r in enumerate(ranked,1): r["rank"] = i
    if args.top > 0: ranked = ranked[:args.top]

    alive_n  = sum(1 for r in all_results if r["alive"])
    passed_n = sum(1 for r in all_results if r["e2e"]["passed"])

    cprint("\\n\\n" + "─"*50, C.CYAN)
    cprint(f"  Total:{total} | Alive:{alive_n} | E2E Passed:{passed_n} | Ranked:{len(ranked)}", C.WHITE, bold=True)
    cprint("─"*50, C.CYAN)

    if not ranked:
        cprint("  [!] No resolvers passed all tests.", C.RED, bold=True)
        sys.exit(0)

    print_table(ranked)
    cprint("\\n  Saving results...", C.CYAN, bold=True)
    save_results(ranked, args.output, cfg)
    cprint(f"\\n  ✅ Top resolver: {C.GREEN}{ranked[0]['ip']}{C.RESET} | Score:{ranked[0]['score']:.3f}\\n", C.WHITE, bold=True)

if __name__ == "__main__":
    main()`;

export const RESOLVERS_FILE = `# ============================================================
#  resolvers.txt — لیست DNS Resolverهای هدف
#  ویرایش با: nano resolvers.txt
#  فرمت: هر خط یک IP یا رنج CIDR
#  خطوط شروع‌شده با # نادیده گرفته میشن
# ============================================================

# ── DNS های معروف عمومی
8.8.8.8
8.8.4.4
1.1.1.1
1.0.0.1
9.9.9.9
149.112.112.112
208.67.222.222
208.67.220.220
64.6.64.6
64.6.65.6

# ── Cloudflare
1.1.1.2
1.0.0.2

# ── Quad9
9.9.9.10
149.112.112.10

# ── AdGuard DNS
94.140.14.14
94.140.15.15

# ── رنج CIDR (مثال - رنج خودتون رو اضافه کنید)
# 192.168.1.0/24
# 10.0.0.0/28
# 203.0.113.0/29`;

export const INSTALL_COMMANDS = `# ── نصب پیش‌نیازها در ترموکس
pkg update && pkg upgrade -y
pkg install python openssh curl -y

# ── دانلود اسکریپت
curl -O https://raw.githubusercontent.com/yourusername/dns-scanner-pro/main/dns_scanner.py
curl -O https://raw.githubusercontent.com/yourusername/dns-scanner-pro/main/resolvers.txt

# ── دادن دسترسی اجرا
chmod +x dns_scanner.py`;

export const USAGE_EXAMPLES = `# ── اجرای پیش‌فرض
python dns_scanner.py

# ── با فایل ورودی سفارشی و ۱۵ thread
python dns_scanner.py -i my_ips.txt -t 15

# ── با دامنه و URL سفارشی
python dns_scanner.py -d example.com -u https://speed.cloudflare.com/__down?bytes=1000000

# ── با تست SSH
python dns_scanner.py --ssh-host myserver.com --ssh-key ~/.ssh/id_rsa --ssh-user ubuntu

# ── فقط ۱۰ تا برتر + حداقل سرعت ۵ مگابیت
python dns_scanner.py --top 10 --min-download 5

# ── بدون تست آپلود، verbose
python dns_scanner.py --no-upload -v

# ── ویرایش لیست DNS ها
nano resolvers.txt`;

export const OUTPUT_EXAMPLE = `╔══════════════════════════════════════════════════════════╗
║           DNS Scanner Pro  ·  Termux Edition  v2.0       ║
║        Port 53 → E2E → HTTP → Download → Upload → Rank   ║
╚══════════════════════════════════════════════════════════╝

  [i] 20 targets | Threads:10 | Timeout:5s | Domain:google.com
  [i] DL: http://www.gstatic.com/generate_204
  [i] UL: https://httpbin.org/post

  Scan started at 14:32:01

[██████████████████████████████] 100.0% | Done:20/20 | Alive:17 | Passed:15

════════════════════════════════════════════════════════════════════════════════
#    IP                P53(ms)   E2E(ms)   HTTP    DL Mbps     UL Mbps     SSH    Score
════════════════════════════════════════════════════════════════════════════════════════
1    8.8.8.8           12.3      18.4      ✓       45.230       8.120      skip   62.471
2    1.1.1.1           8.7       11.2      ✓       42.810       7.890      skip   60.394
3    9.9.9.9           21.4      25.6      ✓       38.420       6.340      skip   56.218
4    8.8.4.4           15.2      19.8      ✓       35.110       5.920      skip   52.086
5    1.0.0.1           9.1       13.3      ✓       33.670       5.110      skip   50.017
...

  Total:20 | Alive:17 | E2E Passed:15 | Ranked:15

  Saving results...
  [✓] Saved: results.txt | results_ips.txt | results.json

  ✅ Top resolver: 8.8.8.8 | Score: 62.471`;
