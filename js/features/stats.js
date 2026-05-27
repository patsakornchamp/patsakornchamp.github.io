import { AppState } from '../core/state.js';
import { getBangkokDate, getBangkokDateTime, getStudentFullName, matchRecordYearSemester, getYearSemesterFromDate, exportToCSV, customAlert, showToast } from '../utils/helpers.js';
import { syncDataFromServer } from '../services/api.js';

export function onStatsTypeChange(skipSync = false) {
    const type = document.getElementById('stats-type').value;
    const yr = document.getElementById('stats-year').value;
    const sem = document.getElementById('stats-semester').value;

    const currentSubjectValue = document.getElementById('stats-subject')?.value; // Get current subject value to try and retain it

    if (type === 'regular') {
        document.getElementById('lbl-stats-class-or-club').innerText = 'ชั้นเรียน';
        document.getElementById('lbl-stats-sub').style.display = 'block';
        document.getElementById('stats-subject').style.display = 'block';
        document.getElementById('lbl-th-class').innerText = 'ชั้น/เลขที่';
        if(window.updateClassDropdown) window.updateClassDropdown(yr, sem, 'stats-class', '-- เลือกชั้นเรียน --');
    } else {
        document.getElementById('lbl-stats-class-or-club').innerText = 'วิชาชุมนุม';
        document.getElementById('lbl-stats-sub').style.display = 'none';
        document.getElementById('stats-subject').style.display = 'none';
        document.getElementById('lbl-th-class').innerText = 'ชั้นเรียนหลัก';
        if(window.updateClubDropdown) window.updateClubDropdown(yr, sem, 'stats-class', '-- เลือกชุมนุม --');
    }
    renderStats(skipSync);
}

export async function renderStats(skipSync = false) {
    const type = document.getElementById('stats-type').value;
    const yr = document.getElementById('stats-year').value;
    const sem = document.getElementById('stats-semester').value;
    const statsClassOrClub = document.getElementById('stats-class').value; 
    const statsSub = document.getElementById('stats-subject').value;

    const btnExport = document.getElementById('btn-export-stats');

    if (type === 'regular') {
        if(!statsClassOrClub || !statsSub || !yr || !sem) { 
            document.getElementById('stats-empty-msg').classList.remove('hidden'); 
            document.getElementById('stats-content').classList.add('hidden'); 
            if (btnExport) btnExport.classList.add('hidden');
            return; 
        }

        if (skipSync !== true) await syncDataFromServer();

        document.getElementById('stats-empty-msg').classList.add('hidden'); 
        document.getElementById('stats-content').classList.remove('hidden');
        if (btnExport) btnExport.classList.remove('hidden');
        
        const stus = AppState.allStudents.filter(x=>x.class===statsClassOrClub && x.status !== 'ลาออก' && x.deleted_flg !== 'Y').sort((a,b)=>a.number-b.number);
        let recs = AppState.allRecords.filter(x=>x.class===statsClassOrClub && (statsSub === 'all' || x.subject===statsSub) && matchRecordYearSemester(x, yr, sem) && x.deleted_flg !== 'Y');
        
        let summary = {มา:0,สาย:0,ลา:0,ขาด:0}; 
        const tbody = document.getElementById('stats-table-body'); 
        tbody.innerHTML='';
        const lblThClass = document.getElementById('lbl-th-class').innerText;
        
        stus.forEach(stu => {
            let mstat = {มา:0,สาย:0,ลา:0,ขาด:0};
            recs.forEach(r => { const a=r.attendance.find(x=>x.studentId===stu.id); if(a) mstat[a.status]++; else mstat['ขาด']++; });
            ['มา','สาย','ลา','ขาด'].forEach(k=>summary[k]+=mstat[k]);
            const pct = recs.length===0 ? 0 : Math.round(((mstat['มา']+mstat['สาย'])/recs.length)*100);
            tbody.innerHTML += `<tr>
                <td class="hidden md:table-cell px-6 py-4 text-sm" data-label="${lblThClass}">${stu.class} เลขที่ ${stu.number}</td>
                <td class="px-6 py-4 td-name" data-label="ชื่อ - นามสกุล">
                    <div class="td-name-content font-semibold text-blue-700 cursor-pointer hover:underline" onclick="openDrilldownModal('${stu.id}', 'regular', '${statsSub}', '${yr}', '${sem}')">
                        <i class="fas fa-search-plus mr-1"></i> ${getStudentFullName(stu)}
                    </div>
                    <div class="td-meta-content hidden md:block">รหัส: ${stu.studentId}</div>
                </td>
                <td class="text-center" data-label="มา">${mstat['มา']}</td>
                <td class="text-center" data-label="สาย">${mstat['สาย']}</td>
                <td class="text-center" data-label="ลา">${mstat['ลา']}</td>
                <td class="text-center" data-label="ขาด">${mstat['ขาด']}</td>
                <td class="text-center font-bold text-green-700" data-label="% เข้าเรียน">${pct}%</td>
            </tr>`;
        });
        
        document.getElementById('stat-total-present').innerText=summary['มา']; 
        document.getElementById('stat-total-late').innerText=summary['สาย']; 
        document.getElementById('stat-total-leave').innerText=summary['ลา']; 
        document.getElementById('stat-total-absent').innerText=summary['ขาด'];
    } 
    else {
        if(!statsClassOrClub || !yr || !sem) { 
            document.getElementById('stats-empty-msg').classList.remove('hidden'); 
            document.getElementById('stats-content').classList.add('hidden'); 
            if (btnExport) btnExport.classList.add('hidden');
            return; 
        }

        if (skipSync !== true) await syncDataFromServer();

        document.getElementById('stats-empty-msg').classList.add('hidden'); 
        document.getElementById('stats-content').classList.remove('hidden');
        if (btnExport) btnExport.classList.remove('hidden');

        const enrollments = AppState.allClubEnrollments.filter(e => e.clubId === statsClassOrClub && e.year == yr && e.semester == sem && e.deleted_flg !== 'Y');
        const enrolledStudentIds = enrollments.map(e => e.studentId);
        const stus = AppState.allStudents.filter(x => enrolledStudentIds.includes(x.id) && x.status !== 'ลาออก' && x.deleted_flg !== 'Y').sort((a,b)=>a.class.localeCompare(b.class, undefined, { numeric: true }) || a.number-b.number);
        
        let recs = AppState.allClubRecords.filter(x => x.clubId === statsClassOrClub && matchRecordYearSemester(x, yr, sem) && x.deleted_flg !== 'Y');

        let summary = {มา:0,สาย:0,ลา:0,ขาด:0}; 
        const tbody = document.getElementById('stats-table-body'); 
        tbody.innerHTML='';
        const lblThClass = document.getElementById('lbl-th-class').innerText;

        stus.forEach(stu => {
            let mstat = {มา:0,สาย:0,ลา:0,ขาด:0};
            recs.forEach(r => { const a=r.attendance.find(x=>x.studentId===stu.id); if(a) mstat[a.status]++; else mstat['ขาด']++; });
            ['มา','สาย','ลา','ขาด'].forEach(k=>summary[k]+=mstat[k]);
            const pct = recs.length===0 ? 0 : Math.round(((mstat['มา']+mstat['สาย'])/recs.length)*100);
            
            tbody.innerHTML += `<tr>
                <td class="hidden md:table-cell px-6 py-4 text-sm" data-label="${lblThClass}">${stu.class} เลขที่ ${stu.number}</td>
                <td class="px-6 py-4 td-name" data-label="ชื่อ - นามสกุล">
                    <div class="td-name-content font-semibold text-green-700 cursor-pointer hover:underline" onclick="openDrilldownModal('${stu.id}', 'club', '${statsClassOrClub}', '${yr}', '${sem}')">
                        <i class="fas fa-search-plus mr-1"></i> ${getStudentFullName(stu)}
                    </div>
                    <div class="td-meta-content hidden md:block">รหัส: ${stu.studentId}</div>
                </td>
                <td class="text-center" data-label="มา">${mstat['มา']}</td>
                <td class="text-center" data-label="สาย">${mstat['สาย']}</td>
                <td class="text-center" data-label="ลา">${mstat['ลา']}</td>
                <td class="text-center" data-label="ขาด">${mstat['ขาด']}</td>
                <td class="text-center font-bold text-green-700" data-label="% เข้าร่วม">${pct}%</td>
            </tr>`;
        });

        document.getElementById('stat-total-present').innerText=summary['มา']; 
        document.getElementById('stat-total-late').innerText=summary['สาย']; 
        document.getElementById('stat-total-leave').innerText=summary['ลา']; 
        document.getElementById('stat-total-absent').innerText=summary['ขาด'];
    }
}

export function exportStatsCSV() {
    const type = document.getElementById('stats-type').value;
    const c = document.getElementById('stats-class').value;
    const s = document.getElementById('stats-subject').value;
    const yr = document.getElementById('stats-year').value;
    const sem = document.getElementById('stats-semester').value;

    if(type === 'regular') {
        if(!c || !s || !yr || !sem) return customAlert('กรุณาเลือกเงื่อนไขก่อนส่งออก');
        const stus = AppState.allStudents.filter(x=>x.class===c && x.status !== 'ลาออก' && x.deleted_flg !== 'Y').sort((a,b)=>a.number-b.number);
        let textRecs = AppState.allRecords.filter(x=>x.class===c && (s === 'all' || x.subject===s) && matchRecordYearSemester(x, yr, sem) && x.deleted_flg !== 'Y');

        const headers = ['เลขที่', 'รหัสประจำตัว', 'ชื่อ-นามสกุล', 'มาเรียน', 'มาสาย', 'ลา', 'ขาดเรียน', 'เปอร์เซ็นต์เข้าเรียน', 'ชั้นเรียน', 'วิชา', 'ปีการศึกษา', 'ภาคเรียน', 'จำนวนครั้งทั้งหมด'];
        const rows = stus.map(stu => {
            let mstat = {มา:0,สาย:0,ลา:0,ขาด:0};
            textRecs.forEach(r => { const a=r.attendance.find(x=>x.studentId===stu.id); if(a) mstat[a.status]++; else mstat['ขาด']++; });
            const pct = textRecs.length===0 ? 0 : Math.round(((mstat['มา']+mstat['สาย'])/textRecs.length)*100);
            return [stu.number, stu.studentId, getStudentFullName(stu), mstat['มา'], mstat['สาย'], mstat['ลา'], mstat['ขาด'], `${pct}%`, c, s === 'all' ? 'รวมทุกวิชา' : s, yr, sem, textRecs.length];
        });
        exportToCSV(`สถิติปกติ_${c}_${s === 'all' ? 'รวมทุกวิชา' : s}.csv`, headers, rows);
    } else {
        if(!c || !yr || !sem) return customAlert('กรุณาเลือกเงื่อนไขก่อนส่งออก');
        const enrollments = AppState.allClubEnrollments.filter(e => e.clubId === c && e.year == yr && e.semester == sem && e.deleted_flg !== 'Y');
        const enrolledStudentIds = enrollments.map(e => e.studentId);
        const stus = AppState.allStudents.filter(x => enrolledStudentIds.includes(x.id) && x.status !== 'ลาออก' && x.deleted_flg !== 'Y');
        let textRecs = AppState.allClubRecords.filter(x => x.clubId === c && matchRecordYearSemester(x, yr, sem) && x.deleted_flg !== 'Y');
        const club = AppState.allClubs.find(cl => cl.id === c && cl.deleted_flg !== 'Y');

        const headers = ['ชั้นเรียน', 'เลขที่', 'รหัสประจำตัว', 'ชื่อ-นามสกุล', 'มาชุมนุม', 'มาสาย', 'ลา', 'ขาดชุมนุม', 'เปอร์เซ็นต์เข้าร่วม', 'ชุมนุม', 'ปีการศึกษา', 'ภาคเรียน', 'จำนวนครั้งกิจกรรม'];
        const rows = stus.map(stu => {
            let mstat = {มา:0,สาย:0,ลา:0,ขาด:0};
            textRecs.forEach(r => { const a=r.attendance.find(x=>x.studentId===stu.id); if(a) mstat[a.status]++; else mstat['ขาด']++; });
            const pct = textRecs.length===0 ? 0 : Math.round(((mstat['มา']+mstat['สาย'])/textRecs.length)*100);
            return [stu.class, stu.number, stu.studentId, getStudentFullName(stu), mstat['มา'], mstat['สาย'], mstat['ลา'], mstat['ขาด'], `${pct}%`, club?club.name:'', yr, sem, textRecs.length];
        });
        exportToCSV(`สถิติชุมนุม_${club?club.name:''}.csv`, headers, rows);
    }
    showToast('ส่งออกสถิติเรียบร้อย');
}

export function openDrilldownModal(stuId, type, filterValue, academicYear, academicSemester) {
    const student = AppState.allStudents.find(s => s.id === stuId && s.deleted_flg !== 'Y');
    if(!student) return;

    document.getElementById('dd-student-name').innerText = getStudentFullName(student);
    document.getElementById('dd-student-meta').innerText = `ระดับชั้น: ${student.class} | เลขที่: ${student.number} | รหัสประจำตัว: ${student.studentId}`;
    
    const tbody = document.getElementById('dd-table-body');
    tbody.innerHTML = '';

    if (type === 'regular') {
        document.getElementById('dd-subject-title').innerHTML = `<i class="fas fa-book mr-1 text-blue-600"></i> วิชาเรียนปกติ: ${filterValue === 'all' ? 'รวมทุกวิชา' : filterValue}`;
        
        const recs = AppState.allRecords.filter(r => (filterValue === 'all' || r.subject === filterValue) && matchRecordYearSemester(r, academicYear, academicSemester) && r.deleted_flg !== 'Y');
        recs.sort((a,b) => new Date(a.date) - new Date(b.date));
        
        recs.forEach(r => {
            const myAtt = r.attendance.find(a => a.studentId === stuId);
            if (!myAtt) return; // ข้ามคาบที่ไม่ได้มีการเช็คชื่อนักเรียนคนนี้
            const statusVal = myAtt.status;
            const colorMap = { 'มา': 'text-green-600', 'สาย': 'text-yellow-600', 'ลา': 'text-blue-600', 'ขาด': 'text-red-600' };
            const subLabel = filterValue === 'all' ? `<br><span class="text-xs text-blue-500">${r.subject}</span>` : '';
            
            tbody.innerHTML += `<tr>
                <td class="px-4 py-2 font-mono text-sm">${getBangkokDateTime(r.date)}${subLabel}</td>
                <td class="px-4 py-2 text-center font-bold text-sm ${colorMap[statusVal] || 'text-red-500'}">${statusVal}</td>
            </tr>`;
        });
    } else {
        const club = AppState.allClubs.find(c => c.id === filterValue && c.deleted_flg !== 'Y');
        document.getElementById('dd-subject-title').innerHTML = `<i class="fas fa-users mr-1 text-green-600"></i> วิชาชุมนุม: ${club ? club.name : 'ไม่ระบุ'}`;
        
        const recs = AppState.allClubRecords.filter(r => r.clubId === filterValue && matchRecordYearSemester(r, academicYear, academicSemester) && r.deleted_flg !== 'Y');
        recs.sort((a,b) => new Date(a.date) - new Date(b.date));
        
        recs.forEach(r => {
            const myAtt = r.attendance.find(a => a.studentId === stuId);
            if (!myAtt) return; // ข้ามคาบที่ไม่ได้มีการเช็คชื่อนักเรียนคนนี้
            const statusVal = myAtt.status;
            const colorMap = { 'มา': 'text-green-600', 'สาย': 'text-yellow-600', 'ลา': 'text-blue-600', 'ขาด': 'text-red-600' };

            tbody.innerHTML += `<tr>
                <td class="px-4 py-2 font-mono text-sm">${getBangkokDateTime(r.date)}</td>
                <td class="px-4 py-2 text-center font-bold text-sm ${colorMap[statusVal] || 'text-red-500'}">${statusVal}</td>
            </tr>`;
        });
    }

    if(tbody.innerHTML === '') {
        tbody.innerHTML = `<tr><td colspan="2" class="text-center py-4 text-xs text-gray-500">ยังไม่มีการบันทึกคาบเรียนในระบบ</td></tr>`;
    }

    document.getElementById('student-drilldown-modal').classList.add('show');
}

export function openSessionDrilldownModal(recordId, type) {
    const containers = document.querySelectorAll('#session-drilldown-modal #sd-list-container');
    if (containers.length === 0) return;

    containers.forEach(c => c.innerHTML = '');
    
    let record;
    if (type === 'regular') {
        record = AppState.allRecords.find(r => r.id === recordId && r.deleted_flg !== 'Y');
        if (!record) return;
        const rYr = record.year !== undefined ? record.year : getYearSemesterFromDate(record.date).year;
        const rSem = record.semester !== undefined ? record.semester : getYearSemesterFromDate(record.date).semester;
        document.querySelectorAll('#sd-session-title').forEach(el => el.innerHTML = `<i class="fas fa-calendar-day mr-2 text-blue-600"></i>${getBangkokDate(record.date)} (คาบ: ${record.period || '-'} | ปีการศึกษา ${rYr} ภาคเรียน ${rSem})`);
        document.querySelectorAll('#sd-session-meta').forEach(el => el.innerText = `ชั้นเรียน: ${record.class} | วิชา: ${record.subject} | ครู: ${record.teacher||'-'}`);
    } else {
        record = AppState.allClubRecords.find(r => r.id === recordId && r.deleted_flg !== 'Y');
        if (!record) return;
        const club = AppState.allClubs.find(c => c.id === record.clubId && c.deleted_flg !== 'Y');
        const rYr = record.year !== undefined ? record.year : getYearSemesterFromDate(record.date).year;
        const rSem = record.semester !== undefined ? record.semester : getYearSemesterFromDate(record.date).semester;
        document.querySelectorAll('#sd-session-title').forEach(el => el.innerHTML = `<i class="fas fa-calendar-day mr-2 text-green-600"></i>${getBangkokDate(record.date)} (กิจกรรมวิชาชุมนุม - ปี ${rYr}/${rSem})`);
        document.querySelectorAll('#sd-session-meta').forEach(el => el.innerText = `ชุมนุม: ${club ? club.name : 'ไม่พบข้อมูลชุมนุม'}`);
    }

    const badgeColorMap = { 'มา': 'bg-green-100 text-green-800', 'สาย': 'bg-yellow-100 text-yellow-800', 'ลา': 'bg-blue-100 text-blue-800', 'ขาด': 'bg-red-100 text-red-800' };
    const attendanceDetails = [];
    record.attendance.forEach(a => {
        const stu = AppState.allStudents.find(s => s.id === a.studentId && s.deleted_flg !== 'Y');
        if (stu) {
            attendanceDetails.push({ number: stu.number || 999, name: getStudentFullName(stu), status: a.status });
        }
    });

    let summary = { 'มา': 0, 'สาย': 0, 'ลา': 0, 'ขาด': 0 };
    let listHtml = '';

    attendanceDetails.sort((a, b) => a.number - b.number);
    attendanceDetails.forEach(a => {
        if (summary[a.status] !== undefined) summary[a.status]++; else summary['ขาด']++;
        const badgeClass = badgeColorMap[a.status] || 'bg-gray-100 text-gray-800';
        listHtml += `
            <div class="bg-white p-3 rounded-lg border flex justify-between items-center gap-4">
                <div>
                    <p class="font-bold text-gray-800 text-sm">${a.name}</p>
                    <p class="text-xs text-gray-500 mt-1">เลขที่: ${a.number === 999 ? '-' : a.number}</p>
                </div>
                <span class="px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap ${badgeClass}">${a.status}</span>
            </div>
        `;
    });

    containers.forEach(c => c.innerHTML = listHtml);

    document.querySelectorAll('#sd-summary-present').forEach(el => el.innerText = summary['มา']);
    document.querySelectorAll('#sd-summary-late').forEach(el => el.innerText = summary['สาย']);
    document.querySelectorAll('#sd-summary-leave').forEach(el => el.innerText = summary['ลา']);
    document.querySelectorAll('#sd-summary-absent').forEach(el => el.innerText = summary['ขาด']);

    const delBtn = document.getElementById('btn-delete-record');
    if (delBtn) {
        if (AppState.currentUser && (AppState.currentUser.role === 'admin' || AppState.currentUser.role === 'teacher')) {
            delBtn.classList.remove('hidden');
            delBtn.onclick = () => { if (window.deleteSessionRecord) window.deleteSessionRecord(recordId, type); };
        } else {
            delBtn.classList.add('hidden');
        }
    }

    document.getElementById('session-drilldown-modal').classList.add('show');
}

// ผูกฟังก์ชันเข้า Window
window.onStatsTypeChange = onStatsTypeChange;
window.renderStats = renderStats;
window.exportStatsCSV = exportStatsCSV;
window.openDrilldownModal = openDrilldownModal;
window.openSessionDrilldownModal = openSessionDrilldownModal;