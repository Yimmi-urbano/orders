const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    orderNumber: { type: String, unique: true },
    domain: { type: String, required: true },
    products: [],
    clientInfo: {},
    billingInfo: {},
    shippingInfo: {},
    paymentStatus: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
    total: { type: Number },
    currency: { type: String },
    orderStatus: { type: String, enum: ['pending', 'shipped', 'delivered', 'cancelled'], default: 'pending' },
    createdAt: { type: Date, default: Date.now }
});

// Middleware para generar un orderNumber solo numérico
orderSchema.pre('save', async function (next) {
    const order = this;

    if (order.isNew) {
        try {
            // Genera un número basado en el timestamp y un sufijo aleatorio para evitar colisiones
            const timestamp = Date.now().toString(); // Timestamp actual en milisegundos
            const randomSuffix = Math.floor(Math.random() * 10000).toString().padStart(4, '0'); // Número aleatorio de 4 dígitos
            order.orderNumber = `${timestamp}${randomSuffix}`;
            next();
        } catch (error) {
            next(error);
        }
    } else {
        next();
    }
});

module.exports = mongoose.model('Order', orderSchema);
