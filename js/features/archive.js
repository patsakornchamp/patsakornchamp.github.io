import { AppState } from '../core/state.js';
import { syncDataFromServer } from '../services/api.js';
import { showLoading, hideLoading, showToast, customAlert, customConfirm } from '../utils/helpers.js';

export async function createDatabaseBackup() {
    if (!AppState.googleSheetUrl) {
        return customAlert('ไม่พบ Google Sheet API URL กรุณาตั้งค่าเชื่อมต่อก่อน');
    }

    showLoading('กำลังดำเนินการสำรองข้อมูลฐานข้อมูลปีปัจจุบัน...');
    try {
        const payload = {
            year: document.getElementById('checkin-year')?.value || '2569',
            semester: document.getElementById('checkin-semester')?.value || '1'
        };

        const res = await fetch(AppState.googleSheetUrl, {
            method: 'POST',
            redirect: 'follow',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'archiveActiveDatabase', payload: payload })
        });
        const result = await res.json();

        if (result.success) {
            const backupUrlContainer = document.getElementById('backup-url-container');
            const backupUrlLink = document.getElementById('backup-url-link');
            const backupNameSpan = document.getElementById('backup-name-span');

            if (backupUrlContainer && backupUrlLink && backupNameSpan) {
                backupUrlLink.href = result.backupUrl;
                backupUrlLink.classList.remove('hidden');
                backupNameSpan.innerText = result.backupName;
                backupUrlContainer.classList.remove('hidden');
            }
            customAlert(`สำรองข้อมูลสำเร็จเรียบร้อยแล้ว!\nชื่อไฟล์สำรอง: ${result.backupName}`);
        } else {
            customAlert('เกิดข้อผิดพลาด: ' + (result.message || 'ไม่สามารถสำรองข้อมูลได้'));
        }
    } catch (e) {
        console.error(e);
        customAlert('การเชื่อมต่อสำรองข้อมูลล้มเหลว: ' + e.toString());
    } finally {
        hideLoading();
    }
}

export async function resetForNewAcademicYear() {
    if (!AppState.googleSheetUrl) {
        return customAlert('ไม่พบ Google Sheet API URL กรุณาตั้งค่าเชื่อมต่อก่อน');
    }

    // ถามยืนยันรอบที่ 1
    customConfirm(
        '⚠️ คำเตือน: ยืนยันการเคลียร์ประวัติล้างข้อมูล',
        'ระบบจะทำการลบประวัติการเช็คชื่อ ประวัติเยี่ยมบ้าน และประวัติการส่งการบ้านทั้งหมดออกทันที โดยจะคงข้อมูล Master Data (ประวัตินักเรียนพร้อมโปรไฟล์, รายชื่อครู, วิชา, ห้องเรียน, ชุมนุม) เอาไว้ใช้งานต่อเทอมถัดไป\n\nกดยืนยันหากมั่นใจว่าสำรองข้อมูลชีตเก็บไว้เรียบร้อยแล้ว',
        async () => {
            // ถามยืนยันรอบที่ 2 (ให้พิมพ์คำว่า CONFIRM)
            const confirmationText = prompt('โปรดพิมพ์คำว่า "CONFIRM" เพื่อยืนยันการล้างข้อมูลทั้งหมด (ตัวพิมพ์ใหญ่ทั้งหมด):');
            if (confirmationText !== 'CONFIRM') {
                return customAlert('การขอยกเลิก: ข้อความยืนยันไม่ถูกต้อง ระบบไม่ได้เปลี่ยนแปลงข้อมูลใดๆ');
            }

            // ยืนยันรหัสผ่านผู้ดูแลระบบ (Admin)
            const password = prompt('กรุณากรอกรหัสผ่าน Admin เพื่อยืนยันตัวตนความปลอดภัย:');
            if (password !== 'admin1234') {
                return customAlert('รหัสผ่านไม่ถูกต้อง การขอยกเลิกคำสั่งล้มเหลว');
            }

            showLoading('กำลังดำเนินการล้างข้อมูลประวัติและรีเซ็ตสถานะระบบ...');
            try {
                const res = await fetch(AppState.googleSheetUrl, {
                    method: 'POST',
                    redirect: 'follow',
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                    body: JSON.stringify({ action: 'resetTransactionData', payload: {} })
                });
                const result = await res.json();

                if (result.success) {
                    showToast('เริ่มปีการศึกษาใหม่และล้างประวัติธุรกรรมสำเร็จ');
                    customAlert('ล้างข้อมูลประวัติธุรกรรมสำเร็จแล้ว! ระบบจะทำการดึงข้อมูลล่าสุดจากชีตใหม่ทันที');
                    
                    // ดึงข้อมูลสดกลับมาอัปเดตลงเครื่อง
                    await syncDataFromServer(false);
                    if (window.updateAllDropdowns) window.updateAllDropdowns();
                    if (window.switchTab) window.switchTab('checkin');
                } else {
                    customAlert('ล้างข้อมูลล้มเหลว: ' + (result.message || 'ไม่สามารถล้างข้อมูลได้'));
                }
            } catch (e) {
                console.error(e);
                customAlert('การส่งคำสั่งล้มเหลว: ' + e.toString());
            } finally {
                hideLoading();
            }
        }
    );
}

// ผูกเข้า Window
window.createDatabaseBackup = createDatabaseBackup;
window.resetForNewAcademicYear = resetForNewAcademicYear;
