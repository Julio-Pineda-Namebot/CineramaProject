/*
 * Controlador: autenticación (login / registro).
 * Tras autenticarse, redirige EXACTAMENTE a la URL de retorno (?return=),
 * conservando el estado del checkout (función, butacas, tiempo de reserva).
 */
(function () {
    CK.ui.injectAuthNav();

    // Si ya hay sesión, no tiene sentido pedir login: vuelve al retorno.
    if (CK.auth.isAuthenticated()) {
        window.location.href = CK.auth.returnUrl();
        return;
    }

    const tabs = document.querySelectorAll(".ck-tab");
    const loginForm = document.getElementById("loginForm");
    const registerForm = document.getElementById("registerForm");
    const authMsg = document.getElementById("authMsg");
    const authIntro = document.getElementById("authIntro");

    // Si el retorno apunta al checkout, refuerza el mensaje.
    const back = new URLSearchParams(window.location.search).get("return") || "";
    if (back.includes("/checkout/")) {
        authIntro.textContent = "Debes iniciar sesión para completar tu compra. Tu reserva se mantiene activa.";
    }

    tabs.forEach((tab) => {
        tab.addEventListener("click", () => {
            tabs.forEach((t) => t.classList.remove("active"));
            tab.classList.add("active");
            const isLogin = tab.dataset.tab === "login";
            loginForm.style.display = isLogin ? "block" : "none";
            registerForm.style.display = isLogin ? "none" : "block";
            authMsg.innerHTML = "";
        });
    });

    function done() {
        window.location.href = CK.auth.returnUrl();
    }

    loginForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const email = document.getElementById("loginEmail").value.trim();
        const password = document.getElementById("loginPassword").value;
        const res = CK.auth.login(email, password);
        if (!res.ok) {
            authMsg.innerHTML = CK.ui.alertHTML("danger", res.error);
            return;
        }
        done();
    });

    registerForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const data = {
            name: document.getElementById("regName").value.trim(),
            dni: document.getElementById("regDni").value.trim(),
            email: document.getElementById("regEmail").value.trim(),
            password: document.getElementById("regPassword").value
        };
        const res = CK.auth.register(data);
        if (!res.ok) {
            authMsg.innerHTML = CK.ui.alertHTML("danger", res.error);
            return;
        }
        done();
    });
})();
