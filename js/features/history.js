import { AppState } from '../core/state.js';
import { getBangkokDate, matchRecordYearSemester, getYearSemesterFromDate, exportToCSV, customAlert, showToast } from '../utils/helpers.js';
import { syncDataFromServer } from '../services/api.js';

export function onHistoryTypeChange() {
    const type = document.getElementById('history-type').value;
    const yr = document.getElementById('history-year').value;
    const sem = document.getElementById('history-semester').value;

    if(type === 'regular') {
        document.getElementById('lbl-history-class-or-club').innerText = 'ชั้นเรียน';
        document.getElementById('lbl-history-sub').style.display = 'block';
        document.getElementById('history-subject').style.display = 'block';
        if(window.updateClassDropdown) window.updateClassDropdown(yr, sem, 'history-class', 'ทุกชั้นเรียน');
    } else {
        document.getElementById('lbl-history-class-or-club').innerText = 'ชุมนุม';
        document.getElementById('lbl-history-sub').style.display = 'none';
        document.getElementById('history-subject').style.display = 'none';
        if(window.updateClubDropdown) window.updateClubDropdown(yr, sem, 'history-class', 'ทุกชุมนุม');
    }
    renderHistory();
}

export async function searchHistory() {
    await syncDataFromServer();
    renderHistory();
}

export function renderHistory() {
    const type = document.getElementById('history-type').value;
    const d = document.getElementById('history-date').value;
    const classOrClub = document.getElementById('history-class').value;
    const s = document.getElementById('history-subject').value;
    const yr = document.getElementById('history-year').value;
    const sem = document.getElementById('history-semester').value;

    const cont = document.getElementById('history-records-container'); 
    cont.innerHTML = '';

    if (type === 'regular') {
        let recs = AppState.allRecords; 
        if (d) {
            recs = recs.filter(r => {
                const recordDate = getBangkokDate(r.date); 
                return recordDate === d;
            });
        }
        if(classOrClub) recs=recs.filter(r=>r.class===classOrClub); 
        if(s) recs=recs.filter(r=>r.subject===s);
        if(yr && sem) recs=recs.filter(r => matchRecordYearSemester(r, yr, sem));

        if (AppState.currentUser && AppState.currentUser.role === 'teacher') {
            const teacherFullName = `${AppState.currentUser.data.firstName} ${AppState.currentUser.data.lastName}`;
            recs = recs.filter(r => r.teacher === teacherFullName); 
        }

        recs.sort((a,b)=>new Date(b.date)-new Date(a.date));
        if(recs.length===0) return cont.innerHTML='<div class="text-center py-10 text-gray-500">ไม่พบประวัติการเช็คชื่อปกติ</div>';

        recs.forEach(r => {
            let stat={มา:0,สาย:0,ลา:0,ขาด:0}; r.attendance.forEach(a=>stat[a.status]++);
            const rYr = r.year !== undefined ? r.year : getYearSemesterFromDate(r.date).year;
            const rSem = r.semester !== undefined ? r.semester : getYearSemesterFromDate(r.date).semester;
            cont.innerHTML += `<div class="bg-white border rounded-lg shadow-sm mb-4 cursor-pointer hover:border-blue-400 hover:shadow-md transition-all duration-200" onclick="openSessionDrilldownModal('${r.id}', 'regular')">
                <div class="bg-gray-50 hover:bg-blue-50/50 px-4 sm:px-6 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 transition-colors">
                    <div>
                        <h4 class="font-bold text-gray-800">${getBangkokDate(r.date)} (คาบ: ${r.period || '-'} | ปีการศึกษา ${rYr} ภาคเรียน ${rSem})</h4>
                        <p class="text-sm mt-1">ชั้นเรียน: ${r.class} | วิชา: ${r.subject} | ครู: ${r.teacher||'-'}</p>
                    </div>
                    <div class="text-sm font-semibold text-green-700 bg-green-100 px-3 py-1.5 rounded-full w-full sm:w-auto text-center">มา:${stat['มา']} สาย:${stat['สาย']} ลา:${stat['ลา']} ขาด:${stat['ขาด']}</div>
                </div>
            </div>`;
        });
    } else {
        let recs = AppState.allClubRecords;
        if (d) {
            recs = recs.filter(r => {
                const recordDate = getBangkokDate(r.date); 
                return recordDate === d;
            });
        }
        if(classOrClub) recs = recs.filter(r => r.clubId === classOrClub);
        if(yr && sem) recs = recs.filter(r => matchRecordYearSemester(r, yr, sem));

        recs.sort((a,b) => new Date(b.date) - new Date(a.date));
        if(recs.length===0) return cont.innerHTML='<div class="text-center py-10 text-gray-500">ไม่พบประวัติการเข้าเรียนกิจกรรมชุมนุม</div>';

        recs.forEach(r => {
            let stat={มา:0,สาย:0,ลา:0,ขาด:0}; 
            r.attendance.forEach(a => stat[a.status]++);
            const club = AppState.allClubs.find(c => c.id === r.clubId);
            
            const rYr = r.year !== undefined ? r.year : getYearSemesterFromDate(r.date).year;
            const rSem = r.semester !== undefined ? r.semester : getYearSemesterFromDate(r.date).semester;
            
            cont.innerHTML += `<div class="bg-white border rounded-lg shadow-sm mb-4 cursor-pointer hover:border-green-400 hover:shadow-md transition-all duration-200" onclick="openSessionDrilldownModal('${r.id}', 'club')">
                <div class="bg-green-50/50 hover:bg-green-100/50 px-4 sm:px-6 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 transition-colors">
                    <div>
                        <h4 class="font-bold text-green-900">${getBangkokDate(r.date)} (กิจกรรมวิชาชุมนุม - ปี ${rYr}/${rSem})</h4>
                        <p class="text-sm font-bold text-gray-700 mt-1">ชุมนุม: ${club ? club.name : 'ไม่พบข้อมูลชุมนุม'}</p>
                    </div>
                    <div class="text-sm font-semibold text-green-700 bg-green-100 px-3 py-1.5 rounded-full w-full sm:w-auto text-center">มา:${stat['มา']} สาย:${stat['สาย']} ลา:${stat['ลา']} ขาด:${stat['ขาด']}</div>
                </div>
            </div>`;
        });
    }
}

export function exportHistoryCSV() {
    const type = document.getElementById('history-type').value;
    const d = document.getElementById('history-date').value;
    const c = document.getElementById('history-class').value;
    const s = document.getElementById('history-subject').value;
    const yr = document.getElementById('history-year').value;
    const sem = document.getElementById('history-semester').value;

    if(type === 'regular') {
        let textRecs = AppState.allRecords;
        if(d) textRecs=textRecs.filter(r=>getBangkokDate(r.date)===d);
        if(c) textRecs=textRecs.filter(r=>r.class===c);
        if(s) textRecs=textRecs.filter(r=>r.subject===s);
        if(yr && sem) textRecs=textRecs.filter(r => matchRecordYearSemester(r, yr, sem));

        if (AppState.currentUser && AppState.currentUser.role === 'teacher') {
            const teacherFullName = `${AppState.currentUser.data.firstName} ${AppState.currentUser.data.lastName}`;
            textRecs = textRecs.filter(r => r.teacher === teacherFullName);
        }

        if(textRecs.length === 0) return customAlert('ไม่พบข้อมูลประวัติภายใต้เงื่อนไขตัวกรองปัจจุบัน');

        const headers = ['วันที่', 'คาบเรียน', 'ปีการศึกษา', 'ภาคเรียน', 'ชั้นเรียน', 'วิชา', 'ครูผู้สอน', 'จำนวนนักเรียน', 'มา (คน)', 'สาย (คน)', 'ลา (คน)', 'ขาด (คน)'];
        const rows = textRecs.map(r => {
            let stat={มา:0,สาย:0,ลา:0,ขาด:0}; r.attendance.forEach(a=>stat[a.status]++);
            return [getBangkokDate(r.date), r.period || '-', r.year || '', r.semester || '', r.class, r.subject, r.teacher || '-', r.attendance.length, stat['มา'], stat['สาย'], stat['ลา'], stat['ขาด']];
        });
        exportToCSV(`ประวัติเช็คชื่อปกติ.csv`, headers, rows);
    } else {
        let textRecs = AppState.allClubRecords;
        if(d) textRecs = textRecs.filter(r => getBangkokDate(r.date) === d);
        if(c) textRecs = textRecs.filter(r => r.clubId === c);
        if(yr && sem) textRecs = textRecs.filter(r => matchRecordYearSemester(r, yr, sem));

        if(textRecs.length === 0) return customAlert('ไม่พบข้อมูลประวัติกิจกรรมชุมนุม');

        const headers = ['วันที่', 'ปีการศึกษา', 'ภาคเรียน', 'ชุมนุม', 'จำนวนผู้เข้าร่วม', 'มา (คน)', 'สาย (คน)', 'ลา (คน)', 'ขาด (คน)'];
        const rows = textRecs.map(r => {
            let stat={มา:0,สาย:0,ลา:0,ขาด:0}; r.attendance.forEach(a=>stat[a.status]++);
            const club = AppState.allClubs.find(cl => cl.id === r.clubId);
            return [getBangkokDate(r.date), r.year || '', r.semester || '', club ? club.name : '', r.attendance.length, stat['มา'], stat['สาย'], stat['ลา'], stat['ขาด']];
        });
        exportToCSV(`ประวัติกิจกรรมชุมนุม.csv`, headers, rows);
    }
    showToast('ส่งออก CSV ประวัติสำเร็จ');
}

// ผูกฟังก์ชันเข้า Window
window.onHistoryTypeChange = onHistoryTypeChange;
window.searchHistory = searchHistory;
window.renderHistory = renderHistory;
window.exportHistoryCSV = exportHistoryCSV;