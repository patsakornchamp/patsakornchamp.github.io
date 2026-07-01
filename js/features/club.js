import { AppState } from '../core/state.js';
import { DB_KEYS } from '../core/config.js';
import { generateId, getStudentFullName, showToast, customAlert, customConfirm, closeModal, exportToCSV, getBangkokDate, getDefaultAcademicYearAndSemester, matchRecordYearSemester, getBangkokCurrentTime, getISOTimestamp, getCurrentUserId } from '../utils/helpers.js';
import { saveToDB, syncDataFromServer } from '../services/api.js';
import { saveCheckinDraft, clearCheckinDraft } from './checkin.js';

// --- 1. Club Master Management ---
export function renderClubList() {
    document.getElementById('tbody-club-list').innerHTML = AppState.allClubs.filter(c => c.deleted_flg !== 'Y').map(c => {
        const primaryTeacher = AppState.allTeachers.find(t => t.id === c.primaryTeacherId && t.deleted_flg !== 'Y');
        const pTeacherName = primaryTeacher ? `${primaryTeacher.title || ''}${primaryTeacher.firstName} ${primaryTeacher.lastName}` : '-';
        
        const enrolledCount = AppState.allClubEnrollments.filter(e => e.clubId === c.id && e.year == c.year && e.semester == c.semester && e.deleted_flg !== 'Y').length;
        
        return `<tr>
            <td class="hidden md:table-cell px-4 py-2 text-sm whitespace-nowrap">${c.year}/${c.semester}</td>
            <td class="px-4 py-2">
                <div class="text-sm font-bold text-green-800 whitespace-nowrap">${c.name}</div>
                <div class="md:hidden mt-1 text-xs text-gray-500 flex flex-col gap-1">
                    <div>ปี ${c.year}/${c.semester} | ครู: ${pTeacherName}</div>
                    <div>ความจุ: ${enrolledCount} / ${c.capacity} คน</div>
                </div>
            </td>
            <td class="hidden md:table-cell px-4 py-2 text-sm whitespace-nowrap">${pTeacherName}</td>
            <td class="hidden md:table-cell px-4 py-2 text-center text-sm whitespace-nowrap">${enrolledCount} / ${c.capacity}</td>
            <td class="px-4 py-2 text-center text-sm whitespace-nowrap">
                <span class="px-2 py-0.5 rounded text-xs font-bold ${c.status === 'เปิด' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">${c.status}</span>
            </td>
            <td class="px-4 py-2 text-center text-sm whitespace-nowrap">
                <button onclick="editClub('${c.id}')" class="text-blue-500 hover:text-blue-700 mr-3"><i class="fas fa-edit"></i></button>
                <button onclick="deleteClub('${c.id}')" class="text-red-500 hover:text-red-700"><i class="fas fa-trash"></i></button>
            </td>
        </tr>`;
    }).join('');
}

export function openClubFormModal() {
    const schoolDefaults = getDefaultAcademicYearAndSemester();
    document.getElementById('club-id').value = '';
    document.getElementById('club-year').value = schoolDefaults.year;
    document.getElementById('club-semester').value = schoolDefaults.semester;
    document.getElementById('club-name').value = '';
    document.getElementById('club-credit').value = '1.0';
    document.getElementById('club-capacity').value = '40';
    document.getElementById('club-desc').value = '';
    document.getElementById('club-status').value = 'เปิด';
    
    const activeTeachers = AppState.allTeachers.filter(t => t.deleted_flg !== 'Y');
    const primarySelect = document.getElementById('club-primary-teacher');
    primarySelect.innerHTML = activeTeachers.map(t => `<option value="${t.id}">${t.title || ''}${t.firstName} ${t.lastName}</option>`).join('');
    
    if (AppState.currentUser && AppState.currentUser.role === 'teacher') {
        primarySelect.value = AppState.currentUser.data.id;
    }

    document.getElementById('club-co-teachers-container').innerHTML = activeTeachers.map(t => `
        <label class="checkbox-container">
            ${t.title || ''}${t.firstName} ${t.lastName}
            <input type="checkbox" value="${t.id}" class="club-co-cb">
            <span class="checkmark"></span>
        </label>
    `).join('');

    document.getElementById('club-modal-title').innerText = 'สร้างชุมนุมใหม่';
    document.getElementById('club-form-modal').classList.add('show');
}

export function editClub(id) {
    const c = AppState.allClubs.find(x => x.id === id && x.deleted_flg !== 'Y');
    if(!c) return;
    document.getElementById('club-id').value = c.id;
    document.getElementById('club-year').value = c.year;
    document.getElementById('club-semester').value = c.semester;
    document.getElementById('club-name').value = c.name;
    document.getElementById('club-credit').value = c.credit || '1.0';
    document.getElementById('club-capacity').value = c.capacity || '40';
    document.getElementById('club-desc').value = c.desc || '';
    document.getElementById('club-status').value = c.status || 'เปิด';

    const activeTeachers = AppState.allTeachers.filter(t => t.deleted_flg !== 'Y');
    const primarySelect = document.getElementById('club-primary-teacher');
    primarySelect.innerHTML = activeTeachers.map(t => `<option value="${t.id}">${t.title || ''}${t.firstName} ${t.lastName}</option>`).join('');
    primarySelect.value = c.primaryTeacherId;

    const coTeachers = c.coAdvisorIds || [];
    document.getElementById('club-co-teachers-container').innerHTML = activeTeachers.map(t => `
        <label class="checkbox-container">
            ${t.title || ''}${t.firstName} ${t.lastName}
            <input type="checkbox" value="${t.id}" class="club-co-cb" ${coTeachers.includes(t.id) ? 'checked' : ''}>
            <span class="checkmark"></span>
        </label>
    `).join('');

    document.getElementById('club-modal-title').innerText = 'แก้ไขข้อมูลชุมนุม';
    document.getElementById('club-form-modal').classList.add('show');
}

export async function saveClub() {
    const id = document.getElementById('club-id').value || generateId();
    const year = parseInt(document.getElementById('club-year').value);
    const semester = parseInt(document.getElementById('club-semester').value);
    const name = document.getElementById('club-name').value.trim();
    const primaryTeacherId = document.getElementById('club-primary-teacher').value;
    const credit = parseFloat(document.getElementById('club-credit').value);
    const capacity = parseInt(document.getElementById('club-capacity').value);
    const desc = document.getElementById('club-desc').value.trim();
    const status = document.getElementById('club-status').value;
    
    const coAdvisorIds = Array.from(document.querySelectorAll('.club-co-cb:checked')).map(cb => cb.value);

    if(!name || isNaN(year) || isNaN(capacity)) {
        return customAlert('กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน (*)');
    }

    let clubObj;
    const idx = AppState.allClubs.findIndex(x => x.id === id);

    const commonData = {
        year, semester, name, primaryTeacherId, coAdvisorIds, credit, capacity, desc, status,
        updatedAt: getISOTimestamp(),
        updatedBy: getCurrentUserId(),
    };

    if (idx > -1) { // Update
        clubObj = { ...AppState.allClubs[idx], ...commonData };
        AppState.allClubs[idx] = clubObj;
    } else { // Create
        clubObj = {
            id, ...commonData,
            createdAt: getISOTimestamp(), createdBy: getCurrentUserId(),
            deleted_flg: 'N', deletedAt: null, deletedBy: null,
        };
        AppState.allClubs.push(clubObj);
    }

    const success = await saveToDB(DB_KEYS.CLUBS, AppState.allClubs, 'saveClubs');
    closeModal('club-form-modal');
    renderClubList();
    onEnrollFilterChange(); // Update dropdowns in other tabs
    if (success !== false) showToast('บันทึกข้อมูลชุมนุมเรียบร้อย');
}

export function deleteClub(id) {
    customConfirm('ยืนยันการลบชุมนุม', 'ข้อมูลชุมนุม, ประวัติเข้าเรียน และการลงทะเบียนในชุมนุมนี้จะถูกซ่อน ยืนยันหรือไม่?', async () => {
        const now = getISOTimestamp();
        const userId = getCurrentUserId();

        const clubIdx = AppState.allClubs.findIndex(x => x.id === id);
        if (clubIdx > -1) {
            AppState.allClubs[clubIdx].deleted_flg = 'Y';
            AppState.allClubs[clubIdx].deletedAt = now;
            AppState.allClubs[clubIdx].deletedBy = userId;
        }

        AppState.allClubEnrollments.forEach((item, i) => { if (item.clubId === id) { AppState.allClubEnrollments[i].deleted_flg = 'Y'; AppState.allClubEnrollments[i].deletedAt = now; AppState.allClubEnrollments[i].deletedBy = userId; } });
        AppState.allClubRecords.forEach((item, i) => { if (item.clubId === id) { AppState.allClubRecords[i].deleted_flg = 'Y'; AppState.allClubRecords[i].deletedAt = now; AppState.allClubRecords[i].deletedBy = userId; } });
        
        await saveToDB(DB_KEYS.CLUBS, AppState.allClubs, 'saveClubs');
        await saveToDB(DB_KEYS.CLUB_ENROLLMENTS, AppState.allClubEnrollments, 'saveClubEnrollments');
        await saveToDB(DB_KEYS.CLUB_RECORDS, AppState.allClubRecords, 'saveClubRecords');
        
        renderClubList();
        showToast('ลบชุมนุมเรียบร้อยแล้ว');
    });
}

// --- 2. Club Enrollments ---
export async function onEnrollFilterChange() {
    const yr = document.getElementById('enroll-year').value;
    const sem = document.getElementById('enroll-semester').value;
    
    const assignSelect = document.getElementById('enroll-assign-club');
    const filteredClubs = AppState.allClubs.filter(c => c.year == yr && c.semester == sem && c.status === 'เปิด' && c.deleted_flg !== 'Y');
    
    assignSelect.innerHTML = `<option value="">-- ปล่อยว่าง (ไม่ระบุชุมนุม) --</option>` + 
        filteredClubs.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

    const classDropdown = document.getElementById('enroll-filter-class');
    const filteredClasses = AppState.allClasses.filter(c => c.year == yr && c.semester == sem && c.deleted_flg !== 'Y');
    filteredClasses.sort((a, b) => a.className.localeCompare(b.className, 'th', { numeric: true }));
    classDropdown.innerHTML = `<option value="">ทุกชั้นเรียน</option>` + 
        filteredClasses.map(c => `<option value="${c.className}">${c.className}</option>`).join('');

    await renderEnrollStudents();
}

export async function renderEnrollStudents() {
    const yr = document.getElementById('enroll-year').value;
    const sem = document.getElementById('enroll-semester').value;
    const classFilter = document.getElementById('enroll-filter-class').value;
    const statusFilter = document.getElementById('enroll-filter-status').value;
    const search = document.getElementById('enroll-search').value.toLowerCase().trim();

    if (classFilter && typeof window.ensureStudentsLoadedForClass === 'function') {
        await window.ensureStudentsLoadedForClass(classFilter);
    }

    let filteredStudents = AppState.allStudents.filter(s => s.status !== 'ลาออก' && s.deleted_flg !== 'Y');
    if(classFilter) filteredStudents = filteredStudents.filter(s => s.class === classFilter);

    if(search) {
        filteredStudents = filteredStudents.filter(s => {
            const fullName = getStudentFullName(s).toLowerCase();
            return (s.studentId || '').toString().includes(search) || fullName.includes(search);
        });
    }

    const mappedStudents = filteredStudents.map(s => {
        const enrollment = AppState.allClubEnrollments.find(e => e.studentId === s.id && e.year == yr && e.semester == sem && e.deleted_flg !== 'Y');
        const club = enrollment ? AppState.allClubs.find(c => c.id === enrollment.clubId && c.deleted_flg !== 'Y') : null;
        return { student: s, club: club, enrollment: enrollment };
    });

    let finalStudents = mappedStudents;
    if (statusFilter === 'noclub') finalStudents = mappedStudents.filter(m => !m.club);
    else if (statusFilter === 'hasclub') finalStudents = mappedStudents.filter(m => m.club);

    finalStudents.sort((a,b) => a.student.class.localeCompare(b.student.class, 'th', { numeric: true }) || a.student.number - b.student.number);

    document.getElementById('tbody-enroll-students').innerHTML = finalStudents.map(m => {
        const s = m.student;
        const clubStatusText = m.club ? 
            `<span class="bg-green-100 text-green-800 text-xs px-2.5 py-1 rounded-full font-bold whitespace-nowrap"><i class="fas fa-check-circle mr-1"></i> ${m.club.name}</span>` : 
            `<span class="bg-yellow-100 text-yellow-800 text-xs px-2.5 py-1 rounded-full font-bold whitespace-nowrap"><i class="fas fa-exclamation-triangle mr-1"></i> ไม่มีชุมนุม</span>`;

        const checkboxHtml = m.club ? '' : `<input type="checkbox" value="${s.id}" class="enroll-select-cb">`;
        const actionsHtml = m.club ? `
            <div class="flex justify-center gap-2">
                <button onclick="openTransferClubModal('${s.id}', '${m.club.id}', '${m.club.name.replace(/'/g, "\\'")}', '${getStudentFullName(s).replace(/'/g, "\\'")}')" class="text-blue-600 hover:text-blue-800 text-xs font-bold" title="ย้ายชุมนุม"><i class="fas fa-exchange-alt mr-1"></i>ย้าย</button>
                <button onclick="removeFromClub('${s.id}', '${m.club.name.replace(/'/g, "\\'")}')" class="text-red-600 hover:text-red-800 text-xs font-bold" title="ออกจากชุมนุม"><i class="fas fa-user-minus mr-1"></i>ออก</button>
            </div>
        ` : `<span class="text-gray-400 text-xs">-</span>`;

        return `<tr>
            <td class="px-4 py-2 text-center whitespace-nowrap">${checkboxHtml}</td>
            <td class="hidden md:table-cell px-4 py-2 text-sm whitespace-nowrap">${s.class} เลขที่ ${s.number}</td>
            <td class="hidden md:table-cell px-4 py-2 text-sm font-mono whitespace-nowrap">${s.studentId}</td>
            <td class="px-4 py-2">
                <div class="text-sm font-bold text-gray-800 whitespace-nowrap">${getStudentFullName(s)}</div>
                <div class="md:hidden mt-1 text-xs text-gray-500">${s.class} เลขที่ ${s.number} | รหัส: ${s.studentId}</div>
            </td>
            <td class="px-4 py-2 text-sm whitespace-nowrap">${clubStatusText}</td>
            <td class="px-4 py-2 text-center whitespace-nowrap" data-label="จัดการ">${actionsHtml}</td>
        </tr>`;
    }).join('');

    document.getElementById('enroll-select-all').checked = false;
}

export function toggleAllEnrollCheckboxes(master) {
    document.querySelectorAll('.enroll-select-cb').forEach(cb => cb.checked = master.checked);
}

export async function bulkAssignClub() {
    const yr = parseInt(document.getElementById('enroll-year').value);
    const sem = parseInt(document.getElementById('enroll-semester').value);
    const clubId = document.getElementById('enroll-assign-club').value;
    
    const now = getISOTimestamp();
    const userId = getCurrentUserId();

    const selectedStudentIds = Array.from(document.querySelectorAll('.enroll-select-cb:checked')).map(cb => cb.value);

    if(selectedStudentIds.length === 0) return customAlert('กรุณาเลือกนักเรียนอย่างน้อย 1 คน');

    let targetClub = null;
    let clubName = 'ปล่อยว่าง (ไม่ระบุชุมนุม)';
    if(clubId) {
        targetClub = AppState.allClubs.find(c => c.id === clubId && c.deleted_flg !== 'Y');
        if (!targetClub) return customAlert('ไม่พบข้อมูลชุมนุมที่เลือก');
        clubName = targetClub.name;

        const currentEnrolled = AppState.allClubEnrollments.filter(e => e.clubId === clubId && e.year == yr && e.semester == sem && e.deleted_flg !== 'Y').length;
        if(currentEnrolled + selectedStudentIds.length > targetClub.capacity) {
            return customAlert(`ไม่สามารถลงทะเบียนได้เนื่องจากเกินความจุห้องชุมนุม (ความจุคงเหลือ: ${targetClub.capacity - currentEnrolled} คน)`);
        }
    }

    const selectedStudents = AppState.allStudents.filter(s => selectedStudentIds.includes(s.id));
    const studentNamesHtml = selectedStudents.map(s => `<li>- ${s.class} เลขที่ ${s.number} ${getStudentFullName(s)} (รหัส: ${s.studentId})</li>`).join('');

    const confirmContent = `
        <div class="text-left bg-blue-50 p-3 rounded border border-blue-200 mb-3 shadow-sm text-sm">
            <p class="font-bold text-blue-900 mb-1">ชุมนุมปลายทาง: <span class="text-blue-700">${clubName}</span></p>
            <p class="text-xs text-gray-600">ปีการศึกษา/ภาคเรียน: ${yr}/${sem}</p>
        </div>
        <div class="text-left text-sm max-h-40 overflow-y-auto border p-2 rounded bg-white">
            <p class="font-bold text-gray-800 mb-2">รายชื่อนักเรียนที่เลือก (${selectedStudents.length} คน):</p>
            <ul class="space-y-1 text-gray-700 font-medium">
                ${studentNamesHtml}
            </ul>
        </div>
        <p class="mt-4 text-gray-800 font-bold">ยืนยันการลงทะเบียนจับคู่นี้หรือไม่?</p>
    `;

    customConfirm('ยืนยันการลงทะเบียนชุมนุมกลุ่ม', confirmContent, async () => {
        selectedStudentIds.forEach(stuId => {
            // Soft-delete any existing enrollment for this student in this semester
            const existingEnrollmentIdx = AppState.allClubEnrollments.findIndex(e => e.studentId === stuId && e.year == yr && e.semester == sem && e.deleted_flg !== 'Y');
            if (existingEnrollmentIdx > -1) {
                AppState.allClubEnrollments[existingEnrollmentIdx].deleted_flg = 'Y';
                AppState.allClubEnrollments[existingEnrollmentIdx].deletedAt = now;
                AppState.allClubEnrollments[existingEnrollmentIdx].deletedBy = userId;
            }

            // Add new one if a club is selected
            if(clubId) {
                AppState.allClubEnrollments.push({ 
                    id: generateId(), studentId: stuId, clubId: clubId, year: yr, semester: sem,
                    createdAt: now, createdBy: userId, updatedAt: now, updatedBy: userId,
                    deleted_flg: 'N', deletedAt: null, deletedBy: null,
                });
            }
        });

        await saveToDB(DB_KEYS.CLUB_ENROLLMENTS, AppState.allClubEnrollments, 'saveClubEnrollments');
        showToast('ปรับปรุงข้อมูลการลงทะเบียนชุมนุมเรียบร้อยแล้ว');
        renderEnrollStudents();
    });
}

export async function removeFromClub(studentId, clubName) {
    const yr = parseInt(document.getElementById('enroll-year').value);
    const sem = parseInt(document.getElementById('enroll-semester').value);

    customConfirm(
        'ยืนยันการนำนักเรียนออกจากชุมนุม', 
        `คุณต้องการนำนักเรียนออกจากชุมนุม <b>${clubName}</b> ในภาคเรียนที่ ${yr}/${sem} ใช่หรือไม่?`, 
        async () => {
            const now = getISOTimestamp();
            const userId = getCurrentUserId();

            const existingEnrollmentIdx = AppState.allClubEnrollments.findIndex(
                e => e.studentId === studentId && e.year == yr && e.semester == sem && e.deleted_flg !== 'Y'
            );

            if (existingEnrollmentIdx > -1) {
                AppState.allClubEnrollments[existingEnrollmentIdx].deleted_flg = 'Y';
                AppState.allClubEnrollments[existingEnrollmentIdx].deletedAt = now;
                AppState.allClubEnrollments[existingEnrollmentIdx].deletedBy = userId;

                await saveToDB(DB_KEYS.CLUB_ENROLLMENTS, AppState.allClubEnrollments, 'saveClubEnrollments');
                showToast('นำนักเรียนออกจากชุมนุมเรียบร้อยแล้ว');
                renderEnrollStudents();
            } else {
                customAlert('ไม่พบข้อมูลการลงทะเบียนชุมนุมของนักเรียนคนนี้');
            }
        }
    );
}

export function openTransferClubModal(studentId, currentClubId, currentClubName, studentName) {
    const yr = document.getElementById('enroll-year').value;
    const sem = document.getElementById('enroll-semester').value;

    document.getElementById('transfer-student-id').value = studentId;
    document.getElementById('transfer-student-name').innerText = studentName;
    document.getElementById('transfer-current-club').innerText = currentClubName;

    const selectEl = document.getElementById('transfer-target-club');
    const filteredClubs = AppState.allClubs.filter(
        c => c.year == yr && c.semester == sem && c.status === 'เปิด' && c.deleted_flg !== 'Y' && c.id !== currentClubId
    );

    if (filteredClubs.length === 0) {
        selectEl.innerHTML = '<option value="">-- ไม่มีชุมนุมอื่นที่เปิดรับสมัคร --</option>';
    } else {
        selectEl.innerHTML = filteredClubs.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    }

    document.getElementById('transfer-club-modal').classList.add('show');
}

export async function submitTransferClub() {
    const studentId = document.getElementById('transfer-student-id').value;
    const targetClubId = document.getElementById('transfer-target-club').value;
    const yr = parseInt(document.getElementById('enroll-year').value);
    const sem = parseInt(document.getElementById('enroll-semester').value);

    if (!targetClubId) {
        return customAlert('กรุณาเลือกชุมนุมปลายทาง');
    }

    const targetClub = AppState.allClubs.find(c => c.id === targetClubId && c.deleted_flg !== 'Y');
    if (!targetClub) {
        return customAlert('ไม่พบข้อมูลชุมนุมปลายทาง');
    }

    const enrolledCount = AppState.allClubEnrollments.filter(
        e => e.clubId === targetClubId && e.year == yr && e.semester == sem && e.deleted_flg !== 'Y'
    ).length;

    if (enrolledCount >= targetClub.capacity) {
        return customAlert(`ชุมนุมปลายทางเต็มแล้ว (ความจุ: ${targetClub.capacity} คน)`);
    }

    const now = getISOTimestamp();
    const userId = getCurrentUserId();

    const existingEnrollmentIdx = AppState.allClubEnrollments.findIndex(
        e => e.studentId === studentId && e.year == yr && e.semester == sem && e.deleted_flg !== 'Y'
    );

    if (existingEnrollmentIdx > -1) {
        AppState.allClubEnrollments[existingEnrollmentIdx].deleted_flg = 'Y';
        AppState.allClubEnrollments[existingEnrollmentIdx].deletedAt = now;
        AppState.allClubEnrollments[existingEnrollmentIdx].deletedBy = userId;
    }

    AppState.allClubEnrollments.push({
        id: generateId(), studentId: studentId, clubId: targetClubId, year: yr, semester: sem,
        createdAt: now, createdBy: userId, updatedAt: now, updatedBy: userId,
        deleted_flg: 'N', deletedAt: null, deletedBy: null,
    });

    await saveToDB(DB_KEYS.CLUB_ENROLLMENTS, AppState.allClubEnrollments, 'saveClubEnrollments');
    closeModal('transfer-club-modal');
    showToast('ย้ายชุมนุมนักเรียนเรียบร้อยแล้ว');
    renderEnrollStudents();
}

// --- 3. Club Attendance ---
export function updateClubDropdown(yearVal, semVal, targetId, defaultText) {
    const el = document.getElementById(targetId);
    if (!el) return;
    
    let filtered = AppState.allClubs.filter(c => c.year == yearVal && c.semester == semVal && c.deleted_flg !== 'Y');
    
    if(AppState.currentUser && AppState.currentUser.role === 'teacher') {
        filtered = filtered.filter(c => (c.primaryTeacherId === AppState.currentUser.data.id || (c.coAdvisorIds && c.coAdvisorIds.includes(AppState.currentUser.data.id))) && c.deleted_flg !== 'Y');
    }

    const clubOptions = filtered.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    el.innerHTML = `<option value="">${defaultText}</option>${clubOptions}`;
}

export function onClubCheckinYearSemesterChange() {
    const yr = document.getElementById('club-checkin-year').value;
    const sem = document.getElementById('club-checkin-semester').value;
    updateClubDropdown(yr, sem, 'club-checkin-id', '-- เลือกชุมนุม --');
}

export function resetClubCheckinTable() {
    document.getElementById('club-student-list-container').classList.add('hidden');
    document.getElementById('club-save-btn-container').classList.add('hidden');
    document.getElementById('club-bulk-actions').classList.add('hidden');
    document.getElementById('club-checkin-table-body').innerHTML = '';
}

export async function loadClubCheckinList() {
    const date = document.getElementById('club-checkin-date').value;
    const yr = document.getElementById('club-checkin-year').value;
    const sem = document.getElementById('club-checkin-semester').value;
    const clubId = document.getElementById('club-checkin-id').value;

    if(!date || !yr || !sem || !clubId) {
        document.getElementById('club-checkin-alert').classList.remove('hidden');
        return;
    }
    document.getElementById('club-checkin-alert').classList.add('hidden');

    await syncDataFromServer();

    const enrollments = AppState.allClubEnrollments.filter(e => e.clubId === clubId && e.year == yr && e.semester == sem && e.deleted_flg !== 'Y');
    const enrolledStudentIds = enrollments.map(e => e.studentId);
    
    if (enrolledStudentIds.length > 0 && typeof window.ensureStudentsLoadedByIds === 'function') {
        await window.ensureStudentsLoadedByIds(enrolledStudentIds);
    }
    
    AppState.currentCheckinStudents = AppState.allStudents.filter(s => enrolledStudentIds.map(String).includes(String(s.id)) && s.status !== 'ลาออก' && s.deleted_flg !== 'Y');
    AppState.currentCheckinStudents.sort((a, b) => {
        const classCompare = a.class.localeCompare(b.class, 'th', { numeric: true });
        if (classCompare !== 0) return classCompare;
        const numA = parseInt(a.number) || 9999;
        const numB = parseInt(b.number) || 9999;
        if (numA !== numB) return numA - numB;
        return (a.studentId || '').toString().localeCompare((b.studentId || '').toString());
    });

    if(AppState.currentCheckinStudents.length === 0) {
        document.getElementById('club-no-students-alert').classList.remove('hidden');
        document.getElementById('club-student-list-container').classList.add('hidden');
        return;
    }
    document.getElementById('club-no-students-alert').classList.add('hidden');

    const existRec = AppState.allClubRecords.find(r => getBangkokDate(r.date) === date && r.clubId === clubId && matchRecordYearSemester(r, yr, sem) && r.deleted_flg !== 'Y');
    
    AppState.activeCheckinStates = {};
    AppState.lastCheckedClubStuId = null;
    
    const isResumingDraft = AppState.draftCheckinAttendance !== undefined && AppState.draftCheckinAttendance !== null;
    
    AppState.currentCheckinStudents.forEach(stu => {
        let status = '';
        if (isResumingDraft) {
            status = AppState.draftCheckinAttendance[stu.id] || '';
        } else if(existRec) {
            const r = existRec.attendance.find(a => a.studentId === stu.id);
            if(r) status = r.status;
        }
        AppState.activeCheckinStates[stu.id] = status;
    });

    if (isResumingDraft) {
        AppState.checkinUnsavedChanges = true;
        delete AppState.draftCheckinAttendance;
    }

    if(document.getElementById('club-checkin-search')) document.getElementById('club-checkin-search').value = '';
    if(document.getElementById('club-checkin-hide-checked')) document.getElementById('club-checkin-hide-checked').checked = false;

    document.getElementById('club-student-list-container').classList.remove('hidden');
    document.getElementById('club-save-btn-container').classList.remove('hidden');
    document.getElementById('club-bulk-actions').classList.remove('hidden');
    document.getElementById('club-bulk-actions').classList.add('flex');

    AppState.checkinUnsavedChanges = false;
    renderClubCheckinTable();
}

export function renderClubCheckinTable() {
    const search = document.getElementById('club-checkin-search').value.toLowerCase().trim();
    let filtered = [...AppState.currentCheckinStudents];

    if(search) {
        filtered = filtered.filter(s => {
            const fullName = getStudentFullName(s).toLowerCase();
            return s.studentId.toString().toLowerCase().includes(search) || fullName.includes(search) || s.class.toLowerCase().includes(search) || s.number.toString().includes(search);
        });
    }

    const hideChecked = document.getElementById('club-checkin-hide-checked') ? document.getElementById('club-checkin-hide-checked').checked : false;
    if (hideChecked) {
        filtered = filtered.filter(s => !AppState.activeCheckinStates[s.id] || s.id === AppState.lastCheckedClubStuId);
    }

    const allChecked = filtered.every(s => AppState.activeCheckinStates[s.id]);

    // จัดเรียง: ล่าสุดอยู่บนสุด -> ยังไม่เช็คอยู่กลาง -> เช็คแล้วไปล่างสุด (จนกว่าจะครบ)
    filtered.sort((a, b) => {
        if (!allChecked) {
            const getWeight = (stu) => {
                if (stu.id === AppState.lastCheckedClubStuId) return 0; // ล่าสุดอยู่บนสุด
                if (AppState.activeCheckinStates[stu.id]) return 2; // เช็คแล้วไปล่างสุด
                return 1; // ยังไม่เช็คอยู่ตรงกลาง
            };
            const weightA = getWeight(a);
            const weightB = getWeight(b);
            if (weightA !== weightB) return weightA - weightB;
        }

        const classCompare = a.class.localeCompare(b.class, 'th', { numeric: true });
        if (classCompare !== 0) return classCompare;
        const numA = parseInt(a.number) || 9999;
        const numB = parseInt(b.number) || 9999;
        if (numA !== numB) return numA - numB;
        return (a.studentId || '').toString().localeCompare((b.studentId || '').toString());
    });

    const tbody = document.getElementById('club-checkin-table-body');
    tbody.innerHTML = '';

    filtered.forEach(stu => {
        const status = AppState.activeCheckinStates[stu.id] || '';
        const radioHtml = ['มา','สาย','ลา','ขาด'].map(st => `
            <input type="radio" id="ca_${stu.id}_${st}" name="ca_${stu.id}" value="${st}" ${status===st?'checked':''} onchange="onClubAttendanceChange('${stu.id}', '${st}')">
            <label for="ca_${stu.id}_${st}">${st}</label>
        `).join('');

        const fullName = getStudentFullName(stu);

        tbody.innerHTML += `<tr class="hover:bg-gray-50 transition-colors">
            <td class="px-6 py-4 text-sm font-semibold text-gray-500 hidden md:table-cell" data-label="ชั้น/เลขที่">${stu.class} เลขที่ ${stu.number}</td>
            <td class="px-6 py-4 text-sm font-mono text-gray-600 hidden md:table-cell" data-label="รหัสประจำตัว">${stu.studentId}</td>
            <td class="px-6 py-4 td-name" data-label="ชื่อ - นามสกุล">
                <div class="td-name-content">${fullName}</div>
                <div class="td-meta-content md:hidden">${stu.class} เลขที่ ${stu.number} | รหัส: ${stu.studentId}</div>
            </td>
            <td class="px-6 py-4 text-center td-actions whitespace-nowrap" data-label="สถานะ">
                <div class="attendance-radio">${radioHtml}</div>
            </td>
        </tr>`;
    });
}

export function onClubAttendanceChange(stuId, status) {
    AppState.activeCheckinStates[stuId] = status;
    AppState.lastCheckedClubStuId = stuId;
    AppState.checkinUnsavedChanges = true;
    saveCheckinDraft();
    renderClubCheckinTable();
}

export function setAllClubAttendance(st) {
    AppState.currentCheckinStudents.forEach(stu => {
        AppState.activeCheckinStates[stu.id] = st;
    });
    AppState.lastCheckedClubStuId = null;
    AppState.checkinUnsavedChanges = true;
    saveCheckinDraft();
    renderClubCheckinTable();
}

export async function saveClubAttendance() {
    const date = document.getElementById('club-checkin-date').value;
    const yr = parseInt(document.getElementById('club-checkin-year').value);
    const sem = parseInt(document.getElementById('club-checkin-semester').value);
    const clubId = document.getElementById('club-checkin-id').value;

    if(!AppState.currentCheckinStudents || AppState.currentCheckinStudents.length === 0) return;

    let actualStats = { 'มา': 0, 'สาย': 0, 'ลา': 0, 'ขาด': 0, 'ยังไม่เช็ค': 0 };
    AppState.currentCheckinStudents.forEach(stu => {
        const st = AppState.activeCheckinStates[stu.id];
        if (!st) actualStats['ยังไม่เช็ค']++;
        else actualStats[st]++;
    });

    const club = AppState.allClubs.find(c => c.id === clubId && c.deleted_flg !== 'Y');
    const clubName = club ? club.name : 'ไม่พบข้อมูลชุมนุม';

    const summaryHtml = `
        <div class="text-left bg-green-50 p-3 rounded border border-green-200 mt-2 mb-3 shadow-sm">
            <p class="mb-1"><b>วันที่:</b> ${getBangkokDate(date)}</p>
            <p class="mb-1"><b>วิชาชุมนุม:</b> ${clubName}</p>
            <p><b>ปีการศึกษา/ภาคเรียน:</b> ${yr}/${sem}</p>
        </div>
        <div class="text-left">
            <p class="font-bold text-gray-800 mb-2">สรุปจำนวนผู้เข้าร่วม (รวม ${AppState.currentCheckinStudents.length} คน)</p>
            <div class="grid grid-cols-2 gap-2 text-sm text-center">
                <div class="bg-green-100 text-green-800 px-2 py-1.5 rounded font-medium border border-green-200">มา: <span class="font-bold text-lg">${actualStats['มา']}</span></div>
                <div class="bg-yellow-100 text-yellow-800 px-2 py-1.5 rounded font-medium border border-yellow-200">สาย: <span class="font-bold text-lg">${actualStats['สาย']}</span></div>
                <div class="bg-blue-100 text-blue-800 px-2 py-1.5 rounded font-medium border border-blue-200">ลา: <span class="font-bold text-lg">${actualStats['ลา']}</span></div>
                <div class="bg-red-100 text-red-800 px-2 py-1.5 rounded font-medium border border-red-200">ขาด: <span class="font-bold text-lg">${actualStats['ขาด']}</span></div>
            </div>
            <div class="bg-gray-100 text-gray-500 px-2 py-1.5 rounded mt-2 text-xs text-center border border-gray-200">
                ยังไม่ได้เช็คชื่อ (ระบบจะบันทึกเป็นขาดอัตโนมัติ): <span class="font-bold text-sm text-gray-700">${actualStats['ยังไม่เช็ค']}</span>
            </div>
        </div>
        <p class="mt-5 text-gray-700 font-bold">ยืนยันการบันทึกข้อมูลใช่หรือไม่?</p>
    `;

    customConfirm('ตรวจสอบและยืนยันข้อมูล', summaryHtml, async () => {
        const now = getISOTimestamp();
        const userId = getCurrentUserId();

        const att = AppState.currentCheckinStudents.map(stu => ({
            studentId: stu.id,
            status: AppState.activeCheckinStates[stu.id] || 'ขาด'
        }));

        const existRecIdx = AppState.allClubRecords.findIndex(r => getBangkokDate(r.date) === date && r.clubId === clubId && matchRecordYearSemester(r, yr, sem) && r.deleted_flg !== 'Y');

        let record;
        if (existRecIdx > -1) { // Update existing record
            record = {
                ...AppState.allClubRecords[existRecIdx], attendance: att, updatedAt: now, updatedBy: userId,
            };
            AppState.allClubRecords[existRecIdx] = record;
        } else { // Create new record
            const localTimestampStr = date + 'T' + getBangkokCurrentTime();
            const utcDate = new Date(localTimestampStr + "+07:00").toISOString();
            record = {
                id: generateId(), date: utcDate, clubId, year: yr, semester: sem, attendance: att,
                createdAt: now, createdBy: userId, updatedAt: now, updatedBy: userId, deleted_flg: 'N', deletedAt: null, deletedBy: null,
            };
            AppState.allClubRecords.push(record);
        }

        await saveToDB(DB_KEYS.CLUB_RECORDS, AppState.allClubRecords, 'saveClubRecords');
        showToast('บันทึกการเข้ากิจกรรมชุมนุมเสร็จสิ้น');
        AppState.checkinUnsavedChanges = false;
        clearCheckinDraft();
    });
}

export function exportClubCheckinCSV() {
    const date = document.getElementById('club-checkin-date').value;
    const yr = document.getElementById('club-checkin-year').value;
    const sem = document.getElementById('club-checkin-semester').value;
    const clubId = document.getElementById('club-checkin-id').value;
    const club = AppState.allClubs.find(c => c.id === clubId && c.deleted_flg !== 'Y');

    if(!AppState.currentCheckinStudents || AppState.currentCheckinStudents.length === 0) return;

    const headers = ['ระดับชั้น', 'เลขที่', 'รหัสประจำตัว', 'ชื่อ-นามสกุล', 'สถานะการเข้าชุมนุม', 'วันที่ทำกิจกรรม', 'ชุมนุม', 'ปีการศึกษา', 'ภาคเรียน'];
    const rows = AppState.currentCheckinStudents.map(stu => {
        const status = AppState.activeCheckinStates[stu.id] || 'ยังไม่ได้เช็ค';
        return [stu.class, stu.number, stu.studentId, getStudentFullName(stu), status, date, club ? club.name : '', yr, sem];
    });

    exportToCSV(`รายงานเช็คชุมนุม_${club ? club.name : ''}_${date}.csv`, headers, rows);
    showToast('ส่งออกไฟล์ CSV ชุมนุมเรียบร้อย');
}

// --- 4. Student Club Dashboard ---
export function renderStudentClubDashboard() {
    const container = document.getElementById('my-club-info-container');
    const schoolDefaults = getDefaultAcademicYearAndSemester();
    
    const enrollment = AppState.allClubEnrollments.find(e => e.studentId === AppState.currentUser.data.id && e.year == schoolDefaults.year && e.semester == schoolDefaults.semester && e.deleted_flg !== 'Y');
    
    if (!enrollment) {
        container.innerHTML = `
            <div class="text-center py-8">
                <i class="fas fa-users-slash text-5xl text-gray-300 mb-3"></i>
                <p class="font-bold text-gray-500">คุณยังไม่ได้ลงทะเบียนในวิชาชุมนุมใดๆ ในภาคเรียนปัจจุบัน</p>
                <p class="text-xs text-gray-400 mt-1">กรุณาติดต่อครูที่ปรึกษาหรือผู้ดูแลระบบเพื่อทำการลงทะเบียน</p>
            </div>
        `;
        document.getElementById('my-club-percent').innerText = '0%';
        document.getElementById('my-club-present').innerText = '0';
        document.getElementById('my-club-absent').innerText = '0';
        return;
    }

    const club = AppState.allClubs.find(c => c.id === enrollment.clubId && c.deleted_flg !== 'Y');
    if(!club) return;

    const primaryTeacher = AppState.allTeachers.find(t => t.id === club.primaryTeacherId && t.deleted_flg !== 'Y');
    const pTeacherName = primaryTeacher ? `${primaryTeacher.title}${primaryTeacher.firstName} ${primaryTeacher.lastName}` : '-';
    const coTeachers = (club.coAdvisorIds || []).map(id => {
        const t = AppState.allTeachers.find(x => x.id === id && x.deleted_flg !== 'Y');
        return t ? `${t.title}${t.firstName} ${t.lastName}` : '';
    }).filter(Boolean).join(', ') || 'ไม่มี';

    container.innerHTML = `
        <div class="p-4 bg-green-50 rounded-lg border border-green-100">
            <p class="text-xs text-green-700 font-bold uppercase tracking-wider">ชื่อวิชาชุมนุม</p>
            <h4 class="text-xl font-bold text-green-950">${club.name}</h4>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="border p-3 rounded">
                <p class="text-xs text-gray-500 font-medium">ครูที่ปรึกษาหลัก</p>
                <p class="font-bold text-gray-800"><i class="fas fa-chalkboard-teacher text-green-600 mr-2"></i> ${pTeacherName}</p>
            </div>
            <div class="border p-3 rounded">
                <p class="text-xs text-gray-500 font-medium">ครูที่ปรึกษาร่วม</p>
                <p class="font-bold text-gray-800"><i class="fas fa-users text-blue-600 mr-2"></i> ${coTeachers}</p>
            </div>
        </div>
        <div class="border p-3 rounded">
            <p class="text-xs text-gray-500 font-medium">คำอธิบายและวัตถุประสงค์</p>
            <p class="text-sm text-gray-700 mt-1">${club.desc || 'ไม่มีคำอธิบายสำหรับชุมนุมนี้'}</p>
        </div>
        <div class="grid grid-cols-2 gap-4">
            <div class="bg-gray-50 p-3 rounded text-center"><p class="text-xs text-gray-500">ปีการศึกษา / ภาคเรียน</p><p class="font-bold text-gray-800">${club.year} / ${club.semester}</p></div>
            <div class="bg-gray-50 p-3 rounded text-center"><p class="text-xs text-gray-500">หน่วยกิต</p><p class="font-bold text-gray-800">${club.credit || '1.0'} หน่วยกิต</p></div>
        </div>
    `;

    const myRecords = AppState.allClubRecords.filter(r => r.clubId === club.id && matchRecordYearSemester(r, club.year, club.semester) && r.deleted_flg !== 'Y');
    let presentCount = 0;
    let absentCount = 0;
    
    myRecords.forEach(r => {
        const myAtt = r.attendance.find(a => a.studentId === AppState.currentUser.data.id);
        if(myAtt) {
            if (myAtt.status === 'มา' || myAtt.status === 'สาย') presentCount++;
            else if (myAtt.status === 'ขาด') absentCount++;
        }
    });

    const totalActiveSessions = presentCount + absentCount;
    const pct = totalActiveSessions === 0 ? 0 : Math.round((presentCount / totalActiveSessions) * 100);
    
    document.getElementById('my-club-percent').innerText = `${pct}%`;
    document.getElementById('my-club-present').innerText = presentCount;
    document.getElementById('my-club-absent').innerText = absentCount;
}
// บรรทัดเดิมช่วงบนของไฟล์ test/js/features/club.js

export function switchClubSubTab(tabId) {
    // 1. ซ่อนเนื้อหาเซกชันย่อยของชุมนุมทั้งหมดก่อน
    document.querySelectorAll('.club-manage-section').forEach(el => el.classList.add('hidden'));
    
    // 2. รีเซ็ตสีของปุ่มแถบย่อยทั้งหมด
    ['list', 'enroll'].forEach(id => {
        const btn = document.getElementById(`csub-${id}`);
        if (btn) {
            btn.classList.remove('border-green-600', 'text-green-700');
            btn.classList.add('border-transparent', 'text-gray-500');
        }
    });

    // 3. เปิดการแสดงผลของเซกชันย่อยที่เลือก
    const targetContent = document.getElementById(`club-manage-${tabId}`);
    if(targetContent) targetContent.classList.remove('hidden');
    
    // 4. ไฮไลต์สีปุ่มแถบย่อยที่ถูกเลือกใช้งาน
    const targetBtn = document.getElementById(`csub-${tabId}`);
    if(targetBtn) {
        targetBtn.classList.remove('border-transparent', 'text-gray-500');
        targetBtn.classList.add('border-green-600', 'text-green-700');
    }

    // 🌟 5. จุดที่แก้ไขเพิ่ม: สั่งดึงข้อมูลจากฐานข้อมูลมาวาดลงตารางทันทีตามแถบที่เลือก
    if (tabId === 'list') {
        renderClubList(); // สั่งวาดตารางรายชื่อชุมนุมทั้งหมด
    } else if (tabId === 'enroll') {
        onEnrollFilterChange(); // สั่งอัปเดตตัวกรองและรายชื่อนักเรียนในหน้าจัดสรรชุมนุม
    }
}
// ผูกฟังก์ชันเข้า Window
window.renderClubList = renderClubList;
window.openClubFormModal = openClubFormModal;
window.editClub = editClub;
window.saveClub = saveClub;
window.deleteClub = deleteClub;
window.onEnrollFilterChange = onEnrollFilterChange;
window.renderEnrollStudents = renderEnrollStudents;
window.toggleAllEnrollCheckboxes = toggleAllEnrollCheckboxes;
window.bulkAssignClub = bulkAssignClub;
window.removeFromClub = removeFromClub;
window.openTransferClubModal = openTransferClubModal;
window.submitTransferClub = submitTransferClub;
window.updateClubDropdown = updateClubDropdown;
window.onClubCheckinYearSemesterChange = onClubCheckinYearSemesterChange;
window.resetClubCheckinTable = resetClubCheckinTable;
window.loadClubCheckinList = loadClubCheckinList;
window.renderClubCheckinTable = renderClubCheckinTable;
window.onClubAttendanceChange = onClubAttendanceChange;
window.setAllClubAttendance = setAllClubAttendance;
window.saveClubAttendance = saveClubAttendance;
window.exportClubCheckinCSV = exportClubCheckinCSV;
window.renderStudentClubDashboard = renderStudentClubDashboard;
window.switchClubSubTab = switchClubSubTab;