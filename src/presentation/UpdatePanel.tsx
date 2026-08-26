import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

import type { Locale } from "../locales/catalogs";
import { catalogs } from "../locales/catalogs";
import { commandErrorCode } from "./command-error";
import { localMediumDateTimeFormatter } from "./presentation-format";

type UpdateStatus =
  | "unconfigured"
  | "offline"
  | "up-to-date"
  | "available"
  | "dismissed"
  | "postponed"
  | "withdrawn-installed"
  | "manual-recovery-required"
  | "untrusted";

type ManualRecoveryReason = keyof (typeof catalogs)["en-US"]["updates"]["manualRecoveryReasons"];
type TrustFailure = keyof (typeof catalogs)["en-US"]["updates"]["trustFailures"];
type WithdrawalReason = keyof (typeof catalogs)["en-US"]["updates"]["withdrawalReasons"];
type UpdateMessages = (typeof catalogs)["en-US"]["updates"];
type BusyAction = "check" | "dismiss" | "postpone" | "install";

interface UpdateRelease {
  version: string;
  publishedAt: string;
  releaseNotes: string;
  minimumSupportedVersion: string;
  targetLibrarySchemaVersion: number;
}

interface UpdateWithdrawal {
  version: string;
  reason: WithdrawalReason;
  guidance: string;
  replacementVersion: string | null;
}

export interface UpdateCheckOutcome {
  installedVersion: string;
  checkedAt: string;
  status: UpdateStatus;
  release: UpdateRelease | null;
  installedWithdrawal: UpdateWithdrawal | null;
  updateActionAvailable: boolean;
  postponedUntil: string | null;
  manualRecoveryReason: ManualRecoveryReason | null;
  trustFailure: TrustFailure | null;
}

interface UpdatePanelProps {
  locale: Locale;
  messages: UpdateMessages;
  errors: Record<string, string>;
  ready: boolean;
  refreshToken: number;
  installationBlocked?: boolean;
  onInstallationStateChange?: (installing: boolean) => void;
}

const attentionStatuses = new Set<UpdateStatus>([
  "available",
  "withdrawn-installed",
  "manual-recovery-required",
  "untrusted",
]);
const UPDATE_CHECK_COMPLETED_EVENT = "fitfreed://update-check-completed";

function interpolate(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.split(`{${key}}`).join(value),
    template,
  );
}

export function UpdatePanel({
  locale,
  messages,
  errors,
  ready,
  refreshToken,
  installationBlocked = false,
  onInstallationStateChange,
}: UpdatePanelProps) {
  const [outcome, setOutcome] = useState<UpdateCheckOutcome>();
  const [busyAction, setBusyAction] = useState<BusyAction>();
  const [manuallyRevealed, setManuallyRevealed] = useState(false);
  const [errorCode, setErrorCode] = useState<string>();
  const requestSequence = useRef(0);
  const dateTime = useMemo(
    () => localMediumDateTimeFormatter(locale),
    [locale],
  );

  useEffect(() => {
    let active = true;
    let unlisten: UnlistenFn | undefined;
    void listen<UpdateCheckOutcome>(UPDATE_CHECK_COMPLETED_EVENT, (event) => {
      if (!active) return;
      requestSequence.current += 1;
      setOutcome(event.payload);
      setManuallyRevealed(false);
      setErrorCode(undefined);
    })
      .then((stopListening) => {
        if (active) {
          unlisten = stopListening;
        } else {
          stopListening();
        }
      })
      .catch(() => {});
    return () => {
      active = false;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    let active = true;
    requestSequence.current += 1;
    const requestId = requestSequence.current;
    invoke<UpdateCheckOutcome>("check_for_updates_on_launch")
      .then((result) => {
        if (active && requestId === requestSequence.current) {
          setOutcome(result);
          setErrorCode(undefined);
        }
      })
      .catch((reason) => {
        if (active && requestId === requestSequence.current) {
          setErrorCode(commandErrorCode(reason));
        }
      });
    return () => {
      active = false;
    };
  }, [ready, refreshToken]);

  async function checkNow() {
    requestSequence.current += 1;
    const requestId = requestSequence.current;
    setBusyAction("check");
    setErrorCode(undefined);
    try {
      const result = await invoke<UpdateCheckOutcome>("check_for_updates");
      if (requestId === requestSequence.current) {
        setOutcome(result);
        setManuallyRevealed(true);
      }
    } catch (reason) {
      if (requestId === requestSequence.current) {
        setErrorCode(commandErrorCode(reason));
      }
    } finally {
      setBusyAction(undefined);
    }
  }

  async function dismiss() {
    if (!outcome?.release) return;
    requestSequence.current += 1;
    const requestId = requestSequence.current;
    setBusyAction("dismiss");
    setErrorCode(undefined);
    try {
      await invoke("dismiss_available_update", {
        candidateVersion: outcome.release.version,
      });
      if (requestId === requestSequence.current) {
        setOutcome({
          ...outcome,
          status: "dismissed",
          updateActionAvailable: false,
          postponedUntil: null,
        });
        setManuallyRevealed(true);
      }
    } catch (reason) {
      if (requestId === requestSequence.current) {
        setErrorCode(commandErrorCode(reason));
      }
    } finally {
      setBusyAction(undefined);
    }
  }

  async function postpone() {
    if (!outcome?.release) return;
    requestSequence.current += 1;
    const requestId = requestSequence.current;
    setBusyAction("postpone");
    setErrorCode(undefined);
    try {
      const until = await invoke<string>("postpone_available_update", {
        candidateVersion: outcome.release.version,
      });
      if (requestId === requestSequence.current) {
        setOutcome({
          ...outcome,
          status: "postponed",
          updateActionAvailable: false,
          postponedUntil: until,
        });
        setManuallyRevealed(true);
      }
    } catch (reason) {
      if (requestId === requestSequence.current) {
        setErrorCode(commandErrorCode(reason));
      }
    } finally {
      setBusyAction(undefined);
    }
  }

  async function install() {
    if (!outcome?.release || !outcome.updateActionAvailable) return;
    requestSequence.current += 1;
    const requestId = requestSequence.current;
    setBusyAction("install");
    onInstallationStateChange?.(true);
    setErrorCode(undefined);
    try {
      await invoke("install_available_update", {
        candidateVersion: outcome.release.version,
      });
    } catch (reason) {
      if (requestId === requestSequence.current) {
        setErrorCode(commandErrorCode(reason));
        setBusyAction(undefined);
        onInstallationStateChange?.(false);
      }
    }
  }

  function formatInstant(value: string): string {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : dateTime.format(parsed);
  }

  function statusText(result: UpdateCheckOutcome): string {
    switch (result.status) {
      case "unconfigured":
        return messages.statuses.unconfigured;
      case "offline":
        return messages.statuses.offline;
      case "up-to-date":
        return interpolate(messages.statuses.upToDate, {
          installedVersion: result.installedVersion,
        });
      case "available":
        return interpolate(messages.statuses.available, {
          version: result.release?.version ?? "",
        });
      case "dismissed":
        return messages.statuses.dismissed;
      case "postponed":
        return interpolate(messages.statuses.postponed, {
          until: result.postponedUntil ? formatInstant(result.postponedUntil) : "",
        });
      case "withdrawn-installed":
        return interpolate(messages.statuses.withdrawnInstalled, {
          installedVersion: result.installedVersion,
          reason: result.installedWithdrawal
            ? messages.withdrawalReasons[result.installedWithdrawal.reason]
            : messages.withdrawalReasons.compatibility,
        });
      case "manual-recovery-required":
        return interpolate(messages.statuses.manualRecoveryRequired, {
          reason: result.manualRecoveryReason
            ? messages.manualRecoveryReasons[result.manualRecoveryReason]
            : messages.manualRecoveryReasons["no-safe-replacement"],
        });
      case "untrusted":
        return messages.statuses.untrusted;
    }
  }

  const showOutcome = outcome
    && (manuallyRevealed || attentionStatuses.has(outcome.status));
  const showRelease = outcome?.release
    && ["available", "withdrawn-installed", "manual-recovery-required"].includes(outcome.status);
  const canDefer = outcome?.status === "available"
    && outcome.updateActionAvailable
    && outcome.release !== null;
  const busy = busyAction !== undefined;
  const operationProgress = busyAction === "check"
    ? messages.checking
    : busyAction === "dismiss"
      ? messages.dismissing
      : busyAction === "postpone"
        ? messages.postponing
        : undefined;

  return (
    <section
      className="update-panel"
      aria-labelledby="update-heading"
      aria-busy={busy}
    >
      <div className="update-panel-heading">
        <div>
          <h2 id="update-heading">{messages.heading}</h2>
          <p>{messages.intro}</p>
        </div>
        <button type="button" className="secondary" onClick={checkNow} disabled={!ready || busy}>
          {messages.checkNow}
        </button>
      </div>

      {outcome && (
        <dl className="update-installed-version">
          <div>
            <dt>{messages.installedVersion}</dt>
            <dd>{outcome.installedVersion}</dd>
          </div>
        </dl>
      )}

      {operationProgress && (
        <p className="update-progress" role="status" aria-live="polite">
          {operationProgress}
        </p>
      )}

      {showOutcome && (
        <div
          className={`update-result update-result-${outcome.status}`}
          role="status"
          aria-live="polite"
          aria-busy={busyAction === "install"}
        >
          <p className="update-status"><strong>{statusText(outcome)}</strong></p>
          {outcome.status === "untrusted" && outcome.trustFailure && (
            <p>{messages.trustFailures[outcome.trustFailure]}</p>
          )}
          {outcome.installedWithdrawal && (
            <p>{outcome.installedWithdrawal.guidance}</p>
          )}
          {showRelease && outcome.release && (
            <div className="update-release">
              <p>{interpolate(messages.published, {
                date: formatInstant(outcome.release.publishedAt),
              })}</p>
              <h3>{messages.releaseNotes}</h3>
              <p>{outcome.release.releaseNotes}</p>
              {outcome.updateActionAvailable && <p>{messages.installNotice}</p>}
              {busyAction === "install" && (
                <p>{interpolate(messages.installingVersion, {
                  version: outcome.release.version,
                })}</p>
              )}
            </div>
          )}
          {canDefer && (
            <div className="update-actions">
              <button type="button" onClick={install} disabled={busy || installationBlocked}>
                {messages.install}
              </button>
              <button type="button" className="secondary" onClick={postpone} disabled={busy}>
                {messages.postpone}
              </button>
              <button type="button" className="secondary" onClick={dismiss} disabled={busy}>
                {messages.dismiss}
              </button>
            </div>
          )}
        </div>
      )}
      {errorCode && (
        <p className="error" role="alert">
          {errors[errorCode] ?? errors.unexpected}
        </p>
      )}
    </section>
  );
}
