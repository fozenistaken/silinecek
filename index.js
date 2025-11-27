const express = require('express');
const axios = require('axios');
const app = express();

// --- AYARLAR (BURAYI DÜZENLE) ---
const GITHUB_USER = "fozenistaken"; 
const GITHUB_REPO = "nxpbot"; // Örn: nexup-bot-v14
const BRANCH = "main"; // Genelde main veya master olur
const CLIENT_SECRET_KEY = process.env.CLIENT_SECRET_KEY;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

// 1. Versiyon Kontrol Rotası
app.get('/check-version', async (req, res) => {
  try {
    // Private repo olduğu için Authorization header ekliyoruz
    const url = `https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO}/${BRANCH}/version.json`;
    
    const response = await axios.get(url, {
      headers: { 
        'Authorization': `token ${TOKEN}`,
        'Accept': 'application/vnd.github.v3.raw'
      }
    });
    
    res.json(response.data);
  } catch (error) {
    console.error("Versiyon hatası:", error.message);
    res.status(500).send("Versiyon kontrol edilemedi.");
  }
});

// 2. İndirme Rotası
app.get("/download-update", async (req, res) => {
  // 1. HEADER KONTROLÜ
  // Launcher'ın gönderdiği gizli anahtarı al
  const clientKey = req.headers['x-client-key']; 

  // Anahtar eşleşiyor mu kontrol et
  if (!clientKey || clientKey !== CLIENT_SECRET_KEY) {
    console.warn("Unauthorized access attempt on download.");
    return res.status(403).send("Erişim Reddedildi: Geçersiz veya Eksik Anahtar.");
  }
  
  // 2. Eğer anahtar doğruysa, indirme işlemini başlat
  try {
    const url = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/zipball/${BRANCH}`;
    
    const response = await axios({
      method: 'get',
      url: url,
      responseType: 'stream',
      headers: { Authorization: `token ${GITHUB_TOKEN}` }
    });

    res.setHeader('Content-Disposition', 'attachment; filename=update.zip');
    response.data.pipe(res);
    
  } catch (error) {
    res.status(500).send("İndirme başarısız.");
  }
});

    // Dosyayı Launcher'a gönder
    res.setHeader('Content-Disposition', 'attachment; filename=update.zip');
    response.data.pipe(res);
    
  } catch (error) {
    console.error("İndirme hatası:", error.message);
    res.status(500).send("İndirme başarısız.");
  }
});

// Sunucuyu Başlat
const port = 3000;
app.listen(port, () => {
  console.log(`Proxy Sunucusu Çalışıyor! Port: ${port}`);
});
