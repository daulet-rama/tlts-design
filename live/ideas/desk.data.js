// Собрано скриптом ideas/tools/build-desk.py из research/data/ — руками не править.
// Экран «Пульт турнирного дня» (desk.html): цифры архива лиги для расчёта дня и дождя.
export const DESK_ARCHIVE = {
  "tournaments": 37,
  "fullDays": 19,
  "fullDayList": [
    {
      "name": "TS CUP 1",
      "date": "2023-04-26",
      "season": 2023
    },
    {
      "name": "TS CUP 2",
      "date": "2023-05-10",
      "season": 2023
    },
    {
      "name": "Technodom Cup",
      "date": "2023-05-31",
      "season": 2023
    },
    {
      "name": "TS CUP 3",
      "date": "2023-06-04",
      "season": 2023
    },
    {
      "name": "TS CUP 4",
      "date": "2023-06-14",
      "season": 2023
    },
    {
      "name": "TS CUP 5",
      "date": "2023-08-06",
      "season": 2023
    },
    {
      "name": "TS CUP 6",
      "date": "2023-09-15",
      "season": 2023
    },
    {
      "name": "Жигули Open 2023",
      "date": "2023-09-09",
      "season": 2023
    },
    {
      "name": "TS CUP 1",
      "date": "2025-04-19",
      "season": 2025
    },
    {
      "name": "TS CUP 2",
      "date": "2025-05-31",
      "season": 2025
    },
    {
      "name": "TS CUP 4",
      "date": "2025-06-21",
      "season": 2025
    },
    {
      "name": "TS CUP 5",
      "date": "2025-06-29",
      "season": 2025
    },
    {
      "name": "TS CUP 6",
      "date": "2025-08-30",
      "season": 2025
    },
    {
      "name": "TS CUP 7",
      "date": "2025-09-06",
      "season": 2025
    },
    {
      "name": "Visa Open 2025",
      "date": "2025-05-03",
      "season": 2025
    },
    {
      "name": "TS CUP 1",
      "date": "2026-04-25",
      "season": 2026
    },
    {
      "name": "TS CUP 2",
      "date": "2026-05-30",
      "season": 2026
    },
    {
      "name": "TS CUP 3",
      "date": "2026-06-13",
      "season": 2026
    },
    {
      "name": "TS CUP 7",
      "date": "2026-09-12",
      "season": 2026
    }
  ],
  "days2026": [
    {
      "name": "TS CUP 1",
      "date": "2026-04-25",
      "season": 2026
    },
    {
      "name": "TS CUP 2",
      "date": "2026-05-30",
      "season": 2026
    },
    {
      "name": "TS CUP 3",
      "date": "2026-06-13",
      "season": 2026
    },
    {
      "name": "TS CUP 7",
      "date": "2026-09-12",
      "season": 2026
    }
  ],
  "springTournaments": 14,
  "months": {
    "4": 4,
    "5": 10,
    "6": 9,
    "7": 1,
    "8": 4,
    "9": 8,
    "10": 1
  },
  "groupMatches": 1492,
  "completeSets": 1483,
  "avgGames": 9.22,
  "scores": {
    "6:4": 339,
    "6:3": 328,
    "6:2": 271,
    "6:1": 183,
    "7:5": 138,
    "7:6": 126,
    "6:0": 98
  },
  "tiebreak76": 126,
  "zeroZero": {
    "count": 4,
    "samePair": true,
    "where": [
      "Visa Open 2026 · Группа D"
    ]
  },
  "oddScores": [
    {
      "t": "Forbes Cup",
      "date": "2023-05-19",
      "group": "Группа E",
      "score": "3:3"
    },
    {
      "t": "TS CUP 5",
      "date": "2023-08-06",
      "group": "Группа E",
      "score": "3:0"
    },
    {
      "t": "TS CUP 1",
      "date": "2024-04-24",
      "group": "Группа D",
      "score": "5:1"
    },
    {
      "t": "TS CUP 1",
      "date": "2024-04-24",
      "group": "Группа E",
      "score": "1:0"
    },
    {
      "t": "TS CUP 3",
      "date": "2024-05-29",
      "group": "Группа B",
      "score": "2:0"
    }
  ],
  "proSet8": [
    {
      "tournament": "Forbes Cup · 2023-05-19",
      "matches": 18
    },
    {
      "tournament": "Forbes Cup Open 2024 · 2024-05-24",
      "matches": 7
    },
    {
      "tournament": "TS CUP 7.0-7.5 · 2024-10-12",
      "matches": 19
    }
  ],
  "programs": [
    {
      "name": "Жигули Open 2023",
      "date": "2023-09-09",
      "slots": "09:00–09:50 · 09:50–10:40 · 10:40–11:30 · 11:30–12:20 · 12:20–13:10",
      "note": "день 2: каждый круг плей-офф — 50 минут, без перерыва между кругами",
      "source": "Программа Жигули Open 2023 (PDF), research/sections/05-tournament-documents.md, раздел 2.5"
    },
    {
      "name": "Жигули Open 2023",
      "date": "2023-09-09",
      "slots": "08:45 — начало игр",
      "note": "день 1: разминка 08:00–08:30, открытие 08:30–08:45, групповые игры с 08:45",
      "source": "Программа Жигули Open 2023 (PDF), там же"
    },
    {
      "name": "Итоговый TS CUP 2023",
      "date": "2023-09-27",
      "slots": "11:40–12:20 · 12:20–13:00 · 13:10–14:00",
      "note": "1/4, 1/2 и финал подряд: интервалы между кругами 0 и 10 минут",
      "source": "Программа Итогового TS CUP 2023 (картинка), там же"
    }
  ]
};
