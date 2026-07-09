import { AppState } from '../core/state.js';
import { DB_KEYS } from '../core/config.js';
import { saveToDB, syncDataFromServer, firebaseClearStudentCheckIns } from '../services/api.js';
import { showLoading, hideLoading, showToast, customAlert, customConfirm } from '../utils/helpers.js';

export async function createDatabaseBackup(autoTrigger = false) {
    showLoading('กำลังจัดเตรียมไฟล์สำรองข้อมูลปีปัจจุบัน...');
    try {
        const school = sessionStorage.getItem('SELECTED_SCHOOL') || 'unknown';
        const year = document.getElementById('checkin-year')?.value || '2569';
        const semester = document.getElementById('checkin-semester')?.value || '1';
        
        const backupData = {
            school: school,
            timestamp: new Date().toISOString(),
            academicYear: year,
            semester: semester,
            data: {
                Students: AppState.allStudents,
                Teachers: AppState.allTeachers,
                Classes: AppState.allClasses,
                Subjects: AppState.allSubjects,
                Clubs: AppState.allClubs,
                ClubEnrollments: AppState.allClubEnrollments,
                ClubRecords: AppState.allClubRecords,
                Records: AppState.allRecords,
                Assignments: AppState.allAssignments,
                StudentAssignments: AppState.allStudentAssignments,
                PRNews: AppState.allPrNews,
                SchoolSettings: AppState.schoolSettings
            }
        };

        const jsonStr = JSON.stringify(backupData, null, 2);
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(jsonStr);
        const filename = `backup_${school}_${year}_sem${semester}_${new Date().toISOString().slice(0,10)}.json`;
        
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", filename);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();

        const backupUrlContainer = document.getElementById('backup-url-container');
        const backupNameSpan = document.getElementById('backup-name-span');
        if (backupUrlContainer && backupNameSpan) {
            backupNameSpan.innerText = filename;
            backupUrlContainer.classList.remove('hidden');
            const backupUrlLink = document.getElementById('backup-url-link');
            if (backupUrlLink) backupUrlLink.classList.add('hidden');
        }

        if (!autoTrigger) {
            customAlert(`สำรองข้อมูลสำเร็จ!\nดาวน์โหลดไฟล์เรียบร้อยแล้ว: ${filename}`);
        }
        return true;
    } catch (e) {
        console.error(e);
        customAlert('การสำรองข้อมูลล้มเหลว: ' + e.toString());
        return false;
    } finally {
        hideLoading();
    }
}

export async function resetForNewAcademicYear() {
    customConfirm(
        '⚠️ คำเตือน: ยืนยันการเคลียร์ประวัติล้างข้อมูล',
        'ระบบจะทำการดาวน์โหลดไฟล์สำรองข้อมูล และทำการลบประวัติการเช็คชื่อ การส่งงาน และคะแนนการบ้านทั้งหมดออกจาก Firebase ทันที โดยจะคงข้อมูลรายชื่อนักเรียน ครู ชั้นเรียน วิชา และชุมนุม เอาไว้ใช้งานต่อเทอมถัดไป\n\nกดยืนยันหากแน่ใจแล้ว',
        async () => {
            const confirmationText = prompt('โปรดพิมพ์คำว่า "CONFIRM" เพื่อยืนยันการล้างข้อมูลทั้งหมด (ตัวพิมพ์ใหญ่ทั้งหมด):');
            if (confirmationText !== 'CONFIRM') {
                return customAlert('การขอยกเลิก: ข้อความยืนยันไม่ถูกต้อง ระบบไม่ได้เปลี่ยนแปลงข้อมูลใดๆ');
            }

            const password = prompt('กรุณากรอกรหัสผ่าน Admin เพื่อยืนยันตัวตนความปลอดภัย:');
            if (password !== 'admin1234') {
                return customAlert('รหัสผ่านไม่ถูกต้อง การขอยกเลิกคำสั่งล้มเหลว');
            }

            // Safety first: Force a backup download
            const backedUp = await createDatabaseBackup(true);
            if (!backedUp) {
                return customAlert('ไม่สามารถสำรองข้อมูลอัตโนมัติได้ ยกเลิกการรีเซ็ตระบบเพื่อความปลอดภัย');
            }

            showLoading('กำลังดำเนินการล้างข้อมูลประวัติและรีเซ็ตสถานะระบบใน Firebase...');
            try {
                // Clear transactional data on Firebase
                const clearRecords = await saveToDB(DB_KEYS.RECORDS, [], 'saveRecords');
                const clearClubRecords = await saveToDB(DB_KEYS.CLUB_RECORDS, [], 'saveClubRecords');
                const clearAssignments = await saveToDB('ASSIGNMENTS', [], 'saveAssignments');
                const clearStudentAssignments = await saveToDB('STUDENT_ASSIGNMENTS', [], 'saveStudentAssignments');
                const clearCheckins = await firebaseClearStudentCheckIns();

                if (clearRecords && clearClubRecords && clearAssignments && clearStudentAssignments && clearCheckins) {
                    if (window.clearCheckinDraft) window.clearCheckinDraft();
                    
                    showToast('เริ่มปีการศึกษาใหม่และล้างประวัติธุรกรรมสำเร็จ');
                    customAlert('ล้างข้อมูลประวัติธุรกรรมใน Firebase สำเร็จแล้ว!\nระบบได้ดาวน์โหลดไฟล์สำรองข้อมูลเก่าเก็บไว้ในคอมพิวเตอร์ของคุณครูเรียบร้อยแล้ว');
                    
                    // Pull fresh empty states
                    await syncDataFromServer(false);
                    if (window.updateAllDropdowns) window.updateAllDropdowns();
                    if (window.switchTab) window.switchTab('checkin');
                } else {
                    customAlert('ล้างข้อมูลล้มเหลว: ไม่สามารถบันทึกค่าว่างลง Firebase ได้');
                }
            } catch (e) {
                console.error(e);
                customAlert('การส่งคำสั่งล้างข้อมูลล้มเหลว: ' + e.toString());
            } finally {
                hideLoading();
            }
        }
    );
}

export function loadAndPreviewBackupFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const parsed = JSON.parse(e.target.result);
            if (!parsed || !parsed.data) {
                return customAlert('ไฟล์สำรองไม่ถูกต้อง หรือโครงสร้างข้อมูลไม่สมบูรณ์');
            }
            AppState.backupViewerData = parsed.data;
            renderBackupPreview();
            showToast('โหลดไฟล์สำรองสำเร็จ!');
        } catch (err) {
            console.error(err);
            customAlert('ไม่สามารถอ่านไฟล์สำรองได้: ' + err.message);
        }
    };
    reader.readAsText(file);
}

export function renderBackupPreview() {
    const container = document.getElementById('backup-preview-content');
    if (!container || !AppState.backupViewerData) return;

    const data = AppState.backupViewerData;
    const records = data.Records || [];
    const clubRecords = data.ClubRecords || [];
    const studentAssignments = data.StudentAssignments || [];

    let html = `
        <div class="space-y-6 mt-6 p-4 bg-gray-50/50 border rounded-xl shadow-sm">
            <h4 class="font-bold text-gray-800 text-sm border-b pb-2"><i class="fas fa-file-invoice mr-2 text-blue-600"></i>ข้อมูลประวัติในไฟล์สำรอง</h4>
            <div class="grid grid-cols-3 gap-2 text-center text-xs">
                <div class="bg-blue-50 text-blue-700 p-2.5 rounded-lg border border-blue-100">
                    <p class="font-semibold uppercase tracking-wider">ประวัติเช็คชื่อปกติ</p>
                    <p class="font-extrabold text-base mt-0.5">${records.length} คาบ</p>
                </div>
                <div class="bg-green-50 text-green-700 p-2.5 rounded-lg border border-green-100">
                    <p class="font-semibold uppercase tracking-wider">ประวัติชุมนุม</p>
                    <p class="font-extrabold text-base mt-0.5">${clubRecords.length} คาบ</p>
                </div>
                <div class="bg-purple-50 text-purple-700 p-2.5 rounded-lg border border-purple-100">
                    <p class="font-semibold uppercase tracking-wider">การส่งงาน/คะแนน</p>
                    <p class="font-extrabold text-base mt-0.5">${studentAssignments.length} รายการ</p>
                </div>
            </div>
            
            <div class="border-t border-gray-200/60 pt-4">
                <label class="block text-xs font-bold text-gray-700 mb-2">เลือกประเภทข้อมูลที่ต้องการแสดงตัวอย่าง</label>
                <select id="backup-preview-type" onchange="changeBackupPreviewType()" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-green-500 focus:border-green-500 bg-white">
                    <option value="regular">ประวัติการเช็คชื่อเข้าเรียนปกติ</option>
                    <option value="club">ประวัติการเข้าเรียนกิจกรรมชุมนุม</option>
                    <option value="assignments">ประวัติการมอบหมายงานและส่งคะแนน</option>
                </select>
                
                <div class="mt-4 max-h-[400px] overflow-y-auto border border-gray-200 rounded-lg bg-white p-2" id="backup-preview-table-container">
                </div>
            </div>
        </div>
    `;
    container.innerHTML = html;
    changeBackupPreviewType();
}

export function changeBackupPreviewType() {
    const type = document.getElementById('backup-preview-type')?.value;
    const container = document.getElementById('backup-preview-table-container');
    if (!container || !AppState.backupViewerData) return;

    const data = AppState.backupViewerData;
    
    if (type === 'regular') {
        const list = data.Records || [];
        if (list.length === 0) {
            container.innerHTML = '<div class="text-center py-6 text-gray-500 text-xs">ไม่มีประวัติการเช็คชื่อปกติในไฟล์นี้</div>';
            return;
        }
        let table = `
            <table class="min-w-full divide-y divide-gray-200 text-xs">
                <thead>
                    <tr class="bg-gray-50 text-gray-500">
                        <th class="px-3 py-2 text-left font-bold">วันที่/คาบ</th>
                        <th class="px-3 py-2 text-left font-bold">ชั้นเรียน</th>
                        <th class="px-3 py-2 text-left font-bold">วิชา</th>
                        <th class="px-3 py-2 text-left font-bold">ครูผู้สอน</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-100 text-gray-700 bg-white">
        `;
        list.forEach(r => {
            const formattedDate = r.date ? r.date.slice(0, 10) : '-';
            table += `
                <tr class="hover:bg-blue-50/40 cursor-pointer" onclick="toggleBackupRowDetails('${r.id}', 'regular')">
                    <td class="px-3 py-2 font-semibold whitespace-nowrap"><i class="fas fa-chevron-right mr-1 text-gray-400"></i>${formattedDate} (คาบ ${r.period || '-'})</td>
                    <td class="px-3 py-2 whitespace-nowrap">${r.class || '-'}</td>
                    <td class="px-3 py-2 whitespace-nowrap">${r.subject || '-'}</td>
                    <td class="px-3 py-2 whitespace-nowrap">${r.teacher || '-'}</td>
                </tr>
                <tr id="detail-${r.id}" class="detail-row hidden bg-gray-50/50">
                    <td colspan="4" class="px-4 py-3" id="detail-content-${r.id}"></td>
                </tr>
            `;
        });
        table += '</tbody></table>';
        container.innerHTML = table;
    } else if (type === 'club') {
        const list = data.ClubRecords || [];
        if (list.length === 0) {
            container.innerHTML = '<div class="text-center py-6 text-gray-500 text-xs">ไม่มีประวัติกิจกรรมชุมนุมในไฟล์นี้</div>';
            return;
        }
        let table = `
            <table class="min-w-full divide-y divide-gray-200 text-xs">
                <thead>
                    <tr class="bg-gray-50 text-gray-500">
                        <th class="px-3 py-2 text-left font-bold">วันที่</th>
                        <th class="px-3 py-2 text-left font-bold">ชุมนุม</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-100 text-gray-700 bg-white">
        `;
        list.forEach(r => {
            const formattedDate = r.date ? r.date.slice(0, 10) : '-';
            table += `
                <tr class="hover:bg-green-50/40 cursor-pointer" onclick="toggleBackupRowDetails('${r.id}', 'club')">
                    <td class="px-3 py-2 font-semibold whitespace-nowrap"><i class="fas fa-chevron-right mr-1 text-gray-400"></i>${formattedDate}</td>
                    <td class="px-3 py-2 whitespace-nowrap">${r.clubName || r.clubId || '-'}</td>
                </tr>
                <tr id="detail-${r.id}" class="detail-row hidden bg-gray-50/50">
                    <td colspan="2" class="px-4 py-3" id="detail-content-${r.id}"></td>
                </tr>
            `;
        });
        table += '</tbody></table>';
        container.innerHTML = table;
    } else {
        const list = data.Assignments || [];
        if (list.length === 0) {
            container.innerHTML = '<div class="text-center py-6 text-gray-500 text-xs">ไม่มีประวัติการมอบหมายงานในไฟล์นี้</div>';
            return;
        }
        let table = `
            <table class="min-w-full divide-y divide-gray-200 text-xs">
                <thead>
                    <tr class="bg-gray-50 text-gray-500">
                        <th class="px-3 py-2 text-left font-bold">ชื่องาน</th>
                        <th class="px-3 py-2 text-left font-bold">ชั้นเรียน</th>
                        <th class="px-3 py-2 text-left font-bold">วิชา</th>
                        <th class="px-3 py-2 text-left font-bold">คะแนนเต็ม</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-100 text-gray-700 bg-white">
        `;
        list.forEach(r => {
            table += `
                <tr class="hover:bg-purple-50/40 cursor-pointer" onclick="toggleBackupRowDetails('${r.id}', 'assignment')">
                    <td class="px-3 py-2 font-semibold whitespace-nowrap"><i class="fas fa-chevron-right mr-1 text-gray-400"></i>${r.title || '-'}</td>
                    <td class="px-3 py-2 whitespace-nowrap">${r.class || '-'}</td>
                    <td class="px-3 py-2 whitespace-nowrap">${r.subject || '-'}</td>
                    <td class="px-3 py-2 whitespace-nowrap">${r.maxScore || '-'} คะแนน</td>
                </tr>
                <tr id="detail-${r.id}" class="detail-row hidden bg-gray-50/50">
                    <td colspan="4" class="px-4 py-3" id="detail-content-${r.id}"></td>
                </tr>
            `;
        });
        table += '</tbody></table>';
        container.innerHTML = table;
    }
}

export function toggleBackupRowDetails(id, type) {
    const detailRow = document.getElementById(`detail-${id}`);
    if (!detailRow) return;

    if (!detailRow.classList.contains('hidden')) {
        detailRow.classList.add('hidden');
        return;
    }

    // Hide all other detail rows to keep preview clean
    document.querySelectorAll('.detail-row').forEach(row => {
        if (row.id !== `detail-${id}`) row.classList.add('hidden');
    });

    const data = AppState.backupViewerData;
    const container = document.getElementById(`detail-content-${id}`);
    if (!container || !data) return;

    const studentMap = {};
    (data.Students || []).forEach(s => {
        studentMap[s.id] = s;
    });

    if (type === 'regular' || type === 'club') {
        const list = type === 'regular' ? (data.Records || []) : (data.ClubRecords || []);
        const record = list.find(r => r.id === id);
        if (!record || !record.attendance) {
            container.innerHTML = '<p class="text-gray-500 py-2 text-xs">ไม่พบรายละเอียดการเข้าเรียน</p>';
            detailRow.classList.remove('hidden');
            return;
        }

        let html = `
            <div class="p-3 bg-blue-50/30 rounded-lg border border-gray-200/80 text-xs mt-1">
                <p class="font-bold text-gray-800 mb-2"><i class="fas fa-users mr-1"></i> รายชื่อเช็คชื่อนักเรียน (${record.attendance.length} คน)</p>
                <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
        `;

        record.attendance.forEach(a => {
            const stu = studentMap[a.studentId];
            const name = stu ? `${stu.firstName} ${stu.lastName}` : 'ไม่พบข้อมูลนักเรียน';
            const num = stu ? `เลขที่ ${stu.number}` : '-';
            const badgeColor = a.status === 'มา' ? 'text-green-700 font-bold' : (a.status === 'สาย' ? 'text-yellow-600 font-bold' : (a.status === 'ลา' ? 'text-blue-600 font-bold' : 'text-red-600 font-bold'));
            const noteText = a.note ? ` <span class="text-gray-400 italic font-normal">(${a.note})</span>` : '';
            html += `
                <div class="bg-white p-2 rounded border border-gray-100 flex justify-between items-center shadow-xs">
                    <div>
                        <span class="font-semibold text-gray-700 block">${name}</span>
                        <span class="text-[10px] text-gray-500 block">${num}</span>
                    </div>
                    <span class="${badgeColor} text-xs shrink-0">${a.status}${noteText}</span>
                </div>
            `;
        });

        html += `</div></div>`;
        container.innerHTML = html;
    } else if (type === 'assignment') {
        const assignments = data.Assignments || [];
        const asm = assignments.find(a => a.id === id);
        const subList = (data.StudentAssignments || []).filter(sa => sa.assignmentId === id);

        if (!asm) {
            container.innerHTML = '<p class="text-gray-500 py-2 text-xs">ไม่พบรายละเอียดงาน</p>';
            detailRow.classList.remove('hidden');
            return;
        }

        let html = `
            <div class="p-3 bg-purple-50/30 rounded-lg border border-gray-200/80 text-xs mt-1">
                <p class="font-bold text-gray-800 mb-2"><i class="fas fa-clipboard-check mr-1"></i> รายละเอียดคะแนนและการส่งงาน (${subList.length} คน)</p>
                <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
        `;

        subList.forEach(a => {
            const stu = studentMap[a.studentId];
            const name = stu ? `${stu.firstName} ${stu.lastName}` : 'ไม่พบข้อมูลนักเรียน';
            const num = stu ? `เลขที่ ${stu.number}` : '-';
            const scoreText = a.score !== undefined && a.score !== '' ? `${a.score} / ${asm.maxScore} คะแนน` : 'ยังไม่ได้ส่ง/ตรวจ';
            const statusColor = a.score !== undefined && a.score !== '' ? 'text-green-700 font-bold' : 'text-red-500';
            const teacherComment = a.teacherComment ? ` <span class="text-gray-400 block italic font-normal mt-0.5 border-t pt-0.5">ครูเม้น: ${a.teacherComment}</span>` : '';
            html += `
                <div class="bg-white p-2 rounded border border-gray-100 flex flex-col shadow-xs">
                    <div class="flex justify-between items-center gap-1">
                        <div>
                            <span class="font-semibold text-gray-700 block">${name}</span>
                            <span class="text-[10px] text-gray-500 block">${num}</span>
                        </div>
                        <span class="${statusColor} text-xs shrink-0">${scoreText}</span>
                    </div>
                    ${teacherComment}
                </div>
            `;
        });

        html += `</div></div>`;
        container.innerHTML = html;
    }

    detailRow.classList.remove('hidden');
}

// Bind to window
window.createDatabaseBackup = createDatabaseBackup;
window.resetForNewAcademicYear = resetForNewAcademicYear;
window.loadAndPreviewBackupFile = loadAndPreviewBackupFile;
window.changeBackupPreviewType = changeBackupPreviewType;
window.toggleBackupRowDetails = toggleBackupRowDetails;
