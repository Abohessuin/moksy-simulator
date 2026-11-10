import { useCallback, useEffect, useState } from 'react';
import { deleteScenario, loadTesting, runScenario, saveScenario, setRecording } from '../api';
import { DashboardError, DashboardLoading } from '../components/Feedback';
import { TestingView } from '../components/TestingView';
import { errorMessage, useAsyncAction } from '../hooks/useAsyncAction';
import { useNotice } from '../hooks/useNotice';

/**
 * Retains recording and scenario behavior without mounting it in the visible dashboard.
 *
 * @returns The connected Testing feature.
 */
export function TestingContainer() {
  const [data, setData] = useState<Awaited<ReturnType<typeof loadTesting>>>();
  const [loadError, setLoadError] = useState('');
  const [scenarioName, setScenarioName] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set());
  const { pending, error, run } = useAsyncAction();
  const { notice, notify } = useNotice();

  /**
   * Refreshes recorder and scenario state.
   *
   * @param signal - Optional signal used to cancel the resource requests.
   * @returns A promise that resolves after Testing state is refreshed.
   */
  const reload = useCallback(async (signal?: AbortSignal) => {
    const next = await loadTesting(signal);
    if (!signal?.aborted) {
      setData(next);
      setSelectedEvents(new Set(next.recorder.events.map((event) => event.id)));
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

  /** Retries initial Testing resource loading when the server becomes available. */
  function retry() {
    setLoadError('');
    void reload().catch((reason) => setLoadError(errorMessage(reason)));
  }

  /**
   * Toggles a recorded request's inclusion in the next saved scenario.
   *
   * @param id - The captured request identifier to toggle.
   */
  function toggleEvent(id: string) {
    setSelectedEvents((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /** Starts or stops recording and refreshes the captured request list. */
  function toggleRecording() {
    if (!data) return;
    const active = data.recorder.active;
    void run(async () => {
      await setRecording(!active);
      await reload();
    });
  }

  /** Validates the name and selection before saving the selected request workflow. */
  function save() {
    void run(async () => {
      if (!scenarioName.trim()) throw new Error('Enter a scenario name');
      if (!selectedEvents.size) throw new Error('Select at least one captured request');
      await saveScenario(scenarioName.trim(), [...selectedEvents]);
      setScenarioName('');
      await reload();
      notify('Scenario saved');
    });
  }

  /**
   * Replays a scenario and reports its status assertions.
   *
   * @param id - The scenario identifier to replay.
   */
  function replay(id: string) {
    void run(async () => {
      const result = await runScenario(id);
      notify(result.failed ? `${result.failed} step(s) failed` : `${result.passed} steps passed`);
    });
  }

  /**
   * Deletes a saved scenario and refreshes the remaining list.
   *
   * @param id - The scenario identifier to delete.
   */
  function remove(id: string) {
    void run(async () => {
      await deleteScenario(id);
      await reload();
    });
  }

  if (!data && loadError) return <DashboardError message={loadError} onRetry={retry} />;
  if (!data) return <DashboardLoading />;

  return (
    <TestingView
      recorder={data.recorder}
      scenarios={data.scenarios}
      scenarioName={scenarioName}
      selectedEvents={selectedEvents}
      pending={pending}
      error={error}
      notice={notice}
      onNameChange={setScenarioName}
      onToggleEvent={toggleEvent}
      onToggleRecording={toggleRecording}
      onSave={save}
      onRun={replay}
      onDelete={remove}
    />
  );
}
