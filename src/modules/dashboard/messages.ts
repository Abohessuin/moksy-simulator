export const DASHBOARD_MESSAGES = {
  LOCAL_ONLY: 'Moksy dashboard controls are available only from the local machine',
  ENDPOINT_NOT_FOUND: 'The selected endpoint is not present in the active agreement',
  STATUS_NOT_ALLOWED: 'The selected status is not defined by this endpoint agreement',
  SCENARIO_NOT_FOUND: 'The selected scenario does not exist',
  SCENARIO_NAME_REQUIRED: 'Scenario name is required',
  EVENTS_REQUIRED: 'Select at least one recorded request',
  INVALID_REQUEST: 'Invalid dashboard request'
} as const;
