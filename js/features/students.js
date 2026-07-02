import { AppState } from '../core/state.js';
import { DB_KEYS } from '../core/config.js';
import { generateId, getStudentFullName, showToast, customAlert, customConfirm, closeModal, validateThaiCitizenId, validatePhoneNumber, matchRecordYearSemester, getISOTimestamp, getCurrentUserId, showLoading, hideLoading, getBangkokDate, getBangkokCurrentTime, isAssignmentIdMatch } from '../utils/helpers.js';
import { saveToDB, syncDataFromServer } from '../services/api.js';

// ฟังก์ชันสำหรับแปลงไฟล์เป็น Base64
const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = error => reject(error);
});

// --- Helper functions for Student Profile ---
function getDirectImageUrl(url) {
    if (!url) return '';
    const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
        return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w1200`;
    }
    return url;
}

async function compressImage(file, maxSize = 1280, quality = 0.8) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let { width, height } = img;
                if (width > height) {
                    if (width > maxSize) { height *= maxSize / width; width = maxSize; }
                } else {
                    if (height > maxSize) { width *= maxSize / height; height = maxSize; }
                }
                canvas.width = width;
                canvas.height = height;
                canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', quality).split(',')[1]);
            };
            img.onerror = error => reject(error);
        };
        reader.onerror = error => reject(error);
    });
}

function updateMapLinkForProfile(lat, lng) {
    const mapLink = document.getElementById('sp-map-link');
    if (!mapLink) return;
    if (lat && lng) {
        mapLink.href = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
        mapLink.classList.remove('hidden');
        mapLink.classList.add('inline-flex');
    } else {
        mapLink.classList.add('hidden');
    }
}

function previewImageForProfile(event, previewId, removeBtnId) {
    const file = event.target.files[0];
    const preview = document.getElementById(previewId);
    const removeBtn = removeBtnId ? document.getElementById(removeBtnId) : null;
    
    // Revoke old object URL if exists to prevent memory leaks
    if (preview && preview.src && preview.src.startsWith('blob:')) {
        URL.revokeObjectURL(preview.src);
    }
    
    if (file && preview) {
        preview.src = URL.createObjectURL(file);
        preview.classList.remove('hidden');
        if (removeBtn) {
            removeBtn.classList.remove('hidden');
            removeBtn.classList.add('flex');
        }
    }
}

// --- Student Self Service ---
export function renderStudentProfile() {
    clearCopiedGuardianInfo();
    const s = AppState.currentUser.data;
    const defaultPic = 'https://upload.wikimedia.org/wikipedia/commons/a/ac/Default_pfp.jpg';
    document.getElementById('profile-fullname').innerText = getStudentFullName(s);
    document.getElementById('profile-studentid').innerText = `รหัสประจำตัว: ${s.studentId || '-'}`;
    
    const badgeEl = document.getElementById('profile-badges');
    let badgesHtml = '';
    const isProfileComplete = s.isProfileComplete === true || String(s.isProfileComplete).toLowerCase() === 'true';
    if (isProfileComplete) {
        badgesHtml += '<span class="bg-green-100 text-green-800 text-sm px-3 py-1 rounded-full font-medium inline-block whitespace-nowrap"><i class="fas fa-check-circle mr-1"></i> ประวัติสมบูรณ์</span>';
    } else {
        badgesHtml += '<span class="bg-yellow-100 text-yellow-800 text-sm px-3 py-1 rounded-full font-medium inline-block whitespace-nowrap"><i class="fas fa-exclamation-triangle mr-1"></i> กรุณากรอกประวัติให้ครบ</span>';
    }
    
    if (s.homeVisit === 'สำเร็จ') {
        badgesHtml += '<span class="bg-blue-100 text-blue-800 text-sm px-3 py-1 rounded-full font-medium inline-block whitespace-nowrap"><i class="fas fa-home mr-1"></i> เยี่ยมบ้านสำเร็จ</span>';
    } else if (!s.homeVisit || s.homeVisit === 'ยังไม่เยี่ยม') {
        badgesHtml += '<span class="bg-gray-100 text-gray-600 text-sm px-3 py-1 rounded-full font-medium inline-block whitespace-nowrap"><i class="fas fa-home mr-1"></i> ยังไม่เยี่ยมบ้าน</span>';
    } else {
        badgesHtml += `<span class="bg-yellow-100 text-yellow-800 text-sm px-3 py-1 rounded-full font-medium inline-block whitespace-nowrap"><i class="fas fa-home mr-1"></i> ${s.homeVisit}</span>`;
    }
    badgeEl.innerHTML = badgesHtml;

    document.getElementById('profile-pic-preview').src = s.profileImageUrl ? getDirectImageUrl(s.profileImageUrl) : defaultPic;

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

    // New Home Info fields
    document.getElementById('sp-home-lat').value = s.home_latitude || '';
    document.getElementById('sp-home-lng').value = s.home_longitude || '';
    document.getElementById('sp-home-directions').value = s.home_directions || '';
    updateMapLinkForProfile(s.home_latitude, s.home_longitude);

    for (let i = 1; i <= 3; i++) {
        const preview = document.getElementById(`sp-home-preview${i}`);
        const removeBtn = document.getElementById(`sp-home-remove${i}`);
        const fileInput = document.getElementById(`sp-home-photo${i}`);
        const imageUrl = s[`home_photo_${i}_url`];
        
        fileInput.value = '';
        if (imageUrl) {
            preview.src = getDirectImageUrl(imageUrl);
            preview.classList.remove('hidden');
            removeBtn.classList.remove('hidden');
            removeBtn.classList.add('flex');
        } else {
            preview.classList.add('hidden');
            removeBtn.classList.add('hidden');
        }
    }

    toggleProfileEditMode(false);
}

export function toggleProfileEditMode(isEditing) {
    const form = document.getElementById('student-self-form');
    const inputs = form.querySelectorAll('input:not([type=file]), select, textarea');
    
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

    document.getElementById('profile-pic-edit-button').classList.toggle('hidden', !isEditing);
    document.getElementById('profile-pic-edit-button').classList.toggle('flex', isEditing);
    document.querySelectorAll('.sp-photo-label').forEach(el => el.classList.toggle('hidden', !isEditing));
    document.querySelectorAll('.sp-remove-btn').forEach(el => el.style.display = isEditing ? 'flex' : 'none');
    document.getElementById('sp-gps-btn').style.display = isEditing ? 'block' : 'none';

    document.getElementById('btn-edit-profile').classList.toggle('hidden', isEditing);
    document.getElementById('btn-cancel-profile').classList.toggle('hidden', !isEditing);
    document.getElementById('btn-save-profile').classList.toggle('hidden', !isEditing);
}

export async function saveMyProfile(e) {
    if (e) e.preventDefault();
    customConfirm('ยืนยันการบันทึกข้อมูล', 'คุณตรวจสอบข้อมูลครบถ้วนและต้องการบันทึกการแก้ไขใช่หรือไม่?', async () => {
        const s = AppState.currentUser.data;
        const citizenId = document.getElementById('sp-citizenid').value.toString().replace(/\s+/g, '');
        const nickname = document.getElementById('sp-nickname').value.trim();
        const dob = document.getElementById('sp-dob').value;
        const phone = document.getElementById('sp-phone').value.trim();
        const email = document.getElementById('sp-email').value.trim();
        const address = document.getElementById('sp-address').value.trim();
        
        const pTitle = document.getElementById('sp-p-title').value;
        const pFname = document.getElementById('sp-p-fname').value.trim();
        const pLname = document.getElementById('sp-p-lname').value.trim();
        const pRel = document.getElementById('sp-p-rel').value;
        const pPhone = document.getElementById('sp-p-phone').value.trim();
        
        const fFname = document.getElementById('sp-f-fname').value.trim();
        const fLname = document.getElementById('sp-f-lname').value.trim();
        const fAge = document.getElementById('sp-f-age').value.trim();
        const fJob = document.getElementById('sp-f-job').value.trim();
        const fPhone = document.getElementById('sp-f-phone').value.trim();
        
        const mFname = document.getElementById('sp-m-fname').value.trim();
        const mLname = document.getElementById('sp-m-lname').value.trim();
        const mAge = document.getElementById('sp-m-age').value.trim();
        const mJob = document.getElementById('sp-m-job').value.trim();
        const mPhone = document.getElementById('sp-m-phone').value.trim();

        const homeLat = document.getElementById('sp-home-lat').value.trim();
        const homeLng = document.getElementById('sp-home-lng').value.trim();
        const homeDirections = document.getElementById('sp-home-directions').value.trim();

        // 1. บังคับห้ามว่างเฉพาะ ชั้นเรียน และ เลขที่
        const stuClass = document.getElementById('sp-class').value;
        const stuNumber = document.getElementById('sp-number').value;
        if (!stuClass || !stuNumber) {
            return customAlert('เกิดข้อผิดพลาด: ชั้นเรียนและเลขที่ห้ามว่าง');
        }

        // 2. ถ้ามีการกรอก Citizen ID หรือเบอร์โทรศัพท์ ให้ทำการตรวจสอบรูปแบบความถูกต้อง (หากเว้นว่างไว้ให้ผ่านได้)
        if (citizenId) {
            if (!validateThaiCitizenId(citizenId)) return customAlert('เลขประจำตัวประชาชน 13 หลัก ไม่ถูกต้อง');
            
            // เช็คเลข ปชช ซ้ำกับคนอื่น
            const duplicate = AppState.allStudents.find(x => x.citizenId === citizenId && x.id !== s.id && x.deleted_flg !== 'Y');
            if (duplicate) {
                const fullName = getStudentFullName(duplicate);
                return customAlert(`เลขประจำตัวประชาชนนี้ถูกใช้งานแล้วในระบบ (ซ้ำกับ: ${fullName})`);
            }
        }
        if (phone && !validatePhoneNumber(phone)) return customAlert('เบอร์โทรศัพท์ของนักเรียนไม่ถูกต้อง');
        if (pPhone && !validatePhoneNumber(pPhone)) return customAlert('เบอร์โทรศัพท์ของผู้ปกครองไม่ถูกต้อง');
        if (fPhone && !validatePhoneNumber(fPhone)) return customAlert('เบอร์โทรศัพท์บิดาไม่ถูกต้อง');
        if (mPhone && !validatePhoneNumber(mPhone)) return customAlert('เบอร์โทรศัพท์มารดาไม่ถูกต้อง');

        s.citizenId = citizenId;
        s.nickname = nickname;
        s.dob = dob;
        s.phone = phone;
        s.email = email;
        s.address = address;
        s.parentTitle = pTitle;
        s.parentFirstName = pFname;
        s.parentLastName = pLname;
        s.parentRelation = pRel;
        s.parentPhone = pPhone;
        s.fatherFirstName = fFname;
        s.fatherLastName = fLname;
        s.fatherAge = fAge;
        s.fatherJob = fJob;
        s.fatherPhone = fPhone;
        s.motherFirstName = mFname;
        s.motherLastName = mLname;
        s.motherAge = mAge;
        s.motherJob = mJob;
        s.motherPhone = mPhone;

        // New Home Info
        s.home_latitude = homeLat;
        s.home_longitude = homeLng;
        s.home_directions = homeDirections;

        s.updatedAt = getISOTimestamp();
        s.updatedBy = getCurrentUserId();
        
        // 3. ตรวจสอบข้อมูลส่วนตัว, ข้อมูลบิดา, และข้อมูลมารดา ว่ากรอกครบหรือไม่เพื่อตั้งสถานะประวัติสมบูรณ์
        const isComplete = 
            citizenId && nickname && dob && phone && email && address && 
            fFname && fLname && fAge && fJob && fPhone && 
            mFname && mLname && mAge && mJob && mPhone;
            
        s.isProfileComplete = isComplete ? 'true' : 'false'; 

        const idx = AppState.allStudents.findIndex(x => x.id === s.id);
        if(idx > -1) AppState.allStudents[idx] = s;
        
        AppState.currentUser.data = s;
        try {
            localStorage.setItem(DB_KEYS.SESSION, JSON.stringify(AppState.currentUser));
        } catch(e) { console.warn(e); }
        
        showLoading('กำลังบันทึกและอัปโหลดรูปภาพ...');
        
        // สร้าง Payload เฉพาะนักเรียนคนนี้ แบบเดียวกับระบบเยี่ยมบ้าน
        const payload = { ...s };

        const profilePicFile = document.getElementById('profile-pic-upload').files[0];
        if (profilePicFile) {
            payload.profileImage_base64 = await compressImage(profilePicFile);
            payload.profileImage_name = profilePicFile.name;
            payload.profileImage_mime = 'image/jpeg';
        }

        for (let i = 1; i <= 3; i++) {
            const file = document.getElementById(`sp-home-photo${i}`).files[0];
            if (file) {
                payload[`home_photo_${i}_base64`] = await compressImage(file);
                payload[`home_photo_${i}_name`] = file.name;
                payload[`home_photo_${i}_mime`] = 'image/jpeg';
            }
        }
        
        try {
            const response = await fetch(AppState.googleSheetUrl, {
                method: 'POST',
                redirect: 'follow', 
                headers: { 'Content-Type': 'text/plain;charset=utf-8' }, 
                body: JSON.stringify({ action: 'saveStudentProfile', payload: payload })
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
                if (result.payload) {
                    const studentIndex = AppState.allStudents.findIndex(std => String(std.id) === String(payload.id));
                    if (studentIndex > -1) {
                        AppState.allStudents[studentIndex] = { ...AppState.allStudents[studentIndex], ...result.payload };
                        await saveToDB(DB_KEYS.STUDENTS, AppState.allStudents, 'saveStudents');
                    }
                }
                showToast('บันทึกข้อมูลส่วนตัวและรูปภาพเรียบร้อยแล้ว');
                await syncDataFromServer(true);
                renderStudentProfile();
            } else {
                customAlert('เกิดข้อผิดพลาดในการบันทึก: ' + (result.message || text || ''));
            }
        } catch (err) {
            console.error(err);
            customAlert('การเชื่อมต่อล้มเหลว กรุณาลองอีกครั้ง');
        }
        hideLoading();
    });
}

// --- CSV Upload ---
export function openUploadCsvModal() {
    document.getElementById('upload-file').value = '';
    
    // Populate classes dynamically
    const uniqueClasses = [...new Set(AppState.allClasses.filter(c => c.deleted_flg !== 'Y').map(c => c.className))].filter(Boolean).sort((a, b) => a.localeCompare(b, 'th', { numeric: true }));
    const uploadClassSelect = document.getElementById('upload-class');
    if (uploadClassSelect) {
        uploadClassSelect.innerHTML = '<option value="">-- เลือกชั้นเรียน --</option>' + 
            uniqueClasses.map(c => `<option value="${c}">${c}</option>`).join('');
    }

    document.getElementById('upload-preview-container').classList.add('hidden');
    document.getElementById('upload-sheet-container').classList.add('hidden');
    document.getElementById('upload-sheet-select').innerHTML = '';
    document.getElementById('btn-save-upload').disabled = true;
    AppState.pendingUploadStudents = [];
    document.getElementById('csv-upload-modal').classList.add('show');
}

export async function downloadStudentTemplate() {
    try {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('รายชื่อนักเรียน');
        
        sheet.columns = [
            { header: 'เลขที่', key: 'number', width: 10 },
            { header: 'เลขประจำตัว', key: 'studentId', width: 15 },
            { header: 'เลขประจำตัวประชาชน', key: 'citizenId', width: 22 },
            { header: 'คำนำหน้า', key: 'title', width: 12 },
            { header: 'ชื่อ', key: 'firstName', width: 20 },
            { header: 'สกุล', key: 'lastName', width: 20 },
            { header: 'ชื่อเล่น', key: 'nickname', width: 12 }
        ];

        const headerRow = sheet.getRow(1);
        headerRow.font = { name: 'Sarabun', bold: true, color: { argb: 'FFFFFF' } };
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: '1E3A8A' }
        };
        headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

        sheet.addRow([1, '10001', '1234567890123', 'เด็กชาย', 'สมชาย', 'ใจดี', 'ชาย']);
        sheet.addRow([2, '10002', '', 'เด็กหญิง', 'สมศรี', 'รักเรียน', 'ศรี']);
        
        sheet.addRow([]);
        const infoRow = sheet.addRow(['* หมายเหตุ: กรุณาอย่าสลับตำแหน่งคอลัมน์ หรือแก้ไขชื่อหัวตาราง และลบข้อมูลตัวอย่างออกด้วย (เลขประจำตัวประชาชนไม่บังคับกรอก)*']);
        infoRow.font = { name: 'Sarabun', italic: true, color: { argb: 'EF4444' } };

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'student_upload_template.xlsx';
        link.click();
        showToast('ดาวน์โหลดเทมเพลต Excel เรียบร้อยแล้ว');
    } catch (err) {
        console.error(err);
        customAlert('เกิดข้อผิดพลาดในการสร้างไฟล์เทมเพลต: ' + err.message);
    }
}

export function previewCSV(event) {
    const actualFile = document.getElementById('upload-file').files[0];
    const cls = document.getElementById('upload-class').value;
    
    if (!cls) {
        customAlert('กรุณาเลือกชั้นเรียนก่อนเลือกไฟล์');
        document.getElementById('upload-file').value = '';
        return;
    }
    if (!actualFile) return;

    const isExcel = actualFile.name.endsWith('.xlsx');
    
    if (isExcel) {
        document.getElementById('upload-sheet-container').classList.add('hidden');
        previewExcel(actualFile);
    } else {
        document.getElementById('upload-sheet-container').classList.add('hidden');
        
        const reader = new FileReader();
        reader.onload = function(e) {
            const buffer = e.target.result;
            
            // Auto detect Thai encoding (UTF-8 vs Windows-874)
            let decoder = new TextDecoder('utf-8', { fatal: true });
            let text;
            try {
                text = decoder.decode(buffer);
            } catch (err) {
                decoder = new TextDecoder('windows-874');
                text = decoder.decode(buffer);
            }
            
            const hasThai = /[\u0E00-\u0E7F]/.test(text);
            const uint8 = new Uint8Array(buffer);
            const hasHighAscii = uint8.some(b => b > 127);
            if (hasHighAscii && !hasThai) {
                decoder = new TextDecoder('windows-874');
                text = decoder.decode(buffer);
            }
            
            const rows = text.split(/\r?\n/);
            AppState.pendingUploadStudents = [];
            let previewHtml = '';
            let errorFound = false;

            // Scan first 20 rows to find headers dynamically
            let headerRowIndex = -1;
            let colIndices = {
                number: -1,
                studentId: -1,
                citizenId: -1,
                title: -1,
                firstName: -1,
                lastName: -1,
                nickname: -1
            };

            for (let i = 0; i < Math.min(rows.length, 20); i++) {
                const line = rows[i].trim();
                if (!line) continue;
                const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
                
                let foundNumber = false;
                let foundStudentId = false;
                let foundFirstName = false;
                let foundLastName = false;
                
                let tempIndices = {
                    number: -1,
                    studentId: -1,
                    citizenId: -1,
                    title: -1,
                    firstName: -1,
                    lastName: -1,
                    nickname: -1
                };

                for (let c = 0; c < cols.length; c++) {
                    const val = cols[c];
                    if (val === 'เลขที่') {
                        tempIndices.number = c;
                        foundNumber = true;
                    } else if (val === 'เลขประจำตัว' || val === 'รหัสประจำตัว') {
                        tempIndices.studentId = c;
                        foundStudentId = true;
                    } else if (val === 'เลขประจำตัวประชาชน' || val === 'เลขบัตรประชาชน' || val === 'เลขบัตรประจำตัวประชาชน') {
                        tempIndices.citizenId = c;
                    } else if (val === 'คำนำหน้า' || val === 'คำนำหน้านาม') {
                        tempIndices.title = c;
                    } else if (val === 'ชื่อ' || val === 'ชื่อจริง') {
                        tempIndices.firstName = c;
                        foundFirstName = true;
                    } else if (val === 'สกุล' || val === 'นามสกุล') {
                        tempIndices.lastName = c;
                        foundLastName = true;
                    } else if (val === 'ชื่อเล่น') {
                        tempIndices.nickname = c;
                    }
                }

                if (foundNumber && foundStudentId && foundFirstName && foundLastName) {
                    headerRowIndex = i;
                    colIndices = tempIndices;
                    break;
                }
            }

            // Fallback default columns if header not matched
            if (headerRowIndex === -1) {
                headerRowIndex = 0; // Assume row 0 is header
                colIndices = { number: 0, studentId: 1, citizenId: 2, title: 3, firstName: 4, lastName: 5, nickname: 6 };
            }

            for (let i = headerRowIndex + 1; i < rows.length; i++) {
                const line = rows[i].trim();
                if (!line) continue; 
                
                const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, '')); 
                
                const numberStr = (colIndices.number !== -1 ? cols[colIndices.number] : '') || '';
                const studentId = (colIndices.studentId !== -1 ? cols[colIndices.studentId] : '') || '';
                const citizenId = (colIndices.citizenId !== -1 ? cols[colIndices.citizenId] : '') || '';
                const title = (colIndices.title !== -1 ? cols[colIndices.title] : '') || '';
                const fname = (colIndices.firstName !== -1 ? cols[colIndices.firstName] : '') || '';
                const lname = (colIndices.lastName !== -1 ? cols[colIndices.lastName] : '') || '';
                const nickname = (colIndices.nickname !== -1 ? cols[colIndices.nickname] : '') || '';
                
                // ข้ามแถวว่าง หรือ แถวที่เป็นหมายเหตุ (ไม่มีรหัสนักเรียน และ ไม่มีชื่อกับนามสกุล)
                if (!studentId && !fname && !lname) {
                    continue;
                }
                
                const number = parseInt(numberStr);
                let rowError = false;
                let statusHtml = '<span class="text-green-600 font-bold"><i class="fas fa-check-circle"></i> ผ่าน</span>';
                
                if (!numberStr || isNaN(number) || !studentId || !title || !fname || !lname) {
                     statusHtml = `<span class="text-red-600 font-bold"><i class="fas fa-times-circle"></i> ข้อมูลไม่ครบถ้วน</span>`;
                     rowError = true;
                     errorFound = true;
                } 
                else {
                    const existInSystem = AppState.allStudents.find(s => s.studentId.toString().trim() === studentId.toString().trim() && s.deleted_flg !== 'Y');
                    const existInFile = AppState.pendingUploadStudents.find(s => s.studentId.toString().trim() === studentId.toString().trim());
                    if (existInSystem || existInFile) {
                        statusHtml = `<span class="text-red-600 font-bold"><i class="fas fa-times-circle"></i> รหัส ${studentId} ซ้ำ</span>`;
                        rowError = true;
                        errorFound = true;
                    }

                    if (citizenId && !rowError) {
                        const citizenSystem = AppState.allStudents.find(s => s.citizenId && s.citizenId.toString().trim() === citizenId.toString().trim() && s.deleted_flg !== 'Y');
                        const citizenFile = AppState.pendingUploadStudents.find(s => s.citizenId && s.citizenId.toString().trim() === citizenId.toString().trim());
                        if (citizenSystem || citizenFile) {
                            statusHtml = `<span class="text-red-600 font-bold"><i class="fas fa-times-circle"></i> เลขบัตร ปชช ${citizenId} ซ้ำ</span>`;
                            rowError = true;
                            errorFound = true;
                        }
                    }
                }

                if(!rowError) {
                    AppState.pendingUploadStudents.push({
                        id: generateId(), class: cls, number: number, studentId: studentId,
                        citizenId: citizenId,
                        title: title, firstName: fname, lastName: lname, nickname: nickname,
                        status: 'ปกติ', isProfileComplete: 'false',
                        createdAt: getISOTimestamp(), createdBy: getCurrentUserId(),
                        updatedAt: getISOTimestamp(), updatedBy: getCurrentUserId(),
                        deleted_flg: 'N', deletedAt: null, deletedBy: null,
                    });
                }

                const displayNick = nickname ? ` (${nickname})` : '';
                previewHtml += `<tr>
                    <td class="px-4 py-2 text-center">${numberStr || '-'}</td>
                    <td class="px-4 py-2">${studentId || '-'}</td>
                    <td class="px-4 py-2">${citizenId || '-'}</td>
                    <td class="px-4 py-2">${title}${fname} ${lname}${displayNick}</td>
                    <td class="px-4 py-2 text-center">${statusHtml}</td>
                </tr>`;
            }

            document.getElementById('upload-preview-body').innerHTML = previewHtml;
            document.getElementById('upload-count').innerText = AppState.pendingUploadStudents.length;
            document.getElementById('upload-preview-container').classList.remove('hidden');
            document.getElementById('btn-save-upload').disabled = errorFound || AppState.pendingUploadStudents.length === 0;
        };
        reader.readAsArrayBuffer(actualFile);
    }
}

export function previewExcel(file, sheetName = null) {
    const cls = document.getElementById('upload-class').value;
    const reader = new FileReader();
    
    showLoading('กำลังวิเคราะห์ไฟล์ Excel...');
    reader.onload = async function(e) {
        try {
            const buffer = e.target.result;
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(buffer);
            
            window._currentUploadWorkbook = workbook;
            
            const sheets = workbook.worksheets;
            const sheetContainer = document.getElementById('upload-sheet-container');
            const sheetSelect = document.getElementById('upload-sheet-select');
            
            if (sheets.length > 1) {
                sheetContainer.classList.remove('hidden');
                if (sheetSelect.innerHTML === '' || !sheetName) {
                    sheetSelect.innerHTML = sheets.map(s => `<option value="${s.name}">${s.name}</option>`).join('');
                }
            } else {
                sheetContainer.classList.add('hidden');
            }
            
            const activeSheet = sheetName ? workbook.getWorksheet(sheetName) : sheets[0];
            AppState.pendingUploadStudents = [];
            let previewHtml = '';
            let errorFound = false;
            
            // Scan first 20 rows of activeSheet to find headers dynamically
            let headerRowNumber = -1;
            let colIndices = {
                number: -1,
                studentId: -1,
                citizenId: -1,
                title: -1,
                firstName: -1,
                lastName: -1,
                nickname: -1
            };

            for (let r = 1; r <= Math.min(activeSheet.rowCount, 20); r++) {
                const row = activeSheet.getRow(r);
                let foundNumber = false;
                let foundStudentId = false;
                let foundFirstName = false;
                let foundLastName = false;
                
                let tempIndices = {
                    number: -1,
                    studentId: -1,
                    citizenId: -1,
                    title: -1,
                    firstName: -1,
                    lastName: -1,
                    nickname: -1
                };

                row.eachCell({ includeEmpty: true }, function(cell, colNumber) {
                    const val = cell.value !== null && cell.value !== undefined ? cell.value.toString().trim() : '';
                    if (val === 'เลขที่') {
                        tempIndices.number = colNumber;
                        foundNumber = true;
                    } else if (val === 'เลขประจำตัว' || val === 'รหัสประจำตัว') {
                        tempIndices.studentId = colNumber;
                        foundStudentId = true;
                    } else if (val === 'เลขประจำตัวประชาชน' || val === 'เลขบัตรประชาชน' || val === 'เลขบัตรประจำตัวประชาชน') {
                        tempIndices.citizenId = colNumber;
                    } else if (val === 'คำนำหน้า' || val === 'คำนำหน้านาม') {
                        tempIndices.title = colNumber;
                    } else if (val === 'ชื่อ' || val === 'ชื่อจริง') {
                        tempIndices.firstName = colNumber;
                        foundFirstName = true;
                    } else if (val === 'สกุล' || val === 'นามสกุล') {
                        tempIndices.lastName = colNumber;
                        foundLastName = true;
                    } else if (val === 'ชื่อเล่น') {
                        tempIndices.nickname = colNumber;
                    }
                });

                if (foundNumber && foundStudentId && foundFirstName && foundLastName) {
                    headerRowNumber = r;
                    colIndices = tempIndices;
                    break;
                }
            }

            // Fallback default columns if header not matched
            if (headerRowNumber === -1) {
                headerRowNumber = 1;
                colIndices = { number: 1, studentId: 2, citizenId: 3, title: 4, firstName: 5, lastName: 6, nickname: 7 };
            }

            activeSheet.eachRow({ includeEmpty: false }, function(row, rowNumber) {
                if (rowNumber <= headerRowNumber) return;
                
                const numberStr = (colIndices.number !== -1 && row.getCell(colIndices.number).value !== null ? row.getCell(colIndices.number).value.toString().trim() : '');
                const studentId = (colIndices.studentId !== -1 && row.getCell(colIndices.studentId).value !== null ? row.getCell(colIndices.studentId).value.toString().trim() : '');
                const citizenId = (colIndices.citizenId !== -1 && row.getCell(colIndices.citizenId).value !== null ? row.getCell(colIndices.citizenId).value.toString().trim() : '');
                const title = (colIndices.title !== -1 && row.getCell(colIndices.title).value !== null ? row.getCell(colIndices.title).value.toString().trim() : '');
                const fname = (colIndices.firstName !== -1 && row.getCell(colIndices.firstName).value !== null ? row.getCell(colIndices.firstName).value.toString().trim() : '');
                const lname = (colIndices.lastName !== -1 && row.getCell(colIndices.lastName).value !== null ? row.getCell(colIndices.lastName).value.toString().trim() : '');
                const nickname = (colIndices.nickname !== -1 && row.getCell(colIndices.nickname).value !== null ? row.getCell(colIndices.nickname).value.toString().trim() : '');
                
                // ข้ามแถวว่าง หรือ แถวที่เป็นหมายเหตุ (ไม่มีรหัสนักเรียน และ ไม่มีชื่อกับนามสกุล)
                if (!studentId && !fname && !lname) {
                    return;
                }
                
                const number = parseInt(numberStr);
                let rowError = false;
                let statusHtml = '<span class="text-green-600 font-bold"><i class="fas fa-check-circle"></i> ผ่าน</span>';
                
                if (!numberStr || isNaN(number) || !studentId || !title || !fname || !lname) {
                     statusHtml = `<span class="text-red-600 font-bold"><i class="fas fa-times-circle"></i> ข้อมูลไม่ครบถ้วน</span>`;
                     rowError = true;
                     errorFound = true;
                } 
                else {
                    const existInSystem = AppState.allStudents.find(s => s.studentId.toString().trim() === studentId.toString().trim() && s.deleted_flg !== 'Y');
                    const existInFile = AppState.pendingUploadStudents.find(s => s.studentId.toString().trim() === studentId.toString().trim());
                    if (existInSystem || existInFile) {
                        statusHtml = `<span class="text-red-600 font-bold"><i class="fas fa-times-circle"></i> รหัส ${studentId} ซ้ำ</span>`;
                        rowError = true;
                        errorFound = true;
                    }

                    if (citizenId && !rowError) {
                        const citizenSystem = AppState.allStudents.find(s => s.citizenId && s.citizenId.toString().trim() === citizenId.toString().trim() && s.deleted_flg !== 'Y');
                        const citizenFile = AppState.pendingUploadStudents.find(s => s.citizenId && s.citizenId.toString().trim() === citizenId.toString().trim());
                        if (citizenSystem || citizenFile) {
                            statusHtml = `<span class="text-red-600 font-bold"><i class="fas fa-times-circle"></i> เลขบัตร ปชช ${citizenId} ซ้ำ</span>`;
                            rowError = true;
                            errorFound = true;
                        }
                    }
                }
                
                if (!rowError) {
                    AppState.pendingUploadStudents.push({
                        id: generateId(), class: cls, number: number, studentId: studentId,
                        citizenId: citizenId,
                        title: title, firstName: fname, lastName: lname, nickname: nickname,
                        status: 'ปกติ', isProfileComplete: 'false',
                        createdAt: getISOTimestamp(), createdBy: getCurrentUserId(),
                        updatedAt: getISOTimestamp(), updatedBy: getCurrentUserId(),
                        deleted_flg: 'N', deletedAt: null, deletedBy: null,
                    });
                }
                
                const displayNick = nickname ? ` (${nickname})` : '';
                previewHtml += `<tr>
                    <td class="px-4 py-2 text-center">${numberStr || '-'}</td>
                    <td class="px-4 py-2">${studentId || '-'}</td>
                    <td class="px-4 py-2">${citizenId || '-'}</td>
                    <td class="px-4 py-2">${title}${fname} ${lname}${displayNick}</td>
                    <td class="px-4 py-2 text-center">${statusHtml}</td>
                </tr>`;
            });
            
            document.getElementById('upload-preview-body').innerHTML = previewHtml;
            document.getElementById('upload-count').innerText = AppState.pendingUploadStudents.length;
            document.getElementById('upload-preview-container').classList.remove('hidden');
            document.getElementById('btn-save-upload').disabled = errorFound || AppState.pendingUploadStudents.length === 0;
        } catch (err) {
            console.error(err);
            customAlert('เกิดข้อผิดพลาดในการวิเคราะห์ไฟล์ Excel: ' + err.message);
        } finally {
            hideLoading();
        }
    };
    reader.readAsArrayBuffer(file);
}

export function onUploadSheetChange() {
    const selectedSheet = document.getElementById('upload-sheet-select').value;
    const file = document.getElementById('upload-file').files[0];
    if (file && window._currentUploadWorkbook) {
        previewExcel(file, selectedSheet);
    }
}

export async function saveCsvUpload() {
    if (AppState.pendingUploadStudents.length === 0) return;
    AppState.allStudents.push(...AppState.pendingUploadStudents);
    await saveToDB(DB_KEYS.STUDENTS, AppState.allStudents, 'saveStudents'); 
    closeModal('csv-upload-modal'); 
    renderManageStudents(); 
    showToast(`อัปโหลดสำเร็จ ${AppState.pendingUploadStudents.length} รายการ`);
    AppState.pendingUploadStudents = [];
}

// ฟังก์ชันสำหรับควบคุมการเปิด-ปิด โหมดแก้ไขในหน้า Modal ของครู/แอดมิน
export function toggleStudentModalEditMode(isEditing) {
    const form = document.getElementById('student-form');
    if (!form) return;
    
    const inputs = form.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
        if (input.type === 'hidden') return;
        
        if (isEditing) {
            input.removeAttribute('disabled');
            input.classList.remove('bg-gray-100');
        } else {
            input.setAttribute('disabled', 'true');
            input.classList.add('bg-gray-100');
        }
    });

    const btnEdit = document.getElementById('btn-edit-student');
    const btnSave = document.getElementById('btn-save-student');
    
    if (btnEdit) btnEdit.classList.toggle('hidden', isEditing);
    if (btnSave) btnSave.classList.toggle('hidden', !isEditing);
    
    // รีเฟรช TomSelect ถ้ามี (กรณีในอนาคตถ้ามีการใช้ searchable dropdown)
    if (document.getElementById('stu-class').tomselect) document.getElementById('stu-class').tomselect.sync();
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

    const uniqueClasses = [...new Set(AppState.allClasses.filter(c => c.deleted_flg !== 'Y').map(c => c.className))].filter(Boolean).sort((a, b) => a.localeCompare(b, 'th', { numeric: true }));
    const classSelect = document.getElementById('stu-class');
    if (classSelect) {
        classSelect.innerHTML = '<option value="">-- เลือกชั้นเรียน --</option>' + 
            uniqueClasses.map(c => `<option value="${c}">${c}</option>`).join('');
    }

    const defaultPic = 'https://upload.wikimedia.org/wikipedia/commons/a/ac/Default_pfp.jpg';
    if (document.getElementById('stu-profile-pic-preview')) document.getElementById('stu-profile-pic-preview').src = defaultPic;
    if (document.getElementById('stu-home-coords')) document.getElementById('stu-home-coords').innerText = 'ไม่พบข้อมูลพิกัด';
    if (document.getElementById('stu-map-link')) { document.getElementById('stu-map-link').classList.add('hidden'); document.getElementById('stu-map-link').classList.remove('inline-flex'); }
    if (document.getElementById('stu-home-directions')) document.getElementById('stu-home-directions').innerText = '-';
    
    for (let i = 1; i <= 3; i++) {
        const photoEl = document.getElementById(`stu-home-photo${i}`);
        if (photoEl) { photoEl.classList.add('hidden'); photoEl.src = ''; }
    }

    // สร้างใหม่ ให้เปิดให้แก้ไขได้เลย (Edit Mode = true)
    toggleStudentModalEditMode(true);
    // ซ่อนปุ่มแก้ไข เพราะอยู่ในโหมดแก้ไขแล้ว
    const btnEdit = document.getElementById('btn-edit-student');
    if (btnEdit) btnEdit.classList.add('hidden');

    document.getElementById('student-modal').classList.add('show'); 
}

export function editStudent(id) {
const s = AppState.allStudents.find(x => x.id === id && x.deleted_flg !== 'Y');
    if (!s) return;

    const uniqueClasses = [...new Set(AppState.allClasses.filter(c => c.deleted_flg !== 'Y').map(c => c.className))].filter(Boolean).sort((a, b) => a.localeCompare(b, 'th', { numeric: true }));
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
    
    // เติมข้อมูลรูปภาพและที่พัก
    const defaultPic = 'https://upload.wikimedia.org/wikipedia/commons/a/ac/Default_pfp.jpg';
    if (document.getElementById('stu-profile-pic-preview')) document.getElementById('stu-profile-pic-preview').src = s.profileImageUrl ? getDirectImageUrl(s.profileImageUrl) : defaultPic;

    if (document.getElementById('stu-home-directions')) document.getElementById('stu-home-directions').innerText = s.home_directions || '-';
    
    const coordsText = document.getElementById('stu-home-coords');
    const mapLink = document.getElementById('stu-map-link');
    if (s.home_latitude && s.home_longitude) {
        if (coordsText) coordsText.innerText = `Lat: ${s.home_latitude}, Lng: ${s.home_longitude}`;
        if (mapLink) {
            mapLink.href = `https://www.google.com/maps/search/?api=1&query=${s.home_latitude},${s.home_longitude}`;
            mapLink.classList.remove('hidden');
            mapLink.classList.add('inline-flex');
        }
    } else {
        if (coordsText) coordsText.innerText = 'ไม่พบข้อมูลพิกัด';
        if (mapLink) { mapLink.href = '#'; mapLink.classList.add('hidden'); mapLink.classList.remove('inline-flex'); }
    }

    for (let i = 1; i <= 3; i++) {
        const photoEl = document.getElementById(`stu-home-photo${i}`);
        const url = s[`home_photo_${i}_url`];
        if (photoEl) {
            if (url) {
                photoEl.src = getDirectImageUrl(url);
                photoEl.classList.remove('hidden');
            } else {
                photoEl.src = '';
                photoEl.classList.add('hidden');
            }
        }
    }

    // ตั้งค่าเริ่มต้นเป็น "อ่านอย่างเดียว" (Edit Mode = false)
    toggleStudentModalEditMode(false);

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
    const stuClass = document.getElementById('stu-class').value;

    if(!studentId || !fname || !lname || !stuClass) return customAlert('กรุณากรอกรหัสประจำตัว ชื่อ นามสกุล และชั้นเรียนให้ครบถ้วน');

    const isAdmin = AppState.currentUser && AppState.currentUser.role === 'admin';
    const isTeacher = AppState.currentUser && AppState.currentUser.role === 'teacher';
    const isAdminOrTeacher = isAdmin || isTeacher;

    // Citizen ID validation
    if (citizenId) {
        if (!validateThaiCitizenId(citizenId)) {
            return customAlert('เลขประจำตัวประชาชน 13 หลัก ไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง');
        }
        // เช็คเลข ปชช ซ้ำกับคนอื่น
        const currentModalId = document.getElementById('stu-id').value || '';
        const duplicate = AppState.allStudents.find(x => x.citizenId === citizenId && x.id !== currentModalId && x.deleted_flg !== 'Y');
        if (duplicate) {
            const fullName = getStudentFullName(duplicate);
            return customAlert(`เลขประจำตัวประชาชนนี้ถูกใช้งานแล้วในระบบ (ซ้ำกับ: ${fullName})`);
        }
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
    const existStu = AppState.allStudents.find(x => x.id === objId && x.deleted_flg !== 'Y');
    
    let isComp = 'false';
    if (existStu) {
        isComp = (existStu.isProfileComplete === true || String(existStu.isProfileComplete).toLowerCase() === 'true') ? 'true' : 'false';
    } else {
        isComp = (citizenId && phone) ? 'true' : 'false';
    }
    
    let obj;
    const idx = AppState.allStudents.findIndex(x=>x.id===objId);

    const commonData = {
        status: status, homeVisit: homeVisit, isProfileComplete: isComp, studentId: studentId,
        title: document.getElementById('stu-title').value, firstName: fname, lastName: lname, nickname: nickname,
        citizenId: citizenId, class: stuClass, number: parseInt(document.getElementById('stu-number').value),
        dob: document.getElementById('stu-dob').value, phone: phone, email: document.getElementById('stu-email').value.trim(),
        address: document.getElementById('stu-address').value.trim(),
        fatherFirstName: document.getElementById('stu-f-fname').value.trim(), fatherLastName: document.getElementById('stu-f-lname').value.trim(), fatherAge: document.getElementById('stu-f-age').value, fatherJob: document.getElementById('stu-f-job').value.trim(), fatherPhone: fPhone,
        motherFirstName: document.getElementById('stu-m-fname').value.trim(), motherLastName: document.getElementById('stu-m-lname').value.trim(), motherAge: document.getElementById('stu-m-age').value, motherJob: document.getElementById('stu-m-job').value.trim(), motherPhone: mPhone,
        parentTitle: document.getElementById('stu-p-title').value, parentFirstName: document.getElementById('stu-p-fname').value.trim(), parentLastName: document.getElementById('stu-p-lname').value.trim(), parentRelation: document.getElementById('stu-p-rel').value, parentPhone: pPhone,
        updatedAt: getISOTimestamp(),
        updatedBy: getCurrentUserId(),
    };

    let shiftCount = 0;
    if (status !== 'ลาออก') {
        const targetClass = commonData.class;
        const targetNumber = commonData.number;
        // หาว่ามีเด็กคนอื่นในห้องนี้ใช้เลขที่นี้ หรือเลขที่มากกว่าอยู่หรือไม่ (กรณีชน)
        const conflict = AppState.allStudents.find(s => s.class === targetClass && s.number === targetNumber && s.id !== objId && s.deleted_flg !== 'Y');
        
        if (conflict) {
            const doShift = confirm(`พบนักเรียนเลขที่ ${targetNumber} ในห้อง ${targetClass} อยู่แล้ว\n\nต้องการแทรกนักเรียนคนนี้ แล้วดันเลขที่ของคนอื่นๆ (+1) อัตโนมัติหรือไม่?`);
            if (doShift) {
                AppState.allStudents.forEach(s => {
                    if (s.class === targetClass && s.number >= targetNumber && s.id !== objId && s.deleted_flg !== 'Y') {
                        s.number += 1; // ดันเลขที่ลง
                        s.updatedAt = getISOTimestamp();
                        s.updatedBy = getCurrentUserId();
                        shiftCount++;
                    }
                });
            }
        }
    }

    if (idx > -1) { // Update
        const oldStu = AppState.allStudents[idx];
        obj = { ...oldStu, ...commonData };
        AppState.allStudents[idx] = obj;
    } else { // Create
        obj = {
            id: objId,
            ...commonData,
            createdAt: getISOTimestamp(),
            createdBy: getCurrentUserId(),
            deleted_flg: 'N',
            deletedAt: null,
            deletedBy: null,
        };
        AppState.allStudents.push(obj);
    }

    await saveToDB(DB_KEYS.STUDENTS, AppState.allStudents, 'saveStudents'); 
    closeModal('student-modal'); 
    renderManageStudents(); 
    if (shiftCount > 0) {
        showToast(`บันทึกข้อมูลและดันเลขที่อัตโนมัติให้เพื่อน ${shiftCount} คน`);
    } else {
        showToast('บันทึกข้อมูลนักเรียนเรียบร้อย');
    }
}

export async function ensureStudentsLoadedForClass(className) {
    if (!className) return;
    const hasStudents = AppState.allStudents.some(s => s.class === className && s.deleted_flg !== 'Y');
    if (!hasStudents) {
        showLoading(`กำลังโหลดรายชื่อนักเรียนชั้น ${className}...`);
        try {
            const res = await fetch(`${AppState.googleSheetUrl}?action=getStudentsByClass&class=${encodeURIComponent(className)}`);
            const json = await res.json();
            if (json.status === 'success' && json.Students) {
                AppState.allStudents = AppState.allStudents.filter(s => s.class !== className);
                AppState.allStudents.push(...json.Students);
                localStorage.setItem(DB_KEYS.STUDENTS, JSON.stringify(AppState.allStudents));
            }
        } catch(e) {
            console.error("Error loading students by class:", e);
            showToast("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้", true);
        } finally {
            hideLoading();
        }
    }
}

export async function ensureStudentsLoadedByIds(studentIds) {
    if (!studentIds || studentIds.length === 0) return;
    const missingIds = studentIds.filter(id => !AppState.allStudents.some(s => String(s.id) === String(id)));
    if (missingIds.length > 0) {
        showLoading(`กำลังโหลดรายชื่อนักเรียนเพิ่มเติม...`);
        try {
            const res = await fetch(AppState.googleSheetUrl, {
                method: 'POST',
                redirect: 'follow',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({
                    action: 'getStudentsByIds',
                    payload: JSON.stringify({ ids: missingIds })
                })
            });
            const text = await res.text();
            const json = JSON.parse(text);
            if (json.status === 'success' && json.Students) {
                AppState.allStudents.push(...json.Students);
                localStorage.setItem(DB_KEYS.STUDENTS, JSON.stringify(AppState.allStudents));
            }
        } catch(e) {
            console.error("Error loading students by IDs:", e);
        } finally {
            hideLoading();
        }
    }
}

export async function onManageClassChange() {
    const className = document.getElementById('manage-filter-class').value;
    if (className) {
        await ensureStudentsLoadedForClass(className);
    }
    renderManageStudents();
}

export async function searchManageStudents() {
    const className = document.getElementById('manage-filter-class').value;
    if (className) {
        showLoading(`กำลังรีเฟรชข้อมูลนักเรียนชั้น ${className}...`);
        try {
            const res = await fetch(`${AppState.googleSheetUrl}?action=getStudentsByClass&class=${encodeURIComponent(className)}`);
            const json = await res.json();
            if (json.status === 'success' && json.Students) {
                AppState.allStudents = AppState.allStudents.filter(s => s.class !== className);
                AppState.allStudents.push(...json.Students);
                localStorage.setItem(DB_KEYS.STUDENTS, JSON.stringify(AppState.allStudents));
            }
        } catch(e) {
            console.error(e);
        } finally {
            hideLoading();
        }
    } else {
        await syncDataFromServer();
    }
    renderManageStudents();
}

export function renderManageStudents() {
    const f = document.getElementById('manage-filter-class').value.trim();
    const txt = document.getElementById('manage-search').value.toLowerCase();
    
    const searchCol = document.getElementById('manage-search-col');
    const refreshCol = document.getElementById('manage-refresh-col');

    if (!f) {
        if (searchCol) searchCol.classList.add('hidden');
        if (refreshCol) refreshCol.classList.add('hidden');
        document.getElementById('manage-students-table-body').innerHTML = `
            <tr>
                <td colspan="5" class="px-6 py-8 text-center text-gray-500 font-bold">
                    <i class="fas fa-info-circle mr-2 text-blue-500"></i>กรุณาเลือกชั้นเรียนเพื่อแสดงข้อมูลนักเรียน
                </td>
            </tr>
        `;
        return;
    }

    if (searchCol) searchCol.classList.remove('hidden');
    if (refreshCol) refreshCol.classList.remove('hidden');

    const allActiveStudents = AppState.allStudents.filter(s => s.deleted_flg !== 'Y'); 
    let stus = [...allActiveStudents];
    if(f) stus = stus.filter(s=>s.class===f); 
    if(txt) stus = stus.filter(s => getStudentFullName(s).toLowerCase().includes(txt) || (s.studentId && s.studentId.toString().includes(txt)));
    
    stus.sort((a,b)=> a.class.localeCompare(b.class, 'th', { numeric: true }) || a.number-b.number);

    document.getElementById('manage-students-table-body').innerHTML = stus.map(s => {
        const isResigned = s.status === 'ลาออก';
        const statusBadge = isResigned ? `<span class="bg-red-100 text-red-800 text-xs px-2 py-0.5 rounded ml-2 font-bold whitespace-nowrap">ลาออก</span>` : '';
        const isProfileComplete = s.isProfileComplete === true || String(s.isProfileComplete).toLowerCase() === 'true';
        const incompleteWarning = (!isProfileComplete && !isResigned) ? `<span class="bg-yellow-100 text-yellow-800 text-xs px-2 py-0.5 rounded ml-2 font-bold whitespace-nowrap border border-yellow-200 shadow-sm" title="ยังไม่กรอกประวัติครบบริบูรณ์"><i class="fas fa-exclamation-triangle mr-1"></i>ยังไม่กรอกประวัติ</span>` : '';
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
                    <button onclick="deleteStu('${s.id}')" class="text-red-500 hover:text-red-700" title="ลบ (ซ่อนข้อมูล)"><i class="fas fa-trash text-lg"></i></button>
                </div>
            </td>
        </tr>`;
    }).join('');
}

export function deleteStu(id) {
    customConfirm('ยืนยันการลบข้อมูลนักเรียน', 'คุณต้องการลบข้อมูลนักเรียนคนนี้ใช่หรือไม่? ข้อมูลจะถูกซ่อนและไม่สามารถเข้าระบบได้อีก', async () => {
        const studentIdx = AppState.allStudents.findIndex(x => x.id === id);
        if (studentIdx > -1) {
            const now = getISOTimestamp();
            const userId = getCurrentUserId();
            AppState.allStudents[studentIdx].deleted_flg = 'Y';
            AppState.allStudents[studentIdx].deletedAt = now;
            AppState.allStudents[studentIdx].deletedBy = userId;

            // Also soft-delete their club enrollments
            AppState.allClubEnrollments.forEach((enrollment, index) => {
                if (enrollment.studentId === id && enrollment.deleted_flg !== 'Y') {
                    AppState.allClubEnrollments[index].deleted_flg = 'Y';
                    AppState.allClubEnrollments[index].deletedAt = now;
                    AppState.allClubEnrollments[index].deletedBy = userId;
                }
            });

            await saveToDB(DB_KEYS.STUDENTS, AppState.allStudents, 'saveStudents');
            await saveToDB(DB_KEYS.CLUB_ENROLLMENTS, AppState.allClubEnrollments, 'saveClubEnrollments');
            renderManageStudents();
            showToast('ลบข้อมูลนักเรียนเรียบร้อยแล้ว');
        }
    });
}

export function renderStudentAcademicPortal() {
    const yr = document.getElementById('aca-year').value;
    const sem = document.getElementById('aca-semester').value;
    const tbody = document.getElementById('aca-table-body');
    tbody.innerHTML = '';

    const stuId = AppState.currentUser.data.id;
    const stuClass = AppState.currentUser.data.class;

    const currentClass = AppState.allClasses.find(c => c.className === stuClass && c.year == yr && c.semester == sem && c.deleted_flg !== 'Y');
    let enrolledSubjects = [];
    if (currentClass && currentClass.subjects) {
        enrolledSubjects = AppState.allSubjects.filter(sub => currentClass.subjects.includes(sub.id) && sub.deleted_flg !== 'Y');
    }

    enrolledSubjects.forEach(sub => {
        const recs = AppState.allRecords.filter(r => r.class === stuClass && r.subject === sub.name && matchRecordYearSemester(r, yr, sem) && r.deleted_flg !== 'Y');

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

    const myEnrollments = AppState.allClubEnrollments.filter(e => e.studentId === stuId && e.year == yr && e.semester == sem && e.deleted_flg !== 'Y');
    myEnrollments.forEach(enroll => {
        const club = AppState.allClubs.find(c => c.id === enroll.clubId && c.deleted_flg !== 'Y');
        if(!club) return;

        const recs = AppState.allClubRecords.filter(r => r.clubId === club.id && matchRecordYearSemester(r, yr, sem) && r.deleted_flg !== 'Y');
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

export function getGPSLocationForProfile() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((position) => {
            document.getElementById('sp-home-lat').value = position.coords.latitude;
            document.getElementById('sp-home-lng').value = position.coords.longitude;
            updateMapLinkForProfile(position.coords.latitude, position.coords.longitude);
            showToast('ดึงพิกัด GPS สำเร็จ');
        }, (error) => {
            let message = 'ไม่สามารถดึงพิกัดได้: ' + error.message;
            if (error.code === error.PERMISSION_DENIED) {
                message = 'คุณปฏิเสธการเข้าถึงตำแหน่ง กรุณาเปิดการอนุญาตในตั้งค่าเบราว์เซอร์/อุปกรณ์ แล้วลองอีกครั้ง';
            }
            customAlert(message);
        });
    } else {
        customAlert('เบราว์เซอร์ของคุณไม่รองรับ Geolocation');
    }
}

export function removeImageForProfile(index) {
    const fileInput = document.getElementById(`sp-home-photo${index}`);
    const preview = document.getElementById(`sp-home-preview${index}`);
    const removeBtn = document.getElementById(`sp-home-remove${index}`);
    
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
    
    // Clear the URL in the current user data so it gets removed from the database on save
    if (AppState.currentUser && AppState.currentUser.data) {
        AppState.currentUser.data[`home_photo_${index}_url`] = '';
    }
}

// ==========================================
// STUDENT ASSIGNMENTS & HOMEWORK PORTAL
// ==========================================

export function renderStudentAssignments() {
    if (!AppState.currentUser || AppState.currentUser.role !== 'student') return;
    
    if (!AppState.allAssignments) AppState.allAssignments = [];
    if (!AppState.allStudentAssignments) AppState.allStudentAssignments = [];

    // แปลงให้เป็น String และลบช่องว่างทิ้งเพื่อป้องกันการเทียบข้อมูลผิดพลาด
    const stuId = String(AppState.currentUser.data.id).trim();
    const stuCode = AppState.currentUser.data.studentId ? String(AppState.currentUser.data.studentId).trim() : '';
    const stuClass = String(AppState.currentUser.data.class || '').trim();
    
    const filterSubEl = document.getElementById('stu-asm-filter-sub');
    const filterStatusEl = document.getElementById('stu-asm-filter-status');
    const filterSub = filterSubEl ? filterSubEl.value : 'all';
    const filterStatus = filterStatusEl ? filterStatusEl.value : 'all';
    
    // 1. ค้นหาประวัติ/สถานะการส่งงานของนักเรียนคนนี้จากตาราง StudentAssignments
    const mySubmissionRecords = AppState.allStudentAssignments.filter(sa => 
        sa.deleted_flg !== 'Y' && 
        (String(sa.studentId).trim() === stuId || (stuCode && String(sa.studentId).trim() === stuCode))
    );
    const assignedIdsFromRecords = mySubmissionRecords.map(sa => String(sa.assignmentId).trim());

    // 2. ดึงรายละเอียดงานทั้งหมดจากตาราง Assignments (ที่มอบหมายเป็นรายบุคคล หรือ มอบหมายให้ห้องเรียนของนักเรียน)
    const myClass = AppState.allClasses.find(c => c.className === stuClass && c.deleted_flg !== 'Y');
    const myClassId = myClass ? String(myClass.id).trim() : '';

    let myAssignments = AppState.allAssignments.filter(a => {
        if (a.deleted_flg === 'Y') return false;
        
        const isDirectlyAssigned = assignedIdsFromRecords.some(saId => 
            isAssignmentIdMatch(saId, a.id)
        );
        const isClassAssigned = myClassId && (String(a.classId).trim() === myClassId || String(a.classId).trim() === stuClass);
        
        return isDirectlyAssigned || isClassAssigned;
    });

    // 3. จับคู่ (Join) รายละเอียดเข้ากับข้อมูลการส่งงานและรายวิชา
    let mappedData = myAssignments.map(a => {
        const aSubId = String(a.subjectId).trim();
        let sub = AppState.allSubjects.find(s => String(s.id).trim() === aSubId);
        if (!sub) sub = AppState.allSubjects.find(s => String(s.name).trim() === aSubId); // สำรองกรณี Sheets บันทึกชื่อวิชาแทน UUID
        if (!sub) sub = { name: a.subjectId || 'ไม่ระบุวิชา' };
        
        let record = mySubmissionRecords.find(sa => {
            return isAssignmentIdMatch(sa.assignmentId, a.id);
        });
        
        // ถ้ายังไม่มี Record ใน DB ให้ถือว่าสถานะ = รอส่ง
        if (!record) {
            record = { status: 'รอส่ง', score: null, teacherComment: '' };
        }
        
        let isOverdue = false;
        if (a.dueDate && a.dueTime && record.status === 'รอส่ง') {
            const dueDateTime = new Date(`${a.dueDate}T${a.dueTime}:00+07:00`);
            if (new Date() > dueDateTime) isOverdue = true;
        }

        return { asm: a, subject: sub, rec: record, isOverdue };
    });

    // 3. วาด Dashboard สรุปคะแนนสะสมแยกตามรายวิชา
    const dashboardEl = document.getElementById('stu-asm-dashboard');
    const subDropdown = document.getElementById('stu-asm-filter-sub');
    let subjectScores = {};
    
    // Calculate total values for the "All" card
    let grandTotalMax = 0;
    let grandMyScore = 0;
    
    mappedData.forEach(item => {
        const subName = item.subject.name;
        if (!subjectScores[subName]) subjectScores[subName] = { subId: item.asm.subjectId, totalMax: 0, myScore: 0, count: 0 };
        
        const maxScoreVal = parseFloat(item.asm.maxScore || 0);
        subjectScores[subName].totalMax += maxScoreVal;
        subjectScores[subName].count++;
        grandTotalMax += maxScoreVal;
        
        if (item.rec.status === 'ตรวจแล้ว' && item.rec.score !== null) {
            const scoreVal = parseFloat(item.rec.score);
            subjectScores[subName].myScore += scoreVal;
            grandMyScore += scoreVal;
        }
    });

    const grandPct = grandTotalMax > 0 ? Math.round((grandMyScore / grandTotalMax) * 100) : 0;
    const isAllActive = !filterSub;
    const allBorderClass = isAllActive ? 'border-indigo-600 shadow-md ring-2 ring-indigo-100 bg-indigo-50/20' : 'border-gray-200 hover:border-indigo-400 bg-white';

    let dashHtml = `
        <div onclick="filterStudentAssignmentBySubject('')" class="cursor-pointer p-4 rounded-xl border-2 ${allBorderClass} shadow-sm flex items-center justify-center text-center transition-all hover:scale-[1.02] duration-200 min-h-[108px]">
            <p class="font-bold text-indigo-900 text-sm"><i class="fas fa-th-large mr-1.5 text-indigo-600"></i>ทุกรายวิชา (ทั้งหมด)</p>
        </div>
    `;
    
    let dropdownHtml = '<option value="">-- ทุกรายวิชา --</option>';
    
    for (const [subName, stats] of Object.entries(subjectScores)) {
        const pct = stats.totalMax > 0 ? Math.round((stats.myScore / stats.totalMax) * 100) : 0;
        dropdownHtml += `<option value="${stats.subId}">${subName}</option>`;
        
        const isActive = filterSub && (String(filterSub).trim() === String(stats.subId).trim() || String(filterSub).trim() === String(subName).trim());
        const borderClass = isActive ? 'border-green-600 shadow-md ring-2 ring-green-100 bg-green-50/10' : 'border-gray-200 hover:border-green-400 bg-white';
        
        dashHtml += `
            <div onclick="filterStudentAssignmentBySubject('${stats.subId}')" class="cursor-pointer p-4 rounded-xl border ${borderClass} shadow-sm flex flex-col justify-between transition-all hover:scale-[1.02] duration-200">
                <p class="font-bold text-indigo-900 text-sm truncate mb-2" title="${subName}">${subName}</p>
                <div>
                    <div class="flex justify-between items-end mb-1">
                        <span class="text-2xl font-black text-green-600">${stats.myScore}<span class="text-sm text-gray-500 font-medium">/${stats.totalMax}</span></span>
                        <span class="text-xs font-bold ${pct >= 80 ? 'text-green-500' : pct >= 50 ? 'text-yellow-500' : 'text-red-500'}">${pct}%</span>
                    </div>
                    <div class="w-full bg-gray-100 rounded-full h-2">
                        <div class="bg-green-500 h-2 rounded-full" style="width: ${pct}%"></div>
                    </div>
                </div>
            </div>
        `;
    }
    
    if(dashHtml === '') dashHtml = '<div class="col-span-full text-sm text-gray-500 italic">ยังไม่มีข้อมูลงานที่ได้รับมอบหมาย</div>';
    dashboardEl.innerHTML = dashHtml;
    
    // Retain dropdown value
    const currentSubVal = subDropdown.value;
    subDropdown.innerHTML = dropdownHtml;
    if (currentSubVal) subDropdown.value = currentSubVal;

    // 4. กรองและแสดงผลตารางรายการงาน
    if (filterSub) {
        mappedData = mappedData.filter(m => 
            String(m.asm.subjectId).trim() === String(filterSub).trim() ||
            (m.subject && String(m.subject.name).trim() === String(filterSub).trim()) ||
            (m.subject && String(m.subject.id).trim() === String(filterSub).trim())
        );
    }
    if (filterStatus) {
        mappedData = mappedData.filter(m => m.rec.status === filterStatus);
    }

    // เรียง: ทวงงาน/เกินกำหนด ขึ้นก่อน -> รอส่ง -> ส่งแล้ว -> ตรวจแล้ว
    mappedData.sort((a,b) => {
        const weight = (m) => {
            if (m.rec.status === 'ทวงงาน') return 0;
            if (m.isOverdue) return 1;
            if (m.rec.status === 'รอส่ง') return 2;
            if (m.rec.status === 'ส่งแล้ว') return 3;
            return 4; // ตรวจแล้ว
        };
        const wA = weight(a); const wB = weight(b);
        if (wA !== wB) return wA - wB;
        return new Date(b.asm.assignDate) - new Date(a.asm.assignDate);
    });

    const listContainer = document.getElementById('stu-asm-list-container');
    if (mappedData.length === 0) {
        listContainer.innerHTML = '<div class="col-span-full text-center py-10 bg-white rounded-xl border text-gray-500">ไม่พบรายการงานภายใต้เงื่อนไขที่เลือก</div>';
        return;
    }

    listContainer.innerHTML = mappedData.map(m => {
        const a = m.asm;
        const r = m.rec;
        
        let statusBadge = '';
        let cardBgClass = 'bg-white';
        let cardBorder = 'border-gray-200';
        let shadowColor = 'shadow-gray-100/50';
        let btnClass = 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200';
        let subjectColor = 'text-indigo-600';

        if (a.submitLocation === 'สอบ') {
            if (r.status === 'ตรวจแล้ว') {
                statusBadge = `<span class="bg-emerald-600 text-white text-[10px] px-2.5 py-1 rounded-full shadow-sm font-bold"><i class="fas fa-check-double mr-1"></i>ประกาศคะแนนแล้ว</span>`;
                cardBgClass = 'bg-gradient-to-br from-emerald-50/70 to-teal-50/20';
                cardBorder = 'border-emerald-300';
                shadowColor = 'shadow-emerald-200/40';
                btnClass = 'bg-emerald-600 hover:bg-emerald-700 text-white border-transparent';
                subjectColor = 'text-emerald-800';
            } else {
                statusBadge = `<span class="bg-yellow-100 text-yellow-800 text-[10px] px-2.5 py-1 rounded-full font-bold border border-yellow-200"><i class="fas fa-hourglass-half mr-1"></i>รอคะแนนสอบ</span>`;
                cardBgClass = 'bg-gradient-to-br from-yellow-50/80 to-amber-50/10';
                cardBorder = 'border-yellow-200';
                shadowColor = 'shadow-yellow-200/30';
                btnClass = 'bg-yellow-50 hover:bg-yellow-100 text-yellow-700 border-yellow-200';
                subjectColor = 'text-yellow-800';
            }
        } else if (r.status === 'ทวงงาน') {
            statusBadge = `<span class="bg-red-500 text-white text-[10px] px-2.5 py-1 rounded-full shadow-sm font-bold animate-pulse"><i class="fas fa-bullhorn mr-1"></i>ครูทวงงาน!</span>`;
            cardBgClass = 'bg-gradient-to-br from-red-50/70 to-orange-50/20';
            cardBorder = 'border-red-300';
            shadowColor = 'shadow-red-200/40';
            btnClass = 'bg-red-600 hover:bg-red-700 text-white border-transparent';
            subjectColor = 'text-red-700';
        } else if (r.status === 'ตรวจแล้ว') {
            statusBadge = `<span class="bg-emerald-600 text-white text-[10px] px-2.5 py-1 rounded-full shadow-sm font-bold"><i class="fas fa-check-double mr-1"></i>ตรวจแล้ว</span>`;
            cardBgClass = 'bg-gradient-to-br from-emerald-50/70 to-teal-50/20';
            cardBorder = 'border-emerald-300';
            shadowColor = 'shadow-emerald-200/40';
            btnClass = 'bg-emerald-600 hover:bg-emerald-700 text-white border-transparent';
            subjectColor = 'text-emerald-800';
        } else if (r.status === 'ส่งแล้ว') {
            statusBadge = `<span class="bg-blue-600 text-white text-[10px] px-2.5 py-1 rounded-full shadow-sm font-bold"><i class="fas fa-paper-plane mr-1"></i>ส่งแล้ว</span>`;
            cardBgClass = 'bg-gradient-to-br from-blue-50/70 to-indigo-50/20';
            cardBorder = 'border-blue-300';
            shadowColor = 'shadow-blue-200/40';
            btnClass = 'bg-blue-600 hover:bg-blue-700 text-white border-transparent';
            subjectColor = 'text-blue-800';
        } else if (m.isOverdue) {
            statusBadge = `<span class="bg-orange-500 text-white text-[10px] px-2.5 py-1 rounded-full shadow-sm font-bold"><i class="fas fa-exclamation-circle mr-1"></i>เลยกำหนดส่ง</span>`;
            cardBgClass = 'bg-gradient-to-br from-orange-50/70 to-amber-50/20';
            cardBorder = 'border-orange-300';
            shadowColor = 'shadow-orange-200/40';
            btnClass = 'bg-orange-500 hover:bg-orange-600 text-white border-transparent';
            subjectColor = 'text-orange-800';
        } else {
            statusBadge = `<span class="bg-slate-100 text-slate-700 text-[10px] px-2.5 py-1 rounded-full font-bold border border-slate-200">รอส่ง</span>`;
            cardBgClass = 'bg-gradient-to-br from-slate-50/80 to-indigo-50/10';
            cardBorder = 'border-slate-200';
            shadowColor = 'shadow-slate-200/30';
            btnClass = 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200';
            subjectColor = 'text-slate-600';
        }

        const scoreText = r.status === 'ตรวจแล้ว' ? `
            <div class="mt-4 flex items-center justify-between bg-emerald-100/60 border border-emerald-200/40 px-3.5 py-2 rounded-xl">
                <span class="text-xs font-bold text-emerald-800"><i class="fas fa-trophy mr-1 text-amber-500 animate-bounce"></i>คะแนนที่ได้</span>
                <span class="text-sm font-black text-emerald-700">${r.score !== null ? r.score : 0} <span class="text-xs text-emerald-600/70 font-bold">/ ${a.maxScore}</span></span>
            </div>` : '';

        const dateSection = a.submitLocation === 'สอบ' ? `
            <div class="space-y-1.5 border-t border-gray-100 pt-3">
                <div class="text-xs text-gray-500 flex items-center font-bold text-indigo-700"><i class="fas fa-file-signature w-5 text-center mr-1"></i>ประเภท: คะแนนสอบ</div>
            </div>` : `
            <div class="space-y-1.5 border-t border-gray-100 pt-3">
                <div class="text-xs text-gray-500 flex items-center"><i class="far fa-calendar-alt w-5 text-center mr-1 text-gray-400"></i>สั่งเมื่อ: ${getBangkokDate(a.assignDate)}</div>
                <div class="text-xs ${m.isOverdue ? 'text-red-600 font-bold' : 'text-gray-500'} flex items-center"><i class="far fa-clock w-5 text-center mr-1 ${m.isOverdue ? 'text-red-500 animate-pulse' : 'text-gray-400'}"></i>กำหนด: ${getBangkokDate(a.dueDate)} ${a.dueTime}</div>
            </div>`;

        const hasQuiz = a.quizQuestions && a.quizQuestions.trim() !== '' && a.quizQuestions !== '[]';
        let btnLabel = '';
        if (hasQuiz) {
            if (r.status === 'ตรวจแล้ว' || r.status === 'ส่งแล้ว') {
                btnLabel = (a.quizShowAnswer === 'true' || a.quizShowAnswer === true) ? '<i class="fas fa-eye"></i> ดูเฉลยและผลคะแนน' : '<i class="fas fa-check-circle"></i> ส่งแบบทดสอบแล้ว';
            } else {
                btnLabel = '<i class="fas fa-puzzle-piece"></i> ทำแบบทดสอบ';
            }
        } else {
            btnLabel = a.submitLocation === 'สอบ' ? (r.status === 'ตรวจแล้ว' ? '<i class="fas fa-eye"></i> ดูผลคะแนนสอบ' : '<i class="fas fa-eye"></i> ดูรายละเอียด') : (r.status === 'ตรวจแล้ว' ? '<i class="fas fa-eye"></i> ดูผลการตรวจ' : '<i class="fas fa-paper-plane"></i> ดูรายละเอียด / ส่งงาน');
        }

        return `
        <div class="${cardBgClass} p-5 rounded-2xl border ${cardBorder} shadow-sm hover:shadow-lg ${shadowColor} transform hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between cursor-pointer" onclick="openStudentAssignmentModal('${a.id}')">
            <div>
                <div class="flex justify-between items-start mb-3">
                    <span class="text-xs font-black uppercase ${subjectColor} bg-white/60 px-2.5 py-1 rounded-lg border border-transparent truncate max-w-[150px] shadow-sm" title="${m.subject.name}">${m.subject.name}</span>
                    ${statusBadge}
                </div>
                <h4 class="font-bold text-gray-800 text-base leading-snug mb-3 hover:text-indigo-600 transition-colors">${a.title}</h4>
                ${dateSection}
            </div>
            ${scoreText}
            <button class="mt-4 w-full ${btnClass} text-xs font-bold py-2.5 rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 hover:shadow">
                ${btnLabel}
            </button>
        </div>`;
    }).join('');
}

export function openStudentAssignmentModal(asmId) {
    const asm = AppState.allAssignments.find(a => String(a.id).trim() === String(asmId).trim());
    if (!asm) return;
    
    const aSubId = String(asm.subjectId).trim();
    let sub = AppState.allSubjects.find(s => String(s.id).trim() === aSubId);
    if (!sub) sub = AppState.allSubjects.find(s => String(s.name).trim() === aSubId);
    if (!sub) sub = { name: asm.subjectId || 'ไม่ระบุวิชา' };

    const stuId = String(AppState.currentUser.data.id).trim();
    const stuCode = AppState.currentUser.data.studentId ? String(AppState.currentUser.data.studentId).trim() : '';
    let rec = AppState.allStudentAssignments && AppState.allStudentAssignments.find(sa => 
        String(sa.assignmentId).trim() === String(asmId).trim() && 
        (String(sa.studentId).trim() === stuId || (stuCode && String(sa.studentId).trim() === stuCode)) && 
        sa.deleted_flg !== 'Y'
    );
    
    document.getElementById('stu-asm-assignment-id').value = asm.id;
    document.getElementById('stu-asm-record-id').value = rec ? rec.id : '';
    
    document.getElementById('stu-asm-detail-title').innerText = asm.title;
    document.getElementById('stu-asm-detail-sub').innerHTML = `<i class="fas fa-book mr-1"></i>${sub.name}`;
    document.getElementById('stu-asm-detail-assign').innerText = `${getBangkokDate(asm.assignDate)} ${asm.assignTime || ''}`;
    document.getElementById('stu-asm-detail-due').innerText = `${getBangkokDate(asm.dueDate)} ${asm.dueTime || ''}`;
    document.getElementById('stu-asm-detail-score').innerText = `${asm.maxScore} คะแนน`;
    document.getElementById('stu-asm-detail-loc').innerText = asm.submitLocation || 'ไม่ระบุ';
    document.getElementById('stu-asm-detail-desc').innerText = asm.description || 'ไม่มีคำอธิบายเพิ่มเติม';

    // Teacher Attached Files (ไฟล์ที่ครูแนบมาพร้อมกับงาน)
    const teacherFilesSection = document.getElementById('stu-asm-teacher-files-section');
    const teacherFilesContainer = document.getElementById('stu-asm-teacher-files-container');
    let teacherFiles = [];
    try {
        teacherFiles = typeof asm.files === 'string' ? JSON.parse(asm.files) : (Array.isArray(asm.files) ? asm.files : []);
    } catch(e) { teacherFiles = []; }

    if (Array.isArray(teacherFiles) && teacherFiles.length > 0) {
        teacherFilesSection.classList.remove('hidden');
        teacherFilesContainer.innerHTML = teacherFiles.map(file => {
            const fileName = file.name || file.n || 'ไฟล์แนบ';
            const fileUrl = file.url || file.u || '';
            const isImg = fileName.match(/\.(jpeg|jpg|gif|png|webp)$/i);
            const isValidUrl = fileUrl && (fileUrl.startsWith('http://') || fileUrl.startsWith('https://'));

            let previewInner = '';
            if (isImg && isValidUrl) {
                previewInner = `<img src="${getDirectImageUrl(fileUrl)}" class="w-full h-16 object-cover rounded border mb-1 cursor-pointer" onclick="viewLargeImage(this.src)" title="คลิกเพื่อดูรูปใหญ่">`;
            } else {
                let faIcon = 'fa-file-alt text-indigo-500';
                if (fileName.match(/\.pdf$/i)) faIcon = 'fa-file-pdf text-red-500';
                else if (fileName.match(/\.(doc|docx)$/i)) faIcon = 'fa-file-word text-blue-600';
                else if (fileName.match(/\.(xls|xlsx|csv)$/i)) faIcon = 'fa-file-excel text-green-600';
                else if (fileName.match(/\.(ppt|pptx)$/i)) faIcon = 'fa-file-powerpoint text-orange-500';
                else if (fileName.match(/\.(zip|rar)$/i)) faIcon = 'fa-file-archive text-gray-700';
                previewInner = `<div class="flex flex-col items-center justify-center h-16 mb-1"><i class="fas ${faIcon} text-3xl"></i></div>`;
            }

            const linkHtml = isValidUrl
                ? `<a href="${fileUrl}" target="_blank" class="text-[10px] text-indigo-600 hover:underline mt-1 font-bold block"><i class="fas fa-download mr-1"></i>ดาวน์โหลด/เปิด</a>`
                : `<span class="text-[10px] text-gray-400 mt-1 italic block">ไม่มีลิงก์</span>`;

            return `
            <div class="border border-indigo-200 rounded-lg p-2 text-center bg-indigo-50/30 flex flex-col justify-center shadow-sm hover:shadow-md transition-shadow">
                ${previewInner}
                <p class="text-[10px] text-gray-700 truncate w-full px-1 font-medium" title="${fileName}">${fileName}</p>
                ${linkHtml}
            </div>`;
        }).join('');
    } else {
        teacherFilesSection.classList.add('hidden');
        teacherFilesContainer.innerHTML = '';
    }

    // Teacher Comment
    const tCommentBox = document.getElementById('stu-asm-teacher-comment-box');
    if (rec && rec.teacherComment) {
        document.getElementById('stu-asm-teacher-comment').innerText = rec.teacherComment;
        tCommentBox.classList.remove('hidden');
    } else {
        tCommentBox.classList.add('hidden');
    }

    // Existing Student Submission Data
    document.getElementById('stu-asm-student-note').value = rec && rec.studentNote ? rec.studentNote : '';
    document.getElementById('stu-asm-submit-loc').value = rec && rec.submitMethod ? rec.submitMethod : (asm.submitLocation === 'อื่นๆ' ? 'ส่งช่องทางอื่น' : asm.submitLocation);

    const isExam = asm.submitLocation === 'สอบ';
    const hasQuiz = asm.quizQuestions && asm.quizQuestions.trim() !== '' && asm.quizQuestions !== '[]';
    
    // Toggle visibility based on isExam & hasQuiz
    const assignDiv = document.getElementById('stu-asm-assign-div');
    const dueDiv = document.getElementById('stu-asm-due-div');
    const locDiv = document.getElementById('stu-asm-loc-div');
    const submitTitle = document.getElementById('stu-asm-submit-title');
    const submitForm = document.getElementById('stu-asm-submit-form');
    const examPending = document.getElementById('stu-asm-exam-pending');
    
    if (assignDiv) assignDiv.style.display = isExam ? 'none' : '';
    if (dueDiv) dueDiv.style.display = isExam ? 'none' : '';
    if (locDiv) locDiv.style.display = isExam ? 'none' : '';
    
    const quizSection = document.getElementById('stu-asm-quiz-section');
    const quizNotStarted = document.getElementById('stu-asm-quiz-not-started');
    const quizCompleted = document.getElementById('stu-asm-quiz-completed');
    const quizScoreDisplay = document.getElementById('stu-asm-quiz-score-display');
    const quizReviewDiv = document.getElementById('stu-asm-quiz-review-div');

    // Grading State
    const btnSubmit = document.getElementById('btn-stu-asm-submit');
    const gradingResult = document.getElementById('stu-asm-grading-result');
    const gradedFilesSection = document.getElementById('stu-asm-graded-files-section');
    const gradedFilesContainer = document.getElementById('stu-asm-graded-files-container');
    const uploadArea = document.getElementById('stu-asm-upload-area');
    
    if (hasQuiz) {
        if (submitTitle) submitTitle.style.display = 'none';
        if (submitForm) submitForm.style.display = 'none';
        if (btnSubmit) btnSubmit.classList.add('hidden');
        if (uploadArea) uploadArea.classList.add('hidden');
        if (examPending) examPending.classList.add('hidden');
        if (gradingResult) gradingResult.classList.add('hidden');
        
        if (quizSection) quizSection.classList.remove('hidden');
        
        const hasDoneQuiz = rec && rec.quizAnswers && rec.quizAnswers.trim() !== '' && rec.quizAnswers !== '[]';
        if (hasDoneQuiz) {
            if (quizNotStarted) quizNotStarted.classList.add('hidden');
            if (quizCompleted) quizCompleted.classList.remove('hidden');
            if (quizScoreDisplay) quizScoreDisplay.innerText = `${rec.score !== null ? rec.score : 0} / ${asm.maxScore}`;
            
            const showAns = asm.quizShowAnswer === 'true' || asm.quizShowAnswer === true;
            if (quizReviewDiv) {
                if (showAns) quizReviewDiv.classList.remove('hidden');
                else quizReviewDiv.classList.add('hidden');
            }
        } else {
            if (quizNotStarted) quizNotStarted.classList.remove('hidden');
            if (quizCompleted) quizCompleted.classList.add('hidden');
        }
        
        if (gradedFilesSection) gradedFilesSection.classList.add('hidden');
        if (gradedFilesContainer) gradedFilesContainer.innerHTML = '';
    } else {
        if (quizSection) quizSection.classList.add('hidden');
        if (submitTitle) submitTitle.style.display = isExam ? 'none' : '';
        if (submitForm) submitForm.style.display = isExam ? 'none' : '';

        if (isExam) {
            if (btnSubmit) btnSubmit.classList.add('hidden');
            if (uploadArea) uploadArea.classList.add('hidden');
            if (examPending) {
                if (rec && rec.status === 'ตรวจแล้ว') {
                    examPending.classList.add('hidden');
                    gradingResult.classList.remove('hidden');
                    document.getElementById('stu-asm-graded-score').innerText = `${rec.score !== null ? rec.score : 0}`;
                } else {
                    examPending.classList.remove('hidden');
                    gradingResult.classList.add('hidden');
                }
            }
            gradedFilesSection.classList.add('hidden');
            gradedFilesContainer.innerHTML = '';
        } else {
            if (examPending) examPending.classList.add('hidden');
            if (rec && rec.status === 'ตรวจแล้ว') {
            btnSubmit.classList.add('hidden');
            gradingResult.classList.remove('hidden');
            if (uploadArea) uploadArea.classList.add('hidden'); // Hide upload area when graded
            document.getElementById('stu-asm-graded-score').innerText = `${rec.score !== null ? rec.score : 0}`;
            document.getElementById('stu-asm-student-note').disabled = true;
            document.getElementById('stu-asm-submit-loc').disabled = true;
            
            let files = [];
            try { files = typeof rec.files === 'string' ? JSON.parse(rec.files) : rec.files; } catch(e) {}
            if (!Array.isArray(files)) files = [];
            
            if (files.length > 0) {
                gradedFilesSection.classList.remove('hidden');
                gradedFilesContainer.innerHTML = files.map((file, idx) => {
                    const fileName = file.name || file.n || 'ไฟล์แนบ';
                    let fileUrl = file.url || file.u || '';
                    
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
                        ? `<a href="${fileUrl}" target="_blank" class="text-[10px] text-indigo-600 hover:underline mt-1 font-bold"><i class="fas fa-download mr-1"></i>ดาวน์โหลด</a>`
                        : `<span class="text-[10px] text-gray-400 mt-1 italic">ไม่มีลิงก์</span>`;
                    
                    return `
                    <div class="border border-green-200 rounded-lg p-2 text-center bg-white flex flex-col justify-center relative shadow-sm hover:shadow-md transition-shadow">
                        ${previewInner}
                        <p class="text-[10px] text-gray-700 truncate w-full px-1 font-medium" title="${fileName}">${fileName}</p>
                        ${linkHtml}
                    </div>`;
                }).join('');
            } else {
                gradedFilesSection.classList.add('hidden');
                gradedFilesContainer.innerHTML = '';
            }
        } else {
            btnSubmit.classList.remove('hidden');
            gradingResult.classList.add('hidden');
            if (uploadArea) uploadArea.classList.remove('hidden'); // Show upload area when not graded
            document.getElementById('stu-asm-student-note').disabled = false;
            document.getElementById('stu-asm-submit-loc').disabled = false;
            gradedFilesSection.classList.add('hidden');
            gradedFilesContainer.innerHTML = '';
        }
    }
    }

    // Render File Upload Slots
    renderStudentAsmFileSlots(rec ? rec.files : '[]');

    document.getElementById('student-assignment-modal').classList.add('show');
}

function renderStudentAsmFileSlots(existingFilesJson) {
    const container = document.getElementById('stu-asm-files-container');
    let files = [];
    try { files = typeof existingFilesJson === 'string' ? JSON.parse(existingFilesJson) : existingFilesJson; } catch(e) {}
    if (!Array.isArray(files)) files = [];

    const isGraded = document.getElementById('stu-asm-grading-result').classList.contains('hidden') === false;

    let html = '';
    for(let i=1; i<=3; i++) {
        const file = files[i-1];
        if (file) {
            const fileName = file.name || file.n;
            let fileUrl = file.url || file.u;
            
            // If URL is missing but base64 is present, use it as a Data URL
            if (!fileUrl && file.base64) {
                fileUrl = `data:${file.mimeType || 'image/jpeg'};base64,${file.base64}`;
            }

            const isValidUrl = fileUrl && (fileUrl.startsWith('http://') || fileUrl.startsWith('https://') || fileUrl.startsWith('data:'));
            const isImg = fileName.match(/\.(jpeg|jpg|gif|png|webp)$/i);
            
            let previewInner = '';
            if (isImg && isValidUrl) {
                previewInner = `<img src="${getDirectImageUrl(fileUrl)}" class="w-full h-14 object-cover rounded border mb-1 cursor-pointer" onclick="viewLargeImage(this.src)">`;
            } else {
                let faIcon = 'fa-file-alt text-indigo-500';
                if (fileName.match(/\.pdf$/i)) faIcon = 'fa-file-pdf text-red-500';
                else if (fileName.match(/\.(doc|docx)$/i)) faIcon = 'fa-file-word text-blue-600';
                else if (fileName.match(/\.(xls|xlsx|csv)$/i)) faIcon = 'fa-file-excel text-green-600';
                else if (fileName.match(/\.(zip|rar)$/i)) faIcon = 'fa-file-archive text-gray-700';
                previewInner = `<div class="flex flex-col items-center justify-center h-14 mb-1"><i class="fas ${faIcon} text-3xl"></i></div>`;
            }

            const removeBtn = isGraded ? '' : `<button type="button" onclick="removeStudentAsmFile(${i})" class="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white w-6 h-6 rounded-full shadow-md flex items-center justify-center"><i class="fas fa-times text-xs"></i></button>`;

            const linkHtml = isValidUrl 
                ? `<a href="${fileUrl}" target="_blank" class="text-[10px] text-indigo-600 hover:underline mt-1 font-bold">ดาวน์โหลด</a>` 
                : `<span class="text-[10px] text-gray-400 mt-1 italic">อัปโหลดสำเร็จ (ไม่มีลิงก์)</span>`;

            html += `
            <div class="border border-indigo-200 rounded-lg p-2 text-center bg-white flex flex-col justify-center relative min-h-[110px]" id="stu-file-slot-${i}" data-existing='${JSON.stringify(file)}'>
                ${previewInner}
                <p class="text-[10px] text-gray-700 truncate w-full px-1 font-medium" title="${fileName}">${fileName}</p>
                ${linkHtml}
                ${removeBtn}
            </div>`;
        } else {
            if (isGraded) {
                html += `<div class="border border-dashed border-gray-300 rounded-lg p-2 flex flex-col items-center justify-center bg-gray-50 min-h-[110px]"><span class="text-xs text-gray-400 font-medium">ไม่มีไฟล์</span></div>`;
            } else {
                html += `
                <div class="border-2 border-dashed border-indigo-300 rounded-lg p-2 text-center bg-white flex flex-col justify-center relative min-h-[110px] hover:border-indigo-500 hover:bg-indigo-50 transition-colors" id="stu-file-slot-${i}">
                    <label for="stu-asm-file-${i}" class="cursor-pointer text-indigo-500 hover:text-indigo-700 flex flex-col items-center justify-center h-full w-full">
                        <i class="fas fa-cloud-upload-alt text-2xl mb-1"></i><span class="text-xs font-medium">แนบไฟล์ ${i}</span>
                    </label>
                    <input type="file" id="stu-asm-file-${i}" class="hidden" onchange="previewStudentAsmFile(event, ${i})">
                </div>`;
            }
        }
    }
    container.innerHTML = html;
}

export function previewStudentAsmFile(event, index) {
    const file = event.target.files[0];
    const slot = document.getElementById(`stu-file-slot-${index}`);
    
    if (file) {
        if (file.size > 10 * 1024 * 1024) {
            customAlert('ไฟล์มีขนาดใหญ่เกิน 10MB');
            event.target.value = '';
            return;
        }
        const isImg = file.type.startsWith('image/');
        let previewInner = '';
        if (isImg) {
            const url = URL.createObjectURL(file);
            previewInner = `<img src="${url}" class="w-full h-14 object-cover rounded border mb-1 cursor-pointer" onclick="viewLargeImage(this.src)">`;
        } else {
            previewInner = `<div class="flex flex-col items-center justify-center h-14 mb-1"><i class="fas fa-file-alt text-3xl text-indigo-500"></i></div>`;
        }

        slot.innerHTML = `
            ${previewInner}
            <p class="text-[10px] text-gray-700 truncate w-full px-1 font-medium">${file.name}</p>
            <span class="text-[10px] text-orange-500 font-bold mt-1">รอการบันทึก...</span>
            <button type="button" onclick="removeStudentAsmFile(${index}, true)" class="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white w-6 h-6 rounded-full shadow-md flex items-center justify-center"><i class="fas fa-times text-xs"></i></button>
            <input type="file" id="stu-asm-file-${index}" class="hidden"> 
        `;
        // Re-attach file object to the newly created hidden input
        const dt = new DataTransfer();
        dt.items.add(file);
        document.getElementById(`stu-asm-file-${index}`).files = dt.files;
    }
}

export function removeStudentAsmFile(index, isNew = false) {
    const slot = document.getElementById(`stu-file-slot-${index}`);
    slot.removeAttribute('data-existing');
    slot.innerHTML = `
        <label for="stu-asm-file-${index}" class="cursor-pointer text-indigo-500 hover:text-indigo-700 flex flex-col items-center justify-center h-full w-full">
            <i class="fas fa-cloud-upload-alt text-2xl mb-1"></i><span class="text-xs font-medium">แนบไฟล์ ${index}</span>
        </label>
        <input type="file" id="stu-asm-file-${index}" class="hidden" onchange="previewStudentAsmFile(event, ${index})">
    `;
    slot.className = "border-2 border-dashed border-indigo-300 rounded-lg p-2 text-center bg-white flex flex-col justify-center relative min-h-[110px] hover:border-indigo-500 hover:bg-indigo-50 transition-colors";
}

export async function submitStudentAssignment() {
    const asmId = document.getElementById('stu-asm-assignment-id').value;
    const recId = document.getElementById('stu-asm-record-id').value || generateId();
    const submitMethod = document.getElementById('stu-asm-submit-loc').value;
    const studentNote = document.getElementById('stu-asm-student-note').value.trim();
    const stuId = AppState.currentUser.data.id;

    // บังคับแนบไฟล์อย่างน้อย 1 ไฟล์หากเลือกส่งแบบออนไลน์
    if (submitMethod === 'ส่ง Online') {
        let hasFile = false;
        for (let i = 1; i <= 3; i++) {
            const slot = document.getElementById(`stu-file-slot-${i}`);
            const fileInput = document.getElementById(`stu-asm-file-${i}`);
            if ((fileInput && fileInput.files.length > 0) || (slot && slot.dataset.existing)) {
                hasFile = true;
                break;
            }
        }
        if (!hasFile) {
            return customAlert('สำหรับการส่งงานออนไลน์ คุณต้องแนบไฟล์อย่างน้อย 1 ไฟล์');
        }
    }

    showLoading('กำลังเตรียมข้อมูลและบีบอัดไฟล์...');

    try {
        const files = [];
        for (let i = 1; i <= 3; i++) {
            const slot = document.getElementById(`stu-file-slot-${i}`);
            const fileInput = document.getElementById(`stu-asm-file-${i}`);
            
            if (fileInput && fileInput.files.length > 0) {
                const f = fileInput.files[0];
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
            } else if (slot && slot.dataset.existing) {
                try { files.push(JSON.parse(slot.dataset.existing)); } catch(e) {}
            }
        }

        const now = getISOTimestamp();
        const payload = {
            id: recId,
            assignmentId: asmId,
            studentId: stuId,
            submitMethod: submitMethod,
            studentNote: studentNote,
            status: 'ส่งแล้ว',
            files: JSON.stringify(files),
            score: null, 
            teacherComment: '', // ครูเป็นคนอัปเดตช่องนี้
            createdAt: now,
            createdBy: stuId,
            updatedAt: now,
            updatedBy: stuId,
            deleted_flg: 'N'
        };

        // ตั้งค่าตัวเลียนแบบเปอร์เซ็นต์ความคืบหน้า (Simulated Progress)
        let percent = 0;
        const progressInterval = setInterval(() => {
            if (percent < 90) {
                percent += Math.floor(Math.random() * 12) + 5; // เพิ่มขึ้นทีละ 5-17%
                if (percent > 90) percent = 90;
                showLoading(`กำลังส่งไฟล์และข้อมูล... ${percent}%`);
            } else if (percent < 98) {
                percent += 1; // เพิ่มช้าลงเมื่อใกล้เสร็จสิ้น
                showLoading(`กำลังอัปโหลดขึ้น Google Drive... ${percent}%`);
            }
        }, 250);

        let responseText;
        try {
            const response = await fetch(AppState.googleSheetUrl, {
                method: 'POST',
                redirect: 'follow',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ action: 'submitStudentAssignment', payload: payload })
            });

            clearInterval(progressInterval);
            
            if (response.ok) {
                responseText = await response.text();
            } else {
                throw new Error(`HTTP Error: ${response.status}`);
            }
        } catch (xhrError) {
            clearInterval(progressInterval);
            throw xhrError;
        }

        showLoading(`กำลังส่งไฟล์และข้อมูล... 100%`);

        let result = {};
        try { result = JSON.parse(responseText); } catch (e) {}

        // ตรวจสอบความสำเร็จแบบละเอียด (ต้องไม่ใช่ error และต้องมีสถานะสำเร็จจริง)
        const isSuccess = result.status === 'success' || result.success === true || responseText.toLowerCase().includes('success') || responseText.includes('สำเร็จ');
        
        if (!isSuccess || result.status === 'error') {
            throw new Error(result.message || responseText || 'เกิดข้อผิดพลาดในการอัปโหลดไฟล์ขึ้น Google Drive');
        }

        // แปลงไฟล์ตอบกลับให้อยู่ในโครงสร้างปกติ
        let finalObj = { ...payload };
        if (result && typeof result === 'object') {
            if (result.data) {
                finalObj = { ...finalObj, ...result.data };
            } else if (result.files || result.id) {
                finalObj = { ...finalObj, ...result };
            }
        }
        try {
            let filesData = finalObj.files || payload.files || '[]';
            let parsedFiles = typeof filesData === 'string' ? JSON.parse(filesData) : filesData;
            if (Array.isArray(parsedFiles)) {
                let hasMissingUrls = false;
                parsedFiles = parsedFiles.map(f => {
                    const urlVal = f.url || f.u;
                    if (!urlVal || urlVal === 'อัปโหลดสำเร็จ') {
                        hasMissingUrls = true;
                    }
                    return { n: f.name || f.n, u: urlVal || 'อัปโหลดสำเร็จ' };
                });
                finalObj.files = JSON.stringify(parsedFiles);
                
                if (hasMissingUrls && files.some(file => file.base64)) {
                    console.warn("Some uploaded student files are missing URLs from the backend response. Please ensure Google Apps Script is updated to the latest version.");
                }
            }
        } catch(e) {}

        // บันทึกลง Local State
        const existIdx = AppState.allStudentAssignments.findIndex(sa => sa.id === recId);
        if (existIdx > -1) { AppState.allStudentAssignments[existIdx] = { ...AppState.allStudentAssignments[existIdx], ...finalObj }; }
        else { AppState.allStudentAssignments.push(finalObj); }

        // สำรองการเซฟลง DB
        await saveToDB('STUDENT_ASSIGNMENTS', AppState.allStudentAssignments, 'saveStudentAssignments');

        hideLoading();
        closeModal('student-assignment-modal');
        renderStudentAssignments();
        showToast('ส่งงานและอัปโหลดไฟล์เรียบร้อยแล้ว!');

    } catch (err) {
        hideLoading();
        customAlert('การอัปโหลดล้มเหลว: ' + err.message + '\n\nกรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต หรือแนบไฟล์ใหม่อีกครั้ง');
    }
}


export function copyParentInfoToGuardian(parentRole) {
    let title = 'นาย';
    let fname = '';
    let lname = '';
    let relation = 'อื่นๆ';
    let phone = '';
    
    if (parentRole === 'father') {
        title = 'นาย';
        fname = (document.getElementById('sp-f-fname').value || '').trim();
        lname = (document.getElementById('sp-f-lname').value || '').trim();
        relation = 'บิดา';
        phone = (document.getElementById('sp-f-phone').value || '').trim();
    } else if (parentRole === 'mother') {
        title = 'นาง';
        fname = (document.getElementById('sp-m-fname').value || '').trim();
        lname = (document.getElementById('sp-m-lname').value || '').trim();
        relation = 'มารดา';
        phone = (document.getElementById('sp-m-phone').value || '').trim();
    }
    
    const titleSelect = document.getElementById('sp-p-title');
    const fnameInput = document.getElementById('sp-p-fname');
    const lnameInput = document.getElementById('sp-p-lname');
    const relSelect = document.getElementById('sp-p-rel');
    const phoneInput = document.getElementById('sp-p-phone');
    
    if (titleSelect) {
        titleSelect.value = title;
        titleSelect.disabled = true;
        titleSelect.classList.add('bg-gray-100');
    }
    if (fnameInput) {
        fnameInput.value = fname;
        fnameInput.readOnly = true;
        fnameInput.classList.add('bg-gray-100');
        // trigger validation styling reset
        fnameInput.classList.remove('border-red-500', 'bg-red-50');
    }
    if (lnameInput) {
        lnameInput.value = lname;
        lnameInput.readOnly = true;
        lnameInput.classList.add('bg-gray-100');
        lnameInput.classList.remove('border-red-500', 'bg-red-50');
    }
    if (relSelect) {
        relSelect.value = relation;
        relSelect.disabled = true;
        relSelect.classList.add('bg-gray-100');
    }
    if (phoneInput) {
        phoneInput.value = phone;
        phoneInput.readOnly = true;
        phoneInput.classList.add('bg-gray-100');
        phoneInput.classList.remove('border-red-500', 'bg-red-50');
    }
    
    const clearBtn = document.getElementById('sp-btn-clear-copy');
    if (clearBtn) {
        clearBtn.classList.remove('hidden');
    }
}

export function clearCopiedGuardianInfo() {
    const radios = document.getElementsByName('sp-copy-parent');
    radios.forEach(r => r.checked = false);
    
    const fnameInput = document.getElementById('sp-p-fname');
    const lnameInput = document.getElementById('sp-p-lname');
    const phoneInput = document.getElementById('sp-p-phone');
    
    if (fnameInput) {
        fnameInput.value = '';
        fnameInput.readOnly = false;
        fnameInput.classList.remove('bg-gray-100');
        fnameInput.classList.remove('border-red-500', 'bg-red-50');
    }
    if (lnameInput) {
        lnameInput.value = '';
        lnameInput.readOnly = false;
        lnameInput.classList.remove('bg-gray-100');
        lnameInput.classList.remove('border-red-500', 'bg-red-50');
    }
    if (phoneInput) {
        phoneInput.value = '';
        phoneInput.readOnly = false;
        phoneInput.classList.remove('bg-gray-100');
        phoneInput.classList.remove('border-red-500', 'bg-red-50');
    }
    
    const titleSelect = document.getElementById('sp-p-title');
    const relSelect = document.getElementById('sp-p-rel');
    
    if (titleSelect) {
        titleSelect.disabled = false;
        titleSelect.classList.remove('bg-gray-100');
    }
    if (relSelect) {
        relSelect.disabled = false;
        relSelect.classList.remove('bg-gray-100');
    }
    
    const clearBtn = document.getElementById('sp-btn-clear-copy');
    if (clearBtn) {
        clearBtn.classList.add('hidden');
    }
}

// --- Bulk Promotion & Transfer Logic ---
export function openBulkTransferModal() {
    const sourceSelect = document.getElementById('bulk-source-class');
    const targetSelect = document.getElementById('bulk-target-class');
    
    if (!sourceSelect || !targetSelect) return;

    // Get unique active classes
    const activeClasses = AppState.allClasses.filter(c => c.deleted_flg !== 'Y');
    // Sort classes: e.g. Year/Semester and name
    activeClasses.sort((a, b) => a.className.localeCompare(b.className, 'th', { numeric: true }) || a.year - b.year);

    const classOptions = '<option value="">-- เลือกชั้นเรียน --</option>' + 
        activeClasses.map(c => `<option value="${c.id}">${c.className} (ปี ${c.year}/${c.semester})</option>`).join('');

    sourceSelect.innerHTML = classOptions;
    targetSelect.innerHTML = classOptions;

    // Clear previous student list
    document.getElementById('bulk-transfer-table-body').innerHTML = `
        <tr>
            <td colspan="4" class="px-4 py-8 text-center text-gray-500 italic">กรุณาเลือกชั้นเรียนต้นทางเพื่อโหลดข้อมูล</td>
        </tr>
    `;
    document.getElementById('bulk-student-count').innerText = '0';
    document.getElementById('bulk-select-all').checked = true;

    document.getElementById('bulk-transfer-modal').classList.add('show');
}

export function onBulkTransferSourceClassChange() {
    const classId = document.getElementById('bulk-source-class').value;
    const tbody = document.getElementById('bulk-transfer-table-body');
    const countSpan = document.getElementById('bulk-student-count');
    
    if (!classId) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="px-4 py-8 text-center text-gray-500 italic">กรุณาเลือกชั้นเรียนต้นทางเพื่อโหลดข้อมูล</td>
            </tr>
        `;
        countSpan.innerText = '0';
        return;
    }

    const cls = AppState.allClasses.find(c => c.id === classId);
    if (!cls) return;

    // Filter students belonging to this class name
    const students = AppState.allStudents
        .filter(s => s.class === cls.className && s.deleted_flg !== 'Y' && s.status !== 'ลาออก')
        .sort((a, b) => a.number - b.number);

    if (students.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="px-4 py-8 text-center text-gray-500 italic">ไม่พบนักเรียนที่กำลังศึกษาในห้องนี้</td>
            </tr>
        `;
        countSpan.innerText = '0';
        return;
    }

    tbody.innerHTML = students.map(s => `
        <tr class="hover:bg-gray-50">
            <td class="px-4 py-2 text-center">
                <input type="checkbox" value="${s.id}" class="bulk-student-cb rounded border-gray-300 text-purple-600 focus:ring-purple-500" checked onchange="updateBulkTransferSelectAllState()">
            </td>
            <td class="px-4 py-2 text-center font-mono">${s.number || '-'}</td>
            <td class="px-4 py-2 font-mono">${s.studentId || '-'}</td>
            <td class="px-4 py-2 font-semibold text-gray-800">${getStudentFullName(s)}</td>
        </tr>
    `).join('');

    countSpan.innerText = students.length;
    document.getElementById('bulk-select-all').checked = true;
}

export function toggleAllBulkTransferCheckboxes(sourceCb) {
    const checkboxes = document.querySelectorAll('.bulk-student-cb');
    checkboxes.forEach(cb => cb.checked = sourceCb.checked);
}

export function updateBulkTransferSelectAllState() {
    const checkboxes = document.querySelectorAll('.bulk-student-cb');
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    document.getElementById('bulk-select-all').checked = allChecked;
}

export async function executeBulkTransfer() {
    const sourceClassId = document.getElementById('bulk-source-class').value;
    const targetClassId = document.getElementById('bulk-target-class').value;
    const resetNumbers = document.getElementById('bulk-reset-numbers').checked;

    if (!sourceClassId || !targetClassId) {
        return customAlert('กรุณาเลือกชั้นเรียนต้นทางและชั้นเรียนปลายทางให้ครบถ้วน');
    }

    if (sourceClassId === targetClassId) {
        return customAlert('ชั้นเรียนต้นทางและชั้นเรียนปลายทางต้องไม่เป็นห้องเรียนเดียวกัน');
    }

    const targetClassObj = AppState.allClasses.find(c => c.id === targetClassId);
    if (!targetClassObj) return;

    // Get checked student IDs
    const checkedCbs = document.querySelectorAll('.bulk-student-cb:checked');
    if (checkedCbs.length === 0) {
        return customAlert('กรุณาเลือกนักเรียนอย่างน้อย 1 คนที่ต้องการย้ายหรือเลื่อนชั้น');
    }

    const studentIds = Array.from(checkedCbs).map(cb => cb.value);

    customConfirm(
        'ยืนยันการย้าย / เลื่อนชั้นเรียนแบบกลุ่ม',
        `คุณต้องการย้ายนักเรียนจำนวน ${studentIds.length} คน ไปยังชั้นเรียน ${targetClassObj.className} ใช่หรือไม่?`,
        async () => {
            showLoading('กำลังดำเนินการย้ายนักเรียน...');
            const now = getISOTimestamp();
            const userId = getCurrentUserId();

            // 1. Update students' class property
            studentIds.forEach(id => {
                const sIdx = AppState.allStudents.findIndex(s => s.id === id);
                if (sIdx > -1) {
                    AppState.allStudents[sIdx].class = targetClassObj.className;
                    AppState.allStudents[sIdx].updatedAt = now;
                    AppState.allStudents[sIdx].updatedBy = userId;
                }
            });

            // 2. Reset student numbers if selected
            if (resetNumbers) {
                // Find all active students in the target class (including the newly moved ones)
                const targetStudents = AppState.allStudents
                    .filter(s => s.class === targetClassObj.className && s.deleted_flg !== 'Y' && s.status !== 'ลาออก');
                
                // Sort by first name alphabetically (Thai dictionary style)
                targetStudents.sort((a, b) => (a.firstName || '').localeCompare(b.firstName || '', 'th'));

                // Assign sequential numbers
                targetStudents.forEach((student, index) => {
                    const sIdx = AppState.allStudents.findIndex(s => s.id === student.id);
                    if (sIdx > -1) {
                        AppState.allStudents[sIdx].number = index + 1;
                        AppState.allStudents[sIdx].updatedAt = now;
                        AppState.allStudents[sIdx].updatedBy = userId;
                    }
                });
            }

            // 3. Save to Google Sheets / DB
            const saveSuccess = await saveToDB(DB_KEYS.STUDENTS, AppState.allStudents, 'saveStudents');
            hideLoading();

            if (saveSuccess !== false) {
                closeModal('bulk-transfer-modal');
                // Refresh list
                if (window.renderManageStudents) window.renderManageStudents();
                showToast(`ดำเนินการเลื่อนชั้น / ย้ายนักเรียน ${studentIds.length} คน สำเร็จเรียบร้อย`);
            } else {
                customAlert('ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง');
            }
        }
    );
}

// ผูกฟังก์ชันเข้า Window
window.copyParentInfoToGuardian = copyParentInfoToGuardian;
window.clearCopiedGuardianInfo = clearCopiedGuardianInfo;
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
window.toggleStudentModalEditMode = toggleStudentModalEditMode;
window.searchManageStudents = searchManageStudents;
window.renderStudentAcademicPortal = renderStudentAcademicPortal;
window.getGPSLocationForProfile = getGPSLocationForProfile;
window.removeImageForProfile = removeImageForProfile;
window.renderStudentAssignments = renderStudentAssignments;
window.openStudentAssignmentModal = openStudentAssignmentModal;
window.previewStudentAsmFile = previewStudentAsmFile;
window.removeStudentAsmFile = removeStudentAsmFile;
window.submitStudentAssignment = submitStudentAssignment;
window.openBulkTransferModal = openBulkTransferModal;
window.onBulkTransferSourceClassChange = onBulkTransferSourceClassChange;
window.toggleAllBulkTransferCheckboxes = toggleAllBulkTransferCheckboxes;
window.updateBulkTransferSelectAllState = updateBulkTransferSelectAllState;
window.executeBulkTransfer = executeBulkTransfer;
window.downloadStudentTemplate = downloadStudentTemplate;
window.previewExcel = previewExcel;
window.onUploadSheetChange = onUploadSheetChange;
window.onManageClassChange = onManageClassChange;
window.ensureStudentsLoadedForClass = ensureStudentsLoadedForClass;
window.ensureStudentsLoadedByIds = ensureStudentsLoadedByIds;

// Event listeners for profile image uploads using event delegation
document.addEventListener('change', (e) => {
    if (e.target && e.target.id === 'profile-pic-upload') {
        previewImageForProfile(e, 'profile-pic-preview', null);
    }
    if (e.target && e.target.id && e.target.id.startsWith('sp-home-photo')) {
        const match = e.target.id.match(/^sp-home-photo(\d+)$/);
        if (match) {
            const idx = match[1];
            previewImageForProfile(e, `sp-home-preview${idx}`, `sp-home-remove${idx}`);
        }
    }
});

// ฟังก์ชันสำหรับตรวจฟอร์แมตข้อมูลส่วนตัวเรียลไทม์ (on change)
function validateProfileInputFormat(event) {
    const input = event.target;
    const val = input.value.trim();
    if (!val) {
        input.classList.remove('border-red-500', 'bg-red-50');
        return;
    }

    if (input.id === 'sp-citizenid') {
        const cleaned = val.replace(/\s+/g, '');
        if (!validateThaiCitizenId(cleaned)) {
            showToast('เลขประจำตัวประชาชน 13 หลัก ไม่ถูกต้อง', 'error');
            input.classList.add('border-red-500', 'bg-red-50');
            setTimeout(() => input.focus(), 50);
        } else {
            input.classList.remove('border-red-500', 'bg-red-50');
        }
    } else if (['sp-phone', 'sp-p-phone', 'sp-f-phone', 'sp-m-phone'].includes(input.id)) {
        if (!validatePhoneNumber(val)) {
            showToast('รูปแบบเบอร์โทรศัพท์ไม่ถูกต้อง (ต้องเป็นตัวเลข 9-10 หลัก)', 'error');
            input.classList.add('border-red-500', 'bg-red-50');
            setTimeout(() => input.focus(), 50);
        } else {
            input.classList.remove('border-red-500', 'bg-red-50');
        }
    }
}

// ผูกเหตุการณ์การเปลี่ยนแปลงข้อมูล (onchange) เพื่อความถูกต้องก่อนบันทึก
const idsToValidate = ['sp-citizenid', 'sp-phone', 'sp-p-phone', 'sp-f-phone', 'sp-m-phone'];
idsToValidate.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
        el.addEventListener('change', validateProfileInputFormat);
    }
});

// ==========================================
// Custom Searchable Dropdown for Student Class Filter
// ==========================================
window.toggleManageClassDropdown = function(e) {
    if (e) e.stopPropagation();
    const list = document.getElementById('manage-class-dropdown-list');
    if (list) {
        list.classList.toggle('hidden');
        if (!list.classList.contains('hidden')) {
            filterManageClassDropdown(''); // Show all on open
        }
    }
};

window.filterManageClassDropdown = function(query) {
    const list = document.getElementById('manage-class-dropdown-list');
    if (!list) return;
    list.classList.remove('hidden');
    
    const classList = [...new Set(AppState.allClasses.filter(c => c.deleted_flg !== 'Y').map(c => c.className))].filter(Boolean).sort((a, b) => a.localeCompare(b, 'th', { numeric: true }));
    const filtered = classList.filter(c => c.toLowerCase().includes(query.toLowerCase().trim()));
    
    if (filtered.length === 0) {
        list.innerHTML = `<div class="px-3 py-2 text-gray-400 italic">ไม่พบชั้นเรียน</div>`;
        return;
    }
    
    list.innerHTML = filtered.map(c => `
        <div class="px-3 py-2 hover:bg-green-50 hover:text-green-800 cursor-pointer transition-colors" onclick="selectManageClassOption('${c}')">${c}</div>
    `).join('');
};

window.selectManageClassOption = function(c) {
    const input = document.getElementById('manage-filter-class');
    if (input) {
        input.value = c;
    }
    const list = document.getElementById('manage-class-dropdown-list');
    if (list) {
        list.classList.add('hidden');
    }
    if (window.onManageClassChange) {
        window.onManageClassChange();
    }
};


export function startStudentQuizFromDetails() {
    const asmId = document.getElementById('stu-asm-assignment-id').value;
    const asm = AppState.allAssignments.find(a => String(a.id).trim() === String(asmId).trim());
    if (!asm) return;
    
    // Hide details modal, open quiz modal
    closeModal('student-assignment-modal');
    
    const stuId = String(AppState.currentUser.data.id).trim();
    const stuCode = AppState.currentUser.data.studentId ? String(AppState.currentUser.data.studentId).trim() : '';
    let rec = AppState.allStudentAssignments && AppState.allStudentAssignments.find(sa => 
        String(sa.assignmentId).trim() === String(asmId).trim() && 
        (String(sa.studentId).trim() === stuId || (stuCode && String(sa.studentId).trim() === stuCode)) && 
        sa.deleted_flg !== 'Y'
    );
    
    renderStudentQuiz(asm, rec, false);
    document.getElementById('student-quiz-modal').classList.add('show');
}

export function startStudentQuizReview() {
    const asmId = document.getElementById('stu-asm-assignment-id').value;
    const asm = AppState.allAssignments.find(a => String(a.id).trim() === String(asmId).trim());
    if (!asm) return;
    
    closeModal('student-assignment-modal');
    
    const stuId = String(AppState.currentUser.data.id).trim();
    const stuCode = AppState.currentUser.data.studentId ? String(AppState.currentUser.data.studentId).trim() : '';
    let rec = AppState.allStudentAssignments && AppState.allStudentAssignments.find(sa => 
        String(sa.assignmentId).trim() === String(asmId).trim() && 
        (String(sa.studentId).trim() === stuId || (stuCode && String(sa.studentId).trim() === stuCode)) && 
        sa.deleted_flg !== 'Y'
    );
    
    renderStudentQuiz(asm, rec, true);
    document.getElementById('student-quiz-modal').classList.add('show');
}

export function renderStudentQuiz(asm, rec, isReviewMode) {
    let questions = [];
    try {
        questions = typeof asm.quizQuestions === 'string' ? JSON.parse(asm.quizQuestions) : asm.quizQuestions;
    } catch(e) {}
    if (!Array.isArray(questions) || questions.length === 0) {
        customAlert('ไม่พบชุดคำถามในระบบ');
        return;
    }
    
    let answers = [];
    if (isReviewMode && rec && rec.quizAnswers) {
        try {
            answers = typeof rec.quizAnswers === 'string' ? JSON.parse(rec.quizAnswers) : rec.quizAnswers;
        } catch(e) {}
    }
    
    // Store metadata on modal container
    const modal = document.getElementById('student-quiz-modal');
    modal.dataset.asmId = asm.id;
    modal.dataset.isReview = isReviewMode ? 'true' : 'false';
    modal.dataset.qCount = questions.length;
    
    // Set title
    document.getElementById('student-quiz-title').innerHTML = isReviewMode 
        ? `<i class="fas fa-eye mr-2 text-indigo-600"></i>เฉลยคำตอบแบบทดสอบ`
        : `<i class="fas fa-pencil-alt mr-2 text-indigo-600"></i>ทำแบบทดสอบ: ${asm.title}`;
        
    // Generate questions HTML
    const content = document.getElementById('student-quiz-content');
    content.innerHTML = questions.map((q, qIdx) => {
        const studentAns = answers[qIdx];
        const isCorrect = studentAns === q.ans;
        
        let headerStatus = '';
        if (isReviewMode) {
            headerStatus = isCorrect 
                ? `<span class="ml-2 bg-green-100 text-green-800 text-[10px] px-2 py-0.5 rounded font-bold border border-green-200"><i class="fas fa-check mr-0.5"></i> ถูกต้อง</span>`
                : `<span class="ml-2 bg-red-100 text-red-800 text-[10px] px-2 py-0.5 rounded font-bold border border-red-200"><i class="fas fa-times mr-0.5"></i> ผิด</span>`;
        }
        
        const choicesHtml = q.choices.map((choice, cIdx) => {
            const thaiLetter = ['ก', 'ข', 'ค', 'ง', 'จ'][cIdx] || (cIdx + 1);
            let choiceClass = 'border-gray-200 hover:bg-indigo-50/50 cursor-pointer';
            let iconClass = 'far fa-circle text-gray-400';
            let checkedAttr = '';
            
            if (isReviewMode) {
                if (cIdx === q.ans) {
                    choiceClass = 'border-green-400 bg-green-50 text-green-900 font-semibold';
                    iconClass = 'fas fa-check-circle text-green-600';
                } else if (cIdx === studentAns) {
                    choiceClass = 'border-red-400 bg-red-50 text-red-900';
                    iconClass = 'fas fa-times-circle text-red-600';
                } else {
                    choiceClass = 'border-gray-200 opacity-60 pointer-events-none';
                }
            } else {
                // Interactive selection
                checkedAttr = `onclick="selectQuizChoice(${qIdx}, ${cIdx})"`;
            }
            
            return `
                <div ${checkedAttr} id="quiz-q${qIdx}-c${cIdx}" class="quiz-choice flex items-center gap-3 p-3.5 border rounded-xl transition-all duration-200 ${choiceClass}">
                    <i class="quiz-choice-icon ${iconClass} text-lg"></i>
                    <span class="text-xs font-bold text-gray-700">${thaiLetter}.</span>
                    <span class="text-sm text-gray-700">${choice}</span>
                </div>
            `;
        }).join('');
        
        let explanationHtml = '';
        if (isReviewMode && q.exp) {
            explanationHtml = `
                <div class="bg-indigo-50 border border-indigo-100 p-3.5 rounded-xl text-xs text-indigo-900 mt-3 flex items-start gap-2">
                    <i class="fas fa-info-circle mt-0.5 text-indigo-500"></i>
                    <div>
                        <span class="font-bold block mb-0.5 text-indigo-950">คำอธิบาย/เฉลย:</span>
                        ${q.exp}
                    </div>
                </div>
            `;
        }
        
        return `
            <div class="quiz-question-card bg-white p-5 rounded-2xl border border-gray-200 shadow-sm text-left" data-q-idx="${qIdx}" data-selected-choice="${isReviewMode ? studentAns : ''}">
                <div class="flex justify-between items-start mb-4 border-b border-gray-100 pb-3">
                    <span class="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg">คำถามข้อที่ ${qIdx + 1}</span>
                    ${headerStatus}
                </div>
                <h5 class="font-bold text-gray-800 text-base mb-4 leading-relaxed">${q.q}</h5>
                <div class="space-y-2.5">
                    ${choicesHtml}
                </div>
                ${explanationHtml}
            </div>
        `;
    }).join('');
    
    // Set footer actions dynamically
    const actions = document.getElementById('student-quiz-actions');
    if (actions) {
        if (isReviewMode) {
            actions.innerHTML = `
                <div class="w-full flex justify-between items-center gap-2">
                    <span id="student-quiz-progress-text" class="text-xs text-gray-500 font-bold">ทบทวนคำตอบ</span>
                    <button onclick="closeModal('student-quiz-modal')" class="px-4 py-2 sm:px-6 sm:py-2.5 text-xs sm:text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-md transition-all whitespace-nowrap">ปิดหน้าต่าง</button>
                </div>
            `;
        } else {
            actions.innerHTML = `
                <span id="student-quiz-progress-text" class="text-xs text-gray-500 font-bold">มีคำถามทั้งหมด ${questions.length} ข้อ</span>
                <div class="flex gap-3">
                    <button onclick="closeModal('student-quiz-modal')" class="px-5 py-2 border rounded-lg hover:bg-gray-100 font-bold text-gray-600 transition-colors">ยกเลิก</button>
                    <button id="student-quiz-submit-btn" onclick="submitStudentQuiz()" class="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-md transition-colors"><i class="fas fa-paper-plane mr-2"></i> ส่งคำตอบ</button>
                </div>
            `;
        }
    }
}

export function selectQuizChoice(qIdx, cIdx) {
    const card = document.querySelector(`.quiz-question-card[data-q-idx="${qIdx}"]`);
    if (!card) return;
    
    // Reset other choices in this card
    card.querySelectorAll('.quiz-choice').forEach(choice => {
        choice.className = 'quiz-choice flex items-center gap-3 p-3.5 border rounded-xl transition-all duration-200 border-gray-200 hover:bg-indigo-50/50 cursor-pointer';
        const icon = choice.querySelector('.quiz-choice-icon');
        if (icon) icon.className = 'quiz-choice-icon far fa-circle text-gray-400';
    });
    
    // Set active choice
    const activeChoice = document.getElementById(`quiz-q${qIdx}-c${cIdx}`);
    if (activeChoice) {
        activeChoice.className = 'quiz-choice flex items-center gap-3 p-3.5 border rounded-xl transition-all duration-200 border-indigo-500 bg-indigo-50 text-indigo-900 font-semibold cursor-pointer';
        const icon = activeChoice.querySelector('.quiz-choice-icon');
        if (icon) icon.className = 'quiz-choice-icon fas fa-check-circle text-indigo-600';
    }
    
    card.dataset.selectedChoice = cIdx;
}

export async function submitStudentQuiz() {
    const modal = document.getElementById('student-quiz-modal');
    const asmId = modal.dataset.asmId;
    const qCount = parseInt(modal.dataset.qCount);
    
    const asm = AppState.allAssignments.find(a => String(a.id).trim() === String(asmId).trim());
    if (!asm) return;
    
    const answers = [];
    let allAnswered = true;
    
    for (let i = 0; i < qCount; i++) {
        const card = document.querySelector(`.quiz-question-card[data-q-idx="${i}"]`);
        const sel = card ? card.dataset.selectedChoice : '';
        if (sel === '' || sel === undefined || sel === null) {
            allAnswered = false;
            break;
        }
        answers.push(parseInt(sel));
    }
    
    if (!allAnswered) {
        return customAlert('กรุณาตอบคำถามให้ครบทุกข้อก่อนส่งคำตอบ');
    }
    
    customConfirm('ยืนยันการส่งคำตอบ', 'คุณต้องการส่งคำตอบแบบทดสอบนี้ใช่หรือไม่? หลังจากส่งแล้วจะไม่สามารถกลับมาแก้ไขได้', async () => {
        showLoading('กำลังตรวจและบันทึกคะแนน...');
        try {
            let questions = [];
            try {
                questions = typeof asm.quizQuestions === 'string' ? JSON.parse(asm.quizQuestions) : asm.quizQuestions;
            } catch(e) {}
            
            // Calculate correct answers
            let correctCount = 0;
            questions.forEach((q, idx) => {
                if (answers[idx] === q.ans) correctCount++;
            });
            
            // Calculate score divided equally and rounded up
            const scorePerQ = parseFloat(asm.maxScore) / questions.length;
            const finalScore = Math.ceil(correctCount * scorePerQ);
            
            const stuId = String(AppState.currentUser.data.id).trim();
            const stuName = getStudentFullName(AppState.currentUser.data);
            const stuNum = AppState.currentUser.data.number;
            const stuClass = AppState.currentUser.data.class;
            
            const recordId = generateId();
            const payload = {
                id: recordId,
                assignmentId: asm.id,
                studentId: stuId,
                studentName: stuName,
                studentNumber: stuNum,
                studentClass: stuClass,
                status: 'ตรวจแล้ว', // Auto-graded quiz is marked as 'ตรวจแล้ว'
                submitMethod: 'ส่ง Online',
                submitDate: getBangkokDate(new Date()),
                submitTime: getBangkokCurrentTime().substring(0, 5),
                score: finalScore,
                quizAnswers: JSON.stringify(answers),
                deleted_flg: 'N',
                createdAt: getISOTimestamp()
            };
            
            if (AppState.googleSheetUrl) {
                try {
                    const response = await fetch(AppState.googleSheetUrl, {
                        method: 'POST',
                        redirect: 'follow',
                        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                        body: JSON.stringify({ action: 'submitAssignment', payload: payload })
                    });
                    const result = await response.json();
                } catch (errSheets) {
                    console.error("Google Sheets save skipped/failed, fallback to Firebase only:", errSheets);
                }
            }
            
            // Save locally
            if (!AppState.allStudentAssignments) AppState.allStudentAssignments = [];
            
            // Remove any existing record for this assignment & student (if any)
            AppState.allStudentAssignments = AppState.allStudentAssignments.filter(sa => 
                !(sa.assignmentId === asm.id && sa.studentId === stuId)
            );
            AppState.allStudentAssignments.push(payload);
            
            // Save to Firebase Realtime Database
            await saveToDB('STUDENT_ASSIGNMENTS', AppState.allStudentAssignments, 'saveStudentAssignments');
            
            // Render results inside student-quiz-modal instead of closing and alerting!
            const quizContent = document.getElementById('student-quiz-content');
            const quizActions = document.getElementById('student-quiz-actions');
            
            // Set header title
            document.getElementById('student-quiz-title').innerHTML = `<i class="fas fa-check-circle text-green-500 mr-2 animate-pulse"></i>ผลลัพธ์การส่งแบบทดสอบ`;
            
            // Render beautiful result card
            quizContent.innerHTML = `
                <div class="flex flex-col items-center text-center p-6 bg-gradient-to-br from-indigo-50/50 to-violet-50/50 rounded-3xl border border-indigo-100/70 shadow-inner max-w-md mx-auto my-4 animate-[fadeIn_0.5s_ease-out]">
                    <div class="w-20 h-20 bg-gradient-to-tr from-indigo-600 to-violet-600 rounded-full flex items-center justify-center text-white text-3xl mb-4 shadow-lg shadow-indigo-200 animate-bounce">
                        <i class="fas fa-trophy"></i>
                    </div>
                    
                    <h3 class="text-2xl font-black text-indigo-900 mb-1">ส่งคำตอบเรียบร้อย!</h3>
                    <p class="text-xs text-gray-500 mb-6">ระบบได้ตรวจข้อสอบแบบเรียลไทม์และบันทึกคะแนนให้เรียบร้อยแล้ว</p>
                    
                    <!-- Score Details -->
                    <div class="grid grid-cols-2 gap-4 w-full mb-6">
                        <div class="bg-white p-4 rounded-2xl border border-indigo-100 shadow-sm flex flex-col justify-center">
                            <span class="text-[10px] font-bold text-gray-400 block mb-1 uppercase tracking-wider">ตอบถูกทั้งหมด</span>
                            <span class="text-2xl font-black text-indigo-600">${correctCount} <span class="text-xs font-semibold text-gray-400">/ ${questions.length} ข้อ</span></span>
                        </div>
                        <div class="bg-white p-4 rounded-2xl border border-indigo-100 shadow-sm flex flex-col justify-center">
                            <span class="text-[10px] font-bold text-gray-400 block mb-1 uppercase tracking-wider">คะแนนสอบที่ได้</span>
                            <span class="text-2xl font-black text-emerald-600">${finalScore} <span class="text-xs font-semibold text-gray-400">/ ${asm.maxScore} คะแนน</span></span>
                        </div>
                    </div>
                    
                    <!-- Progress Bar -->
                    <div class="w-full bg-gray-200 h-2.5 rounded-full overflow-hidden mb-2">
                        <div class="bg-gradient-to-r from-indigo-500 to-violet-600 h-full rounded-full" style="width: ${(correctCount / questions.length) * 100}%"></div>
                    </div>
                    <span class="text-xs font-bold text-indigo-700">คิดเป็นความถูกต้อง ${Math.round((correctCount / questions.length) * 100)}%</span>
                </div>
            `;
            
            // Set beautiful footer buttons
            const reviewButtonHtml = asm.quizShowAnswer === 'true' 
                ? `<button onclick="renderStudentQuiz(AppState.allAssignments.find(a => String(a.id).trim() === '${asm.id}'), AppState.allStudentAssignments.find(sa => sa.assignmentId === '${asm.id}' && String(sa.studentId).trim() === '${stuId}'), true)" class="px-4 py-2 sm:px-6 sm:py-2.5 text-xs sm:text-sm bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap"><i class="fas fa-eye"></i>ดูเฉลยทันที</button>`
                : '';
                
            quizActions.innerHTML = `
                <div class="w-full flex justify-between items-center gap-2">
                    <span class="text-[10px] text-gray-400 font-medium"><i class="fas fa-info-circle mr-1"></i>ส่งเมื่อ: ${payload.submitDate} ${payload.submitTime} น.</span>
                    <div class="flex gap-2 shrink-0">
                        ${reviewButtonHtml}
                        <button onclick="closeModal('student-quiz-modal')" class="px-4 py-2 sm:px-6 sm:py-2.5 text-xs sm:text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-md transition-all whitespace-nowrap">ปิดหน้าต่าง</button>
                    </div>
                </div>
            `;
            
            hideLoading();
            
            // Refresh student assignment list
            renderStudentAssignments();
            
            // Auto refresh details view if open
            setTimeout(() => {
                const detModal = document.getElementById('student-assignment-modal');
                if (detModal && detModal.classList.contains('show')) {
                    openStudentAssignmentModal(asm.id);
                }
            }, 500);
        } catch (err) {
            console.error(err);
            hideLoading();
            customAlert(err.message || 'เกิดข้อผิดพลาดในการส่งคำตอบ โปรดลองใหม่อีกครั้ง');
        }
    });
}

export function filterStudentAssignmentBySubject(subId) {
    const subDropdown = document.getElementById('stu-asm-filter-sub');
    if (subDropdown) {
        subDropdown.value = subId || '';
        renderStudentAssignments();
    }
}

window.startStudentQuizFromDetails = startStudentQuizFromDetails;
window.startStudentQuizReview = startStudentQuizReview;
window.selectQuizChoice = selectQuizChoice;
window.submitStudentQuiz = submitStudentQuiz;
window.renderStudentQuiz = renderStudentQuiz;
window.filterStudentAssignmentBySubject = filterStudentAssignmentBySubject;

// Close dropdown when clicking outside
document.addEventListener('click', function(e) {
    const container = document.getElementById('manage-class-dropdown-container');
    if (container && !container.contains(e.target)) {
        const list = document.getElementById('manage-class-dropdown-list');
        if (list) list.classList.add('hidden');
    }
});