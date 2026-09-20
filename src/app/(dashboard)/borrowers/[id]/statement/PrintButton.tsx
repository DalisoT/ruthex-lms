'use client';

import { useState } from 'react';

/**
 * Print / download statement as PDF using the browser's native print dialog.
 * The browser "Save as PDF" target renders exactly what's on screen.
 */
export default function PrintButton() {
  const [printing, setPrinting] = useState(false);
  function print() {
    setPrinting(true);
    window.print();
    setTimeout(() => setPrinting(false), 800);
  }
  return (
    <button className="btn btn-primary" onClick={print} disabled={printing}>
      {printing ? 'Opening print dialog…' : 'Print / Save as PDF'}
    </button>
  );
}
