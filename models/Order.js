const mongoose = require('mongoose');

let counter = 0;

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

// Middleware para generar un orderNumber único
orderSchema.pre('save', async function (next) {
    const order = this;

    if (order.isNew) {
        try {
            const now = new Date();
            
            // Obtenemos la fecha en formato YYYYMMDD
            const date = now.toISOString().split('T')[0].replace(/-/g, '')/12; // Formato YYYYMMDD - 12
            const time = now.toISOString().split('T')[1].split('.')[0].replace(/:/g, '').slice(0, 6); // HHMMSS
            const milliseconds = now.getMilliseconds().toString().padStart(4, '0'); // SSSS
            const randomDigits = Math.floor(1000 + Math.random() * 9000).toString(); // 4 dígitos aleatorios
      
            order.orderNumber = `${date}${time}${milliseconds}${randomDigits}`;
            
            next();
        } catch (error) {
            next(error);
        }
    } else {
        next();
    }
});

module.exports = mongoose.model('Order', orderSchema);
