window.MockSource = {
  multiplex: {
    thespace: { id: "thespace", label: "The Space Cinema", shortLabel: "The Space" },
    uci: { id: "uci", label: "UCI Cinema", shortLabel: "UCI" }
  },

  cities: {
    belpasso: {
      id: "belpasso",
      label: "Belpasso",
      multiplexId: "thespace"
    },
    catania: {
      id: "catania",
      label: "Catania",
      multiplexId: "thespace"
    },
    milano: {
      id: "milano",
      label: "Milano Bicocca",
      multiplexId: "uci"
    },
    roma: {
      id: "roma",
      label: "Roma",
      multiplexId: "uci"
    }
  },

  programmazione: {
    thespace: {
      belpasso: {
        "2026-02-12": {
          Avatar: ["09:15", "20:30", "03:40"]
        },
        "2026-02-13": {
          Avatar: ["09:15", "20:30", "02:55"]
        },
        "2026-02-14": {},
        "2026-02-15": {
          Avatar: ["09:15", "20:30", "03:40"]
        }
      },
      catania: {
        "2026-02-12": {
          Avatar: ["10:30", "11:30", "12:30", "13:30", "14:30", "15:30", "23:40"]
        }
      }
    },
    uci: {
      milano: {
        "2026-02-02": {
          Dune: ["21:00"]
        }
      }
    }
  }
};