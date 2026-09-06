"use client";

import { ReportsView } from "@/components/views/ReportsView";

export function TaxDeclarationView({ selectedProjectId }: { selectedProjectId: string | null }) {
  return <ReportsView selectedProjectId={selectedProjectId} initialTab="tax_declaration" taxOnly />;
}
