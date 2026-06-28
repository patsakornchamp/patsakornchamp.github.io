import { AppState } from '../core/state.js';
import { saveToDB, syncDataFromServer } from '../services/api.js';
import { getBangkokDate, getBangkokCurrentTime, getISOTimestamp, getCurrentUserId, showToast, customAlert, customConfirm, closeModal, getStudentFullName, showLoading, hideLoading, generateId } from '../utils/helpers.js';

// ฟังก์ชันสำหรับแปลงไฟล์ให้เป็น Base64
const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = error => reject(error);
});

// ฟังก์ชันบีบอัดรูปภาพก่อนส่งเป็น Base64
async function compressImage(file, maxSize = 1280, quality = 0.8) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                
                if (width > height) {
                    if (width > maxSize) { height = Math.round(height * (maxSize / width)); width = maxSize; }
                } else {
                    if (height > maxSize) { width = Math.round(width * (maxSize / height)); height = maxSize; }
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', quality).split(',')[1]);
            };
            img.onerror = error => reject(error);
        };
        reader.onerror = error => reject(error);
    });
}

// ฟังก์ชันแปลงลิงก์ Google Drive เป็นลิงก์ที่แสดงภาพได้โดยตรง
function getDirectImageUrl(url) {
    if (!url) return '';
    const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
        return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w1200`;
    }
    return url;
}

export function onAsmTypeChange() {
    const type = document.getElementById('asm-type').value;
    const normalFields = document.querySelectorAll('.asm-normal-only-field');
    const isExam = type === 'exam';
    normalFields.forEach(f => {
        if (isExam) {
            f.classList.add('hidden');
        } else {
            f.classList.remove('hidden');
        }
    });

    const fields = ['asm-assign-date', 'asm-assign-time', 'asm-due-date', 'asm-due-time'];
    fields.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            if (isExam) {
                el.removeAttribute('required');
            } else {
                el.setAttribute('required', 'required');
            }
        }
    });
}

export function initAssignmentsTab() {
    // เตรียม State จำลอง หากยังไม่มีข้อมูล (เพราะ backend อาจจะยังไม่พร้อมรับ action แบบอัตโนมัติ)
    if (!AppState.allAssignments) AppState.allAssignments = [];
    if (!AppState.allStudentAssignments) AppState.allStudentAssignments = [];
    
    // เตรียม Dropdown กรองชั้นเรียน
    let classes = AppState.allClasses.filter(c => c.deleted_flg !== 'Y');
    
    if (AppState.currentUser && AppState.currentUser.role === 'teacher') {
        const teacherId = AppState.currentUser.data.id;
        const teacherSubjects = AppState.currentUser.data.subjects || [];
        classes = classes.filter(c => {
            return c.subjects && Array.isArray(c.subjects) && c.subjects.some(subId => teacherSubjects.includes(subId));
        });
    }
    classes.sort((a,b) => a.className.localeCompare(b.className, 'th', { numeric: true }));
    const filterClassEl = document.getElementById('asm-filter-class');
    const formClassEl = document.getElementById('asm-class');
    
    if (filterClassEl) {
        filterClassEl.innerHTML = '<option value="">-- ทุกชั้นเรียน --</option>' + classes.map(c => `<option value="${c.id}">${c.className}</option>`).join('');
    }
    if (formClassEl) {
        formClassEl.innerHTML = '<option value="">-- เลือกชั้นเรียน --</option>' + classes.map(c => `<option value="${c.id}">${c.className}</option>`).join('');
    }

    if (document.getElementById('asm-filter-title')) document.getElementById('asm-filter-title').value = '';
    if (document.getElementById('asm-filter-progress')) document.getElementById('asm-filter-progress').value = '';

    renderAssignmentsList();
}

export function onAsmFilterClassChange() {
    const classId = document.getElementById('asm-filter-class').value;
    const subEl = document.getElementById('asm-filter-subject');
    
    if (!classId) {
        subEl.innerHTML = '<option value="">-- ทุกวิชา --</option>';
        renderAssignmentsList();
        return;
    }

    const cls = AppState.allClasses.find(c => c.id === classId && c.deleted_flg !== 'Y');
    let subjects = cls && cls.subjects ? AppState.allSubjects.filter(s => cls.subjects.includes(s.id) && s.deleted_flg !== 'Y') : [];
    
    if (AppState.currentUser && AppState.currentUser.role === 'teacher') {
        const teacherSubs = AppState.currentUser.data.subjects || [];
        subjects = subjects.filter(s => teacherSubs.includes(s.id));
    }
    
    subEl.innerHTML = '<option value="">-- ทุกวิชา --</option>' + subjects.map(s => `<option value="${s.id}">${s.code} - ${s.name}</option>`).join('');
    renderAssignmentsList();
}

export function onAsmFormClassChange() {
    const classId = document.getElementById('asm-class').value;
    const subEl = document.getElementById('asm-subject');
    const stuContainer = document.getElementById('asm-students-container');
    const selectAllCb = document.getElementById('asm-student-all');
    const searchEl = document.getElementById('asm-student-search');

    if (!classId) {
        subEl.innerHTML = '<option value="">-- กรุณาเลือกชั้นเรียนก่อน --</option>';
        stuContainer.innerHTML = '<div class="text-sm text-gray-500 italic col-span-full">กรุณาเลือกชั้นเรียนก่อน</div>';
        if (selectAllCb) selectAllCb.checked = false;
        return;
    }
    
    const cls = AppState.allClasses.find(c => c.id === classId && c.deleted_flg !== 'Y');
    let subjects = cls && cls.subjects ? AppState.allSubjects.filter(s => cls.subjects.includes(s.id) && s.deleted_flg !== 'Y') : [];
    
    if (AppState.currentUser && AppState.currentUser.role === 'teacher') {
        const teacherSubs = AppState.currentUser.data.subjects || [];
        subjects = subjects.filter(s => teacherSubs.includes(s.id));
    }
    
    subEl.innerHTML = '<option value="">-- เลือกวิชา --</option>' + subjects.map(s => `<option value="${s.id}">${s.code} - ${s.name}</option>`).join('');

    // โหลดรายชื่อนักเรียนตามชั้นเรียน
    const clsName = cls ? cls.className : '';
    const students = AppState.allStudents.filter(s => s.class === clsName && s.status !== 'ลาออก' && s.deleted_flg !== 'Y').sort((a,b) => a.number - b.number);
    
    if (students.length > 0) {
        stuContainer.innerHTML = students.map(s => `
            <label class="checkbox-container text-sm asm-stu-label" data-search="${(s.studentId || '').toString().toLowerCase()} ${getStudentFullName(s).toLowerCase()}">
                ${s.studentId || '-'} ${getStudentFullName(s)}
                <input type="checkbox" value="${s.id}" class="asm-stu-cb" checked onchange="checkAsmStudentAllState()">
                <span class="checkmark"></span>
            </label>
        `).join('');
        if (selectAllCb) selectAllCb.checked = true;
    } else {
        stuContainer.innerHTML = '<div class="text-sm text-gray-500 italic col-span-full">ไม่พบนักเรียนในชั้นเรียนนี้</div>';
        if (selectAllCb) selectAllCb.checked = false;
    }
    if (searchEl) searchEl.value = '';
}

export function filterAsmStudents() {
    const query = (document.getElementById('asm-student-search') ? document.getElementById('asm-student-search').value.toLowerCase().trim() : '');
    const labels = document.querySelectorAll('.asm-stu-label');
    labels.forEach(label => {
        const searchData = label.getAttribute('data-search') || '';
        if (searchData.includes(query)) {
            label.classList.remove('hidden');
        } else {
            label.classList.add('hidden');
        }
    });
    checkAsmStudentAllState();
}

export function toggleAllAsmStudents(masterCb) {
    document.querySelectorAll('.asm-stu-label:not(.hidden) .asm-stu-cb').forEach(cb => cb.checked = masterCb.checked);
}

export function checkAsmStudentAllState() {
    const visibleCbs = document.querySelectorAll('.asm-stu-label:not(.hidden) .asm-stu-cb');
    const checkedCbs = document.querySelectorAll('.asm-stu-label:not(.hidden) .asm-stu-cb:checked');
    const masterCb = document.getElementById('asm-student-all');
    if (masterCb) masterCb.checked = (visibleCbs.length > 0 && visibleCbs.length === checkedCbs.length);
}

export function renderAssignmentsList() {
    if (!AppState.allAssignments) AppState.allAssignments = [];
    const filterTitle = document.getElementById('asm-filter-title') ? document.getElementById('asm-filter-title').value.toLowerCase().trim() : '';
    const filterClass = document.getElementById('asm-filter-class').value;
    const filterSub = document.getElementById('asm-filter-subject').value;
    const filterProgress = document.getElementById('asm-filter-progress') ? document.getElementById('asm-filter-progress').value : '';
    const tbody = document.getElementById('tbody-assignments');

    // Show export button only when class AND subject are selected
    const exportBtn = document.getElementById('asm-export-btn-container');
    if (exportBtn) {
        if (filterClass && filterSub) {
            exportBtn.classList.remove('hidden');
        } else {
            exportBtn.classList.add('hidden');
        }
    }
    
    let list = AppState.allAssignments.filter(a => a.deleted_flg !== 'Y');
    
    // กรองสิทธิ์ครูผู้สอน
    if (AppState.currentUser && AppState.currentUser.role === 'teacher') {
        list = list.filter(a => a.teacherId === AppState.currentUser.data.id);
    }
    
    if (filterTitle) list = list.filter(a => (a.title || '').toLowerCase().includes(filterTitle));
    if (filterClass) list = list.filter(a => a.classId === filterClass);
    if (filterSub) list = list.filter(a => a.subjectId === filterSub);
    
    // เสริมข้อมูลเพื่อใช้สำหรับการคำนวณ Filter "ส่งครบ/ยังไม่ครบ"
    let enhancedList = list.map(a => {
        const cls = AppState.allClasses.find(c => c.id === a.classId);
        const sub = AppState.allSubjects.find(s => s.id === a.subjectId);
        
        const assignedRecords = AppState.allStudentAssignments ? AppState.allStudentAssignments.filter(sa => sa.assignmentId === a.id && sa.deleted_flg !== 'Y') : [];
        const stuCount = assignedRecords.length;
        const submitCount = assignedRecords.filter(sa => sa.status === 'ส่งแล้ว' || sa.status === 'ตรวจแล้ว').length;
        const gradeCount = assignedRecords.filter(sa => sa.status === 'ตรวจแล้ว').length;
        
        return { ...a, _cls: cls, _sub: sub, _stuCount: stuCount, _submitCount: submitCount, _gradeCount: gradeCount };
    });

    if (filterProgress === 'complete') {
        enhancedList = enhancedList.filter(a => a._stuCount > 0 && a._submitCount >= a._stuCount);
    } else if (filterProgress === 'incomplete') {
        enhancedList = enhancedList.filter(a => a._submitCount < a._stuCount || a._stuCount === 0);
    }

    // เรียงตามวันที่มอบหมายงาน (ล่าสุดขึ้นก่อน)
    enhancedList.sort((a,b) => new Date(b.assignDate) - new Date(a.assignDate));
    
    if (enhancedList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center py-8 text-gray-500">ไม่พบข้อมูลการมอบหมายงาน</td></tr>';
        return;
    }

    tbody.innerHTML = enhancedList.map(a => {
        const cls = a._cls;
        const sub = a._sub;
        const stuCount = a._stuCount;
        const submitCount = a._submitCount;

        let isOverdue = false;
        // ยกเลิกการเตือนหากความคืบหน้าส่งงานครบแล้ว (submitCount >= stuCount)
        if (a.submitLocation !== 'สอบ' && a.dueDate && a.dueTime && submitCount < stuCount) {
            // คำนวณเวลาเลยกำหนดส่งโดยอิงตามเวลาประเทศไทย (+07:00)
            const dueDateTime = new Date(`${a.dueDate}T${a.dueTime}:00+07:00`);
            if (new Date() > dueDateTime) isOverdue = true;
        }
        
        const overdueBadge = isOverdue ? `<span class="bg-red-100 text-red-800 text-[10px] sm:text-xs px-2 py-0.5 rounded ml-1 font-bold whitespace-nowrap border border-red-200 shadow-sm align-middle"><i class="fas fa-exclamation-circle mr-1"></i>เลยกำหนด</span>` : '';
        const rowClass = isOverdue ? 'bg-red-50/50 hover:bg-red-100/50' : 'hover:bg-gray-50';
        
        return `
        <tr class="${rowClass}">
            <td class="px-4 py-3">
                <div class="font-bold text-gray-800 leading-tight">${a.title} ${overdueBadge}</div>
                <div class="text-xs text-gray-500 mt-1 line-clamp-1">${a.description || '-'}</div>
                <div class="md:hidden text-xs font-medium text-blue-600 mt-1">${cls ? cls.className : ''} | ${sub ? sub.name : ''}</div>
            </td>
            <td class="hidden md:table-cell px-4 py-3 text-sm text-gray-600">${cls ? cls.className : '-'}</td>
            <td class="hidden md:table-cell px-4 py-3 text-sm text-gray-600">${sub ? sub.name : '-'}</td>
            <td class="px-4 py-3 text-center text-sm font-medium text-gray-600">${a.submitLocation === 'สอบ' ? '-' : `${getBangkokDate(a.assignDate)} ${a.assignTime || ''}`}</td>
            <td class="px-4 py-3 text-center text-sm font-medium text-red-600">${a.submitLocation === 'สอบ' ? '<span class="text-gray-400 font-normal italic">สอบ (ไม่ต้องส่ง)</span>' : `${getBangkokDate(a.dueDate)} ${a.dueTime}`}</td>
            <td class="px-4 py-3 text-center whitespace-nowrap">
                <span class="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded font-bold">${submitCount} / ${stuCount}</span>
            </td>
            <td class="px-4 py-3 text-center whitespace-nowrap">
                <span class="bg-green-100 text-green-800 text-xs px-2 py-1 rounded font-bold">${a._gradeCount} / ${stuCount}</span>
            </td>
            <td class="px-4 py-3 text-center whitespace-nowrap">
                <div class="flex items-center justify-center space-x-2">
                    <button onclick="openGradingModal('${a.id}')" class="bg-green-100 text-green-700 hover:bg-green-200 hover:text-green-800 border border-green-200 w-8 h-8 rounded flex items-center justify-center transition-colors shadow-sm" title="ตรวจงาน / ให้คะแนน"><i class="fas fa-clipboard-check"></i></button>
                    <button onclick="editAssignment('${a.id}')" class="bg-blue-100 text-blue-700 hover:bg-blue-200 hover:text-blue-800 border border-blue-200 w-8 h-8 rounded flex items-center justify-center transition-colors shadow-sm" title="แก้ไขงาน"><i class="fas fa-edit"></i></button>
                    <button onclick="deleteAssignment('${a.id}')" class="bg-red-100 text-red-700 hover:bg-red-200 hover:text-red-800 border border-red-200 w-8 h-8 rounded flex items-center justify-center transition-colors shadow-sm" title="ลบงาน"><i class="fas fa-trash-alt"></i></button>
                </div>
            </td>
        </tr>`;
    }).join('');
}

export async function searchAssignments() {
    showLoading('กำลังดึงข้อมูลล่าสุดจากเซิร์ฟเวอร์...');
    try {
        await syncDataFromServer(true);
    } catch (e) {
        console.error('Error syncing assignments data:', e);
    }
    hideLoading();
    renderAssignmentsList();
}

export function openAssignmentModal() {
    document.getElementById('asm-modal-title').innerHTML = '<i class="fas fa-tasks mr-2"></i>มอบหมายงาน';
    // โหลดรายชื่อชั้นเรียนใหม่และกรองตามสิทธิ์ครู (เฉพาะชั้นที่ตนเองสอนหรือเป็นที่ปรึกษา)
    let classes = AppState.allClasses.filter(c => c.deleted_flg !== 'Y');
    if (AppState.currentUser && AppState.currentUser.role === 'teacher') {
        const teacherId = AppState.currentUser.data.id;
        const teacherSubjects = AppState.currentUser.data.subjects || [];
        classes = classes.filter(c => {
            return c.subjects && Array.isArray(c.subjects) && c.subjects.some(subId => teacherSubjects.includes(subId));
        });
    }
    classes.sort((a,b) => a.className.localeCompare(b.className, 'th', { numeric: true }));
    const formClassEl = document.getElementById('asm-class');
    if (formClassEl) {
        formClassEl.innerHTML = '<option value="">-- เลือกชั้นเรียน --</option>' + classes.map(c => `<option value="${c.id}">${c.className}</option>`).join('');
    }

    document.getElementById('asm-id').value = '';
    document.getElementById('asm-title').value = '';
    document.getElementById('asm-type').value = 'normal';
    onAsmTypeChange();
    document.getElementById('asm-subject').innerHTML = '<option value="">-- กรุณาเลือกชั้นเรียนก่อน --</option>';
    document.getElementById('asm-assign-date').value = getBangkokDate(new Date());
    document.getElementById('asm-assign-time').value = getBangkokCurrentTime().substring(0, 5);
    document.getElementById('asm-due-date').value = '';
    document.getElementById('asm-due-time').value = '';
    document.getElementById('asm-location').value = 'ส่ง Online';
    document.getElementById('asm-loc-other').classList.add('hidden');
    document.getElementById('asm-loc-other').value = '';
    document.getElementById('asm-score').value = '10';
    document.getElementById('asm-desc').value = '';
    document.getElementById('asm-student-all').checked = false;
    document.getElementById('asm-students-container').innerHTML = '<div class="text-sm text-gray-500 italic col-span-full">กรุณาเลือกชั้นเรียนก่อน</div>';
    const searchEl = document.getElementById('asm-student-search');
    if (searchEl) searchEl.value = '';
    
    [1,2,3].forEach(i => removeAsmFile(i));
    
    document.getElementById('assignment-modal').classList.add('show');
}

export function editAssignment(id) {
    const asm = AppState.allAssignments.find(a => a.id === id && a.deleted_flg !== 'Y');
    if (!asm) return;

    document.getElementById('asm-modal-title').innerHTML = '<i class="fas fa-edit mr-2"></i>แก้ไขงานมอบหมาย';
    document.getElementById('asm-id').value = asm.id;
    document.getElementById('asm-title').value = asm.title || '';
    
    let classes = AppState.allClasses.filter(c => c.deleted_flg !== 'Y');
    if (AppState.currentUser && AppState.currentUser.role === 'teacher') {
        const teacherId = AppState.currentUser.data.id;
        const teacherSubjects = AppState.currentUser.data.subjects || [];
        classes = classes.filter(c => c.subjects && Array.isArray(c.subjects) && c.subjects.some(subId => teacherSubjects.includes(subId)));
    }
    classes.sort((a,b) => a.className.localeCompare(b.className, 'th', { numeric: true }));
    const formClassEl = document.getElementById('asm-class');
    if (formClassEl) {
        formClassEl.innerHTML = '<option value="">-- เลือกชั้นเรียน --</option>' + classes.map(c => `<option value="${c.id}">${c.className}</option>`).join('');
    }
    document.getElementById('asm-class').value = asm.classId || '';

    const subEl = document.getElementById('asm-subject');
    const stuContainer = document.getElementById('asm-students-container');
    const selectAllCb = document.getElementById('asm-student-all');
    const searchEl = document.getElementById('asm-student-search');

    if (!asm.classId) {
        subEl.innerHTML = '<option value="">-- กรุณาเลือกชั้นเรียนก่อน --</option>';
        stuContainer.innerHTML = '<div class="text-sm text-gray-500 italic col-span-full">กรุณาเลือกชั้นเรียนก่อน</div>';
        if (selectAllCb) selectAllCb.checked = false;
    } else {
        const cls = AppState.allClasses.find(c => c.id === asm.classId && c.deleted_flg !== 'Y');
        let subjects = cls && cls.subjects ? AppState.allSubjects.filter(s => cls.subjects.includes(s.id) && s.deleted_flg !== 'Y') : [];
        if (AppState.currentUser && AppState.currentUser.role === 'teacher') {
            const teacherSubs = AppState.currentUser.data.subjects || [];
            subjects = subjects.filter(s => teacherSubs.includes(s.id));
        }
        subEl.innerHTML = '<option value="">-- เลือกวิชา --</option>' + subjects.map(s => `<option value="${s.id}">${s.code} - ${s.name}</option>`).join('');
        document.getElementById('asm-subject').value = asm.subjectId || '';

        const clsName = cls ? cls.className : '';
        const students = AppState.allStudents.filter(s => s.class === clsName && s.status !== 'ลาออก' && s.deleted_flg !== 'Y').sort((a,b) => a.number - b.number);
        
        const targetRecords = AppState.allStudentAssignments ? AppState.allStudentAssignments.filter(sa => sa.assignmentId === asm.id && sa.deleted_flg !== 'Y') : [];
        const targetStudents = targetRecords.map(sa => String(sa.studentId));

        if (students.length > 0) {
            stuContainer.innerHTML = students.map(s => {
                const isChecked = targetStudents.includes(String(s.id)) || targetStudents.includes(String(s.studentId)); 
                return `
                <label class="checkbox-container text-sm asm-stu-label" data-search="${(s.studentId || '').toString().toLowerCase()} ${getStudentFullName(s).toLowerCase()}">
                    ${s.studentId || '-'} ${getStudentFullName(s)}
                    <input type="checkbox" value="${s.id}" class="asm-stu-cb" ${isChecked ? 'checked' : ''} onchange="checkAsmStudentAllState()">
                    <span class="checkmark"></span>
                </label>`;
            }).join('');
            setTimeout(() => checkAsmStudentAllState(), 10);
        } else {
            stuContainer.innerHTML = '<div class="text-sm text-gray-500 italic col-span-full">ไม่พบนักเรียนในชั้นเรียนนี้</div>';
            if (selectAllCb) selectAllCb.checked = false;
        }
    }
    if (searchEl) searchEl.value = '';

    document.getElementById('asm-assign-date').value = asm.assignDate || '';
    document.getElementById('asm-assign-time').value = asm.assignTime || '';
    document.getElementById('asm-due-date').value = asm.dueDate || '';
    document.getElementById('asm-due-time').value = asm.dueTime || '';
    
    const loc = asm.submitLocation || 'ส่ง Online';
    if (loc === 'สอบ') {
        document.getElementById('asm-type').value = 'exam';
        document.getElementById('asm-location').value = 'ส่ง Online';
        document.getElementById('asm-loc-other').classList.add('hidden');
        document.getElementById('asm-loc-other').value = '';
    } else {
        document.getElementById('asm-type').value = 'normal';
        const standardLocs = ['ส่ง Online', 'ส่งในคาบเรียน', 'ส่งที่โต๊ะทำงานครู'];
        if (standardLocs.includes(loc)) {
            document.getElementById('asm-location').value = loc;
            document.getElementById('asm-loc-other').classList.add('hidden');
            document.getElementById('asm-loc-other').value = '';
        } else {
            document.getElementById('asm-location').value = 'อื่นๆ';
            document.getElementById('asm-loc-other').classList.remove('hidden');
            document.getElementById('asm-loc-other').value = loc;
        }
    }
    onAsmTypeChange();
    document.getElementById('asm-score').value = asm.maxScore || '10';
    document.getElementById('asm-desc').value = asm.description || '';

    [1, 2, 3].forEach(i => removeAsmFile(i));

    if (asm.files) {
        let parsedFiles = [];
        try { parsedFiles = typeof asm.files === 'string' ? JSON.parse(asm.files) : asm.files; } catch (e) {}

        if (Array.isArray(parsedFiles)) {
            parsedFiles.forEach((file, idx) => {
                const i = idx + 1;
                if (i > 3) return;
                const fileName = file.name || file.n;
                const fileUrl = file.url || file.u;
                if (!fileName || !fileUrl) return;

                const container = document.getElementById(`asm-preview-container-${i}`);
                const imgPreview = document.getElementById(`asm-img-preview-${i}`);
                const iconPreview = document.getElementById(`asm-icon-preview-${i}`);
                const iconElement = iconPreview.querySelector('i');
                const filenameLabel = document.getElementById(`asm-filename-${i}`);
                const labelArea = document.getElementById(`asm-label-${i}`);

                filenameLabel.innerText = fileName;
                labelArea.classList.add('hidden');
                container.classList.remove('hidden');

                const isImage = fileName.match(/\.(jpeg|jpg|gif|png|webp)$/i);
                if (isImage) {
                    imgPreview.src = getDirectImageUrl(fileUrl);
                    imgPreview.classList.remove('hidden');
                    iconPreview.classList.add('hidden');
                } else {
                    imgPreview.classList.add('hidden');
                    iconPreview.classList.remove('hidden');
                    let faIcon = 'fa-file text-gray-500';
                    if (fileName.match(/\.pdf$/i)) faIcon = 'fa-file-pdf text-red-500';
                    else if (fileName.match(/\.(doc|docx)$/i)) faIcon = 'fa-file-word text-blue-600';
                    else if (fileName.match(/\.(xls|xlsx|csv)$/i)) faIcon = 'fa-file-excel text-green-600';
                    else if (fileName.match(/\.(ppt|pptx)$/i)) faIcon = 'fa-file-powerpoint text-orange-500';
                    else if (fileName.match(/\.(zip|rar)$/i)) faIcon = 'fa-file-archive text-gray-700';
                    iconElement.className = `fas ${faIcon} text-3xl`;
                }
                container.dataset.existingFile = JSON.stringify(file);
            });
        }
    }
    document.getElementById('assignment-modal').classList.add('show');
}

export async function saveAssignment() {
    const title = document.getElementById('asm-title').value.trim();
    const classId = document.getElementById('asm-class').value;
    const subjectId = document.getElementById('asm-subject').value;
    const maxScore = document.getElementById('asm-score').value;
    
    const type = document.getElementById('asm-type').value;
    let assignDate, assignTime, dueDate, dueTime, location;
    
    if (type === 'exam') {
        assignDate = getBangkokDate(new Date());
        assignTime = getBangkokCurrentTime().substring(0, 5);
        dueDate = getBangkokDate(new Date());
        dueTime = '23:59';
        location = 'สอบ';
    } else {
        assignDate = document.getElementById('asm-assign-date').value;
        assignTime = document.getElementById('asm-assign-time').value;
        dueDate = document.getElementById('asm-due-date').value;
        dueTime = document.getElementById('asm-due-time').value;
        location = document.getElementById('asm-location').value;
        if (location === 'อื่นๆ') {
            location = document.getElementById('asm-loc-other').value.trim() || 'ไม่ระบุ';
        }
    }
    
    if (!title || !classId || !subjectId || !dueDate || !maxScore) {
        return customAlert('กรุณากรอกข้อมูลที่มีเครื่องหมาย (*) ให้ครบถ้วน');
    }
    
    const selectedStudentIds = Array.from(document.querySelectorAll('.asm-stu-cb:checked')).map(cb => cb.value);
    if (selectedStudentIds.length === 0) {
        return customAlert('กรุณาเลือกนักเรียนอย่างน้อย 1 คน');
    }
    
    showLoading('กำลังบันทึกและประมวลผลไฟล์...');
    
    const id = document.getElementById('asm-id').value || generateId();
    const payload = {
        id: id,
        title: title,
        classId: classId,
        subjectId: subjectId,
        assignDate: assignDate,
        assignTime: assignTime,
        dueDate: dueDate,
        dueTime: dueTime,
        submitLocation: location,
        maxScore: parseFloat(maxScore),
        description: document.getElementById('asm-desc').value.trim(),
        teacherId: AppState.currentUser ? AppState.currentUser.data.id : 'unknown',
        createdAt: getISOTimestamp(),
        deleted_flg: 'N'
    };

    // รวบรวมไฟล์
    const files = [];
    for(let i=1; i<=3; i++) {
        const fileInput = document.getElementById(`asm-file-${i}`);
        const container = document.getElementById(`asm-preview-container-${i}`);
        if (fileInput.files.length > 0) {
            const f = fileInput.files[0];
            if (f.size > 10 * 1024 * 1024) {
                hideLoading();
                return customAlert(`ไฟล์ที่ ${i} มีขนาดใหญ่เกิน 10MB`);
            }
            
            let base64Data;
            if (f.type.startsWith('image/')) {
                base64Data = await compressImage(f);
            } else {
                base64Data = await fileToBase64(f);
            }
            files.push({
                name: f.name,
                mimeType: f.type.startsWith('image/') ? 'image/jpeg' : f.type,
                base64: base64Data
            });
        } else if (container.dataset.existingFile) {
            try {
                files.push(JSON.parse(container.dataset.existingFile));
            } catch(e) {}
        }
    }
    payload.files = JSON.stringify(files); // ยัดลง Payload เตรียมส่งขึ้น Apps Script
    
    try {
        const response = await fetch(AppState.googleSheetUrl, {
            method: 'POST',
            redirect: 'follow',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'createAssignmentWithFiles', payload: payload })
        });
        
        const text = await response.text();
        let result = {};
        
        try {
            result = JSON.parse(text);
        } catch (e) {
            // ข้าม Error กรณีแปลงเป็น JSON ไม่สำเร็จ
        }
        
        // 🌟 ตรวจสอบความสำเร็จแบบรอบคอบที่สุด (ดักจับทุกรูปแบบของคำว่า สำเร็จ)
        let isError = result.status === 'error' || result.error === true;
        const msgStr = (result.message || text || '').toLowerCase();
        
        if (isError && (msgStr.includes('สำเร็จ') || msgStr.includes('สําเร็จ') || msgStr.includes('success'))) {
            isError = false; // Override กลับเป็นสำเร็จ
        }

        const isSuccess = !isError && (
            response.ok || 
            result.status === 'success' || 
            result.success === true || 
            result.id !== undefined || 
            msgStr.includes('สำเร็จ') || msgStr.includes('สําเร็จ') || msgStr.includes('success')
        );
            
        if (!isSuccess) {
            throw new Error(result.message || text || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
        }

        let finalObj = { ...payload };
        if (result && typeof result === 'object') {
            if (result.data) { finalObj = { ...finalObj, ...result.data }; } 
            else if (result.id) { finalObj = { ...finalObj, ...result }; }
        }
        
        try {
            let filesData = finalObj.files || payload.files || '[]';
            let parsedFiles = typeof filesData === 'string' ? JSON.parse(filesData) : filesData;
            if (Array.isArray(parsedFiles)) {
                parsedFiles = parsedFiles.map(f => ({ n: f.name || f.n, u: f.url || f.u || 'อัปโหลดสำเร็จ' }));
                finalObj.files = JSON.stringify(parsedFiles);
            }
        } catch(e) {}
        
        const existIdx = AppState.allAssignments.findIndex(a => a.id === id);
        if (existIdx > -1) { AppState.allAssignments[existIdx] = finalObj; }
        else { AppState.allAssignments.push(finalObj); }
        
        await saveToDB('ASSIGNMENTS', AppState.allAssignments, 'saveAssignments');
        
        // อัปเดต StudentAssignments ตามรายชื่อนักเรียนที่ถูกเลือก
        const finalId = finalObj.id || id;
        let studentAssignmentsUpdated = false;
        const now = getISOTimestamp();
        const userId = getCurrentUserId();

        if (!AppState.allStudentAssignments) AppState.allStudentAssignments = [];

        AppState.allStudentAssignments.forEach(sa => {
            // รองรับทั้งกรณี ID ตรงกันเป๊ะ หรือเป็น ID เก่าที่เป็น prefix ของ ID ปัจจุบัน
            const isMatch = sa.assignmentId === finalId || 
                            sa.assignmentId === id ||
                            (sa.assignmentId && finalId && (sa.assignmentId.startsWith(finalId) || finalId.startsWith(sa.assignmentId)));
            if (isMatch) {
                const isSelected = selectedStudentIds.includes(String(sa.studentId));
                // หากเอาเครื่องหมายติ๊กออกและนักเรียนคนนั้นยังไม่ได้ส่งงาน (สถานะ รอส่ง) ให้ลบข้อมูลออก
                if (!isSelected && sa.deleted_flg !== 'Y' && sa.status === 'รอส่ง') {
                    sa.deleted_flg = 'Y';
                    sa.deletedAt = now;
                    sa.deletedBy = userId;
                    studentAssignmentsUpdated = true;
                }
            }
        });

        selectedStudentIds.forEach(stuId => {
            const existing = AppState.allStudentAssignments.find(sa => 
                (sa.assignmentId === finalId || sa.assignmentId === id || (sa.assignmentId && finalId && (sa.assignmentId.startsWith(finalId) || finalId.startsWith(sa.assignmentId)))) && 
                String(sa.studentId) === String(stuId)
            );
            if (!existing) {
                AppState.allStudentAssignments.push({
                    id: generateId(), assignmentId: finalId, studentId: stuId, status: 'รอส่ง', score: null, teacherComment: '', files: '[]',
                    createdAt: now, createdBy: userId, updatedAt: now, updatedBy: userId, deleted_flg: 'N'
                });
                studentAssignmentsUpdated = true;
            } else if (existing.deleted_flg === 'Y') {
                // กู้คืนหากเคยถูกลบไป
                existing.deleted_flg = 'N'; existing.deletedAt = null; existing.deletedBy = null; existing.updatedAt = now; existing.updatedBy = userId;
                existing.assignmentId = finalId; // อัปเดตให้เป็น ID ที่ถูกต้องจาก Server
                studentAssignmentsUpdated = true;
            }
        });

        if (studentAssignmentsUpdated) {
            await saveToDB('STUDENT_ASSIGNMENTS', AppState.allStudentAssignments, 'saveStudentAssignments');
        }
        
        hideLoading();
        closeModal('assignment-modal');
        renderAssignmentsList();
        showToast('สร้างงานมอบหมายเรียบร้อย');
        
    } catch (err) {
        hideLoading();
        customAlert('ระบบแจ้งเตือน: ' + err.message);
    }
}

export function deleteAssignment(id) {
    const hasSubmission = AppState.allStudentAssignments && AppState.allStudentAssignments.some(s => 
        (s.assignmentId === id || (s.assignmentId && id && (s.assignmentId.startsWith(id) || id.startsWith(s.assignmentId)))) && 
        (s.status === 'ส่งแล้ว' || s.status === 'ตรวจแล้ว' || s.score !== null) && 
        s.deleted_flg !== 'Y'
    );
    if (hasSubmission) {
        return customAlert('ไม่สามารถลบงานนี้ได้ เนื่องจากมีการส่งงานหรือคุณได้ให้คะแนนนักเรียนไปแล้ว');
    }
    
    customConfirm('ยืนยันการลบงาน', 'คุณแน่ใจหรือไม่ที่จะลบการมอบหมายงานนี้?', async () => {
        const idx = AppState.allAssignments.findIndex(a => a.id === id);
        if (idx > -1) {
            AppState.allAssignments[idx].deleted_flg = 'Y';
            AppState.allAssignments[idx].deletedAt = getISOTimestamp();
            await saveToDB('ASSIGNMENTS', AppState.allAssignments, 'saveAssignments');
            renderAssignmentsList();
            showToast('ลบงานเรียบร้อยแล้ว');
        }
    });
}

let currentGradingAssignmentId = null;
let currentGradingStudentId = null;

export async function openGradingModal(assignmentId) {
    currentGradingAssignmentId = assignmentId;
    const asm = AppState.allAssignments.find(a => a.id === assignmentId);
    if (!asm) return;
    
    const cls = AppState.allClasses.find(c => c.id === asm.classId);
    if (cls && cls.className && typeof window.ensureStudentsLoadedForClass === 'function') {
        await window.ensureStudentsLoadedForClass(cls.className);
    }
    
    document.getElementById('grading-title').innerText = asm.title;
    document.getElementById('grading-max-score').innerText = `(เต็ม ${asm.maxScore})`;
    
    if(document.getElementById('grading-search')) document.getElementById('grading-search').value = '';
    if(document.getElementById('grading-filter-status')) document.getElementById('grading-filter-status').value = '';
    
    renderGradingTable();
    document.getElementById('grading-modal').classList.add('show');
}

export function renderGradingTable() {
    const asm = AppState.allAssignments.find(a => a.id === currentGradingAssignmentId);
    if (!asm) return;

    const cls = AppState.allClasses.find(c => c.id === asm.classId);
    let stus = AppState.allStudents.filter(s => s.class === (cls ? cls.className : '') && s.status !== 'ลาออก' && s.deleted_flg !== 'Y');
    
    const assignedRecords = AppState.allStudentAssignments ? AppState.allStudentAssignments.filter(sa => 
        (sa.assignmentId === asm.id || (sa.assignmentId && asm.id && (sa.assignmentId.startsWith(asm.id) || asm.id.startsWith(sa.assignmentId)))) && 
        sa.deleted_flg !== 'Y'
    ) : [];
    const targetStudents = assignedRecords.map(sa => String(sa.studentId));
    stus = stus.filter(s => targetStudents.includes(String(s.id)) || targetStudents.includes(String(s.studentId)));
    
    // จับคู่ข้อมูลนักเรียนและสถานะงาน
    let mappedStus = stus.map(stu => {
        const sAsm = AppState.allStudentAssignments && AppState.allStudentAssignments.find(x => 
            (String(x.assignmentId) === String(asm.id) || (x.assignmentId && asm.id && (String(x.assignmentId).startsWith(String(asm.id)) || String(asm.id).startsWith(String(x.assignmentId))))) && 
            (String(x.studentId) === String(stu.id) || String(x.studentId) === String(stu.studentId)) && 
            x.deleted_flg !== 'Y'
        ) || { status: 'รอส่ง', score: '', teacherComment: '' };
        return { stu, sAsm };
    });

    // Filter Search/Status
    const search = document.getElementById('grading-search') ? document.getElementById('grading-search').value.toLowerCase().trim() : '';
    const filterStatus = document.getElementById('grading-filter-status') ? document.getElementById('grading-filter-status').value : '';

    if (search) {
        mappedStus = mappedStus.filter(m => getStudentFullName(m.stu).toLowerCase().includes(search) || m.stu.number.toString().includes(search));
    }
    if (filterStatus) {
        mappedStus = mappedStus.filter(m => m.sAsm.status === filterStatus);
    }

    mappedStus.sort((a,b) => a.stu.number - b.stu.number);

    const tbody = document.getElementById('tbody-grading');
    tbody.innerHTML = mappedStus.map(m => {
        const stu = m.stu;
        const sAsm = m.sAsm;
        const statusColors = { 'รอส่ง':'bg-gray-100 text-gray-600', 'ส่งแล้ว':'bg-blue-100 text-blue-700', 'ตรวจแล้ว':'bg-green-100 text-green-700', 'ทวงงาน':'bg-red-100 text-red-700 font-bold shadow-sm' };
        
        return `
        <tr class="grading-row hover:bg-gray-50 transition-colors" data-stuid="${stu.id}" data-orig-status="${sAsm.status}">
            <td class="px-4 py-3 text-sm text-gray-500" data-label="เลขที่">${stu.number}</td>
            <td class="hidden md:table-cell px-4 py-3 text-sm font-mono text-gray-500" data-label="รหัสประจำตัว">${stu.studentId || '-'}</td>
            <td class="px-4 py-3 td-name" data-label="ชื่อ - นามสกุล">
                <div class="td-name-content text-sm font-bold text-gray-800">${getStudentFullName(stu)}</div>
                <div class="td-meta-content md:hidden text-xs text-gray-500 mt-1">เลขที่: ${stu.number} | รหัส: ${stu.studentId || '-'}</div>
            </td>
            <td class="px-4 py-3" data-label="คะแนน">
                <input type="number" class="score-input w-full border rounded px-2 py-1.5 text-sm text-center focus:ring-green-500 focus:border-green-500" max="${asm.maxScore}" value="${sAsm.score !== null && sAsm.score !== '' ? sAsm.score : ''}" onkeydown="handleScoreEnter(event, this)" onkeyup="validateScore(this, ${asm.maxScore}); autoUpdateStatusUI(this)" onchange="validateScore(this, ${asm.maxScore}); autoUpdateStatusUI(this)">
            </td>
            <td class="px-4 py-3 text-center" data-label="ไฟล์งานนักเรียน">
                ${asm.submitLocation === 'สอบ' ? `<span class="text-gray-400 text-xs">-</span>` : (['ส่งแล้ว', 'ตรวจแล้ว'].includes(sAsm.status)
                    ? `<button onclick="viewStudentSubmission('${stu.id}')" class="text-xs bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 px-2 py-1 rounded transition-colors font-bold"><i class="fas fa-eye mr-1"></i> ตรวจงาน</button>`
                    : `<span class="text-gray-400 text-xs">-</span>`)}
            </td>
            <td class="px-4 py-3 text-center" data-label="จัดการ">
                ${asm.submitLocation !== 'สอบ' ? `<button onclick="remindAssignment('${stu.id}')" class="text-xs bg-red-500 text-white px-2 py-1.5 rounded hover:bg-red-600 transition-colors shadow-sm ${['ส่งแล้ว', 'ตรวจแล้ว'].includes(sAsm.status) ? 'hidden' : ''}"><i class="fas fa-bullhorn mr-1"></i>ทวงงาน</button>` : `<span class="text-gray-400 text-xs">-</span>`}
            </td>
            <td class="px-4 py-3" data-label="หมายเหตุครู">
                <input type="text" class="comment-input w-full border rounded px-2 py-1.5 text-sm focus:ring-green-500 focus:border-green-500" value="${sAsm.teacherComment || ''}" placeholder="ระบุหมายเหตุ...">
            </td>
            <td class="px-4 py-3 text-center" data-label="สถานะ">
                <span class="status-badge px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap ${statusColors[sAsm.status] || 'bg-gray-100 text-gray-600'}">${sAsm.status}</span>
            </td>
        </tr>`;
    }).join('');
}

export function viewStudentSubmission(studentId) {
    currentGradingStudentId = studentId;
    const asm = AppState.allAssignments.find(a => a.id === currentGradingAssignmentId);
    if (!asm) return;

    const student = AppState.allStudents.find(s => s.id === studentId);
    if (!student) return;

    const sAsm = AppState.allStudentAssignments && AppState.allStudentAssignments.find(x => 
        (String(x.assignmentId) === String(asm.id) || (x.assignmentId && asm.id && (String(x.assignmentId).startsWith(String(asm.id)) || String(asm.id).startsWith(String(x.assignmentId))))) && 
        (String(x.studentId) === String(studentId) || String(x.studentId) === String(student.studentId)) && 
        x.deleted_flg !== 'Y'
    );

    // Use submission record if it exists, otherwise default to empty submission state
    const displayAsm = sAsm || {
        submitMethod: 'ยังไม่ได้ส่ง',
        studentNote: 'ไม่มีข้อความจากนักเรียน',
        files: '[]',
        updatedAt: null,
        createdAt: null
    };

    document.getElementById('vss-student-name').innerText = getStudentFullName(student);
    document.getElementById('vss-assignment-title').innerText = asm.title;
    document.getElementById('vss-submit-method').innerText = displayAsm.submitMethod || 'ไม่ระบุ';
    
    let timeText = '-';
    if (displayAsm.updatedAt) {
        timeText = `${getBangkokDate(displayAsm.updatedAt)} ${new Date(displayAsm.updatedAt).toLocaleTimeString('th-TH').substring(0, 5)}`;
    } else if (displayAsm.createdAt) {
        timeText = `${getBangkokDate(displayAsm.createdAt)} ${new Date(displayAsm.createdAt).toLocaleTimeString('th-TH').substring(0, 5)}`;
    }
    document.getElementById('vss-submit-time').innerText = timeText;
    document.getElementById('vss-student-note').innerText = displayAsm.studentNote || 'ไม่มีข้อความจากนักเรียน';

    const container = document.getElementById('vss-files-container');
    let files = [];
    try { files = typeof displayAsm.files === 'string' ? JSON.parse(displayAsm.files) : displayAsm.files; } catch(e) {}
    if (!Array.isArray(files)) files = [];

    if (files.length === 0) {
        container.innerHTML = '<div class="col-span-full py-4 text-center text-gray-400 italic bg-gray-50 rounded-lg border border-dashed w-full">ไม่มีไฟล์แนบ</div>';
    } else {
        container.innerHTML = files.map((file, idx) => {
            const fileName = file.name || file.n || 'ไฟล์แนบ';
            let fileUrl = file.url || file.u || '';
            
            // If URL is missing but base64 is present, use it as a Data URL
            if (!fileUrl && file.base64) {
                fileUrl = `data:${file.mimeType || 'image/jpeg'};base64,${file.base64}`;
            }
            
            const isImg = fileName.match(/\.(jpeg|jpg|gif|png|webp)$/i);
            const isValidUrl = fileUrl && (fileUrl.startsWith('http://') || fileUrl.startsWith('https://') || fileUrl.startsWith('data:'));
            
            let previewInner = '';
            if (isImg && isValidUrl) {
                previewInner = `<img src="${getDirectImageUrl(fileUrl)}" class="w-full h-16 object-cover rounded border mb-1 cursor-pointer" onclick="viewLargeImage(this.src)" title="คลิกเพื่อดูรูปใหญ่">`;
            } else {
                let faIcon = 'fa-file-alt text-indigo-500';
                if (fileName.match(/\.pdf$/i)) faIcon = 'fa-file-pdf text-red-500';
                else if (fileName.match(/\.(doc|docx)$/i)) faIcon = 'fa-file-word text-blue-600';
                else if (fileName.match(/\.(xls|xlsx|csv)$/i)) faIcon = 'fa-file-excel text-green-600';
                else if (fileName.match(/\.(zip|rar)$/i)) faIcon = 'fa-file-archive text-gray-700';
                previewInner = `<div class="flex flex-col items-center justify-center h-16 mb-1"><i class="fas ${faIcon} text-3xl"></i></div>`;
            }

            const linkHtml = isValidUrl
                ? `<a href="${fileUrl}" target="_blank" class="text-[10px] text-indigo-600 hover:underline mt-1 font-bold"><i class="fas fa-download mr-1"></i>เปิดดู/โหลด</a>`
                : `<span class="text-[10px] text-gray-400 mt-1 italic">ไม่มีลิงก์ดาวน์โหลด</span>`;

            return `
            <div class="border border-indigo-100 rounded-lg p-2 text-center bg-white flex flex-col justify-center relative shadow-sm hover:shadow-md transition-shadow">
                ${previewInner}
                <p class="text-[10px] text-gray-700 truncate w-full px-1 font-medium" title="${fileName}">${fileName}</p>
                ${linkHtml}
            </div>`;
        }).join('');
    }

    // Set grading section values
    const scoreInput = document.getElementById('vss-score-input');
    const commentInput = document.getElementById('vss-comment-input');
    const maxScoreLabel = document.getElementById('vss-max-score-label');

    if (scoreInput && commentInput && maxScoreLabel) {
        maxScoreLabel.innerText = `(เต็ม ${asm.maxScore})`;
        scoreInput.value = (sAsm && sAsm.score !== null && sAsm.score !== undefined) ? sAsm.score : '';
        commentInput.value = (sAsm && sAsm.teacherComment) ? sAsm.teacherComment : '';
        scoreInput.setAttribute('max', asm.maxScore);
        
        const gradingSection = document.getElementById('vss-grading-section');
        if (gradingSection) {
            const role = AppState.currentUser ? AppState.currentUser.role : '';
            if (role === 'teacher' || role === 'admin') {
                gradingSection.classList.remove('hidden');
            } else {
                gradingSection.classList.add('hidden');
            }
        }
    }

    document.getElementById('view-student-submission-modal').classList.add('show');
}

export async function submitSubmissionGrading() {
    if (!currentGradingAssignmentId || !currentGradingStudentId) return;

    const asm = AppState.allAssignments.find(a => a.id === currentGradingAssignmentId);
    if (!asm) return;

    const student = AppState.allStudents.find(s => s.id === currentGradingStudentId);
    if (!student) return;

    const scoreInput = document.getElementById('vss-score-input');
    const commentInput = document.getElementById('vss-comment-input');
    if (!scoreInput || !commentInput) return;

    let scoreVal = scoreInput.value.trim();
    const commentVal = commentInput.value.trim();

    if (scoreVal !== '') {
        const val = parseFloat(scoreVal);
        if (val > asm.maxScore) {
            scoreInput.value = asm.maxScore;
            scoreVal = asm.maxScore.toString();
            return customAlert(`คะแนนต้องไม่เกิน ${asm.maxScore}`);
        } else if (val < 0) {
            scoreInput.value = 0;
            scoreVal = '0';
        }
    }

    const now = getISOTimestamp();
    const userId = getCurrentUserId();
    const stuCode = student.studentId || '';

    let sAsm = AppState.allStudentAssignments.find(x => 
        (String(x.assignmentId) === String(currentGradingAssignmentId) || (x.assignmentId && currentGradingAssignmentId && (String(x.assignmentId).startsWith(String(currentGradingAssignmentId)) || String(currentGradingAssignmentId).startsWith(String(x.assignmentId))))) && 
        (String(x.studentId) === String(currentGradingStudentId) || String(x.studentId) === String(stuCode)) && 
        x.deleted_flg !== 'Y');

    const scoreNum = scoreVal !== '' ? parseFloat(scoreVal) : null;
    let newStatus = sAsm ? sAsm.status : 'รอส่ง';
    if (scoreNum !== null) {
        newStatus = 'ตรวจแล้ว';
    } else if (sAsm && sAsm.status === 'ตรวจแล้ว' && scoreNum === null) {
        newStatus = 'ส่งแล้ว';
    }

    if (sAsm) {
        sAsm.status = newStatus;
        sAsm.score = scoreNum;
        sAsm.teacherComment = commentVal;
        sAsm.updatedAt = now;
        sAsm.updatedBy = userId;
    } else {
        sAsm = {
            id: generateId(), assignmentId: currentGradingAssignmentId, studentId: currentGradingStudentId,
            status: newStatus, score: scoreNum, teacherComment: commentVal, files: '[]',
            createdAt: now, createdBy: userId, updatedAt: now, updatedBy: userId, deleted_flg: 'N'
        };
        AppState.allStudentAssignments.push(sAsm);
    }

    showLoading('กำลังบันทึกคะแนน...');
    try {
        await saveToDB('STUDENT_ASSIGNMENTS', AppState.allStudentAssignments, 'saveStudentAssignments');
        showToast('บันทึกคะแนนเรียบร้อยแล้ว');
        closeModal('view-student-submission-modal');
        renderGradingTable();
    } catch (e) {
        console.error(e);
        customAlert('บันทึกคะแนนล้มเหลว กรุณาลองอีกครั้ง');
    } finally {
        hideLoading();
    }
}

export function autoUpdateStatusUI(inputEl) {
    const row = inputEl.closest('.grading-row');
    const score = inputEl.value;
    const badge = row.querySelector('.status-badge');
    const origStatus = row.getAttribute('data-orig-status');
    
    let newStatus = origStatus;
    if (score !== '') {
        newStatus = 'ตรวจแล้ว';
    } else if (origStatus === 'ตรวจแล้ว' && score === '') {
        newStatus = 'ส่งแล้ว'; // ถ้าเอาคะแนนออก กลับไปเป็นส่งแล้ว
    }
    
    badge.innerText = newStatus;
    const statusColors = { 'รอส่ง':'bg-gray-100 text-gray-600', 'ส่งแล้ว':'bg-blue-100 text-blue-700', 'ตรวจแล้ว':'bg-green-100 text-green-700', 'ทวงงาน':'bg-red-100 text-red-700 font-bold shadow-sm' };
    badge.className = `status-badge px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap ${statusColors[newStatus] || 'bg-gray-100 text-gray-600'}`;
    
    const remindBtn = row.querySelector('button[onclick^="remindAssignment"]');
    if (remindBtn) {
        if (['ส่งแล้ว', 'ตรวจแล้ว'].includes(newStatus)) { remindBtn.classList.add('hidden'); } 
        else { remindBtn.classList.remove('hidden'); }
    }
}

export function validateScore(input, maxScore) {
    if (input.value !== '') {
        const val = parseFloat(input.value);
        if (val > maxScore) {
            input.value = maxScore;
            customAlert(`คะแนนต้องไม่เกิน ${maxScore}`);
        } else if (val < 0) {
            input.value = 0;
        }
    }
}

export function handleScoreEnter(event, inputEl) {
    if (event.key === 'Enter') {
        event.preventDefault(); // ป้องกันการทำงานพื้นฐานของปุ่ม Enter
        const inputs = Array.from(document.querySelectorAll('.grading-row .score-input'));
        const index = inputs.indexOf(inputEl);
        if (index > -1 && index < inputs.length - 1) {
            inputs[index + 1].focus(); // ย้ายไปช่องถัดไป
            inputs[index + 1].select(); // คลุมดำตัวเลขเดิม (ถ้ามี) ให้พิมพ์ทับได้เลย
        }
    }
}

export function validateBulkScore(input) {
    const asm = AppState.allAssignments.find(a => a.id === currentGradingAssignmentId);
    if (!asm) return;
    validateScore(input, asm.maxScore);
}

export function applyBulkScore() {
    const val = document.getElementById('bulk-score').value;
    document.querySelectorAll('.grading-row .score-input').forEach(el => {
        el.value = val;
        autoUpdateStatusUI(el);
    });
}

export function remindAssignment(stuId) {
    const stu = AppState.allStudents.find(s => s.id === stuId);
    const stuCode = stu ? stu.studentId : '';

    const row = document.querySelector(`.grading-row[data-stuid="${stuId}"]`);
    const currentNote = row ? row.querySelector('.comment-input').value : '';
    
    const msgHtml = `คุณต้องการทวงงานนักเรียนคนนี้ใช่หรือไม่? ระบบจะเปลี่ยนสถานะเป็น "ทวงงาน"<br><br>
    <div class="mt-3 text-left">
        <label class="block text-sm font-bold text-gray-700 mb-1">หมายเหตุครู:</label>
        <input type="text" id="remind-note-input" class="w-full border rounded px-3 py-2 text-sm focus:ring-red-500 focus:border-red-500" placeholder="ระบุข้อความทวงงาน..." value="${currentNote}">
    </div>`;

    customConfirm('ยืนยันการทวงงาน', msgHtml, async () => {
        const note = document.getElementById('remind-note-input').value;
        if (row) {
            row.querySelector('.comment-input').value = note;
            row.setAttribute('data-force-status', 'ทวงงาน'); // บังคับให้ฟังก์ชันบันทึกมองเห็นสถานะใหม่
        }
        
        // บันทึกข้อมูลที่ค้างอยู่ทั้งหมด (โดยไม่ปิด Modal)
        await saveGrading(true); 
        showToast('ทวงงานและบันทึกข้อมูลเรียบร้อย');
        renderGradingTable();
    });
}

export async function saveGrading(stayOpen = false, isConfirmed = false) {
    const tbody = document.getElementById('tbody-grading');
    if (!tbody) return;
    const rows = tbody.querySelectorAll('.grading-row');
    
    // แสดงสรุปผลคะแนนก่อนบันทึกจริง (เมื่อบันทึกจากปุ่มเซฟหลัก และยังไม่ได้กดยืนยัน)
    if (stayOpen !== true && isConfirmed !== true) {
        if (rows.length === 0) {
            return closeModal('grading-modal');
        }

        const asm = AppState.allAssignments.find(a => a.id === currentGradingAssignmentId);
        const maxScoreStr = asm ? ` (คะแนนเต็ม ${asm.maxScore})` : '';

        let summaryHtml = `
            <div class="text-center mb-3">
                <p class="text-sm text-gray-600 font-bold mb-1">กรุณาตรวจสอบคะแนนสอบของนักเรียนก่อนทำการบันทึกข้อมูล${maxScoreStr}</p>
            </div>
            <div style="max-height: 250px; overflow-y: auto;" class="text-left border border-gray-200 rounded-xl p-3 bg-gray-50/70 space-y-1.5 shadow-inner text-xs">
        `;

        let gradedCount = 0;
        rows.forEach(row => {
            const name = row.querySelector('.td-name-content').innerText;
            const number = row.querySelector('[data-label="เลขที่"]').innerText;
            const scoreInput = row.querySelector('.score-input');
            const score = scoreInput ? scoreInput.value.trim() : '';
            const statusBadge = row.querySelector('.status-badge');
            const status = statusBadge ? statusBadge.innerText : 'รอส่ง';
            
            let scoreText = '';
            if (score !== '') {
                scoreText = `<span class="font-bold text-green-600 font-mono text-sm">${score}</span> คะแนน`;
                gradedCount++;
            } else {
                scoreText = `<span class="text-gray-400 italic">${status}</span>`;
            }
            
            summaryHtml += `
                <div class="flex justify-between items-center py-1.5 border-b border-gray-200 last:border-0">
                    <span class="text-gray-700 font-medium">เลขที่ ${number} ${name}</span>
                    <span class="text-right">${scoreText}</span>
                </div>
            `;
        });
        
        summaryHtml += '</div>';

        customConfirm(
            'สรุปการให้คะแนนนักเรียน',
            summaryHtml,
            async () => {
                await saveGrading(stayOpen, true);
            }
        );
        return;
    }
    
    let updatedCount = 0;
    const now = getISOTimestamp();
    const userId = getCurrentUserId();
    
    rows.forEach(row => {
        const stuId = row.getAttribute('data-stuid');
        const origStatus = row.getAttribute('data-orig-status');
        const forceStatus = row.getAttribute('data-force-status');
        const score = row.querySelector('.score-input').value;
        const comment = row.querySelector('.comment-input').value;
        
        const stu = AppState.allStudents.find(s => s.id === stuId);
        const stuCode = stu ? stu.studentId : '';

        let sAsm = AppState.allStudentAssignments.find(x => 
            (String(x.assignmentId) === String(currentGradingAssignmentId) || (x.assignmentId && currentGradingAssignmentId && (String(x.assignmentId).startsWith(String(currentGradingAssignmentId)) || String(currentGradingAssignmentId).startsWith(String(x.assignmentId))))) && 
            (String(x.studentId) === String(stuId) || String(x.studentId) === String(stuCode)) && 
            x.deleted_flg !== 'Y');
        
        let newStatus = sAsm ? sAsm.status : 'รอส่ง';
        if (forceStatus) {
            newStatus = forceStatus;
        } else if (score !== '') {
            newStatus = 'ตรวจแล้ว';
        } else if (origStatus === 'ตรวจแล้ว' && score === '') {
            newStatus = 'ส่งแล้ว';
        }

        if (sAsm) {
            if (sAsm.status !== newStatus || sAsm.score !== (score !== '' ? parseFloat(score) : null) || sAsm.teacherComment !== comment) {
                sAsm.status = newStatus;
                sAsm.score = score !== '' ? parseFloat(score) : null;
                sAsm.teacherComment = comment;
                sAsm.updatedAt = now;
                sAsm.updatedBy = userId;
                updatedCount++;
            }
        } else {
            if (newStatus !== 'รอส่ง' || score !== '' || comment !== '') {
                AppState.allStudentAssignments.push({
                    id: generateId(), assignmentId: currentGradingAssignmentId, studentId: stuId,
                    status: newStatus, score: score !== '' ? parseFloat(score) : null, teacherComment: comment, files: '[]',
                    createdAt: now, createdBy: userId, updatedAt: now, updatedBy: userId, deleted_flg: 'N'
                });
                updatedCount++;
            }
        }
    });
    
    if (updatedCount > 0) {
        showLoading('กำลังบันทึกข้อมูล...');
        await saveToDB('STUDENT_ASSIGNMENTS', AppState.allStudentAssignments, 'saveStudentAssignments');
        hideLoading();
    }
    
    // ถ้าระบุให้เปิดหน้าต่างค้างไว้ (เช่น ถูกเรียกจากปุ่มทวงงาน) จะไม่ทำงานในส่วนนี้
    if (stayOpen !== true) {
        showToast('บันทึกข้อมูลเรียบร้อย');
        closeModal('grading-modal');
        renderAssignmentsList();
    }
}

export function previewAsmFile(event, index) {
    const file = event.target.files[0];
    const container = document.getElementById(`asm-preview-container-${index}`);
    const imgPreview = document.getElementById(`asm-img-preview-${index}`);
    const iconPreview = document.getElementById(`asm-icon-preview-${index}`);
    const iconElement = iconPreview.querySelector('i');
    const filenameLabel = document.getElementById(`asm-filename-${index}`);
    const labelArea = document.getElementById(`asm-label-${index}`);

    if (file) {
        delete container.dataset.existingFile; // override existing
        if (file.size > 10 * 1024 * 1024) {
            customAlert('ไฟล์มีขนาดใหญ่เกิน 10MB');
            removeAsmFile(index);
            return;
        }
        filenameLabel.innerText = file.name;
        labelArea.classList.add('hidden');
        container.classList.remove('hidden');

        if (file.type.startsWith('image/')) {
            if (imgPreview.src && imgPreview.src.startsWith('blob:')) {
                URL.revokeObjectURL(imgPreview.src);
            }
            imgPreview.src = URL.createObjectURL(file);
            imgPreview.classList.remove('hidden');
            iconPreview.classList.add('hidden');
        } else {
            imgPreview.classList.add('hidden'); iconPreview.classList.remove('hidden');
            let faIcon = 'fa-file text-gray-500';
            if (file.type.includes('pdf') || file.name.endsWith('.pdf')) faIcon = 'fa-file-pdf text-red-500';
            else if (file.type.includes('word') || file.name.endsWith('.doc') || file.name.endsWith('.docx')) faIcon = 'fa-file-word text-blue-600';
            else if (file.type.includes('excel') || file.type.includes('spreadsheet') || file.name.endsWith('.xls') || file.name.endsWith('.xlsx')) faIcon = 'fa-file-excel text-green-600';
            else if (file.type.includes('presentation') || file.name.endsWith('.ppt') || file.name.endsWith('.pptx')) faIcon = 'fa-file-powerpoint text-orange-500';
            else if (file.type.startsWith('video/')) faIcon = 'fa-file-video text-purple-500';
            else if (file.type.includes('zip') || file.type.includes('rar')) faIcon = 'fa-file-archive text-gray-700';
            iconElement.className = `fas ${faIcon} text-3xl`;
        }
    } else { removeAsmFile(index); }
}

export function removeAsmFile(index) {
    const input = document.getElementById(`asm-file-${index}`);
    if (input) input.value = '';
    const label = document.getElementById(`asm-label-${index}`);
    if (label) label.classList.remove('hidden');
    const container = document.getElementById(`asm-preview-container-${index}`);
    if (container) {
        container.classList.add('hidden');
        delete container.dataset.existingFile;
    }
    const img = document.getElementById(`asm-img-preview-${index}`);
    if (img) {
        if (img.src && img.src.startsWith('blob:')) {
            URL.revokeObjectURL(img.src);
        }
        img.src = '';
    }
}

window.initAssignmentsTab = initAssignmentsTab;
window.onAsmTypeChange = onAsmTypeChange;
window.onAsmFilterClassChange = onAsmFilterClassChange;
window.onAsmFormClassChange = onAsmFormClassChange;
window.renderAssignmentsList = renderAssignmentsList;
window.openAssignmentModal = openAssignmentModal;
window.editAssignment = editAssignment;
window.saveAssignment = saveAssignment;
window.deleteAssignment = deleteAssignment;
window.openGradingModal = openGradingModal;
window.renderGradingTable = renderGradingTable;
window.autoUpdateStatusUI = autoUpdateStatusUI;
window.validateScore = validateScore;
window.handleScoreEnter = handleScoreEnter;
window.validateBulkScore = validateBulkScore;
window.applyBulkScore = applyBulkScore;
window.remindAssignment = remindAssignment;
window.saveGrading = saveGrading;
window.toggleAllAsmStudents = toggleAllAsmStudents;
window.checkAsmStudentAllState = checkAsmStudentAllState;
window.filterAsmStudents = filterAsmStudents;
window.previewAsmFile = previewAsmFile;
window.removeAsmFile = removeAsmFile;
window.searchAssignments = searchAssignments;
window.viewStudentSubmission = viewStudentSubmission;
window.submitSubmissionGrading = submitSubmissionGrading;
// ========== EXPORT ASSIGNMENTS EXCEL ==========
function getColLetterAsm(colIndex) {
    let letter = '';
    while (colIndex > 0) {
        let temp = (colIndex - 1) % 26;
        letter = String.fromCharCode(temp + 65) + letter;
        colIndex = (colIndex - temp - 1) / 26;
    }
    return letter;
}

export async function exportAssignmentsExcel() {
    const filterClass = document.getElementById('asm-filter-class').value;
    const filterSub = document.getElementById('asm-filter-subject').value;

    if (!filterClass || !filterSub) {
        if (window.customAlert) customAlert('กรุณาเลือกชั้นเรียนและวิชาก่อนส่งออก');
        return;
    }
    if (!window.ExcelJS) {
        if (window.customAlert) customAlert('ไม่สามารถโหลดไลบรารี Excel ได้ โปรดรีเฟรชหน้าเว็บแล้วลองใหม่');
        return;
    }

    const clsObj = AppState.allClasses.find(c => c.id === filterClass);
    const className = clsObj ? clsObj.className : filterClass;
    const subObj = AppState.allSubjects.find(s => s.id === filterSub);
    const subName = subObj ? subObj.name : filterSub;

    // ดึงงานทั้งหมดของชั้น+วิชานี้ เรียงจากเก่าไปใหม่
    let assignments = AppState.allAssignments.filter(a =>
        a.deleted_flg !== 'Y' && a.classId === filterClass && a.subjectId === filterSub
    );
    if (AppState.currentUser && AppState.currentUser.role === 'teacher') {
        assignments = assignments.filter(a => a.teacherId === AppState.currentUser.data.id);
    }
    assignments.sort((a, b) => new Date(a.assignDate) - new Date(b.assignDate));

    if (assignments.length === 0) {
        if (window.customAlert) customAlert('ไม่พบงานในชั้นเรียนและวิชานี้');
        return;
    }

    // ดึงนักเรียนในชั้นเรียน เรียงตามเลขที่
    const stus = AppState.allStudents
        .filter(s => s.class === className && s.status !== 'ลาออก' && s.deleted_flg !== 'Y')
        .sort((a, b) => a.number - b.number);

    // ดึง studentAssignments ทั้งหมด
    const allSA = AppState.allStudentAssignments ? AppState.allStudentAssignments.filter(sa => sa.deleted_flg !== 'Y') : [];

    // สร้าง lookup: assignmentId -> Set of studentId ที่ครูสั่ง
    const assignedStudentMap = {};
    assignments.forEach(a => {
        const sas = allSA.filter(sa =>
            sa.assignmentId === a.id ||
            (sa.assignmentId && a.id && (sa.assignmentId.startsWith(a.id) || a.id.startsWith(sa.assignmentId)))
        );
        assignedStudentMap[a.id] = new Set(sas.map(sa => String(sa.studentId)));
    });

    // คะแนนเต็มรวม
    const totalMaxScore = assignments.reduce((acc, a) => acc + (parseFloat(a.maxScore) || 0), 0);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('รายงานคะแนน');

    // หัวตาราง
    const asmHeaders = assignments.map(a => `${a.title}\n(เต็ม ${a.maxScore || 0})`);
    const headers = ['เลขที่', 'รหัสนักเรียน', 'ชื่อ-สกุล', ...asmHeaders, `รวมคะแนน\n(เต็ม ${totalMaxScore})`, 'ตัดเกรด'];
    ws.addRow(headers);

    const totalCols = headers.length;
    ws.getRow(1).eachCell((cell, colNum) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
        cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 10 };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        if (colNum > 3 && colNum < totalCols) {
            cell.alignment.textRotation = 90;
        }
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });
    ws.getRow(1).height = 130;

    stus.forEach((stu, idx) => {
        const rowData = [stu.number, stu.studentId || '', getStudentFullName(stu)];
        let totalScore = 0;
        let hasAnyScore = false;

        assignments.forEach(a => {
            const stuIdStr = String(stu.id);
            const stuStudentIdStr = String(stu.studentId || '');
            const assigned = assignedStudentMap[a.id];
            const isAssigned = assigned && (assigned.has(stuIdStr) || assigned.has(stuStudentIdStr));

            if (!isAssigned) {
                rowData.push('-');
                return;
            }

            // หา SA record
            const sa = allSA.find(s => {
                const asmMatch = s.assignmentId === a.id ||
                    (s.assignmentId && a.id && (s.assignmentId.startsWith(a.id) || a.id.startsWith(s.assignmentId)));
                const stuMatch = String(s.studentId) === stuIdStr || String(s.studentId) === stuStudentIdStr;
                return asmMatch && stuMatch;
            });

            if (!sa || sa.score === null || sa.score === undefined || sa.score === '') {
                rowData.push('');
            } else {
                const sc = parseFloat(sa.score);
                rowData.push(sc);
                totalScore += sc;
                hasAnyScore = true;
            }
        });

        rowData.push(hasAnyScore ? totalScore : '');

        let grade = '';
        if (hasAnyScore && totalMaxScore > 0) {
            const pct = (totalScore / totalMaxScore) * 100;
            if (pct >= 80) grade = '4';
            else if (pct >= 75) grade = '3.5';
            else if (pct >= 70) grade = '3';
            else if (pct >= 65) grade = '2.5';
            else if (pct >= 60) grade = '2';
            else if (pct >= 55) grade = '1.5';
            else if (pct >= 50) grade = '1';
            else grade = '0';
        }
        rowData.push(grade);

        const row = ws.addRow(rowData);
        const isEven = idx % 2 === 0;

        row.eachCell((cell, colNum) => {
            if (isEven) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
            }
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            if (colNum !== 3) {
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
            } else {
                cell.alignment = { vertical: 'middle', horizontal: 'left' };
            }
            if (colNum === totalCols) {
                const g = parseFloat(cell.value);
                if (!isNaN(g)) {
                    let color;
                    if (g >= 3.5) color = 'FF166534';
                    else if (g >= 2.5) color = 'FF1D4ED8';
                    else if (g >= 1.5) color = 'FF92400E';
                    else color = 'FFB91C1C';
                    cell.font = { bold: true, color: { argb: color } };
                }
            }
            if (colNum === totalCols - 1 && cell.value !== '') {
                cell.font = { bold: true };
            }
        });
    });

    ws.getColumn(1).width = 8;
    ws.getColumn(2).width = 16;
    ws.getColumn(3).width = 28;
    for (let i = 1; i <= assignments.length; i++) ws.getColumn(3 + i).width = 7;
    ws.getColumn(3 + assignments.length + 1).width = 14;
    ws.getColumn(3 + assignments.length + 2).width = 10;

    const fileName = `คะแนน_${className}_${subName}.xlsx`;
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.click();

    if (window.showToast) showToast(`ส่งออกรายงานคะแนน ${className} - ${subName} เรียบร้อย`);
}

window.exportAssignmentsExcel = exportAssignmentsExcel;
