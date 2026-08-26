import { type Ref, useMemo } from "react";

import { type catalogs, type Locale } from "../locales/catalogs";
import {
  DataTable,
  NumericTableCell,
  NumericTableHeader,
} from "./DataTable";
import { exactDecimalFormatter, formatDetailDuration } from "./presentation-format";
import { formatDistance } from "./training-format";
import type {
  TrainingExerciseZones,
  TrainingZone,
  TrainingZoneGroup,
} from "./training-session-zone";

interface TrainingSessionZonesPanelProps {
  assessment: TrainingExerciseZones;
  locale: Locale;
  messages: (typeof catalogs)["en-US"];
  focusGroupRef?: string;
  focusHeadingRef?: Ref<HTMLHeadingElement>;
}

function interpolate(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.split(`{${key}}`).join(value),
    template,
  );
}

export function TrainingSessionZonesPanel({
  assessment,
  locale,
  messages,
  focusGroupRef,
  focusHeadingRef,
}: TrainingSessionZonesPanelProps) {
  const copy = messages.training.sessionLibrary;
  const number = useMemo(() => exactDecimalFormatter(locale), [locale]);

  function unsupportedGroups(count: number) {
    if (count === 0) return null;
    return (
      <details className="answer-exact-values training-compatibility-details">
        <summary>{copy.unsupportedZoneGroupsSummary}</summary>
        <p className="training-zone-unsupported">
          {interpolate(
            count === 1 ? copy.unsupportedZoneGroups.one : copy.unsupportedZoneGroups.other,
            { count: number.format(count) },
          )}
        </p>
      </details>
    );
  }

  function exactValue(value: number | null): string {
    return value === null ? copy.zoneNotRecorded : number.format(value);
  }

  function distance(zone: TrainingZone, group: TrainingZoneGroup): string {
    if (group.kind !== "speed") return copy.zoneNotApplicable;
    return formatDistance(
      zone.distanceMeters,
      locale,
      copy.zoneNotRecorded,
      messages.training.units.meters,
    );
  }

  function muscleLoad(zone: TrainingZone, group: TrainingZoneGroup): string {
    if (group.kind !== "power") return copy.zoneNotApplicable;
    return exactValue(zone.muscleLoad);
  }

  function groupPanel(group: TrainingZoneGroup) {
    const kind = copy.zoneKinds[group.kind];
    const unit = copy.zoneUnits[group.unit];
    const heading = interpolate(copy.zoneGroupHeading, {
      kind,
      number: number.format(group.ordinal + 1),
    });
    if (group.zones === null) {
      return (
        <section
          className="training-zone-group"
          key={group.zoneGroupRef}
          role="region"
          aria-label={heading}
        >
          <h6
            ref={group.zoneGroupRef === focusGroupRef ? focusHeadingRef : undefined}
            className={group.zoneGroupRef === focusGroupRef
              ? "training-result-focus-target"
              : undefined}
            tabIndex={group.zoneGroupRef === focusGroupRef ? -1 : undefined}
          >{heading}</h6>
          <p>{copy.zoneBandsNotProvided}</p>
        </section>
      );
    }
    if (group.zones.length === 0) {
      return (
        <section
          className="training-zone-group"
          key={group.zoneGroupRef}
          role="region"
          aria-label={heading}
        >
          <h6
            ref={group.zoneGroupRef === focusGroupRef ? focusHeadingRef : undefined}
            className={group.zoneGroupRef === focusGroupRef
              ? "training-result-focus-target"
              : undefined}
            tabIndex={group.zoneGroupRef === focusGroupRef ? -1 : undefined}
          >{heading}</h6>
          <p>{copy.zoneBandsProvidedEmpty}</p>
        </section>
      );
    }
    const knownTimes = group.zones.filter(
      (zone) => zone.timeInZoneMilliseconds !== null,
    );
    const totalKnownTime = knownTimes.reduce(
      (total, zone) => total + BigInt(zone.timeInZoneMilliseconds!),
      0n,
    );
    const summary = interpolate(copy.zoneDistributionSummary, {
      kind,
      known: number.format(knownTimes.length),
      total: number.format(group.zones.length),
    });
    return (
      <section
        className="training-zone-group"
        key={group.zoneGroupRef}
        role="region"
        aria-label={heading}
      >
        <h6
          ref={group.zoneGroupRef === focusGroupRef ? focusHeadingRef : undefined}
          className={group.zoneGroupRef === focusGroupRef
            ? "training-result-focus-target"
            : undefined}
          tabIndex={group.zoneGroupRef === focusGroupRef ? -1 : undefined}
        >{heading}</h6>
        <div className="training-zone-distribution" role="img" aria-label={summary}>
          {group.zones.map((zone) => {
            const width = zone.timeInZoneMilliseconds === null || totalKnownTime === 0n
              ? 0
              : Number(BigInt(zone.timeInZoneMilliseconds) * 10_000n / totalKnownTime) / 100;
            return (
              <div className="training-zone-bar-row" key={zone.zoneRef}>
                <span>{copy.zoneNumber} {number.format(zone.ordinal + 1)}</span>
                <span className="training-zone-bar-track" aria-hidden="true">
                  <span style={{ width: `${width}%` }} />
                </span>
                <span>{zone.timeInZoneMilliseconds === null
                  ? copy.zoneNotRecorded
                  : formatDetailDuration(
                    zone.timeInZoneMilliseconds,
                    locale,
                    messages.training.durationUnits,
                  )}</span>
              </div>
            );
          })}
        </div>
        <details className="answer-exact-values training-zone-exact">
          <summary>{copy.zoneExactValues}</summary>
          <DataTable accessibleName={`${heading} · ${copy.zoneExactValues}`}>
            <thead><tr>
              <NumericTableHeader scope="col">{copy.zoneNumber}</NumericTableHeader>
              <NumericTableHeader scope="col">{copy.zoneRange}</NumericTableHeader>
              <NumericTableHeader scope="col">{copy.zoneTime}</NumericTableHeader>
              <NumericTableHeader scope="col">{copy.zoneDistance}</NumericTableHeader>
              <NumericTableHeader scope="col">{copy.zoneMuscleLoad}</NumericTableHeader>
            </tr></thead>
            <tbody>{group.zones.map((zone) => (
              <tr key={zone.zoneRef}>
                <NumericTableHeader scope="row">{number.format(zone.ordinal + 1)}</NumericTableHeader>
                <NumericTableCell>{number.format(zone.lowerLimit)}–{number.format(zone.higherLimit)} {unit}</NumericTableCell>
                <NumericTableCell>{zone.timeInZoneMilliseconds === null
                  ? copy.zoneNotRecorded
                  : formatDetailDuration(
                    zone.timeInZoneMilliseconds,
                    locale,
                    messages.training.durationUnits,
                  )}</NumericTableCell>
                <NumericTableCell>{distance(zone, group)}</NumericTableCell>
                <NumericTableCell>{muscleLoad(zone, group)}</NumericTableCell>
              </tr>
            ))}</tbody>
          </DataTable>
        </details>
      </section>
    );
  }

  return (
    <section
      className="training-exercise-zones"
      role="region"
      aria-label={copy.zoneHeading}
    >
      <h5>{copy.zoneHeading}</h5>
      {assessment.zones === null ? <p>{copy.zoneContainerNotProvided}</p> : (
        <>
          <p>{copy.zoneIntro}</p>
          <p className="training-zone-attribution">{copy.zoneSourceAttribution}</p>
          {assessment.zones.groups.length === 0
            ? <p>{copy.zoneGroupsProvidedEmpty}</p>
            : assessment.zones.groups.map(groupPanel)}
          {unsupportedGroups(assessment.zones.unsupportedGroupCount)}
        </>
      )}
    </section>
  );
}
