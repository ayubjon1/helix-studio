// ═══════════════════════════════════════════════════
//  Helix Studio — Internationalization (RU / EN)
// ═══════════════════════════════════════════════════

const I18N = {
    ru: {
        // Header
        "Model Ready": "Модель готова",

        // Modes
        "Текст → Речь": "Текст → Речь",
        "Клонирование": "Клонирование",
        "Дизайн голоса": "Дизайн голоса",

        // Panels
        "Синтез": "Синтез",
        "Результат": "Результат",

        // Text input
        "Текст для синтеза": "Текст для синтеза",
        "text_placeholder": "Введите текст, который нужно озвучить...",

        // Clone
        "Голосовые пресеты": "Голосовые пресеты",
        "Или загрузите новый голос": "Или загрузите новый голос",
        "drop_text": "Перетащите аудио или ",
        "drop_link": "выберите файл",
        "drop_hint": "WAV, MP3, FLAC — 3-30 сек",
        "drop_or_record": "или запишите с микрофона",
        "Записать": "Записать",
        "rec_stop": "— нажмите чтобы остановить",
        "Транскрипция": "Транскрипция",
        "transcription_optional": "(необязательно — авто через Whisper)",
        "ref_text_placeholder": "Текст, произнесённый в аудио...",
        "preset_name_placeholder": "Имя пресета...",
        "Сохранить голос": "Сохранить голос",
        "Нет сохранённых голосов": "Нет сохранённых голосов",

        // Design
        "Описание голоса": "Описание голоса",
        "instruct_placeholder": "female, young adult, british accent, low pitch...",
        "Пол:": "Пол:",
        "Возраст:": "Возраст:",
        "Тон:": "Тон:",
        "Акцент:": "Акцент:",
        "Стиль:": "Стиль:",
        "Готовые:": "Готовые:",
        "Молодая британка": "Молодая британка",
        "Мужчина баритон": "Мужчина баритон",
        "Ребёнок": "Ребёнок",
        "Пожилой с акцентом": "Пожилой с акцентом",
        "Шёпот": "Шёпот",

        // Params
        "Параметры генерации": "Параметры генерации",
        "Язык": "Язык",
        "Авто": "Авто",
        "Авто-определение": "Авто-определение",
        "Скорость": "Скорость",
        "Шаги диффузии": "Шаги диффузии",
        "steps_hint": "16 = быстро, 32 = баланс, 64 = макс. качество",
        "Длительность (сек)": "Длительность (сек)",
        "duration_hint": "0 = определяется автоматически по тексту",
        "Расширенные параметры": "Расширенные параметры",
        "guidance_hint": "Усиливает следование инструкциям (1=слабо, 5=строго)",
        "class_temp_hint": "0 = детерминированный, >0 = случайная вариативность",

        // Generate
        "Генерировать": "Генерировать",
        "Генерация...": "Генерация...",

        // Output
        "output_empty": "Введите текст и нажмите «Генерировать»",
        "error_occurred": "Произошла ошибка",
        "Попробовать снова": "Попробовать снова",

        // History
        "История": "История",
        "Пока пусто": "Пока пусто",

        // Shortcuts
        "Горячие клавиши": "Горячие клавиши",
        "shortcut_generate": "Генерировать",
        "shortcut_play": "Играть / Пауза",
        "shortcut_modes": "Режимы",

        // Trimmer
        "Сбросить": "Сбросить",

        // Toasts
        "toast_done": "Готово за",
        "toast_history_cleared": "История очищена",
        "toast_transcription_done": "Транскрипция готова",
        "toast_voice_saved": "Голос сохранён",
        "toast_enter_text": "Введите текст",
        "toast_upload_audio": "Сначала загрузите аудио",
        "toast_file_loaded": "Загружен",
        "toast_recorded": "Записано",
        "toast_saved": "Файл сохранён",
        "toast_no_mic": "Не удалось начать запись",
        "toast_preset_deleted": "Пресет удалён",
        "toast_downloading": "Скачивание...",
        "Сохраняю...": "Сохраняю...",
        "Мужчина 东北话": "Мужчина 东北话",
        "Записать": "Записать",
        "output_or": "или",
        "中文方言:": "中文方言:",

        // Voice design tags
        "tag.male": "мужской",
        "tag.female": "женский",
        "tag.child": "ребёнок",
        "tag.teenager": "подросток",
        "tag.young_adult": "молодой",
        "tag.middle_aged": "средний",
        "tag.elderly": "пожилой",
        "tag.very_low": "очень низкий",
        "tag.low": "низкий",
        "tag.moderate": "средний",
        "tag.high": "высокий",
        "tag.very_high": "очень высокий",
        "tag.american": "американский",
        "tag.british": "британский",
        "tag.australian": "австралийский",
        "tag.indian": "индийский",
        "tag.russian": "русский",
        "tag.chinese": "китайский",
        "tag.japanese": "японский",
        "tag.korean": "корейский",
        "tag.whisper": "шёпот",
        "preset_name_placeholder": "Имя пресета...",
        "search_lang_placeholder": "Поиск языка...",
        "toast_select_audio": "Выберите аудиофайл",
        "confirm_delete_preset": "Удалить этот голосовой пресет?",
        "confirm_clear_history": "Очистить всю историю?",
        "download_error": "Ошибка скачивания",
        "popular_languages": "Популярные",
        "all_languages": "Все языки",
        "nothing_found": "Ничего не найдено",
        "ТТС": "ТТС",
        "Клон": "Клон",
        "Дизайн": "Дизайн",

        // Update
        "update_checking": "Проверка обновлений...",
        "update_available": "Доступно обновление!",
        "update_latest": "У вас последняя версия",
        "update_error": "Не удалось проверить обновления",
        "Обновить": "Обновить",
    },

    en: {
        "Model Ready": "Model Ready",
        "Текст → Речь": "Text → Speech",
        "Клонирование": "Cloning",
        "Дизайн голоса": "Voice Design",
        "Синтез": "Synthesis",
        "Результат": "Result",
        "Текст для синтеза": "Text to synthesize",
        "text_placeholder": "Enter text to convert to speech...",
        "Голосовые пресеты": "Voice Presets",
        "Или загрузите новый голос": "Or upload a new voice",
        "drop_text": "Drop audio or ",
        "drop_link": "choose file",
        "drop_hint": "WAV, MP3, FLAC — 3-30 sec",
        "drop_or_record": "or record from microphone",
        "Записать": "Record",
        "rec_stop": "— click to stop",
        "Транскрипция": "Transcription",
        "transcription_optional": "(optional — auto via Whisper)",
        "ref_text_placeholder": "Text spoken in the audio...",
        "preset_name_placeholder": "Preset name...",
        "Сохранить голос": "Save Voice",
        "Нет сохранённых голосов": "No saved voices",
        "Описание голоса": "Voice Description",
        "instruct_placeholder": "female, young adult, british accent, low pitch...",
        "Пол:": "Gender:",
        "Возраст:": "Age:",
        "Тон:": "Pitch:",
        "Акцент:": "Accent:",
        "Стиль:": "Style:",
        "Готовые:": "Presets:",
        "Молодая британка": "Young British",
        "Мужчина баритон": "Male Baritone",
        "Ребёнок": "Child",
        "Пожилой с акцентом": "Elderly Accented",
        "Шёпот": "Whisper",
        "Параметры генерации": "Generation Parameters",
        "Язык": "Language",
        "Авто": "Auto",
        "Авто-определение": "Auto-detect",
        "Скорость": "Speed",
        "Шаги диффузии": "Diffusion Steps",
        "steps_hint": "16 = fast, 32 = balanced, 64 = max quality",
        "Длительность (сек)": "Duration (sec)",
        "duration_hint": "0 = auto based on text length",
        "Расширенные параметры": "Advanced Parameters",
        "guidance_hint": "Strengthens instruction following (1=weak, 5=strict)",
        "class_temp_hint": "0 = deterministic, >0 = random variation",
        "Генерировать": "Generate",
        "Генерация...": "Generating...",
        "output_empty": "Enter text and click \"Generate\"",
        "error_occurred": "An error occurred",
        "Попробовать снова": "Try Again",
        "История": "History",
        "Пока пусто": "Empty",
        "Горячие клавиши": "Keyboard Shortcuts",
        "shortcut_generate": "Generate",
        "shortcut_play": "Play / Pause",
        "shortcut_modes": "Modes",
        "Сбросить": "Reset",
        "toast_done": "Done in",
        "toast_history_cleared": "History cleared",
        "toast_transcription_done": "Transcription ready",
        "toast_voice_saved": "Voice saved",
        "toast_enter_text": "Enter text",
        "toast_upload_audio": "Upload audio first",
        "toast_file_loaded": "Loaded",
        "toast_recorded": "Recorded",
        "toast_saved": "File saved",
        "toast_no_mic": "Could not start recording",
        "toast_preset_deleted": "Preset deleted",
        "toast_downloading": "Downloading...",
        "Сохраняю...": "Saving...",
        "Мужчина 东北话": "Male 东北话",
        "Записать": "Record",
        "output_or": "or",
        "中文方言:": "Chinese Dialects:",

        // Voice design tags
        "tag.male": "male",
        "tag.female": "female",
        "tag.child": "child",
        "tag.teenager": "teenager",
        "tag.young_adult": "young adult",
        "tag.middle_aged": "middle-aged",
        "tag.elderly": "elderly",
        "tag.very_low": "very low",
        "tag.low": "low",
        "tag.moderate": "moderate",
        "tag.high": "high",
        "tag.very_high": "very high",
        "tag.american": "american",
        "tag.british": "british",
        "tag.australian": "australian",
        "tag.indian": "indian",
        "tag.russian": "russian",
        "tag.chinese": "chinese",
        "tag.japanese": "japanese",
        "tag.korean": "korean",
        "tag.whisper": "whisper",
        "preset_name_placeholder": "Preset name...",
        "search_lang_placeholder": "Search language...",
        "toast_select_audio": "Please select an audio file",
        "confirm_delete_preset": "Delete this voice preset?",
        "confirm_clear_history": "Clear all history?",
        "download_error": "Download error",
        "popular_languages": "Popular",
        "all_languages": "All languages",
        "nothing_found": "Nothing found",
        "ТТС": "TTS",
        "Клон": "Clone",
        "Дизайн": "Design",
        "update_checking": "Checking for updates...",
        "update_available": "Update available!",
        "update_latest": "You have the latest version",
        "update_error": "Could not check for updates",
        "Обновить": "Update",
    }
};

let currentLang = localStorage.getItem("helix-lang") || "ru";

function t(key) {
    return (I18N[currentLang] && I18N[currentLang][key]) || (I18N.ru[key]) || key;
}

function applyLanguage() {
    // Apply translations to all elements with data-i18n attribute
    document.querySelectorAll("[data-i18n]").forEach(el => {
        const key = el.getAttribute("data-i18n");
        // Skip lang-picker-text if a specific language is selected
        if (el.id === "lang-picker-text" && document.getElementById("language-select")?.value) return;
        el.textContent = t(key);
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
        el.placeholder = t(el.getAttribute("data-i18n-placeholder"));
    });
    document.querySelectorAll("[data-i18n-title]").forEach(el => {
        el.title = t(el.getAttribute("data-i18n-title"));
    });
}
