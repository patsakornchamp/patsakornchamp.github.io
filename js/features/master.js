import { AppState } from '../core/state.js';
import { DB_KEYS } from '../core/config.js';
import { generateId, showToast, customAlert, customConfirm, closeModal, validatePhoneNumber, getDefaultAcademicYearAndSemester, getISOTimestamp, getCurrentUserId } from '../utils/helpers.js';
import { saveToDB, syncDataFromServer } from '../services/api.js';

export function renderMasterData() {
    const searchSub = (document.getElementById('search-subject') ? document.getElementById('search-subject').value.toLowerCase().trim() : '');
    const searchTeacher = (document.getElementById('search-teacher') ? document.getElementById('search-teacher').value.toLowerCase().trim() : '');
    const searchClass = (document.getElementById('search-class') ? document.getElementById('search-class').value.toLowerCase().trim() : '');

    let filteredSubjects = AppState.allSubjects.filter(s => s.deleted_flg !== 'Y');
    if (searchSub) {
        filteredSubjects = filteredSubjects.filter(s => (s.code || '').toLowerCase().includes(searchSub) || (s.name || '').toLowerCase().includes(searchSub));
    }

    filteredSubjects.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    document.getElementById('tbody-subjects').innerHTML = filteredSubjects.map(s => {
        let subjectButtonsHtml = '';
        if (AppState.currentUser && AppState.currentUser.role === 'admin') {
            subjectButtonsHtml = `<button onclick="editSubject('${s.id}')" class="text-blue-500 hover:text-blue-700 mr-3"><i class="fas fa-edit"></i></button>
                                  <button onclick="deleteMaster('subject', '${s.id}')" class="text-red-500 hover:text-red-700"><i class="fas fa-trash"></i></button>`;
        } else if (AppState.currentUser && AppState.currentUser.role === 'teacher') {
            if (AppState.currentUser.data.subjects && AppState.currentUser.data.subjects.includes(s.id)) {
                subjectButtonsHtml = `<button onclick="editSubject('${s.id}')" class="text-blue-500 hover:text-blue-700 mr-3"><i class="fas fa-edit"></i></button>
                                      <button onclick="deleteMaster('subject', '${s.id}')" class="text-red-500 hover:text-red-700"><i class="fas fa-trash"></i></button>`;
            }
        }
        return `<tr>
        <td class="hidden md:table-cell px-4 py-2 text-sm whitespace-nowrap">${s.code}</td>
        <td class="px-4 py-2">
            <div class="text-sm font-bold text-gray-800 whitespace-nowrap">${s.name}</div>
            <div class="md:hidden mt-1 text-xs text-gray-500">รหัส: ${s.code} | ${s.credit} หน่วยกิต</div>
        </td>
        <td class="hidden md:table-cell px-4 py-2 text-sm whitespace-nowrap" data-label="หน่วยกิต">${s.credit}</td>
        <td class="px-4 py-2 text-center text-sm whitespace-nowrap">${subjectButtonsHtml}</td></tr>`;
    }).join('');
    
    let filteredTeachers = AppState.allTeachers.filter(t => t.deleted_flg !== 'Y');
    if (searchTeacher) {
        filteredTeachers = filteredTeachers.filter(t => 
            (t.email || '').toLowerCase().includes(searchTeacher) || 
            (t.firstName || '').toLowerCase().includes(searchTeacher) || 
            (t.lastName || '').toLowerCase().includes(searchTeacher)
        );
    }

    filteredTeachers.sort((a, b) => (a.firstName || '').localeCompare(b.firstName || ''));

    document.getElementById('tbody-teachers').innerHTML = filteredTeachers.map(t => {
        const subs = t.subjects ? t.subjects.map(sid => { const s = AppState.allSubjects.find(x=>x.id===sid && x.deleted_flg !== 'Y'); return s?s.name:''; }).filter(Boolean).join(', ') : '-';
        return `<tr>
        <td class="hidden md:table-cell px-4 py-2 text-sm font-medium text-gray-800 whitespace-nowrap">${t.email||'-'}</td>
        <td class="px-4 py-2">
            <div class="text-sm font-bold text-gray-800 whitespace-nowrap">${t.title || ''}${t.firstName} ${t.lastName}</div>
            <div class="md:hidden mt-1 text-xs text-gray-500 flex flex-col gap-1">
                <div>📧 ${t.email||'ไม่มีอีเมล'}</div>
                <div>📞 ${t.phone||'ไม่มีเบอร์โทร'}</div>
                <div class="truncate w-48">วิชา: ${subs}</div>
            </div>
        </td>
        <td class="hidden md:table-cell px-4 py-2 text-sm whitespace-nowrap">${t.phone||'-'}</td>
        <td class="hidden md:table-cell px-4 py-2 text-sm text-gray-500 max-w-xs truncate">${subs}</td>
        <td class="px-4 py-2 text-center text-sm whitespace-nowrap">
            <button onclick="editTeacher('${t.id}')" class="text-blue-500 hover:text-blue-700 mr-3"><i class="fas fa-edit"></i></button>
            <button onclick="deleteMaster('teacher', '${t.id}')" class="text-red-500 hover:text-red-700"><i class="fas fa-trash"></i></button>
        </td></tr>`;
    }).join('');

    let filteredClasses = AppState.allClasses.filter(c => c.deleted_flg !== 'Y');
    if (searchClass) {
        filteredClasses = filteredClasses.filter(c => (c.className || '').toLowerCase().includes(searchClass));
    }

    const sortedClasses = filteredClasses.sort((a, b) => (a.className || '').localeCompare(b.className || '', undefined, { numeric: true }));
    document.getElementById('tbody-classes').innerHTML = sortedClasses.map(c => {
        const advs = c.advisors ? c.advisors.map(tid => { const t = AppState.allTeachers.find(x=>x.id===tid && x.deleted_flg !== 'Y'); return t?t.firstName:''; }).filter(Boolean).join(', ') : '-';
        const subs = c.subjects ? c.subjects.map(sid => { const s = AppState.allSubjects.find(x=>x.id===sid && x.deleted_flg !== 'Y'); return s?s.name:''; }).filter(Boolean).join(', ') : '-';
        return `<tr>
        <td class="hidden md:table-cell px-4 py-2 text-sm whitespace-nowrap">${c.year}/${c.semester}</td>
        <td class="px-4 py-2">
            <div class="text-sm font-bold text-gray-800 whitespace-nowrap">${c.className}</div>
            <div class="md:hidden mt-1 text-xs text-gray-500 flex flex-col gap-1">
                <div>ปี ${c.year}/${c.semester}</div>
                <div class="truncate w-48">ครูที่ปรึกษา: ${advs}</div>
                <div class="truncate w-48">วิชา: ${subs}</div>
            </div>
        </td>
        <td class="hidden md:table-cell px-4 py-2 text-sm whitespace-nowrap">${advs}</td>
        <td class="hidden md:table-cell px-4 py-2 text-sm text-gray-500 max-w-xs truncate" title="${subs}">${subs}</td>
        <td class="px-4 py-2 text-center text-sm whitespace-nowrap">
            <button onclick="editClass('${c.id}')" class="text-blue-500 hover:text-blue-700 mr-3"><i class="fas fa-edit"></i></button>
            <button onclick="deleteMaster('class', '${c.id}')" class="text-red-500 hover:text-red-700"><i class="fas fa-trash"></i></button>
        </td></tr>`;
    }).join('');
}

export function deleteMaster(type, id) {
    if (type === 'teacher' && AppState.currentUser && AppState.currentUser.role !== 'admin') return customAlert('คุณไม่มีสิทธิ์ลบข้อมูลครูผู้สอน');
    if (type === 'subject' && AppState.currentUser && AppState.currentUser.role === 'teacher') return customAlert('คุณไม่มีสิทธิ์ลบข้อมูลวิชา');
    customConfirm('ยืนยันการลบข้อมูล', 'คุณต้องการลบข้อมูลนี้ใช่หรือไม่? ข้อมูลจะถูกซ่อนแต่ยังสามารถกู้คืนได้โดยผู้ดูแลระบบ', async () => {
        let dataArray, dbKey, action;
        const now = getISOTimestamp();
        const userId = getCurrentUserId();

        if(type==='subject') { dataArray = AppState.allSubjects; dbKey = DB_KEYS.SUBJECTS; action = 'saveSubjects'; }
        if(type==='teacher') { dataArray = AppState.allTeachers; dbKey = DB_KEYS.TEACHERS; action = 'saveTeachers'; }
        if(type==='class') { dataArray = AppState.allClasses; dbKey = DB_KEYS.CLASSES; action = 'saveClasses'; }

        if (dataArray) {
            const idx = dataArray.findIndex(x => x.id === id);
            if (idx > -1) {
                dataArray[idx].deleted_flg = 'Y';
                dataArray[idx].deletedAt = now;
                dataArray[idx].deletedBy = userId;
                await saveToDB(dbKey, dataArray, action);
                renderMasterData(); 
                if(window.updateAllDropdowns) window.updateAllDropdowns(); 
                showToast('ลบข้อมูลเรียบร้อยแล้ว');
            }
        }
    });
}

// Subject CRUD
export function openSubjectModal() {
    document.getElementById('sub-id').value='';
    document.getElementById('sub-code').value='';
    document.getElementById('sub-name').value='';
    document.getElementById('sub-name').removeAttribute('readonly'); // ทำให้แก้ไขได้
    document.getElementById('sub-name').classList.remove('bg-gray-100'); // ลบพื้นหลังสีเทา
    document.getElementById('sub-name-edit-warning').classList.add('hidden'); // ซ่อนคำเตือน
    document.getElementById('sub-credit').value='';
    document.getElementById('subject-modal').classList.add('show');
}
export function editSubject(id) {
    const s = AppState.allSubjects.find(x=>x.id===id && x.deleted_flg !== 'Y'); if(!s) return;
    document.getElementById('sub-id').value=s.id;
    document.getElementById('sub-code').value=s.code;
    document.getElementById('sub-name').value=s.name;

    // ควบคุม readonly และข้อความเตือนตามบทบาทผู้ใช้
    if (AppState.currentUser && AppState.currentUser.role === 'teacher') {
        document.getElementById('sub-name').setAttribute('readonly', 'true');
        document.getElementById('sub-name').classList.add('bg-gray-100');
        document.getElementById('sub-name-edit-warning').classList.remove('hidden');
    } else { // Admin หรือบทบาทอื่น
        document.getElementById('sub-name').removeAttribute('readonly');
        document.getElementById('sub-name').classList.remove('bg-gray-100');
        document.getElementById('sub-name-edit-warning').classList.add('hidden');
    }
    document.getElementById('sub-credit').value=s.credit;
    document.getElementById('subject-modal').classList.add('show');
}
export async function saveSubject() {
    const id = document.getElementById('sub-id').value || generateId();
    const code = document.getElementById('sub-code').value;
    const name = document.getElementById('sub-name').value;
    const credit = document.getElementById('sub-credit').value;

    if(!code || !name) return customAlert('กรุณากรอกรหัสและชื่อวิชาให้ครบถ้วน');

    let obj;
    const idx = AppState.allSubjects.findIndex(x => x.id === id);

    if (idx > -1) { // Update
        obj = {
            ...AppState.allSubjects[idx],
            code, name, credit,
            updatedAt: getISOTimestamp(),
            updatedBy: getCurrentUserId(),
        };
        AppState.allSubjects[idx] = obj;
    } else { // Create
        obj = {
            id, code, name, credit,
            createdAt: getISOTimestamp(), createdBy: getCurrentUserId(),
            updatedAt: getISOTimestamp(), updatedBy: getCurrentUserId(),
            deleted_flg: 'N', deletedAt: null, deletedBy: null,
        };
        AppState.allSubjects.push(obj);
    }

    await saveToDB(DB_KEYS.SUBJECTS, AppState.allSubjects, 'saveSubjects');
    closeModal('subject-modal'); renderMasterData(); 
    if(window.updateAllDropdowns) window.updateAllDropdowns(); 
    showToast('บันทึกวิชาแล้ว');
}

export function renderTeacherSubjectsList() {
    const query = (document.getElementById('t-subject-search') ? document.getElementById('t-subject-search').value.toLowerCase().trim() : '');
    const container = document.getElementById('t-subjects-container');
    
    let filteredSubjects = AppState.allSubjects.filter(s => s.deleted_flg !== 'Y');
    
    if (query) {
        filteredSubjects = filteredSubjects.filter(s => (s.code || '').toLowerCase().includes(query) || (s.name || '').toLowerCase().includes(query));
    }

    filteredSubjects.sort((a, b) => {
        const aSelected = window._tempTeacherSubIds.includes(a.id);
        const bSelected = window._tempTeacherSubIds.includes(b.id);
        if (aSelected && !bSelected) return -1;
        if (!aSelected && bSelected) return 1;
        return (a.code || a.name).localeCompare(b.code || b.name);
    });

    container.innerHTML = filteredSubjects.map(s => `<label class="checkbox-container">${s.code} - ${s.name}<input type="checkbox" value="${s.id}" class="t-sub-cb" ${window._tempTeacherSubIds.includes(s.id)?'checked':''} onchange="toggleTeacherSubject(this)"><span class="checkmark"></span></label>`).join('');
}

export function toggleTeacherSubject(cb) {
    if (cb.checked) {
        if (!window._tempTeacherSubIds.includes(cb.value)) window._tempTeacherSubIds.push(cb.value);
    } else {
        const index = window._tempTeacherSubIds.indexOf(cb.value);
        if (index > -1) window._tempTeacherSubIds.splice(index, 1);
    }
}

// Teacher CRUD
export function openTeacherModal() {
    if (AppState.currentUser && AppState.currentUser.role !== 'admin') return customAlert('เฉพาะผู้ดูแลระบบเท่านั้นที่จัดการข้อมูลนี้ได้');
    document.getElementById('t-id').value=''; 
    document.getElementById('t-title').value='นาย'; 
    document.getElementById('t-title').disabled=false; 
    document.getElementById('t-fname').value=''; 
    document.getElementById('t-fname').readOnly=false; 
    document.getElementById('t-fname').classList.remove('bg-gray-100'); 
    document.getElementById('t-lname').value=''; 
    document.getElementById('t-lname').readOnly=false; 
    document.getElementById('t-lname').classList.remove('bg-gray-100'); 
    document.getElementById('t-phone').value=''; 
    document.getElementById('t-email').value=''; document.getElementById('t-password').value=''; document.getElementById('t-conf-password').value='';
    if (document.getElementById('t-subject-search')) document.getElementById('t-subject-search').value = '';
    window._tempTeacherSubIds = [];
    renderTeacherSubjectsList();
    document.getElementById('teacher-modal').classList.add('show');
}
export function editTeacher(id) {
    if (AppState.currentUser && AppState.currentUser.role !== 'admin') return customAlert('เฉพาะผู้ดูแลระบบเท่านั้นที่จัดการข้อมูลนี้ได้');
    const t = AppState.allTeachers.find(x=>x.id===id && x.deleted_flg !== 'Y'); if(!t) return;
    document.getElementById('t-id').value=t.id; 
    document.getElementById('t-title').value=t.title||'นาย'; 
    document.getElementById('t-title').disabled=false; 
    document.getElementById('t-fname').value=t.firstName; 
    document.getElementById('t-fname').readOnly=false; 
    document.getElementById('t-fname').classList.remove('bg-gray-100'); 
    document.getElementById('t-lname').value=t.lastName; 
    document.getElementById('t-lname').readOnly=false; 
    document.getElementById('t-lname').classList.remove('bg-gray-100'); 
    document.getElementById('t-phone').value=t.phone||''; 
    document.getElementById('t-email').value=t.email||''; document.getElementById('t-password').value=t.password||''; document.getElementById('t-conf-password').value=t.password||'';
    window._tempTeacherSubIds = t.subjects ? [...t.subjects] : [];
    renderTeacherSubjectsList();
    document.getElementById('teacher-modal').classList.add('show');
}
export async function saveTeacher() {
    if (AppState.currentUser && AppState.currentUser.role !== 'admin') return customAlert('เฉพาะผู้ดูแลระบบเท่านั้นที่จัดการข้อมูลนี้ได้');
    const pass = document.getElementById('t-password').value;
    const confPass = document.getElementById('t-conf-password').value;
    
    if (pass !== confPass) return customAlert('รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน');
    if (!pass) return customAlert('กรุณากำหนดรหัสผ่านสำหรับการเข้าสู่ระบบของครู');

    const subs = [...(window._tempTeacherSubIds || [])];
    const id = document.getElementById('t-id').value || generateId();
    const email = document.getElementById('t-email').value.trim();

    const firstName = document.getElementById('t-fname').value;
    const lastName = document.getElementById('t-lname').value;
    const phone = document.getElementById('t-phone').value;

    if(!email) return customAlert('กรุณากรอกอีเมลสำหรับเข้าสู่ระบบ');
    if(!firstName || !lastName) return customAlert('กรุณากรอกชื่อและนามสกุลให้ครบถ้วน');
    if(phone && !validatePhoneNumber(phone)) return customAlert('เบอร์โทรศัพท์ครูไม่ถูกต้อง');
    
    const existEmail = AppState.allTeachers.find(x => x.email === email && x.id !== id && x.deleted_flg !== 'Y');
    if(existEmail) return customAlert('อีเมลนี้ถูกใช้งานไปแล้ว กรุณาใช้อีเมลอื่น');

    let obj;
    const idx = AppState.allTeachers.findIndex(x => x.id === id);

    const commonData = {
        title: document.getElementById('t-title').value, firstName, lastName, phone, email, password: pass, subjects: subs,
        updatedAt: getISOTimestamp(), updatedBy: getCurrentUserId(),
    };

    if (idx > -1) { // Update
        obj = { ...AppState.allTeachers[idx], ...commonData };
        AppState.allTeachers[idx] = obj;
    } else { // Create
        obj = {
            id, ...commonData,
            createdAt: getISOTimestamp(), createdBy: getCurrentUserId(),
            deleted_flg: 'N', deletedAt: null, deletedBy: null,
        };
        AppState.allTeachers.push(obj);
    }

    await saveToDB(DB_KEYS.TEACHERS, AppState.allTeachers, 'saveTeachers');
    closeModal('teacher-modal'); renderMasterData(); 
    if(window.updateAllDropdowns) window.updateAllDropdowns(); 
    showToast('บันทึกครูแล้ว');
}

// ฟังก์ชันสำหรับสร้างและกรองรายชื่อครูที่ปรึกษาในชั้นเรียน
export function renderClassAdvisorsList() {
    const query = (document.getElementById('c-advisor-search') ? document.getElementById('c-advisor-search').value.toLowerCase().trim() : '');
    const container = document.getElementById('c-advisors-container');
    
    let filteredTeachers = AppState.allTeachers.filter(t => t.deleted_flg !== 'Y');
    
    if (query) {
        filteredTeachers = filteredTeachers.filter(t => (t.firstName || '').toLowerCase().includes(query) || (t.lastName || '').toLowerCase().includes(query));
    }

    filteredTeachers.sort((a, b) => {
        const aSelected = window._tempClassAdvisorIds.includes(a.id);
        const bSelected = window._tempClassAdvisorIds.includes(b.id);
        if (aSelected && !bSelected) return -1;
        if (!aSelected && bSelected) return 1;
        return (a.firstName || '').localeCompare(b.firstName || '');
    });

    container.innerHTML = filteredTeachers.map(t => `<label class="checkbox-container">${t.firstName} ${t.lastName}<input type="checkbox" value="${t.id}" class="c-adv-cb" ${window._tempClassAdvisorIds.includes(t.id)?'checked':''} onchange="toggleClassAdvisor(this)"><span class="checkmark"></span></label>`).join('');
}

export function toggleClassAdvisor(cb) {
    if (cb.checked) {
        if (!window._tempClassAdvisorIds.includes(cb.value)) window._tempClassAdvisorIds.push(cb.value);
    } else {
        const index = window._tempClassAdvisorIds.indexOf(cb.value);
        if (index > -1) window._tempClassAdvisorIds.splice(index, 1);
    }
}

// ฟังก์ชันสำหรับสร้างและกรองรายวิชาในชั้นเรียน
export function renderClassSubjectsList() {
    const query = (document.getElementById('c-subject-search') ? document.getElementById('c-subject-search').value.toLowerCase().trim() : '');
    const container = document.getElementById('c-subjects-container');
    
    let filteredSubjects = AppState.allSubjects.filter(s => s.deleted_flg !== 'Y');
    
    if (query) {
        filteredSubjects = filteredSubjects.filter(s => (s.code || '').toLowerCase().includes(query) || (s.name || '').toLowerCase().includes(query));
    }

    filteredSubjects.sort((a, b) => {
        const aSelected = window._tempClassSubjectIds.includes(a.id);
        const bSelected = window._tempClassSubjectIds.includes(b.id);
        if (aSelected && !bSelected) return -1;
        if (!aSelected && bSelected) return 1;
        return (a.code || a.name).localeCompare(b.code || b.name);
    });

    container.innerHTML = filteredSubjects.map(s => `<label class="checkbox-container">${s.code} - ${s.name}<input type="checkbox" value="${s.id}" class="c-sub-cb" ${window._tempClassSubjectIds.includes(s.id)?'checked':''} onchange="toggleClassSubject(this)"><span class="checkmark"></span></label>`).join('');
}

export function toggleClassSubject(cb) {
    if (cb.checked) {
        if (!window._tempClassSubjectIds.includes(cb.value)) window._tempClassSubjectIds.push(cb.value);
    } else {
        const index = window._tempClassSubjectIds.indexOf(cb.value);
        if (index > -1) window._tempClassSubjectIds.splice(index, 1);
    }
}

// Class CRUD
export function openClassModal() {
    const schoolDefaults = getDefaultAcademicYearAndSemester();
    document.getElementById('c-id').value=''; 
    document.getElementById('c-year').value = schoolDefaults.year; 
    document.getElementById('c-sem').value = schoolDefaults.semester;
    document.getElementById('c-name').value='';
    
    if (document.getElementById('c-advisor-search')) document.getElementById('c-advisor-search').value = '';
    if (document.getElementById('c-subject-search')) document.getElementById('c-subject-search').value = '';
    
    window._tempClassAdvisorIds = [];
    window._tempClassSubjectIds = [];
    
    renderClassAdvisorsList();
    renderClassSubjectsList();
    
    document.getElementById('class-modal').classList.add('show');
}
export function editClass(id) {
    const c = AppState.allClasses.find(x=>x.id===id && x.deleted_flg !== 'Y'); if(!c) return;
    document.getElementById('c-id').value=c.id; document.getElementById('c-year').value=c.year; document.getElementById('c-sem').value=c.semester; document.getElementById('c-name').value=c.className;
    
    if (document.getElementById('c-advisor-search')) document.getElementById('c-advisor-search').value = '';
    if (document.getElementById('c-subject-search')) document.getElementById('c-subject-search').value = '';
    
    window._tempClassAdvisorIds = c.advisors ? [...c.advisors] : [];
    window._tempClassSubjectIds = c.subjects ? [...c.subjects] : [];
    
    renderClassAdvisorsList();
    renderClassSubjectsList();
    
    document.getElementById('class-modal').classList.add('show');
}
export async function saveClassRoom() {
    const advs = [...(window._tempClassAdvisorIds || [])];
    const subs = [...(window._tempClassSubjectIds || [])];
    const id = document.getElementById('c-id').value || generateId();
    const className = document.getElementById('c-name').value;
    if(!className) return customAlert('กรุณากรอกชื่อชั้นเรียน');

    let obj;
    const idx = AppState.allClasses.findIndex(x => x.id === id);
    const commonData = {
        year: document.getElementById('c-year').value, semester: document.getElementById('c-sem').value, className, advisors: advs, subjects: subs,
        updatedAt: getISOTimestamp(), updatedBy: getCurrentUserId(),
    };

    if (idx > -1) { // Update
        obj = { ...AppState.allClasses[idx], ...commonData };
        AppState.allClasses[idx] = obj;
    } else { // Create
        obj = {
            id, ...commonData,
            createdAt: getISOTimestamp(), createdBy: getCurrentUserId(),
            deleted_flg: 'N', deletedAt: null, deletedBy: null,
        };
        AppState.allClasses.push(obj);
    }

    await saveToDB(DB_KEYS.CLASSES, AppState.allClasses, 'saveClasses');
    closeModal('class-modal'); renderMasterData(); 
    if(window.updateAllDropdowns) window.updateAllDropdowns(); 
    showToast('บันทึกชั้นเรียนแล้ว');
}
// ฟังก์ชันสำหรับสลับเมนูย่อยในหน้าข้อมูลพื้นฐาน
export function switchMasterSubTab(tabId) {
    // ซ่อนเนื้อหาทั้งหมดก่อน
    document.querySelectorAll('.master-section').forEach(el => el.classList.add('hidden'));
    
    // รีเซ็ตสีปุ่มทั้งหมด
    ['subjects', 'teachers', 'classes', 'students', 'club-manage', 'pr-news'].forEach(id => {
        const btn = document.getElementById(`msub-${id}`);
        if (btn) {
            btn.classList.remove('border-green-600', 'text-green-700');
            btn.classList.add('border-transparent', 'text-gray-500');
        }
    });

    // แสดงเนื้อหาที่เลือก
    const targetContent = document.getElementById(`master-${tabId}`);
    if(targetContent) targetContent.classList.remove('hidden');
    
    // ไฮไลต์สีปุ่มที่เลือก
    const targetBtn = document.getElementById(`msub-${tabId}`);
    if(targetBtn) {
        targetBtn.classList.remove('border-transparent', 'text-gray-500');
        targetBtn.classList.add('border-green-600', 'text-green-700');
    }

    if (tabId === 'students') {
        if (window.renderManageStudents) window.renderManageStudents();
    } else if (tabId === 'club-manage') {
        if (window.switchClubSubTab) window.switchClubSubTab('list');
    } else if (tabId === 'pr-news') {
        if (window.renderPRNewsData) window.renderPRNewsData();
    } else {
        renderMasterData();
    }
}

export async function searchMasterData() {
    await syncDataFromServer();
    
    // ตรวจสอบว่าเมนูย่อยไหนกำลังเปิดใช้งานอยู่ เพื่อสั่งวาดข้อมูลหน้านั้นใหม่ให้ถูกต้อง
    const activeSubTab = ['subjects', 'teachers', 'classes', 'students', 'club-manage', 'pr-news'].find(id => {
        const btn = document.getElementById(`msub-${id}`);
        return btn && btn.classList.contains('border-green-600');
    }) || 'subjects';

    if (activeSubTab === 'students') {
        if (window.renderManageStudents) window.renderManageStudents();
    } else if (activeSubTab === 'club-manage') {
        if (window.switchClubSubTab) window.switchClubSubTab('list');
    } else if (activeSubTab === 'pr-news') {
        if (window.renderPRNewsData) window.renderPRNewsData();
    } else {
        renderMasterData();
    }
}

// ผูกฟังก์ชันเข้า Window
window.renderMasterData = renderMasterData;
window.deleteMaster = deleteMaster;
window.openSubjectModal = openSubjectModal;
window.editSubject = editSubject;
window.saveSubject = saveSubject;
window.openTeacherModal = openTeacherModal;
window.editTeacher = editTeacher;
window.saveTeacher = saveTeacher;
window.openClassModal = openClassModal;
window.editClass = editClass;
window.saveClassRoom = saveClassRoom;
window.switchMasterSubTab = switchMasterSubTab;
window.searchMasterData = searchMasterData;
window.renderTeacherSubjectsList = renderTeacherSubjectsList;
window.toggleTeacherSubject = toggleTeacherSubject;
window.renderClassAdvisorsList = renderClassAdvisorsList;
window.toggleClassAdvisor = toggleClassAdvisor;
window.renderClassSubjectsList = renderClassSubjectsList;
window.toggleClassSubject = toggleClassSubject;