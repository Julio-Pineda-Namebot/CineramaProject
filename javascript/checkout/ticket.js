/*
 * Generación del ticket digital: código QR (qrcodejs) y PDF (jsPDF).
 * Ambas librerías se cargan por CDN en las páginas que lo requieren,
 * siguiendo el mismo patrón que Bootstrap/Swiper en el proyecto.
 */
window.CK = window.CK || {};

CK.ticket = (function () {
    // Dibuja un QR dentro de `container` y devuelve su dataURL (para el PDF).
    function renderQR(container, text, size) {
        container.innerHTML = "";
        // eslint-disable-next-line no-undef
        new QRCode(container, {
            text: text,
            width: size || 160,
            height: size || 160,
            correctLevel: QRCode.CorrectLevel.M
        });
        const canvas = container.querySelector("canvas");
        try {
            return canvas ? canvas.toDataURL("image/png") : null;
        } catch (e) {
            return null;
        }
    }

    // Construye y descarga el PDF del ticket.
    function downloadPDF(ticket, qrDataUrl) {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ unit: "mm", format: "a5" });
        const left = 16;
        let y = 20;

        doc.setFillColor(0, 0, 0);
        doc.rect(0, 0, 148, 14, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(16);
        doc.text("CINERAMA", left, 9.5);
        doc.setFontSize(9);
        doc.text("Entrada de cine", 132, 9.5, { align: "right" });

        doc.setTextColor(0, 0, 0);
        y = 26;
        doc.setFontSize(11);
        doc.text("Código de compra", left, y);
        doc.setFontSize(14);
        doc.setFont(undefined, "bold");
        doc.text(ticket.code, left, y + 7);
        doc.setFont(undefined, "normal");

        const rows = [
            ["Película", ticket.movie],
            ["Cine", ticket.cinema],
            ["Sala", ticket.room],
            ["Formato", ticket.format],
            ["Fecha", ticket.date],
            ["Hora", ticket.time],
            ["Butacas", ticket.seats.join(", ")],
            ["Total", "S/ " + Number(ticket.total).toFixed(2)]
        ];
        y = y + 16;
        doc.setFontSize(11);
        rows.forEach((r) => {
            doc.setTextColor(120, 120, 120);
            doc.text(r[0], left, y);
            doc.setTextColor(0, 0, 0);
            doc.text(String(r[1]), left + 34, y);
            y += 8;
        });

        if (qrDataUrl) {
            doc.addImage(qrDataUrl, "PNG", 96, 46, 40, 40);
            doc.setFontSize(8);
            doc.setTextColor(120, 120, 120);
            doc.text("Presenta este QR en puerta", 116, 90, { align: "center" });
        }

        doc.setFontSize(8);
        doc.setTextColor(120, 120, 120);
        doc.text("Cinerama S.A. | RUC 20494191637", left, 195);

        doc.save(`ticket-${ticket.code}.pdf`);
    }

    return { renderQR, downloadPDF };
})();
