const DEFAULT_PRODUCTS_API_URL = 'https://api-products.creceidea.pe';

function productsApiUrl() {
    return (process.env.PRODUCTS_API_URL || DEFAULT_PRODUCTS_API_URL).replace(/\/$/, '');
}

function asPositiveNumber(value, field) {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) {
        throw new Error(`${field} inválido para sincronizar inventario.`);
    }
    return number;
}

function unitSalePrice(product) {
    const sale = Number(product.valid_price);
    if (Number.isFinite(sale) && sale >= 0) return sale;

    const promotional = Number(product.price_sale);
    const regular = Number(product.price_regular);
    if (Number.isFinite(promotional) && promotional > 0 && (!Number.isFinite(regular) || promotional < regular)) return promotional;
    if (Number.isFinite(regular) && regular >= 0) return regular;
    throw new Error(`No se encontró un precio válido para ${product.title || 'un producto'}.`);
}

function toInventoryLine(product) {
    if (!product?.productId) {
        throw new Error(`El pedido contiene un producto sin identificador inventariable (${product?.title || 'sin nombre'}).`);
    }
    return {
        productId: String(product.productId),
        ...(product.variationId ? { variationId: String(product.variationId) } : {}),
        ...(product.variationSku ? { variationSku: String(product.variationSku) } : {}),
        quantity: asPositiveNumber(product.qty ?? product.quantity, 'La cantidad'),
        unitSalePrice: unitSalePrice(product)
    };
}

function buildInventorySale(order) {
    const lines = Array.isArray(order?.products) ? order.products.map(toInventoryLine) : [];
    if (lines.length === 0) throw new Error('El pedido no contiene productos para descontar del inventario.');
    return {
        idempotencyKey: `order:${order._id}`,
        referenceType: 'order',
        referenceId: String(order._id),
        type: 'sale',
        reason: `Venta del pedido ${order.orderNumber || order._id}`,
        lines
    };
}

async function consumeOrderInventory(order) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
        const response = await fetch(`${productsApiUrl()}/api/inventory/consume`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                domain: order.domain
            },
            body: JSON.stringify(buildInventorySale(order)),
            signal: controller.signal
        });
        const body = await response.json().catch(() => null);
        if (!response.ok) {
            throw new Error(body?.message || `Inventario respondió HTTP ${response.status}.`);
        }
        return Array.isArray(body) ? body : [];
    } finally {
        clearTimeout(timeout);
    }
}

module.exports = {
    buildInventorySale,
    consumeOrderInventory,
    toInventoryLine,
    unitSalePrice
};
