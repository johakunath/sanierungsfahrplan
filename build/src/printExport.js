// ============================================================================
// PDF-EXPORT via window.print() — keine externen Abhängigkeiten
// Nutzer bekommt den nativen Druckdialog → "Als PDF speichern"
// Print-CSS versteckt alle interaktiven Elemente, zeigt nur die Print-Sektion
// ============================================================================

export function exportAsPDF() {
  document.body.classList.add("print-active");
  // Kleiner Timeout damit Browser das CSS applied, bevor Print-Dialog öffnet
  setTimeout(() => {
    try {
      window.print();
    } finally {
      // Class wieder weg — unabhängig ob User druckt oder abbricht
      setTimeout(() => document.body.classList.remove("print-active"), 100);
    }
  }, 50);
}
