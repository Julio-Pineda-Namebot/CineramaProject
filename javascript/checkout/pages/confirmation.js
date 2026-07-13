/*
 * Controlador: confirmación de compra.
 * Genera el ticket digital (con QR), simula el envío del correo con el PDF
 * adjunto y ofrece la descarga del PDF. Cierra el flujo del checkout.
 */
(function () {
    CK.ui.injectAuthNav();
    CK.ui.renderStepper(document.getElementById("stepper"), "confirmation");

    const content = document.getElementById("content");
    const qrSource = document.getElementById("qrSource");
    const state = CK.store.get();
    const order = state.order;

    if (!order) {
        window.location.href = "/index.html";
        return;
    }

    let qrDataUrl = null;
    let ticket = null;

    async function init() {
        content.innerHTML = `<div class="ck-spinner"></div>`;

        // POST /tickets
        ticket = await CK.api.createTicket(order);
        CK.store.patch({ ticket });

        render();

        // QR (canvas oculto -> dataURL para pantalla y PDF)
        qrDataUrl = CK.ticket.renderQR(qrSource, ticket.qrPayload, 160);
        const qrBox = document.getElementById("qrBox");
        if (qrDataUrl && qrBox) {
            qrBox.innerHTML = `<img src="${qrDataUrl}" alt="Código QR" width="160" height="160">`;
        }

        // POST /notifications/email (una sola vez por orden)
        const emailState = CK.store.get();
        if (!emailState.emailSent) {
            await CK.api.sendEmail({
                to: order.user.email,
                subject: `Tu compra en Cinerama - ${order.code}`,
                ticket,
                attachment: `ticket-${order.code}.pdf`
            });
            CK.store.patch({ emailSent: true });
            const note = document.getElementById("emailNote");
            if (note) {
                note.innerHTML = CK.ui.alertHTML("success",
                    `<i class="fa-solid fa-envelope-circle-check"></i> Enviamos la confirmación y tu ticket a <strong>${order.user.email}</strong>.`);
            }
        }
    }

    function render() {
        content.innerHTML = `
            <div class="text-center mb-4">
                <div class="ck-pay-icon is-success"><i class="fa-solid fa-circle-check"></i></div>
                <h1 class="ck-title h4 mb-1">¡Compra confirmada!</h1>
                <p class="ck-subtitle">Tu pago fue aprobado y tus butacas quedaron aseguradas.</p>
            </div>

            <div id="emailNote"></div>

            <div class="ck-ticket mb-3">
                <div class="ck-ticket-head">
                    <div>
                        <div style="font-size:.75rem; opacity:.8;">Código de compra</div>
                        <div class="ck-ticket-code">${ticket.code}</div>
                    </div>
                    <img src="/assets/icons/logo.png" alt="Cinerama" width="120">
                </div>
                <div class="ck-ticket-body">
                    <div class="ck-ticket-data">
                        <div class="ck-summary-row"><span class="ck-key">Película</span><span>${ticket.movie}</span></div>
                        <div class="ck-summary-row"><span class="ck-key">Cine</span><span>${ticket.cinema}</span></div>
                        <div class="ck-summary-row"><span class="ck-key">Sala</span><span>${ticket.room}</span></div>
                        <div class="ck-summary-row"><span class="ck-key">Formato</span><span>${ticket.format}</span></div>
                        <div class="ck-summary-row"><span class="ck-key">Fecha</span><span>${ticket.date}</span></div>
                        <div class="ck-summary-row"><span class="ck-key">Hora</span><span>${ticket.time}</span></div>
                        <div class="ck-summary-row"><span class="ck-key">Butacas</span><span>${ticket.seats.join(", ")}</span></div>
                        <div class="ck-summary-row ck-summary-total"><span>Total</span><span>${CK.ui.money(ticket.total)}</span></div>
                    </div>
                    <div class="ck-ticket-qr">
                        <div id="qrBox"><div class="ck-spinner"></div></div>
                        <div class="ck-muted mt-2">Escanéalo en puerta</div>
                    </div>
                </div>
            </div>

            <div class="ck-dl-row">
                <button class="ck-btn" id="pdfBtn"><i class="fa-solid fa-file-arrow-down"></i> Descargar PDF</button>
                <a class="ck-btn ck-btn-outline" href="/pages/account/purchases.html">Mis compras</a>
                <a class="ck-btn ck-btn-outline" href="/index.html">Volver a la cartelera</a>
            </div>`;

        document.getElementById("pdfBtn").addEventListener("click", () => {
            CK.ticket.downloadPDF(ticket, qrDataUrl);
        });
    }

    init();
})();
