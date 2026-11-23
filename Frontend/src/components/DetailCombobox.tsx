import { useEffect, useRef, useState } from "react";
import Icon from "./Icon";
import type { DetailOptions } from "../data/discovery";

type Item = { value: string; kind: "all" | "sport" | "video" };
const normalized = (value: string) => value.replace(/\s+/g, "").toLocaleLowerCase("ko-KR");

export default function DetailCombobox({
  id,
  value,
  options,
  onChange,
}: {
  id: string;
  value: string;
  options: DetailOptions;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const listRef = useRef<HTMLDivElement>(null);
  const inputValue = value === "전체 종목" ? "" : value;
  const query = normalized(inputValue);
  const matches = (text: string) => !query || normalized(text).includes(query);
  const items: Item[] = [
    { value: "전체 종목", kind: "all" },
    ...options.sports.filter(matches).map((value) => ({ value, kind: "sport" as const })),
    ...options.videoTitles.filter(matches).map((value) => ({ value, kind: "video" as const })),
  ];
  const activeIndex = Math.min(active, items.length - 1);
  useEffect(() => {
    const list = listRef.current;
    const option = list?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!open || !list || !option) return;
    if (option.offsetTop < list.scrollTop) list.scrollTop = option.offsetTop;
    else if (option.offsetTop + option.offsetHeight > list.scrollTop + list.clientHeight)
      list.scrollTop = option.offsetTop + option.offsetHeight - list.clientHeight;
  }, [open, activeIndex]);
  const empty = options.sports.length + options.videoTitles.length === 0;
  const choose = (item: Item) => {
    onChange(item.value);
    setOpen(false);
    setActive(-1);
  };
  const renderOption = (item: Item, index: number) => (
    <div
      id={`${id}-option-${index}`}
      key={`${item.kind}:${item.value}`}
      role="option"
      aria-selected={index === activeIndex}
      className={`detail-option ${index === activeIndex ? "active" : ""}`}
      onMouseDown={(event) => event.preventDefault()}
      onMouseMove={() => setActive(index)}
      onClick={() => choose(item)}
    >
      {item.kind === "all" ? "전체 세부 종목" : item.value}
    </div>
  );
  return (
    <div
      className="detail-combobox"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setOpen(false);
          setActive(-1);
        }
      }}
    >
      <div className="input-wrap">
        <input
          id={id}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={open ? `${id}-options` : undefined}
          aria-activedescendant={
            open && activeIndex >= 0 ? `${id}-option-${activeIndex}` : undefined
          }
          aria-describedby={empty ? `${id}-empty` : undefined}
          value={inputValue}
          placeholder="전체 세부 종목"
          autoComplete="off"
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onChange={(event) => {
            onChange(event.target.value || "전체 종목");
            setActive(-1);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              setOpen(true);
              setActive((previous) =>
                event.key === "ArrowDown"
                  ? !open
                    ? 0
                    : (previous + 1) % items.length
                  : !open || previous <= 0
                    ? items.length - 1
                    : previous - 1,
              );
            } else if (open && (event.key === "Home" || event.key === "End")) {
              event.preventDefault();
              setActive(event.key === "Home" ? 0 : items.length - 1);
            } else if (event.key === "Escape") {
              event.preventDefault();
              setOpen(false);
              setActive(-1);
            } else if (event.key === "Enter") {
              if (open && activeIndex >= 0) {
                event.preventDefault();
                choose(items[activeIndex]);
              } else setOpen(false); // Free text still submits the existing search form.
            } else if (event.key === "Tab") {
              setOpen(false);
              setActive(-1);
            }
          }}
        />
        <Icon name="chevron" size={17} />
        {open && (
          <div
            ref={listRef}
            id={`${id}-options`}
            role="listbox"
            aria-label="분야별 세부 항목"
            className="detail-options"
          >
            {renderOption(items[0], 0)}
            {(["sport", "video"] as const).map((kind) => {
              const indices = items
                .map((item, index) => ({ item, index }))
                .filter(({ item }) => item.kind === kind);
              return indices.length ? (
                <div
                  key={kind}
                  role="group"
                  aria-label={kind === "sport" ? "운동 종목" : "관련 영상 제목"}
                >
                  <div className="detail-option-group" aria-hidden="true">
                    {kind === "sport" ? "운동 종목" : "관련 영상 제목"}
                  </div>
                  {indices.map(({ item, index }) => renderOption(item, index))}
                </div>
              ) : null;
            })}
            {!empty && items.length === 1 && (
              <p className="detail-options-message">
                입력한 검색어와 일치하는 선택 항목이 없습니다. 검색어를 직접 검색하거나 전체 세부
                종목으로 돌아갈 수 있어요.
              </p>
            )}
            {empty && (
              <p className="detail-options-message">
                현재 이 분야에서 선택할 수 있는 세부 항목이 없습니다.
              </p>
            )}
          </div>
        )}
      </div>
      {empty && (
        <p className="detail-empty" id={`${id}-empty`} role="status">
          현재 이 분야에서 선택할 수 있는 세부 항목이 없습니다.
        </p>
      )}
    </div>
  );
}
