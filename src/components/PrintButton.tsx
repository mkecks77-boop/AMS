"use client";

export function PrintButton() {
  return <button className="btn" onClick={() => window.print()}>Drucken / als PDF speichern</button>;
}
