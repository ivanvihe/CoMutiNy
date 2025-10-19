import { useEffect } from 'react';
import type { BuildPlacementStatus } from '../../buildings/types';
import './BuildStatusPanel.css';

export interface BuildStatusPanelProps {
  status: (BuildPlacementStatus & { timestamp: number }) | null;
  onDismiss: () => void;
}

export const BuildStatusPanel = ({ status, onDismiss }: BuildStatusPanelProps) => {
  useEffect(() => {
    if (!status) {
      return undefined;
    }

    const timeout = window.setTimeout(onDismiss, 4500);
    return () => window.clearTimeout(timeout);
  }, [status, onDismiss]);

  if (!status) {
    return null;
  }

  return (
    <div className={`build-status build-status--${status.status}`} role="status">
      {status.message}
    </div>
  );
};

export default BuildStatusPanel;
