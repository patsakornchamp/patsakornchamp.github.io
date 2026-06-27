// ==========================================
// MAKHRAB - Google Apps Script Backend (Unified Version)
// ==========================================

// 📁 ID โฟลเดอร์ Google Drive สำหรับเก็บไฟล์ต่างๆ
const DRIVE_FOLDER_STUDENT_PROFILES = "1c3wsOu1qQZD5f-jjeKs1egBMb-2A7kbP";  // รูปโปรไฟล์/รูปบ้านนักเรียน
const DRIVE_FOLDER_HOME_VISIT = "1Wz_XR7S26B_3qukVISIg4X8weOaWMCx8";        // รูปการเยี่ยมบ้าน
const DRIVE_FOLDER_ASSIGNMENTS = "1U0-PV-CmR_XrvP12DNNAsxoVVAyTJXux";       // งานครู/สื่อการสอน
const DRIVE_FOLDER_SUBMISSIONS = "1F0w-Hy401CaqZ5YUYDUWMDi_kqnRGM9C";       // งานนักเรียนที่ส่งมา
const DRIVE_FOLDER_PR_NEWS = "1rL8XvuqeCaV2mxcFjBDq7v4ayo-vu33g";           // รูปประชาสัมพันธ์


// ==========================================
// 1. Core API (doGet & doPost)
// ==========================================

function doGet(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const action = (e.parameter && e.parameter.action) ? e.parameter.action : 'getData';
  
  // ตรวจสอบและสร้างชีตใหม่หากยังไม่มี
  const requiredSheets = ['Assignments', 'StudentAssignments', 'Home_Visits', 'Settings'];
  requiredSheets.forEach(sheetName => {
    if (!ss.getSheetByName(sheetName)) ss.insertSheet(sheetName);
  });
  if (!ss.getSheetByName('Home_Visit_Members')) {
    ss.insertSheet('Home_Visit_Members').appendRow(['id', 'visit_id', 'title', 'first_name', 'last_name', 'age', 'occupation', 'relationship', 'phone', 'note']);
  }
  if (!ss.getSheetByName('PR_News')) {
    ss.insertSheet('PR_News').appendRow(['id', 'activity_name', 'details', 'start_date', 'end_date', 'image_url', 'status_active', 'note', 'deleted_flg', 'createdAt', 'createdBy', 'updatedAt', 'updatedBy', 'deletedAt', 'deletedBy']);
  }
  if (!ss.getSheetByName('StudentCheckIns')) {
    ss.insertSheet('StudentCheckIns').appendRow(['id', 'studentId', 'classId', 'subjectId', 'teacherId', 'latitude', 'longitude', 'scanTime', 'status']);
  }
  if (ss.getSheetByName('Settings').getLastRow() === 0) {
    ss.getSheetByName('Settings').appendRow(['schoolName', 'systemName', 'schoolAddress', 'latitude', 'longitude', 'logoUrl']);
  }

  if (action === 'getData') {
    const result = {
      status: 'success',
      Students: getSheetData(ss, 'Students'),
      Records: getSheetData(ss, 'Records'),
      Subjects: getSheetData(ss, 'Subjects'),
      Teachers: getSheetData(ss, 'Teachers'),
      Classes: getSheetData(ss, 'Classes'),
      Clubs: getSheetData(ss, 'Clubs'),
      ClubEnrollments: getSheetData(ss, 'ClubEnrollments'),
      ClubRecords: getSheetData(ss, 'ClubRecords'),
      Assignments: getSheetData(ss, 'Assignments'),
      StudentAssignments: getSheetData(ss, 'StudentAssignments'),
      PRNews: getSheetData(ss, 'PR_News'),
      StudentCheckIns: getSheetData(ss, 'StudentCheckIns'),
      Settings: getSheetData(ss, 'Settings')
    };
    return successResponse(result);
  }
  
  return errorResponse('Invalid action');
}

function doPost(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const postData = JSON.parse(e.postData.contents);
    const action = postData.action;
    const data = postData.data;
    const payload = postData.payload;

    // 🌟 1. ดึงข้อมูลแบบเจาะจง (Get Data via POST)
    if (action === 'getHomeVisitData') {
      return successResponse(getHomeVisitData(postData));
    }
    
    // 🌟 2. บันทึกข้อมูลที่ต้องการ Logic เฉพาะตัว (Custom Saves)
    if (action === 'saveStudentProfile') {
      return wrapResponse(saveStudentProfile(payload));
    } 
    if (action === 'saveHomeVisitData') {
      return wrapResponse(saveHomeVisitData(payload));
    }
    if (action === 'savePRItem') {
      return wrapResponse(savePRItem(payload));
    }
    if (action === 'createAssignmentWithFiles') {
      return wrapResponse(createAssignmentWithFiles(ss, payload));
    }
    if (action === 'submitStudentAssignment') {
      return wrapResponse(submitStudentAssignment(ss, payload));
    }
    if (action === 'archiveActiveDatabase') {
      return wrapResponse(archiveActiveDatabase(payload));
    }
    if (action === 'resetTransactionData') {
      return wrapResponse(resetTransactionData(payload));
    }
    if (action === 'studentSelfCheckin') {
      return wrapResponse(studentSelfCheckin(payload));
    }
    if (action === 'updateStudentCheckInsStatus') {
      return wrapResponse(updateStudentCheckInsStatus(payload));
    }
    if (action === 'getStudentCheckIns') {
      return successResponse({ StudentCheckIns: getSheetData(ss, 'StudentCheckIns') });
    }

    // 🌟 3. บันทึกข้อมูลทั้งตาราง (Bulk Save)
    if (action === 'saveStudents') {
      saveStudentsData(ss, data);
      return successResponse({ action: action });
    }
    
    const bulkSaveActions = {
      'saveRecords': 'Records',
      'saveSubjects': 'Subjects',
      'saveTeachers': 'Teachers',
      'saveClasses': 'Classes',
      'saveClubs': 'Clubs',
      'saveClubEnrollments': 'ClubEnrollments',
      'saveClubRecords': 'ClubRecords',
      'saveAssignments': 'Assignments',
      'saveStudentAssignments': 'StudentAssignments',
      'savePRNews': 'PR_News'
    };

    if (bulkSaveActions[action]) {
      saveSheetData(ss, bulkSaveActions[action], data);
      return successResponse({ action: action });
    }

    // 🌟 4. ระบบ Sync All
    if (action === 'syncAll') {
      if (postData.students) saveStudentsData(ss, postData.students);
      if (postData.records) saveSheetData(ss, 'Records', postData.records);
      if (postData.subjects) saveSheetData(ss, 'Subjects', postData.subjects);
      if (postData.teachers) saveSheetData(ss, 'Teachers', postData.teachers);
      if (postData.classes) saveSheetData(ss, 'Classes', postData.classes);
      if (postData.clubs) saveSheetData(ss, 'Clubs', postData.clubs);
      if (postData.clubEnrollments) saveSheetData(ss, 'ClubEnrollments', postData.clubEnrollments);
      if (postData.clubRecords) saveSheetData(ss, 'ClubRecords', postData.clubRecords);
      return successResponse({ action: 'syncAll' });
    }
    
    return errorResponse("Action not found: " + action);
  } catch (error) {
    return errorResponse(error.toString());
  }
}

// ==========================================
// 2. Feature: Assignments & Files
// ==========================================

function submitStudentAssignment(ss, payload) {
  var files = [];
  if (payload.files) {
    var rawFiles = JSON.parse(payload.files);
    
    var folder;
    try {
      folder = DriveApp.getFolderById(DRIVE_FOLDER_SUBMISSIONS);
    } catch(e) {
      var folders = DriveApp.getFoldersByName("MAKHRAB_Student_Submissions");
      if (folders.hasNext()) {
        folder = folders.next();
      } else {
        folder = DriveApp.createFolder("MAKHRAB_Student_Submissions");
      }
    }
    
    for (var i = 0; i < rawFiles.length; i++) {
      var fileObj = rawFiles[i];
      if (fileObj.base64) {
        var decoded = Utilities.base64Decode(fileObj.base64);
        var blob = Utilities.newBlob(decoded, fileObj.mimeType || 'application/octet-stream', fileObj.name);
        var driveFile = folder.createFile(blob);
        driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        files.push({ n: fileObj.name, u: driveFile.getUrl() });
      } else if (fileObj.u || fileObj.url) {
        files.push({ n: fileObj.n || fileObj.name, u: fileObj.u || fileObj.url });
      }
    }
  }
  
  payload.files = JSON.stringify(files);
  
  var data = getSheetData(ss, "StudentAssignments");
  var existIdx = -1;
  for (var i = 0; i < data.length; i++) {
    if (String(data[i].id) === String(payload.id)) {
      existIdx = i;
      break;
    }
  }
  
  if (existIdx > -1) {
    data[existIdx] = payload;
  } else {
    data.push(payload);
  }
  
  saveSheetData(ss, "StudentAssignments", data);
  return {
    success: true,
    message: "บันทึกการส่งงานและอัปโหลดไฟล์เรียบร้อยแล้ว",
    data: payload
  };
}

function createAssignmentWithFiles(ss, payload) {
  try {
    const uploadedFiles = [];
    if (payload.files) {
      const parsedFiles = JSON.parse(payload.files);
      for (let i = 0; i < parsedFiles.length; i++) {
        const file = parsedFiles[i];
        if (file.base64) {
          const url = uploadImageToDrive(file.base64, `[Asm]_${payload.id}_${file.name}`, file.mimeType, DRIVE_FOLDER_ASSIGNMENTS);
          uploadedFiles.push({ n: file.name, u: url });
        }
      }
    }
    
    payload.files = JSON.stringify(uploadedFiles);
    
    const sheetName = 'Assignments';
    let dataArray = getSheetData(ss, sheetName);
    const existingIndex = dataArray.findIndex(r => r.id === payload.id);
    
    if (existingIndex > -1) {
      dataArray[existingIndex] = payload;
    } else {
      dataArray.push(payload);
    }
    
    saveSheetData(ss, sheetName, dataArray);
    return { success: true, data: payload, message: 'อัปโหลดงานสำเร็จ' };
  } catch(e) {
    return { success: false, message: "Upload File Failed: " + e.message };
  }
}

// ==========================================
// 3. Feature: Student Profiles & Home Visits
// ==========================================

function saveStudentsData(ss, studentsArray) {
  if (!studentsArray || studentsArray.length === 0) return;

  studentsArray.forEach(function(student) {
    if (student.profileImage_base64) {
      try {
        var url = uploadImageToDrive(student.profileImage_base64, student.profileImage_name, student.profileImage_mime, DRIVE_FOLDER_STUDENT_PROFILES);
        student.profileImageUrl = url;
      } catch (e) {
        Logger.log('Profile image upload failed for student ' + student.id + ': ' + e.toString());
      }
      delete student.profileImage_base64;
      delete student.profileImage_name;
      delete student.profileImage_mime;
    }
    
    for (let i = 1; i <= 3; i++) {
      const b64Key  = 'home_photo_' + i + '_base64';
      const nameKey = 'home_photo_' + i + '_name';
      const mimeKey = 'home_photo_' + i + '_mime';
      const urlKey  = 'home_photo_' + i + '_url';
      if (student[b64Key]) {
        try {
          var url = uploadImageToDrive(student[b64Key], student[nameKey], student[mimeKey], DRIVE_FOLDER_STUDENT_PROFILES);
          student[urlKey] = url;
        } catch (e) {
          Logger.log('Home photo ' + i + ' upload failed: ' + e.toString());
        }
        delete student[b64Key];
        delete student[nameKey];
        delete student[mimeKey];
      }
    }
  });

  saveSheetData(ss, 'Students', studentsArray);
}

// 🔧 แก้ไขแล้ว: saveStudentProfile — บันทึกโปรไฟล์นักเรียนรายบุคคล
function saveStudentProfile(payload) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Students');
    if (!sheet) return { success: false, message: 'ไม่พบตาราง Students' };
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(String); // แปลง headers ทั้งหมดเป็น String
    let rowIndex = -1;
    
    // 🔧 แก้ Bug #1: เปรียบเทียบ ID ด้วย String เสมอ ป้องกันกรณี Sheets อ่านเป็น Number
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === String(payload.id).trim()) {
        rowIndex = i + 1; // 1-indexed สำหรับ sheet.getRange()
        break;
      }
    }
    
    if (rowIndex === -1) {
      return { success: false, message: 'ไม่พบรหัสนักเรียนในฐานข้อมูล (ID: ' + payload.id + ')' };
    }

    // 🔧 แก้ Bug #2: อัปโหลดรูปโปรไฟล์ แล้วใส่ URL กลับเข้า payload ก่อน delete base64
    if (payload.profileImage_base64) {
      try {
        const url = uploadImageToDrive(
          payload.profileImage_base64,
          payload.profileImage_name || 'profile.jpg',
          payload.profileImage_mime || 'image/jpeg',
          DRIVE_FOLDER_STUDENT_PROFILES
        );
        payload.profileImageUrl = url;
      } catch (e) {
        Logger.log('Profile image upload failed: ' + e.toString());
      }
    }
    delete payload.profileImage_base64;
    delete payload.profileImage_name;
    delete payload.profileImage_mime;

    // 🔧 แก้ Bug #3: อัปโหลดรูปถ่ายบ้าน 1-3 พร้อมสำรอง URL เดิมถ้าไม่ได้อัปโหลดใหม่
    for (let i = 1; i <= 3; i++) {
      const b64Key  = `home_photo_${i}_base64`;
      const nameKey = `home_photo_${i}_name`;
      const mimeKey = `home_photo_${i}_mime`;
      const urlKey  = `home_photo_${i}_url`;

      if (payload[b64Key]) {
        try {
          const url = uploadImageToDrive(
            payload[b64Key],
            payload[nameKey] || `home_photo_${i}.jpg`,
            payload[mimeKey] || 'image/jpeg',
            DRIVE_FOLDER_STUDENT_PROFILES
          );
          payload[urlKey] = url; // อัปเดต URL ใหม่ใน payload
        } catch (e) {
          Logger.log('Home photo ' + i + ' upload failed: ' + e.toString());
        }
      }
      // ลบ base64 ออกจาก payload ก่อนบันทึกลงชีต
      delete payload[b64Key];
      delete payload[nameKey];
      delete payload[mimeKey];
    }
    
    // 🔧 แก้ Bug #4: สร้างคอลัมน์ใหม่สำหรับทุก field ใน payload ที่ยังไม่มีใน sheet
    // (ครอบคลุม home_latitude, home_longitude, home_directions และ field อื่นๆ ในอนาคต)
    const allPayloadKeys = Object.keys(payload);
    allPayloadKeys.forEach(key => {
      if (headers.indexOf(key) === -1) {
        headers.push(key);
        // เขียน header ใหม่ต่อท้ายแถวแรก
        sheet.getRange(1, headers.length).setValue(key);
        Logger.log('สร้างคอลัมน์ใหม่: ' + key);
      }
    });
    
    // สร้าง updatedRow โดย map ทุก header
    const currentRow = data[rowIndex - 1];
    const updatedRow = headers.map((h, colIdx) => {
      if (payload.hasOwnProperty(h)) {
        const val = payload[h];
        // แปลง Object/Array เป็น JSON string ก่อนบันทึก
        if (val !== null && typeof val === 'object') return JSON.stringify(val);
        return (val !== undefined && val !== null) ? val : '';
      }
      // ถ้า payload ไม่มี field นี้ → ใช้ค่าเดิมจาก sheet
      return currentRow[colIdx] !== undefined ? currentRow[colIdx] : '';
    });
    
    sheet.getRange(rowIndex, 1, 1, updatedRow.length).setValues([updatedRow]);
    SpreadsheetApp.flush();
    
    return { success: true, message: 'บันทึกข้อมูลและอัปโหลดรูปภาพสำเร็จ' };
  } catch (e) {
    Logger.log('saveStudentProfile error: ' + e.toString());
    return { success: false, message: e.toString() };
  }
}

function saveHomeVisitData(payload) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Home_Visits') || createHomeVisitsSheet(ss);
    
    let photo1Url = payload.photo_1_base64 ? uploadImageToDrive(payload.photo_1_base64, payload.photo_1_name, payload.photo_1_mime, DRIVE_FOLDER_HOME_VISIT) : '';
    let photo2Url = payload.photo_2_base64 ? uploadImageToDrive(payload.photo_2_base64, payload.photo_2_name, payload.photo_2_mime, DRIVE_FOLDER_HOME_VISIT) : '';
    let photo3Url = payload.photo_3_base64 ? uploadImageToDrive(payload.photo_3_base64, payload.photo_3_name, payload.photo_3_mime, DRIVE_FOLDER_HOME_VISIT) : '';
    
    // 🌟 อัปโหลดลายเซ็นผู้ปกครอง
    let signatureUrl = payload.signature_base64 ? uploadImageToDrive(payload.signature_base64, payload.signature_name, payload.signature_mime, DRIVE_FOLDER_HOME_VISIT) : '';

    const data = sheet.getDataRange().getValues();
    let rowIndex = -1;

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][1]).trim() === String(payload.student_id).trim() && 
          String(data[i][2]) == String(payload.academic_year) && 
          String(data[i][3]) == String(payload.semester)) {
        rowIndex = i + 1;
        // สำรอง URL รูปภาพเดิมถ้าไม่ได้อัปโหลดใหม่
        photo1Url = photo1Url || data[i][15];
        photo2Url = photo2Url || data[i][16];
        photo3Url = photo3Url || data[i][17];
        // 🌟 ดึงลิงก์ลายเซ็นเดิม (ถ้ามีและไม่ได้อัปโหลดลายเซ็นใหม่)
        signatureUrl = signatureUrl || (data[i][22] || '');
        break;
      }
    }

    const rowData = [
      payload.student_id + '_' + payload.academic_year + '_' + payload.semester,
      payload.student_id, payload.academic_year, payload.semester, payload.visit_date,
      payload.guardian_name, payload.guardian_relationship, payload.guardian_phone,
      payload.housing_type, payload.economic_status, payload.environment_safety,
      payload.commute_method, payload.home_behavior, payload.watchlist_issues,
      payload.guardian_suggestions, photo1Url, photo2Url, photo3Url,
      payload.latitude, payload.longitude, payload.updated_by, new Date().toISOString(),
      signatureUrl
    ];

    if (rowIndex > -1) {
      sheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);
    } else {
      sheet.appendRow(rowData);
    }

    // 🌟 บันทึกข้อมูลสมาชิกในบ้าน (One-to-Many)
    if (payload.members) {
      let newMembers = payload.members;
      if (typeof newMembers === 'string') {
        try {
          newMembers = JSON.parse(newMembers);
        } catch(e) {
          newMembers = [];
        }
      }
      if (Array.isArray(newMembers)) {
        const visitId = payload.student_id + '_' + payload.academic_year + '_' + payload.semester;
        let membersData = getSheetData(ss, 'Home_Visit_Members');
        // ลบข้อมูลเดิมของ visit_id นี้ออก
        membersData = membersData.filter(m => String(m.visit_id) !== String(visitId));
        // ใส่ข้อมูลใหม่
        newMembers.forEach((m, idx) => {
          membersData.push({
            id: visitId + '_' + idx,
            visit_id: visitId,
            title: m.title || '',
            first_name: m.first_name || '',
            last_name: m.last_name || '',
            age: m.age || '',
            occupation: m.occupation || '',
            relationship: m.relationship || '',
            phone: m.phone || '',
            note: m.note || ''
          });
        });
        saveSheetData(ss, 'Home_Visit_Members', membersData);
      }
    }

    return { success: true, message: 'บันทึกประวัติการเยี่ยมบ้านเรียบร้อยแล้ว' };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

function getHomeVisitData(request) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Home_Visits');
    if (!sheet) return { success: true, data: null };
    
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][1]).trim() === String(request.studentId).trim() && 
          String(data[i][2]) == String(request.academicYear) && 
          String(data[i][3]) == String(request.semester)) {
        
        // 🌟 แปลงรูปภาพจาก Drive เป็น Base64 เพื่อแก้ปัญหา CORS
        const getBase64FromDriveUrl = function(driveUrl) {
          if (!driveUrl) return '';
          try {
            const match = driveUrl.match(/\/d\/([a-zA-Z0-9_-]+)/) || driveUrl.match(/id=([a-zA-Z0-9_-]+)/);
            if (match && match[1]) {
              const file = DriveApp.getFileById(match[1]);
              const mime = file.getMimeType();
              return 'data:' + mime + ';base64,' + Utilities.base64Encode(file.getBlob().getBytes());
            }
          } catch(e) {
            Logger.log('Error encoding image from Drive: ' + e.message);
          }
          return '';
        };

        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const visitId = data[i][0];
        let members = [];
        if (ss.getSheetByName('Home_Visit_Members')) {
          const allMembers = getSheetData(ss, 'Home_Visit_Members');
          members = allMembers.filter(m => String(m.visit_id) === String(visitId));
        }

        return {
          success: true,
          data: {
            visit_id: data[i][0], student_id: data[i][1], academic_year: data[i][2], semester: data[i][3],
            visit_date: data[i][4], guardian_name: data[i][5], guardian_relationship: data[i][6],
            guardian_phone: data[i][7], housing_type: data[i][8], economic_status: data[i][9],
            environment_safety: data[i][10], commute_method: data[i][11], home_behavior: data[i][12],
            watchlist_issues: data[i][13], guardian_suggestions: data[i][14],
            photo_1_url: data[i][15], photo_2_url: data[i][16], photo_3_url: data[i][17],
            latitude: data[i][18], longitude: data[i][19],
            signature_url: data[i][22] || '',
            // 🌟 ส่ง Base64 กลับเพื่อสร้าง PDF โดยไม่ติด CORS
            photo_1_base64: getBase64FromDriveUrl(data[i][15]),
            photo_2_base64: getBase64FromDriveUrl(data[i][16]),
            photo_3_base64: getBase64FromDriveUrl(data[i][17]),
            signature_base64: getBase64FromDriveUrl(data[i][22]),
            members: members
          }
        };
      }
    }
    return { success: true, data: null };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

// ==========================================
// 4. Data Processing Helpers
// ==========================================

function getSheetData(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  
  var range = sheet.getDataRange();
  var values = range.getValues();
  var displayValues = range.getDisplayValues();
  
  if (values.length <= 1) return [];
  var headers = values[0];
  var list = [];
  
  const textFormatCols = ['studentId', 'citizenId', 'phone', 'parentPhone', 'fatherPhone', 'motherPhone'];

  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    var displayRow = displayValues[i];
    var obj = {};
    
    for (var j = 0; j < headers.length; j++) {
      var val = row[j];
      var header = headers[j];
      
      if (val instanceof Date) {
        val = Utilities.formatDate(val, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ssXXX");
      } else if (textFormatCols.includes(header)) {
        val = displayRow[j];
      }
      
      if (typeof val === 'string' && 
          ((val.startsWith('[') && val.endsWith(']')) || 
           (val.startsWith('{') && val.endsWith('}')))) {
        try { obj[header] = JSON.parse(val); } catch(e) { obj[header] = val; }
      } else {
        obj[header] = val;
      }
    }
    list.push(obj);
  }
  return list;
}

function saveSheetData(ss, sheetName, dataArray) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) sheet = ss.insertSheet(sheetName);
  
  sheet.clear();
  if (!dataArray || dataArray.length === 0) return;
  
  var systemHeaders = ['id', 'deleted_flg', 'createdAt', 'createdBy', 'updatedAt', 'updatedBy', 'deletedAt', 'deletedBy'];
  var headerSet = {};
  
  systemHeaders.forEach(function(h) { headerSet[h] = true; });
  dataArray.forEach(function(item) {
    Object.keys(item).forEach(function(key) { headerSet[key] = true; });
  });
  var headers = Object.keys(headerSet);
  
  var outputData = [headers];
  
  dataArray.forEach(function(item) {
    var row = [];
    headers.forEach(function(header) {
      var val = item[header];
      if (header === 'deleted_flg' && (val === undefined || val === null || val === '')) val = 'N';
      
      if (typeof val === 'object' && val !== null) row.push(JSON.stringify(val));
      else if (typeof val === 'boolean') row.push(val);
      else if (val === undefined || val === null) row.push("");
      else row.push(val);
    });
    outputData.push(row);
  });
  
  var targetRange = sheet.getRange(1, 1, outputData.length, headers.length);
  targetRange.setNumberFormat("@");
  targetRange.setValues(outputData);
  SpreadsheetApp.flush();
}

// ==========================================
// 5. Utility & File Helpers
// ==========================================

function uploadImageToDrive(base64Data, fileName, mimeType, folderId) {
  try {
    const folder = DriveApp.getFolderById(folderId);
    let cleanBase64 = base64Data.replace(/\s/g, '');
    let blob;
    try {
      blob = Utilities.newBlob(Utilities.base64Decode(cleanBase64), mimeType, fileName);
    } catch (e) {
      blob = Utilities.newBlob(Utilities.base64DecodeWebSafe(cleanBase64), mimeType, fileName);
    }
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return file.getUrl();
  } catch (e) {
    throw new Error('อัปโหลดไฟล์รูปล้มเหลว (' + fileName + '): ' + e.message);
  }
}

function successResponse(data) {
  data = data || {};
  return ContentService.createTextOutput(JSON.stringify(Object.assign({ status: 'success' }, data)))
    .setMimeType(ContentService.MimeType.JSON);
}

function errorResponse(message) {
  return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: message }))
    .setMimeType(ContentService.MimeType.JSON);
}

function wrapResponse(result) {
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function createHomeVisitsSheet(ss) {
  const sheet = ss.insertSheet('Home_Visits');
  const headers = [
    'visit_id', 'student_id', 'academic_year', 'semester', 'visit_date',
    'guardian_name', 'guardian_relationship', 'guardian_phone',
    'housing_type', 'economic_status', 'environment_safety',
    'commute_method', 'home_behavior', 'watchlist_issues', 'guardian_suggestions',
    'photo_1_url', 'photo_2_url', 'photo_3_url',
    'latitude', 'longitude', 'updated_by', 'timestamp', 'signature_url'
  ];
  sheet.appendRow(headers);
  return sheet;
}

function forceAuthDrive() {
  const folders = [
    { id: DRIVE_FOLDER_STUDENT_PROFILES, name: 'Student Profiles' },
    { id: DRIVE_FOLDER_HOME_VISIT, name: 'Home Visits' },
    { id: DRIVE_FOLDER_ASSIGNMENTS, name: 'Assignments' },
    { id: DRIVE_FOLDER_SUBMISSIONS, name: 'Submissions' },
    { id: DRIVE_FOLDER_PR_NEWS, name: 'PRNEWS' }
  ];
  
  folders.forEach(f => {
    try {
      let folder = DriveApp.getFolderById(f.id);
      let file = folder.createFile("auth_test.txt", "OK");
      file.setTrashed(true);
      Logger.log('🟢 เปิดสิทธิ์สำเร็จ: ' + f.name);
    } catch(e) {
      Logger.log('🔴 เข้าถึงไม่ได้: ' + f.name + ' - ' + e.message);
    }
  });
}

function savePRItem(payload) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('PR_News');
    if (!sheet) return { success: false, message: 'ไม่พบตาราง PR_News' };

    let imageUrl = payload.image_url || '';
    if (payload.image_base64) {
      imageUrl = uploadImageToDrive(payload.image_base64, payload.image_name, payload.image_mime, DRIVE_FOLDER_PR_NEWS);
    }

    let data = getSheetData(ss, 'PR_News');
    let itemIdx = -1;
    for (let i = 0; i < data.length; i++) {
      if (String(data[i].id) === String(payload.id)) {
        itemIdx = i;
        break;
      }
    }

    const now = new Date().toISOString();
    const item = {
      id: payload.id,
      activity_name: payload.activity_name || '',
      details: payload.details || '',
      start_date: payload.start_date || '',
      end_date: payload.end_date || '',
      image_url: imageUrl,
      status_active: String(payload.status_active),
      note: payload.note || '',
      deleted_flg: payload.deleted_flg || 'N',
      createdAt: payload.createdAt || now,
      createdBy: payload.createdBy || 'unknown',
      updatedAt: now,
      updatedBy: payload.updatedBy || 'unknown',
      deletedAt: payload.deletedAt || '',
      deletedBy: payload.deletedBy || ''
    };

    if (itemIdx > -1) {
      data[itemIdx] = item;
    } else {
      data.push(item);
    }

    saveSheetData(ss, 'PR_News', data);
    return { success: true, message: 'บันทึกข่าวประชาสัมพันธ์เรียบร้อยแล้ว', data: item };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

// 📦 สำรองข้อมูล Google Sheets ทั้งไฟล์เก็บไว้ใน Google Drive
function archiveActiveDatabase(payload) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const file = DriveApp.getFileById(ss.getId());
    const parentFolders = file.getParents();
    let folder = parentFolders.hasNext() ? parentFolders.next() : DriveApp.getRootFolder();
    
    const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd_HHmmss");
    const backupName = `[Backup] ${ss.getName()}_${payload.year || '2569'}_เทอม${payload.semester || '1'}_${timestamp}`;
    
    const backupFile = file.makeCopy(backupName, folder);
    backupFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    return {
      success: true,
      message: 'สำรองข้อมูลสำเร็จ',
      backupUrl: backupFile.getUrl(),
      backupName: backupName
    };
  } catch (e) {
    return { success: false, message: 'การสำรองข้อมูลล้มเหลว: ' + e.toString() };
  }
}

// 🧹 ล้างข้อมูลเฉพาะตารางธุรกรรม (Transaction Data) และรีเซ็ตสถานะเยี่ยมบ้านนักเรียน
function resetTransactionData(payload) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // 1. ล้างข้อมูลชีตธุรกรรม (ล้างตั้งแต่แถวที่ 2 ลงไปเพื่อเก็บ Header ไว้)
    const sheetsToClear = ['Records', 'ClubRecords', 'Home_Visits', 'Home_Visit_Members', 'Assignments', 'StudentAssignments'];
    sheetsToClear.forEach(name => {
      const sheet = ss.getSheetByName(name);
      if (sheet) {
        const lastRow = sheet.getLastRow();
        const lastCol = sheet.getLastColumn();
        if (lastRow > 1) {
          sheet.getRange(2, 1, lastRow - 1, lastCol).clearContent();
        }
      }
    });
    
    // 2. รีเซ็ตคอลัมน์ homeVisit ในตาราง Students ให้เป็น 'ยังไม่เยี่ยม' ทั้งหมด
    const studentSheet = ss.getSheetByName('Students');
    if (studentSheet) {
      const data = studentSheet.getDataRange().getValues();
      const headers = data[0].map(String);
      const homeVisitColIdx = headers.indexOf('homeVisit');
      
      if (homeVisitColIdx > -1 && data.length > 1) {
        for (let i = 1; i < data.length; i++) {
          studentSheet.getRange(i + 1, homeVisitColIdx + 1).setValue('ยังไม่เยี่ยม');
        }
      }
    }
    
    SpreadsheetApp.flush();
    return { success: true, message: 'ล้างประวัติธุรกรรมเพื่อเตรียมเริ่มปีการศึกษาใหม่สำเร็จเรียบร้อยแล้ว' };
  } catch (e) {
    return { success: false, message: 'ล้างข้อมูลล้มเหลว: ' + e.toString() };
  }
}

// ==========================================
// 6. QR Code Check-in System
// ==========================================

function studentSelfCheckin(payload) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('StudentCheckIns');
    if (!sheet) {
      sheet = ss.insertSheet('StudentCheckIns');
      sheet.appendRow(['id', 'studentId', 'classId', 'subjectId', 'teacherId', 'latitude', 'longitude', 'scanTime', 'status']);
    }
    
    const id = payload.id || new Date().getTime().toString();
    const rowData = [
      id,
      payload.studentId || '',
      payload.classId || '',
      payload.subjectId || '',
      payload.teacherId || '',
      payload.latitude || '',
      payload.longitude || '',
      payload.scanTime || new Date().toISOString(),
      'PENDING'
    ];
    
    sheet.appendRow(rowData);
    return { success: true, message: 'เช็คชื่อสำเร็จแล้ว' };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

function updateStudentCheckInsStatus(payload) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('StudentCheckIns');
    if (!sheet) return { success: false, message: 'ไม่พบชีต StudentCheckIns' };
    
    const data = sheet.getDataRange().getValues();
    const idsToUpdate = (payload.ids || []).map(String);
    const newStatus = payload.status || 'SYNCED';
    
    if (idsToUpdate.length === 0) {
       return { success: true, message: 'ไม่มีรายการให้อัปเดต' };
    }
    
    for (let i = 1; i < data.length; i++) {
      if (idsToUpdate.includes(String(data[i][0]))) {
        sheet.getRange(i + 1, 9).setValue(newStatus); // 9th column is status
      }
    }
    
    return { success: true, message: 'อัปเดตสถานะสำเร็จ' };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

