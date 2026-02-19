
/* =====================
   CONFIG
===================== */
let weeklyChartInstance = null;
const REFRESH_INTERVAL = 5000;
const DEFAULT_THUMBNAIL =
  "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d";


// func 
async function adminFetch(url, options = {}) {
  const token = localStorage.getItem("adminToken");

  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token,
      ...(options.headers || {})
    }
  });

  // 🔒 Kalau token invalid / expired
  if (res.status === 401) {
    alert("Session expired. Silakan login ulang.");
    localStorage.removeItem("adminToken");
    window.location.href = "/admin";
    return;
  }

  return res;
}

/* =====================
   LOGIN
===================== */
async function login() {
  const name = document.getElementById("name").value;
  const password = document.getElementById("password").value;
  const msg = document.getElementById("msg");
  const btn = document.getElementById("loginBtn");

  msg.textContent = "";

  if (!name || !password) {
    msg.textContent = "Harap isi nama dan password!";
    return;
  }

  btn.disabled = true;
  btn.innerHTML = "⏳ Memproses...";

  try {
    const res = await fetch("/admin/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ name, password })
    });

    const data = await res.json();

   if (data.success) {
   localStorage.setItem("adminToken", data.token);
   window.location.href = "/admin/dashboard";
} else {
  msg.textContent = data.error || "Login gagal";
  btn.disabled = false;
  btn.innerHTML = "Login";
}

  } catch {
    msg.textContent = "Server error";
    btn.disabled = false;
    btn.innerHTML = "Login";
  }
}

/* =====================
   LOAD USERS
===================== */
async function loadUsers() {
  try {
    const res = await adminFetch("/admin/users");
    if (!res.ok) throw new Error();
    return await res.json();
  } catch {
    return [];
  }
}

/* =====================
   DASHBOARD RENDER (ONCE)
===================== */
async function renderDashboard() {
  const dashboard = document.getElementById("dashboard");
  if (!dashboard) return;

  dashboard.innerHTML = "<h2>Loading...</h2>";

  let users = [];
  let winner = null;
  let closed = false;

  try {
    users = await loadUsers();
  } catch {}

  try {
    const winnerRes = await fetch("/winner");
    const winnerData = await winnerRes.json();
    winner = winnerData.winner;
  } catch {}

  try {
    const statusRes = await fetch("/status");
    const status = await statusRes.json();
    closed = status?.registrationclosed || false;
  } catch {}

  dashboard.innerHTML = `
  <div class="dashboard-content">

    <div class="dashboard-header">
      <h2>⚙️ Admin Dashboard</h2>
      <button class="logout-btn" onclick="logout()">Logout</button>
    </div>
     
     <div class="banner-section">
  <h3>📢 Atur Banner</h3>

  <input 
    type="text" 
    id="bannerImage" 
    placeholder="Masukkan link gambar banner..."
    style="width:100%;padding:8px;margin-top:8px"
  />

  <div style="margin-top:10px">
    <label>
      <input type="checkbox" id="bannerActive" />
      Aktifkan Banner
    </label>
  </div>

  <button onclick="saveBanner()" style="margin-top:10px">
    💾 Simpan Banner
  </button>

  <div id="bannerPreview" style="margin-top:15px"></div>
</div>

 
</div>
     
     
    <div class="stats-container">
  <div class="stat-box">
    <div class="icon">👥</div>
    <div class="number" id="totalUsers">${users.length}</div>
    <div class="label">Total Pendaftar</div>
  </div>
</div>

<div style="margin-top:30px; height:260px;">
  <h3>📊 Statistik 7 Hari Terakhir</h3>
  <canvas id="weeklyChart"></canvas>
</div>

    <div class="action-buttons">
      <button onclick="pickWinner()">🎉 Pilih Pemenang</button>
      <button onclick="resetSystem()">♻️ Reset Sistem</button>
      <button onclick="toggleRegistration()">
        ${closed ? "🔓 Buka Pendaftaran" : "🔒 Tutup Pendaftaran"}
      </button>
    </div>

    ${
      winner
        ? `
        <div class="winner-box">
          <h3>🏆 Pemenang</h3>
          <p><strong>Nama:</strong> ${winner.name}</p>
          <p><strong>Kode:</strong> ${winner.code}</p>
        </div>
      `
        : ""
    }

    <div class="users-section">
  <h3>📋 Daftar Peserta</h3>

  ${
    users.length === 0
      ? "<p>Belum ada peserta</p>"
      : `
        <div class="table-wrapper">
            <table class="users-table">
          <thead>
            <tr>
              <th>No</th>
              <th>Nama</th>
              <th>Kode</th>
            </tr>
          </thead>
          <tbody>
            ${users
              .map(
                (u, i) => `
                  <tr>
                    <td>${i + 1}</td>
                    <td>${u.name}</td>
                    <td><span class="code-badge">${u.code}</span></td>
                  </tr>
                `
              )
              .join("")}
          </tbody>
        </table>
       </div>
        `
  }
</div>

  </div>
  `;
  loadAdminBanner();
  loadWeeklyChart();
}

async function loadAdminBanner() {
  try {
    const res = await fetch('/banner');
    const data = await res.json();

    document.getElementById("bannerImage").value = data.image || "";
    document.getElementById("bannerActive").checked = data.active || false;

    if (data.image) {
      document.getElementById("bannerPreview").innerHTML = `
        <img src="${data.image}" style="max-width:100%;border-radius:8px" />
      `;
    }

  } catch {
    console.log("Gagal load banner");
  }
}

/* =====================
   AUTO REFRESH JUMLAH USER (TANPA RE-RENDER)
===================== */
setInterval(async () => {
  const totalEl = document.getElementById("totalUsers");
  if (!totalEl) return;

  const users = await loadUsers();
  totalEl.textContent = users.length;
}, REFRESH_INTERVAL);

// Auto refresh weekly chart
setInterval(async () => {
  const chartCanvas = document.getElementById("weeklyChart");
  if (!chartCanvas || !weeklyChartInstance) return;

  try {
    const res = await adminFetch("/admin/stats/weekly");
    const data = await res.json();

    const labels = Object.keys(data).reverse();
    const values = Object.values(data).reverse();

    weeklyChartInstance.data.labels = labels;
    weeklyChartInstance.data.datasets[0].data = values;
    weeklyChartInstance.update();
  } catch (err) {
    console.log("Gagal refresh chart", err);
  }
}, REFRESH_INTERVAL);

setInterval(async () => {
  const winnerSection = document.querySelector(".winner-box");
  if (!winnerSection) return;

  try {
    const res = await fetch("/winner");
    const data = await res.json();

    if (data.winner && !winnerSection.innerHTML.includes(data.winner.code)) {
      renderDashboard();
    }
  } catch {}
}, REFRESH_INTERVAL);

/* =====================
   PICK WINNER (ANIMATED)
===================== */
async function pickWinner() {
  let winnerSection = document.querySelector(".winner-box");

if (!winnerSection) {
  const usersSection = document.querySelector(".users-section");
  if (!usersSection) return;

  winnerSection = document.createElement("div");
  winnerSection.className = "winner-box";
  usersSection.before(winnerSection);
}
  if (!winnerSection) return;

  // Ambil semua user dulu untuk animasi rolling
  const users = await loadUsers();
  if (!users || users.length === 0) {
    winnerSection.innerHTML = "<p>Belum ada peserta</p>";
    return;
  }

  // Tampilkan animasi awal
  winnerSection.innerHTML = `
  <div style="text-align:center;padding:30px 0">
    <h3 style="margin-bottom:15px">🎲 Mengundi Pemenang...</h3>
    <div 
      id="rollingName" 
      style="
        font-size:36px;
        font-weight:bold;
        letter-spacing:1px;
        animation: pulse 0.6s infinite;
      "
    >
      ...
    </div>
  </div>
`;

  let index = 0;

  let speed = 60;
let rolling;

function startRolling() {
  rolling = setInterval(() => {
    const nameEl = document.getElementById("rollingName");
    if (!nameEl) return;

    nameEl.textContent = users[index % users.length].name;
    index++;
  }, speed);
}

startRolling();

// efek melambat
setTimeout(() => {
  clearInterval(rolling);
  speed = 150;
  startRolling();
}, 1500);

setTimeout(() => {
  clearInterval(rolling);
}, 2500);

  // Setelah 3 detik baru ambil winner asli dari backend
  setTimeout(async () => {
    clearInterval(rolling);

    const res = await adminFetch("/admin/pick", { method: "POST" });
    const data = await res.json();

    if (data.error) {
      winnerSection.innerHTML = `<p>${data.error}</p>`;
      return;
    }

    winnerSection.innerHTML = `
      <h3>🏆 PEMENANG GIVEAWAY</h3>
      <div style="font-size:34px;font-weight:bold;margin:15px 0">
        ${data.name}
      </div>
      <span class="code-badge">${data.code}</span>
      <p style="margin-top:10px">🎉 Giveaway Selesai</p>
    `;

    if (typeof confetti === "function") {
      confetti({
        particleCount: 180,
        spread: 100,
        origin: { y: 0.6 }
      });
    }

  }, 3000);
}
/* =====================
   BANNER
===================== */
async function saveBanner() {
  const image = document.getElementById('bannerImage').value;
  const active = document.getElementById('bannerActive').checked;

  await adminFetch('/admin/banner', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image, active })
  });

  document.getElementById("bannerPreview").innerHTML = image
    ? `<img src="${image}" style="max-width:100%;border-radius:8px" />`
    : "";

  alert("Banner berhasil disimpan!");
}

/* =====================
   REGISTRATION TOGGLE
===================== */
async function toggleRegistration() {
  await adminFetch("/admin/toggle-registration", { method: "POST" });
  renderDashboard();
}

/* =====================
   LOGOUT
===================== */
function logout() {
  localStorage.removeItem("adminToken");
  window.location.href = "/admin/login.html";
}

/*======================
         reset G.A
====================*/
async function resetSystem() {
  const confirmReset = confirm(
    "Yakin ingin mereset sistem?\nSemua data peserta & pemenang akan dihapus!"
  );

  if (!confirmReset) return;

  try {
    const res = await adminFetch("/admin/reset", {
      method: "POST"
    });

    const data = await res.json();

    if (data.success) {
      alert("✅ Sistem berhasil direset!");
      renderDashboard();
    } else {
      alert("Gagal reset sistem");
    }
  } catch {
    alert("Server error");
  }
}

async function loadWeeklyChart() {
  try {
    const res = await adminFetch("/admin/stats/weekly");
    const data = await res.json();

    const labels = Object.keys(data).reverse();
    const values = Object.values(data).reverse();

    const ctx = document.getElementById("weeklyChart");
    if (!ctx) return;

    if (weeklyChartInstance) {
      weeklyChartInstance.destroy();
    }

    const context = ctx.getContext("2d");
    const gradient = context.createLinearGradient(0, 0, 0, 200);
gradient.addColorStop(0, "rgba(54, 162, 235, 0.4)");
gradient.addColorStop(1, "rgba(54, 162, 235, 0)");

weeklyChartInstance = new Chart(ctx, {
  type: "line",
  data: {
    labels: labels,
    datasets: [{
      label: "Jumlah Pendaftar",
      data: values,
      borderColor: "#36A2EB",
      backgroundColor: gradient,
      tension: 0.4,
      pointRadius: 4,
      pointHoverRadius: 6,
      borderWidth: 3,
      fill: true
    }]
  },
  options: {
    responsive: true,
    plugins: {
      legend: {
        labels: {
          color: "#333",
          font: { size: 14 }
        }
      },
      tooltip: {
        backgroundColor: "#111",
        titleColor: "#fff",
        bodyColor: "#fff",
        padding: 10,
        cornerRadius: 8
      }
    },
    scales: {
      x: { grid: { display: false } },
      y: {
        beginAtZero: true,
        grid: { color: "rgba(0,0,0,0.05)" }
      }
    }
  }
}); // ← WAJIB ADA
  } catch (err) {
    console.log("Gagal load chart", err);
  }
}   // ← INI YANG KURANG
/* =====================
   INIT
===================== */
document.addEventListener("DOMContentLoaded", () => {

  console.log("Path:", window.location.pathname);

  // Kalau di login page
  if (window.location.pathname.includes("login")) {
    return;
  }

  // Kalau belum login
  if (!localStorage.getItem("adminToken")) {
    window.location.href = "/admin";
    return;
  }

  // Render dashboard
  renderDashboard();

});