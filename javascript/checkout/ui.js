/*
 * Utilidades de UI compartidas por las vistas del checkout.
 * Sólo usa componentes/estilos existentes del proyecto (Bootstrap + tokens).
 */
window.CK = window.CK || {};

CK.ui = (function () {
    // Formato de moneda (soles peruanos).
    function money(n) {
        return "S/ " + Number(n || 0).toFixed(2);
    }

    // Pasos del flujo de compra (para el indicador de progreso).
    const STEPS = [
        { key: "showtimes", label: "Función" },
        { key: "seats",     label: "Butacas" },
        { key: "summary",   label: "Resumen" },
        { key: "payment",   label: "Pago" },
        { key: "confirmation", label: "Listo" }
    ];

    // Dibuja el indicador de pasos dentro del contenedor dado.
    function renderStepper(container, currentKey) {
        if (!container) return;
        const idx = STEPS.findIndex((s) => s.key === currentKey);
        container.innerHTML = STEPS.map((s, i) => {
            let cls = "ck-step";
            if (i < idx) cls += " ck-step-done";
            if (i === idx) cls += " ck-step-active";
            return `
                <div class="${cls}">
                    <span class="ck-step-dot">${i < idx ? '<i class="fa-solid fa-check"></i>' : (i + 1)}</span>
                    <span class="ck-step-label">${s.label}</span>
                </div>`;
        }).join('<span class="ck-step-sep"></span>');
    }

    // Convierte milisegundos restantes a "MM:SS".
    function mmss(ms) {
        const total = Math.max(0, Math.floor(ms / 1000));
        const m = Math.floor(total / 60);
        const s = total % 60;
        return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    }

    /*
     * Inicia una cuenta regresiva hasta expiresAt.
     * Llama onTick(msRestantes) cada segundo y onExpire() al llegar a cero.
     * Devuelve una función para detenerla.
     */
    function startCountdown(expiresAt, { onTick, onExpire } = {}) {
        let stopped = false;
        function tick() {
            if (stopped) return;
            const remaining = expiresAt - Date.now();
            if (remaining <= 0) {
                onTick && onTick(0);
                onExpire && onExpire();
                return;
            }
            onTick && onTick(remaining);
            setTimeout(tick, 1000);
        }
        tick();
        return () => { stopped = true; };
    }

    /*
     * Inyecta en el navbar el estado de sesión: enlace a "Mis compras" y
     * "Cerrar sesión" si hay usuario, o "Ingresar" si no lo hay.
     * Requiere un <ul class="navbar-nav"> en el header.
     */
    function injectAuthNav() {
        const nav = document.querySelector(".navbar-nav");
        if (!nav) return;
        const user = CK.auth.currentUser();
        const li = document.createElement("li");
        li.className = "nav-item";
        if (user) {
            // Ícono de usuario con menú desplegable (Bootstrap dropdown).
            li.className = "nav-item dropdown";
            li.innerHTML = `
                <a class="nav-link dropdown-toggle" href="#" id="ckUserMenu" role="button"
                   data-bs-toggle="dropdown" aria-expanded="false">
                    <i class="fa-solid fa-circle-user"></i> ${user.name.split(" ")[0]}
                </a>
                <ul class="dropdown-menu dropdown-menu-end" aria-labelledby="ckUserMenu">
                    <li><a class="dropdown-item" href="/pages/account/purchases.html">
                        <i class="fa-solid fa-ticket"></i> Mis compras</a></li>
                    <li><hr class="dropdown-divider"></li>
                    <li><a class="dropdown-item" href="#" id="ckLogout">
                        <i class="fa-solid fa-right-from-bracket"></i> Cerrar sesión</a></li>
                </ul>`;
            nav.appendChild(li);
            li.querySelector("#ckLogout").addEventListener("click", (e) => {
                e.preventDefault();
                CK.auth.logout();
                window.location.href = "/index.html";
            });
        } else {
            li.innerHTML = `<a class="nav-link" href="${CK.auth.LOGIN_URL}">Ingresar</a>`;
            nav.appendChild(li);
        }
    }

    // Mensaje inline con estilos Bootstrap (alert). type: danger|success|warning|info.
    function alertHTML(type, message) {
        return `<div class="alert alert-${type} ck-alert" role="alert">${message}</div>`;
    }

    return { money, STEPS, renderStepper, mmss, startCountdown, injectAuthNav, alertHTML };
})();
