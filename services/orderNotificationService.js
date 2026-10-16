const DEFAULT_CONFIGURATION_API_URL = 'https://api-configuration.creceidea.pe/api';
const DEFAULT_OPENWA_API_URL = 'https://message-wsp.agencsi.com/api';

const paymentStatusLabels = {
    pending: 'Pendiente',
    completed: 'Pagado',
    failed: 'Fallido',
    decline: 'Rechazado',
};

const orderStatusLabels = {
    pending: 'Pendiente',
    shipped: 'Enviado',
    delivered: 'Entregado',
    cancelled: 'Cancelado',
};

function getEnvironment(name, fallback) {
    return (process.env[name] || fallback || '').replace(/\/$/, '');
}

async function requestJson(url, options) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        const body = await response.json().catch(() => null);

        if (!response.ok) {
            throw new Error(body?.message || body?.error || `HTTP ${response.status}`);
        }

        return body;
    } finally {
        clearTimeout(timeout);
    }
}

function getCustomerName(clientInfo = {}) {
    const fullName = [clientInfo.first_name, clientInfo.last_name].filter(Boolean).join(' ').trim();
    return fullName || clientInfo.name || 'Cliente sin nombre';
}

function formatAmount(total, currency) {
    const amount = Number(total) || 0;
    const prefix = currency === 'PEN' ? 'S/' : `${currency || 'PEN'} `;
    return `${prefix} ${amount.toFixed(2)}`;
}

function formatProducts(products = []) {
    return products.map((product) => {
        const variation = product.variationName ? ` (${product.variationName})` : '';
        return `- ${product.title || 'Producto'}${variation} x ${product.qty || 1}`;
    }).join('\n');
}

function buildNewOrderMessage(order) {
    const paymentStatus = paymentStatusLabels[order.paymentStatus?.typeStatus] || 'Pendiente';
    const orderStatus = orderStatusLabels[order.orderStatus?.typeStatus] || 'Pendiente';

    return [
        'Nuevo pedido recibido',
        '',
        `Pedido: ${order.orderNumber}`,
        `Cliente: ${getCustomerName(order.clientInfo)}`,
        'Productos:',
        formatProducts(order.products),
        `Total: ${formatAmount(order.total, order.currency)}`,
        `Pago: ${paymentStatus}`,
        `Estado: ${orderStatus}`,
    ].join('\n');
}

async function getOrderNotificationSettings(domain) {
    const baseUrl = getEnvironment('CONFIGURATION_API_URL', DEFAULT_CONFIGURATION_API_URL);
    const response = await requestJson(`${baseUrl}/config/order-notifications`, {
        headers: { domain },
    });

    return response?.data || null;
}

async function notifyOwnerAboutNewOrder(order) {
    const openWaApiKey = process.env.OPENWA_API_KEY;
    const openWaBusinessId = process.env.OPENWA_BUSINESS_ID;

    if (!openWaApiKey || !openWaBusinessId) {
        return { skipped: true, reason: 'OpenWA no está configurado.' };
    }

    const settings = await getOrderNotificationSettings(order.domain);
    if (!settings?.isActive || !settings.phone) {
        return { skipped: true, reason: 'Las notificaciones están desactivadas para la tienda.' };
    }

    const baseUrl = getEnvironment('OPENWA_API_URL', DEFAULT_OPENWA_API_URL);
    await requestJson(`${baseUrl}/messages/${encodeURIComponent(openWaBusinessId)}/text`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': openWaApiKey,
        },
        body: JSON.stringify({
            to: settings.phone,
            message: buildNewOrderMessage(order),
        }),
    });

    return { skipped: false };
}

module.exports = {
    buildNewOrderMessage,
    notifyOwnerAboutNewOrder,
};
