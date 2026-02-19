const app = document.getElementById("app");
const saved = localStorage.getItem("giveawayUser");

// Thumbnail default
const DEFAULT_THUMBNAIL =
  "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=800&q=80";

let currentThumbnail = DEFAULT_THUMBNAIL;
let winnerInterval = null;
let lastWinnerCode = null;
/* =====================
   ANIMATION UTILITIES
===================== */
function addAnimation(element, animationClass, duration = 500) {
  element.classList.add(animationClass);
  setTimeout(() => {
    element.classList.remove(animationClass);
  }, duration);
}

function setButtonLoading(button, isLoading) {
  if (isLoading) {
    button.classList.add('loading');
    button.disabled = true;
    button.innerHTML = 'Memproses...';
  } else {
    button.classList.remove('loading');
    button.disabled = false;
    button.innerHTML = '🎯 DAPATKAN KODE';
  }
}

/* =====================
   HALAMAN USER (FORM)
===================== */
//banner
async function loadBannerFromServer() {
  try {
    const res = await fetch("/banner");
    const data = await res.json();

    if (data.active && data.image) {
      currentThumbnail = data.image;
    } else {
      currentThumbnail = DEFAULT_THUMBNAIL;
    }
  } catch {
    currentThumbnail = DEFAULT_THUMBNAIL;
  }
}


function showUserView() {
  if (winnerInterval) {
    clearInterval(winnerInterval);
    winnerInterval = null;
  }
  app.innerHTML = `
    <div class="thumbnail-container">
      <img src="${currentThumbnail}" class="thumbnail-img">
      <div class="thumbnail-overlay">
        <div>
          <h3 class="thumbnail-title">🎁 GIVEAWAY EKSKLUSIF</h3>
          <small>Hadiah Menanti Anda!</small>
        </div>
        <span class="thumbnail-badge">HOT</span>
      </div>
    </div>

    <h2>Dapatkan Kode Giveaway</h2>
    <p>Isi nama untuk mendapatkan kode unik</p>

    <div class="input-group">
      <label>📝 Nama Lengkap</label>
      <input id="name" type="text" placeholder="Masukkan nama lengkap">
    </div>

    <button onclick="registerUser()">🎯 DAPATKAN KODE</button>
    <button class="secondary" onclick="showStatusOnly()">
  👀 Lihat Status Giveaway
</button>

    <div class="instructions">
      <p><strong>Syarat & Ketentuan:</strong></p>
      <p>• Satu orang hanya boleh 1 kode</p>
      <p>• Kode bersifat rahasia</p>
      <p>• Keputusan admin bersifat mutlak</p>
    </div>
  `;
}



function showStatusOnly() {
  app.innerHTML = `
    <h2>📊 Status Giveaway</h2>

    <div class="status-box">
      <p>👥 Peserta: <span id="counter">-</span></p>
      <p>Status: <strong id="statusText">Memuat...</strong></p>
    </div>

    <div class="status-box" id="winnerBox">
      <p>🏆 Memuat pemenang...</p>
    </div>

    <button onclick="showUserView()">⬅️ Kembali</button>
  `;

  checkStatus();
  checkWinner();

   if (!winnerInterval) {
  winnerInterval = setInterval(() => {
    checkWinner();
    checkStatus();
  }, 5000);
 }
}
/* =====================
   REGISTRASI USER
===================== */
async function registerUser() {
  let status;
try {
  const statusRes = await fetch("/status");
  status = await statusRes.json();
} catch {
  alert("Server tidak merespon");
  return;
}

if (status.registrationClosed) {
  alert("❌ Pendaftaran sedang ditutup oleh admin");
  return;
}
  const nameInput = document.getElementById("name");
  if (!nameInput) return;

  const name = nameInput.value.trim();
  if (!name) {
    addAnimation(nameInput, "shake");
    return;
  }

  const button = document.querySelector("button:not(.secondary)");
  setButtonLoading(button, true);

  const deviceId = getDeviceId();

  try {
    const res = await fetch("/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, deviceId })
    });

    const data = await res.json();

    if (data.error) {
      alert(data.error);
      setButtonLoading(button, false);
      return;
    }

    // SIMPAN USER LOGIN (BUKAN DATABASE)
    localStorage.setItem("giveawayUser", JSON.stringify(data));
    showUserDashboard(data);

  } catch (err) {
    alert("Server error");
  } finally {
    setButtonLoading(button, false);
  }
}

function getDeviceId() {
  let id = localStorage.getItem("giveawayDeviceId");
  if (!id) {
    id = "DEV-" + Math.random().toString(36).slice(2, 11);
    localStorage.setItem("giveawayDeviceId", id);
  }
  return id;
}

/* =====================
   DASHBOARD USER
===================== */
function showUserDashboard(user) {
  app.innerHTML = `
    <div class="thumbnail-container">
      <img src="${currentThumbnail}" class="thumbnail-img">
      <div class="thumbnail-overlay">
        <div>
          <h3 class="thumbnail-title">KODE ANDA SIAP!</h3>
          <small>Selamat, ${user.name}</small>
        </div>
        <span class="thumbnail-badge">ACTIVE</span>
      </div>
    </div>

    <div class="greeting">
      <h2>🎉 Selamat Bergabung!</h2>
    </div>

    <p>Kode giveaway Anda:</p>

    <div class="code-container">
      <h1>${user.code}</h1>
      <small>Simpan kode ini dengan aman</small>
    </div>

    <div class="instructions">
      <p><strong>Cara Klaim:</strong></p>
      <p>Lihat pengumuman admin, jika kode kamu terpilih segera hubungi admin.</p>
    </div>

    <button id="shareBtn" onclick="shareCode()">📤 Bagikan Kode</button>
    <button class="secondary" onclick="logoutUser()">🔄 Ganti Akun</button>
  `;

  setTimeout(() => {
    const codeContainer = document.querySelector('.code-container');
    if (codeContainer) {
      addAnimation(codeContainer, 'success-message');
    }
  }, 300);
  
  if (winnerInterval) {
  clearInterval(winnerInterval);
  winnerInterval = null;
  }
}
/* =====================
   UTILITAS
===================== */
function shareCode() {
  const user = JSON.parse(localStorage.getItem("giveawayUser"));
  if (!user) return;

  const text = `Saya dapat kode giveaway: ${user.code}`;
  navigator.clipboard.writeText(text).then(() => {
    const button = document.getElementById("shareBtn");
    const originalText = button.innerHTML;
    
    button.innerHTML = '✓ Tersalin!';
    button.style.background = 'linear-gradient(135deg, #27ae60, #2ecc71)';
    
    setTimeout(() => {
      button.innerHTML = originalText;
      button.style.background = '';
    }, 2000);
  });
}

function logoutUser() {
  if (confirm("Ganti akun?")) {
    app.style.opacity = '0.7';
    app.style.transform = 'scale(0.95)';
    
    setTimeout(() => {
      localStorage.removeItem("giveawayUser");
      app.style.opacity = '';
      app.style.transform = '';
      showUserView();
    }, 300);
  }
}

async function checkStatus() {
  const counter = document.getElementById("counter");
  const statusText = document.getElementById("statusText");

  try {
    const usersRes = await fetch("/admin/users?t=" + Date.now());

    const users = await usersRes.json();

    const statusRes = await fetch("/status?t=" + Date.now());
    const status = await statusRes.json();

    if (counter) counter.textContent = users.length;

    if (statusText) {
      statusText.textContent = status.registrationClosed
        ? "❌ Pendaftaran Ditutup"
        : "✅ Masih Dibuka";
    }
  } catch {
    if (statusText) statusText.textContent = "⚠️ Gagal memuat status";
  }
}

async function checkWinner() {
  try {
    const res = await fetch("/winner?t=" + Date.now());
    const data = await res.json();

    const winnerBox = document.getElementById("winnerBox");
    if (!winnerBox) return;

    // BELUM ADA PEMENANG
    if (!data.winner || !data.winner.code) {
      if (lastWinnerCode !== null) {
        lastWinnerCode = null;
        winnerBox.innerHTML = `<p>🏆 Pemenang belum diumumkan</p>`;
      }
      return;
    }

    // Kalau sama, jangan animasi ulang
    if (data.winner.code === lastWinnerCode) return;

    lastWinnerCode = data.winner.code;

    const name = data.winner.name;
    const code = data.winner.code;
    if (!name || !code) return;
    
    // Animasi awal
    winnerBox.innerHTML = `
      <h3>🎲 Mengundi...</h3>
      <div id="rollingText" style="font-size:24px;margin-top:12px">...</div>
    `;

    const fakeTexts = [
      "Mengacak peserta...",
      "Menentukan pemenang...",
      "Hampir selesai...",
      name
    ];

    let i = 0;

    const rolling = setInterval(() => {
      const el = document.getElementById("rollingText");
      if (!el) return;
      el.textContent = fakeTexts[i % fakeTexts.length];
      i++;
    }, 200);

    setTimeout(() => {
      clearInterval(rolling);

      winnerBox.innerHTML = `
        <h3>🏆 PEMENANG GIVEAWAY</h3>
        <div style="font-size:28px;font-weight:bold;margin:10px 0">
          ${name}
        </div>
        <div class="code-container">
          <h1>${code}</h1>
        </div>
        <p>🎉 Selamat kepada pemenang!</p>
      `;

      if (typeof confetti === "function") {
        confetti({
          particleCount: 150,
          spread: 90,
          origin: { y: 0.6 }
        });
      }

    }, 3000);

  } catch (e) {
    console.log("Gagal cek pemenang");
  }
}
/* =====================
   INIT
===================== */
document.addEventListener("DOMContentLoaded", async () => {

  await loadBannerFromServer();
  app.style.opacity = '0';
  app.style.transform = 'translateY(20px)';
  
  setTimeout(() => {
    app.style.transition = 'all 0.6s ease-out';
    app.style.opacity = '1';
    app.style.transform = 'translateY(0)';
  }, 100);

  if (saved) {
    try {
      const user = JSON.parse(saved);
      if (user && user.code && user.deviceId) {
        showUserDashboard(user);
      } else {
        throw new Error();
      }
    } catch {
      localStorage.removeItem("giveawayUser");
      showUserView();
    }
  } else {
    showUserView();
  }
});
