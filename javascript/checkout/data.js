/*
 * Catálogo mock del flujo de compra (Cinerama).
 * Reutiliza las películas y ciudades ya presentes en el sitio.
 * Estos datos representan la "base" de funciones; en un backend real
 * vendrían de la API. La disponibilidad de butacas se gestiona aparte
 * (ver db.js), este archivo sólo describe la oferta.
 */
window.CK = window.CK || {};

CK.data = (function () {
    // Películas en cartelera (id de carpeta -> metadatos)
    const MOVIES = {
        Scream7:       { id: "Scream7",       title: "Scream 7",                          poster: "/assets/img/movies/card/scream7.jpg" },
        TheMonkey:     { id: "TheMonkey",     title: "El Mono: La Maldición Regresa",     poster: "/assets/img/movies/card/themonkey.jpg" },
        Hoppers:       { id: "Hoppers",       title: "Hoppers: Operación Castor",         poster: "/assets/img/movies/card/hoppers.jpg" },
        Nuremberg:     { id: "Nuremberg",     title: "Nuremberg: El Juicio del Siglo",    poster: "/assets/img/movies/card/nuremberg.jpg" },
        Hamnet:        { id: "Hamnet",        title: "Hamnet",                            poster: "/assets/img/movies/card/hamnet.jpg" },
        SonidoMuerte:  { id: "SonidoMuerte",  title: "El sonido de la muerte",            poster: "/assets/img/movies/card/sonido-muerte.jpg" },
        Goat:          { id: "Goat",          title: "Goat: La Cabra que Cambió el Juego",poster: "/assets/img/movies/card/cabra.jpg" },
        CaminosCrimen: { id: "CaminosCrimen", title: "Caminos Del Crimen",                poster: "/assets/img/movies/card/caminos-crimen.jpg" },
        MejorEnemiga:  { id: "MejorEnemiga",  title: "Mi mejor enemiga",                  poster: "/assets/img/movies/card/mejor-enemiga.jpg" },
        FinDelMundo:   { id: "FinDelMundo",   title: "El día del fin del mundo",          poster: "/assets/img/movies/card/fin-del-mundo.jpg" },
        Avatar:        { id: "Avatar",        title: "Avatar: Fuego y Ceniza",            poster: "/assets/img/movies/card/avatar.jpg" },
        Zootopia2:     { id: "Zootopia2",     title: "Zootopia 2",                        poster: "/assets/img/movies/card/zootopia2.png" }
    };

    // Sedes (cines). Son exactamente las sedes de la sección "Sedes" (places.html).
    const CINEMAS = [
        { id: "ica-mp",    name: "Cinerama Ica - MegaPlaza",    city: "Ica" },
        { id: "ica-pl",    name: "Cinerama Ica - Plaza del Sol", city: "Ica" },
        { id: "lima",      name: "Cinerama Lima - Pacifico",    city: "Lima" },
        { id: "chimbote",  name: "Cinerama Chimbote",           city: "Chimbote" },
        { id: "cusco",     name: "Cinerama Cusco",              city: "Cusco" },
        { id: "cajamarca", name: "Cinerama Cajamarca",          city: "Cajamarca" },
        { id: "piura",     name: "Cinerama Piura",              city: "Piura" }
    ];

    // Formatos disponibles y su factor de precio (base S/ 15.00)
    const FORMATS = [
        { id: "2d-reg-dob", name: "2D Regular Doblada",     price: 22.50 },
        { id: "2d-reg-sub", name: "2D Regular Subtitulada", price: 22.50 },
        { id: "3d-dob",     name: "3D Doblada",             price: 28.00 },
        { id: "prime-sub",  name: "Prime Subtitulada",      price: 35.00 }
    ];

    const HORARIOS = ["14:30", "17:15", "20:00", "21:10", "22:00"];

    // Salas por cine
    const ROOMS = ["Sala 1", "Sala 2", "Sala 6"];

    // Layout de sala: filas A-J, 12 columnas con un pasillo entre col 6 y 7.
    const ROWS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
    const COLS = 12;
    const AISLE_AFTER = 6; // pasillo tras la columna 6

    function pad2(n) { return n < 10 ? "0" + n : "" + n; }

    // Genera las próximas N fechas (incluye hoy) en formato YYYY-MM-DD.
    function nextDates(n) {
        const out = [];
        const base = new Date();
        base.setHours(0, 0, 0, 0);
        for (let i = 0; i < n; i++) {
            const d = new Date(base);
            d.setDate(base.getDate() + i);
            out.push({
                value: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`,
                label: d.toLocaleDateString("es-PE", { weekday: "short", day: "2-digit", month: "short" }),
                display: `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`
            });
        }
        return out;
    }

    // Hash determinista para variar la oferta por película/cine sin aleatoriedad real.
    function hash(str) {
        let h = 0;
        for (let i = 0; i < str.length; i++) {
            h = (h << 5) - h + str.charCodeAt(i);
            h |= 0;
        }
        return Math.abs(h);
    }

    /*
     * Devuelve todas las funciones de una película.
     * Cada función tiene un id determinista, para que la disponibilidad de
     * butacas (db.js) sea estable entre recargas y consistente entre pestañas.
     */
    function getShowtimes(movieId) {
        const movie = MOVIES[movieId];
        if (!movie) return [];
        const dates = nextDates(5);
        const shows = [];
        // No todos los cines proyectan todas las películas: se elige un subconjunto estable.
        const cinemas = CINEMAS.filter((c, i) => (hash(movieId + c.id) % 3) !== 0 || i < 2);

        cinemas.forEach((cinema) => {
            dates.forEach((date) => {
                // Formatos ofrecidos por cine para esta película (subconjunto estable).
                const formats = FORMATS.filter((f) => (hash(movieId + cinema.id + f.id) % 5) !== 0);
                formats.forEach((format) => {
                    const room = ROOMS[hash(cinema.id + format.id) % ROOMS.length];
                    // Horarios ofrecidos (subconjunto estable, al menos 2).
                    const times = HORARIOS.filter((t, i) => (hash(movieId + cinema.id + format.id + t) % 3) !== 0 || i < 2);
                    times.forEach((time) => {
                        const id = `${movieId}_${cinema.id}_${date.value}_${format.id}_${time}`.replace(/[^A-Za-z0-9_]/g, "");
                        shows.push({
                            id,
                            movieId,
                            movieTitle: movie.title,
                            cinemaId: cinema.id,
                            cinemaName: cinema.name,
                            city: cinema.city,
                            room,
                            date: date.value,
                            dateLabel: date.label,
                            dateDisplay: date.display,
                            formatId: format.id,
                            format: format.name,
                            time,
                            price: format.price
                        });
                    });
                });
            });
        });
        return shows;
    }

    function getShowtime(showtimeId) {
        // El id contiene movieId como primer segmento.
        const movieId = showtimeId.split("_")[0];
        return getShowtimes(movieId).find((s) => s.id === showtimeId) || null;
    }

    // Estructura base del mapa de sala (sin estados; los estados vienen de db.js).
    function seatLayout() {
        const rows = ROWS.map((row) => {
            const seats = [];
            for (let c = 1; c <= COLS; c++) {
                seats.push({ id: `${row}${c}`, row, col: c });
            }
            return { row, seats };
        });
        return { rows, cols: COLS, aisleAfter: AISLE_AFTER };
    }

    return {
        MOVIES, CINEMAS, FORMATS, HORARIOS, ROOMS,
        getMovie: (id) => MOVIES[id] || null,
        getShowtimes,
        getShowtime,
        seatLayout,
        _hash: hash
    };
})();
