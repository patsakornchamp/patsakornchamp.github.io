import { AppState } from '../core/state.js';
import { DB_KEYS } from '../core/config.js';
import { generateId, getStudentFullName, showToast, customAlert, customConfirm, closeModal, exportToCSV, getBangkokDate, getDefaultAcademicYearAndSemester, matchRecordYearSemester, getBangkokCurrentTime } from '../utils/helpers.js';
import { saveToDB, syncDataFromServer } from '../services/api.js';

// --- 1. Club Master Management ---
export function renderClubList() {
    document.getElementById('tbody-club-list').innerHTML = AppState.allClubs.map(c => {
        const primaryTeacher = AppState.allTeachers.find(t => t.id === c.primaryTeacherId);
        const pTeacherName = primaryTeacher ? `${primaryTeacher.title || ''}${primaryTeacher.firstName} ${primaryTeacher.lastName}` : '-';
        
        const enrolledCount = AppState.allClubEnrollments.filter(e => e.clubId === c.id && e.year == c.year && e.semester == c.semester).length;
        
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
    
    const primarySelect = document.getElementById('club-primary-teacher');
    primarySelect.innerHTML = AppState.allTeachers.map(t => `<option value="${t.id}">${t.title || ''}${t.firstName} ${t.lastName}</option>`).join('');
    
    if (AppState.currentUser && AppState.currentUser.role === 'teacher') {
        primarySelect.value = AppState.currentUser.data.id;
    }

    document.getElementById('club-co-teachers-container').innerHTML = AppState.allTeachers.map(t => `
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
    const c = AppState.allClubs.find(x => x.id === id);
    if(!c) return;
    document.getElementById('club-id').value = c.id;
    document.getElementById('club-year').value = c.year;
    document.getElementById('club-semester').value = c.semester;
    document.getElementById('club-name').value = c.name;
    document.getElementById('club-credit').value = c.credit || '1.0';
    document.getElementById('club-capacity').value = c.capacity || '40';
    document.getElementById('club-desc').value = c.desc || '';
    document.getElementById('club-status').value = c.status || 'เปิด';

    const primarySelect = document.getElementById('club-primary-teacher');
    primarySelect.innerHTML = AppState.allTeachers.map(t => `<option value="${t.id}">${t.title || ''}${t.firstName} ${t.lastName}</option>`).join('');
    primarySelect.value = c.primaryTeacherId;

    const coTeachers = c.coAdvisorIds || [];
    document.getElementById('club-co-teachers-container').innerHTML = AppState.allTeachers.map(t => `
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

    const clubObj = { id, year, semester, name, primaryTeacherId, coAdvisorIds, credit, capacity, desc, status };
    const idx = AppState.allClubs.findIndex(x => x.id === id);
    if(idx > -1) AppState.allClubs[idx] = clubObj; else AppState.allClubs.push(clubObj);

    const success = await saveToDB(DB_KEYS.CLUBS, AppState.allClubs, 'saveClubs');
    closeModal('club-form-modal');
    renderClubList();
    if (success !== false) showToast('บันทึกข้อมูลชุมนุมเรียบร้อย');
}

export function deleteClub(id) {
    customConfirm('ยืนยันการลบชุมนุม', 'ประวัติเข้าเรียนและการลงทะเบียนในชุมนุมนี้จะถูกลบทั้งหมด ยืนยันที่จะลบ?', async () => {
        AppState.allClubs = AppState.allClubs.filter(x => x.id !== id);
        AppState.allClubEnrollments = AppState.allClubEnrollments.filter(x => x.clubId !== id);
        AppState.allClubRecords = AppState.allClubRecords.filter(x => x.clubId !== id);
        
        await saveToDB(DB_KEYS.CLUBS, AppState.allClubs, 'saveClubs');
        await saveToDB(DB_KEYS.CLUB_ENROLLMENTS, AppState.allClubEnrollments, 'saveClubEnrollments');
        await saveToDB(DB_KEYS.CLUB_RECORDS, AppState.allClubRecords, 'saveClubRecords');
        
        renderClubList();
        showToast('ลบชุมนุมเรียบร้อยแล้ว');
    });
}

// --- 2. Club Enrollments ---
export function onEnrollFilterChange() {
    const yr = document.getElementById('enroll-year').value;
    const sem = document.getElementById('enroll-semester').value;
    
    const assignSelect = document.getElementById('enroll-assign-club');
    const filteredClubs = AppState.allClubs.filter(c => c.year == yr && c.semester == sem && c.status === 'เปิด');
    
    assignSelect.innerHTML = `<option value="">-- ปล่อยว่าง (ไม่ระบุชุมนุม) --</option>` + 
        filteredClubs.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

    const classDropdown = document.getElementById('enroll-filter-class');
    const filteredClasses = AppState.allClasses.filter(c => c.year == yr && c.semester == sem);
    filteredClasses.sort((a, b) => a.className.localeCompare(b.className, undefined, { numeric: true }));
    classDropdown.innerHTML = `<option value="">ทุกชั้นเรียน</option>` + 
        filteredClasses.map(c => `<option value="${c.className}">${c.className}</option>`).join('');

    renderEnrollStudents();
}

export function renderEnrollStudents() {
    const yr = document.getElementById('enroll-year').value;
    const sem = document.getElementById('enroll-semester').value;
    const classFilter = document.getElementById('enroll-filter-class').value;
    const statusFilter = document.getElementById('enroll-filter-status').value;
    const search = document.getElementById('enroll-search').value.toLowerCase().trim();

    let filteredStudents = AppState.allStudents.filter(s => s.status !== 'ลาออก');
    if(classFilter) filteredStudents = filteredStudents.filter(s => s.class === classFilter);

    if(search) {
        filteredStudents = filteredStudents.filter(s => {
            const fullName = getStudentFullName(s).toLowerCase();
            return s.studentId.toString().includes(search) || fullName.includes(search);
        });
    }

    const mappedStudents = filteredStudents.map(s => {
        const enrollment = AppState.allClubEnrollments.find(e => e.studentId === s.id && e.year == yr && e.semester == sem);
        const club = enrollment ? AppState.allClubs.find(c => c.id === enrollment.clubId) : null;
        return { student: s, club: club, enrollment: enrollment };
    });

    let finalStudents = mappedStudents;
    if (statusFilter === 'noclub') finalStudents = mappedStudents.filter(m => !m.club);
    else if (statusFilter === 'hasclub') finalStudents = mappedStudents.filter(m => m.club);

    finalStudents.sort((a,b) => a.student.class.localeCompare(b.student.class, undefined, { numeric: true }) || a.student.number - b.student.number);

    document.getElementById('tbody-enroll-students').innerHTML = finalStudents.map(m => {
        const s = m.student;
        const clubStatusText = m.club ? 
            `<span class="bg-green-100 text-green-800 text-xs px-2.5 py-1 rounded-full font-bold whitespace-nowrap"><i class="fas fa-check-circle mr-1"></i> ${m.club.name}</span>` : 
            `<span class="bg-yellow-100 text-yellow-800 text-xs px-2.5 py-1 rounded-full font-bold whitespace-nowrap"><i class="fas fa-exclamation-triangle mr-1"></i> ไม่มีชุมนุม</span>`;

        const checkboxHtml = m.club ? '' : `<input type="checkbox" value="${s.id}" class="enroll-select-cb">`;

        return `<tr>
            <td class="px-4 py-2 text-center whitespace-nowrap">${checkboxHtml}</td>
            <td class="hidden md:table-cell px-4 py-2 text-sm whitespace-nowrap">${s.class} เลขที่ ${s.number}</td>
            <td class="hidden md:table-cell px-4 py-2 text-sm font-mono whitespace-nowrap">${s.studentId}</td>
            <td class="px-4 py-2">
                <div class="text-sm font-bold text-gray-800 whitespace-nowrap">${getStudentFullName(s)}</div>
                <div class="md:hidden mt-1 text-xs text-gray-500">${s.class} เลขที่ ${s.number} | รหัส: ${s.studentId}</div>
            </td>
            <td class="px-4 py-2 text-sm whitespace-nowrap">${clubStatusText}</td>
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
    
    const selectedStudentIds = Array.from(document.querySelectorAll('.enroll-select-cb:checked')).map(cb => cb.value);

    if(selectedStudentIds.length === 0) return customAlert('กรุณาเลือกนักเรียนอย่างน้อย 1 คน');

    if(clubId) {
        const targetClub = AppState.allClubs.find(c => c.id === clubId);
        const currentEnrolled = AppState.allClubEnrollments.filter(e => e.clubId === clubId && e.year == yr && e.semester == sem).length;
        if(currentEnrolled + selectedStudentIds.length > targetClub.capacity) {
            return customAlert(`ไม่สามารถลงทะเบียนได้เนื่องจากเกินความจุห้องชุมนุม (ความจุคงเหลือ: ${targetClub.capacity - currentEnrolled} คน)`);
        }
    }

    selectedStudentIds.forEach(stuId => {
        AppState.allClubEnrollments = AppState.allClubEnrollments.filter(e => !(e.studentId === stuId && e.year == yr && e.semester == sem));
        if(clubId) {
            AppState.allClubEnrollments.push({ id: generateId(), studentId: stuId, clubId: clubId, year: yr, semester: sem });
        }
    });

    await saveToDB(DB_KEYS.CLUB_ENROLLMENTS, AppState.allClubEnrollments, 'saveClubEnrollments');
    showToast('ปรับปรุงข้อมูลการลงทะเบียนชุมนุมเรียบร้อย');
    renderEnrollStudents();
}

// --- 3. Club Attendance ---
export function updateClubDropdown(yearVal, semVal, targetId, defaultText) {
    const el = document.getElementById(targetId);
    if (!el) return;
    
    let filtered = AppState.allClubs.filter(c => c.year == yearVal && c.semester == semVal);
    
    if(AppState.currentUser && AppState.currentUser.role === 'teacher') {
        filtered = filtered.filter(c => c.primaryTeacherId === AppState.currentUser.data.id || (c.coAdvisorIds && c.coAdvisorIds.includes(AppState.currentUser.data.id)));
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

    const enrollments = AppState.allClubEnrollments.filter(e => e.clubId === clubId && e.year == yr && e.semester == sem);
    const enrolledStudentIds = enrollments.map(e => e.studentId);
    
    AppState.currentCheckinStudents = AppState.allStudents.filter(s => enrolledStudentIds.includes(s.id) && s.status !== 'ลาออก');
    AppState.currentCheckinStudents.sort((a, b) => {
        const classCompare = a.class.localeCompare(b.class, undefined, { numeric: true });
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

    const existRec = AppState.allClubRecords.find(r => getBangkokDate(r.date) === date && r.clubId === clubId && matchRecordYearSemester(r, yr, sem));
    
    AppState.activeCheckinStates = {};
    AppState.lastCheckedClubStuId = null;
    AppState.currentCheckinStudents.forEach(stu => {
        let status = '';
        if(existRec) {
            const r = existRec.attendance.find(a => a.studentId === stu.id);
            if(r) status = r.status;
        }
        AppState.activeCheckinStates[stu.id] = status;
    });

    if(document.getElementById('club-checkin-search')) document.getElementById('club-checkin-search').value = '';
    if(document.getElementById('club-checkin-hide-checked')) document.getElementById('club-checkin-hide-checked').checked = false;

    document.getElementById('club-student-list-container').classList.remove('hidden');
    document.getElementById('club-save-btn-container').classList.remove('hidden');
    document.getElementById('club-bulk-actions').classList.remove('hidden');
    document.getElementById('club-bulk-actions').classList.add('flex');

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

        const classCompare = a.class.localeCompare(b.class, undefined, { numeric: true });
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
            <td class="px-6 py-4 td-name">
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
    renderClubCheckinTable();
}

export function setAllClubAttendance(st) {
    AppState.currentCheckinStudents.forEach(stu => {
        AppState.activeCheckinStates[stu.id] = st;
    });
    AppState.lastCheckedClubStuId = null;
    renderClubCheckinTable();
}

export async function saveClubAttendance() {
    const date = document.getElementById('club-checkin-date').value;
    const yr = parseInt(document.getElementById('club-checkin-year').value);
    const sem = parseInt(document.getElementById('club-checkin-semester').value);
    const clubId = document.getElementById('club-checkin-id').value;

    if(!AppState.currentCheckinStudents || AppState.currentCheckinStudents.length === 0) return;

    const att = AppState.currentCheckinStudents.map(stu => ({
        studentId: stu.id,
        studentName: getStudentFullName(stu),
        studentClass: stu.class,
        studentNumber: stu.number,
        status: AppState.activeCheckinStates[stu.id] || 'ขาด'
    }));

    const localTimestampStr = date + 'T' + getBangkokCurrentTime();
    const utcDate = new Date(localTimestampStr + "+07:00").toISOString();

    const record = {
        id: generateId(), date: utcDate, clubId, year: yr, semester: sem, attendance: att
    };

    AppState.allClubRecords = AppState.allClubRecords.filter(r => !(getBangkokDate(r.date) === date && r.clubId === clubId && matchRecordYearSemester(r, yr, sem)));
    AppState.allClubRecords.push(record);

    await saveToDB(DB_KEYS.CLUB_RECORDS, AppState.allClubRecords, 'saveClubRecords');
    showToast('บันทึกการเข้ากิจกรรมชุมนุมเสร็จสิ้น');
}

export function exportClubCheckinCSV() {
    const date = document.getElementById('club-checkin-date').value;
    const yr = document.getElementById('club-checkin-year').value;
    const sem = document.getElementById('club-checkin-semester').value;
    const clubId = document.getElementById('club-checkin-id').value;
    const club = AppState.allClubs.find(c => c.id === clubId);

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
    
    const enrollment = AppState.allClubEnrollments.find(e => e.studentId === AppState.currentUser.data.id && e.year == schoolDefaults.year && e.semester == schoolDefaults.semester);
    
    if(!enrollment) {
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

    const club = AppState.allClubs.find(c => c.id === enrollment.clubId);
    if(!club) return;

    const primaryTeacher = AppState.allTeachers.find(t => t.id === club.primaryTeacherId);
    const pTeacherName = primaryTeacher ? `${primaryTeacher.title}${primaryTeacher.firstName} ${primaryTeacher.lastName}` : '-';
    const coTeachers = (club.coAdvisorIds || []).map(id => {
        const t = AppState.allTeachers.find(x => x.id === id);
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

    const myRecords = AppState.allClubRecords.filter(r => r.clubId === club.id && matchRecordYearSemester(r, club.year, club.semester));
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