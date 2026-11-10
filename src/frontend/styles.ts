import type { CSSProperties } from 'react';

/** Inline styles keep the launcher independent of the consumer's stylesheet imports. */
export const devtoolsStyles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 2147483646,
    background: 'rgba(13, 28, 35, 0.48)',
    backdropFilter: 'blur(4px)',
    padding: 24,
    display: 'grid',
    placeItems: 'center'
  },
  launcher: {
    position: 'fixed',
    bottom: 20,
    zIndex: 2147483645,
    width: 48,
    height: 48,
    border: 0,
    borderRadius: 14,
    display: 'grid',
    placeItems: 'center',
    cursor: 'pointer',
    background: 'linear-gradient(145deg, #1aa48f, #0b685e)',
    color: '#fff',
    boxShadow: '0 10px 30px rgba(11, 104, 94, .35)',
    font: '800 20px/1 ui-sans-serif, system-ui, sans-serif'
  },
  panel: {
    width: 'min(1180px, 100%)',
    height: 'min(840px, calc(100vh - 48px))',
    position: 'relative',
    borderRadius: 18,
    overflow: 'hidden',
    background: '#eaf0f1',
    boxShadow: '0 32px 100px rgba(0, 0, 0, .35)'
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 2,
    width: 34,
    height: 34,
    borderRadius: 9,
    border: '1px solid #d8e1e5',
    background: '#fff',
    color: '#34495a',
    cursor: 'pointer',
    fontSize: 20
  },
  frame: { width: '100%', height: '100%', border: 0, display: 'block' }
} satisfies Record<string, CSSProperties>;
