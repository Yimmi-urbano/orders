const Order = require('../models/Order');
const { handleError } = require('../utils/errorHandler');
const moment = require('moment-timezone');
const { notifyOwnerAboutNewOrder } = require('../services/orderNotificationService');
const { consumeOrderInventory } = require('../services/inventorySaleService');
const { getDomainTimeZone } = require('../services/domainTimeZoneService');

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

        // La entrega de WhatsApp nunca debe impedir que se confirme un pedido válido.
        notifyOwnerAboutNewOrder(savedOrder.toObject()).catch((error) => {
            console.error(`No se pudo notificar el pedido ${savedOrder.orderNumber}:`, error.message);
        });

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

        const { clientName, orderNumber, page = 1, startDate, endDate } = req.query;
        const timeZone = await getDomainTimeZone(domain);

        const filter = { domain };

        if (startDate || endDate) {
            const isValidDate = (value) => typeof value === 'string'
                && /^\d{4}-\d{2}-\d{2}$/.test(value)
                && moment.tz(value, 'YYYY-MM-DD', true, timeZone).isValid();
            if (!isValidDate(startDate) || !isValidDate(endDate) || startDate > endDate) {
                return res.status(400).json({ status: false, message: 'startDate y endDate deben ser fechas válidas YYYY-MM-DD y startDate no puede superar endDate.' });
            }
            filter.createdAt = {
                $gte: moment.tz(startDate, 'YYYY-MM-DD', timeZone).startOf('day').toDate(),
                $lt: moment.tz(endDate, 'YYYY-MM-DD', timeZone).add(1, 'day').startOf('day').toDate(),
            };
        }

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

        // Formatear fechas antes de enviarlas en la respuesta
        const formattedOrders = orders.map(order => ({
            ...order,
            createdAt: moment(order.createdAt).tz(timeZone).format("DD-MM-YYYY"),
            paymentStatus: {
                ...order.paymentStatus,
                date: order.paymentStatus?.date 
                    ? moment(order.paymentStatus.date).tz(timeZone).format("DD-MM-YYYY")
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
        const domain = req.headers['domain'];

        if (!orderId || !domain) {
            return res.status(400).json({ message: "El ID del pedido es requerido." });
        }
        if (!['pending', 'completed', 'failed', 'decline'].includes(typeStatus)) {
            return res.status(400).json({ message: "El estado de pago no es válido." });
        }

        const paymentDate = new Date();

        const updatedOrder = await Order.findOneAndUpdate(
            { _id: orderId, domain },
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

        if (typeStatus === 'completed') {
            try {
                const movements = await consumeOrderInventory(updatedOrder.toObject());
                const inventorySync = {
                    status: 'synced',
                    movementIds: movements.map((movement) => String(movement._id)).filter(Boolean),
                    syncedAt: new Date(),
                    lastError: ''
                };
                await Order.updateOne({ _id: updatedOrder._id, domain }, { $set: { inventorySync } });
                updatedOrder.inventorySync = inventorySync;
            } catch (inventoryError) {
                const inventorySync = {
                    status: 'failed',
                    movementIds: [],
                    lastError: inventoryError.message || 'No fue posible descontar el inventario.'
                };
                await Order.updateOne({ _id: updatedOrder._id, domain }, { $set: { inventorySync } });
                updatedOrder.inventorySync = inventorySync;
                console.error(`Inventario no sincronizado para el pedido ${updatedOrder.orderNumber}:`, inventorySync.lastError);
            }
        }

        res.status(200).json({
            status: true,
            message: "Estado de pago actualizado.",
            data: updatedOrder,
            inventory: updatedOrder.inventorySync
        });
    } catch (error) {
        console.error("Error actualizando estado de pago:", error);
        res.status(500).json({ status: false, message: "Error interno del servidor." });
    }
};

exports.syncInventory = async (req, res) => {
    try {
        const { orderId } = req.params;
        const domain = req.headers['domain'];
        const order = await Order.findOne({ _id: orderId, domain });
        if (!order) return res.status(404).json({ message: 'Pedido no encontrado.' });
        if (order.paymentStatus?.typeStatus !== 'completed') {
            return res.status(409).json({ message: 'Solo se sincronizan pedidos con pago completado.' });
        }

        const movements = await consumeOrderInventory(order.toObject());
        const inventorySync = {
            status: 'synced',
            movementIds: movements.map((movement) => String(movement._id)).filter(Boolean),
            syncedAt: new Date(),
            lastError: ''
        };
        await Order.updateOne({ _id: order._id, domain }, { $set: { inventorySync } });
        res.status(200).json({ status: true, message: 'Inventario sincronizado.', movementIds: inventorySync.movementIds });
    } catch (error) {
        console.error('Error sincronizando inventario del pedido:', error);
        res.status(502).json({ status: false, message: error.message || 'No fue posible sincronizar el inventario.' });
    }
};

exports.updateOrderStatus = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { typeStatus, message } = req.body;

        if (!orderId) {
            return res.status(400).json({ message: "El ID del pedido es requerido." });
        }

        const statusDate = new Date();

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
        const timeZone = await getDomainTimeZone(domain);

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

        if (!moment.tz(startDate, 'YYYY-MM-DD', true, timeZone).isValid() || !moment.tz(endDate, 'YYYY-MM-DD', true, timeZone).isValid()) {
            return res.status(400).json({ 
                status: false, 
                message: 'Las fechas proporcionadas no son válidas. Use el formato YYYY-MM-DD.' 
            });
        }

        startDate = moment.tz(startDate, 'YYYY-MM-DD', timeZone).startOf('day').toDate();
        endDate = moment.tz(endDate, 'YYYY-MM-DD', timeZone).endOf('day').toDate();

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
                        day: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: timeZone } },
                        dayOfWeek: { $dayOfWeek: { date: "$createdAt", timezone: timeZone } }
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

