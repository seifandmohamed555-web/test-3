/* ========================================
   MAP Supplies - JavaScript لوحة الإدارة
   ======================================== */

// ===== المتغيرات العامة =====
const ADMIN_SECRET_CODE = 'map2026';
const DEFAULT_ADMIN = {
    email: 'admin@mapsupplies.com',
    password: 'admin123',
    role: 'admin',
    name: 'المدير الرئيسي'
};

let currentUser = null;
let orders = [];
let customers = [];
let supervisors = [];
let notifications = [];
let quotes = [];
let categories = [
    { id: 'electronics', name: 'إلكترونيات', icon: '💻' },
    { id: 'furniture', name: 'أثاث', icon: '🪑' },
    { id: 'office', name: 'مستلزمات مكتبية', icon: '📎' },
    { id: 'industrial', name: 'معدات صناعية', icon: '🏭' },
    { id: 'food', name: 'مواد غذائية', icon: '🍽️' },
    { id: 'medical', name: 'مستلزمات طبية', icon: '⚕️' },
    { id: 'other', name: 'أخرى', icon: '📌' }
];
let notificationTemplate = 'مرحباً [اسم العميل]، تم إضافة عرض سعر جديد لطلبكم رقم #[رقم الطلب]. يرجى تسجيل الدخول لمراجعة التفاصيل. - فريق MAP Supplies';

// ===== تهيئة التطبيق =====
document.addEventListener('DOMContentLoaded', async function () {
    // تهيئة قاعدة البيانات المحلية والسحابية
    if (typeof MAP_DB !== 'undefined') await MAP_DB.init();
    if (typeof MAP_CLOUD !== 'undefined') await MAP_CLOUD.init();

    await loadFromStorage();
    checkAdminSession();

    // مراقبة البيانات لحظياً من السحابة لتحديث اللوحة فوراً
    if (typeof MAP_CLOUD !== 'undefined') {
        MAP_CLOUD.subscribe('orders', (data) => { orders = data; updateAdminStats(); loadRecentActivity(); if (activeSection === 'orders') loadAdminOrders(); });
        MAP_CLOUD.subscribe('customers', (data) => { customers = data; updateAdminStats(); if (activeSection === 'customers') loadCustomersList(); });
        MAP_CLOUD.subscribe('quotes', (data) => { quotes = data; });
    }

    // تهيئة EmailJS
    if (typeof emailjs !== 'undefined') {
        emailjs.init("vcHKe7GLjFyqTEKti");
    }
});

let activeSection = 'dashboard';

// ===== تحميل البيانات من السحابة (Firebase) و Local Storage =====
async function loadFromStorage() {
    // محاولة التحميل من السحابة أولاً للربط بين الأجهزة
    if (typeof MAP_CLOUD !== 'undefined') {
        orders = await MAP_CLOUD.getAll('orders');
        customers = await MAP_CLOUD.getAll('customers');
        supervisors = await MAP_CLOUD.getAll('supervisors');
        notifications = await MAP_CLOUD.getAll('notifications');
        quotes = await MAP_CLOUD.getAll('quotes');
        const cloudCats = await MAP_CLOUD.getSetting('admin_categories');
        if (cloudCats) categories = cloudCats;
        const cloudTemplate = await MAP_CLOUD.getSetting('admin_notificationTemplate');
        if (cloudTemplate) notificationTemplate = cloudTemplate;
    } else {
        // Fallback للـ LocalStorage في حالة عدم وجود إنترنت
        orders = JSON.parse(localStorage.getItem('admin_orders')) ?? [];
        customers = JSON.parse(localStorage.getItem('admin_customers')) ?? [];
        supervisors = JSON.parse(localStorage.getItem('admin_supervisors')) ?? [];
        notifications = JSON.parse(localStorage.getItem('admin_notifications')) ?? [];
        quotes = JSON.parse(localStorage.getItem('admin_quotes')) ?? [];
        categories = JSON.parse(localStorage.getItem('admin_categories')) ?? categories;
        notificationTemplate = localStorage.getItem('admin_notificationTemplate') ?? notificationTemplate;
    }
}

async function saveToStorage() {
    try {
        // 1. الحفظ في LocalStorage للتوافق السريع
        localStorage.setItem('admin_orders', JSON.stringify(orders));
        localStorage.setItem('admin_customers', JSON.stringify(customers));
        localStorage.setItem('admin_supervisors', JSON.stringify(supervisors));
        localStorage.setItem('admin_notifications', JSON.stringify(notifications));
        localStorage.setItem('admin_quotes', JSON.stringify(quotes));
        localStorage.setItem('admin_categories', JSON.stringify(categories));

        // 2. المزامنة السحابية (Firebase) للربط العالمي - استخدام Promise.all للسرعة
        if (typeof MAP_CLOUD !== 'undefined') {
            const saves = [
                ...orders.map(o => MAP_CLOUD.save('orders', o)),
                ...customers.map(c => MAP_CLOUD.save('customers', c)),
                ...supervisors.map(s => MAP_CLOUD.save('supervisors', s)),
                ...notifications.map(n => MAP_CLOUD.save('notifications', n)),
                ...quotes.map(q => MAP_CLOUD.save('quotes', q)),
                MAP_CLOUD.setSetting('admin_categories', categories),
                MAP_CLOUD.setSetting('admin_notificationTemplate', notificationTemplate)
            ];
            await Promise.all(saves);
        }

        // 3. الحفظ المحلي الاحتياطي (IndexedDB)
        if (typeof MAP_DB !== 'undefined' && MAP_DB.db) {
            orders.forEach(o => MAP_DB.save('orders', o));
            customers.forEach(c => MAP_DB.save('customers', c));
            supervisors.forEach(s => MAP_DB.save('supervisors', s));
            notifications.forEach(n => MAP_DB.save('notifications', n));
            quotes.forEach(q => MAP_DB.save('quotes', q));
        }
    } catch (e) {
        console.error('فشل حفظ البيانات:', e);
    }
}

// ===== إدارة الجلسات =====
function checkAdminSession() {
    const session = JSON.parse(localStorage.getItem('adminSession'));

    if (session) {
        const sessionTime = new Date(session.timestamp);
        const now = new Date();
        const hoursDiff = (now - sessionTime) / (1000 * 60 * 60);

        if (hoursDiff < 24) {
            currentUser = session.user;
            showAdminDashboard();
            loadAdminData();
        } else {
            localStorage.removeItem('adminSession');
            showToast('انتهت صلاحية الجلسة. يرجى تسجيل الدخول مرة أخرى.', 'warning');
        }
    }
}

function createAdminSession(user) {
    const session = {
        user: user,
        timestamp: new Date().toISOString()
    };
    localStorage.setItem('adminSession', JSON.stringify(session));
    currentUser = user;
}

function destroyAdminSession() {
    localStorage.removeItem('adminSession');
    currentUser = null;
}

// ===== التنقل بين الصفحات =====
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    document.getElementById(pageId).classList.add('active');
}

function backToCodePage() {
    showPage('admin-login-page');
    document.getElementById('admin-code').value = '';
}

function backToRolePage() {
    showPage('admin-role-page');
}

// ===== التحقق من الرمز السري =====
function verifyAdminCode(event) {
    event.preventDefault();

    const code = document.getElementById('admin-code').value;

    if (code === ADMIN_SECRET_CODE) {
        showPage('admin-role-page');
        showToast('تم التحقق من الرمز السري بنجاح', 'success');
    } else {
        showToast('الرمز السري غير صحيح', 'error');
        document.getElementById('admin-code').value = '';
    }
}

// ===== عرض نماذج تسجيل الدخول =====
function showAdminLoginForm() {
    showPage('admin-main-login-page');
}

function showSupervisorLoginForm() {
    showPage('supervisor-login-page');
}

// ===== تسجيل دخول المدير الرئيسي =====
function handleAdminLogin(event) {
    event.preventDefault();

    const code = document.getElementById('admin-main-code').value;

    if (code === 'seif web') {
        createAdminSession(DEFAULT_ADMIN);
        showAdminDashboard();
        loadAdminData();
        showToast('مرحباً بك في لوحة الإدارة', 'success');
    } else {
        showToast('الرمز السري الخاص بالمدير غير صحيح', 'error');
    }
}

// ===== تسجيل دخول المشرف الفرعي =====
function handleSupervisorLogin(event) {
    event.preventDefault();

    const email = document.getElementById('supervisor-email').value;
    const password = document.getElementById('supervisor-password').value;

    const supervisor = supervisors.find(s => s.email === email && s.password === password);

    if (supervisor) {
        createAdminSession({ ...supervisor, role: 'supervisor' });
        showAdminDashboard();
        loadAdminData();
        showToast('مرحباً بك ' + supervisor.name, 'success');
    } else {
        showToast('البريد الإلكتروني أو كلمة المرور غير صحيحة', 'error');
    }
}

// ===== عرض لوحة التحكم =====
function showAdminDashboard() {
    showPage('admin-dashboard');
    document.getElementById('admin-user-name').textContent = currentUser.name;

    const navLinks = {
        dashboard: document.getElementById('nav-dashboard'),
        orders: document.getElementById('nav-orders'),
        customers: document.getElementById('nav-customers'),
        supervisors: document.getElementById('nav-supervisors'),
        categories: document.getElementById('nav-categories'),
        notifications: document.getElementById('nav-notifications'),
        settings: document.getElementById('nav-settings')
    };

    if (currentUser.role === 'supervisor') {
        // إخفاء كل شيء ما عدا الطلبات للمشرف الفرعي
        navLinks.dashboard.style.display = 'none';
        navLinks.customers.style.display = 'none';
        navLinks.supervisors.style.display = 'none';
        navLinks.categories.style.display = 'none';
        navLinks.notifications.style.display = 'none';
        navLinks.settings.style.display = 'none';

        // عرض قسم الطلبات مباشرة
        showAdminSection('orders');
    } else {
        // إظهار كل شيء للمدير الرئيسي
        Object.values(navLinks).forEach(link => {
            if (link) link.style.display = 'block';
        });
        showAdminSection('dashboard');
    }
}

// ===== تسجيل الخروج =====
function handleAdminLogout() {
    if (confirm('هل أنت متأكد من تسجيل الخروج؟')) {
        destroyAdminSession();
        showPage('admin-login-page');
        showToast('تم تسجيل الخروج بنجاح', 'success');
    }
}

// ===== التنقل بين أقسام لوحة التحكم =====
function showAdminSection(sectionId) {
    // منع المشرف من الوصول لأي قسم بخلاف الطلبات
    if (currentUser && currentUser.role === 'supervisor' && sectionId !== 'orders') {
        showToast('ليس لديك صلاحية للوصول لهذا القسم', 'error');
        return;
    }

    const targetSection = document.getElementById('admin-' + sectionId);
    if (!targetSection) {
        console.error('Section not found: admin-' + sectionId);
        return;
    }

    document.querySelectorAll('#admin-dashboard .dashboard-section').forEach(section => {
        section.classList.remove('active');
    });
    targetSection.classList.add('active');

    document.querySelectorAll('#admin-dashboard .nav-link').forEach(link => {
        link.classList.remove('active');
    });

    // تفعيل الرابط المناسب في القائمة
    const activeLink = document.getElementById('nav-' + sectionId);
    if (activeLink) activeLink.classList.add('active');

    activeSection = sectionId;

    if (sectionId === 'orders') {
        loadAdminOrders();
    } else if (sectionId === 'customers') {
        loadCustomersList();
    } else if (sectionId === 'supervisors') {
        loadSupervisorsList();
    } else if (sectionId === 'categories') {
        loadCategoriesAdmin();
    } else if (sectionId === 'notifications') {
        loadNotificationsList();
    } else if (sectionId === 'settings') {
        loadSettingsData();
    }
}

// ===== تحميل بيانات الإدارة =====
function loadAdminData() {
    updateAdminStats();
    loadRecentActivity();
}

// ===== تحديث الإحصائيات =====
function updateAdminStats() {
    const totalOrders = orders.length;
    const totalCustomers = customers.length;
    const pendingOrders = orders.filter(o => o.status === 'pending' || o.status === 'reviewing').length;
    const approvedOrders = orders.filter(o => o.status === 'approved').length;
    const shippedOrders = orders.filter(o => o.status === 'shipped' || o.status === 'delivered').length;

    // حساب إجمالي المبيعات
    const acceptedQuotes = quotes.filter(q => q.status === 'accepted');
    const totalSales = acceptedQuotes.reduce((sum, q) => sum + parseFloat(q.price), 0);

    // حساب معدل قبول العروض
    const totalQuotes = quotes.length;
    const acceptedQuotesCount = acceptedQuotes.length;
    const quoteRate = totalQuotes > 0 ? ((acceptedQuotesCount / totalQuotes) * 100).toFixed(1) : 0;

    // حساب متوسط قيمة الطلب
    const avgOrder = acceptedQuotesCount > 0 ? (totalSales / acceptedQuotesCount).toFixed(2) : 0;

    document.getElementById('admin-total-orders').textContent = totalOrders;
    document.getElementById('admin-total-customers').textContent = totalCustomers;
    document.getElementById('admin-pending-orders').textContent = pendingOrders;
    document.getElementById('admin-total-sales').textContent = totalSales.toFixed(2) + ' ج.م';
    document.getElementById('admin-approved-orders').textContent = approvedOrders;
    document.getElementById('admin-shipped-orders').textContent = shippedOrders;
    document.getElementById('admin-quote-rate').textContent = quoteRate + '%';
    document.getElementById('admin-avg-order').textContent = avgOrder + ' ج.م';
}

// ===== تحميل النشاط الأخير =====
function loadRecentActivity() {
    const activityList = document.getElementById('recent-activity-list');
    const recentOrders = orders.slice(-5).reverse();
    const recentNotifications = notifications.slice(-3).reverse();

    let activities = [];

    // إضافة الطلبات الأخيرة
    recentOrders.forEach(order => {
        activities.push({
            icon: '📋',
            title: `طلب جديد #${order.id.substring(0, 8)}`,
            time: formatDate(order.createdAt),
            timestamp: new Date(order.createdAt)
        });
    });

    // إضافة الإشعارات الأخيرة
    recentNotifications.forEach(notif => {
        activities.push({
            icon: notif.status === 'sent' ? '✅' : '❌',
            title: `إشعار ${notif.status === 'sent' ? 'مرسل' : 'فشل'} إلى ${notif.customerName}`,
            time: formatDate(notif.timestamp),
            timestamp: new Date(notif.timestamp)
        });
    });

    // ترتيب حسب الوقت
    activities.sort((a, b) => b.timestamp - a.timestamp);
    activities = activities.slice(0, 10);

    if (activities.length === 0) {
        activityList.innerHTML = '<p class="empty-state">لا يوجد نشاط حديث</p>';
        return;
    }

    activityList.innerHTML = activities.map(activity => `
        <div class="activity-item">
            <div class="activity-icon">${activity.icon}</div>
            <div class="activity-content">
                <p class="activity-title">${activity.title}</p>
                <p class="activity-time">${activity.time}</p>
            </div>
        </div>
    `).join('');
}

// ===== تحميل الطلبات =====
function loadAdminOrders() {
    const ordersList = document.getElementById('admin-orders-list');

    if (orders.length === 0) {
        ordersList.innerHTML = '<p class="empty-state">لا توجد طلبات</p>';
        return;
    }

    ordersList.innerHTML = orders.slice().reverse().map(order => createOrderCard(order)).join('');
}

// ===== إنشاء بطاقة طلب =====
function createOrderCard(order) {
    const statusLabels = {
        pending: 'معلق',
        reviewing: 'قيد المراجعة',
        quoted: 'مسعر',
        approved: 'موافق عليه',
        preparing: 'قيد التحضير',
        shipped: 'مشحون',
        delivered: 'مسلم',
        cancelled: 'ملغي'
    };

    const orderQuotes = quotes.filter(q => q.orderId === order.id);

    return `
        <div class="order-card">
            <div class="order-header">
                <div>
                    <span class="order-id">طلب #${order.id.substring(0, 8)}</span>
                    <p style="margin: 4px 0; color: var(--text-secondary); font-size: 14px;">العميل: ${order.customerName}</p>
                </div>
                <span class="order-status status-${order.status}">${statusLabels[order.status]}</span>
            </div>
            <div class="order-body">
                <div class="order-items">
                    ${order.items.map(item => `
                        <div class="order-item">
                            ${item.image ? `<img src="${item.image}" alt="${item.productName}" class="item-image">` : '<div class="item-image">📦</div>'}
                            <div class="item-details">
                                <h4>${item.productName}</h4>
                                <p>الكمية: ${item.quantity}</p>
                                ${item.productType ? `<p>النوع: ${item.productType}</p>` : ''}
                                ${item.productSpecs ? `<p>المواصفات: ${item.productSpecs}</p>` : ''}
                                ${item.productNotes ? `<p>ملاحظات: ${item.productNotes}</p>` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
                ${orderQuotes.length > 0 ? `
                    <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border-color);">
                        <h4>عروض الأسعار (${orderQuotes.length})</h4>
                        ${orderQuotes.map(quote => `
                            <div style="padding: 12px; background: #f8fafc; border-radius: 8px; margin-top: 8px;">
                                <p><strong>السعر:</strong> ${quote.price} ج.م</p>
                                <p><strong>مدة التسليم:</strong> ${quote.delivery}</p>
                                <p><strong>شروط الدفع:</strong> ${quote.payment}</p>
                                ${quote.notes ? `<p><strong>ملاحظات:</strong> ${quote.notes}</p>` : ''}
                                ${quote.status === 'accepted' ? '<p style="color: var(--success-color); font-weight: 600;">✓ تم القبول</p>' : ''}
                                ${quote.status === 'rejected' ? '<p style="color: var(--danger-color); font-weight: 600;">✗ تم الرفض</p>' : ''}
                                ${quote.status === 'pending' ? '<p style="color: var(--warning-color); font-weight: 600;">⏳ قيد الانتظار</p>' : ''}
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
            <div class="order-footer">
                <span class="order-date">${formatDate(order.createdAt)}</span>
                <div class="order-actions">
                    <button class="btn btn-primary btn-sm" onclick="openQuoteModal('${order.id}')">إضافة عرض سعر</button>
                    ${order.status === 'pending' ? `<button class="btn btn-secondary btn-sm" onclick="updateOrderStatus('${order.id}', 'reviewing')">قيد المراجعة</button>` : ''}
                    ${order.status === 'approved' ? `<button class="btn btn-secondary btn-sm" onclick="updateOrderStatus('${order.id}', 'preparing')">قيد التحضير</button>` : ''}
                    ${order.status === 'preparing' ? `<button class="btn btn-secondary btn-sm" onclick="updateOrderStatus('${order.id}', 'shipped')">تم الشحن</button>` : ''}
                    ${order.status === 'shipped' ? `<button class="btn btn-secondary btn-sm" onclick="updateOrderStatus('${order.id}', 'delivered')">تم التسليم</button>` : ''}
                </div>
            </div>
        </div>
    `;
}

// ===== البحث في الطلبات =====
function searchOrders() {
    const searchTerm = document.getElementById('admin-search').value.toLowerCase();
    const ordersList = document.getElementById('admin-orders-list');

    let filteredOrders = orders.filter(order => {
        return order.id.toLowerCase().includes(searchTerm) ||
            order.customerName.toLowerCase().includes(searchTerm);
    });

    if (filteredOrders.length === 0) {
        ordersList.innerHTML = '<p class="empty-state">لا توجد نتائج</p>';
        return;
    }

    ordersList.innerHTML = filteredOrders.slice().reverse().map(order => createOrderCard(order)).join('');
}

// ===== تصفية الطلبات =====
function filterAdminOrders() {
    const status = document.getElementById('admin-status-filter').value;
    const date = document.getElementById('admin-date-filter').value;
    const ordersList = document.getElementById('admin-orders-list');

    let filteredOrders = orders;

    if (status !== 'all') {
        filteredOrders = filteredOrders.filter(o => o.status === status);
    }

    if (date) {
        filteredOrders = filteredOrders.filter(o => {
            const orderDate = new Date(o.createdAt).toISOString().split('T')[0];
            return orderDate === date;
        });
    }

    if (filteredOrders.length === 0) {
        ordersList.innerHTML = '<p class="empty-state">لا توجد طلبات</p>';
        return;
    }

    ordersList.innerHTML = filteredOrders.slice().reverse().map(order => createOrderCard(order)).join('');
}

// ===== إعادة تعيين الفلاتر =====
function resetFilters() {
    document.getElementById('admin-search').value = '';
    document.getElementById('admin-status-filter').value = 'all';
    document.getElementById('admin-date-filter').value = '';
    loadAdminOrders();
}

// ===== فتح نافذة عرض السعر =====
function openQuoteModal(orderId) {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    document.getElementById('quote-order-id').value = orderId;

    // عرض تفاصيل الطلب
    const detailsPreview = document.getElementById('quote-order-details');
    detailsPreview.innerHTML = `
        <h4>تفاصيل الطلب</h4>
        <div class="detail-row">
            <strong>رقم الطلب:</strong>
            <span>#${order.id.substring(0, 8)}</span>
        </div>
        <div class="detail-row">
            <strong>العميل:</strong>
            <span>${order.customerName}</span>
        </div>
        <div class="detail-row">
            <strong>التاريخ:</strong>
            <span>${formatDate(order.createdAt)}</span>
        </div>
        <div class="order-items-preview">
            <h5>المنتجات:</h5>
            <ul>
                ${order.items.map(item => `
                    <li>${item.productName} - الكمية: ${item.quantity}</li>
                `).join('')}
            </ul>
        </div>
    `;

    document.getElementById('quote-modal').classList.add('active');
}

// ===== إغلاق نافذة عرض السعر =====
function closeQuoteModal() {
    document.getElementById('quote-modal').classList.remove('active');
    document.getElementById('quote-form').reset();
}

// ===== إرسال عرض السعر =====
function submitQuote(event) {
    event.preventDefault();

    const orderId = document.getElementById('quote-order-id').value;
    const price = document.getElementById('quote-price').value;
    const delivery = document.getElementById('quote-delivery').value;
    const payment = document.getElementById('quote-payment').value;
    const notes = document.getElementById('quote-notes').value;

    const quote = {
        id: generateId(),
        orderId,
        price,
        delivery,
        payment,
        notes,
        status: 'pending',
        createdAt: new Date().toISOString()
    };

    quotes.push(quote);

    // تحديث حالة الطلب
    const order = orders.find(o => o.id === orderId);
    if (order) {
        order.status = 'quoted';
        sendNotification(order);
    }

    saveToStorage();
    closeQuoteModal();
    loadAdminOrders();
    updateAdminStats();
    showToast('تم إضافة عرض السعر وإرسال إشعار للعميل', 'success');
}

// ===== إرسال إشعار (محاكاة البريد والواتساب) =====
function sendNotification(order) {
    const customer = customers.find(c => c.id === order.customerId);
    if (!customer) return;

    const message = notificationTemplate
        .replace('[اسم العميل]', customer.companyName)
        .replace('[رقم الطلب]', order.id.substring(0, 8));

    // إعداد روابط الإرسال (للرجوع السريع)
    const emailLink = `mailto:${customer.email}?subject=عرض سعر جديد #${order.id.substring(0, 8)}&body=${encodeURIComponent(message)}`;
    const whatsappLink = `https://wa.me/${customer.phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;

    const notification = {
        id: generateId(),
        orderId: order.id,
        customerId: customer.id,
        customerName: customer.companyName,
        customerPhone: customer.phone,
        customerEmail: customer.email,
        message,
        emailStatus: 'pending',
        whatsappStatus: 'sent',
        links: { email: emailLink, whatsapp: whatsappLink },
        timestamp: new Date().toISOString()
    };

    // إرسال الإيميل الحقيقي عبر EmailJS من لوحة الإدارة
    if (typeof emailjs !== 'undefined') {
        const templateParams = {
            to_name: customer.companyName,
            to_email: customer.email,
            message: message
        };

        emailjs.send('service_rz6x4y9', 'template_lk49do2', templateParams, 'vcHKe7GLjFyqTEKti')
            .then(function (response) {
                console.log('Admin Email Sent Success!', response.status, response.text);
                notification.emailStatus = 'sent';
                saveToStorage();
                loadNotificationsList();
                showToast('تم إرسال بريد إلكتروني للعميل بنجاح', 'success');
            }, function (error) {
                console.error('Admin Email Failed Error:', error);
                notification.emailStatus = 'failed';
                saveToStorage();
                loadNotificationsList();
                showToast('فشل إرسال البريد: ' + (error.text || 'خطأ في الربط'), 'error');
            });
    }

    notifications.push(notification);
    saveToStorage();

    console.log(`%c[WhatsApp Link Generated for ${customer.phone}]:`, 'color: #25d366; font-weight: bold;', message);
}

// ===== تحديث حالة الطلب =====
function updateOrderStatus(orderId, newStatus) {
    const order = orders.find(o => o.id === orderId);
    if (order) {
        order.status = newStatus;
        saveToStorage();
        loadAdminOrders();
        updateAdminStats();
        showToast('تم تحديث حالة الطلب', 'success');
    }
}

// ===== تحميل قائمة العملاء =====
function loadCustomersList() {
    const customersList = document.getElementById('customers-list');

    if (customers.length === 0) {
        customersList.innerHTML = '<p class="empty-state">لا يوجد عملاء</p>';
        return;
    }

    customersList.innerHTML = customers.map(customer => `
        <div class="customer-card">
            <h3>${customer.companyName}</h3>
            <div class="customer-info">
                <p><strong>البريد:</strong> ${customer.email}</p>
                <p><strong>الهاتف:</strong> ${customer.phone}</p>
                <p><strong>واتساب:</strong> ${customer.whatsappPhone || 'غير مسجل'}</p>
                <p><strong>الرقم الضريبي:</strong> ${customer.taxNumber}</p>
                <p><strong>العنوان:</strong> ${customer.address || 'غير مسجل'}</p>
                <p><strong>تاريخ التسجيل:</strong> ${formatDate(customer.createdAt)}</p>
                <p><strong>الحالة:</strong> 
                    ${customer.isBlocked ?
            '<span class="status-badge blocked">محظور</span>' :
            '<span class="status-badge active">نشط</span>'}
                </p>
            </div>
            <div class="customer-actions">
                ${customer.isBlocked ?
            `<button class="btn btn-primary btn-sm" onclick="toggleBlockCustomer('${customer.id}')">إلغاء الحظر</button>` :
            `<button class="btn btn-secondary btn-sm" onclick="toggleBlockCustomer('${customer.id}')">حظر</button>`
        }
            </div>
        </div>
    `).join('');
}

// ===== البحث في العملاء =====
function searchCustomers() {
    const searchTerm = document.getElementById('customers-search').value.toLowerCase();
    const customersList = document.getElementById('customers-list');

    let filteredCustomers = customers.filter(customer => {
        return customer.companyName.toLowerCase().includes(searchTerm) ||
            customer.email.toLowerCase().includes(searchTerm);
    });

    if (filteredCustomers.length === 0) {
        customersList.innerHTML = '<p class="empty-state">لا توجد نتائج</p>';
        return;
    }

    customersList.innerHTML = filteredCustomers.map(customer => `
        <div class="customer-card">
            <h3>${customer.companyName}</h3>
            <div class="customer-info">
                <p><strong>البريد:</strong> ${customer.email}</p>
                <p><strong>الهاتف:</strong> ${customer.phone}</p>
                <p><strong>واتساب:</strong> ${customer.whatsappPhone || 'غير مسجل'}</p>
                <p><strong>الرقم الضريبي:</strong> ${customer.taxNumber}</p>
                <p><strong>العنوان:</strong> ${customer.address || 'غير مسجل'}</p>
                <p><strong>تاريخ التسجيل:</strong> ${formatDate(customer.createdAt)}</p>
                <p><strong>الحالة:</strong> 
                    ${customer.isBlocked ?
            '<span class="status-badge blocked">محظور</span>' :
            '<span class="status-badge active">نشط</span>'}
                </p>
            </div>
            <div class="customer-actions">
                ${customer.isBlocked ?
            `<button class="btn btn-primary btn-sm" onclick="toggleBlockCustomer('${customer.id}')">إلغاء الحظر</button>` :
            `<button class="btn btn-secondary btn-sm" onclick="toggleBlockCustomer('${customer.id}')">حظر</button>`
        }
            </div>
        </div>
    `).join('');
}

// ===== تصفية العملاء =====
function filterCustomers() {
    const status = document.getElementById('customers-status-filter').value;
    const customersList = document.getElementById('customers-list');

    let filteredCustomers = customers;

    if (status === 'active') {
        filteredCustomers = customers.filter(c => !c.isBlocked);
    } else if (status === 'blocked') {
        filteredCustomers = customers.filter(c => c.isBlocked);
    }

    if (filteredCustomers.length === 0) {
        customersList.innerHTML = '<p class="empty-state">لا يوجد عملاء</p>';
        return;
    }

    customersList.innerHTML = filteredCustomers.map(customer => `
        <div class="customer-card">
            <h3>${customer.companyName}</h3>
            <div class="customer-info">
                <p><strong>البريد:</strong> ${customer.email}</p>
                <p><strong>الهاتف:</strong> ${customer.phone}</p>
                <p><strong>الرقم الضريبي:</strong> ${customer.taxNumber}</p>
                <p><strong>تاريخ التسجيل:</strong> ${formatDate(customer.createdAt)}</p>
                <p><strong>الحالة:</strong> 
                    ${customer.isBlocked ?
            '<span class="status-badge blocked">محظور</span>' :
            '<span class="status-badge active">نشط</span>'}
                </p>
            </div>
            <div class="customer-actions">
                ${customer.isBlocked ?
            `<button class="btn btn-primary btn-sm" onclick="toggleBlockCustomer('${customer.id}')">إلغاء الحظر</button>` :
            `<button class="btn btn-secondary btn-sm" onclick="toggleBlockCustomer('${customer.id}')">حظر</button>`
        }
            </div>
        </div>
    `).join('');
}

// ===== حظر/إلغاء حظر العميل =====
function toggleBlockCustomer(customerId) {
    const customer = customers.find(c => c.id === customerId);
    if (customer) {
        customer.isBlocked = !customer.isBlocked;
        saveToStorage();
        loadCustomersList();
        showToast(customer.isBlocked ? 'تم حظر العميل' : 'تم إلغاء حظر العميل', 'success');
    }
}

// ===== فتح نافذة إضافة مشرف =====
function showAddSupervisorModal() {
    if (currentUser.role !== 'admin') {
        showToast('ليس لديك صلاحية لإضافة مشرفين', 'error');
        return;
    }
    document.getElementById('supervisor-modal').classList.add('active');
}

// ===== إغلاق نافذة المشرف =====
function closeSupervisorModal() {
    document.getElementById('supervisor-modal').classList.remove('active');
    document.getElementById('supervisor-form').reset();
}

// ===== إضافة مشرف =====
function addSupervisor(event) {
    event.preventDefault();

    const name = document.getElementById('supervisor-name').value;
    const email = document.getElementById('supervisor-email-add').value;
    const password = document.getElementById('supervisor-password-add').value;

    if (supervisors.some(s => s.email === email)) {
        showToast('البريد الإلكتروني مستخدم بالفعل', 'error');
        return;
    }

    const supervisor = {
        id: generateId(),
        name,
        email,
        password,
        code: generateSupervisorCode(),
        createdAt: new Date().toISOString()
    };

    supervisors.push(supervisor);
    saveToStorage();
    closeSupervisorModal();
    loadSupervisorsList();
    showToast('تم إضافة المشرف بنجاح. الرمز الخاص: ' + supervisor.code, 'success');
}

// ===== تحميل قائمة المشرفين =====
function loadSupervisorsList() {
    const supervisorsList = document.getElementById('supervisors-list');

    if (supervisors.length === 0) {
        supervisorsList.innerHTML = '<p class="empty-state">لا يوجد مشرفين</p>';
        return;
    }

    supervisorsList.innerHTML = supervisors.map(supervisor => `
        <div class="supervisor-card">
            <h3>${supervisor.name}</h3>
            <div class="supervisor-info">
                <p><strong>البريد:</strong> ${supervisor.email}</p>
                <p><strong>الرمز الخاص:</strong> <code style="background: #f1f5f9; padding: 4px 8px; border-radius: 4px;">${supervisor.code}</code></p>
                <p><strong>تاريخ الإضافة:</strong> ${formatDate(supervisor.createdAt)}</p>
                <p><strong>الصلاحيات:</strong> عرض الطلبات، إضافة عروض أسعار</p>
            </div>
            <div class="supervisor-actions">
                <button class="btn btn-secondary btn-sm" onclick="deleteSupervisor('${supervisor.id}')">حذف</button>
            </div>
        </div>
    `).join('');
}

// ===== حذف مشرف =====
function deleteSupervisor(supervisorId) {
    if (confirm('هل أنت متأكد من حذف هذا المشرف؟')) {
        supervisors = supervisors.filter(s => s.id !== supervisorId);
        saveToStorage();
        loadSupervisorsList();
        showToast('تم حذف المشرف', 'success');
    }
}

// ===== تحميل سجل الإشعارات =====
function loadNotificationsList() {
    const notificationsList = document.getElementById('notifications-log');
    if (!notificationsList) return;

    if (notifications.length === 0) {
        notificationsList.innerHTML = '<p class="empty-state">لا توجد إشعارات</p>';
        return;
    }

    notificationsList.innerHTML = notifications.slice().reverse().map(notification => `
        <div class="notification-item">
            <div class="notification-header">
                <div class="notification-channels">
                    <span class="status-badge active" style="background: #e0f2fe; color: #0369a1;">
                        ✉️ بريد: تم الإرسال
                    </span>
                    <span class="status-badge active" style="background: #dcfce7; color: #15803d;">
                        💬 واتساب: تم الإرسال
                    </span>
                </div>
                <span class="notification-time">${formatDate(notification.timestamp)}</span>
            </div>
            <p><strong>إلى:</strong> ${notification.customerName}</p>
            <p><strong>البيانات:</strong> ${notification.customerEmail} | ${notification.customerPhone}</p>
            <p class="notification-message">${notification.message}</p>
            <div class="notification-actions" style="margin-top: 10px; display: flex; gap: 8px;">
                <a href="${notification.links?.email || '#'}" class="btn btn-secondary btn-sm">فتح في البريد</a>
                <a href="${notification.links?.whatsapp || '#'}" target="_blank" class="btn btn-secondary btn-sm" style="background: #25d366; color: white; border: none;">فتح في واتساب</a>
            </div>
        </div>
    `).join('');
}

// ===== تصفية الإشعارات =====
function filterNotifications() {
    const status = document.getElementById('notifications-status-filter').value;
    const notificationsList = document.getElementById('notifications-log');

    let filteredNotifications = notifications;

    if (status !== 'all') {
        filteredNotifications = notifications.filter(n => n.status === status);
    }

    if (filteredNotifications.length === 0) {
        notificationsList.innerHTML = '<p class="empty-state">لا توجد إشعارات</p>';
        return;
    }

    notificationsList.innerHTML = filteredNotifications.slice().reverse().map(notification => `
        <div class="notification-item">
            <div class="notification-header">
                <span class="notification-status ${notification.status === 'sent' ? 'success' : 'failed'}">
                    ${notification.status === 'sent' ? '✓ تم الإرسال' : '✗ فشل الإرسال'}
                </span>
                <span class="notification-time">${formatDate(notification.timestamp)}</span>
            </div>
            <p><strong>إلى:</strong> ${notification.customerName} (${notification.customerPhone})</p>
            <p class="notification-message">${notification.message}</p>
        </div>
    `).join('');
}

// ===== حفظ قالب الإشعارات =====
function saveNotificationTemplate(event) {
    event.preventDefault();

    notificationTemplate = document.getElementById('notification-template').value;
    localStorage.setItem('admin_notificationTemplate', notificationTemplate);

    showToast('تم حفظ قالب الرسالة', 'success');
}

// ===== تحميل بيانات الإعدادات =====
function loadSettingsData() {
    document.getElementById('settings-total-orders').textContent = orders.length;
    document.getElementById('settings-total-customers').textContent = customers.length;
    document.getElementById('settings-total-supervisors').textContent = supervisors.length;
    document.getElementById('settings-total-notifications').textContent = notifications.length;
}

// ===== تصدير البيانات =====
function exportData() {
    const data = {
        orders,
        customers,
        supervisors,
        notifications,
        quotes,
        exportDate: new Date().toISOString()
    };

    const dataStr = JSON.stringify(data, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `map-supplies-data-${Date.now()}.json`;
    link.click();

    showToast('تم تصدير البيانات بنجاح', 'success');
}

// ===== مسح جميع البيانات =====
function clearAllData() {
    if (confirm('هل أنت متأكد من مسح جميع البيانات؟ هذا الإجراء لا يمكن التراجع عنه!')) {
        if (confirm('تأكيد نهائي: سيتم مسح جميع الطلبات والعملاء والإشعارات!')) {
            localStorage.clear();
            showToast('تم مسح جميع البيانات. سيتم إعادة تحميل الصفحة...', 'success');
            setTimeout(() => {
                location.reload();
            }, 2000);
        }
    }
}

// ===== دوال مساعدة =====
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function generateSupervisorCode() {
    return 'SUP-' + Math.random().toString(36).substr(2, 6).toUpperCase();
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// ===== إدارة الفئات (للمدير الرئيسي فقط) =====
function loadCategoriesAdmin() {
    const categoriesList = document.getElementById('categories-list-admin');
    if (!categoriesList) return;

    if (categories.length === 0) {
        categoriesList.innerHTML = '<p class="empty-state">لا توجد فئات حالياً</p>';
        return;
    }

    categoriesList.innerHTML = categories.map(cat => `
        <div class="activity-item">
            <div class="activity-icon">${cat.icon}</div>
            <div class="activity-content">
                <p class="activity-title">${cat.name}</p>
                <p class="activity-time">المعرف: ${cat.id}</p>
            </div>
            <button class="btn btn-secondary btn-sm" onclick="deleteCategory('${cat.id}')">حذف</button>
        </div>
    `).join('');
}

function handleAddCategory(event) {
    event.preventDefault();

    if (currentUser.role !== 'admin') {
        showToast('ليس لديك صلاحية لإضافة فئات', 'error');
        return;
    }

    const name = document.getElementById('category-name').value;
    const icon = document.getElementById('category-icon').value;
    const id = generateId().substring(0, 8);

    const newCategory = { id, name, icon };
    categories.push(newCategory);

    saveToStorage();
    document.getElementById('add-category-form').reset();
    loadCategoriesAdmin();
    showToast('تم إضافة الفئة بنجاح', 'success');
}

function deleteCategory(id) {
    if (currentUser.role !== 'admin') {
        showToast('ليس لديك صلاحية لحذف فئات', 'error');
        return;
    }

    if (confirm('هل أنت متأكد من حذف هذه الفئة؟')) {
        categories = categories.filter(cat => cat.id !== id);
        saveToStorage();
        loadCategoriesAdmin();
        showToast('تم حذف الفئة بنجاح', 'success');
    }
}

// ===== Toast للإشعارات =====
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.className = 'toast ' + type;
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}
