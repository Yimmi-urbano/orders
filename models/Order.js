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

            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime(); 
            const hours = now.getHours().toString().padStart(2, '0'); 
            const seconds = now.getSeconds().toString().padStart(2, '0'); 
            order.orderNumber = `${startOfMonth}${hours}${seconds}`;

            next();
        } catch (error) {
            next(error);
        }
    } else {
        next();
    }
});

module.exports = mongoose.model('Order', orderSchema);
