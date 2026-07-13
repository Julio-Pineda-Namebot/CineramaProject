/*
 * Autenticación simulada.
 *
 * Sesión persistida en localStorage (sobrevive recargas). Los usuarios se
 * guardan en CK.db. NOTA: al ser una simulación, las credenciales se guardan
 * en claro; un backend real haría hashing y emitiría un token.
 *
 * Regla de negocio: no se permite comprar sin usuario autenticado. Cuando un
 * paso protegido detecta que no hay sesión, redirige al login conservando la
 * URL de retorno para volver EXACTAMENTE al punto del checkout.
 */
window.CK = window.CK || {};

CK.auth = (function () {
    const SESSION_KEY = "ck_session_v1";
    const LOGIN_URL = "/pages/auth/login.html";

    function currentUser() {
        try {
            return JSON.parse(localStorage.getItem(SESSION_KEY)) || null;
        } catch (e) {
            return null;
        }
    }

    function isAuthenticated() {
        return !!currentUser();
    }

    function setSession(user) {
        const safe = { name: user.name, email: user.email, dni: user.dni || null };
        localStorage.setItem(SESSION_KEY, JSON.stringify(safe));
        return safe;
    }

    function login(email, password) {
        const user = CK.db.findUser(email);
        if (!user) return { ok: false, error: "No existe una cuenta con ese correo." };
        if (user.password !== password) return { ok: false, error: "Contraseña incorrecta." };
        return { ok: true, user: setSession(user) };
    }

    function register(data) {
        const email = (data.email || "").toLowerCase();
        if (CK.db.findUser(email)) {
            return { ok: false, error: "Ya existe una cuenta con ese correo." };
        }
        const user = {
            name: data.name,
            email,
            dni: data.dni || null,
            password: data.password
        };
        CK.db.saveUser(user);
        return { ok: true, user: setSession(user) };
    }

    function logout() {
        localStorage.removeItem(SESSION_KEY);
    }

    /*
     * Protege un paso. Si no hay sesión, redirige al login con la URL de
     * retorno y devuelve false (el llamador debe detener su ejecución).
     */
    function requireAuth(returnUrl) {
        if (isAuthenticated()) return true;
        const back = returnUrl || (window.location.pathname + window.location.search);
        window.location.href = `${LOGIN_URL}?return=${encodeURIComponent(back)}`;
        return false;
    }

    // URL de retorno segura (sólo rutas internas).
    function returnUrl() {
        const params = new URLSearchParams(window.location.search);
        const back = params.get("return");
        if (back && back.startsWith("/")) return back;
        return "/index.html";
    }

    return {
        SESSION_KEY, LOGIN_URL,
        currentUser, isAuthenticated,
        login, register, logout,
        requireAuth, returnUrl
    };
})();

/*
 * Cuenta de prueba estática (demo).
 * Correo: cliente@cinerama.pe   Contraseña: 123456
 * Se crea una sola vez si aún no existe, para poder probar el flujo sin registrarse.
 */
(function seedDemoUser() {
    if (!CK.db.findUser("cliente@cinerama.pe")) {
        CK.db.saveUser({
            name: "Cliente Demo",
            email: "cliente@cinerama.pe",
            dni: "00000000",
            password: "123456"
        });
    }
})();
