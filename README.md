# MAKHRAB — ระบบจัดการโรงเรียนออนไลน์

> **📌 AI Instruction:** ทุกครั้งที่ได้รับคำสั่งงานในโปรเจคนี้ ให้อ่านไฟล์นี้ก่อนเสมอ เพื่อทำความเข้าใจโครงสร้าง กฎ และ pattern ของโปรเจคก่อนลงมือแก้ไขโค้ด

---

## 🏫 ภาพรวมโปรเจค

**MAKHRAB** คือระบบจัดการข้อมูลโรงเรียนแบบ Single Page Application (SPA) สำหรับ **โรงเรียนไชยฉิมพลีวิทยาคม**  
ระบบใช้ **Google Sheets** เป็นฐานข้อมูล และ **Google Apps Script** เป็น Backend API  
Frontend เป็น HTML + Vanilla JS (ES Modules) + TailwindCSS

---

## 📁 โครงสร้างไฟล์

```
d:\Makrb\patsakornchamp.github.io\
├── index.html                  # UI หลักทั้งหมด (SPA) รวม Modal ทุกอัน
├── homevisit_report.html       # หน้าพิมพ์รายงานเยี่ยมบ้าน (แยกต่างหาก)
├── design.md                   # เอกสาร Design Guidelines และ Backend API Reference
├── README.md                   # ไฟล์นี้ — คู่มือสำหรับ AI
├── logopng.png / logopng2.png  # โลโก้โรงเรียน
└── js/
    ├── main.js                 # Entry point: initApp, switchTab, updateAllDropdowns
    ├── core/
    │   ├── config.js           # DB_KEYS (localStorage keys), DEFAULT_GOOGLE_SCRIPT_URL, DEPLOY_VERSION
    │   └── state.js            # AppState (Global state: allStudents, allRecords, currentUser ฯลฯ)
    ├── utils/
    │   └── helpers.js          # ฟังก์ชันช่วย: showToast, customAlert, customConfirm, generateId,
    │                           # validateThaiCitizenId, validatePhoneNumber, getStudentFullName,
    │                           # getBangkokDate, getDefaultAcademicYearAndSemester
    ├── services/
    │   └── api.js              # loadFromLocalStorage(), syncDataFromServer(), saveToDB()
    └── features/
        ├── auth.js             # ล็อกอิน/ออก, loginSuccess()
        ├── students.js         # จัดการนักเรียน: openStudentModal, editStudent, saveStudent,
        │                       # renderStudentProfile, saveMyProfile, renderManageStudents
        ├── checkin.js          # เช็คชื่อปกติ: loadCheckinList, saveAttendance, renderCheckinTable
        ├── club.js             # ชุมนุม: เช็คชื่อชุมนุม, ลงทะเบียนชุมนุม
        ├── history.js          # ประวัติเช็คชื่อ: searchHistory, renderHistory
        ├── stats.js            # สถิติเวลาเรียน: renderStats
        ├── master.js           # Master Data: วิชา, ครู, ชั้นเรียน, นักเรียน
        ├── homevisit.js        # ระบบเยี่ยมบ้าน: บันทึกฟอร์ม, GPS, รูปภาพ, พิมพ์รายงาน
        └── assignments.js      # การบ้าน/งาน: ครูสั่งงาน, นักเรียนดูงาน
```

---

## 🔑 Global State (AppState)

ตัวแปรกลางที่ใช้ทั่วทั้งระบบ อยู่ใน `js/core/state.js`

| Property | ประเภท | คำอธิบาย |
|---|---|---|
| `currentUser` | Object / null | ข้อมูลผู้ใช้ที่ login: `{ role: 'admin'/'teacher'/'student', data: {...} }` |
| `googleSheetUrl` | string | URL ของ Google Apps Script Web App |
| `allStudents` | Array | รายชื่อนักเรียนทั้งหมด |
| `allRecords` | Array | บันทึกการเช็คชื่อปกติ |
| `allSubjects` | Array | รายวิชาทั้งหมด |
| `allTeachers` | Array | รายชื่อครูทั้งหมด |
| `allClasses` | Array | ชั้นเรียนทั้งหมด |
| `allClubs` | Array | ชุมนุมทั้งหมด |
| `allClubEnrollments` | Array | การลงทะเบียนชุมนุม |
| `allClubRecords` | Array | บันทึกการเช็คชื่อชุมนุม |
| `allAssignments` | Array | รายการงาน/การบ้าน |
| `allStudentAssignments` | Array | การส่งงานของนักเรียน |

---

## 👤 ระบบผู้ใช้ (Roles)

| Role | สิทธิ์ |
|---|---|
| `admin` | เข้าถึงทุกแท็บ ทุกฟังก์ชัน รวมถึงการจัดการ Master Data |
| `teacher` | เช็คชื่อ, ดูสถิติ, จัดการนักเรียน, เยี่ยมบ้าน, จัดการการบ้าน |
| `student` | ดูโปรไฟล์ตัวเอง, ดูชุมนุม, ดูเกรด/งาน |

---

## 🗂️ โครงสร้างข้อมูลสำคัญ

### Student Object (ข้อมูลนักเรียน)
```js
{
  id: string,             // UUID
  studentId: string,      // รหัสประจำตัวนักเรียน (เช่น "12345")
  title: string,          // คำนำหน้า: 'เด็กชาย' | 'เด็กหญิง' | 'นาย' | 'นางสาว'
  firstName: string,
  lastName: string,
  nickname: string,
  class: string,          // ชื่อชั้นเรียน เช่น "ม.1/1"
  number: number,         // เลขที่
  citizenId: string,      // เลข ปชช. 13 หลัก
  dob: string,            // วันเกิด (YYYY-MM-DD)
  phone: string,
  email: string,
  address: string,
  profileImageUrl: string,// URL รูปโปรไฟล์ (Google Drive)
  status: string,         // 'ปกติ' | 'ลาออก'
  homeVisit: string,      // 'ยังไม่เยี่ยม' | 'สำเร็จ' | 'เลื่อนวันเข้าเยี่ยม' | ...
  isProfileComplete: string, // 'true' | 'false'
  
  // ข้อมูลผู้ปกครองหลัก
  parentTitle: string,    // 'นาย' | 'นาง' | 'นางสาว'
  parentFirstName: string,
  parentLastName: string,
  parentRelation: string, // 'บิดา' | 'มารดา' | 'ปู่/ย่า/ตา/ยาย' | ...
  parentPhone: string,
  
  // ข้อมูลบิดา
  fatherFirstName: string,
  fatherLastName: string,
  fatherAge: string,
  fatherJob: string,
  fatherPhone: string,
  
  // ข้อมูลมารดา
  motherFirstName: string,
  motherLastName: string,
  motherAge: string,
  motherJob: string,
  motherPhone: string,
  
  // ข้อมูลที่พัก (GPS + รูปภาพ)
  home_latitude: string,
  home_longitude: string,
  home_directions: string,
  home_photo_1_url: string,
  home_photo_2_url: string,
  home_photo_3_url: string,
  
  // Soft Delete
  deleted_flg: 'N' | 'Y',
  deletedAt: string | null,
  deletedBy: string | null,
  
  // Audit
  createdAt: string,
  createdBy: string,
  updatedAt: string,
  updatedBy: string,
}
```

### Attendance Record (บันทึกเช็คชื่อ)
```js
{
  id: string,
  date: string,         // YYYY-MM-DD
  year: string,         // ปีการศึกษา (พ.ศ.)
  semester: string,     // '1' | '2'
  period: string,       // 'โฮมรูม' | '1'-'8' | 'พักเที่ยง' | 'กิจกรรม'
  classId: string,
  subjectId: string,
  teacherId: string,
  attendance: [{ studentId: string, status: 'มา'|'สาย'|'ลา'|'ขาด' }],
  deleted_flg: 'N' | 'Y',
  ...audit fields
}
```

---

## ⚙️ LocalStorage Keys (DB_KEYS)

```js
'school_students'          // allStudents
'school_records'           // allRecords (เช็คชื่อปกติ)
'school_subjects'          // allSubjects
'school_teachers'          // allTeachers
'school_classes'           // allClasses
'school_google_sheet_url'  // URL ของ Apps Script
'school_active_session'    // session ผู้ใช้ที่ login อยู่
'school_clubs'             // allClubs
'school_club_enrollments'  // allClubEnrollments
'school_club_records'      // allClubRecords
'ASSIGNMENTS'              // allAssignments
'STUDENT_ASSIGNMENTS'      // allStudentAssignments
```

---

## 🎨 Design Guidelines (สรุป)

- **Font:** `'Sarabun', sans-serif` (ทุก element)
- **Theme:** Glassmorphism — backdrop-blur, white/opacity background, soft shadows
- **สีหลัก:** Green (`green-600` to `green-800`) สำหรับ header/nav/primary actions
- **ปุ่ม:** opacity 70%, rounded-xl, hover ยกตัว translateY(-2px)
- **Input/Select/Textarea:** class `.glass-input` หรือ `border rounded focus:ring-green-500`
- **Mobile:** ตารางแปลงเป็น Card View อัตโนมัติ (class `mobile-card-table`)
- **Modal:** class `glass-modal`, เปิดด้วย `.classList.add('show')`, ปิดด้วย `closeModal(id)`
- **Toast:** เรียก `showToast('ข้อความ')` — แสดงมุมขวาล่าง
- **Loading:** `showLoading('ข้อความ')` / `hideLoading()`
- **Alert/Confirm:** ใช้ `customAlert(msg)` และ `customConfirm(title, msg, callback)` แทน browser default

---

## 🔌 Backend API (Google Apps Script)

### Endpoint
URL เก็บอยู่ใน `AppState.googleSheetUrl` (ตั้งค่าได้ในหน้า Settings)  
Default URL: `https://script.google.com/macros/s/AKfycbz.../exec`

### GET (ดึงข้อมูลทั้งหมด)
```
GET {url}?action=getData&t={timestamp}
```
Response: `{ status: 'success', Students: [...], Records: [...], ... }`

### POST (บันทึกข้อมูล)
```js
fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'text/plain;charset=utf-8' },
  body: JSON.stringify({ action: 'actionName', data: [...] })
})
```

### POST Actions ที่มีอยู่

| action | คำอธิบาย |
|---|---|
| `saveStudents` | บันทึกนักเรียนทั้งหมด (เหมาชีท) |
| `saveRecords` | บันทึกประวัติเช็คชื่อทั้งหมด |
| `saveSubjects` | บันทึกรายวิชา |
| `saveTeachers` | บันทึกครูผู้สอน |
| `saveClasses` | บันทึกชั้นเรียน |
| `saveClubs` | บันทึกชุมนุม |
| `saveClubEnrollments` | บันทึกการลงทะเบียนชุมนุม |
| `saveClubRecords` | บันทึกเช็คชื่อชุมนุม |
| `saveStudentProfile` | บันทึกโปรไฟล์นักเรียนรายบุคคล พร้อมอัปโหลดรูปภาพขึ้น Google Drive |
| `getHomeVisitData` | ดึงข้อมูลเยี่ยมบ้าน |
| `saveHomeVisitData` | บันทึกข้อมูลเยี่ยมบ้าน พร้อมอัปโหลดรูปภาพ |

### Soft Delete Pattern
ทุก record ใช้ Soft Delete: ตั้ง `deleted_flg: 'Y'` แทนการลบจริง  
**ห้าม** ลบ record ออกจาก array โดยตรง  
เมื่อ query ข้อมูลให้ filter เสมอ: `.filter(x => x.deleted_flg !== 'Y')`

---

## 🧩 Pattern การเขียนโค้ด

### 1. การบันทึกข้อมูล
```js
// บันทึกลง LocalStorage + Google Sheets พร้อมกัน
await saveToDB(DB_KEYS.STUDENTS, AppState.allStudents, 'saveStudents');
```

### 2. การดึงข้อมูลสดจาก Server
```js
await syncDataFromServer(silent = false);
// silent=true = ไม่แสดง error toast
```

### 3. การ Export ฟังก์ชันออก window (ให้ HTML เรียกได้)
```js
// ทุกฟังก์ชันที่ถูกเรียกจาก HTML attribute เช่น onclick="xxx()"
// ต้องผูกกับ window ที่ท้ายไฟล์
window.functionName = functionName;
```

### 4. Dropdown ที่รองรับ Tom Select
```js
// ใช้ safeSetSelectHtml() แทนการ set innerHTML โดยตรง
// เพื่อรองรับกรณีที่ dropdown ถูกแปลงเป็น Tom Select แล้ว
window.safeSetSelectHtml(selectId, htmlString);
```

### 5. การ Generate ID
```js
import { generateId } from '../utils/helpers.js';
const id = generateId(); // UUID-like string
```

### 6. Timestamp
```js
import { getISOTimestamp, getCurrentUserId } from '../utils/helpers.js';
obj.updatedAt = getISOTimestamp();
obj.updatedBy = getCurrentUserId();
```

---

## 🏷️ HTML Modal Pattern

Modal ทุกอันใน `index.html` ใช้ pattern เดียวกัน:
```html
<div id="modal-name" class="modal-overlay glass-modal">
  <!-- เนื้อหา -->
</div>
```
- **เปิด:** `document.getElementById('modal-name').classList.add('show')`
- **ปิด:** `closeModal('modal-name')` (จาก helpers.js)

### Modal IDs สำคัญ

| Modal ID | ใช้สำหรับ |
|---|---|
| `student-modal` | เพิ่ม/แก้ไขนักเรียน (ครู/แอดมิน) |
| `csv-upload-modal` | อัปโหลด CSV นักเรียน |
| `home-visit-modal` | บันทึกเยี่ยมบ้าน |
| `subject-modal` | เพิ่ม/แก้ไขวิชา |
| `teacher-modal` | เพิ่ม/แก้ไขครู |
| `class-modal` | เพิ่ม/แก้ไขชั้นเรียน |
| `club-modal` | เพิ่ม/แก้ไขชุมนุม |

---

## 📋 Form Field IDs สำคัญ (Modal นักเรียน)

### Modal ครู/แอดมิน (`student-modal`)
| Field ID | ข้อมูล |
|---|---|
| `stu-id` | hidden — UUID ของนักเรียน |
| `stu-studentid` | รหัสประจำตัว |
| `stu-title` | คำนำหน้านักเรียน |
| `stu-fname` / `stu-lname` | ชื่อ-นามสกุล |
| `stu-class` / `stu-number` | ชั้นเรียน/เลขที่ |
| `stu-p-title` | คำนำหน้าผู้ปกครอง (นาย/นาง/นางสาว) |
| `stu-p-fname` / `stu-p-lname` | ชื่อ-นามสกุลผู้ปกครอง |
| `stu-p-rel` | ความสัมพันธ์ |
| `stu-p-phone` | เบอร์โทรผู้ปกครอง |
| `stu-f-fname` / `stu-f-lname` | ชื่อ-นามสกุลบิดา |
| `stu-m-fname` / `stu-m-lname` | ชื่อ-นามสกุลมารดา |

### หน้านักเรียนกรอกเอง (`student-self-form`)
| Field ID | ข้อมูล |
|---|---|
| `sp-p-title` | คำนำหน้าผู้ปกครอง (นาย/นาง/นางสาว) |
| `sp-p-fname` / `sp-p-lname` | ชื่อ-นามสกุลผู้ปกครอง |
| `sp-f-fname` / `sp-f-lname` | ชื่อ-นามสกุลบิดา |
| `sp-m-fname` / `sp-m-lname` | ชื่อ-นามสกุลมารดา |
| `sp-home-lat` / `sp-home-lng` | พิกัด GPS บ้าน |

---

## 🚫 กฎที่ต้องปฏิบัติเสมอ

1. **อย่าลบ record จริง** — ใช้ `deleted_flg: 'Y'` เสมอ
2. **อย่าแก้ไข `index.html` โดยไม่รู้ตำแหน่ง** — ไฟล์ใหญ่มาก (2300+ บรรทัด) ต้อง grep หา ID/section ก่อนเสมอ
3. **ฟังก์ชันที่เรียกจาก HTML** ต้องผูก `window.xxx = xxx` ที่ท้ายไฟล์ feature เสมอ
4. **ใช้ `safeSetSelectHtml()`** แทน `.innerHTML =` สำหรับ `<select>` element ทุกอัน
5. **ภาษาไทยในระบบ** — ตรวจสอบให้ถูกต้อง ระวัง encoding เมื่อใช้ grep
6. **ข้อมูลปีการศึกษา** เป็น พ.ศ. (เช่น 2567, 2568)
7. **อย่าเปลี่ยน `design.md`** เป็นแหล่ง reference ของ Backend API ที่สำคัญ

---

## 🔍 วิธีค้นหาโค้ดในโปรเจคนี้

เนื่องจาก `index.html` ใหญ่มาก ให้ใช้วิธีดังนี้:

```bash
# ค้นหา element ID ใน HTML
grep -n "id=\"stu-p-title\"" index.html

# ค้นหา function ใน JS
grep -rn "function openStudentModal" js/

# ค้นหา Modal ที่เกี่ยวกับนักเรียน
grep -n "student-modal" index.html
```

---

## 📝 การอัปเดต README นี้

เมื่อเพิ่มฟีเจอร์ใหม่ที่สำคัญ ให้อัปเดตส่วนที่เกี่ยวข้องใน README นี้ด้วย เช่น:
- Field ID ใหม่ใน Form
- Action ใหม่ใน Backend API
- Global State ใหม่
- Modal ใหม่
