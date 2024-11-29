const mongoose = require('mongoose');
const ksuid = require('ksuid');
const moment = require('moment-timezone'); 

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
    createdAt: { type: Date }
});

orderSchema.pre('save', async function (next) {
    const order = this;

    if (order.isNew) {
        try {

            const country = order.clientInfo.country || 'America/Lima';  
            const now = moment.tz(country);

            order.createdAt = now.toDate();

            const timestamp = now.valueOf();
            const ksuidString = await ksuid.random(); 
            const randomPart = ksuidString.string.slice(0, 7); 

            order.orderNumber = `${timestamp}${randomPart}`;

            next(); 
        } catch (error) {
            next(error);  
        }
    } else {
        next();  
    }
});

module.exports = mongoose.model('Order', orderSchema);
