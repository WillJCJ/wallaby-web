function calculateAge(dobString) {
  if (!dobString || dobString === "TBC") return "TBC";
  const birthDate = new Date(dobString);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

const wallabies = {
  andrew: {
    name: "Andrew",
    alias: "",
    img: "/images/wallabies/andrew-feature.jpg",
    desc: "Unwitting star of The Yorkshire Vet, Andrew first came to The Firs as 'Kathleen' along with Kevin<sup>†</sup> in 2020.\
    His brief stint as Kathleen ended on a hot summers day when it was discovered he had a big pair of balls to match his fieldmate.\
    These balls became a problem though after he fathered 3 joeys in two years.\
    So, in October 2025, the vet came round with a dart gun and poor Andrew woke up missing the aforementioned balls.\
    He got the last laugh though because Jackie let him back in with his girls too soon so there are two more babies for 2026.",
    stats: {
      DoB: "2018-03-01", // Estimated
      Weight: "0.2 Shetland ponies",
      "Favourite food": "Rich Tea biscuits (preferably McVities)",
      Personality: "Friendly",
    },
  },
  annie: {
    name: "Mary-Anne",
    alias: "Known as Annie",
    img: "/images/wallabies/annie-feature.png",
    desc: "Placeholder — add Annie's description here.",
    stats: {
      DoB: "2022-01-01", // Estimated 
      Weight: "2.5 Spaniels",
      "Favourite food": "Lettuce",
      Personality: "Cautious",
    },
  },
  kathleen: {
    name: "Kathleen",
    alias: "",
    img: "/images/wallabies/kathleen-feature.png",
    desc: "Kathleen .",
    stats: {
      DoB: "2023-04-01", // First spotted in the pouch around March/April
      Weight: "24 Cabbages",
      "Favourite food": "Ginger Nuts",
      Personality: "Timid",
    },
  },
  pinky: {
    name: "Pinky",
    alias: "",
    img: "/images/wallabies/pinky-feature.png",
    desc: "A genetic freak of nautre, Pinky hopes for a warm summer or it might get a bit chilly in that white coat!\
    Pinky is slightly unnerved by all the talk of wallaby balls in the other bios.",
    stats: {
      DoB: "2026-02-01",
      Weight: "3 tins of beans",
      Personality: "Lazy",
    },
  },
  joey: {
    name: "TBC",
    alias: "Joey",
    img: "/images/wallabies/joey-feature.png",
    desc: "The as-yet-unnamed baby of Kathleen, we'll call them Joey for now.\
    Joey asks that you don't look too closely at their family tree or you will see Andrew appear twice.\
    Joey hopes that they turn out to be a girl wallaby so their balls don't suffer the same fate as Andrew's",
    stats: {
      DoB: "2026-02-15",
      Weight: "2 Victoria sponge cakes",
      Personality: "TBC",
    },
  },
};

function openModal(id) {
  const w = wallabies[id];
  document.getElementById("modal-img").src = w.img;
  document.getElementById("modal-img").alt = w.name;
  document.getElementById("modal-name").textContent = w.name;
  const alias = document.getElementById("modal-alias");
  alias.textContent = w.alias;
  alias.style.display = w.alias ? "block" : "none";
  document.getElementById("modal-desc").innerHTML = w.desc;
  document.getElementById("modal-stats").innerHTML = Object.entries(w.stats)
    .map(([k, v]) => {
      // Swap out DoB for Age, leave it as k, v for all else
      const label = k === "DoB" ? "Age" : k;
      const value = k === "DoB" ? calculateAge(v) : v;
      return `
        <div class="stat">
          <div class="stat-label">${label}</div>
          <div class="stat-value">${value}</div>
        </div>`;
    })
    .join("");
  document.getElementById("overlay").classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeModal(e) {
  if (!e || e.target === document.getElementById("overlay")) {
    document.getElementById("overlay").classList.remove("open");
    document.body.style.overflow = "";
  }
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeModal();
});
