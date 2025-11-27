const express = require('express');
const axios = require('axios');
const app = express();

// --- AYARLAR VE GİZLİ ANAHTARLAR (RENDER SECRETS'TEN ÇEKİLİR) ---
// Render'da tanımladığın değişkenleri kullanır.
const GITHUB_TOKEN = process.env.GITHUB_TOKEN; 
const CLIENT_SECRET_KEY = process.env.CLIENT_SECRET_KEY;
const GITHUB_USER = "fozenistaken"; // Kendi GitHub kullanıcı adın
const GITHUB_REPO = "nxpbot"; // Kendi GitHub depo adın
const BRANCH = "main"; // Ana dal

// --- GÜVENLİK KONTROLÜ (MIDDLEWARE) ---
// Sadece gizli anahtarı gönderenlerin indirme yapmasına izin verir.
const checkDownloadKey = (req, res, next) => {
    const clientKey = req.headers['x-client-key']; 
    if (!clientKey || clientKey !== CLIENT_SECRET_KEY) {
        console.warn("🚫 Unauthorized download attempt.");
        return res.status(403).send("Erişim Reddedildi: Geçersiz Anahtar.");
    }
    next();
};

// --- ROTLAR ---

// Varsayılan Root Rotası (Tarayıcıda / açılınca hata vermesin diye)
app.get('/', (req, res) => {
    res.send("Nexup Update Proxy Sunucusu Aktif! 🟢");
});

// 1. VERSİYON KONTROLÜ
// Launcher buraya istek atar. (Token gereklidir)
app.get('/check-version', async (req, res) => {
  try {
    const url = `https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO}/${BRANCH}/version.json`;
    
    const response = await axios.get(url, {
      headers: { 
        // Token'ı başlıkta GitHub'a gönder
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3.raw'
      }
    });
    
    // GitHub'dan gelen versiyon dosyasını direkt Launcher'a yolla
    res.json(response.data);
  } catch (error) {
    console.error("Versiyon kontrol hatası:", error.message);
    res.status(500).send("Versiyon kontrol edilemedi veya GitHub'a erişilemiyor.");
  }
});

// 2. İNDİRME ROTASI (KONTROLLÜ)
// Launcher'ın asıl zip dosyasını indirdiği rota. (Token + Gizli Anahtar gerekir)
app.get('/download-update', checkDownloadKey, async (req, res) => {
  // ... (Güvenlik kontrolü) ...
  try {
    const url = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/zipball/${BRANCH}`;
    console.log("talebi aldım")
    const response = await axios({
      method: 'get',
      url: url,
      responseType: 'stream',
      // GitHub'a Token'ı gönderiyoruz
      headers: { 
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    // Axios varsayılan olarak 4xx veya 5xx statü kodlarında hata fırlatır.
    // Başarılıysa Launcher'a yollarız.
    res.setHeader('Content-Disposition', 'attachment; filename=update.zip');
    response.data.pipe(res);
    
  } catch (error) {
    // Hata durumunda hatanın sebebini konsola ve kullanıcıya gönderelim.
    const statusCode = error.response ? error.response.status : 500;
    console.error(`İndirme başarısız oldu. GitHub Status: ${statusCode}`);
    
    if (statusCode === 404) {
        return res.status(404).send("Dosya veya GitHub deposu bulunamadı.");
    }
    if (statusCode === 401 || statusCode === 403) {
        return res.status(403).send("ERİŞİM YETKİSİ YOK. GITHUB_TOKEN'I KONTROL EDİN.");
    }
    res.status(500).send("İndirme sırasında sunucu hatası oluştu.");
  }
});

// Sunucuyu Başlat
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Proxy Sunucusu Çalışıyor! Port: ${port}`);
});
