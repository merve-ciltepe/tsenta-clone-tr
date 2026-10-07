require("dotenv").config();
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const multer = require("multer");

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

const PORT = process.env.PORT || 4000;
const DB_FILE = path.join(__dirname, "applications.json");

// ─── Dosya Yükleme Ayarları ─────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf" || file.mimetype === "text/plain") {
      cb(null, true);
    } else {
      cb(new Error("Sadece PDF veya TXT dosyası kabul edilir"), false);
    }
  },
});

// ─── Veritabanı Yardımcıları ─────────────────────────────────────
function readDB() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, JSON.stringify({ applications: [] }, null, 2));
      return { applications: [] };
    }
    return JSON.parse(fs.readFileSync(DB_FILE, "utf-8") || '{"applications":[]}');
  } catch (err) {
    return { applications: [] };
  }
}

function saveDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
}

// ─── Groq & Gemini LLM Yardımcıları ───────────────────────────────
async function callGroq(prompt, jsonMode = false) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || !apiKey.startsWith("gsk_")) {
    throw new Error("GROQ_API_KEY eksik veya geçersiz (gsk_ ile başlamalı).");
  }

  const { Groq } = require("groq-sdk");
  const groq = new Groq({ apiKey });

  const completion = await groq.chat.completions.create({
    messages: [
      {
        role: "system",
        content: "Sen Türk iş piyasasına hakim uzman bir insan kaynakları ve kariyer danışmanısın. Yanıtlarını Türkçe ve net ver."
      },
      { role: "user", content: prompt }
    ],
    model: "llama-3.3-70b-versatile",
    temperature: 0.2,
    response_format: jsonMode ? { type: "json_object" } : undefined
  });

  return completion.choices[0]?.message?.content || "";
}

async function callGemini(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.includes("buraya_api_key")) {
    throw new Error("GEMINI_API_KEY tanımlanmamış.");
  }

  const { GoogleGenerativeAI } = require("@google/generative-ai");
  const genAI = new GoogleGenerativeAI(apiKey);
  
  const modelNames = ["gemini-3.8-flash", "gemini-2.5-flash", "gemini-flash-latest"];
  let lastError = null;

  for (const m of modelNames) {
    try {
      const model = genAI.getGenerativeModel({ model: m });
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error("Gemini modellerine ulaşılamadı.");
}

// Birleşik LLM Çağrıcı (Önce Groq -> Sonra Gemini)
async function callLLM(prompt, jsonMode = false) {
  // 1) Groq (En hızlı ve kota sorunu olmayan)
  if (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.startsWith("gsk_")) {
    try {
      const text = await callGroq(prompt, jsonMode);
      return { text, provider: "groq (Llama-3.3-70B)" };
    } catch (err) {
      console.warn("⚠️ Groq hatası, Gemini deneniyor:", err.message);
    }
  }

  // 2) Gemini
  if (process.env.GEMINI_API_KEY) {
    try {
      const text = await callGemini(prompt);
      return { text, provider: "gemini" };
    } catch (err) {
      console.warn("⚠️ Gemini hatası:", err.message);
    }
  }

  throw new Error("Hiçbir bulut LLM sağlayıcısı yanıt vermedi.");
}

// ─── PDF'den Metin Çıkarma ────────────────────────────────────────
async function extractTextFromPDF(buffer) {
  try {
    const pdfParse = require("pdf-parse");
    const data = await pdfParse(buffer);
    return data.text;
  } catch (err) {
    throw new Error("PDF okunamadı: " + err.message);
  }
}

// ─── AKILLI YEREL NLP & KARİYER MOTORU (HIBRAYD MOTOR) ──────────
// Gemini API erişim kısıtlaması (403/429/404) yaşandığında sıfır kesintiyle devreye girer
function localAnalyzeCV(text) {
  const clean = text.replace(/\r\n/g, "\n");
  const lines = clean.split("\n").map(l => l.trim()).filter(Boolean);

  // E-posta
  const emailMatch = clean.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const email = emailMatch ? emailMatch[0] : null;

  // Telefon
  const phoneMatch = clean.match(/(?:\+?90|0)?\s*[5]\d{2}[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}/);
  const telefon = phoneMatch ? phoneMatch[0] : null;

  // İsim Tespiti
  let ad_soyad = "Aday";
  for (const l of lines.slice(0, 5)) {
    if (l.length >= 3 && l.length <= 40 && !l.includes("@") && !l.includes("http") && !/cv|özgeçmiş|curriculum/i.test(l)) {
      ad_soyad = l;
      break;
    }
  }

  // Bilinen teknik ve sosyal beceriler sözlüğü
  const skillDict = [
    "JavaScript", "TypeScript", "React", "Node.js", "Express", "Python", "Django", "Flask",
    "FastAPI", "C++", "C", "C#", ".NET", "Java", "Spring Boot", "SQL", "PostgreSQL",
    "MySQL", "MongoDB", "Redis", "Docker", "Kubernetes", "AWS", "Azure", "GCP", "Git",
    "GitHub", "CI/CD", "Linux", "Embedded", "Gömülü Sistemler", "STM32", "Arduino",
    "ESP32", "RTOS", "FreeRTOS", "Microcontroller", "IoT", "Yapay Zeka", "Machine Learning",
    "Deep Learning", "TensorFlow", "PyTorch", "NLP", "Computer Vision", "Figma", "UI/UX",
    "HTML", "CSS", "Tailwind CSS", "Bootstrap", "REST API", "GraphQL", "Agile", "Scrum"
  ];

  const beceriler = [];
  const lowerText = clean.toLowerCase();
  for (const s of skillDict) {
    if (lowerText.includes(s.toLowerCase())) {
      beceriler.push(s);
    }
  }

  // Eğitim
  let egitim = "Lisans Derecesi";
  const eduKeywords = ["üniversite", "university", "mühendislik", "lisans", "yüksek lisans", "master", "fakülte"];
  for (const l of lines) {
    if (eduKeywords.some(k => l.toLowerCase().includes(k))) {
      egitim = l.slice(0, 80);
      break;
    }
  }

  // Diller
  const diller = ["Türkçe"];
  if (/ingilizce|english/i.test(clean)) diller.push("İngilizce");
  if (/almanca|german/i.test(clean)) diller.push("Almanca");
  if (/fransızca|french/i.test(clean)) diller.push("Fransızca");

  // Deneyim
  let deneyim_yillari = 2;
  const yearMatches = clean.match(/20\d{2}/g);
  if (yearMatches && yearMatches.length >= 2) {
    const nums = yearMatches.map(Number).sort((a,b)=>a-b);
    const diff = nums[nums.length-1] - nums[0];
    if (diff > 0 && diff < 30) deneyim_yillari = Math.min(diff, 10);
  }

  // Puanlama (Metin uzunluğu, beceri sayısı, eğitim vb.)
  let cv_puani = 65 + Math.min(beceriler.length * 3, 25);
  if (email) cv_puani += 3;
  if (telefon) cv_puani += 3;
  if (cv_puani > 96) cv_puani = 96;

  // Güçlü yönler
  const guclu_yonler = [
    beceriler.length > 5 ? `${beceriler.slice(0, 3).join(", ")} dahil zengin teknik yetkinlik` : "Geniş teknoloji adaptasyonu",
    "Proje ve takım çalışmasına yatkın profil",
    "Sürekli öğrenme ve kariyer odaklı gelişim profili"
  ];

  const gelistirilmesi_gereken = [
    "CV'de ölçülebilir metrikler (örn. %30 performans artışı) daha fazla vurgulanabilir",
    "GitHub veya portfolyo proje bağlantıları öne çıkarılabilir"
  ];

  const sektor_onerileri = [
    beceriler.some(b => /embedded|stm32|iot/i.test(b)) ? "Savunma Sanayii & Donanım / IoT" : "Yazılım & Bilişim Teknolojileri",
    "Fintek & E-Ticaret Platformları",
    "Ar-Ge & Teknokent Girişimleri"
  ];

  const ozet = `${ad_soyad}, ${egitim} geçmişine ve ${deneyim_yillari} yıllık sektörel birikime sahip, ${beceriler.slice(0, 4).join(", ") || "modern teknolojiler"} alanında yetkin bir uzmandır. Türk iş piyasasında katma değer üretecek potansiyeli yüksektir.`;

  return {
    ad_soyad,
    email,
    telefon,
    ozet,
    deneyim_yillari,
    beceriler: beceriler.length ? beceriler : ["Problem Çözme", "Yazılım Geliştirme", "Analitik Düşünme"],
    egitim,
    diller,
    guclu_yonler,
    gelistirilmesi_gereken,
    sektor_onerileri,
    cv_puani
  };
}

function localAnalyzeJob(jobDescription, cvAnalysis) {
  const lowerJd = jobDescription.toLowerCase();
  const cvSkills = cvAnalysis?.beceriler || [];

  // Pozisyon Adı
  let pozisyon_adi = "Yazılım Uzmanı";
  const titleMatches = [
    "yazılım mühendisi", "software engineer", "frontend developer", "backend developer",
    "full stack developer", "gömülü sistemler mühendisi", "embedded software engineer",
    "veri bilimci", "yapay zeka mühendisi", "stajyer", "proje yöneticisi"
  ];
  for (const t of titleMatches) {
    if (lowerJd.includes(t)) {
      pozisyon_adi = t.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
      break;
    }
  }

  // Şirket Adı
  let sirket_adi = "İşveren Şirket";
  const lines = jobDescription.split("\n").map(l => l.trim()).filter(Boolean);
  if (lines.length > 0 && lines[0].length < 40) {
    sirket_adi = lines[0].replace(/[\/|-].*$/, "").trim();
  }

  // Eşleşen ve eksik beceriler
  const guclu_eslesmeler = [];
  const eksik_beceriler = [];

  for (const s of cvSkills) {
    if (lowerJd.includes(s.toLowerCase())) {
      guclu_eslesmeler.push(s);
    }
  }

  const commonKeywords = ["React", "TypeScript", "Node.js", "Docker", "SQL", "Git", "REST API", "Python", "AWS", "CI/CD", "Linux"];
  for (const k of commonKeywords) {
    if (lowerJd.includes(k.toLowerCase()) && !cvSkills.some(s => s.toLowerCase() === k.toLowerCase())) {
      eksik_beceriler.push(k);
    }
  }

  // Skor
  const totalRelevant = Math.max(guclu_eslesmeler.length + eksik_beceriler.length, 1);
  let uyum_skoru = Math.round((guclu_eslesmeler.length / totalRelevant) * 100);
  if (uyum_skoru < 55) uyum_skoru = 62 + Math.floor(Math.random() * 15);
  if (uyum_skoru > 94) uyum_skoru = 94;

  const basarma_ihtimali = uyum_skoru >= 80 ? "Yüksek" : uyum_skoru >= 65 ? "Orta" : "Geliştirilebilir";

  const oneriler = [
    `İş ilanında adı geçen '${eksik_beceriler[0] || "temel gereksinimler"}' konusunda pratik deneyimini öne çıkar.`,
    `CV'ndeki '${guclu_eslesmeler[0] || cvSkills[0] || "teknik projelerin"}' başarılarını ilk sayfada net belirt.`,
    "Ön yazında şirketin son dönemdeki hedeflerine nasıl katkı sunacağını vurgula."
  ];

  const anahtar_kelimeler = guclu_eslesmeler.concat(eksik_beceriler).slice(0, 6);

  return {
    pozisyon_adi,
    sirket_adi,
    uyum_skoru,
    guclu_eslesmeler: guclu_eslesmeler.length ? guclu_eslesmeler : ["Temel Teknik Yeterlilik", "Takım Çalışması"],
    eksik_beceriler: eksik_beceriler.length ? eksik_beceriler.slice(0, 4) : ["Spesifik Sektörel Araçlar"],
    oneriler,
    anahtar_kelimeler,
    maas_tahmini: uyum_skoru > 75 ? "45.000 - 65.000 TL" : "35.000 - 50.000 TL",
    basarma_ihtimali,
    neden_uygun: `${cvAnalysis?.ad_soyad || "Aday"}, ilan metninde talep edilen '${guclu_eslesmeler.join(", ") || "temel yetkinlikler"}' konusunda güçlü bir profile sahip. Geçmiş tecrübeleri ve problem çözme becerisi ile bu rolde hızlı değer üretebilir.`,
    dikkat_edilmesi_gerekenler: `Mülakat aşamasında ${eksik_beceriler.slice(0, 2).join(" ve ") || "aranan yan teknolojiler"} ile ilgili gelebilecek sorulara hazırlıklı olunmalı.`
  };
}

function localGenerateCoverLetter(jobDescription, cvAnalysis, jobAnalysis, tone = "profesyonel") {
  const ad = cvAnalysis?.ad_soyad || "Aday";
  const sirket = jobAnalysis?.sirket_adi || "Sayın Yetkili";
  const pozisyon = jobAnalysis?.pozisyon_adi || "Açık Pozisyon";
  const beceriler = (cvAnalysis?.beceriler || []).slice(0, 3).join(", ") || "yazılım geliştirme yetkinliklerim";

  if (tone === "samimi") {
    return `Sayın İşe Alım Ekibi,

${sirket} bünyesinde açılmış olan ${pozisyon} ilanını büyük bir heyecanla inceledim. Şirketinizin vizyonu ve geliştirdiği teknolojiler uzun süredir ilgimi çekiyordu; bu ekibin bir parçası olmak benim için harika bir adım olur.

${cvAnalysis?.egitim || "Mühendislik"} kökenim ve ${beceriler} alanlarındaki deneyimim sayesinde, ilanınızda yer alan sorumlulukları hızla sahiplenebileceğime inanıyorum. Ekip içinde öğrenmeye ve birlikte üretmeye her zaman tutkuyla yaklaşıyorum.

Neler yapabileceğimizi ve projelerinize nasıl değer katabileceğimi detaylıca konuşmak için sizinle bir araya gelmeyi çok isterim. Zaman ayırdığınız için teşekkür ederim.

Saygılarımla,
${ad}`;
  }

  if (tone === "ozguvenlı") {
    return `Sayın İşe Alım Yöneticisi,

${sirket} çatısı altındaki ${pozisyon} pozisyonuna, aradığınız somut teknik çıktıyı ve dinamizmi sağlayabilecek nitelikte bir aday olarak başvuruyorum.

Kariyerim boyunca ${beceriler} ekseninde geliştirdiğim projelerde yüksek performans, temiz mimari ve zamanında teslimat prensiplerine odaklandım. ${sirket}'in hedeflerine doğrudan ivme kazandırabilecek bir yetkinlik setine ve problem çözme refleksine sahibim.

Sizinle yapacağımız görüşmede, ekibinize nasıl hızlı ve ölçülebilir bir katkı sağlayabileceğimi somut örneklerle aktarmaktan mutluluk duyarım.

İlginiz için teşekkür ederim.

Saygılarımla,
${ad}`;
  }

  // Varsayılan: Profesyonel
  return `Sayın İşe Alım Yöneticisi,

${sirket} bünyesinde yer alan ${pozisyon} pozisyonu için başvurumu sunmaktan memnuniyet duyuyorum. Sahip olduğum teknik birikim ve profesyonel çalışma disiplininin ekibinizin hedefleriyle tam örtüştüğüne inanıyorum.

${cvAnalysis?.egitim || "İlgili alandaki eğitimim"} ve ${cvAnalysis?.deneyim_yillari || 2} yıllık mesleki yolculuğumda ${beceriler} alanlarında uzmanlaştım. Analitik düşünme yaklaşımım, karmaşık gereksinimleri stabil ve sürdürülebilir çözümlere dönüştürmeme olanak sağlamaktadır.

Bu pozisyonda kurumunuzun başarısına nasıl katkı sağlayabileceğimi detaylandırmak üzere sizinle uygun bir zamanda görüşmeyi arzu ederim. Başvurumu değerlendirmeye aldığınız için teşekkür ederim.

Saygılarımla,
${ad}`;
}

// ─── API Endpoint'leri ────────────────────────────────────────────

// Sağlık Kontrolü
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "Başvur.AI Backend", hybrid_engine: true });
});

// CV Yükleme ve Analiz
app.post("/api/analyze-cv", upload.single("cv"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "CV dosyası yüklenmedi" });
    }

    let cvText = "";
    if (req.file.mimetype === "application/pdf") {
      cvText = await extractTextFromPDF(req.file.buffer);
    } else {
      cvText = req.file.buffer.toString("utf-8");
    }

    if (!cvText || cvText.trim().length < 20) {
      return res.status(400).json({ error: "CV metni okunamadı veya dosya boş." });
    }

    let parsed = null;
    let engine = "gemini";

    // 1) Önce LLM (Groq / Gemini) dene
    try {
      const prompt = `Sen bir Türk kariyer danışmanısın. Aşağıdaki CV metnini analiz et ve JSON formatında yanıt ver.

CV Metni:
${cvText.slice(0, 4000)}

Şu bilgileri çıkar ve JSON olarak döndür (başka hiçbir şey yazma, sadece JSON):
{
  "ad_soyad": "kişinin adı soyadı",
  "email": "email adresi veya null",
  "telefon": "telefon numarası veya null",
  "ozet": "2-3 cümle profesyonel özet",
  "deneyim_yillari": 2,
  "beceriler": ["beceri1", "beceri2", "beceri3"],
  "egitim": "en yüksek eğitim derecesi ve okul",
  "diller": ["Türkçe", "İngilizce"],
  "guclu_yonler": ["güçlü yön 1", "güçlü yön 2", "güçlü yön 3"],
  "gelistirilmesi_gereken": ["alan 1", "alan 2"],
  "sektor_onerileri": ["Teknoloji", "Finans"],
  "cv_puani": 75
}`;

      const { text: aiResponse, provider } = await callLLM(prompt, true);
      engine = provider;
      let jsonStr = aiResponse.trim();
      if (jsonStr.startsWith("```json")) jsonStr = jsonStr.slice(7);
      if (jsonStr.startsWith("```")) jsonStr = jsonStr.slice(3);
      if (jsonStr.endsWith("```")) jsonStr = jsonStr.slice(0, -3);
      parsed = JSON.parse(jsonStr.trim());
    } catch (apiErr) {
      console.warn("⚠️ Bulut LLM ulaşılamadı, Akıllı Hibrit NLP Motoru devrede:", apiErr.message);
      engine = "hibrit_yerel";
      parsed = localAnalyzeCV(cvText);
    }

    res.json({
      success: true,
      engine,
      cvText: cvText.slice(0, 5000),
      analysis: parsed
    });
  } catch (err) {
    console.error("CV genel analiz hatası:", err);
    res.status(500).json({ error: "CV analiz edilemedi: " + err.message });
  }
});

// İş İlanı Analizi + Eşleştirme
app.post("/api/analyze-job", async (req, res) => {
  try {
    const { jobDescription, cvText, cvAnalysis } = req.body;
    if (!jobDescription || !cvText) {
      return res.status(400).json({ error: "İş ilanı veya CV metni eksik" });
    }

    let analysis = null;
    let engine = "gemini";

    try {
      const prompt = `Sen bir Türk kariyer danışmanısın. Aşağıdaki iş ilanını ve CV'yi karşılaştır.

İŞ İLANI:
${jobDescription.slice(0, 2000)}

CV ÖZETİ:
${JSON.stringify(cvAnalysis || {}).slice(0, 1000)}

CV METNİ:
${cvText.slice(0, 2000)}

Analiz sonucunu JSON formatında döndür (sadece JSON):
{
  "pozisyon_adi": "iş ilanındaki pozisyon adı",
  "sirket_adi": "şirket adı veya null",
  "uyum_skoru": 78,
  "guclu_eslesmeler": ["eşleşen beceri 1", "eşleşen beceri 2"],
  "eksik_beceriler": ["eksik beceri 1", "eksik beceri 2"],
  "oneriler": ["başvuru için öneri 1", "başvuru için öneri 2"],
  "anahtar_kelimeler": ["anahtar kelime 1", "anahtar kelime 2"],
  "maas_tahmini": "35.000-50.000 TL",
  "basarma_ihtimali": "Yüksek",
  "neden_uygun": "Adayın bu pozisyona uygun olduğuna dair 2-3 cümlelik analiz",
  "dikkat_edilmesi_gerekenler": "Dikkat edilmesi gereken 1-2 madde"
}`;

      const { text: aiResponse, provider } = await callLLM(prompt, true);
      engine = provider;
      let jsonStr = aiResponse.trim();
      if (jsonStr.startsWith("```json")) jsonStr = jsonStr.slice(7);
      if (jsonStr.startsWith("```")) jsonStr = jsonStr.slice(3);
      if (jsonStr.endsWith("```")) jsonStr = jsonStr.slice(0, -3);
      analysis = JSON.parse(jsonStr.trim());
    } catch (apiErr) {
      console.warn("⚠️ Bulut LLM hatası, Akıllı Yerel Eşleştirme devreye girdi:", apiErr.message);
      engine = "hibrit_yerel";
      analysis = localAnalyzeJob(jobDescription, cvAnalysis);
    }

    res.json({ success: true, engine, analysis });
  } catch (err) {
    console.error("İş analiz hatası:", err);
    res.status(500).json({ error: "İş ilanı analiz edilemedi: " + err.message });
  }
});

// Ön Yazı Oluştur
app.post("/api/generate-cover-letter", async (req, res) => {
  try {
    const { jobDescription, cvAnalysis, jobAnalysis, tone } = req.body;
    if (!jobDescription || !cvAnalysis) {
      return res.status(400).json({ error: "Eksik veri" });
    }

    let coverLetter = "";
    let engine = "gemini";

    try {
      const prompt = `Sen profesyonel bir kariyer danışmanısın. Aşağıdaki bilgilere göre Türkçe bir ön yazı yaz.
TON: ${tone}
ADAY BİLGİLERİ: ${JSON.stringify(cvAnalysis)}
İŞ İLANI: ${jobDescription.slice(0, 1500)}
İŞ ANALİZİ: ${JSON.stringify(jobAnalysis || {})}
Sadece ön yazı metnini yaz, başka açıklama ekleme.`;

      const { text: aiText, provider } = await callLLM(prompt, false);
      engine = provider;
      coverLetter = aiText.trim();
    } catch (apiErr) {
      console.warn("⚠️ Bulut LLM hatası, Yerel Ön Yazı Motoru devreye girdi:", apiErr.message);
      engine = "hibrit_yerel";
      coverLetter = localGenerateCoverLetter(jobDescription, cvAnalysis, jobAnalysis, tone);
    }

    res.json({ success: true, engine, coverLetter });
  } catch (err) {
    console.error("Ön yazı hatası:", err);
    res.status(500).json({ error: "Ön yazı oluşturulamadı: " + err.message });
  }
});

// CV İyileştirme Önerileri
app.post("/api/improve-cv", async (req, res) => {
  try {
    const { cvText, jobDescription } = req.body;
    let oneriler = [];
    let engine = "gemini";

    try {
      const prompt = `Bu CV'yi bu iş ilanına göre geliştirmek için 4 somut öneri ver. JSON: { "oneriler": [ { "baslik": "", "aciklama": "", "oncelik": "yüksek/orta", "ornek": "" } ] }
CV: ${cvText.slice(0, 2000)}
İŞ İLANI: ${jobDescription.slice(0, 1000)}`;

      const { text: r, provider } = await callLLM(prompt, true);
      engine = provider;
      let jsonStr = r.trim();
      if (jsonStr.startsWith("```json")) jsonStr = jsonStr.slice(7);
      if (jsonStr.startsWith("```")) jsonStr = jsonStr.slice(3);
      if (jsonStr.endsWith("```")) jsonStr = jsonStr.slice(0, -3);
      oneriler = JSON.parse(jsonStr.trim()).oneriler;
    } catch (e) {
      engine = "hibrit_yerel";
      oneriler = [
        {
          baslik: "İlanda Geçen Anahtar Kelimeleri Entegre Et",
          aciklama: "İş tanımında yer alan teknolojileri ve terminolojiyi CV'nizin yetkinlikler ve deneyim bölümünde birebir geçirin.",
          oncelik: "yüksek",
          ornek: "Örn: 'React ve modern durum yönetimi mimarileri kullanarak...' şeklinde somutlaştırın."
        },
        {
          baslik: "Ölçülebilir Çıktılar ve Rakamlar Ekleyin",
          aciklama: "Yalnızca yaptığınız işleri değil, bunların projeye sağladığı verimlilik veya hız artışlarını yüzde olarak belirtin.",
          oncelik: "yüksek",
          ornek: "Örn: 'API yanıt sürelerini %35 optimize etti.'"
        },
        {
          baslik: "Türk İş Kültürüne Uygun Özet Paragraf",
          aciklama: "CV'nizin en üstüne 2-3 cümlelik, hedefinizi ve şirkete katacağınız somut değeri özetleyen bir giriş ekleyin.",
          oncelik: "orta",
          ornek: "Örn: '3+ yıl deneyimli, temiz kod mimarisine odaklı yazılım geliştirici.'"
        }
      ];
    }

    res.json({ success: true, engine, oneriler });
  } catch (err) {
    res.status(500).json({ error: "Öneriler üretilemedi: " + err.message });
  }
});

// Başvuru Kaydet
app.post("/api/applications", async (req, res) => {
  try {
    const { company, position, matchScore, status, notes, jobUrl } = req.body;
    const db = readDB();
    
    const newApp = {
      id: Date.now(),
      company: company || "Bilinmiyor",
      position: position || "Bilinmiyor",
      matchScore: matchScore || 0,
      status: status || "Beklemede",
      notes: notes || "",
      jobUrl: jobUrl || "",
      date: new Date().toLocaleDateString("tr-TR"),
      createdAt: new Date().toISOString()
    };
    
    db.applications.push(newApp);
    saveDB(db);
    
    res.json({ success: true, application: newApp });
  } catch (err) {
    res.status(500).json({ error: "Başvuru kaydedilemedi: " + err.message });
  }
});

// Başvuruları Listele
app.get("/api/applications", (req, res) => {
  const db = readDB();
  const sorted = [...db.applications].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ applications: sorted });
});

// Başvuru Durumu Güncelle
app.patch("/api/applications/:id", (req, res) => {
  const db = readDB();
  const id = parseInt(req.params.id);
  const idx = db.applications.findIndex(a => a.id === id);
  
  if (idx === -1) return res.status(404).json({ error: "Başvuru bulunamadı" });
  
  db.applications[idx] = { ...db.applications[idx], ...req.body };
  saveDB(db);
  
  res.json({ success: true, application: db.applications[idx] });
});

// Başvuru Sil
app.delete("/api/applications/:id", (req, res) => {
  const db = readDB();
  const id = parseInt(req.params.id);
  db.applications = db.applications.filter(a => a.id !== id);
  saveDB(db);
  res.json({ success: true });
});

// Türk İş Portalleri
app.get("/api/job-portals", (req, res) => {
  const portals = [
    { name: "Kariyer.net", url: "https://www.kariyer.net", logo: "🔵", description: "Türkiye'nin en büyük iş platformu" },
    { name: "LinkedIn TR", url: "https://www.linkedin.com/jobs", logo: "🔷", description: "Küresel profesyonel ağ" },
    { name: "İŞKUR", url: "https://www.iskur.gov.tr", logo: "🟥", description: "Devlet iş ve işçi bulma kurumu" },
    { name: "Yenibiris.com", url: "https://www.yenibiris.com", logo: "🟠", description: "İş arama ve kariyer platformu" },
    { name: "SecretCV", url: "https://www.secretcv.com", logo: "🟣", description: "Gizli CV ile iş arama" },
    { name: "Glassdoor TR", url: "https://www.glassdoor.com.tr", logo: "🟢", description: "Şirket yorumları ve iş ilanları" },
    { name: "Indeed TR", url: "https://tr.indeed.com", logo: "⚡", description: "Küresel iş arama motoru" },
  ];
  res.json({ portals });
});

// İstatistikler
app.get("/api/stats", (req, res) => {
  const db = readDB();
  const apps = db.applications;
  
  const stats = {
    total: apps.length,
    beklemede: apps.filter(a => a.status === "Beklemede").length,
    gorusme: apps.filter(a => a.status === "Görüşme").length,
    kabul: apps.filter(a => a.status === "Kabul").length,
    red: apps.filter(a => a.status === "Red").length,
    ortalama_uyum: apps.length > 0 
      ? Math.round(apps.reduce((s, a) => s + (a.matchScore || 0), 0) / apps.length)
      : 0
  };
  
  res.json(stats);
});

app.listen(PORT, () => {
  console.log(`\n🚀 Başvur.AI Hibrit Backend ${PORT} portunda çalışıyor`);
  console.log(`📡 API: http://localhost:${PORT}/api/health\n`);
});
