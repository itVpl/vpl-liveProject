import { Load } from '../models/loadModel.js';
import Bid from '../models/bidModel.js';
import ShipperDriver from '../models/shipper_driverModel.js';
import Tracking from '../models/Tracking.js';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import PDFTable from 'pdfkit-table';

// ✅ Get load board dashboard data
export const getLoadBoardDashboard = async (req, res, next) => {
    try {
        const {
            page = 1,
            limit = 10,
            originCity,
            destinationCity,
            vehicleType,
            minWeight,
            maxWeight,
            minRate,
            maxRate,
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = req.query;

        const filter = { status: { $in: ['Posted', 'Bidding'] } };

        // Apply filters
        if (originCity) {
            filter['origin.city'] = { $regex: originCity, $options: 'i' };
        }
        if (destinationCity) {
            filter['destination.city'] = { $regex: destinationCity, $options: 'i' };
        }
        if (vehicleType) {
            filter.vehicleType = vehicleType;
        }
        if (minWeight || maxWeight) {
            filter.weight = {};
            if (minWeight) filter.weight.$gte = Number(minWeight);
            if (maxWeight) filter.weight.$lte = Number(maxWeight);
        }
        if (minRate || maxRate) {
            filter.rate = {};
            if (minRate) filter.rate.$gte = Number(minRate);
            if (maxRate) filter.rate.$lte = Number(maxRate);
        }

        const sortOptions = {};
        sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

        const loads = await Load.find(filter)
            .populate('shipper', 'compName mc_dot_no city state')
            .sort(sortOptions)
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .exec();

        const total = await Load.countDocuments(filter);

        // Get statistics
        const totalLoads = await Load.countDocuments();
        const postedLoads = await Load.countDocuments({ status: 'Posted' });
        const biddingLoads = await Load.countDocuments({ status: 'Bidding' });
        const assignedLoads = await Load.countDocuments({ status: 'Assigned' });
        const totalBids = await Bid.countDocuments();
        const pendingBids = await Bid.countDocuments({ status: 'Pending' });

        // Get top shippers
        const topShippers = await Load.aggregate([
            { $group: { _id: '$shipper', loadCount: { $sum: 1 } } },
            { $sort: { loadCount: -1 } },
            { $limit: 5 },
            {
                $lookup: {
                    from: 'shipperdrivers',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'shipperInfo'
                }
            },
            { $unwind: '$shipperInfo' },
            { $project: { compName: '$shipperInfo.compName', loadCount: 1 } }
        ]);

        // Get popular routes
        const popularRoutes = await Load.aggregate([
            {
                $group: {
                    _id: {
                        origin: '$origin.city',
                        destination: '$destination.city'
                    },
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } },
            { $limit: 5 }
        ]);

        res.status(200).json({
            success: true,
            loads,
            pagination: {
                totalPages: Math.ceil(total / limit),
                currentPage: page,
                totalLoads: total,
            },
            statistics: {
                totalLoads,
                postedLoads,
                biddingLoads,
                assignedLoads,
                totalBids,
                pendingBids,
            },
            topShippers,
            popularRoutes,
        });
    } catch (error) {
        next(error);
    }
};

// ✅ Get load board filters
export const getLoadBoardFilters = async (req, res, next) => {
    try {
        // Get unique cities for origin and destination
        const originCities = await Load.distinct('origin.city');
        const destinationCities = await Load.distinct('destination.city');
        
        // Get unique vehicle types
        const vehicleTypes = await Load.distinct('vehicleType');
        
        // Get unique commodities
        const commodities = await Load.distinct('commodity');
        
        // Get rate ranges
        const rateStats = await Load.aggregate([
            { $group: { _id: null, minRate: { $min: '$rate' }, maxRate: { $max: '$rate' } } }
        ]);
        
        // Get weight ranges
        const weightStats = await Load.aggregate([
            { $group: { _id: null, minWeight: { $min: '$weight' }, maxWeight: { $max: '$weight' } } }
        ]);

        res.status(200).json({
            success: true,
            filters: {
                originCities: originCities.sort(),
                destinationCities: destinationCities.sort(),
                vehicleTypes: vehicleTypes.sort(),
                commodities: commodities.sort(),
                rateRange: rateStats[0] || { minRate: 0, maxRate: 0 },
                weightRange: weightStats[0] || { minWeight: 0, maxWeight: 0 },
            }
        });
    } catch (error) {
        next(error);
    }
};

// ✅ Get load board analytics
export const getLoadBoardAnalytics = async (req, res, next) => {
    try {
        const { period = '30' } = req.query; // days
        const daysAgo = new Date();
        daysAgo.setDate(daysAgo.getDate() - parseInt(period));

        // Load statistics by status
        const loadStatsByStatus = await Load.aggregate([
            { $match: { createdAt: { $gte: daysAgo } } },
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);

        // Load statistics by vehicle type
        const loadStatsByVehicleType = await Load.aggregate([
            { $match: { createdAt: { $gte: daysAgo } } },
            { $group: { _id: '$vehicleType', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);

        // Bid statistics
        const bidStats = await Bid.aggregate([
            { $match: { createdAt: { $gte: daysAgo } } },
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);

        // Average rate by vehicle type
        const avgRateByVehicleType = await Load.aggregate([
            { $match: { createdAt: { $gte: daysAgo } } },
            { $group: { _id: '$vehicleType', avgRate: { $avg: '$rate' } } },
            { $sort: { avgRate: -1 } }
        ]);

        // Daily load posting trend
        const dailyLoadTrend = await Load.aggregate([
            { $match: { createdAt: { $gte: daysAgo } } },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        res.status(200).json({
            success: true,
            analytics: {
                loadStatsByStatus,
                loadStatsByVehicleType,
                bidStats,
                avgRateByVehicleType,
                dailyLoadTrend,
            }
        });
    } catch (error) {
        next(error);
    }
};

// ✅ Get load board notifications
export const getLoadBoardNotifications = async (req, res, next) => {
    try {
        const userId = req.user._id;
        const user = await ShipperDriver.findById(userId);

        let notifications = [];

        if (user.userType === 'shipper') {
            // Get notifications for shipper
            const shipperLoads = await Load.find({ shipper: userId });
            const loadIds = shipperLoads.map(load => load._id);

            // New bids on shipper's loads
            const newBids = await Bid.find({
                load: { $in: loadIds },
                status: 'Pending',
                createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
            }).populate('carrier', 'compName mc_dot_no');

            notifications = newBids.map(bid => ({
                type: 'new_bid',
                message: `New bid received from ${bid.carrier.compName}`,
                data: bid,
                timestamp: bid.createdAt
            }));
        } else if (user.userType === 'trucker') {
            // Get notifications for trucker
            const truckerBids = await Bid.find({ carrier: userId });

            // Bid status updates
            const recentBidUpdates = await Bid.find({
                carrier: userId,
                $or: [
                    { acceptedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
                    { rejectedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }
                ]
            }).populate('load', 'origin destination commodity');

            notifications = recentBidUpdates.map(bid => ({
                type: bid.status === 'Accepted' ? 'bid_accepted' : 'bid_rejected',
                message: bid.status === 'Accepted' 
                    ? `Your bid was accepted for load from ${bid.load.origin.city} to ${bid.load.destination.city}`
                    : `Your bid was rejected for load from ${bid.load.origin.city} to ${bid.load.destination.city}`,
                data: bid,
                timestamp: bid.acceptedAt || bid.rejectedAt
            }));
        }

        // Sort by timestamp (newest first)
        notifications.sort((a, b) => b.timestamp - a.timestamp);

        res.status(200).json({
            success: true,
            notifications,
            unreadCount: notifications.length,
        });
    } catch (error) {
        next(error);
    }
};

// ✅ Completed Loads Report (all or user-wise)
export const getCompletedLoadsReport = async (req, res, next) => {
    try {
        const { userId, userType } = req.query; // userType: 'shipper' or 'trucker'
        const filter = { status: 'Delivered' };
        if (userId && userType === 'shipper') {
            filter.shipper = userId;
        } else if (userId && userType === 'trucker') {
            filter.assignedTo = userId;
        }
        const loads = await Load.find(filter)
            .populate('shipper', 'compName email')
            .populate('assignedTo', 'compName email')
            .sort({ deliveryDate: -1 });
        res.status(200).json({ success: true, total: loads.length, loads });
    } catch (error) { next(error); }
};

// ✅ Delivery Delays Report
export const getDeliveryDelaysReport = async (req, res, next) => {
    try {
        const { userId, userType } = req.query; // userType: 'shipper' or 'trucker'
        // Find all delivered loads
        const loadFilter = { status: 'Delivered' };
        if (userId && userType === 'shipper') {
            loadFilter.shipper = userId;
        } else if (userId && userType === 'trucker') {
            loadFilter.assignedTo = userId;
        }
        const deliveredLoads = await Load.find(loadFilter);
        // Find delays by comparing Tracking.endedAt with Load.deliveryDate
        const delayedDeliveries = [];
        for (const load of deliveredLoads) {
            const tracking = await Tracking.findOne({ load: load._id });
            if (tracking && tracking.endedAt && load.deliveryDate && tracking.endedAt > load.deliveryDate) {
                delayedDeliveries.push({
                    load,
                    scheduledDelivery: load.deliveryDate,
                    actualDelivery: tracking.endedAt,
                    delayHours: ((tracking.endedAt - load.deliveryDate) / (1000 * 60 * 60)).toFixed(2)
                });
            }
        }
        res.status(200).json({ success: true, total: delayedDeliveries.length, delayedDeliveries });
    } catch (error) { next(error); }
};

// ✅ Completed Loads Report (Excel Export)
export const exportCompletedLoadsExcel = async (req, res, next) => {
    try {
        const { userId, userType } = req.query;
        const filter = { status: 'Delivered' };
        if (userId && userType === 'shipper') {
            filter.shipper = userId;
        } else if (userId && userType === 'trucker') {
            filter.assignedTo = userId;
        }
        const loads = await Load.find(filter)
            .populate('shipper', 'compName email phoneNo city state')
            .populate('assignedTo', 'compName email phoneNo city state')
            .populate('acceptedBid')
            .sort({ deliveryDate: -1 });
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Completed Loads');
        worksheet.columns = [
            { header: 'Shipment Number', key: 'shipmentNumber', width: 20 },
            { header: 'Shipper', key: 'shipper', width: 20 },
            { header: 'Shipper Email', key: 'shipperEmail', width: 24 },
            { header: 'Shipper Phone', key: 'shipperPhone', width: 18 },
            { header: 'Trucker', key: 'trucker', width: 20 },
            { header: 'Trucker Email', key: 'truckerEmail', width: 24 },
            { header: 'Trucker Phone', key: 'truckerPhone', width: 18 },
            { header: 'Driver Name', key: 'driverName', width: 20 },
            { header: 'Driver Phone', key: 'driverPhone', width: 18 },
            { header: 'Vehicle Number', key: 'vehicleNumber', width: 18 },
            { header: 'Origin', key: 'origin', width: 24 },
            { header: 'Destination', key: 'destination', width: 24 },
            { header: 'Pickup Date', key: 'pickupDate', width: 18 },
            { header: 'Delivery Date', key: 'deliveryDate', width: 18 },
            { header: 'Weight', key: 'weight', width: 10 },
            { header: 'Commodity', key: 'commodity', width: 16 },
            { header: 'Vehicle Type', key: 'vehicleType', width: 16 },
            { header: 'Rate', key: 'rate', width: 10 },
            { header: 'Rate Type', key: 'rateType', width: 14 },
            { header: 'Status', key: 'status', width: 14 },
        ];
        loads.forEach(load => {
            worksheet.addRow({
                shipmentNumber: load.shipmentNumber || '',
                shipper: load.shipper?.compName || '',
                shipperEmail: load.shipper?.email || '',
                shipperPhone: load.shipper?.phoneNo || '',
                trucker: load.assignedTo?.compName || '',
                truckerEmail: load.assignedTo?.email || '',
                truckerPhone: load.assignedTo?.phoneNo || '',
                driverName: load.acceptedBid?.driverName || '',
                driverPhone: load.acceptedBid?.driverPhone || '',
                vehicleNumber: load.acceptedBid?.vehicleNumber || '',
                origin: `${load.origin?.city || ''}, ${load.origin?.state || ''}`,
                destination: `${load.destination?.city || ''}, ${load.destination?.state || ''}`,
                pickupDate: load.pickupDate ? new Date(load.pickupDate).toLocaleString() : '',
                deliveryDate: load.deliveryDate ? new Date(load.deliveryDate).toLocaleString() : '',
                weight: load.weight,
                commodity: load.commodity,
                vehicleType: load.vehicleType,
                rate: load.rate,
                rateType: load.rateType,
                status: load.status,
            });
        });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="completed_loads.xlsx"');
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) { next(error); }
};

// ✅ Delivery Delays Report (Excel Export)
export const exportDeliveryDelaysExcel = async (req, res, next) => {
    try {
        const { userId, userType } = req.query;
        const loadFilter = { status: 'Delivered' };
        if (userId && userType === 'shipper') {
            loadFilter.shipper = userId;
        } else if (userId && userType === 'trucker') {
            loadFilter.assignedTo = userId;
        }
        const deliveredLoads = await Load.find(loadFilter)
            .populate('shipper', 'compName email')
            .populate('assignedTo', 'compName email');
        const delayedDeliveries = [];
        for (const load of deliveredLoads) {
            const tracking = await Tracking.findOne({ load: load._id });
            if (tracking && tracking.endedAt && load.deliveryDate && tracking.endedAt > load.deliveryDate) {
                delayedDeliveries.push({
                    load,
                    scheduledDelivery: load.deliveryDate,
                    actualDelivery: tracking.endedAt,
                    delayHours: ((tracking.endedAt - load.deliveryDate) / (1000 * 60 * 60)).toFixed(2)
                });
            }
        }
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Delivery Delays');
        worksheet.columns = [
            { header: 'Shipment Number', key: 'shipmentNumber', width: 20 },
            { header: 'Shipper', key: 'shipper', width: 20 },
            { header: 'Trucker', key: 'trucker', width: 20 },
            { header: 'Origin', key: 'origin', width: 20 },
            { header: 'Destination', key: 'destination', width: 20 },
            { header: 'Scheduled Delivery', key: 'scheduled', width: 22 },
            { header: 'Actual Delivery', key: 'actual', width: 22 },
            { header: 'Delay (hours)', key: 'delay', width: 16 },
        ];
        delayedDeliveries.forEach(item => {
            worksheet.addRow({
                shipmentNumber: item.load.shipmentNumber || '',
                shipper: item.load.shipper?.compName || '',
                trucker: item.load.assignedTo?.compName || '',
                origin: `${item.load.origin?.city || ''}, ${item.load.origin?.state || ''}`,
                destination: `${item.load.destination?.city || ''}, ${item.load.destination?.state || ''}`,
                scheduled: item.scheduledDelivery ? new Date(item.scheduledDelivery).toLocaleString() : '',
                actual: item.actualDelivery ? new Date(item.actualDelivery).toLocaleString() : '',
                delay: item.delayHours,
            });
        });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="delivery_delays.xlsx"');
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) { next(error); }
};

export const exportCompletedLoadsPDF = async (req, res, next) => {
    try {
        const { userId, userType } = req.query;
        const filter = { status: 'Delivered' };
        if (userId && userType === 'shipper') {
            filter.shipper = userId;
        } else if (userId && userType === 'trucker') {
            filter.assignedTo = userId;
        }
        const loads = await Load.find(filter)
            .populate('shipper', 'compName email phoneNo city state')
            .populate('assignedTo', 'compName email phoneNo city state')
            .populate('acceptedBid')
            .sort({ deliveryDate: -1 });
        const doc = new PDFDocument({ margin: 20, size: 'A4', layout: 'landscape' });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="completed_loads.pdf"');
        doc.fontSize(20).text('Completed Loads Report', { align: 'center', underline: true });
        doc.moveDown(1.5);
        // Prepare table data
        const table = {
            headers: [
                'Shipment No', 'Shipper', 'Trucker', 'Driver', 'Origin', 'Destination',
                'Pickup Date', 'Delivery Date', 'Weight', 'Commodity', 'Vehicle Type',
                'Rate', 'Rate Type', 'Status'
            ],
            rows: loads.map(load => [
                load.shipmentNumber || '',
                load.shipper?.compName || '',
                load.assignedTo?.compName || '',
                load.acceptedBid?.driverName || '',
                `${load.origin?.city || ''}, ${load.origin?.state || ''}`,
                `${load.destination?.city || ''}, ${load.destination?.state || ''}`,
                load.pickupDate ? new Date(load.pickupDate).toLocaleDateString() : '',
                load.deliveryDate ? new Date(load.deliveryDate).toLocaleDateString() : '',
                load.weight,
                load.commodity,
                load.vehicleType,
                load.rate,
                load.rateType,
                load.status
            ])
        };
        await doc.table(table, {
            prepareHeader: () => doc.font('Helvetica-Bold').fontSize(10),
            prepareRow: (row, i) => doc.font('Helvetica').fontSize(9).fillColor(i % 2 ? '#444' : '#000'),
            padding: 4,
            columnSpacing: 4,
            width: doc.page.width - 40
        });
        doc.end();
        doc.pipe(res);
    } catch (error) { next(error); }
};

export const exportDeliveryDelaysPDF = async (req, res, next) => {
    try {
        const { userId, userType } = req.query;
        const loadFilter = { status: 'Delivered' };
        if (userId && userType === 'shipper') {
            loadFilter.shipper = userId;
        } else if (userId && userType === 'trucker') {
            loadFilter.assignedTo = userId;
        }
        const deliveredLoads = await Load.find(loadFilter)
            .populate('shipper', 'compName email phoneNo city state')
            .populate('assignedTo', 'compName email phoneNo city state')
            .populate('acceptedBid');
        const delayedDeliveries = [];
        for (const load of deliveredLoads) {
            const tracking = await Tracking.findOne({ load: load._id });
            if (tracking && tracking.endedAt && load.deliveryDate && tracking.endedAt > load.deliveryDate) {
                delayedDeliveries.push({
                    load,
                    scheduledDelivery: load.deliveryDate,
                    actualDelivery: tracking.endedAt,
                    delayHours: ((tracking.endedAt - load.deliveryDate) / (1000 * 60 * 60)).toFixed(2)
                });
            }
        }
        const doc = new PDFDocument({ margin: 20, size: 'A4', layout: 'landscape' });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="delivery_delays.pdf"');
        doc.fontSize(20).text('Delivery Delays Report', { align: 'center', underline: true });
        doc.moveDown(1.5);
        // Prepare table data
        const table = {
            headers: [
                'Shipment No', 'Shipper', 'Trucker', 'Driver', 'Origin', 'Destination',
                'Scheduled Delivery', 'Actual Delivery', 'Delay (hours)',
                'Weight', 'Commodity', 'Vehicle Type', 'Rate', 'Rate Type', 'Status'
            ],
            rows: delayedDeliveries.map(item => [
                item.load.shipmentNumber || '',
                item.load.shipper?.compName || '',
                item.load.assignedTo?.compName || '',
                item.load.acceptedBid?.driverName || '',
                `${item.load.origin?.city || ''}, ${item.load.origin?.state || ''}`,
                `${item.load.destination?.city || ''}, ${item.load.destination?.state || ''}`,
                item.scheduledDelivery ? new Date(item.scheduledDelivery).toLocaleDateString() : '',
                item.actualDelivery ? new Date(item.actualDelivery).toLocaleDateString() : '',
                item.delayHours,
                item.load.weight,
                item.load.commodity,
                item.load.vehicleType,
                item.load.rate,
                item.load.rateType,
                item.load.status
            ])
        };
        await doc.table(table, {
            prepareHeader: () => doc.font('Helvetica-Bold').fontSize(10),
            prepareRow: (row, i) => doc.font('Helvetica').fontSize(9).fillColor(i % 2 ? '#444' : '#000'),
            padding: 4,
            columnSpacing: 4,
            width: doc.page.width - 40
        });
        doc.end();
        doc.pipe(res);
    } catch (error) { next(error); }
}; 