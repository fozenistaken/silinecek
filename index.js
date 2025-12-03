const express = require('express');
const axios = require('axios');
const app = express();

// --- AYARLAR (RENDER ENV'DEN ÇEKİLİR) ---
const GITHUB_TOKEN = process.env.GITHUB_TOKEN; 
const CLIENT_SECRET_KEY = process.env.CLIENT_SECRET_KEY;

// 🟢 DEĞİŞİKLİK BURADA: URL YERİNE DİREKT LİSTE
// Render'da 'ALLOWED_HWIDS' adında bir değişken oluşturup ID'leri virgül ile ayırarak yazmalısın.
// Örn: b10a8db...,54105b...
const ALLOWED_HWIDS_ENV = process.env.ALLOWED_HWIDS || ""; 

const GITHUB_USER = "fozenistaken"; 
const GITHUB_REPO = "nxpbot"; 
const BRANCH = "main"; 

app.use(express.json());

// --- YARDIMCI FONKSİYON: HWID LİSTESİNİ ENV'DEN OKU ---
function getAllowedHWIDs() {
    if (!ALLOWED_HWIDS_ENV) return [];
    
    // Virgülle ayrılmış string'i diziye (array) çevir ve boşlukları temizle
    return ALLOWED_HWIDS_ENV.split(',').map(id => id.trim()).filter(id => id !== "");
}

// --- MIDDLEWARE: İNDİRME GÜVENLİĞİ ---
const protectDownloads = (req, res, next) => {
    const clientKey = req.headers['x-client-key'];
    const clientHWID = req.headers['x-hwid'];

    // 1. Secret Key Kontrolü
    if (!clientKey || clientKey !== CLIENT_SECRET_KEY) {
        return res.status(403).send("Geçersiz Anahtar.");
    }

    // 2. HWID Kontrolü
    if (!clientHWID) return res.status(400).send("HWID Eksik.");

    // Listeyi Env'den al
    const allowedList = getAllowedHWIDs();
    
    if (!allowedList.includes(clientHWID)) {
        return res.status(403).send("Lisanssız Cihaz.");
    }

    next();
};

// --- ROTALAR ---

app.get('/', (req, res) => {
    res.send("Nexup Update & Lisans Sunucusu (ENV Modu) Aktif! 🟢");
});

// 🔥 LİSANS SORGULAMA ROTASI
app.post('/verify-license', (req, res) => {
    const clientKey = req.headers['x-client-key'];
    const clientHWID = req.headers['x-hwid'];

    if (!clientKey || clientKey !== CLIENT_SECRET_KEY) {
        return res.status(200).json({ success: false, message: "Gizli anahtar hatalı!" });
    }

    if (!clientHWID) {
        return res.status(200).json({ success: false, message: "HWID bilgisi gönderilmedi." });
    }

    // Listeyi Env'den al ve kontrol et
    const allowedList = getAllowedHWIDs();
    
    if (allowedList.includes(clientHWID)) {
        console.log(`✅ Lisans Doğrulandı: ${clientHWID}`);
        return res.status(200).json({ success: true, message: "Lisans Aktif." });
    } else {
        console.warn(`⛔ Lisanssız Giriş Denemesi: ${clientHWID}`);
        return res.status(200).json({ success: false, message: "Bu cihazın lisansı bulunmamaktadır." });
    }
});

// 1. VERSİYON KONTROLÜ
app.get('/check-version', protectDownloads, async (req, res) => {
  try {
    const url = `https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO}/${BRANCH}/version.json`;
    const response = await axios.get(url, {
      headers: { 'Authorization': `token ${GITHUB_TOKEN}` }
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).send("Versiyon alınamadı.");
  }
});

// 2. İNDİRME ROTASI
app.get('/download-update', protectDownloads, async (req, res) => {
  try {
    const url = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/${BRANCH}/update.zip`; // Veya zipball
    
    const response = await axios({
      method: 'get',
      url: url,
      responseType: 'stream',
      headers: { 'Authorization': `token ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3+json' }
    });

    res.setHeader('Content-Disposition', 'attachment; filename=update.zip');
    response.data.pipe(res);
    
  } catch (error) {
    res.status(500).send("İndirme hatası.");
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Sunucu ${port} portunda çalışıyor.`);
});
