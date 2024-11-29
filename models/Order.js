const mongoose = require('mongoose');

// Contador incremental en memoria para evitar colisiones por segundo
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
            // Fecha y hora actuales
            const now = new Date();

            // Timestamp del inicio del mes en milisegundos (13 dígitos)
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

            // Milisegundos actuales (3 dígitos)
            const milliseconds = now.getMilliseconds().toString().padStart(2, '0');

            // Incrementa el contador, reseteándolo a 0 si cambia el segundo
            counter = (counter + 1) % 1000; // Limitar el contador a 3 dígitos
            const counterStr = counter.toString().padStart(2, '0');

            // Genera 2 dígitos aleatorios
            const randomDigits = Math.floor(10 + Math.random() * 90).toString();

            // Combina los componentes en el orderNumber (20 dígitos)
            order.orderNumber = `${startOfMonth}${counterStr}${milliseconds}${randomDigits}`;
            next();
        } catch (error) {
            next(error);
        }
    } else {
        next();
    }
});

module.exports = mongoose.model('Order', orderSchema);
