// Simple Vanilla JS Router
import { showLoading, hideLoading } from '../utils/helpers.js';
import { AppState } from './state.js';

class Router {
    constructor() {
        this.routes = {};
        this.currentRoute = null;
        
        this.hashChangeHandler = this.handleRoute.bind(this);
        window.addEventListener('hashchange', this.hashChangeHandler);
    }

    // Register a route and its corresponding HTML file path and init function
    addRoute(hash, htmlPath, initCallback = null) {
        this.routes[hash] = { htmlPath, initCallback };
    }

    async handleRoute() {
        let hash = window.location.hash;
        if (!hash || hash === '#' || hash === '#/checkin') {
            if (AppState.currentUser && AppState.currentUser.role === 'student') {
                hash = '#/my-assignments';
            } else {
                hash = '#/checkin';
            }
        }
        
        // Update URL hash if it was empty/defaulted
        if (window.location.hash !== hash) {
            window.location.hash = hash;
        }

        const route = this.routes[hash];

        if (!route) {
            console.error('Route not found:', hash);
            return;
        }

        if (AppState.checkinUnsavedChanges) {
            // Restore hash temporarily to avoid visual page-switch before choice is made
            if (this.currentRoute) {
                window.removeEventListener('hashchange', this.hashChangeHandler);
                window.location.hash = this.currentRoute;
                setTimeout(() => {
                    window.addEventListener('hashchange', this.hashChangeHandler);
                }, 0);
            }
            
            // Show custom confirm modal
            if (window.customConfirm) {
                window.customConfirm(
                    'ข้อมูลการเช็คชื่อยังไม่ได้บันทึก',
                    'มีข้อมูลการเช็คชื่อที่กำลังดำเนินการอยู่และยังไม่ได้ทำการบันทึก หากออกจากหน้านี้ข้อมูลดังกล่าวจะสูญหายทันที ต้องการออกใช่หรือไม่?',
                    () => {
                        AppState.checkinUnsavedChanges = false;
                        window.removeEventListener('hashchange', this.hashChangeHandler);
                        window.location.hash = hash;
                        this.handleRoute();
                        setTimeout(() => {
                            window.addEventListener('hashchange', this.hashChangeHandler);
                        }, 0);
                    },
                    'ออกโดยไม่บันทึก',
                    'ทำงานต่อ'
                );
            } else {
                // Fallback to standard confirm if helper is missing
                const confirmLeave = confirm('คุณมีข้อมูลที่ยังไม่ได้บันทึก ต้องการออกจากหน้านี้ใช่หรือไม่?');
                if (confirmLeave) {
                    AppState.checkinUnsavedChanges = false;
                    window.removeEventListener('hashchange', this.hashChangeHandler);
                    window.location.hash = hash;
                    this.handleRoute();
                    setTimeout(() => {
                        window.addEventListener('hashchange', this.hashChangeHandler);
                    }, 0);
                }
            }
            return;
        }

        if (this.currentRoute === hash) return;
        this.currentRoute = hash;

        showLoading('กำลังโหลด...');
        try {
            const appContent = document.getElementById('app-content');
            if (!appContent) throw new Error('app-content element not found');

            const response = await fetch(route.htmlPath);
            if (!response.ok) throw new Error('Failed to load page');
            
            const html = await response.text();
            appContent.innerHTML = html;

            // Make sure the loaded page is visible
            const firstChild = appContent.firstElementChild;
            if (firstChild && firstChild.classList.contains('tab-content')) {
                firstChild.classList.add('active');
                firstChild.classList.remove('hidden');
            }

            // Update active state in sidebar/nav if needed
            this.updateActiveNav(hash);

            // Execute initialization callback for the loaded page
            if (route.initCallback) {
                setTimeout(() => route.initCallback(), 0);
            }
            if (window.initTabLogic) {
                setTimeout(() => window.initTabLogic(hash.replace('#/', '')), 0);
            }
        } catch (error) {
            console.error('Error loading route:', error);
            const appContent = document.getElementById('app-content');
            if (appContent) {
                appContent.innerHTML = `<div class="p-8 text-center text-red-500">
                    <h2>ไม่สามารถโหลดหน้าเว็บได้</h2>
                    <p>${error.message}</p>
                </div>`;
            }
        } finally {
            hideLoading();
        }
    }

    updateActiveNav(hash) {
        const tabId = hash.replace('#/', '');
        document.querySelectorAll('.nav-btn').forEach(el => {
            el.classList.remove('active', 'border-white', 'text-white');
            el.classList.add('border-transparent', 'text-green-200');
        });
        const nav = document.getElementById(`nav-${tabId}`);
        if (nav) {
            nav.classList.remove('border-transparent', 'text-green-200');
            nav.classList.add('active', 'border-white', 'text-white');
        }

        // Highlight mobile bottom nav active state
        document.querySelectorAll('.mob-nav-btn').forEach(el => {
            if (el.id !== 'nav-mob-student-qr') {
                el.classList.remove('text-green-600');
                el.classList.add('text-gray-400');
            } else {
                el.classList.remove('ring-4', 'ring-green-300');
            }
        });
        const mobNav = document.getElementById(`nav-mob-${tabId}`);
        if (mobNav) {
            if (tabId !== 'student-qr') {
                mobNav.classList.remove('text-gray-400');
                mobNav.classList.add('text-green-600');
            } else {
                mobNav.classList.add('ring-4', 'ring-green-300');
            }
        }
    }
}

export const appRouter = new Router();
window.appRouter = appRouter;

// Register all pages
appRouter.addRoute('#/student-qr', 'pages/student-qr.html');
appRouter.addRoute('#/my-profile', 'pages/my-profile.html');
appRouter.addRoute('#/my-club', 'pages/my-club.html');
appRouter.addRoute('#/academic', 'pages/academic.html');
appRouter.addRoute('#/my-assignments', 'pages/my-assignments.html');
appRouter.addRoute('#/checkin', 'pages/checkin.html');
appRouter.addRoute('#/club-checkin', 'pages/club-checkin.html');
appRouter.addRoute('#/history', 'pages/history.html');
appRouter.addRoute('#/stats', 'pages/stats.html');
appRouter.addRoute('#/home-visit', 'pages/home-visit.html');
appRouter.addRoute('#/master', 'pages/master.html');
appRouter.addRoute('#/assignments', 'pages/assignments.html');
appRouter.addRoute('#/settings', 'pages/settings.html');

// Initialize router immediately or when DOM is fully loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        appRouter.handleRoute();
    });
} else {
    appRouter.handleRoute();
}
