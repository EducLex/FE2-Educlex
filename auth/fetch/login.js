 // ===============================
// GLOBAL CONFIG (biar bisa dipakai semua blok)
// ===============================
const apiBase = "http://localhost:8080";

const SEND_OTP_ENDPOINT = "/auth/send-otp";
const VERIFY_EMAIL_ENDPOINT = "/auth/verify-email";
const RESET_PASSWORD_ENDPOINT = "/jaksa/auth/reset-password-jaksa";
const LOGIN_ENDPOINT = "/auth/login";

// Fallback showAlert jika belum ada
if (typeof showAlert !== "function") {
  function showAlert(message, type = "info") {
    const container = document.getElementById("alert-container");
    if (container) {
      const icon = { success: "✅", error: "❌", warning: "⚠️", info: "ℹ️" }[type] || "ℹ️";
      container.innerHTML = `<div class="alert ${type}">${icon} ${message}</div>`;
      setTimeout(() => (container.innerHTML = ""), 4000);
    } else {
      alert(message);
    }
  }
}

// ===============================
// ROUTE GUARD
// HANYA tanya.html yang wajib login
// halaman lain tetap publik
// ===============================
const PROTECTED_PATHS = new Set(["/user/tanyajaksa/tanya.html"]);

// ==================================================
// Base64URL decode helper (FIX JWT decoding)
// ==================================================
function base64UrlDecode(str) {
  try {
    if (!str) return null;
    let s = String(str).replace(/-/g, "+").replace(/_/g, "/");
    const pad = s.length % 4;
    if (pad) s += "=".repeat(4 - pad);
    return atob(s);
  } catch (_) {
    return null;
  }
}

function decodeJwtPayload(token) {
  try {
    const parts = String(token || "").split(".");
    if (parts.length !== 3) return null;

    const decoded = base64UrlDecode(parts[1]);
    if (!decoded) return null;

    return JSON.parse(decoded);
  } catch (_) {
    return null;
  }
}

// ==================================================
// TOKEN HELPERS
// - Guard: boleh pakai session/local (biar admin/jaksa tetap dianggap login)
// - User token sengaja tidak disimpan di localStorage (lihat saveAuth)
// ==================================================
function getAnyToken() {
  const t = sessionStorage.getItem("token") || localStorage.getItem("token");
  if (!t) return null;
  const s = String(t).trim();
  if (!s || s === "null" || s === "undefined") return null;
  return s;
}

function hasValidLogin() {
  const token = getAnyToken();
  if (!token) return false;

  const payload = decodeJwtPayload(token);
  if (!payload || payload.exp == null) return false;

  const exp = Number(payload.exp);
  if (!Number.isFinite(exp)) return false;

  const ok = Date.now() < exp * 1000;
  if (!ok) {
    try {
      sessionStorage.removeItem("token");
      sessionStorage.removeItem("role");
      sessionStorage.removeItem("displayName");

      localStorage.removeItem("token");
      localStorage.removeItem("role");
      localStorage.removeItem("displayName");
    } catch (_) {}
  }
  return ok;
}

function isLoginPage() {
  return window.location.pathname.includes("/auth/login.html");
}

function guardProtectedRoutes() {
  // cuma lock tanya.html
  if (!PROTECTED_PATHS.has(window.location.pathname)) return;
  if (isLoginPage()) return;

  if (!hasValidLogin()) {
    const redirect = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `/auth/login.html?redirect=${redirect}`;
  }
}

// ==================================================
// Extract Role + Display Name
// ==================================================
function extractRoleFromResponse(data, token) {
  let role =
    data?.role ||
    data?.user?.role ||
    data?.data?.role ||
    (Array.isArray(data?.roles) ? data.roles[0] : null);

  if (!role && token) {
    const payload = decodeJwtPayload(token);
    role = payload?.role || payload?.roles?.[0] || payload?.authorities?.[0] || null;
  }
  return role || null;
}

function extractDisplayName(data, token) {
  const name =
    data?.name ||
    data?.nama ||
    data?.fullname ||
    data?.username ||
    data?.user?.name ||
    data?.user?.nama ||
    data?.user?.fullname ||
    data?.user?.username ||
    data?.data?.name ||
    data?.data?.nama ||
    data?.data?.fullname ||
    data?.data?.username ||
    null;

  if (name) return String(name);

  const payload = token ? decodeJwtPayload(token) : null;
  const fromJwt =
    payload?.name ||
    payload?.nama ||
    payload?.fullname ||
    payload?.username ||
    payload?.email ||
    null;

  return fromJwt ? String(fromJwt) : null;
}

// ==================================================
// NORMALIZE ROLE
// ==================================================
function normalizeRole(role) {
  if (!role) return null;
  const r = String(role).toLowerCase().trim();
  if (r === "admin") return "admin";
  if (r === "jaksa" || r === "prosecutor") return "jaksa";
  return "user";
}

// ==================================================
// Save auth:
// - sessionStorage ALWAYS: token, role, displayName
// - localStorage:
//   - admin/jaksa: token+role+displayName (biar dashboard tetap jalan)
//   - user: SIMPAN displayName SAJA (navbar semua halaman bisa tampil Ayu), token/role local dibersihin
// ==================================================
function saveAuth(token, role, displayName) {
  const nr = normalizeRole(role);

  try {
    if (token) sessionStorage.setItem("token", token);
    if (nr) sessionStorage.setItem("role", nr);
    if (displayName) sessionStorage.setItem("displayName", displayName);
  } catch (_) {}

  try {
    if (nr === "admin" || nr === "jaksa") {
      if (token) localStorage.setItem("token", token);
      if (nr) localStorage.setItem("role", nr);
      if (displayName) localStorage.setItem("displayName", displayName);
    } else {
      // user: jangan simpan token di localStorage
      localStorage.removeItem("token");
      localStorage.removeItem("role");
      if (displayName) localStorage.setItem("displayName", displayName);
    }
  } catch (_) {}
}

// ==================================================
// Navbar label
// - sessionStorage dulu, fallback localStorage
// ==================================================
function getDisplayNameAny() {
  const s = (sessionStorage.getItem("displayName") || "").trim();
  if (s) return s;
  const l = (localStorage.getItem("displayName") || "").trim();
  return l || "";
}

function applyAkunLabel() {
  const btn = document.querySelector(".dropbtn");
  if (!btn) return;

  const name = getDisplayNameAny();
  btn.textContent = name ? `👤 ${name} ▾` : "👤 Akun ▾";
}

// ===============================
// Helpers redirect
// ===============================
function safeRedirectTarget(raw) {
  if (!raw) return null;
  if (raw.startsWith("/")) return raw;
  return null;
}

function getRedirectTargetFromUrlOrSession() {
  try {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = safeRedirectTarget(params.get("redirect"));
    if (fromQuery) return fromQuery;

    const fromSession = safeRedirectTarget(sessionStorage.getItem("redirectAfterLogin"));
    if (fromSession) return fromSession;
  } catch (_) {}
  return null;
}

function clearRedirectSession() {
  try {
    sessionStorage.removeItem("redirectAfterLogin");
  } catch (_) {}
}

// ✅ sesuai request:
// - admin -> dashboard admin
// - jaksa -> dashboard jaksa
// - user -> tanya.html (default)
function getRedirectByRole(role) {
  const nr = normalizeRole(role);
  if (nr === "admin") return "/admin/dashboard/dbadmin.html";
  if (nr === "jaksa") return "/jaksa/dashboard/dbjaksa.html";
  return "/user/tanyajaksa/tanya.html";
}

function finalizeLoginRedirect(role) {
  const nr = normalizeRole(role);
  const redirectTarget = getRedirectTargetFromUrlOrSession();
  clearRedirectSession();

  // admin/jaksa selalu dashboard
  if (nr === "admin" || nr === "jaksa") {
    window.location.href = getRedirectByRole(nr);
    return;
  }

  // user: kalau redirectTarget ada, boleh dipakai (biasanya tanya.html karena guard)
  // tapi default tetap tanya.html sesuai request
  const fallback = "/user/tanyajaksa/tanya.html";
  window.location.href = redirectTarget || fallback;
}

// ===============================
// Update menu login/logout (kalau elemennya ada)
// ===============================
function updateNavbarMenuIfExists() {
  const loginLink = document.getElementById("loginLink");
  const logoutBtn = document.getElementById("btn-logout");

  if (loginLink) {
    const redirect = encodeURIComponent(window.location.pathname + window.location.search);
    loginLink.href = `/auth/login.html?redirect=${redirect}`;
  }

  const loggedIn = hasValidLogin();
  if (loginLink) loginLink.style.display = loggedIn ? "none" : "block";
  if (logoutBtn) logoutBtn.style.display = loggedIn ? "block" : "none";

  applyAkunLabel();
}

// ===============================
// MAIN DOM READY
// ===============================
document.addEventListener("DOMContentLoaded", () => {
  // ✅ hanya tanya.html yang diproteksi
  guardProtectedRoutes();

  // ✅ halaman publik tetap aman, cuma update navbar
  updateNavbarMenuIfExists();

  // ELEMEN LOGIN & RESET PASSWORD
  const loginForm = document.getElementById("loginForm");
  const loginFormContainer = document.getElementById("login-form-container");

  const forgotPasswordLink = document.getElementById("forgot-password-link");
  const forgotContainer = document.getElementById("forgot-password-container");
  const backToLoginBtn = document.getElementById("back-to-login");

  const resetContainer = document.getElementById("reset-password-container");
  const resetPasswordForm = document.getElementById("resetPasswordForm");
  const backToForgotBtn = document.getElementById("back-to-forgot");

  const forgotForm = document.getElementById("forgotPasswordForm");
  const resetEmailInput = document.getElementById("resetEmail");

  // ============================
  // A. LOGIN MANUAL
  // ============================
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const username = document.getElementById("loginUsername")?.value.trim();
      const password = document.getElementById("loginPassword")?.value;

      if (!username || !password) {
        showAlert("Username dan password wajib diisi!", "warning");
        return;
      }

      try {
        const res = await fetch(`${apiBase}${LOGIN_ENDPOINT}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        });

        const text = await res.text();
        let data = {};
        try {
          data = JSON.parse(text);
        } catch {
          data = { message: text };
        }

        if (!res.ok) {
          console.error("❌ LOGIN ERROR:", res.status, text);
          showAlert(data.error || data.message || "Login gagal!", "error");
          return;
        }

        const token = data.token || data.access_token || data.data?.token || null;
        const role = extractRoleFromResponse(data, token);
        const displayName = extractDisplayName(data, token);

        saveAuth(token, role, displayName);

        showAlert("Login berhasil!", "success");
        setTimeout(() => finalizeLoginRedirect(role), 600);
      } catch (err) {
        console.error("❌ FETCH ERROR LOGIN:", err);
        showAlert("Gagal terhubung ke server.", "error");
      }
    });
  }

  // ============================
  // B. LUPA PASSWORD (tetap)
  // ============================
  if (forgotPasswordLink) {
    forgotPasswordLink.addEventListener("click", (e) => {
      e.preventDefault();
      if (loginFormContainer) loginFormContainer.style.display = "none";
      if (resetContainer) resetContainer.style.display = "none";
      if (forgotContainer) forgotContainer.style.display = "block";
    });
  }

  if (backToLoginBtn) {
    backToLoginBtn.addEventListener("click", () => {
      if (forgotContainer) forgotContainer.style.display = "none";
      if (resetContainer) resetContainer.style.display = "none";
      if (loginFormContainer) loginFormContainer.style.display = "block";
    });
  }

  if (backToForgotBtn) {
    backToForgotBtn.addEventListener("click", () => {
      if (resetContainer) resetContainer.style.display = "none";
      if (loginFormContainer) loginFormContainer.style.display = "none";
      if (forgotContainer) forgotContainer.style.display = "block";
    });
  }

  if (forgotForm) {
    forgotForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("forgotEmail")?.value.trim();

      if (!email) {
        showAlert("Email wajib diisi!", "warning");
        return;
      }

      try {
        const res = await fetch(`${apiBase}${SEND_OTP_ENDPOINT}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });

        const text = await res.text();
        let data = {};
        try {
          data = JSON.parse(text);
        } catch {
          data = { message: text };
        }

        if (!res.ok) {
          showAlert(data.error || data.message || "Gagal mengirim OTP!", "error");
          return;
        }

        if (resetEmailInput) resetEmailInput.value = email;

        if (forgotContainer) forgotContainer.style.display = "none";
        if (resetContainer) resetContainer.style.display = "block";

        showAlert("Kode OTP telah dikirim ke email kamu!", "success");
      } catch (err) {
        console.error("❌ FETCH ERROR SEND OTP:", err);
        showAlert("Gagal terhubung ke server.", "error");
      }
    });
  }

  if (resetPasswordForm) {
    resetPasswordForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const email =
        document.getElementById("resetEmail")?.value.trim() ||
        document.getElementById("forgotEmail")?.value.trim() ||
        "";

      const otp = document.getElementById("resetOtp")?.value?.trim();
      const newPassword = document.getElementById("newPassword")?.value;
      const confirmNewPassword = document.getElementById("confirmNewPassword")?.value;

      if (!email || !otp || !newPassword || !confirmNewPassword) {
        showAlert("Email, OTP, dan kedua kolom password wajib diisi!", "warning");
        return;
      }

      if (newPassword !== confirmNewPassword) {
        showAlert("Password baru dan konfirmasi tidak sama!", "error");
        return;
      }

      if (newPassword.length < 8) {
        showAlert("Password minimal 8 karakter!", "warning");
        return;
      }

      // verify otp
      try {
        const verifyRes = await fetch(`${apiBase}${VERIFY_EMAIL_ENDPOINT}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, otp }),
        });

        const verifyText = await verifyRes.text();
        let verifyData = {};
        try {
          verifyData = JSON.parse(verifyText);
        } catch {
          verifyData = { error: verifyText };
        }

        if (!verifyRes.ok) {
          showAlert(verifyData.error || verifyData.message || "OTP salah!", "error");
          return;
        }
      } catch (err) {
        console.error("❌ VERIFY OTP ERROR:", err);
        showAlert("Gagal terhubung ke server saat verifikasi OTP.", "error");
        return;
      }

      // reset password
      try {
        const res = await fetch(`${apiBase}${RESET_PASSWORD_ENDPOINT}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, new_password: newPassword }),
        });

        const text = await res.text();
        let data = {};
        try {
          data = JSON.parse(text);
        } catch {
          data = { message: text };
        }

        if (!res.ok) {
          showAlert(data.error || data.message || "Gagal reset password!", "error");
          return;
        }

        Swal.fire({
          icon: "success",
          title: "Password berhasil diubah",
          text: "Silakan login dengan password baru.",
          timer: 2500,
          showConfirmButton: false,
        }).then(() => {
          if (resetContainer) resetContainer.style.display = "none";
          if (loginFormContainer) loginFormContainer.style.display = "block";
        });
      } catch (err) {
        console.error("❌ RESET PASSWORD ERROR:", err);
        showAlert("Gagal terhubung ke server.", "error");
      }
    });
  }

  // ============================
  // GOOGLE BUTTONS
  // ============================
  const googleRegisBtn = document.getElementById("googleRegisBtn");
  if (googleRegisBtn) {
    googleRegisBtn.addEventListener("click", () => {
      localStorage.setItem("googleRegisterMode", "yes");
      window.location.href = `${apiBase}/auth/google/login`;
    });
  }

  const googleLoginBtn = document.getElementById("googleLoginBtn");
  if (googleLoginBtn) {
    googleLoginBtn.addEventListener("click", () => {
      localStorage.removeItem("googleRegisterMode");
      window.location.href = `${apiBase}/auth/google/login`;
    });
  }
});

// ===============================
// GOOGLE CALLBACK HANDLER
// ===============================
(function () {
  const params = new URLSearchParams(window.location.search);

  const googleEmail = params.get("email");
  const googleToken = params.get("token");
  const googleError = params.get("error");

  const isGoogleRegister = localStorage.getItem("googleRegisterMode") === "yes";

  if (googleError) {
    showAlert(googleError, "error");
    return;
  }

  // 1) GOOGLE REGISTER MODE -> kirim OTP, tampilkan OTP form
  if (isGoogleRegister && googleEmail && !googleToken) {
    fetch(`${apiBase}${SEND_OTP_ENDPOINT}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: googleEmail }),
    }).catch(() => {});

    const registerContainer = document.getElementById("register-form-container");
    const otpContainer = document.getElementById("otp-form-container");

    if (registerContainer) registerContainer.style.display = "none";
    if (otpContainer) otpContainer.style.display = "block";

    const otpEmailInput = document.getElementById("otpEmail");
    if (otpEmailInput) otpEmailInput.value = googleEmail;

    localStorage.setItem("pendingGoogleEmail", googleEmail);

    showAlert("Kode OTP telah dikirim ke email Anda!", "success");
    return;
  }

  // 2) GOOGLE LOGIN MODE -> simpan token, redirect
  if (googleToken) {
    const payload = decodeJwtPayload(googleToken);
    const role = payload?.role || payload?.roles?.[0] || null;

    const displayName =
      extractDisplayName({ email: googleEmail }, googleToken) || googleEmail || null;

    saveAuth(googleToken, role, displayName);

    showAlert("Login Google berhasil!", "success");
    setTimeout(() => finalizeLoginRedirect(role), 600);
  }
})();

// ===============================
// VERIFY OTP GOOGLE REGISTER (tetap ada)
// ===============================
const verifyGoogleOtpBtn = document.getElementById("verifyGoogleOtpBtn");

if (verifyGoogleOtpBtn) {
  verifyGoogleOtpBtn.addEventListener("click", () => {
    const email = localStorage.getItem("pendingGoogleEmail");
    const otp = document.getElementById("otpInput")?.value?.trim();

    if (!otp) {
      showAlert("Masukkan kode OTP!", "error");
      return;
    }

    fetch(`${apiBase}${VERIFY_EMAIL_ENDPOINT}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, otp }),
    })
      .then((res) => res.text())
      .then((text) => {
        let data = {};
        try {
          data = JSON.parse(text);
        } catch {
          data = { message: text };
        }

        if (data.error) {
          showAlert(data.error, "error");
          return;
        }

        showAlert("Verifikasi berhasil! Silakan login.", "success");

        localStorage.removeItem("pendingGoogleEmail");
        localStorage.removeItem("googleRegisterMode");

        setTimeout(() => {
          window.location.href = "../login.html";
        }, 900);
      })
      .catch((err) => {
        console.error(err);
        showAlert("Gagal verifikasi OTP.", "error");
      });
  });
}
