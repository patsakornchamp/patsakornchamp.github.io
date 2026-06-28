import { AppState } from '../core/state.js';
import { DB_KEYS } from '../core/config.js';
import { getStudentFullName, showLoading, hideLoading, customAlert, closeModal } from '../utils/helpers.js';
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

        let student = AppState.allStudents.find(s => {
            if (!s.studentId) return false;
            const cleanStudentId = s.studentId.toString().trim();
            return cleanStudentId === user && cleanStudentId === pass && s.deleted_flg !== 'Y';
        });
        
        if (!student && user === pass) {
            try {
                const res = await fetch(`${AppState.googleSheetUrl}?action=getStudentById&studentId=${encodeURIComponent(user)}`);
                const json = await res.json();
                if (json.status === 'success' && json.Student) {
                    student = json.Student;
                    AppState.allStudents.push(student);
                    localStorage.setItem(DB_KEYS.STUDENTS, JSON.stringify(AppState.allStudents));
                }
            } catch (err) {
                console.error("Login fetch error:", err);
            }
        }
        
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
    const mobNameEl = document.getElementById('mobile-user-name');
    const mobRoleEl = document.getElementById('mobile-user-role');
    
    if(AppState.currentUser.role === 'admin') {
        nameEl.innerText = AppState.currentUser.data.name; roleEl.innerText = 'ผู้ดูแลระบบสูงสุด';
        if(mobNameEl) mobNameEl.innerText = AppState.currentUser.data.name; 
        if(mobRoleEl) mobRoleEl.innerText = 'ผู้ดูแลระบบสูงสุด';
    } else if(AppState.currentUser.role === 'teacher') {
        const tName = `ครู${AppState.currentUser.data.firstName} ${AppState.currentUser.data.lastName}`;
        nameEl.innerText = tName; roleEl.innerText = 'ครูผู้สอน';
        if(mobNameEl) mobNameEl.innerText = tName; 
        if(mobRoleEl) mobRoleEl.innerText = 'ครูผู้สอน';
    } else if(AppState.currentUser.role === 'student') {
        const sName = getStudentFullName(AppState.currentUser.data);
        const sRole = `นักเรียนชั้น ${AppState.currentUser.data.class}`;
        nameEl.innerText = sName; roleEl.innerText = sRole;
        if(mobNameEl) mobNameEl.innerText = sName; 
        if(mobRoleEl) mobRoleEl.innerText = sRole;
    }

    updateMenuVisibility();
    if(window.updateAllDropdowns) window.updateAllDropdowns();

    // Show dynamic PR announcements on login/refresh
    if (window.showPRAnnouncementIfActive) {
        window.showPRAnnouncementIfActive();
    }
    
    setTimeout(() => {
        if (window.promptBiometricEnrollment) {
            window.promptBiometricEnrollment();
        }
    }, 500);
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
    ['menu-my-profile', 'menu-my-club', 'menu-academic', 'menu-my-assignments', 'menu-student-qr', 'menu-checkin', 'menu-club-checkin', 'menu-history', 'menu-stats', 'menu-master', 'menu-settings', 'menu-home-visit', 'menu-assignments'].forEach(id => {
        document.getElementById(id).classList.add('hidden');
    });

    const periodSelect = document.getElementById('checkin-period');

    if(AppState.currentUser.role === 'admin') {
        ['menu-checkin', 'menu-club-checkin', 'menu-history', 'menu-stats', 'menu-master', 'menu-settings', 'menu-home-visit', 'menu-assignments'].forEach(id => document.getElementById(id).classList.remove('hidden'));
        const msubTeacher = document.getElementById('msub-teachers');
        if(msubTeacher) msubTeacher.classList.remove('hidden');
        
        if (periodSelect) {
            periodSelect.removeAttribute('disabled');
            periodSelect.classList.remove('bg-gray-100', 'text-gray-500', 'cursor-not-allowed');
        }
        if(window.switchTab) window.switchTab('checkin');
    } 
    else if (AppState.currentUser.role === 'teacher') {
        ['menu-checkin', 'menu-club-checkin', 'menu-history', 'menu-stats', 'menu-master', 'menu-home-visit', 'menu-assignments'].forEach(id => document.getElementById(id).classList.remove('hidden'));
        const msubTeacher = document.getElementById('msub-teachers');
        if(msubTeacher) msubTeacher.classList.add('hidden');
        
        if (periodSelect) {
            periodSelect.removeAttribute('disabled');
            periodSelect.classList.remove('bg-gray-100', 'text-gray-500', 'cursor-not-allowed');
        }
        if(window.switchTab) window.switchTab('checkin');
    }
    else if (AppState.currentUser.role === 'student') {
        ['menu-my-profile', 'menu-my-club', 'menu-academic', 'menu-my-assignments', 'menu-student-qr'].forEach(id => document.getElementById(id).classList.remove('hidden'));
        if(window.switchTab) window.switchTab('my-profile');
    }
}

export function openTeacherRegisterSearch(e) {
    if(e) e.preventDefault();
    document.getElementById('reg-search-fname').value = '';
    document.getElementById('reg-search-lname').value = '';
    document.getElementById('teacher-register-search-modal').classList.add('show');
}

export function searchTeacherForRegister() {
    const fname = document.getElementById('reg-search-fname').value.trim();
    const lname = document.getElementById('reg-search-lname').value.trim();

    if (!fname || !lname) {
        return customAlert('กรุณากรอกชื่อและนามสกุลให้ครบถ้วน');
    }

    const teacher = AppState.allTeachers.find(t => t.firstName === fname && t.lastName === lname && t.deleted_flg !== 'Y');

    closeModal('teacher-register-search-modal');

    if (teacher) {
        if (teacher.email) {
            customAlert(`มีข้อมูลสมาชิกแล้ว Email ของคุณคือ: ${teacher.email}`);
        } else {
            document.getElementById('t-id').value = teacher.id;
            document.getElementById('t-title').value = teacher.title || 'นาย';
            document.getElementById('t-title').disabled = true;
            
            document.getElementById('t-fname').value = teacher.firstName;
            document.getElementById('t-fname').readOnly = true;
            document.getElementById('t-fname').classList.add('bg-gray-100');
            
            document.getElementById('t-lname').value = teacher.lastName;
            document.getElementById('t-lname').readOnly = true;
            document.getElementById('t-lname').classList.add('bg-gray-100');

            document.getElementById('t-phone').value = teacher.phone || '';
            document.getElementById('t-email').value = '';
            document.getElementById('t-password').value = '';
            document.getElementById('t-conf-password').value = '';
            
            if (document.getElementById('t-subject-search')) document.getElementById('t-subject-search').value = '';
            window._tempTeacherSubIds = teacher.subjects ? [...teacher.subjects] : [];
            if(window.renderTeacherSubjectsList) window.renderTeacherSubjectsList();
            
            document.getElementById('teacher-modal').classList.add('show');
        }
    } else {
        // หากไม่พบชื่อ-นามสกุล เปิด Modal เพิ่มใหม่แบบเป็นค่าว่าง
        if(window.openTeacherModal) window.openTeacherModal();
    }
}

// ผูกฟังก์ชันเข้า Window
window.switchLoginTab = switchLoginTab;
window.handleLogin = handleLogin;
window.logout = logout;
window.openTeacherRegisterSearch = openTeacherRegisterSearch;
window.searchTeacherForRegister = searchTeacherForRegister;
// ==========================================
// WebAuthn Biometric Login
// ==========================================

export function checkBiometricAvailability() {
    const cred = localStorage.getItem('BIOMETRIC_CRED');
    const bBtns = document.querySelectorAll('.biometric-login-btn');
    if (cred && window.PublicKeyCredential) {
        bBtns.forEach(btn => btn.classList.remove('hidden'));
    } else {
        bBtns.forEach(btn => btn.classList.add('hidden'));
    }
}

export async function enableBiometric() {
    if (!window.PublicKeyCredential) {
        showToast("อุปกรณ์หรือเบราว์เซอร์ของคุณไม่รองรับระบบนี้", "error");
        return;
    }
    const user = AppState.currentUser;
    if (!user) return;
    
    try {
        showLoading("กำลังตั้งค่าระบบ Biometric...");
        
        const challenge = new Uint8Array(32);
        window.crypto.getRandomValues(challenge);
        
        const userId = user.role + '_' + (user.data.id || user.data.studentId || 'admin');
        const encoder = new TextEncoder();
        const userIdBuffer = encoder.encode(userId);
        
        const publicKey = {
            challenge: challenge,
            rp: { name: "MAKHRAB System", id: window.location.hostname },
            user: {
                id: userIdBuffer,
                name: userId,
                displayName: user.data.name || getStudentFullName(user.data) || "User"
            },
            pubKeyCredParams: [{ type: "public-key", alg: -7 }],
            authenticatorSelection: {
                authenticatorAttachment: "platform",
                userVerification: "required"
            },
            timeout: 60000,
            attestation: "none"
        };
        
        const credential = await navigator.credentials.create({ publicKey });
        const credId = bufferToBase64(credential.rawId);
        
        localStorage.setItem('BIOMETRIC_CRED', JSON.stringify({
            id: credId,
            user: user
        }));
        
        hideLoading();
        showToast("ตั้งค่า Biometric สำเร็จ!", "success");
        checkBiometricAvailability();
    } catch (e) {
        hideLoading();
        console.error("Biometric Setup Error:", e);
        showToast("ยกเลิกหรือเกิดข้อผิดพลาดในการตั้งค่า", "error");
    }
}

export async function loginWithBiometric() {
    const savedCred = JSON.parse(localStorage.getItem('BIOMETRIC_CRED'));
    if (!savedCred || !savedCred.id) return;
    
    try {
        const challenge = new Uint8Array(32);
        window.crypto.getRandomValues(challenge);
        
        const publicKey = {
            challenge: challenge,
            allowCredentials: [{
                id: base64ToBuffer(savedCred.id),
                type: "public-key"
            }],
            userVerification: "required",
            timeout: 60000
        };
        
        await navigator.credentials.get({ publicKey });
        
        // Success! Log the user in
        handleLoginSuccessInternal(savedCred.user);
        
    } catch (e) {
        console.error("Biometric Login Error:", e);
        showToast("ไม่สามารถเข้าสู่ระบบด้วย Biometric ได้", "error");
    }
}

function handleLoginSuccessInternal(user) {
    if (window.loginSuccess) {
        window.loginSuccess(user);
    } else {
        loginSuccess(user);
    }
}

export function promptBiometricEnrollment() {
    if (!window.PublicKeyCredential) return;
    const cred = localStorage.getItem('BIOMETRIC_CRED');
    const dismissed = localStorage.getItem('BIOMETRIC_DISMISSED');
    // If not enrolled on this device yet, ask them
    if (!cred && !dismissed) {
        localStorage.setItem('BIOMETRIC_DISMISSED', 'true');
        customConfirm("ใช้งาน Biometric", "คุณต้องการเปิดใช้งานการเข้าสู่ระบบด้วยใบหน้า (Face ID) หรือสแกนลายนิ้วมือ สำหรับเครื่องนี้หรือไม่? เพื่อความสะดวกในครั้งต่อไป", () => {
            enableBiometric();
        });
    }
}

window.checkBiometricAvailability = checkBiometricAvailability;
window.enableBiometric = enableBiometric;
window.loginWithBiometric = loginWithBiometric;
window.promptBiometricEnrollment = promptBiometricEnrollment;



