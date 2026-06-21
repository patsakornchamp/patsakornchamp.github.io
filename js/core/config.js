export const DB_KEYS = {
    STUDENTS: 'school_students',
    RECORDS: 'school_records',
    SUBJECTS: 'school_subjects',
    TEACHERS: 'school_teachers',
    CLASSES: 'school_classes',
    SETTINGS: 'school_google_sheet_url',
    SESSION: 'school_active_session',
    CLUBS: 'school_clubs',
    CLUB_ENROLLMENTS: 'school_club_enrollments',
    CLUB_RECORDS: 'school_club_records',
    PR_NEWS: 'school_pr_news'
};

export const DEFAULT_GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwiRyzPr1vDN6w39Z8-rJE_wph-gXM8Sd3jXXcR3HkD7Z0TlL_fjpTuRROLOoVeIVswCQ/exec";

// เวอร์ชันการ deploy (เมื่อมีการ deploy ใหม่ ให้เปลี่ยนค่านี้ เช่น วันเวลา หรือเลขเวอร์ชัน เพื่อบังคับให้ครูและแอดมินล็อกอินใหม่)
export const DEPLOY_VERSION = "20260621_2525";