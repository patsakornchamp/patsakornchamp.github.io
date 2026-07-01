// ==========================================
// MAKHRAB - Google Apps Script Backend (Unified Version) - Stripped for File Upload Only
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
  return successResponse({ message: "Firebase is now used for DB. GAS is only used for File Uploads." });
}

function doPost(e) {
  try {
    const postData = JSON.parse(e.postData.contents);
    const action = postData.action;
    const payload = postData.payload;

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
      return wrapResponse(createAssignmentWithFiles(payload));
    }
    if (action === 'submitStudentAssignment') {
      return wrapResponse(submitStudentAssignment(payload));
    }
    if (action === 'uploadFile') {
      return wrapResponse(uploadFile(payload));
    }
    
    return errorResponse("Action not found: " + action);
  } catch (error) {
    return errorResponse(error.toString());
  }
}

// ==========================================
// 2. Feature: Assignments & Files
// ==========================================

function submitStudentAssignment(payload) {
  var files = [];
  if (payload.files) {
    var rawFiles = JSON.parse(payload.files);
    var folder;
    try {
      folder = DriveApp.getFolderById(DRIVE_FOLDER_SUBMISSIONS);
    } catch(e) {
      folder = DriveApp.createFolder("MAKHRAB_Student_Submissions");
    }
    for (var i = 0; i < rawFiles.length; i++) {
      var fileObj = rawFiles[i];
      if (fileObj.base64) {
        var decoded = Utilities.base64Decode(fileObj.base64);
        var blob = Utilities.newBlob(decoded, fileObj.mimeType || 'application/octet-stream', fileObj.name);
        var driveFile = folder.createFile(blob);
        driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        files.push({ n: fileObj.name, u: driveFile.getUrl() });
      }
    }
  }
  return { success: true, message: "อัปโหลดไฟล์เรียบร้อยแล้ว", files: files };
}

function createAssignmentWithFiles(payload) {
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
    return { success: true, files: uploadedFiles, message: 'อัปโหลดงานสำเร็จ' };
  } catch(e) {
    return { success: false, message: "Upload File Failed: " + e.message };
  }
}

function uploadFile(payload) {
  try {
    if (payload.fileBase64) {
      const url = uploadImageToDrive(payload.fileBase64, payload.fileName || 'file', payload.mimeType || 'application/octet-stream', DRIVE_FOLDER_ASSIGNMENTS);
      return { success: true, url: url };
    }
    return { success: false, message: 'No file provided' };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

// ==========================================
// 3. Feature: Student Profiles & Home Visits
// ==========================================

function saveStudentProfile(payload) {
  try {
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
          payload[urlKey] = url; 
        } catch (e) {
          Logger.log('Home photo ' + i + ' upload failed: ' + e.toString());
        }
      }
      delete payload[b64Key];
      delete payload[nameKey];
      delete payload[mimeKey];
    }
    
    return { success: true, message: 'อัปโหลดรูปภาพสำเร็จ', payload: payload };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

function saveHomeVisitData(payload) {
  try {
    let photo1Url = payload.photo_1_base64 ? uploadImageToDrive(payload.photo_1_base64, payload.photo_1_name, payload.photo_1_mime, DRIVE_FOLDER_HOME_VISIT) : '';
    let photo2Url = payload.photo_2_base64 ? uploadImageToDrive(payload.photo_2_base64, payload.photo_2_name, payload.photo_2_mime, DRIVE_FOLDER_HOME_VISIT) : '';
    let photo3Url = payload.photo_3_base64 ? uploadImageToDrive(payload.photo_3_base64, payload.photo_3_name, payload.photo_3_mime, DRIVE_FOLDER_HOME_VISIT) : '';
    let signatureUrl = payload.signature_base64 ? uploadImageToDrive(payload.signature_base64, payload.signature_name, payload.signature_mime, DRIVE_FOLDER_HOME_VISIT) : '';

    return { 
      success: true, 
      message: 'อัปโหลดรูปภาพเยี่ยมบ้านสำเร็จ', 
      urls: { photo1Url, photo2Url, photo3Url, signatureUrl } 
    };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

function savePRItem(payload) {
  try {
    let imageUrl = payload.image_url || '';
    if (payload.image_base64) {
      imageUrl = uploadImageToDrive(payload.image_base64, payload.image_name, payload.image_mime, DRIVE_FOLDER_PR_NEWS);
    }
    return { success: true, message: 'อัปโหลดรูปภาพ PR สำเร็จ', imageUrl: imageUrl };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
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
