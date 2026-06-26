import { AppState } from '../core/state.js';
import { DB_KEYS } from '../core/config.js';
import { generateId, getStudentFullName, showToast, matchRecordYearSemester, getBangkokDate, getBangkokCurrentTime, exportToCSV, getISOTimestamp, getCurrentUserId, customConfirm } from '../utils/helpers.js';
import { syncDataFromServer, saveToDB } from '../services/api.js';

export function resetCheckinTable() {
    document.getElementById('student-list-container').classList.add('hidden');
    document.getElementById('save-btn-container').classList.add('hidden');
    document.getElementById('bulk-actions').classList.add('hidden');
    document.getElementById('checkin-table-body').innerHTML = '';
    AppState.currentCheckinStudents = [];
    AppState.activeCheckinStates = {};
    AppState.lastCheckedStuId = null;
    AppState.lastCheckedStuId = null;
    AppState.pendingSyncIds = [];
    document.getElementById('no-students-alert').classList.add('hidden');
    document.getElementById('tc-show-qr-btn').classList.add('hidden');
    document.getElementById('tc-scan-btn').classList.add('hidden');
    document.getElementById('pull-qr-btn').classList.add('hidden');
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
    document.getElementById('tc-show-qr-btn').classList.remove('hidden');
    document.getElementById('tc-scan-btn').classList.remove('hidden');
    document.getElementById('pull-qr-btn').classList.remove('hidden');

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

    if (!AppState.currentCheckinStudents || AppState.currentCheckinStudents.length === 0) return;

    let actualStats = { 'มา': 0, 'สาย': 0, 'ลา': 0, 'ขาด': 0, 'ยังไม่เช็ค': 0 };
    AppState.currentCheckinStudents.forEach(stu => {
        const st = AppState.activeCheckinStates[stu.id];
        if (!st) actualStats['ยังไม่เช็ค']++;
        else actualStats[st]++;
    });

    const summaryHtml = `
        <div class="text-left bg-gray-50 p-3 rounded border border-gray-200 mt-2 mb-3 shadow-sm">
            <p class="mb-1"><b>วันที่:</b> ${getBangkokDate(date)}</p>
            <p class="mb-1"><b>คาบเรียน:</b> ${period}</p>
            <p class="mb-1"><b>วิชา:</b> ${subName} (${clsName})</p>
            <p><b>ครูผู้สอน:</b> ${teacher}</p>
        </div>
        <div class="text-left">
            <p class="font-bold text-gray-800 mb-2">สรุปจำนวนนักเรียน (รวม ${AppState.currentCheckinStudents.length} คน)</p>
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

        const existRecIdx = AppState.allRecords.findIndex(r => getBangkokDate(r.date)===date && String(r.period||'')===String(period||'') && (r.classId === clsId || (!r.classId && r.class===clsName)) && (r.subjectId === subId || (!r.subjectId && r.subject===subName)) && matchRecordYearSemester(r, yr, sem) && r.deleted_flg !== 'Y');
        
        let record;
        if (existRecIdx > -1) { // Update
            record = {
                ...AppState.allRecords[existRecIdx],
                classId: clsId, class: clsName, subjectId: subId, subject: subName, teacherId: tId, teacher, attendance: att, updatedAt: now, updatedBy: userId,
            };
            AppState.allRecords[existRecIdx] = record;
        } else { // Create
            const localTimestampStr = date + 'T' + getBangkokCurrentTime();
            const utcDate = new Date(localTimestampStr + "+07:00").toISOString();
            record = { 
                id: generateId(), date: utcDate, period: period, classId: clsId, class: clsName, subjectId: subId, subject: subName, teacherId: tId, teacher, year: yr, semester: sem, attendance: att,
                createdAt: now, createdBy: userId, updatedAt: now, updatedBy: userId, deleted_flg: 'N', deletedAt: null, deletedBy: null,
            };
            AppState.allRecords.push(record);
        }

        await saveToDB(DB_KEYS.RECORDS, AppState.allRecords, 'saveRecords');
        
        // Sync pending QR check-ins if any
        if (AppState.pendingSyncIds && AppState.pendingSyncIds.length > 0) {
            try {
                const apiUrl = AppState.googleSheetUrl;
                await fetch(apiUrl, {
                    method: 'POST',
                    body: JSON.stringify({
                        action: 'updateStudentCheckInsStatus',
                        payload: { ids: AppState.pendingSyncIds, status: 'SYNCED' }
                    })
                });
                AppState.pendingSyncIds = [];
            } catch (err) {
                console.error("Failed to update sync status", err);
            }
        }
        
        showToast('บันทึกการเช็คชื่อเรียบร้อย');
    });
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

// ==========================================
// QR CODE CHECK-IN SYSTEM LOGIC
// ==========================================

const SCHOOL_LAT = 13.736717; // Placeholder: เปลี่ยนเป็นพิกัดจริงของโรงเรียน
const SCHOOL_LON = 100.523186; // Placeholder: เปลี่ยนเป็นพิกัดจริงของโรงเรียน

let html5QrCode = null;
let currentQrData = null;

export function playBeep() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
    } catch(e) { console.error(e); }
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; 
    const p1 = lat1 * Math.PI/180;
    const p2 = lat2 * Math.PI/180;
    const dp = (lat2-lat1) * Math.PI/180;
    const dl = (lon2-lon1) * Math.PI/180;
    const a = Math.sin(dp/2) * Math.sin(dp/2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl/2) * Math.sin(dl/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; 
}

// ================= Teacher Side =================

export function showClassroomQrModal() {
    const date = document.getElementById('checkin-date').value; 
    const period = document.getElementById('checkin-period').value;
    const clsId = document.getElementById('checkin-class').value; 
    const subId = document.getElementById('checkin-subject').value; 
    const teacherSelect = document.getElementById('checkin-teacher');
    const tId = teacherSelect.value;

    if(!date || !period || !clsId || !subId || !tId) { 
        alert('กรุณาเลือกข้อมูลให้ครบถ้วนก่อนสร้าง QR'); 
        return; 
    }

    const subObj = AppState.allSubjects.find(s => s.id === subId);
    document.getElementById('qr-classroom-desc').innerText = `วิชา: ${subObj ? subObj.name : subId} | คาบ: ${period}`;

    const qrData = {
        t: 'C',
        d: date, p: period, c: clsId, s: subId, tc: tId,
        ts: Date.now()
    };

    const encodedData = encodeURIComponent(JSON.stringify(qrData));
    const container = document.getElementById('qr-classroom-container');
    container.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodedData}" class="mx-auto shadow-md rounded-xl" alt="QR Code">`;

    document.getElementById('qr-classroom-modal').classList.add('show');
}

let currentScannerCallback = null;

function startCameraWithList(callback) {
    currentScannerCallback = callback;
    document.getElementById('qr-scanner-modal').classList.add('show');
    
    const select = document.getElementById('camera-select');
    if (select) {
        select.innerHTML = '<option value="">กำลังค้นหากล้อง...</option>';
        select.disabled = true;
    }

    if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().then(() => { html5QrCode.clear(); startCamInit(); }).catch(() => { startCamInit(); });
    } else {
        if (!html5QrCode) html5QrCode = new Html5Qrcode("student-reader");
        startCamInit();
    }
}

function startCamInit() {
    // Ensure permission is requested first if needed
    Html5Qrcode.getCameras().then(devices => {
        const select = document.getElementById('camera-select');
        if (devices && devices.length > 0) {
            if (select) select.innerHTML = '';
            let defaultCameraId = devices[0].id;
            
            devices.forEach((device, index) => {
                const opt = document.createElement('option');
                opt.value = device.id;
                opt.text = device.label || `Camera ${index + 1}`;
                const labelLow = opt.text.toLowerCase();
                if (labelLow.includes('back') || labelLow.includes('environment') || labelLow.includes('rear')) {
                    defaultCameraId = device.id;
                }
                if (select) select.appendChild(opt);
            });
            
            if (select) {
                select.value = defaultCameraId;
                select.disabled = false;
            }
            startSpecificCamera(defaultCameraId);
        } else {
            // Fallback if getCameras returns empty but we might still have a default camera
            if(select) {
                select.innerHTML = '<option value="">กล้องเริ่มต้น (Default)</option>';
                select.disabled = true;
            }
            startSpecificCamera({ facingMode: "environment" });
        }
    }).catch(err => {
        const select = document.getElementById('camera-select');
        if (select) {
            select.innerHTML = '<option value="">กล้องเริ่มต้น (Default)</option>';
            select.disabled = true;
        }
        startSpecificCamera({ facingMode: "environment" });
    });
}

function startSpecificCamera(cameraConfig) {
    if (!html5QrCode) html5QrCode = new Html5Qrcode("student-reader");
    if (html5QrCode.isScanning) {
        html5QrCode.stop().then(() => {
            _playSpecificCamera(cameraConfig);
        }).catch(err => console.error(err));
    } else {
        _playSpecificCamera(cameraConfig);
    }
}

function _playSpecificCamera(cameraConfig) {
    html5QrCode.start(
        cameraConfig,
        { fps: 10 },
        currentScannerCallback,
        undefined
    ).catch(err => {
        // If environment fails, try user camera
        if (typeof cameraConfig === 'object' && cameraConfig.facingMode === 'environment') {
            html5QrCode.start({ facingMode: "user" }, { fps: 10 }, currentScannerCallback, undefined).catch(e2 => {
                console.error("Fallback failed", e2);
                alert("ไม่สามารถเปิดกล้องได้ กรุณาตรวจสอบสิทธิ์การเข้าถึงกล้อง");
            });
        } else {
            console.error("Error starting camera", err);
            alert("ไม่สามารถเปิดกล้องนี้ได้: " + err);
        }
    });
}

export function switchCamera(cameraId) {
    if (cameraId) startSpecificCamera(cameraId);
}

export function openTeacherQrScanner() {
    // ครูสแกน QR ของเด็ก
    startCameraWithList((decodedText) => {
        try {
            const data = JSON.parse(decodedText);
            if (data.t === 'S' || data.type === 'STUDENT') {
                const stuId = data.id || data.studentId;
                const stu = AppState.currentCheckinStudents.find(s => s.studentId === stuId || s.id === stuId);
                if (stu) {
                    playBeep();
                    onAttendanceChange(stu.id, 'มา');
                    showToast(`เช็คชื่อ ${stu.firstName} สำเร็จ`);
                    // ไม่ปิดกล้อง เผื่อสแกนคนต่อไป
                }
            }
        } catch (e) { console.error("Invalid QR", e); }
    });
}

export async function pullStudentCheckIns() {
    const btn = document.getElementById('pull-qr-btn');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> ดึงข้อมูล...';
    try {
        const apiUrl = AppState.googleSheetUrl;
        const res = await fetch(apiUrl, {
            method: 'POST',
            body: JSON.stringify({ action: 'getStudentCheckIns' })
        });
        const json = await res.json();
        if (json.status === 'success' && json.StudentCheckIns) {
            const date = document.getElementById('checkin-date').value; 
            const period = document.getElementById('checkin-period').value;
            const clsId = document.getElementById('checkin-class').value; 
            const subId = document.getElementById('checkin-subject').value; 

            let count = 0;
            AppState.pendingSyncIds = AppState.pendingSyncIds || [];
            
            json.StudentCheckIns.forEach(record => {
                // Check if match and PENDING
                // In production we should compare date correctly. Here we assume the app script saved it in ISO.
                if (record.status === 'PENDING' && record.classId === clsId && record.subjectId === subId && String(record.period||record.scanTime).includes(period)) { // scanTime can be tricky to match period exactly, let's assume they match session
                    const stu = AppState.currentCheckinStudents.find(s => s.studentId === record.studentId || s.id === record.studentId);
                    if (stu) {
                        AppState.activeCheckinStates[stu.id] = 'มา';
                        if (!AppState.pendingSyncIds.includes(record.id)) {
                            AppState.pendingSyncIds.push(record.id);
                        }
                        count++;
                    }
                }
            });
            renderCheckinTable();
            if (count > 0) showToast(`ดึงข้อมูลสำเร็จ ${count} คน`);
            else showToast(`ไม่มีข้อมูลใหม่`, false);
        }
    } catch(e) {
        showToast('เกิดข้อผิดพลาดในการดึงข้อมูล', true);
    }
    btn.innerHTML = '<i class="fas fa-cloud-download-alt mr-1"></i> ดึงสแกน';
}


// ================= Student Side =================

export function showStudentPersonalQr() {
    const container = document.getElementById('qr-classroom-container'); // Reuse container logic
    if(!container) return; // For simplicity in student tab, let's create a dynamic modal if not exists, or just use the same modal.
    
    // We will use qr-classroom-modal but change titles
    const modal = document.getElementById('qr-classroom-modal');
    document.querySelector('#qr-classroom-modal h3').innerText = "QR ประจำตัวนักเรียน";
    document.getElementById('qr-classroom-desc').innerText = "แสดง QR Code นี้ให้ครูผู้สอนสแกน";
    document.getElementById('qr-classroom-timer').parentNode.style.display = "none";
    
    container.innerHTML = '';
    const stu = AppState.currentUser;
    const qrData = {
        t: 'S',
        id: stu.studentId || stu.id,
        ts: Date.now()
    };
    const encodedData = encodeURIComponent(JSON.stringify(qrData));
    container.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodedData}" class="mx-auto shadow-md rounded-xl" alt="QR Code">`;
    
    modal.classList.add('show');
}

export function startStudentQrScanner() {
    startCameraWithList((decodedText) => {
        try {
            const data = JSON.parse(decodedText);
            if (data.t === 'C' || data.type === 'CLASSROOM') {
                const diff = Date.now() - (data.ts || data.timestamp);
                if (diff > 5 * 60 * 1000) {
                    alert("QR Code นี้หมดอายุแล้ว กรุณาแจ้งครูให้สร้างใหม่");
                    return;
                }
                playBeep();
                stopStudentQrScanner();
                processStudentScan({
                    clsId: data.c || data.clsId,
                    subId: data.s || data.subId,
                    tId: data.tc || data.tId,
                    period: data.p || data.period
                });
            }
        } catch (e) {}
    });
}

export function stopStudentQrScanner() {
    try {
        if (html5QrCode && html5QrCode.isScanning) {
            html5QrCode.stop().then(() => {
                html5QrCode.clear();
            }).catch(e => console.error("Error stopping", e));
        } else if (html5QrCode) {
            html5QrCode.clear();
        }
    } catch (e) { console.error(e); }
    document.getElementById('qr-scanner-modal').classList.remove('show');
}

function processStudentScan(data) {
    currentQrData = data;
    
    // Check GPS
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const lat = pos.coords.latitude;
                const lon = pos.coords.longitude;
                const dist = calculateDistance(lat, lon, SCHOOL_LAT, SCHOOL_LON);
                
                document.getElementById('qr-confirm-distance').innerText = `${Math.round(dist)} เมตร`;
                
                if (dist > 300) {
                    document.getElementById('qr-confirm-distance').classList.add('text-red-600');
                    alert(`คุณอยู่นอกพื้นที่โรงเรียน (ระยะห่าง ${Math.round(dist)} เมตร) ไม่อนุญาตให้เช็คชื่อ`);
                    return;
                }
                document.getElementById('qr-confirm-distance').classList.add('text-green-600');
                
                const subObj = AppState.allSubjects.find(s => s.id === data.subId);
                const tObj = AppState.allTeachers.find(t => t.id === data.tId);
                document.getElementById('qr-confirm-subject').innerText = subObj ? subObj.name : data.subId;
                document.getElementById('qr-confirm-teacher').innerText = tObj ? `${tObj.firstName} ${tObj.lastName}` : data.tId;
                document.getElementById('qr-confirm-period').innerText = data.period;
                
                currentQrData.lat = lat;
                currentQrData.lon = lon;
                
                document.getElementById('qr-scan-confirm-modal').classList.add('show');
            },
            (err) => { alert("ต้องอนุญาตการเข้าถึงตำแหน่งที่ตั้ง (GPS) เพื่อเช็คชื่อ"); },
            { enableHighAccuracy: true }
        );
    } else {
        alert("เบราว์เซอร์นี้ไม่รองรับ GPS");
    }
}

export async function submitStudentAttendance() {
    const btn = document.getElementById('qr-confirm-btn');
    btn.disabled = true;
    btn.innerHTML = 'กำลังบันทึก...';
    try {
        const payload = {
            action: 'studentSelfCheckin',
            payload: {
                studentId: AppState.currentUser.id,
                classId: currentQrData.clsId,
                subjectId: currentQrData.subId,
                teacherId: currentQrData.tId,
                period: currentQrData.period, // Not exact col, but let's pass it
                latitude: currentQrData.lat,
                longitude: currentQrData.lon,
                scanTime: new Date().toISOString()
            }
        };
        const apiUrl = AppState.googleSheetUrl;
        const res = await fetch(apiUrl, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        const json = await res.json();
        if (json.status === 'success') {
            showToast("เช็คชื่อสำเร็จแล้ว!");
            document.getElementById('qr-scan-confirm-modal').classList.remove('show');
        } else {
            showToast("เกิดข้อผิดพลาด: " + json.message, true);
        }
    } catch(e) {
        showToast("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้", true);
    }
    btn.disabled = false;
    btn.innerHTML = 'ยืนยันการเข้าเรียน';
}

window.showClassroomQrModal = showClassroomQrModal;
window.openTeacherQrScanner = openTeacherQrScanner;
window.pullStudentCheckIns = pullStudentCheckIns;
window.showStudentPersonalQr = showStudentPersonalQr;
window.startStudentQrScanner = startStudentQrScanner;
window.stopStudentQrScanner = stopStudentQrScanner;
window.submitStudentAttendance = submitStudentAttendance;
window.switchCamera = switchCamera;