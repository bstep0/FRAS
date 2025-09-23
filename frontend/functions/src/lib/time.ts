import { DateTime } from "luxon";

export const CENTRAL_TIMEZONE = "America/Chicago";

export interface ParsedSchedule {
  start: DateTime;
  end: DateTime;
  days: number[];
}

const DAY_TOKEN_MAP: Record<string, number> = {
  M: 1,
  MON: 1,
  MONDAY: 1,
  T: 2,
  TU: 2,
  TUE: 2,
  TUES: 2,
  TUESDAY: 2,
  W: 3,
  WED: 3,
  WEDS: 3,
  WEDNESDAY: 3,
  R: 4,
  TH: 4,
  THU: 4,
  THUR: 4,
  THURS: 4,
  THURSDAY: 4,
  F: 5,
  FRI: 5,
  FRIDAY: 5,
  SA: 6,
  SAT: 6,
  SATURDAY: 6,
  SU: 7,
  SUN: 7,
  SUNDAY: 7,
};

const CONDENSED_DAY_PAIRS: Record<string, number> = {
  TU: 2,
  TH: 4,
  TR: 4,
  SA: 6,
  SU: 7,
};

const SINGLE_DAY_LETTERS: Record<string, number> = {
  M: 1,
  T: 2,
  W: 3,
  R: 4,
  H: 4,
  F: 5,
  S: 6,
};

export interface ParseScheduleOptions {
  zone?: string;
  baseDate?: DateTime;
}

export const parseSchedule = (
  schedule: string | undefined | null,
  options: ParseScheduleOptions = {}
): ParsedSchedule | null => {
  if (!schedule) {
    return null;
  }

  const zone = options.zone ?? CENTRAL_TIMEZONE;
  const baseDate = options.baseDate ?? DateTime.now().setZone(zone);

  const normalized = schedule.trim();
  if (!normalized) {
    return null;
  }

  const timeMatch = normalized.match(/(\d{1,2}:\d{2}\s*[ap]m)\s*-\s*(\d{1,2}:\d{2}\s*[ap]m)/i);
  if (!timeMatch) {
    return null;
  }

  const [timePortion, startTextRaw, endTextRaw] = timeMatch;
  const dayPortionIndex = normalized.indexOf(timePortion);
  const dayPortion = dayPortionIndex > 0 ? normalized.slice(0, dayPortionIndex).trim() : "";

  const startText = startTextRaw.replace(/\s+/g, "");
  const endText = endTextRaw.replace(/\s+/g, "");

  const parsedStart = DateTime.fromFormat(startText, "h:mma", { zone });
  const parsedEnd = DateTime.fromFormat(endText, "h:mma", { zone });

  if (!parsedStart.isValid || !parsedEnd.isValid) {
    return null;
  }

  const start = baseDate.set({
    hour: parsedStart.hour,
    minute: parsedStart.minute,
    second: 0,
    millisecond: 0,
  });

  const end = baseDate.set({
    hour: parsedEnd.hour,
    minute: parsedEnd.minute,
    second: 0,
    millisecond: 0,
  });

  const days = parseDayPortion(dayPortion);

  return {
    start,
    end,
    days,
  };
};

const parseDayPortion = (value: string): number[] => {
  const result = new Set<number>();
  if (!value) {
    return [];
  }

  const tokens = value
    .replace(/[^A-Za-z]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim().toUpperCase())
    .filter(Boolean);

  if (tokens.length) {
    tokens.forEach((token) => {
      if (DAY_TOKEN_MAP[token]) {
        result.add(DAY_TOKEN_MAP[token]);
      } else {
        parseCondensedDays(token, result);
      }
    });
  } else {
    parseCondensedDays(value.toUpperCase(), result);
  }

  return Array.from(result.values()).sort((a, b) => a - b);
};

const parseCondensedDays = (token: string, accumulator: Set<number>) => {
  let index = 0;
  while (index < token.length) {
    const pair = token.slice(index, index + 2);
    if (CONDENSED_DAY_PAIRS[pair]) {
      accumulator.add(CONDENSED_DAY_PAIRS[pair]);
      index += 2;
      continue;
    }

    const singleChar = token[index];
    if (SINGLE_DAY_LETTERS[singleChar]) {
      const mapped = SINGLE_DAY_LETTERS[singleChar];
      // Saturday/Sunday disambiguation for single S
      if (singleChar === "S") {
        // Default the first S to Saturday, the second to Sunday if present.
        accumulator.add(mapped);
      } else {
        accumulator.add(mapped);
      }
    }
    index += 1;
  }
};

export const normalizeStatus = (status?: string | null): string | null => {
  if (!status) {
    return null;
  }
  return status.toString().trim().toLowerCase();
};

export const formatDisplayDate = (date: DateTime): string =>
  date.toFormat("MMM d");

