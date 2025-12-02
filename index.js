const express = require('express');
const axios = require('axios');
const app = express();

// --- AYARLAR ---
const GITHUB_TOKEN = process.env.GITHUB_TOKEN; 
const CLIENT_SECRET_KEY = process.env.CLIENT_SECRET_KEY;
const HWID_LIST_URL = process.env.HWID_LIST_URL; // GitHub Raw URL (allowlist.txt)

const GITHUB_USER = "fozenistaken"; 
const GITHUB_REPO = "nxpbot"; 
const BRANCH = "main"; 

// JSON Body Parser (Post istekleri için gerekebilir)
app.use(express.json());

// --- YARDIMCI FONKSİYON: HWID LİSTESİNİ ÇEK ---
async function getAllowedHWIDs() {
    try {
        const response = await axios.get(HWID_LIST_URL);
        return response.data; // Dosya içeriği (String)
    } catch (error) {
        console.error("HWID Listesi Çekilemedi:", error.message);
        return ""; // Hata olursa boş döndür
    }
}

// --- MIDDLEWARE: İNDİRME GÜVENLİĞİ ---
// Bu sadece dosya indirme ve versiyon kontrolü rotalarında kullanılır.
const protectDownloads = async (req, res, next) => {
    const clientKey = req.headers['x-client-key'];
    const clientHWID = req.headers['x-hwid'];

    // 1. Secret Key Kontrolü
    if (!clientKey || clientKey !== CLIENT_SECRET_KEY) {
        return res.status(403).send("Geçersiz Anahtar.");
    }

    // 2. HWID Kontrolü
    if (!clientHWID) return res.status(400).send("HWID Eksik.");

    const allowedList = await getAllowedHWIDs();
    if (!allowedList.includes(clientHWID)) {
        return res.status(403).send("Lisanssız Cihaz.");
    }

    next();
};

// --- ROTALAR ---

app.get('/', (req, res) => {
    res.send("Nexup Update & Lisans Sunucusu Aktif! 🟢");
});

// 🔥 YENİ: LİSANS SORGULAMA ROTASI
// Launcher açılışta buraya istek atar.
// Cevap olarak { success: true/false } döner.
app.post('/verify-license', async (req, res) => {
    const clientKey = req.headers['x-client-key'];
    const clientHWID = req.headers['x-hwid'];

    // 1. Anahtar Kontrolü
    if (!clientKey || clientKey !== CLIENT_SECRET_KEY) {
        return res.status(200).json({ 
            success: false, 
            message: "Gizli anahtar hatalı!" 
        });
    }

    // 2. HWID Kontrolü
    if (!clientHWID) {
        return res.status(200).json({ 
            success: false, 
            message: "HWID bilgisi gönderilmedi." 
        });
    }

    // 3. Listeden Kontrol Et
    const allowedList = await getAllowedHWIDs();
    
    if (allowedList.includes(clientHWID)) {
        console.log(`✅ Lisans Doğrulandı: ${clientHWID}`);
        return res.status(200).json({ 
            success: true, 
            message: "Lisans Aktif." 
        });
    } else {
        console.warn(`⛔ Lisanssız Giriş Denemesi: ${clientHWID}`);
        return res.status(200).json({ 
            success: false, 
            message: "Bu cihazın lisansı bulunmamaktadır." 
        });
    }
});

// 1. VERSİYON KONTROLÜ (Korumalı)
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

// 2. İNDİRME ROTASI (Korumalı)
app.get('/download-update', protectDownloads, async (req, res) => {
  try {
    const url = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/${BRANCH}/update.zip`; // Veya zipball url'si
    // NOT: Eğer zipball kullanıyorsan url yapısı farklıdır, önceki koddaki gibi kalabilir.
    
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
