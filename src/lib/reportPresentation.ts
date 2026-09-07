export function shouldShowAdvancedReports(activeTab: string, taxOnly: boolean) {
  return !taxOnly && activeTab === "comparison";
}
