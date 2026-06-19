import { DB_KEYS } from '../core/config.js';
import { saveToDB, syncDataFromServer } from '../services/api.js';
import { AppState } from '../core/state.js';
import { getStudentFullName, showLoading, hideLoading, showToast, customAlert, getBangkokDate, getISOTimestamp } from '../utils/helpers.js';

let currentHvStep = 1;
let currentStudentFamilyData = null;
let isDrawingSig = false;
let sigCanvas = null;
let sigCtx = null;
let hasSigned = false;

// ฟังก์ชันแปลงลิงก์ Google Drive เป็นลิงก์ที่แสดงภาพได้โดยตรง
function getDirectImageUrl(url) {
    if (!url) return '';
    const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
        // เปลี่ยนมาใช้ endpoint thumbnail ซึ่ง Google ยังอนุญาตให้ใช้เป็น src ของรูปภาพได้
        return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w1200`;
    }
    return url;
}

// ฟังก์ชันสำหรับแสดง/ซ่อนช่อง Text Box กรณีที่เลือก "อื่นๆ"
export function toggleHvOther(selectElem, targetId) {
    const target = document.getElementById(targetId);
    if (selectElem.value === 'อื่นๆ' || selectElem.value === 'ผู้ปกครองอื่นๆ') {
        target.classList.remove('hidden');
    } else {
        target.classList.add('hidden');
        target.value = '';
    }
}

// ฟังก์ชันอัปเดตปุ่ม Google Maps
export function updateMapLink(lat, lng) {
    const mapLink = document.getElementById('hv-map-link');
    if (mapLink) {
        if (lat && lng) {
            mapLink.href = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
            mapLink.classList.remove('hidden');
            mapLink.classList.add('inline-flex');
        } else {
            mapLink.href = '#';
            mapLink.classList.add('hidden');
            mapLink.classList.remove('inline-flex');
        }
    }
}

export function initHomeVisitTab() {
    // ดึงชั้นเรียนมาแสดงผลเฉพาะที่ครูคนนั้นเป็นที่ปรึกษา
    const classSelect = document.getElementById('hv-class');
    if (!classSelect) return;
    
    let advisorClasses = [];
    if (AppState.currentUser && AppState.currentUser.role === 'teacher') {
        const tId = AppState.currentUser.data.id;
        advisorClasses = AppState.allClasses.filter(c => c.advisors && c.advisors.includes(tId) && c.deleted_flg !== 'Y');
    } else if (AppState.currentUser && AppState.currentUser.role === 'admin') {
        advisorClasses = AppState.allClasses.filter(c => c.deleted_flg !== 'Y');
    }

    advisorClasses.sort((a,b) => a.className.localeCompare(b.className, undefined, {numeric: true}));
    classSelect.innerHTML = '<option value="">-- เลือกชั้นเรียน --</option>' + 
        advisorClasses.map(c => `<option value="${c.className}">${c.className}</option>`).join('');
    
    const tbody = document.getElementById('tbody-home-visit');
    if (tbody) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center py-8 text-gray-500">กรุณาเลือกชั้นเรียนและกดปุ่มค้นหาเพื่อแสดงข้อมูล</td></tr>';
    }
}

export async function searchHomeVisit() {
    const clsName = document.getElementById('hv-class').value;
    if (!clsName) {
        return customAlert('กรุณาเลือกชั้นเรียนก่อนค้นหา');
    }

    showLoading('กำลังดึงข้อมูลล่าสุดจากเซิร์ฟเวอร์...');
    try {
        await syncDataFromServer(true);
    } catch (e) {
        console.error('Error syncing home visit data:', e);
    }
    hideLoading();

    renderHomeVisitList();
}

export function renderHomeVisitList() {
    const clsName = document.getElementById('hv-class').value;
    const status = document.getElementById('hv-status').value;
    const tbody = document.getElementById('tbody-home-visit');

    const selectAllBox = document.getElementById('hv-select-all');
    if (selectAllBox) selectAllBox.checked = false;

    const bulkPrintBtn = document.getElementById('hv-btn-bulk-print');
    if (bulkPrintBtn) bulkPrintBtn.classList.add('hidden');

    if (!clsName) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center py-8 text-gray-500">กรุณาเลือกชั้นเรียนที่ท่านเป็นที่ปรึกษา</td></tr>';
        return;
    }

    let students = AppState.allStudents.filter(s => s.class === clsName && s.status !== 'ลาออก' && s.deleted_flg !== 'Y');
    
    if (status !== 'all') {
        if (status === 'ยังไม่เยี่ยม') {
            students = students.filter(s => !s.homeVisit || s.homeVisit === '' || s.homeVisit === 'ยังไม่เยี่ยม');
        } else {
            students = students.filter(s => s.homeVisit === status);
        }
    }

    students.sort((a, b) => a.number - b.number);

    if (students.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center py-8 text-gray-500">ไม่พบนักเรียนภายใต้เงื่อนไขที่เลือก</td></tr>';
        return;
    }

    tbody.innerHTML = students.map(s => {
        let bgColorClass = '';
        const hv = s.homeVisit || 'ยังไม่เยี่ยม';
        if (hv === 'สำเร็จ') bgColorClass = 'bg-green-600 text-white';
        else bgColorClass = 'bg-red-500 text-white';

        const statusSelect = `
            <select class="${bgColorClass} text-xs font-bold px-2 py-1 rounded-full cursor-pointer outline-none border-none hover:opacity-80 transition-opacity" 
                    style="appearance: none; -webkit-appearance: none; text-align: center; text-align-last: center;"
                    onclick="event.stopPropagation();" 
                    onchange="updateInlineHomeVisitStatus('${s.id}', this.value)">
                <option value="ยังไม่เยี่ยม" ${hv === 'ยังไม่เยี่ยม' ? 'selected' : ''}>ยังไม่เยี่ยม</option>
                <option value="สำเร็จ" ${hv === 'สำเร็จ' ? 'selected' : ''}>สำเร็จ</option>
                <option value="เลื่อนวันเข้าเยี่ยม" ${hv === 'เลื่อนวันเข้าเยี่ยม' ? 'selected' : ''}>เลื่อนวันเข้าเยี่ยม</option>
                <option value="ไม่พบนักเรียน" ${hv === 'ไม่พบนักเรียน' ? 'selected' : ''}>ไม่พบนักเรียน</option>
                <option value="ไม่พบผู้ปกครอง" ${hv === 'ไม่พบผู้ปกครอง' ? 'selected' : ''}>ไม่พบผู้ปกครอง</option>
                <option value="บ้านอยู่ห่างไกล" ${hv === 'บ้านอยู่ห่างไกล' ? 'selected' : ''}>บ้านอยู่ห่างไกล</option>
                <option value="ผู้ปกครองไม่สะดวก" ${hv === 'ผู้ปกครองไม่สะดวก' ? 'selected' : ''}>ผู้ปกครองไม่สะดวก</option>
            </select>
        `;

        const fatherName = (s.fatherFirstName || s.fatherLastName) ? `${s.fatherFirstName || ''} ${s.fatherLastName || ''}`.trim() : '';
        const fatherPhone = s.fatherPhone || '';
        const motherName = (s.motherFirstName || s.motherLastName) ? `${s.motherFirstName || ''} ${s.motherLastName || ''}`.trim() : '';
        const motherPhone = s.motherPhone || '';
        const parentName = (s.parentFirstName || s.parentLastName) ? `${s.parentTitle || ''}${s.parentFirstName || ''} ${s.parentLastName || ''}`.trim() : '';
        const parentPhone = s.parentPhone || '';
        const parentRelation = s.parentRelation || '';

        return `
        <tr class="hover:bg-gray-50 cursor-pointer transition-colors" onclick="openHomeVisitModal('${s.id}')">
            <td class="px-4 py-3 text-center" data-label="เลือก" onclick="event.stopPropagation();">
                <input type="checkbox" class="hv-student-checkbox" value="${s.id}" data-status="${hv}" ${hv !== 'สำเร็จ' ? 'disabled title="กรุณาบันทึกข้อมูลเยี่ยมบ้านสำเร็จก่อน"' : 'onchange="updateBulkPrintButtonVisibility()"'} >
            </td>
            <td class="hidden md:table-cell px-4 py-3 text-sm" data-label="เลขที่">${s.number || '-'}</td>
            <td class="hidden md:table-cell px-4 py-3 text-sm font-mono text-gray-500" data-label="รหัสนักเรียน">${s.studentId || '-'}</td>
            <td class="px-4 py-3 td-name" data-label="ชื่อ - นามสกุล">
                <div class="td-name-content font-bold text-gray-800">${getStudentFullName(s)}</div>
                <div class="md:hidden mt-1 text-xs text-gray-500">เลขที่ ${s.number || '-'} | รหัส: ${s.studentId || '-'}</div>
                <div class="md:hidden mt-1 text-xs text-gray-500">โทร: ${s.phone || '-'}</div>
                <div class="md:hidden mt-1.5 pt-1.5 border-t border-gray-200/60 text-[11px] text-gray-600 space-y-0.5">
                    <div><strong>บิดา:</strong> ${fatherName || '<span class="text-gray-400">ไม่ระบุ</span>'} ${fatherPhone ? `(${fatherPhone})` : ''}</div>
                    <div><strong>มารดา:</strong> ${motherName || '<span class="text-gray-400">ไม่ระบุ</span>'} ${motherPhone ? `(${motherPhone})` : ''}</div>
                    <div><strong>ผู้ปกครอง:</strong> ${parentName || '<span class="text-gray-400">ไม่ระบุ</span>'} ${parentRelation ? `(${parentRelation})` : ''} ${parentPhone ? `(${parentPhone})` : ''}</div>
                </div>
            </td>
            <td class="hidden lg:table-cell px-4 py-3 text-xs text-gray-600" data-label="ข้อมูลผู้ปกครอง">
                <div class="space-y-1">
                    <div><strong class="text-gray-700">บิดา:</strong> ${fatherName || '<span class="text-gray-400">ไม่ระบุ</span>'} ${fatherPhone ? `<span class="font-mono text-gray-500">(${fatherPhone})</span>` : ''}</div>
                    <div><strong class="text-gray-700">มารดา:</strong> ${motherName || '<span class="text-gray-400">ไม่ระบุ</span>'} ${motherPhone ? `<span class="font-mono text-gray-500">(${motherPhone})</span>` : ''}</div>
                    <div><strong class="text-gray-700">ผู้ปกครอง:</strong> ${parentName || '<span class="text-gray-400">ไม่ระบุ</span>'} ${parentRelation ? `<span class="text-indigo-600 font-semibold">(${parentRelation})</span>` : ''} ${parentPhone ? `<span class="font-mono text-gray-500">(${parentPhone})</span>` : ''}</div>
                </div>
            </td>
            <td class="hidden md:table-cell px-4 py-3 text-sm text-gray-600" data-label="เบอร์โทรศัพท์ติดต่อ">${s.phone || '-'}</td>
            <td class="px-4 py-3 text-center" data-label="ข้อมูลที่พักนักเรียน" onclick="event.stopPropagation();">
                <button onclick="openStudentHomeInfoModal('${s.id}')" class="w-full md:w-auto bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded text-sm md:text-xs font-bold transition whitespace-nowrap"><i class="fas fa-map-marked-alt mr-1"></i> พิกัด/รูปบ้าน</button>
            </td>
            <td class="px-4 py-3 text-center" data-label="สถานะการเยี่ยมบ้าน" onclick="event.stopPropagation();">
                ${statusSelect}
            </td>
            <td class="px-4 py-3 text-center td-actions" data-label="จัดการ" onclick="event.stopPropagation();">
                <div class="flex justify-center items-center gap-1">
                    <button onclick="openHomeVisitModal('${s.id}')" class="w-full md:w-auto bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-600 px-3 py-1.5 rounded text-sm md:text-xs font-bold transition whitespace-nowrap"><i class="fas fa-edit mr-1"></i> บันทึก</button>
                    ${hv === 'สำเร็จ' ? `<button onclick="printHomeVisitReport('${s.id}')" class="w-full md:w-auto bg-green-50 border border-green-200 hover:bg-green-100 text-green-600 px-3 py-1.5 rounded text-sm md:text-xs font-bold transition whitespace-nowrap"><i class="fas fa-file-pdf mr-1"></i> รายงาน</button>` : ''}
                </div>
            </td>
        </tr>`;
    }).join('');
}

export function openStudentHomeInfoModal(studentId) {
    const student = AppState.allStudents.find(s => s.id === studentId);
    if (!student) return;

    document.getElementById('shi-directions').innerText = student.home_directions || student.address || 'นักเรียนยังไม่ได้ระบุข้อมูล';

    const mapLink = document.getElementById('shi-map-link');
    const coordsText = document.getElementById('shi-coords');
    if (student.home_latitude && student.home_longitude) {
        mapLink.href = `https://www.google.com/maps/search/?api=1&query=${student.home_latitude},${student.home_longitude}`;
        mapLink.classList.remove('hidden');
        coordsText.innerText = `Lat: ${student.home_latitude}, Lng: ${student.home_longitude}`;
    } else {
        mapLink.href = '#';
        mapLink.classList.add('hidden');
        coordsText.innerText = 'นักเรียนยังไม่ได้ระบุพิกัด GPS';
    }

    let hasPhotos = false;
    for (let i = 1; i <= 3; i++) {
        const imgEl = document.getElementById(`shi-photo-${i}`);
        const url = student[`home_photo_${i}_url`];
        if (url) {
            imgEl.src = getDirectImageUrl(url);
            imgEl.classList.remove('hidden');
            hasPhotos = true;
        } else {
            imgEl.src = '';
            imgEl.classList.add('hidden');
        }
    }
    document.getElementById('shi-no-photos').classList.toggle('hidden', hasPhotos);
    document.getElementById('student-home-info-modal').classList.add('show');
}

export async function updateInlineHomeVisitStatus(studentId, newStatus) {
    const sIdx = AppState.allStudents.findIndex(s => s.id === studentId);
    if (sIdx > -1) {
        AppState.allStudents[sIdx].homeVisit = newStatus;
        AppState.allStudents[sIdx].updatedAt = getISOTimestamp();
        await saveToDB(DB_KEYS.STUDENTS, AppState.allStudents, 'saveStudents');
        showToast('อัปเดตสถานะเยี่ยมบ้านเรียบร้อย');
        renderHomeVisitList(); 
    }
}

export function setHomeVisitFieldsDisabled(disabled) {
    const container = document.getElementById('hv-form-container');
    if (!container) return;
    
    // Disable inputs, selects, textareas
    container.querySelectorAll('input, select, textarea').forEach(el => {
        if (el.id === 'hv-student-id' || el.id === 'hv-lat' || el.id === 'hv-lng') return;
        
        if (disabled) {
            el.setAttribute('disabled', 'true');
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                el.classList.add('bg-gray-100');
            }
        } else {
            el.removeAttribute('disabled');
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                el.classList.remove('bg-gray-100');
            }
        }
    });

    // Disable file label triggers (camera buttons)
    const fileLabels = container.querySelectorAll('label[for^="hv-photo"]');
    fileLabels.forEach(lbl => {
        if (disabled) {
            lbl.style.pointerEvents = 'none';
            lbl.classList.add('opacity-50');
        } else {
            lbl.style.pointerEvents = 'auto';
            lbl.classList.remove('opacity-50');
        }
    });

    // Disable remove image buttons
    const removeBtns = container.querySelectorAll('button[id^="hv-remove"]');
    removeBtns.forEach(btn => {
        if (disabled) {
            btn.classList.add('hidden');
            btn.classList.remove('flex');
        } else {
            const index = btn.id.replace('hv-remove', '');
            const preview = document.getElementById(`hv-preview${index}`);
            if (preview && !preview.classList.contains('hidden') && preview.src) {
                btn.classList.remove('hidden');
                btn.classList.add('flex');
            }
        }
    });

    // Disable watchdog checkboxes
    container.querySelectorAll('.hv-watchlist').forEach(cb => {
        const label = cb.closest('label');
        if (label) {
            if (disabled) {
                label.classList.add('opacity-60', 'pointer-events-none');
            } else {
                label.classList.remove('opacity-60', 'pointer-events-none');
            }
        }
    });

    // Disable copy buttons (autofill)
    const copyButtons = container.querySelectorAll('button[onclick^="autofillHvGuardian"]');
    copyButtons.forEach(btn => {
        if (disabled) {
            btn.classList.add('opacity-50', 'pointer-events-none');
        } else {
            btn.classList.remove('opacity-50', 'pointer-events-none');
        }
    });

    // Disable GPS button
    const gpsBtn = container.querySelector('button[onclick="getGPSLocation()"]');
    if (gpsBtn) {
        if (disabled) {
            gpsBtn.classList.add('opacity-50', 'pointer-events-none');
        } else {
            gpsBtn.classList.remove('opacity-50', 'pointer-events-none');
        }
    }

    // Disable Signature clear button
    const clearSigBtn = container.querySelector('button[onclick="clearSignature()"]');
    if (clearSigBtn) {
        if (disabled) {
            clearSigBtn.classList.add('opacity-50', 'pointer-events-none');
        } else {
            clearSigBtn.classList.remove('opacity-50', 'pointer-events-none');
        }
    }

    // Disable Save button
    const saveBtn = document.getElementById('hv-btn-save');
    if (saveBtn) {
        if (disabled) {
            saveBtn.classList.add('opacity-50', 'pointer-events-none');
        } else {
            saveBtn.classList.remove('opacity-50', 'pointer-events-none');
        }
    }
}

export function enableHomeVisitEditing() {
    window.hvIsReadOnly = false;
    setHomeVisitFieldsDisabled(false);
    
    // Hide the Edit button
    const editBtn = document.getElementById('hv-btn-edit-mode');
    if (editBtn) editBtn.classList.add('hidden');
    showToast('เปิดโหมดแก้ไขข้อมูลเรียบร้อย');
}

export async function openHomeVisitModal(studentId) {
    const student = AppState.allStudents.find(s => s.id === studentId);
    if (!student) return;

    window.hvIsReadOnly = false;
    setHomeVisitFieldsDisabled(false);
    const editBtn = document.getElementById('hv-btn-edit-mode');
    if (editBtn) editBtn.classList.add('hidden');

    document.getElementById('hv-student-id').value = student.id;
    document.getElementById('hv-display-name').innerText = getStudentFullName(student);
    document.getElementById('hv-display-studentid').innerText = student.studentId || '-';
    document.getElementById('hv-display-class').innerText = student.class || '-';
    
    // ดึงข้อมูลครอบครัวจากฐานข้อมูลนักเรียนมาจัดเก็บและแสดงผล
    currentStudentFamilyData = {
        fatherName: (student.fatherFirstName || student.fatherLastName) ? `${student.fatherFirstName || ''} ${student.fatherLastName || ''}`.trim() : '',
        fatherPhone: student.fatherPhone || '',
        fatherJob: student.fatherJob || '',
        motherName: (student.motherFirstName || student.motherLastName) ? `${student.motherFirstName || ''} ${student.motherLastName || ''}`.trim() : '',
        motherPhone: student.motherPhone || '',
        motherJob: student.motherJob || '',
        parentName: (student.parentFirstName || student.parentLastName) ? `${student.parentTitle || ''}${student.parentFirstName || ''} ${student.parentLastName || ''}`.trim() : '',
        parentPhone: student.parentPhone || '',
        parentRelation: student.parentRelation || ''
    };

    document.getElementById('hv-db-father-name').innerText = currentStudentFamilyData.fatherName || 'ไม่ระบุ';
    document.getElementById('hv-db-father-phone').innerText = currentStudentFamilyData.fatherPhone ? `📞 ${currentStudentFamilyData.fatherPhone}` : 'ไม่มีเบอร์โทร';
    document.getElementById('hv-db-father-job').innerText = currentStudentFamilyData.fatherJob ? `💼 ${currentStudentFamilyData.fatherJob}` : 'ไม่ระบุอาชีพ';

    document.getElementById('hv-db-mother-name').innerText = currentStudentFamilyData.motherName || 'ไม่ระบุ';
    document.getElementById('hv-db-mother-phone').innerText = currentStudentFamilyData.motherPhone ? `📞 ${currentStudentFamilyData.motherPhone}` : 'ไม่มีเบอร์โทร';
    document.getElementById('hv-db-mother-job').innerText = currentStudentFamilyData.motherJob ? `💼 ${currentStudentFamilyData.motherJob}` : 'ไม่ระบุอาชีพ';

    document.getElementById('hv-db-parent-name').innerText = currentStudentFamilyData.parentName || 'ไม่ระบุ';
    document.getElementById('hv-db-parent-phone').innerText = currentStudentFamilyData.parentPhone ? `📞 ${currentStudentFamilyData.parentPhone}` : 'ไม่มีเบอร์โทร';
    document.getElementById('hv-db-parent-rel').innerText = currentStudentFamilyData.parentRelation ? `👥 ${currentStudentFamilyData.parentRelation}` : 'ไม่ระบุความสัมพันธ์';
    
    document.querySelectorAll('#hv-form-container input[type="text"], #hv-form-container input[type="tel"], #hv-form-container input[type="date"], #hv-form-container textarea').forEach(el => el.value = '');
    document.querySelectorAll('.hv-watchlist').forEach(cb => cb.checked = false);
    document.querySelectorAll('#hv-form-container select').forEach(el => el.selectedIndex = 0);
    document.querySelectorAll('input[type="file"]').forEach(el => el.value = '');
    document.querySelectorAll('img[id^="hv-preview"]').forEach(el => { el.src = ''; el.classList.add('hidden'); });
    document.querySelectorAll('button[id^="hv-remove"]').forEach(el => { el.classList.add('hidden'); el.classList.remove('flex'); });
    updateMapLink(null, null);
    
    clearSignature();
    const savedSigContainer = document.getElementById('hv-saved-sig-container');
    const savedSigPreview = document.getElementById('hv-sig-preview');
    if (savedSigContainer) savedSigContainer.classList.add('hidden');
    if (savedSigPreview) savedSigPreview.src = '';
    
    const printBtn = document.getElementById('hv-btn-print');
    if (printBtn) printBtn.classList.add('hidden');
    
    ['hv-guardian-rel-other', 'hv-housing-other', 'hv-commute-other'].forEach(id => {
        const el = document.getElementById(id);
        if(el) { el.classList.add('hidden'); el.value = ''; }
    });
    
    document.getElementById('hv-visit-date').value = getBangkokDate(new Date());
    
    const currentHv = student.homeVisit;
    const validStatuses = ['สำเร็จ', 'เลื่อนวันเข้าเยี่ยม', 'ไม่พบนักเรียน', 'ไม่พบผู้ปกครอง', 'บ้านอยู่ห่างไกล', 'ผู้ปกครองไม่สะดวก'];
    document.getElementById('hv-visit-status').value = validStatuses.includes(currentHv) ? currentHv : 'สำเร็จ';

    showLoading('กำลังดึงข้อมูลประวัติเยี่ยมบ้าน...');
    try {
        const yr = document.getElementById('hv-year').value;
        const sem = document.getElementById('hv-semester').value;
        const response = await fetch(AppState.googleSheetUrl, {
            method: 'POST',
            redirect: 'follow',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'getHomeVisitData', studentId: student.id, academicYear: yr, semester: sem })
        });
        const result = await response.json();
        
        if (result.success && result.data) {
            const data = result.data;
            document.getElementById('hv-guardian-name').value = data.guardian_name || '';
            document.getElementById('hv-guardian-phone').value = data.guardian_phone || '';
            if (data.visit_date) document.getElementById('hv-visit-date').value = data.visit_date.split('T')[0];
            
            const setDropdownAndOther = (selectId, otherId, val, otherKeyword, defaultVal) => {
                const select = document.getElementById(selectId);
                const other = document.getElementById(otherId);
                if (!val) val = defaultVal;
                
                let found = Array.from(select.options).some(opt => opt.value === val);
                
                if (found) {
                    select.value = val;
                    other.classList.add('hidden');
                    other.value = '';
                } else {
                    select.value = otherKeyword;
                    other.classList.remove('hidden');
                    other.value = val;
                }
            };
            
            setDropdownAndOther('hv-guardian-rel', 'hv-guardian-rel-other', data.guardian_relationship, 'ผู้ปกครองอื่นๆ', 'บิดา');
            setDropdownAndOther('hv-housing', 'hv-housing-other', data.housing_type, 'อื่นๆ', 'บ้านส่วนตัว');
            setDropdownAndOther('hv-commute', 'hv-commute-other', data.commute_method, 'อื่นๆ', 'รถรับส่งนักเรียน');
            document.getElementById('hv-economic').value = data.economic_status || 'ปานกลาง';
            document.getElementById('hv-environment').value = data.environment_safety || '';
            
            document.getElementById('hv-behavior').value = data.home_behavior || '';
            document.getElementById('hv-suggestions').value = data.guardian_suggestions || '';
            
            if (data.watchlist_issues) {
                const issues = data.watchlist_issues.split(',');
                document.querySelectorAll('.hv-watchlist').forEach(cb => {
                    if (issues.includes(cb.value)) cb.checked = true;
                });
            }
            
            document.getElementById('hv-lat').value = data.latitude || '';
            document.getElementById('hv-lng').value = data.longitude || '';
            updateMapLink(data.latitude, data.longitude);

            if (data.photo_1_url) { 
                document.getElementById('hv-preview1').src = getDirectImageUrl(data.photo_1_url); 
                document.getElementById('hv-preview1').classList.remove('hidden'); 
            }
            if (data.photo_2_url) { 
                document.getElementById('hv-preview2').src = getDirectImageUrl(data.photo_2_url); 
                document.getElementById('hv-preview2').classList.remove('hidden'); 
            }
            if (data.photo_3_url) { 
                document.getElementById('hv-preview3').src = getDirectImageUrl(data.photo_3_url); 
                document.getElementById('hv-preview3').classList.remove('hidden'); 
            }
            if (data.signature_url) {
                const savedSigContainer = document.getElementById('hv-saved-sig-container');
                const savedSigPreview = document.getElementById('hv-sig-preview');
                if (savedSigPreview) savedSigPreview.src = getDirectImageUrl(data.signature_url);
                if (savedSigContainer) savedSigContainer.classList.remove('hidden');
            }
            if (printBtn) printBtn.classList.remove('hidden');

            // Lock fields for editing if a record exists
            window.hvIsReadOnly = true;
            setHomeVisitFieldsDisabled(true);
            if (editBtn) editBtn.classList.remove('hidden');
        }
    } catch (e) {
        console.error(e);
    }
    hideLoading();

    currentHvStep = 1;
    updateHvUI();
    document.getElementById('home-visit-modal').classList.add('show');
}

export function changeHvStep(direction) {
    currentHvStep += direction;
    if (currentHvStep < 1) currentHvStep = 1;
    if (currentHvStep > 5) currentHvStep = 5;
    updateHvUI();
}

function updateHvUI() {
    document.querySelectorAll('.hv-step').forEach((el, index) => {
        el.classList.toggle('hidden', index + 1 !== currentHvStep);
        el.classList.toggle('block', index + 1 === currentHvStep);
    });

    for(let i=1; i<=5; i++) {
        const tab = document.getElementById(`hv-step-${i}-tab`);
        if(tab) {
            if(i === currentHvStep) {
                tab.classList.remove('text-gray-400', 'font-medium');
                tab.classList.add('text-blue-600', 'font-bold');
            } else {
                tab.classList.remove('text-blue-600', 'font-bold');
                tab.classList.add('text-gray-400', 'font-medium');
            }
        }
    }

    document.getElementById('hv-btn-prev').classList.toggle('hidden', currentHvStep === 1);
    document.getElementById('hv-btn-next').classList.toggle('hidden', currentHvStep === 5);
    document.getElementById('hv-btn-save').classList.toggle('hidden', currentHvStep !== 5);

    if (currentHvStep === 5) {
        setTimeout(initSignaturePad, 50);
    }
}

export function initSignaturePad() {
    sigCanvas = document.getElementById('hv-sig-canvas');
    if (!sigCanvas) return;
    sigCtx = sigCanvas.getContext('2d');
    
    resizeSigCanvas();
    
    sigCanvas.removeEventListener('mousedown', startDrawing);
    sigCanvas.removeEventListener('mousemove', draw);
    sigCanvas.removeEventListener('mouseup', stopDrawing);
    sigCanvas.removeEventListener('mouseleave', stopDrawing);
    
    sigCanvas.addEventListener('mousedown', startDrawing);
    sigCanvas.addEventListener('mousemove', draw);
    sigCanvas.addEventListener('mouseup', stopDrawing);
    sigCanvas.addEventListener('mouseleave', stopDrawing);
    
    sigCanvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    sigCanvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    sigCanvas.addEventListener('touchend', handleTouchEnd, { passive: false });
}

function resizeSigCanvas() {
    if (!sigCanvas || !sigCtx) return;
    const rect = sigCanvas.getBoundingClientRect();
    sigCanvas.width = rect.width;
    sigCanvas.height = rect.height;
    
    sigCtx.strokeStyle = '#000000';
    sigCtx.lineWidth = 3;
    sigCtx.lineCap = 'round';
    sigCtx.lineJoin = 'round';
    
    hasSigned = false;
    const placeholder = document.getElementById('hv-sig-placeholder');
    if (placeholder) placeholder.classList.remove('hidden');
}

function startDrawing(e) {
    if (window.hvIsReadOnly) return;
    isDrawingSig = true;
    const rect = sigCanvas.getBoundingClientRect();
    sigCtx.beginPath();
    sigCtx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    const placeholder = document.getElementById('hv-sig-placeholder');
    if (placeholder) placeholder.classList.add('hidden');
}

function draw(e) {
    if (window.hvIsReadOnly || !isDrawingSig) return;
    const rect = sigCanvas.getBoundingClientRect();
    sigCtx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    sigCtx.stroke();
    hasSigned = true;
}

function stopDrawing() {
    isDrawingSig = false;
}

function handleTouchStart(e) {
    if (window.hvIsReadOnly) return;
    if (e.touches.length === 1) {
        const touch = e.touches[0];
        const rect = sigCanvas.getBoundingClientRect();
        isDrawingSig = true;
        sigCtx.beginPath();
        sigCtx.moveTo(touch.clientX - rect.left, touch.clientY - rect.top);
        const placeholder = document.getElementById('hv-sig-placeholder');
        if (placeholder) placeholder.classList.add('hidden');
        e.preventDefault();
    }
}

function handleTouchMove(e) {
    if (window.hvIsReadOnly) return;
    if (isDrawingSig && e.touches.length === 1) {
        const touch = e.touches[0];
        const rect = sigCanvas.getBoundingClientRect();
        sigCtx.lineTo(touch.clientX - rect.left, touch.clientY - rect.top);
        sigCtx.stroke();
        hasSigned = true;
        e.preventDefault();
    }
}

function handleTouchEnd(e) {
    isDrawingSig = false;
    e.preventDefault();
}

export function clearSignature() {
    if (!sigCanvas || !sigCtx) return;
    sigCtx.clearRect(0, 0, sigCanvas.width, sigCanvas.height);
    hasSigned = false;
    const placeholder = document.getElementById('hv-sig-placeholder');
    if (placeholder) placeholder.classList.remove('hidden');
}

export function getGPSLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((position) => {
            document.getElementById('hv-lat').value = position.coords.latitude;
            document.getElementById('hv-lng').value = position.coords.longitude;
            updateMapLink(position.coords.latitude, position.coords.longitude);
            showToast('ดึงพิกัด GPS สำเร็จ');
        }, (error) => {
            customAlert('ไม่สามารถดึงพิกัดได้: ' + error.message);
        });
    } else {
        customAlert('เบราว์เซอร์ของคุณไม่รองรับ Geolocation');
    }
}

export function previewImage(event, previewId, removeBtnId) {
    const file = event.target.files[0];
    const preview = document.getElementById(previewId);
    const removeBtn = document.getElementById(removeBtnId);
    
    // Revoke old object URL if exists to prevent memory leaks
    if (preview && preview.src && preview.src.startsWith('blob:')) {
        URL.revokeObjectURL(preview.src);
    }
    
    if (file) {
        if (preview) {
            preview.src = URL.createObjectURL(file);
            preview.classList.remove('hidden');
        }
        if (removeBtn) {
            removeBtn.classList.remove('hidden');
            removeBtn.classList.add('flex');
        }
    } else {
        if (preview) {
            preview.src = '';
            preview.classList.add('hidden');
        }
        if (removeBtn) {
            removeBtn.classList.add('hidden');
            removeBtn.classList.remove('flex');
        }
    }
}

export function removeImage(index) {
    const fileInput = document.getElementById(`hv-photo${index}`);
    const preview = document.getElementById(`hv-preview${index}`);
    const removeBtn = document.getElementById(`hv-remove${index}`);
    
    if (fileInput) fileInput.value = '';
    if (preview) {
        if (preview.src && preview.src.startsWith('blob:')) {
            URL.revokeObjectURL(preview.src);
        }
        preview.src = '';
        preview.classList.add('hidden');
    }
    if (removeBtn) {
        removeBtn.classList.add('hidden');
        removeBtn.classList.remove('flex');
    }
}

export function viewLargeImage(src) {
    if (!src) return;
    const modal = document.getElementById('image-viewer-modal');
    const img = document.getElementById('large-image-preview');
    if (modal && img) {
        img.src = src;
        modal.classList.add('show');
    } else {
        window.open(src, '_blank');
    }
}

// ฟังก์ชันบีบอัดรูปภาพก่อนส่งเป็น Base64 เพื่อป้องกันปัญหาไฟล์ใหญ่เกินไปจน Google Apps Script timeout
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
                
                // คำนวณอัตราส่วนเพื่อรักษา Aspect Ratio โดยเช็คทั้งความกว้างและความสูง
                if (width > height) {
                    if (width > maxSize) {
                        height = Math.round(height * (maxSize / width));
                        width = maxSize;
                    }
                } else {
                    if (height > maxSize) {
                        width = Math.round(width * (maxSize / height));
                        height = maxSize;
                    }
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', quality).split(',')[1]); // แปลงเป็น JPEG และปรับคุณภาพ
            };
            img.onerror = error => reject(error);
        };
        reader.onerror = error => reject(error);
    });
}

export async function submitHomeVisit() {
    const studentId = document.getElementById('hv-student-id').value;
    const guardianName = document.getElementById('hv-guardian-name').value;
    const visitDate = document.getElementById('hv-visit-date').value;
    const visitStatus = document.getElementById('hv-visit-status').value;

    if (visitStatus === 'สำเร็จ' && (!guardianName || !visitDate)) {
        return customAlert('กรณีเยี่ยมบ้านสำเร็จ กรุณากรอกข้อมูล ชื่อผู้ปกครอง และ วันที่เยี่ยมบ้าน ในขั้นตอนที่ 1 ให้ครบถ้วน');
    } else if (!visitDate) {
        return customAlert('กรุณาระบุ วันที่ลงพื้นที่/วันที่บันทึก ในช่องวันที่เยี่ยมบ้าน');
    }

    const getDropdownOrOtherValue = (selectId, otherId, otherKeyword) => {
        const selectVal = document.getElementById(selectId).value;
        if (selectVal === otherKeyword) {
            return document.getElementById(otherId).value || otherKeyword;
        }
        return selectVal;
    };

    const p1Preview = document.getElementById('hv-preview1');
    const p2Preview = document.getElementById('hv-preview2');
    const p3Preview = document.getElementById('hv-preview3');
    const sigPreview = document.getElementById('hv-sig-preview');

    const payload = {
        student_id: studentId,
        academic_year: document.getElementById('hv-year').value,
        semester: document.getElementById('hv-semester').value,
        visit_date: visitDate,
        guardian_name: guardianName,
        guardian_relationship: getDropdownOrOtherValue('hv-guardian-rel', 'hv-guardian-rel-other', 'ผู้ปกครองอื่นๆ'),
        guardian_phone: document.getElementById('hv-guardian-phone').value,
        housing_type: getDropdownOrOtherValue('hv-housing', 'hv-housing-other', 'อื่นๆ'),
        economic_status: document.getElementById('hv-economic').value,
        commute_method: getDropdownOrOtherValue('hv-commute', 'hv-commute-other', 'อื่นๆ'),
        environment_safety: document.getElementById('hv-environment').value,
        home_behavior: document.getElementById('hv-behavior').value,
        watchlist_issues: Array.from(document.querySelectorAll('.hv-watchlist:checked')).map(cb => cb.value).join(','),
        guardian_suggestions: document.getElementById('hv-suggestions').value,
        latitude: document.getElementById('hv-lat').value,
        longitude: document.getElementById('hv-lng').value,
        photo_1_url: (p1Preview && !p1Preview.classList.contains('hidden') && p1Preview.src) ? p1Preview.src : '',
        photo_2_url: (p2Preview && !p2Preview.classList.contains('hidden') && p2Preview.src) ? p2Preview.src : '',
        photo_3_url: (p3Preview && !p3Preview.classList.contains('hidden') && p3Preview.src) ? p3Preview.src : '',
        signature_url: (sigPreview && sigPreview.src) ? sigPreview.src : '',
        updated_by: AppState.currentUser ? AppState.currentUser.data.id : 'unknown'
    };

    showLoading('กำลังอัปโหลดข้อมูลและรูปภาพ...');
    try {
        const f1 = document.getElementById('hv-photo1').files[0];
        const f2 = document.getElementById('hv-photo2').files[0];
        const f3 = document.getElementById('hv-photo3').files[0];

        if (f1) { payload.photo_1_base64 = await compressImage(f1); payload.photo_1_mime = 'image/jpeg'; payload.photo_1_name = f1.name; }
        if (f2) { payload.photo_2_base64 = await compressImage(f2); payload.photo_2_mime = 'image/jpeg'; payload.photo_2_name = f2.name; }
        if (f3) { payload.photo_3_base64 = await compressImage(f3); payload.photo_3_mime = 'image/jpeg'; payload.photo_3_name = f3.name; }
        if (hasSigned && sigCanvas) {
            payload.signature_base64 = sigCanvas.toDataURL('image/png').split(',')[1];
            payload.signature_mime = 'image/png';
            payload.signature_name = 'guardian_signature.png';
        }

        const response = await fetch(AppState.googleSheetUrl, {
            method: 'POST',
            redirect: 'follow', // จำเป็นต้องใส่เพื่อให้รองรับการ Redirect ของ Google Apps Script
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // ป้องกันปัญหา CORS
            body: JSON.stringify({ action: 'saveHomeVisitData', payload: payload })
        });
        
        const text = await response.text();
        let result = {};
        try {
            result = JSON.parse(text);
        } catch (e) {
            console.error('JSON parse error:', e);
        }
        
        const isSuccess = response.ok || result.success === true || result.status === 'success' || text.toLowerCase().includes('success') || text.includes('สำเร็จ');
        if (isSuccess) {
            const sIdx = AppState.allStudents.findIndex(s => s.id === studentId);
            if (sIdx > -1) {
                AppState.allStudents[sIdx].homeVisit = visitStatus;
                AppState.allStudents[sIdx].updatedAt = getISOTimestamp();
                await saveToDB(DB_KEYS.STUDENTS, AppState.allStudents, 'saveStudents');
            }
            document.getElementById('home-visit-modal').classList.remove('show');
            renderHomeVisitList();
            showToast('บันทึกข้อมูลเยี่ยมบ้านเรียบร้อย');
        } else {
            customAlert('เกิดข้อผิดพลาดในการบันทึก: ' + (result.message || text || ''));
        }
    } catch (e) {
        console.error(e);
        customAlert('การเชื่อมต่อล้มเหลว กรุณาลองอีกครั้ง');
    }
    hideLoading();
}

export function autofillHvGuardian(role) {
    if (!currentStudentFamilyData) return;

    const nameInput = document.getElementById('hv-guardian-name');
    const relSelect = document.getElementById('hv-guardian-rel');
    const phoneInput = document.getElementById('hv-guardian-phone');
    const otherRelInput = document.getElementById('hv-guardian-rel-other');

    if (role === 'father') {
        nameInput.value = currentStudentFamilyData.fatherName;
        relSelect.value = 'บิดา';
        phoneInput.value = currentStudentFamilyData.fatherPhone;
        if (otherRelInput) { otherRelInput.classList.add('hidden'); otherRelInput.value = ''; }
    } else if (role === 'mother') {
        nameInput.value = currentStudentFamilyData.motherName;
        relSelect.value = 'มารดา';
        phoneInput.value = currentStudentFamilyData.motherPhone;
        if (otherRelInput) { otherRelInput.classList.add('hidden'); otherRelInput.value = ''; }
    } else if (role === 'parent') {
        nameInput.value = currentStudentFamilyData.parentName;
        phoneInput.value = currentStudentFamilyData.parentPhone;
        
        const relVal = currentStudentFamilyData.parentRelation;
        const selectOptions = Array.from(relSelect.options).map(opt => opt.value);
        if (selectOptions.includes(relVal)) {
            relSelect.value = relVal;
            if (otherRelInput) { otherRelInput.classList.add('hidden'); otherRelInput.value = ''; }
        } else {
            relSelect.value = 'ผู้ปกครองอื่นๆ';
            if (otherRelInput) {
                otherRelInput.classList.remove('hidden');
                otherRelInput.value = relVal;
            }
        }
    }
}

window.initHomeVisitTab = initHomeVisitTab;
window.renderHomeVisitList = renderHomeVisitList;
window.searchHomeVisit = searchHomeVisit;
window.openHomeVisitModal = openHomeVisitModal;
window.changeHvStep = changeHvStep;
window.getGPSLocation = getGPSLocation;
window.previewImage = previewImage;
window.removeImage = removeImage;
window.viewLargeImage = viewLargeImage;
window.submitHomeVisit = submitHomeVisit;
window.updateInlineHomeVisitStatus = updateInlineHomeVisitStatus;
window.toggleHvOther = toggleHvOther;
window.updateMapLink = updateMapLink;
window.openStudentHomeInfoModal = openStudentHomeInfoModal;
window.autofillHvGuardian = autofillHvGuardian;
window.clearSignature = clearSignature;
window.initSignaturePad = initSignaturePad;
window.enableHomeVisitEditing = enableHomeVisitEditing;
window.setHomeVisitFieldsDisabled = setHomeVisitFieldsDisabled;

export async function printHomeVisitReport(studentId) {
    const student = AppState.allStudents.find(s => s.id === studentId);
    if (!student) return customAlert('ไม่พบข้อมูลนักเรียน');

    const yr = document.getElementById('hv-year').value;
    const sem = document.getElementById('hv-semester').value;

    showLoading('กำลังดึงข้อมูลสำหรับพิมพ์รายงาน...');
    try {
        const response = await fetch(AppState.googleSheetUrl, {
            method: 'POST',
            redirect: 'follow',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'getHomeVisitData', studentId: student.id, academicYear: yr, semester: sem })
        });
        const result = await response.json();
        hideLoading();

        if (!result.success || !result.data) {
            return customAlert('ไม่พบข้อมูลการเยี่ยมบ้านของนักเรียนคนนี้ในระบบ (กรุณาบันทึกข้อมูลก่อนพิมพ์รายงาน)');
        }

        const data = result.data;

        // ดึงชื่อครูผู้บันทึก
        let teacherName = data.updated_by || '';
        if (AppState.allTeachers) {
            const t = AppState.allTeachers.find(x => x.id === data.updated_by);
            if (t) teacherName = `${t.firstName} ${t.lastName}`;
        }

        // โหลดไฟล์เทมเพลต HTML
        const templateResponse = await fetch('homevisit_report.html');
        let html = await templateResponse.text();

        // จัดการ Watchlist
        let watchlistStr = data.watchlist_issues || 'ไม่มีประเด็นน่าเป็นห่วง';

        // จัดการจัดแสดงรูปภาพ (ถ้าไม่มีให้ใช้ placeholder)
        const placeholderImg = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="180" viewBox="0 0 300 180"><rect width="300" height="180" fill="%23f1f5f9"/><text x="50%" y="50%" font-family="sans-serif" font-size="14" fill="%2394a3b8" text-anchor="middle" dominant-baseline="middle">ไม่มีรูปภาพประกอบ</text></svg>';
        
        const photo1 = data.photo_1_url ? getDirectImageUrl(data.photo_1_url) : placeholderImg;
        const photo2 = data.photo_2_url ? getDirectImageUrl(data.photo_2_url) : placeholderImg;
        const photo3 = data.photo_3_url ? getDirectImageUrl(data.photo_3_url) : placeholderImg;

        // ลายเซ็นผู้ปกครอง
        let signatureHtml = '';
        if (data.signature_url) {
            signatureHtml = `<img src="${getDirectImageUrl(data.signature_url)}" style="max-height: 50px; object-fit: contain;" alt="ลายเซ็นผู้ปกครอง">`;
        } else {
            signatureHtml = '<span style="color:#94a3b8; font-size:10pt; font-style:italic;">(ไม่ได้ลงชื่ออิเล็กทรอนิกส์)</span>';
        }

        // จัดฟอร์แมตวันที่บันทึก
        let timestampStr = '-';
        if (data.timestamp) {
            try {
                timestampStr = new Date(data.timestamp).toLocaleString('th-TH');
            } catch(e) {
                timestampStr = data.timestamp;
            }
        }
        
        let visitDateStr = '-';
        if (data.visit_date) {
            try {
                const d = new Date(data.visit_date);
                visitDateStr = d.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
            } catch(e) {
                visitDateStr = data.visit_date;
            }
        }

        // จับคู่แทนที่ตัวแปรใน HTML Template
        const replacements = {
            '{{semester}}': sem,
            '{{academic_year}}': yr,
            '{{visit_id}}': `HV-${yr}-${sem}-${student.studentId || student.id}`,
            '{{student_name}}': getStudentFullName(student),
            '{{student_id}}': student.studentId || '-',
            '{{father_name}}': `${student.fatherFirstName || ''} ${student.fatherLastName || ''}`.trim() || '-',
            '{{father_age}}': student.fatherAge ? `${student.fatherAge} ปี` : '-',
            '{{father_job}}': student.fatherJob || '-',
            '{{father_phone}}': student.fatherPhone || '-',
            '{{mother_name}}': `${student.motherFirstName || ''} ${student.motherLastName || ''}`.trim() || '-',
            '{{mother_age}}': student.motherAge ? `${student.motherAge} ปี` : '-',
            '{{mother_job}}': student.motherJob || '-',
            '{{mother_phone}}': student.motherPhone || '-',
            '{{guardian_name}}': data.guardian_name || '-',
            '{{guardian_relationship}}': data.guardian_relationship || '-',
            '{{guardian_phone}}': data.guardian_phone || '-',
            '{{economic_status}}': data.economic_status || '-',
            '{{housing_type}}': data.housing_type || '-',
            '{{environment_safety}}': data.environment_safety || '-',
            '{{commute_method}}': data.commute_method || '-',
            '{{home_behavior}}': data.home_behavior || '-',
            '{{watchlist_issues}}': watchlistStr,
            '{{guardian_suggestions}}': data.guardian_suggestions || '-',
            '{{latitude}}': data.latitude || '-',
            '{{longitude}}': data.longitude || '-',
            '{{photo_1_url}}': photo1,
            '{{photo_2_url}}': photo2,
            '{{photo_3_url}}': photo3,
            '{{visit_date}}': visitDateStr,
            '{{updated_by}}': teacherName,
            '{{timestamp}}': timestampStr
        };

        for (const [key, val] of Object.entries(replacements)) {
            html = html.replaceAll(key, val);
        }

        // สำหรับหน้าต่างการพิมพ์ ลายเซ็นถ้ามี ให้แทรกลงในช่องลงชื่อ
        if (data.signature_url) {
            html = html.replace(
                'ลงชื่อ..........................................................<br>\n                ( <b>' + (data.guardian_name || '-') + '</b> )',
                `ลงชื่อ &nbsp; ${signatureHtml} &nbsp;<br>\n                ( <b>${data.guardian_name || '-'}</b> )`
            );
        }

        // เปิดหน้าพิมพ์รายงาน
        const printWindow = window.open('', '_blank');
        printWindow.document.write(html);
        printWindow.document.close();
        
        // รอรูปภาพโหลดเสร็จแล้วค่อยสั่งพิมพ์
        printWindow.onload = function() {
            setTimeout(() => {
                printWindow.print();
            }, 300);
        };

    } catch (e) {
        console.error(e);
        hideLoading();
        customAlert('ไม่สามารถดึงข้อมูลรายงานได้');
    }
}

export function printHomeVisitReportFromModal() {
    const studentId = document.getElementById('hv-student-id').value;
    if (studentId) {
        printHomeVisitReport(studentId);
    }
}

window.printHomeVisitReport = printHomeVisitReport;
window.printHomeVisitReportFromModal = printHomeVisitReportFromModal;

export function toggleAllHomeVisitCheckboxes(masterCheckbox) {
    const checkboxes = document.querySelectorAll('.hv-student-checkbox:not([disabled])');
    checkboxes.forEach(cb => {
        cb.checked = masterCheckbox.checked;
    });
    updateBulkPrintButtonVisibility();
}

export function updateBulkPrintButtonVisibility() {
    const checkedBoxes = document.querySelectorAll('.hv-student-checkbox:checked');
    const bulkPrintBtn = document.getElementById('hv-btn-bulk-print');
    if (bulkPrintBtn) {
        if (checkedBoxes.length > 0) {
            bulkPrintBtn.classList.remove('hidden');
        } else {
            bulkPrintBtn.classList.add('hidden');
        }
    }
}

export async function printSelectedHomeVisits() {
    const checkedBoxes = document.querySelectorAll('.hv-student-checkbox:checked');
    const completedIds = Array.from(checkedBoxes)
        .filter(cb => cb.getAttribute('data-status') === 'สำเร็จ')
        .map(cb => cb.value);

    if (completedIds.length === 0) {
        return customAlert('กรุณาเลือกนักเรียนที่มีสถานะเยี่ยมบ้าน "สำเร็จ" อย่างน้อย 1 คนเพื่อออกรายงาน');
    }

    const yr = document.getElementById('hv-year').value;
    const sem = document.getElementById('hv-semester').value;

    showLoading(`กำลังดึงข้อมูลรายงาน ${completedIds.length} รายการ...`);
    try {
        // ดึงไฟล์เทมเพลต HTML
        const templateResponse = await fetch('homevisit_report.html');
        const templateHtml = await templateResponse.text();

        // ดึงสไตล์และเนื้อหาภายใน Body จากเทมเพลต
        const headMatch = templateHtml.match(/<head>([\s\S]*?)<\/head>/);
        const bodyMatch = templateHtml.match(/<body>([\s\S]*?)<\/body>/);
        
        let styles = headMatch ? headMatch[1] : '';
        let bodyTemplate = bodyMatch ? bodyMatch[1] : '';

        // เพิ่มคลาสสำหรับแบ่งหน้าในสไตล์
        styles += `
            <style>
                .report-page {
                    page-break-after: always;
                    page-break-inside: avoid;
                    margin-bottom: 20px;
                }
                @media print {
                    .report-page {
                        page-break-after: always;
                        page-break-inside: avoid;
                        margin-bottom: 0;
                    }
                    .report-page:last-child {
                        page-break-after: avoid;
                    }
                }
            </style>
        `;

        let combinedBodyHtml = '';

        for (const studentId of completedIds) {
            const student = AppState.allStudents.find(s => s.id === studentId);
            if (!student) continue;

            const response = await fetch(AppState.googleSheetUrl, {
                method: 'POST',
                redirect: 'follow',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ action: 'getHomeVisitData', studentId: student.id, academicYear: yr, semester: sem })
            });
            const result = await response.json();

            if (result.success && result.data) {
                const data = result.data;

                let teacherName = data.updated_by || '';
                if (AppState.allTeachers) {
                    const t = AppState.allTeachers.find(x => x.id === data.updated_by);
                    if (t) teacherName = `${t.firstName} ${t.lastName}`;
                }

                let watchlistStr = data.watchlist_issues || 'ไม่มีประเด็นน่าเป็นห่วง';
                const placeholderImg = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="180" viewBox="0 0 300 180"><rect width="300" height="180" fill="%23f1f5f9"/><text x="50%" y="50%" font-family="sans-serif" font-size="14" fill="%2394a3b8" text-anchor="middle" dominant-baseline="middle">ไม่มีรูปภาพประกอบ</text></svg>';
                
                const photo1 = data.photo_1_url ? getDirectImageUrl(data.photo_1_url) : placeholderImg;
                const photo2 = data.photo_2_url ? getDirectImageUrl(data.photo_2_url) : placeholderImg;
                const photo3 = data.photo_3_url ? getDirectImageUrl(data.photo_3_url) : placeholderImg;

                let signatureHtml = '';
                if (data.signature_url) {
                    signatureHtml = `<img src="${getDirectImageUrl(data.signature_url)}" style="max-height: 50px; object-fit: contain;" alt="ลายเซ็นผู้ปกครอง">`;
                } else {
                    signatureHtml = '<span style="color:#94a3b8; font-size:10pt; font-style:italic;">(ไม่ได้ลงชื่ออิเล็กทรอนิกส์)</span>';
                }

                let timestampStr = '-';
                if (data.timestamp) {
                    try { timestampStr = new Date(data.timestamp).toLocaleString('th-TH'); } catch(e) { timestampStr = data.timestamp; }
                }
                
                let visitDateStr = '-';
                if (data.visit_date) {
                    try {
                        const d = new Date(data.visit_date);
                        visitDateStr = d.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
                    } catch(e) { visitDateStr = data.visit_date; }
                }

                const replacements = {
                    '{{semester}}': sem,
                    '{{academic_year}}': yr,
                    '{{visit_id}}': `HV-${yr}-${sem}-${student.studentId || student.id}`,
                    '{{student_name}}': getStudentFullName(student),
                    '{{student_id}}': student.studentId || '-',
                    '{{father_name}}': `${student.fatherFirstName || ''} ${student.fatherLastName || ''}`.trim() || '-',
                    '{{father_age}}': student.fatherAge ? `${student.fatherAge} ปี` : '-',
                    '{{father_job}}': student.fatherJob || '-',
                    '{{father_phone}}': student.fatherPhone || '-',
                    '{{mother_name}}': `${student.motherFirstName || ''} ${student.motherLastName || ''}`.trim() || '-',
                    '{{mother_age}}': student.motherAge ? `${student.motherAge} ปี` : '-',
                    '{{mother_job}}': student.motherJob || '-',
                    '{{mother_phone}}': student.motherPhone || '-',
                    '{{guardian_name}}': data.guardian_name || '-',
                    '{{guardian_relationship}}': data.guardian_relationship || '-',
                    '{{guardian_phone}}': data.guardian_phone || '-',
                    '{{economic_status}}': data.economic_status || '-',
                    '{{housing_type}}': data.housing_type || '-',
                    '{{environment_safety}}': data.environment_safety || '-',
                    '{{commute_method}}': data.commute_method || '-',
                    '{{home_behavior}}': data.home_behavior || '-',
                    '{{watchlist_issues}}': watchlistStr,
                    '{{guardian_suggestions}}': data.guardian_suggestions || '-',
                    '{{latitude}}': data.latitude || '-',
                    '{{longitude}}': data.longitude || '-',
                    '{{photo_1_url}}': photo1,
                    '{{photo_2_url}}': photo2,
                    '{{photo_3_url}}': photo3,
                    '{{visit_date}}': visitDateStr,
                    '{{updated_by}}': teacherName,
                    '{{timestamp}}': timestampStr
                };

                let studentReport = bodyTemplate;
                for (const [key, val] of Object.entries(replacements)) {
                    studentReport = studentReport.replaceAll(key, val);
                }

                if (data.signature_url) {
                    studentReport = studentReport.replace(
                        'ลงชื่อ..........................................................<br>\n                ( <b>' + (data.guardian_name || '-') + '</b> )',
                        `ลงชื่อ &nbsp; ${signatureHtml} &nbsp;<br>\n                ( <b>${data.guardian_name || '-'}</b> )`
                    );
                }

                combinedBodyHtml += `<div class="report-page">${studentReport}</div>`;
            }
        }

        hideLoading();

        if (combinedBodyHtml === '') {
            return customAlert('ไม่พบข้อมูลการเยี่ยมบ้านที่สามารถออกรายงานได้');
        }

        const finalHtml = `
            <!DOCTYPE html>
            <html lang="th">
            <head>
                ${styles}
            </head>
            <body>
                ${combinedBodyHtml}
            </body>
            </html>
        `;

        const printWindow = window.open('', '_blank');
        printWindow.document.write(finalHtml);
        printWindow.document.close();
        
        printWindow.onload = function() {
            setTimeout(() => {
                printWindow.print();
            }, 500);
        };

    } catch (e) {
        console.error(e);
        hideLoading();
        customAlert('เกิดข้อผิดพลาดในการสร้างรายงานรวม');
    }
}

window.toggleAllHomeVisitCheckboxes = toggleAllHomeVisitCheckboxes;
window.printSelectedHomeVisits = printSelectedHomeVisits;
window.updateBulkPrintButtonVisibility = updateBulkPrintButtonVisibility;