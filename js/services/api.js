import { DB_KEYS, firebaseConfig } from '../core/config.js';
import { AppState } from '../core/state.js';
import { loginSuccess } from '../features/auth.js';
import { showLoading, hideLoading, showToast } from '../utils/helpers.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getDatabase, ref, get, set, update } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export function loadFromLocalStorage() {
    AppState.allStudents = JSON.parse(localStorage.getItem(DB_KEYS.STUDENTS) || '[]').filter(Boolean);
    AppState.allRecords = JSON.parse(localStorage.getItem(DB_KEYS.RECORDS) || '[]').filter(Boolean);
    AppState.allSubjects = JSON.parse(localStorage.getItem(DB_KEYS.SUBJECTS) || '[]').filter(Boolean);
    AppState.allTeachers = JSON.parse(localStorage.getItem(DB_KEYS.TEACHERS) || '[]').filter(Boolean);
    AppState.allClasses = JSON.parse(localStorage.getItem(DB_KEYS.CLASSES) || '[]').filter(Boolean);
    AppState.allClasses.sort((a, b) => (a && a.className || '').localeCompare(b && b.className || '', 'th', { numeric: true }));
    AppState.allClubs = JSON.parse(localStorage.getItem(DB_KEYS.CLUBS) || '[]').filter(Boolean);
    AppState.allClubEnrollments = JSON.parse(localStorage.getItem(DB_KEYS.CLUB_ENROLLMENTS) || '[]').filter(Boolean);
    AppState.allClubRecords = JSON.parse(localStorage.getItem(DB_KEYS.CLUB_RECORDS) || '[]').filter(Boolean);
    AppState.allAssignments = JSON.parse(localStorage.getItem('ASSIGNMENTS') || '[]').filter(Boolean);
    AppState.allStudentAssignments = JSON.parse(localStorage.getItem('STUDENT_ASSIGNMENTS') || '[]').filter(Boolean);
    AppState.allPrNews = JSON.parse(localStorage.getItem(DB_KEYS.PR_NEWS) || '[]').filter(Boolean);
    AppState.schoolSettings = JSON.parse(localStorage.getItem(DB_KEYS.SCHOOL_SETTINGS) || '{}');
}

export async function syncDataFromServer(silent = false) {
    showLoading('กำลังเชื่อมต่อฐานข้อมูล Firebase...');

    AppState.currentUser = JSON.parse(localStorage.getItem(DB_KEYS.SESSION));
    
    try {
        const dbRef = ref(db, '/');
        const snapshot = await get(dbRef);
        const data = snapshot.val() || {};
        
        if (data.Students) {
            AppState.allStudents = (Array.isArray(data.Students) ? data.Students : Object.values(data.Students)).filter(Boolean);
        }
        AppState.allRecords = data.Records ? (Array.isArray(data.Records) ? data.Records : Object.values(data.Records)).filter(Boolean) : [];
        AppState.allSubjects = data.Subjects ? (Array.isArray(data.Subjects) ? data.Subjects : Object.values(data.Subjects)).filter(Boolean) : [];
        AppState.allTeachers = data.Teachers ? (Array.isArray(data.Teachers) ? data.Teachers : Object.values(data.Teachers)).filter(Boolean) : [];
        AppState.allClasses = data.Classes ? (Array.isArray(data.Classes) ? data.Classes : Object.values(data.Classes)).filter(Boolean) : [];
        AppState.allClasses.sort((a, b) => (a && a.className || '').localeCompare(b && b.className || '', 'th', { numeric: true }));
        AppState.allClubs = data.Clubs ? (Array.isArray(data.Clubs) ? data.Clubs : Object.values(data.Clubs)).filter(Boolean) : [];
        AppState.allClubEnrollments = data.ClubEnrollments ? (Array.isArray(data.ClubEnrollments) ? data.ClubEnrollments : Object.values(data.ClubEnrollments)).filter(Boolean) : [];
        AppState.allClubRecords = data.ClubRecords ? (Array.isArray(data.ClubRecords) ? data.ClubRecords : Object.values(data.ClubRecords)).filter(Boolean) : [];
        AppState.allAssignments = data.Assignments ? (Array.isArray(data.Assignments) ? data.Assignments : Object.values(data.Assignments)).filter(Boolean) : [];
        AppState.allStudentAssignments = data.StudentAssignments ? (Array.isArray(data.StudentAssignments) ? data.StudentAssignments : Object.values(data.StudentAssignments)).filter(Boolean) : [];
        AppState.allPrNews = data.PRNews ? (Array.isArray(data.PRNews) ? data.PRNews : Object.values(data.PRNews)).filter(Boolean) : [];
        
        if (data.Settings) {
            const settingsArr = Array.isArray(data.Settings) ? data.Settings : Object.values(data.Settings);
            if (settingsArr.length > 0) {
                AppState.schoolSettings = settingsArr[0];
            } else {
                AppState.schoolSettings = {};
            }
        } else {
            AppState.schoolSettings = {};
        }

        // Save to LocalStorage
        localStorage.setItem(DB_KEYS.STUDENTS, JSON.stringify(AppState.allStudents));
        localStorage.setItem(DB_KEYS.RECORDS, JSON.stringify(AppState.allRecords));
        localStorage.setItem(DB_KEYS.SUBJECTS, JSON.stringify(AppState.allSubjects));
        localStorage.setItem(DB_KEYS.TEACHERS, JSON.stringify(AppState.allTeachers));
        localStorage.setItem(DB_KEYS.CLASSES, JSON.stringify(AppState.allClasses));
        localStorage.setItem(DB_KEYS.CLUBS, JSON.stringify(AppState.allClubs));
        localStorage.setItem(DB_KEYS.CLUB_ENROLLMENTS, JSON.stringify(AppState.allClubEnrollments));
        localStorage.setItem(DB_KEYS.CLUB_RECORDS, JSON.stringify(AppState.allClubRecords));
        localStorage.setItem('ASSIGNMENTS', JSON.stringify(AppState.allAssignments));
        localStorage.setItem('STUDENT_ASSIGNMENTS', JSON.stringify(AppState.allStudentAssignments));
        localStorage.setItem(DB_KEYS.PR_NEWS, JSON.stringify(AppState.allPrNews));
        localStorage.setItem(DB_KEYS.SCHOOL_SETTINGS, JSON.stringify(AppState.schoolSettings));
        
        if (AppState.currentUser) {
            if (AppState.currentUser.role === 'student') {
                const updatedUser = AppState.allStudents.find(s => s.id === AppState.currentUser.data.id && s.deleted_flg !== 'Y');
                if (updatedUser) AppState.currentUser.data = updatedUser;
            } else if (AppState.currentUser.role === 'teacher') {
                const updatedUser = AppState.allTeachers.find(t => t.id === AppState.currentUser.data.id && t.deleted_flg !== 'Y');
                if (updatedUser) AppState.currentUser.data = updatedUser;
            }
            localStorage.setItem(DB_KEYS.SESSION, JSON.stringify(AppState.currentUser));
        }
        return true;
    } catch (error) {
        console.error('Firebase sync error:', error);
        if (!silent) showToast('ไม่สามารถดึงข้อมูลล่าสุดได้ ระบบกำลังใช้ข้อมูลเดิม');
        loadFromLocalStorage();
        return false;
    } finally {
        hideLoading();
    }
}

export function loadKeyFromLocalStorage(key) {
    const raw = localStorage.getItem(key);
    if (key === DB_KEYS.SCHOOL_SETTINGS) {
        AppState.schoolSettings = JSON.parse(raw || '{}');
        return;
    }
    const val = JSON.parse(raw || '[]').filter(Boolean);
    if (key === DB_KEYS.STUDENTS) AppState.allStudents = val;
    else if (key === DB_KEYS.RECORDS) AppState.allRecords = val;
    else if (key === DB_KEYS.SUBJECTS) AppState.allSubjects = val;
    else if (key === DB_KEYS.TEACHERS) AppState.allTeachers = val;
    else if (key === DB_KEYS.CLASSES) {
        AppState.allClasses = val;
        AppState.allClasses.sort((a, b) => (a && a.className || '').localeCompare(b && b.className || '', 'th', { numeric: true }));
    }
    else if (key === DB_KEYS.CLUBS) AppState.allClubs = val;
    else if (key === DB_KEYS.CLUB_ENROLLMENTS) AppState.allClubEnrollments = val;
    else if (key === DB_KEYS.CLUB_RECORDS) AppState.allClubRecords = val;
    else if (key === 'ASSIGNMENTS') AppState.allAssignments = val;
    else if (key === 'STUDENT_ASSIGNMENTS') AppState.allStudentAssignments = val;
    else if (key === DB_KEYS.PR_NEWS) AppState.allPrNews = val;
}

export async function saveToDB(key, data, action) {
    const previousValue = localStorage.getItem(key);
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
        console.warn('LocalStorage limit exceeded, skipping local cache for this save:', e);
    }
    if (action) {
        showLoading('กำลังบันทึกข้อมูลลง Firebase...'); 
        try {
            let path = '';
            if (action === 'saveStudents') path = 'Students';
            else if (action === 'saveRecords') path = 'Records';
            else if (action === 'saveSubjects') path = 'Subjects';
            else if (action === 'saveTeachers') path = 'Teachers';
            else if (action === 'saveClasses') path = 'Classes';
            else if (action === 'saveClubs') path = 'Clubs';
            else if (action === 'saveClubEnrollments') path = 'ClubEnrollments';
            else if (action === 'saveClubRecords') path = 'ClubRecords';
            else if (action === 'saveAssignments') path = 'Assignments';
            else if (action === 'saveStudentAssignments') path = 'StudentAssignments';
            else if (action === 'savePRNews') path = 'PRNews';
            else if (action === 'saveSettings') path = 'Settings';
            
            if (path) {
                await set(ref(db, path), data);
            }
            return true;
        } catch(e) { 
            console.error(e); 
            // Rollback local storage
            if (previousValue !== null) {
                localStorage.setItem(key, previousValue);
            } else {
                localStorage.removeItem(key);
            }
            // Revert AppState memory
            loadKeyFromLocalStorage(key);
            
            showToast('บันทึกลงฐานข้อมูลล้มเหลว: ระบบได้ยกเลิกการเปลี่ยนแปลงในเครื่องเพื่อป้องกันข้อมูลคลาดเคลื่อน ' + e.message);
            return false;
        } finally { 
            hideLoading(); 
        }
    }
    return true;
}

export async function uploadFileToDrive(fileBase64, action = 'uploadFile', extraPayload = {}) {
    if (!AppState.googleSheetUrl) return null;
    showLoading('กำลังอัปโหลดไฟล์...');
    try {
        const payload = { ...extraPayload, fileBase64 };
        const res = await fetch(AppState.googleSheetUrl, {
            method: 'POST',
            redirect: 'follow',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: action, payload: payload })
        });
        const text = await res.text();
        const result = JSON.parse(text);
        if (result.status === 'error' || result.success === false) throw new Error(result.message || 'Upload Error');
        return result;
    } catch (e) {
        console.error(e);
        showToast('อัปโหลดล้มเหลว: ' + e.message);
        return null;
    } finally {
        hideLoading();
    }
}

export async function firebaseStudentSelfCheckin(payload) {
    try {
        const id = payload.id || new Date().getTime().toString() + '_' + Math.random().toString(36).substr(2, 9);
        const checkinRef = ref(db, `StudentCheckIns/${id}`);
        const checkinData = {
            id: id,
            studentId: payload.studentId || '',
            classId: payload.classId || '',
            subjectId: payload.subjectId || '',
            teacherId: payload.teacherId || '',
            period: payload.period || '',
            latitude: payload.latitude || '',
            longitude: payload.longitude || '',
            scanTime: payload.scanTime || new Date().toISOString(),
            status: 'PENDING'
        };
        await set(checkinRef, checkinData);
        return { success: true, message: 'เช็คชื่อสำเร็จแล้ว' };
    } catch (error) {
        console.error("Firebase student checkin error:", error);
        return { success: false, message: error.toString() };
    }
}

export async function firebaseGetStudentCheckIns() {
    try {
        const dbRef = ref(db, 'StudentCheckIns');
        const snapshot = await get(dbRef);
        const data = snapshot.val() || {};
        const list = (Array.isArray(data) ? data : Object.values(data)).filter(Boolean);
        return { status: 'success', StudentCheckIns: list };
    } catch (error) {
        console.error("Firebase get checkins error:", error);
        return { status: 'error', message: error.toString() };
    }
}

export async function firebaseUpdateStudentCheckInsStatus(ids, status = 'SYNCED') {
    try {
        const updates = {};
        for (const id of ids) {
            updates[`StudentCheckIns/${id}/status`] = status;
        }
        await update(ref(db, '/'), updates);
        return { success: true };
    } catch (error) {
        console.error("Firebase update checkins status error:", error);
        return { success: false, message: error.toString() };
    }
}

export async function firebaseClearStudentCheckIns() {
    try {
        const checkinRef = ref(db, 'StudentCheckIns');
        await set(checkinRef, null);
        return true;
    } catch (error) {
        console.error("Firebase clear checkins error:", error);
        return false;
    }
}