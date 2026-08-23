import { useEffect, useRef } from "react";

import { type catalogs } from "../locales/catalogs";
import { restoreFocusAfterReveal } from "./focus-restoration";
import { TrainingRangeEditor } from "./TrainingRangeEditor";
import {
  type TrainingRangeEditorSurface,
  useOptionalTrainingRangeInteraction,
} from "./TrainingRangeInteractionProvider";

interface TrainingRangeEvidenceEditorProps {
  surface: TrainingRangeEditorSurface;
  messages: (typeof catalogs)["en-US"];
}

export function TrainingRangeEvidenceEditor({
  surface,
  messages,
}: TrainingRangeEvidenceEditorProps) {
  const interaction = useOptionalTrainingRangeInteraction();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const active = interaction?.editor?.surface === surface;

  useEffect(() => {
    if (!active) return;
    return restoreFocusAfterReveal(
      headingRef.current,
      null,
      { forceInitialFocus: true },
    );
  }, [
    active,
    interaction?.editor?.mode,
    interaction?.editor?.rangeRef,
  ]);

  if (!active) return null;
  return (
    <aside className="training-range-evidence-editor">
      <TrainingRangeEditor
        surface={surface}
        messages={messages}
        lockCoordinate
        headingRef={headingRef}
      />
    </aside>
  );
}
