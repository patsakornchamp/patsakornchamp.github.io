import { DB_KEYS, DEFAULT_GOOGLE_SCRIPT_URL, DEPLOY_VERSION, ENVIRONMENT } from './core/config.js';
import { AppState } from './core/state.js';
import { syncDataFromServer, saveToDB } from './services/api.js';
import { getBangkokDate, getDefaultAcademicYearAndSemester, showToast, customAlert, customConfirm, getISOTimestamp, getCurrentUserId } from './utils/helpers.js'; // 🌟 นำเข้าฟังก์ชันจัดการวันที่ของไทย

// 🌟 1. นำเข้าไฟล์ Features ทั้งหมดเพื่อให้ฟังก์ชันของมันทำงานและผูกเข้ากับ window
import './core/router.js';
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
    
    if (el.tomselect) {
        const ts = el.tomselect;
        const currentVal = ts.getValue();
        ts.destroy();
        
        el.innerHTML = html;
        
        const newTs = new TomSelect(el, {
            create: false,
            sortField: null
        });
        
        if (currentVal !== undefined && Array.from(el.options).some(opt => opt.value === currentVal)) {
            newTs.setValue(currentVal, true); 
        } else {
            newTs.setValue(el.options.length > 0 ? el.options[0].value : '', true);
        }
    } else {
        const currentVal = el.value;
        el.innerHTML = html;
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
    
    // Populating Period dropdown if checkin-period element exists
    const periodSelect = document.getElementById('checkin-period');
    if (periodSelect && ENVIRONMENT && ENVIRONMENT.periods) {
        const periodHtml = ENVIRONMENT.periods.map(p => 
            `<option value="${p.value}">${p.label}</option>`
        ).join('');
        safeSetSelectHtml('checkin-period', periodHtml);
    }

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

    // ดึงค่าจาก AppState.allClasses โดยใช้ className (ค่าจริงจากฐานข้อมูล) และกรองเฉพาะห้องที่มีนักเรียนอยู่จริงเท่านั้น
    const activeClassesWithStudents = AppState.allClasses.filter(c => 
        c.deleted_flg !== 'Y' && 
        AppState.allStudents.some(s => s.class === c.className && s.deleted_flg !== 'Y')
    );
    const classOptions = '<option value="">-- เลือกชั้นเรียน --</option>' + activeClassesWithStudents.sort((a,b)=>a.className.localeCompare(b.className, 'th', { numeric: true })).map(c => `<option value="${c.id}">${c.className}</option>`).join('');
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

// 🌟 3. ฟังก์ชันควบคุมเมนูหลัก (แก้ไขให้ใช้ Router)
function switchTab(tabId) {
    if (AppState.currentTab === tabId) return;
    
    if (AppState.currentTab === 'student-qr' && tabId !== 'student-qr') {
        if (window.stopStudentQrScanner) window.stopStudentQrScanner();
    }

    AppState.currentTab = tabId;
    const targetHash = '#/' + tabId;
    if (window.location.hash === targetHash) {
        if (window.appRouter) {
            window.appRouter.handleRoute();
        }
    } else {
        window.location.hash = targetHash;
    }
    
    // ซ่อนเมนูมือถืออัตโนมัติเมื่อกดเลือกเมนูย่อยเสร็จ
    const navEl = document.getElementById('app-nav');
    const icon = document.getElementById('mobile-menu-icon');
    if (window.innerWidth < 768 && navEl && !navEl.classList.contains('hidden')) {
        navEl.classList.add('hidden');
        if(icon) { icon.classList.remove('fa-times'); icon.classList.add('fa-bars'); }
    }
}

window.initTabLogic = function(tabId) {
    // 🌟 โหลด Dropdowns และป้อนข้อมูลเริ่มต้นสำหรับหน้านี้
    updateAllDropdowns();

    // 🔥 บังคับล้างค่าที่กรอกไว้และสั่งวาดตารางใหม่ทันทีเมื่อกดเปลี่ยนสลับแท็บ
    const today = getBangkokDate(new Date());
    const schoolDefaults = getDefaultAcademicYearAndSemester();

    // ตั้งค่าวันปัจจุบันให้ช่องวันที่
    const checkinDateEl = document.getElementById('checkin-date');
    if (checkinDateEl) checkinDateEl.value = today;
    const clubCheckinDateEl = document.getElementById('club-checkin-date');
    if (clubCheckinDateEl) clubCheckinDateEl.value = today;
    const historyDateEl = document.getElementById('history-date');
    if (historyDateEl) historyDateEl.value = '';

    // ตั้งค่าปีการศึกษาเริ่มต้น
    ['checkin-year', 'club-checkin-year', 'enroll-year', 'history-year', 'stats-year', 'aca-year', 'hv-year'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = schoolDefaults.year;
    });

    // ตั้งค่าเทอมเริ่มต้น
    ['checkin-semester', 'club-checkin-semester', 'enroll-semester', 'history-semester', 'stats-semester', 'aca-semester', 'hv-semester'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = schoolDefaults.semester;
    });

    if (tabId === 'checkin') {
        if (window.onCheckinYearSemesterChange) window.onCheckinYearSemesterChange();
        ['checkin-search', 'checkin-class', 'checkin-subject'].forEach(id => clearInputValue(id));
        if (AppState.currentUser && AppState.currentUser.role === 'admin') {
            clearInputValue('checkin-teacher');
        }
        if (window.onTeacherChange) window.onTeacherChange();
        
        const cb = document.getElementById('checkin-hide-checked'); if (cb) cb.checked = false;
        if (window.autoSelectPeriod) window.autoSelectPeriod();
        if (window.resetCheckinTable) window.resetCheckinTable();
        
        // Only load list if there is no pending draft to restore
        const draftKey = (ENVIRONMENT ? ENVIRONMENT.keyPrefix : '') + 'checkin_draft';
        const hasDraft = localStorage.getItem(draftKey) !== null;
        if (!hasDraft && window.loadCheckinList) window.loadCheckinList();
    } else if (tabId === 'club-checkin') {
        if (window.onClubCheckinYearSemesterChange) window.onClubCheckinYearSemesterChange();
        ['club-checkin-search', 'club-checkin-id'].forEach(id => {
            clearInputValue(id);
        });
        const cb = document.getElementById('club-checkin-hide-checked'); if (cb) cb.checked = false;
        if (window.resetClubCheckinTable) window.resetClubCheckinTable();
    }

    // ตรวจสอบร่างเช็คชื่อค้างอยู่ใน LocalStorage
    if (tabId === 'checkin' || tabId === 'club-checkin') {
        const draftKey = (ENVIRONMENT ? ENVIRONMENT.keyPrefix : '') + 'checkin_draft';
        const draftStr = localStorage.getItem(draftKey);
        if (draftStr && !AppState.draftPrompted) {
            try {
                const draft = JSON.parse(draftStr);
                if (draft && draft.clsId) {
                    AppState.draftPrompted = true;
                    setTimeout(() => {
                        const targetName = draft.isClub ? 'กิจกรรมชุมนุม' : 'การเช็คชื่อปกติ';
                        let details = '';
                        if (draft.isClub) {
                            const clubObj = AppState.allClubs.find(c => c.id === draft.clsId);
                            details = clubObj ? clubObj.name : draft.clsId;
                        } else {
                            const clsObj = AppState.allClasses.find(c => c.id === draft.clsId);
                            const clsName = clsObj ? clsObj.className : draft.clsId;
                            const subObj = AppState.allSubjects.find(s => s.id === draft.subId);
                            const subName = subObj ? `${subObj.code} - ${subObj.name}` : draft.subId;
                            details = `${clsName} วิชา ${subName}`;
                        }
                        
                        if (window.customConfirm) {
                            window.customConfirm(
                                'พบข้อมูลการเช็คชื่อค้างอยู่',
                                `ระบบพบประวัติการเช็คชื่อค้างอยู่ของ <b>${details}</b> (${targetName}) ต้องการทำต่อหรือไม่?`,
                                () => {
                                    if (draft.isClub && tabId !== 'club-checkin') {
                                        window.switchTab('club-checkin');
                                    } else if (!draft.isClub && tabId !== 'checkin') {
                                        window.switchTab('checkin');
                                    }
                                    setTimeout(() => {
                                        if (window.resumeCheckinDraft) window.resumeCheckinDraft(draft);
                                        AppState.draftPrompted = false;
                                    }, 150);
                                },
                                'ทำต่อ',
                                'ล้างข้อมูลร่าง',
                                () => {
                                    localStorage.removeItem(draftKey);
                                    AppState.draftPrompted = false;
                                }
                            );
                        }
                    }, 500);
                }
            } catch (e) {
                console.error("Error reading draft:", e);
            }
        }
    } else if (tabId === 'history') {
        if (window.onHistoryYearSemesterChange) window.onHistoryYearSemesterChange();
        ['history-date', 'history-class', 'history-subject'].forEach(id => {
            clearInputValue(id);
        });
        const cont = document.getElementById('history-records-container'); if (cont) cont.innerHTML = '';
        if (window.onHistoryTypeChange) window.onHistoryTypeChange(); 
    } else if (tabId === 'stats') {
        if (window.onStatsYearSemesterChange) window.onStatsYearSemesterChange();
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
        if (window.onEnrollFilterChange) window.onEnrollFilterChange();
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
        if (window.updateBiometricButtons) window.updateBiometricButtons();
    } else if (tabId === 'home-visit') {
        clearInputValue('hv-class');
        const st = document.getElementById('hv-status'); if (st) st.value = 'all';
        if (window.initHomeVisitTab) window.initHomeVisitTab();
    } else if (tabId === 'assignments') {
        ['asm-filter-class', 'asm-filter-subject'].forEach(id => clearInputValue(id));
        if (window.initAssignmentsTab) window.initAssignmentsTab();
    }

    // 🌟 เปิดใช้งานระบบ Searchable Dropdown (Tom Select) ให้กับทุกๆ ตัวกรองชั้นเรียน, วิชา, และครู
    ['checkin-class', 'checkin-teacher', 'checkin-subject', 'history-class', 'history-subject', 'stats-class', 'stats-subject', 'hv-class'].forEach(id => {
        const el = document.getElementById(id);
        if (el && window.TomSelect && !el.tomselect) {
            new TomSelect(el, {
                create: false,
                sortField: null
            });
        }
    });
};
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
    let selectedValue = '';

    if (ENVIRONMENT && ENVIRONMENT.periods) {
        // ค้นหาคาบเรียนที่มีช่วงเวลาตรงกับเวลาปัจจุบันที่ระบุไว้ใน Label
        for (const p of ENVIRONMENT.periods) {
            const match = p.label.match(/\((\d{2})\.(\d{2})-(\d{2})\.(\d{2})\)/);
            if (match) {
                const startHour = parseInt(match[1]);
                const startMin = parseInt(match[2]);
                const endHour = parseInt(match[3]);
                const endMin = parseInt(match[4]);
                
                const startTime = startHour * 100 + startMin;
                const endTime = endHour * 100 + endMin;
                
                if (timeNum >= startTime && timeNum < endTime) {
                    selectedValue = p.value;
                    break;
                }
            }
        }
        
        // หากอยู่นอกช่วงเวลาเรียน
        if (!selectedValue && ENVIRONMENT.periods.length > 0) {
            // เช็คก่อนเวลาเริ่มคาบแรก
            const firstMatch = ENVIRONMENT.periods[0].label.match(/\((\d{2})\.(\d{2})/);
            if (firstMatch) {
                const firstStart = parseInt(firstMatch[1]) * 100 + parseInt(firstMatch[2]);
                if (timeNum < firstStart) {
                    selectedValue = ENVIRONMENT.periods[0].value;
                }
            }
            
            // หากเลยคาบสุดท้ายไปแล้ว
            if (!selectedValue) {
                selectedValue = ENVIRONMENT.periods[ENVIRONMENT.periods.length - 1].value;
            }
        }
    }
    
    const periodSelect = document.getElementById('checkin-period');
    if (periodSelect) {
        if (periodSelect.tomselect) {
            periodSelect.tomselect.setValue(selectedValue || '1', true);
        } else {
            periodSelect.value = selectedValue || '1';
        }
    }
}

// 🌟 4. เริ่มการทำงานของแอป
export function applySchoolSettings() {
    const defaultLogo = ENVIRONMENT && ENVIRONMENT.logoUrl ? ENVIRONMENT.logoUrl : '';
    let schoolName = ENVIRONMENT && ENVIRONMENT.systemName ? ENVIRONMENT.systemName.replace("ระบบของโรงเรียน ", "") : '';
    let systemName = "MAKHRAB";
    let logoUrl = defaultLogo;

    if (AppState.schoolSettings && Object.keys(AppState.schoolSettings).length > 0) {
        if (AppState.schoolSettings.schoolName) schoolName = AppState.schoolSettings.schoolName;
        if (AppState.schoolSettings.systemName) systemName = AppState.schoolSettings.systemName;
        if (AppState.schoolSettings.logoUrl) logoUrl = AppState.schoolSettings.logoUrl;
    }
    
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
    
    // Always set logo image (using default logo as fallback)
    const loginLogo = document.getElementById('ui-login-logo');
    const mainLogo = document.getElementById('ui-main-logo');
    const directUrl = window.getDirectImageUrl ? window.getDirectImageUrl(logoUrl) : logoUrl;
    if (loginLogo) loginLogo.src = directUrl;
    if (mainLogo) mainLogo.src = directUrl;

    updateDynamicManifest();
}

export function updateDynamicManifest() {
    const urlParams = new URLSearchParams(window.location.search);
    let schoolParam = urlParams.get('school') || localStorage.getItem('SELECTED_SCHOOL') || '';
    
    let manifestFile = 'manifest.json';
    if (schoolParam === 'rnn') {
        manifestFile = 'manifest_rnn.json';
    }

    let manifestLink = document.querySelector('link[rel="manifest"]');
    if (!manifestLink) {
        manifestLink = document.createElement('link');
        manifestLink.rel = 'manifest';
        document.head.appendChild(manifestLink);
    }
    manifestLink.href = './' + manifestFile;
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
    if (document.getElementById('checkin-date')) document.getElementById('checkin-date').value = today;
    if (document.getElementById('club-checkin-date')) document.getElementById('club-checkin-date').value = today;
    if (document.getElementById('history-date')) document.getElementById('history-date').value = ''; 
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

        // 🌟 2. โหลดข้อมูลเริ่มต้น (ไม่ต้องเรียก tab-specific function เพราะ Router จะจัดการตอนเข้าแท็บ)

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
                const hasBiometric = localStorage.getItem('BIOMETRIC_CRED');
                if (hasBiometric && (parsedUser.role === 'teacher' || parsedUser.role === 'admin')) {
                    document.getElementById('login-screen').classList.remove('hidden');
                    if (window.checkBiometricAvailability) window.checkBiometricAvailability();
                    setTimeout(() => {
                        if (window.loginWithBiometric) window.loginWithBiometric();
                    }, 800);
                } else {
                    auth.loginSuccess(parsedUser);
                }
                if (parsedUser.role === 'admin' || parsedUser.role === 'teacher') {
                     // Checkin list will load when the tab is initialized by the router
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
    const filtered = AppState.allClasses.filter(c => 
        c.year == yearVal && 
        c.semester == semVal && 
        c.deleted_flg !== 'Y' &&
        AppState.allStudents.some(s => s.class === c.className && s.deleted_flg !== 'Y')
    );
    filtered.sort((a,b) => a.className.localeCompare(b.className, 'th', { numeric: true }));
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
    const el = document.getElementById('checkin-teacher');
    if (!el) return;
    const teacherId = el.value;
    const classId = document.getElementById('checkin-class')?.value;
    populateCheckinSubjectDropdown(teacherId, classId);
    if (window.resetCheckinTable) window.resetCheckinTable();
}

export async function onCheckinClassChange() {
    const teacherId = document.getElementById('checkin-teacher')?.value;
    const classId = document.getElementById('checkin-class')?.value;
    populateCheckinSubjectDropdown(teacherId, classId);
    if (classId) {
        const clsObj = AppState.allClasses.find(c => c.id === classId);
        const clsName = clsObj ? clsObj.className : classId;
        if (clsName && typeof window.ensureStudentsLoadedForClass === 'function') {
            await window.ensureStudentsLoadedForClass(clsName);
        }
    }
    if (window.resetCheckinTable) window.resetCheckinTable();
}

export function onHistoryYearSemesterChange() {
    if (window.onHistoryTypeChange) window.onHistoryTypeChange();
}

export function onStatsYearSemesterChange() {
    if (window.onStatsTypeChange) window.onStatsTypeChange();
}

export function onStatsClassChange() {
    const el = document.getElementById('stats-class');
    if (!el) return;
    const classId = el.value;

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
    const el = document.getElementById('history-class');
    if (!el) return;
    const classId = el.value;

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

export function checkAndPromptDraft() {
    if (!AppState.currentUser) return; // Only prompt if logged in
    if (AppState.currentUser.role !== 'admin' && AppState.currentUser.role !== 'teacher') return; // Only for admin/teachers

    const draftKey = (ENVIRONMENT ? ENVIRONMENT.keyPrefix : '') + 'checkin_draft';
    const draftStr = localStorage.getItem(draftKey);
    if (draftStr && !AppState.draftPrompted) {
        try {
            const draft = JSON.parse(draftStr);
            if (draft && draft.clsId) {
                AppState.draftPrompted = true;
                setTimeout(() => {
                    const targetName = draft.isClub ? 'กิจกรรมชุมนุม' : 'การเช็คชื่อปกติ';
                    let details = '';
                    if (draft.isClub) {
                        const clubObj = AppState.allClubs.find(c => c.id === draft.clsId);
                        details = clubObj ? clubObj.name : draft.clsId;
                    } else {
                        const clsObj = AppState.allClasses.find(c => c.id === draft.clsId);
                        const clsName = clsObj ? clsObj.className : draft.clsId;
                        const subObj = AppState.allSubjects.find(s => s.id === draft.subId);
                        const subName = subObj ? `${subObj.code} - ${subObj.name}` : draft.subId;
                        details = `${clsName} วิชา ${subName}`;
                    }

                    if (window.customConfirm) {
                        window.customConfirm(
                            'พบข้อมูลการเช็คชื่อค้างอยู่',
                            `ระบบพบประวัติการเช็คชื่อค้างอยู่ของ <b>${details}</b> (${targetName}) ต้องการทำต่อหรือไม่?`,
                            () => {
                                // Switch tab first if needed
                                const targetTab = draft.isClub ? 'club-checkin' : 'checkin';
                                if (AppState.currentTab !== targetTab) {
                                    window.switchTab(targetTab);
                                }
                                setTimeout(() => {
                                    if (window.resumeCheckinDraft) window.resumeCheckinDraft(draft);
                                    AppState.draftPrompted = false;
                                }, 200);
                            },
                            'ทำต่อ',
                            'ล้างข้อมูลร่าง',
                            () => {
                                localStorage.removeItem(draftKey);
                                AppState.draftPrompted = false;
                            }
                        );
                    }
                }, 500);
            }
        } catch (e) {
            console.error("Error reading draft:", e);
        }
    }
}
window.checkAndPromptDraft = checkAndPromptDraft;

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

// ป้องกันการรีเฟรชหน้าจอหรือปิดแท็บโดยไม่ตั้งใจเมื่อยังไม่ได้บันทึกการเช็คชื่อ
window.addEventListener('beforeunload', (e) => {
    if (AppState.checkinUnsavedChanges) {
        e.preventDefault();
        e.returnValue = 'คุณมีข้อมูลที่ยังไม่ได้บันทึก ต้องการออกจากหน้านี้ใช่หรือไม่?';
        return e.returnValue;
    }
});
