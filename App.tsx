import React, { useState, useRef, useCallback } from "react";
import ReactDOM from "react-dom/client";

const API = "http://localhost:4000/api";

// ─── Tipler ─────────────────────────────────────────────────────
interface CVAnalysis {
  ad_soyad: string;
  email: string;
  telefon: string;
  ozet: string;
  deneyim_yillari: number;
  beceriler: string[];
  egitim: string;
  diller: string[];
  guclu_yonler: string[];
  gelistirilmesi_gereken: string[];
  sektor_onerileri: string[];
  cv_puani: number;
}

interface JobAnalysis {
  pozisyon_adi: string;
  sirket_adi: string;
  uyum_skoru: number;
  guclu_eslesmeler: string[];
  eksik_beceriler: string[];
  oneriler: string[];
  anahtar_kelimeler: string[];
  maas_tahmini: string;
  basarma_ihtimali: string;
  neden_uygun: string;
  dikkat_edilmesi_gerekenler: string;
}

interface Application {
  id: number;
  company: string;
  position: string;
  matchScore: number;
  status: string;
  notes: string;
  jobUrl: string;
  date: string;
}

// ─── Yardımcı Bileşenler ─────────────────────────────────────────
const ScoreCircle = ({ score, size = "lg" }: { score: number; size?: string }) => {
  const color = score >= 80 ? "#10b981" : score >= 60 ? "#f59e0b" : "#ef4444";
  const s = size === "lg" ? 100 : 60;
  const r = (s / 2) - 8;
  const circ = 2 * Math.PI * r;
  const pct = (score / 100) * circ;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={s} height={s} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={s/2} cy={s/2} r={r} fill="none" stroke="#e5e7eb" strokeWidth="6" />
        <circle
          cx={s/2} cy={s/2} r={r} fill="none"
          stroke={color} strokeWidth="6"
          strokeDasharray={`${pct} ${circ - pct}`}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 1s ease" }}
        />
      </svg>
      <span className={`absolute font-bold ${size === "lg" ? "text-xl" : "text-sm"}`} style={{ color }}>
        {score}%
      </span>
    </div>
  );
};

const Badge = ({ text, color }: { text: string; color: string }) => (
  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${color}`}>
    {text}
  </span>
);

const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, string> = {
    "Beklemede": "bg-yellow-100 text-yellow-800",
    "Görüşme": "bg-blue-100 text-blue-800",
    "Kabul": "bg-green-100 text-green-800",
    "Red": "bg-red-100 text-red-800",
    "Geri Çekildi": "bg-gray-100 text-gray-800",
  };
  return <Badge text={status} color={map[status] || "bg-gray-100 text-gray-800"} />;
};

const Spinner = () => (
  <div className="flex items-center justify-center p-8">
    <div className="relative">
      <div className="w-12 h-12 rounded-full border-4 border-indigo-100"></div>
      <div className="w-12 h-12 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin absolute inset-0"></div>
    </div>
  </div>
);

// ─── Bölümler ────────────────────────────────────────────────────

// HERO
const HeroSection = ({ onStart }: { onStart: () => void }) => (
  <div className="min-h-screen flex flex-col">
    {/* Navbar */}
    <nav className="bg-white border-b border-gray-100 px-6 py-4">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🎯</span>
          <span className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Başvur.AI
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500 hidden md:block">YC S2026 — Tsenta'dan ilham alındı</span>
          <button
            onClick={onStart}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            Hemen Başla
          </button>
        </div>
      </div>
    </nav>

    {/* Hero */}
    <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 px-6 py-20">
      <div className="max-w-4xl text-center">
        <div className="inline-flex items-center gap-2 bg-indigo-100 text-indigo-700 px-4 py-2 rounded-full text-sm font-medium mb-6">
          <span>⚡</span>
          <span>YC S2026 Tsenta Klonu — Türkiye Versiyonu</span>
        </div>
        <h1 className="text-5xl md:text-6xl font-extrabold text-gray-900 mb-6 leading-tight">
          İş Başvurularını<br />
          <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            AI ile Güçlendir
          </span>
        </h1>
        <p className="text-xl text-gray-500 mb-10 max-w-2xl mx-auto">
          CV'ni yükle, iş ilanını yapıştır. Saniyeler içinde uyum analizi, kişiselleştirilmiş 
          ön yazı ve başvuru takibi. Türkiye'nin iş piyasasına özel.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
          <button
            onClick={onStart}
            className="bg-indigo-600 text-white px-8 py-4 rounded-xl text-lg font-semibold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 hover:shadow-xl"
          >
            🚀 Ücretsiz Dene
          </button>
          <a
            href="https://www.ycombinator.com/companies/tsenta"
            target="_blank"
            rel="noopener noreferrer"
            className="border border-gray-200 text-gray-600 px-8 py-4 rounded-xl text-lg font-medium hover:border-gray-300 transition-all"
          >
            🔗 Tsenta (YC S2026)
          </a>
        </div>

        {/* Özellikler */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
          {[
            { icon: "📄", label: "CV Analizi", desc: "AI destekli" },
            { icon: "🎯", label: "Uyum Skoru", desc: "Anlık hesaplama" },
            { icon: "✍️", label: "Ön Yazı", desc: "Kişiselleştirilmiş" },
            { icon: "📊", label: "Başvuru Takibi", desc: "Türk platformları" },
          ].map((f, i) => (
            <div key={i} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center card-hover">
              <div className="text-3xl mb-2">{f.icon}</div>
              <div className="font-semibold text-gray-800 text-sm">{f.label}</div>
              <div className="text-xs text-gray-400">{f.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

// CV YÜKLEME
const CVUploadSection = ({
  onAnalyzed
}: {
  onAnalyzed: (cvText: string, analysis: CVAnalysis) => void;
}) => {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fileName, setFileName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    if (!file) return;
    setFileName(file.name);
    setLoading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("cv", file);

      const res = await fetch(`${API}/analyze-cv`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Hata oluştu");

      onAnalyzed(data.cvText, data.analysis);
    } catch (err: any) {
      setError(err.message || "CV yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [onAnalyzed]);

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">📄 CV'ni Yükle</h2>
        <p className="text-gray-500">PDF veya TXT formatında — AI saniyeler içinde analiz eder</p>
      </div>

      <div
        className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
          dragging ? "border-indigo-500 bg-indigo-50" : "border-gray-200 hover:border-indigo-300 hover:bg-gray-50"
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files[0];
          if (file) handleFile(file);
        }}
        onClick={() => inputRef.current?.click()}
      >
        {loading ? (
          <div>
            <Spinner />
            <p className="text-indigo-600 font-medium mt-2">CV analiz ediliyor...</p>
          </div>
        ) : (
          <>
            <div className="text-5xl mb-4">📁</div>
            <p className="text-lg font-semibold text-gray-700 mb-2">
              {fileName || "CV'ni buraya sürükle veya tıkla"}
            </p>
            <p className="text-sm text-gray-400">PDF veya TXT • Maks 10MB</p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.txt"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />
      </div>

      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          ❌ {error}
        </div>
      )}

      <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-4">
        <p className="text-sm text-amber-700">
          💡 <strong>İpucu:</strong> CV'ni <strong>metin tabanlı PDF</strong> olarak kaydet (taranmış değil).
          Kariyer.net veya LinkedIn'den indirilen PDF'ler de çalışır.
        </p>
      </div>
    </div>
  );
};

// CV ANALİZ SONUCU
const CVResultSection = ({
  analysis,
  onContinue
}: {
  analysis: CVAnalysis;
  onContinue: () => void;
}) => {
  const scoreColor = analysis.cv_puani >= 80 ? "text-green-600" : analysis.cv_puani >= 60 ? "text-amber-600" : "text-red-600";

  return (
    <div className="max-w-3xl mx-auto p-6 fade-in">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">✅ CV Analizi Tamamlandı</h2>
        <ScoreCircle score={analysis.cv_puani} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
          <h3 className="font-semibold text-gray-700 mb-3">👤 Kişi Bilgileri</h3>
          <div className="space-y-2 text-sm">
            <div><span className="text-gray-400">Ad Soyad:</span> <span className="font-medium">{analysis.ad_soyad}</span></div>
            {analysis.email && <div><span className="text-gray-400">Email:</span> <span className="font-medium">{analysis.email}</span></div>}
            <div><span className="text-gray-400">Deneyim:</span> <span className="font-medium">{analysis.deneyim_yillari} yıl</span></div>
            <div><span className="text-gray-400">Eğitim:</span> <span className="font-medium">{analysis.egitim}</span></div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
          <h3 className="font-semibold text-gray-700 mb-3">🌍 Diller</h3>
          <div className="flex flex-wrap gap-2 mb-3">
            {analysis.diller?.map(d => <Badge key={d} text={d} color="bg-blue-100 text-blue-700" />)}
          </div>
          <h3 className="font-semibold text-gray-700 mb-2">🏢 Sektör Önerileri</h3>
          <div className="flex flex-wrap gap-2">
            {analysis.sektor_onerileri?.map(s => <Badge key={s} text={s} color="bg-purple-100 text-purple-700" />)}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm mb-4">
        <h3 className="font-semibold text-gray-700 mb-3">💡 Özet</h3>
        <p className="text-gray-600 text-sm leading-relaxed">{analysis.ozet}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
          <h3 className="font-semibold text-gray-700 mb-3">💪 Beceriler</h3>
          <div className="flex flex-wrap gap-2">
            {analysis.beceriler?.map(b => <Badge key={b} text={b} color="bg-green-100 text-green-700" />)}
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
          <h3 className="font-semibold text-gray-700 mb-3">✨ Güçlü Yönler</h3>
          <ul className="space-y-1">
            {analysis.guclu_yonler?.map(g => (
              <li key={g} className="flex items-start gap-2 text-sm text-gray-600">
                <span className="text-green-500 mt-0.5">✓</span> {g}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <button
        onClick={onContinue}
        className="w-full bg-indigo-600 text-white py-4 rounded-xl font-semibold text-lg hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
      >
        Devam Et: İş İlanı Ekle →
      </button>
    </div>
  );
};

// İŞ İLANI GİRİŞİ
const JobInputSection = ({
  onAnalyzed,
  cvText,
  cvAnalysis
}: {
  onAnalyzed: (analysis: JobAnalysis, jd: string) => void;
  cvText: string;
  cvAnalysis: CVAnalysis;
}) => {
  const [jobDescription, setJobDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const portals = [
    { name: "Kariyer.net", url: "https://www.kariyer.net", emoji: "🔵" },
    { name: "LinkedIn", url: "https://linkedin.com/jobs", emoji: "🔷" },
    { name: "İŞKUR", url: "https://www.iskur.gov.tr/is-ilanlari/", emoji: "🟥" },
    { name: "Yenibiris", url: "https://www.yenibiris.com", emoji: "🟠" },
    { name: "SecretCV", url: "https://www.secretcv.com", emoji: "🟣" },
  ];

  const handleAnalyze = async () => {
    if (!jobDescription.trim() || jobDescription.length < 50) {
      setError("Lütfen en az 50 karakter uzunluğunda iş ilanı metni gir");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${API}/analyze-job`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobDescription, cvText, cvAnalysis }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onAnalyzed(data.analysis, jobDescription);
    } catch (err: any) {
      setError(err.message || "Analiz yapılamadı");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">🎯 İş İlanı Ekle</h2>
        <p className="text-gray-500 text-sm">İş ilanını kopyala-yapıştır — AI CV'nle karşılaştıracak</p>
      </div>

      {/* Portal Kısayolları */}
      <div className="mb-4">
        <p className="text-xs text-gray-400 mb-2 font-medium">TÜRK İŞ PLATFORMLARI</p>
        <div className="flex flex-wrap gap-2">
          {portals.map(p => (
            <a
              key={p.name}
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 bg-white border border-gray-200 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
            >
              {p.emoji} {p.name}
            </a>
          ))}
        </div>
      </div>

      <textarea
        value={jobDescription}
        onChange={(e) => setJobDescription(e.target.value)}
        placeholder="İş ilanı metnini buraya yapıştır...

Örnek:
Yazılım Mühendisi - Kariyer.net
İstanbul Anadolu / Tam Zamanlı

Aranan Nitelikler:
- 3+ yıl React deneyimi
- Node.js bilgisi
..."
        className="w-full h-64 border border-gray-200 rounded-xl p-4 text-sm text-gray-700 resize-none focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all"
      />

      <div className="flex items-center justify-between mt-2 mb-4 text-xs text-gray-400">
        <span>{jobDescription.length} karakter</span>
        <span>Min: 50 karakter</span>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          ❌ {error}
        </div>
      )}

      <button
        onClick={handleAnalyze}
        disabled={loading || jobDescription.length < 50}
        className="w-full bg-indigo-600 text-white py-4 rounded-xl font-semibold text-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-200"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="animate-spin">⏳</span> Analiz ediliyor...
          </span>
        ) : "🔍 Uyum Analizi Yap"}
      </button>
    </div>
  );
};

// UYUM ANALİZ SONUCU
const JobMatchSection = ({
  jobAnalysis,
  jobDescription,
  cvText,
  cvAnalysis,
  onSaveApplication,
  onReset
}: {
  jobAnalysis: JobAnalysis;
  jobDescription: string;
  cvText: string;
  cvAnalysis: CVAnalysis;
  onSaveApplication: (app: Partial<Application>) => void;
  onReset: () => void;
}) => {
  const [activeTab, setActiveTab] = useState<"analiz" | "onYazi" | "iyilestir">("analiz");
  const [coverLetter, setCoverLetter] = useState("");
  const [improvements, setImprovements] = useState<any[]>([]);
  const [tone, setTone] = useState("profesyonel");
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  const scoreColor = jobAnalysis.uyum_skoru >= 80 ? "text-green-600" : jobAnalysis.uyum_skoru >= 60 ? "text-amber-600" : "text-red-600";
  const chanceBg = jobAnalysis.basarma_ihtimali === "Yüksek" ? "bg-green-100 text-green-700" :
    jobAnalysis.basarma_ihtimali === "Orta" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700";

  const generateCoverLetter = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/generate-cover-letter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobDescription, cvAnalysis, jobAnalysis, tone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCoverLetter(data.coverLetter);
    } catch (err: any) {
      alert("Ön yazı oluşturulamadı: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const generateImprovements = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/improve-cv`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cvText, jobDescription }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setImprovements(data.oneriler || []);
    } catch (err: any) {
      alert("İyileştirme önerileri alınamadı: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const saveApplication = async () => {
    onSaveApplication({
      company: jobAnalysis.sirket_adi || "Bilinmiyor",
      position: jobAnalysis.pozisyon_adi,
      matchScore: jobAnalysis.uyum_skoru,
      status: "Beklemede",
    });
    setSaved(true);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(coverLetter);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-3xl mx-auto p-6 fade-in">
      {/* Skor Kartı */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-6 text-white mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold mb-1">{jobAnalysis.pozisyon_adi}</h2>
            {jobAnalysis.sirket_adi && (
              <p className="text-indigo-200">🏢 {jobAnalysis.sirket_adi}</p>
            )}
            <div className="flex items-center gap-3 mt-3">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${chanceBg}`}>
                {jobAnalysis.basarma_ihtimali} İhtimal
              </span>
              {jobAnalysis.maas_tahmini && (
                <span className="bg-white/20 px-3 py-1 rounded-full text-sm">
                  💰 {jobAnalysis.maas_tahmini}
                </span>
              )}
            </div>
          </div>
          <ScoreCircle score={jobAnalysis.uyum_skoru} size="lg" />
        </div>
      </div>

      {/* Tablar */}
      <div className="flex gap-2 mb-6 bg-gray-100 p-1 rounded-xl">
        {(["analiz", "onYazi", "iyilestir"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab ? "bg-white shadow text-indigo-600" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab === "analiz" ? "📊 Analiz" : tab === "onYazi" ? "✍️ Ön Yazı" : "🔧 İyileştir"}
          </button>
        ))}
      </div>

      {/* Analiz Sekmesi */}
      {activeTab === "analiz" && (
        <div className="space-y-4 fade-in">
          <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
            <p className="text-gray-600 text-sm leading-relaxed">{jobAnalysis.neden_uygun}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
              <h3 className="font-semibold text-green-700 mb-3">✅ Güçlü Eşleşmeler</h3>
              <ul className="space-y-2">
                {jobAnalysis.guclu_eslesmeler?.map((e, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                    <span className="text-green-500 mt-0.5 shrink-0">✓</span> {e}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
              <h3 className="font-semibold text-red-600 mb-3">⚠️ Eksik Beceriler</h3>
              <ul className="space-y-2">
                {jobAnalysis.eksik_beceriler?.map((e, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                    <span className="text-red-400 mt-0.5 shrink-0">✗</span> {e}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
            <h3 className="font-semibold text-gray-700 mb-3">💡 Öneriler</h3>
            <ul className="space-y-2">
              {jobAnalysis.oneriler?.map((o, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                  <span className="text-indigo-500 mt-0.5 shrink-0">→</span> {o}
                </li>
              ))}
            </ul>
          </div>

          {jobAnalysis.anahtar_kelimeler?.length > 0 && (
            <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
              <h3 className="font-semibold text-gray-700 mb-3">🔑 Anahtar Kelimeler (CV'ne ekle!)</h3>
              <div className="flex flex-wrap gap-2">
                {jobAnalysis.anahtar_kelimeler.map(k => (
                  <Badge key={k} text={k} color="bg-indigo-100 text-indigo-700" />
                ))}
              </div>
            </div>
          )}

          {jobAnalysis.dikkat_edilmesi_gerekenler && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-sm text-amber-700">
                ⚠️ <strong>Dikkat:</strong> {jobAnalysis.dikkat_edilmesi_gerekenler}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Ön Yazı Sekmesi */}
      {activeTab === "onYazi" && (
        <div className="space-y-4 fade-in">
          {!coverLetter ? (
            <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
              <h3 className="font-semibold text-gray-800 mb-4">✍️ Ton Seçimi</h3>
              <div className="grid grid-cols-2 gap-3 mb-6">
                {[
                  { id: "profesyonel", label: "💼 Profesyonel", desc: "Resmi ve kurumsal" },
                  { id: "samimi", label: "😊 Samimi", desc: "Sıcak ve doğal" },
                  { id: "ozguvenlı", label: "💪 Özgüvenli", desc: "İddialı ve kararlı" },
                  { id: "akademik", label: "🎓 Akademik", desc: "Detaylı ve analitik" },
                ].map(t => (
                  <button
                    key={t.id}
                    onClick={() => setTone(t.id)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      tone === t.id
                        ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="font-medium text-sm">{t.label}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{t.desc}</div>
                  </button>
                ))}
              </div>
              <button
                onClick={generateCoverLetter}
                disabled={loading}
                className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-all"
              >
                {loading ? "⏳ Oluşturuluyor..." : "✨ Ön Yazı Oluştur"}
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-gray-800">Ön Yazın Hazır 🎉</h3>
                <div className="flex gap-2">
                  <button
                    onClick={copyToClipboard}
                    className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                  >
                    {copied ? "✅ Kopyalandı!" : "📋 Kopyala"}
                  </button>
                  <button
                    onClick={() => setCoverLetter("")}
                    className="text-sm text-gray-400 hover:text-gray-600 px-3 py-1.5"
                  >
                    Yeniden
                  </button>
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap max-h-80 overflow-y-auto border">
                {coverLetter}
              </div>
            </div>
          )}
        </div>
      )}

      {/* İyileştir Sekmesi */}
      {activeTab === "iyilestir" && (
        <div className="space-y-4 fade-in">
          {improvements.length === 0 ? (
            <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm text-center">
              <div className="text-4xl mb-4">🔧</div>
              <p className="text-gray-500 mb-4">CV'ni bu iş ilanına göre nasıl iyileştirebilirsin?</p>
              <button
                onClick={generateImprovements}
                disabled={loading}
                className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-all"
              >
                {loading ? "⏳ Analiz ediliyor..." : "🔍 İyileştirme Önerileri Al"}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {improvements.map((imp, i) => (
                <div key={i} className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-gray-800 text-sm">{imp.baslik}</h3>
                    <Badge
                      text={imp.oncelik}
                      color={imp.oncelik === "yüksek" ? "bg-red-100 text-red-700" : imp.oncelik === "orta" ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"}
                    />
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{imp.aciklama}</p>
                  {imp.ornek && (
                    <div className="bg-indigo-50 rounded-lg p-3 text-xs text-indigo-700">
                      💡 Örnek: {imp.ornek}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Aksiyon Butonları */}
      <div className="flex gap-3 mt-6">
        <button
          onClick={saveApplication}
          disabled={saved}
          className="flex-1 bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 disabled:opacity-60 transition-all"
        >
          {saved ? "✅ Kaydedildi!" : "💾 Başvuruyu Kaydet"}
        </button>
        <button
          onClick={onReset}
          className="px-6 py-3 border border-gray-200 rounded-xl font-medium text-gray-600 hover:border-gray-300 transition-all"
        >
          Yeni İlan →
        </button>
      </div>
    </div>
  );
};

// BAŞVURU TAKİPÇİSİ
const ApplicationTracker = ({ onBack }: { onBack: () => void }) => {
  const [apps, setApps] = useState<Application[]>([]);
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [appsRes, statsRes] = await Promise.all([
        fetch(`${API}/applications`),
        fetch(`${API}/stats`)
      ]);
      const appsData = await appsRes.json();
      const statsData = await statsRes.json();
      setApps(appsData.applications || []);
      setStats(statsData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => { fetchData(); }, []);

  const updateStatus = async (id: number, status: string) => {
    await fetch(`${API}/applications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    fetchData();
  };

  const deleteApp = async (id: number) => {
    if (!confirm("Bu başvuruyu silmek istiyor musun?")) return;
    await fetch(`${API}/applications/${id}`, { method: "DELETE" });
    fetchData();
  };

  const statCards = [
    { label: "Toplam", value: stats.total || 0, color: "bg-indigo-50 text-indigo-700", emoji: "📊" },
    { label: "Beklemede", value: stats.beklemede || 0, color: "bg-yellow-50 text-yellow-700", emoji: "⏳" },
    { label: "Görüşme", value: stats.gorusme || 0, color: "bg-blue-50 text-blue-700", emoji: "🤝" },
    { label: "Kabul", value: stats.kabul || 0, color: "bg-green-50 text-green-700", emoji: "🎉" },
  ];

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">📊 Başvuru Takipçisi</h2>
        <button onClick={onBack} className="text-sm text-indigo-600 font-medium hover:text-indigo-700">
          ← Geri Dön
        </button>
      </div>

      {/* İstatistikler */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {statCards.map(s => (
          <div key={s.label} className={`${s.color} rounded-xl p-4 text-center`}>
            <div className="text-2xl mb-1">{s.emoji}</div>
            <div className="text-2xl font-bold">{s.value}</div>
            <div className="text-xs font-medium opacity-75">{s.label}</div>
          </div>
        ))}
      </div>

      {loading ? <Spinner /> : apps.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="text-5xl mb-4">📭</div>
          <p>Henüz kayıtlı başvuru yok.</p>
          <p className="text-sm mt-1">İş analizi yapıp "Başvuruyu Kaydet" butonuna bas.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {apps.map(app => (
            <div key={app.id} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-gray-800 truncate">{app.position}</h3>
                  <StatusBadge status={app.status} />
                </div>
                <p className="text-sm text-gray-500">{app.company} · {app.date}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <ScoreCircle score={app.matchScore} size="sm" />
                <select
                  value={app.status}
                  onChange={(e) => updateStatus(app.id, e.target.value)}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-indigo-400"
                >
                  {["Beklemede", "Görüşme", "Kabul", "Red", "Geri Çekildi"].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <button onClick={() => deleteApp(app.id)} className="text-gray-300 hover:text-red-400 transition-colors">✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── ANA UYGULAMA ─────────────────────────────────────────────────
type Step = "hero" | "upload" | "cvResult" | "jobInput" | "jobResult" | "tracker";

export default function App() {
  const [step, setStep] = useState<Step>("hero");
  const [cvText, setCvText] = useState("");
  const [cvAnalysis, setCvAnalysis] = useState<CVAnalysis | null>(null);
  const [jobAnalysis, setJobAnalysis] = useState<JobAnalysis | null>(null);
  const [jobDescription, setJobDescription] = useState("");

  const handleCVAnalyzed = (text: string, analysis: CVAnalysis) => {
    setCvText(text);
    setCvAnalysis(analysis);
    setStep("cvResult");
  };

  const handleJobAnalyzed = (analysis: JobAnalysis, jd: string) => {
    setJobAnalysis(analysis);
    setJobDescription(jd);
    setStep("jobResult");
  };

  const saveApplication = async (appData: any) => {
    try {
      await fetch(`${API}/applications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(appData),
      });
    } catch (err) {
      console.error("Kayıt hatası:", err);
    }
  };

  const resetToJobInput = () => {
    setJobAnalysis(null);
    setJobDescription("");
    setStep("jobInput");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Üst Bar (hero hariç) */}
      {step !== "hero" && (
        <nav className="bg-white border-b border-gray-100 px-6 py-3 sticky top-0 z-10">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <button
              onClick={() => setStep("hero")}
              className="flex items-center gap-2 font-bold text-lg bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent"
            >
              🎯 Başvur.AI
            </button>
            <div className="flex items-center gap-4">
              {/* İlerleme */}
              {(step === "upload" || step === "cvResult" || step === "jobInput" || step === "jobResult") && (
                <div className="hidden md:flex items-center gap-1 text-xs">
                  {["CV Yükle", "Analiz", "İş İlanı", "Sonuç"].map((s, i) => {
                    const stepIdx = { upload: 0, cvResult: 1, jobInput: 2, jobResult: 3 }[step] ?? 0;
                    return (
                      <React.Fragment key={s}>
                        <span className={`px-2 py-0.5 rounded-full ${i <= stepIdx ? "bg-indigo-100 text-indigo-700 font-medium" : "text-gray-400"}`}>
                          {s}
                        </span>
                        {i < 3 && <span className="text-gray-300">›</span>}
                      </React.Fragment>
                    );
                  })}
                </div>
              )}
              <button
                onClick={() => setStep("tracker")}
                className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-indigo-600 font-medium transition-colors"
              >
                📊 Takipçi
              </button>
              <button
                onClick={() => setStep("upload")}
                className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
              >
                + Yeni
              </button>
            </div>
          </div>
        </nav>
      )}

      {/* Sayfa İçeriği */}
      <div className="py-6">
        {step === "hero" && <HeroSection onStart={() => setStep("upload")} />}
        {step === "upload" && <CVUploadSection onAnalyzed={handleCVAnalyzed} />}
        {step === "cvResult" && cvAnalysis && (
          <CVResultSection analysis={cvAnalysis} onContinue={() => setStep("jobInput")} />
        )}
        {step === "jobInput" && cvAnalysis && (
          <JobInputSection
            onAnalyzed={handleJobAnalyzed}
            cvText={cvText}
            cvAnalysis={cvAnalysis}
          />
        )}
        {step === "jobResult" && jobAnalysis && cvAnalysis && (
          <JobMatchSection
            jobAnalysis={jobAnalysis}
            jobDescription={jobDescription}
            cvText={cvText}
            cvAnalysis={cvAnalysis}
            onSaveApplication={saveApplication}
            onReset={resetToJobInput}
          />
        )}
        {step === "tracker" && <ApplicationTracker onBack={() => setStep(cvAnalysis ? "jobResult" : "hero")} />}
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
