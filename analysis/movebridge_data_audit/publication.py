"""Publish audit data without copying instructor names or unsafe worksheet cells."""

import re


SERVICE_BASE = "3a6316a20046f34d4cde847612dcc96d37735eb2"
INSTRUCTOR_MARKER = re.compile(r"\*\s*([가-힣]{2,4})(?=\s*강사)")
INSTRUCTOR_SUFFIX = re.compile(
    r"^(?:특강|배드민턴\s*단기|탁구\s*단기).*\d{1,2}(?:시)?\s+([가-힣]{3})\s*$"
)
SPREADSHEET_PREFIX = re.compile(r"^\s*[=+@-]|^[\t\r\n]")
SIGNED_NUMBER = re.compile(r"[+-]?\d+(?:\.\d+)?")


def course_text_redactor(titles):
    names = {match.group(1) for title in titles for pattern in (INSTRUCTOR_MARKER, INSTRUCTOR_SUFFIX)
             for match in pattern.finditer(title.strip())}
    if not names:
        return lambda text: text
    pattern = re.compile(r"(?<![가-힣])(?:" + "|".join(sorted(map(re.escape, names))) + r")(?![가-힣])")
    return lambda text: pattern.sub("[강사명 비공개]", text)


def public_value(value, redact):
    """Preserve numbers, identifiers and structure. Mask matching names in text values."""
    if isinstance(value, str):
        return redact(value)
    if isinstance(value, dict):
        return {key: public_value(item, redact) for key, item in value.items()}
    if isinstance(value, list):
        return [public_value(item, redact) for item in value]
    return value


def public_csv_row(row, redact):
    published = public_value(row, redact)
    for key, value in published.items():
        if (isinstance(value, str) and SPREADSHEET_PREFIX.match(value)
                and value.strip() != "-" and not SIGNED_NUMBER.fullmatch(value.strip())):
            published[key] = "'" + value
    return published
