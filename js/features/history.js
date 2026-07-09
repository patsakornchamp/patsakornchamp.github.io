import { AppState } from '../core/state.js';
import { DB_KEYS } from '../core/config.js';
import { getBangkokDate, matchRecordYearSemester, getYearSemesterFromDate, exportToCSV, customAlert, showToast, getISOTimestamp, getCurrentUserId, customConfirm, closeModal } from '../utils/helpers.js';
import { saveToDB, syncDataFromServer } from '../services/api.js';

export function onHistoryTypeChange() {
    const type = document.getElementById('history-type').value;
    const yr = document.getElementById('history-year').value;
    const sem = document.getElementById('history-semester').value;

    if(type === 'regular') {
        document.getElementById('lbl-history-class-or-club').innerText = 'ชั้นเรียน';
        document.getElementById('lbl-history-sub').style.display = 'block';
        document.getElementById('history-subject').style.display = 'block';
        if(window.updateClassDropdown) window.updateClassDropdown(yr, sem, 'history-class', 'ทุกชั้นเรียน');
        document.getElementById('history-subject').innerHTML = '<option value="">-- กรุณาเลือกชั้นเรียนก่อน --</option>';
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

let currentHistoryPage = 1;
const recordsPerPage = 20;

export function changeHistoryPage(page) {
    currentHistoryPage = page;
    renderHistory(false);
}

function renderPaginationControls(containerId, totalPages, currentPage, callbackName) {
    const cont = document.getElementById(containerId);
    if (!cont) return;

    let html = `<div class="flex flex-wrap items-center justify-center gap-1.5 mt-6 border-t pt-4">`;

    const prevDisabled = currentPage === 1 ? 'disabled opacity-50 cursor-not-allowed' : '';
    html += `<button ${prevDisabled} onclick="${callbackName}(${currentPage - 1})" class="px-3 py-1.5 bg-white border text-gray-700 rounded-lg hover:bg-gray-50 text-xs font-bold transition shadow-sm flex items-center gap-1"><i class="fas fa-chevron-left"></i> ก่อนหน้า</button>`;

    const range = 2;
    let startPage = Math.max(1, currentPage - range);
    let endPage = Math.min(totalPages, currentPage + range);

    if (startPage > 1) {
        html += `<button onclick="${callbackName}(1)" class="px-3 py-1.5 bg-white border text-gray-700 rounded-lg hover:bg-gray-50 text-xs font-bold transition shadow-sm">1</button>`;
        if (startPage > 2) {
            html += `<span class="text-gray-400 px-1 text-xs">...</span>`;
        }
    }

    for (let i = startPage; i <= endPage; i++) {
        const activeClass = i === currentPage ? 'bg-blue-600 border-blue-600 text-white hover:bg-blue-700' : 'bg-white text-gray-700 border hover:bg-gray-50';
        html += `<button onclick="${callbackName}(${i})" class="px-3 py-1.5 ${activeClass} rounded-lg text-xs font-bold transition shadow-sm">${i}</button>`;
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            html += `<span class="text-gray-400 px-1 text-xs">...</span>`;
        }
        html += `<button onclick="${callbackName}(${totalPages})" class="px-3 py-1.5 bg-white border text-gray-700 rounded-lg hover:bg-gray-50 text-xs font-bold transition shadow-sm">${totalPages}</button>`;
    }

    const nextDisabled = currentPage === totalPages ? 'disabled opacity-50 cursor-not-allowed' : '';
    html += `<button ${nextDisabled} onclick="${callbackName}(${currentPage + 1})" class="px-3 py-1.5 bg-white border text-gray-700 rounded-lg hover:bg-gray-50 text-xs font-bold transition shadow-sm flex items-center gap-1">ถัดไป <i class="fas fa-chevron-right"></i></button>`;

    html += `</div>`;
    html += `<div class="text-center text-xs text-gray-500 mt-2 font-medium">หน้า ${currentPage} จากทั้งหมด ${totalPages} หน้า</div>`;

    cont.innerHTML += html;
}

export function renderHistory(resetPage = true) {
    if (resetPage === true) {
        currentHistoryPage = 1;
    }

    const type = document.getElementById('history-type').value;
    const d = document.getElementById('history-date').value;
    const classOrClubId = document.getElementById('history-class').value;
    const subId = document.getElementById('history-subject').value;
    const yr = document.getElementById('history-year').value;
    const sem = document.getElementById('history-semester').value;

    const cont = document.getElementById('history-records-container'); 
    cont.innerHTML = '';

    if (type === 'regular') {
        let recs = AppState.allRecords.filter(r => 
            r.deleted_flg !== 'Y' && 
            (!r.class || AppState.allClasses.some(c => (c.id === r.classId || c.className === r.class) && c.deleted_flg !== 'Y')) &&
            (!r.subject || AppState.allSubjects.some(s => (s.id === r.subjectId || s.name === r.subject) && s.deleted_flg !== 'Y'))
        ); 

        const clsObj = AppState.allClasses.find(c => c.id === classOrClubId);
        const clsName = clsObj ? clsObj.className : classOrClubId;
        const subObj = AppState.allSubjects.find(s => s.id === subId);
        const subName = subObj ? subObj.name : subId;

        if (d) {
            recs = recs.filter(r => {
                const recordDate = getBangkokDate(r.date); 
                return recordDate === d;
            });
        }
        if(classOrClubId) recs=recs.filter(r => r.classId === classOrClubId || r.class === clsName); 
        if(subId) recs=recs.filter(r => r.subjectId === subId || r.subject === subName);
        if(yr && sem) recs=recs.filter(r => matchRecordYearSemester(r, yr, sem));

        if (AppState.currentUser && AppState.currentUser.role === 'teacher') {
            const tId = AppState.currentUser.data.id;
            const teacherFullName = `${AppState.currentUser.data.firstName} ${AppState.currentUser.data.lastName}`;
            recs = recs.filter(r => r.teacherId === tId || (!r.teacherId && r.teacher === teacherFullName)); 
        }

        recs.sort((a,b)=>new Date(b.date)-new Date(a.date));
        if(recs.length===0) return cont.innerHTML='<div class="text-center py-10 text-gray-500">ไม่พบประวัติการเช็คชื่อปกติ</div>';

        // Pre-create Maps for O(1) lookups
        const classMap = {};
        AppState.allClasses.forEach(c => { classMap[c.id] = c; });
        const subjectMap = {};
        AppState.allSubjects.forEach(s => { subjectMap[s.id] = s; });
        const teacherMap = {};
        AppState.allTeachers.forEach(t => { teacherMap[t.id] = t; });

        // Calculate pages
        const totalPages = Math.ceil(recs.length / recordsPerPage);
        if (currentHistoryPage > totalPages) {
            currentHistoryPage = totalPages || 1;
        }

        const pageRecords = recs.slice((currentHistoryPage - 1) * recordsPerPage, currentHistoryPage * recordsPerPage);
        const htmlArray = [];

        pageRecords.forEach(r => {
            let stat={มา:0,สาย:0,ลา:0,ขาด:0}; 
            let attList = r.attendance || [];
            if (typeof attList === 'string') {
                try { attList = JSON.parse(attList); } catch(e) { attList = []; }
            }
            if (attList && typeof attList === 'object' && !Array.isArray(attList)) {
                attList = Object.values(attList);
            }
            attList.forEach(a => {
                if (stat[a.status] !== undefined) {
                    stat[a.status]++;
                }
            });
            const rYr = r.year !== undefined ? r.year : getYearSemesterFromDate(r.date).year;
            const rSem = r.semester !== undefined ? r.semester : getYearSemesterFromDate(r.date).semester;
            const rClassName = r.classId ? (classMap[r.classId]?.className || r.class) : r.class;
            const rSubName = r.subjectId ? (subjectMap[r.subjectId]?.name || r.subject) : r.subject;
            const rTeacherName = r.teacherId ? (() => { const t = teacherMap[r.teacherId]; return t ? `${t.firstName} ${t.lastName}` : r.teacher; })() : r.teacher;
            
            let deleteBtnHtml = '';
            if (AppState.currentUser && (AppState.currentUser.role === 'admin' || AppState.currentUser.role === 'teacher')) {
                deleteBtnHtml = `<button onclick="event.stopPropagation(); deleteSessionRecord('${r.id}', 'regular')" class="text-red-500 hover:text-red-700 p-2 rounded-full hover:bg-red-100 transition-colors shrink-0" title="ลบประวัตินี้"><i class="fas fa-trash-alt"></i></button>`;
            }

            htmlArray.push(`<div class="bg-white border rounded-lg shadow-sm mb-4 cursor-pointer hover:border-blue-400 hover:shadow-md transition-all duration-200" onclick="openSessionDrilldownModal('${r.id}', 'regular')">
                <div class="bg-gray-50 hover:bg-blue-50/50 px-4 sm:px-6 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 transition-colors">
                    <div class="flex-1">
                        <h4 class="font-bold text-gray-800">${getBangkokDate(r.date)} (คาบ: ${r.period || '-'} | ปีการศึกษา ${rYr} ภาคเรียน ${rSem})</h4>
                        <p class="text-sm mt-1">ชั้นเรียน: ${rClassName} | วิชา: ${rSubName} | ครู: ${rTeacherName||'-'}</p>
                    </div>
                    <div class="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                        <div class="text-sm font-semibold text-green-700 bg-green-100 px-3 py-1.5 rounded-full text-center whitespace-nowrap">มา:${stat['มา']} สาย:${stat['สาย']} ลา:${stat['ลา']} ขาด:${stat['ขาด']}</div>
                        ${deleteBtnHtml}
                    </div>
                </div>
            </div>`);
        });

        cont.innerHTML = htmlArray.join('');

        if (totalPages > 1) {
            renderPaginationControls('history-records-container', totalPages, currentHistoryPage, 'changeHistoryPage');
        }
    } else {
        let recs = AppState.allClubRecords.filter(r => 
            r.deleted_flg !== 'Y' && 
            AppState.allClubs.some(c => c.id === r.clubId && c.deleted_flg !== 'Y')
        );
        if (d) {
            recs = recs.filter(r => {
                const recordDate = getBangkokDate(r.date); 
                return recordDate === d;
            });
        }
        if(classOrClubId) recs = recs.filter(r => r.clubId === classOrClubId);
        if(yr && sem) recs = recs.filter(r => matchRecordYearSemester(r, yr, sem));

        recs.sort((a,b) => new Date(b.date) - new Date(a.date));
        if(recs.length===0) return cont.innerHTML='<div class="text-center py-10 text-gray-500">ไม่พบประวัติการเข้าเรียนกิจกรรมชุมนุม</div>';

        // Pre-create Maps for O(1) lookups
        const clubMap = {};
        AppState.allClubs.forEach(c => { clubMap[c.id] = c; });

        // Calculate pages
        const totalPages = Math.ceil(recs.length / recordsPerPage);
        if (currentHistoryPage > totalPages) {
            currentHistoryPage = totalPages || 1;
        }

        const pageRecords = recs.slice((currentHistoryPage - 1) * recordsPerPage, currentHistoryPage * recordsPerPage);
        const htmlArray = [];

        pageRecords.forEach(r => {
            let stat={มา:0,สาย:0,ลา:0,ขาด:0}; 
            let attList = r.attendance || [];
            if (typeof attList === 'string') {
                try { attList = JSON.parse(attList); } catch(e) { attList = []; }
            }
            if (attList && typeof attList === 'object' && !Array.isArray(attList)) {
                attList = Object.values(attList);
            }
            attList.forEach(a => {
                if (stat[a.status] !== undefined) {
                    stat[a.status]++;
                }
            });
            const club = clubMap[r.clubId];
            
            const rYr = r.year !== undefined ? r.year : getYearSemesterFromDate(r.date).year;
            const rSem = r.semester !== undefined ? r.semester : getYearSemesterFromDate(r.date).semester;
            
            let deleteBtnHtml = '';
            if (AppState.currentUser && (AppState.currentUser.role === 'admin' || AppState.currentUser.role === 'teacher')) {
                deleteBtnHtml = `<button onclick="event.stopPropagation(); deleteSessionRecord('${r.id}', 'club')" class="text-red-500 hover:text-red-700 p-2 rounded-full hover:bg-red-100 transition-colors shrink-0" title="ลบประวัตินี้"><i class="fas fa-trash-alt"></i></button>`;
            }

            htmlArray.push(`<div class="bg-white border rounded-lg shadow-sm mb-4 cursor-pointer hover:border-green-400 hover:shadow-md transition-all duration-200" onclick="openSessionDrilldownModal('${r.id}', 'club')">
                <div class="bg-green-50/50 hover:bg-green-100/50 px-4 sm:px-6 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 transition-colors">
                    <div class="flex-1">
                        <h4 class="font-bold text-green-900">${getBangkokDate(r.date)} (กิจกรรมวิชาชุมนุม - ปี ${rYr}/${rSem})</h4>
                        <p class="text-sm font-bold text-gray-700 mt-1">ชุมนุม: ${club ? club.name : 'ไม่พบข้อมูลชุมนุม'}</p>
                    </div>
                    <div class="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                        <div class="text-sm font-semibold text-green-700 bg-green-100 px-3 py-1.5 rounded-full text-center whitespace-nowrap">มา:${stat['มา']} สาย:${stat['สาย']} ลา:${stat['ลา']} ขาด:${stat['ขาด']}</div>
                        ${deleteBtnHtml}
                    </div>
                </div>
            </div>`);
        });

        cont.innerHTML = htmlArray.join('');

        if (totalPages > 1) {
            renderPaginationControls('history-records-container', totalPages, currentHistoryPage, 'changeHistoryPage');
        }
    }
}

export function exportHistoryCSV() {
    const type = document.getElementById('history-type').value;
    const d = document.getElementById('history-date').value;
    const classOrClubId = document.getElementById('history-class').value;
    const subId = document.getElementById('history-subject').value;
    const yr = document.getElementById('history-year').value;
    const sem = document.getElementById('history-semester').value;

    if(type === 'regular') {
        let textRecs = AppState.allRecords.filter(r => 
            r.deleted_flg !== 'Y' && 
            AppState.allClasses.some(c => (r.classId ? c.id === r.classId : c.className === r.class) && c.deleted_flg !== 'Y') &&
            AppState.allSubjects.some(s => (r.subjectId ? s.id === r.subjectId : s.name === r.subject) && s.deleted_flg !== 'Y')
        );
        const clsObj = AppState.allClasses.find(c => c.id === classOrClubId);
        const clsName = clsObj ? clsObj.className : classOrClubId;
        const subObj = AppState.allSubjects.find(s => s.id === subId);
        const subName = subObj ? subObj.name : subId;

        if(d) textRecs=textRecs.filter(r=>getBangkokDate(r.date)===d);
        if(classOrClubId) textRecs=textRecs.filter(r => r.classId === classOrClubId || (!r.classId && r.class === clsName));
        if(subId) textRecs=textRecs.filter(r => r.subjectId === subId || (!r.subjectId && r.subject === subName));
        if(yr && sem) textRecs=textRecs.filter(r => matchRecordYearSemester(r, yr, sem));

        if (AppState.currentUser && AppState.currentUser.role === 'teacher') {
            const tId = AppState.currentUser.data.id;
            const teacherFullName = `${AppState.currentUser.data.firstName} ${AppState.currentUser.data.lastName}`;
            textRecs = textRecs.filter(r => r.teacherId === tId || (!r.teacherId && r.teacher === teacherFullName));
        }

        if(textRecs.length === 0) return customAlert('ไม่พบข้อมูลประวัติภายใต้เงื่อนไขตัวกรองปัจจุบัน');

        const headers = ['วันที่', 'คาบเรียน', 'ปีการศึกษา', 'ภาคเรียน', 'ชั้นเรียน', 'วิชา', 'ครูผู้สอน', 'จำนวนนักเรียน', 'มา (คน)', 'สาย (คน)', 'ลา (คน)', 'ขาด (คน)'];
        const rows = textRecs.map(r => {
            let stat={มา:0,สาย:0,ลา:0,ขาด:0}; 
            let activeCount = 0;
            r.attendance.forEach(a => {
                if (AppState.allStudents.some(stu => stu.id === a.studentId)) {
                    stat[a.status]++;
                    activeCount++;
                }
            });
            const rClassName = r.classId ? (AppState.allClasses.find(c=>c.id===r.classId)?.className || r.class) : r.class;
            const rSubName = r.subjectId ? (AppState.allSubjects.find(s=>s.id===r.subjectId)?.name || r.subject) : r.subject;
            const rTeacherName = r.teacherId ? (() => { const t = AppState.allTeachers.find(t=>t.id===r.teacherId); return t ? `${t.firstName} ${t.lastName}` : r.teacher; })() : r.teacher;
            return [getBangkokDate(r.date), r.period || '-', r.year || '', r.semester || '', rClassName, rSubName, rTeacherName || '-', activeCount, stat['มา'], stat['สาย'], stat['ลา'], stat['ขาด']];
        });
        exportToCSV(`ประวัติเช็คชื่อปกติ.csv`, headers, rows);
    } else {
        let textRecs = AppState.allClubRecords.filter(r => 
            r.deleted_flg !== 'Y' && 
            AppState.allClubs.some(c => c.id === r.clubId && c.deleted_flg !== 'Y')
        );
        if(d) textRecs = textRecs.filter(r => getBangkokDate(r.date) === d);
        if(classOrClubId) textRecs = textRecs.filter(r => r.clubId === classOrClubId);
        if(yr && sem) textRecs = textRecs.filter(r => matchRecordYearSemester(r, yr, sem));

        if(textRecs.length === 0) return customAlert('ไม่พบข้อมูลประวัติกิจกรรมชุมนุม');

        const headers = ['วันที่', 'ปีการศึกษา', 'ภาคเรียน', 'ชุมนุม', 'จำนวนผู้เข้าร่วม', 'มา (คน)', 'สาย (คน)', 'ลา (คน)', 'ขาด (คน)'];
        const rows = textRecs.map(r => {
            let stat={มา:0,สาย:0,ลา:0,ขาด:0}; 
            let activeCount = 0;
            r.attendance.forEach(a => {
                if (AppState.allStudents.some(stu => stu.id === a.studentId)) {
                    stat[a.status]++;
                    activeCount++;
                }
            });
            const club = AppState.allClubs.find(cl => cl.id === r.clubId && cl.deleted_flg !== 'Y');
            return [getBangkokDate(r.date), r.year || '', r.semester || '', club ? club.name : '', activeCount, stat['มา'], stat['สาย'], stat['ลา'], stat['ขาด']];
        });
        exportToCSV(`ประวัติกิจกรรมชุมนุม.csv`, headers, rows);
    }
    showToast('ส่งออก CSV ประวัติสำเร็จ');
}

export function deleteSessionRecord(recordId, type) {
    customConfirm('ยืนยันการลบประวัติ', 'คุณต้องการลบประวัติการเช็คชื่อคาบนี้ใช่หรือไม่? (ข้อมูลจะถูกซ่อนไว้และนำออกจากสถิติ)', async () => {
        const now = getISOTimestamp();
        const userId = getCurrentUserId();
        
        if (type === 'regular') {
            const idx = AppState.allRecords.findIndex(r => r.id === recordId);
            if (idx > -1) {
                AppState.allRecords[idx].deleted_flg = 'Y';
                AppState.allRecords[idx].deletedAt = now;
                AppState.allRecords[idx].deletedBy = userId;
                await saveToDB(DB_KEYS.RECORDS, AppState.allRecords, 'saveRecords');
            }
        } else {
            const idx = AppState.allClubRecords.findIndex(r => r.id === recordId);
            if (idx > -1) {
                AppState.allClubRecords[idx].deleted_flg = 'Y';
                AppState.allClubRecords[idx].deletedAt = now;
                AppState.allClubRecords[idx].deletedBy = userId;
                await saveToDB(DB_KEYS.CLUB_RECORDS, AppState.allClubRecords, 'saveClubRecords');
            }
        }
        
        closeModal('session-drilldown-modal');
        showToast('ลบประวัติการเช็คชื่อเรียบร้อยแล้ว');
        if (AppState.currentTab === 'history') renderHistory();
        else if (AppState.currentTab === 'stats' && window.renderStats) window.renderStats(true);
    });
}

// ผูกฟังก์ชันเข้า Window
window.onHistoryTypeChange = onHistoryTypeChange;
window.searchHistory = searchHistory;
window.renderHistory = renderHistory;
window.exportHistoryCSV = exportHistoryCSV;
window.deleteSessionRecord = deleteSessionRecord;
window.changeHistoryPage = changeHistoryPage;