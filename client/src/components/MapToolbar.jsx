export default function MapToolbar({
  zoom,
  minZoom,
  maxZoom,
  step,
  zoomPercentage,
  onZoomChange,
  onZoomIn,
  onZoomOut,
  onZoomReset
}) {
  const displayPercentage = Number.isFinite(zoomPercentage) ? zoomPercentage : Math.round((zoom ?? 1) * 100);

  return (
    <div className="hud-card map-toolbar" role="group" aria-label="Controles de zoom del mapa">
      <div className="map-toolbar__header">
        <span className="hud-card__title">Zoom</span>
        <button
          type="button"
          className="hud-button map-toolbar__reset"
          onClick={onZoomReset}
          aria-label="Restablecer zoom"
        >
          {displayPercentage}%
        </button>
      </div>
      <div className="map-toolbar__controls">
        <button type="button" className="hud-button" onClick={onZoomOut} aria-label="Reducir zoom">
          −
        </button>
        <input
          type="range"
          className="map-toolbar__slider"
          min={minZoom}
          max={maxZoom}
          step={step}
          value={zoom}
          onChange={onZoomChange}
          aria-label="Nivel de zoom"
        />
        <button type="button" className="hud-button" onClick={onZoomIn} aria-label="Aumentar zoom">
          +
        </button>
      </div>
      <p className="map-toolbar__hint">Atajos: +/- · 0 para reiniciar</p>
    </div>
  );
}
