import { useEffect, useState } from 'react';
import { applyResponseStatus, resetResponseStatus } from '../api';
import { EndpointDetailsView } from '../components/EndpointDetailsView';
import { useAsyncAction } from '../hooks/useAsyncAction';
import type { Endpoint } from '../types';

interface EndpointDetailsContainerProps {
  endpoint: Endpoint;
  onReload: () => Promise<void>;
  onNotify: (message: string) => void;
}

/**
 * Owns the draft status and persists response changes through the dashboard API.
 *
 * @param props - The selected endpoint and callbacks for refresh and notification.
 * @returns The connected endpoint details view.
 */
export function EndpointDetailsContainer({ endpoint, onReload, onNotify }: EndpointDetailsContainerProps) {
  const [status, setStatus] = useState(endpoint.override ?? endpoint.successStatus);
  const { pending, error, run } = useAsyncAction();

  useEffect(() => {
    setStatus(endpoint.override ?? endpoint.successStatus);
  }, [endpoint.key, endpoint.override, endpoint.successStatus]);

  /** Restores the normal response and synchronizes the selector, even without an existing override. */
  function reset() {
    void run(async () => {
      await resetResponseStatus(endpoint.key);
      setStatus(endpoint.successStatus);
      await onReload();
      onNotify('Normal behavior restored');
    });
  }

  /** Applies the selected agreed status and confirms it after refreshing server state. */
  function apply() {
    void run(async () => {
      await applyResponseStatus(endpoint.key, status);
      await onReload();
      onNotify(status === endpoint.successStatus ? 'Normal behavior applied' : `Response ${status} applied`);
    });
  }

  return (
    <EndpointDetailsView
      endpoint={endpoint}
      status={status}
      pending={pending}
      error={error}
      onStatusChange={setStatus}
      onReset={reset}
      onApply={apply}
    />
  );
}
