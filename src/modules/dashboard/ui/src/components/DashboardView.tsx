import type { ReactNode } from "react";
import type { DashboardTab, Workspace } from "../types";
import { ActionError } from "./Feedback";

interface DashboardViewProps {
  workspace: Workspace;
  endpointCount: number;
  tab: DashboardTab;
  notice: string;
  error: string;
  pending: boolean;
  children: ReactNode;
  onTabChange: (tab: DashboardTab) => void;
  onCopyUrl: () => void;
}

/**
 * Presents the dashboard shell using state supplied by its container.
 *
 * @param props - Workspace state, navigation state, content, and shell actions.
 * @returns The dashboard shell element.
 */
export function DashboardView(props: DashboardViewProps) {
  const {
    workspace,
    endpointCount,
    tab,
    notice,
    error,
    pending,
    children,
    onTabChange,
    onCopyUrl,
  } = props;

  return (
    <div className="screen">
      <div className="ambient">
        <i />
        Moksy · Local development environment
      </div>
      <section className="window">
        <header className="windowTop">
          <div className="brand">
            <div className="brandLogo">♙</div>
            <div>
              <strong>
                moksy<span>.</span>
              </strong>
              <small>developer dashboard</small>
            </div>
          </div>
          <div className="topActions">
            <span className="online">
              <i />
              Mock online
            </span>
            <button
              className="url"
              onClick={onCopyUrl}
              disabled={pending}
              aria-label="Copy mock URL"
            >
              {workspace.baseUrl.replace(/^https?:\/\//, "")} ⧉
            </button>
          </div>
        </header>
        <nav className="tabs" aria-label="Dashboard sections">
          <button
            className={tab === "setup" ? "active" : ""}
            onClick={() => onTabChange("setup")}
          >
            ☷ Setup
          </button>
          <button
            className={tab === "apis" ? "active" : ""}
            onClick={() => onTabChange("apis")}
          >
            ▣ APIs <b>{endpointCount}</b>
          </button>
        </nav>
        <div className="content">
          <ActionError message={error} />
          {children}
        </div>
        <footer>
          <span>ⓘ Local dashboard · Real Moksy runtime</span>
          <span>
            <i /> Agreement-driven mocking · Seed {workspace.seed.split(" ")[0]}
          </span>
        </footer>
      </section>
      {notice && (
        <div className="toast" role="status">
          {notice}
        </div>
      )}
    </div>
  );
}
