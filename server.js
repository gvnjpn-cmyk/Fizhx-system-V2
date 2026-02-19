const jwt = require("jsonwebtoken");

const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const express = require("express");
const rateLimit = require("express-rate-limit");
const path = require("path");

const JWT_SECRET = process.env.JWT_SECRET || "super_secret_admin_key";


//verfy admin 
function verifyAdmin(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    if (decoded.role !== "admin") {
      return res.status(403).json({ error: "Forbidden" });
    }

    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

const app = express();
const PORT = process.env.PORT || 3000;


// middleware
app.use(express.json());
const registerLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 menit
  max: 1, // max 3 request per IP
  message: { error: "Terlalu banyak percobaan, coba lagi nanti." }
});

app.use(express.static(path.join(__dirname, "public")));

// utils
function generateVIPCode() {
  const part1 = Math.random().toString(36).substring(2,5).toUpperCase();
  const part2 = Math.random().toString(36).substring(2,5).toUpperCase();
  return `${part1}-${Math.floor(10 + Math.random() * 90)}${part2[0]}-VIP`;
}

// routes
app.get("/", (_, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});

app.post("/register", registerLimiter, async (req, res) => {
  const { name, deviceId } = req.body;

  if (!name || !deviceId) {
    return res.json({ error: "Data tidak lengkap" });
  }

  const { data: status } = await supabase
    .from("status")
    .select("*")
    .maybeSingle();

  if (status && status.registrationclosed) {
    return res.json({ error: "Pendaftaran sedang ditutup" });
  }

  const code = generateVIPCode();

  const { error } = await supabase
    .from("users")
    .insert([
      {
        name,
        code,
        deviceid: deviceId,
        time: Date.now()
      }
    ]);

  if (error) {
    return res.json({ error: "Nama atau perangkat sudah terdaftar" });
  }

  res.json({ name, code, deviceId });
});

// =====================
// ADMIN - GET ALL USERS
// =====================
app.get("/admin/users", verifyAdmin, async (_, res) => {
  const { data } = await supabase
    .from("users")
    .select("*")
    .order("time", { ascending: true });

  res.json(data || []);
});

// admin pages
app.get("/admin", (_, res) => {
  res.redirect("/admin/login.html");
});

app.get("/admin/dashboard", (_, res) => {
  res.redirect("/admin/dashboard.html");
});

// admin login (simple)
app.post("/admin/login", async (req, res) => {
  const { name, password } = req.body;

  if (name === "admin" && password === "admin123") {

    const token = jwt.sign(
      { role: "admin" },
      JWT_SECRET,
      { expiresIn: "2h" }
    );

    return res.json({ success: true, token });
  }

  res.json({ success: false, error: "Login gagal" });
});
// pick winner
app.post("/admin/pick", verifyAdmin, async (_, res) => {

  const { data: existingWinner } = await supabase
    .from("winner")
    .select("*")
    .maybeSingle();

  if (existingWinner && existingWinner.code) {
    return res.json({ error: "Pemenang sudah dipilih" });
  }

  const { data: users } = await supabase
    .from("users")
    .select("*");

  if (!users || users.length === 0) {
    return res.json({ error: "Belum ada peserta" });
  }

  const winner = users[Math.floor(Math.random() * users.length)];

  await supabase.from("winner").insert([
    {
      name: winner.name,
      code: winner.code
    }
  ]);

  await supabase
    .from("status")
    .update({ registrationclosed: true });

  res.json(winner);
});

// =====================
// ADMIN RESET SYSTEM
// =====================
app.post("/admin/reset", verifyAdmin, async (_, res) => {

  await supabase.from("users").delete().not("id", "is", null);
  
 await supabase.from("winner").delete().not("id", "is", null);

  await supabase
    .from("status")
    .update({ registrationclosed: false });

  res.json({ success: true });
});


// =====================
// GET WINNER (UNTUK USER)
// =====================
app.get("/winner", async (_, res) => {
  const { data } = await supabase
    .from("winner")
    .select("*")
    .maybeSingle();

  res.json({ winner: data || null });
});

// =====================
// GET STATUS
// =====================
app.get("/status", async (_, res) => {
  const { data } = await supabase
    .from("status")
    .select("*")
    .maybeSingle();

  res.json(data || { registrationclosed: false });
});

// =====================
// ADMIN TOGGLE STATUS
// =====================
app.post("/admin/toggle-registration", verifyAdmin, async (_, res) => {

  const { data } = await supabase
    .from("status")
    .select("*")
    .maybeSingle();

  const newValue = data ? !data.registrationclosed : true;

  await supabase
    .from("status")
    .update({ registrationclosed: newValue });

  res.json({ registrationclosed: newValue });
});

// =====================
// GET BANNER
// =====================
app.get("/banner", async (_, res) => {
  const { data } = await supabase
    .from("banner")
    .select("*")
    .maybeSingle();

  res.json(data || { image: "", active: false });
});

//statistik hari ini
app.get("/admin/stats/today", verifyAdmin, async (_, res) => {
  const todayStart = new Date();
  todayStart.setHours(0,0,0,0);

  const { count } = await supabase
    .from("users")
    .select("*", { count: "exact", head: true })
    .gte("time", todayStart.getTime());

  res.json({ totalToday: count || 0 });
});

//statistik terahir 
app.get("/admin/stats/latest", verifyAdmin, async (_, res) => {
  const { data } = await supabase
    .from("users")
    .select("*")
    .order("time", { ascending: false })
    .limit(5);

  res.json(data || []);
});

// =====================
// STATISTIK 7 HARI TERAKHIR
// =====================
app.get("/admin/stats/weekly", verifyAdmin, async (_, res) => {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  sevenDaysAgo.setHours(0,0,0,0);

  const { data } = await supabase
    .from("users")
    .select("time")
    .gte("time", sevenDaysAgo.getTime());

  const result = {};

  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  .toISOString()
  .slice(0,10);
    result[key] = 0;
  }

  if (data) {
    data.forEach(u => {
      const date = new Date(u.time - new Date().getTimezoneOffset() * 60000)
  .toISOString()
  .slice(0,10);
      if (result[date] !== undefined) {
        result[date]++;
      }
    });
  }

  res.json(result);
});


// =====================
// UPDATE BANNER (ADMIN)
// =====================
app.post("/admin/banner", verifyAdmin, async (req, res) => {
  const { image, active } = req.body;

  await supabase
    .from("banner")
    .update({
      image: image || "",
      active: !!active
    })
    .not("id", "is", null);

  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log("🚀 Server running on port " + PORT);
});