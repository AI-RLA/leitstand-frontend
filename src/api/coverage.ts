import { useMutation } from "@tanstack/react-query";
import { api } from "./client";

// A mutation rather than a query: the preview runs on a button press, is never cached and never
// invalidated, and its result belongs to the draft that asked for it.
export function usePreviewCoverage() {
  return useMutation({ mutationFn: api.previewCoverage });
}
