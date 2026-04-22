import { useState } from "react";
import CodeBlock from "./components/CodeBlock";
import StepCard from "./components/StepCard";
import {
  DNS_SCANNER_SCRIPT,
  RESOLVERS_FILE,
  INSTALL_COMMANDS,
  USAGE_EXAMPLES,
  OUTPUT_EXAMPLE,
} from "./data/scriptContent";



type TabId = "overview" | "install" | "script" | "resolvers" | "usage" | "output";

const tabs: { id: TabId; label: string; icon: string }[] = [
  { id: "overview",  label: "نمای کلی",    icon: "🗺️" },
  { id: "install",   label: "نصب",          icon: "📦" },
  { id: "script",    label: "اسکریپت",      icon: "🐍" },
  { id: "resolvers", label: "فایل DNS",     icon: "📝" },
  { id: "usage",     label: "نحوه استفاده", icon: "⚡" },
  { id: "output",    label: "خروجی نمونه",  icon: "📊" },
];

const steps = [
  {
    number: 1,
    icon: "🔌",
    title: "Port 53 Check (Alive)",
    description: "ارسال DNS Query UDP/TCP به پورت ۵۳ — سریع‌ترین فیلتر برای حذف مرده‌ها",
    color: "border-blue-500/30",
    details: [
      "UDP Query اول — TCP fallback",
      "Timeout قابل تنظیم",
      "اندازه‌گیری latency اولیه",
      "حذف IPهای مرده قبل از تست‌های سنگین",
    ],
  },
  {
    number: 2,
    icon: "🌐",
    title: "E2E Test (DNS Resolution)",
    description: "Resolve واقعی دامنه با DNS مورد نظر — تضمین عملکرد واقعی",
    color: "border-purple-500/30",
    details: [
      "ساخت دستی DNS query (بدون نیاز به کتابخانه)",
      "Parse پاسخ و استخراج A records",
      "اندازه‌گیری latency دقیق E2E",
      "تأیید صحت پاسخ DNS",
    ],
  },
  {
    number: 3,
    icon: "🔗",
    title: "HTTP Test",
    description: "بررسی دسترسی HTTP — تست لایه‌ی بالاتر از DNS",
    color: "border-yellow-500/30",
    details: [
      "Request به URL تعریف‌شده",
      "بررسی status code < 400",
      "اندازه‌گیری HTTP latency",
      "پشتیبانی از URL سفارشی",
    ],
  },
  {
    number: 4,
    icon: "⬇️",
    title: "Download Speed Test",
    description: "تست سرعت دانلود از URL مشخص — تا ۵ مگابایت",
    color: "border-green-500/30",
    details: [
      "دانلود chunk به chunk",
      "Cache-buster خودکار",
      "محاسبه Mbps دقیق",
      "URL سفارشی + default gstatic",
    ],
  },
  {
    number: 5,
    icon: "⬆️",
    title: "Upload Speed Test",
    description: "تست سرعت آپلود با داده‌ی تصادفی — اختیاری",
    color: "border-orange-500/30",
    details: [
      "ارسال داده‌ی random به endpoint",
      "محاسبه دقیق MB/s",
      "قابل غیرفعال با --no-upload",
      "حجم قابل تنظیم",
    ],
  },
  {
    number: 6,
    icon: "🔐",
    title: "SSH Test (اختیاری)",
    description: "تست اتصال SSH با کلید خصوصی — برای زیرساخت خودتون",
    color: "border-red-500/30",
    details: [
      "نیاز به domain + public key",
      "StrictHostKeyChecking=no",
      "قابل فعال با --ssh-host و --ssh-key",
      "BatchMode برای اتوماسیون",
    ],
  },
  {
    number: 7,
    icon: "🏆",
    title: "Ranking & Output",
    description: "رده‌بندی بر اساس Score ترکیبی + خروجی ۳ فرمته",
    color: "border-cyan-500/30",
    details: [
      "Score = E2E(30%) + Download(50%) + Upload(20%)",
      "results.txt — جزئیات کامل",
      "results_ips.txt — فقط IP‌ها عمودی",
      "results.json — داده‌ی ساختاریافته",
    ],
  },
];

const features = [
  { icon: "🧵", title: "Multi-thread", desc: "تا ۵۰ thread موازی" },
  { icon: "📡", title: "UDP + TCP", desc: "Fallback خودکار" },
  { icon: "🎯", title: "CIDR Support", desc: "رنج IP قابل تعریف" },
  { icon: "⚙️", title: "کاملاً قابل تنظیم", desc: "همه چیز via CLI" },
  { icon: "📦", title: "Zero Dependency", desc: "فقط Python stdlib" },
  { icon: "🔋", title: "بهینه موبایل", desc: "کم‌مصرف، سریع" },
  { icon: "📊", title: "سه فرمت خروجی", desc: "TXT / JSON / IP List" },
  { icon: "🌈", title: "UI رنگی", desc: "پیشرفت real-time" },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>("overview");


  return (
    <div className="min-h-screen bg-gray-950 text-gray-100" dir="rtl">
      {/* ── Hero Header ── */}
      <header className="relative overflow-hidden border-b border-gray-800">
        {/* background glow */}
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-950/40 via-gray-950 to-purple-950/30 pointer-events-none" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-40 bg-cyan-500/10 blur-3xl rounded-full pointer-events-none" />

        <div className="relative max-w-6xl mx-auto px-4 py-10">
          <div className="flex flex-col items-center text-center gap-4">
            {/* badge */}
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
              Termux Edition · v2.0.0 · Python 3 · Zero Dependencies
            </div>

            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
              <span className="text-white">DNS</span>
              <span className="text-cyan-400"> Scanner</span>
              <span className="text-white"> Pro</span>
            </h1>

            <p className="text-gray-400 max-w-2xl text-base leading-relaxed">
              اسکنر حرفه‌ای DNS برای ترموکس — تست پورت ۵۳، E2E، HTTP، دانلود، آپلود و SSH
              <br />
              رده‌بندی هوشمند بر اساس سرعت و تأخیر با خروجی کامل
            </p>

            {/* stats */}
            <div className="flex flex-wrap justify-center gap-6 mt-2">
              {[
                { label: "مراحل تست", value: "7" },
                { label: "Thread همزمان", value: "10+" },
                { label: "فرمت خروجی", value: "3" },
                { label: "وابستگی خارجی", value: "۰" },
              ].map((s) => (
                <div key={s.label} className="text-center">
                  <div className="text-2xl font-bold text-cyan-400">{s.value}</div>
                  <div className="text-gray-500 text-xs">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* ── Tabs Navigation ── */}
      <nav className="sticky top-0 z-40 bg-gray-950/95 backdrop-blur border-b border-gray-800">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex overflow-x-auto gap-1 py-2 scrollbar-hide">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  activeTab === tab.id
                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                    : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* ── Main Content ── */}
      <main className="max-w-6xl mx-auto px-4 py-8">

        {/* ══ Tab: Overview ══ */}
        {activeTab === "overview" && (
          <div className="space-y-8">
            {/* flow diagram */}
            <section>
              <h2 className="text-xl font-bold text-white mb-4">🗺️ جریان کامل اسکن</h2>
              <div className="flex flex-wrap items-center gap-2 p-4 bg-gray-900 rounded-xl border border-gray-800 font-mono text-sm">
                {[
                  { label: "resolvers.txt", color: "text-gray-400 bg-gray-800" },
                  { label: "→", color: "text-gray-600" },
                  { label: "Port 53 Check", color: "text-blue-300 bg-blue-900/30 border border-blue-500/30" },
                  { label: "→", color: "text-gray-600" },
                  { label: "E2E DNS Test", color: "text-purple-300 bg-purple-900/30 border border-purple-500/30" },
                  { label: "→", color: "text-gray-600" },
                  { label: "HTTP Test", color: "text-yellow-300 bg-yellow-900/30 border border-yellow-500/30" },
                  { label: "→", color: "text-gray-600" },
                  { label: "Download", color: "text-green-300 bg-green-900/30 border border-green-500/30" },
                  { label: "→", color: "text-gray-600" },
                  { label: "Upload", color: "text-orange-300 bg-orange-900/30 border border-orange-500/30" },
                  { label: "→", color: "text-gray-600" },
                  { label: "SSH (opt)", color: "text-red-300 bg-red-900/30 border border-red-500/30" },
                  { label: "→", color: "text-gray-600" },
                  { label: "🏆 Ranking", color: "text-cyan-300 bg-cyan-900/30 border border-cyan-500/30" },
                ].map((item, i) =>
                  item.label === "→" ? (
                    <span key={i} className={`text-lg font-bold ${item.color}`}>{item.label}</span>
                  ) : (
                    <span key={i} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${item.color}`}>{item.label}</span>
                  )
                )}
              </div>
            </section>

            {/* steps */}
            <section>
              <h2 className="text-xl font-bold text-white mb-4">📋 مراحل تست</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {steps.map((s) => (
                  <StepCard key={s.number} {...s} />
                ))}
              </div>
            </section>

            {/* features */}
            <section>
              <h2 className="text-xl font-bold text-white mb-4">✨ ویژگی‌ها</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {features.map((f) => (
                  <div key={f.title} className="p-4 rounded-xl bg-gray-900 border border-gray-800 hover:border-gray-700 transition-colors text-center">
                    <div className="text-2xl mb-2">{f.icon}</div>
                    <div className="text-white font-semibold text-sm">{f.title}</div>
                    <div className="text-gray-500 text-xs mt-1">{f.desc}</div>
                  </div>
                ))}
              </div>
            </section>

            {/* score formula */}
            <section>
              <h2 className="text-xl font-bold text-white mb-4">🧮 فرمول امتیازدهی</h2>
              <div className="p-5 bg-gray-900 rounded-xl border border-gray-800">
                <div className="font-mono text-center text-lg mb-4 text-cyan-300">
                  Score = E2E_Score(30%) + Download_Score(50%) + Upload_Score(20%)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                  <div className="p-3 bg-purple-900/20 rounded-lg border border-purple-500/20">
                    <div className="text-purple-300 font-bold mb-1">🌐 E2E Score (30%)</div>
                    <code className="text-gray-400 text-xs">max(0, 1000 - latency_ms) / 1000 × 30</code>
                    <p className="text-gray-500 text-xs mt-1">تأخیر کمتر = امتیاز بالاتر</p>
                  </div>
                  <div className="p-3 bg-green-900/20 rounded-lg border border-green-500/20">
                    <div className="text-green-300 font-bold mb-1">⬇️ Download Score (50%)</div>
                    <code className="text-gray-400 text-xs">min(speed, 100) / 100 × 50</code>
                    <p className="text-gray-500 text-xs mt-1">حداکثر ۱۰۰ Mbps محاسبه می‌شه</p>
                  </div>
                  <div className="p-3 bg-orange-900/20 rounded-lg border border-orange-500/20">
                    <div className="text-orange-300 font-bold mb-1">⬆️ Upload Score (20%)</div>
                    <code className="text-gray-400 text-xs">min(speed, 50) / 50 × 20</code>
                    <p className="text-gray-500 text-xs mt-1">حداکثر ۵۰ Mbps محاسبه می‌شه</p>
                  </div>
                </div>
              </div>
            </section>

            {/* quick start CTA */}
            <section className="p-5 bg-gradient-to-r from-cyan-900/20 to-purple-900/20 rounded-xl border border-cyan-500/20">
              <h3 className="text-white font-bold mb-2">🚀 شروع سریع</h3>
              <div className="bg-gray-950 rounded-lg p-3 font-mono text-sm text-green-400 border border-gray-800 mb-3">
                <div className="text-gray-500 text-xs mb-1"># ترموکس رو باز کن و این رو بزن:</div>
                <div>pkg install python -y && python dns_scanner.py -i resolvers.txt -t 10</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setActiveTab("install")}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  📦 راهنمای نصب ←
                </button>
                <button
                  onClick={() => setActiveTab("script")}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  🐍 دریافت اسکریپت ←
                </button>
              </div>
            </section>
          </div>
        )}

        {/* ══ Tab: Install ══ */}
        {activeTab === "install" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white mb-1">📦 نصب در ترموکس</h2>
              <p className="text-gray-400 text-sm">فقط Python نیاز داری — هیچ کتابخانه‌ی خارجی لازم نیست</p>
            </div>

            <CodeBlock
              code={INSTALL_COMMANDS}
              language="bash"
              title="termux-install.sh"
              maxHeight="300px"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 bg-gray-900 rounded-xl border border-gray-800">
                <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                  <span>✅</span> پیش‌نیازها
                </h3>
                <ul className="space-y-2 text-sm">
                  {[
                    { pkg: "python", desc: "Python 3.8+", required: true },
                    { pkg: "openssh", desc: "برای تست SSH", required: false },
                    { pkg: "curl", desc: "برای دانلود اسکریپت", required: false },
                  ].map((p) => (
                    <li key={p.pkg} className="flex items-center gap-2">
                      <span className={p.required ? "text-green-400" : "text-yellow-400"}>
                        {p.required ? "●" : "○"}
                      </span>
                      <code className="text-cyan-400 font-mono text-xs bg-gray-800 px-1.5 py-0.5 rounded">{p.pkg}</code>
                      <span className="text-gray-400">{p.desc}</span>
                      {!p.required && <span className="text-gray-600 text-xs">(اختیاری)</span>}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-4 bg-gray-900 rounded-xl border border-gray-800">
                <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                  <span>📁</span> ساختار فایل‌ها
                </h3>
                <pre className="text-xs font-mono text-gray-400 leading-6">{`dns-scanner-pro/
├── 📄 dns_scanner.py    ← اسکریپت اصلی
├── 📝 resolvers.txt     ← لیست DNS ها
├── 📊 results.txt       ← خروجی جزئیات
├── 📋 results_ips.txt   ← فقط IP ها
└── 🔢 results.json      ← داده JSON`}</pre>
              </div>
            </div>

            <div className="p-4 bg-yellow-900/20 border border-yellow-500/30 rounded-xl">
              <h3 className="text-yellow-300 font-semibold mb-2 flex items-center gap-2">
                <span>⚠️</span> نکته مهم — تست SSH
              </h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                برای استفاده از تست SSH، نیاز به <strong className="text-white">یک سرور شخصی</strong> دارید که SSH فعال داشته باشه.
                کلید خصوصی رو باید توی ترموکس داشته باشید (<code className="text-cyan-400 text-xs bg-gray-900 px-1 rounded">~/.ssh/id_rsa</code>).
                اگه سرور SSH ندارید، از <code className="text-cyan-400 text-xs bg-gray-900 px-1 rounded">--no-ssh</code> استفاده کنید.
              </p>
            </div>
          </div>
        )}

        {/* ══ Tab: Script ══ */}
        {activeTab === "script" && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-white mb-1">🐍 اسکریپت Python</h2>
              <p className="text-gray-400 text-sm">کپی کن، توی ترموکس با nano ذخیره کن</p>
            </div>

            <div className="p-3 bg-gray-900 rounded-lg border border-gray-800 text-sm font-mono">
              <span className="text-gray-500"># ذخیره توی ترموکس:</span>
              <br />
              <span className="text-green-400">nano dns_scanner.py</span>
              <span className="text-gray-400">  # paste کن، Ctrl+X → Y → Enter</span>
            </div>

            <CodeBlock
              code={DNS_SCANNER_SCRIPT}
              language="python"
              title="dns_scanner.py"
              maxHeight="70vh"
            />

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-xs">
              {[
                { label: "خطوط کد", value: "~350" },
                { label: "وابستگی", value: "0" },
                { label: "مراحل تست", value: "7" },
                { label: "فرمت خروجی", value: "3" },
              ].map((s) => (
                <div key={s.label} className="p-3 bg-gray-900 rounded-lg border border-gray-800">
                  <div className="text-xl font-bold text-cyan-400">{s.value}</div>
                  <div className="text-gray-500 mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══ Tab: Resolvers ══ */}
        {activeTab === "resolvers" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white mb-1">📝 فایل resolvers.txt</h2>
              <p className="text-gray-400 text-sm">لیست DNS هدف — هر خط یه IP یا رنج CIDR</p>
            </div>

            <div className="p-4 bg-gray-900 rounded-xl border border-gray-800">
              <h3 className="text-white font-semibold mb-3">✏️ نحوه ویرایش</h3>
              <div className="bg-gray-950 rounded-lg p-3 font-mono text-sm text-green-400 border border-gray-800 space-y-1">
                <div><span className="text-gray-500"># باز کن با nano</span></div>
                <div>nano resolvers.txt</div>
                <div className="mt-2"><span className="text-gray-500"># یا با یه دستور اضافه کن</span></div>
                <div>echo "1.2.3.4" &gt;&gt; resolvers.txt</div>
                <div className="mt-2"><span className="text-gray-500"># رنج CIDR اضافه کن</span></div>
                <div>echo "192.168.1.0/28" &gt;&gt; resolvers.txt</div>
              </div>
            </div>

            <CodeBlock
              code={RESOLVERS_FILE}
              language="text"
              title="resolvers.txt"
              maxHeight="400px"
            />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 bg-gray-900 rounded-xl border border-gray-800">
                <div className="text-blue-400 font-bold mb-2 text-sm">📌 IP تکی</div>
                <code className="text-gray-300 text-xs font-mono">8.8.8.8</code>
              </div>
              <div className="p-4 bg-gray-900 rounded-xl border border-gray-800">
                <div className="text-purple-400 font-bold mb-2 text-sm">🔢 رنج CIDR</div>
                <code className="text-gray-300 text-xs font-mono">192.168.1.0/24</code>
              </div>
              <div className="p-4 bg-gray-900 rounded-xl border border-gray-800">
                <div className="text-gray-400 font-bold mb-2 text-sm">💬 کامنت</div>
                <code className="text-gray-300 text-xs font-mono"># این خط نادیده گرفته می‌شه</code>
              </div>
            </div>
          </div>
        )}

        {/* ══ Tab: Usage ══ */}
        {activeTab === "usage" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white mb-1">⚡ نحوه استفاده</h2>
              <p className="text-gray-400 text-sm">مثال‌های کاربردی برای همه سناریوها</p>
            </div>

            <CodeBlock
              code={USAGE_EXAMPLES}
              language="bash"
              title="usage-examples.sh"
              maxHeight="500px"
            />

            {/* CLI Reference Table */}
            <div>
              <h3 className="text-white font-bold mb-3">📖 جدول پارامترها</h3>
              <div className="overflow-x-auto rounded-xl border border-gray-800">
                <table className="w-full text-sm font-mono">
                  <thead>
                    <tr className="bg-gray-800 text-gray-300">
                      <th className="text-right px-4 py-3 font-semibold">پارامتر</th>
                      <th className="text-right px-4 py-3 font-semibold">پیش‌فرض</th>
                      <th className="text-right px-4 py-3 font-semibold">توضیح</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { param: "-i / --input",      def: "resolvers.txt",                        desc: "فایل ورودی IP/CIDR" },
                      { param: "-o / --output",     def: "results.txt",                          desc: "فایل خروجی" },
                      { param: "-t / --threads",    def: "10",                                   desc: "تعداد thread موازی" },
                      { param: "-T / --timeout",    def: "5",                                    desc: "timeout به ثانیه" },
                      { param: "-d / --domain",     def: "google.com",                           desc: "دامنه برای E2E" },
                      { param: "-u / --url",        def: "gstatic.com/generate_204",             desc: "URL دانلود" },
                      { param: "--upload-url",       def: "httpbin.org/post",                     desc: "URL آپلود" },
                      { param: "--http-url",         def: "gstatic.com/generate_204",             desc: "URL تست HTTP" },
                      { param: "--upload-size",      def: "512 (KB)",                             desc: "حجم داده آپلود" },
                      { param: "--ssh-host",         def: "—",                                   desc: "هاست SSH" },
                      { param: "--ssh-key",          def: "—",                                   desc: "فایل کلید خصوصی SSH" },
                      { param: "--ssh-user",         def: "root",                                 desc: "یوزر SSH" },
                      { param: "--no-upload",        def: "—",                                   desc: "غیرفعال کردن آپلود" },
                      { param: "--no-ssh",           def: "—",                                   desc: "غیرفعال کردن SSH" },
                      { param: "--top N",            def: "0 (همه)",                             desc: "نمایش N تا برتر" },
                      { param: "--min-download",     def: "0",                                   desc: "حداقل سرعت دانلود (Mbps)" },
                      { param: "--min-upload",       def: "0",                                   desc: "حداقل سرعت آپلود (Mbps)" },
                      { param: "-v / --verbose",     def: "—",                                   desc: "نمایش جزئیات هر IP" },
                    ].map((row, i) => (
                      <tr key={i} className={i % 2 === 0 ? "bg-gray-950" : "bg-gray-900"}>
                        <td className="px-4 py-2.5 text-cyan-400 whitespace-nowrap">{row.param}</td>
                        <td className="px-4 py-2.5 text-yellow-400 whitespace-nowrap text-xs">{row.def}</td>
                        <td className="px-4 py-2.5 text-gray-400 font-sans">{row.desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ══ Tab: Output ══ */}
        {activeTab === "output" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white mb-1">📊 خروجی نمونه</h2>
              <p className="text-gray-400 text-sm">نمونه واقعی از خروجی ترمینال و فایل‌ها</p>
            </div>

            <CodeBlock
              code={OUTPUT_EXAMPLE}
              language="text"
              title="terminal-output-example"
              maxHeight="500px"
            />

            {/* Output Files */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 bg-gray-900 rounded-xl border border-green-500/20">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xl">📋</span>
                  <div>
                    <div className="text-white font-semibold text-sm">results_ips.txt</div>
                    <div className="text-gray-500 text-xs">فقط IP‌ها — عمودی</div>
                  </div>
                </div>
                <pre className="text-xs font-mono text-green-400 bg-gray-950 p-2 rounded">{`8.8.8.8
1.1.1.1
9.9.9.9
8.8.4.4
1.0.0.1
...`}</pre>
                <p className="text-gray-500 text-xs mt-2">قابل کپی مستقیم در کانفیگ‌ها</p>
              </div>

              <div className="p-4 bg-gray-900 rounded-xl border border-blue-500/20">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xl">📄</span>
                  <div>
                    <div className="text-white font-semibold text-sm">results.txt</div>
                    <div className="text-gray-500 text-xs">جزئیات کامل</div>
                  </div>
                </div>
                <pre className="text-xs font-mono text-blue-400 bg-gray-950 p-2 rounded">{`RANK IP         E2Ems  DL    UL
1    8.8.8.8    18.4  45.2  8.1
2    1.1.1.1    11.2  42.8  7.9
...
[JSON per IP]`}</pre>
                <p className="text-gray-500 text-xs mt-2">گزارش کامل با تمام متریک‌ها</p>
              </div>

              <div className="p-4 bg-gray-900 rounded-xl border border-purple-500/20">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xl">🔢</span>
                  <div>
                    <div className="text-white font-semibold text-sm">results.json</div>
                    <div className="text-gray-500 text-xs">داده ساختاریافته</div>
                  </div>
                </div>
                <pre className="text-xs font-mono text-purple-400 bg-gray-950 p-2 rounded">{`{
 "meta": {...},
 "results": [
  {"ip": "8.8.8.8",
   "score": 62.47,
   ...}
 ]
}`}</pre>
                <p className="text-gray-500 text-xs mt-2">برای پردازش برنامه‌ای</p>
              </div>
            </div>

            {/* Score interpretation */}
            <div className="p-4 bg-gray-900 rounded-xl border border-gray-800">
              <h3 className="text-white font-semibold mb-3">🏆 تفسیر Score</h3>
              <div className="space-y-2">
                {[
                  { range: "80 – 100", label: "عالی", color: "bg-green-500", textColor: "text-green-300", desc: "بهترین DNS — سریع و پایدار" },
                  { range: "60 – 79",  label: "خوب",  color: "bg-blue-500",  textColor: "text-blue-300",  desc: "DNS خوب — قابل استفاده" },
                  { range: "40 – 59",  label: "متوسط",color: "bg-yellow-500",textColor: "text-yellow-300",desc: "قابل قبول — بهتر گزینه‌های دیگه رو چک کن" },
                  { range: "0 – 39",   label: "ضعیف", color: "bg-red-500",   textColor: "text-red-300",   desc: "سرعت پایین — توصیه نمی‌شه" },
                ].map((s) => (
                  <div key={s.range} className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${s.color}`}></div>
                    <span className={`font-mono text-sm ${s.textColor} w-16`}>{s.range}</span>
                    <span className="text-white text-sm font-medium w-12">{s.label}</span>
                    <span className="text-gray-400 text-sm">{s.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-gray-800 mt-12 py-6">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <div className="text-gray-600 text-sm font-mono">
            DNS Scanner Pro · Termux Edition · v2.0.0
            <span className="mx-2">·</span>
            Python 3 · Zero Dependencies · MIT License
          </div>
          <div className="text-gray-700 text-xs mt-1">
            Port 53 → E2E → HTTP → Download → Upload → SSH → Ranking
          </div>
        </div>
      </footer>
    </div>
  );
}
