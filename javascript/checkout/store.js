/*
 * Estado global del checkout.
 *
 * Se persiste en sessionStorage para sobrevivir a la navegación entre pasos
 * (selección de función -> butacas -> auth -> resumen -> pago -> confirmación)
 * sin perder la información de la compra, incluido el tiempo restante de la
 * reserva. La sesión del usuario vive aparte (CK.auth), aquí sólo se refleja.
 */
window.CK = window.CK || {};

CK.store = (function () {
    const KEY = "ck_checkout_v1";

    function empty() {
        return {
            movie: null,          // { id, title, poster }
            cinema: null,         // { id, name, city }
            showtime: null,       // función seleccionada (objeto completo de data.js)
            room: null,           // string
            selectedSeats: [],    // ["F5","F6"]
            reservationId: null,  // id de la reserva temporal
            expiresAt: null,      // timestamp de expiración del bloqueo (timer)
            paymentStatus: null,  // PENDING | PROCESSING | SUCCESS | FAILED
            order: null,          // orden confirmada
            ticket: null          // ticket generado
        };
    }

    function get() {
        try {
            return Object.assign(empty(), JSON.parse(sessionStorage.getItem(KEY)) || {});
        } catch (e) {
            return empty();
        }
    }

    function save(state) {
        sessionStorage.setItem(KEY, JSON.stringify(state));
        return state;
    }

    // Aplica un parche parcial y persiste.
    function patch(partial) {
        const next = Object.assign(get(), partial);
        return save(next);
    }

    function clear() {
        sessionStorage.removeItem(KEY);
    }

    // Total en base a butacas x precio de la función.
    function total(state) {
        const s = state || get();
        const price = (s.showtime && s.showtime.price) || 0;
        return +(price * (s.selectedSeats ? s.selectedSeats.length : 0)).toFixed(2);
    }

    // ¿El bloqueo temporal sigue vigente?
    function reservationActive(state) {
        const s = state || get();
        return !!(s.reservationId && s.expiresAt && s.expiresAt > Date.now());
    }

    return { KEY, empty, get, save, patch, clear, total, reservationActive };
})();
