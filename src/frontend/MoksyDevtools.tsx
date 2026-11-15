import { useState } from "react";
import { getMoksyServerOrigin } from "../modules/config/server-address.js";
import { DevtoolsView } from "./components/DevtoolsView.js";

/**
 * Owns launcher state and connects to Moksy at its standard local address.
 *
 * @returns The floating Moksy launcher and, when open, its dashboard overlay.
 */
export function MoksyDevtools() {
  const [open, setOpen] = useState(false);
  const dashboardUrl = `${getMoksyServerOrigin({})}/_moksy`;

  return (
    <DevtoolsView
      open={open}
      dashboardUrl={dashboardUrl}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
    />
  );
}
