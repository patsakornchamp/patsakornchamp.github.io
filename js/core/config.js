// Reading URL Parameter for Multi-tenant support
const urlParams = new URLSearchParams(window.location.search);
let schoolParam = urlParams.get('school');
if (schoolParam) {
    localStorage.setItem('SELECTED_SCHOOL', schoolParam);
} else {
    schoolParam = localStorage.getItem('SELECTED_SCHOOL') || '';
}

// Environment configuration mapping
let ENVIRONMENT;

if (schoolParam === 'rnn') {
    ENVIRONMENT = {
        keyPrefix: 'rnn_',
        systemName: "ระบบของโรงเรียน RNN",
        databaseUrl: "https://script.google.com/macros/s/AKfycbxVEMuweYZ4KHHIqvXWOnCKc0yOrgUlMowJr4R6ZWmFVGHwMezs3gthHRL4N-rNLWDVbw/exec",
        periods: [
            { value: "1", label: "คาบที่ 1 (08.30-09.20)" },
            { value: "2", label: "คาบที่ 2 (09.20-10.10)" },
            { value: "พัก", label: "พัก (10.10-10.20)" },
            { value: "3", label: "คาบที่ 3 (10.20-11.10)" },
            { value: "4", label: "คาบที่ 4 (11.10-12.00)" },
            { value: "5", label: "คาบที่ 5 (12.00-12.50)" },
            { value: "6", label: "คาบที่ 6 (12.50-13.40)" },
            { value: "7", label: "คาบที่ 7 (13.40-14.30)" },
            { value: "8", label: "คาบที่ 8 (14.30-15.20)" },
            { value: "9", label: "คาบที่ 9 (15.20-16.10)" }
        ]
    };
} else if (schoolParam === 'abc') {
    ENVIRONMENT = {
        keyPrefix: 'abc_',
        systemName: "ระบบของโรงเรียน ABC",
        databaseUrl: "https://script.google.com/macros/s/---ABC-ID---/exec",
        periods: [
            { value: "โฮมรูม", label: "โฮมรูม (08.00-08.30)" },
            { value: "1", label: "คาบที่ 1 (08.30-09.20)" },
            { value: "2", label: "คาบที่ 2 (09.20-10.10)" },
            { value: "3", label: "คาบที่ 3 (10.10-11.00)" },
            { value: "4", label: "คาบที่ 4 (11.00-11.50)" },
            { value: "พักเที่ยง", label: "พักเที่ยง (11.50-12.40)" },
            { value: "5", label: "คาบที่ 5 (12.40-13.30)" },
            { value: "6", label: "คาบที่ 6 (13.30-14.20)" },
            { value: "7", label: "คาบที่ 7 (14.20-15.10)" },
            { value: "8", label: "คาบที่ 8 (15.10-16.00)" },
            { value: "กิจกรรม", label: "กิจกรรมหลังเลิกเรียน" }
        ]
    };
} else {
    // Default school CCPW
    ENVIRONMENT = {
        keyPrefix: 'ccpw_',
        systemName: "ระบบของโรงเรียน CCPW",
        databaseUrl: "https://script.google.com/macros/s/AKfycbwiRyzPr1vDN6w39Z8-rJE_wph-gXM8Sd3jXXcR3HkD7Z0TlL_fjpTuRROLOoVeIVswCQ/exec",
        periods: [
            { value: "โฮมรูม", label: "โฮมรูม (08.00-08.30)" },
            { value: "1", label: "คาบที่ 1 (08.30-09.20)" },
            { value: "2", label: "คาบที่ 2 (09.20-10.10)" },
            { value: "3", label: "คาบที่ 3 (10.10-11.00)" },
            { value: "4", label: "คาบที่ 4 (11.00-11.50)" },
            { value: "พักเที่ยง", label: "พักเที่ยง (11.50-12.40)" },
            { value: "5", label: "คาบที่ 5 (12.40-13.30)" },
            { value: "6", label: "คาบที่ 6 (13.30-14.20)" },
            { value: "7", label: "คาบที่ 7 (14.20-15.10)" },
            { value: "8", label: "คาบที่ 8 (15.10-16.00)" },
            { value: "กิจกรรม", label: "กิจกรรมหลังเลิกเรียน" }
        ]
    };
}

export { ENVIRONMENT };

export const DB_KEYS = {
    STUDENTS: ENVIRONMENT.keyPrefix + 'students',
    RECORDS: ENVIRONMENT.keyPrefix + 'records',
    SUBJECTS: ENVIRONMENT.keyPrefix + 'subjects',
    TEACHERS: ENVIRONMENT.keyPrefix + 'teachers',
    CLASSES: ENVIRONMENT.keyPrefix + 'classes',
    SETTINGS: ENVIRONMENT.keyPrefix + 'google_sheet_url',
    SESSION: ENVIRONMENT.keyPrefix + 'active_session',
    CLUBS: ENVIRONMENT.keyPrefix + 'clubs',
    CLUB_ENROLLMENTS: ENVIRONMENT.keyPrefix + 'club_enrollments',
    CLUB_RECORDS: ENVIRONMENT.keyPrefix + 'club_records',
    PR_NEWS: ENVIRONMENT.keyPrefix + 'pr_news',
    SCHOOL_SETTINGS: ENVIRONMENT.keyPrefix + 'settings_data'
};

export const DEFAULT_GOOGLE_SCRIPT_URL = ENVIRONMENT.databaseUrl;

// เวอร์ชันการ deploy (เมื่อมีการ deploy ใหม่ ให้เปลี่ยนค่านี้ เช่น วันเวลา หรือเลขเวอร์ชัน เพื่อบังคับให้ครูและแอดมินล็อกอินใหม่)
export const DEPLOY_VERSION = "20260627_2336";

