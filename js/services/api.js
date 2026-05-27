import { DB_KEYS } from '../core/config.js';
import { AppState } from '../core/state.js';
import { loginSuccess } from '../features/auth.js';
import { showLoading, hideLoading, showToast } from '../utils/helpers.js';

export function loadFromLocalStorage() {
    AppState.allStudents = JSON.parse(localStorage.getItem(DB_KEYS.STUDENTS) || '[]');
    AppState.allRecords = JSON.parse(localStorage.getItem(DB_KEYS.RECORDS) || '[]');
    AppState.allSubjects = JSON.parse(localStorage.getItem(DB_KEYS.SUBJECTS) || '[]');
    AppState.allTeachers = JSON.parse(localStorage.getItem(DB_KEYS.TEACHERS) || '[]');
    AppState.allClasses = JSON.parse(localStorage.getItem(DB_KEYS.CLASSES) || '[]');
    AppState.allClubs = JSON.parse(localStorage.getItem(DB_KEYS.CLUBS) || '[]');
    AppState.allClubEnrollments = JSON.parse(localStorage.getItem(DB_KEYS.CLUB_ENROLLMENTS) || '[]');
    AppState.allClubRecords = JSON.parse(localStorage.getItem(DB_KEYS.CLUB_RECORDS) || '[]');
}

// ในไฟล์ test/js/services/api.js
export async function syncDataFromServer(silent = false) {
    if (!AppState.googleSheetUrl) {
        loadFromLocalStorage();
        if (!silent) hideLoading(); // Ensure loading is hidden even if no URL
        return false;
    }
    if (!silent) showLoading('กำลังซิงค์ข้อมูลล่าสุด...');

    // อ่านข้อมูล session ที่มีอยู่จาก localStorage ก่อน
    AppState.currentUser = JSON.parse(localStorage.getItem(DB_KEYS.SESSION));
    try {
        const res = await fetch(`${AppState.googleSheetUrl}?action=getData&t=${new Date().getTime()}`, { cache: 'no-store' });
        const data = await res.json();
        
        if(data.status === 'success') {
            // 🌟 แก้ไขตรงนี้: ต้องรับข้อมูลให้ครบทุกชีต ห้ามย่อ
            AppState.allStudents = data.Students || [];
            AppState.allRecords = data.Records || [];
            AppState.allSubjects = data.Subjects || [];
            AppState.allTeachers = data.Teachers || [];
            AppState.allClasses = data.Classes || [];
            AppState.allClubs = data.Clubs || [];
            AppState.allClubEnrollments = data.ClubEnrollments || [];
            AppState.allClubRecords = data.ClubRecords || [];
            
            // Save to LocalStorage เพื่อสำรองตอนเน็ตหลุด
            localStorage.setItem(DB_KEYS.STUDENTS, JSON.stringify(AppState.allStudents));
            localStorage.setItem(DB_KEYS.RECORDS, JSON.stringify(AppState.allRecords));
            localStorage.setItem(DB_KEYS.SUBJECTS, JSON.stringify(AppState.allSubjects));
            localStorage.setItem(DB_KEYS.TEACHERS, JSON.stringify(AppState.allTeachers));
            localStorage.setItem(DB_KEYS.CLASSES, JSON.stringify(AppState.allClasses));
            localStorage.setItem(DB_KEYS.CLUBS, JSON.stringify(AppState.allClubs));
            localStorage.setItem(DB_KEYS.CLUB_ENROLLMENTS, JSON.stringify(AppState.allClubEnrollments));
            localStorage.setItem(DB_KEYS.CLUB_RECORDS, JSON.stringify(AppState.allClubRecords));
            
            // อัปเดตข้อมูลผู้ใช้ปัจจุบัน (currentUser)
            if (AppState.currentUser) { // ตรวจสอบข้อมูล user ที่ล็อกอินค้างไว้กับข้อมูลใหม่
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
        }
    } catch (e) {
        console.error('Sync error:', e);
        if (!silent) showToast('ไม่สามารถดึงข้อมูลล่าสุดได้ ระบบกำลังใช้ข้อมูลเดิม');
        loadFromLocalStorage();
        return false;
    } finally {
        hideLoading();
    }
}

export async function saveToDB(key, data, action) {
    localStorage.setItem(key, JSON.stringify(data));
    if (AppState.googleSheetUrl && action) {
        showLoading('กำลังบันทึกข้อมูล...'); 
        try {
            const res = await fetch(AppState.googleSheetUrl, { 
                method: 'POST', 
                redirect: 'follow', 
                headers: { 'Content-Type': 'text/plain;charset=utf-8' }, 
                body: JSON.stringify({ action: action, data: data }) 
            });
            const text = await res.text();
            try {
                const result = JSON.parse(text);
                if (result.status === 'error') throw new Error(result.message || 'Server Data Error');
                return true;
            } catch(err) {
                if (res.ok) return true; // ทริคแก้บั๊กตอน Google Sheet บันทึกผ่านแต่ไม่ยอมพ่น JSON
                throw new Error('HTTP ' + res.status);
            }
        } catch(e) { 
            console.error(e); 
            showToast('บันทึกลงฐานข้อมูลล้มเหลว: ' + e.message);
            return false;
        } finally { 
            hideLoading(); 
        }
    }
    return true;
}