"use client";

import { Printer } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";

/** Opens the browser's print dialog, where "Save as PDF" produces the report file. */
export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className={buttonClasses("primary")}>
      <Printer aria-hidden size={14} strokeWidth={1.75} />
      Print or save as PDF
    </button>
  );
}
