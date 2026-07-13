/*
 * Controlador: pago.
 *
 * Estados del pago: PENDING -> PROCESSING -> SUCCESS | FAILED.
 * Durante el proceso se bloquean todas las acciones (overlay).
 * Al aprobarse: confirma la orden (marca butacas SOLD, una sola orden) y
 * redirige a la confirmación. Estructura lista para una pasarela real futura.
 *
 * Simulación: una tarjeta terminada en 0000 es rechazada (FAILED).
 */
(function () {
    CK.ui.injectAuthNav();
    CK.ui.renderStepper(document.getElementById("stepper"), "payment");

    const content = document.getElementById("content");
    const timerBar = document.getElementById("timerBar");
    const timerEl = document.getElementById("timer");
    const timerValue = document.getElementById("timerValue");

    const state = CK.store.get();

    // Reglas de acceso al pago.
    if (!state.showtime || !state.selectedSeats.length) {
        window.location.href = "/index.html";
        return;
    }
    if (!CK.auth.isAuthenticated()) {
        CK.auth.requireAuth("/pages/checkout/summary.html");
        return;
    }
    if (!CK.store.reservationActive(state)) {
        content.innerHTML = CK.ui.alertHTML("warning",
            "Tu reserva expiró. No es posible pagar. Selecciona tus butacas nuevamente.") +
            `<a class="ck-btn" href="/pages/checkout/showtimes.html?movie=${state.movie ? state.movie.id : ""}">Elegir función</a>`;
        return;
    }

    const show = state.showtime;
    const total = CK.store.total(state);

    content.innerHTML = `
        <div class="row">
            <div class="col-12 col-lg-7 mb-3">
                <div class="ck-card">
                    <div class="ck-card-head">Método de pago</div>
                    <div class="mb-3">
                        <div class="form-check">
                            <input class="form-check-input" type="radio" name="method" id="mCard" value="card" checked>
                            <label class="form-check-label" for="mCard">Tarjeta de crédito / débito</label>
                        </div>
                        <div class="form-check">
                            <input class="form-check-input" type="radio" name="method" id="mExternal" value="external">
                            <label class="form-check-label" for="mExternal">Métodos externos (Yape / PLIN)</label>
                        </div>
                    </div>

                    <form id="cardForm">
                        <div id="cardFields">
                            <div class="mb-3">
                                <label class="ck-label">Número de tarjeta</label>
                                <input type="text" inputmode="numeric" maxlength="19" class="form-control ck-input"
                                    id="cardNumber" placeholder="4111 1111 1111 1111" required>
                            </div>
                            <div class="mb-3">
                                <label class="ck-label">Nombre del titular</label>
                                <input type="text" class="form-control ck-input" id="cardName"
                                    placeholder="Como aparece en la tarjeta" required>
                            </div>
                            <div class="row">
                                <div class="col-6 mb-3">
                                    <label class="ck-label">Vencimiento</label>
                                    <input type="text" class="form-control ck-input" id="cardExp"
                                        placeholder="MM/AA" maxlength="5" required>
                                </div>
                                <div class="col-6 mb-3">
                                    <label class="ck-label">CVV</label>
                                    <input type="password" inputmode="numeric" class="form-control ck-input"
                                        id="cardCvv" placeholder="***" maxlength="4" required>
                                </div>
                            </div>
                        </div>
                        <div id="externalNote" style="display:none;">
                            ${CK.ui.alertHTML("info", "Los métodos externos se habilitarán con la integración de la pasarela. Por ahora usa tarjeta.")}
                        </div>
                        <div id="payMsg"></div>
                        <button type="submit" class="ck-btn w-100 mt-2" id="payBtn">Pagar ${CK.ui.money(total)}</button>
                    </form>
                    <p class="ck-muted mt-2 mb-0">
                        Simulación: cualquier tarjeta es aprobada, salvo las que terminan en 0000 (rechazo).
                    </p>
                </div>
            </div>
            <div class="col-12 col-lg-5">
                <div class="ck-card ck-summary">
                    <div class="ck-card-head">${show.movieTitle}</div>
                    <div class="ck-summary-row"><span class="ck-key">Cine</span><span>${show.cinemaName}</span></div>
                    <div class="ck-summary-row"><span class="ck-key">Sala</span><span>${show.room}</span></div>
                    <div class="ck-summary-row"><span class="ck-key">Fecha / Hora</span>
                        <span>${show.dateDisplay} ${show.time}</span></div>
                    <div class="ck-summary-row"><span class="ck-key">Butacas</span>
                        <span>${state.selectedSeats.join(", ")}</span></div>
                    <div class="ck-summary-row ck-summary-total">
                        <span>Total</span><span>${CK.ui.money(total)}</span>
                    </div>
                </div>
            </div>
        </div>`;

    const cardForm = document.getElementById("cardForm");
    const payMsg = document.getElementById("payMsg");
    const payBtn = document.getElementById("payBtn");
    const cardFields = document.getElementById("cardFields");
    const externalNote = document.getElementById("externalNote");

    // Alternar método (externos deshabilitado en esta simulación).
    document.querySelectorAll('input[name="method"]').forEach((r) => {
        r.addEventListener("change", () => {
            const external = document.getElementById("mExternal").checked;
            cardFields.style.display = external ? "none" : "block";
            externalNote.style.display = external ? "block" : "none";
            cardFields.querySelectorAll("input").forEach((i) => (i.required = !external));
            payBtn.classList.toggle("is-disabled", external);
            payBtn.disabled = external;
        });
    });

    // Formateo simple del número de tarjeta.
    document.getElementById("cardNumber").addEventListener("input", (e) => {
        let v = e.target.value.replace(/\D/g, "").slice(0, 16);
        e.target.value = v.replace(/(.{4})/g, "$1 ").trim();
    });
    document.getElementById("cardExp").addEventListener("input", (e) => {
        let v = e.target.value.replace(/\D/g, "").slice(0, 4);
        if (v.length >= 3) v = v.slice(0, 2) + "/" + v.slice(2);
        e.target.value = v;
    });

    // ---- Overlay de estado del pago ----
    function overlay(html) {
        let el = document.getElementById("ckOverlay");
        if (!el) {
            el = document.createElement("div");
            el.id = "ckOverlay";
            el.className = "ck-overlay";
            document.body.appendChild(el);
        }
        el.innerHTML = `<div class="ck-overlay-box">${html}</div>`;
        return el;
    }
    function closeOverlay() {
        const el = document.getElementById("ckOverlay");
        if (el) el.remove();
    }

    function renderStatus(status, message) {
        if (status === "PENDING" || status === "PROCESSING") {
            overlay(`
                <div class="ck-spinner"></div>
                <h5 class="mb-1">${status === "PENDING" ? "Iniciando pago…" : "Procesando pago…"}</h5>
                <p class="ck-muted mb-0">No cierres esta ventana.</p>`);
        } else if (status === "FAILED") {
            overlay(`
                <div class="ck-pay-icon is-failed"><i class="fa-solid fa-circle-xmark"></i></div>
                <h5 class="mb-1">Pago rechazado</h5>
                <p class="ck-muted">${message || ""}</p>
                <button class="ck-btn" id="retryBtn">Reintentar</button>`);
            document.getElementById("retryBtn").addEventListener("click", () => {
                closeOverlay();
                setBusy(false);
            });
        }
    }

    function setBusy(busy) {
        payBtn.disabled = busy;
        payBtn.classList.toggle("is-disabled", busy);
        cardForm.querySelectorAll("input").forEach((i) => (i.disabled = busy));
    }

    cardForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        payMsg.innerHTML = "";

        // Revalida reserva justo antes de cobrar.
        const s = CK.store.get();
        if (!CK.store.reservationActive(s)) {
            payMsg.innerHTML = CK.ui.alertHTML("danger", "Tu reserva expiró. No se realizó ningún cargo.");
            return;
        }

        setBusy(true);
        const payment = {
            method: "card",
            cardNumber: document.getElementById("cardNumber").value,
            name: document.getElementById("cardName").value
        };

        CK.store.patch({ paymentStatus: "PENDING" });

        const result = await CK.api.processPayment(payment, (status) => {
            CK.store.patch({ paymentStatus: status });
            renderStatus(status);
        });

        if (result.status !== "SUCCESS") {
            renderStatus("FAILED", result.message);
            return;
        }

        // Pago aprobado -> confirmar orden (una sola orden por compra).
        const user = CK.auth.currentUser();
        const orderRes = await CK.api.createOrder({
            showtimeId: show.id,
            movieId: show.movieId,
            movieTitle: show.movieTitle,
            cinemaName: show.cinemaName,
            city: show.city,
            room: show.room,
            format: show.format,
            date: show.date,
            dateDisplay: show.dateDisplay,
            time: show.time,
            seats: s.selectedSeats.slice(),
            unitPrice: show.price,
            total: CK.store.total(s),
            reservationId: s.reservationId,
            transactionId: result.transactionId,
            user: { name: user.name, email: user.email, dni: user.dni || null }
        });

        if (!orderRes.ok) {
            renderStatus("FAILED", "No pudimos asegurar tus butacas. No se realizó ningún cargo.");
            return;
        }

        CK.store.patch({ order: orderRes.order, paymentStatus: "SUCCESS", reservationId: null, expiresAt: null });
        window.location.href = "/pages/checkout/confirmation.html";
    });

    // Contador de reserva.
    timerBar.style.display = "block";
    CK.ui.startCountdown(state.expiresAt, {
        onTick: (ms) => {
            timerValue.textContent = CK.ui.mmss(ms);
            timerEl.classList.toggle("is-danger", ms <= 60000);
        },
        onExpire: () => {
            CK.api.releaseReservation(state.reservationId);
            CK.store.patch({ selectedSeats: [], reservationId: null, expiresAt: null });
            content.innerHTML = CK.ui.alertHTML("warning", "Tu reserva expiró. No se realizó ningún cargo.") +
                `<a class="ck-btn" href="/pages/checkout/showtimes.html?movie=${state.movie ? state.movie.id : ""}">Elegir función</a>`;
        }
    });
})();
