// Сгенерировано tools/build-archive.py — не править руками.
// Настоящие игроки и матчи лиги из research/data. Чего нет в данных — null.
export const ARCHIVE = {
 "meta": {
  "generated": "2026-11-13",
  "ratingDate": "2026-09-07",
  "source": "research/data: rating_current.json, results_normalized.json, brackets_part1–4.json, tournaments.json",
  "notes": [
   "КПР, баллы и места в Бете и Альфе (rating.points — баллы Беты, rating.alphaPoints — баллы Альфы), rating.tournaments — из rating_current.json (рейтинг лиги на meta.ratingDate).",
   "rating.above — соседнее место выше в Бете и в Альфе (в своём уровне КПР) из того же rating_current.json; id — null, если этого игрока нет в прототипе.",
   "titles — по results_normalized.json: stage — чемпион высшей категории этапа (включая Forbes, Technodom, Жигули, Visa Open, TS CUP 7.0-7.5), final — Итоговый TS CUP, second — вторая категория.",
   "stageWins — те же победы titles.stage, разделённые: tsCup — этапы «TS CUP N», special — спецтурниры (Forbes Cup, Technodom Cup, Жигули Open, Visa Open, TS CUP 7.0-7.5); specialNames — их названия. Даёт ли спецтурнир звание «Чемпион этапа» — вопрос лиге, звание пока считается по titles.stage.",
   "partners[].kpr — КПР партнёра из rating_current.json (null, если его нет в рейтинге); name — «Имя Фамилия», как у игроков.",
   "finals/semis — финалы и полуфиналы высшей категории по сеткам (в 2023 высшая — Masters, вторая — Futures).",
   "tournaments, since, wl, partners — по сеткам, группам и спискам участников за 2023–2026; данных до 2023 нет, поэтому since — «не позже» (sinceApprox: true). Сокращённые имена в сетках 2023–2025 («Фамилия И.») сведены к полным по однозначному совпадению; неоднозначные не учтены.",
   "form — null: порядок матчей внутри группового этапа в данных не задан.",
   "age, hand — нет в данных (null).",
   "Пара: kprSum и pointsSum — сумма текущих КПР и баллов игроков, не на дату матча."
  ]
 },
 "players": [
  {
   "id": "a-abizhanov-ardak",
   "demo": false,
   "last": "Абижанов",
   "first": "Ардак",
   "patronymic": null,
   "name": "Ардак Абижанов",
   "short": "Абижанов А.",
   "age": null,
   "hand": null,
   "kpr": 4.0,
   "rating": {
    "points": 1520,
    "place": 20,
    "alphaPlace": 9,
    "alphaPoints": 1400,
    "tournaments": 7,
    "demo": false,
    "above": {
     "beta": {
      "place": 19,
      "name": "Сабит Султанов",
      "points": 1550,
      "id": "a-sultanov-sabit"
     },
     "alpha": {
      "place": 8,
      "name": "Ринат Топиев",
      "points": 1450,
      "id": "a-topiev-rinat"
     }
    }
   },
   "titles": {
    "stage": 0,
    "final": 0,
    "second": 0
   },
   "stageWins": {
    "tsCup": 0,
    "special": 0,
    "specialNames": []
   },
   "finalYears": [],
   "finals": 1,
   "semis": 2,
   "tournaments": 21,
   "since": 2023,
   "sinceApprox": true,
   "wl": {
    "season": [
     20,
     14
    ],
    "career": [
     42,
     45
    ]
   },
   "form": null,
   "partners": [
    {
     "id": "a-topiev-rinat",
     "name": "Ринат Топиев",
     "short": "Топиев Р.",
     "kpr": 4.0,
     "matches": 26,
     "tournaments": 5
    },
    {
     "id": "a-sulaymanov-armanzhan",
     "name": "Арманжан Сулайманов",
     "short": "Сулайманов А.",
     "kpr": 4.0,
     "matches": 16,
     "tournaments": 3
    },
    {
     "id": "a-kurinov-vladimir",
     "name": "Владимир Куринов",
     "short": "Куринов В.",
     "kpr": 4.0,
     "matches": 8,
     "tournaments": 2
    }
   ],
   "portrait": null
  },
  {
   "id": "a-bazarkulov-abdikhalyk",
   "demo": false,
   "last": "Базаркулов",
   "first": "Абдихалык",
   "patronymic": null,
   "name": "Абдихалык Базаркулов",
   "short": "Базаркулов А.",
   "age": null,
   "hand": null,
   "kpr": 3.5,
   "rating": {
    "points": 2370,
    "place": 2,
    "alphaPlace": 1,
    "alphaPoints": 1950,
    "tournaments": 10,
    "demo": false,
    "above": {
     "beta": {
      "place": 1,
      "name": "Сергей Шахворостов",
      "points": 2870,
      "id": "a-shakhvorostov-sergey"
     },
     "alpha": null
    }
   },
   "titles": {
    "stage": 2,
    "final": 0,
    "second": 2
   },
   "stageWins": {
    "tsCup": 2,
    "special": 0,
    "specialNames": []
   },
   "finalYears": [],
   "finals": 2,
   "semis": 5,
   "tournaments": 25,
   "since": 2023,
   "sinceApprox": true,
   "wl": {
    "season": [
     31,
     13
    ],
    "career": [
     71,
     48
    ]
   },
   "form": null,
   "partners": [
    {
     "id": "a-beysmakov-olzhas",
     "name": "Олжас Бейсмаков",
     "short": "Бейсмаков О.",
     "kpr": 4.5,
     "matches": 32,
     "tournaments": 6
    },
    {
     "id": "a-fakhradini-ali",
     "name": "Али Фахрадини",
     "short": "Фахрадини А.",
     "kpr": 4.0,
     "matches": 23,
     "tournaments": 5
    },
    {
     "id": "a-shakhvorostov-sergey",
     "name": "Сергей Шахворостов",
     "short": "Шахворостов С.",
     "kpr": 4.5,
     "matches": 14,
     "tournaments": 3
    }
   ],
   "portrait": null
  },
  {
   "id": "a-beysmakov-olzhas",
   "demo": false,
   "last": "Бейсмаков",
   "first": "Олжас",
   "patronymic": null,
   "name": "Олжас Бейсмаков",
   "short": "Бейсмаков О.",
   "age": null,
   "hand": null,
   "kpr": 4.5,
   "rating": {
    "points": 2300,
    "place": 3,
    "alphaPlace": 2,
    "alphaPoints": 2050,
    "tournaments": 10,
    "demo": false,
    "above": {
     "beta": {
      "place": 2,
      "name": "Абдихалык Базаркулов",
      "points": 2370,
      "id": "a-bazarkulov-abdikhalyk"
     },
     "alpha": {
      "place": 1,
      "name": "Сергей Шахворостов",
      "points": 2800,
      "id": "a-shakhvorostov-sergey"
     }
    }
   },
   "titles": {
    "stage": 2,
    "final": 0,
    "second": 0
   },
   "stageWins": {
    "tsCup": 2,
    "special": 0,
    "specialNames": []
   },
   "finalYears": [],
   "finals": 2,
   "semis": 7,
   "tournaments": 19,
   "since": 2024,
   "sinceApprox": true,
   "wl": {
    "season": [
     29,
     16
    ],
    "career": [
     60,
     35
    ]
   },
   "form": null,
   "partners": [
    {
     "id": "a-bazarkulov-abdikhalyk",
     "name": "Абдихалык Базаркулов",
     "short": "Базаркулов А.",
     "kpr": 3.5,
     "matches": 32,
     "tournaments": 6
    },
    {
     "id": "a-dakenov-meyrkhan",
     "name": "Мейрхан Дакенов",
     "short": "Дакенов М.",
     "kpr": 3.5,
     "matches": 26,
     "tournaments": 5
    },
    {
     "id": "a-adambekov-abylzhan",
     "name": "Абылжан Адамбеков",
     "short": "Адамбеков А.",
     "kpr": 3.5,
     "matches": 15,
     "tournaments": 3
    }
   ],
   "portrait": null
  },
  {
   "id": "a-beniaminov-zhan",
   "demo": false,
   "last": "Бениаминов",
   "first": "Жан",
   "patronymic": null,
   "name": "Жан Бениаминов",
   "short": "Бениаминов Ж.",
   "age": null,
   "hand": null,
   "kpr": 4.0,
   "rating": {
    "points": 1950,
    "place": 10,
    "alphaPlace": 1,
    "alphaPoints": 1850,
    "tournaments": 8,
    "demo": false,
    "above": {
     "beta": {
      "place": 9,
      "name": "Владимир Пономарев",
      "points": 2000,
      "id": "a-ponomarev-vladimir"
     },
     "alpha": null
    }
   },
   "titles": {
    "stage": 3,
    "final": 0,
    "second": 1
   },
   "stageWins": {
    "tsCup": 3,
    "special": 0,
    "specialNames": []
   },
   "finalYears": [],
   "finals": 8,
   "semis": 8,
   "tournaments": 32,
   "since": 2023,
   "sinceApprox": true,
   "wl": {
    "season": [
     26,
     7
    ],
    "career": [
     119,
     50
    ]
   },
   "form": null,
   "partners": [
    {
     "id": "a-nurambekov-timur",
     "name": "Тимур Нурамбеков",
     "short": "Нурамбеков Т.",
     "kpr": 4.0,
     "matches": 150,
     "tournaments": 28
    },
    {
     "id": "a-yashar-aziz",
     "name": "Азиз Яшар",
     "short": "Яшар А.",
     "kpr": 4.0,
     "matches": 8,
     "tournaments": 2
    },
    {
     "id": "a-topiev-rinat",
     "name": "Ринат Топиев",
     "short": "Топиев Р.",
     "kpr": 4.0,
     "matches": 6,
     "tournaments": 1
    }
   ],
   "portrait": null
  },
  {
   "id": "a-dakenov-meyrkhan",
   "demo": false,
   "last": "Дакенов",
   "first": "Мейрхан",
   "patronymic": null,
   "name": "Мейрхан Дакенов",
   "short": "Дакенов М.",
   "age": null,
   "hand": null,
   "kpr": 3.5,
   "rating": {
    "points": 1800,
    "place": 13,
    "alphaPlace": 2,
    "alphaPoints": 1750,
    "tournaments": 9,
    "demo": false,
    "above": {
     "beta": {
      "place": 12,
      "name": "Азиз Яшар",
      "points": 1900,
      "id": "a-yashar-aziz"
     },
     "alpha": {
      "place": 1,
      "name": "Абдихалык Базаркулов",
      "points": 1950,
      "id": "a-bazarkulov-abdikhalyk"
     }
    }
   },
   "titles": {
    "stage": 1,
    "final": 0,
    "second": 0
   },
   "stageWins": {
    "tsCup": 1,
    "special": 0,
    "specialNames": []
   },
   "finalYears": [],
   "finals": 1,
   "semis": 4,
   "tournaments": 17,
   "since": 2024,
   "sinceApprox": true,
   "wl": {
    "season": [
     25,
     16
    ],
    "career": [
     51,
     33
    ]
   },
   "form": null,
   "partners": [
    {
     "id": "a-markov-roman",
     "name": "Роман Марков",
     "short": "Марков Р.",
     "kpr": 4.5,
     "matches": 30,
     "tournaments": 6
    },
    {
     "id": "a-beysmakov-olzhas",
     "name": "Олжас Бейсмаков",
     "short": "Бейсмаков О.",
     "kpr": 4.5,
     "matches": 26,
     "tournaments": 5
    },
    {
     "id": "a-kim-yuriy",
     "name": "Юрий Ким",
     "short": "Ким Ю.",
     "kpr": 4.5,
     "matches": 8,
     "tournaments": 2
    }
   ],
   "portrait": null
  },
  {
   "id": "a-dostanov-farkhat",
   "demo": false,
   "last": "Достанов",
   "first": "Фархат",
   "patronymic": null,
   "name": "Фархат Достанов",
   "short": "Достанов Ф.",
   "age": null,
   "hand": null,
   "kpr": 5.0,
   "rating": {
    "points": 2300,
    "place": 4,
    "alphaPlace": 1,
    "alphaPoints": 2200,
    "tournaments": 7,
    "demo": false,
    "above": {
     "beta": {
      "place": 3,
      "name": "Олжас Бейсмаков",
      "points": 2300,
      "id": "a-beysmakov-olzhas"
     },
     "alpha": null
    }
   },
   "titles": {
    "stage": 6,
    "final": 3,
    "second": 0
   },
   "stageWins": {
    "tsCup": 4,
    "special": 2,
    "specialNames": [
     "Forbes Cup 2023",
     "Жигули Open 2023"
    ]
   },
   "finalYears": [
    2023,
    2024,
    2026
   ],
   "finals": 11,
   "semis": 14,
   "tournaments": 24,
   "since": 2023,
   "sinceApprox": true,
   "wl": {
    "season": [
     28,
     6
    ],
    "career": [
     106,
     28
    ]
   },
   "form": null,
   "partners": [
    {
     "id": "a-mukhammetov-riat",
     "name": "Риат Мухамметов",
     "short": "Мухамметов Р.",
     "kpr": 3.0,
     "matches": 25,
     "tournaments": 4
    },
    {
     "id": "a-kasanov-rezvan",
     "name": "Резван Касанов",
     "short": "Касанов Р.",
     "kpr": 4.0,
     "matches": 19,
     "tournaments": 3
    },
    {
     "id": "a-aytkesh-adil",
     "name": "Адил Айткеш",
     "short": "Айткеш А.",
     "kpr": 3.0,
     "matches": 14,
     "tournaments": 2
    }
   ],
   "portrait": null
  },
  {
   "id": "a-ibragimov-said",
   "demo": false,
   "last": "Ибрагимов",
   "first": "Саид",
   "patronymic": null,
   "name": "Саид Ибрагимов",
   "short": "Ибрагимов С.",
   "age": null,
   "hand": null,
   "kpr": 3.5,
   "rating": {
    "points": 1650,
    "place": 16,
    "alphaPlace": 3,
    "alphaPoints": 1650,
    "tournaments": 7,
    "demo": false,
    "above": {
     "beta": {
      "place": 15,
      "name": "Денис Старостенко",
      "points": 1750,
      "id": "a-starostenko-denis"
     },
     "alpha": {
      "place": 2,
      "name": "Мейрхан Дакенов",
      "points": 1750,
      "id": "a-dakenov-meyrkhan"
     }
    }
   },
   "titles": {
    "stage": 1,
    "final": 0,
    "second": 0
   },
   "stageWins": {
    "tsCup": 1,
    "special": 0,
    "specialNames": []
   },
   "finalYears": [],
   "finals": 2,
   "semis": 5,
   "tournaments": 14,
   "since": 2024,
   "sinceApprox": true,
   "wl": {
    "season": [
     25,
     8
    ],
    "career": [
     51,
     25
    ]
   },
   "form": null,
   "partners": [
    {
     "id": "a-shaykenov-abay",
     "name": "Абай Шайкенов",
     "short": "Шайкенов А.",
     "kpr": 4.5,
     "matches": 39,
     "tournaments": 7
    },
    {
     "id": "a-khakimov-almaz",
     "name": "Алмаз Хакимов",
     "short": "Хакимов А.",
     "kpr": 4.5,
     "matches": 10,
     "tournaments": 2
    },
    {
     "id": "a-kogay-valentin",
     "name": "Валентин Когай",
     "short": "Когай В.",
     "kpr": 4.5,
     "matches": 7,
     "tournaments": 1
    }
   ],
   "portrait": null
  },
  {
   "id": "a-kuznetsov-roman",
   "demo": false,
   "last": "Кузнецов",
   "first": "Роман",
   "patronymic": null,
   "name": "Роман Кузнецов",
   "short": "Кузнецов Р.",
   "age": null,
   "hand": null,
   "kpr": 5.0,
   "rating": {
    "points": 2270,
    "place": 5,
    "alphaPlace": 2,
    "alphaPoints": 2150,
    "tournaments": 8,
    "demo": false,
    "above": {
     "beta": {
      "place": 4,
      "name": "Фархат Достанов",
      "points": 2300,
      "id": "a-dostanov-farkhat"
     },
     "alpha": {
      "place": 1,
      "name": "Фархат Достанов",
      "points": 2200,
      "id": "a-dostanov-farkhat"
     }
    }
   },
   "titles": {
    "stage": 3,
    "final": 1,
    "second": 1
   },
   "stageWins": {
    "tsCup": 3,
    "special": 0,
    "specialNames": []
   },
   "finalYears": [
    2025
   ],
   "finals": 7,
   "semis": 11,
   "tournaments": 21,
   "since": 2024,
   "sinceApprox": true,
   "wl": {
    "season": [
     26,
     11
    ],
    "career": [
     84,
     34
    ]
   },
   "form": null,
   "partners": [
    {
     "id": "a-starostenko-denis",
     "name": "Денис Старостенко",
     "short": "Старостенко Д.",
     "kpr": 3.0,
     "matches": 51,
     "tournaments": 9
    },
    {
     "id": "a-kusainov-erulan",
     "name": "Ерулан Кусаинов",
     "short": "Кусаинов Е.",
     "kpr": null,
     "matches": 28,
     "tournaments": 5
    },
    {
     "id": "a-madinov-romin",
     "name": "Ромин Мадинов",
     "short": "Мадинов Р.",
     "kpr": 3.0,
     "matches": 16,
     "tournaments": 3
    }
   ],
   "portrait": null
  },
  {
   "id": "a-medeuov-adil",
   "demo": false,
   "last": "Медеуов",
   "first": "Адиль",
   "patronymic": null,
   "name": "Адиль Медеуов",
   "short": "Медеуов А.",
   "age": null,
   "hand": null,
   "kpr": 4.0,
   "rating": {
    "points": 1750,
    "place": 14,
    "alphaPlace": 6,
    "alphaPoints": 1700,
    "tournaments": 5,
    "demo": false,
    "above": {
     "beta": {
      "place": 13,
      "name": "Мейрхан Дакенов",
      "points": 1800,
      "id": "a-dakenov-meyrkhan"
     },
     "alpha": {
      "place": 5,
      "name": "Арманжан Сулайманов",
      "points": 1750,
      "id": "a-sulaymanov-armanzhan"
     }
    }
   },
   "titles": {
    "stage": 0,
    "final": 0,
    "second": 0
   },
   "stageWins": {
    "tsCup": 0,
    "special": 0,
    "specialNames": []
   },
   "finalYears": [],
   "finals": 2,
   "semis": 4,
   "tournaments": 19,
   "since": 2023,
   "sinceApprox": true,
   "wl": {
    "season": [
     19,
     10
    ],
    "career": [
     49,
     49
    ]
   },
   "form": null,
   "partners": [
    {
     "id": "a-kaldaev-bektursyn",
     "name": "Бектурсын Калдаев",
     "short": "Калдаев Б.",
     "kpr": 4.0,
     "matches": 33,
     "tournaments": 6
    },
    {
     "id": "a-sulaymanov-armanzhan",
     "name": "Арманжан Сулайманов",
     "short": "Сулайманов А.",
     "kpr": 4.0,
     "matches": 29,
     "tournaments": 6
    },
    {
     "id": "a-koblandy-farkhad",
     "name": "Фархад Кобланды",
     "short": "Кобланды Ф.",
     "kpr": 4.0,
     "matches": 19,
     "tournaments": 4
    }
   ],
   "portrait": null
  },
  {
   "id": "a-murzhukov-timur",
   "demo": false,
   "last": "Муржуков",
   "first": "Тимур",
   "patronymic": null,
   "name": "Тимур Муржуков",
   "short": "Муржуков Т.",
   "age": null,
   "hand": null,
   "kpr": 3.5,
   "rating": {
    "points": 1650,
    "place": 17,
    "alphaPlace": 4,
    "alphaPoints": 1450,
    "tournaments": 7,
    "demo": false,
    "above": {
     "beta": {
      "place": 16,
      "name": "Саид Ибрагимов",
      "points": 1650,
      "id": "a-ibragimov-said"
     },
     "alpha": {
      "place": 3,
      "name": "Саид Ибрагимов",
      "points": 1650,
      "id": "a-ibragimov-said"
     }
    }
   },
   "titles": {
    "stage": 1,
    "final": 0,
    "second": 0
   },
   "stageWins": {
    "tsCup": 1,
    "special": 0,
    "specialNames": []
   },
   "finalYears": [],
   "finals": 1,
   "semis": 5,
   "tournaments": 31,
   "since": 2023,
   "sinceApprox": true,
   "wl": {
    "season": [
     20,
     12
    ],
    "career": [
     69,
     79
    ]
   },
   "form": null,
   "partners": [
    {
     "id": "a-tagibekov-almas",
     "name": "Алмас Тагибеков",
     "short": "Тагибеков А.",
     "kpr": 4.0,
     "matches": 20,
     "tournaments": 4
    },
    {
     "id": "a-dzheksekov-islam",
     "name": "Ислам Джексеков",
     "short": "Джексеков И.",
     "kpr": 4.5,
     "matches": 19,
     "tournaments": 4
    },
    {
     "id": "a-urdashev-kayrat",
     "name": "Кайрат Урдашев",
     "short": "Урдашев К.",
     "kpr": 4.0,
     "matches": 19,
     "tournaments": 4
    }
   ],
   "portrait": null
  },
  {
   "id": "a-mukhammetov-riat",
   "demo": false,
   "last": "Мухамметов",
   "first": "Риат",
   "patronymic": null,
   "name": "Риат Мухамметов",
   "short": "Мухамметов Р.",
   "age": null,
   "hand": null,
   "kpr": 3.0,
   "rating": {
    "points": 2070,
    "place": 8,
    "alphaPlace": 1,
    "alphaPoints": 1970,
    "tournaments": 5,
    "demo": false,
    "above": {
     "beta": {
      "place": 7,
      "name": "Тимур Нурамбеков",
      "points": 2090,
      "id": "a-nurambekov-timur"
     },
     "alpha": null
    }
   },
   "titles": {
    "stage": 1,
    "final": 1,
    "second": 0
   },
   "stageWins": {
    "tsCup": 1,
    "special": 0,
    "specialNames": []
   },
   "finalYears": [
    2026
   ],
   "finals": 3,
   "semis": 3,
   "tournaments": 9,
   "since": 2025,
   "sinceApprox": true,
   "wl": {
    "season": [
     24,
     9
    ],
    "career": [
     27,
     12
    ]
   },
   "form": null,
   "partners": [
    {
     "id": "a-dostanov-farkhat",
     "name": "Фархат Достанов",
     "short": "Достанов Ф.",
     "kpr": 5.0,
     "matches": 25,
     "tournaments": 4
    },
    {
     "id": "a-alekseev-veniamin",
     "name": "Вениамин Алексеев",
     "short": "Алексеев В.",
     "kpr": 5.0,
     "matches": 8,
     "tournaments": 2
    },
    {
     "id": "a-arzumanov-sergey",
     "name": "Сергей Арзуманов",
     "short": "Арзуманов С.",
     "kpr": 5.0,
     "matches": 6,
     "tournaments": 1
    }
   ],
   "portrait": null
  },
  {
   "id": "a-mushekbaev-adil",
   "demo": false,
   "last": "Мушекбаев",
   "first": "Адиль",
   "patronymic": null,
   "name": "Адиль Мушекбаев",
   "short": "Мушекбаев А.",
   "age": null,
   "hand": null,
   "kpr": 4.5,
   "rating": {
    "points": 1900,
    "place": 11,
    "alphaPlace": 3,
    "alphaPoints": 1850,
    "tournaments": 7,
    "demo": false,
    "above": {
     "beta": {
      "place": 10,
      "name": "Жан Бениаминов",
      "points": 1950,
      "id": "a-beniaminov-zhan"
     },
     "alpha": {
      "place": 2,
      "name": "Олжас Бейсмаков",
      "points": 2050,
      "id": "a-beysmakov-olzhas"
     }
    }
   },
   "titles": {
    "stage": 0,
    "final": 0,
    "second": 1
   },
   "stageWins": {
    "tsCup": 0,
    "special": 0,
    "specialNames": []
   },
   "finalYears": [],
   "finals": 5,
   "semis": 8,
   "tournaments": 30,
   "since": 2023,
   "sinceApprox": true,
   "wl": {
    "season": [
     21,
     11
    ],
    "career": [
     92,
     58
    ]
   },
   "form": null,
   "partners": [
    {
     "id": "a-ponomarev-vladimir",
     "name": "Владимир Пономарев",
     "short": "Пономарев В.",
     "kpr": 4.0,
     "matches": 62,
     "tournaments": 13
    },
    {
     "id": "a-kim-lev",
     "name": "Лев Ким",
     "short": "Ким Л.",
     "kpr": 3.5,
     "matches": 27,
     "tournaments": 5
    },
    {
     "id": "a-sultanov-sabit",
     "name": "Сабит Султанов",
     "short": "Султанов С.",
     "kpr": 3.5,
     "matches": 16,
     "tournaments": 3
    }
   ],
   "portrait": null
  },
  {
   "id": "a-nurambekov-timur",
   "demo": false,
   "last": "Нурамбеков",
   "first": "Тимур",
   "patronymic": null,
   "name": "Тимур Нурамбеков",
   "short": "Нурамбеков Т.",
   "age": null,
   "hand": null,
   "kpr": 4.0,
   "rating": {
    "points": 2090,
    "place": 7,
    "alphaPlace": 2,
    "alphaPoints": 1850,
    "tournaments": 9,
    "demo": false,
    "above": {
     "beta": {
      "place": 6,
      "name": "Арманжан Сулайманов",
      "points": 2100,
      "id": "a-sulaymanov-armanzhan"
     },
     "alpha": {
      "place": 1,
      "name": "Жан Бениаминов",
      "points": 1850,
      "id": "a-beniaminov-zhan"
     }
    }
   },
   "titles": {
    "stage": 4,
    "final": 0,
    "second": 1
   },
   "stageWins": {
    "tsCup": 4,
    "special": 0,
    "specialNames": []
   },
   "finalYears": [],
   "finals": 9,
   "semis": 9,
   "tournaments": 32,
   "since": 2023,
   "sinceApprox": true,
   "wl": {
    "season": [
     30,
     10
    ],
    "career": [
     130,
     45
    ]
   },
   "form": null,
   "partners": [
    {
     "id": "a-beniaminov-zhan",
     "name": "Жан Бениаминов",
     "short": "Бениаминов Ж.",
     "kpr": 4.0,
     "matches": 150,
     "tournaments": 28
    },
    {
     "id": "a-yashar-aziz",
     "name": "Азиз Яшар",
     "short": "Яшар А.",
     "kpr": 4.0,
     "matches": 12,
     "tournaments": 2
    },
    {
     "id": "a-kekilbaev-dimash",
     "name": "Димаш Кекилбаев",
     "short": "Кекилбаев Д.",
     "kpr": 4.0,
     "matches": 7,
     "tournaments": 1
    }
   ],
   "portrait": null
  },
  {
   "id": "a-ponomarev-vladimir",
   "demo": false,
   "last": "Пономарев",
   "first": "Владимир",
   "patronymic": null,
   "name": "Владимир Пономарев",
   "short": "Пономарев В.",
   "age": null,
   "hand": null,
   "kpr": 4.0,
   "rating": {
    "points": 2000,
    "place": 9,
    "alphaPlace": 3,
    "alphaPoints": 1850,
    "tournaments": 8,
    "demo": false,
    "above": {
     "beta": {
      "place": 8,
      "name": "Риат Мухамметов",
      "points": 2070,
      "id": "a-mukhammetov-riat"
     },
     "alpha": {
      "place": 2,
      "name": "Тимур Нурамбеков",
      "points": 1850,
      "id": "a-nurambekov-timur"
     }
    }
   },
   "titles": {
    "stage": 2,
    "final": 0,
    "second": 2
   },
   "stageWins": {
    "tsCup": 1,
    "special": 1,
    "specialNames": [
     "Visa Open 2025"
    ]
   },
   "finalYears": [],
   "finals": 4,
   "semis": 9,
   "tournaments": 31,
   "since": 2023,
   "sinceApprox": true,
   "wl": {
    "season": [
     23,
     17
    ],
    "career": [
     95,
     58
    ]
   },
   "form": null,
   "partners": [
    {
     "id": "a-yashar-aziz",
     "name": "Азиз Яшар",
     "short": "Яшар А.",
     "kpr": 4.0,
     "matches": 79,
     "tournaments": 15
    },
    {
     "id": "a-mushekbaev-adil",
     "name": "Адиль Мушекбаев",
     "short": "Мушекбаев А.",
     "kpr": 4.5,
     "matches": 62,
     "tournaments": 13
    },
    {
     "id": "a-ibragimov-said",
     "name": "Саид Ибрагимов",
     "short": "Ибрагимов С.",
     "kpr": 3.5,
     "matches": 5,
     "tournaments": 1
    }
   ],
   "portrait": null
  },
  {
   "id": "a-raisov-amanzhol",
   "demo": false,
   "last": "Раисов",
   "first": "Аманжол",
   "patronymic": null,
   "name": "Аманжол Раисов",
   "short": "Раисов А.",
   "age": null,
   "hand": null,
   "kpr": 3.5,
   "rating": {
    "points": 1210,
    "place": 26,
    "alphaPlace": 8,
    "alphaPoints": 1090,
    "tournaments": 7,
    "demo": false,
    "above": {
     "beta": {
      "place": 25,
      "name": "Алмаз Хакимов",
      "points": 1250,
      "id": null
     },
     "alpha": {
      "place": 7,
      "name": "Даулет Утегулов",
      "points": 1120,
      "id": null
     }
    }
   },
   "titles": {
    "stage": 0,
    "final": 0,
    "second": 0
   },
   "stageWins": {
    "tsCup": 0,
    "special": 0,
    "specialNames": []
   },
   "finalYears": [],
   "finals": 3,
   "semis": 7,
   "tournaments": 34,
   "since": 2023,
   "sinceApprox": true,
   "wl": {
    "season": [
     17,
     24
    ],
    "career": [
     78,
     83
    ]
   },
   "form": null,
   "partners": [
    {
     "id": "a-shakhvorostov-sergey",
     "name": "Сергей Шахворостов",
     "short": "Шахворостов С.",
     "kpr": 4.5,
     "matches": 14,
     "tournaments": 3
    },
    {
     "id": "a-chakenov-zhalgas",
     "name": "Жалгас Чакенов",
     "short": "Чакенов Ж.",
     "kpr": 4.5,
     "matches": 13,
     "tournaments": 2
    },
    {
     "id": "a-khakimov-almaz",
     "name": "Алмаз Хакимов",
     "short": "Хакимов А.",
     "kpr": 4.5,
     "matches": 12,
     "tournaments": 2
    }
   ],
   "portrait": null
  },
  {
   "id": "a-smagulov-arman",
   "demo": false,
   "last": "Смагулов",
   "first": "Арман",
   "patronymic": null,
   "name": "Арман Смагулов",
   "short": "Смагулов А.",
   "age": null,
   "hand": null,
   "kpr": 4.5,
   "rating": {
    "points": 1170,
    "place": 28,
    "alphaPlace": 7,
    "alphaPoints": 970,
    "tournaments": 8,
    "demo": false,
    "above": {
     "beta": {
      "place": 27,
      "name": "Ануар Байбосынов",
      "points": 1200,
      "id": null
     },
     "alpha": {
      "place": 6,
      "name": "Ануар Байбосынов",
      "points": 1200,
      "id": null
     }
    }
   },
   "titles": {
    "stage": 0,
    "final": 0,
    "second": 1
   },
   "stageWins": {
    "tsCup": 0,
    "special": 0,
    "specialNames": []
   },
   "finalYears": [],
   "finals": 0,
   "semis": 2,
   "tournaments": 16,
   "since": 2024,
   "sinceApprox": true,
   "wl": {
    "season": [
     22,
     16
    ],
    "career": [
     40,
     33
    ]
   },
   "form": null,
   "partners": [
    {
     "id": "a-kusainov-erulan",
     "name": "Ерулан Кусаинов",
     "short": "Кусаинов Е.",
     "kpr": null,
     "matches": 23,
     "tournaments": 4
    },
    {
     "id": "a-tolbasy-serik",
     "name": "Серік Төлбасы",
     "short": "Төлбасы С.",
     "kpr": 3.5,
     "matches": 17,
     "tournaments": 4
    },
    {
     "id": "a-bazarkulov-abdikhalyk",
     "name": "Абдихалык Базаркулов",
     "short": "Базаркулов А.",
     "kpr": 3.5,
     "matches": 12,
     "tournaments": 3
    }
   ],
   "portrait": null
  },
  {
   "id": "a-starostenko-denis",
   "demo": false,
   "last": "Старостенко",
   "first": "Денис",
   "patronymic": "Анатольевич",
   "name": "Денис Старостенко",
   "short": "Старостенко Д.",
   "age": null,
   "hand": null,
   "kpr": 3.0,
   "rating": {
    "points": 1750,
    "place": 15,
    "alphaPlace": 2,
    "alphaPoints": 1700,
    "tournaments": 6,
    "demo": false,
    "above": {
     "beta": {
      "place": 14,
      "name": "Адиль Медеуов",
      "points": 1750,
      "id": "a-medeuov-adil"
     },
     "alpha": {
      "place": 1,
      "name": "Риат Мухамметов",
      "points": 1970,
      "id": "a-mukhammetov-riat"
     }
    }
   },
   "titles": {
    "stage": 1,
    "final": 1,
    "second": 0
   },
   "stageWins": {
    "tsCup": 1,
    "special": 0,
    "specialNames": []
   },
   "finalYears": [
    2025
   ],
   "finals": 4,
   "semis": 6,
   "tournaments": 13,
   "since": 2025,
   "sinceApprox": true,
   "wl": {
    "season": [
     19,
     12
    ],
    "career": [
     43,
     25
    ]
   },
   "form": null,
   "partners": [
    {
     "id": "a-kuznetsov-roman",
     "name": "Роман Кузнецов",
     "short": "Кузнецов Р.",
     "kpr": 5.0,
     "matches": 51,
     "tournaments": 9
    },
    {
     "id": "a-arzumanov-sergey",
     "name": "Сергей Арзуманов",
     "short": "Арзуманов С.",
     "kpr": 5.0,
     "matches": 5,
     "tournaments": 1
    },
    {
     "id": "a-kryukov-oleg",
     "name": "Олег Крюков",
     "short": "Крюков О.",
     "kpr": 5.0,
     "matches": 4,
     "tournaments": 1
    }
   ],
   "portrait": null
  },
  {
   "id": "a-sulaymanov-armanzhan",
   "demo": false,
   "last": "Сулайманов",
   "first": "Арманжан",
   "patronymic": null,
   "name": "Арманжан Сулайманов",
   "short": "Сулайманов А.",
   "age": null,
   "hand": null,
   "kpr": 4.0,
   "rating": {
    "points": 2100,
    "place": 6,
    "alphaPlace": 5,
    "alphaPoints": 1750,
    "tournaments": 8,
    "demo": false,
    "above": {
     "beta": {
      "place": 5,
      "name": "Роман Кузнецов",
      "points": 2270,
      "id": "a-kuznetsov-roman"
     },
     "alpha": {
      "place": 4,
      "name": "Азиз Яшар",
      "points": 1850,
      "id": "a-yashar-aziz"
     }
    }
   },
   "titles": {
    "stage": 1,
    "final": 0,
    "second": 1
   },
   "stageWins": {
    "tsCup": 0,
    "special": 1,
    "specialNames": [
     "Technodom Cup 2023"
    ]
   },
   "finalYears": [],
   "finals": 5,
   "semis": 11,
   "tournaments": 28,
   "since": 2023,
   "sinceApprox": true,
   "wl": {
    "season": [
     26,
     15
    ],
    "career": [
     103,
     46
    ]
   },
   "form": null,
   "partners": [
    {
     "id": "a-medeuov-adil",
     "name": "Адиль Медеуов",
     "short": "Медеуов А.",
     "kpr": 4.0,
     "matches": 29,
     "tournaments": 6
    },
    {
     "id": "a-markov-roman",
     "name": "Роман Марков",
     "short": "Марков Р.",
     "kpr": 4.5,
     "matches": 19,
     "tournaments": 3
    },
    {
     "id": "a-kim-yuriy",
     "name": "Юрий Ким",
     "short": "Ким Ю.",
     "kpr": 4.5,
     "matches": 17,
     "tournaments": 3
    }
   ],
   "portrait": null
  },
  {
   "id": "a-sultanov-sabit",
   "demo": false,
   "last": "Султанов",
   "first": "Сабит",
   "patronymic": null,
   "name": "Сабит Султанов",
   "short": "Султанов С.",
   "age": null,
   "hand": null,
   "kpr": 3.5,
   "rating": {
    "points": 1550,
    "place": 19,
    "alphaPlace": 5,
    "alphaPoints": 1350,
    "tournaments": 8,
    "demo": false,
    "above": {
     "beta": {
      "place": 18,
      "name": "Ринат Топиев",
      "points": 1600,
      "id": "a-topiev-rinat"
     },
     "alpha": {
      "place": 4,
      "name": "Тимур Муржуков",
      "points": 1450,
      "id": "a-murzhukov-timur"
     }
    }
   },
   "titles": {
    "stage": 0,
    "final": 0,
    "second": 2
   },
   "stageWins": {
    "tsCup": 0,
    "special": 0,
    "specialNames": []
   },
   "finalYears": [],
   "finals": 1,
   "semis": 2,
   "tournaments": 17,
   "since": 2024,
   "sinceApprox": true,
   "wl": {
    "season": [
     24,
     17
    ],
    "career": [
     40,
     44
    ]
   },
   "form": null,
   "partners": [
    {
     "id": "a-bakiev-nazimzhan",
     "name": "Назимжан Бакиев",
     "short": "Бакиев Н.",
     "kpr": 4.5,
     "matches": 23,
     "tournaments": 5
    },
    {
     "id": "a-mushekbaev-adil",
     "name": "Адиль Мушекбаев",
     "short": "Мушекбаев А.",
     "kpr": 4.5,
     "matches": 16,
     "tournaments": 3
    },
    {
     "id": "a-shaykenov-abay",
     "name": "Абай Шайкенов",
     "short": "Шайкенов А.",
     "kpr": 4.5,
     "matches": 10,
     "tournaments": 2
    }
   ],
   "portrait": null
  },
  {
   "id": "a-topiev-rinat",
   "demo": false,
   "last": "Топиев",
   "first": "Ринат",
   "patronymic": null,
   "name": "Ринат Топиев",
   "short": "Топиев Р.",
   "age": null,
   "hand": null,
   "kpr": 4.0,
   "rating": {
    "points": 1600,
    "place": 18,
    "alphaPlace": 8,
    "alphaPoints": 1450,
    "tournaments": 6,
    "demo": false,
    "above": {
     "beta": {
      "place": 17,
      "name": "Тимур Муржуков",
      "points": 1650,
      "id": "a-murzhukov-timur"
     },
     "alpha": {
      "place": 7,
      "name": "Даниар Абенов",
      "points": 1610,
      "id": null
     }
    }
   },
   "titles": {
    "stage": 0,
    "final": 0,
    "second": 1
   },
   "stageWins": {
    "tsCup": 0,
    "special": 0,
    "specialNames": []
   },
   "finalYears": [],
   "finals": 1,
   "semis": 1,
   "tournaments": 14,
   "since": 2025,
   "sinceApprox": true,
   "wl": {
    "season": [
     22,
     11
    ],
    "career": [
     30,
     34
    ]
   },
   "form": null,
   "partners": [
    {
     "id": "a-abizhanov-ardak",
     "name": "Ардак Абижанов",
     "short": "Абижанов А.",
     "kpr": 4.0,
     "matches": 26,
     "tournaments": 5
    },
    {
     "id": "a-shynasilov-kuandyk",
     "name": "Куандык Шынасилов",
     "short": "Шынасилов К.",
     "kpr": 4.0,
     "matches": 12,
     "tournaments": 3
    },
    {
     "id": "a-sulaymanov-armanzhan",
     "name": "Арманжан Сулайманов",
     "short": "Сулайманов А.",
     "kpr": 4.0,
     "matches": 7,
     "tournaments": 1
    }
   ],
   "portrait": null
  },
  {
   "id": "a-shaykenov-abay",
   "demo": false,
   "last": "Шайкенов",
   "first": "Абай",
   "patronymic": null,
   "name": "Абай Шайкенов",
   "short": "Шайкенов А.",
   "age": null,
   "hand": null,
   "kpr": 4.5,
   "rating": {
    "points": 1290,
    "place": 24,
    "alphaPlace": 4,
    "alphaPoints": 1290,
    "tournaments": 7,
    "demo": false,
    "above": {
     "beta": {
      "place": 23,
      "name": "Серік Төлбасы",
      "points": 1350,
      "id": null
     },
     "alpha": {
      "place": 3,
      "name": "Адиль Мушекбаев",
      "points": 1850,
      "id": "a-mushekbaev-adil"
     }
    }
   },
   "titles": {
    "stage": 1,
    "final": 0,
    "second": 1
   },
   "stageWins": {
    "tsCup": 1,
    "special": 0,
    "specialNames": []
   },
   "finalYears": [],
   "finals": 4,
   "semis": 7,
   "tournaments": 27,
   "since": 2023,
   "sinceApprox": true,
   "wl": {
    "season": [
     25,
     11
    ],
    "career": [
     87,
     48
    ]
   },
   "form": null,
   "partners": [
    {
     "id": "a-ibragimov-said",
     "name": "Саид Ибрагимов",
     "short": "Ибрагимов С.",
     "kpr": 3.5,
     "matches": 39,
     "tournaments": 7
    },
    {
     "id": "a-tolbasy-serik",
     "name": "Серік Төлбасы",
     "short": "Төлбасы С.",
     "kpr": 3.5,
     "matches": 24,
     "tournaments": 6
    },
    {
     "id": "a-yashar-aziz",
     "name": "Азиз Яшар",
     "short": "Яшар А.",
     "kpr": 4.0,
     "matches": 16,
     "tournaments": 4
    }
   ],
   "portrait": null
  },
  {
   "id": "a-shakhvorostov-sergey",
   "demo": false,
   "last": "Шахворостов",
   "first": "Сергей",
   "patronymic": null,
   "name": "Сергей Шахворостов",
   "short": "Шахворостов С.",
   "age": null,
   "hand": null,
   "kpr": 4.5,
   "rating": {
    "points": 2870,
    "place": 1,
    "alphaPlace": 1,
    "alphaPoints": 2800,
    "tournaments": 8,
    "demo": false,
    "above": {
     "beta": null,
     "alpha": null
    }
   },
   "titles": {
    "stage": 8,
    "final": 0,
    "second": 1
   },
   "stageWins": {
    "tsCup": 6,
    "special": 2,
    "specialNames": [
     "Forbes Cup Open 2024",
     "Visa Open 2026"
    ]
   },
   "finalYears": [],
   "finals": 10,
   "semis": 20,
   "tournaments": 33,
   "since": 2023,
   "sinceApprox": true,
   "wl": {
    "season": [
     25,
     10
    ],
    "career": [
     127,
     52
    ]
   },
   "form": null,
   "partners": [
    {
     "id": "a-yashar-aziz",
     "name": "Азиз Яшар",
     "short": "Яшар А.",
     "kpr": 4.0,
     "matches": 53,
     "tournaments": 9
    },
    {
     "id": "a-bakiev-nazimzhan",
     "name": "Назимжан Бакиев",
     "short": "Бакиев Н.",
     "kpr": 4.5,
     "matches": 41,
     "tournaments": 7
    },
    {
     "id": "a-rakhimgaliev-talgat",
     "name": "Талгат Рахимгалиев",
     "short": "Рахимгалиев Т.",
     "kpr": 3.5,
     "matches": 17,
     "tournaments": 3
    }
   ],
   "portrait": null
  },
  {
   "id": "a-yashar-aziz",
   "demo": false,
   "last": "Яшар",
   "first": "Азиз",
   "patronymic": null,
   "name": "Азиз Яшар",
   "short": "Яшар А.",
   "age": null,
   "hand": null,
   "kpr": 4.0,
   "rating": {
    "points": 1900,
    "place": 12,
    "alphaPlace": 4,
    "alphaPoints": 1850,
    "tournaments": 7,
    "demo": false,
    "above": {
     "beta": {
      "place": 11,
      "name": "Адиль Мушекбаев",
      "points": 1900,
      "id": "a-mushekbaev-adil"
     },
     "alpha": {
      "place": 3,
      "name": "Владимир Пономарев",
      "points": 1850,
      "id": "a-ponomarev-vladimir"
     }
    }
   },
   "titles": {
    "stage": 5,
    "final": 0,
    "second": 3
   },
   "stageWins": {
    "tsCup": 4,
    "special": 1,
    "specialNames": [
     "Visa Open 2025"
    ]
   },
   "finalYears": [],
   "finals": 8,
   "semis": 15,
   "tournaments": 35,
   "since": 2023,
   "sinceApprox": true,
   "wl": {
    "season": [
     22,
     14
    ],
    "career": [
     128,
     60
    ]
   },
   "form": null,
   "partners": [
    {
     "id": "a-ponomarev-vladimir",
     "name": "Владимир Пономарев",
     "short": "Пономарев В.",
     "kpr": 4.0,
     "matches": 79,
     "tournaments": 15
    },
    {
     "id": "a-shakhvorostov-sergey",
     "name": "Сергей Шахворостов",
     "short": "Шахворостов С.",
     "kpr": 4.5,
     "matches": 53,
     "tournaments": 9
    },
    {
     "id": "a-shaykenov-abay",
     "name": "Абай Шайкенов",
     "short": "Шайкенов А.",
     "kpr": 4.5,
     "matches": 16,
     "tournaments": 4
    }
   ],
   "portrait": null
  }
 ],
 "pairs": [
  {
   "id": "ap-raisov-amanzhol-shakhvorostov-sergey",
   "players": [
    "a-raisov-amanzhol",
    "a-shakhvorostov-sergey"
   ],
   "kprSum": 8.0,
   "pointsSum": 4080,
   "seed": null
  },
  {
   "id": "ap-kuznetsov-roman-starostenko-denis",
   "players": [
    "a-kuznetsov-roman",
    "a-starostenko-denis"
   ],
   "kprSum": 8.0,
   "pointsSum": 4020,
   "seed": null
  },
  {
   "id": "ap-nurambekov-timur-beniaminov-zhan",
   "players": [
    "a-nurambekov-timur",
    "a-beniaminov-zhan"
   ],
   "kprSum": 8.0,
   "pointsSum": 4040,
   "seed": null
  },
  {
   "id": "ap-shaykenov-abay-ibragimov-said",
   "players": [
    "a-shaykenov-abay",
    "a-ibragimov-said"
   ],
   "kprSum": 8.0,
   "pointsSum": 2940,
   "seed": null
  },
  {
   "id": "ap-dostanov-farkhat-mukhammetov-riat",
   "players": [
    "a-dostanov-farkhat",
    "a-mukhammetov-riat"
   ],
   "kprSum": 8.0,
   "pointsSum": 4370,
   "seed": null
  },
  {
   "id": "ap-beysmakov-olzhas-dakenov-meyrkhan",
   "players": [
    "a-beysmakov-olzhas",
    "a-dakenov-meyrkhan"
   ],
   "kprSum": 8.0,
   "pointsSum": 4100,
   "seed": null
  },
  {
   "id": "ap-murzhukov-timur-smagulov-arman",
   "players": [
    "a-murzhukov-timur",
    "a-smagulov-arman"
   ],
   "kprSum": 8.0,
   "pointsSum": 2820,
   "seed": null
  }
 ],
 "tournaments": [
  {
   "id": "t-a80",
   "sourceId": 80,
   "name": "TS CUP 7",
   "season": 2026,
   "date": "2026-09-12",
   "venue": "Gorky Tennis Park",
   "demo": false,
   "categories": [
    "Grand Masters",
    "Masters"
   ]
  },
  {
   "id": "t-a81",
   "sourceId": 81,
   "name": "Итоговый TS CUP 2026",
   "season": 2026,
   "date": "2026-09-25",
   "venue": "Gorky Tennis Park",
   "demo": false,
   "categories": [
    "Grand Masters",
    "Masters"
   ]
  }
 ],
 "matches": [
  {
   "id": "m-a80-sf1",
   "tournamentId": "t-a80",
   "stage": "1/2 финала",
   "category": "Grand Masters",
   "pairs": [
    "ap-raisov-amanzhol-shakhvorostov-sergey",
    "ap-kuznetsov-roman-starostenko-denis"
   ],
   "result": [
    6,
    4
   ],
   "h2h": {
    "wins": [
     0,
     0
    ],
    "meetings": []
   }
  },
  {
   "id": "m-a80-sf2",
   "tournamentId": "t-a80",
   "stage": "1/2 финала",
   "category": "Grand Masters",
   "pairs": [
    "ap-nurambekov-timur-beniaminov-zhan",
    "ap-shaykenov-abay-ibragimov-said"
   ],
   "result": [
    7,
    6
   ],
   "h2h": {
    "wins": [
     0,
     0
    ],
    "meetings": []
   }
  },
  {
   "id": "m-a80-f",
   "tournamentId": "t-a80",
   "stage": "Финал",
   "category": "Grand Masters",
   "pairs": [
    "ap-raisov-amanzhol-shakhvorostov-sergey",
    "ap-nurambekov-timur-beniaminov-zhan"
   ],
   "result": [
    0,
    6
   ],
   "h2h": {
    "wins": [
     0,
     0
    ],
    "meetings": []
   }
  },
  {
   "id": "m-a81-sf1",
   "tournamentId": "t-a81",
   "stage": "1/2 финала",
   "category": "Grand Masters",
   "pairs": [
    "ap-dostanov-farkhat-mukhammetov-riat",
    "ap-beysmakov-olzhas-dakenov-meyrkhan"
   ],
   "result": [
    6,
    2
   ],
   "h2h": {
    "wins": [
     0,
     0
    ],
    "meetings": []
   }
  },
  {
   "id": "m-a81-sf2",
   "tournamentId": "t-a81",
   "stage": "1/2 финала",
   "category": "Grand Masters",
   "pairs": [
    "ap-shaykenov-abay-ibragimov-said",
    "ap-murzhukov-timur-smagulov-arman"
   ],
   "result": [
    7,
    6
   ],
   "h2h": {
    "wins": [
     0,
     0
    ],
    "meetings": []
   }
  },
  {
   "id": "m-a81-f",
   "tournamentId": "t-a81",
   "stage": "Финал",
   "category": "Grand Masters",
   "pairs": [
    "ap-dostanov-farkhat-mukhammetov-riat",
    "ap-shaykenov-abay-ibragimov-said"
   ],
   "result": [
    6,
    1
   ],
   "h2h": {
    "wins": [
     1,
     0
    ],
    "meetings": [
     {
      "date": "2026-09-25",
      "tournament": "ИТОГОВЫЙ TS CUP 2026",
      "tournamentId": 81,
      "stage": "Группа A",
      "category": null,
      "score": "6:2",
      "winner": 0
     }
    ]
   }
  }
 ],
 "ratingBeta": [
  {
   "place": 1,
   "id": "a-shakhvorostov-sergey",
   "points": 2870,
   "kpr": 4.5,
   "tournaments": 8
  },
  {
   "place": 2,
   "id": "a-bazarkulov-abdikhalyk",
   "points": 2370,
   "kpr": 3.5,
   "tournaments": 10
  },
  {
   "place": 3,
   "id": "a-beysmakov-olzhas",
   "points": 2300,
   "kpr": 4.5,
   "tournaments": 10
  },
  {
   "place": 4,
   "id": "a-dostanov-farkhat",
   "points": 2300,
   "kpr": 5.0,
   "tournaments": 7
  },
  {
   "place": 5,
   "id": "a-kuznetsov-roman",
   "points": 2270,
   "kpr": 5.0,
   "tournaments": 8
  },
  {
   "place": 6,
   "id": "a-sulaymanov-armanzhan",
   "points": 2100,
   "kpr": 4.0,
   "tournaments": 8
  },
  {
   "place": 7,
   "id": "a-nurambekov-timur",
   "points": 2090,
   "kpr": 4.0,
   "tournaments": 9
  },
  {
   "place": 8,
   "id": "a-mukhammetov-riat",
   "points": 2070,
   "kpr": 3.0,
   "tournaments": 5
  },
  {
   "place": 9,
   "id": "a-ponomarev-vladimir",
   "points": 2000,
   "kpr": 4.0,
   "tournaments": 8
  },
  {
   "place": 10,
   "id": "a-beniaminov-zhan",
   "points": 1950,
   "kpr": 4.0,
   "tournaments": 8
  },
  {
   "place": 11,
   "id": "a-mushekbaev-adil",
   "points": 1900,
   "kpr": 4.5,
   "tournaments": 7
  },
  {
   "place": 12,
   "id": "a-yashar-aziz",
   "points": 1900,
   "kpr": 4.0,
   "tournaments": 7
  },
  {
   "place": 13,
   "id": "a-dakenov-meyrkhan",
   "points": 1800,
   "kpr": 3.5,
   "tournaments": 9
  },
  {
   "place": 14,
   "id": "a-medeuov-adil",
   "points": 1750,
   "kpr": 4.0,
   "tournaments": 5
  },
  {
   "place": 15,
   "id": "a-starostenko-denis",
   "points": 1750,
   "kpr": 3.0,
   "tournaments": 6
  },
  {
   "place": 16,
   "id": "a-ibragimov-said",
   "points": 1650,
   "kpr": 3.5,
   "tournaments": 7
  },
  {
   "place": 17,
   "id": "a-murzhukov-timur",
   "points": 1650,
   "kpr": 3.5,
   "tournaments": 7
  },
  {
   "place": 18,
   "id": "a-topiev-rinat",
   "points": 1600,
   "kpr": 4.0,
   "tournaments": 6
  },
  {
   "place": 19,
   "id": "a-sultanov-sabit",
   "points": 1550,
   "kpr": 3.5,
   "tournaments": 8
  },
  {
   "place": 20,
   "id": "a-abizhanov-ardak",
   "points": 1520,
   "kpr": 4.0,
   "tournaments": 7
  }
 ]
};
export default ARCHIVE;
