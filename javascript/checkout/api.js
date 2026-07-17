/*
 * Capa de servicios (API simulada).
 *
 * Refleja los endpoints que expondría un backend real. Toda la persistencia
 * ocurre en CK.db (localStorage). Las funciones devuelven Promesas y aplican
 * una pequeña latencia para imitar la red, de modo que el resto de la app
 * ya está escrita "async" y migrar a fetch() real sea un cambio localizado.
 *
 * Correspondencia con los endpoints pedidos:
 *   GET    /showtimes?movie=       -> getShowtimes(movieId)
 *   GET    /showtimes/{id}/seats   -> getSeats(showtimeId)
 *   POST   /reservations           -> createReservation(showtimeId, seats)
 *   DELETE /reservations/{id}      -> releaseReservation(reservationId)
 *   POST   /orders                 -> createOrder(payload)
 *   POST   /tickets                -> createTicket(order)
 *   POST   /notifications/email    -> sendEmail(payload)
 *   (pago) POST /payments          -> processPayment(payload)
 */
window.CK = window.CK || {};

CK.api = (function () {
    function delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    // GET /showtimes?movie=
    async function getShowtimes(movieId) {
        await delay(250);
        return CK.data.getShowtimes(movieId);
    }

    async function getShowtime(showtimeId) {
        await delay(120);
        return CK.data.getShowtime(showtimeId);
    }

    // GET /showtimes/{id}/seats  -> layout + estado de cada butaca
    async function getSeats(showtimeId) {
        await delay(300);
        return {
            layout: CK.data.seatLayout(),
            states: CK.db.getSeatStates(showtimeId)
        };
    }

    // POST /reservations  -> bloqueo temporal (15 min)
    async function createReservation(showtimeId, seatIds) {
        await delay(200);
        return CK.db.reserve(showtimeId, seatIds);
    }

    // DELETE /reservations/{id}
    async function releaseReservation(reservationId) {
        await delay(120);
        return CK.db.release(reservationId);
    }

    async function getReservation(reservationId) {
        await delay(80);
        return CK.db.getReservation(reservationId);
    }

    /*
     * POST /payments -> procesa el pago simulado.
     * Estados: PENDING -> PROCESSING -> SUCCESS | FAILED.
     * `onState` recibe cada transición para que la UI muestre el progreso.
     * Reglas simples de simulación:
     *   - Tarjeta: las que terminan en "0000" fallan.
     *   - Yape: el código de aprobación "000000" falla.
     */
    async function processPayment(payment, onState) {
        onState && onState("PENDING");
        await delay(400);
        onState && onState("PROCESSING");
        await delay(1600);

        let declined, failMsg;
        if (payment.method === "yape") {
            declined = (payment.code || "") === "000000";
            failMsg = "Código de aprobación inválido o expirado.";
        } else {
            declined = (payment.cardNumber || "").replace(/\s/g, "").endsWith("0000");
            failMsg = "Tarjeta rechazada por el emisor.";
        }

        const status = declined ? "FAILED" : "SUCCESS";
        onState && onState(status);
        return {
            status,
            transactionId: status === "SUCCESS" ? "txn_" + Date.now().toString(36) : null,
            message: declined ? failMsg : "Pago aprobado."
        };
    }

    // POST /orders -> confirma la compra tras el pago aprobado (una orden por compra)
    async function createOrder(payload) {
        await delay(350);
        return CK.db.confirmOrder(payload);
    }

    // POST /tickets -> genera los datos del ticket digital a partir de la orden
    async function createTicket(order) {
        await delay(200);
        return {
            code: order.code,
            movie: order.movieTitle,
            cinema: order.cinemaName,
            room: order.room,
            date: order.dateDisplay,
            time: order.time,
            format: order.format,
            seats: order.seats,
            total: order.total,
            // Contenido codificado en el QR (validación en puerta).
            qrPayload: `CINERAMA|${order.code}|${order.showtimeId}|${order.seats.join(",")}`
        };
    }

    // POST /notifications/email -> envío simulado del correo de confirmación
    async function sendEmail(payload) {
        await delay(600);
        // En producción aquí iría el servicio de correo (con el PDF adjunto).
        console.info("[Cinerama] Correo de confirmación enviado a:", payload.to, payload);
        return { ok: true, to: payload.to, sentAt: Date.now() };
    }

    return {
        getShowtimes,
        getShowtime,
        getSeats,
        createReservation,
        releaseReservation,
        getReservation,
        processPayment,
        createOrder,
        createTicket,
        sendEmail
    };
})();
