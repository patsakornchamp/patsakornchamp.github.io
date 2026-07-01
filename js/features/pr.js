import { AppState } from '../core/state.js';
import { DB_KEYS } from '../core/config.js';
import { generateId, showToast, showLoading, hideLoading, customAlert, customConfirm, closeModal, getISOTimestamp, getCurrentUserId, getDirectImageUrl } from '../utils/helpers.js';
import { saveToDB } from '../services/api.js';

function escapeHTML(text) {
    if (!text) return '';
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function linkify(text) {
    if (!text) return '';
    
    // Replace http/https links
    let replacedText = text.replace(/(\b(https?|ftp):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/gim, 
        '<a href="$1" target="_blank" class="text-blue-600 hover:text-blue-800 underline break-all font-medium">$1</a>');
        
    // Replace www links (that don't have http/https prefix)
    replacedText = replacedText.replace(/(^|[^\/])(www\.[\S]+(\b|$))/gim, 
        '$1<a href="http://$2" target="_blank" class="text-blue-600 hover:text-blue-800 underline break-all font-medium">$2</a>');
        
    return replacedText;
}

export function renderPRNewsData() {
    const searchQuery = (document.getElementById('search-pr-news') ? document.getElementById('search-pr-news').value.toLowerCase().trim() : '');
    const tbody = document.getElementById('tbody-pr-news');
    if (!tbody) return;

    let filteredPR = (AppState.allPrNews || []).filter(pr => pr.deleted_flg !== 'Y');
    if (searchQuery) {
        filteredPR = filteredPR.filter(pr => (pr.activity_name || '').toLowerCase().includes(searchQuery) || (pr.details || '').toLowerCase().includes(searchQuery));
    }

    // Sort by start_date descending (newest first)
    filteredPR.sort((a, b) => (b.start_date || '').localeCompare(a.start_date || ''));

    tbody.innerHTML = filteredPR.map(pr => {
        const isActive = pr.status_active === 'true' || pr.status_active === true || pr.status_active === 'Y';
        const statusBadge = isActive 
            ? `<span class="px-2 py-1 bg-green-100 text-green-800 text-xs font-bold rounded-full">แสดงผล (Active)</span>`
            : `<span class="px-2 py-1 bg-gray-100 text-gray-800 text-xs font-bold rounded-full">ปิดกั้น (Inactive)</span>`;
            
        const imgHtml = pr.image_url 
            ? `<img src="${getDirectImageUrl(pr.image_url)}" class="w-12 h-12 object-cover rounded border cursor-pointer hover:scale-105 transition-transform" onclick="window.viewLargeImage('${getDirectImageUrl(pr.image_url)}')">` 
            : `<span class="text-xs text-gray-400">ไม่มีรูป</span>`;

        const startStr = pr.start_date ? (pr.start_date instanceof Date ? pr.start_date.toISOString() : String(pr.start_date)) : '';
        const startDate = startStr ? startStr.split('T')[0] : '-';

        const endStr = pr.end_date ? (pr.end_date instanceof Date ? pr.end_date.toISOString() : String(pr.end_date)) : '';
        const endDate = endStr ? endStr.split('T')[0] : '-';

        return `
            <tr>
                <td class="px-4 py-2 whitespace-nowrap text-sm">${imgHtml}</td>
                <td class="px-4 py-2">
                    <div class="text-sm font-bold text-gray-800">${pr.activity_name || 'ไม่ระบุชื่อกิจกรรม'}</div>
                    <div class="text-xs text-gray-500 line-clamp-2 max-w-md mt-0.5">${pr.details || ''}</div>
                    ${pr.note ? `<div class="text-[10px] text-gray-400 mt-0.5">📌 หมายเหตุ: ${pr.note}</div>` : ''}
                </td>
                <td class="hidden md:table-cell px-4 py-2 whitespace-nowrap text-xs text-gray-600">${startDate} ถึง ${endDate}</td>
                <td class="px-4 py-2 whitespace-nowrap text-center text-sm">${statusBadge}</td>
                <td class="px-4 py-2 whitespace-nowrap text-center text-sm">
                    <button onclick="editPRNewsItem('${pr.id}')" class="text-blue-500 hover:text-blue-700 mr-3"><i class="fas fa-edit"></i></button>
                    <button onclick="deletePRNewsItem('${pr.id}')" class="text-red-500 hover:text-red-700"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `;
    }).join('');
}

export function openPRNewsModal() {
    document.getElementById('pr-id').value = '';
    document.getElementById('pr-activity-name').value = '';
    document.getElementById('pr-details').value = '';
    document.getElementById('pr-start-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('pr-end-date').value = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // +7 days
    document.getElementById('pr-image-file').value = '';
    document.getElementById('pr-image-url').value = '';
    document.getElementById('pr-status-active').value = 'true';
    document.getElementById('pr-note').value = '';
    
    clearPRImagePreview();
    document.getElementById('pr-news-modal').classList.add('show');
}

export function previewPRImage(event) {
    const file = event.target.files[0];
    const preview = document.getElementById('pr-image-preview');
    const container = document.getElementById('pr-image-preview-container');
    if (file) {
        preview.src = URL.createObjectURL(file);
        container.classList.remove('hidden');
    } else {
        clearPRImagePreview();
    }
}

export function clearPRImagePreview() {
    const preview = document.getElementById('pr-image-preview');
    const container = document.getElementById('pr-image-preview-container');
    const fileInput = document.getElementById('pr-image-file');
    if (fileInput) fileInput.value = '';
    if (preview) {
        if (preview.src && preview.src.startsWith('blob:')) {
            URL.revokeObjectURL(preview.src);
        }
        preview.src = '';
    }
    if (container) container.classList.add('hidden');
}

export function editPRNewsItem(id) {
    const pr = (AppState.allPrNews || []).find(x => String(x.id) === String(id) && x.deleted_flg !== 'Y');
    if (!pr) return;

    document.getElementById('pr-id').value = pr.id;
    document.getElementById('pr-activity-name').value = pr.activity_name || '';
    document.getElementById('pr-details').value = pr.details || '';
    const startStr = pr.start_date ? (pr.start_date instanceof Date ? pr.start_date.toISOString() : String(pr.start_date)) : '';
    document.getElementById('pr-start-date').value = startStr ? startStr.split('T')[0] : '';

    const endStr = pr.end_date ? (pr.end_date instanceof Date ? pr.end_date.toISOString() : String(pr.end_date)) : '';
    document.getElementById('pr-end-date').value = endStr ? endStr.split('T')[0] : '';
    document.getElementById('pr-image-file').value = '';
    document.getElementById('pr-image-url').value = pr.image_url || '';
    document.getElementById('pr-status-active').value = String(pr.status_active);
    document.getElementById('pr-note').value = pr.note || '';

    const container = document.getElementById('pr-image-preview-container');
    const preview = document.getElementById('pr-image-preview');
    if (pr.image_url && preview && container) {
        preview.src = getDirectImageUrl(pr.image_url);
        container.classList.remove('hidden');
    } else {
        clearPRImagePreview();
    }

    document.getElementById('pr-news-modal').classList.add('show');
}

async function compressPRImage(file, maxSize = 1024, quality = 0.75) {
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
                resolve(canvas.toDataURL('image/jpeg', quality).split(',')[1]);
            };
            img.onerror = error => reject(error);
        };
        reader.onerror = error => reject(error);
    });
}

export async function savePRNewsItem() {
    const id = document.getElementById('pr-id').value || generateId();
    const activityName = document.getElementById('pr-activity-name').value.trim();
    const details = document.getElementById('pr-details').value.trim();
    const startDate = document.getElementById('pr-start-date').value;
    const endDate = document.getElementById('pr-end-date').value;
    let imageUrl = document.getElementById('pr-image-url').value.trim();
    const statusActive = document.getElementById('pr-status-active').value === 'true';
    const note = document.getElementById('pr-note').value.trim();

    if (!activityName || !startDate || !endDate) {
        return customAlert('กรุณากรอกชื่อกิจกรรม วันเริ่มต้นแสดงผล และวันสิ้นสุดแสดงผล ให้ครบถ้วน');
    }

    const fileInput = document.getElementById('pr-image-file');
    const file = fileInput ? fileInput.files[0] : null;

    showLoading('กำลังบันทึกข้อมูลประชาสัมพันธ์...');

    try {
        const payload = {
            id: id,
            activity_name: activityName,
            details: details,
            start_date: startDate,
            end_date: endDate,
            image_url: imageUrl,
            status_active: statusActive,
            note: note,
            updatedBy: getCurrentUserId()
        };

        const existingItem = (AppState.allPrNews || []).find(x => x.id === id);
        if (existingItem) {
            payload.createdAt = existingItem.createdAt;
            payload.createdBy = existingItem.createdBy;
            payload.deleted_flg = existingItem.deleted_flg || 'N';
        } else {
            payload.createdAt = getISOTimestamp();
            payload.createdBy = getCurrentUserId();
            payload.deleted_flg = 'N';
        }

        if (file) {
            payload.image_base64 = await compressPRImage(file);
            payload.image_mime = 'image/jpeg';
            payload.image_name = file.name;
        }

        const response = await fetch(AppState.googleSheetUrl, {
            method: 'POST',
            redirect: 'follow',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'savePRItem', payload: payload })
        });
        const result = await response.json();

        if (result.success && result.data) {
            const savedItem = result.data;
            if (!AppState.allPrNews) AppState.allPrNews = [];
            
            const idx = AppState.allPrNews.findIndex(x => String(x.id) === String(id));
            if (idx > -1) {
                AppState.allPrNews[idx] = savedItem;
            } else {
                AppState.allPrNews.push(savedItem);
            }

            // Sync to local cache
            localStorage.setItem(DB_KEYS.PR_NEWS, JSON.stringify(AppState.allPrNews));
            closeModal('pr-news-modal');
            renderPRNewsData();
            showToast('บันทึกข่าวประชาสัมพันธ์สำเร็จ');
        } else {
            customAlert('เกิดข้อผิดพลาด: ' + (result.message || 'ไม่สามารถบันทึกข้อมูลได้'));
        }
    } catch(e) {
        console.error(e);
        customAlert('การบันทึกล้มเหลว: ' + e.toString());
    } finally {
        hideLoading();
    }
}

export function deletePRNewsItem(id) {
    customConfirm('ยืนยันการลบข่าวประชาสัมพันธ์', 'คุณต้องการลบข่าวประชาสัมพันธ์นี้ใช่หรือไม่?', async () => {
        const itemIdx = (AppState.allPrNews || []).findIndex(x => String(x.id) === String(id));
        if (itemIdx > -1) {
            AppState.allPrNews[itemIdx].deleted_flg = 'Y';
            AppState.allPrNews[itemIdx].deletedAt = getISOTimestamp();
            AppState.allPrNews[itemIdx].deletedBy = getCurrentUserId();
            
            await saveToDB(DB_KEYS.PR_NEWS, AppState.allPrNews, 'savePRNews');
            renderPRNewsData();
            showToast('ลบข่าวประชาสัมพันธ์เรียบร้อยแล้ว');
        }
    });
}

let prAutoplayTimer = null;

export function startPRAutoplay() {
    stopPRAutoplay();
    if (window.totalPRSlidesCount > 1) {
        prAutoplayTimer = setInterval(() => {
            changePRSlide(1);
        }, 5000);
    }
}

export function stopPRAutoplay() {
    if (prAutoplayTimer) {
        clearInterval(prAutoplayTimer);
        prAutoplayTimer = null;
    }
}

window.startPRAutoplay = startPRAutoplay;
window.stopPRAutoplay = stopPRAutoplay;

export function showPRAnnouncementIfActive() {
    console.log("Checking active PRs...", AppState.allPrNews);
    
    // Helper to normalize start/end dates from database to YYYY-MM-DD local Bangkok format
    function getBkkDateString(dateInput) {
        if (!dateInput) return '';
        let str = String(dateInput).trim();
        if (!str) return '';
        
        // Handle DD/MM/YYYY or DD/MM/BE format
        if (str.includes('/')) {
            const parts = str.split('/');
            if (parts.length === 3) {
                let day = parts[0].padStart(2, '0');
                let month = parts[1].padStart(2, '0');
                let year = parseInt(parts[2]);
                if (year > 2400) year -= 543; // BE to CE
                return `${year}-${month}-${day}`;
            }
        }
        
        // Parse with local Bangkok time zone
        try {
            const d = new Date(str);
            if (!isNaN(d.getTime())) {
                return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
            }
        } catch(e) {}
        
        return str.split('T')[0];
    }

    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    
    const activePRs = (AppState.allPrNews || []).filter(pr => {
        if (pr.deleted_flg === 'Y') return false;
        
        const activeStr = String(pr.status_active).toLowerCase().trim();
        const isActive = activeStr === 'true' || activeStr === 'y' || activeStr === 'yes' || activeStr === '1' || pr.status_active === true;
        if (!isActive) return false;
        
        const start = getBkkDateString(pr.start_date);
        const end = getBkkDateString(pr.end_date);
        
        console.log(`PR: ${pr.activity_name}, active: ${isActive}, range: ${start} to ${end}, today: ${today}`);
        
        if (start && today < start) return false;
        if (end && today > end) return false;
        return true;
    });
    
    if (activePRs.length > 0) {
        const prModal = document.getElementById('pr-announcement-modal');
        if (prModal) {
            const container = prModal.querySelector('.relative');
            if (container) {
                let slidesHtml = '';
                activePRs.forEach((pr, idx) => {
                    const hasTitle = pr.activity_name && pr.activity_name.trim();
                    const hasDetails = pr.details && pr.details.trim();
                    const imageUrl = pr.image_url ? getDirectImageUrl(pr.image_url) : 'image/a1.jpg';
                    
                    let infoBoxHtml = '';
                    if (hasTitle || hasDetails) {
                        const title = pr.activity_name ? escapeHTML(pr.activity_name.trim()) : 'ประชาสัมพันธ์';
                        const detailsHtml = hasDetails ? `<p class="text-[11px] text-gray-600 leading-relaxed whitespace-pre-wrap">${linkify(escapeHTML(pr.details.trim()))}</p>` : '';
                        infoBoxHtml = `
                            <div class="bg-white/85 backdrop-blur-md p-4 rounded-xl mb-4 text-left border border-white/35 shadow-sm max-h-[20vh] overflow-y-auto">
                                <h4 class="font-bold text-sm text-green-800 mb-1">${title}</h4>
                                ${detailsHtml}
                            </div>
                        `;
                    }
                    
                    slidesHtml += `
                        <div class="pr-slide ${idx === 0 ? 'block' : 'hidden'} w-full" data-slide-index="${idx}">
                            <div class="w-full rounded-2xl overflow-hidden shadow-2xl border border-white/20 mb-4 bg-white/10 backdrop-blur-md">
                                <img src="${imageUrl}" alt="PR Image" class="w-full max-h-[60vh] object-contain mx-auto">
                            </div>
                            ${infoBoxHtml}
                        </div>
                    `;
                });
                
                let navHtml = '';
                if (activePRs.length > 1) {
                    navHtml = `
                        <div class="flex justify-between items-center w-full px-2 mb-4">
                            <button type="button" onclick="changePRSlide(-1, true)" class="bg-white/90 hover:bg-white text-gray-800 px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-sm"><i class="fas fa-chevron-left mr-1"></i> ก่อนหน้า</button>
                            <span class="text-xs font-bold text-white bg-black/40 px-2 py-1 rounded-full"><span id="pr-current-slide-num">1</span>/${activePRs.length}</span>
                            <button type="button" onclick="changePRSlide(1, true)" class="bg-white/90 hover:bg-white text-gray-800 px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-sm">ถัดไป <i class="fas fa-chevron-right mr-1"></i></button>
                        </div>
                    `;
                }
                
                container.innerHTML = `
                    <button onclick="closeModal('pr-announcement-modal')" class="absolute -top-12 right-0 bg-white/90 hover:bg-white text-gray-800 w-10 h-10 rounded-full flex items-center justify-center transition shadow-md border border-gray-200/50 focus:outline-none z-50">
                        <i class="fas fa-times text-lg"></i>
                    </button>
                    <div class="w-full pr-slides-container cursor-pointer select-none" 
                         onmousedown="stopPRAutoplay()" 
                         onmouseup="startPRAutoplay()" 
                         onmouseleave="startPRAutoplay()" 
                         ontouchstart="stopPRAutoplay()" 
                         ontouchend="startPRAutoplay()">
                        ${slidesHtml}
                    </div>
                    ${navHtml}
                    <button onclick="closeModal('pr-announcement-modal')" class="px-8 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold rounded-xl shadow-md hover:shadow-lg w-full transition-all">
                        ปิดหน้าต่าง
                    </button>
                `;
                
                window.currentPRSlideIdx = 0;
                window.totalPRSlidesCount = activePRs.length;
            }
            prModal.classList.add('show');
            startPRAutoplay();
        }
    }
}

export function changePRSlide(direction, isManual = false) {
    if (typeof window.currentPRSlideIdx === 'undefined' || !window.totalPRSlidesCount) return;
    
    const slides = document.querySelectorAll('.pr-slide');
    if (!slides.length) return;
    
    slides[window.currentPRSlideIdx].classList.remove('block');
    slides[window.currentPRSlideIdx].classList.add('hidden');
    
    window.currentPRSlideIdx = (window.currentPRSlideIdx + direction + window.totalPRSlidesCount) % window.totalPRSlidesCount;
    
    slides[window.currentPRSlideIdx].classList.remove('hidden');
    slides[window.currentPRSlideIdx].classList.add('block');
    
    const numEl = document.getElementById('pr-current-slide-num');
    if (numEl) numEl.innerText = window.currentPRSlideIdx + 1;

    if (isManual) {
        startPRAutoplay();
    }
}

// Bind to window
window.renderPRNewsData = renderPRNewsData;
window.openPRNewsModal = openPRNewsModal;
window.previewPRImage = previewPRImage;
window.clearPRImagePreview = clearPRImagePreview;
window.editPRNewsItem = editPRNewsItem;
window.savePRNewsItem = savePRNewsItem;
window.deletePRNewsItem = deletePRNewsItem;
window.showPRAnnouncementIfActive = showPRAnnouncementIfActive;
window.changePRSlide = changePRSlide;
