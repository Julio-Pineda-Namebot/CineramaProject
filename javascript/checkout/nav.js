/*
 * Enlace de sesión para el navbar de las páginas generales del sitio
 * (cartelera, sedes, contacto, detalle de película, etc.).
 *
 * Es autónomo: no depende de los demás módulos del checkout, sólo lee la
 * sesión guardada en localStorage (misma clave que CK.auth). Así el botón
 * "Ingresar" / cuenta aparece en todas las páginas sin cargar todo el bundle.
 */
(function () {
    var SESSION_KEY = "ck_session_v1";
    var LOGIN_URL = "/pages/auth/login.html";
    var ACCOUNT_URL = "/pages/account/purchases.html";

    function currentUser() {
        try {
            return JSON.parse(localStorage.getItem(SESSION_KEY)) || null;
        } catch (e) {
            return null;
        }
    }

    function init() {
        var nav = document.querySelector(".navbar-nav");
        if (!nav || nav.querySelector(".ck-nav-session")) return;

        var user = currentUser();
        var li = document.createElement("li");
        li.className = "nav-item ck-nav-session";

        if (user) {
            // Ícono de usuario con menú desplegable (Bootstrap dropdown).
            var first = user.name ? user.name.split(" ")[0] : "Cuenta";
            li.className = "nav-item dropdown ck-nav-session";
            li.innerHTML =
                '<a class="nav-link dropdown-toggle" href="#" id="ckUserMenu" role="button" ' +
                'data-bs-toggle="dropdown" aria-expanded="false">' +
                '<i class="fa-solid fa-circle-user"></i> ' + first + '</a>' +
                '<ul class="dropdown-menu dropdown-menu-end" aria-labelledby="ckUserMenu">' +
                '<li><a class="dropdown-item" href="' + ACCOUNT_URL + '">' +
                '<i class="fa-solid fa-ticket"></i> Mis compras</a></li>' +
                '<li><hr class="dropdown-divider"></li>' +
                '<li><a class="dropdown-item" href="#" id="ckNavLogout">' +
                '<i class="fa-solid fa-right-from-bracket"></i> Cerrar sesión</a></li>' +
                '</ul>';
            nav.appendChild(li);
            li.querySelector("#ckNavLogout").addEventListener("click", function (e) {
                e.preventDefault();
                localStorage.removeItem(SESSION_KEY);
                window.location.reload();
            });
        } else {
            li.innerHTML = '<a class="nav-link" href="' + LOGIN_URL + '">Ingresar</a>';
            nav.appendChild(li);
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
