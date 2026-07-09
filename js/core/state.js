export const AppState = {
    currentTab: '',
    googleSheetUrl: '',
    currentUser: null,
    schoolSettings: {},
    
    // Database Data
    allStudents: [],
    allRecords: [],
    allSubjects: [],
    allTeachers: [],
    allClasses: [],
    allClubs: [],
    allClubEnrollments: [],
    allClubRecords: [],
    allAssignments: [],
    allStudentAssignments: [],
    allPrNews: [],

    // Temporary States
    currentCheckinStudents: [],
    activeCheckinStates: {},
    activeCheckinNotes: {},
    lastCheckedStuId: null,
    checkinUnsavedChanges: false,
    draftPrompted: false,
    backupViewerData: null
};