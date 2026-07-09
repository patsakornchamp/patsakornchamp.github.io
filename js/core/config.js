// Reading URL Parameter for Multi-tenant support
const urlParams = new URLSearchParams(window.location.search);
let schoolParam = urlParams.get('school');
if (schoolParam) {
    sessionStorage.setItem('SELECTED_SCHOOL', schoolParam);
} else {
    schoolParam = sessionStorage.getItem('SELECTED_SCHOOL') || '';
}

// Block and show error if no valid school is specified in the URL or session
if (schoolParam !== 'rnn' && schoolParam !== 'cpw') {
    document.addEventListener('DOMContentLoaded', () => {
        document.body.innerHTML = `
            <div style="
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
                font-family: 'Sarabun', 'Inter', sans-serif;
                padding: 20px;
                text-align: center;
                box-sizing: border-box;
            ">
                <div style="
                    background: rgba(255, 255, 255, 0.85);
                    backdrop-filter: blur(10px);
                    -webkit-backdrop-filter: blur(10px);
                    border: 1px solid rgba(255, 255, 255, 0.3);
                    border-radius: 24px;
                    padding: 40px 30px;
                    max-width: 500px;
                    width: 100%;
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.05);
                ">
                    <div style="
                        font-size: 50px;
                        color: #e53e3e;
                        margin-bottom: 20px;
                    ">
                        ⚠️
                    </div>
                    <h2 style="
                        font-size: 22px;
                        font-weight: 800;
                        color: #2d3748;
                        margin-bottom: 10px;
                    ">ไม่พบข้อมูลโรงเรียน</h2>
                    <p style="
                        font-size: 15px;
                        color: #718096;
                        line-height: 1.6;
                        margin-bottom: 30px;
                    ">ลิงก์นี้ไม่ถูกต้อง หรือไม่ระบุรหัสโรงเรียนใน URL พารามิเตอร์<br>กรุณาเข้าใช้งานผ่านลิงก์เฉพาะของโรงเรียนท่าน</p>
                    <div style="
                        display: flex;
                        flex-direction: column;
                        gap: 12px;
                    ">
                        <a href="?school=rnn" style="
                            background: #3182ce;
                            color: white;
                            text-decoration: none;
                            padding: 12px 24px;
                            border-radius: 12px;
                            font-weight: bold;
                            transition: background 0.2s;
                        ">เข้าใช้งานโรงเรียนราชวินิต นนทบุรี</a>
                        <a href="?school=cpw" style="
                            background: #38a169;
                            color: white;
                            text-decoration: none;
                            padding: 12px 24px;
                            border-radius: 12px;
                            font-weight: bold;
                            transition: background 0.2s;
                        ">เข้าใช้งานไชยฉิมพลีวิทยาคม</a>
                    </div>
                </div>
            </div>
        `;
    });
    throw new Error('School parameter is missing or invalid.');
}

// Environment configuration mapping
let ENVIRONMENT;

if (schoolParam === 'rnn') {
    ENVIRONMENT = {
        keyPrefix: 'rnn_',
        systemName: "ระบบของโรงเรียน RNN",
        logoUrl: "https://drive.google.com/thumbnail?id=1i8lJyPYuT-UbSM54dCbzVOY38kox41N2",
        databaseUrl: "https://script.google.com/macros/s/AKfycbzblldGNfn2lVjh_fI_6TxZfd-5Wzh99sISvTNMXUYhFoqNXYzcmdAHwC_yyfwJacXUYQ/exec",
        periods: [
            { value: "1", label: "คาบที่ 1 (08.30-09.20)" },
            { value: "2", label: "คาบที่ 2 (09.20-10.10)" },
            { value: "พัก", label: "พัก (10.10-10.20)" },
            { value: "3", label: "คาบที่ 3 (10.20-11.10)" },
            { value: "4", label: "คาบที่ 4 (11.10-12.00)" },
            { value: "5", label: "คาบที่ 5 (12.00-12.50)" },
            { value: "6", label: "คาบที่ 6 (12.50-13.40)" },
            { value: "7", label: "คาบที่ 7 (13.40-14.30)" },
            { value: "8", label: "คาบที่ 8 (14.30-15.20)" },
            { value: "9", label: "คาบที่ 9 (15.20-16.10)" }
        ]
    };
} else {
     // Default school cpw
    ENVIRONMENT = {
        keyPrefix: 'cpw_',
        systemName: "ระบบของโรงเรียน cpw",
        logoUrl: "https://drive.google.com/thumbnail?id=1YQ2gOFcMp688iFpv5k5b_9ZKDqZ0L7bI",
        databaseUrl: "https://script.google.com/macros/s/AKfycbx0LXo2P_g-vLJwgwElD0XHjPYdjHg7dEKKA1gpHRRO9nKVDNw0C2Sysp_69qeDtCIo4Q/exec",
        periods: [
            { value: "โฮมรูม", label: "โฮมรูม (08.00-08.30)" },
            { value: "1", label: "คาบที่ 1 (08.30-09.20)" },
            { value: "2", label: "คาบที่ 2 (09.20-10.10)" },
            { value: "3", label: "คาบที่ 3 (10.10-11.00)" },
            { value: "4", label: "คาบที่ 4 (11.00-11.50)" },
            { value: "พักเที่ยง", label: "พักเที่ยง (11.50-12.40)" },
            { value: "5", label: "คาบที่ 5 (12.40-13.30)" },
            { value: "6", label: "คาบที่ 6 (13.30-14.20)" },
            { value: "7", label: "คาบที่ 7 (14.20-15.10)" },
            { value: "8", label: "คาบที่ 8 (15.10-16.00)" },
            { value: "กิจกรรม", label: "กิจกรรมหลังเลิกเรียน" }
        ]
    };
}

export { ENVIRONMENT };

export const DB_KEYS = {
    STUDENTS: ENVIRONMENT.keyPrefix + 'students',
    RECORDS: ENVIRONMENT.keyPrefix + 'records',
    SUBJECTS: ENVIRONMENT.keyPrefix + 'subjects',
    TEACHERS: ENVIRONMENT.keyPrefix + 'teachers',
    CLASSES: ENVIRONMENT.keyPrefix + 'classes',
    SETTINGS: ENVIRONMENT.keyPrefix + 'google_sheet_url',
    SESSION: ENVIRONMENT.keyPrefix + 'active_session',
    CLUBS: ENVIRONMENT.keyPrefix + 'clubs',
    CLUB_ENROLLMENTS: ENVIRONMENT.keyPrefix + 'club_enrollments',
    CLUB_RECORDS: ENVIRONMENT.keyPrefix + 'club_records',
    PR_NEWS: ENVIRONMENT.keyPrefix + 'pr_news',
    SCHOOL_SETTINGS: ENVIRONMENT.keyPrefix + 'settings_data'
};

export const DEFAULT_GOOGLE_SCRIPT_URL = ENVIRONMENT.databaseUrl;

// เวอร์ชันการ deploy (เมื่อมีการ deploy ใหม่ ให้เปลี่ยนค่านี้ เช่น วันเวลา หรือเลขเวอร์ชัน เพื่อบังคับให้ครูและแอดมินล็อกอินใหม่)
export const DEPLOY_VERSION = "20260627_2336";

export const firebaseConfigRNN = {
  apiKey: "AIzaSyAaDvuY3R2oKThWJFfyqx7yQs_NOQHQCZc",
  authDomain: "makhrab-4be89.firebaseapp.com",
  databaseURL: "https://makhrab-4be89-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "makhrab-4be89",
  storageBucket: "makhrab-4be89.firebasestorage.app",
  messagingSenderId: "1068852054646",
  appId: "1:1068852054646:web:3f2c4c56799e79fe236d57",
  measurementId: "G-M2XCYFNS76"
};

export const firebaseConfigCSM = {
  apiKey: "AIzaSyCzYPGqoXaNVeVZcyvN7X5TrNZ4InCDGr4",
  authDomain: "makhrab-csm.firebaseapp.com",
  databaseURL: "https://makhrab-csm-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "makhrab-csm",
  storageBucket: "makhrab-csm.firebasestorage.app",
  messagingSenderId: "333201567743",
  appId: "1:333201567743:web:cad015f513dd314b1681ca",
  measurementId: "G-DS7P4W6W65"
};

// เลือก Config ให้ตรงกับโรงเรียน (default เป็น CSM/CPW)
export const firebaseConfig = (schoolParam === 'rnn') ? firebaseConfigRNN : firebaseConfigCSM;
