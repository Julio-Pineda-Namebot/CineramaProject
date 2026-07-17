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

                    <div class="ck-methods">
                        <label class="ck-method is-active" id="labelCard">
                            <input class="ck-method-radio" type="radio" name="method" id="mCard" value="card" checked>
                            <span class="ck-method-body">
                                <span class="ck-method-name">
                                    <i class="fa-regular fa-credit-card"></i> Tarjeta de crédito / débito
                                </span>
                                <span class="ck-brands">
                                    <i class="fa-brands fa-cc-visa" data-brand="visa"></i>
                                    <i class="fa-brands fa-cc-mastercard" data-brand="mastercard"></i>
                                    <i class="fa-brands fa-cc-amex" data-brand="amex"></i>
                                    <i class="fa-brands fa-cc-diners-club" data-brand="diners"></i>
                                </span>
                            </span>
                        </label>
                        <label class="ck-method" id="labelYape">
                            <input class="ck-method-radio" type="radio" name="method" id="mYape" value="yape">
                            <span class="ck-method-body">
                                <span class="ck-method-name">Pago online con Yape</span>
                                <span class="ck-yape-logo ck-yape-logo-sm">Yape</span>
                            </span>
                        </label>
                    </div>

                    <form id="payForm">
                        <div id="cardFields">
                            <div class="mb-3">
                                <label class="ck-label">Número de tarjeta</label>
                                <div class="ck-card-input">
                                    <input type="text" inputmode="numeric" maxlength="19" class="form-control ck-input"
                                        id="cardNumber" placeholder="4111 1111 1111 1111" required>
                                    <i class="fa-brands ck-card-brand" id="cardBrandIcon"></i>
                                </div>
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
                            <button type="submit" class="ck-btn w-100 mt-2" id="payBtn">Pagar ${CK.ui.money(total)}</button>
                        </div>

                        <div id="yapeFields" style="display:none;">
                            <div class="ck-yape">
                                <div class="ck-yape-logo">Yape</div>
                                <label class="ck-label">Ingresa tu celular Yape</label>
                                <input type="tel" inputmode="numeric" maxlength="11" class="form-control ck-input ck-yape-phone"
                                    id="yapePhone" placeholder="999 999 999" disabled>
                                <label class="ck-label mt-3">Código de aprobación</label>
                                <div class="ck-yape-code" id="yapeCode">
                                    <input type="text" inputmode="numeric" maxlength="1" disabled>
                                    <input type="text" inputmode="numeric" maxlength="1" disabled>
                                    <input type="text" inputmode="numeric" maxlength="1" disabled>
                                    <input type="text" inputmode="numeric" maxlength="1" disabled>
                                    <input type="text" inputmode="numeric" maxlength="1" disabled>
                                    <input type="text" inputmode="numeric" maxlength="1" disabled>
                                </div>
                                <p class="ck-muted ck-yape-hint">Encuéntralo en el menú de Yape</p>
                                <button type="submit" class="ck-yape-btn" id="yapeBtn">Yapear ${CK.ui.money(total)}</button>
                            </div>
                        </div>

                        <div id="payMsg"></div>
                    </form>
                    <p class="ck-muted mt-2 mb-0">
                        Simulación: se aprueba cualquier pago, salvo tarjetas terminadas en 0000
                        o el código Yape 000000 (rechazo).
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

    const payForm = document.getElementById("payForm");
    const payMsg = document.getElementById("payMsg");
    const payBtn = document.getElementById("payBtn");
    const cardFields = document.getElementById("cardFields");
    const yapeFields = document.getElementById("yapeFields");
    const yapeBtn = document.getElementById("yapeBtn");
    const cardNumber = document.getElementById("cardNumber");
    const cardBrandIcon = document.getElementById("cardBrandIcon");
    const yapePhone = document.getElementById("yapePhone");
    const yapeCodeInputs = Array.from(document.querySelectorAll("#yapeCode input"));
    const brandsRow = document.querySelector(".ck-brands");

    function currentMethod() {
        return document.querySelector('input[name="method"]:checked').value;
    }

    // Detección de marca según los primeros dígitos del número.
    function detectBrand(value) {
        const n = value.replace(/\D/g, "");
        if (/^4/.test(n)) return "visa";
        if (/^(5[1-5]|222[1-9]|22[3-9]|2[3-6]|27[01]|2720)/.test(n)) return "mastercard";
        if (/^3[47]/.test(n)) return "amex";
        if (/^3(0[0-5]|[68])/.test(n)) return "diners";
        return null;
    }

    const BRAND_ICON = {
        visa: "fa-cc-visa",
        mastercard: "fa-cc-mastercard",
        amex: "fa-cc-amex",
        diners: "fa-cc-diners-club"
    };

    // Resalta la marca detectada en la fila superior y junto al input.
    function updateBrand() {
        const brand = detectBrand(cardNumber.value);
        brandsRow.querySelectorAll("i").forEach((i) => {
            i.classList.toggle("is-active", i.dataset.brand === brand);
        });
        cardBrandIcon.className = "fa-brands ck-card-brand";
        if (brand) {
            cardBrandIcon.classList.add(BRAND_ICON[brand], "is-" + brand, "show");
        }
    }

    // Alternar método de pago.
    function selectMethod(method) {
        const isYape = method === "yape";
        cardFields.style.display = isYape ? "none" : "block";
        yapeFields.style.display = isYape ? "block" : "none";
        document.getElementById("labelCard").classList.toggle("is-active", !isYape);
        document.getElementById("labelYape").classList.toggle("is-active", isYape);

        // Solo los campos visibles son obligatorios (evita bloquear el submit).
        cardFields.querySelectorAll("input").forEach((i) => (i.required = !isYape));
        yapePhone.disabled = !isYape;
        yapePhone.required = isYape;
        yapeCodeInputs.forEach((i) => {
            i.disabled = !isYape;
            i.required = isYape;
        });
    }

    document.querySelectorAll('input[name="method"]').forEach((r) => {
        r.addEventListener("change", () => selectMethod(currentMethod()));
    });

    // Formateo simple del número de tarjeta + marca.
    cardNumber.addEventListener("input", (e) => {
        let v = e.target.value.replace(/\D/g, "").slice(0, 16);
        e.target.value = v.replace(/(.{4})/g, "$1 ").trim();
        updateBrand();
    });
    document.getElementById("cardExp").addEventListener("input", (e) => {
        let v = e.target.value.replace(/\D/g, "").slice(0, 4);
        if (v.length >= 3) v = v.slice(0, 2) + "/" + v.slice(2);
        e.target.value = v;
    });

    // Celular Yape: 9 dígitos con espacios (999 999 999).
    yapePhone.addEventListener("input", (e) => {
        let v = e.target.value.replace(/\D/g, "").slice(0, 9);
        e.target.value = v.replace(/(\d{3})(?=\d)/g, "$1 ").trim();
    });

    // Código de aprobación Yape: 6 casillas con auto-avance.
    yapeCodeInputs.forEach((input, idx) => {
        input.addEventListener("input", (e) => {
            e.target.value = e.target.value.replace(/\D/g, "");
            if (e.target.value && idx < yapeCodeInputs.length - 1) {
                yapeCodeInputs[idx + 1].focus();
            }
        });
        input.addEventListener("keydown", (e) => {
            if (e.key === "Backspace" && !e.target.value && idx > 0) {
                yapeCodeInputs[idx - 1].focus();
            }
        });
        input.addEventListener("paste", (e) => {
            e.preventDefault();
            const digits = (e.clipboardData.getData("text") || "").replace(/\D/g, "").slice(0, 6);
            digits.split("").forEach((d, i) => (yapeCodeInputs[i].value = d));
            const next = Math.min(digits.length, yapeCodeInputs.length - 1);
            yapeCodeInputs[next].focus();
        });
    });

    function yapeCodeValue() {
        return yapeCodeInputs.map((i) => i.value).join("");
    }

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
        yapeBtn.disabled = busy;
        yapeBtn.classList.toggle("is-disabled", busy);
        payForm.querySelectorAll("input").forEach((i) => (i.disabled = busy));
        // Al reactivar, restaura qué campos van habilitados según el método.
        if (!busy) selectMethod(currentMethod());
    }

    payForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        payMsg.innerHTML = "";

        const method = currentMethod();

        // Validación específica de Yape (las casillas no usan required nativo bien).
        if (method === "yape") {
            if (yapePhone.value.replace(/\D/g, "").length !== 9) {
                payMsg.innerHTML = CK.ui.alertHTML("danger", "Ingresa un número de celular Yape válido (9 dígitos).");
                return;
            }
            if (yapeCodeValue().length !== 6) {
                payMsg.innerHTML = CK.ui.alertHTML("danger", "Ingresa el código de aprobación de 6 dígitos.");
                return;
            }
        }

        // Revalida reserva justo antes de cobrar.
        const s = CK.store.get();
        if (!CK.store.reservationActive(s)) {
            payMsg.innerHTML = CK.ui.alertHTML("danger", "Tu reserva expiró. No se realizó ningún cargo.");
            return;
        }

        setBusy(true);
        const payment = method === "yape"
            ? {
                method: "yape",
                phone: yapePhone.value.replace(/\D/g, ""),
                code: yapeCodeValue()
            }
            : {
                method: "card",
                cardNumber: cardNumber.value,
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
