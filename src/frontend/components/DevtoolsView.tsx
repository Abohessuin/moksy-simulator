import { devtoolsStyles } from "../styles.js";

interface DevtoolsViewProps {
  open: boolean;
  position: "bottom-left" | "bottom-right";
  dashboardUrl: string;
  onOpen: () => void;
  onClose: () => void;
}

/**
 * Presents the floating launcher and iframe overlay using container-supplied props.
 *
 * @param props - Open state, placement, iframe URL, and interaction callbacks.
 * @returns The launcher and optional dashboard dialog.
 */
export function DevtoolsView({
  open,
  position,
  dashboardUrl,
  onOpen,
  onClose,
}: DevtoolsViewProps) {
  return (
    <>
      <button
        type="button"
        aria-label="Open Moksy Devtools"
        aria-expanded={open}
        title="Moksy Devtools"
        onClick={onOpen}
        style={{
          ...devtoolsStyles.launcher,
          ...(position === "bottom-left" ? { left: 20 } : { right: 20 }),
        }}
      >
        M
      </button>

      {open && (
        <div
          style={devtoolsStyles.overlay}
          role="dialog"
          aria-modal="true"
          aria-label="Moksy Devtools"
        >
          <div style={devtoolsStyles.panel}>
            <button
              type="button"
              aria-label="Close Moksy Devtools"
              onClick={onClose}
              style={devtoolsStyles.closeButton}
            >
              ×
            </button>
            <iframe
              title="Moksy dashboard"
              src={dashboardUrl}
              style={devtoolsStyles.frame}
            />
          </div>
        </div>
      )}
    </>
  );
}
