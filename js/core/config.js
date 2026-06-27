// Reading URL Parameter for Multi-tenant support
const urlParams = new URLSearchParams(window.location.search);
const schoolParam = urlParams.get('school') || '';

// Environment configuration mapping
let ENVIRONMENT;

if (schoolParam === 'rnn') {
    ENVIRONMENT = {
        keyPrefix: 'rnn_',
        systemName: "ระบบของโรงเรียน RNN",
        databaseUrl: "https://script.google.com/macros/s/AKfycbxVEMuweYZ4KHHIqvXWOnCKc0yOrgUlMowJr4R6ZWmFVGHwMezs3gthHRL4N-rNLWDVbw/exec"
    };
} else if (schoolParam === 'abc') {
    ENVIRONMENT = {
        keyPrefix: 'abc_',
        systemName: "ระบบของโรงเรียน ABC",
        databaseUrl: "https://script.google.com/macros/s/---ABC-ID---/exec"
    };
} else {
    // Default school CCPW
    ENVIRONMENT = {
        keyPrefix: 'ccpw_',
        systemName: "ระบบของโรงเรียน CCPW",
        databaseUrl: "https://script.google.com/macros/s/AKfycbwiRyzPr1vDN6w39Z8-rJE_wph-gXM8Sd3jXXcR3HkD7Z0TlL_fjpTuRROLOoVeIVswCQ/exec"
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