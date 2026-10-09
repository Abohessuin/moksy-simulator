import { MoksyAgreementError, MoksyConfigError, MoksyError } from './errors.js';

export function formatDiagnosticError(error: unknown): string {
  if (error instanceof MoksyAgreementError) {
    const lines = [
      '==============================================================',
      ' [Moksy Agreement Error] API agreement validation failed',
      '=============================================================='
    ];
    if (error.context.filePath) lines.push(`  Document : ${error.context.filePath}`);
    if (error.context.endpoint) lines.push(`  Endpoint : ${error.context.endpoint}`);
    if (error.context.section) lines.push(`  Section  : ${error.context.section}`);
    if (error.context.row !== undefined) lines.push(`  Row      : ${error.context.row}`);
    if (error.context.field) lines.push(`  Field    : ${error.context.field}`);
    lines.push(`  Problem  : ${error.message.replace(/^\[Moksy Agreement Error.*?\]:\s*/, '')}`);
    lines.push('==============================================================');
    return lines.join('\n');
  }

  if (error instanceof MoksyConfigError) {
    const lines = [
      '==============================================================',
      ' [Moksy Configuration Error] Invalid simulator configuration',
      '=============================================================='
    ];
    if (error.filePath) lines.push(`  File    : ${error.filePath}`);
    lines.push(`  Problem : ${error.message.replace(/^\[Moksy Config Error.*?\]:\s*/, '')}`);
    lines.push('==============================================================');
    return lines.join('\n');
  }

  if (error instanceof MoksyError) {
    return `[Moksy Error]: ${error.message}`;
  }

  if (error instanceof Error) {
    return `[Unexpected Error]: ${error.message}\n${error.stack || ''}`;
  }

  return `[Fatal Error]: ${String(error)}`;
}
