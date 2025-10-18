import { INVENTORY_PRESET } from "@voxel/registry";
import { useClientState } from "@multiplayer/state";

const HUD = () => {
  const { username, session } = useClientState();

  return (
    <div className="hud-overlay" aria-hidden={!session}>
      <div className="hud-top-row">
        <div>
          <h2>CoMutiNy</h2>
          <p>Un espacio para crear juntos.</p>
        </div>
        <div>
          <p>Conectado como:</p>
          <strong>{username || "Invitado"}</strong>
        </div>
      </div>
      <div className="hud-bottom-row">
        <div className="inventory-bar" role="toolbar" aria-label="Inventario de bloques">
          {INVENTORY_PRESET.map((blockId, index) => (
            <div key={blockId} className={`inventory-slot ${index === 0 ? "active" : ""}`}>
              <span>{index + 1}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default HUD;
