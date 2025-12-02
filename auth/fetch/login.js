// =============================================================
// 🔹 INPUT LOGIN MANUAL
// =============================================================
const emailInput = document.getElementById("email") || document.getElementById("loginUsername");
const passwordInput = document.getElementById("password") || document.getElementById("loginPassword");
const loginForm = document.getElementById("loginForm");

// =============================================================
// ⭐ LOGIN MANUAL
// =============================================================
if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();

        if (!email || !password) {
            alert("Email/Username dan password wajib diisi!");
            return;
        }

        try {
            const response = await fetch("http://localhost:8080/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    username: email,
                    password: password
                })
            });

            const result = await response.json();
            console.log("Login response:", result);

            if (!response.ok) {
                alert(result.error || result.message || "Login gagal!");
                return;
            }

            // Simpan token
            localStorage.setItem("token", result.token);

            // Redirect ke halaman utama (ROOT)
            window.location.href = "/index.html";

        } catch (error) {
            console.error("Login error:", error);
            alert("Terjadi kesalahan. Pastikan backend berjalan.");
        }
    });
}

// =============================================================
// ⭐ LOGIN GOOGLE
// =============================================================
const googleLoginBtn = document.getElementById("googleLoginBtn");

if (googleLoginBtn) {
    googleLoginBtn.addEventListener("click", () => {
        window.location.href = "http://localhost:8080/auth/google/login";
    });
}

// =============================================================
// ⭐ HANDLE CALLBACK GOOGLE LOGIN
// =============================================================
const urlParams = new URLSearchParams(window.location.search);
const googleToken = urlParams.get("token");

if (googleToken) {
    localStorage.setItem("token", googleToken);
    window.location.href = "/index.html";
}

// =============================================================
//  BELOW THIS POINT: FORGOT & RESET PASSWORD
// =============================================================

const forgotPasswordLink = document.getElementById("forgot-password-link");
const forgotPasswordContainer = document.getElementById("forgot-password-container");
const resetPasswordContainer = document.getElementById("reset-password-container");
const forgotPasswordForm = document.getElementById("forgotPasswordForm");
const resetPasswordForm = document.getElementById("resetPasswordForm");
const backToLoginBtn = document.getElementById("back-to-login");
const backToForgotBtn = document.getElementById("back-to-forgot");
const resetTokenInput = document.getElementById("resetToken");

// ⭐ Show forgot password form
if (forgotPasswordLink) {
    forgotPasswordLink.addEventListener("click", () => {
        document.getElementById("login-form-container").style.display = "none";
        forgotPasswordContainer.style.display = "block";
        resetPasswordContainer.style.display = "none";
    });
}

// ⭐ Back to login
if (backToLoginBtn) {
    backToLoginBtn.addEventListener("click", () => {
        forgotPasswordContainer.style.display = "none";
        resetPasswordContainer.style.display = "none";
        document.getElementById("login-form-container").style.display = "block";
    });
}

// ⭐ Forgot password submit
if (forgotPasswordForm) {
    forgotPasswordForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const email = document.getElementById("forgotEmail").value.trim();

        if (!email) {
            alert("Email wajib diisi!");
            return;
        }

        try {
            const res = await fetch("http://localhost:8080/jaksa/auth/forgot-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email })
            });

            const data = await res.json();

            if (!res.ok) {
                alert(data.message || "Gagal mengirim email reset password.");
                return;
            }

            alert("Tautan reset password telah dikirim ke email Anda.");

            forgotPasswordContainer.style.display = "none";
            resetPasswordContainer.style.display = "block";

        } catch (err) {
            console.error("Forgot error:", err);
            alert("Terjadi kesalahan.");
        }
    });
}

// ⭐ Reset password submit
if (resetPasswordForm) {
    resetPasswordForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const newPassword = document.getElementById("newPassword").value.trim();
        const confirmPassword = document.getElementById("confirmNewPassword").value.trim();
        const token = resetTokenInput.value.trim();

        if (!newPassword || !confirmPassword) {
            alert("Semua field wajib diisi.");
            return;
        }

        if (newPassword !== confirmPassword) {
            alert("Password tidak sama.");
            return;
        }

        try {
            const res = await fetch("http://localhost:8080/jaksa/auth/reset-password-jaksa", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    token,
                    new_password: newPassword
                })
            });

            const data = await res.json();

            if (!res.ok) {
                alert(data.message || "Gagal mereset password.");
                return;
            }

            alert("Password berhasil direset. Silakan login kembali.");

            resetPasswordContainer.style.display = "none";
            document.getElementById("login-form-container").style.display = "block";

        } catch (err) {
            console.error("Reset error:", err);
            alert("Terjadi kesalahan.");
        }
    });
}

// ⭐ Back to forgot password
if (backToForgotBtn) {
    backToForgotBtn.addEventListener("click", () => {
        resetPasswordContainer.style.display = "none";
        forgotPasswordContainer.style.display = "block";
    });
}
