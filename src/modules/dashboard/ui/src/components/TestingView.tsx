import type { Recorder, Scenario } from '../types';
import { ActionError } from './Feedback';
import { Method } from './Method';

interface TestingViewProps {
  recorder: Recorder;
  scenarios: Scenario[];
  scenarioName: string;
  selectedEvents: ReadonlySet<string>;
  pending: boolean;
  error: string;
  notice: string;
  onNameChange: (value: string) => void;
  onToggleEvent: (id: string) => void;
  onToggleRecording: () => void;
  onSave: () => void;
  onRun: (id: string) => void;
  onDelete: (id: string) => void;
}

/**
 * Preserves the Testing UI as a prop-only view until the feature is exposed again.
 *
 * @param props - Recorder state, scenarios, selections, form state, and actions.
 * @returns The Testing feature element.
 */
export function TestingView(props: TestingViewProps) {
  const {
    recorder, scenarios, scenarioName, selectedEvents, pending, error, notice,
    onNameChange, onToggleEvent, onToggleRecording, onSave, onRun, onDelete
  } = props;

  return (
    <div className="testing">
      <div className="testingHead">
        <div>
          <h1>Testing</h1>
          <p>Capture API workflows on Moksy, then replay the saved requests.</p>
        </div>
        <span className={`chip ${recorder.active ? 'warning' : 'neutral'}`}>
          {recorder.active ? '● Recording' : 'Recorder ready'}
        </span>
      </div>
      <div className="guide">
        {[
          ['1', 'Record', 'Use your frontend while it talks to Moksy.'],
          ['2', 'Review & save', 'Keep meaningful requests and their expected status.'],
          ['3', 'Run on Mock', 'Replay the calls through the active agreement.'],
          ['4', 'Real backend', 'Planned with explicit URL and credential safety.']
        ].map(([number, title, text]) => (
          <article key={number}>
            <b>{number}</b>
            <h3>{title}</h3>
            <p>{text}</p>
          </article>
        ))}
      </div>
      <ActionError message={error} />
      <div className="recordActions">
        <button className="primary" onClick={onToggleRecording} disabled={pending}>
          {recorder.active ? '■ Stop recording' : '◎ Start recording'}
        </button>
        {recorder.events.length > 0 && (
          <>
            <input
              value={scenarioName}
              onChange={(event) => onNameChange(event.target.value)}
              placeholder="Scenario name"
              aria-label="Scenario name"
              disabled={pending}
            />
            <button onClick={onSave} disabled={pending}>Save selected</button>
          </>
        )}
      </div>
      <h3>Captured requests</h3>
      <div className="eventList">
        {recorder.events.length ? recorder.events.map((event) => (
          <div className="event" key={event.id}>
            <input
              type="checkbox"
              checked={selectedEvents.has(event.id)}
              onChange={() => onToggleEvent(event.id)}
              aria-label={`Select ${event.method} ${event.url}`}
              disabled={pending}
            />
            <Method value={event.method} />
            <div>
              <strong className="mono">{event.url}</strong>
              <small>{new Date(event.capturedAt).toLocaleTimeString()}</small>
            </div>
            <span className={`chip ${event.status >= 400 ? 'danger' : 'success'}`}>{event.status}</span>
          </div>
        )) : (
          <div className="empty">No captured requests. Start recording, then use the connected application.</div>
        )}
      </div>
      <h3 className="savedTitle">Saved scenarios</h3>
      <div className="eventList">
        {scenarios.length ? scenarios.map((scenario) => (
          <div className="event" key={scenario.id}>
            <div>
              <strong>{scenario.name}</strong>
              <small>{scenario.steps.length} steps · {new Date(scenario.updatedAt).toLocaleString()}</small>
            </div>
            <button onClick={() => onRun(scenario.id)} disabled={pending}>▷ Run mock</button>
            <button className="dangerText" onClick={() => onDelete(scenario.id)} disabled={pending}>Delete</button>
          </div>
        )) : <div className="empty">No saved scenarios yet.</div>}
      </div>
      {notice && <div className="toast" role="status">{notice}</div>}
    </div>
  );
}
