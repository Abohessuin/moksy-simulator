import type { Endpoint } from '../types';
import { ActionError } from './Feedback';
import { Method } from './Method';

interface EndpointDetailsViewProps {
  endpoint: Endpoint;
  status: number;
  pending: boolean;
  error: string;
  onStatusChange: (status: number) => void;
  onReset: () => void;
  onApply: () => void;
}

/**
 * Displays the request contract and controlled response selector for one endpoint.
 *
 * @param props - Endpoint data, draft response status, pending state, and actions.
 * @returns The endpoint details element.
 */
export function EndpointDetailsView(props: EndpointDetailsViewProps) {
  const { endpoint, status, pending, error, onStatusChange, onReset, onApply } = props;
  return (
    <>
      <div className="endpointTitle">
        <div>
          <Method value={endpoint.method} />
          <h1 className="mono">{endpoint.path}</h1>
        </div>
        <span className={`chip ${endpoint.override ? 'warning' : 'success'}`}>
          {endpoint.override ? `Override ${endpoint.override}` : 'Normal behavior'}
        </span>
      </div>
      <p className="caption">
        {endpoint.name} · {endpoint.collection ? (
          <>Collection: <b>{endpoint.collection}</b></>
        ) : <b>Independent response</b>} · Success: <b>{endpoint.successStatus}</b>
      </p>
      <h3>Request contract</h3>
      <div className="tableWrap">
        <table>
          <thead>
            <tr>
              <th>Field</th>
              <th>Location</th>
              <th>Type</th>
              <th>Required</th>
              <th>Behavior</th>
            </tr>
          </thead>
          <tbody>
            {endpoint.requestFields.length ? endpoint.requestFields.map((field) => (
              <tr key={`${field.location}-${field.field}`}>
                <td className="mono">{field.field}</td>
                <td>{field.location}</td>
                <td>{field.type}</td>
                <td>{field.required ? 'Yes' : 'No'}</td>
                <td>{field.behavior ?? '—'}</td>
              </tr>
            )) : (
              <tr><td colSpan={5}>No request fields defined.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {!endpoint.collection && (
        <div className="note">
          <b>Stateless API.</b> Requests are independent and do not read or change a collection.
        </div>
      )}
      <div className="behavior">
        <h2>Mock response behavior</h2>
        <p>Choose a status declared in this endpoint agreement. Request validation still takes precedence.</p>
        <div className="behaviorControls">
          <select
            aria-label="Response status"
            value={status}
            onChange={(event) => onStatusChange(Number(event.target.value))}
            disabled={pending}
          >
            {endpoint.statuses.map((value) => (
              <option value={value} key={value}>
                {value}{value === endpoint.successStatus ? ' · normal success' : ' · agreed error'}
              </option>
            ))}
          </select>
        </div>
        <ActionError message={error} />
        <div className="rightActions">
          <button onClick={onReset} disabled={pending}>Reset to normal</button>
          <button className="primary" onClick={onApply} disabled={pending}>
            {pending ? 'Applying…' : 'Apply behavior'}
          </button>
        </div>
      </div>
    </>
  );
}
