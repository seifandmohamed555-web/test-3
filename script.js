/* ========================================
   MAP Supplies - ملف JavaScript للعملاء فقط
   جميع الوظائف الخاصة بالعملاء فقط
   ======================================== */

// ===== المتغيرات العامة =====
let currentUser = null;
let cart = [];
let customerOrders = [];
let customerQuotes = [];
let categories = [
    { id: 'electronics', name: 'إلكترونيات', icon: '💻' },
    { id: 'furniture', name: 'أثاث', icon: '🪑' },
    { id: 'office', name: 'مستلزمات مكتبية', icon: '📎' },
    { id: 'industrial', name: 'معدات صناعية', icon: '🏭' },
    { id: 'food', name: 'مواد غذائية', icon: '🍽️' },
    { id: 'medical', name: 'مستلزمات طبية', icon: '⚕️' },
    { id: 'other', name: 'أخرى', icon: '📌' }
];
let selectedCategory = 'all';
let resetEmail = '';

// ===== تهيئة التطبيق =====
document.addEventListener('DOMContentLoaded', async function () {
    await initializeApp();
    checkSession();
});

async function initializeApp() {
    // تهيئة قواعد البيانات
    if (typeof MAP_DB !== 'undefined') await MAP_DB.init();
    if (typeof MAP_CLOUD !== 'undefined') await MAP_CLOUD.init();

    // تحميل البيانات
    await loadFromStorage();

    // تهيئة EmailJS
    if (typeof emailjs !== 'undefined') {
        emailjs.init("vcHKe7GLjFyqTEKti");
    }

    // إضافة بيانات تجريبية (للسحابة إذا كانت فارغة)
    const checkCustomers = await MAP_CLOUD.getAll('customers');
    if (checkCustomers.length === 0) {
        addSampleData();
    }
}

async function loadFromStorage() {
    // تحميل السلة الخاصة بالعميل فقط (محلياً)
    cart = JSON.parse(localStorage.getItem('customer_cart')) ?? [];

    // تحميل البيانات المشتركة من السحابة
    if (typeof MAP_CLOUD !== 'undefined') {
        const cloudCats = await MAP_CLOUD.getSetting('admin_categories');
        if (cloudCats) categories = cloudCats;
    } else {
        categories = JSON.parse(localStorage.getItem('admin_categories')) ?? categories;
    }
}

function saveCart() {
    localStorage.setItem('customer_cart', JSON.stringify(cart));

    // حفظ احتياطي في قاعدة البيانات
    if (typeof MAP_DB !== 'undefined' && MAP_DB.db) {
        MAP_DB.setSetting('customer_cart', cart);
    }
}

async function addSampleData() {
    // إضافة عميل تجريبي في السحابة
    const sampleCustomer = {
        id: generateId(),
        companyName: 'شركة التوريدات المتحدة',
        phone: '+201234567890',
        email: 'test@map.com',
        password: '123',
        taxNumber: '123-456-789',
        address: 'القاهرة، مصر',
        whatsappPhone: '+201234567890',
        createdAt: new Date().toISOString(),
        isBlocked: false
    };

    if (typeof MAP_CLOUD !== 'undefined') {
        await MAP_CLOUD.save('customers', sampleCustomer);
        await MAP_CLOUD.setSetting('admin_categories', categories);
    }
}

// ===== إدارة الجلسات =====
function checkSession() {
    const session = JSON.parse(localStorage.getItem('customerSession'));

    if (session) {
        const sessionTime = new Date(session.timestamp);
        const now = new Date();
        const hoursDiff = (now - sessionTime) / (1000 * 60 * 60);

        if (hoursDiff < 24) {
            currentUser = session.user;
            showCustomerDashboard();
        } else {
            localStorage.removeItem('customerSession');
            showToast('انتهت صلاحية الجلسة. يرجى تسجيل الدخول مرة أخرى.', 'warning');
        }
    }
}

function createSession(user) {
    const session = {
        user: user,
        timestamp: new Date().toISOString()
    };
    localStorage.setItem('customerSession', JSON.stringify(session));
    currentUser = user;
}

function destroySession() {
    localStorage.removeItem('customerSession');
    currentUser = null;
}

// ===== التنقل بين الصفحات =====
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    document.getElementById(pageId).classList.add('active');
}

function showLandingPage() {
    showPage('landing-page');
}

function showLoginPage() {
    showPage('login-page');
}

function showRegisterPage() {
    showPage('register-page');
}

function showCustomerDashboard() {
    showPage('customer-dashboard');
    showCustomerSection('home');
    loadCustomerData();
}

function scrollToFeatures() {
    document.getElementById('features').scrollIntoView({ behavior: 'smooth' });
}

// ===== التنقل بين أقسام لوحة العميل =====
function showCustomerSection(sectionId) {
    document.querySelectorAll('#customer-dashboard .dashboard-section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById('customer-' + sectionId).classList.add('active');

    document.querySelectorAll('#customer-dashboard .nav-link').forEach(link => {
        link.classList.remove('active');
    });
    event?.target?.classList.add('active');

    if (sectionId === 'home') {
        loadRecentOrders();
    } else if (sectionId === 'new-order') {
        renderCategories();
        document.getElementById('new-order-form').reset();
    } else if (sectionId === 'my-orders') {
        loadCustomerOrders();
    } else if (sectionId === 'cart') {
        displayCart();
    } else if (sectionId === 'settings') {
        loadCustomerSettings();
    }
}

// ===== تسجيل الدخول =====
function handleLogin(event) {
    event.preventDefault();

    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    // التحقق من العملاء فقط
    const customers = JSON.parse(localStorage.getItem('admin_customers')) || [];
    const customer = customers.find(c => c.email === email && c.password === password);

    if (customer) {
        if (customer.isBlocked) {
            showToast('تم حظر حسابك. يرجى التواصل مع الإدارة.', 'error');
            return;
        }
        createSession({ ...customer, role: 'customer' });
        showCustomerDashboard();
        showToast('مرحباً بك ' + customer.companyName, 'success');
        return;
    }

    showToast('البريد الإلكتروني أو كلمة المرور غير صحيحة', 'error');
}

// ===== التسجيل =====
function handleRegister(event) {
    event.preventDefault();

    const companyName = document.getElementById('company-name').value;
    const phone = document.getElementById('phone').value;
    const email = document.getElementById('register-email').value;
    const taxNumber = document.getElementById('tax-number').value;
    const address = document.getElementById('address').value;
    const whatsappPhone = document.getElementById('whatsapp-phone').value;
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;

    // التحقق من تطابق كلمة المرور
    if (password !== confirmPassword) {
        showToast('كلمة المرور غير متطابقة', 'error');
        return;
    }

    // التحقق من عدم وجود البريد الإلكتروني مسبقاً
    const customers = JSON.parse(localStorage.getItem('admin_customers')) || [];
    if (customers.some(c => c.email === email)) {
        showToast('البريد الإلكتروني مستخدم بالفعل', 'error');
        return;
    }

    // إنشاء حساب جديد
    const newCustomer = {
        id: generateId(),
        companyName,
        phone,
        email,
        taxNumber,
        address,
        whatsappPhone,
        password,
        createdAt: new Date().toISOString(),
        isBlocked: false
    };

    customers.push(newCustomer);
    localStorage.setItem('admin_customers', JSON.stringify(customers));

    // حفظ في قاعدة البيانات الاحترافية
    if (typeof MAP_DB !== 'undefined' && MAP_DB.db) {
        MAP_DB.save('customers', newCustomer);
    }

    showToast('تم إنشاء الحساب بنجاح! يمكنك الآن تسجيل الدخول.', 'success');

    // الانتقال لصفحة تسجيل الدخول
    setTimeout(() => {
        showLoginPage();
        document.getElementById('login-email').value = email;
    }, 1500);
}

// ===== تسجيل الخروج =====
function handleLogout() {
    destroySession();
    cart = [];
    saveCart();
    showLandingPage();
    showToast('تم تسجيل الخروج بنجاح', 'success');
}

// ===== استعادة كلمة المرور =====
function showForgotPassword() {
    document.getElementById('forgot-password-modal').classList.add('active');
    document.getElementById('forgot-step-1').style.display = 'block';
    document.getElementById('forgot-step-2').style.display = 'none';
}

function closeForgotPasswordModal() {
    document.getElementById('forgot-password-modal').classList.remove('active');
}

function handleForgotPasswordRequest(event) {
    event.preventDefault();
    const email = document.getElementById('forgot-email').value;

    const customers = JSON.parse(localStorage.getItem('admin_customers')) || [];
    const customer = customers.find(c => c.email === email);

    if (customer) {
        resetEmail = email;
        // الانتقال المباشر للخطوة الثانية (محاكاة سريعة بطلب من المستخدم)
        document.getElementById('forgot-step-1').style.display = 'none';
        document.getElementById('forgot-step-2').style.display = 'block';
        showToast('تم التحقق من الحساب بنجاح. أدخل الرمز 1234 وكلمة المرور الجديدة.', 'info');
    } else {
        showToast('هذا البريد الإلكتروني غير مسجل لدينا', 'error');
    }
}

function handleResetPassword(event) {
    event.preventDefault();
    const code = document.getElementById('reset-code').value;
    const newPassword = document.getElementById('new-reset-password').value;

    if (code === '1234') {
        const customers = JSON.parse(localStorage.getItem('admin_customers')) || [];
        const customer = customers.find(c => c.email === resetEmail);

        if (customer) {
            customer.password = newPassword;
            localStorage.setItem('admin_customers', JSON.stringify(customers));
            showToast('تمت إعادة ضبط كلمة المرور بنجاح. يمكنك الآن تسجيل الدخول.', 'success');
            closeForgotPasswordModal();
            showLoginPage();
        }
    } else {
        showToast('رمز التحقق غير صحيح', 'error');
    }
}

// ===== اختيار الفئة =====
function selectCategory(category) {
    document.querySelectorAll('.category-item').forEach(item => {
        item.classList.remove('active');
    });
    event.target.classList.add('active');
}

// ===== إضافة منتج للسلة =====
function addToCart(event) {
    event.preventDefault();

    const productName = document.getElementById('product-name').value;
    const quantity = parseInt(document.getElementById('quantity').value);
    const productType = document.getElementById('product-type').value;
    const productNotes = document.getElementById('product-notes').value;
    const productImage = document.getElementById('product-image').files[0];

    const cartItem = {
        id: generateId(),
        productName,
        quantity,
        productType,
        productNotes,
        image: null
    };

    // معالجة الصورة
    if (productImage) {
        const reader = new FileReader();
        reader.onload = function (e) {
            cartItem.image = e.target.result;
            cart.push(cartItem);
            saveCart();
            updateCartBadge();
            showToast('تمت إضافة المنتج للسلة', 'success');
            resetOrderForm();
        };
        reader.readAsDataURL(productImage);
    } else {
        cart.push(cartItem);
        saveCart();
        updateCartBadge();
        showToast('تمت إضافة المنتج للسلة', 'success');
        resetOrderForm();
    }
}

// ===== معاينة الصورة =====
function previewImage(event) {
    const file = event.target.files[0];
    const preview = document.getElementById('image-preview');

    if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            preview.innerHTML = `<img src="${e.target.result}" alt="معاينة">`;
            preview.classList.add('active');
        };
        reader.readAsDataURL(file);
    } else {
        preview.innerHTML = '';
        preview.classList.remove('active');
    }
}

// ===== إعادة تعيين نموذج الطلب =====
function resetOrderForm() {
    document.getElementById('new-order-form').reset();
    document.getElementById('image-preview').innerHTML = '';
    document.getElementById('image-preview').classList.remove('active');
}

// ===== تحديث شارة السلة =====
function updateCartBadge() {
    const badge = document.getElementById('cart-badge');
    const stat = document.getElementById('cart-items-stat');
    badge.textContent = cart.length;
    if (stat) stat.textContent = cart.length;
}

// ===== عرض السلة =====
function displayCart() {
    const cartContainer = document.getElementById('cart-items');
    const cartSummary = document.getElementById('cart-summary');

    if (cart.length === 0) {
        cartContainer.innerHTML = '<p class="empty-state">السلة فارغة</p>';
        cartSummary.style.display = 'none';
        return;
    }

    cartContainer.innerHTML = cart.map((item, index) => `
        <div class="cart-item">
            <div class="item-image">
                ${item.image ? `<img src="${item.image}" alt="${item.productName}" style="width: 100px; height: 100px; object-fit: cover; border-radius: 8px;">` : '<div style="width: 100px; height: 100px; background: #e2e8f0; border-radius: 8px; display: flex; align-items: center; justify-content: center;">📦</div>'}
            </div>
            <div class="item-details">
                <h4>${item.productName}</h4>
                <p>الكمية: ${item.quantity}</p>
                ${item.productType ? `<p>النوع: ${item.productType}</p>` : ''}
                ${item.productSpecs ? `<p>المواصفات: ${item.productSpecs}</p>` : ''}
                ${item.productNotes ? `<p>ملاحظات: ${item.productNotes}</p>` : ''}
            </div>
            <button class="btn btn-secondary btn-sm" onclick="removeFromCart(${index})">حذف</button>
        </div>
    `).join('');

    document.getElementById('cart-total-items').textContent = cart.length;
    cartSummary.style.display = 'block';
}

// ===== حذف من السلة =====
function removeFromCart(index) {
    cart.splice(index, 1);
    saveCart();
    updateCartBadge();
    displayCart();
    showToast('تم حذف المنتج من السلة', 'success');
}

// ===== إفراغ السلة =====
function clearCart() {
    if (confirm('هل أنت متأكد من إفراغ السلة؟')) {
        cart = [];
        saveCart();
        updateCartBadge();
        displayCart();
        showToast('تم إفراغ السلة', 'success');
    }
}

// ===== إرسال الطلب =====
function submitOrder() {
    if (cart.length === 0) {
        showToast('السلة فارغة', 'error');
        return;
    }

    const order = {
        id: generateId(),
        customerId: currentUser.id,
        customerName: currentUser.companyName,
        customerEmail: currentUser.email,
        items: [...cart],
        status: 'pending',
        createdAt: new Date().toISOString()
    };

    // حفظ الطلب في بيانات الإدارة
    const orders = JSON.parse(localStorage.getItem('admin_orders')) || [];
    orders.push(order);
    localStorage.setItem('admin_orders', JSON.stringify(orders));

    // حفظ في قاعدة البيانات الاحترافية
    if (typeof MAP_DB !== 'undefined' && MAP_DB.db) {
        MAP_DB.save('orders', order);
    }

    cart = [];
    saveCart();
    updateCartBadge();

    showToast('تم إرسال الطلب بنجاح! سيتم مراجعته قريباً.', 'success');
    showCustomerSection('my-orders');
}

// ===== عرض طلبات العميل =====
function loadCustomerOrders() {
    const ordersList = document.getElementById('orders-list');
    const allOrders = JSON.parse(localStorage.getItem('admin_orders')) || [];
    const myOrders = allOrders.filter(o => o.customerId === currentUser.id);

    if (myOrders.length === 0) {
        ordersList.innerHTML = '<p class="empty-state">لا توجد طلبات حتى الآن</p>';
        return;
    }

    ordersList.innerHTML = myOrders.slice().reverse().map(order => createOrderCard(order)).join('');
}

// ===== تصفية الطلبات =====
function filterOrders() {
    const status = document.getElementById('orders-status-filter').value;
    const ordersList = document.getElementById('orders-list');
    const allOrders = JSON.parse(localStorage.getItem('admin_orders')) || [];
    let myOrders = allOrders.filter(o => o.customerId === currentUser.id);

    if (status !== 'all') {
        myOrders = myOrders.filter(o => o.status === status);
    }

    if (myOrders.length === 0) {
        ordersList.innerHTML = '<p class="empty-state">لا توجد طلبات</p>';
        return;
    }

    ordersList.innerHTML = myOrders.slice().reverse().map(order => createOrderCard(order)).join('');
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

    const allQuotes = JSON.parse(localStorage.getItem('admin_quotes')) || [];
    const orderQuotes = allQuotes.filter(q => q.orderId === order.id);

    return `
        <div class="order-card">
            <div class="order-header">
                <span class="order-id">طلب #${order.id.substring(0, 8)}</span>
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
                            </div>
                        </div>
                    `).join('')}
                </div>
                ${orderQuotes.length > 0 ? `
                    <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border-color);">
                        <h4>عروض الأسعار (${orderQuotes.length})</h4>
                        ${orderQuotes.map(quote => {
        let priceColor = 'inherit';
        if (quote.status === 'accepted') priceColor = 'var(--success-color)';
        if (quote.status === 'rejected') priceColor = 'var(--danger-color)';

        return `
                            <div style="padding: 12px; background: #f8fafc; border-radius: 8px; margin-top: 8px;">
                                <p><strong>السعر:</strong> <span style="color: ${priceColor}; font-weight: bold;">${quote.price} ج.م</span></p>
                                <p><strong>مدة التسليم:</strong> ${quote.delivery}</p>
                                <p><strong>شروط الدفع:</strong> ${quote.payment}</p>
                                ${quote.notes ? `<p><strong>ملاحظات:</strong> ${quote.notes}</p>` : ''}
                                ${quote.status === 'pending' ? `
                                    <div style="display: flex; gap: 8px; margin-top: 8px;">
                                        <button class="btn btn-primary btn-sm" onclick="acceptQuote('${quote.id}', '${order.id}')">قبول</button>
                                        <button class="btn btn-secondary btn-sm" onclick="rejectQuote('${quote.id}')">رفض</button>
                                    </div>
                                ` : ''}
                                ${quote.status === 'accepted' ? '<p style="color: var(--success-color); font-weight: 600;">✓ تم القبول</p>' : ''}
                                ${quote.status === 'rejected' ? '<p style="color: var(--danger-color); font-weight: 600;">✗ تم الرفض</p>' : ''}
                            </div>
                        `;
    }).join('')}
                    </div>
                ` : ''}
            </div>
            <div class="order-footer">
                <span class="order-date">${formatDate(order.createdAt)}</span>
            </div>
        </div>
    `;
}

// ===== قبول عرض السعر =====
function acceptQuote(quoteId, orderId) {
    const quotes = JSON.parse(localStorage.getItem('admin_quotes')) || [];
    const quote = quotes.find(q => q.id === quoteId);

    if (quote) {
        quote.status = 'accepted';
        localStorage.setItem('admin_quotes', JSON.stringify(quotes));

        const orders = JSON.parse(localStorage.getItem('admin_orders')) || [];
        const order = orders.find(o => o.id === orderId);
        if (order) {
            order.status = 'approved';
            localStorage.setItem('admin_orders', JSON.stringify(orders));

            // تحديث قاعدة البيانات الاحترافية
            if (typeof MAP_DB !== 'undefined' && MAP_DB.db) {
                MAP_DB.save('orders', order);
            }
        }

        // تحديث قاعدة البيانات الاحترافية
        if (typeof MAP_DB !== 'undefined' && MAP_DB.db) {
            MAP_DB.save('quotes', quote);
        }

        loadCustomerOrders();
        showToast('تم قبول عرض السعر', 'success');
    }
}

// ===== رفض عرض السعر =====
function rejectQuote(quoteId) {
    const quotes = JSON.parse(localStorage.getItem('admin_quotes')) || [];
    const quote = quotes.find(q => q.id === quoteId);

    if (quote) {
        quote.status = 'rejected';
        localStorage.setItem('admin_quotes', JSON.stringify(quotes));

        // تحديث قاعدة البيانات الاحترافية
        if (typeof MAP_DB !== 'undefined' && MAP_DB.db) {
            MAP_DB.save('quotes', quote);
        }

        loadCustomerOrders();
        showToast('تم رفض عرض السعر', 'info');
    }
}

// ===== تحميل بيانات العميل =====
function loadCustomerData() {
    document.getElementById('customer-name').textContent = 'مرحباً ' + currentUser.companyName;
    updateCartBadge();
    updateCustomerStats();
    loadRecentOrders();
}

// ===== تحديث إحصائيات العميل =====
function updateCustomerStats() {
    const allOrders = JSON.parse(localStorage.getItem('admin_orders')) || [];
    const myOrders = allOrders.filter(o => o.customerId === currentUser.id);
    const pendingOrders = myOrders.filter(o => o.status === 'pending' || o.status === 'reviewing');
    const completedOrders = myOrders.filter(o => o.status === 'delivered');

    document.getElementById('total-orders-stat').textContent = myOrders.length;
    document.getElementById('pending-orders-stat').textContent = pendingOrders.length;
    document.getElementById('completed-orders-stat').textContent = completedOrders.length;
}

// ===== تحميل آخر الطلبات =====
function loadRecentOrders() {
    const recentOrdersList = document.getElementById('recent-orders-list');
    const allOrders = JSON.parse(localStorage.getItem('admin_orders')) || [];
    const myOrders = allOrders.filter(o => o.customerId === currentUser.id).slice(-3).reverse();

    if (myOrders.length === 0) {
        recentOrdersList.innerHTML = '<p class="empty-state">لا توجد طلبات حتى الآن</p>';
        return;
    }

    recentOrdersList.innerHTML = myOrders.map(order => createOrderCard(order)).join('');
}

// ===== تحميل إعدادات العميل =====
function loadCustomerSettings() {
    document.getElementById('settings-company').value = currentUser.companyName;
    document.getElementById('settings-phone').value = currentUser.phone;
    document.getElementById('settings-email').value = currentUser.email;
    document.getElementById('settings-tax').value = currentUser.taxNumber;
}

// ===== تحديث الإعدادات =====
function updateSettings(event) {
    event.preventDefault();

    const companyName = document.getElementById('settings-company').value;
    const phone = document.getElementById('settings-phone').value;
    const email = document.getElementById('settings-email').value;
    const taxNumber = document.getElementById('settings-tax').value;

    const customers = JSON.parse(localStorage.getItem('admin_customers')) || [];
    const customer = customers.find(c => c.id === currentUser.id);

    if (customer) {
        customer.companyName = companyName;
        customer.phone = phone;
        customer.email = email;
        customer.taxNumber = taxNumber;

        localStorage.setItem('admin_customers', JSON.stringify(customers));

        currentUser.companyName = companyName;
        currentUser.phone = phone;
        currentUser.email = email;
        currentUser.taxNumber = taxNumber;

        createSession(currentUser);

        showToast('تم حفظ التغييرات بنجاح', 'success');
    }
}

// ===== تغيير كلمة المرور =====
function changePassword(event) {
    event.preventDefault();

    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmNewPassword = document.getElementById('confirm-new-password').value;

    if (currentPassword !== currentUser.password) {
        showToast('كلمة المرور الحالية غير صحيحة', 'error');
        return;
    }

    if (newPassword !== confirmNewPassword) {
        showToast('كلمة المرور الجديدة غير متطابقة', 'error');
        return;
    }

    const customers = JSON.parse(localStorage.getItem('admin_customers')) || [];
    const customer = customers.find(c => c.id === currentUser.id);

    if (customer) {
        customer.password = newPassword;
        localStorage.setItem('admin_customers', JSON.stringify(customers));

        currentUser.password = newPassword;
        createSession(currentUser);

        document.getElementById('password-form').reset();
        showToast('تم تغيير كلمة المرور بنجاح', 'success');
    }
}

// ===== دوال مساعدة =====
// ===== إدارة الفئات والمنتجات =====
function renderCategories() {
    const categoriesContainer = document.querySelector('.categories-list');
    if (!categoriesContainer) return;

    let html = `
        <button class="category-item ${selectedCategory === 'all' ? 'active' : ''}" onclick="selectCategory('all')">
            <span>📦</span> جميع الفئات
        </button>
    `;

    html += categories.map(cat => `
        <button class="category-item ${selectedCategory === cat.id ? 'active' : ''}" onclick="selectCategory('${cat.id}')">
            <span>${cat.icon}</span> ${cat.name}
        </button>
    `).join('');

    categoriesContainer.innerHTML = html;
}

function selectCategory(categoryId) {
    selectedCategory = categoryId;
    renderCategories();

    // هنا يتم تصفية المنتجات في المستقبل
    // حالياً نقوم فقط بتحديث الواجهة
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
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

// ===== Toast للإشعارات =====
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = 'toast ' + type;
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// ===== تحديث الإحصائيات =====
function updateStats() {
    // لا شيء للعملاء
}

// ===== أيقونة دخول الإدارة =====
function showAdminAccessModal() {
    document.getElementById('admin-access-modal').classList.add('active');
    // التركيز على حقل الإدخال
    setTimeout(() => {
        document.getElementById('admin-access-code').focus();
    }, 100);
}

function closeAdminAccessModal() {
    document.getElementById('admin-access-modal').classList.remove('active');
    document.getElementById('admin-access-form').reset();
}

function verifyAdminAccess(event) {
    event.preventDefault();

    const code = document.getElementById('admin-access-code').value;

    if (code === 'map2026') {
        // التوجيه إلى صفحة الإدارة
        window.location.href = 'admin.html';
    } else {
        showToast('الرمز السري غير صحيح', 'error');
        document.getElementById('admin-access-code').value = '';
        document.getElementById('admin-access-code').focus();
    }
}

// إغلاق Modal عند الضغط خارجه
document.addEventListener('click', function (event) {
    const modal = document.getElementById('admin-access-modal');
    if (event.target === modal) {
        closeAdminAccessModal();
    }
});

