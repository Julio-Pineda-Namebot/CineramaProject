/*
 * Controlador: selección de butacas.
 *
 * - Renderiza el mapa de sala con los estados AVAILABLE/SELECTED/LOCKED/SOLD.
 * - Al seleccionar/quitar butacas crea/actualiza la reserva temporal (bloqueo
 *   de 15 min) en el "servidor" (CK.db), lo que impide que otro usuario compre
 *   las mismas butacas.
 * - Muestra el contador regresivo y libera automáticamente al expirar.
 * - Escucha cambios de otras pestañas para reflejar bloqueos ajenos en vivo.
 */
(function () {
    CK.ui.injectAuthNav();
    CK.ui.renderStepper(document.getElementById("stepper"), "seats");

    let state = CK.store.get();
    if (!state.showtime) {
        window.location.href = "/index.html";
        return;
    }
    const show = state.showtime;
    const showtimeId = show.id;

    // Cabecera con datos de la función.
    document.getElementById("showTitle").textContent = show.movieTitle;
    document.getElementById("showMeta").innerHTML =
        `${show.cinemaName} · ${show.room} · ${show.format}<br>` +
        `<i class="fa-regular fa-calendar"></i> ${show.dateDisplay} · <i class="fa-regular fa-clock"></i> ${show.time}`;

    const seatArea = document.getElementById("seatArea");
    const seatTags = document.getElementById("seatTags");
    const seatCount = document.getElementById("seatCount");
    const unitPrice = document.getElementById("unitPrice");
    const totalEl = document.getElementById("total");
    const continueBtn = document.getElementById("continueBtn");
    const timerBox = document.getElementById("timerBox");
    const timerEl = document.getElementById("timer");
    const timerValue = document.getElementById("timerValue");
    const seatMsg = document.getElementById("seatMsg");

    let layout = null;
    let states = {};
    let selected = [];
    let stopTimer = null;
    let busy = false;

    document.getElementById("unitPrice").textContent = CK.ui.money(show.price);

    // ---- Contador regresivo de la reserva ----
    function refreshTimer() {
        if (stopTimer) { stopTimer(); stopTimer = null; }
        const s = CK.store.get();
        if (!CK.store.reservationActive(s)) {
            timerBox.style.display = "none";
            return;
        }
        timerBox.style.display = "block";
        stopTimer = CK.ui.startCountdown(s.expiresAt, {
            onTick: (ms) => {
                timerValue.textContent = CK.ui.mmss(ms);
                timerEl.classList.toggle("is-danger", ms <= 60000);
            },
            onExpire: onReservationExpired
        });
    }

    function onReservationExpired() {
        // Libera y limpia; las butacas vuelven a estar disponibles para todos.
        const s = CK.store.get();
        CK.api.releaseReservation(s.reservationId);
        CK.store.patch({ selectedSeats: [], reservationId: null, expiresAt: null });
        timerBox.style.display = "none";
        seatMsg.innerHTML = CK.ui.alertHTML("warning", "Tu tiempo de reserva expiró. Vuelve a seleccionar tus butacas.");
        loadSeats();
    }

    // ---- Render del mapa ----
    function render() {
        selected = Object.keys(states).filter((id) => states[id] === "SELECTED").sort(seatSort);

        const rowsHTML = layout.rows.map((r) => {
            const seatsHTML = r.seats.map((seat) => {
                const st = states[seat.id] || "AVAILABLE";
                const cls = {
                    AVAILABLE: "is-available",
                    SELECTED: "is-selected",
                    LOCKED: "is-locked",
                    SOLD: "is-sold"
                }[st];
                const disabled = (st === "LOCKED" || st === "SOLD") ? "disabled" : "";
                const gap = seat.col === layout.aisleAfter ? '<span class="ck-seat-gap"></span>' : "";
                return `<button type="button" class="ck-seat ${cls}" data-seat="${seat.id}" data-state="${st}" ${disabled}
                            title="${seat.id}">${seat.col}</button>${gap}`;
            }).join("");
            return `<div class="ck-seat-row"><span class="ck-row-label">${r.row}</span>${seatsHTML}</div>`;
        }).join("");

        seatArea.innerHTML = `
            <div class="ck-screen">Pantalla</div>
            <div class="ck-seatmap-scroll">
                <div class="ck-seatmap">${rowsHTML}</div>
            </div>
            <div class="ck-legend">
                <span class="ck-legend-item"><span class="ck-legend-box"></span> Disponible</span>
                <span class="ck-legend-item"><span class="ck-legend-box is-selected"></span> Seleccionada</span>
                <span class="ck-legend-item"><span class="ck-legend-box is-locked"></span> Reservada</span>
                <span class="ck-legend-item"><span class="ck-legend-box is-sold"></span> Vendida</span>
            </div>`;

        seatArea.querySelectorAll(".ck-seat").forEach((btn) => {
            const st = btn.dataset.state;
            if (st === "AVAILABLE" || st === "SELECTED") {
                btn.addEventListener("click", () => toggleSeat(btn.dataset.seat, st));
            }
        });

        renderSummary();
    }

    function seatSort(a, b) {
        if (a[0] !== b[0]) return a[0].localeCompare(b[0]);
        return parseInt(a.slice(1), 10) - parseInt(b.slice(1), 10);
    }

    function renderSummary() {
        if (selected.length) {
            seatTags.innerHTML = selected.map((s) => `<span class="ck-seat-tag">${s}</span>`).join("");
        } else {
            seatTags.innerHTML = `<span class="ck-muted">Ninguna seleccionada</span>`;
        }
        seatCount.textContent = selected.length;
        totalEl.textContent = CK.ui.money(show.price * selected.length);

        const enabled = selected.length > 0;
        continueBtn.disabled = !enabled;
        continueBtn.classList.toggle("is-disabled", !enabled);
    }

    // ---- Selección / reserva ----
    async function toggleSeat(seatId, currentState) {
        if (busy) return;
        busy = true;
        seatMsg.innerHTML = "";

        const desired = Object.keys(states).filter((id) => states[id] === "SELECTED");
        let next;
        if (currentState === "SELECTED") {
            next = desired.filter((id) => id !== seatId);
        } else {
            next = desired.concat(seatId);
        }

        const res = await CK.api.createReservation(showtimeId, next);
        if (!res.ok) {
            // Otro usuario tomó una butaca antes: se refresca el mapa.
            seatMsg.innerHTML = CK.ui.alertHTML("danger",
                `La butaca ${res.conflict.join(", ")} ya no está disponible.`);
            await loadSeats();
            busy = false;
            return;
        }

        CK.store.patch({
            selectedSeats: res.seats || [],
            reservationId: res.reservationId,
            expiresAt: res.expiresAt
        });
        refreshTimer();
        await loadSeats();
        busy = false;
    }

    // ---- Carga estados desde el "servidor" ----
    async function loadSeats() {
        const data = await CK.api.getSeats(showtimeId);
        layout = data.layout;
        states = data.states;
        render();
    }

    // ---- Continuar (requiere autenticación) ----
    continueBtn.addEventListener("click", () => {
        const s = CK.store.get();
        if (!s.selectedSeats.length || !CK.store.reservationActive(s)) {
            seatMsg.innerHTML = CK.ui.alertHTML("warning", "Selecciona al menos una butaca para continuar.");
            return;
        }
        // Regla: no se permite comprar sin usuario autenticado.
        if (!CK.auth.isAuthenticated()) {
            CK.auth.requireAuth("/pages/checkout/summary.html");
            return;
        }
        window.location.href = "/pages/checkout/summary.html";
    });

    // ---- Sincronización entre pestañas (multiusuario) ----
    CK.db.subscribe(() => { loadSeats(); });

    // Al abandonar la página sin continuar, mantenemos la reserva viva (persistida);
    // el contador seguirá corriendo y expirará por sí solo. Si el usuario cancela,
    // el botón Cancelar navega fuera y la reserva expira sola.

    // Init: restaura selección/tiempo desde la reserva vigente (si la hay).
    (function init() {
        const s = CK.store.get();
        if (s.reservationId) {
            const r = CK.db.getReservation(s.reservationId);
            if (r) {
                CK.store.patch({ selectedSeats: r.seats, expiresAt: r.expiresAt });
            } else {
                CK.store.patch({ selectedSeats: [], reservationId: null, expiresAt: null });
            }
        }
        refreshTimer();
        loadSeats();
    })();
})();
