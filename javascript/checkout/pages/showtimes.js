/*
 * Controlador: selección de función.
 * Muestra las funciones disponibles de una película agrupadas por
 * cine, fecha y formato. Al elegir un horario continúa al selector de butacas.
 */
(function () {
    CK.ui.injectAuthNav();
    CK.ui.renderStepper(document.getElementById("stepper"), "showtimes");

    const params = new URLSearchParams(window.location.search);
    const movieId = params.get("movie");
    const movie = CK.data.getMovie(movieId);

    if (!movie) {
        window.location.href = "/index.html";
        return;
    }

    // Cabecera de película
    document.getElementById("movieHeader").innerHTML = `
        <div class="col-auto">
            <img src="${movie.poster}" alt="${movie.title}" width="90"
                 style="border-radius: var(--radius-btn);">
        </div>
        <div class="col">
            <p class="ck-muted mb-0">Compra de entradas</p>
            <h1 class="ck-title h3 mb-0">${movie.title}</h1>
        </div>`;

    const cityFilter = document.getElementById("cityFilter");
    const formatFilter = document.getElementById("formatFilter");
    const dateChips = document.getElementById("dateChips");
    const container = document.getElementById("showtimesContainer");

    let allShows = [];
    let selectedDate = null;

    function unique(arr) { return Array.from(new Set(arr)); }

    function populateFilters() {
        // Filtro por sede (nombre del cine), tal como aparecen en la sección Sedes.
        const sedes = unique(allShows.map((s) => s.cinemaName));
        sedes.forEach((c) => {
            const o = document.createElement("option");
            o.value = c; o.textContent = c;
            cityFilter.appendChild(o);
        });
        const formats = unique(allShows.map((s) => s.format));
        formats.forEach((f) => {
            const o = document.createElement("option");
            o.value = f; o.textContent = f;
            formatFilter.appendChild(o);
        });
    }

    function renderDateChips() {
        const dates = [];
        const seen = new Set();
        allShows.forEach((s) => {
            if (!seen.has(s.date)) {
                seen.add(s.date);
                dates.push({ value: s.date, label: s.dateLabel });
            }
        });
        dates.sort((a, b) => a.value.localeCompare(b.value));
        if (!selectedDate && dates.length) selectedDate = dates[0].value;

        dateChips.innerHTML = "";
        dates.forEach((d) => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "ck-date" + (d.value === selectedDate ? " active" : "");
            btn.textContent = d.label;
            btn.addEventListener("click", () => {
                selectedDate = d.value;
                renderDateChips();
                renderShows();
            });
            dateChips.appendChild(btn);
        });
    }

    function renderShows() {
        const sede = cityFilter.value;
        const format = formatFilter.value;
        const shows = allShows.filter((s) =>
            s.date === selectedDate &&
            (!sede || s.cinemaName === sede) &&
            (!format || s.format === format)
        );

        if (!shows.length) {
            container.innerHTML = CK.ui.alertHTML("warning", "No hay funciones disponibles con los filtros seleccionados.");
            return;
        }

        // Agrupar por cine y, dentro de cada cine, por formato.
        const byCinema = {};
        shows.forEach((s) => {
            (byCinema[s.cinemaId] = byCinema[s.cinemaId] || { cinema: s, formats: {} });
            (byCinema[s.cinemaId].formats[s.formatId] = byCinema[s.cinemaId].formats[s.formatId] || { format: s, times: [] })
                .times.push(s);
        });

        container.innerHTML = Object.values(byCinema).map((group) => {
            const c = group.cinema;
            const formatsHTML = Object.values(group.formats).map((fg) => {
                const f = fg.format;
                const times = fg.times.sort((a, b) => a.time.localeCompare(b.time)).map((s) => `
                    <button type="button" class="ck-time" data-show="${s.id}">
                        ${s.time}
                    </button>`).join("");
                return `
                    <div class="ck-format-block">
                        <div class="ck-format-name">${f.format} · ${f.room} · ${CK.ui.money(f.price)}</div>
                        <div>${times}</div>
                    </div>`;
            }).join("");
            return `
                <div class="ck-group">
                    <div class="ck-group-title">${c.cinemaName}</div>
                    <div class="ck-group-sub"><i class="fa-solid fa-location-dot"></i> ${c.city}</div>
                    ${formatsHTML}
                </div>`;
        }).join("");

        container.querySelectorAll(".ck-time").forEach((btn) => {
            btn.addEventListener("click", () => selectShow(btn.dataset.show));
        });
    }

    function selectShow(showId) {
        const show = allShows.find((s) => s.id === showId);
        if (!show) return;
        // Inicia/actualiza el estado del checkout. Reinicia butacas/reserva previa.
        CK.store.patch({
            movie: { id: movie.id, title: movie.title, poster: movie.poster },
            cinema: { id: show.cinemaId, name: show.cinemaName, city: show.city },
            showtime: show,
            room: show.room,
            selectedSeats: [],
            reservationId: null,
            expiresAt: null,
            paymentStatus: null,
            order: null,
            ticket: null
        });
        window.location.href = "/pages/checkout/seats.html";
    }

    async function init() {
        container.innerHTML = `<div class="ck-spinner"></div>`;
        allShows = await CK.api.getShowtimes(movieId);
        if (!allShows.length) {
            container.innerHTML = CK.ui.alertHTML("warning", "Esta película aún no tiene funciones programadas.");
            return;
        }
        populateFilters();
        renderDateChips();
        renderShows();
        cityFilter.addEventListener("change", renderShows);
        formatFilter.addEventListener("change", renderShows);
    }

    init();
})();
