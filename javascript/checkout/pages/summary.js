/*
 * Controlador: resumen de compra (vista previa antes del pago).
 * Reglas: requiere sesión, butacas y reserva vigente. Permite volver a
 * cambiar butacas o continuar al pago.
 */
(function () {
    CK.ui.injectAuthNav();
    CK.ui.renderStepper(document.getElementById("stepper"), "summary");

    const content = document.getElementById("content");
    const timerBar = document.getElementById("timerBar");
    const timerEl = document.getElementById("timer");
    const timerValue = document.getElementById("timerValue");

    const state = CK.store.get();

    // No se llega aquí sin función/butacas.
    if (!state.showtime || !state.selectedSeats.length) {
        window.location.href = "/index.html";
        return;
    }
    // Regla: no se permite comprar sin usuario autenticado.
    if (!CK.auth.isAuthenticated()) {
        CK.auth.requireAuth("/pages/checkout/summary.html");
        return;
    }
    // La reserva debe seguir vigente.
    if (!CK.store.reservationActive(state)) {
        expired();
        return;
    }

    function expired() {
        timerBar.style.display = "none";
        const movieId = state.movie ? state.movie.id : "";
        content.innerHTML =
            CK.ui.alertHTML("warning", "Tu reserva expiró. Debes seleccionar tus butacas nuevamente.") +
            `<a class="ck-btn" href="/pages/checkout/showtimes.html?movie=${movieId}">Elegir función</a>`;
    }

    const show = state.showtime;
    const user = CK.auth.currentUser();
    const total = CK.store.total(state);

    content.innerHTML = `
        <div class="row">
            <div class="col-12 col-lg-8 mb-3">
                <div class="ck-card">
                    <div class="ck-card-head">${show.movieTitle}</div>
                    <div class="ck-summary-row"><span class="ck-key">Cine</span><span>${show.cinemaName}</span></div>
                    <div class="ck-summary-row"><span class="ck-key">Sala</span><span>${show.room}</span></div>
                    <div class="ck-summary-row"><span class="ck-key">Fecha</span><span>${show.dateDisplay}</span></div>
                    <div class="ck-summary-row"><span class="ck-key">Hora</span><span>${show.time}</span></div>
                    <div class="ck-summary-row"><span class="ck-key">Formato</span><span>${show.format}</span></div>
                    <div class="ck-summary-row"><span class="ck-key">Butacas</span>
                        <span>${state.selectedSeats.join(", ")}</span></div>
                    <div class="ck-summary-row"><span class="ck-key">Precio unitario</span>
                        <span>${CK.ui.money(show.price)}</span></div>
                </div>
                <div class="ck-card">
                    <div class="ck-card-head">Titular de la compra</div>
                    <div class="ck-summary-row"><span class="ck-key">Nombre</span><span>${user.name}</span></div>
                    <div class="ck-summary-row"><span class="ck-key">Correo</span><span>${user.email}</span></div>
                </div>
            </div>
            <div class="col-12 col-lg-4">
                <div class="ck-card ck-summary">
                    <div class="ck-card-head">Total a pagar</div>
                    <div class="ck-summary-row">
                        <span class="ck-key">${state.selectedSeats.length} entrada(s)</span>
                        <span>${CK.ui.money(total)}</span>
                    </div>
                    <div class="ck-summary-row ck-summary-total">
                        <span>Total</span><span>${CK.ui.money(total)}</span>
                    </div>
                    <button class="ck-btn w-100 mt-3" id="payBtn">Continuar al pago</button>
                    <a class="ck-btn ck-btn-outline w-100 mt-2" href="/pages/checkout/seats.html">Cambiar butacas</a>
                </div>
            </div>
        </div>`;

    document.getElementById("payBtn").addEventListener("click", () => {
        window.location.href = "/pages/checkout/payment.html";
    });

    // Contador de la reserva compartido.
    timerBar.style.display = "block";
    CK.ui.startCountdown(state.expiresAt, {
        onTick: (ms) => {
            timerValue.textContent = CK.ui.mmss(ms);
            timerEl.classList.toggle("is-danger", ms <= 60000);
        },
        onExpire: () => {
            CK.api.releaseReservation(state.reservationId);
            CK.store.patch({ selectedSeats: [], reservationId: null, expiresAt: null });
            expired();
        }
    });
})();
