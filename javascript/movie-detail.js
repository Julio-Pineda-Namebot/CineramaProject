const searchParams = new URLSearchParams(window.location.search);
const movieId = searchParams.get("id");

const movieBackground = {
    Scream7: "https://res.cloudinary.com/daioibryi/image/upload/v1773112931/scream7bg_yxxak5.webp",
    TheMonkey: "https://res.cloudinary.com/daioibryi/image/upload/v1773115518/img_2_guedbs.jpg",
    Hoppers: "https://res.cloudinary.com/daioibryi/image/upload/v1773117110/img_1_mqroxs.jpg",
    Nuremberg: "https://res.cloudinary.com/daioibryi/image/upload/v1773123273/img_4_dlpvgf.jpg",
    Hamnet: "https://res.cloudinary.com/daioibryi/image/upload/v1773291988/img_5_e9bjha.jpg",
    SonidoMuerte: "https://res.cloudinary.com/daioibryi/image/upload/v1773293229/img_6_asqvwg.jpg",
    Goat: "https://res.cloudinary.com/daioibryi/image/upload/v1773293343/img_7_zabzgq.jpg",
    CaminosCrimen: "https://res.cloudinary.com/daioibryi/image/upload/v1773293423/img_1_b7ml1a.webp",
    MejorEnemiga: "https://res.cloudinary.com/daioibryi/image/upload/v1773293608/PELICULA-Mi-Mejor-Enemiga-1_nqpgx0.jpg",
    FinDelMundo: "https://res.cloudinary.com/daioibryi/image/upload/v1773293652/img_2_mhvnzq.webp",
    Avatar: "https://res.cloudinary.com/daioibryi/image/upload/v1773293743/img_3_dezcvk.webp",
    Zootopia2: "https://res.cloudinary.com/daioibryi/image/upload/v1773293779/img_8_afw0ix.jpg"
};

const movieDetailBackground = document.getElementById("movieDetail");

movieDetailBackground.style.backgroundImage = `
    linear-gradient(var(--color-bg-dark-80)),
    url(${movieBackground[movieId]})
`;