const FLAGS = {
  DEBUG: true,
  NOTIFICATIONS: true,
  TEST_TOOLS: false,
  LOGS: false
};



window.CinemaAdapter = (() => {
  const mock = window.MockSource;

  /* =======================
     MULTIPLEX
  ======================= */

  function getMultiplexList() {
    return Object.values(mock.multiplex).map(m => ({
      id: m.id,
      label: m.label
    }));
  }

  function getMultiplexById(id) {
    return mock.multiplex[id] || null;
  }

  function getMultiplexIdFromUI(label) {
    const entry = Object.values(mock.multiplex)
      .find(m => m.label === label);
    return entry?.id || null;
  }

  /* =======================
     CITIES
  ======================= */

  function getCitiesByMultiplex(multiplexId) {
    return Object.values(mock.cities)
      .filter(c => c.multiplexId === multiplexId)
      .map(c => {
        const m = mock.multiplex[multiplexId];
        return {
          id: c.id,
          label: `${m.shortLabel} • ${c.label}`
        };
      });
  }

  function getCityById(cityId) {
    return mock.cities[cityId] || null;
  }

  function getCityInfoFromUI(label) {
    const city = Object.values(mock.cities).find(c => {
      const m = mock.multiplex[c.multiplexId];
      return `${m.shortLabel} • ${c.label}` === label;
    });

    if (!city) return null;

    return {
      id: city.id,
      multiplexId: city.multiplexId
    };
  }

  /* =======================
     PROGRAMMAZIONE
  ======================= */

  function getProgrammazioneByCityId(multiplexId, cityId) {
    return (
      mock.programmazione?.[multiplexId]?.[cityId] || {}
    );
  }

  function getProgrammazioneByCityUI(cityLabel) {
    const info = getCityInfoFromUI(cityLabel);
    if (!info) return {};
    return getProgrammazioneByCityId(
      info.multiplexId,
      info.id
    );
  }

  return {
    getMultiplexList,
    getMultiplexIdFromUI,
    getMultiplexById,
    getCitiesByMultiplex,
    getCityInfoFromUI,
    getCityById,
    getProgrammazioneByCityId,
    getProgrammazioneByCityUI
  };
})();
