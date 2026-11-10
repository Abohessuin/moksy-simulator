import { useState } from 'react';
import {
  getMoksyServerOrigin,
  type MoksyConnectionConfig
} from '../modules/config/server-address.js';
import { DevtoolsView } from './components/DevtoolsView.js';

export interface MoksyDevtoolsProps {
  /** Host and port from the same configuration used to start Moksy. */
  config: MoksyConnectionConfig;
  initialIsOpen?: boolean;
  position?: 'bottom-left' | 'bottom-right';
}

/**
 * Owns launcher state and resolves the iframe address from the server configuration.
 * Consumers should mount this during development and pass their simulator config.
 *
 * @param props - Devtools configuration, initial state, and launcher position.
 * @returns The floating Moksy launcher and, when open, its dashboard overlay.
 */
export function MoksyDevtools({
  config,
  initialIsOpen = false,
  position = 'bottom-right'
}: MoksyDevtoolsProps) {
  const [open, setOpen] = useState(initialIsOpen);
  const dashboardUrl = `${getMoksyServerOrigin(config)}/_moksy`;

  return (
    <DevtoolsView
      open={open}
      position={position}
      dashboardUrl={dashboardUrl}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
    />
  );
}
