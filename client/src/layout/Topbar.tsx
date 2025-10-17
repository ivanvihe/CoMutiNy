import type { ChangeEvent } from 'react';
import MapToolbar from '../components/MapToolbar.jsx';

type TopbarProps = {
  alias?: string | null;
  connectionStatus: string;
  connectionLabel: string;
  mapName?: string | null;
  mapDescription?: string | null;
  biome?: string | null;
  totalCrew: number;
  mapIndex: number;
  mapCount: number;
  canNavigateMaps: boolean;
  onPrevMap?: () => void;
  onNextMap?: () => void;
  onOpenSettings?: () => void;
  controlsHint?: string;
  zoom: number;
  minZoom: number;
  maxZoom: number;
  step: number;
  zoomPercentage: number;
  onZoomChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
};

export default function Topbar({
  alias,
  connectionStatus,
  connectionLabel,
  mapName,
  mapDescription,
  biome,
  totalCrew,
  mapIndex,
  mapCount,
  canNavigateMaps,
  onPrevMap,
  onNextMap,
  onOpenSettings,
  controlsHint,
  zoom,
  minZoom,
  maxZoom,
  step,
  zoomPercentage,
  onZoomChange,
  onZoomIn,
  onZoomOut,
  onZoomReset
}: TopbarProps) {
  const safeMapIndex = Number.isFinite(mapIndex) ? mapIndex : 0;
  const safeMapCount = mapCount > 0 ? mapCount : 1;
  const navigationDisabled = !canNavigateMaps;
  const showSettings = typeof onOpenSettings === 'function';
  const showAlias = typeof alias === 'string' && alias.trim().length > 0;
  const hasDescription = typeof mapDescription === 'string' && mapDescription.trim().length > 0;
  const hasBiome = typeof biome === 'string' && biome.trim().length > 0;

  return (
    <div className="topbar" role="region" aria-label="Información general del mapa">
      <div className="topbar__section topbar__section--info">
        <span className="topbar__title">{mapName ?? 'Exploración'}</span>
        {hasDescription && <span className="topbar__subtitle">{mapDescription}</span>}
        <div className="topbar__meta">
          {hasBiome && <span className="topbar__meta-item">Bioma: {biome}</span>}
          <span className="topbar__meta-item">Usuarios: {totalCrew}</span>
        </div>
      </div>

      <div className="topbar__section topbar__section--status">
        {showAlias && <span className="topbar__alias">{alias}</span>}
        <span className={`topbar__chip topbar__chip--${connectionStatus}`} role="status">
          {connectionLabel}
        </span>
      </div>

      <div className="topbar__section topbar__section--controls">
        {controlsHint && <span className="topbar__hint">{controlsHint}</span>}

        <div className="topbar__group" role="group" aria-label="Cambiar de mapa">
          <button
            type="button"
            className="control-pill control-pill--icon"
            onClick={onPrevMap}
            aria-label="Mapa anterior"
            disabled={navigationDisabled || !onPrevMap}
          >
            ◀
          </button>
          <span className="topbar__counter">
            {safeMapIndex + 1}/{safeMapCount}
          </span>
          <button
            type="button"
            className="control-pill control-pill--icon"
            onClick={onNextMap}
            aria-label="Mapa siguiente"
            disabled={navigationDisabled || !onNextMap}
          >
            ▶
          </button>
        </div>

        <MapToolbar
          zoom={zoom}
          minZoom={minZoom}
          maxZoom={maxZoom}
          step={step}
          onZoomChange={onZoomChange}
          onZoomIn={onZoomIn}
          onZoomOut={onZoomOut}
          onZoomReset={onZoomReset}
          zoomPercentage={zoomPercentage}
        />

        {showSettings && (
          <button
            type="button"
            className="control-pill control-pill--emphasis"
            onClick={onOpenSettings}
            aria-label="Abrir preferencias"
          >
            Preferencias
          </button>
        )}
      </div>
    </div>
  );
}
