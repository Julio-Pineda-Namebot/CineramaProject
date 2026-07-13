/*
 * Controlador: historial de compras del usuario.
 * Requiere sesión. Lista las órdenes y permite descargar cada ticket en PDF.
 */
(function () {
    CK.ui.injectAuthNav();

    if (!CK.auth.requireAuth("/pages/account/purchases.html")) return;

    const user = CK.auth.currentUser();
    document.getElementById("userLine").textContent = `${user.name} · ${user.email}`;

    const list = document.getElementById("list");
    const qrSource = document.getElementById("qrSource");
    const orders = CK.db.getPurchases(user.email);

    if (!orders.length) {
        list.innerHTML = CK.ui.alertHTML("info", "Aún no tienes compras.") +
            `<a class="ck-btn" href="/index.html">Ver cartelera</a>`;
        return;
    }

    list.innerHTML = orders.map((o) => `
        <div class="ck-history-item">
            <div>
                <div class="ck-ticket-code">${o.code}</div>
                <div>${o.movieTitle}</div>
                <div class="ck-muted">
                    ${o.cinemaName} · ${o.room} · ${o.dateDisplay} ${o.time} · Butacas ${o.seats.join(", ")}
                </div>
            </div>
            <div class="text-end">
                <div class="ck-ticket-code mb-2">${CK.ui.money(o.total)}</div>
                <button class="ck-btn ck-btn-outline" data-order="${o.id}">
                    <i class="fa-solid fa-file-arrow-down"></i> PDF
                </button>
            </div>
        </div>`).join("");

    list.querySelectorAll("[data-order]").forEach((btn) => {
        btn.addEventListener("click", async () => {
            const order = CK.db.getOrder(btn.dataset.order);
            if (!order) return;
            const ticket = await CK.api.createTicket(order);
            const qr = CK.ticket.renderQR(qrSource, ticket.qrPayload, 160);
            CK.ticket.downloadPDF(ticket, qr);
        });
    });
})();
