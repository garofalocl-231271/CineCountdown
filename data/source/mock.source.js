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
        "2026-02-21": {
          Avatar: ["15:45", "15:50", "23:40"]
        },
        "2026-02-17": {
          Avatar: ["09:15", "20:35", "03:40"]
        },
        "2026-02-18": {
          Avatar: ["08:45", "20:35", "15:58"]
        },
        "2026-02-19": {
          Avatar: ["08:45", "20:35", "22:00"]
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
