export type ComposeOperation = "idle" | "translating" | "sending";
export type EnterAction = "none" | "translate" | "send";

export function getEnterAction({
  operation,
  sourceText,
  previewText,
  previewIsCurrent
}: {
  operation: ComposeOperation;
  sourceText: string;
  previewText: string;
  previewIsCurrent: boolean;
}): EnterAction {
  if (operation !== "idle" || !sourceText.trim()) return "none";
  if (previewIsCurrent && previewText.trim()) return "send";
  return "translate";
}
