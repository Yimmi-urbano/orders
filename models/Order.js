const mongoose = require('mongoose');
const ksuid = require('ksuid');

const orderSchema = new mongoose.Schema({
    orderNumber: { 
        type: String, 
        unique: true, 
        required: true,
        match: /^\d{20}$/ // Asegura que tenga exactamente 20 dígitos
    },
    domain: { type: String, required: true },
    products: [],
    clientInfo: {},
    billingInfo: {},
    shippingInfo: {},
    paymentStatus: { 
        type: String, 
        enum: ['pending', 'completed', 'failed'], 
        default: 'pending' 
    },
    total: { type: Number },
    currency: { type: String },
    orderStatus: { 
        type: String, 
        enum: ['pending', 'shipped', 'delivered', 'cancelled'], 
        default: 'pending' 
    },
    createdAt: { type: Date, default: Date.now }
});

// Generador de identificador numérico de 20 dígitos basado en ksuid
async function generateNumericOrderNumber() {
    const id = await ksuid.random(); // Genera un ksuid único
    const numericId = BigInt(`0x${id.string}`).toString(); // Convierte a un número decimal
    return numericId.slice(0, 20).padStart(20, '0'); // Ajusta a 20 dígitos
}

orderSchema.pre('save', async function (next) {
    const order = this;
    if (!order.orderNumber) { // Verifica si el campo no está definido
        try {
            const id = await ksuid.random(); // Genera el KSUID
            const numericId = BigInt(`0x${id.string}`).toString(); // Convierte a número
            order.orderNumber = numericId.slice(0, 20).padStart(20, '0'); // Ajusta a 20 dígitos
        } catch (error) {
            return next(error); // Propaga el error
        }
    }
    next();
});


module.exports = mongoose.model('Order', orderSchema);
