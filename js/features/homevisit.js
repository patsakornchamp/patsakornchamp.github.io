import { DB_KEYS } from '../core/config.js';
import { saveToDB, syncDataFromServer } from '../services/api.js';
import { AppState } from '../core/state.js';
import { getStudentFullName, showLoading, hideLoading, showToast, customAlert, getBangkokDate, getISOTimestamp } from '../utils/helpers.js';

let currentHvStep = 1;
let currentStudentFamilyData = null;

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
        if (hv === 'สำเร็จ') bgColorClass = 'bg-green-100 text-green-800';
        else if (hv === 'ยังไม่เยี่ยม') bgColorClass = 'bg-gray-100 text-gray-800';
        else bgColorClass = 'bg-yellow-100 text-yellow-800';

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
            <td class="px-4 py-3 text-center td-actions" data-label="จัดการ">
                <button class="w-full md:w-auto bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-600 px-3 py-1.5 rounded text-sm md:text-xs font-bold transition whitespace-nowrap"><i class="fas fa-edit mr-1"></i> บันทึกข้อมูล</button>
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

export async function openHomeVisitModal(studentId) {
    const student = AppState.allStudents.find(s => s.id === studentId);
    if (!student) return;

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
                document.getElementById('hv-remove1').classList.remove('hidden'); document.getElementById('hv-remove1').classList.add('flex');
            }
            if (data.photo_2_url) { 
                document.getElementById('hv-preview2').src = getDirectImageUrl(data.photo_2_url); 
                document.getElementById('hv-preview2').classList.remove('hidden'); 
                document.getElementById('hv-remove2').classList.remove('hidden'); document.getElementById('hv-remove2').classList.add('flex');
            }
            if (data.photo_3_url) { 
                document.getElementById('hv-preview3').src = getDirectImageUrl(data.photo_3_url); 
                document.getElementById('hv-preview3').classList.remove('hidden'); 
                document.getElementById('hv-remove3').classList.remove('hidden'); document.getElementById('hv-remove3').classList.add('flex');
            }
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
    if (currentHvStep > 4) currentHvStep = 4;
    updateHvUI();
}

function updateHvUI() {
    document.querySelectorAll('.hv-step').forEach((el, index) => {
        el.classList.toggle('hidden', index + 1 !== currentHvStep);
        el.classList.toggle('block', index + 1 === currentHvStep);
    });

    for(let i=1; i<=4; i++) {
        const tab = document.getElementById(`hv-step-${i}-tab`);
        if(i === currentHvStep) {
            tab.classList.remove('text-gray-400', 'font-medium');
            tab.classList.add('text-blue-600', 'font-bold');
        } else {
            tab.classList.remove('text-blue-600', 'font-bold');
            tab.classList.add('text-gray-400', 'font-medium');
        }
    }

    document.getElementById('hv-btn-prev').classList.toggle('hidden', currentHvStep === 1);
    document.getElementById('hv-btn-next').classList.toggle('hidden', currentHvStep === 4);
    document.getElementById('hv-btn-save').classList.toggle('hidden', currentHvStep !== 4);
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
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            preview.src = e.target.result;
            preview.classList.remove('hidden');
            if (removeBtn) {
                removeBtn.classList.remove('hidden');
                removeBtn.classList.add('flex');
            }
        }
        reader.readAsDataURL(file);
    } else {
        preview.classList.add('hidden');
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
    if (preview) { preview.src = ''; preview.classList.add('hidden'); }
    if (removeBtn) { removeBtn.classList.add('hidden'); removeBtn.classList.remove('flex'); }
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

        const response = await fetch(AppState.googleSheetUrl, {
            method: 'POST',
            redirect: 'follow', // จำเป็นต้องใส่เพื่อให้รองรับการ Redirect ของ Google Apps Script
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // ป้องกันปัญหา CORS
            body: JSON.stringify({ action: 'saveHomeVisitData', payload: payload })
        });
        
        const result = await response.json();
        if (result.success) {
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
            customAlert('เกิดข้อผิดพลาดในการบันทึก: ' + (result.message || ''));
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