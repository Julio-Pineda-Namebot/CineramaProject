/*
 * "Base de datos" simulada respaldada en localStorage.
 *
 * Simula el estado que en producción viviría en un servidor:
 *   - butacas vendidas y bloqueadas (con expiración)
 *   - reservas temporales
 *   - órdenes de compra
 *   - usuarios e historial de compras
 *
 * localStorage es compartido entre pestañas del mismo navegador, así que el
 * evento `storage` permite simular concurrencia multiusuario: si una pestaña
 * bloquea una butaca, las demás la ven como LOCKED en tiempo real.
 *
 * Cada pestaña actúa como un "cliente" distinto (clientId en sessionStorage),
 * de modo que las reservas propias se ven SELECTED y las ajenas LOCKED.
 */
window.CK = window.CK || {};

CK.db = (function () {
    const KEY = "ck_db_v1";
    const CLIENT_KEY = "ck_client_id";
    const RESERVATION_MINUTES = 15;
    const RESERVATION_MS = RESERVATION_MINUTES * 60 * 1000;

    // ---- Identidad del cliente (pestaña / navegador) ----
    function clientId() {
        let id = sessionStorage.getItem(CLIENT_KEY);
        if (!id) {
            id = "c_" + Date.now().toString(36) + "_" + Math.floor(Math.random() * 1e6).toString(36);
            sessionStorage.setItem(CLIENT_KEY, id);
        }
        return id;
    }

    // ---- Lectura / escritura del estado global ----
    function read() {
        try {
            return JSON.parse(localStorage.getItem(KEY)) || emptyDb();
        } catch (e) {
            return emptyDb();
        }
    }

    function emptyDb() {
        return { seats: {}, reservations: {}, orders: {}, users: {}, purchases: {}, orderSeq: 0 };
    }

    function write(db) {
        localStorage.setItem(KEY, JSON.stringify(db));
    }

    // ---- Semilla determinista de butacas vendidas por función ----
    // Garantiza que cada función tenga una ocupación realista y estable.
    function ensureSeeded(db, showtimeId) {
        if (db.seats[showtimeId]) return;
        const layout = CK.data.seatLayout();
        const map = {};
        layout.rows.forEach((r) => {
            r.seats.forEach((s) => {
                // ~18% vendidas de forma determinista (sin aleatoriedad real).
                if (CK.data._hash(showtimeId + s.id) % 100 < 18) {
                    map[s.id] = { status: "SOLD", owner: "system" };
                }
            });
        });
        db.seats[showtimeId] = map;
    }

    // ---- Purga de bloqueos/reservas expirados ----
    // Devuelve true si hubo cambios.
    function purge(db) {
        const now = Date.now();
        let changed = false;
        Object.keys(db.reservations).forEach((rid) => {
            const r = db.reservations[rid];
            if (r.expiresAt <= now) {
                releaseInternal(db, rid);
                changed = true;
            }
        });
        return changed;
    }

    function releaseInternal(db, reservationId) {
        const r = db.reservations[reservationId];
        if (!r) return;
        const map = db.seats[r.showtimeId] || {};
        r.seats.forEach((seatId) => {
            const seat = map[seatId];
            if (seat && seat.status === "LOCKED" && seat.reservationId === reservationId) {
                delete map[seatId];
            }
        });
        delete db.reservations[reservationId];
    }

    // ---- API interna del "servidor" ----

    // Estado de todas las butacas de una función para el cliente actual.
    function getSeatStates(showtimeId) {
        const db = read();
        ensureSeeded(db, showtimeId);
        const changed = purge(db);
        write(db); // persiste semilla y purga
        const me = clientId();
        const map = db.seats[showtimeId] || {};
        const states = {};
        const layout = CK.data.seatLayout();
        layout.rows.forEach((r) => {
            r.seats.forEach((s) => {
                const seat = map[s.id];
                if (!seat) {
                    states[s.id] = "AVAILABLE";
                } else if (seat.status === "SOLD") {
                    states[s.id] = "SOLD";
                } else if (seat.status === "LOCKED") {
                    states[s.id] = seat.owner === me ? "SELECTED" : "LOCKED";
                }
            });
        });
        return states;
    }

    /*
     * Crea/actualiza la reserva temporal del cliente para una función.
     * Reglas de negocio:
     *   - una butaca no puede tener dos compradores (rechaza SOLD o LOCKED ajena)
     *   - reemplaza la selección previa del mismo cliente para esa función
     * Devuelve { ok, reservationId, expiresAt } o { ok:false, conflict:[...] }.
     */
    function reserve(showtimeId, seatIds) {
        const db = read();
        ensureSeeded(db, showtimeId);
        purge(db);
        const me = clientId();
        const map = db.seats[showtimeId];

        // Validación de conflicto contra el estado más reciente.
        const conflict = seatIds.filter((id) => {
            const seat = map[id];
            return seat && !(seat.status === "LOCKED" && seat.owner === me);
        });
        if (conflict.length) {
            write(db);
            return { ok: false, conflict };
        }

        // Libera cualquier reserva previa de este cliente para esta función.
        Object.keys(db.reservations).forEach((rid) => {
            const r = db.reservations[rid];
            if (r.owner === me && r.showtimeId === showtimeId) releaseInternal(db, rid);
        });

        if (!seatIds.length) {
            write(db);
            return { ok: true, reservationId: null, expiresAt: null };
        }

        const reservationId = "r_" + Date.now().toString(36) + "_" + Math.floor(Math.random() * 1e6).toString(36);
        const expiresAt = Date.now() + RESERVATION_MS;
        seatIds.forEach((id) => {
            map[id] = { status: "LOCKED", owner: me, reservationId, expiresAt };
        });
        db.reservations[reservationId] = { id: reservationId, showtimeId, seats: seatIds.slice(), owner: me, expiresAt };
        write(db);
        return { ok: true, reservationId, expiresAt, seats: seatIds.slice() };
    }

    function release(reservationId) {
        if (!reservationId) return { ok: true };
        const db = read();
        releaseInternal(db, reservationId);
        write(db);
        return { ok: true };
    }

    function getReservation(reservationId) {
        const db = read();
        purge(db);
        write(db);
        return db.reservations[reservationId] || null;
    }

    // Confirma la compra: marca butacas como SOLD y crea la orden. Una sola orden por compra.
    function confirmOrder(payload) {
        const db = read();
        purge(db);
        const me = clientId();
        const { showtimeId, seats, reservationId } = payload;
        const map = db.seats[showtimeId] || (db.seats[showtimeId] = {});

        // Revalida que las butacas sigan bajo esta reserva (no expiradas ni robadas).
        const invalid = seats.filter((id) => {
            const seat = map[id];
            return !seat || seat.status !== "LOCKED" || seat.owner !== me || seat.reservationId !== reservationId;
        });
        if (invalid.length) {
            write(db);
            return { ok: false, invalid };
        }

        db.orderSeq = (db.orderSeq || 0) + 1;
        const year = new Date().getFullYear();
        const code = `CP-${year}${String(db.orderSeq).padStart(5, "0")}`;
        const orderId = "o_" + Date.now().toString(36);

        seats.forEach((id) => { map[id] = { status: "SOLD", owner: me }; });
        delete db.reservations[reservationId];

        const order = Object.assign({ id: orderId, code, createdAt: Date.now() }, payload);
        db.orders[orderId] = order;

        const email = (payload.user && payload.user.email || "").toLowerCase();
        if (email) {
            if (!db.purchases[email]) db.purchases[email] = [];
            db.purchases[email].unshift(orderId);
        }
        write(db);
        return { ok: true, order };
    }

    function getOrder(orderId) {
        return read().orders[orderId] || null;
    }

    function getPurchases(email) {
        const db = read();
        const ids = db.purchases[(email || "").toLowerCase()] || [];
        return ids.map((id) => db.orders[id]).filter(Boolean);
    }

    // ---- Usuarios (auth mock) ----
    function findUser(email) {
        return read().users[(email || "").toLowerCase()] || null;
    }

    function saveUser(user) {
        const db = read();
        db.users[user.email.toLowerCase()] = user;
        write(db);
        return user;
    }

    // ---- Suscripción a cambios entre pestañas ----
    function subscribe(callback) {
        function handler(e) {
            if (e.key === KEY) callback();
        }
        window.addEventListener("storage", handler);
        return () => window.removeEventListener("storage", handler);
    }

    return {
        clientId,
        RESERVATION_MINUTES,
        RESERVATION_MS,
        getSeatStates,
        reserve,
        release,
        getReservation,
        confirmOrder,
        getOrder,
        getPurchases,
        findUser,
        saveUser,
        subscribe
    };
})();
