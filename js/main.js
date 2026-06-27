import { DB_KEYS, DEFAULT_GOOGLE_SCRIPT_URL, DEPLOY_VERSION, ENVIRONMENT } from './core/config.js';
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
import './features/homevisit.js';
import './features/assignments.js';
import './features/pr.js';
import './features/archive.js';

// 🌟 ฟังก์ชันจัดการ Select HTML ให้รองรับ Tom Select (ค้นหาได้)
export function safeSetSelectHtml(id, html) {
    const el = document.getElementById(id);
    if (!el) return;
    const currentVal = el.tomselect ? el.tomselect.getValue() : el.value;
    
    if (el.tomselect) {
        el.tomselect.clearOptions();
    }

    el.innerHTML = html;
    
    if (el.tomselect) {
        el.tomselect.sync();
        if (currentVal !== undefined && Array.from(el.options).some(opt => opt.value === currentVal)) {
            el.tomselect.setValue(currentVal, true); 
        } else {
            el.tomselect.setValue(el.options.length > 0 ? el.options[0].value : '', true);
        }
    } else {
        if (currentVal !== undefined && Array.from(el.options).some(opt => opt.value === currentVal)) {
            el.value = currentVal;
        } else {
            el.value = el.options.length > 0 ? el.options[0].value : '';
        }
    }
}

// 🌟 2. ฟังก์ชันช่วยป้อนข้อมูลใส่ Dropdown ทั่วทั้งระบบ
export function updateAllDropdowns() {
    let latestYear = new Date().getFullYear() + 543;
    if (AppState.allClasses && AppState.allClasses.filter(c => c.deleted_flg !== 'Y').length > 0) {
        latestYear = Math.max(...AppState.allClasses.map(c => parseInt(c.year) || latestYear));
    }

    const populateYear = (selectId) => {
        let html = '';
        for(let i = latestYear + 1; i >= latestYear - 3; i--) {
            html += `<option value="${i}" ${i === latestYear ? 'selected' : ''}>${i}</option>`;
        }
        safeSetSelectHtml(selectId, html);
    };

    ['checkin-year', 'club-checkin-year', 'enroll-year', 'history-year', 'stats-year', 'aca-year', 'hv-year'].forEach(populateYear);
    
    safeSetSelectHtml('checkin-subject', '<option value="">-- กรุณาเลือกครูผู้สอนก่อน --</option>');
    safeSetSelectHtml('stats-subject', '<option value="">-- กรุณาเลือกชั้นเรียนก่อน --</option>');
    safeSetSelectHtml('history-subject', '<option value="">-- กรุณาเลือกชั้นเรียนก่อน --</option>');

    let activeTeachers = AppState.allTeachers.filter(t => t.deleted_flg !== 'Y');
    
    // จัดเรียง: นำครูที่เข้าสู่ระบบขึ้นเป็นคนแรกสุด จากนั้นเรียงท่านอื่นตามตัวอักษร
    if (AppState.currentUser && AppState.currentUser.role === 'teacher') {
        const loggedInId = AppState.currentUser.data.id;
        activeTeachers.sort((a, b) => {
            if (a.id === loggedInId) return -1;
            if (b.id === loggedInId) return 1;
            return (a.firstName || '').localeCompare(b.firstName || '');
        });
    } else {
        activeTeachers.sort((a, b) => (a.firstName || '').localeCompare(b.firstName || ''));
    }
    
    const teacherOptions = '<option value="">-- เลือกครูผู้สอน --</option>' + activeTeachers.map(t => `<option value="${t.id}">${t.firstName} ${t.lastName}</option>`).join('');
    safeSetSelectHtml('checkin-teacher', teacherOptions);

    // ถ้าระบบรู้ว่าเป็นครู ให้เลือกชื่อตัวเองทันที
    if (AppState.currentUser && AppState.currentUser.role === 'teacher') {
        const checkinTeacherEl = document.getElementById('checkin-teacher');
        if (checkinTeacherEl) {
            if (checkinTeacherEl.tomselect) checkinTeacherEl.tomselect.setValue(AppState.currentUser.data.id, true);
            else checkinTeacherEl.value = AppState.currentUser.data.id;
        }
    }

    // ดึงค่าจาก AppState.allClasses โดยใช้ className (ค่าจริงจากฐานข้อมูล) และจำค่าเดิมไว้
    const classOptions = '<option value="">-- เลือกชั้นเรียน --</option>' + AppState.allClasses.filter(c => c.deleted_flg !== 'Y').sort((a,b)=>a.className.localeCompare(b.className, undefined, {numeric: true})).map(c => `<option value="${c.id}">${c.className}</option>`).join('');
    ['checkin-class', 'history-class', 'stats-class'].forEach(id => {
        safeSetSelectHtml(id, classOptions);
    });

    if (window.onTeacherChange && document.getElementById('checkin-teacher')?.value) window.onTeacherChange();
    if (window.onStatsClassChange && document.getElementById('stats-class')?.value) window.onStatsClassChange();
    if (window.onHistoryClassChange && document.getElementById('history-class')?.value) window.onHistoryClassChange();
}
window.updateAllDropdowns = updateAllDropdowns;

function clearInputValue(id) {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.tomselect) el.tomselect.setValue('', true);
    else el.value = '';
}

// 🌟 3. ฟังก์ชันควบคุมเมนูหลัก (แก้ไขให้เรียก Render ข้อมูลของแต่ละหน้าตาราง)
function switchTab(tabId) {
    if (AppState.currentTab === 'student-qr' && tabId !== 'student-qr') {
        if (window.stopStudentQrScanner) window.stopStudentQrScanner();
    }
    
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

    // ซ่อนเมนูมือถืออัตโนมัติเมื่อกดเลือกเมนูย่อยเสร็จ
    const navEl = document.getElementById('app-nav');
    const icon = document.getElementById('mobile-menu-icon');
    if (window.innerWidth < 768 && navEl && !navEl.classList.contains('hidden')) {
        navEl.classList.add('hidden');
        if(icon) { icon.classList.remove('fa-times'); icon.classList.add('fa-bars'); }
    }

    // 🔥 บังคับล้างค่าที่กรอกไว้และสั่งวาดตารางใหม่ทันทีเมื่อกดเปลี่ยนสลับแท็บ
    const today = getBangkokDate(new Date());

    if (tabId === 'checkin') {
        ['checkin-search', 'checkin-class', 'checkin-subject'].forEach(id => clearInputValue(id));
        if (AppState.currentUser && AppState.currentUser.role === 'admin') {
            clearInputValue('checkin-teacher');
        }
        if (window.onTeacherChange) window.onTeacherChange();
        
        const dateEl = document.getElementById('checkin-date'); if (dateEl) dateEl.value = today;
        const cb = document.getElementById('checkin-hide-checked'); if (cb) cb.checked = false;
        if (window.autoSelectPeriod) window.autoSelectPeriod();
        if (window.resetCheckinTable) window.resetCheckinTable();
    } else if (tabId === 'club-checkin') {
        ['club-checkin-search', 'club-checkin-id'].forEach(id => {
            clearInputValue(id);
        });
        const dateEl = document.getElementById('club-checkin-date'); if (dateEl) dateEl.value = today;
        const cb = document.getElementById('club-checkin-hide-checked'); if (cb) cb.checked = false;
        if (window.onClubCheckinYearSemesterChange) window.onClubCheckinYearSemesterChange();
        if (window.resetClubCheckinTable) window.resetClubCheckinTable();
    } else if (tabId === 'history') {
        ['history-date', 'history-class', 'history-subject'].forEach(id => {
            clearInputValue(id);
        });
        const cont = document.getElementById('history-records-container'); if (cont) cont.innerHTML = '';
        if (window.onHistoryTypeChange) window.onHistoryTypeChange(); 
    } else if (tabId === 'stats') {
        ['stats-class', 'stats-subject'].forEach(id => {
            clearInputValue(id);
        });
        const msg = document.getElementById('stats-empty-msg'); if (msg) msg.classList.remove('hidden');
        const cont = document.getElementById('stats-content'); if (cont) cont.classList.add('hidden');
        const btn = document.getElementById('btn-export-stats'); if (btn) btn.classList.add('hidden');
        if (window.onStatsTypeChange) window.onStatsTypeChange(true); 
    } else if (tabId === 'master') {
        ['search-subject', 'search-teacher', 'search-class', 'manage-search', 'manage-filter-class', 'enroll-search', 'enroll-filter-class', 'search-pr-news'].forEach(id => {
            clearInputValue(id);
        });
        const st = document.getElementById('enroll-filter-status'); if (st) st.value = 'all';
        if (window.switchMasterSubTab) window.switchMasterSubTab('subjects'); 
    } else if (tabId === 'my-profile' && window.renderStudentProfile) {
        window.renderStudentProfile();
    } else if (tabId === 'my-club' && window.renderStudentClubDashboard) {
        window.renderStudentClubDashboard();
    } else if (tabId === 'academic' && window.renderStudentAcademicPortal) {
        window.renderStudentAcademicPortal();
    } else if (tabId === 'my-assignments' && window.renderStudentAssignments) {
        // วาดข้อมูลเดิมจากแคชในเครื่องขึ้นมาก่อนทันทีเพื่อไม่ให้หน้าจอว่างเปล่า
        window.renderStudentAssignments();
        
        // ซิงค์ข้อมูลล่าสุดจาก Google Sheets ในพื้นหลัง แล้ววาดซ้ำอีกครั้งเมื่อเสร็จ
        syncDataFromServer(true).then(() => {
            window.renderStudentAssignments();
        });
    } else if (tabId === 'settings') {
        const el = document.getElementById('google-sheet-url');
        if (el) el.value = AppState.googleSheetUrl || '';
    } else if (tabId === 'home-visit') {
        clearInputValue('hv-class');
        const st = document.getElementById('hv-status'); if (st) st.value = 'all';
        if (window.initHomeVisitTab) window.initHomeVisitTab();
    } else if (tabId === 'assignments') {
        ['asm-filter-class', 'asm-filter-subject'].forEach(id => clearInputValue(id));
        if (window.initAssignmentsTab) window.initAssignmentsTab();
    }

    // 🌟 เปิดใช้งานระบบ Searchable Dropdown (Tom Select)
    ['checkin-class', 'checkin-teacher', 'checkin-subject', 'history-subject'].forEach(id => {
        const el = document.getElementById(id);
        if (el && window.TomSelect && !el.tomselect) {
            new TomSelect(el, {
                create: false,
                sortField: null
            });
        }
    });
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

    const urlParams = new URLSearchParams(window.location.search);
    const schoolParam = urlParams.get('school') || '';

    if (schoolParam === 'rnn') {
        if (timeNum < 830) period = '1';
        else if (timeNum >= 830 && timeNum < 920) period = '1';
        else if (timeNum >= 920 && timeNum < 1010) period = '2';
        else if (timeNum >= 1010 && timeNum < 1020) period = 'พัก';
        else if (timeNum >= 1020 && timeNum < 1110) period = '3';
        else if (timeNum >= 1110 && timeNum < 1200) period = '4';
        else if (timeNum >= 1200 && timeNum < 1250) period = '5';
        else if (timeNum >= 1250 && timeNum < 1340) period = '6';
        else if (timeNum >= 1340 && timeNum < 1430) period = '7';
        else if (timeNum >= 1430 && timeNum < 1520) period = '8';
        else if (timeNum >= 1520 && timeNum < 1610) period = '9';
        else period = '9';
    } else {
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
    }
    
    const periodSelect = document.getElementById('checkin-period');
    if (periodSelect) periodSelect.value = period;
}

// 🌟 4. เริ่มการทำงานของแอป
export function applySchoolSettings() {
    if (AppState.schoolSettings && Object.keys(AppState.schoolSettings).length > 0) {
        const { schoolName, systemName, logoUrl } = AppState.schoolSettings;
        
        if (systemName) {
            document.title = `${systemName} - ${schoolName || ''}`;
            const loginSystemName = document.getElementById('ui-login-system-name');
            const mainSystemName = document.getElementById('ui-main-system-name');
            if (loginSystemName) loginSystemName.innerText = systemName;
            if (mainSystemName) mainSystemName.innerText = systemName;
        }
        
        if (schoolName) {
            const loginSchoolName = document.getElementById('ui-login-school-name');
            const mainSchoolName = document.getElementById('ui-main-school-name');
            if (loginSchoolName) loginSchoolName.innerText = schoolName;
            if (mainSchoolName) mainSchoolName.innerText = schoolName;
        }
        
        if (logoUrl) {
            const loginLogo = document.getElementById('ui-login-logo');
            const mainLogo = document.getElementById('ui-main-logo');
            const directUrl = window.getDirectImageUrl ? window.getDirectImageUrl(logoUrl) : logoUrl;
            if (loginLogo) loginLogo.src = directUrl;
            if (mainLogo) mainLogo.src = directUrl;
        }

        updateDynamicManifest();
    }
}

export function updateDynamicManifest() {
    const schoolSettings = AppState.schoolSettings || {};
    const schoolName = schoolSettings.schoolName || 'MAKHRAB';
    const logoUrl = schoolSettings.logoUrl || 'logopngPDF.png';
    const directLogoUrl = window.getDirectImageUrl ? window.getDirectImageUrl(logoUrl) : logoUrl;
    const startUrl = `./index.html${window.location.search}`;

    const manifestObj = {
        name: `MAKHRAB - ${schoolName}`,
        short_name: schoolName,
        description: `ระบบเช็คชื่อและจัดการข้อมูล - ${schoolName}`,
        start_url: startUrl,
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#0f766e",
        icons: [
            {
                src: directLogoUrl,
                sizes: "192x192",
                type: "image/png",
                purpose: "any maskable"
            },
            {
                src: directLogoUrl,
                sizes: "512x512",
                type: "image/png",
                purpose: "any maskable"
            }
        ]
    };

    const stringManifest = JSON.stringify(manifestObj);
    const blob = new Blob([stringManifest], {type: 'application/json'});
    const manifestURL = URL.createObjectURL(blob);
    
    let manifestLink = document.querySelector('link[rel="manifest"]');
    if (!manifestLink) {
        manifestLink = document.createElement('link');
        manifestLink.rel = 'manifest';
        document.head.appendChild(manifestLink);
    }
    manifestLink.href = manifestURL;
}

async function initApp() {
    // Dynamic school name updates based on ENVIRONMENT
    if (ENVIRONMENT && ENVIRONMENT.systemName) {
        document.title = `MAKHRAB - ${ENVIRONMENT.systemName}`;
        const loginNameEl = document.getElementById('ui-login-school-name');
        if (loginNameEl) loginNameEl.innerText = ENVIRONMENT.systemName;
        const mainNameEl = document.getElementById('ui-main-school-name');
        if (mainNameEl) mainNameEl.innerText = ENVIRONMENT.systemName;
    }

    // Render dynamic periods list
    const periodSelect = document.getElementById('checkin-period');
    if (periodSelect && ENVIRONMENT && ENVIRONMENT.periods) {
        periodSelect.innerHTML = ENVIRONMENT.periods.map(p => 
            `<option value="${p.value}">${p.label}</option>`
        ).join('');
    }

    if (window.checkBiometricAvailability) window.checkBiometricAvailability();

    // Register Service Worker for PWA
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js').catch(err => console.log('SW reg failed:', err));
        });
    }

    AppState.googleSheetUrl = localStorage.getItem(DB_KEYS.SETTINGS) || DEFAULT_GOOGLE_SCRIPT_URL;
    
    // ตั้งค่าเวลาปกติ แต่หน้าประวัติให้ปล่อยว่างไว้
    const today = getBangkokDate(new Date());
    document.getElementById('checkin-date').value = today;
    document.getElementById('club-checkin-date').value = today;
    document.getElementById('history-date').value = ''; 
    autoSelectPeriod();

    // Apply settings from cache first
    applySchoolSettings();

    try {
        await syncDataFromServer(true);
        applySchoolSettings(); // Re-apply after sync
        updateAllDropdowns();

        // 🌟 1. ตั้งค่าเริ่มต้นให้ปี/ภาคเรียน เป็นเทอมปัจจุบัน
        const schoolDefaults = getDefaultAcademicYearAndSemester();
        ['checkin-year', 'club-checkin-year', 'enroll-year', 'history-year', 'stats-year', 'aca-year', 'hv-year'].forEach(id => {
            const el = document.getElementById(id);
            if(el) el.value = schoolDefaults.year;
        });
        ['checkin-semester', 'club-checkin-semester', 'enroll-semester', 'history-semester', 'stats-semester', 'aca-semester', 'hv-semester'].forEach(id => {
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

    // ตรวจสอบรุ่นการ deploy เพื่อบังคับให้ครูและแอดมินล็อกอินใหม่หากมีการเปลี่ยนแปลง
    const savedDeployVersion = localStorage.getItem('app_deploy_version');
    if (savedDeployVersion !== DEPLOY_VERSION) {
        localStorage.setItem('app_deploy_version', DEPLOY_VERSION);
        const savedSession = localStorage.getItem(DB_KEYS.SESSION);
        if (savedSession) {
            try {
                const parsedUser = JSON.parse(savedSession);
                if (parsedUser.role === 'teacher' || parsedUser.role === 'admin') {
                    localStorage.removeItem(DB_KEYS.SESSION);
                }
            } catch(e) {}
        }
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

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

// ==========================================
// ฟังก์ชันควบคุมการทำงานของ Dropdown ความสัมพันธ์
// ==========================================
export function updateClassDropdown(yearVal, semVal, targetId, defaultText) {
    const filtered = AppState.allClasses.filter(c => c.year == yearVal && c.semester == semVal && c.deleted_flg !== 'Y');
    filtered.sort((a,b) => a.className.localeCompare(b.className, undefined, {numeric:true}));
    const html = `<option value="">${defaultText}</option>` + 
        filtered.map(c => `<option value="${c.id}">${c.className}</option>`).join('');
    safeSetSelectHtml(targetId, html);
}

export function onCheckinYearSemesterChange() {
    const yr = document.getElementById('checkin-year').value;
    const sem = document.getElementById('checkin-semester').value;
    updateClassDropdown(yr, sem, 'checkin-class', '-- เลือกชั้นเรียน --');
    const teacherId = document.getElementById('checkin-teacher')?.value;
    const classId = document.getElementById('checkin-class')?.value;
    populateCheckinSubjectDropdown(teacherId, classId);
    if (window.resetCheckinTable) window.resetCheckinTable();
}

// 3. ฟังก์ชันกรองวิชาตามครู (สมบูรณ์)
export function populateCheckinSubjectDropdown(teacherId, classId) {
    let html = '<option value="">-- กรุณาเลือกครูผู้สอนก่อน --</option>';
    if (teacherId) {
        const teacher = AppState.allTeachers.find(t => t.id === teacherId && t.deleted_flg !== 'Y');
        if (teacher && teacher.subjects && teacher.subjects.length > 0) {
            let teacherSubjects = AppState.allSubjects.filter(s => teacher.subjects.includes(s.id) && s.deleted_flg !== 'Y');
            
            if (classId) {
                const clsObj = AppState.allClasses.find(c => c.id === classId && c.deleted_flg !== 'Y');
                if (clsObj && clsObj.subjects && clsObj.subjects.length > 0) {
                    teacherSubjects = teacherSubjects.filter(s => clsObj.subjects.includes(s.id));
                }
            }
            teacherSubjects.sort((a, b) => (a.code || a.name).localeCompare(b.code || b.name));
            if (teacherSubjects.length > 0) {
                html = '<option value="">-- เลือกวิชา --</option>' + teacherSubjects.map(s => `<option value="${s.id}">${s.code} - ${s.name}</option>`).join('');
            } else {
                html = '<option value="">-- ไม่พบวิชาของครูในชั้นเรียนนี้ --</option>';
            }
        } else {
            html = '<option value="">-- ไม่พบวิชาที่สอน --</option>';
        }
    }
    safeSetSelectHtml('checkin-subject', html);
}
export function onTeacherChange() {
    const teacherId = document.getElementById('checkin-teacher').value;
    const classId = document.getElementById('checkin-class')?.value;
    populateCheckinSubjectDropdown(teacherId, classId);
    if (window.resetCheckinTable) window.resetCheckinTable();
}

export function onCheckinClassChange() {
    const teacherId = document.getElementById('checkin-teacher')?.value;
    const classId = document.getElementById('checkin-class')?.value;
    populateCheckinSubjectDropdown(teacherId, classId);
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

    if (!classId) {
        safeSetSelectHtml('stats-subject', '<option value="">-- กรุณาเลือกชั้นเรียนก่อน --</option>');
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
    
    safeSetSelectHtml('stats-subject', '<option value="all">-- รวมทุกวิชา --</option>' + subjectOptionsStr);
}

export function onHistoryClassChange() {
    const classId = document.getElementById('history-class').value;

    if (!classId) {
        safeSetSelectHtml('history-subject', '<option value="">-- กรุณาเลือกชั้นเรียนก่อน --</option>');
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
    
    safeSetSelectHtml('history-subject', '<option value="">-- ทุกวิชา --</option>' + subjectOptionsStr);
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

// 🌟 ระบบควบคุมการเปิด-ปิด Tooltip (สำหรับ Hover บนคอมฯ และ Click/Tap บนมือถือ/แท็บเล็ต)
document.addEventListener('click', function(e) {
    const tooltipContainer = e.target.closest('.tooltip-container');
    
    // ปิด Tooltip อื่นๆ ที่เปิดอยู่
    document.querySelectorAll('.tooltip-container.active').forEach(container => {
        if (container !== tooltipContainer) {
            container.classList.remove('active');
        }
    });
    
    // ถ้าคลิกโดน Tooltip Container
    if (tooltipContainer) {
        // เช็คว่าเป็น Mobile/Tablet View (< 1024px) หรืออุปกรณ์สัมผัส
        const isMobileOrTouch = (window.innerWidth < 1024) || !window.matchMedia('(hover: hover)').matches;
        if (isMobileOrTouch) {
            tooltipContainer.classList.toggle('active');
        }
    }
});

// 🌟 ฟังก์ชันสลับการเปิด-ปิด เมนูแฮมเบอร์เกอร์บนมือถือ
export function toggleMobileMenu() {
    const nav = document.getElementById('app-nav');
    const icon = document.getElementById('mobile-menu-icon');
    if (nav.classList.contains('hidden')) {
        nav.classList.remove('hidden');
        if(icon) { icon.classList.remove('fa-bars'); icon.classList.add('fa-times'); }
    } else {
        nav.classList.add('hidden');
        if(icon) { icon.classList.remove('fa-times'); icon.classList.add('fa-bars'); }
    }
}

window.autoSelectPeriod = autoSelectPeriod;
window.updateClassDropdown = updateClassDropdown;
window.populateCheckinSubjectDropdown = populateCheckinSubjectDropdown;
window.onCheckinYearSemesterChange = onCheckinYearSemesterChange;
window.onTeacherChange = onTeacherChange;
window.onCheckinClassChange = onCheckinClassChange;
window.onHistoryYearSemesterChange = onHistoryYearSemesterChange;
window.onStatsYearSemesterChange = onStatsYearSemesterChange;
window.onStatsClassChange = onStatsClassChange;
window.onHistoryClassChange = onHistoryClassChange;
window.saveSettings = saveSettings;
window.syncDataToGoogleSheet = syncDataToGoogleSheet;
window.cleanUpOldAttendanceData = cleanUpOldAttendanceData;
window.migrateOldAttendanceIds = migrateOldAttendanceIds;
window.toggleMobileMenu = toggleMobileMenu;
