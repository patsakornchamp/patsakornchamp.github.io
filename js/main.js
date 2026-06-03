import { DB_KEYS, DEFAULT_GOOGLE_SCRIPT_URL } from './core/config.js';
import { AppState } from './core/state.js';
import { syncDataFromServer, saveToDB } from './services/api.js';
import { getBangkokDate, getDefaultAcademicYearAndSemester, showToast, customAlert, customConfirm, getISOTimestamp, getCurrentUserId } from './utils/helpers.js'; // 🌟 นำเข้าฟังก์ชันจัดการวันที่ของไทย

// 🌟 1. นำเข้าไฟล์ Features ทั้งหมดเพื่อให้ฟังก์ชันของมันทำงานและผูกเข้ากับ window
import * as auth from './features/auth.js';
import './features/checkin.js'; 
import './features/students.js';
import './features/master.js';
import './features/club.js';
import './features/stats.js';
import './features/history.js';

// 🌟 2. ฟังก์ชันช่วยป้อนข้อมูลใส่ Dropdown ทั่วทั้งระบบ
export function updateAllDropdowns() {
    let latestYear = new Date().getFullYear() + 543;
    if (AppState.allClasses && AppState.allClasses.filter(c => c.deleted_flg !== 'Y').length > 0) {
        latestYear = Math.max(...AppState.allClasses.map(c => parseInt(c.year) || latestYear));
    }

    const populateYear = (selectId) => {
        const el = document.getElementById(selectId);
        if(!el) return;
        const currentVal = el.value;
        el.innerHTML = '';
        for(let i = latestYear + 1; i >= latestYear - 3; i--) {
            el.innerHTML += `<option value="${i}" ${i === latestYear ? 'selected' : ''}>${i}</option>`;
        }
        if (currentVal) el.value = currentVal;
    };

    ['checkin-year', 'club-checkin-year', 'enroll-year', 'history-year', 'stats-year', 'aca-year'].forEach(populateYear);
    
    let activeSubjects = AppState.allSubjects.filter(s => s.deleted_flg !== 'Y');
    if (AppState.currentUser && AppState.currentUser.role === 'teacher') {
        const teacherSubjects = AppState.currentUser.data.subjects || [];
        activeSubjects = activeSubjects.filter(s => teacherSubjects.includes(s.id));
    }
    activeSubjects.sort((a, b) => (a.code || a.name).localeCompare(b.code || b.name));
    const subjectOptionsStr = activeSubjects.map(s => `<option value="${s.id}">${s.code} - ${s.name}</option>`).join('');

    ['checkin-subject'].forEach(id => {
        const el = document.getElementById(id);
        if(el) {
            const currentVal = el.value;
            el.innerHTML = '<option value="">-- เลือกวิชา --</option>' + subjectOptionsStr;
            if (currentVal) el.value = currentVal;
        }
    });

    ['stats-subject', 'history-subject'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.innerHTML = '<option value="">-- กรุณาเลือกชั้นเรียนก่อน --</option>';
        }
    });
    if (window.onStatsClassChange && document.getElementById('stats-class')?.value) window.onStatsClassChange();
    if (window.onHistoryClassChange && document.getElementById('history-class')?.value) window.onHistoryClassChange();

    const teacherOptions = '<option value="">-- เลือกครูผู้สอน --</option>' + AppState.allTeachers.filter(t => t.deleted_flg !== 'Y').map(t => `<option value="${t.id}">${t.firstName} ${t.lastName}</option>`).join('');
    const elTeacher = document.getElementById('checkin-teacher');
    if(elTeacher) {
        const currentVal = elTeacher.value;
        elTeacher.innerHTML = teacherOptions;
        if (currentVal) elTeacher.value = currentVal;
    }

    // ดึงค่าจาก AppState.allClasses โดยใช้ className (ค่าจริงจากฐานข้อมูล) และจำค่าเดิมไว้
    const classOptions = '<option value="">-- เลือกชั้นเรียน --</option>' + AppState.allClasses.filter(c => c.deleted_flg !== 'Y').sort((a,b)=>a.className.localeCompare(b.className, undefined, {numeric: true})).map(c => `<option value="${c.id}">${c.className}</option>`).join('');
    ['checkin-class', 'history-class', 'stats-class'].forEach(id => {
        const el = document.getElementById(id);
        if(el) {
            const currentVal = el.value;
            el.innerHTML = classOptions;
            if (currentVal) el.value = currentVal;
        }
    });
}
window.updateAllDropdowns = updateAllDropdowns;

// 🌟 3. ฟังก์ชันควบคุมเมนูหลัก (แก้ไขให้เรียก Render ข้อมูลของแต่ละหน้าตาราง)
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(el => {
        el.classList.remove('active', 'border-white', 'text-white');
        el.classList.add('border-transparent', 'text-green-200');
    });
    
    const targetContent = document.getElementById(`tab-${tabId}`);
    if(targetContent) targetContent.classList.add('active');
    
    const nav = document.getElementById(`nav-${tabId}`);
    if(nav) {
        nav.classList.remove('border-transparent', 'text-green-200');
        nav.classList.add('active', 'border-white', 'text-white');
    }
    AppState.currentTab = tabId;
    // 🔥 บังคับล้างค่าที่กรอกไว้และสั่งวาดตารางใหม่ทันทีเมื่อกดเปลี่ยนสลับแท็บ
    const today = getBangkokDate(new Date());

    if (tabId === 'checkin') {
        ['checkin-search', 'checkin-class', 'checkin-subject', 'checkin-teacher'].forEach(id => {
            const el = document.getElementById(id); if (el) el.value = '';
        });
        const dateEl = document.getElementById('checkin-date'); if (dateEl) dateEl.value = today;
        const cb = document.getElementById('checkin-hide-checked'); if (cb) cb.checked = false;
        if (window.autoSelectPeriod) window.autoSelectPeriod();
        if (window.resetCheckinTable) window.resetCheckinTable();
    } else if (tabId === 'club-checkin') {
        ['club-checkin-search', 'club-checkin-id'].forEach(id => {
            const el = document.getElementById(id); if (el) el.value = '';
        });
        const dateEl = document.getElementById('club-checkin-date'); if (dateEl) dateEl.value = today;
        const cb = document.getElementById('club-checkin-hide-checked'); if (cb) cb.checked = false;
        if (window.onClubCheckinYearSemesterChange) window.onClubCheckinYearSemesterChange();
        if (window.resetClubCheckinTable) window.resetClubCheckinTable();
    } else if (tabId === 'history') {
        ['history-date', 'history-class', 'history-subject'].forEach(id => {
            const el = document.getElementById(id); if (el) el.value = '';
        });
        const cont = document.getElementById('history-records-container'); if (cont) cont.innerHTML = '';
        if (window.onHistoryTypeChange) window.onHistoryTypeChange(); 
    } else if (tabId === 'stats') {
        ['stats-class', 'stats-subject'].forEach(id => {
            const el = document.getElementById(id); if (el) el.value = '';
        });
        const msg = document.getElementById('stats-empty-msg'); if (msg) msg.classList.remove('hidden');
        const cont = document.getElementById('stats-content'); if (cont) cont.classList.add('hidden');
        const btn = document.getElementById('btn-export-stats'); if (btn) btn.classList.add('hidden');
        if (window.onStatsTypeChange) window.onStatsTypeChange(true); 
    } else if (tabId === 'students') {
        ['manage-search', 'manage-filter-class'].forEach(id => {
            const el = document.getElementById(id); if (el) el.value = '';
        });
        if (window.renderManageStudents) window.renderManageStudents(); 
    } else if (tabId === 'club-manage') {
        ['enroll-search', 'enroll-filter-class'].forEach(id => {
            const el = document.getElementById(id); if (el) el.value = '';
        });
        const st = document.getElementById('enroll-filter-status'); if (st) st.value = 'all';
        if (window.switchClubSubTab) window.switchClubSubTab('list'); 
    } else if (tabId === 'master') {
        ['search-subject', 'search-teacher', 'search-class'].forEach(id => {
            const el = document.getElementById(id); if (el) el.value = '';
        });
        if (window.switchMasterSubTab) window.switchMasterSubTab('subjects'); 
    } else if (tabId === 'my-profile' && window.renderStudentProfile) {
        window.renderStudentProfile();
    } else if (tabId === 'my-club' && window.renderStudentClubDashboard) {
        window.renderStudentClubDashboard();
    } else if (tabId === 'academic' && window.renderStudentAcademicPortal) {
        window.renderStudentAcademicPortal();
    } else if (tabId === 'settings') {
        const el = document.getElementById('google-sheet-url');
        if (el) el.value = AppState.googleSheetUrl || '';
    }
}
window.switchTab = switchTab;

// 1. เพิ่มฟังก์ชันหาคาบเรียนอัตโนมัติ
export function autoSelectPeriod() {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Bangkok', hour12: false, hour: 'numeric', minute: 'numeric' });
    const timeParts = formatter.formatToParts(now);
    let hour = parseInt(timeParts.find(p => p.type === 'hour').value);
    let minute = parseInt(timeParts.find(p => p.type === 'minute').value);
    if (hour === 24) hour = 0;
    
    const timeNum = hour * 100 + minute;
    let period = '1';
    if (timeNum < 830) period = 'โฮมรูม';
    else if (timeNum >= 830 && timeNum < 920) period = '1';
    else if (timeNum >= 920 && timeNum < 1010) period = '2';
    else if (timeNum >= 1010 && timeNum < 1100) period = '3';
    else if (timeNum >= 1100 && timeNum < 1150) period = '4';
    else if (timeNum >= 1150 && timeNum < 1240) period = 'พักเที่ยง';
    else if (timeNum >= 1240 && timeNum < 1330) period = '5';
    else if (timeNum >= 1330 && timeNum < 1420) period = '6';
    else if (timeNum >= 1420 && timeNum < 1510) period = '7';
    else if (timeNum >= 1510 && timeNum < 1600) period = '8';
    else period = 'กิจกรรม';
    
    const periodSelect = document.getElementById('checkin-period');
    if (periodSelect) periodSelect.value = period;
}

// 🌟 4. เริ่มการทำงานของแอป
async function initApp() {
    AppState.googleSheetUrl = localStorage.getItem(DB_KEYS.SETTINGS) || DEFAULT_GOOGLE_SCRIPT_URL;
    
    // ตั้งค่าเวลาปกติ แต่หน้าประวัติให้ปล่อยว่างไว้
    const today = getBangkokDate(new Date());
    document.getElementById('checkin-date').value = today;
    document.getElementById('club-checkin-date').value = today;
    document.getElementById('history-date').value = ''; 
    autoSelectPeriod();

    try {
        await syncDataFromServer(true);
        updateAllDropdowns();

        // 🌟 1. ตั้งค่าเริ่มต้นให้ปี/ภาคเรียน เป็นเทอมปัจจุบัน
        const schoolDefaults = getDefaultAcademicYearAndSemester();
        ['checkin-year', 'club-checkin-year', 'enroll-year', 'history-year', 'stats-year', 'aca-year'].forEach(id => {
            const el = document.getElementById(id);
            if(el) el.value = schoolDefaults.year;
        });
        ['checkin-semester', 'club-checkin-semester', 'enroll-semester', 'history-semester', 'stats-semester', 'aca-semester'].forEach(id => {
            const el = document.getElementById(id);
            if(el) el.value = schoolDefaults.semester;
        });

        // 🌟 2. กระตุ้นฟังก์ชันเปลี่ยนปี/เทอม เพื่อให้ Dropdown ย่อยๆ (เช่น วิชา, ชุมนุม) โหลดข้อมูลเข้าตัวมันเอง
        if (window.onCheckinYearSemesterChange) window.onCheckinYearSemesterChange();
        if (window.onClubCheckinYearSemesterChange) window.onClubCheckinYearSemesterChange();
        if (window.onHistoryYearSemesterChange) window.onHistoryYearSemesterChange();
        if (window.onStatsYearSemesterChange) window.onStatsYearSemesterChange();
        if (window.onEnrollFilterChange) window.onEnrollFilterChange();

    } catch (e) {
        console.error(e); 
    }

    // ตรวจสอบ Session แบบเข้มงวด
    const savedSession = localStorage.getItem(DB_KEYS.SESSION);
    if (savedSession) {
        try {
            const parsedUser = JSON.parse(savedSession);
            let isValidSession = false;
            if (parsedUser.role === 'admin') isValidSession = true;
            else if (parsedUser.role === 'teacher') isValidSession = AppState.allTeachers.some(t => t.id === parsedUser.data.id && t.deleted_flg !== 'Y');
            else if (parsedUser.role === 'student') isValidSession = AppState.allStudents.some(s => s.id === parsedUser.data.id && s.status !== 'ลาออก' && s.deleted_flg !== 'Y'); // เช็คพ้นสภาพ
            
            if (isValidSession) {
                auth.loginSuccess(parsedUser);
                if (parsedUser.role === 'admin' || parsedUser.role === 'teacher') {
                     if(window.loadCheckinList) window.loadCheckinList();
                }
            } else {
                localStorage.removeItem(DB_KEYS.SESSION);
                    document.getElementById('login-screen').classList.remove('hidden');
            }
            } catch(e) { 
                localStorage.removeItem(DB_KEYS.SESSION); 
                document.getElementById('login-screen').classList.remove('hidden');
            }
        } else {
            document.getElementById('login-screen').classList.remove('hidden');
    }
}

document.addEventListener('DOMContentLoaded', initApp);

// ==========================================
// ฟังก์ชันควบคุมการทำงานของ Dropdown ความสัมพันธ์
// ==========================================
export function updateClassDropdown(yearVal, semVal, targetId, defaultText) {
    const el = document.getElementById(targetId);
    if (!el) return;
    const filtered = AppState.allClasses.filter(c => c.year == yearVal && c.semester == semVal && c.deleted_flg !== 'Y');
    filtered.sort((a,b) => a.className.localeCompare(b.className, undefined, {numeric:true}));
    el.innerHTML = `<option value="">${defaultText}</option>` + 
        filtered.map(c => `<option value="${c.id}">${c.className}</option>`).join('');
}

export function onCheckinYearSemesterChange() {
    const yr = document.getElementById('checkin-year').value;
    const sem = document.getElementById('checkin-semester').value;
    updateClassDropdown(yr, sem, 'checkin-class', '-- เลือกชั้นเรียน --');
    if (window.resetCheckinTable) window.resetCheckinTable();
}

// 3. ฟังก์ชันกรองวิชาตามครู (สมบูรณ์)
export function populateCheckinSubjectDropdown(teacherId) {
    const subjectSelect = document.getElementById('checkin-subject');
    if (!subjectSelect) return;
    subjectSelect.innerHTML = '<option value="">-- เลือกวิชา --</option>';
    if (!teacherId) return;
    
    const teacher = AppState.allTeachers.find(t => t.id === teacherId && t.deleted_flg !== 'Y');
    if (!teacher || !teacher.subjects) return;
    
    const teacherSubjects = AppState.allSubjects.filter(s => teacher.subjects.includes(s.id) && s.deleted_flg !== 'Y');
    teacherSubjects.sort((a, b) => (a.code || a.name).localeCompare(b.code || b.name));
    subjectSelect.innerHTML += teacherSubjects.map(s => `<option value="${s.id}">${s.code} - ${s.name}</option>`).join('');
}
export function onTeacherChange() {
    const teacherId = document.getElementById('checkin-teacher').value;
    populateCheckinSubjectDropdown(teacherId);
    if (window.resetCheckinTable) window.resetCheckinTable();
}

export function onHistoryYearSemesterChange() {
    if (window.onHistoryTypeChange) window.onHistoryTypeChange();
}

export function onStatsYearSemesterChange() {
    if (window.onStatsTypeChange) window.onStatsTypeChange();
}

export function onStatsClassChange() {
    const classId = document.getElementById('stats-class').value;
    const subjectSelect = document.getElementById('stats-subject');
    if (!subjectSelect) return;

    const currentSubVal = subjectSelect.value;

    if (!classId) {
        subjectSelect.innerHTML = '<option value="">-- กรุณาเลือกชั้นเรียนก่อน --</option>';
        return;
    }

    const clsObj = AppState.allClasses.find(c => c.id === classId && c.deleted_flg !== 'Y');
    let activeSubjects = clsObj && clsObj.subjects ? AppState.allSubjects.filter(s => clsObj.subjects.includes(s.id) && s.deleted_flg !== 'Y') : [];
    
    if (AppState.currentUser && AppState.currentUser.role === 'teacher') {
        const teacherSubjects = AppState.currentUser.data.subjects || [];
        activeSubjects = activeSubjects.filter(s => teacherSubjects.includes(s.id));
    }
    
    activeSubjects.sort((a, b) => (a.code || a.name).localeCompare(b.code || b.name));
    const subjectOptionsStr = activeSubjects.map(s => `<option value="${s.id}">${s.code} - ${s.name}</option>`).join('');
    
    subjectSelect.innerHTML = '<option value="all">-- รวมทุกวิชา --</option>' + subjectOptionsStr;
    if (currentSubVal && Array.from(subjectSelect.options).some(opt => opt.value === currentSubVal)) {
        subjectSelect.value = currentSubVal;
    }
}

export function onHistoryClassChange() {
    const classId = document.getElementById('history-class').value;
    const subjectSelect = document.getElementById('history-subject');
    if (!subjectSelect) return;

    const currentSubVal = subjectSelect.value;

    if (!classId) {
        subjectSelect.innerHTML = '<option value="">-- กรุณาเลือกชั้นเรียนก่อน --</option>';
        return;
    }

    const clsObj = AppState.allClasses.find(c => c.id === classId && c.deleted_flg !== 'Y');
    let activeSubjects = clsObj && clsObj.subjects ? AppState.allSubjects.filter(s => clsObj.subjects.includes(s.id) && s.deleted_flg !== 'Y') : [];
    
    if (AppState.currentUser && AppState.currentUser.role === 'teacher') {
        const teacherSubjects = AppState.currentUser.data.subjects || [];
        activeSubjects = activeSubjects.filter(s => teacherSubjects.includes(s.id));
    }
    
    activeSubjects.sort((a, b) => (a.code || a.name).localeCompare(b.code || b.name));
    const subjectOptionsStr = activeSubjects.map(s => `<option value="${s.id}">${s.code} - ${s.name}</option>`).join('');
    
    subjectSelect.innerHTML = '<option value="">-- ทุกวิชา --</option>' + subjectOptionsStr;
    if (currentSubVal && Array.from(subjectSelect.options).some(opt => opt.value === currentSubVal)) {
        subjectSelect.value = currentSubVal;
    }
}

export function saveSettings() {
    const url = document.getElementById('google-sheet-url').value.trim();
    if (!url) return customAlert('กรุณากรอก URL ก่อนบันทึก');
    AppState.googleSheetUrl = url;
    localStorage.setItem(DB_KEYS.SETTINGS, url);
    showToast('บันทึกการตั้งค่า URL เรียบร้อย');
}

export async function syncDataToGoogleSheet() {
    if (!AppState.googleSheetUrl) return customAlert('กรุณาตั้งค่า URL ก่อนการซิงค์');
    
    customConfirm('ยืนยันการซิงค์ข้อมูล', 'ระบบจะส่งข้อมูลทั้งหมดจากเครื่องขึ้นไปทับบน Google Sheets ยืนยันหรือไม่? (อาจใช้เวลาสักครู่)', async () => {
        let success = true;
        const ops = [
            { key: DB_KEYS.STUDENTS, data: AppState.allStudents, action: 'saveStudents' },
            { key: DB_KEYS.RECORDS, data: AppState.allRecords, action: 'saveRecords' },
            { key: DB_KEYS.SUBJECTS, data: AppState.allSubjects, action: 'saveSubjects' },
            { key: DB_KEYS.TEACHERS, data: AppState.allTeachers, action: 'saveTeachers' },
            { key: DB_KEYS.CLASSES, data: AppState.allClasses, action: 'saveClasses' },
            { key: DB_KEYS.CLUBS, data: AppState.allClubs, action: 'saveClubs' },
            { key: DB_KEYS.CLUB_ENROLLMENTS, data: AppState.allClubEnrollments, action: 'saveClubEnrollments' },
            { key: DB_KEYS.CLUB_RECORDS, data: AppState.allClubRecords, action: 'saveClubRecords' }
        ];
        
        for (const op of ops) {
            const result = await saveToDB(op.key, op.data, op.action);
            if (result === false) success = false;
        }
        
        if (success) showToast('ซิงค์ข้อมูลขึ้น Google Sheets สำเร็จ');
    });
}

export async function cleanUpOldAttendanceData() {
    customConfirm('ยืนยันการล้างข้อมูลเก่า', 'ระบบจะทำการลบข้อมูลชื่อและเลขที่ที่ซ้ำซ้อนในประวัติเช็คชื่อเก่าทั้งหมด เพื่อประหยัดพื้นที่ตามโครงสร้างใหม่ ยืนยันหรือไม่?', async () => {
        let recordsUpdated = false;
        let clubRecordsUpdated = false;

        AppState.allRecords.forEach(r => {
            if (r.attendance && Array.isArray(r.attendance)) {
                r.attendance.forEach(a => {
                    if (a.studentName !== undefined || a.studentNumber !== undefined) {
                        delete a.studentName;
                        delete a.studentNumber;
                        recordsUpdated = true;
                    }
                });
            }
        });

        AppState.allClubRecords.forEach(r => {
            if (r.attendance && Array.isArray(r.attendance)) {
                r.attendance.forEach(a => {
                    if (a.studentName !== undefined || a.studentNumber !== undefined || a.studentClass !== undefined) {
                        delete a.studentName;
                        delete a.studentNumber;
                        delete a.studentClass;
                        clubRecordsUpdated = true;
                    }
                });
            }
        });

        if (recordsUpdated) await saveToDB(DB_KEYS.RECORDS, AppState.allRecords, 'saveRecords');
        if (clubRecordsUpdated) await saveToDB(DB_KEYS.CLUB_RECORDS, AppState.allClubRecords, 'saveClubRecords');

        if (recordsUpdated || clubRecordsUpdated) {
            showToast('ปรับปรุงรูปแบบข้อมูลเก่าเรียบร้อยแล้ว');
        } else {
            showToast('ข้อมูลทั้งหมดเป็นรูปแบบใหม่แล้ว ไม่จำเป็นต้องปรับปรุง');
        }
    });
}

export async function migrateOldAttendanceIds() {
    customConfirm('ยืนยันการผูก ID ข้อมูลเก่า', 'ระบบจะทำการตรวจสอบและผูก ID (ชั้นเรียน, วิชา, ครูผู้สอน) ให้กับข้อมูลประวัติการเช็คชื่อเก่าที่ยังไม่มี ID ยืนยันหรือไม่?', async () => {
        let recordsUpdated = false;
        const now = getISOTimestamp();
        const userId = getCurrentUserId();

        AppState.allRecords.forEach(r => {
            let updated = false;

            if (!r.classId && r.class) {
                const cls = AppState.allClasses.find(c => c.className === r.class);
                if (cls) { r.classId = cls.id; updated = true; }
            }
            if (!r.subjectId && r.subject) {
                const sub = AppState.allSubjects.find(s => s.name === r.subject);
                if (sub) { r.subjectId = sub.id; updated = true; }
            }
            if (!r.teacherId && r.teacher) {
                const teacher = AppState.allTeachers.find(t => `${t.firstName} ${t.lastName}` === r.teacher);
                if (teacher) { r.teacherId = teacher.id; updated = true; }
            }

            if (updated) {
                r.updatedAt = now;
                r.updatedBy = userId;
                recordsUpdated = true;
            }
        });

        if (recordsUpdated) {
            await saveToDB(DB_KEYS.RECORDS, AppState.allRecords, 'saveRecords');
            showToast('ค้นหาและผูก ID ข้อมูลประวัติการเช็คชื่อเก่าเรียบร้อยแล้ว');
        } else {
            showToast('ไม่มีข้อมูลเก่าที่ต้องอัปเดต หรือผูก ID ครบหมดแล้ว');
        }
    });
}

window.autoSelectPeriod = autoSelectPeriod;
window.updateClassDropdown = updateClassDropdown;
window.populateCheckinSubjectDropdown = populateCheckinSubjectDropdown;
window.onCheckinYearSemesterChange = onCheckinYearSemesterChange;
window.onTeacherChange = onTeacherChange;
window.onHistoryYearSemesterChange = onHistoryYearSemesterChange;
window.onStatsYearSemesterChange = onStatsYearSemesterChange;
window.onStatsClassChange = onStatsClassChange;
window.onHistoryClassChange = onHistoryClassChange;
window.saveSettings = saveSettings;
window.syncDataToGoogleSheet = syncDataToGoogleSheet;
window.cleanUpOldAttendanceData = cleanUpOldAttendanceData;
window.migrateOldAttendanceIds = migrateOldAttendanceIds;