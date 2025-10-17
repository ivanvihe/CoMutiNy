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
    <div className="map-toolbar" role="group" aria-label="Controles de zoom del mapa">
      <span className="map-toolbar__label">Zoom</span>
      <button
        type="button"
        className="control-pill control-pill--icon map-toolbar__button"
        onClick={onZoomOut}
        aria-label="Reducir zoom"
      >
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
      <button
        type="button"
        className="control-pill control-pill--icon map-toolbar__button"
        onClick={onZoomIn}
        aria-label="Aumentar zoom"
      >
        +
      </button>
      <button
        type="button"
        className="control-pill control-pill--reset map-toolbar__reset"
        onClick={onZoomReset}
        aria-label="Restablecer zoom"
      >
        {displayPercentage}%
      </button>
    </div>
  );
}
