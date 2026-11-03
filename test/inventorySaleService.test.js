const test = require('node:test');
const assert = require('node:assert/strict');
const { buildInventorySale } = require('../services/inventorySaleService');

test('convierte un pedido confirmado en una salida FIFO idempotente', () => {
    const sale = buildInventorySale({
        _id: 'order-1',
        orderNumber: 'PED-001',
        products: [{ productId: 'product-1', title: 'Cubeta Silicona con Tapa', qty: 2, valid_price: 25 }]
    });

    assert.deepEqual(sale, {
        idempotencyKey: 'order:order-1',
        referenceType: 'order',
        referenceId: 'order-1',
        type: 'sale',
        reason: 'Venta del pedido PED-001',
        lines: [{ productId: 'product-1', quantity: 2, unitSalePrice: 25 }]
    });
});

test('conserva el SKU de variación para descontar el lote correcto', () => {
    const sale = buildInventorySale({
        _id: 'order-2',
        products: [{ productId: 'product-1', variationSku: 'SIL-TAPA-ROJA', qty: 1, valid_price: 30 }]
    });

    assert.equal(sale.lines[0].variationSku, 'SIL-TAPA-ROJA');
});
