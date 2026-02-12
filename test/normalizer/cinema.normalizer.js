window.CinemaNormalizer = (function () {
  function buildMaps(source) {
    const MULTIPLEX_MAP = {};
    const CITY_MAP = {};

    Object.values(source.multiplex).forEach(m => {
      MULTIPLEX_MAP[m.label] = m.id;
    });

    Object.values(source.cities).forEach(c => {
      const multiplexLabel =
        source.multiplex[c.multiplexId]?.label;

      if (!multiplexLabel) return;

      const uiLabel = `${multiplexLabel} • ${c.label}`;

      CITY_MAP[uiLabel] = {
        id: c.id,
        multiplex: c.multiplexId
      };
    });

    return { MULTIPLEX_MAP, CITY_MAP };
  }

  return { buildMaps };
})();