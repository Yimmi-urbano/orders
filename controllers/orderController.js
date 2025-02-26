const Order = require('../models/Order');
const { handleError } = require('../utils/errorHandler');
const moment = require('moment-timezone');

exports.createOrder = async (req, res) => {
    try {
        const domain = req.headers['domain'];
        const { products, clientInfo, billingInfo, shippingInfo, currency, total } = req.body;

        const order = new Order({
            domain,
            products,
            clientInfo,
            billingInfo,
            shippingInfo,
            total,
            currency
        });

        const savedOrder = await order.save();
        res.status(201).json(savedOrder);
    } catch (error) {
        handleError(res, error);
    }
};

exports.getOrders = async (req, res) => {
    try {
        const domain = req.headers['domain'];
        if (!domain) {
            return res.status(400).json({ status: false, message: 'El dominio es requerido' });
        }

        const { clientName, orderNumber, page = 1 } = req.query;

        const filter = { domain };

        if (clientName) {
            filter['clientInfo.name'] = { $regex: clientName, $options: 'i' };
        }
        if (orderNumber) {
            filter.orderNumber = orderNumber;
        }

        const limit = 20;
        const skip = (page - 1) * limit;

        const orders = await Order.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(); // Convierte documentos a objetos JavaScript simples

        const totalRecords = await Order.countDocuments(filter);
        const totalPages = Math.ceil(totalRecords / limit);

        if (orders.length === 0) {
            return res.status(404).json({ status: false, message: 'No se encontraron registros' });
        }

        // Formatear fechas antes de enviarlas en la respuesta
        const formattedOrders = orders.map(order => ({
            ...order,
            createdAt: moment(order.createdAt).tz("America/Lima").format("DD-MM-YYYY"),
            paymentStatus: {
                ...order.paymentStatus,
                date: order.paymentStatus?.date 
                    ? moment(order.paymentStatus.date).tz("America/Lima").format("DD-MM-YYYY") 
                    : null
            }
        }));

        res.status(200).json({
            status: true,
            data: formattedOrders,
            pagination: {
                currentPage: Number(page),
                totalPages,
                totalRecords
            }
        });
    } catch (error) {
        handleError(res, error);
    }
};


exports.getOrderByDomainAndOrderNumber = async (req, res) => {
    try {
        const domain = req.headers['domain'];
        const { orderNumber } = req.params;

        if (!domain || !orderNumber) {
            return res.status(400).json({ status: false, message: 'Faltan parámetros necesarios' });
        }

        const order = await Order.findOne({ domain, orderNumber });
        if (!order) {
            return res.status(404).json({ status: false, message: 'Pedido no encontrado' });
        }
        res.status(200).json(order);
    } catch (error) {
        console.error('Error al obtener el pedido:', error);
        handleError(res, error);
    }
};

exports.updatePaymentStatus = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { typeStatus, message, methodPayment } = req.body;

        if (!orderId) {
            return res.status(400).json({ message: "El ID del pedido es requerido." });
        }

        const paymentDate = moment.tz('America/Lima').toDate();

        const updatedOrder = await Order.findByIdAndUpdate(
            orderId,
            {
                $set: {
                    "paymentStatus.typeStatus": typeStatus,
                    "paymentStatus.message": message || "",
                    "paymentStatus.methodPayment": methodPayment || null,
                    "paymentStatus.date": paymentDate
                }
            },
            { new: true }
        );

        if (!updatedOrder) {
            return res.status(404).json({ message: "Pedido no encontrado." });
        }

        res.status(200).json({ status: true, message: "Estado de pago actualizado.", data: updatedOrder });
    } catch (error) {
        console.error("Error actualizando estado de pago:", error);
        res.status(500).json({ status: false, message: "Error interno del servidor." });
    }
};

exports.updateOrderStatus = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { typeStatus, message } = req.body;

        if (!orderId) {
            return res.status(400).json({ message: "El ID del pedido es requerido." });
        }

        const statusDate = moment.tz('America/Lima').toDate();

        const updatedOrder = await Order.findByIdAndUpdate(
            orderId,
            {
                $set: {
                    "orderStatus.typeStatus": typeStatus,
                    "orderStatus.message": message || "",
                    "orderStatus.date": statusDate
                }
            },
            { new: true }
        );

        if (!updatedOrder) {
            return res.status(404).json({ message: "Pedido no encontrado." });
        }

        res.status(200).json({ status: true, message: "Estado del pedido actualizado.", data: updatedOrder });
    } catch (error) {
        console.error("Error actualizando estado del pedido:", error);
        res.status(500).json({ status: false, message: "Error interno del servidor." });
    }
};


exports.getTopSellingProduct = async (req, res) => {
    try {
        const domain = req.headers['domain'];
        if (!domain) {
            return res.status(400).json({ status: false, message: 'El dominio es requerido' });
        }

        const orders = await Order.aggregate([
            { $match: { domain, 'paymentStatus.typeStatus': 'completed' } },
            { $unwind: "$products" },
            { $group: {
                _id: "$products.productId",
                name: { $first: "$products.title" },
                image: { $first: "$products.image" },
                slugs: { $push: "$products.slug" },
                totalSold: { $sum: "$products.qty" }
            }},
            { $addFields: { slug: { $arrayElemAt: ["$slugs", 0] } } },
            { $project: { slugs: 0 } }, 
            { $sort: { totalSold: -1 } },
            { $limit: 1 }
        ]);

        if (orders.length === 0) {
            return res.status(404).json({ status: false, message: 'No hay productos vendidos' });
        }

        res.status(200).json({ status: true, data: orders[0] });
    } catch (error) {
        handleError(res, error);
    }
};

exports.getDailySales = async (req, res) => {
    try {
        let { startDate, endDate } = req.query;
        const domain = req.headers.domain;

        if (!startDate || !endDate || !domain) {
            return res.status(400).json({ 
                status: false, 
                message: 'Debe proporcionar startDate, endDate en formato YYYY-MM-DD en query params y domain en headers.' 
            });
        }

        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

        if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
            return res.status(400).json({ 
                status: false, 
                message: 'El formato de fecha es incorrecto. Use YYYY-MM-DD. Ejemplo: startDate=2025-01-01&endDate=2025-07-31' 
            });
        }

        if (!moment(startDate, 'YYYY-MM-DD', true).isValid() || !moment(endDate, 'YYYY-MM-DD', true).isValid()) {
            return res.status(400).json({ 
                status: false, 
                message: 'Las fechas proporcionadas no son válidas. Use el formato YYYY-MM-DD.' 
            });
        }

        // Convertir a zona horaria America/Lima
        startDate = moment.tz(startDate, 'YYYY-MM-DD', 'America/Lima').startOf('day').toDate();
        endDate = moment.tz(endDate, 'YYYY-MM-DD', 'America/Lima').endOf('day').toDate();

        const sales = await Order.aggregate([
            {
                $match: {
                    domain: domain,
                    createdAt: { $gte: startDate, $lte: endDate },
                    'paymentStatus.typeStatus': 'completed'
                }
            },
            {
                $group: {
                    _id: { 
                        day: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "America/Lima" } }, 
                        dayOfWeek: { $dayOfWeek: "$createdAt" } 
                    },
                    uv: { $sum: '$total' }
                }
            },
            { $sort: { '_id.day': 1 } },
            {
                $project: {
                    _id: 0,
                    name: '$_id.day',
                    day: {
                        $switch: {
                            branches: [
                                { case: { $eq: ["$_id.dayOfWeek", 1] }, then: "Domingo" },
                                { case: { $eq: ["$_id.dayOfWeek", 2] }, then: "Lunes" },
                                { case: { $eq: ["$_id.dayOfWeek", 3] }, then: "Martes" },
                                { case: { $eq: ["$_id.dayOfWeek", 4] }, then: "Miércoles" },
                                { case: { $eq: ["$_id.dayOfWeek", 5] }, then: "Jueves" },
                                { case: { $eq: ["$_id.dayOfWeek", 6] }, then: "Viernes" },
                                { case: { $eq: ["$_id.dayOfWeek", 7] }, then: "Sábado" }
                            ],
                            default: "Desconocido"
                        }
                    },
                    uv: { $toDouble: { $round: ["$uv", 2] } }
                }
            }
        ]);

        // Calcular la suma total de uv y la cantidad de registros en `data`
        const totalUv = sales.reduce((sum, item) => sum + item.uv, 0);
        const totalCount = sales.length; // Número de registros en `data`

        return res.status(200).json({ 
            status: true, 
            data: sales, 
            totalUv: Math.round(totalUv * 100) / 100, 
            totalCount // Número de elementos en `data`
        });
    } catch (error) {
        console.error('Error obteniendo ventas diarias:', error);
        return res.status(500).json({ status: false, message: 'Error interno del servidor.' });
    }
};

