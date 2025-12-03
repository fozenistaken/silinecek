const express = require('express');
const axios = require('axios');
const app = express();

// --- AYARLAR (RENDER ENV'DEN ÇEKİLİR) ---
const GITHUB_TOKEN = process.env.GITHUB_TOKEN; 
const CLIENT_SECRET_KEY = process.env.CLIENT_SECRET_KEY;
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

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

// 2. İNDİRME ROTASI (DÜZELTİLDİ)
app.get('/download-update', protectDownloads, async (req, res) => {
  try {
    // HATALI OLAN: .../${BRANCH}/update.zip
    // DOĞRU OLAN: .../zipball/${BRANCH}
    const url = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/zipball/${BRANCH}`;
    
    console.log(`İndirme başlatılıyor: ${url}`); // Log ekleyelim ki URL'i görelim

    const response = await axios({
      method: 'get',
      url: url,
      responseType: 'stream',
      headers: { 
        'Authorization': `token ${GITHUB_TOKEN}`, 
        'Accept': 'application/vnd.github+json' // Güncel API header'ı
      }
    });

    // İndirilen dosyanın adını belirle
    res.setHeader('Content-Disposition', 'attachment; filename=update.zip');
    res.setHeader('Content-Type', 'application/zip');
    
    // Akışı (Stream) istemciye yönlendir
    response.data.pipe(res);
    
  } catch (error) {
    // Hata detayını konsola yazdıralım (Debug için önemli)
    if (error.response) {
        console.error("GitHub Hatası:", error.response.status, error.response.statusText);
    } else {
        console.error("İndirme Hatası:", error.message);
    }
    
    res.status(500).send("İndirme sırasında sunucu hatası oluştu.");
  }
});
app.post('/log', async (req, res) => {
    const clientKey = req.headers['x-client-key'];
    
    // 1. Güvenlik Kontrolü (Sadece senin launcher'ın log atabilsin)
    if (!clientKey || clientKey !== CLIENT_SECRET_KEY) {
        return res.status(403).send("Yetkisiz Erişim.");
    }

    // 2. Launcher'dan gelen verileri al
    const { username, hostname, platform, hwid, type, reason, ip } = req.body;

    // 3. Embed Rengi ve Başlığını Sunucuda Belirle
    let color = 3447003; // Mavi
    let title = "Launcher İşlemi";

    if (type === 'lisansPozitif') {
        color = 5763719; // Yeşil
        title = "✅ Başarılı Giriş / Lisans Onaylandı";
    } else if (type === 'LisansNegatif') {
        color = 15548997; // Kırmızı
        title = "⛔ Yetkisiz Giriş / Lisans Hatası";
    } else if (type === 'start') {
        color = 16776960; // Sarı
        title = "🚀 Launcher Başlatıldı";
    }

    // 4. Discord'a Gönderilecek Veriyi Hazırla
    const embedData = {
        username: "Nexup Security",
        avatar_url: "https://i.imgur.com/AfFp7pu.png",
        embeds: [{
            title: title,
            color: color,
            fields: [
                { name: "👤 Kullanıcı", value: `\`${username}\` @ \`${hostname}\``, inline: true },
                { name: "💻 İşletim Sistemi", value: `\`${platform}\``, inline: true },
                { name: "🌐 IP Adresi", value: `\`${ip || req.ip}\``, inline: false },
                { name: "🔑 HWID", value: `\`${hwid}\``, inline: false },
                { name: "📝 Durum/Mesaj", value: reason ? `\`${reason}\`` : "İşlem Tamamlandı", inline: false }
            ],
            footer: { text: "Nexup Proxy Logger System" },
            timestamp: new Date().toISOString()
        }]
    };

    try {
        if (DISCORD_WEBHOOK_URL) {
            await axios.post(DISCORD_WEBHOOK_URL, embedData);
            return res.json({ success: true });
        } else {
            console.warn("Webhook URL tanımlanmamış!");
            console.log("webhook hata");
            return res.status(500).json({ success: false, message: "Webhook ayarlı değil." });
        }
    } catch (error) {
        console.error("Discord Log Hatası:", error.message);
        console.log("webhook hata 2");
        return res.status(500).json({ success: false, error: error.message });
    }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Sunucu ${port} portunda çalışıyor.`);
});
