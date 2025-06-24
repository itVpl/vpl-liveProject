import { Load } from '../models/loadModel.js';
import Bid from '../models/bidModel.js';
import ShipperDriver from '../models/shipper_driverModel.js';

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