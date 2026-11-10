import { useCallback, useEffect, useState } from 'react';
import { loadDashboard, resetWorkspace } from '../api';
import { DashboardView } from '../components/DashboardView';
import { DashboardError, DashboardLoading } from '../components/Feedback';
import { SetupView } from '../components/SetupView';
import { errorMessage, useAsyncAction } from '../hooks/useAsyncAction';
import { useNotice } from '../hooks/useNotice';
import type { DashboardData, DashboardTab } from '../types';
import { ApiCatalogContainer } from './ApiCatalogContainer';

/**
 * Owns workspace loading, navigation, notifications, and global dashboard actions.
 *
 * @returns The dashboard shell connected to server state and actions.
 */
export function DashboardContainer() {
  const [data, setData] = useState<DashboardData>();
  const [tab, setTab] = useState<DashboardTab>('setup');
  const [loadError, setLoadError] = useState('');
  const { notice, notify } = useNotice();
  const action = useAsyncAction();

  /**
   * Refreshes the visible dashboard resources.
   *
   * @param signal - Optional signal used to cancel the resource requests.
   * @returns A promise that resolves after dashboard state is refreshed.
   */
  const reload = useCallback(async (signal?: AbortSignal) => {
    const next = await loadDashboard(signal);
    if (!signal?.aborted) {
      setData(next);
      setLoadError('');
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void reload(controller.signal).catch((reason) => {
      if (!controller.signal.aborted) setLoadError(errorMessage(reason));
    });
    return () => controller.abort();
  }, [reload]);

  /** Retries a failed initial request without leaving an unhandled rejection. */
  function retry() {
    setLoadError('');
    void reload().catch((reason) => setLoadError(errorMessage(reason)));
  }

  /** Resets server state and refreshes the screen before confirming completion. */
  function reset() {
    void action.run(async () => {
      await resetWorkspace();
      await reload();
      notify('Workspace reset from seed');
    });
  }

  /** Copies the configuration-derived API URL, including clipboard permission errors. */
  function copyUrl() {
    if (!data) return;
    const url = data.workspace.baseUrl;
    void action.run(async () => {
      if (!navigator.clipboard) throw new Error('Clipboard is unavailable in this browser.');
      await navigator.clipboard.writeText(url);
      notify('Mock URL copied');
    });
  }

  if (!data && loadError) return <DashboardError message={loadError} onRetry={retry} />;
  if (!data) return <DashboardLoading />;

  return (
    <DashboardView
      workspace={data.workspace}
      endpointCount={data.endpoints.length}
      tab={tab}
      notice={notice}
      error={action.error}
      pending={action.pending}
      onTabChange={setTab}
      onCopyUrl={copyUrl}
    >
      <div hidden={tab !== 'setup'}>
        <SetupView
          workspace={data.workspace}
          recordCount={data.collections.reduce((sum, collection) => sum + collection.records.length, 0)}
          pending={action.pending}
          onReset={reset}
        />
      </div>
      <div hidden={tab !== 'apis'} style={{ height: '100%' }}>
        <ApiCatalogContainer endpoints={data.endpoints} onReload={reload} onNotify={notify} />
      </div>
    </DashboardView>
  );
}
