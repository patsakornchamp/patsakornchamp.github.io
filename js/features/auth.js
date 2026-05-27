import { AppState } from '../core/state.js';
import { DB_KEYS } from '../core/config.js';
import { getStudentFullName, showLoading, hideLoading } from '../utils/helpers.js';
import { syncDataFromServer } from '../services/api.js';

export function switchLoginTab(type) {
    document.getElementById('form-login-student').classList.add('hidden');
    document.getElementById('form-login-teacher').classList.add('hidden');
    document.getElementById('l-tab-student').className = 'flex-1 py-3 text-center font-bold text-gray-500 border-b-2 border-transparent hover:text-green-600 focus:outline-none';
    document.getElementById('l-tab-teacher').className = 'flex-1 py-3 text-center font-bold text-gray-500 border-b-2 border-transparent hover:text-green-600 focus:outline-none';
    
    if(type === 'student') {
        document.getElementById('form-login-student').classList.remove('hidden');
        document.getElementById('l-tab-student').className = 'flex-1 py-3 text-center font-bold text-green-700 border-b-2 border-green-600 focus:outline-none';
    } else {
        document.getElementById('form-login-teacher').classList.remove('hidden');
        document.getElementById('l-tab-teacher').className = 'flex-1 py-3 text-center font-bold text-green-700 border-b-2 border-green-600 focus:outline-none';
    }
    document.getElementById('login-error-msg').classList.add('hidden');
}

export async function handleLogin(e, role) {
    e.preventDefault();
    const errorMsg = document.getElementById('login-error-msg');
    errorMsg.classList.add('hidden');

    showLoading('กำลังตรวจสอบข้อมูลการเข้าสู่ระบบ...');
    await syncDataFromServer(true); // ดึงข้อมูลล่าสุดจากฐานข้อมูลมาอัปเดต state แบบ background
    hideLoading();

    if (role === 'teacher') {
        const user = document.getElementById('login-tc-user').value.trim();
        const pass = document.getElementById('login-tc-pass').value.trim();

        if (user === 'admin' && pass === 'admin1234') {
            loginSuccess({ role: 'admin', data: { name: 'ผู้ดูแลระบบ (Admin)' } });
            return;
        }

        const teacher = AppState.allTeachers.find(t => {
            const tEmail = t.email ? t.email.toString().trim() : '';
            const tPass = t.password ? t.password.toString().trim() : '';
            return tEmail === user && tPass === pass && t.deleted_flg !== 'Y';
        });
        
        if (teacher) {
            loginSuccess({ role: 'teacher', data: teacher });
            return;
        }
        
        errorMsg.innerText = "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
        errorMsg.classList.remove('hidden');
    } 
    else if (role === 'student') {
        const user = document.getElementById('login-stu-id').value.trim();
        const pass = document.getElementById('login-stu-pass').value.trim();

        const student = AppState.allStudents.find(s => {
            if (!s.studentId) return false;
            const cleanStudentId = s.studentId.toString().trim();
            return cleanStudentId === user && cleanStudentId === pass && s.deleted_flg !== 'Y';
        });
        
        if (student) {
            if (student.status === 'ลาออก') {
                errorMsg.innerText = "รหัสนักเรียนนี้พ้นสภาพการเป็นนักเรียนแล้ว";
                errorMsg.classList.remove('hidden');
                return;
            }
            loginSuccess({ role: 'student', data: student });
            return;
        }

        errorMsg.innerText = "รหัสนักเรียนไม่ถูกต้อง (รหัสผ่านเริ่มต้นคือรหัสประจำตัวนักเรียนของคุณ)";
        errorMsg.classList.remove('hidden');
    }
}

export function loginSuccess(userObj) {
    AppState.currentUser = userObj;
    localStorage.setItem(DB_KEYS.SESSION, JSON.stringify(AppState.currentUser));
    
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app-header').classList.remove('hidden');
    document.getElementById('app-main').classList.remove('hidden');
    
    const nameEl = document.getElementById('current-user-name');
    const roleEl = document.getElementById('current-user-role');
    
    if(AppState.currentUser.role === 'admin') {
        nameEl.innerText = AppState.currentUser.data.name; roleEl.innerText = 'ผู้ดูแลระบบสูงสุด';
    } else if(AppState.currentUser.role === 'teacher') {
        nameEl.innerText = `ครู${AppState.currentUser.data.firstName} ${AppState.currentUser.data.lastName}`; roleEl.innerText = 'ครูผู้สอน';
    } else if(AppState.currentUser.role === 'student') {
        nameEl.innerText = getStudentFullName(AppState.currentUser.data); roleEl.innerText = `นักเรียนชั้น ${AppState.currentUser.data.class}`;
    }

    updateMenuVisibility();
    if(window.updateAllDropdowns) window.updateAllDropdowns();
}

export function logout() {
    AppState.currentUser = null;
    localStorage.removeItem(DB_KEYS.SESSION);
    
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('app-header').classList.add('hidden');
    document.getElementById('app-main').classList.add('hidden');
    document.getElementById('form-login-student').reset();
    document.getElementById('form-login-teacher').reset();
}

export function updateMenuVisibility() {
    ['menu-my-profile', 'menu-my-club', 'menu-academic', 'menu-checkin', 'menu-club-checkin', 'menu-club-manage', 'menu-history', 'menu-stats', 'menu-students', 'menu-master', 'menu-settings'].forEach(id => {
        document.getElementById(id).classList.add('hidden');
    });

    const periodSelect = document.getElementById('checkin-period');

    if(AppState.currentUser.role === 'admin') {
        ['menu-checkin', 'menu-club-checkin', 'menu-club-manage', 'menu-history', 'menu-stats', 'menu-students', 'menu-master', 'menu-settings'].forEach(id => document.getElementById(id).classList.remove('hidden'));
        const msubTeacher = document.getElementById('msub-teachers');
        if(msubTeacher) msubTeacher.classList.remove('hidden');
        
        if (periodSelect) {
            periodSelect.removeAttribute('disabled');
            periodSelect.classList.remove('bg-gray-100', 'text-gray-500', 'cursor-not-allowed');
        }
        if(window.switchTab) window.switchTab('checkin');
    } 
    else if (AppState.currentUser.role === 'teacher') {
        ['menu-checkin', 'menu-club-checkin', 'menu-club-manage', 'menu-history', 'menu-stats', 'menu-students', 'menu-master'].forEach(id => document.getElementById(id).classList.remove('hidden'));
        const msubTeacher = document.getElementById('msub-teachers');
        if(msubTeacher) msubTeacher.classList.add('hidden');
        
        if (periodSelect) {
            periodSelect.setAttribute('disabled', 'true');
            periodSelect.classList.add('bg-gray-100', 'text-gray-500', 'cursor-not-allowed');
        }
        if(window.switchTab) window.switchTab('checkin');
    }
    else if (AppState.currentUser.role === 'student') {
        ['menu-my-profile', 'menu-my-club', 'menu-academic'].forEach(id => document.getElementById(id).classList.remove('hidden'));
        if(window.switchTab) window.switchTab('my-profile');
    }
}

// ผูกฟังก์ชันเข้า Window
window.switchLoginTab = switchLoginTab;
window.handleLogin = handleLogin;
window.logout = logout;