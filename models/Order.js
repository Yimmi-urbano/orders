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

orderSchema.pre('save', async function (next) {
    const order = this;

    if (order.isNew) {
        try {
            const randomOrderNumber = Math.floor(1000000000 + Math.random() * 9000000000); // Genera entre 1000000000 y 9999999999
            order.orderNumber = randomOrderNumber.toString();
            next();
        } catch (error) {
            next(error);
        }
    } else {
        next();
    }
});

module.exports = mongoose.model('Order', orderSchema);
