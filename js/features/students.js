import { AppState } from '../core/state.js';
import { DB_KEYS } from '../core/config.js';
import { generateId, getStudentFullName, showToast, customAlert, customConfirm, closeModal, validateThaiCitizenId, validatePhoneNumber, matchRecordYearSemester } from '../utils/helpers.js';
import { saveToDB } from '../services/api.js';

// --- Student Self Service ---
export function renderStudentProfile() {
    const s = AppState.currentUser.data;
    document.getElementById('profile-fullname').innerText = getStudentFullName(s);
    document.getElementById('profile-studentid').innerText = `รหัสประจำตัว: ${s.studentId || '-'}`;
    
    const badgeEl = document.getElementById('profile-badges');
    let badgesHtml = '';
    if (s.isProfileComplete) {
        badgesHtml += '<span class="bg-green-100 text-green-800 text-sm px-3 py-1 rounded-full font-medium inline-block mb-1"><i class="fas fa-check-circle mr-1"></i> ประวัติสมบูรณ์</span><br>';
    } else {
        badgesHtml += '<span class="bg-yellow-100 text-yellow-800 text-sm px-3 py-1 rounded-full font-medium inline-block mb-1"><i class="fas fa-exclamation-triangle mr-1"></i> กรุณากรอกประวัติให้ครบ</span><br>';
    }
    
    if (s.homeVisit === 'สำเร็จ') {
        badgesHtml += '<span class="bg-blue-100 text-blue-800 text-sm px-3 py-1 rounded-full font-medium inline-block"><i class="fas fa-home mr-1"></i> เยี่ยมบ้านสำเร็จ</span>';
    } else if (s.homeVisit === 'ไม่สำเร็จ') {
        badgesHtml += '<span class="bg-red-100 text-red-800 text-sm px-3 py-1 rounded-full font-medium inline-block"><i class="fas fa-home mr-1"></i> เยี่ยมบ้านไม่สำเร็จ</span>';
    } else {
        badgesHtml += '<span class="bg-gray-100 text-gray-600 text-sm px-3 py-1 rounded-full font-medium inline-block"><i class="fas fa-home mr-1"></i> ยังไม่เยี่ยมบ้าน</span>';
    }
    badgeEl.innerHTML = badgesHtml;

    document.getElementById('sp-citizenid').value = s.citizenId || '';
    document.getElementById('sp-nickname').value = s.nickname || '';
    document.getElementById('sp-class').value = s.class || '';
    document.getElementById('sp-number').value = s.number || '';
    document.getElementById('sp-dob').value = s.dob || '';
    document.getElementById('sp-phone').value = s.phone || '';
    document.getElementById('sp-email').value = s.email || '';
    document.getElementById('sp-address').value = s.address || '';
    
    document.getElementById('sp-p-title').value = s.parentTitle || 'นาย';
    if(s.parentName && !s.parentFirstName) { document.getElementById('sp-p-fname').value = s.parentName; }
    else { document.getElementById('sp-p-fname').value = s.parentFirstName || ''; document.getElementById('sp-p-lname').value = s.parentLastName || ''; }
    
    document.getElementById('sp-p-rel').value = s.parentRelation || 'บิดา';
    document.getElementById('sp-p-phone').value = s.parentPhone || '';

    document.getElementById('sp-f-fname').value = s.fatherFirstName || '';
    document.getElementById('sp-f-lname').value = s.fatherLastName || '';
    document.getElementById('sp-f-age').value = s.fatherAge || '';
    document.getElementById('sp-f-job').value = s.fatherJob || '';
    document.getElementById('sp-f-phone').value = s.fatherPhone || '';
    
    document.getElementById('sp-m-fname').value = s.motherFirstName || '';
    document.getElementById('sp-m-lname').value = s.motherLastName || '';
    document.getElementById('sp-m-age').value = s.motherAge || '';
    document.getElementById('sp-m-job').value = s.motherJob || '';
    document.getElementById('sp-m-phone').value = s.motherPhone || '';

    toggleProfileEditMode(false);
}

export function toggleProfileEditMode(isEditing) {
    const form = document.getElementById('student-self-form');
    const inputs = form.querySelectorAll('input, select, textarea');
    
    inputs.forEach(input => {
        if (input.id === 'sp-class' || input.id === 'sp-number') return;
        if (isEditing) {
            input.removeAttribute('disabled');
            input.classList.remove('bg-gray-100');
        } else {
            input.setAttribute('disabled', 'true');
            input.classList.add('bg-gray-100');
        }
    });

    document.getElementById('btn-edit-profile').classList.toggle('hidden', isEditing);
    document.getElementById('btn-cancel-profile').classList.toggle('hidden', !isEditing);
    document.getElementById('btn-save-profile').classList.toggle('hidden', !isEditing);
}

export function saveMyProfile(e) {
    e.preventDefault();
    
    customConfirm('ยืนยันการบันทึกข้อมูล', 'คุณตรวจสอบข้อมูลครบถ้วนและต้องการบันทึกการแก้ไขใช่หรือไม่?', async () => {
        const s = AppState.currentUser.data;
        const citizenId = document.getElementById('sp-citizenid').value.toString().replace(/\s+/g, '');
        const phone = document.getElementById('sp-phone').value;
        const pPhone = document.getElementById('sp-p-phone').value;
        const fPhone = document.getElementById('sp-f-phone').value;
        const mPhone = document.getElementById('sp-m-phone').value;

        if(!validateThaiCitizenId(citizenId)) return customAlert('เลขประจำตัวประชาชน 13 หลัก ไม่ถูกต้อง');
        if(!validatePhoneNumber(phone)) return customAlert('เบอร์โทรศัพท์ของนักเรียนไม่ถูกต้อง');
        if(!validatePhoneNumber(pPhone)) return customAlert('เบอร์โทรศัพท์ของผู้ปกครองไม่ถูกต้อง');
        if(!validatePhoneNumber(fPhone)) return customAlert('เบอร์โทรศัพท์บิดาไม่ถูกต้อง');
        if(!validatePhoneNumber(mPhone)) return customAlert('เบอร์โทรศัพท์มารดาไม่ถูกต้อง');

        s.citizenId = citizenId;
        s.nickname = document.getElementById('sp-nickname').value.trim();
        s.dob = document.getElementById('sp-dob').value;
        s.phone = phone;
        s.email = document.getElementById('sp-email').value;
        s.address = document.getElementById('sp-address').value;
        s.parentTitle = document.getElementById('sp-p-title').value;
        s.parentFirstName = document.getElementById('sp-p-fname').value;
        s.parentLastName = document.getElementById('sp-p-lname').value;
        s.parentRelation = document.getElementById('sp-p-rel').value;
        s.parentPhone = pPhone;
        s.fatherFirstName = document.getElementById('sp-f-fname').value.trim();
        s.fatherLastName = document.getElementById('sp-f-lname').value.trim();
        s.fatherAge = document.getElementById('sp-f-age').value;
        s.fatherJob = document.getElementById('sp-f-job').value.trim();
        s.fatherPhone = fPhone.trim();
        s.motherFirstName = document.getElementById('sp-m-fname').value.trim();
        s.motherLastName = document.getElementById('sp-m-lname').value.trim();
        s.motherAge = document.getElementById('sp-m-age').value;
        s.motherJob = document.getElementById('sp-m-job').value.trim();
        s.motherPhone = mPhone.trim();
        s.isProfileComplete = true; 

        const idx = AppState.allStudents.findIndex(x => x.id === s.id);
        if(idx > -1) AppState.allStudents[idx] = s;
        
        AppState.currentUser.data = s;
        localStorage.setItem(DB_KEYS.SESSION, JSON.stringify(AppState.currentUser));
        
        await saveToDB(DB_KEYS.STUDENTS, AppState.allStudents, 'saveStudents'); 
        showToast('บันทึกข้อมูลส่วนตัวเรียบร้อยแล้ว');
        renderStudentProfile();
    });
}

// --- CSV Upload ---
export function openUploadCsvModal() {
    document.getElementById('upload-file').value = '';
    document.getElementById('upload-class').value = '';
    document.getElementById('upload-encoding').value = 'windows-874';
    document.getElementById('upload-preview-container').classList.add('hidden');
    document.getElementById('btn-save-upload').disabled = true;
    AppState.pendingUploadStudents = [];
    document.getElementById('csv-upload-modal').classList.add('show');
}

export function previewCSV(event) {
    const actualFile = document.getElementById('upload-file').files[0];
    const cls = document.getElementById('upload-class').value;
    const encoding = document.getElementById('upload-encoding').value;
    
    if (!cls) {
        customAlert('กรุณาเลือกชั้นเรียนก่อนเลือกไฟล์');
        document.getElementById('upload-file').value = '';
        return;
    }
    if (!actualFile) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const text = e.target.result;
        const rows = text.split(/\r?\n/);
        AppState.pendingUploadStudents = [];
        let previewHtml = '';
        let errorFound = false;

        for (let i = 1; i < rows.length; i++) {
            const line = rows[i].trim();
            if (!line) continue; 
            
            const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, '')); 
            
            const numberStr = cols[0] || '';
            const studentId = cols[1] || '';
            const title = cols[2] || '';
            const fname = cols[3] || '';
            const lname = cols[4] || '';
            const nickname = cols[5] || '';
            
            const number = parseInt(numberStr);
            let rowError = false;
            let statusHtml = '<span class="text-green-600 font-bold"><i class="fas fa-check-circle"></i> ผ่าน</span>';
            
            if (!numberStr || isNaN(number) || !studentId || !title || !fname || !lname) {
                 statusHtml = `<span class="text-red-600 font-bold"><i class="fas fa-times-circle"></i> ข้อมูลไม่ครบถ้วน</span>`;
                 rowError = true;
                 errorFound = true;
            } 
            else {
                const existInSystem = AppState.allStudents.find(s => s.studentId.toString().trim() === studentId.toString().trim());
                const existInFile = AppState.pendingUploadStudents.find(s => s.studentId.toString().trim() === studentId.toString().trim());
                if (existInSystem || existInFile) {
                    statusHtml = `<span class="text-red-600 font-bold"><i class="fas fa-times-circle"></i> รหัส ${studentId} ซ้ำ</span>`;
                    rowError = true;
                    errorFound = true;
                }
            }

            if(!rowError) {
                AppState.pendingUploadStudents.push({
                    id: generateId(), class: cls, number: number, studentId: studentId,
                    title: title, firstName: fname, lastName: lname, nickname: nickname,
                    status: 'ปกติ', isProfileComplete: false
                });
            }

            const displayNick = nickname ? ` (${nickname})` : '';
            previewHtml += `<tr>
                <td class="px-4 py-2 text-center">${numberStr || '-'}</td>
                <td class="px-4 py-2">${studentId || '-'}</td>
                <td class="px-4 py-2">${title}${fname} ${lname}${displayNick}</td>
                <td class="px-4 py-2 text-center">${statusHtml}</td>
            </tr>`;
        }

        document.getElementById('upload-preview-body').innerHTML = previewHtml;
        document.getElementById('upload-count').innerText = AppState.pendingUploadStudents.length;
        document.getElementById('upload-preview-container').classList.remove('hidden');
        document.getElementById('btn-save-upload').disabled = errorFound || AppState.pendingUploadStudents.length === 0;
    };
    reader.readAsText(actualFile, encoding);
}

export async function saveCsvUpload() {
    if (AppState.pendingUploadStudents.length === 0) return;
    AppState.allStudents = [...AppState.allStudents, ...AppState.pendingUploadStudents];
    await saveToDB(DB_KEYS.STUDENTS, AppState.allStudents, 'saveStudents'); 
    closeModal('csv-upload-modal'); 
    renderManageStudents(); 
    showToast(`อัปโหลดสำเร็จ ${AppState.pendingUploadStudents.length} รายการ`);
    AppState.pendingUploadStudents = [];
}

// --- Manual Student Management ---
export function openStudentModal() { 
    document.getElementById('student-form').reset(); 
    document.getElementById('stu-id').value=''; 
    document.getElementById('stu-status').value='ปกติ'; 
    document.getElementById('stu-homevisit').value=''; 
    document.getElementById('stu-title').value='เด็กชาย'; 
    document.getElementById('stu-p-title').value='นาย'; 
    document.getElementById('stu-p-rel').value='บิดา'; 
    document.getElementById('stu-nickname').value=''; 
    document.getElementById('student-modal').classList.add('show'); 
}

export function editStudent(id) {
const s = AppState.allStudents.find(x => x.id === id);
    if (!s) return;

    // 🌟 เพิ่มการวาด Dropdown ชั้นเรียนให้เป็นปัจจุบันก่อนเลือกค่า
    const uniqueClasses = [...new Set(AppState.allClasses.map(c => c.className))].filter(Boolean).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    const classSelect = document.getElementById('stu-class');
    classSelect.innerHTML = '<option value="">-- เลือกชั้นเรียน --</option>' + 
        uniqueClasses.map(c => `<option value="${c}">${c}</option>`).join('');

    document.getElementById('student-form').reset(); 
    document.getElementById('stu-id').value = s.id;
    document.getElementById('stu-status').value = s.status || 'ปกติ';
    document.getElementById('stu-homevisit').value = s.homeVisit || '';
    document.getElementById('stu-studentid').value = s.studentId || '';
    document.getElementById('stu-title').value = s.title || 'เด็กชาย';
    if(s.name && !s.firstName) { document.getElementById('stu-fname').value = s.name; } 
    else { document.getElementById('stu-fname').value = s.firstName || ''; document.getElementById('stu-lname').value = s.lastName || ''; }
    
    document.getElementById('stu-nickname').value = s.nickname || '';
    document.getElementById('stu-citizenid').value = s.citizenId || '';
    document.getElementById('stu-class').value = s.class || '';
    document.getElementById('stu-number').value = s.number || '';
    document.getElementById('stu-dob').value = s.dob || '';
    document.getElementById('stu-phone').value = s.phone || '';
    document.getElementById('stu-email').value = s.email || '';
    document.getElementById('stu-address').value = s.address || '';
    
    document.getElementById('stu-f-fname').value = s.fatherFirstName || '';
    document.getElementById('stu-f-lname').value = s.fatherLastName || '';
    document.getElementById('stu-f-age').value = s.fatherAge || '';
    document.getElementById('stu-f-job').value = s.fatherJob || '';
    document.getElementById('stu-f-phone').value = s.fatherPhone || '';
    
    document.getElementById('stu-m-fname').value = s.motherFirstName || '';
    document.getElementById('stu-m-lname').value = s.motherLastName || '';
    document.getElementById('stu-m-age').value = s.motherAge || '';
    document.getElementById('stu-m-job').value = s.motherJob || '';
    document.getElementById('stu-m-phone').value = s.motherPhone || '';
    
    document.getElementById('stu-p-title').value = s.parentTitle || 'นาย';
    if(s.parentName && !s.parentFirstName) { document.getElementById('stu-p-fname').value = s.parentName; }
    else { document.getElementById('stu-p-fname').value = s.parentFirstName || ''; document.getElementById('stu-p-lname').value = s.parentLastName || ''; }
    document.getElementById('stu-p-rel').value = s.parentRelation || 'บิดา';
    document.getElementById('stu-p-phone').value = s.parentPhone || '';
    
    document.getElementById('student-modal').classList.add('show');
}

export async function saveStudent() {
    const studentId = document.getElementById('stu-studentid').value.toString().trim();
    const fname = document.getElementById('stu-fname').value.trim();
    const lname = document.getElementById('stu-lname').value.trim();
    const nickname = document.getElementById('stu-nickname').value.trim();
    const citizenId = document.getElementById('stu-citizenid').value.toString().replace(/\s+/g, '');
    const phone = document.getElementById('stu-phone').value.toString().trim();
    const fPhone = document.getElementById('stu-f-phone').value.toString().trim();
    const mPhone = document.getElementById('stu-m-phone').value.toString().trim();
    const pPhone = document.getElementById('stu-p-phone').value.toString().trim();
    const status = document.getElementById('stu-status').value;
    const homeVisit = document.getElementById('stu-homevisit').value;

    if(!studentId || !fname || !lname) return customAlert('กรุณากรอกรหัสประจำตัว ชื่อ และนามสกุลให้ครบถ้วน');

    const isAdmin = AppState.currentUser && AppState.currentUser.role === 'admin';
    const isTeacher = AppState.currentUser && AppState.currentUser.role === 'teacher';
    const isAdminOrTeacher = isAdmin || isTeacher;

    // Citizen ID validation
    if (citizenId && !validateThaiCitizenId(citizenId)) {
        return customAlert('เลขประจำตัวประชาชน 13 หลัก ไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง');
    } else if (!isAdminOrTeacher && !citizenId) {
        return customAlert('กรุณากรอกเลขประจำตัวประชาชน 13 หลัก');
    }

    // Student Phone validation
    if (phone && !validatePhoneNumber(phone)) {
        return customAlert('เบอร์โทรศัพท์นักเรียนไม่ถูกต้อง (ต้องเป็นตัวเลข 9-10 หลักเท่านั้น)');
    } else if (!isAdminOrTeacher && !phone) {
        return customAlert('กรุณากรอกเบอร์โทรศัพท์นักเรียน');
    }

    // Father Phone validation
    if (fPhone && !validatePhoneNumber(fPhone)) {
        return customAlert('เบอร์โทรศัพท์บิดาไม่ถูกต้อง');
    } else if (!isAdminOrTeacher && !fPhone) {
        return customAlert('กรุณากรอกเบอร์โทรศัพท์บิดา');
    }

    // Mother Phone validation
    if (mPhone && !validatePhoneNumber(mPhone)) {
        return customAlert('เบอร์โทรศัพท์มารดาไม่ถูกต้อง');
    } else if (!isAdminOrTeacher && !mPhone) {
        return customAlert('กรุณากรอกเบอร์โทรศัพท์มารดา');
    }

    // Parent Phone validation
    if (pPhone && !validatePhoneNumber(pPhone)) {
        return customAlert('เบอร์โทรศัพท์ผู้ปกครองไม่ถูกต้อง');
    } else if (!isAdminOrTeacher && !pPhone) {
        return customAlert('กรุณากรอกเบอร์โทรศัพท์ผู้ปกครอง');
    }

    const objId = document.getElementById('stu-id').value || generateId();
    const existStu = AppState.allStudents.find(x => x.id === objId);
    const isComp = existStu ? existStu.isProfileComplete : (citizenId && phone ? true : false); 

    const obj = {
        id: objId, status: status, homeVisit: homeVisit, isProfileComplete: isComp, studentId: studentId,
        title: document.getElementById('stu-title').value, firstName: fname, lastName: lname, nickname: nickname,
        citizenId: citizenId, class: document.getElementById('stu-class').value, number: parseInt(document.getElementById('stu-number').value),
        dob: document.getElementById('stu-dob').value, phone: phone, email: document.getElementById('stu-email').value.trim(),
        address: document.getElementById('stu-address').value.trim(),
        fatherFirstName: document.getElementById('stu-f-fname').value.trim(), fatherLastName: document.getElementById('stu-f-lname').value.trim(), fatherAge: document.getElementById('stu-f-age').value, fatherJob: document.getElementById('stu-f-job').value.trim(), fatherPhone: fPhone,
        motherFirstName: document.getElementById('stu-m-fname').value.trim(), motherLastName: document.getElementById('stu-m-lname').value.trim(), motherAge: document.getElementById('stu-m-age').value, motherJob: document.getElementById('stu-m-job').value.trim(), motherPhone: mPhone,
        parentTitle: document.getElementById('stu-p-title').value, parentFirstName: document.getElementById('stu-p-fname').value.trim(), parentLastName: document.getElementById('stu-p-lname').value.trim(), parentRelation: document.getElementById('stu-p-rel').value, parentPhone: pPhone
    };

    const idx = AppState.allStudents.findIndex(x=>x.id===obj.id); if(idx>-1) AppState.allStudents[idx]=obj; else AppState.allStudents.push(obj);
    await saveToDB(DB_KEYS.STUDENTS, AppState.allStudents, 'saveStudents'); 
    closeModal('student-modal'); renderManageStudents(); showToast('บันทึกข้อมูลนักเรียนเรียบร้อย');
}

export function renderManageStudents() {
    const f = document.getElementById('manage-filter-class').value;
    const txt = document.getElementById('manage-search').value.toLowerCase();
    let stus = AppState.allStudents; 
    
    if(f) stus = stus.filter(s=>s.class===f); 
    if(txt) stus = stus.filter(s => getStudentFullName(s).toLowerCase().includes(txt) || (s.studentId && s.studentId.toString().includes(txt)));
    
    stus.sort((a,b)=> a.class.localeCompare(b.class, undefined, { numeric: true }) || a.number-b.number);
    
    const filterClassDropdown = document.getElementById('manage-filter-class');
    const classList = [...new Set(AppState.allStudents.map(s => s.class))].filter(Boolean).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    const currentSelected = filterClassDropdown.value;
    filterClassDropdown.innerHTML = `<option value="">ดูทุกชั้นเรียน</option>` + classList.map(c => `<option value="${c}">${c}</option>`).join('');
    filterClassDropdown.value = currentSelected;

    document.getElementById('manage-students-table-body').innerHTML = stus.map(s => {
        const isResigned = s.status === 'ลาออก';
        const statusBadge = isResigned ? `<span class="bg-red-100 text-red-800 text-xs px-2 py-0.5 rounded ml-2 font-bold whitespace-nowrap">ลาออก</span>` : '';
        const incompleteWarning = (!s.isProfileComplete && !isResigned) ? `<span class="text-yellow-500 ml-2" title="ยังไม่กรอกประวัติครบบริบูรณ์"><i class="fas fa-exclamation-triangle"></i></span>` : '';
        const rowClass = isResigned ? 'opacity-50 bg-gray-50' : 'hover:bg-gray-50';

        return `<tr class="${rowClass}">
            <td class="hidden md:table-cell px-6 py-4 text-sm text-gray-500 whitespace-nowrap">${s.class} เลขที่ ${s.number}</td>
            <td class="hidden md:table-cell px-6 py-4 text-sm text-gray-500 whitespace-nowrap">${s.studentId}</td>
            <td class="px-6 py-4">
                <div class="text-sm font-bold text-gray-800">${getStudentFullName(s)} ${statusBadge} ${incompleteWarning}</div>
                <div class="md:hidden mt-1 text-xs text-gray-500 flex flex-col gap-1">
                    <div>${s.class} | เลขที่ ${s.number} | รหัส: ${s.studentId}</div>
                    ${s.phone ? `<div>📞 ${s.phone}</div>` : `<div class="text-gray-400">ไม่มีเบอร์โทร</div>`}
                </div>
            </td>
            <td class="hidden md:table-cell px-6 py-4 text-sm text-gray-500 whitespace-nowrap">${s.phone || '-'}</td>
            <td class="px-6 py-4 text-center text-sm w-auto md:w-32 whitespace-nowrap">
                <div class="flex items-center justify-center space-x-3">
                    <button onclick="editStudent('${s.id}')" class="text-blue-500 hover:text-blue-700" title="แก้ไข"><i class="fas fa-edit text-lg"></i></button>
                    <button onclick="deleteStu('${s.id}')" class="text-red-500 hover:text-red-700" title="ลบถาวร"><i class="fas fa-trash text-lg"></i></button>
                </div>
            </td>
        </tr>`;
    }).join('');
}

export function deleteStu(id) {
    customConfirm('ยืนยันการลบข้อมูลนักเรียน', 'คุณต้องการลบข้อมูลนักเรียนคนนี้ใช่หรือไม่?', async () => {
        AppState.allStudents = AppState.allStudents.filter(x=>x.id!==id);
        AppState.allClubEnrollments = AppState.allClubEnrollments.filter(x => x.studentId !== id);
        await saveToDB(DB_KEYS.STUDENTS, AppState.allStudents, 'saveStudents');
        await saveToDB(DB_KEYS.CLUB_ENROLLMENTS, AppState.allClubEnrollments, 'saveClubEnrollments');
        renderManageStudents();
        showToast('ลบข้อมูลนักเรียนเรียบร้อยแล้ว');
    });
}

export function renderStudentAcademicPortal() {
    const yr = document.getElementById('aca-year').value;
    const sem = document.getElementById('aca-semester').value;
    const tbody = document.getElementById('aca-table-body');
    tbody.innerHTML = '';

    const stuId = AppState.currentUser.data.id;
    const stuClass = AppState.currentUser.data.class;

    const currentClass = AppState.allClasses.find(c => c.className === stuClass && c.year == yr && c.semester == sem);
    let enrolledSubjects = [];
    if (currentClass && currentClass.subjects) {
        enrolledSubjects = AppState.allSubjects.filter(sub => currentClass.subjects.includes(sub.id));
    }

    enrolledSubjects.forEach(sub => {
        const recs = AppState.allRecords.filter(r => r.class === stuClass && r.subject === sub.name && matchRecordYearSemester(r, yr, sem));

        let stats = { มา: 0, สาย: 0, ลา: 0, ขาด: 0 };
        recs.forEach(r => {
            const a = r.attendance.find(x => x.studentId === stuId);
            if(a) stats[a.status]++;
        });

        const total = stats['มา'] + stats['สาย'] + stats['ลา'] + stats['ขาด'];
        const pct = total === 0 ? 0 : Math.round(((stats['มา'] + stats['สาย'])/total)*100);

        tbody.innerHTML += `<tr class="block md:table-row bg-white border border-gray-200 md:border-none mb-4 md:mb-0 rounded-xl md:rounded-none shadow-sm md:shadow-none overflow-hidden">
            <td class="block md:table-cell px-6 py-4 bg-gray-50 md:bg-transparent border-b md:border-none">
                <div class="text-sm font-bold text-gray-800">${sub.code} - ${sub.name}</div>
                <div class="text-xs font-normal text-gray-500 mt-0.5">(วิชาเรียนปกติ)</div>
            </td>
            <td class="block md:table-cell px-6 py-3 border-b md:border-none border-gray-100">
                <div class="flex justify-between md:justify-center items-center"><span class="md:hidden text-xs font-medium text-gray-500">มาเรียน</span><span class="text-sm font-semibold text-green-600">${stats['มา']}</span></div>
            </td>
            <td class="block md:table-cell px-6 py-3 border-b md:border-none border-gray-100">
                <div class="flex justify-between md:justify-center items-center"><span class="md:hidden text-xs font-medium text-gray-500">สาย</span><span class="text-sm font-semibold text-yellow-600">${stats['สาย']}</span></div>
            </td>
            <td class="block md:table-cell px-6 py-3 border-b md:border-none border-gray-100">
                <div class="flex justify-between md:justify-center items-center"><span class="md:hidden text-xs font-medium text-gray-500">ลา</span><span class="text-sm font-semibold text-blue-600">${stats['ลา']}</span></div>
            </td>
            <td class="block md:table-cell px-6 py-3 border-b md:border-none border-gray-100">
                <div class="flex justify-between md:justify-center items-center"><span class="md:hidden text-xs font-medium text-gray-500">ขาด</span><span class="text-sm font-semibold text-red-600">${stats['ขาด']}</span></div>
            </td>
            <td class="block md:table-cell px-6 py-3 bg-gray-50/50 md:bg-transparent">
                <div class="flex justify-between md:justify-center items-center"><span class="md:hidden text-xs font-medium text-gray-600">% เวลาเรียน</span><span class="text-sm font-bold text-indigo-700">${pct}%</span></div>
            </td>
        </tr>`;
    });

    const myEnrollments = AppState.allClubEnrollments.filter(e => e.studentId === stuId && e.year == yr && e.semester == sem);
    myEnrollments.forEach(enroll => {
        const club = AppState.allClubs.find(c => c.id === enroll.clubId);
        if(!club) return;

        const recs = AppState.allClubRecords.filter(r => r.clubId === club.id && matchRecordYearSemester(r, yr, sem));
        let stats = { มา: 0, สาย: 0, ลา: 0, ขาด: 0 };
        
        recs.forEach(r => {
            const a = r.attendance.find(x => x.studentId === stuId);
            if(a) stats[a.status]++;
        });

        const total = stats['มา'] + stats['สาย'] + stats['ลา'] + stats['ขาด'];
        const pct = total === 0 ? 0 : Math.round(((stats['มา'] + stats['สาย'])/total)*100);

        tbody.innerHTML += `<tr class="block md:table-row bg-white md:bg-green-50/40 border border-green-200 md:border-none mb-4 md:mb-0 rounded-xl md:rounded-none shadow-sm md:shadow-none overflow-hidden">
            <td class="block md:table-cell px-6 py-4 bg-green-50 md:bg-transparent border-b md:border-none border-green-100">
                <div class="text-sm font-bold text-green-900">${club.name}</div>
                <div class="text-xs font-semibold text-green-600 mt-0.5">(วิชาชุมนุม)</div>
            </td>
            <td class="block md:table-cell px-6 py-3 border-b md:border-none border-green-50">
                <div class="flex justify-between md:justify-center items-center"><span class="md:hidden text-xs font-medium text-green-800">มาเรียน</span><span class="text-sm font-semibold text-green-600">${stats['มา']}</span></div>
            </td>
            <td class="block md:table-cell px-6 py-3 border-b md:border-none border-green-50">
                <div class="flex justify-between md:justify-center items-center"><span class="md:hidden text-xs font-medium text-green-800">สาย</span><span class="text-sm font-semibold text-yellow-600">${stats['สาย']}</span></div>
            </td>
            <td class="block md:table-cell px-6 py-3 border-b md:border-none border-green-50">
                <div class="flex justify-between md:justify-center items-center"><span class="md:hidden text-xs font-medium text-green-800">ลา</span><span class="text-sm font-semibold text-blue-600">${stats['ลา']}</span></div>
            </td>
            <td class="block md:table-cell px-6 py-3 border-b md:border-none border-green-50">
                <div class="flex justify-between md:justify-center items-center"><span class="md:hidden text-xs font-medium text-green-800">ขาด</span><span class="text-sm font-semibold text-red-600">${stats['ขาด']}</span></div>
            </td>
            <td class="block md:table-cell px-6 py-3 bg-green-50/50 md:bg-transparent">
                <div class="flex justify-between md:justify-center items-center"><span class="md:hidden text-xs font-medium text-green-800">% เวลาเรียน</span><span class="text-sm font-bold text-green-700">${pct}%</span></div>
            </td>
        </tr>`;
    });

    if (tbody.innerHTML === '') {
        tbody.innerHTML = `<tr class="block md:table-row"><td colspan="6" class="block md:table-cell text-center py-6 text-sm text-gray-500 bg-white rounded-lg border md:border-none shadow-sm md:shadow-none">ไม่พบประวัติเวลาเรียนภายใต้เงื่อนไขปีและภาคเรียนนี้</td></tr>`;
    }
}

// ผูกฟังก์ชันเข้า Window
window.renderStudentProfile = renderStudentProfile;
window.toggleProfileEditMode = toggleProfileEditMode;
window.saveMyProfile = saveMyProfile;
window.openUploadCsvModal = openUploadCsvModal;
window.previewCSV = previewCSV;
window.saveCsvUpload = saveCsvUpload;
window.openStudentModal = openStudentModal;
window.editStudent = editStudent;
window.saveStudent = saveStudent;
window.renderManageStudents = renderManageStudents;
window.deleteStu = deleteStu;
window.renderStudentAcademicPortal = renderStudentAcademicPortal;