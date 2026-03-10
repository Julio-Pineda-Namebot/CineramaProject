const searchParams = new URLSearchParams(window.location.search);
const movieId = searchParams.get("id");

const movieBackground = {
    Scream7: "https://res.cloudinary.com/daioibryi/image/upload/v1773112931/scream7bg_yxxak5.webp",
    TheMonkey: "https://res.cloudinary.com/daioibryi/image/upload/v1773115518/img_2_guedbs.jpg",
    Hoppers: "https://res.cloudinary.com/daioibryi/image/upload/v1773117110/img_1_mqroxs.jpg",
    Nuremberg: "https://res.cloudinary.com/daioibryi/image/upload/v1773123273/img_4_dlpvgf.jpg"
};

const movieDetailBackground = document.getElementById("movieDetail");

movieDetailBackground.style.backgroundImage = `
    linear-gradient(var(--color-bg-dark-80)),
    url(${movieBackground[movieId]})
`;