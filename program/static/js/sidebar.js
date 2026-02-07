/**
 * 側邊欄摺疊功能
 * 適用於所有頁面
 */

(function() {
    'use strict';

    // 等待 DOM 載入完成
    document.addEventListener('DOMContentLoaded', function() {
        initSidebar();
    });

    function initSidebar() {
        const sidebar = document.getElementById('sidebar');
        const toggleBtn = document.getElementById('sidebarToggle');
        const body = document.body;

        if (!sidebar || !toggleBtn) {
            console.warn('Sidebar elements not found');
            return;
        }

        // 從 localStorage 讀取摺疊狀態
        const isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
        
        // 初始化狀態
        if (isCollapsed) {
            sidebar.classList.add('collapsed');
            body.classList.add('sidebar-collapsed');
        }

        // 點擊按鈕切換摺疊狀態
        toggleBtn.addEventListener('click', function() {
            toggleSidebar();
        });

        // 支援鍵盤快捷鍵 Ctrl+B 或 Cmd+B
        document.addEventListener('keydown', function(e) {
            if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
                e.preventDefault();
                toggleSidebar();
            }
        });
    }

    function toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        const body = document.body;

        if (!sidebar) return;

        const isCurrentlyCollapsed = sidebar.classList.contains('collapsed');

        if (isCurrentlyCollapsed) {
            // 展開側邊欄
            sidebar.classList.remove('collapsed');
            body.classList.remove('sidebar-collapsed');
            localStorage.setItem('sidebarCollapsed', 'false');
        } else {
            // 摺疊側邊欄
            sidebar.classList.add('collapsed');
            body.classList.add('sidebar-collapsed');
            localStorage.setItem('sidebarCollapsed', 'true');
        }

        // 觸發視窗 resize 事件，讓圖表等元素重新調整大小
        setTimeout(function() {
            window.dispatchEvent(new Event('resize'));
        }, 300); // 等待 CSS transition 完成
    }

    // 導出函數供外部使用（如果需要）
    window.toggleSidebar = toggleSidebar;
})();

