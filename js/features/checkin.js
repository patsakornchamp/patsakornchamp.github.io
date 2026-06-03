import { AppState } from '../core/state.js';
import { DB_KEYS } from '../core/config.js';
import { generateId, getStudentFullName, showToast, matchRecordYearSemester, getBangkokDate, getBangkokCurrentTime, exportToCSV, getISOTimestamp, getCurrentUserId } from '../utils/helpers.js';
import { syncDataFromServer, saveToDB } from '../services/api.js';

export function resetCheckinTable() {
    document.getElementById('student-list-container').classList.add('hidden');
    document.getElementById('save-btn-container').classList.add('hidden');
    document.getElementById('bulk-actions').classList.add('hidden');
    document.getElementById('checkin-table-body').innerHTML = '';
    AppState.currentCheckinStudents = [];
    AppState.activeCheckinStates = {};
    AppState.lastCheckedStuId = null;
    document.getElementById('no-students-alert').classList.add('hidden');
}

export async function loadCheckinList() {
    const date = document.getElementById('checkin-date').value; 
    const period = document.getElementById('checkin-period').value;
    const clsId = document.getElementById('checkin-class').value; 
    const subId = document.getElementById('checkin-subject').value; 
    const teacherId = document.getElementById('checkin-teacher').value;
    const yr = document.getElementById('checkin-year').value;
    const sem = document.getElementById('checkin-semester').value;

    if(!date || !period || !clsId || !subId || !teacherId || !yr || !sem) { 
        document.getElementById('checkin-alert').classList.remove('hidden'); 
        return; 
    }
    document.getElementById('checkin-alert').classList.add('hidden');

    await syncDataFromServer();

    const clsObj = AppState.allClasses.find(c => c.id === clsId);
    const clsName = clsObj ? clsObj.className : clsId;
    const subObj = AppState.allSubjects.find(s => s.id === subId);
    const subName = subObj ? subObj.name : subId;

    AppState.currentCheckinStudents = AppState.allStudents.filter(s => s.class === clsName && s.status !== 'ลาออก' && s.deleted_flg !== 'Y').sort((a,b) => {
        const numA = parseInt(a.number) || 9999;
        const numB = parseInt(b.number) || 9999;
        if (numA !== numB) return numA - numB;
        return (a.studentId || '').toString().localeCompare((b.studentId || '').toString());
    });
    
    if(AppState.currentCheckinStudents.length === 0) { 
        document.getElementById('no-students-alert').classList.remove('hidden'); 
        document.getElementById('student-list-container').classList.add('hidden'); 
        return; 
    }
    document.getElementById('no-students-alert').classList.add('hidden');

    const existRec = AppState.allRecords.find(r => getBangkokDate(r.date)===date && String(r.period||'')===String(period||'') && (r.classId === clsId || (!r.classId && r.class===clsName)) && (r.subjectId === subId || (!r.subjectId && r.subject===subName)) && matchRecordYearSemester(r, yr, sem) && r.deleted_flg !== 'Y');
    
    AppState.activeCheckinStates = {};
    AppState.lastCheckedStuId = null;
    AppState.currentCheckinStudents.forEach(stu => {
        let status = ''; 
        if(existRec) { 
            const r = existRec.attendance.find(a=>a.studentId===stu.id); 
            if(r) status = r.status; 
        }
        AppState.activeCheckinStates[stu.id] = status;
    });

    if(document.getElementById('checkin-search')) document.getElementById('checkin-search').value = '';
    if(document.getElementById('checkin-hide-checked')) document.getElementById('checkin-hide-checked').checked = false;

    document.getElementById('student-list-container').classList.remove('hidden'); 
    document.getElementById('save-btn-container').classList.remove('hidden'); 
    document.getElementById('bulk-actions').classList.remove('hidden'); 
    document.getElementById('bulk-actions').classList.add('flex');

    renderCheckinTable();
}

export function renderCheckinTable() {
    let filteredStudents = [...AppState.currentCheckinStudents];
    const query = document.getElementById('checkin-search') ? document.getElementById('checkin-search').value.trim().toLowerCase() : '';
    if (query) {
        filteredStudents = filteredStudents.filter(s => {
            const fullName = getStudentFullName(s).toLowerCase();
            return s.number.toString().includes(query) || s.studentId.toString().toLowerCase().includes(query) || fullName.includes(query);
        });
    }

    const hideChecked = document.getElementById('checkin-hide-checked') ? document.getElementById('checkin-hide-checked').checked : false;
    if (hideChecked) {
        filteredStudents = filteredStudents.filter(s => !AppState.activeCheckinStates[s.id] || s.id === AppState.lastCheckedStuId);
    }

    const allChecked = filteredStudents.every(s => AppState.activeCheckinStates[s.id]);

    // จัดเรียง: ล่าสุดอยู่บนสุด -> ยังไม่เช็คอยู่กลาง -> เช็คแล้วไปล่างสุด (จนกว่าจะครบ)
    filteredStudents.sort((a, b) => {
        if (!allChecked) {
            const getWeight = (stu) => {
                if (stu.id === AppState.lastCheckedStuId) return 0; // ล่าสุดอยู่บนสุด
                if (AppState.activeCheckinStates[stu.id]) return 2; // เช็คแล้วไปล่างสุด
                return 1; // ยังไม่เช็คอยู่ตรงกลาง
            };
            const weightA = getWeight(a);
            const weightB = getWeight(b);
            if (weightA !== weightB) return weightA - weightB;
        }

        const numA = parseInt(a.number) || 9999;
        const numB = parseInt(b.number) || 9999;
        if (numA !== numB) return numA - numB;
        return (a.studentId || '').toString().localeCompare((b.studentId || '').toString());
    });
    const tbody = document.getElementById('checkin-table-body');
    tbody.innerHTML = '';

    filteredStudents.forEach(stu => {
        const status = AppState.activeCheckinStates[stu.id] || '';
        const radioHtml = ['มา','สาย','ลา','ขาด'].map(st => `
            <input type="radio" id="a_${stu.id}_${st}" name="a_${stu.id}" value="${st}" ${status===st?'checked':''} onchange="onAttendanceChange('${stu.id}', '${st}')">
             <label for="a_${stu.id}_${st}">${st}</label>
        `).join('');
        
        const fullName = getStudentFullName(stu);
        
        tbody.innerHTML += `<tr class="hover:bg-gray-50 transition-colors">
            <td class="px-6 py-4 text-sm font-semibold text-gray-500 hidden md:table-cell" data-label="เลขที่">${stu.number}</td>
            <td class="px-6 py-4 text-sm font-mono text-gray-600 hidden md:table-cell" data-label="รหัสประจำตัว">${stu.studentId}</td>
            <td class="px-6 py-4 td-name" data-label="ชื่อ - นามสกุล">
                <div class="td-name-content">${fullName}</div>
                <div class="td-meta-content md:hidden">เลขที่ ${stu.number} | รหัส: ${stu.studentId}</div>
            </td>
            <td class="px-6 py-4 text-center td-actions whitespace-nowrap" data-label="สถานะ">
                <div class="attendance-radio">${radioHtml}</div>
            </td>
        </tr>`;
    });
}

export function onAttendanceChange(stuId, status) {
    AppState.activeCheckinStates[stuId] = status;
    AppState.lastCheckedStuId = stuId;
    renderCheckinTable(); 
}

export function setAllAttendance(st) { 
    AppState.currentCheckinStudents.forEach(stu => { 
        AppState.activeCheckinStates[stu.id] = st;
    }); 
    AppState.lastCheckedStuId = null;
    renderCheckinTable();
}

export async function saveAttendance() {
    const date = document.getElementById('checkin-date').value; 
    const period = document.getElementById('checkin-period').value;
    const clsId = document.getElementById('checkin-class').value; 
    const subId = document.getElementById('checkin-subject').value; 
    const teacherSelect = document.getElementById('checkin-teacher');
    const tId = teacherSelect.value;
    const clsObj = AppState.allClasses.find(c => c.id === clsId);
    const clsName = clsObj ? clsObj.className : clsId;
    const subObj = AppState.allSubjects.find(s => s.id === subId);
    const subName = subObj ? subObj.name : subId;
    const tObj = AppState.allTeachers.find(t => t.id === tId && t.deleted_flg !== 'Y');
    const teacher = tObj ? `${tObj.firstName} ${tObj.lastName}` : teacherSelect.options[teacherSelect.selectedIndex].text;
    const yr = parseInt(document.getElementById('checkin-year').value);
    const sem = parseInt(document.getElementById('checkin-semester').value);

    const now = getISOTimestamp();
    const userId = getCurrentUserId();

    if (!AppState.currentCheckinStudents || AppState.currentCheckinStudents.length === 0) return;

    const att = AppState.currentCheckinStudents.map(stu => ({ 
        studentId: stu.id, 
        status: AppState.activeCheckinStates[stu.id] || 'ขาด'
    }));

    const existRecIdx = AppState.allRecords.findIndex(r => getBangkokDate(r.date)===date && String(r.period||'')===String(period||'') && (r.classId === clsId || (!r.classId && r.class===clsName)) && (r.subjectId === subId || (!r.subjectId && r.subject===subName)) && matchRecordYearSemester(r, yr, sem) && r.deleted_flg !== 'Y');
    
    let record;
    if (existRecIdx > -1) { // Update
        record = {
            ...AppState.allRecords[existRecIdx],
            classId: clsId, class: clsName,
            subjectId: subId, subject: subName,
            teacherId: tId, teacher,
            attendance: att,
            updatedAt: now,
            updatedBy: userId,
        };
        AppState.allRecords[existRecIdx] = record;
    } else { // Create
        const localTimestampStr = date + 'T' + getBangkokCurrentTime();
        const utcDate = new Date(localTimestampStr + "+07:00").toISOString();
        record = { 
            id: generateId(), date: utcDate, period: period, classId: clsId, class: clsName, subjectId: subId, subject: subName, teacherId: tId, teacher, year: yr, semester: sem, attendance: att,
            createdAt: now, createdBy: userId,
            updatedAt: now, updatedBy: userId,
            deleted_flg: 'N', deletedAt: null, deletedBy: null,
        };
        AppState.allRecords.push(record);
    }

    await saveToDB(DB_KEYS.RECORDS, AppState.allRecords, 'saveRecords');
    showToast('บันทึกการเช็คชื่อเรียบร้อย');
}

export function exportCheckinCSV() {
    const date = document.getElementById('checkin-date').value;
    const period = document.getElementById('checkin-period').value;
    const clsId = document.getElementById('checkin-class').value;
    const subId = document.getElementById('checkin-subject').value;
    const teacherSelect = document.getElementById('checkin-teacher');
    const tId = teacherSelect.value;
    const clsObj = AppState.allClasses.find(c => c.id === clsId);
    const clsName = clsObj ? clsObj.className : clsId;
    const subObj = AppState.allSubjects.find(s => s.id === subId);
    const subName = subObj ? subObj.name : subId;
    const tObj = AppState.allTeachers.find(t => t.id === tId && t.deleted_flg !== 'Y');
    const teacher = tObj ? `${tObj.firstName} ${tObj.lastName}` : teacherSelect.options[teacherSelect.selectedIndex].text;
    const yr = document.getElementById('checkin-year').value;
    const sem = document.getElementById('checkin-semester').value;

    if(!AppState.currentCheckinStudents || AppState.currentCheckinStudents.length === 0) return;

    const headers = ['เลขที่', 'รหัสประจำตัว', 'ชื่อ-นามสกุล', 'สถานะการเช็ค', 'วันที่', 'คาบเรียน', 'ชั้นเรียน', 'วิชา', 'ครูผู้สอน', 'ปีการศึกษา', 'ภาคเรียน'];
    const rows = AppState.currentCheckinStudents.map(stu => {
        const status = AppState.activeCheckinStates[stu.id] || 'ยังไม่ได้เช็ค';
        return [stu.number, stu.studentId, getStudentFullName(stu), status, date, period, clsName, subName, teacher, yr, sem];
    });

    exportToCSV(`รายงานเช็คชื่อ_${clsName}_${subName}_${date}_คาบ${period}.csv`, headers, rows);
    showToast('ส่งออกไฟล์ CSV เรียบร้อย');
}

window.resetCheckinTable = resetCheckinTable;
window.loadCheckinList = loadCheckinList;
window.renderCheckinTable = renderCheckinTable;
window.onAttendanceChange = onAttendanceChange;
window.setAllAttendance = setAllAttendance;
window.saveAttendance = saveAttendance;
window.exportCheckinCSV = exportCheckinCSV;