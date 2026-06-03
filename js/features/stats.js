import { AppState } from '../core/state.js';
import { getBangkokDate, getBangkokDateTime, getStudentFullName, matchRecordYearSemester, getYearSemesterFromDate, exportToCSV, customAlert, showToast } from '../utils/helpers.js';
import { syncDataFromServer } from '../services/api.js';

// ฟังก์ชันสำหรับคำนวณชื่อคอลัมน์ Excel (เช่น 1 = A, 27 = AA)
function getColLetter(colIndex) {
    let letter = '';
    while (colIndex > 0) {
        let temp = (colIndex - 1) % 26;
        letter = String.fromCharCode(temp + 65) + letter;
        colIndex = (colIndex - temp - 1) / 26;
    }
    return letter;
}

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
        document.getElementById('stats-subject').innerHTML = '<option value="">-- กรุณาเลือกชั้นเรียนก่อน --</option>';
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
    const statsClassOrClubId = document.getElementById('stats-class').value; 
    const statsSubId = document.getElementById('stats-subject').value;

    const btnExport = document.getElementById('export-btn-container');

    if (type === 'regular') {
        if(!statsClassOrClubId || !statsSubId || !yr || !sem) { 
            document.getElementById('stats-empty-msg').classList.remove('hidden'); 
            document.getElementById('stats-content').classList.add('hidden'); 
            if (btnExport) btnExport.classList.add('hidden');
            return; 
        }

        if (skipSync !== true) await syncDataFromServer();

        document.getElementById('stats-empty-msg').classList.add('hidden'); 
        document.getElementById('stats-content').classList.remove('hidden');
        if (btnExport) btnExport.classList.remove('hidden');
        
        const clsObj = AppState.allClasses.find(c => c.id === statsClassOrClubId);
        const className = clsObj ? clsObj.className : statsClassOrClubId;
        const subObj = AppState.allSubjects.find(s => s.id === statsSubId);
        const subName = subObj ? subObj.name : statsSubId;

        const stus = AppState.allStudents.filter(x=>x.class===className && x.status !== 'ลาออก' && x.deleted_flg !== 'Y').sort((a,b)=>a.number-b.number);
        let recs = AppState.allRecords.filter(x=>(x.classId === statsClassOrClubId || (!x.classId && x.class===className)) && (statsSubId === 'all' || x.subjectId === statsSubId || (!x.subjectId && x.subject===subName)) && matchRecordYearSemester(x, yr, sem) && x.deleted_flg !== 'Y');
        
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
                    <div class="td-name-content font-semibold text-blue-700 cursor-pointer hover:underline" onclick="openDrilldownModal('${stu.id}', 'regular', '${statsSubId}', '${yr}', '${sem}')">
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
        if(!statsClassOrClubId || !yr || !sem) { 
            document.getElementById('stats-empty-msg').classList.remove('hidden'); 
            document.getElementById('stats-content').classList.add('hidden'); 
            if (btnExport) btnExport.classList.add('hidden');
            return; 
        }

        if (skipSync !== true) await syncDataFromServer();

        document.getElementById('stats-empty-msg').classList.add('hidden'); 
        document.getElementById('stats-content').classList.remove('hidden');
        if (btnExport) btnExport.classList.remove('hidden');

        const enrollments = AppState.allClubEnrollments.filter(e => e.clubId === statsClassOrClubId && e.year == yr && e.semester == sem && e.deleted_flg !== 'Y');
        const enrolledStudentIds = enrollments.map(e => e.studentId);
        const stus = AppState.allStudents.filter(x => enrolledStudentIds.includes(x.id) && x.status !== 'ลาออก' && x.deleted_flg !== 'Y').sort((a,b)=>a.class.localeCompare(b.class, undefined, { numeric: true }) || a.number-b.number);
        
        let recs = AppState.allClubRecords.filter(x => x.clubId === statsClassOrClubId && matchRecordYearSemester(x, yr, sem) && x.deleted_flg !== 'Y');

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
                    <div class="td-name-content font-semibold text-green-700 cursor-pointer hover:underline" onclick="openDrilldownModal('${stu.id}', 'club', '${statsClassOrClubId}', '${yr}', '${sem}')">
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
    const statsClassOrClubId = document.getElementById('stats-class').value;
    const statsSubId = document.getElementById('stats-subject').value;
    const yr = document.getElementById('stats-year').value;
    const sem = document.getElementById('stats-semester').value;

    if(!statsClassOrClubId || !yr || !sem || (type === 'regular' && !statsSubId)) return customAlert('กรุณาเลือกเงื่อนไขก่อนส่งออก');

    let stus, textRecs, fileName;
    if(type === 'regular') {
        const clsObj = AppState.allClasses.find(c => c.id === statsClassOrClubId);
        const className = clsObj ? clsObj.className : statsClassOrClubId;
        const subObj = AppState.allSubjects.find(s => s.id === statsSubId);
        const subName = subObj ? subObj.name : statsSubId;

        stus = AppState.allStudents.filter(x=>x.class===className && x.status !== 'ลาออก' && x.deleted_flg !== 'Y').sort((a,b)=>a.number-b.number);
        textRecs = AppState.allRecords.filter(x=>(x.classId === statsClassOrClubId || (!x.classId && x.class === className)) && (statsSubId === 'all' || x.subjectId === statsSubId || (!x.subjectId && x.subject === subName)) && matchRecordYearSemester(x, yr, sem) && x.deleted_flg !== 'Y');
        fileName = `สถิติปกติ_${className}_${statsSubId === 'all' ? 'รวมทุกวิชา' : subName}.csv`;
    } else {
        const enrollments = AppState.allClubEnrollments.filter(e => e.clubId === statsClassOrClubId && e.year == yr && e.semester == sem && e.deleted_flg !== 'Y');
        const enrolledStudentIds = enrollments.map(e => e.studentId);
        stus = AppState.allStudents.filter(x => enrolledStudentIds.includes(x.id) && x.status !== 'ลาออก' && x.deleted_flg !== 'Y').sort((a,b)=>a.number-b.number);
        textRecs = AppState.allClubRecords.filter(x => x.clubId === statsClassOrClubId && matchRecordYearSemester(x, yr, sem) && x.deleted_flg !== 'Y');
        const club = AppState.allClubs.find(cl => cl.id === statsClassOrClubId && cl.deleted_flg !== 'Y');
        fileName = `สถิติชุมนุม_${club?club.name:''}.csv`;
    }

    if (textRecs.length === 0) return customAlert('ไม่พบข้อมูลการเช็คชื่อสำหรับสร้างตาราง');
    
    textRecs.sort((a,b) => new Date(a.date) - new Date(b.date));
    const dateHeaders = textRecs.map(r => `${getBangkokDate(r.date)}${r.period ? ' (คาบ ' + r.period + ')' : ''}`);
    
    const headers = ['เลขที่', 'รหัสประจำตัว', 'ชื่อ-นามสกุล', ...dateHeaders, 'รวมมา', 'รวมขาด', 'รวมลา', 'รวมสาย', 'รวมทั้งหมด'];
    const rows = stus.map(stu => {
        const rowData = [stu.number, stu.studentId, getStudentFullName(stu)];
        let mstat = {มา:0, ขาด:0, ลา:0, สาย:0};
        
        textRecs.forEach(r => {
            const att = r.attendance.find(x => x.studentId === stu.id);
            let val = 'ข'; // ค่าเริ่มต้นถ้าไม่มีข้อมูล
            if(att) {
                if(att.status === 'มา') { val = 'ม'; mstat['มา']++; }
                else if(att.status === 'ขาด') { val = 'ข'; mstat['ขาด']++; }
                else if(att.status === 'ลา') { val = 'ล'; mstat['ลา']++; }
                else if(att.status === 'สาย') { val = 'ส'; mstat['สาย']++; }
            } else { mstat['ขาด']++; }
            rowData.push(val);
        });
        
        const total = mstat['มา'] + mstat['ขาด'] + mstat['ลา'] + mstat['สาย'];
        rowData.push(mstat['มา'], mstat['ขาด'], mstat['ลา'], mstat['สาย'], total);
        return rowData;
    });
    
    exportToCSV(fileName, headers, rows);
    showToast('ส่งออกสถิติ (CSV) เรียบร้อย');
}

export async function exportStatsExcel() {
    const type = document.getElementById('stats-type').value;
    const statsClassOrClubId = document.getElementById('stats-class').value;
    const statsSubId = document.getElementById('stats-subject').value;
    const yr = document.getElementById('stats-year').value;
    const sem = document.getElementById('stats-semester').value;

    if(!statsClassOrClubId || !yr || !sem || (type === 'regular' && !statsSubId)) return customAlert('กรุณาเลือกเงื่อนไขก่อนส่งออก');

    let stus, textRecs, fileName;
    if(type === 'regular') {
        const clsObj = AppState.allClasses.find(c => c.id === statsClassOrClubId);
        const className = clsObj ? clsObj.className : statsClassOrClubId;
        const subObj = AppState.allSubjects.find(s => s.id === statsSubId);
        const subName = subObj ? subObj.name : statsSubId;

        stus = AppState.allStudents.filter(x=>x.class===className && x.status !== 'ลาออก' && x.deleted_flg !== 'Y').sort((a,b)=>a.number-b.number);
        textRecs = AppState.allRecords.filter(x=>(x.classId === statsClassOrClubId || (!x.classId && x.class === className)) && (statsSubId === 'all' || x.subjectId === statsSubId || (!x.subjectId && x.subject === subName)) && matchRecordYearSemester(x, yr, sem) && x.deleted_flg !== 'Y');
        fileName = `สถิติปกติ_${className}_${statsSubId === 'all' ? 'รวมทุกวิชา' : subName}.xlsx`;
    } else {
        const enrollments = AppState.allClubEnrollments.filter(e => e.clubId === statsClassOrClubId && e.year == yr && e.semester == sem && e.deleted_flg !== 'Y');
        const enrolledStudentIds = enrollments.map(e => e.studentId);
        stus = AppState.allStudents.filter(x => enrolledStudentIds.includes(x.id) && x.status !== 'ลาออก' && x.deleted_flg !== 'Y').sort((a,b)=>a.number-b.number);
        textRecs = AppState.allClubRecords.filter(x => x.clubId === statsClassOrClubId && matchRecordYearSemester(x, yr, sem) && x.deleted_flg !== 'Y');
        const club = AppState.allClubs.find(cl => cl.id === statsClassOrClubId && cl.deleted_flg !== 'Y');
        fileName = `สถิติชุมนุม_${club?club.name:''}.xlsx`;
    }

    if (textRecs.length === 0) return customAlert('ไม่พบข้อมูลการเช็คชื่อสำหรับสร้างตาราง');

    if (!window.ExcelJS) return customAlert('ไม่สามารถโหลดไลบรารี Excel ได้ โปรดรีเฟรชหน้าเว็บแล้วลองใหม่');
    
    textRecs.sort((a,b) => new Date(a.date) - new Date(b.date));
    const dateHeaders = textRecs.map(r => `${getBangkokDate(r.date)}${r.period ? '\n(คาบ ' + r.period + ')' : ''}`);
    
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Attendance Record');

    // 1. หัวตาราง
    const headers = ['เลขที่', 'รหัสประจำตัว', 'ชื่อ-นามสกุล', ...dateHeaders, 'รวมมา', 'รวมขาด', 'รวมลา', 'รวมสาย', 'รวมทั้งหมด'];
    ws.addRow(headers);

    // ตกแต่ง Header Row (พื้นหลังสีฟ้า ตัวหนังสือหนาสีขาว)
    ws.getRow(1).eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
        cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
    });
    ws.getRow(1).height = 30; // ปรับความสูงหัวตารางรับ Wrap text

    // 2. ลูปยัดข้อมูลและสูตรลงในแถว
    stus.forEach((stu, index) => {
        const rowData = [stu.number, stu.studentId, getStudentFullName(stu)];
        
        textRecs.forEach(s => {
            const att = s.attendance.find(a => a.studentId === stu.id);
            let val = 'ข'; // ค่าเริ่มต้น ขาดเรียน
            if (att) {
                if (att.status === 'มา') val = 'ม';
                else if (att.status === 'ขาด') val = 'ข';
                else if (att.status === 'ลา') val = 'ล';
                else if (att.status === 'สาย') val = 'ส';
            }
            rowData.push(val);
        });

        const row = ws.addRow(rowData);
        const rIdx = row.number;

        // การผูกสูตรคำนวณ (Dynamic Formula)
        const datesCount = textRecs.length;
        const startCol = 'D';
        const endCol = getColLetter(3 + datesCount);
        const range = `${startCol}${rIdx}:${endCol}${rIdx}`; // เช่น D2:H2
        
        // เซลล์ [รวมมา, รวมขาด, รวมลา, รวมสาย, รวมทั้งหมด]
        row.getCell(4 + datesCount).value = { formula: `COUNTIF(${range}, "ม")` };
        row.getCell(5 + datesCount).value = { formula: `COUNTIF(${range}, "ข")` };
        row.getCell(6 + datesCount).value = { formula: `COUNTIF(${range}, "ล")` };
        row.getCell(7 + datesCount).value = { formula: `COUNTIF(${range}, "ส")` };
        row.getCell(8 + datesCount).value = { formula: `SUM(${getColLetter(4 + datesCount)}${rIdx}:${getColLetter(7 + datesCount)}${rIdx})` }; // =SUM(I2:L2)

        // การตกแต่ง (Zebra Striping, Alignment)
        const isEven = index % 2 === 0;
        row.eachCell((cell, colNumber) => {
            if (isEven) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } }; // สีเทาอ่อนสลับ
            }
            cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
            
            if(colNumber !== 3) cell.alignment = { vertical: 'middle', horizontal: 'center' };
            else cell.alignment = { vertical: 'middle', horizontal: 'left' }; // ชื่อให้อยู่ชิดซ้าย
        });
    });

    // 3. ปรับขนาดความกว้างคอลัมน์ (Auto Fit แบบ Manual)
    ws.getColumn(1).width = 8;
    ws.getColumn(2).width = 15;
    ws.getColumn(3).width = 30;
    for(let i=1; i<=textRecs.length; i++) ws.getColumn(3+i).width = 15; // คอลัมน์วันที่
    for(let i=1; i<=5; i++) ws.getColumn(3+textRecs.length+i).width = 12; // คอลัมน์รวม

    // สร้างไฟล์และให้ผู้ใช้ดาวน์โหลด
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.click();
    
    showToast('ส่งออกสถิติ (Excel) เรียบร้อย');
}

export function openDrilldownModal(stuId, type, filterValue, academicYear, academicSemester) {
    const student = AppState.allStudents.find(s => s.id === stuId && s.deleted_flg !== 'Y');
    if(!student) return;

    document.getElementById('dd-student-name').innerText = getStudentFullName(student);
    document.getElementById('dd-student-meta').innerText = `ระดับชั้น: ${student.class} | เลขที่: ${student.number} | รหัสประจำตัว: ${student.studentId}`;
    
    const tbody = document.getElementById('dd-table-body');
    tbody.innerHTML = '';

    if (type === 'regular') {
        const subObj = AppState.allSubjects.find(s => s.id === filterValue);
        const subName = filterValue === 'all' ? 'รวมทุกวิชา' : (subObj ? subObj.name : filterValue);
        document.getElementById('dd-subject-title').innerHTML = `<i class="fas fa-book mr-1 text-blue-600"></i> วิชาเรียนปกติ: ${subName}`;
        
        const recs = AppState.allRecords.filter(r => (filterValue === 'all' || r.subjectId === filterValue || (!r.subjectId && r.subject === subName)) && matchRecordYearSemester(r, academicYear, academicSemester) && r.deleted_flg !== 'Y');
        recs.sort((a,b) => new Date(a.date) - new Date(b.date));
        
        recs.forEach(r => {
            const myAtt = r.attendance.find(a => a.studentId === stuId);
            if (!myAtt) return; // ข้ามคาบที่ไม่ได้มีการเช็คชื่อนักเรียนคนนี้
            const statusVal = myAtt.status;
            const colorMap = { 'มา': 'text-green-600', 'สาย': 'text-yellow-600', 'ลา': 'text-blue-600', 'ขาด': 'text-red-600' };
            const rSubName = r.subjectId ? (AppState.allSubjects.find(s=>s.id===r.subjectId)?.name || r.subject) : r.subject;
            const subLabel = filterValue === 'all' ? `<br><span class="text-xs text-blue-500">${rSubName}</span>` : '';
            
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
        const rClassName = record.classId ? (AppState.allClasses.find(c=>c.id===record.classId)?.className || record.class) : record.class;
        const rSubName = record.subjectId ? (AppState.allSubjects.find(s=>s.id===record.subjectId)?.name || record.subject) : record.subject;
        const rTeacherName = record.teacherId ? (() => { const t = AppState.allTeachers.find(t=>t.id===record.teacherId); return t ? `${t.firstName} ${t.lastName}` : record.teacher; })() : record.teacher;
        document.querySelectorAll('#sd-session-title').forEach(el => el.innerHTML = `<i class="fas fa-calendar-day mr-2 text-blue-600"></i>${getBangkokDate(record.date)} (คาบ: ${record.period || '-'} | ปีการศึกษา ${rYr} ภาคเรียน ${rSem})`);
        document.querySelectorAll('#sd-session-meta').forEach(el => el.innerText = `ชั้นเรียน: ${rClassName} | วิชา: ${rSubName} | ครู: ${rTeacherName||'-'}`);
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
        const stu = AppState.allStudents.find(s => s.id === a.studentId);
        if (stu) {
            const isInactive = stu.deleted_flg === 'Y' || stu.status === 'ลาออก';
            const nameSuffix = isInactive ? ' <span class="text-xs text-red-500 font-normal ml-1">(พ้นสภาพ)</span>' : '';
            attendanceDetails.push({ number: stu.number || 999, name: getStudentFullName(stu) + nameSuffix, status: a.status });
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
window.exportStatsExcel = exportStatsExcel;
window.openDrilldownModal = openDrilldownModal;
window.openSessionDrilldownModal = openSessionDrilldownModal;