const wallabies = {
  andrew: {
    name: "Andrew",
    alias: "",
    img: "/images/wallabies/andrew-feature.jpg",
    desc: "Unwitting star of The Yorkshire Vet, Andrew first came to The Firs as 'Kathleen' along with Kevin (†) in 2020.\
    His brief stint as Kathleen ended on a hot summers day when it was discovered he had a big pair of balls to match his fieldmate.\
    These balls became a problem though after he fathered 3 joeys in two years.\
    So, in October 2025, the vet came round with a dart gun and poor Andrew woke up missing the aforementioned balls.\
    He got the last laugh though because Jackie let him back in with his girls too soon so there are two more babies for 2026.",
    stats: {
      Age: "TBC",
      Weight: "TBC",
      "Favourite food": "TBC",
      Personality: "TBC",
    },
  },
  annie: {
    name: "Mary-Anne",
    alias: "Known as Annie",
    img: "/images/wallabies/annie-feature.png",
    desc: "Placeholder — add Annie's description here.",
    stats: {
      Age: "TBC",
      Weight: "TBC",
      "Favourite food": "TBC",
      Personality: "TBC",
    },
  },
  kathleen: {
    name: "Kathleen",
    alias: "",
    img: "/images/wallabies/kathleen-feature.png",
    desc: "Placeholder — add Kathleen's description here.",
    stats: {
      Age: "TBC",
      Weight: "TBC",
      "Favourite food": "TBC",
      Personality: "TBC",
    },
  },
  pinky: {
    name: "Pinky",
    alias: "",
    img: "/images/wallabies/pinky-feature.png",
    desc: "Placeholder — add Pinky's description here.",
    stats: {
      Age: "TBC",
      Weight: "TBC",
      "Favourite food": "TBC",
      Personality: "TBC",
    },
  },
  joey: {
    name: "Joey",
    alias: "Name to be confirmed",
    img: "/images/wallabies/joey-feature.png",
    desc: "Placeholder — add Joey's description here.",
    stats: {
      Age: "TBC",
      Weight: "TBC",
      "Favourite food": "TBC",
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
  document.getElementById("modal-desc").textContent = w.desc;
  document.getElementById("modal-stats").innerHTML = Object.entries(w.stats)
    .map(
      ([k, v]) => `
      <div class="stat">
        <div class="stat-label">${k}</div>
        <div class="stat-value">${v}</div>
      </div>`
    )
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
