// ==========================================
// ไฟล์: test/js/utils/helpers.js
// หน้าที่: รวมฟังก์ชันตัวช่วย (Utility Functions)
// ==========================================
import { AppState } from '../core/state.js';

export function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

export function getStudentFullName(s) {
    if(!s) return '';
    const nick = s.nickname ? ` (${s.nickname})` : '';
    return s.firstName ? `${s.title || ''}${s.firstName} ${s.lastName || ''}${nick}` : `${s.name || ''}${nick}`;
}

export function getCurrentUserId() {
    if (!AppState.currentUser) return 'system';
    if (AppState.currentUser.role === 'admin') return 'admin';
    return AppState.currentUser.data.id;
}

export function getISOTimestamp() {
    // Returns a UTC ISO 8601 string for database consistency.
    return new Date().toISOString();
}

// ฟังก์ชันแปลงลิงก์ Google Drive เป็นลิงก์ที่แสดงภาพได้โดยตรง
export function showLoading(text = 'กำลังประมวลผล...') {
    const overlay = document.getElementById('loading-overlay');
    const textEl = document.getElementById('loading-text');
    if (overlay) overlay.classList.add('show');
    if (textEl) textEl.innerText = text;
}

export function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.classList.remove('show');
}

export function showToast(msg, type = 'success') {
    const toast = document.getElementById('toast');
    const toastMsg = document.getElementById('toast-msg');
    const toastIcon = toast ? toast.querySelector('i') : null;
    if(!toast || !toastMsg) return;
    
    toastMsg.innerText = msg;
    
    if (type === 'error') {
        toast.classList.add('error');
        if (toastIcon) {
            toastIcon.className = 'fas fa-exclamation-circle';
        }
    } else {
        toast.classList.remove('error');
        if (toastIcon) {
            toastIcon.className = 'fas fa-check-circle';
        }
    }
    
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

export function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove('show');
    
    if (id === 'pr-announcement-modal' && typeof window.stopPRAutoplay === 'function') {
        window.stopPRAutoplay();
    }
}

export function customAlert(msg) {
    const el = document.getElementById('alert-message');
    if(el) el.innerText = msg;
    const modal = document.getElementById('custom-alert-modal');
    if(modal) modal.classList.add('show');
}

export function customConfirm(title, msg, callback) {
    const titleEl = document.getElementById('confirm-title');
    const msgEl = document.getElementById('confirm-message');
    if(titleEl) titleEl.innerText = title;
    if(msgEl) msgEl.innerHTML = msg;

    const modal = document.getElementById('custom-confirm-modal');
    const okBtn = document.getElementById('confirm-ok-btn');
    
    if(modal && okBtn) {
        modal.classList.add('show');
        okBtn.onclick = () => {
            closeModal('custom-confirm-modal');
            if (callback) callback();
        };
    }
}

export function validateThaiCitizenId(id) {
    if (!id || id.length !== 13 || !/^\d{13}$/.test(id)) return false;
    let sum = 0;
    for (let i = 0; i < 12; i++) sum += parseFloat(id.charAt(i)) * (13 - i);
    return (11 - sum % 11) % 10 === parseFloat(id.charAt(12));
}

export function validatePhoneNumber(phone) {
    if(!phone) return true; // ถ้าไม่มีเบอร์ให้ผ่าน
    const p = phone.replace(/[^0-9]/g, '');
    return p.length >= 9 && p.length <= 10;
}

// --- ฟังก์ชันเกี่ยวกับวันที่และเวลา (โซนเวลาประเทศไทย) ---
export function getBangkokDate(dateInput) {
    if (!dateInput) return '';
    const d = (typeof dateInput === 'string') ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

export function getBangkokCurrentTime() {
    return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date());
}

export function getBangkokDateTime(dateInput) {
    if (!dateInput) return '';
    const d = (typeof dateInput === 'string') ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(d).replace(' ', 'T');
}




export function getDefaultAcademicYearAndSemester() {
    const d = new Date();
    const y = d.getFullYear() + 543;
    const m = d.getMonth() + 1;
    let year = y;
    let sem = 1;
    if (m >= 4 && m <= 10) { year = y; sem = 1; }
    else if (m >= 11 || m <= 3) { year = m <= 3 ? y - 1 : y; sem = 2; }
    return { year, semester: sem };
}

export function getYearSemesterFromDate(dateStr) {
    const d = new Date(dateStr);
    const y = d.getFullYear() + 543;
    const m = d.getMonth() + 1;
    if (m >= 4 && m <= 10) return { year: y, semester: 1 };
    return { year: m <= 3 ? y - 1 : y, semester: 2 };
}

export function matchRecordYearSemester(record, filterYear, filterSemester) {
    if(record.year !== undefined && record.semester !== undefined) {
        return record.year.toString() === filterYear.toString() && record.semester.toString() === filterSemester.toString();
    }
    const parsed = getYearSemesterFromDate(record.date);
    return parsed.year.toString() === filterYear.toString() && parsed.semester.toString() === filterSemester.toString();
}

// --- 🌟 ฟังก์ชัน Export CSV ที่มีปัญหา ---
export function exportToCSV(filename, headers, rows) {
    const csvRows = [headers.join(',')];
    for (const row of rows) {
        const values = row.map(val => {
            const escaped = ('' + (val !== undefined && val !== null ? val : '')).replace(/"/g, '""');
            return `"${escaped}"`;
        }).join(',');
        csvRows.push(values);
    }
    const csvString = '\uFEFF' + csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

export function getDirectImageUrl(url) {
    if (!url) return '';
    const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
        return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w1200`;
    }
    return url;
}

// ==========================================
// WebAuthn Utilities
// ==========================================
export function bufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export function base64ToBuffer(base64) {
    let b64 = base64.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4 !== 0) {
        b64 += '=';
    }
    const binary = window.atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

// ==========================================
// ผูกฟังก์ชัน UI พื้นฐานเข้า Global Window (เพื่อให้ปุ่ม onclick ในหน้า HTML กดใช้งานได้)
// ==========================================
window.closeModal = closeModal;
window.customAlert = customAlert;
window.customConfirm = customConfirm;
window.getDirectImageUrl = getDirectImageUrl;