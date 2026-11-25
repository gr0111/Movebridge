import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { days } from "../../data/search";
import {
  completionKey,
  koreaDisplayDate,
  validateWorkoutDraft,
  workoutNoteLimit,
  workoutTitleLimit,
} from "./planner-model";
import type { WorkoutDraft, WorkoutPlan } from "./planner-model";
import type { useWorkoutPlanner } from "./useWorkoutPlanner";

export type DialogSelection = { id: string; creating: boolean };
export type Planner = ReturnType<typeof useWorkoutPlanner>;

function draftFor(plan?: WorkoutPlan): WorkoutDraft {
  return plan
    ? {
        title: plan.title,
        day_of_week: plan.day_of_week,
        start_time: plan.start_time.slice(0, 5),
        end_time: plan.end_time.slice(0, 5),
        note: plan.note ?? "",
      }
    : { title: "", day_of_week: -1, start_time: "", end_time: "", note: "" };
}

export default function WorkoutDialog({
  selection,
  planner,
  dates,
  close,
}: {
  selection: DialogSelection;
  planner: Planner;
  dates: string[];
  close: () => void;
}) {
  const plan = planner.plans.find(({ id }) => id === selection.id);
  const [mode, setMode] = useState<"form" | "detail" | "delete">(
    selection.creating ? "form" : "detail",
  );
  const [draft, setDraft] = useState(() => draftFor(plan));
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const firstInput = useRef<HTMLInputElement>(null);
  const cancelDelete = useRef<HTMLButtonElement>(null);
  const busy = planner.pending.has(selection.id);

  useEffect(() => {
    const element = dialog.current!;
    const opener = document.activeElement;
    element.showModal();
    return () => {
      element.close();
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);
  useEffect(() => {
    (mode === "form"
      ? firstInput.current
      : mode === "delete"
        ? cancelDelete.current
        : heading.current
    )?.focus();
  }, [mode]);

  function show(target: typeof mode) {
    setError("");
    setNotice("");
    setMode(target);
  }

  async function perform(action: () => Promise<boolean>, success: () => void, failure: string) {
    setError("");
    setNotice("");
    try {
      if (await action()) success();
    } catch {
      setError(failure);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const times = new FormData(event.currentTarget);
    const submitted = {
      ...draft,
      start_time: String(times.get("start_time") ?? ""),
      end_time: String(times.get("end_time") ?? ""),
    };
    const { error } = validateWorkoutDraft(submitted);
    if (error) {
      setError(error);
      return;
    }
    void perform(
      () => planner.store.save(selection.id, submitted, !selection.creating),
      selection.creating
        ? close
        : () => {
            show("detail");
            setNotice("운동 일정을 수정했어요.");
          },
      "운동 일정을 저장하지 못했어요. 입력 내용은 남아 있으니 다시 시도해 주세요.",
    );
  }

  const date = plan ? dates[plan.day_of_week] : null;
  const checked =
    date &&
    planner.completions.some(
      ({ plan_id, performed_on }) =>
        completionKey(plan_id, performed_on) === completionKey(selection.id, date),
    );
  const setField = <K extends keyof WorkoutDraft>(key: K, value: WorkoutDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  return (
    <dialog
      className="workout-dialog"
      ref={dialog}
      aria-labelledby="workout-dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) close();
      }}
    >
      <div className="workout-dialog-content" aria-busy={busy}>
        <div className="workout-dialog-heading">
          <h2 ref={heading} tabIndex={-1} id="workout-dialog-title">
            {mode === "delete"
              ? "운동 일정 삭제"
              : mode === "form"
                ? selection.creating
                  ? "운동 추가"
                  : "운동 일정 수정"
                : plan?.title}
          </h2>
          <button type="button" className="text-button" disabled={busy} onClick={close}>
            닫기
          </button>
        </div>
        {mode === "form" ? (
          <form className="workout-form" onSubmit={submit} noValidate>
            <fieldset disabled={busy}>
              <label>
                운동명 ({workoutTitleLimit}자 이내)
                <input
                  ref={firstInput}
                  value={draft.title}
                  onChange={(event) => setField("title", event.target.value)}
                  required
                />
              </label>
              <label>
                요일
                <select
                  value={draft.day_of_week}
                  onChange={(event) => setField("day_of_week", Number(event.target.value))}
                  required
                >
                  <option value={-1}>요일을 선택해 주세요</option>
                  {days.map((day, index) => (
                    <option value={index} key={day}>
                      {day}요일
                    </option>
                  ))}
                </select>
              </label>
              <div className="workout-form-times">
                <label>
                  시작시간
                  <input type="time" name="start_time" defaultValue={draft.start_time} required />
                </label>
                <label>
                  종료시간
                  <input type="time" name="end_time" defaultValue={draft.end_time} required />
                </label>
              </div>
              <label>
                메모 (선택, {workoutNoteLimit}자 이내)
                <textarea
                  rows={3}
                  value={draft.note}
                  onChange={(event) => setField("note", event.target.value)}
                />
              </label>
            </fieldset>
            {error && (
              <p className="bookmark-error" role="alert">
                {error}
              </p>
            )}
            <div className="workout-actions">
              <button type="submit" className="primary-button" disabled={busy}>
                {busy ? "저장 중…" : "운동 일정 저장"}
              </button>
              <button
                type="button"
                className="secondary-button"
                disabled={busy}
                onClick={selection.creating ? close : () => show("detail")}
              >
                취소
              </button>
            </div>
          </form>
        ) : mode === "delete" ? (
          <>
            <p>‘{plan?.title}’ 일정과 이 일정의 모든 날짜별 완료 기록을 삭제할까요?</p>
            {error && (
              <p className="bookmark-error" role="alert">
                {error}
              </p>
            )}
            <div className="workout-actions">
              <button
                type="button"
                className="secondary-button"
                ref={cancelDelete}
                disabled={busy}
                onClick={() => show("detail")}
              >
                취소
              </button>
              <button
                type="button"
                className="primary-button"
                disabled={busy}
                onClick={() =>
                  void perform(
                    () => planner.store.remove(selection.id),
                    close,
                    "운동 일정을 삭제하지 못했어요. 다시 시도해 주세요.",
                  )
                }
              >
                {busy ? "삭제 중…" : "일정과 완료 기록 삭제"}
              </button>
            </div>
          </>
        ) : (
          plan &&
          date && (
            <>
              <p>
                <span className="workout-source">직접 등록</span> {days[plan.day_of_week]}요일 ·{" "}
                {plan.start_time.slice(0, 5)}–{plan.end_time.slice(0, 5)}
              </p>
              {plan.note && <p className="workout-note">{plan.note}</p>}
              <label className="workout-completion">
                <input
                  type="checkbox"
                  checked={Boolean(checked)}
                  disabled={busy}
                  onChange={() =>
                    void perform(
                      () => planner.store.setCompletion(plan.id, date, !checked),
                      () =>
                        setNotice(
                          checked
                            ? "이 날짜의 완료 기록을 취소했어요."
                            : "이 날짜의 운동 완료를 기록했어요.",
                        ),
                      "운동 완료 기록을 변경하지 못했어요. 다시 시도해 주세요.",
                    )
                  }
                />
                {koreaDisplayDate(date)} 운동 완료
              </label>
              {error && (
                <p className="bookmark-error" role="alert">
                  {error}
                </p>
              )}
              {notice && <p role="status">{notice}</p>}
              <div className="workout-actions">
                <button
                  type="button"
                  className="secondary-button"
                  disabled={busy}
                  onClick={() => {
                    setDraft(draftFor(plan));
                    show("form");
                  }}
                >
                  일정 수정
                </button>
                <button
                  type="button"
                  className="text-button"
                  disabled={busy}
                  onClick={() => show("delete")}
                >
                  일정 삭제
                </button>
              </div>
            </>
          )
        )}
      </div>
    </dialog>
  );
}
