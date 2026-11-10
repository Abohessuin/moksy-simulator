import type { Workspace } from '../types';

interface SetupViewProps {
  workspace: Workspace;
  recordCount: number;
  pending: boolean;
  onReset: () => void;
}

interface StatProps {
  label: string;
  value: string;
  good?: boolean;
  mono?: boolean;
}

/**
 * Renders one labeled runtime value.
 *
 * @param props - Label, value, and optional status or monospace styling.
 * @returns The runtime statistic element.
 */
function Stat({ label, value, good, mono }: StatProps) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong className={`${good ? 'goodText' : ''} ${mono ? 'mono' : ''}`}>{value}</strong>
    </div>
  );
}

/**
 * Displays configured source files and the runtime snapshot.
 *
 * @param props - Workspace data, record count, pending state, and reset callback.
 * @returns The Setup screen element.
 */
export function SetupView({ workspace, recordCount, pending, onReset }: SetupViewProps) {
  return (
    <div className="setupWrap">
      <div className="heading">
        <div>
          <h1>Workspace setup</h1>
          <p>Review the two files that define your mock environment.</p>
        </div>
        <span className="chip neutral">Local workspace</span>
      </div>
      <div className="setupGrid">
        <article className="panel">
          <h2>▤ Source files</h2>
          <div className="fileBlock">
            <span className="fileIcon config">&lt;/&gt;</span>
            <div>
              <strong>{workspace.configName}</strong>
              <small>Runtime configuration · JSON</small>
            </div>
          </div>
          <div className="fileBlock">
            <span className="fileIcon">▤</span>
            <div>
              <strong>{workspace.agreementName}</strong>
              <small>API contract document · DOCX</small>
            </div>
          </div>
          <div className="note">
            <b>Reload current workspace.</b> Reset response controls and regenerate in-memory data
            from the configured seed. Saved scenarios remain available.
          </div>
        </article>
        <article className="panel">
          <h2>⌁ Current runtime</h2>
          <Stat label="Mock server" value="● Running" good />
          <Stat label="Base URL" value={workspace.baseUrl} mono />
          <Stat label="Port" value={String(workspace.port)} />
          <Stat label="Seed" value={workspace.seed} />
          <Stat label="Stateful collections" value={`${workspace.collectionCount} · ${recordCount} records`} />
          <Stat label="Endpoints" value={`${workspace.endpointCount} discovered`} />
        </article>
      </div>
      <div className="bottomActions">
        <span>Mock data is ephemeral; saved QA scenarios are persistent artifacts.</span>
        <button className="primary" onClick={onReset} disabled={pending}>
          {pending ? 'Reloading…' : '↻ Reload workspace'}
        </button>
      </div>
    </div>
  );
}
